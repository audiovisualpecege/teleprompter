/**
 * Contratos de IPC (TechSpec, "Contratos de IPC"). O programa não tem API HTTP:
 * as fronteiras são estes canais tipados, expostos pelo preload via `contextBridge`.
 *
 * - `Invoke*`: a janela pede e espera uma resposta (`ipcRenderer.invoke`/`ipcMain.handle`).
 * - `Send*`: a janela avisa, sem resposta (`ipcRenderer.send`/`ipcMain.on`).
 * - `*Events`: o principal publica para a janela (`webContents.send`).
 */
import type { MotionSegment } from './motion';
import type {
  ActionId,
  Appearance,
  EngineFault,
  EngineId,
  FileError,
  Hypothesis,
  KeyCombo,
  Keymap,
  LayoutResult,
  ManualScrollCommand,
  MicDevice,
  OutputInfo,
  Result,
  Settings,
  StateSnapshot,
  VoiceMode,
  VoiceState,
  VoiceStatus,
} from './types';

/* ---------- Cargas dos canais ---------- */

/**
 * Resposta à pergunta de alterações não salvas: "Salvar", "Não salvar" ou "Cancelar".
 * Quando a pergunta nasceu na tela, "Cancelar" pode simplesmente não repetir o
 * comando; quando nasceu no principal (`StateSnapshot.prompt`), `cancel` a fecha.
 */
export type UnsavedChoice = 'save' | 'discard' | 'cancel';

export type DocCommand =
  | { op: 'setDraft'; text: string }
  | { op: 'confirm' }
  | { op: 'discard' }
  | { op: 'new'; unsaved?: UnsavedChoice }
  | { op: 'open'; path?: string; unsaved?: UnsavedChoice }
  | { op: 'save' }
  | { op: 'saveAs' }
  | { op: 'import'; path?: string; unsaved?: UnsavedChoice }
  | { op: 'recover'; accept?: boolean }
  | { op: 'close'; unsaved?: UnsavedChoice };

export const UNSAVED_OPTIONS = ['Salvar', 'Não salvar', 'Cancelar'] as const;

/** Há alterações não salvas: a tela pergunta e repete o comando com `unsaved`. */
export interface NeedsConfirmation {
  code: 'needs-confirmation';
  options: typeof UNSAVED_OPTIONS;
}
export type DocFailure = FileError | NeedsConfirmation | 'empty-text' | 'cancelled';

export type OutputCommand =
  | { op: 'open'; displayKey: string }
  | { op: 'close'; id: number }
  | { op: 'set'; id: number; mirrorH?: boolean; flipV?: boolean; voiceSignal?: boolean };
export type OutputFailure = 'display-busy' | 'control-display' | 'display-missing';

export type VoiceCommand =
  | { op: 'toggle' }
  | { op: 'setMic'; deviceId: string }
  | { op: 'setEngine'; engine: EngineId }
  | { op: 'setMode'; mode: VoiceMode };
export type VoiceFailure = 'no-text' | 'no-mic' | 'mic-denied';

/**
 * Principal → janela de controle (acréscimo à TechSpec, tarefa 6): o `VoiceController`
 * mora no principal, mas a captura e o motor rodam na janela de controle. Cada ligação
 * da voz é uma sessão; as respostas (`asr:*`) trazem a sessão, e o principal descarta as
 * de uma sessão velha (ligar e desligar seguidos, US-028 EC-4).
 *
 * - `start`: carrega o motor, liga a captura no microfone e responde `asr:ready`.
 * - `stop`: desliga a captura e o motor.
 * - `setVocabulary`: novo texto confirmado com a voz ligada.
 * - `setMic`: troca o microfone com a voz ligada, sem desligar o motor.
 */
export type VoiceRunCommand =
  | { op: 'start'; session: number; engine: EngineId; deviceId: string | null; vocabulary: string[] }
  | { op: 'stop'; session: number }
  | { op: 'setVocabulary'; session: number; vocabulary: string[] }
  | { op: 'setMic'; session: number; deviceId: string | null };

/** Respostas da janela de controle, com a sessão que as gerou (acréscimo à TechSpec, tarefa 6). */
export interface AsrHypothesisMsg extends Hypothesis {
  session: number;
}
export interface AsrFaultMsg {
  session: number;
  fault: EngineFault;
  detail?: string;
}
export interface AsrLagMsg {
  session: number;
  lagMs: number;
}
export interface AsrReadyMsg {
  session: number;
}

