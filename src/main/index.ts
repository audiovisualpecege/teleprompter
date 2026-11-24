/**
 * Processo principal: dono do estado e da rolagem (ADR-006). Liga o log, o tema
 * Noite, o relógio comum, o `AppStore` (roteiro, rolagem, ajustes, recuperação), a
 * abertura por arquivo e a janela de controle; as tarefas seguintes acrescentam as
 * saídas, os atalhos e a voz.
 */
import * as electron from 'electron';
import { app, ipcMain, Menu, nativeTheme, protocol } from 'electron';
import type { ClockPong } from '@shared/ipc';
import { processNow } from '@shared/motion';
import icon from '../../build/icons/256x256.png?asset';
import { bindStore, type MainTransport } from './ipc-main';
import { catchUnexpected, logEvent, setupLog } from './log';
import { createElectronPlatform } from './platform';
import { RecoveryStore, setupFileOpening } from './recovery';
import { realScheduler } from './scroll-engine';
import { ScriptFiles } from './script-files';
import { SettingsStore } from './settings';
import { AppStore } from './store';
import { installMainTestHooks, registerTestHook } from './test-hooks';
import { createControlWindow } from './windows';
import { handleModelScheme, modelsDir, registerModelScheme } from './models';
import type { WindowLike } from './platform';

setupLog(app.getPath('userData'));
catchUnexpected(process);
// Modelo do Vosk servido do disco à janela de controle (precisa ser registrado antes do `ready`).
registerModelScheme(protocol);

// Tema Noite, sempre: menus e diálogos do sistema ficam escuros, sem seguir a preferência do sistema.
nativeTheme.themeSource = 'dark';

let controlWindow: WindowLike | null = null;

// Instância única: o `.roteiro` do duplo clique (argv no Windows, `open-file` no Mac)
// vai para a instância aberta, e a segunda instância encerra.
const fileOpening = setupFileOpening(app, process.argv, () => {
  if (controlWindow && !controlWindow.isDestroyed()) controlWindow.focus();
});

/** Transporte do `AppStore` sobre `ipcMain`, falando com a janela de controle. */
function electronTransport(): MainTransport {
  return {
    handle(channel, fn) {
      ipcMain.handle(channel, (_e, req) => fn(req as never));
      return () => ipcMain.removeHandler(channel);
    },
    on(channel, fn) {
      const listener = (_e: unknown, payload: unknown): void => fn(payload as never);
      ipcMain.on(channel, listener);
      return () => ipcMain.removeListener(channel, listener);
    },
    toControl(channel, payload) {
      if (controlWindow && !controlWindow.isDestroyed()) controlWindow.webContents.send(channel, payload);
    },
    // As saídas chegam na tarefa das saídas (`OutputManager`).
    toOutputs: () => undefined,
    layoutToOutputs: () => undefined,
  };
}

if (fileOpening.primary) {
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
    handleModelScheme(
      protocol,
      modelsDir({ isPackaged: app.isPackaged, resourcesPath: process.resourcesPath, appPath: app.getAppPath() }),
    );
    const platform = createElectronPlatform(electron);
    logEvent('app.start', { version: app.getVersion(), platform: process.platform, arch: process.arch });
    const userData = app.getPath('userData');
    const store = new AppStore({
      files: new ScriptFiles({ dialog: platform.dialog, window: () => controlWindow }),
      settings: new SettingsStore({ userDataDir: userData, log: logEvent }),
      recovery: new RecoveryStore(userData),
      scheduler: realScheduler(processNow),
      now: processNow,
      log: logEvent,
    });
    bindStore(store, electronTransport());
    store.onQuit(() => app.quit());
    controlWindow = createControlWindow(platform, {
      mainDir: __dirname,
      devServerUrl: process.env.ELECTRON_RENDERER_URL,
      icon,
    });
    controlWindow.on('closed', () => {
      controlWindow = null;
      // Sem alterações, a cópia de recuperação some. Com alterações, ela fica até a
      // pergunta de fechar chegar com a tela de controle (tarefa da tela).
      store.requestClose();
      store.dispose();
      app.quit();
    });
    const started = store.init();
    // O primeiro estado e o arquivo do duplo clique só depois de a tela carregar.
    controlWindow.webContents.on('did-finish-load', () => {
      void started.then(() => {
        controlWindow?.webContents.send('state:snapshot', store.snapshot());
        controlWindow?.webContents.send('layout:request', store.currentLayoutRequest());
        fileOpening.ready((path) => void store.openFromSystem(path));
      });
    });
  });

  app.on('window-all-closed', () => app.quit());
}
