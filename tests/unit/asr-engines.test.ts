import { describe, expect, it, vi } from 'vitest';
import type { AsrPcmRequest, AsrPcmResponse } from '@shared/ipc';
import type { AudioSource, PcmChunk } from '../../src/renderer/control/asr/engine';
import { ParakeetEngine, type ParakeetLink } from '../../src/renderer/control/asr/parakeet-engine';
import {
  VoskEngine,
  type VoskModelLike,
  type VoskRecognizerLike,
} from '../../src/renderer/control/asr/vosk-engine';
import { ParakeetHost, type HostClock } from '../../src/main/parakeet-host';
import { launchParakeet, type UtilityProcessLike } from '../../src/main/parakeet-process';
import { LagLog, percentile } from '../../src/main/voice-log';

class FakeSource implements AudioSource {
  readonly sampleRate = 16000 as const;
  private cbs = new Set<(c: PcmChunk) => void>();
  onPcm(cb: (c: PcmChunk) => void): () => void {
    this.cbs.add(cb);
    return () => this.cbs.delete(cb);
  }
  push(endMs: number): void {
    for (const cb of this.cbs) cb({ samples: new Float32Array(1600), endMs });
  }
}

type Handler = (m: { result?: { partial?: string; text?: string }; error?: string }) => void;

class FakeRecognizer implements VoskRecognizerLike {
  handlers: Record<string, Handler> = {};
  fed = 0;
  removed = false;
  constructor(
    readonly sampleRate: number,
    readonly grammar?: string,
  ) {}
  on(event: string, l: Handler): void {
    this.handlers[event] = l;
  }
  acceptWaveformFloat(): void {
    this.fed++;
  }
  remove(): void {
    this.removed = true;
  }
}

function fakeVosk() {
  const recognizers: FakeRecognizer[] = [];
  const modelHandlers: Record<string, Handler> = {};
  let workerError: ((d: string) => void) | null = null;
  const model: VoskModelLike = {
    KaldiRecognizer: class extends FakeRecognizer {
      constructor(sr: number, g?: string) {
        super(sr, g);
        recognizers.push(this);
      }
    } as unknown as VoskModelLike['KaldiRecognizer'],
    on: (e, l) => {
      modelHandlers[e] = l as Handler;
    },
    terminate: vi.fn(),
  };
  let now = 0;
  const engine = new VoskEngine({
    loadModel: async (onWorkerError) => {
      workerError = onWorkerError;
      return model;
    },
    now: () => now,
  });
  return {
    engine,
    recognizers,
    model,
    modelHandlers,
    workerError: (d: string) => workerError?.(d),
    setNow: (t: number) => {
      now = t;
    },
  };
}