/**
 * Entradas de áudio vistas pela janela de controle (`enumerateDevices`), mandadas na
 * abertura e a cada `devicechange` (acréscimo à TechSpec, tarefa 6): o principal não vê
 * os microfones e precisa deles para recusar `no-mic` e avisar do microfone guardado ausente.
 */
export interface VoiceDevicesMsg {
  devices: MicDevice[];
}

export type KeymapCommand =
  | { op: 'set'; action: ActionId; combo: KeyCombo; force?: boolean }
  | { op: 'clear'; action: ActionId }
  | { op: 'reset' };
export type KeymapFailure = { conflictWith: ActionId } | 'reserved';

export type SettingsCommand = { op: 'resetAll' };
/**
 * `download` baixa e abre o instalador. Acréscimo à TechSpec (tarefa 7): `dismiss` é o
 * "Fechar" do aviso, guardado no principal até o fim da sessão (UT-222).
 */
export type UpdateCommand = { op: 'download' } | { op: 'dismiss' };
export type UpdateFailure = 'network' | 'no-asset';

export interface LayoutRequest {
  revision: number;
  text: string;
  appearance: Appearance;
}

export interface ClockPong {
  t0: number;
  mainNow: number;
}

/** O que cada saída recebe para desenhar. */
export interface OutputView {
  id: number;
  layout: LayoutResult | null;
  mirrorH: boolean;
  flipV: boolean;
  voiceSignal: boolean;
  voiceState: VoiceState;
  showBadge: boolean;
}

/* ---------- Mapas de canais ---------- */

/** Janela de controle → principal, com resposta. */
export interface ControlInvokeChannels {
  'cmd:doc': { req: DocCommand; res: Result<void, DocFailure> };
  'cmd:appearance': { req: Partial<Appearance>; res: Appearance };
  'cmd:output': { req: OutputCommand; res: Result<OutputInfo, OutputFailure> };
  'cmd:voice': { req: VoiceCommand; res: Result<VoiceStatus, VoiceFailure> };
  'cmd:keymap': { req: KeymapCommand; res: Result<Keymap, KeymapFailure> };
  'cmd:settings': { req: SettingsCommand; res: Settings };
  'cmd:update': { req: UpdateCommand; res: Result<void, UpdateFailure> };
  /**
   * Acréscimo à TechSpec (tarefa 7): o botão "Abrir pasta de registros" da tela Sobre abre
   * `userData/logs` no sistema; a resposta é o caminho aberto.
   */
  'cmd:openLogs': { req: null; res: string };
  'clock:ping': { req: number; res: ClockPong };
}

/** Janela de controle → principal, sem resposta. */
export interface ControlSendChannels {
  'cmd:scroll': ManualScrollCommand;
  'asr:hypothesis': AsrHypothesisMsg;
  'asr:fault': AsrFaultMsg;
  'asr:lag': AsrLagMsg;
  'asr:ready': AsrReadyMsg;
  'voice:devices': VoiceDevicesMsg;
  /** Pede ao principal o `utilityProcess` do Parakeet; a porta do `asr:pcm` chega por `voice:parakeetPort`. */
  'voice:wantParakeet': null;
  'ui:editorFocus': boolean;
  /**
   * A tela de atalhos está gravando uma combinação (acréscimo à TechSpec, tarefa 5): as
   * teclas vão para a tela sem virar ação.
   */
  'ui:keyCapture': boolean;
  'layout:result': LayoutResult;
}

/** Principal → janela de controle. */
export interface ControlEvents {
  'layout:request': LayoutRequest;
  'state:snapshot': StateSnapshot;
  'motion:segment': MotionSegment;
  /** Esc com o editor em foco (capturado pelo principal): a tela tira o foco do editor. */
  'ui:blurEditor': null;
  'voice:run': VoiceRunCommand;
}

/** Saída → principal, com resposta. */
export interface OutputInvokeChannels {
  'clock:ping': { req: number; res: ClockPong };
}

/** Saída → principal, sem resposta (acréscimo à TechSpec, tarefa 5): quadros longos por minuto. */
export interface OutputSendChannels {
  'render:longFrame': { count: number; maxMs: number };
}

/** Principal → saída. */
export interface OutputEvents {
  'state:output': OutputView;
  'motion:segment': MotionSegment;
}

