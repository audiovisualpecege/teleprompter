/**
 * UpdateChecker (TechSpec, "Pontos de integração: API do GitHub"): UT-213 a UT-222 e UT-256.
 * A rede e o shell são falsos; o download grava numa pasta temporária real.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DOWNLOAD_FAILED_MESSAGE,
  isNewer,
  RELEASES_URL,
  UpdateChecker,
  UPDATE_TIMEOUT_MS,
  type UpdateCheckerOptions,
} from '../../src/main/updates';

const BASE = 'https://github.com/audiovisualpecege/teleprompter/releases/download';

function release(tag: string, names: string[]): Response {
  const version = tag.replace(/^v/, '');
  return new Response(
    JSON.stringify({
      tag_name: tag,
      assets: names.map((n) => ({ name: n.replace('{v}', version), browser_download_url: `${BASE}/${tag}/${n.replace('{v}', version)}` })),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

const ALL_ASSETS = ['Teleprompter-{v}-win-x64.exe', 'Teleprompter-{v}-mac-x64.dmg', 'Teleprompter-{v}-mac-arm64.dmg'];

let dir: string;
let logs: { event: string; fields?: Record<string, unknown> }[];
let opened: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tp-updates-'));
  logs = [];
  opened = [];
});
afterEach(() => {
  vi.useRealTimers();
  rmSync(dir, { recursive: true, force: true });
});

function checker(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>, patch: Partial<UpdateCheckerOptions> = {}) {
  const fetch = vi.fn(fetchImpl);
  const c = new UpdateChecker({
    net: { fetch },
    shell: {
      openPath: async (p) => {
        opened.push(p);
        return '';
      },
      showItemInFolder: () => undefined,
      openExternal: async () => undefined,
    },
    currentVersion: '1.0.0',
    platform: 'win32',
    arch: 'x64',
    downloadsDir: dir,
    log: (event, fields) => logs.push({ event, fields }),
    ...patch,
  });
  return { c, fetch };
}

const checkLog = () => logs.filter((l) => l.event === 'update.check').map((l) => l.fields?.result);

describe('UpdateChecker: consulta e comparação', () => {
  it('UT-213: v1.1.0 com o instalador do Windows, na 1.0.0, devolve a versão e o asset', async () => {
    const { c, fetch } = checker(async () => release('v1.1.0', ALL_ASSETS));
    await expect(c.check()).resolves.toEqual({
      version: '1.1.0',
      url: `${BASE}/v1.1.0/Teleprompter-1.1.0-win-x64.exe`,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(RELEASES_URL);
    expect(RELEASES_URL).toBe('https://api.github.com/repos/audiovisualpecege/teleprompter/releases/latest');
    // Sem autenticação.
    const headers = new Headers(fetch.mock.calls[0][1]?.headers);
    expect(headers.has('authorization')).toBe(false);
    expect(c.view).toEqual({ version: '1.1.0', url: `${BASE}/v1.1.0/Teleprompter-1.1.0-win-x64.exe`, progress: null, error: null });
    expect(checkLog()).toEqual(['available']);
  });

  it('UT-214: a Release v1.0.0 na versão 1.0.0 devolve null', async () => {
    const { c } = checker(async () => release('v1.0.0', ALL_ASSETS));
    await expect(c.check()).resolves.toBeNull();
    expect(c.view).toBeNull();
    expect(checkLog()).toEqual(['up-to-date']);
  });

  it('UT-215: a Release v0.9.0 devolve null', async () => {
    const { c } = checker(async () => release('v0.9.0', ALL_ASSETS));
    await expect(c.check()).resolves.toBeNull();
  });

  it('compara como semver, não como texto', () => {
    expect(isNewer('v1.10.0', '1.9.0')).toBe(true);
    expect(isNewer('v2.0.0', '1.99.99')).toBe(true);
    expect(isNewer('v1.0.1', '1.0.0')).toBe(true);
    expect(isNewer('v1.0.0-beta.1', '1.0.0')).toBe(false);
    expect(isNewer('v1.0.0', '1.0.0-beta.1')).toBe(true);
    expect(isNewer('versao', '1.0.0')).toBe(false);
  });

  it('consulta uma vez só por instância (uma por abertura)', async () => {
    const { c, fetch } = checker(async () => release('v1.1.0', ALL_ASSETS));
    await Promise.all([c.check(), c.check()]);
    await c.check();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('UpdateChecker: falhas silenciosas', () => {
  it('UT-216: sem rede devolve null, grava result=network, não lança e é a única chamada de rede', async () => {
    const { c, fetch } = checker(async () => {
      throw new TypeError('net::ERR_INTERNET_DISCONNECTED');
    });
    await expect(c.check()).resolves.toBeNull();
    expect(c.view).toBeNull();
    expect(logs).toContainEqual({ event: 'update.check', fields: { result: 'network' } });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls.map((call) => call[0])).toEqual([RELEASES_URL]);
  });

  it('UT-217: a resposta 403 (limite da API) devolve null', async () => {
    const { c } = checker(async () => new Response('{"message":"API rate limit exceeded"}', { status: 403 }));
    await expect(c.check()).resolves.toBeNull();
    expect(checkLog()).toEqual(['http']);
  });

  it('404 e JSON inesperado também devolvem null', async () => {
    await expect(checker(async () => new Response('', { status: 404 })).c.check()).resolves.toBeNull();
    await expect(checker(async () => new Response('isto não é json', { status: 200 })).c.check()).resolves.toBeNull();
    await expect(checker(async () => new Response('{"tag_name": 3}', { status: 200 })).c.check()).resolves.toBeNull();
    expect(checkLog()).toEqual(['http', 'invalid', 'invalid']);
  });

  it('UT-218: sem resposta em 5 s devolve null', async () => {
    vi.useFakeTimers();
    const { c, fetch } = checker(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const result = c.check();
    await vi.advanceTimersByTimeAsync(UPDATE_TIMEOUT_MS - 1);
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBeNull();
    expect(UPDATE_TIMEOUT_MS).toBe(5000);
    expect(checkLog()).toEqual(['timeout']);
  });

  it('UT-219: uma Release sem o instalador da plataforma devolve null e grava no-asset', async () => {
    const { c } = checker(async () => release('v1.1.0', ['Teleprompter-{v}-mac-arm64.dmg']));
    await expect(c.check()).resolves.toBeNull();
    expect(checkLog()).toEqual(['no-asset']);
  });

  it('UT-220: no darwin arm64, escolhe o DMG de Apple Silicon', async () => {
    const { c } = checker(async () => release('v1.1.0', ALL_ASSETS), { platform: 'darwin', arch: 'arm64' });
    await expect(c.check()).resolves.toEqual({ version: '1.1.0', url: `${BASE}/v1.1.0/Teleprompter-1.1.0-mac-arm64.dmg` });
    const intel = checker(async () => release('v1.1.0', ALL_ASSETS), { platform: 'darwin', arch: 'x64' });
    await expect(intel.c.check()).resolves.toEqual({ version: '1.1.0', url: `${BASE}/v1.1.0/Teleprompter-1.1.0-mac-x64.dmg` });
  });
});

/** Uma resposta de download que entrega `chunks` e, se `cutAfter`, corta a conexão depois desse pedaço. */
function downloadResponse(chunks: Uint8Array[], cutAfter?: number): Response {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (cutAfter !== undefined && i === cutAfter) {
        controller.error(new TypeError('net::ERR_CONNECTION_RESET'));
        return;
      }
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[i++]);
    },
  });
  return new Response(body, { status: 200, headers: { 'content-length': String(total) } });
}

