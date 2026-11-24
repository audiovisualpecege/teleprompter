/**
 * Adaptadores finos do Electron (TechSpec, "Abordagem de testes"). O resto do
 * processo principal fala só com `Platform`, que os testes de unidade trocam por
 * falsos. Este arquivo só importa tipos do Electron; o módulo real entra por
 * `createElectronPlatform(electron)`.
 */
import type * as Electron from 'electron';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlatformDisplay {
  id: number;
  label: string;
  bounds: Rect;
  workArea: Rect;
  scaleFactor: number;
  size: { width: number; height: number };
}

export type ScreenEvent = 'display-added' | 'display-removed' | 'display-metrics-changed';

export interface ScreenAdapter {
  getAllDisplays(): PlatformDisplay[];
  getPrimaryDisplay(): PlatformDisplay;
  getDisplayMatching(rect: Rect): PlatformDisplay;
  on(event: ScreenEvent, cb: (display: PlatformDisplay) => void): () => void;
}

/** O que o resto do principal usa de uma `BrowserWindow`. */
export interface WindowLike {
  readonly id: number;
  readonly webContents: {
    send(channel: string, ...args: unknown[]): void;
    on(event: string, cb: (...args: unknown[]) => void): unknown;
  };
  loadURL(url: string): Promise<void>;
  loadFile(path: string, options?: { hash?: string; query?: Record<string, string> }): Promise<void>;
  show(): void;
  close(): void;
  destroy(): void;
  focus(): void;
  isDestroyed(): boolean;
  getBounds(): Rect;
  setBounds(bounds: Partial<Rect>): void;
  setFullScreen(flag: boolean): void;
  setSimpleFullScreen(flag: boolean): void;
  setBackgroundColor(color: string): void;
  on(event: string, cb: (...args: unknown[]) => void): unknown;
  once(event: string, cb: (...args: unknown[]) => void): unknown;
}

export interface WindowAdapter {
  create(options: Electron.BrowserWindowConstructorOptions): WindowLike;
  all(): WindowLike[];
}

export interface PowerSaveAdapter {
  start(type: 'prevent-app-suspension' | 'prevent-display-sleep'): number;
  stop(id: number): void;
  isStarted(id: number): boolean;
}

export interface DialogAdapter {
  showOpenDialog(
    window: WindowLike | null,
    options: Electron.OpenDialogOptions,
  ): Promise<{ canceled: boolean; filePaths: string[] }>;
  showSaveDialog(
    window: WindowLike | null,
    options: Electron.SaveDialogOptions,
  ): Promise<{ canceled: boolean; filePath?: string }>;
}

export interface NetAdapter {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

export interface ShellAdapter {
  openPath(path: string): Promise<string>;
  showItemInFolder(path: string): void;
  openExternal(url: string): Promise<void>;
}

export interface Platform {
  screen: ScreenAdapter;
  windows: WindowAdapter;
  powerSaveBlocker: PowerSaveAdapter;
  dialog: DialogAdapter;
  net: NetAdapter;
  shell: ShellAdapter;
}

type ElectronModule = typeof Electron;

function toDisplay(d: Electron.Display): PlatformDisplay {
  return {
    id: d.id,
    label: d.label,
    bounds: { ...d.bounds },
    workArea: { ...d.workArea },
    scaleFactor: d.scaleFactor,
    size: { ...d.size },
  };
}

/** Os adaptadores reais, ligados ao módulo `electron`. */
export function createElectronPlatform(electron: ElectronModule): Platform {
  const { screen, BrowserWindow, powerSaveBlocker, dialog, net, shell } = electron;
  const asWindow = (w: Electron.BrowserWindow): WindowLike => w as unknown as WindowLike;
  const asNative = (w: WindowLike | null): Electron.BrowserWindow | null =>
    w ? (BrowserWindow.fromId(w.id) ?? null) : null;

  return {
    screen: {
      getAllDisplays: () => screen.getAllDisplays().map(toDisplay),
      getPrimaryDisplay: () => toDisplay(screen.getPrimaryDisplay()),
      getDisplayMatching: (rect) => toDisplay(screen.getDisplayMatching(rect)),
      on(event, cb) {
        const handler = (...args: unknown[]): void => cb(toDisplay(args[1] as Electron.Display));
        screen.on(event as 'display-added', handler as never);
        return () => screen.removeListener(event as 'display-added', handler as never);
      },
    },
    windows: {
      create: (options) => asWindow(new BrowserWindow(options)),
      all: () => BrowserWindow.getAllWindows().map(asWindow),
    },
    powerSaveBlocker: {
      start: (type) => powerSaveBlocker.start(type),
      stop: (id) => powerSaveBlocker.stop(id),
      isStarted: (id) => powerSaveBlocker.isStarted(id),
    },
    dialog: {
      async showOpenDialog(window, options) {
        const w = asNative(window);
        return w ? dialog.showOpenDialog(w, options) : dialog.showOpenDialog(options);
      },
      async showSaveDialog(window, options) {
        const w = asNative(window);
        return w ? dialog.showSaveDialog(w, options) : dialog.showSaveDialog(options);
      },
    },
    net: {
      fetch: (url, init) => net.fetch(url, init),
    },
    shell: {
      openPath: (p) => shell.openPath(p),
      showItemInFolder: (p) => shell.showItemInFolder(p),
      openExternal: (url) => shell.openExternal(url),
    },
  };
}
