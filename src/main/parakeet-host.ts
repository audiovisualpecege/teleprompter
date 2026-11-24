/**
 * ParakeetHost (TechSpec, "Voz"; ADR-007): roda num `utilityProcess` separado e só é
 * carregado quando o Parakeet está ativo. Recebe o áudio da janela de controle pelo
 * `MessagePort` do canal `asr:pcm`, guarda os últimos 3 s e decodifica essa janela
 * deslizante com o Parakeet v3 (`sherpa-onnx-node`) a cada 600 ms. Quando a
 * decodificação demora mais que o intervalo, o intervalo cresce até o tempo dela, para
 * o processo não acumular trabalho; quando ela volta a ser rápida, ele volta a 600 ms.
 *
 * O Silero VAD evita decodificar silêncio. Nada sai do computador.
 */
import { join } from 'node:path';
import type { AsrPcmRequest, AsrPcmResponse } from '@shared/ipc';

export const PARAKEET_WINDOW_MS = 3000;
export const PARAKEET_BASE_INTERVAL_MS = 600;
/** Teto do intervalo: acima disso o atraso já passou do limite de "lento demais". */
export const PARAKEET_MAX_INTERVAL_MS = 3000;
export const PARAKEET_SAMPLE_RATE = 16000;
export const PARAKEET_MODEL_FOLDER = 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8';
export const SILERO_VAD_FILE = 'silero_vad.onnx';

/** Decodifica um trecho de áudio e devolve o texto. */
export interface Decoder {
  decode(samples: Float32Array): Promise<string>;
}

/** Diz se houve fala no pedaço de áudio recebido. */
export interface SpeechDetector {
  accept(samples: Float32Array): boolean;
}

