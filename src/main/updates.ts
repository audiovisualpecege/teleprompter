/**
 * Aviso de versão nova (TechSpec, "Pontos de integração: API do GitHub"; US-038).
 *
 * - Uma consulta por abertura a `releases/latest` de `audiovisualpecege/teleprompter`,
 *   por `net.fetch`, sem autenticação e com limite de 5 s. É a única chamada de rede do
 *   programa, junto com o download do instalador.
 * - A tag (`v1.2.3`) é comparada como semver com a versão do programa.
 * - O instalador é o asset que termina em `-win-x64.exe` (Windows) ou `-mac-<arch>.dmg` (Mac).
 * - Qualquer falha vai só ao log (`update.check`, com `result`), sem aviso.
 * - Baixar grava o instalador na pasta Downloads (num `.part`, renomeado só no fim, para
 *   nunca deixar arquivo pela metade) e o abre com `shell.openPath`.
 * - "Fechar" esconde o aviso até o fim da sessão: o estado mora aqui, no principal, e uma
 *   nova abertura volta a mostrar.
 */
import { createWriteStream } from 'node:fs';
import { rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { UpdateFailure } from '@shared/ipc';
import type { Result, UpdateView } from '@shared/types';
import type { NetAdapter, ShellAdapter } from './platform';

export const RELEASES_URL = 'https://api.github.com/repos/audiovisualpecege/teleprompter/releases/latest';
export const UPDATE_TIMEOUT_MS = 5000;
export const DOWNLOAD_FAILED_MESSAGE = 'Não foi possível baixar a versão nova';

export type LogFn = (event: string, fields?: Record<string, unknown>) => void;

export interface UpdateInfo {
  version: string;
  url: string;
}

/** Resultado da consulta, gravado em `update.check`. */
export type CheckResult = 'available' | 'up-to-date' | 'network' | 'timeout' | 'http' | 'invalid' | 'no-asset';

/** Grava um arquivo aos pedaços; trocável nos testes. */
export interface DownloadFs {
  createWriter(path: string): { write(chunk: Uint8Array): Promise<void>; close(): Promise<void> };
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export const nodeDownloadFs: DownloadFs = {
  createWriter(path) {
    const stream = createWriteStream(path);
    const failed = new Promise<never>((_, reject) => stream.once('error', reject));
    failed.catch(() => undefined);
    return {
      write: (chunk) =>
        Promise.race([
          failed,
          new Promise<void>((resolve, reject) => stream.write(chunk, (e) => (e ? reject(e) : resolve()))),
        ]),
      close: () => Promise.race([failed, new Promise<void>((resolve) => stream.end(() => resolve()))]),
    };
  },
  rename: (from, to) => rename(from, to),
  remove: (path) => unlink(path).catch(() => undefined),
};

export interface UpdateCheckerOptions {
  net: NetAdapter;
  shell: ShellAdapter;
  /** `app.getVersion()`. */
  currentVersion: string;
  platform: NodeJS.Platform;
  arch: string;
  /** `app.getPath('downloads')`. */
  downloadsDir: string;
  log?: LogFn;
  /** Só o build de teste troca (`TP_UPDATE_URL`). */
  url?: string;
  timeoutMs?: number;
  fs?: DownloadFs;
  /** O aviso mudou (apareceu, progresso, erro, fechado). */
  onChange?: () => void;
}

/** `v1.2.3` ou `1.2.3` (com ou sem sufixo de pré-versão); `null` se não for semver. */
export function parseVersion(tag: string): { core: [number, number, number]; pre: string | null } | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(tag).trim());
  if (!m) return null;
  return { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? null };
}

/** Diz se `candidate` é mais nova que `current` (semver; pré-versão vale menos que a versão). */
export function isNewer(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i];
  }
  if (a.pre === b.pre) return false;
  if (a.pre === null) return true;
  if (b.pre === null) return false;
  return a.pre.localeCompare(b.pre, 'en', { numeric: true }) > 0;
}

/** Sufixo do instalador desta plataforma, ou `null` onde não há instalador. */
export function assetSuffix(platform: NodeJS.Platform, arch: string): string | null {
  if (platform === 'win32') return '-win-x64.exe';
  if (platform === 'darwin') return `-mac-${arch}.dmg`;
  return null;
}

interface ReleaseAsset {
  name?: unknown;
  browser_download_url?: unknown;
}

export class UpdateChecker {
  private readonly o: UpdateCheckerOptions;
  private readonly fs: DownloadFs;
  private readonly log: LogFn;
  private checked: Promise<UpdateInfo | null> | null = null;
  private info: UpdateInfo | null = null;
  private dismissed = false;
  private progress: number | null = null;
  private error: string | null = null;
  private downloading: Promise<Result<void, UpdateFailure>> | null = null;

  constructor(options: UpdateCheckerOptions) {
    this.o = options;
    this.fs = options.fs ?? nodeDownloadFs;
    this.log = options.log ?? (() => undefined);
  }

