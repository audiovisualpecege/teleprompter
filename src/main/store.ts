/**
 * Estado único do programa (TechSpec, "Visão dos componentes"; ADR-006).
 *
 * - Aplica os comandos de `cmd:scroll`, `cmd:doc`, `cmd:appearance` e `cmd:settings`.
 * - Publica `StateSnapshot` (estado) e `MotionSegment` (rolagem, nunca a posição
 *   quadro a quadro).
 * - Quando o texto confirmado ou a aparência muda, pede a diagramação à janela de
 *   controle (`layout:request` com `revision`). Ao receber o `layout:result` mais
 *   novo, publica o layout às saídas e só depois reancora a posição, para que as
 *   janelas tenham o layout novo antes do trecho novo.
 * - Documento: `dirty` (rascunho ou aparência diferente do último salvo) e `pending`
 *   (rascunho diferente do texto confirmado) podem coexistir.
 * - Nenhum erro de arquivo derruba o programa nem perde o texto em edição.
 */
import { sameAppearance, sanitizeAppearance } from '@shared/appearance';
import { RECOVERY_SAVE_MS } from '@shared/defaults';
import { fileErrorMessage } from '@shared/file-errors';
import { UNSAVED_OPTIONS, type DocCommand, type DocFailure, type LayoutRequest, type SettingsCommand, type UnsavedChoice } from '@shared/ipc';
import type { MotionSegment } from '@shared/motion';
import {
  err,
  ok,
  type Appearance,
  type DocPrompt,
  type FileError,
  type LayoutResult,
  type Notice,
  type NoticeKind,
  type Result,
  type ScrollCommand,
  type Settings,
  type StateSnapshot,
  type VoiceStatus,
} from '@shared/types';
import { ignoredMessage } from './import-docx';
import type { RecoveryStore } from './recovery';
import { createScrollEngine, type Scheduler, type ScrollApplyResult, type ScrollEngine } from './scroll-engine';
import type { ScriptFiles } from './script-files';
import type { LogFn, SettingsStore } from './settings';

export interface AppStoreOptions {
  files: ScriptFiles;
  settings: SettingsStore;
  recovery: RecoveryStore;
  scheduler: Scheduler;
  now: () => number;
  log?: LogFn;
  engine?: ScrollEngine;
}

type DocResult = Result<void, DocFailure>;

const MAX_NOTICES = 5;

const needsConfirmation = (): DocResult => err({ code: 'needs-confirmation', options: UNSAVED_OPTIONS });

export class AppStore {
  readonly engine: ScrollEngine;
  private readonly files: ScriptFiles;
  private readonly settings: SettingsStore;
  private readonly recovery: RecoveryStore;
  private readonly scheduler: Scheduler;
  private readonly now: () => number;
  private readonly log: LogFn;

  private filePath: string | null = null;
  private draft = '';
  private confirmed = '';
  private appearance: Appearance;
  /** Último salvo; `null` depois de recuperar (sempre há alteração não salva). */
  private saved: { text: string; appearance: Appearance } | null;
  private notices: Notice[] = [];
  private noticeSeq = 0;
  private prompt: DocPrompt | null = null;
  private editorFocused = false;
  private voice: VoiceStatus;

  private revision = 0;
  private requested = new Map<number, string>();
  /** Texto do layout aplicado agora (`null` antes do primeiro). */
  private appliedText: string | null = null;
  private appliedRevision = 0;
  /** O próximo layout volta a posição a 0 (abrir, novo). */
  private resetOnLayout = true;

  private recoveryCancel: (() => void) | null = null;
  private recoveryWritten: string | null = null;
  private pendingIo: Promise<void> = Promise.resolve();

  private readonly snapshotListeners = new Set<(s: StateSnapshot) => void>();
  private readonly segmentListeners = new Set<(s: MotionSegment) => void>();
  private readonly layoutRequestListeners = new Set<(r: LayoutRequest) => void>();
  private readonly layoutListeners = new Set<(l: LayoutResult) => void>();
  private readonly quitListeners = new Set<() => void>();

