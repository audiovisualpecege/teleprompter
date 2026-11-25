/**
 * Processo principal: dono do estado e da rolagem (ADR-006). Liga o log, o tema
 * Noite, o relógio comum, o `AppStore` (roteiro, rolagem, ajustes, recuperação), a
 * abertura por arquivo, a janela de controle, as saídas de TP (com monitores, energia e
 * queda e volta) e os atalhos de todas as janelas. A voz completa chega na tarefa da voz.
 */
import * as electron from 'electron';
import { app, ipcMain, Menu, nativeTheme, protocol } from 'electron';
import type { ClockPong } from '@shared/ipc';
import { processNow } from '@shared/motion';
import icon from '../../build/icons/256x256.png?asset';
import { bindStore, bindStudio, type MainTransport } from './ipc-main';
import { createFakeScreen, DisplayRegistry, parseFakeDisplays, type FakeDisplaySpec } from './displays';
import { KeymapService } from './keymap';
import { OutputManager, type OutputPlacement } from './outputs';
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
import type { PlatformDisplay, ScreenAdapter, WindowLike } from './platform';
import { installPermissions } from './permissions';

// Só no build de teste: cada teste de ponta a ponta usa a sua própria pasta de usuário.
if (__TP_TEST__ && process.env.TP_USER_DATA) app.setPath('userData', process.env.TP_USER_DATA);
// Só no build de teste: janelas cobertas ou fora da frente continuam desenhando, para as
// sondas de posição das saídas virtuais andarem como numa tela de verdade.
if (__TP_TEST__) {
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
}

setupLog(app.getPath('userData'));
catchUnexpected(process);
// Modelo do Vosk servido do disco à janela de controle (precisa ser registrado antes do `ready`).
registerModelScheme(protocol);

// Tema Noite, sempre: menus e diálogos do sistema ficam escuros, sem seguir a preferência do sistema.
nativeTheme.themeSource = 'dark';

