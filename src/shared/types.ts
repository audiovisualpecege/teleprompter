/**
 * Modelos de dados compartilhados entre o processo principal e as janelas
 * (TechSpec, "Modelos de dados" e "Interfaces centrais").
 */

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export type LetterCase = 'normal' | 'upper' | 'lower';
export type TextAlign = 'center' | 'left';

export interface Appearance {
  /** Padrão 'Archivo'. */
  fontFamily: string;
  /** 20..200, padrão 80 (px no palco 1920x1080). */
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  /** #RRGGBBAA, translúcida. */
  bandColor: string;
  letterCase: LetterCase;
  align: TextAlign;
  /** 0..40, de cada lado. */
  marginPct: number;
  /** 10..60. */
  bandPositionPct: number;
}

export interface ScriptToken {
  norm: string;
  start: number;
  end: number;
  line: number;
}

export interface LayoutLine {
  /** Texto exibido (já com a caixa escolhida). */
  text: string;
  /** Posições de caractere no texto guardado. */
  start: number;
  end: number;
  y: number;
  height: number;
}

export interface LayoutResult {
  revision: number;
  appearance: Appearance;
  lines: LayoutLine[];
  totalHeight: number;
  wordCount: number;
  missingFont: string | null;
}

export interface Anchor {
  charOffset: number;
  fraction: number;
}

export type ScrollDir = 1 | -1;

export type ScrollCommand =
  | { type: 'lineStep'; dir: ScrollDir }
  | { type: 'holdStart'; dir: ScrollDir }
  | { type: 'holdEnd' }
  | { type: 'nudge'; dy: number }
  | { type: 'toStart' }
  | { type: 'autoStart' }
  | { type: 'autoPause' }
  | { type: 'setSpeed'; speed: number }
  | { type: 'voiceTarget'; y: number };

/** Comandos de rolagem que a tela de controle pode mandar (a voz entra pelo principal). */
export type ManualScrollCommand = Exclude<ScrollCommand, { type: 'voiceTarget' }>;

export interface Hypothesis {
  words: string[];
  final: boolean;
  audioEndMs: number;
}

export type EngineFault = 'mic-lost' | 'mic-denied' | 'no-mic' | 'engine-crashed' | 'too-slow';
export type EngineId = 'vosk' | 'parakeet';
export type VoiceMode = 'near' | 'forwardJumps';

export type VoiceState = 'off' | 'preparing' | 'listening' | 'waiting' | 'failed';

export interface VoiceStatus {
  state: VoiceState;
  fault: EngineFault | null;
  engine: EngineId;
  mode: VoiceMode;
  lagMs: number | null;
}

export type OutputState = 'open' | 'down' | 'closed';

export interface OutputInfo {
  id: number;
  displayKey: string;
  label: string;
  size: string;
  state: OutputState;
  mirrorH: boolean;
  flipV: boolean;
  voiceSignal: boolean;
}

export interface DisplayInfo {
  /** `id|label|largura x altura`. */
  displayKey: string;
  id: number;
  label: string;
  size: string;
  bounds: { x: number; y: number; width: number; height: number };
  primary: boolean;
  /** Monitor onde está a janela de controle (nunca recebe saída). */
  hasControl: boolean;
  /** Saída aberta neste monitor, se houver. */
  outputId: number | null;
}

export type NoticeKind = 'info' | 'success' | 'warning' | 'danger';

export interface Notice {
  id: string;
  kind: NoticeKind;
  message: string;
  /**
   * Hora do aviso (acréscimo à TechSpec, tarefa 6): uma falha repetida mantém o mesmo
   * aviso, com a hora atualizada (US-034 EC-2).
   */
  at?: number;
}

/** Entrada de áudio, pelo nome que o sistema dá (acréscimo à TechSpec, tarefa 6). */
export interface MicDevice {
  deviceId: string;
  label: string;
}

/**
 * Ajustes da tela de voz que a janela de controle não descobre sozinha (acréscimo à
 * TechSpec, tarefa 6): o microfone guardado e os motores que carregam neste computador.
 */
export interface VoiceSetup {
  micDeviceId: string | null;
  micLabel: string | null;
  engines: EngineId[];
  /** Por que o Parakeet não aparece nesta plataforma, se for o caso. */
  parakeetUnavailable: string | null;
}

export type FileErrorCode =
  | 'empty'
  | 'not-text'
  | 'unreadable'
  | 'no-text-content'
  | 'unsupported-format'
  | 'invalid-roteiro'
  | 'permission-denied'
  | 'not-found'
  | 'invalid-name'
  | 'disk-full';

export interface FileError {
  code: FileErrorCode;
  path?: string;
  detail?: string;
}

export type ActionId =
  | 'autoToggle'
  | 'down'
  | 'up'
  | 'faster'
  | 'slower'
  | 'toStart'
  | 'voiceToggle'
  | 'closeOutput';

export interface KeyCombo {
  key: string;
  ctrlOrCmd: boolean;
  shift: boolean;
  alt: boolean;
}

export type Keymap = Record<ActionId, KeyCombo[]>;

export interface SavedOutput {
  displayKey: string;
  label: string;
  size: string;
  mirrorH: boolean;
  flipV: boolean;
  voiceSignal: boolean;
}

export interface Settings {
  schemaVersion: 1;
  outputs: SavedOutput[];
  keymap: Keymap;
  micDeviceId: string | null;
  micLabel: string | null;
  voiceEngine: EngineId;
  voiceMode: VoiceMode;
  speed: number;
  lastAppearance: Appearance;
  controlDisplayKey: string | null;
}

export type Automation = 'none' | 'auto' | 'voice';

export interface DocState {
  filePath: string | null;
  draftText: string;
  confirmedText: string;
  dirty: boolean;
  pending: boolean;
}

/**
 * Aviso de versão nova na tela de controle (US-038). Acréscimo à TechSpec (tarefa 7): além
 * de `version` e `url`, o progresso do download (0 a 100, `null` antes de baixar) e o erro
 * do download, para a tela mostrar o andamento e "Não foi possível baixar a versão nova".
 */
export interface UpdateView {
  version: string;
  url: string;
  progress: number | null;
  error: string | null;
}

export interface StateSnapshot {
  doc: DocState;
  appearance: Appearance;
  automation: Automation;
  speed: number;
  voice: VoiceStatus;
  voiceSetup: VoiceSetup;
  outputs: OutputInfo[];
  displays: DisplayInfo[];
  editorFocused: boolean;
  /**
   * Mapa de atalhos atual (acréscimo à TechSpec, tarefa 5): as dicas dos botões e a tela de
   * atalhos leem daqui, e não do padrão.
   */
  keymap: Keymap;
  update: UpdateView | null;
  notices: Notice[];
  /** Pergunta pendente que nasceu no principal (duplo clique, fechar, recuperação). */
  prompt: DocPrompt | null;
}

/**
 * Pergunta que o principal pede à tela de controle:
 * - `unsaved`: abrir por duplo clique ou fechar o programa com alterações não salvas;
 *   a tela responde com `cmd:doc` da mesma operação e `unsaved: 'save' | 'discard'`.
 * - `recovery`: há uma cópia de recuperação de uma queda; a tela responde com
 *   `cmd:doc { op: 'recover', accept }`.
 */
export type DocPrompt =
  | { kind: 'unsaved'; op: 'open' | 'close'; path: string | null }
  | { kind: 'recovery'; savedAt: number; filePath: string | null };
