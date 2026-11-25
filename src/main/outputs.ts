/**
 * Saídas de TP (TechSpec, "Saídas (`OutputManager`)"; US-015 a US-020; ADR-001, ADR-010).
 *
 * - Abrir: uma janela sem moldura, com `backgroundThrottling: false`, nos `bounds` do
 *   monitor, em tela cheia (`fullscreen` no Windows, `simpleFullScreen` no Mac) e com o
 *   fundo da aparência, para nascer sem piscar.
 * - Numeração: o menor número livre a partir de 1. O número aparece na saída por
 *   `ID_BADGE_MS` só quando ela é aberta pela tela de controle.
 * - Inversões (`mirrorH`, `flipV`) e o sinal de voz ficam guardados por monitor em
 *   `ajustes.json`; mudar uma inversão não emite trecho de movimento.
 * - Monitor desligado: a saída vira `down`, com aviso. Monitor de volta: reabre depois de
 *   `DISPLAY_STABLE_MS` de estabilidade, sem o número, uma única vez por saída.
 * - A janela de controle nunca recebe saída; quando fica sem monitor próprio (o dela
 *   sumiu ou tem saída), vai para o primeiro monitor livre assim que houver um.
 * - Esc numa saída é anulado, e a saída arrastada ou fora da tela cheia volta ao lugar.
 * - O `PowerGuard` fica ligado enquanto houver ao menos uma saída `open`.
 */
import { DISPLAY_STABLE_MS } from '@shared/defaults';
import type { OutputCommand, OutputFailure, OutputView } from '@shared/ipc';
import type { MotionSegment } from '@shared/motion';
import {
  err,
  ok,
  type Appearance,
  type DisplayInfo,
  type LayoutResult,
  type NoticeKind,
  type OutputInfo,
  type Result,
  type SavedOutput,
  type VoiceState,
} from '@shared/types';
import { displayKey, displayLabel, displaySize, matchDisplay, parseDisplayKey, type DisplayRegistry } from './displays';
import type { Platform, PlatformDisplay, Rect, WindowLike } from './platform';
import { PowerGuard } from './power';
import type { Scheduler } from './scroll-engine';
import type { LogFn, SettingsStore } from './settings';
import { createOutputWindow, type WindowPaths } from './windows';

/** Onde a janela de uma saída fica: os `bounds` do monitor em tela cheia, ou um retângulo (monitores virtuais). */
export interface OutputPlacement {
  bounds: Rect;
  fullscreen: boolean;
}

export interface OutputNotices {
  add(id: string, kind: NoticeKind, message: string): void;
  remove(id: string): void;
}

export interface OutputManagerOptions {
  platform: Platform;
  displays: DisplayRegistry;
  settings: SettingsStore;
  scheduler: Scheduler;
  now: () => number;
  paths: WindowPaths;
  isMac: boolean;
  controlWindow: () => WindowLike | null;
  appearance: () => Appearance;
  notices?: OutputNotices;
  log?: LogFn;
  /** Saídas ou monitores mudaram: o `AppStore` republica o estado. */
  onChange?: () => void;
  /** Cada janela de saída criada (o `KeymapService` passa a ouvir as teclas dela). */
  onWindow?: (win: WindowLike, outputId: number) => void;
  placement?: (d: PlatformDisplay) => OutputPlacement;
  power?: PowerGuard;
}

interface Output {
  info: OutputInfo;
  win: WindowLike | null;
  display: PlatformDisplay | null;
  /** A página da janela já carregou e recebe mensagens. */
  ready: boolean;
  /** O próximo `state:output` leva `showBadge: true` (aberta pela tela de controle). */
  badge: boolean;
  reopenCancel: (() => void) | null;
}

/** Tolerância para comparar `bounds` (arredondamentos do sistema). */
const BOUNDS_TOLERANCE = 2;

export const downNoticeId = (id: number): string => `output-down-${id}`;
export const downMessage = (id: number, label: string): string => `Saída ${id} caiu (${label})`;

/** Duas `displayKey` guardadas são do mesmo monitor (mesmas regras de `matchDisplay`). */
export function sameDisplay(a: string, b: string): boolean {
  if (a === b) return true;
  const p = parseDisplayKey(b);
  if (!p) return false;
  const size = { width: p.width, height: p.height };
  const bounds = { x: 0, y: 0, ...size };
  return matchDisplay(a, { id: p.id, label: p.label, bounds, workArea: bounds, scaleFactor: 1, size });
}

