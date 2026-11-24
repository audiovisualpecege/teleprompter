/**
 * Importação de `.txt` (TechSpec, "Importação"; US-002).
 *
 * 1. Bytes NUL ou mais de 10% de caracteres de controle: `not-text`.
 * 2. UTF-8 estrito; se falhar, Windows-1252 (o Latin-1 comum do Windows).
 * 3. Quebras de linha normalizadas para `\n`.
 * 4. Vazio ou só com espaços: `empty`.
 */
import { err, ok, type FileError, type Result } from '@shared/types';

const CONTROL_RATIO = 0.1;

function hasBom(b: Uint8Array, ...bom: number[]): boolean {
  return bom.every((v, i) => b[i] === v);
}

/** Decodifica bytes de um arquivo de texto. Não lança erro. */
export function decodeText(bytes: Uint8Array): Result<string, FileError> {
  // UTF-16 com marca (o "Unicode" do Bloco de Notas) é texto, apesar dos bytes NUL.
  if (hasBom(bytes, 0xff, 0xfe) || hasBom(bytes, 0xfe, 0xff)) {
    try {
      const enc = bytes[0] === 0xff ? 'utf-16le' : 'utf-16be';
      return finish(new TextDecoder(enc, { fatal: true }).decode(bytes));
    } catch {
      return err({ code: 'not-text' });
    }
  }
  if (bytes.includes(0)) return err({ code: 'not-text' });

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); // tira a marca UTF-8, se houver
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return finish(text);
}

function finish(raw: string): Result<string, FileError> {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (text.trim() === '') return err({ code: 'empty' });
  let control = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0c) || (c >= 0x7f && c < 0xa0)) control++;
  }
  if (control / text.length > CONTROL_RATIO) return err({ code: 'not-text' });
  return ok(text);
}

export function importTxt(bytes: Uint8Array): Result<{ text: string }, FileError> {
  if (bytes.length === 0) return err({ code: 'empty' });
  const r = decodeText(bytes);
  return r.ok ? ok({ text: r.value }) : r;
}
