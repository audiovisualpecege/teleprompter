/**
 * Processo principal do banco de medição da voz. Usa as mesmas peças do programa
 * (protocolo `tp-model:` para o Vosk, `launchParakeet` com `utilityProcess` para o
 * Parakeet), abre uma janela escondida com a página de medição e imprime o resultado
 * numa linha `RESULT:` para o teste. Conta toda requisição de rede: tem de ser zero.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';
import { Readable } from 'node:stream';
import { app, BrowserWindow, ipcMain, MessageChannelMain, protocol, session, utilityProcess } from 'electron';
import { handleModelScheme, registerModelScheme } from '../../../src/main/models';
import { launchParakeet, type ParakeetProcess } from '../../../src/main/parakeet-process';

interface MainConfig {
  page: {
    engine: 'vosk' | 'parakeet';
    mode: 'near' | 'forwardJumps';
    fixture: string;
    roteiro: string;
    tailMs: number;
    source?: 'wav' | 'mic';
  };
  modelsDir: string;
  fixturesDir: string;
  outDir: string;
  timeoutMs: number;
}

const cfg = JSON.parse(process.env.TP_HARNESS ?? '{}') as MainConfig;
const network: string[] = [];

registerModelScheme(protocol, [
  { scheme: 'tp-fixture', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

// Microfone falso do Chromium tocando a fixture (como o E2E fará).
if (cfg.page.source === 'mic') {
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch('use-file-for-fake-audio-capture', join(cfg.fixturesDir, cfg.page.fixture));
}

// Pasta de dados própria, apagada a cada execução: o Vosk começa sem cache.
app.setPath('userData', join(cfg.outDir, `user-data-${process.pid}`));

function finish(json: string): void {
  const res = JSON.parse(json) as Record<string, unknown>;
  res.network = network;
  process.stdout.write(`RESULT:${JSON.stringify(res)}\n`);
  parakeet?.stop();
  app.exit(0);
}

let parakeet: ParakeetProcess | null = null;

void app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (d, cb) => {
    network.push(d.url);
    cb({ cancel: true });
  });
  handleModelScheme(protocol, cfg.modelsDir);
  protocol.handle('tp-fixture', (req) => {
    const name = decodeURIComponent(new URL(req.url).pathname.replace(/^\/+/, ''));
    const file = normalize(join(cfg.fixturesDir, name));
    if (!file.startsWith(normalize(cfg.fixturesDir) + sep) || !existsSync(file)) return new Response('', { status: 404 });
    return new Response(Readable.toWeb(createReadStream(file)) as unknown as ReadableStream, {
      headers: { 'Content-Length': String(statSync(file).size), 'Access-Control-Allow-Origin': '*' },
    });
  });

  ipcMain.handle('harness:config', () => cfg.page);
  ipcMain.on('harness:result', (_e, json: string) => finish(json));

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(cfg.outDir, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  ipcMain.on('harness:want-port', () => {
    parakeet = launchParakeet({
      fork: (modulePath) => utilityProcess.fork(modulePath, [], { serviceName: 'Parakeet', stdio: 'inherit' }),
      createChannel: () => new MessageChannelMain(),
      modulePath: join(cfg.outDir, 'parakeet-host.js'),
      modelsDir: cfg.modelsDir,
      onFault: (_f, detail) => win.webContents.send('harness:exit', detail),
    });
    win.webContents.postMessage('harness:port', null, [parakeet.rendererPort as Electron.MessagePortMain]);
  });
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') process.stderr.write(`[página] ${e.message}\n`);
  });
  setTimeout(() => finish(JSON.stringify({ ok: false, error: 'tempo esgotado' })), cfg.timeoutMs);
  await win.loadFile(join(cfg.outDir, 'index.html'));
});