const sameBounds = (a: Rect, b: Rect): boolean =>
  Math.abs(a.x - b.x) <= BOUNDS_TOLERANCE &&
  Math.abs(a.y - b.y) <= BOUNDS_TOLERANCE &&
  Math.abs(a.width - b.width) <= BOUNDS_TOLERANCE &&
  Math.abs(a.height - b.height) <= BOUNDS_TOLERANCE;

export class OutputManager {
  readonly power: PowerGuard;
  private readonly o: OutputManagerOptions;
  private readonly log: LogFn;
  private readonly outputsById = new Map<number, Output>();
  private readonly offs: (() => void)[] = [];
  private layout: LayoutResult | null = null;
  private segment: MotionSegment = { kind: 'hold', y: 0 };
  private voiceState: VoiceState = 'off';
  private disposed = false;

  constructor(options: OutputManagerOptions) {
    this.o = options;
    this.log = options.log ?? (() => undefined);
    this.power = options.power ?? new PowerGuard(options.platform.powerSaveBlocker);
    this.offs.push(
      options.displays.on('display-removed', (d) => this.displayRemoved(d)),
      options.displays.on('display-added', (d) => this.displayAdded(d)),
      options.displays.on('display-metrics-changed', (d) => this.displayChanged(d)),
    );
  }

  /* ---------- Leitura ---------- */

  outputs(): OutputInfo[] {
    return [...this.outputsById.values()].sort((a, b) => a.info.id - b.info.id).map((x) => ({ ...x.info }));
  }

  displays(): DisplayInfo[] {
    const control = this.controlDisplay();
    const primary = this.o.displays.primary();
    return this.o.displays.list().map((d) => ({
      displayKey: displayKey(d),
      id: d.id,
      label: displayLabel(d),
      size: displaySize(d),
      bounds: { ...d.bounds },
      primary: primary?.id === d.id,
      hasControl: control?.id === d.id && !this.outputOn(d),
      outputId: this.outputOn(d)?.info.id ?? null,
    }));
  }

  /** A saída dona desta `webContents` (para os eventos que as saídas mandam). */
  outputIdOf(webContentsId: number): number | null {
    for (const out of this.outputsById.values()) {
      if (out.win && !out.win.isDestroyed() && out.win.webContents.id === webContentsId) return out.info.id;
    }
    return null;
  }

  /** A janela da saída `id`, se estiver aberta. */
  windowOf(id: number): WindowLike | null {
    const win = this.outputsById.get(id)?.win ?? null;
    return win && !win.isDestroyed() ? win : null;
  }

  /** O que a saída `id` recebe agora. */
  view(id: number): OutputView | null {
    const out = this.outputsById.get(id);
    return out ? this.viewOf(out, false) : null;
  }

  get openCount(): number {
    return [...this.outputsById.values()].filter((x) => x.info.state === 'open').length;
  }

  /* ---------- Comandos (`cmd:output`) ---------- */

  command(cmd: OutputCommand): Result<OutputInfo, OutputFailure> {
    switch (cmd.op) {
      case 'open':
        return this.open(cmd.displayKey);
      case 'close':
        return this.close(cmd.id);
      case 'set':
        return this.set(cmd.id, cmd);
    }
  }

  open(key: string): Result<OutputInfo, OutputFailure> {
    const d = this.o.displays.find(key);
    if (!d) return err('display-missing');
    if (this.controlDisplay()?.id === d.id && !this.outputOn(d)) return err('control-display');
    if (this.outputOn(d) || this.pendingOn(d)) return err('display-busy');
    const saved = this.savedFor(key);
    const out: Output = {
      info: {
        id: this.nextId(),
        displayKey: key,
        label: displayLabel(d),
        size: displaySize(d),
        state: 'open',
        mirrorH: saved?.mirrorH ?? false,
        flipV: saved?.flipV ?? false,
        voiceSignal: saved?.voiceSignal ?? true,
      },
      win: null,
      display: null,
      ready: false,
      badge: true,
      reopenCancel: null,
    };
    this.outputsById.set(out.info.id, out);
    this.openWindow(out, d);
    this.log('output.open', { id: out.info.id, displayKey: key, label: out.info.label });
    this.saveOutput(out.info);
    this.afterChange();
    return ok({ ...out.info });
  }