  constructor(options: AppStoreOptions) {
    this.files = options.files;
    this.settings = options.settings;
    this.recovery = options.recovery;
    this.scheduler = options.scheduler;
    this.now = options.now;
    this.log = options.log ?? (() => undefined);
    const s = this.settings.settings;
    this.appearance = { ...s.lastAppearance };
    this.saved = { text: '', appearance: { ...this.appearance } };
    this.voice = { state: 'off', fault: null, engine: s.voiceEngine, mode: s.voiceMode, lagMs: null };
    this.engine = options.engine ?? createScrollEngine({ scheduler: this.scheduler, speed: s.speed });
    this.engine.onSegment((seg) => this.segmentListeners.forEach((cb) => cb(seg)));
    this.engine.onAutoEnded(() => this.publish());
  }

  /**
   * Abertura do programa: lê os ajustes (aviso único se estavam corrompidos) e
   * oferece a recuperação se houver `recuperacao.json`.
   */
  async init(): Promise<void> {
    const { settings, corrupt } = this.settings.load();
    this.appearance = { ...settings.lastAppearance };
    this.saved = { text: '', appearance: { ...this.appearance } };
    this.voice = { ...this.voice, engine: settings.voiceEngine, mode: settings.voiceMode };
    this.engine.apply({ type: 'setSpeed', speed: settings.speed }, this.now());
    if (corrupt) this.notify('warning', 'Os ajustes guardados não puderam ser lidos. O programa voltou aos ajustes padrão', 'settings.corrupt');
    const rec = await this.recovery.read();
    if (rec) this.prompt = { kind: 'recovery', savedAt: rec.savedAt, filePath: rec.filePath };
    this.requestLayout();
    this.publish();
  }

  /* ---------- Assinaturas ---------- */

  onSnapshot(cb: (s: StateSnapshot) => void): () => void {
    this.snapshotListeners.add(cb);
    return () => this.snapshotListeners.delete(cb);
  }
  onSegment(cb: (s: MotionSegment) => void): () => void {
    this.segmentListeners.add(cb);
    return () => this.segmentListeners.delete(cb);
  }
  onLayoutRequest(cb: (r: LayoutRequest) => void): () => void {
    this.layoutRequestListeners.add(cb);
    return () => this.layoutRequestListeners.delete(cb);
  }
  /** Layout aplicado, sempre antes do trecho de movimento reancorado. */
  onLayout(cb: (l: LayoutResult) => void): () => void {
    this.layoutListeners.add(cb);
    return () => this.layoutListeners.delete(cb);
  }
  /** O fechamento foi liberado (sem alterações ou depois da resposta). */
  onQuit(cb: () => void): () => void {
    this.quitListeners.add(cb);
    return () => this.quitListeners.delete(cb);
  }

  get dirty(): boolean {
    return (
      this.saved === null || this.draft !== this.saved.text || !sameAppearance(this.appearance, this.saved.appearance)
    );
  }

  get pending(): boolean {
    return this.draft !== this.confirmed;
  }

  get layout(): LayoutResult | null {
    return this.engine.layout;
  }

  snapshot(): StateSnapshot {
    return {
      doc: {
        filePath: this.filePath,
        draftText: this.draft,
        confirmedText: this.confirmed,
        dirty: this.dirty,
        pending: this.pending,
      },
      appearance: { ...this.appearance },
      automation: this.engine.automation,
      speed: this.engine.speed,
      voice: { ...this.voice },
      outputs: [],
      displays: [],
      editorFocused: this.editorFocused,
      update: null,
      notices: [...this.notices],
      prompt: this.prompt,
    };
  }

  /** Espera as gravações em curso (recuperação, ajustes). */
  async flush(): Promise<void> {
    await this.pendingIo;
    await this.settings.flush();
  }

  /* ---------- Rolagem ---------- */

