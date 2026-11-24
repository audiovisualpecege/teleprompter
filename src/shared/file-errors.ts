/**
 * Mensagens em português de cada erro de arquivo (TechSpec, "Convenção de erros").
 * O principal as põe nos avisos; a tela de controle pode usá-las direto.
 */
import type { FileError, FileErrorCode } from './types';

export const FILE_ERROR_MESSAGES: Record<FileErrorCode, string> = {
  empty: 'O arquivo está vazio',
  'not-text': 'O arquivo não pôde ser lido: ele não é um arquivo de texto',
  unreadable: 'O arquivo não pôde ser lido',
  'no-text-content': 'O arquivo não tem texto para importar',
  'unsupported-format': 'Formato não aceito. Escolha um arquivo .txt ou .docx',
  'invalid-roteiro': 'Este arquivo não é um roteiro válido',
  'permission-denied': 'Sem permissão para usar este arquivo ou esta pasta',
  'not-found': 'O arquivo ou a pasta não foi encontrado. Ele pode ter sido movido ou a pasta de rede está indisponível',
  'invalid-name': 'O nome do arquivo tem caracteres que o sistema não aceita',
  'disk-full': 'Não há espaço livre no disco',
};

export function fileErrorMessage(error: FileError | FileErrorCode): string {
  const code = typeof error === 'string' ? error : error.code;
  return FILE_ERROR_MESSAGES[code] ?? FILE_ERROR_MESSAGES.unreadable;
}

const ERRNO_TO_CODE: Record<string, FileErrorCode> = {
  EACCES: 'permission-denied',
  EPERM: 'permission-denied',
  EROFS: 'permission-denied',
  EBUSY: 'permission-denied',
  ENOSPC: 'disk-full',
  EDQUOT: 'disk-full',
  ENOENT: 'not-found',
  ENOTDIR: 'not-found',
  EINVAL: 'invalid-name',
  ENAMETOOLONG: 'invalid-name',
};

/** Traduz um erro do Node (`err.code`) num `FileError`. Erro desconhecido vira `unreadable`. */
export function toFileError(e: unknown, path?: string): FileError {
  const errno = (e as { code?: unknown } | null)?.code;
  const code = (typeof errno === 'string' && ERRNO_TO_CODE[errno]) || 'unreadable';
  return { code, path, detail: typeof errno === 'string' ? errno : undefined };
}
