/**
 * Página do banco de medição da voz: toca uma fixture WAV em tempo real para um motor
 * real (Vosk no Worker do vosk-browser, ou Parakeet no utilityProcess), passa cada
 * hipótese pelo alinhador e devolve, para o teste, quando o cursor chegou a cada token.
 */
import { buildSpokenVocabulary } from '@shared/text';
import type { VoiceMode } from '@shared/types';
import { buildScriptTokens, track } from '../../../src/main/voice-tracker';
import { epochNow, type AudioSource, type PcmChunk, type SpeechEngine } from '../../../src/renderer/control/asr/engine';
import { ParakeetEngine, type ParakeetLink } from '../../../src/renderer/control/asr/parakeet-engine';
import { VoskEngine, voskDeps } from '../../../src/renderer/control/asr/vosk-engine';
import { AudioCapture, browserCaptureDeps } from '../../../src/renderer/control/audio/capture';
import { resample } from '../../../src/renderer/control/audio/dsp';
import type { AsrPcmResponse } from '@shared/ipc';
import { parseWav } from './wav';

export interface HarnessConfig {
  engine: 'vosk' | 'parakeet';
  mode: VoiceMode;
  fixture: string;
  roteiro: string;
  tailMs: number;
  /** `mic`: o microfone falso do Chromium toca a fixture e passa pelo AudioCapture real. */
  source?: 'wav' | 'mic';
}

export interface HarnessResult {
  ok: boolean;
  error?: string;
  loadMs: number;
  t0: number;
  durationMs: number;
  tokens: number;
  events: { cursor: number; t: number; jumped: boolean }[];
  lags: number[];
  hypotheses: { partial: number; final: number };
  /** Cada hipótese do motor, com o instante (relógio de `epochNow`), para repetir no `VoiceController`. */
  heard: { t: number; words: string[]; final: boolean }[];
  faults: string[];
}

interface HarnessBridge {
  config(): Promise<HarnessConfig>;
  wantPort(): void;
  done(json: string): void;
}

const harness = (window as unknown as { harness: HarnessBridge }).harness;

/** Toca o WAV em pedaços de 100 ms no ritmo do relógio, como o microfone faria. */
class WavSource implements AudioSource {
  readonly sampleRate = 16000 as const;
  private readonly cbs = new Set<(c: PcmChunk) => void>();
  constructor(private readonly samples: Float32Array) {}
  onPcm(cb: (c: PcmChunk) => void): () => void {
    this.cbs.add(cb);
    return () => {
      this.cbs.delete(cb);
    };
  }
  play(t0: number): Promise<void> {
    const chunk = 1600;
    let next = 0;
    return new Promise((resolve) => {
      const tick = (): void => {
        const due = Math.floor(((epochNow() - t0) / 1000) * 16000);
        while (next + chunk <= due && next < this.samples.length) {
          const samples = this.samples.slice(next, Math.min(next + chunk, this.samples.length));
          next += chunk;
          const endMs = epochNow();
          for (const cb of this.cbs) cb({ samples, endMs });
        }
        if (next >= this.samples.length) resolve();
        else setTimeout(tick, 20);
      };
      tick();
    });
  }
}

function parakeetLink(): Promise<ParakeetLink> {
  return new Promise((resolve) => {
    const exits = new Set<(c: number | null) => void>();
    window.addEventListener('message', (e: MessageEvent) => {
      if (e.data === 'harness:port' && e.ports[0]) {
        const port = e.ports[0];
        const msgs = new Set<(m: AsrPcmResponse) => void>();
        port.onmessage = (ev) => {
          for (const cb of msgs) cb(ev.data as AsrPcmResponse);
        };
        resolve({
          post: (m, transfer) => port.postMessage(m, transfer ?? []),
          onMessage: (cb) => {
            msgs.add(cb);
            return () => {
              msgs.delete(cb);
            };
          },
          onExit: (cb) => {
            exits.add(cb);
            return () => {
              exits.delete(cb);
            };
          },
          close: () => port.close(),
        });
      } else if (e.data?.type === 'harness:exit') {
        for (const cb of exits) cb(null);
      }
    });
    harness.wantPort();
  });
}

async function run(): Promise<HarnessResult> {
  const cfg = await harness.config();
  const result: HarnessResult = {
    ok: false,
    loadMs: 0,
    t0: 0,
    durationMs: 0,
    tokens: 0,
    events: [],
    lags: [],
    hypotheses: { partial: 0, final: 0 },
    heard: [],
    faults: [],
  };
  const roteiro = await (await fetch(`tp-fixture://f/${cfg.roteiro}`)).text();
  const tokens = buildScriptTokens(roteiro, [{ start: 0, end: roteiro.length }]);
  result.tokens = tokens.length;
  const wav = parseWav(await (await fetch(`tp-fixture://f/${cfg.fixture}`)).arrayBuffer());
  const samples = wav.rate === 16000 ? wav.samples : resample(wav.samples, wav.rate);
  result.durationMs = (samples.length / 16000) * 1000;

  const engine: SpeechEngine =
    cfg.engine === 'vosk'
      ? new VoskEngine(voskDeps(new URL('./vosk-worker.js', location.href).href))
      : new ParakeetEngine({ connect: parakeetLink, now: epochNow });
  let cursor = 0;
  engine.onFault((f, d) => result.faults.push(`${f}: ${d ?? ''}`));
  engine.onLag((l) => result.lags.push(l));
  engine.onHypothesis((h) => {
    result.hypotheses[h.final ? 'final' : 'partial']++;
    result.heard.push({ t: epochNow(), words: h.words, final: h.final });
    const r = track({ tokens, cursor, mode: cfg.mode, heard: h.words });
    if (r.cursor > cursor) {
      cursor = r.cursor;
      result.events.push({ cursor, t: epochNow(), jumped: r.jumped });
    }
  });
  const l0 = epochNow();
  await engine.load();
  result.loadMs = epochNow() - l0;
  if (cfg.source === 'mic') {
    const capture = new AudioCapture(browserCaptureDeps(new URL('./pcm-worklet.js', location.href).href));
    capture.onFault((f, d) => result.faults.push(`${f}: ${d ?? ''}`));
    await engine.start(capture, buildSpokenVocabulary(roteiro));
    const fault = await capture.start(null);
    if (fault) throw new Error(`captura: ${fault}`);
    result.t0 = epochNow();
    await new Promise((r) => setTimeout(r, result.durationMs));
    await capture.stop();
  } else {
    const source = new WavSource(samples);
    await engine.start(source, buildSpokenVocabulary(roteiro));
    result.t0 = epochNow();
    await source.play(result.t0);
  }
  await new Promise((r) => setTimeout(r, cfg.tailMs));
  await engine.stop();
  result.ok = true;
  return result;
}

run()
  .then((r) => harness.done(JSON.stringify(r)))
  .catch((e: unknown) =>
    harness.done(JSON.stringify({ ok: false, error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })),
  );