  scroll(cmd: ScrollCommand): ScrollApplyResult {
    const before = { automation: this.engine.automation, speed: this.engine.speed };
    const r = this.engine.apply(cmd, this.now());
    if (this.engine.speed !== before.speed) void this.settings.update({ speed: this.engine.speed });
    if (this.engine.automation !== before.automation || this.engine.speed !== before.speed) this.publish();
    return r;
  }

  setEditorFocused(focused: boolean): void {
    if (this.editorFocused === focused) return;
    this.editorFocused = focused;
    this.publish();
  }

  /* ---------- Diagramação ---------- */

  private requestLayout(): void {
    this.revision += 1;
    this.requested.set(this.revision, this.confirmed);
    const req: LayoutRequest = { revision: this.revision, text: this.confirmed, appearance: { ...this.appearance } };
    this.layoutRequestListeners.forEach((cb) => cb(req));
  }

  /** O pedido de diagramação mais novo (a janela de controle que acabou de carregar o recebe de novo). */
  currentLayoutRequest(): LayoutRequest {
    return { revision: this.revision, text: this.requested.get(this.revision) ?? this.appliedText ?? this.confirmed, appearance: { ...this.appearance } };
  }

  /** `layout:result`: só o mais novo vale; os outros chegaram atrasados. */
  layoutResult(layout: LayoutResult): void {
    if (layout.revision !== this.revision || this.appliedRevision === layout.revision) return;
    const text = this.requested.get(layout.revision);
    if (text === undefined) return;
    this.requested.clear();
    this.requested.set(layout.revision, text);
    // Primeiro o layout às janelas, depois o trecho reancorado.
    this.layoutListeners.forEach((cb) => cb(layout));
    const now = this.now();
    if (this.resetOnLayout || this.appliedText === null) this.engine.load(layout, now);
    else if (text !== this.appliedText) this.engine.replaceText(this.appliedText, text, layout, now);
    else this.engine.relayout(layout, now);
    this.resetOnLayout = false;
    this.appliedText = text;
    this.appliedRevision = layout.revision;
    this.publish();
  }

  /* ---------- Aparência ---------- */

  setAppearance(patch: Partial<Appearance>): Appearance {
    const next = sanitizeAppearance(patch as Record<string, unknown>, this.appearance);
    if (sameAppearance(next, this.appearance)) return { ...this.appearance };
    this.appearance = next;
    void this.settings.update({ lastAppearance: { ...next } });
    this.requestLayout();
    this.publish();
    return { ...next };
  }

  /* ---------- Ajustes ---------- */

  async settingsCommand(cmd: SettingsCommand): Promise<Settings> {
    if (cmd.op === 'resetAll') {
      const s = await this.settings.resetAll();
      this.engine.apply({ type: 'setSpeed', speed: s.speed }, this.now());
      this.voice = { ...this.voice, engine: s.voiceEngine, mode: s.voiceMode };
      this.publish();
      return s;
    }
    return this.settings.settings;
  }

  /* ---------- Documento ---------- */

  async doc(cmd: DocCommand): Promise<DocResult> {
    switch (cmd.op) {
      case 'setDraft':
        return this.setDraft(cmd.text);
      case 'confirm':
        return this.confirm();
      case 'discard':
        this.draft = this.confirmed;
        this.publish();
        return ok(undefined);
      case 'new':
        return this.guarded(cmd.unsaved, async () => {
          this.resetDoc('', '', null, { ...this.settings.settings.lastAppearance });
          return ok(undefined);
        });
      case 'open':
        return this.guarded(cmd.unsaved, () => this.open(cmd.path));
      case 'save':
        return this.save(false);
      case 'saveAs':
        return this.save(true);
      case 'import':
        return this.guarded(cmd.unsaved, () => this.importFile(cmd.path));
      case 'recover':
        return this.recover(cmd.accept ?? true);
      case 'close':
        return this.guarded(cmd.unsaved, async () => {
          await this.stopRecovery(true);
          this.quitListeners.forEach((cb) => cb());
          return ok(undefined);
        });
    }
  }