  close(id: number): Result<OutputInfo, OutputFailure> {
    const out = this.outputsById.get(id);
    if (!out) return err('display-missing');
    out.reopenCancel?.();
    out.reopenCancel = null;
    this.destroyWindow(out);
    out.info.state = 'closed';
    this.outputsById.delete(id);
    this.forgetOutput(out.info.displayKey);
    this.o.notices?.remove(downNoticeId(id));
    this.log('output.close', { id, displayKey: out.info.displayKey, label: out.info.label });
    this.afterChange();
    return ok({ ...out.info });
  }

  set(id: number, patch: { mirrorH?: boolean; flipV?: boolean; voiceSignal?: boolean }): Result<OutputInfo, OutputFailure> {
    const out = this.outputsById.get(id);
    if (!out) return err('display-missing');
    if (typeof patch.mirrorH === 'boolean') out.info.mirrorH = patch.mirrorH;
    if (typeof patch.flipV === 'boolean') out.info.flipV = patch.flipV;
    if (typeof patch.voiceSignal === 'boolean') out.info.voiceSignal = patch.voiceSignal;
    this.saveOutput(out.info);
    // Só a saída mudada recebe o estado novo; nenhum trecho de movimento é emitido.
    this.sendView(out);
    this.o.onChange?.();
    return ok({ ...out.info });
  }

  /**
   * Abertura do programa (US-020): reabre, sem o número, as saídas guardadas cujo monitor
   * está ligado. As outras ficam `down` em silêncio e reabrem quando o monitor aparecer.
   * Um monitor guardado que agora é o da tela de controle não recebe saída.
   */
  restore(): void {
    const control = this.controlDisplay();
    for (const saved of this.o.settings.settings.outputs) {
      if (control && matchDisplay(saved.displayKey, control)) continue;
      if ([...this.outputsById.values()].some((x) => sameDisplay(saved.displayKey, x.info.displayKey))) continue;
      const d = this.o.displays.findMatch(saved.displayKey, (x) => this.isTaken(x));
      const out: Output = {
        info: {
          id: this.nextId(),
          displayKey: d ? displayKey(d) : saved.displayKey,
          label: d ? displayLabel(d) : saved.label || saved.displayKey,
          size: d ? displaySize(d) : saved.size,
          state: d ? 'open' : 'down',
          mirrorH: saved.mirrorH,
          flipV: saved.flipV,
          voiceSignal: saved.voiceSignal,
        },
        win: null,
        display: null,
        ready: false,
        badge: false,
        reopenCancel: null,
      };
      this.outputsById.set(out.info.id, out);
      if (d) {
        this.openWindow(out, d);
        this.log('output.open', { id: out.info.id, displayKey: out.info.displayKey, label: out.info.label, restored: true });
        if (out.info.displayKey !== saved.displayKey) this.saveOutput(out.info);
      }
    }
    this.afterChange();
  }

  /* ---------- O que as saídas desenham ---------- */

  setLayout(layout: LayoutResult): void {
    this.layout = layout;
    for (const out of this.outputsById.values()) {
      if (out.win && !out.win.isDestroyed()) out.win.setBackgroundColor(layout.appearance.backgroundColor);
      this.sendView(out);
    }
  }

  setSegment(segment: MotionSegment): void {
    this.segment = segment;
    for (const out of this.outputsById.values()) this.send(out, 'motion:segment', segment);
  }

  /** Estado da voz para o sinal discreto (a tarefa da voz aplica o atraso de estabilidade antes). */
  setVoiceState(state: VoiceState): void {
    if (state === this.voiceState) return;
    this.voiceState = state;
    for (const out of this.outputsById.values()) this.sendView(out);
  }

