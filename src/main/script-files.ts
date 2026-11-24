/**
 * Arquivos de roteiro (ADR-008) e importação (US-002, US-003).
 *
 * - `.roteiro`: JSON em UTF-8 `{ formato, versao, texto, aparencia }`, validado com
 *   `zod` campo a campo; campo ausente ou inválido vira o padrão.
 * - `versao` maior que 1 abre o que for entendido, com o aviso `newer-version`.
 * - Gravação segura (temporário e renomear). Todo erro vira `FileError`, nunca exceção.
 */
import { extname } from 'node:path';
import { z } from 'zod';
import { sanitizeAppearance } from '@shared/appearance';
import { DEFAULT_APPEARANCE, ROTEIRO_EXT, ROTEIRO_FORMAT, ROTEIRO_VERSION } from '@shared/defaults';
import { toFileError } from '@shared/file-errors';
import { err, ok, type Appearance, type FileError, type Result } from '@shared/types';
import { importDocx, type IgnoredItems } from './import-docx';
import { importTxt } from './import-txt';
import type { DialogAdapter, WindowLike } from './platform';
import { atomicWrite, nodeFileSystem, type FileSystem } from './safe-write';

export const ROTEIRO_FILTERS = [{ name: 'Roteiro', extensions: [ROTEIRO_EXT] }];
export const IMPORT_FILTERS = [{ name: 'Texto', extensions: ['txt', 'docx'] }];

export interface RoteiroContent {
  text: string;
  appearance: Appearance;
}

export type RoteiroWarning = 'newer-version';

export interface RoteiroRead extends RoteiroContent {
  warnings: RoteiroWarning[];
}

export interface ImportResult {
  text: string;
  ignored: IgnoredItems | null;
}

const headerSchema = z.object({
  formato: z.literal(ROTEIRO_FORMAT),
  versao: z.number().int().min(1).catch(ROTEIRO_VERSION),
  texto: z.string(),
});

/** Conteúdo do `.roteiro`, com chaves em ordem fixa (dois salvamentos iguais dão os mesmos bytes). */
export function encodeRoteiro(content: RoteiroContent): string {
  const file = {
    formato: ROTEIRO_FORMAT,
    versao: ROTEIRO_VERSION,
    texto: content.text,
    aparencia: sanitizeAppearance(content.appearance, DEFAULT_APPEARANCE),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function decodeRoteiro(raw: string): Result<RoteiroRead, FileError> {
  let data: unknown;
  try {
    data = JSON.parse(raw.replace(/^﻿/, ''));
  } catch {
    return err({ code: 'invalid-roteiro' });
  }
  const head = headerSchema.safeParse(data);
  if (!head.success) return err({ code: 'invalid-roteiro' });
  const aparencia = (data as { aparencia?: unknown }).aparencia;
  const appearance = sanitizeAppearance(
    aparencia && typeof aparencia === 'object' ? (aparencia as Record<string, unknown>) : null,
    DEFAULT_APPEARANCE,
  );
  const warnings: RoteiroWarning[] = head.data.versao > ROTEIRO_VERSION ? ['newer-version'] : [];
  return ok({ text: head.data.texto.replace(/\r\n?/g, '\n'), appearance, warnings });
}

export interface ScriptFilesOptions {
  dialog: DialogAdapter;
  fs?: FileSystem;
  /** Janela dona dos seletores (a de controle). */
  window?: () => WindowLike | null;
}

export class ScriptFiles {
  private readonly dialog: DialogAdapter;
  private readonly fs: FileSystem;
  private readonly window: () => WindowLike | null;

  constructor(options: ScriptFilesOptions) {
    this.dialog = options.dialog;
    this.fs = options.fs ?? nodeFileSystem;
    this.window = options.window ?? (() => null);
  }

  async read(path: string): Promise<Result<RoteiroRead, FileError>> {
    let bytes: Uint8Array;
    try {
      bytes = await this.fs.readFile(path);
    } catch (e) {
      return err(toFileError(e, path));
    }
    let raw: string;
    try {
      raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return err({ code: 'invalid-roteiro', path });
    }
    const r = decodeRoteiro(raw);
    return r.ok ? r : err({ ...r.error, path });
  }

  async write(path: string, content: RoteiroContent): Promise<Result<void, FileError>> {
    try {
      await atomicWrite(path, encodeRoteiro(content), this.fs);
      return ok(undefined);
    } catch (e) {
      return err(toFileError(e, path));
    }
  }

  /** Lê um `.txt` ou `.docx`; outro formato devolve `unsupported-format`. */
  async importFile(path: string): Promise<Result<ImportResult, FileError>> {
    const ext = extname(path).toLowerCase();
    if (ext !== '.txt' && ext !== '.docx') return err({ code: 'unsupported-format', path });
    let bytes: Uint8Array;
    try {
      bytes = await this.fs.readFile(path);
    } catch (e) {
      return err(toFileError(e, path));
    }
    if (ext === '.txt') {
      const r = importTxt(bytes);
      return r.ok ? ok({ text: r.value.text, ignored: null }) : err({ ...r.error, path });
    }
    const r = await importDocx(bytes);
    return r.ok ? ok(r.value) : err({ ...r.error, path });
  }

  /** Seletor para abrir um `.roteiro`. `null` quando cancelado. */
  async pickOpen(): Promise<string | null> {
    const r = await this.dialog.showOpenDialog(this.window(), {
      title: 'Abrir roteiro',
      properties: ['openFile'],
      filters: ROTEIRO_FILTERS,
    });
    return r.canceled ? null : (r.filePaths[0] ?? null);
  }

  /** Seletor para importar um `.txt` ou `.docx`. `null` quando cancelado. */
  async pickImport(): Promise<string | null> {
    const r = await this.dialog.showOpenDialog(this.window(), {
      title: 'Importar texto',
      properties: ['openFile'],
      filters: IMPORT_FILTERS,
    });
    return r.canceled ? null : (r.filePaths[0] ?? null);
  }

  /** Seletor para salvar; acrescenta `.roteiro` quando falta. `null` quando cancelado. */
  async pickSave(defaultPath?: string): Promise<string | null> {
    const r = await this.dialog.showSaveDialog(this.window(), {
      title: 'Salvar roteiro',
      defaultPath,
      filters: ROTEIRO_FILTERS,
    });
    if (r.canceled || !r.filePath) return null;
    return extname(r.filePath).toLowerCase() === `.${ROTEIRO_EXT}` ? r.filePath : `${r.filePath}.${ROTEIRO_EXT}`;
  }
}