  /** Abrir pelo sistema (duplo clique, segunda instância): pergunta antes se houver alterações. */
  openFromSystem(path: string): Promise<DocResult> {
    if (this.dirty) {
      this.prompt = { kind: 'unsaved', op: 'open', path };
      this.publish();
      return Promise.resolve(needsConfirmation());
    }
    return this.doc({ op: 'open', path });
  }

  /** O sistema quer fechar a janela: `true` libera; `false` pergunta à tela antes. */
  requestClose(): boolean {
    if (!this.dirty) {
      void this.stopRecovery(true);
      return true;
    }
    this.prompt = { kind: 'unsaved', op: 'close', path: null };
    this.publish();
    return false;
  }

  dismissNotice(id: string): void {
    this.notices = this.notices.filter((n) => n.id !== id);
    this.publish();
  }

  private setDraft(text: string): DocResult {
    if (typeof text !== 'string') return ok(undefined);
    const normalized = text.replace(/\r\n?/g, '\n');
    if (normalized === this.draft) return ok(undefined);
    this.draft = normalized;
    this.publish();
    return ok(undefined);
  }

  private confirm(): DocResult {
    if (this.draft.trim() === '') return err('empty-text');
    if (this.draft === this.confirmed) return ok(undefined);
    this.confirmed = this.draft;
    this.requestLayout();
    this.publish();
    return ok(undefined);
  }

  /** Pergunta de alterações não salvas antes de trocar o documento ou fechar. */
  private async guarded(
    choice: UnsavedChoice | undefined,
    action: () => Promise<DocResult>,
  ): Promise<DocResult> {
    if (choice === 'cancel') {
      this.clearPrompt();
      return err('cancelled');
    }
    if (this.dirty) {
      if (choice === undefined) return needsConfirmation();
      if (choice === 'save') {
        const saved = await this.save(false);
        if (!saved.ok) {
          // "Salvar" falhou: a ação original é cancelada e o documento fica intacto.
          this.clearPrompt();
          return saved;
        }
      }
    }
    const r = await action();
    this.clearPrompt();
    return r;
  }

  private clearPrompt(): void {
    if (this.prompt?.kind !== 'unsaved') return;
    this.prompt = null;
    this.publish();
  }

  /** Troca o documento inteiro; o próximo layout volta a posição a 0 e pausa a automática. */
  private resetDoc(text: string, confirmed: string, filePath: string | null, appearance: Appearance): void {
    this.engine.apply({ type: 'autoPause' }, this.now());
    this.draft = text;
    this.confirmed = confirmed;
    this.filePath = filePath;
    this.appearance = appearance;
    this.saved = { text, appearance: { ...appearance } };
    this.resetOnLayout = true;
    this.requestLayout();
    this.publish();
  }

  private async open(path?: string): Promise<DocResult> {
    const target = path ?? (await this.files.pickOpen());
    if (!target) return err('cancelled');
    const r = await this.files.read(target);
    if (!r.ok) return this.fileFailure('open', r.error);
    this.resetDoc(r.value.text, r.value.text, target, r.value.appearance);
    if (r.value.warnings.includes('newer-version')) {
      this.notify('warning', 'Este roteiro foi salvo por uma versão mais nova do programa. Algum ajuste pode não ter sido aplicado');
    }
    return ok(undefined);
  }

  private async importFile(path?: string): Promise<DocResult> {
    const target = path ?? (await this.files.pickImport());
    if (!target) return err('cancelled');
    const r = await this.files.importFile(target);
    if (!r.ok) return this.fileFailure('import', r.error);
    // O texto importado é um roteiro novo: vai para o rascunho e as saídas não mudam.
    this.draft = r.value.text;
    this.filePath = null;
    this.saved = { text: '', appearance: { ...this.appearance } };
    const ignored = r.value.ignored ? ignoredMessage(r.value.ignored) : null;
    if (ignored) this.notify('info', ignored);
    this.publish();
    return ok(undefined);
  }

