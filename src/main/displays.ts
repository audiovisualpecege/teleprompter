/**
 * Lista de monitores (TechSpec, "Identidade de monitor"; US-015, US-018).
 *
 * - `displayKey`: `id|label|largura x altura` do Electron (sem espaços no tamanho).
 * - `matchDisplay`: um monitor que voltou casa por `id` e `label` iguais, ou por `label`
 *   e tamanho iguais quando o `id` mudou (troca de porta no Windows). Outro monitor na
 *   mesma porta tem outro `label` e não casa (US-018 EC-3).
 * - Só no build de teste, `TP_FAKE_DISPLAYS` troca o `screen` real por monitores virtuais,
 *   ligados e desligados por `__tpTest.addDisplay` e `__tpTest.removeDisplay`.
 */
import type { PlatformDisplay, Rect, ScreenAdapter, ScreenEvent } from './platform';

/** Identidade estável do monitor: `id|label|1920x1080`. */
export function displayKey(d: PlatformDisplay): string {
  return `${d.id}|${d.label}|${d.size.width}x${d.size.height}`;
}

export interface ParsedDisplayKey {
  id: number;
  label: string;
  width: number;
  height: number;
}

/** Lê uma `displayKey` guardada. O `label` pode conter `|`; o `id` é o primeiro campo e o tamanho, o último. */
export function parseDisplayKey(key: string): ParsedDisplayKey | null {
  const first = key.indexOf('|');
  const last = key.lastIndexOf('|');
  if (first < 0 || last <= first) return null;
  const id = Number(key.slice(0, first));
  const size = /^(\d+)x(\d+)$/.exec(key.slice(last + 1));
  if (!Number.isFinite(id) || !size) return null;
  return { id, label: key.slice(first + 1, last), width: Number(size[1]), height: Number(size[2]) };
}

/** Tamanho como aparece na tela: "1920 x 1080". */
export function displaySize(d: PlatformDisplay): string {
  return `${d.size.width} x ${d.size.height}`;
}

/** Nome do monitor na tela; sem `label` do sistema, "Monitor <id>". */
export function displayLabel(d: PlatformDisplay): string {
  return d.label.trim() || `Monitor ${d.id}`;
}

/** O monitor `d` é o mesmo guardado em `savedKey`? */
export function matchDisplay(savedKey: string, d: PlatformDisplay): boolean {
  const saved = parseDisplayKey(savedKey);
  if (!saved) return false;
  if (saved.label !== d.label) return false;
  if (saved.id === d.id) return true;
  return saved.width === d.size.width && saved.height === d.size.height;
}

/** O ponto central de um retângulo está dentro do monitor? */
export function containsCenter(d: PlatformDisplay, r: Rect): boolean {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const b = d.bounds;
  return cx >= b.x && cx < b.x + b.width && cy >= b.y && cy < b.y + b.height;
}

export type DisplayListener = (d: PlatformDisplay) => void;

/** Lista de monitores ligados e os eventos de ligar, desligar e mudar. */
export class DisplayRegistry {
  private readonly screen: ScreenAdapter;
  private readonly offs: (() => void)[] = [];
  private readonly listeners = new Map<ScreenEvent, Set<DisplayListener>>();

  constructor(screen: ScreenAdapter) {
    this.screen = screen;
    for (const event of ['display-added', 'display-removed', 'display-metrics-changed'] as const) {
      this.offs.push(screen.on(event, (d) => this.listeners.get(event)?.forEach((cb) => cb(d))));
    }
  }

  list(): PlatformDisplay[] {
    return this.screen.getAllDisplays();
  }

  /** O monitor com esta `displayKey` exata, se estiver ligado. */
  find(key: string): PlatformDisplay | undefined {
    return this.list().find((d) => displayKey(d) === key);
  }

  /** O monitor ligado que casa com a `displayKey` guardada: primeiro a chave exata, depois `matchDisplay`. */
  findMatch(savedKey: string, exclude: (d: PlatformDisplay) => boolean = () => false): PlatformDisplay | undefined {
    const candidates = this.list().filter((d) => !exclude(d));
    return candidates.find((d) => displayKey(d) === savedKey) ?? candidates.find((d) => matchDisplay(savedKey, d));
  }

