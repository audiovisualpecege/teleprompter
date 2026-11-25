/**
 * Máquina de estados da voz (TechSpec, "Estados da voz (VoiceController)"; ADR-003,
 * ADR-004, ADR-005 e ADR-007).
 *
 * O motor e a captura rodam na janela de controle; aqui fica o que decide:
 *
 * - **Estados:** `off`, `preparing`, `listening`, `waiting` e `failed`, com a tabela da
 *   TechSpec. Ligar só com texto confirmado e microfone disponível.
 * - **Sessões:** cada ligação (ou reinício do motor) é uma sessão nova. As respostas da
 *   janela (`asr:*`) de uma sessão velha são descartadas, então ligar e desligar seguidos
 *   terminam no último toque, sem carregamento pendente (US-028 EC-4).
 * - **Rolagem:** cada hipótese passa pelo `VoiceTracker`, e o alvo vai ao `ScrollEngine`
 *   como `voiceTarget`. O manual vale sempre por cima: logo depois de um comando manual as
 *   hipóteses são ignoradas, e o cursor é ressincronizado pela linha da faixa.
 * - **Uma automação por vez:** ligar a voz pausa a automática; iniciar a automática
 *   desliga a voz.
 * - **Falhas:** qualquer `EngineFault` leva a `failed`, com o texto parado onde está e um
 *   único aviso atualizado. O microfone que volta, o motor que reinicia (até 3 tentativas,
 *   em 1, 2 e 4 s) e o atraso que cai abaixo de 800 ms levam de volta a `listening`.
 * - **Sinal nas saídas:** só muda depois de 700 ms de estado estável.
 */
import {
  MANUAL_PRIORITY_MS,
  RECOVERED_LAG_MS,
  SIGNAL_DEBOUNCE_MS,
  TOO_SLOW_LAG_MS,
  WAITING_AFTER_MS,
} from '@shared/defaults';
import type {
  AsrFaultMsg,
  AsrHypothesisMsg,
  AsrLagMsg,
  AsrReadyMsg,
  VoiceCommand,
  VoiceFailure,
  VoiceRunCommand,
} from '@shared/ipc';
import { segmentTarget } from '@shared/motion';
import { buildSpokenVocabulary } from '@shared/text';
import {
  err,
  ok,
  type EngineFault,
  type EngineId,
  type LayoutResult,
  type MicDevice,
  type Result,
  type ScriptToken,
  type ScrollCommand,
  type VoiceState,
  type VoiceStatus,
} from '@shared/types';
import {
  faultReason,
  MIC_MISSING_MESSAGE,
  MIC_MISSING_NOTICE,
  NO_MIC_MESSAGE,
  micDeniedMessage,
  VOICE_FAULT_NOTICE,
  VOICE_START_NOTICE,
} from '@shared/voice';
import type { Scheduler, ScrollApplyResult } from './scroll-engine';
import type { LogFn, SettingsStore } from './settings';
import type { AppStore, LayoutKind } from './store';
import { buildScriptTokens, resyncFromBand, track } from './voice-tracker';
import { LagLog, logEngineRestart } from './voice-log';

/** Esperas antes de cada reinício do motor (US-034; TechSpec, "Causas resolvidas"). */
export const ENGINE_RESTART_DELAYS_MS = [1000, 2000, 4000] as const;

/** Permissão de microfone do sistema (no Mac, `systemPreferences`). */
export type MicAccess = 'granted' | 'denied' | 'unknown';

/** Ponte com a janela de controle, onde rodam a captura e o motor. */
export interface VoicePort {
  run(cmd: VoiceRunCommand): void;
}

export interface VoiceControllerOptions {
  store: AppStore;
  settings: SettingsStore;
  scheduler: Scheduler;
  now: () => number;
  port: VoicePort;
  /** Sinal discreto nas saídas (o `OutputManager`). */
  outputs?: { setVoiceState(state: VoiceState): void } | null;
  /** Pede ou lê a permissão de microfone do sistema (no Mac, `askForMediaAccess`). */
  micAccess?: () => MicAccess | Promise<MicAccess>;
  /** Motores que carregam neste computador. */
  engines?: { engines: EngineId[]; parakeetUnavailable: string | null };
  platform?: string;
  log?: LogFn;
}

/** Linhas manuais que pedem ressincronizar o cursor (o `holdStart` espera o `holdEnd`). */
const RESYNC_COMMANDS: ReadonlySet<ScrollCommand['type']> = new Set(['lineStep', 'holdEnd', 'nudge', 'toStart']);

