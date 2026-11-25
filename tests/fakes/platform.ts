/**
 * Falso de `Platform` (src/main/platform.ts) para os testes de unidade do principal.
 * Monitores, janelas, bloqueio de energia, diálogos, rede e shell são controlados
 * pelo teste; nada do Electron é carregado.
 */
import type {
  Platform,
  PlatformDisplay,
  Rect,
  ScreenEvent,
  WindowLike,
} from '../../src/main/platform';

export interface FakeWindow extends WindowLike {
  options: Record<string, unknown>;
  sent: { channel: string; args: unknown[] }[];
  loaded: string | null;
  fullScreen: boolean;
  /** Chamadas a `setFullScreen`/`setSimpleFullScreen(true)`. */
  fullScreenCalls: number;
  emit(event: string, ...args: unknown[]): void;
  /** Emite um evento na `webContents` (`did-finish-load`, `before-input-event`). */
  emitWeb(event: string, ...args: unknown[]): void;
  /** Uma tecla pelo `before-input-event`; devolve se a página foi impedida de recebê-la. */
  key(input: { type?: string; key: string; control?: boolean; meta?: boolean; shift?: boolean; alt?: boolean; isAutoRepeat?: boolean }): boolean;
}

export interface FakePlatform extends Platform {
  displays: PlatformDisplay[];
  created: FakeWindow[];
  blockers: Set<number>;
  dialogAnswers: { open: string[] | null; save: string | null };
  /** Opções de cada seletor chamado, em ordem. */
  dialogCalls: { kind: 'open' | 'save'; options: Record<string, unknown> }[];
  fetchImpl: (url: string) => Promise<Response>;
  opened: string[];
  addDisplay(d: PlatformDisplay): void;
  removeDisplay(id: number): void;
}

export function fakeDisplay(id: number, label: string, x = 0, width = 1920, height = 1080): PlatformDisplay {
  const bounds = { x, y: 0, width, height };
  return { id, label, bounds, workArea: { ...bounds }, scaleFactor: 1, size: { width, height } };
}

function fakeWindow(id: number, options: Record<string, unknown>): FakeWindow {
  const listeners = new Map<string, ((...a: unknown[]) => void)[]>();
  const webListeners = new Map<string, ((...a: unknown[]) => void)[]>();
  const on = (event: string, cb: (...a: unknown[]) => void): void => {
    listeners.set(event, [...(listeners.get(event) ?? []), cb]);
  };
  let destroyed = false;
  let minimized = false;
  let bounds: Rect = {
    x: Number(options.x ?? 0),
    y: Number(options.y ?? 0),
    width: Number(options.width ?? 800),
    height: Number(options.height ?? 600),
  };
  const win: FakeWindow = {
    id,
    options,
    sent: [],
    loaded: null,
    fullScreen: Boolean(options.fullscreen || options.simpleFullscreen),
    fullScreenCalls: 0,
    webContents: {
      id: 1000 + id,
      send: (channel, ...args) => {
        if (!destroyed) win.sent.push({ channel, args });
      },
      on: (event, cb) => void webListeners.set(event, [...(webListeners.get(event) ?? []), cb]),
    },
    loadURL: async (url) => void (win.loaded = url),
    loadFile: async (path) => void (win.loaded = path),
    show: () => undefined,
    close: () => {
      if (destroyed) return;
      let prevented = false;
      win.emit('close', { preventDefault: () => void (prevented = true) });
      if (prevented) return;
      destroyed = true;
      win.emit('closed');
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      // Como no Electron: `destroy` não emite `close`, só `closed`.
      win.emit('closed');
    },
    focus: () => undefined,
    isDestroyed: () => destroyed,
    getBounds: () => ({ ...bounds }),
    setBounds: (b) => void (bounds = { ...bounds, ...b }),
    setFullScreen: (flag) => {
      win.fullScreen = flag;
      if (flag) win.fullScreenCalls++;
    },
    setSimpleFullScreen: (flag) => {
      win.fullScreen = flag;
      if (flag) win.fullScreenCalls++;
    },
    isFullScreen: () => win.fullScreen,
    isMinimized: () => minimized,
    restore: () => void (minimized = false),
    setBackgroundColor: (c) => void (options.backgroundColor = c),
    on,
    once: on,
    emit: (event, ...args) => (listeners.get(event) ?? []).forEach((cb) => cb(...args)),
    emitWeb: (event, ...args) => (webListeners.get(event) ?? []).forEach((cb) => cb(...args)),
    key(input) {
      let prevented = false;
      const event = { preventDefault: () => void (prevented = true) };
      win.emitWeb('before-input-event', event, { type: 'keyDown', control: false, meta: false, shift: false, alt: false, isAutoRepeat: false, ...input });
      return prevented;
    },
  };
  return win;
}