  private async save(asNew: boolean): Promise<DocResult> {
    let path = asNew || !this.filePath ? await this.files.pickSave(this.filePath ?? undefined) : this.filePath;
    if (!path) return err('cancelled');
    const content = { text: this.draft, appearance: { ...this.appearance } };
    let r = await this.files.write(path, content);
    if (!r.ok && r.error.code === 'not-found') {
      // O arquivo ou a pasta sumiu por fora: pede um novo local (US-004 EC-2).
      path = await this.files.pickSave(path);
      if (!path) return err('cancelled');
      r = await this.files.write(path, content);
    }
    if (!r.ok) return this.fileFailure('save', r.error);
    this.filePath = path;
    this.saved = { text: content.text, appearance: content.appearance };
    await this.stopRecovery(true);
    this.publish();
    return ok(undefined);
  }

  private async recover(accept: boolean): Promise<DocResult> {
    const data = await this.recovery.read();
    if (this.prompt?.kind === 'recovery') this.prompt = null;
    if (!data) {
      this.publish();
      return err({ code: 'not-found' });
    }
    if (!accept) {
      await this.recovery.clear();
      this.publish();
      return ok(undefined);
    }
    this.draft = data.draftText;
    this.filePath = data.filePath;
    if (!sameAppearance(data.appearance, this.appearance)) {
      this.appearance = data.appearance;
      this.requestLayout();
    }
    this.saved = null;
    this.publish();
    return ok(undefined);
  }

  private fileFailure(op: string, error: FileError): DocResult {
    this.log('file.error', { op, code: error.code });
    this.notify('danger', fileErrorMessage(error));
    this.publish();
    return err(error);
  }

  private notify(kind: NoticeKind, message: string, id?: string): void {
    const nid = id ?? `n${++this.noticeSeq}`;
    this.notices = [...this.notices.filter((n) => n.id !== nid), { id: nid, kind, message }].slice(-MAX_NOTICES);
  }

  /* ---------- Recuperação ---------- */

  private syncRecovery(): void {
    if (this.dirty) {
      if (!this.recoveryCancel) this.scheduleRecovery();
    } else if (this.recoveryCancel || this.recoveryWritten !== null) {
      void this.stopRecovery(true);
    }
  }

  private scheduleRecovery(): void {
    const at = this.now() + RECOVERY_SAVE_MS;
    this.recoveryCancel = this.scheduler.at(at, () => {
      this.recoveryCancel = null;
      if (!this.dirty) return;
      const data = { filePath: this.filePath, draftText: this.draft, appearance: { ...this.appearance }, savedAt: at };
      const key = JSON.stringify({ ...data, savedAt: 0 });
      if (key !== this.recoveryWritten) {
        this.recoveryWritten = key;
        void this.enqueue(() =>
          this.recovery.write(data).catch((e: unknown) => {
            this.recoveryWritten = null;
            this.log('file.error', { op: 'recovery', code: (e as { code?: string }).code ?? 'unknown' });
          }),
        );
      }
      this.scheduleRecovery();
    });
  }

  private async stopRecovery(clearFile: boolean): Promise<void> {
    this.recoveryCancel?.();
    this.recoveryCancel = null;
    this.recoveryWritten = null;
    if (clearFile) await this.enqueue(() => this.recovery.clear());
  }

  /** Gravações da recuperação em fila, na ordem em que foram pedidas. */
  private enqueue(fn: () => Promise<void>): Promise<void> {
    const next = this.pendingIo.then(fn, fn);
    this.pendingIo = next;
    return next;
  }

  /** Encerra temporizadores (fechamento do programa e testes). */
  dispose(): void {
    this.recoveryCancel?.();
    this.recoveryCancel = null;
  }

  private publish(): void {
    this.syncRecovery();
    const snap = this.snapshot();
    this.snapshotListeners.forEach((cb) => cb(snap));
  }
}