describe('asr-engines', () => {
  it('UT-110 vosk-engine: gramática restrita ao roteiro e parcial vira Hypothesis final: false', async () => {
    const v = fakeVosk();
    const src = new FakeSource();
    const hyps: unknown[] = [];
    const lags: number[] = [];
    v.engine.onHypothesis((h) => hyps.push(h));
    v.engine.onLag((l) => lags.push(l));
    await v.engine.load();
    await v.engine.start(src, ['a', 'casa', '[unk]']);
    expect(v.recognizers).toHaveLength(1);
    expect(v.recognizers[0].sampleRate).toBe(16000);
    expect(JSON.parse(v.recognizers[0].grammar!)).toEqual(['a', 'casa', '[unk]']);

    src.push(5000);
    expect(v.recognizers[0].fed).toBe(1);
    v.setNow(5300);
    v.recognizers[0].handlers.partialresult({ result: { partial: 'a casa' } });
    expect(hyps).toEqual([{ words: ['a', 'casa'], final: false, audioEndMs: 5000 }]);
    expect(lags).toEqual([300]);

    // Vocabulário novo recria o reconhecedor com a gramática nova.
    v.engine.setVocabulary(['outro', 'texto', '[unk]']);
    expect(v.recognizers[0].removed).toBe(true);
    expect(JSON.parse(v.recognizers[1].grammar!)).toEqual(['outro', 'texto', '[unk]']);
  });

  it('UT-111 vosk-engine: erro no Worker emite engine-crashed', async () => {
    const v = fakeVosk();
    const faults: string[] = [];
    v.engine.onFault((f) => faults.push(f));
    await v.engine.start(new FakeSource(), ['a', '[unk]']);
    v.workerError('RuntimeError: memory access out of bounds');
    expect(faults).toEqual(['engine-crashed']);
    expect(v.model.terminate).toHaveBeenCalled();

    // Erro reportado pelo modelo (carga falhou) também.
    const w = fakeVosk();
    const f2: string[] = [];
    w.engine.onFault((f) => f2.push(f));
    await w.engine.load();
    w.modelHandlers.error({ error: 'falha ao abrir o modelo' });
    expect(f2).toEqual(['engine-crashed']);
  });

  it('UT-112 parakeet: saída inesperada do utilityProcess emite engine-crashed', async () => {
    // Lado do principal: a saída sem stop() é falha; depois de stop() não é.
    let exit: ((code: number) => void) | null = null;
    const child: UtilityProcessLike = {
      postMessage: vi.fn(),
      on: (_e, cb) => {
        exit = cb;
        return child;
      },
      kill: vi.fn(() => true),
    };
    const onFault = vi.fn();
    const port = { close: vi.fn() };
    launchParakeet({
      fork: () => child,
      createChannel: () => ({ port1: { close: vi.fn() }, port2: port }),
      modulePath: 'parakeet-host.js',
      modelsDir: '/modelos',
      onFault,
    });
    expect(child.postMessage).toHaveBeenCalledWith({ type: 'init', modelsDir: '/modelos' }, [expect.anything()]);
    exit!(3221225477);
    expect(onFault).toHaveBeenCalledWith('engine-crashed', expect.stringContaining('3221225477'));

    const onFault2 = vi.fn();
    const p2 = launchParakeet({
      fork: () => child,
      createChannel: () => ({ port1: { close: vi.fn() }, port2: { close: vi.fn() } }),
      modulePath: 'x',
      modelsDir: 'y',
      onFault: onFault2,
    });
    p2.stop();
    exit!(0);
    expect(onFault2).not.toHaveBeenCalled();

    // Lado da janela: o motor recebe o aviso de saída e emite engine-crashed.
    const link = fakeLink();
    const engine = new ParakeetEngine({ connect: async () => link.link, now: () => 0 });
    const faults: string[] = [];
    engine.onFault((f) => faults.push(f));
    const loaded = engine.load();
    await vi.waitUntil(() => link.listening());
    link.reply({ ready: true });
    await loaded;
    link.exit(1);
    expect(faults).toEqual(['engine-crashed']);
  });

  it('UT-113 parakeet: decodificação de 900 ms aumenta o intervalo de 600 para 900, e lag = agora - audioEndMs', async () => {
    let t = 0;
    const clock: HostClock = { now: () => t, setTimeout: () => 0, clearTimeout: () => undefined };
    const sent: AsrPcmResponse[] = [];
    const host = new ParakeetHost({
      decoder: {
        decode: async () => {
          t += 900;
          return 'acompanha a leitura';
        },
      },
      send: (m) => sent.push(m),
      clock,
    });
    expect(host.intervalMs).toBe(600);
    host.push(new Float32Array(1600), 10_000);
    await host.tick();
    expect(host.intervalMs).toBe(900);
    expect(sent).toEqual([{ words: ['acompanha', 'a', 'leitura'], final: false, audioEndMs: 10_000 }]);
    // Sem áudio novo, não decodifica de novo.
    await host.tick();
    expect(sent).toHaveLength(1);

    // Lado da janela: o atraso é agora menos o audioEndMs da resposta.
    const link = fakeLink();
    let now = 0;
    const engine = new ParakeetEngine({ connect: async () => link.link, now: () => now });
    const lags: number[] = [];
    const hyps: unknown[] = [];
    engine.onLag((l) => lags.push(l));
    engine.onHypothesis((h) => hyps.push(h));
    const src = new FakeSource();
    const started = engine.start(src, []);
    await vi.waitUntil(() => link.listening());
    link.reply({ ready: true });
    await started;
    src.push(20_000);
    expect(link.posted[0]).toMatchObject({ endMs: 20_000 });
    now = 20_750;
    link.reply({ words: ['a', 'leitura'], final: false, audioEndMs: 20_000 });
    expect(lags).toEqual([750]);
    expect(hyps).toEqual([{ words: ['a', 'leitura'], final: false, audioEndMs: 20_000 }]);
  });

  it('parakeet-host: decodificação rápida volta o intervalo ao mínimo, e silêncio não é decodificado', async () => {
    let t = 0;
    let cost = 1200;
    const host = new ParakeetHost({
      decoder: {
        decode: async () => {
          t += cost;
          return 'ok';
        },
      },
      send: () => undefined,
      vad: { accept: (s) => s[0] !== 0 },
      clock: { now: () => t, setTimeout: () => 0, clearTimeout: () => undefined },
    });
    host.push(Float32Array.of(0.2, 0.1), 1000);
    await host.tick();
    expect(host.intervalMs).toBe(1200);
    cost = 100;
    host.push(Float32Array.of(0.2, 0.1), 2000);
    await host.tick();
    expect(host.intervalMs).toBe(600);
    // Só silêncio por mais de 3 s depois da última fala: nada a decodificar.
    const before = t;
    host.push(new Float32Array(16000 * 4), 6000);
    await host.tick();
    expect(t).toBe(before);
  });

  it('voice-log: voice.lag por minuto com p50 e p95', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([], 50)).toBeNull();
    const write = vi.fn();
    const log = new LagLog(() => 'vosk', write);
    for (let i = 1; i <= 10; i++) log.add(i * 10, i * 1000);
    expect(write).not.toHaveBeenCalled();
    // Passado um minuto do início, a medição seguinte fecha o minuto anterior.
    log.add(999, 61_000);
    expect(write).toHaveBeenCalledWith('voice.lag', { engine: 'vosk', count: 10, p50: 50, p95: 100 });
  });
});

function fakeLink() {
  let onMessage: ((m: AsrPcmResponse) => void) | null = null;
  let onExit: ((c: number | null) => void) | null = null;
  const posted: AsrPcmRequest[] = [];
  const link: ParakeetLink = {
    post: (m) => {
      posted.push(m);
    },
    onMessage: (cb) => {
      onMessage = cb;
      return () => (onMessage = null);
    },
    onExit: (cb) => {
      onExit = cb;
      return () => (onExit = null);
    },
    close: vi.fn(),
  };
  return {
    link,
    posted,
    listening: () => onMessage !== null,
    reply: (m: AsrPcmResponse) => onMessage?.(m),
    exit: (c: number) => onExit?.(c),
  };
}
