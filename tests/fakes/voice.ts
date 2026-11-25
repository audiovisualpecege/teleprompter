/**
 * `VoiceController` de teste: `AppStore` real com relógio falso, a janela de controle
 * falsa (guarda os `voice:run`) e o sinal das saídas falso. O "motor falso" do catálogo
 * é o próprio teste, que responde `asr:ready`, `asr:hypothesis`, `asr:fault` e `asr:lag`.
 */
import type { VoiceRunCommand } from '@shared/ipc';
import type { EngineFault, EngineId, MicDevice, VoiceState } from '@shared/types';
import { VoiceController, type MicAccess } from '../../src/main/voice-controller';
import { createTestStore, type TestStore } from './store';

/** Roteiro de teste do `VoiceTracker`, um trecho por linha (parágrafos). */
export const VOICE_LINES = [
  'o teleprompter da chiaro acompanha',
  'a leitura de quem lê o texto',
  'no vidro com calma e atenção',
  'até o fim da gravação',
];
export const VOICE_TEXT = VOICE_LINES.join('\n');
export const MIC: MicDevice = { deviceId: 'mic-1', label: 'Microfone USB' };

export interface TestVoice extends TestStore {
  vc: VoiceController;
  runs: VoiceRunCommand[];
  signals: VoiceState[];
  access: { value: MicAccess };
  /** Confirma um texto (o layout responde na hora). */
  confirm(text?: string): Promise<void>;
  /** Liga a voz e responde `asr:ready`. */
  listen(): Promise<void>;
  hear(...words: string[]): void;
  ready(): void;
  fault(f: EngineFault): void;
  lag(ms: number): void;
  state(): VoiceState;
  lastRun(): VoiceRunCommand | undefined;
}

export interface TestVoiceOptions {
  engines?: EngineId[];
  devices?: MicDevice[] | null;
  platform?: string;
}

export async function createTestVoice(options: TestVoiceOptions = {}): Promise<TestVoice> {
  const t = await createTestStore();
  const runs: VoiceRunCommand[] = [];
  const signals: VoiceState[] = [];
  const access = { value: 'granted' as MicAccess };
  const vc = new VoiceController({
    store: t.store,
    settings: t.settings,
    scheduler: t.clock,
    now: () => t.clock.now,
    port: { run: (cmd) => void runs.push(cmd) },
    outputs: { setVoiceState: (s) => void signals.push(s) },
    micAccess: () => access.value,
    engines: { engines: options.engines ?? ['vosk', 'parakeet'], parakeetUnavailable: null },
    platform: options.platform ?? 'win32',
    log: (event, fields) => void t.logs.push({ event, fields }),
  });
  if (options.devices !== null) vc.devicesChanged(options.devices ?? [MIC]);
  const v: TestVoice = {
    ...t,
    vc,
    runs,
    signals,
    access,
    async confirm(text = VOICE_TEXT) {
      await t.store.doc({ op: 'setDraft', text });
      await t.store.doc({ op: 'confirm' });
    },
    async listen() {
      if (t.store.confirmedText === '') await v.confirm();
      const r = await vc.toggle();
      if (!r.ok) throw new Error(`a voz não ligou: ${r.error}`);
      v.ready();
    },
    hear(...words) {
      vc.hypothesis({ session: vc.currentSession, words, final: false, audioEndMs: t.clock.now });
    },
    ready() {
      vc.ready({ session: vc.currentSession });
    },
    fault(f) {
      vc.engineFault({ session: vc.currentSession, fault: f });
    },
    lag(ms) {
      vc.lag({ session: vc.currentSession, lagMs: ms });
    },
    state: () => t.store.snapshot().voice.state,
    lastRun: () => runs.at(-1),
  };
  return v;
}
