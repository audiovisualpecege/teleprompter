/**
 * Gravação segura (ADR-008): grava num temporário ao lado e renomeia por cima.
 * Uma falha no meio deixa o arquivo anterior intacto e apaga o temporário.
 */
import { promises as nodeFs } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** Operações de disco usadas aqui e nos leitores; os testes trocam por falsos que falham. */
export interface FileSystem {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: string | Uint8Array): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  unlink(path: string): Promise<void>;
}

export const nodeFileSystem: FileSystem = {
  readFile: (p) => nodeFs.readFile(p),
  writeFile: (p, d) => nodeFs.writeFile(p, d),
  rename: (a, b) => nodeFs.rename(a, b),
  unlink: (p) => nodeFs.unlink(p),
};

let counter = 0;

/** Caminho do temporário, na mesma pasta (o renomear só é atômico no mesmo disco). */
export function tempPathFor(path: string): string {
  counter = (counter + 1) % 1_000_000;
  return join(dirname(path), `.${basename(path)}.${process.pid}.${counter}.tmp`);
}

export async function atomicWrite(path: string, data: string | Uint8Array, fs: FileSystem = nodeFileSystem): Promise<void> {
  const tmp = tempPathFor(path);
  try {
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, path);
  } catch (e) {
    await fs.unlink(tmp).catch(() => undefined);
    throw e;
  }
}