let controlWindow: WindowLike | null = null;
let outputs: OutputManager | null = null;

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
    toOutputs(channel, payload) {
      if (channel === 'motion:segment') outputs?.setSegment(payload as never);
    },
    layoutToOutputs: (layout) => outputs?.setLayout(layout),
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
    installPermissions(electron.session.defaultSession);
    handleModelScheme(
      protocol,
      modelsDir({ isPackaged: app.isPackaged, resourcesPath: process.resourcesPath, appPath: app.getAppPath() }),
    );
    const platform = createElectronPlatform(electron);
    logEvent('app.start', { version: app.getVersion(), platform: process.platform, arch: process.arch });
    const userData = app.getPath('userData');
    const settings = new SettingsStore({ userDataDir: userData, log: logEvent });
    const store = new AppStore({
      files: new ScriptFiles({ dialog: platform.dialog, window: () => controlWindow }),
      settings,
      recovery: new RecoveryStore(userData),
      scheduler: realScheduler(processNow),
      now: processNow,
      log: logEvent,
    });
    const paths = { mainDir: __dirname, devServerUrl: process.env.ELECTRON_RENDERER_URL, icon };
    const transport = electronTransport();
    bindStore(store, transport);
    controlWindow = createControlWindow(platform, paths);

    // Monitores: os reais ou, só no build de teste, os virtuais de `TP_FAKE_DISPLAYS`.
    let screenAdapter: ScreenAdapter = platform.screen;
    let placement: ((d: PlatformDisplay) => OutputPlacement) | undefined;
    if (__TP_TEST__ && process.env.TP_FAKE_DISPLAYS) {
      const fake = createFakeScreen(parseFakeDisplays(process.env.TP_FAKE_DISPLAYS));
      screenAdapter = fake;
      placement = virtualPlacement(platform.screen);
      registerTestHook('addDisplay', (spec) =>
        fake.addDisplay(typeof spec === 'string' ? { label: spec, width: 1920, height: 1080 } : (spec as FakeDisplaySpec)),
      );
      registerTestHook('removeDisplay', (label) => fake.removeDisplay(String(label)));
    }
    const displays = new DisplayRegistry(screenAdapter);
    const studio = new OutputManager({
      platform,
      displays,
      settings,
      scheduler: realScheduler(processNow),
      now: processNow,
      paths,
      isMac: process.platform === 'darwin',
      controlWindow: () => controlWindow,
      appearance: () => store.layout?.appearance ?? settings.settings.lastAppearance,
      notices: { add: (id, kind, message) => store.addNotice(id, kind, message), remove: (id) => store.removeNotice(id) },
      log: logEvent,
      onChange: () => store.refresh(),
      onWindow: (win, id) => keymap.attach(win, { kind: 'output', id }),
      placement,
    });
    outputs = studio;
    const keymap = new KeymapService({
      settings,
      platform: process.platform,
      editorFocused: () => store.isEditorFocused,
      log: logEvent,
      onChange: () => store.refresh(),
      handlers: {
        scroll: (cmd) => void store.scroll(cmd),
        automation: () => store.engine.automation,
        speed: () => store.engine.speed,
        // O `VoiceController` (tarefa da voz) assume este atalho.
        voiceToggle: () => logEvent('voice.toggle', { source: 'keymap' }),
        closeOutput: (id) => void studio.close(id),
        editorBlur: () => controlWindow?.webContents.send('ui:blurEditor', null),
      },
    });
    keymap.attach(controlWindow, { kind: 'control' });
    bindStudio(store, studio, keymap, transport);
    ipcMain.on('render:longFrame', (e, payload: { count?: number; maxMs?: number }) => {
      logEvent('render.longFrame', { id: studio.outputIdOf(e.sender.id), count: payload?.count, maxMs: payload?.maxMs });
    });
    if (__TP_TEST__) {
      registerTestHook('powerBlocker', () => studio.power.active);
      registerTestHook('outputs', () => studio.outputs());
      // O Playwright entrega as teclas direto à página, sem o `before-input-event`. Este gancho
      // emite o evento na `webContents` real da janela (controle ou saída `n`), como o
      // Electron faz com uma tecla do sistema, e diz se a página deixou de recebê-la.
      registerTestHook('emitKey', (target, input) => {
        const win = target === 'control' ? controlWindow : studio.windowOf(Number(target));
        if (!win) return false;
        let prevented = false;
        const event = { preventDefault: () => void (prevented = true) };
        (win.webContents as unknown as { emit(e: string, ...a: unknown[]): void }).emit('before-input-event', event, {
          type: 'keyDown',
          control: false,
          meta: false,
          shift: false,
          alt: false,
          isAutoRepeat: false,
          ...(input as object),
        });
        return prevented;
      });
    }

    // Fechar a tela de controle fecha o programa e todas as saídas, com a pergunta de
    // alterações não salvas antes (US-019 EC-2). O mesmo vale para Cmd+Q no Mac.
    let quitting = false;
    let exiting = false;
    const shutdown = (): void => {
      if (quitting) return;
      quitting = true;
      studio.dispose();
    };
    // Antes de sair, as gravações em curso (ajustes, recuperação) terminam.
    const quitAfterFlush = (): void => {
      if (exiting) return;
      exiting = true;
      void store
        .flush()
        .catch(() => undefined)
        .finally(() => app.quit());
    };
    store.onQuit(() => {
      shutdown();
      quitAfterFlush();
    });
    app.on('before-quit', (event) => {
      if (exiting) return;
      if (!quitting && !store.requestClose()) {
        event.preventDefault();
        controlWindow?.focus();
        return;
      }
      event.preventDefault();
      shutdown();
      quitAfterFlush();
    });
    controlWindow.on('close', (...args: unknown[]) => {
      if (quitting) return;
      if (!store.requestClose()) {
        (args[0] as { preventDefault(): void }).preventDefault();
        return;
      }
      shutdown();
    });
    controlWindow.on('closed', () => {
      controlWindow = null;
      shutdown();
      store.dispose();
      quitAfterFlush();
    });
    const started = store.init();
    // As saídas guardadas reabrem (sem número) depois de os ajustes serem lidos.
    void started.then(() => studio.restore());
    // O primeiro estado e o arquivo do duplo clique só depois de a tela carregar.
    controlWindow.webContents.on('did-finish-load', () => {
      void started.then(() => {
        controlWindow?.webContents.send('state:snapshot', store.snapshot());
        controlWindow?.webContents.send('layout:request', store.currentLayoutRequest());
        fileOpening.ready((path) => void store.openFromSystem(path));
      });
    });
  });

  // Sair é sempre pela janela de controle (com a pergunta de alterações não salvas).
  app.on('window-all-closed', () => undefined);
}

/**
 * Só no build de teste: cada monitor virtual vira um retângulo pequeno na tela real, sem
 * tela cheia do sistema, para as janelas de saída ficarem visíveis e desenharem.
 */
function virtualPlacement(real: ScreenAdapter): (d: PlatformDisplay) => OutputPlacement {
  const TILE = 480;
  return (d) => {
    const area = real.getPrimaryDisplay().workArea;
    const height = Math.round((TILE * d.size.height) / d.size.width);
    const index = Math.max(0, d.id - 1);
    return {
      bounds: { x: area.x + 16 + ((index * (TILE + 16)) % Math.max(TILE, area.width - TILE)), y: area.y + area.height - height - 16, width: TILE, height },
      fullscreen: false,
    };
  };
}
