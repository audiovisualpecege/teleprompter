/**
 * Criação das janelas, sempre com `contextIsolation` ligado, `nodeIntegration`
 * desligado e a ponte do preload como única passagem para o principal.
 */
import { join } from 'node:path';
import type { Platform, Rect, WindowLike } from './platform';

/** Fundo da janela de controle: Noite (`--surface-page` do tema Noite), para nunca piscar claro. */
export const CONTROL_BACKGROUND = '#070010';

export interface WindowPaths {
  /** Pasta do build (`out/main`), onde ficam `../preload` e `../renderer`. */
  mainDir: string;
  /** URL do servidor de desenvolvimento, quando houver. */
  devServerUrl?: string;
  icon: string;
}

function loadPage(win: WindowLike, paths: WindowPaths, page: 'control' | 'output'): Promise<void> {
  if (paths.devServerUrl) return win.loadURL(`${paths.devServerUrl}/${page}/index.html`);
  return win.loadFile(join(paths.mainDir, '..', 'renderer', page, 'index.html'));
}

export function createControlWindow(platform: Platform, paths: WindowPaths): WindowLike {
  const win = platform.windows.create({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Teleprompter',
    icon: paths.icon,
    backgroundColor: CONTROL_BACKGROUND,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(paths.mainDir, '..', 'preload', 'control.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // A janela abriga a captura de áudio e a diagramação: não pode atrasar minimizada.
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  void loadPage(win, paths, 'control');
  return win;
}

export interface OutputWindowOptions {
  bounds: Rect;
  /** Cor de fundo da aparência, para a saída nascer sem piscar. */
  backgroundColor: string;
  isMac: boolean;
  /**
   * Tela cheia do sistema (padrão: sim). Só os monitores virtuais do build de teste a
   * desligam, porque a janela fica num retângulo da tela real.
   */
  fullscreen?: boolean;
}

export function createOutputWindow(
  platform: Platform,
  paths: WindowPaths,
  opts: OutputWindowOptions,
): WindowLike {
  const win = platform.windows.create({
    ...opts.bounds,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    title: 'Teleprompter: saída',
    icon: paths.icon,
    backgroundColor: opts.backgroundColor,
    fullscreen: (opts.fullscreen ?? true) && !opts.isMac,
    simpleFullscreen: (opts.fullscreen ?? true) && opts.isMac,
    webPreferences: {
      preload: join(paths.mainDir, '..', 'preload', 'output.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  keepAboveTaskbar(win, opts);
  win.once('ready-to-show', () => {
    win.show();
    // Se a tela cheia pedida na criação não pegou, pede de novo ao mostrar.
    if ((opts.fullscreen ?? true) && !opts.isMac && !win.isFullScreen()) win.setFullScreen(true);
  });
  void loadPage(win, paths, 'output');
  return win;
}

/**
 * No Windows, a tela cheia só esconde a barra de tarefas enquanto a janela está em foco, e o
 * foco fica na tela de controle: a barra voltava por cima do texto no monitor do TP. Sempre
 * por cima, a saída fica acima da barra. No Mac a tela cheia simples já esconde a barra.
 */
export function keepAboveTaskbar(win: WindowLike, opts: Pick<OutputWindowOptions, 'isMac' | 'fullscreen'>): void {
  if ((opts.fullscreen ?? true) && !opts.isMac) win.setAlwaysOnTop(true, 'screen-saver');
}