export class VoiceController {
  private readonly o: VoiceControllerOptions;
  private readonly log: LogFn;
  private readonly platform: string;
  private readonly engines: EngineId[];
  private state: VoiceState = 'off';
  private fault: EngineFault | null = null;
  private lagMs: number | null = null;
  private session = 0;
  private engine: EngineId = 'vosk';

  private devices: MicDevice[] = [];
  private devicesKnown = false;

  private tokens: ScriptToken[] = [];
  private layout: LayoutResult | null = null;
  private cursor = 0;
  private vocabularyText = '';

  private waitingCancel: (() => void) | null = null;
  private restartCancel: (() => void) | null = null;
  private restartAttempts = 0;
  private signalCancel: (() => void) | null = null;
  private signalSent: VoiceState = 'off';
  private readonly lagLog: LagLog;
  private readonly offs: (() => void)[] = [];

  constructor(options: VoiceControllerOptions) {
    this.o = options;
    this.log = options.log ?? (() => undefined);
    this.platform = options.platform ?? process.platform;
    this.engines = options.engines?.engines ?? ['vosk'];
    this.lagLog = new LagLog(() => this.engine, (event, fields) => this.log(event, fields));
    const { store } = options;
    store.setVoiceEngines(this.engines, options.engines?.parakeetUnavailable ?? null);
    this.offs.push(
      store.onScroll((cmd, result) => this.afterScroll(cmd, result)),
      store.onDocLayout((kind, layout, text) => this.afterLayout(kind, layout, text)),
    );
    if (store.layout) this.afterLayout('load', store.layout, store.confirmedText);
  }

  /* ---------- Leitura ---------- */

  get status(): VoiceStatus {
    const s = this.o.settings.settings;
    return { state: this.state, fault: this.fault, engine: s.voiceEngine, mode: s.voiceMode, lagMs: this.lagMs };
  }

  /** Cursor do alinhador: o último token já lido. */
  get trackerCursor(): number {
    return this.cursor;
  }

  get currentSession(): number {
    return this.session;
  }

  /* ---------- cmd:voice ---------- */

  async command(cmd: VoiceCommand): Promise<Result<VoiceStatus, VoiceFailure>> {
    switch (cmd?.op) {
      case 'toggle':
        return this.toggle();
      case 'setMic':
        return ok(this.setMic(typeof cmd.deviceId === 'string' && cmd.deviceId !== '' ? cmd.deviceId : null));
      case 'setEngine':
        return ok(this.setEngine(cmd.engine));
      case 'setMode':
        if (cmd.mode === 'near' || cmd.mode === 'forwardJumps') {
          await this.o.settings.update({ voiceMode: cmd.mode });
          this.o.store.refresh();
        }
        return ok(this.status);
      default:
        return ok(this.status);
    }
  }

  /** Liga ou desliga (botão Voz, atalho V). */
  async toggle(): Promise<Result<VoiceStatus, VoiceFailure>> {
    if (this.state !== 'off') {
      this.turnOff();
      return ok(this.status);
    }
    return this.turnOn();
  }

  private async turnOn(): Promise<Result<VoiceStatus, VoiceFailure>> {
    const { store } = this.o;
    if (store.confirmedText.trim() === '') return err('no-text');
    const access = (await this.o.micAccess?.()) ?? 'granted';
    // Enquanto a permissão era pedida, outra ligação pode ter acontecido.
    if (this.state !== 'off') return ok(this.status);
    if (access === 'denied') return this.refuse('mic-denied', micDeniedMessage(this.platform));
    if (this.devicesKnown && this.devices.length === 0) return this.refuse('no-mic', NO_MIC_MESSAGE);
    const saved = this.o.settings.settings.micDeviceId;
    if (saved && this.devicesKnown && !this.findSavedMic()) {
      // A voz não liga sozinha noutro microfone (US-029 EC-1).
      store.addNotice(MIC_MISSING_NOTICE, 'warning', MIC_MISSING_MESSAGE);
      return err('no-mic');
    }
    store.removeNotice(VOICE_START_NOTICE);
    // Uma automação por vez: ligar a voz pausa a automática (ADR-005).
    if (store.engine.automation === 'auto') store.scroll({ type: 'autoPause' });
    this.restartAttempts = 0;
    this.resyncFromBand();
    this.startSession('preparing');
    return ok(this.status);
  }

  private refuse(code: 'no-mic' | 'mic-denied', message: string): Result<VoiceStatus, VoiceFailure> {
    this.o.store.addNotice(VOICE_START_NOTICE, 'danger', message, this.o.now());
    return err(code);
  }