export function createFakePlatform(displays: PlatformDisplay[] = [fakeDisplay(1, 'Monitor 1')]): FakePlatform {
  const screenListeners = new Map<ScreenEvent, ((d: PlatformDisplay) => void)[]>();
  const emit = (event: ScreenEvent, d: PlatformDisplay): void =>
    (screenListeners.get(event) ?? []).forEach((cb) => cb(d));
  let nextBlocker = 1;
  let nextWindow = 1;

  const fake: FakePlatform = {
    displays: [...displays],
    created: [],
    blockers: new Set(),
    dialogAnswers: { open: null, save: null },
    dialogCalls: [],
    fetchImpl: async () => new Response('{}', { status: 404 }),
    opened: [],
    screen: {
      getAllDisplays: () => [...fake.displays],
      getPrimaryDisplay: () => fake.displays[0],
      getDisplayMatching: (rect) =>
        fake.displays.find(
          (d) => rect.x >= d.bounds.x && rect.x < d.bounds.x + d.bounds.width,
        ) ?? fake.displays[0],
      on(event, cb) {
        screenListeners.set(event, [...(screenListeners.get(event) ?? []), cb]);
        return () => screenListeners.set(event, (screenListeners.get(event) ?? []).filter((c) => c !== cb));
      },
    },
    windows: {
      create(options) {
        const w = fakeWindow(nextWindow++, options as Record<string, unknown>);
        fake.created.push(w);
        return w;
      },
      all: () => fake.created.filter((w) => !w.isDestroyed()),
    },
    powerSaveBlocker: {
      start: () => {
        const id = nextBlocker++;
        fake.blockers.add(id);
        return id;
      },
      stop: (id) => void fake.blockers.delete(id),
      isStarted: (id) => fake.blockers.has(id),
    },
    dialog: {
      showOpenDialog: async (_w, options) => {
        fake.dialogCalls.push({ kind: 'open', options: options as Record<string, unknown> });
        return fake.dialogAnswers.open
          ? { canceled: false, filePaths: fake.dialogAnswers.open }
          : { canceled: true, filePaths: [] };
      },
      showSaveDialog: async (_w, options) => {
        fake.dialogCalls.push({ kind: 'save', options: options as Record<string, unknown> });
        return fake.dialogAnswers.save ? { canceled: false, filePath: fake.dialogAnswers.save } : { canceled: true };
      },
    },
    net: { fetch: (url) => fake.fetchImpl(url) },
    shell: {
      openPath: async (p) => {
        fake.opened.push(p);
        return '';
      },
      showItemInFolder: (p) => void fake.opened.push(p),
      openExternal: async (u) => void fake.opened.push(u),
    },
    addDisplay(d) {
      fake.displays.push(d);
      emit('display-added', d);
    },
    removeDisplay(id) {
      const d = fake.displays.find((x) => x.id === id);
      if (!d) return;
      fake.displays = fake.displays.filter((x) => x.id !== id);
      emit('display-removed', d);
    },
  };
  return fake;
}
