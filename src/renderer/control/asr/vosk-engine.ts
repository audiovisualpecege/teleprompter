/**
 * Motor Vosk (ADR-007): o modelo pequeno em português roda em WebAssembly no Worker do
 * `vosk-browser` (`vosk-worker.ts`), dentro da janela de controle, com a gramática
 * restrita às palavras do roteiro mais `[unk]`. Cada pedaço de áudio enviado gera um
 * resultado (parcial ou final), na mesma ordem; por isso o fim do áudio de cada
 * hipótese sai de uma fila.
 *
 * O Worker é aberto de um arquivo do programa, não de blob (veja `vosk-worker.ts`), e
 * fala o protocolo de mensagens do `vosk-browser`. O modelo é lido do próprio
 * computador (protocolo `tp-model:` servido pelo principal), nunca da internet.
 */
import {
  Listeners,
  epochNow,
  splitWords,
  type AudioSource,
  type EngineFault,
  type Hypothesis,
  type PcmChunk,
  type SpeechEngine,
} from './engine';

/** Endereço do modelo Vosk servido pelo principal a partir de `resources/models/`. */
export const VOSK_MODEL_URL = 'tp-model://models/vosk-model-small-pt-0.3.tar.gz';

interface VoskMessage {
  event?: string;
  recognizerId?: string;
  result?: { partial?: string; text?: string } | boolean;
  error?: string;
}

type ResultPayload = { partial?: string; text?: string };

/** O que o motor usa de um reconhecedor (o `KaldiRecognizer` do `vosk-browser`). */
export interface VoskRecognizerLike {
  on(event: 'result' | 'partialresult' | 'error', listener: (message: { result?: ResultPayload; error?: string }) => void): void;
  acceptWaveformFloat(buffer: Float32Array, sampleRate: number): void;
  remove(): void;
}

/** O que o motor usa do modelo carregado no Worker. */
export interface VoskModelLike {
  KaldiRecognizer: new (sampleRate: number, grammar?: string) => VoskRecognizerLike;
  on(event: 'load' | 'error', listener: (message: { error?: string }) => void): void;
  terminate(): void;
}

export interface VoskDeps {
  /** Carrega o modelo e liga `onWorkerError` aos erros do Worker. */
  loadModel(onWorkerError: (detail: string) => void): Promise<VoskModelLike>;
  now(): number;
}

/** Fala com o Worker do `vosk-browser` pelo protocolo de mensagens dele. */
export function openVoskWorker(worker: Worker, modelUrl: string, onWorkerError: (d: string) => void): Promise<VoskModelLike> {
  const recognizers = new Map<string, Map<string, (m: { result?: ResultPayload; error?: string }) => void>>();
  const modelHandlers = new Map<string, (m: { error?: string }) => void>();
  let seq = 0;
  return new Promise((resolve, reject) => {
    let loaded = false;
    worker.addEventListener('error', (e) => {
      const detail = e.message || 'erro no Worker do Vosk';
      if (!loaded) reject(new Error(detail));
      onWorkerError(detail);
    });
    worker.addEventListener('message', (e: MessageEvent<VoskMessage>) => {
      const m = e.data;
      if (!m) return;
      if (m.event === 'load') {
        loaded = true;
        if (m.result === true) resolve(model);
        else reject(new Error('O modelo Vosk não carregou'));
        return;
      }
      const rec = m.recognizerId ? recognizers.get(m.recognizerId) : undefined;
      if (rec) {
        rec.get(m.event ?? '')?.({ result: m.result as ResultPayload, error: m.error });
        return;
      }
      if (m.event === 'error') {
        if (!loaded) reject(new Error(m.error ?? 'erro no Vosk'));
        else modelHandlers.get('error')?.({ error: m.error });
      }
    });
    const model: VoskModelLike = {
      KaldiRecognizer: class implements VoskRecognizerLike {
        private readonly id = `r${++seq}`;
        constructor(sampleRate: number, grammar?: string) {
          recognizers.set(this.id, new Map());
          worker.postMessage({ action: 'create', recognizerId: this.id, sampleRate, grammar });
        }
        on(event: 'result' | 'partialresult' | 'error', l: (m: { result?: ResultPayload; error?: string }) => void): void {
          recognizers.get(this.id)?.set(event, l);
        }
        acceptWaveformFloat(buffer: Float32Array, sampleRate: number): void {
          // O Kaldi espera amostras na faixa de 16 bits, como o vosk-browser faz.
          const data = buffer.map((v) => v * 0x8000);
          worker.postMessage({ action: 'audioChunk', recognizerId: this.id, data, sampleRate }, [data.buffer]);
        }
        remove(): void {
          recognizers.delete(this.id);
          worker.postMessage({ action: 'remove', recognizerId: this.id });
        }
      },
      on: (event, l) => {
        modelHandlers.set(event, l);
      },
      terminate: () => worker.terminate(),
    };
    worker.postMessage({ action: 'set', key: 'logLevel', value: -1 });
    worker.postMessage({ action: 'load', modelUrl });
  });
}

