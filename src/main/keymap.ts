/**
 * Atalhos de teclado (TechSpec, "Atalhos (`KeymapService`)"; US-023, US-024, US-027).
 *
 * - Captura pelo `before-input-event` de todas as janelas do programa (controle e saídas);
 *   nada fora do programa é capturado. Pedais e passadores imitam teclas e entram por aqui.
 * - Com o editor em foco (só na janela de controle), apenas combinações com Ctrl ou Cmd
 *   agem; Esc tira o foco do editor.
 * - Subir e descer: aperto curto anda uma linha; a primeira repetição do sistema
 *   (`isAutoRepeat`) passa a segurar, e soltar a tecla para. As outras ações ignoram a
 *   repetição: tecla segurada conta um só acionamento.
 * - Cada combinação pertence a no máximo uma ação; reservadas do sistema não são aceitas.
 * - O mapa fica em `ajustes.json` (lido sempre dos ajustes, então "Voltar ao padrão" vale na hora).
 */
import { defaultKeymap, SPEED_STEP } from '@shared/defaults';
import type { KeymapCommand, KeymapFailure } from '@shared/ipc';
import { err, ok, type ActionId, type Automation, type KeyCombo, type Keymap, type ManualScrollCommand, type Result } from '@shared/types';
import { comboId, comboFromInput as comboFrom, isModifierKey, isReserved, normalizeCombo, normalizeKey, sameCombo } from '@shared/keys';
import type { WindowLike } from './platform';
import type { LogFn, SettingsStore } from './settings';

export { comboId, isModifierKey, isReserved, normalizeCombo, normalizeKey, RESERVED_COMBOS, sameCombo } from '@shared/keys';

/** A tecla do `before-input-event` como `KeyCombo` (`null` para uma modificadora sozinha). */
export function comboFromInput(input: KeyInput, platform: string): KeyCombo | null {
  return comboFrom({ key: input.key, control: input.control, meta: input.meta, shift: input.shift, alt: input.alt }, platform === 'darwin');
}

export const ACTION_IDS: readonly ActionId[] = [
  'autoToggle',
  'down',
  'up',
  'faster',
  'slower',
  'toStart',
  'voiceToggle',
  'closeOutput',
];

/** De onde veio a tecla: a janela de controle ou a saída `id`. */
export type KeySource = { kind: 'control' } | { kind: 'output'; id: number };

/** O `input` do `before-input-event` do Electron. */
export interface KeyInput {
  type: string;
  key: string;
  control?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  isAutoRepeat?: boolean;
}

export interface KeymapHandlers {
  scroll(cmd: ManualScrollCommand): void;
  automation(): Automation;
  speed(): number;
  voiceToggle(): void;
  closeOutput(id: number): void;
  /** Esc com o editor em foco: a tela de controle tira o foco do editor. */
  editorBlur(): void;
}

/** O que o serviço fez com uma tecla (registro para os testes e o log). */
export type KeymapEvent =
  | { kind: 'action'; action: ActionId; source: KeySource }
  | { kind: 'editorBlur' }
  | { kind: 'scroll'; cmd: ManualScrollCommand };

export interface KeymapServiceOptions {
  settings: SettingsStore;
  /** `process.platform`: no Mac, `ctrlOrCmd` é o Cmd; nos outros, o Ctrl. */
  platform: string;
  editorFocused: () => boolean;
  handlers: KeymapHandlers;
  /** O mapa mudou: a tela de controle atualiza as dicas. */
  onChange?: (keymap: Keymap) => void;
  log?: LogFn;
}

const HOLD_ACTIONS: Partial<Record<ActionId, 1 | -1>> = { down: 1, up: -1 };

export class KeymapService {
  private readonly o: KeymapServiceOptions;
  private readonly log: LogFn;
  /** Teclas de subir e descer seguradas agora (pelo `comboId`). */
  private readonly held = new Map<string, 1 | -1>();
  private capturing = false;
  private readonly eventListeners = new Set<(e: KeymapEvent) => void>();

  constructor(options: KeymapServiceOptions) {
    this.o = options;
    this.log = options.log ?? (() => undefined);
  }

  get keymap(): Keymap {
    return cloneKeymap(this.o.settings.settings.keymap);
  }

  get platform(): string {
    return this.o.platform;
  }

  onEvent(cb: (e: KeymapEvent) => void): () => void {
    this.eventListeners.add(cb);
    return () => this.eventListeners.delete(cb);
  }

  /** A tela está gravando um atalho: as teclas vão direto para ela, sem agir. */
  setCapturing(flag: boolean): void {
    this.capturing = Boolean(flag);
    if (this.capturing) this.releaseHeld();
  }

  /** A ação desta combinação no mapa atual. */
  actionFor(combo: KeyCombo): ActionId | null {
    const id = comboId(combo);
    const map = this.o.settings.settings.keymap;
    for (const action of ACTION_IDS) if ((map[action] ?? []).some((x) => comboId(x) === id)) return action;
    return null;
  }

  /** Ouve as teclas de uma janela do programa. */
  attach(win: WindowLike, source: KeySource): void {
    win.webContents.on('before-input-event', (...args: unknown[]) => {
      const [event, input] = args as [{ preventDefault(): void }, KeyInput];
      if (this.handleInput(source, input)) event.preventDefault();
    });
  }