  /** O monitor onde está o retângulo (a janela de controle). */
  matching(rect: Rect): PlatformDisplay | undefined {
    const all = this.list();
    if (all.length === 0) return undefined;
    return all.find((d) => containsCenter(d, rect)) ?? this.screen.getDisplayMatching(rect);
  }

  primary(): PlatformDisplay | undefined {
    return this.list().length > 0 ? this.screen.getPrimaryDisplay() : undefined;
  }

  on(event: ScreenEvent, cb: DisplayListener): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(cb);
    this.listeners.set(event, set);
    return () => set.delete(cb);
  }

  dispose(): void {
    this.offs.forEach((off) => off());
    this.listeners.clear();
  }
}

/* ---------- Monitores simulados (só no build de teste) ---------- */

export interface FakeDisplaySpec {
  label: string;
  width: number;
  height: number;
  id?: number;
}

export interface FakeScreen extends ScreenAdapter {
  addDisplay(spec: FakeDisplaySpec): PlatformDisplay;
  removeDisplay(label: string): boolean;
}

/**
 * Lê `TP_FAKE_DISPLAYS`: JSON com uma lista de `{ label, width, height, id? }`. O primeiro
 * é o da tela de controle. Também aceita o texto curto `A 1920x1080, B 1920x1080`.
 */
export function parseFakeDisplays(raw: string): FakeDisplaySpec[] {
  const text = raw.trim();
  if (text.startsWith('[') && text.includes('{')) {
    const list = JSON.parse(text) as unknown[];
    return list.flatMap((item) => {
      const o = item as Partial<FakeDisplaySpec>;
      if (typeof o?.label !== 'string' || !Number(o.width) || !Number(o.height)) return [];
      return [{ label: o.label, width: Number(o.width), height: Number(o.height), ...(o.id ? { id: Number(o.id) } : {}) }];
    });
  }
  return text
    .replace(/^\[|\]$/g, '')
    .split(',')
    .flatMap((part) => {
      const m = /^\s*(\S+).*?(\d+)x(\d+)\s*$/.exec(part);
      return m ? [{ label: m[1], width: Number(m[2]), height: Number(m[3]) }] : [];
    });
}

/**
 * `screen` virtual: os monitores ficam lado a lado a partir de x = 0, na ordem em que
 * entram. Um monitor religado com o mesmo `label` ganha o mesmo `id` e o mesmo lugar.
 */
export function createFakeScreen(specs: FakeDisplaySpec[]): FakeScreen {
  let displays: PlatformDisplay[] = [];
  const known = new Map<string, PlatformDisplay>();
  let nextId = 1;
  let nextX = 0;
  const listeners = new Map<ScreenEvent, Set<(d: PlatformDisplay) => void>>();
  const emit = (event: ScreenEvent, d: PlatformDisplay): void => listeners.get(event)?.forEach((cb) => cb(d));

  const make = (spec: FakeDisplaySpec): PlatformDisplay => {
    const prev = known.get(spec.label);
    if (prev && prev.size.width === spec.width && prev.size.height === spec.height && spec.id === undefined) {
      return prev;
    }
    const id = spec.id ?? prev?.id ?? nextId;
    nextId = Math.max(nextId, id + 1);
    const x = prev?.bounds.x ?? nextX;
    if (!prev) nextX += spec.width;
    const bounds = { x, y: 0, width: spec.width, height: spec.height };
    const d: PlatformDisplay = { id, label: spec.label, bounds, workArea: { ...bounds }, scaleFactor: 1, size: { width: spec.width, height: spec.height } };
    known.set(spec.label, d);
    return d;
  };
  displays = specs.map(make);

  const fake: FakeScreen = {
    getAllDisplays: () => [...displays],
    getPrimaryDisplay: () => displays[0],
    getDisplayMatching: (rect) => displays.find((d) => containsCenter(d, rect)) ?? displays[0],
    on(event, cb) {
      const set = listeners.get(event) ?? new Set();
      set.add(cb);
      listeners.set(event, set);
      return () => set.delete(cb);
    },
    addDisplay(spec) {
      const d = make(spec);
      if (!displays.some((x) => x.id === d.id)) displays = [...displays, d];
      emit('display-added', d);
      return d;
    },
    removeDisplay(label) {
      const d = displays.find((x) => x.label === label);
      if (!d) return false;
      displays = displays.filter((x) => x !== d);
      emit('display-removed', d);
      return true;
    },
  };
  return fake;
}
