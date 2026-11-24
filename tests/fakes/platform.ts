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
  emit(event: string, ...args: unknown[]): void;
}

export interface FakePlatform extends Platform {
  displays: PlatformDisplay[];
  created: FakeWindow[];
  blockers: Set<number>;
  dialogAnswers: { open: string[] | null; save: string | null };
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
  const on = (event: string, cb: (...a: unknown[]) => void): void => {
    listeners.set(event, [...(listeners.get(event) ?? []), cb]);
  };
  let destroyed = false;
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
    webContents: {
      send: (channel, ...args) => void win.sent.push({ channel, args }),
      on: () => undefined,
    },
    loadURL: async (url) => void (win.loaded = url),
    loadFile: async (path) => void (win.loaded = path),
    show: () => undefined,
    close: () => {
      destroyed = true;
      win.emit('closed');
    },
    destroy: () => {
      destroyed = true;
    },
    focus: () => undefined,
    isDestroyed: () => destroyed,
    getBounds: () => ({ ...bounds }),
    setBounds: (b) => void (bounds = { ...bounds, ...b }),
    setFullScreen: () => undefined,
    setSimpleFullScreen: () => undefined,
    setBackgroundColor: (c) => void (options.backgroundColor = c),
    on,
    once: on,
    emit: (event, ...args) => (listeners.get(event) ?? []).forEach((cb) => cb(...args)),
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
      showOpenDialog: async () =>
        fake.dialogAnswers.open ? { canceled: false, filePaths: fake.dialogAnswers.open } : { canceled: true, filePaths: [] },
      showSaveDialog: async () =>
        fake.dialogAnswers.save ? { canceled: false, filePath: fake.dialogAnswers.save } : { canceled: true },
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
