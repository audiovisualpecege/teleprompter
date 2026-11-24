/** Disco em memória para os testes de unidade, com falhas por código de erro do Node. */
import { dirname, normalize } from 'node:path';
import type { FileSystem } from '../../src/main/safe-write';

export interface MemFs extends FileSystem {
  /** Arquivos por caminho normalizado (`path.normalize`). */
  files: Map<string, Uint8Array>;
  /** Pastas que existem (gravar fora delas dá ENOENT). Vazio: todas existem. */
  dirs: Set<string>;
  /** Próximas falhas de gravação: código do Node (`EACCES`, `ENOSPC`...) por pasta ou caminho. */
  failWrite: Map<string, string>;
  failRead: Map<string, string>;
  text(path: string): string;
}

const fail = (code: string): never => {
  throw Object.assign(new Error(code), { code });
};

export function createMemFs(initial: Record<string, string | Uint8Array> = {}): MemFs {
  const enc = new TextEncoder();
  const files = new Map<string, Uint8Array>();
  for (const [k, v] of Object.entries(initial)) files.set(normalize(k), typeof v === 'string' ? enc.encode(v) : v);
  const n = (p: string): string => normalize(p);
  const match = (m: Map<string, string>, path: string): string | undefined => {
    for (const [k, v] of m) if (n(k) === n(path) || n(k) === dirname(n(path))) return v;
    return undefined;
  };
  const fs: MemFs = {
    files,
    dirs: new Set(),
    failWrite: new Map(),
    failRead: new Map(),
    text: (p) => new TextDecoder().decode(files.get(n(p)) ?? new Uint8Array()),
    async readFile(p) {
      const code = match(fs.failRead, p);
      if (code) fail(code);
      const f = files.get(n(p));
      if (!f) fail('ENOENT');
      return f!;
    },
    async writeFile(p, d) {
      const code = match(fs.failWrite, p);
      if (code) fail(code);
      if (fs.dirs.size > 0 && ![...fs.dirs].some((d) => n(d) === dirname(n(p)))) fail('ENOENT');
      files.set(n(p), typeof d === 'string' ? enc.encode(d) : d);
    },
    async rename(a, b) {
      const f = files.get(n(a));
      if (!f) fail('ENOENT');
      files.delete(n(a));
      files.set(n(b), f!);
    },
    async unlink(p) {
      if (!files.delete(n(p))) fail('ENOENT');
    },
  };
  return fs;
}