  /** O que a tela de controle mostra (`StateSnapshot.update`); `null` sem aviso ou depois de "Fechar". */
  get view(): UpdateView | null {
    if (!this.info || this.dismissed) return null;
    return { ...this.info, progress: this.progress, error: this.error };
  }

  /** Consulta a Release mais nova, uma vez por instância (uma por abertura do programa). */
  check(): Promise<UpdateInfo | null> {
    this.checked ??= this.run();
    return this.checked;
  }

  /** "Fechar": o aviso some até o fim da sessão. */
  dismiss(): void {
    if (this.dismissed) return;
    this.dismissed = true;
    this.o.onChange?.();
  }

  /** "Baixar e instalar": grava em Downloads com progresso e abre o instalador. */
  download(): Promise<Result<void, UpdateFailure>> {
    if (!this.info) return Promise.resolve({ ok: false, error: 'no-asset' });
    this.downloading ??= this.runDownload(this.info).finally(() => {
      this.downloading = null;
    });
    return this.downloading;
  }

  private async run(): Promise<UpdateInfo | null> {
    const { result, info } = await this.fetchLatest();
    this.log('update.check', info ? { result, version: info.version } : { result });
    this.info = info;
    if (info) this.o.onChange?.();
    return info;
  }

  private async fetchLatest(): Promise<{ result: CheckResult; info: UpdateInfo | null }> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.o.timeoutMs ?? UPDATE_TIMEOUT_MS);
    try {
      let response: Response;
      try {
        response = await this.o.net.fetch(this.o.url ?? RELEASES_URL, {
          headers: { Accept: 'application/vnd.github+json' },
          signal: controller.signal,
        });
      } catch {
        return { result: timedOut ? 'timeout' : 'network', info: null };
      }
      if (!response.ok) return { result: 'http', info: null };
      let release: { tag_name?: unknown; assets?: unknown };
      try {
        release = (await response.json()) as typeof release;
      } catch {
        return { result: timedOut ? 'timeout' : 'invalid', info: null };
      }
      const tag = typeof release?.tag_name === 'string' ? release.tag_name : '';
      const parsed = parseVersion(tag);
      if (!parsed) return { result: 'invalid', info: null };
      if (!isNewer(tag, this.o.currentVersion)) return { result: 'up-to-date', info: null };
      const suffix = assetSuffix(this.o.platform, this.o.arch);
      const assets: ReleaseAsset[] = Array.isArray(release.assets) ? (release.assets as ReleaseAsset[]) : [];
      const asset = suffix
        ? assets.find((a) => typeof a?.name === 'string' && a.name.endsWith(suffix) && typeof a.browser_download_url === 'string')
        : undefined;
      if (!asset) return { result: 'no-asset', info: null };
      return { result: 'available', info: { version: tag.replace(/^v/, ''), url: String(asset.browser_download_url) } };
    } finally {
      clearTimeout(timer);
    }
  }

  private async runDownload(info: UpdateInfo): Promise<Result<void, UpdateFailure>> {
    const name = fileNameOf(info.url);
    const target = join(this.o.downloadsDir, name);
    const partial = `${target}.part`;
    this.error = null;
    this.progress = 0;
    this.o.onChange?.();
    let writer: ReturnType<DownloadFs['createWriter']> | null = null;
    try {
      const response = await this.o.net.fetch(info.url);
      if (!response.ok || !response.body) throw new Error(`http ${response.status}`);
      const total = Number(response.headers.get('content-length')) || 0;
      writer = this.fs.createWriter(partial);
      const reader = response.body.getReader();
      let received = 0;
      let lastShown = -1;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
        received += value.byteLength;
        if (total > 0) {
          const pct = Math.min(99, Math.floor((received / total) * 100));
          if (pct !== lastShown) {
            lastShown = pct;
            this.progress = pct;
            this.o.onChange?.();
          }
        }
      }
      // Conexão cortada antes do fim (o tamanho anunciado não chegou).
      if (total > 0 && received < total) throw new Error('incompleto');
      await writer.close();
      writer = null;
      await this.fs.rename(partial, target);
    } catch (e) {
      if (writer) await writer.close().catch(() => undefined);
      await this.fs.remove(partial);
      this.log('update.download', { result: 'network', error: String(e) });
      this.progress = null;
      this.error = DOWNLOAD_FAILED_MESSAGE;
      this.o.onChange?.();
      return { ok: false, error: 'network' };
    }
    this.progress = 100;
    this.o.onChange?.();
    this.log('update.download', { result: 'ok', file: name });
    const failure = await this.o.shell.openPath(target);
    if (failure) this.log('update.open', { error: failure });
    return { ok: true, value: undefined };
  }
}

/** Nome do arquivo no fim da URL do asset, sem caracteres que o sistema recusa. */
function fileNameOf(url: string): string {
  let name = 'Teleprompter-instalador';
  try {
    name = decodeURIComponent(new URL(url).pathname.split('/').pop() || name);
  } catch {
    // URL estranha: fica o nome padrão.
  }
  return name.replace(/[\\/:*?"<>|]/g, '_');
}