export interface HostClock {
  now(): number;
  setTimeout(cb: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface ParakeetHostOptions {
  decoder: Decoder;
  send(message: AsrPcmResponse): void;
  vad?: SpeechDetector;
  clock?: HostClock;
  windowMs?: number;
  baseIntervalMs?: number;
  maxIntervalMs?: number;
}

const realClock: HostClock = {
  now: () => performance.now(),
  setTimeout: (cb, ms) => setTimeout(cb, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export class ParakeetHost {
  private chunks: { samples: Float32Array; endMs: number }[] = [];
  private samplesInWindow = 0;
  private lastSpeechEndMs = -Infinity;
  private lastDecodedEndMs = -Infinity;
  private timer: unknown = null;
  private running = false;
  private decoding = false;
  private _intervalMs: number;
  private readonly clock: HostClock;
  private readonly windowSamples: number;

  constructor(private readonly o: ParakeetHostOptions) {
    this.clock = o.clock ?? realClock;
    this._intervalMs = o.baseIntervalMs ?? PARAKEET_BASE_INTERVAL_MS;
    this.windowSamples = Math.round(((o.windowMs ?? PARAKEET_WINDOW_MS) / 1000) * PARAKEET_SAMPLE_RATE);
  }

  /** Intervalo atual entre decodificações, em ms. */
  get intervalMs(): number {
    return this._intervalMs;
  }

  push(samples: Float32Array, endMs: number): void {
    if (!(samples instanceof Float32Array) || samples.length === 0) return;
    this.chunks.push({ samples, endMs });
    this.samplesInWindow += samples.length;
    while (this.chunks.length > 1 && this.samplesInWindow - this.chunks[0].samples.length >= this.windowSamples) {
      this.samplesInWindow -= this.chunks.shift()!.samples.length;
    }
    if (!this.o.vad || this.o.vad.accept(samples)) this.lastSpeechEndMs = endMs;
  }

  /** Esvazia o áudio guardado (a voz parou ou o motor foi desligado). */
  reset(): void {
    this.chunks = [];
    this.samplesInWindow = 0;
    this.lastSpeechEndMs = -Infinity;
    this.lastDecodedEndMs = -Infinity;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Uma rodada: decodifica a janela se houver áudio novo com fala, e ajusta o intervalo. */
  async tick(): Promise<void> {
    if (this.decoding) return;
    const last = this.chunks.at(-1);
    if (!last || last.endMs <= this.lastDecodedEndMs) return;
    const windowStartMs = last.endMs - (this.samplesInWindow / PARAKEET_SAMPLE_RATE) * 1000;
    if (this.lastSpeechEndMs <= windowStartMs) return;
    const audio = new Float32Array(this.samplesInWindow);
    let offset = 0;
    for (const c of this.chunks) {
      audio.set(c.samples, offset);
      offset += c.samples.length;
    }
    const audioEndMs = last.endMs;
    this.lastDecodedEndMs = audioEndMs;
    this.decoding = true;
    const t0 = this.clock.now();
    try {
      const text = await this.o.decoder.decode(audio);
      const words = text.split(/\s+/).filter(Boolean);
      this.o.send({ words, final: false, audioEndMs });
    } catch (e) {
      this.o.send({ fault: 'engine-crashed', detail: e instanceof Error ? e.message : String(e) });
      this.stop();
    } finally {
      this.decoding = false;
      const elapsed = this.clock.now() - t0;
      const base = this.o.baseIntervalMs ?? PARAKEET_BASE_INTERVAL_MS;
      const max = this.o.maxIntervalMs ?? PARAKEET_MAX_INTERVAL_MS;
      this._intervalMs = Math.min(max, Math.max(base, Math.round(elapsed)));
    }
  }

  private schedule(): void {
    if (!this.running) return;
    this.timer = this.clock.setTimeout(() => {
      void this.tick().finally(() => this.schedule());
    }, this._intervalMs);
  }
}

/* ---------- sherpa-onnx-node ---------- */

interface SherpaStream {
  acceptWaveform(o: { samples: Float32Array; sampleRate: number }): void;
}
interface SherpaRecognizer {
  createStream(): SherpaStream;
  decodeAsync(stream: SherpaStream): Promise<{ text: string }>;
}
interface SherpaVad {
  acceptWaveform(samples: Float32Array): void;
  isDetected(): boolean;
  isEmpty(): boolean;
  pop(): void;
}
interface SherpaModule {
  OfflineRecognizer: { createAsync(config: unknown): Promise<SherpaRecognizer> };
  Vad: new (config: unknown, bufferSizeInSeconds: number) => SherpaVad;
}

const VAD_WINDOW = 512;

/** Cria o decodificador e o VAD reais a partir da pasta de modelos. */
export async function createSherpaDecoder(modelsDir: string): Promise<{ decoder: Decoder; vad: SpeechDetector }> {
  const sherpa = (await import('sherpa-onnx-node')) as unknown as SherpaModule & { default?: SherpaModule };
  const mod: SherpaModule = sherpa.OfflineRecognizer ? sherpa : sherpa.default!;
  const dir = join(modelsDir, PARAKEET_MODEL_FOLDER);
  const recognizer = await mod.OfflineRecognizer.createAsync({
    featConfig: { sampleRate: PARAKEET_SAMPLE_RATE, featureDim: 80 },
    modelConfig: {
      transducer: {
        encoder: join(dir, 'encoder.int8.onnx'),
        decoder: join(dir, 'decoder.int8.onnx'),
        joiner: join(dir, 'joiner.int8.onnx'),
      },
      tokens: join(dir, 'tokens.txt'),
      modelType: 'nemo_transducer',
      numThreads: 2,
      provider: 'cpu',
      debug: 0,
    },
    decodingMethod: 'greedy_search',
  });
  const vad = new mod.Vad(
    {
      sileroVad: {
        model: join(modelsDir, SILERO_VAD_FILE),
        threshold: 0.5,
        minSilenceDuration: 0.25,
        minSpeechDuration: 0.1,
        windowSize: VAD_WINDOW,
      },
      sampleRate: PARAKEET_SAMPLE_RATE,
      numThreads: 1,
      debug: 0,
    },
    10,
  );
  let pending = new Float32Array(0);
  return {
    decoder: {
      async decode(samples) {
        const stream = recognizer.createStream();
        stream.acceptWaveform({ samples, sampleRate: PARAKEET_SAMPLE_RATE });
        return (await recognizer.decodeAsync(stream)).text ?? '';
      },
    },
    vad: {
      accept(samples) {
        const all = new Float32Array(pending.length + samples.length);
        all.set(pending);
        all.set(samples, pending.length);
        let speech = false;
        let i = 0;
        for (; i + VAD_WINDOW <= all.length; i += VAD_WINDOW) {
          vad.acceptWaveform(all.subarray(i, i + VAD_WINDOW));
          speech ||= vad.isDetected();
        }
        pending = all.slice(i);
        while (!vad.isEmpty()) vad.pop();
        return speech;
      },
    },
  };
}

/* ---------- Processo ---------- */

/** Mensagem do principal ao abrir o processo; a porta do `asr:pcm` vai junto. */
export interface ParakeetInit {
  type: 'init';
  modelsDir: string;
}

interface PortLike {
  on(event: 'message', cb: (e: { data: AsrPcmRequest }) => void): void;
  postMessage(message: AsrPcmResponse): void;
  start(): void;
}

interface ParentPortLike {
  on(event: 'message', cb: (e: { data: ParakeetInit; ports: PortLike[] }) => void): void;
}

/** Corpo do `utilityProcess`: espera a porta, carrega o modelo e atende o `asr:pcm`. */
export function runParakeetProcess(parentPort: ParentPortLike): void {
  let started = false;
  parentPort.on('message', (e) => {
    if (started || e.data?.type !== 'init' || !e.ports?.[0]) return;
    started = true;
    const port = e.ports[0];
    let host: ParakeetHost | null = null;
    port.on('message', (ev) => {
      const m = ev.data;
      if (!host || !m) return;
      if ('pcm' in m) host.push(m.pcm, m.endMs);
      else if ('stop' in m) host.reset();
    });
    port.start();
    createSherpaDecoder(e.data.modelsDir)
      .then(({ decoder, vad }) => {
        host = new ParakeetHost({ decoder, vad, send: (msg) => port.postMessage(msg) });
        host.start();
        port.postMessage({ ready: true });
      })
      .catch((err: unknown) => {
        port.postMessage({ fault: 'engine-crashed', detail: err instanceof Error ? err.message : String(err) });
      });
  });
}

const parentPort = (process as unknown as { parentPort?: ParentPortLike }).parentPort;
if (parentPort) runParakeetProcess(parentPort);