/** Carregamento real: abre o Worker do arquivo `workerUrl` e carrega o modelo. */
export function voskDeps(workerUrl: string, modelUrl = VOSK_MODEL_URL): VoskDeps {
  return {
    now: epochNow,
    loadModel: (onWorkerError) => openVoskWorker(new Worker(workerUrl), modelUrl, onWorkerError),
  };
}

export class VoskEngine implements SpeechEngine {
  readonly id = 'vosk' as const;
  private model: VoskModelLike | null = null;
  private recognizer: VoskRecognizerLike | null = null;
  private input: AudioSource | null = null;
  private unsubscribeInput: (() => void) | null = null;
  /** Fim do áudio de cada pedaço enviado e ainda sem resultado. */
  private pending: number[] = [];
  private lastText: string | null = null;
  private crashed = false;
  private readonly hyp = new Listeners<[Hypothesis]>();
  private readonly fault = new Listeners<[EngineFault, string | undefined]>();
  private readonly lag = new Listeners<[number]>();

  constructor(private readonly deps: VoskDeps) {}

  async load(): Promise<void> {
    if (this.model) return;
    this.crashed = false;
    try {
      const model = await this.deps.loadModel((detail) => this.crash(detail));
      model.on('error', (m) => this.crash(m.error ?? 'erro no modelo Vosk'));
      this.model = model;
    } catch (e) {
      this.crash(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }

  async start(input: AudioSource, vocabulary: string[]): Promise<void> {
    if (!this.model) await this.load();
    this.input = input;
    this.createRecognizer(vocabulary);
    this.unsubscribeInput?.();
    this.unsubscribeInput = input.onPcm((chunk) => this.feed(chunk));
  }

  setVocabulary(vocabulary: string[]): void {
    if (!this.model || !this.input) return;
    this.createRecognizer(vocabulary);
  }

  async stop(): Promise<void> {
    this.unsubscribeInput?.();
    this.unsubscribeInput = null;
    this.input = null;
    this.removeRecognizer();
  }

  /** Desliga o Worker de vez (troca de motor ou fim do programa). */
  dispose(): void {
    void this.stop();
    this.model?.terminate();
    this.model = null;
  }

  onHypothesis(cb: (h: Hypothesis) => void): () => void {
    return this.hyp.add(cb);
  }

  onFault(cb: (f: EngineFault, detail?: string) => void): () => void {
    return this.fault.add(cb);
  }

  onLag(cb: (lagMs: number) => void): () => void {
    return this.lag.add(cb);
  }

  private createRecognizer(vocabulary: string[]): void {
    if (!this.model) return;
    this.removeRecognizer();
    const grammar = JSON.stringify(vocabulary.includes('[unk]') ? vocabulary : [...vocabulary, '[unk]']);
    const rec = new this.model.KaldiRecognizer(16000, grammar);
    rec.on('partialresult', (m) => this.onResult(rec, m.result?.partial, false));
    rec.on('result', (m) => this.onResult(rec, m.result?.text, true));
    // Um pedaço que o Worker não processou: só sai da fila.
    rec.on('error', () => {
      if (rec === this.recognizer) this.pending.shift();
    });
    this.recognizer = rec;
  }

  private removeRecognizer(): void {
    const rec = this.recognizer;
    this.recognizer = null;
    this.pending = [];
    this.lastText = null;
    if (rec) {
      try {
        rec.remove();
      } catch {
        /* O Worker já pode ter sido desligado. */
      }
    }
  }

  private feed(chunk: PcmChunk): void {
    const rec = this.recognizer;
    if (!rec || this.crashed) return;
    this.pending.push(chunk.endMs);
    // O vosk-browser transfere o buffer: manda uma cópia para não esvaziar o de quem chamou.
    rec.acceptWaveformFloat(chunk.samples.slice(), 16000);
  }

  private onResult(rec: VoskRecognizerLike, text: string | undefined, final: boolean): void {
    if (rec !== this.recognizer) return;
    const audioEndMs = this.pending.shift();
    if (audioEndMs === undefined) return;
    this.lag.emit(Math.max(0, this.deps.now() - audioEndMs));
    const words = splitWords(text);
    const key = `${final ? 'f' : 'p'}:${words.join(' ')}`;
    // Parciais repetidos (silêncio, a mesma palavra ainda sendo dita) não geram hipótese nova.
    if (words.length === 0 || key === this.lastText) {
      if (final) this.lastText = null;
      return;
    }
    this.lastText = final ? null : key;
    this.hyp.emit({ words, final, audioEndMs });
  }

  private crash(detail: string): void {
    if (this.crashed) return;
    this.crashed = true;
    // O próximo `load()` cria um Worker novo (reiniciar o motor).
    this.removeRecognizer();
    try {
      this.model?.terminate();
    } catch {
      /* Worker já morto. */
    }
    this.model = null;
    this.fault.emit('engine-crashed', detail);
  }
}