export type ControlInvokeChannel = keyof ControlInvokeChannels;
export type ControlSendChannel = keyof ControlSendChannels;
export type ControlEventChannel = keyof ControlEvents;
export type OutputInvokeChannel = keyof OutputInvokeChannels;
export type OutputEventChannel = keyof OutputEvents;
export type OutputSendChannel = keyof OutputSendChannels;

/** Listas usadas pelo preload para só deixar passar canais conhecidos. */
export const CONTROL_INVOKE_CHANNELS = [
  'cmd:doc',
  'cmd:appearance',
  'cmd:output',
  'cmd:voice',
  'cmd:keymap',
  'cmd:settings',
  'cmd:update',
  'cmd:openLogs',
  'clock:ping',
] as const satisfies readonly ControlInvokeChannel[];

export const CONTROL_SEND_CHANNELS = [
  'cmd:scroll',
  'asr:hypothesis',
  'asr:fault',
  'asr:lag',
  'asr:ready',
  'voice:devices',
  'voice:wantParakeet',
  'ui:editorFocus',
  'ui:keyCapture',
  'layout:result',
] as const satisfies readonly ControlSendChannel[];

export const CONTROL_EVENT_CHANNELS = [
  'layout:request',
  'state:snapshot',
  'motion:segment',
  'ui:blurEditor',
  'voice:run',
] as const satisfies readonly ControlEventChannel[];

export const OUTPUT_INVOKE_CHANNELS = ['clock:ping'] as const satisfies readonly OutputInvokeChannel[];

export const OUTPUT_SEND_CHANNELS = ['render:longFrame'] as const satisfies readonly OutputSendChannel[];

export const OUTPUT_EVENT_CHANNELS = [
  'state:output',
  'motion:segment',
] as const satisfies readonly OutputEventChannel[];

/* ---------- Pontes expostas em `window.tp` ---------- */

export type Unsubscribe = () => void;

export interface ControlBridge {
  readonly role: 'control';
  invoke<C extends ControlInvokeChannel>(
    channel: C,
    payload: ControlInvokeChannels[C]['req'],
  ): Promise<ControlInvokeChannels[C]['res']>;
  send<C extends ControlSendChannel>(channel: C, payload: ControlSendChannels[C]): void;
  on<C extends ControlEventChannel>(channel: C, cb: (payload: ControlEvents[C]) => void): Unsubscribe;
}

export interface OutputBridge {
  readonly role: 'output';
  invoke<C extends OutputInvokeChannel>(
    channel: C,
    payload: OutputInvokeChannels[C]['req'],
  ): Promise<OutputInvokeChannels[C]['res']>;
  send<C extends OutputSendChannel>(channel: C, payload: OutputSendChannels[C]): void;
  on<C extends OutputEventChannel>(channel: C, cb: (payload: OutputEvents[C]) => void): Unsubscribe;
}

/* ---------- asr:pcm (janela de controle → ParakeetHost, por MessagePort) ---------- */

/**
 * Canal `asr:pcm`: não passa pelo `ipcRenderer`. A janela de controle manda o áudio
 * ao `ParakeetHost` (utilityProcess) por um `MessagePort`, com o buffer transferível.
 */
export const ASR_PCM_CHANNEL = 'asr:pcm';
/** Áudio mono a 16 kHz. */
export const ASR_PCM_SAMPLE_RATE = 16000;
/**
 * O áudio vai com o instante do fim do pedaço (relógio comum `epochNow`), para que a
 * resposta traga o `audioEndMs` e o motor meça o atraso. `stop` esvazia o buffer.
 */
export type AsrPcmRequest = { pcm: Float32Array; endMs: number } | { stop: true };
export type AsrPcmResponse =
  | { words: string[]; final: boolean; audioEndMs: number }
  | { fault: EngineFault; detail?: string }
  | { ready: true };

/**
 * A porta do `asr:pcm` do Parakeet chega à janela de controle por `webContents.postMessage`
 * neste canal; o preload a repassa à página com `window.postMessage` e esta marca.
 */
export const PARAKEET_PORT_CHANNEL = 'voice:parakeetPort';
/** Aviso do preload à página de que o processo do Parakeet terminou. */
export const PARAKEET_EXIT_MESSAGE = 'tp:parakeet-exit';

/** Prefixo dos canais de teste, que só existem no build de teste. */
export const TEST_CHANNEL_PREFIX = 'test:';