const bytes = (n: number, fill: number) => new Uint8Array(n).fill(fill);

describe('UpdateChecker: baixar e fechar', () => {
  it('UT-221: download grava o arquivo na pasta Downloads, com progresso, e abre o instalador', async () => {
    const progress: (number | null)[] = [];
    let c!: UpdateChecker;
    ({ c } = checker(
      async (url) => (url === RELEASES_URL ? release('v1.1.0', ALL_ASSETS) : downloadResponse([bytes(50, 1), bytes(50, 2)])),
      { onChange: () => progress.push(c.view?.progress ?? null) },
    ));
    await c.check();
    await expect(c.download()).resolves.toEqual({ ok: true, value: undefined });
    const file = join(dir, 'Teleprompter-1.1.0-win-x64.exe');
    expect(readFileSync(file).byteLength).toBe(100);
    expect(readdirSync(dir)).toEqual(['Teleprompter-1.1.0-win-x64.exe']);
    expect(opened).toEqual([file]);
    expect(progress).toContain(50);
    expect(progress.at(-1)).toBe(100);
  });

  it('UT-256: a conexão cortada no meio devolve network, não deixa arquivo parcial, avisa e não abre nada', async () => {
    const { c } = checker(async (url) =>
      url === RELEASES_URL ? release('v1.1.0', ALL_ASSETS) : downloadResponse([bytes(40, 1), bytes(40, 2), bytes(40, 3)], 1),
    );
    await c.check();
    await expect(c.download()).resolves.toEqual({ ok: false, error: 'network' });
    expect(readdirSync(dir)).toEqual([]);
    expect(opened).toEqual([]);
    expect(c.view?.error).toBe(DOWNLOAD_FAILED_MESSAGE);
    expect(DOWNLOAD_FAILED_MESSAGE).toBe('Não foi possível baixar a versão nova');
    expect(c.view?.progress).toBeNull();
  });

  it('UT-256: o corpo que termina antes do tamanho anunciado também conta como corte', async () => {
    const { c } = checker(async (url) => {
      if (url === RELEASES_URL) return release('v1.1.0', ALL_ASSETS);
      const r = downloadResponse([bytes(10, 1)]);
      return new Response(r.body, { status: 200, headers: { 'content-length': '500' } });
    });
    await c.check();
    await expect(c.download()).resolves.toEqual({ ok: false, error: 'network' });
    expect(readdirSync(dir)).toEqual([]);
    expect(opened).toEqual([]);
  });

  it('UT-222: fechar esconde o aviso até o fim da sessão; uma nova instância volta a mostrar', async () => {
    const fetchImpl = async () => release('v1.1.0', ALL_ASSETS);
    const first = checker(fetchImpl).c;
    await first.check();
    expect(first.view).not.toBeNull();
    first.dismiss();
    expect(first.view).toBeNull();
    await first.check();
    expect(first.view).toBeNull();

    const next = checker(fetchImpl).c;
    await next.check();
    expect(next.view?.version).toBe('1.1.0');
  });
});
