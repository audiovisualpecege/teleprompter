/**
 * Processo principal: dono do estado e da rolagem (ADR-006). Nesta casca ele liga o
 * log, o tema Noite, o relógio comum e a janela de controle; as tarefas seguintes
 * acrescentam o `AppStore`, o motor de rolagem, as saídas e a voz.
 */
import * as electron from 'electron';
import { app, ipcMain, Menu, nativeTheme } from 'electron';
import type { ClockPong } from '@shared/ipc';
import { processNow } from '@shared/motion';
import icon from '../../build/icons/256x256.png?asset';
import { catchUnexpected, logEvent, setupLog } from './log';
import { createElectronPlatform } from './platform';
import { installMainTestHooks, registerTestHook } from './test-hooks';
import { createControlWindow } from './windows';
import type { WindowLike } from './platform';

setupLog(app.getPath('userData'));
catchUnexpected(process);

// Tema Noite, sempre: menus e diálogos do sistema ficam escuros, sem seguir a preferência do sistema.
nativeTheme.themeSource = 'dark';

let controlWindow: WindowLike | null = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (controlWindow && !controlWindow.isDestroyed()) controlWindow.focus();
  });

  // Relógio comum: cada janela mede o desvio do seu relógio em relação a este.
  ipcMain.handle('clock:ping', (_event, t0: number): ClockPong => ({ t0, mainNow: processNow() }));

  if (__TP_TEST__) {
    installMainTestHooks(ipcMain);
    registerTestHook('ping', () => 'pong');
    registerTestHook('appVersion', () => app.getVersion());
  }

  app.on('render-process-gone', (_e, _wc, details) => logEvent('render.gone', { ...details }));
  app.on('child-process-gone', (_e, details) => logEvent('child.gone', { ...details }));

  // Nenhuma janela navega para fora do programa nem abre outra janela.
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-navigate', (event) => event.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });

  void app.whenReady().then(() => {
    // No Windows a barra de menu nativa seria clara: o programa não tem menu.
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
    const platform = createElectronPlatform(electron);
    logEvent('app.start', { version: app.getVersion(), platform: process.platform, arch: process.arch });
    controlWindow = createControlWindow(platform, {
      mainDir: __dirname,
      devServerUrl: process.env.ELECTRON_RENDERER_URL,
      icon,
    });
    controlWindow.on('closed', () => {
      controlWindow = null;
      app.quit();
    });
  });

  app.on('window-all-closed', () => app.quit());
}
