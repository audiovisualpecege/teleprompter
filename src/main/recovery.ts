/**
 * Cópia de recuperação (ADR-008, US-007 EC-1) e abertura por arquivo (US-005 AC-2).
 *
 * - `recuperacao.json` fica na pasta do usuário, é gravado com segurança e some ao
 *   salvar ou fechar normalmente. Se existir ao abrir, o programa oferece recuperar.
 * - Duplo clique num `.roteiro`: no Windows o caminho chega por `argv`, e a trava de
 *   instância única repassa à instância aberta; no Mac chega pelo evento `open-file`.
 */
import { join } from 'node:path';
import { z } from 'zod';
import { sanitizeAppearance } from '@shared/appearance';
import { DEFAULT_APPEARANCE, RECOVERY_FILE, ROTEIRO_EXT } from '@shared/defaults';
import type { Appearance } from '@shared/types';
import { atomicWrite, nodeFileSystem, type FileSystem } from './safe-write';

export interface RecoveryData {
  filePath: string | null;
  draftText: string;
  appearance: Appearance;
  savedAt: number;
}

export function recoveryPath(userDataDir: string): string {
  return join(userDataDir, RECOVERY_FILE);
}

const recoverySchema = z.object({
  filePath: z.string().nullable().catch(null),
  draftText: z.string(),
  appearance: z.unknown(),
  savedAt: z.number().catch(0),
});

export class RecoveryStore {
  readonly path: string;
  private readonly fs: FileSystem;

  constructor(userDataDir: string, fs: FileSystem = nodeFileSystem) {
    this.path = recoveryPath(userDataDir);
    this.fs = fs;
  }

  async write(data: RecoveryData): Promise<void> {
    await atomicWrite(this.path, `${JSON.stringify(data, null, 2)}\n`, this.fs);
  }

  /** A cópia guardada, ou `null` se não há (ou está ilegível). */
  async read(): Promise<RecoveryData | null> {
    try {
      const raw = new TextDecoder().decode(await this.fs.readFile(this.path));
      const p = recoverySchema.safeParse(JSON.parse(raw));
      if (!p.success) return null;
      return {
        filePath: p.data.filePath,
        draftText: p.data.draftText,
        appearance: sanitizeAppearance(p.data.appearance as Record<string, unknown>, DEFAULT_APPEARANCE),
        savedAt: p.data.savedAt,
      };
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    await this.fs.unlink(this.path).catch(() => undefined);
  }
}

/* ---------- Abertura por arquivo e instância única ---------- */

/** O `.roteiro` passado na linha de comando, ignorando o executável e as opções. */
export function fileFromArgv(argv: readonly string[]): string | null {
  for (let i = argv.length - 1; i >= 1; i--) {
    const a = argv[i];
    if (!a || a.startsWith('-')) continue;
    if (a.toLowerCase().endsWith(`.${ROTEIRO_EXT}`)) return a;
  }
  return null;
}

/** O que a abertura por arquivo usa do `app` do Electron. */
export interface FileOpeningApp {
  requestSingleInstanceLock(): boolean;
  quit(): void;
  on(event: 'second-instance', cb: (event: unknown, argv: string[], cwd: string) => void): unknown;
  on(event: 'open-file', cb: (event: { preventDefault(): void }, path: string) => void): unknown;
}

export interface FileOpening {
  /** Esta é a primeira instância (as outras repassam o arquivo e encerram). */
  readonly primary: boolean;
  /** Liga a entrega dos arquivos; os que chegaram antes (Mac antes de pronto, argv) saem agora. */
  ready(onOpen: (path: string) => void): void;
}

/**
 * Trava de instância única e entrega dos arquivos abertos pelo sistema.
 * Os arquivos que chegam antes de `ready` (o argv da própria abertura, o `open-file`
 * do Mac antes da janela) ficam na fila.
 */
export function setupFileOpening(app: FileOpeningApp, argv: readonly string[], onFocus?: () => void): FileOpening {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return { primary: false, ready: () => undefined };
  }
  const queue: string[] = [];
  let deliver: ((path: string) => void) | null = null;
  const push = (path: string | null): void => {
    if (!path) return;
    if (deliver) deliver(path);
    else queue.push(path);
  };
  push(fileFromArgv(argv));
  app.on('second-instance', (_e, otherArgv) => {
    onFocus?.();
    push(fileFromArgv(otherArgv));
  });
  app.on('open-file', (e, path) => {
    e.preventDefault();
    push(path);
  });
  return {
    primary: true,
    ready(onOpen) {
      deliver = onOpen;
      for (const p of queue.splice(0)) onOpen(p);
    },
  };
}