  /** Desliga a voz: o texto fica parado onde está (US-028 AC-3) e o alerta some. */
  turnOff(): void {
    if (this.state === 'off') return;
    this.session++;
    this.o.port.run({ op: 'stop', session: this.session });
    this.cancelTimers();
    this.o.store.engine.holdVoice(this.o.now());
    this.o.store.removeNotice(VOICE_FAULT_NOTICE);
    this.fault = null;
    this.setState('off');
  }

  private setMic(deviceId: string | null): VoiceStatus {
    const device = deviceId ? this.devices.find((d) => d.deviceId === deviceId) : undefined;
    void this.o.settings.update({ micDeviceId: deviceId, micLabel: device?.label ?? (deviceId ? this.o.settings.settings.micLabel : null) });
    this.o.store.removeNotice(MIC_MISSING_NOTICE);
    if (this.state === 'failed' && (this.fault === 'mic-lost' || this.fault === 'no-mic' || this.fault === 'mic-denied')) {
      this.restartSession();
    } else if (this.state !== 'off') {
      // Troca a captura sem desligar o motor (US-029 EC-2).
      this.o.port.run({ op: 'setMic', session: this.session, deviceId });
    }
    this.o.store.refresh();
    return this.status;
  }

  private setEngine(engine: EngineId): VoiceStatus {
    if ((engine !== 'vosk' && engine !== 'parakeet') || !this.engines.includes(engine)) return this.status;
    if (engine === this.o.settings.settings.voiceEngine) return this.status;
    void this.o.settings.update({ voiceEngine: engine });
    if (this.state !== 'off') {
      this.restartAttempts = 0;
      this.o.store.removeNotice(VOICE_FAULT_NOTICE);
      this.fault = null;
      this.startSession('preparing');
    }
    this.o.store.refresh();
    return this.status;
  }

  /**
   * Depois de "Voltar ao padrão": o modo já vem dos ajustes; se a voz está ligada com
   * outro motor, ela recomeça no motor padrão.
   */
  settingsReset(previous: { voiceEngine: EngineId }): void {
    if (this.state !== 'off' && previous.voiceEngine !== this.resolvedEngine()) {
      this.restartAttempts = 0;
      this.o.store.removeNotice(VOICE_FAULT_NOTICE);
      this.fault = null;
      this.startSession('preparing');
    }
    this.o.store.refresh();
  }

  /* ---------- Sessões ---------- */

  private resolvedEngine(): EngineId {
    const wanted = this.o.settings.settings.voiceEngine;
    return this.engines.includes(wanted) ? wanted : 'vosk';
  }

  private resolvedDevice(): string | null {
    const saved = this.o.settings.settings.micDeviceId;
    if (!saved) return null;
    return this.findSavedMic()?.deviceId ?? saved;
  }

  /** Abre uma sessão nova na janela de controle (ligar, reiniciar o motor, trocar de motor). */
  private startSession(state: 'preparing' | 'failed'): void {
    this.session++;
    this.cancelWaiting();
    this.engine = this.resolvedEngine();
    this.vocabularyText = this.o.store.confirmedText;
    this.o.port.run({
      op: 'start',
      session: this.session,
      engine: this.engine,
      deviceId: this.resolvedDevice(),
      vocabulary: buildSpokenVocabulary(this.vocabularyText),
    });
    if (state !== this.state) this.setState(state);
  }

  /** Reinicia a captura e o motor, continuando em `failed` até o `asr:ready`. */
  private restartSession(): void {
    this.startSession(this.state === 'failed' ? 'failed' : 'preparing');
  }

  /* ---------- Respostas da janela de controle ---------- */

  ready(msg: AsrReadyMsg): void {
    if (msg?.session !== this.session || (this.state !== 'preparing' && this.state !== 'failed')) return;
    this.restartCancel?.();
    this.restartCancel = null;
    this.recover();
  }

