/**
 * IT-021: `UpdateChecker` contra um servidor HTTP local que imita `releases/latest` com
 * `v9.9.9`. O `StateSnapshot.update` é preenchido pelo `AppStore` real, e o download grava o
 * asset na pasta Downloads de teste. Também confere o voltar ao padrão nas saídas abertas.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bindStore, bindUpdate } from '../../src/main/ipc-main';
import { UpdateChecker } from '../../src/main/updates';
import { createIpcBus } from '../fakes/ipc-bus';
import { createTestStore } from '../fakes/store';
import { B, createTestStudio, keyOf, lastView } from '../fakes/studio';

const INSTALLER = Buffer.alloc(256 * 1024, 7);

let server: Server;
let base: string;
let downloads: string;
let requests: string[];

beforeEach(async () => {
  downloads = mkdtempSync(join(tmpdir(), 'tp-downloads-'));
  requests = [];
  server = createServer((req, res) => {
    requests.push(req.url ?? '');
    if (req.url === '/repos/audiovisualpecege/teleprompter/releases/latest') {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          tag_name: 'v9.9.9',
          assets: ['win-x64.exe', 'mac-x64.dmg', 'mac-arm64.dmg'].map((s) => ({
            name: `Teleprompter-9.9.9-${s}`,
            browser_download_url: `${base}/download/Teleprompter-9.9.9-${s}`,
          })),
        }),
      );
      return;
    }
    if (req.url?.startsWith('/download/')) {
      res.setHeader('content-length', String(INSTALLER.byteLength));
      // Em dois pedaços, para haver progresso.
      res.write(INSTALLER.subarray(0, INSTALLER.byteLength / 2));
      setTimeout(() => res.end(INSTALLER.subarray(INSTALLER.byteLength / 2)), 20);
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(downloads, { recursive: true, force: true });
});

describe('IT-021: aviso e download contra um servidor local', () => {
  it('preenche StateSnapshot.update e baixa o instalador para a pasta Downloads de teste', async () => {
    const t = await createTestStore();
    const bus = createIpcBus(1);
    bindStore(t.store, bus);
    const opened: string[] = [];
    const updates = new UpdateChecker({
      net: { fetch: (url, init) => fetch(url, init) },
      shell: {
        openPath: async (p) => {
          opened.push(p);
          return '';
        },
        showItemInFolder: () => undefined,
        openExternal: async () => undefined,
      },
      currentVersion: '1.0.0',
      platform: process.platform === 'darwin' ? 'darwin' : 'win32',
      arch: process.platform === 'darwin' ? process.arch : 'x64',
      downloadsDir: downloads,
      log: (event, fields) => t.logs.push({ event, fields }),
      url: `${base}/repos/audiovisualpecege/teleprompter/releases/latest`,
      onChange: () => t.store.refresh(),
    });
    bindUpdate(t.store, updates, () => '/logs', bus);
    expect(t.last().update).toBeNull();

    await updates.check();
    const name = process.platform === 'darwin' ? `Teleprompter-9.9.9-mac-${process.arch}.dmg` : 'Teleprompter-9.9.9-win-x64.exe';
    expect(t.last().update).toEqual({ version: '9.9.9', url: `${base}/download/${name}`, progress: null, error: null });
    expect(bus.control.snapshot?.update?.version).toBe('9.9.9');
    // As saídas nunca recebem o aviso.
    expect(bus.outputs[0].messages.some((m) => m.channel === 'state:snapshot')).toBe(false);

    const progress: (number | null)[] = [];
    t.store.onSnapshot((s) => progress.push(s.update?.progress ?? null));
    await expect(bus.invoke('cmd:update', { op: 'download' })).resolves.toEqual({ ok: true, value: undefined });
    expect(readdirSync(downloads)).toEqual([name]);
    expect(readFileSync(join(downloads, name)).equals(INSTALLER)).toBe(true);
    expect(opened).toEqual([join(downloads, name)]);
    expect(progress.some((p) => p !== null && p > 0 && p < 100)).toBe(true);
    expect(t.last().update?.progress).toBe(100);
    expect(requests).toEqual(['/repos/audiovisualpecege/teleprompter/releases/latest', `/download/${name}`]);
    expect(t.logs).toContainEqual({ event: 'update.check', fields: { result: 'available', version: '9.9.9' } });

    // "Fechar" pelo canal: o aviso sai do estado até o fim da sessão.
    await bus.invoke('cmd:update', { op: 'dismiss' });
    expect(t.last().update).toBeNull();
    await expect(bus.invoke('cmd:openLogs', null)).resolves.toBe('/logs');
  });
});

describe('voltar ao padrão com saídas abertas', () => {
  it('as saídas abertas ficam sem inversão na hora, e a velocidade volta a 1,00x', async () => {
    const t = await createTestStore();
    const studio = createTestStudio();
    t.store.onSettingsReset(() => studio.manager.resetInversions());
    const opened = studio.manager.open(keyOf(B()));
    if (!opened.ok) throw new Error('não abriu');
    studio.loadAll();
    studio.manager.set(opened.value.id, { mirrorH: true, flipV: true });
    expect(studio.manager.outputs()[0]).toMatchObject({ mirrorH: true, flipV: true });
    await t.store.settingsCommand({ op: 'resetAll' });
    // O AppStore do teste usa outros ajustes que o estúdio; o estúdio aplica o padrão às saídas.
    expect(studio.manager.outputs()[0]).toMatchObject({ mirrorH: false, flipV: false });
    expect(lastView(studio.windowsOf(opened.value.id)[0])).toMatchObject({ mirrorH: false, flipV: false });
    expect(studio.settings.settings.outputs).toEqual([expect.objectContaining({ mirrorH: false, flipV: false })]);
    expect(t.last().speed).toBe(1);
    expect(t.logs.some((l) => l.event === 'settings.reset')).toBe(true);
    studio.manager.dispose();
  });
});