  /** Trata uma tecla. Devolve `true` quando ela virou ação (a página não a recebe). */
  handleInput(source: KeySource, input: KeyInput): boolean {
    if (this.capturing || !input) return false;
    const down = input.type === 'keyDown' || input.type === 'rawKeyDown';
    const up = input.type === 'keyUp';
    if (!down && !up) return false;
    const combo = comboFromInput(input, this.o.platform);
    if (!combo) return false;
    const id = comboId(combo);

    if (up) {
      // Soltar uma tecla segurada sempre para, mesmo que o mapa ou o foco tenham mudado.
      const plain = this.findHeld(combo);
      if (plain !== null) {
        this.held.delete(plain);
        this.scroll({ type: 'holdEnd' });
        return true;
      }
      return this.actionFor(combo) !== null && !this.editorBlocks(source, combo);
    }

    const editor = source.kind === 'control' && this.o.editorFocused();
    if (editor && combo.key === 'Escape' && !combo.ctrlOrCmd && !combo.alt) {
      this.emit({ kind: 'editorBlur' });
      this.o.handlers.editorBlur();
      return false;
    }
    const action = this.actionFor(combo);
    if (!action) return false;
    // Com o editor em foco, as teclas digitam; só Ctrl ou Cmd agem.
    if (this.editorBlocks(source, combo)) return false;

    const dir = HOLD_ACTIONS[action];
    if (dir) {
      if (!input.isAutoRepeat) {
        this.held.delete(id);
        this.emit({ kind: 'action', action, source });
        this.scroll({ type: 'lineStep', dir });
      } else if (!this.held.has(id)) {
        this.held.set(id, dir);
        this.scroll({ type: 'holdStart', dir });
      }
      return true;
    }
    // Alternâncias e passos: a repetição de tecla do sistema não conta.
    if (input.isAutoRepeat) return true;
    this.emit({ kind: 'action', action, source });
    this.run(action, source);
    return true;
  }

  /* ---------- Troca de atalhos (`cmd:keymap`) ---------- */

  command(cmd: KeymapCommand): Result<Keymap, KeymapFailure> {
    const map = this.keymap;
    switch (cmd.op) {
      case 'set': {
        if (!ACTION_IDS.includes(cmd.action) || !cmd.combo?.key) return err('reserved');
        const combo = normalizeCombo(cmd.combo);
        if (isReserved(combo) || isModifierKey(combo.key)) return err('reserved');
        const owner = this.actionFor(combo);
        if (owner && owner !== cmd.action) {
          if (!cmd.force) return err({ conflictWith: owner });
          map[owner] = map[owner].filter((x) => !sameCombo(x, combo));
        }
        map[cmd.action] = [combo];
        break;
      }
      case 'clear':
        if (!ACTION_IDS.includes(cmd.action)) return ok(map);
        map[cmd.action] = [];
        break;
      case 'reset':
        return ok(this.save(defaultKeymap()));
    }
    return ok(this.save(map));
  }

  /* ---------- Auxiliares ---------- */

  private save(map: Keymap): Keymap {
    void this.o.settings.update({ keymap: cloneKeymap(map) });
    this.log('keymap.change', {});
    const next = this.keymap;
    this.o.onChange?.(next);
    return next;
  }

  private editorBlocks(source: KeySource, combo: KeyCombo): boolean {
    return source.kind === 'control' && this.o.editorFocused() && !combo.ctrlOrCmd;
  }

  private findHeld(combo: KeyCombo): string | null {
    const id = comboId(combo);
    if (this.held.has(id)) return id;
    // Soltar a tecla com outro modificador (o Shift saiu antes): vale pela tecla.
    const key = normalizeKey(combo.key);
    for (const h of this.held.keys()) if (h.endsWith(`|${key}`)) return h;
    return null;
  }

  private releaseHeld(): void {
    if (this.held.size === 0) return;
    this.held.clear();
    this.scroll({ type: 'holdEnd' });
  }

  private scroll(cmd: ManualScrollCommand): void {
    this.emit({ kind: 'scroll', cmd });
    this.o.handlers.scroll(cmd);
  }

  private run(action: ActionId, source: KeySource): void {
    const h = this.o.handlers;
    switch (action) {
      case 'autoToggle':
        this.scroll({ type: h.automation() === 'auto' ? 'autoPause' : 'autoStart' });
        return;
      case 'faster':
        this.scroll({ type: 'setSpeed', speed: h.speed() + SPEED_STEP });
        return;
      case 'slower':
        this.scroll({ type: 'setSpeed', speed: h.speed() - SPEED_STEP });
        return;
      case 'toStart':
        this.scroll({ type: 'toStart' });
        return;
      case 'voiceToggle':
        h.voiceToggle();
        return;
      case 'closeOutput':
        // Fecha a saída em foco; vindo da tela de controle, não há saída em foco.
        if (source.kind === 'output') h.closeOutput(source.id);
        return;
      case 'down':
      case 'up':
        return;
    }
  }

  private emit(e: KeymapEvent): void {
    this.eventListeners.forEach((cb) => cb(e));
  }
}

export function cloneKeymap(map: Keymap): Keymap {
  const out = defaultKeymap();
  for (const action of ACTION_IDS) out[action] = (map[action] ?? []).map((x) => ({ ...x }));
  return out;
}