  /** Fecha todas as janelas sem mexer nas saídas guardadas (fechamento do programa). */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const out of this.outputsById.values()) {
      out.reopenCancel?.();
      out.reopenCancel = null;
      this.destroyWindow(out);
    }
    this.power.dispose();
    this.offs.forEach((off) => off());
  }

  /* ---------- Monitores ---------- */

  private displayRemoved(d: PlatformDisplay): void {
    if (this.disposed) return;
    for (const out of this.outputsById.values()) {
      if (out.info.state === 'open' && out.display?.id === d.id) {
        this.destroyWindow(out);
        out.info.state = 'down';
        out.display = null;
        this.log('output.down', { id: out.info.id, displayKey: out.info.displayKey, label: out.info.label });
        this.o.notices?.add(downNoticeId(out.info.id), 'warning', downMessage(out.info.id, out.info.label));
      } else if (out.info.state === 'down' && out.reopenCancel && matchDisplay(out.info.displayKey, d)) {
        // O monitor sumiu de novo antes de ficar estável: espera o próximo retorno.
        out.reopenCancel();
        out.reopenCancel = null;
      }
    }
    this.afterChange();
  }

  private displayAdded(d: PlatformDisplay): void {
    if (this.disposed) return;
    for (const out of this.outputsById.values()) {
      if (out.info.state === 'down' && matchDisplay(out.info.displayKey, d)) this.scheduleReopen(out);
    }
    this.afterChange();
  }

  private displayChanged(d: PlatformDisplay): void {
    if (this.disposed) return;
    for (const out of this.outputsById.values()) {
      if (out.info.state !== 'open' || out.display?.id !== d.id) continue;
      out.display = d;
      out.info.size = displaySize(d);
      this.guardBounds(out, false);
    }
    this.afterChange();
  }

  /** Reabre depois de `DISPLAY_STABLE_MS`; um novo retorno do monitor recomeça a espera (uma janela só). */
  private scheduleReopen(out: Output): void {
    out.reopenCancel?.();
    out.reopenCancel = this.o.scheduler.at(this.o.now() + DISPLAY_STABLE_MS, () => {
      out.reopenCancel = null;
      if (this.disposed || out.info.state !== 'down' || this.outputsById.get(out.info.id) !== out) return;
      const d = this.o.displays.findMatch(out.info.displayKey, (x) => this.isTaken(x) || this.controlDisplay()?.id === x.id);
      if (!d) return;
      const before = out.info.displayKey;
      out.info.displayKey = displayKey(d);
      out.info.label = displayLabel(d);
      out.info.size = displaySize(d);
      out.info.state = 'open';
      out.badge = false;
      this.openWindow(out, d);
      this.o.notices?.remove(downNoticeId(out.info.id));
      this.log('output.reopen', { id: out.info.id, displayKey: out.info.displayKey, label: out.info.label });
      if (before !== out.info.displayKey) this.saveOutput(out.info, before);
      this.afterChange();
    });
  }

  /* ---------- Janela de controle ---------- */

  /** O monitor onde está a janela de controle. */
  private controlDisplay(): PlatformDisplay | undefined {
    const win = this.o.controlWindow();
    if (!win || win.isDestroyed()) return undefined;
    return this.o.displays.matching(win.getBounds());
  }

  /**
   * A janela de controle sem monitor próprio (o dela sumiu ou tem saída) vai para o
   * primeiro monitor livre. Nenhuma saída fecha para dar lugar a ela (US-018 EC-1).
   */
  private relocateControl(): void {
    const win = this.o.controlWindow();
    if (!win || win.isDestroyed()) return;
    const current = this.controlDisplay();
    if (current && !this.outputOn(current) && this.o.displays.list().some((d) => d.id === current.id)) return;
    const free = this.o.displays.list().find((d) => !this.isTaken(d));
    if (!free) return;
    const b = win.getBounds();
    const area = free.workArea;
    const width = Math.min(b.width, area.width);
    const height = Math.min(b.height, area.height);
    if (win.isMinimized()) win.restore();
    win.setBounds({
      x: Math.round(area.x + (area.width - width) / 2),
      y: Math.round(area.y + (area.height - height) / 2),
      width,
      height,
    });
    void this.o.settings.update({ controlDisplayKey: displayKey(free) });
  }

  /* ---------- Janelas de saída ---------- */

  private placement(d: PlatformDisplay): OutputPlacement {
    return this.o.placement?.(d) ?? { bounds: { ...d.bounds }, fullscreen: true };
  }

  private openWindow(out: Output, d: PlatformDisplay): void {
    const place = this.placement(d);
    const background = this.layout?.appearance.backgroundColor ?? this.o.appearance().backgroundColor;
    const win = createOutputWindow(this.o.platform, this.o.paths, {
      bounds: place.bounds,
      backgroundColor: background,
      isMac: this.o.isMac,
      fullscreen: place.fullscreen,
    });
    out.win = win;
    out.display = d;
    out.ready = false;
    win.webContents.on('did-finish-load', () => {
      if (out.win !== win) return;
      out.ready = true;
      // Primeiro o layout, depois o trecho em curso (a mesma ordem do `AppStore`).
      this.sendView(out);
      this.send(out, 'motion:segment', this.segment);
    });
    // Esc numa saída não a fecha nem a tira da tela cheia (US-019 AC-2).
    win.webContents.on('before-input-event', (...args: unknown[]) => {
      const [event, input] = args as [{ preventDefault(): void }, { key?: string; type?: string }];
      if (input?.key === 'Escape' || input?.key === 'Esc') event.preventDefault();
    });
    // Fechar é só pela tela de controle ou pelo atalho; o fechamento do sistema (Alt+F4) é anulado.
    win.on('close', (...args: unknown[]) => {
      if (out.win === win && !this.disposed) (args[0] as { preventDefault(): void } | undefined)?.preventDefault();
    });
    win.on('closed', () => {
      if (out.win !== win || this.disposed) return;
      // A janela sumiu por fora (falha do sistema): a saída fecha e o resto continua.
      out.win = null;
      this.close(out.info.id);
    });
    for (const event of ['move', 'moved', 'resize', 'resized']) win.on(event, () => this.guardBounds(out, false));
    win.on('leave-full-screen', () => this.guardBounds(out, true));
    this.o.onWindow?.(win, out.info.id);
  }

  /** Devolve a saída arrastada, redimensionada ou fora da tela cheia ao seu monitor (US-017 EC-2). */
  private guardBounds(out: Output, leftFullScreen: boolean): void {
    const win = out.win;
    const d = out.display;
    if (!win || win.isDestroyed() || !d || this.disposed) return;
    const place = this.placement(d);
    const moved = !sameBounds(win.getBounds(), place.bounds);
    if (moved) win.setBounds(place.bounds);
    if (place.fullscreen && (leftFullScreen || moved)) {
      if (this.o.isMac) win.setSimpleFullScreen(true);
      else win.setFullScreen(true);
    }
  }

  private destroyWindow(out: Output): void {
    const win = out.win;
    out.win = null;
    out.ready = false;
    if (win && !win.isDestroyed()) win.destroy();
  }

  private viewOf(out: Output, consumeBadge: boolean): OutputView {
    const showBadge = out.badge;
    if (consumeBadge) out.badge = false;
    return {
      id: out.info.id,
      layout: this.layout,
      mirrorH: out.info.mirrorH,
      flipV: out.info.flipV,
      voiceSignal: out.info.voiceSignal,
      voiceState: this.voiceState,
      showBadge,
    };
  }

  private sendView(out: Output): void {
    if (!out.ready || !out.win || out.win.isDestroyed()) return;
    out.win.webContents.send('state:output', this.viewOf(out, true));
  }

  private send(out: Output, channel: string, payload: unknown): void {
    if (!out.ready || !out.win || out.win.isDestroyed()) return;
    out.win.webContents.send(channel, payload);
  }

  /* ---------- Auxiliares ---------- */

  private outputOn(d: PlatformDisplay): Output | undefined {
    return [...this.outputsById.values()].find((x) => x.info.state === 'open' && x.display?.id === d.id);
  }

  /** Uma saída caída esperando a estabilidade deste monitor para reabrir. */
  private pendingOn(d: PlatformDisplay): Output | undefined {
    return [...this.outputsById.values()].find((x) => x.info.state === 'down' && x.reopenCancel && matchDisplay(x.info.displayKey, d));
  }

  private isTaken(d: PlatformDisplay): boolean {
    return Boolean(this.outputOn(d));
  }

  private nextId(): number {
    let id = 1;
    while (this.outputsById.has(id)) id++;
    return id;
  }

  private savedFor(key: string): SavedOutput | undefined {
    const list = this.o.settings.settings.outputs;
    return list.find((s) => s.displayKey === key) ?? list.find((s) => sameDisplay(s.displayKey, key));
  }

  /** Guarda (ou atualiza) a saída deste monitor em `ajustes.json`. */
  private saveOutput(info: OutputInfo, previousKey?: string): void {
    const entry: SavedOutput = {
      displayKey: info.displayKey,
      label: info.label,
      size: info.size,
      mirrorH: info.mirrorH,
      flipV: info.flipV,
      voiceSignal: info.voiceSignal,
    };
    const keys = [info.displayKey, previousKey].filter((k): k is string => Boolean(k));
    const others = this.o.settings.settings.outputs.filter((s) => !keys.some((k) => sameDisplay(s.displayKey, k)));
    void this.o.settings.update({ outputs: [...others, entry] });
  }

  private forgetOutput(key: string): void {
    const outputs = this.o.settings.settings.outputs.filter((s) => !sameDisplay(s.displayKey, key));
    void this.o.settings.update({ outputs });
  }

  private afterChange(): void {
    if (this.disposed) return;
    this.power.update(this.openCount);
    this.relocateControl();
    this.o.onChange?.();
  }
}