  hypothesis(msg: AsrHypothesisMsg): void {
    if (msg?.session !== this.session || (this.state !== 'listening' && this.state !== 'waiting')) return;
    if (!Array.isArray(msg.words) || msg.words.length === 0) return;
    // O motor funciona: um próximo travamento volta a ter as 3 tentativas.
    this.restartAttempts = 0;
    const { store } = this.o;
    const now = this.o.now();
    // O manual vale por cima: logo depois de um comando manual, a voz não mexe no texto nem no cursor.
    if (now - store.engine.lastManualAt < MANUAL_PRIORITY_MS) return;
    if (this.tokens.length === 0) return;
    const r = track({
      tokens: this.tokens,
      cursor: this.cursor,
      mode: this.o.settings.settings.voiceMode,
      heard: msg.words,
    });
    if (!r.matched || r.cursor <= this.cursor) return;
    this.cursor = r.cursor;
    const line = this.layout?.lines[this.tokens[this.cursor].line];
    if (line) store.scroll({ type: 'voiceTarget', y: line.y });
    if (this.cursor >= this.tokens.length - 1) {
      // Fim do texto: a última linha fica na faixa e a voz continua ligada, esperando (US-030 EC-6).
      this.cancelWaiting();
      this.setState('waiting');
      return;
    }
    if (this.state === 'waiting') this.setState('listening');
    this.armWaiting();
  }

  engineFault(msg: AsrFaultMsg): void {
    if (msg?.session !== this.session || this.state === 'off') return;
    this.fail(msg.fault);
  }

  lag(msg: AsrLagMsg): void {
    if (msg?.session !== this.session || this.state === 'off' || !Number.isFinite(msg.lagMs)) return;
    const now = this.o.now();
    this.lagLog.add(msg.lagMs, now);
    this.lagMs = this.lagMs === null ? msg.lagMs : Math.round(this.lagMs * 0.8 + msg.lagMs * 0.2);
    if ((this.state === 'listening' || this.state === 'waiting') && msg.lagMs > TOO_SLOW_LAG_MS) {
      this.fail('too-slow');
    } else if (this.state === 'failed' && this.fault === 'too-slow' && msg.lagMs < RECOVERED_LAG_MS) {
      this.recover();
    }
  }

  /** A falha do processo do Parakeet chega pelo principal, na sessão atual. */
  currentEngineFault(fault: EngineFault): void {
    this.engineFault({ session: this.session, fault });
  }

  /** Entradas de áudio vistas pela janela de controle (abertura e `devicechange`). */
  devicesChanged(list: MicDevice[]): void {
    this.devices = Array.isArray(list)
      ? list.filter((d) => d && typeof d.deviceId === 'string').map((d) => ({ deviceId: d.deviceId, label: String(d.label ?? '') }))
      : [];
    this.devicesKnown = true;
    const { store, settings } = this.o;
    const saved = settings.settings.micDeviceId;
    const found = this.findSavedMic();
    if (saved && !found) {
      store.addNotice(MIC_MISSING_NOTICE, 'warning', MIC_MISSING_MESSAGE);
    } else {
      store.removeNotice(MIC_MISSING_NOTICE);
      // O mesmo microfone com outro identificador (o sistema o trocou): guarda o novo.
      if (found && found.deviceId !== saved) void settings.update({ micDeviceId: found.deviceId, micLabel: found.label });
    }
    if (this.devices.length > 0) store.removeNotice(VOICE_START_NOTICE);
    // O microfone voltou: a captura reinicia e a voz volta a ouvir sozinha (US-034 AC-2).
    if (this.state === 'failed' && (this.fault === 'mic-lost' || this.fault === 'no-mic') && this.micAvailable()) {
      this.restartSession();
    }
  }

  private findSavedMic(): MicDevice | undefined {
    const { micDeviceId, micLabel } = this.o.settings.settings;
    if (!micDeviceId) return undefined;
    return this.devices.find((d) => d.deviceId === micDeviceId) ?? (micLabel ? this.devices.find((d) => d.label === micLabel) : undefined);
  }

  private micAvailable(): boolean {
    if (this.o.settings.settings.micDeviceId) return Boolean(this.findSavedMic());
    return this.devices.length > 0;
  }

  /* ---------- Falha e recuperação ---------- */

  private fail(fault: EngineFault): void {
    const { store } = this.o;
    const now = this.o.now();
    this.cancelWaiting();
    this.restartCancel?.();
    this.restartCancel = null;
    // O texto fica parado onde está, visível em todas as saídas (US-034 AC-1).
    store.engine.holdVoice(now);
    this.fault = fault;
    // Um único aviso, com a hora atualizada (US-034 EC-2).
    store.addNotice(VOICE_FAULT_NOTICE, 'danger', faultReason(fault, this.platform), now);
    if (fault === 'engine-crashed') this.scheduleRestart();
    if (this.state !== 'failed') this.setState('failed');
    else this.publish();
  }

  private scheduleRestart(): void {
    if (this.restartAttempts >= ENGINE_RESTART_DELAYS_MS.length) return; // fica em `failed`
    const attempt = ++this.restartAttempts;
    const at = this.o.now() + ENGINE_RESTART_DELAYS_MS[attempt - 1];
    this.restartCancel = this.o.scheduler.at(at, () => {
      this.restartCancel = null;
      if (this.state !== 'failed' || this.fault !== 'engine-crashed') return;
      logEngineRestart(this.engine, attempt, (event, fields) => this.log(event, fields));
      this.restartSession();
    });
  }

  private recover(): void {
    this.o.store.removeNotice(VOICE_FAULT_NOTICE);
    this.fault = null;
    this.setState(this.cursor >= this.tokens.length - 1 && this.tokens.length > 0 ? 'waiting' : 'listening');
    if (this.state === 'listening') this.armWaiting();
  }

  /* ---------- Esperando ---------- */

  private armWaiting(): void {
    this.cancelWaiting();
    this.waitingCancel = this.o.scheduler.at(this.o.now() + WAITING_AFTER_MS, () => {
      this.waitingCancel = null;
      if (this.state === 'listening') this.setState('waiting');
    });
  }

  private cancelWaiting(): void {
    this.waitingCancel?.();
    this.waitingCancel = null;
  }

  private cancelTimers(): void {
    this.cancelWaiting();
    this.restartCancel?.();
    this.restartCancel = null;
  }

  /* ---------- Rolagem e texto ---------- */

  private afterScroll(cmd: ScrollCommand, result: ScrollApplyResult): void {
    if (cmd.type === 'autoStart' && result === 'ok') {
      // Iniciar a automática desliga a voz (ADR-005).
      this.turnOff();
      return;
    }
    if (result === 'ok' && RESYNC_COMMANDS.has(cmd.type)) this.resyncFromBand();
  }

  /** O cursor vai para antes da linha que está (ou vai ficar) na faixa (US-033 AC-2, EC-3). */
  private resyncFromBand(): void {
    const lines = this.layout?.lines ?? [];
    if (lines.length === 0 || this.tokens.length === 0) {
      this.cursor = 0;
      return;
    }
    const y = segmentTarget(this.o.store.engine.segment);
    let line = 0;
    while (line + 1 < lines.length && lines[line + 1].y <= y + 0.5) line++;
    this.cursor = resyncFromBand(this.tokens, line);
  }

  private afterLayout(kind: LayoutKind, layout: LayoutResult, text: string): void {
    this.layout = layout;
    this.tokens = buildScriptTokens(text, layout.lines);
    if (kind === 'load') this.cursor = 0;
    else if (kind === 'replace') this.resyncFromBand();
    else this.cursor = Math.min(this.cursor, Math.max(0, this.tokens.length - 1));
    if (this.state === 'off') return;
    if (text.trim() === '') {
      this.turnOff();
      return;
    }
    if (text !== this.vocabularyText) {
      // Texto novo confirmado com a voz ligada: o vocabulário muda e o estado não (UT-101).
      this.vocabularyText = text;
      this.o.port.run({ op: 'setVocabulary', session: this.session, vocabulary: buildSpokenVocabulary(text) });
    }
  }

  /* ---------- Estado e sinal ---------- */

  private setState(next: VoiceState): void {
    const from = this.state;
    this.state = next;
    if (next !== 'failed') this.fault = null;
    if (from !== next) {
      this.log('voice.state', { from, to: next, fault: this.fault, engine: this.engine });
      this.scheduleSignal();
    }
    this.publish();
  }

  private publish(): void {
    this.o.store.setVoice({ state: this.state, fault: this.fault, lagMs: this.lagMs });
  }

  /** O sinal das saídas só muda com o estado estável por 700 ms (US-035 EC-3). */
  private scheduleSignal(): void {
    this.signalCancel?.();
    this.signalCancel = null;
    if (this.state === this.signalSent) return;
    const target = this.state;
    this.signalCancel = this.o.scheduler.at(this.o.now() + SIGNAL_DEBOUNCE_MS, () => {
      this.signalCancel = null;
      if (this.state !== target) return;
      this.signalSent = target;
      this.o.outputs?.setVoiceState(target);
    });
  }

  /** Estado já enviado às saídas. */
  get signalState(): VoiceState {
    return this.signalSent;
  }

  dispose(): void {
    this.cancelTimers();
    this.signalCancel?.();
    this.signalCancel = null;
    this.offs.forEach((off) => off());
    this.lagLog.flush(this.o.now());
  }
}
