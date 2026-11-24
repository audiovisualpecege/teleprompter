/**
 * Log local (TechSpec, "Monitoramento e observabilidade"): `electron-log` em
 * `userData/logs/`, com rotação de 5 arquivos de 1 MB. Nada sai do computador.
 * Exceções inesperadas do principal vão ao log e nunca derrubam as janelas.
 */
import { existsSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import log from 'electron-log/main';

export const LOG_MAX_BYTES = 1024 * 1024;
export const LOG_MAX_FILES = 5;
export const LOG_FILE_NAME = 'teleprompter.log';

/**
 * Gira os arquivos: `x.log` vira `x.1.log`, `x.1.log` vira `x.2.log` e assim por
 * diante, apagando o mais antigo, para que existam no máximo `maxFiles` arquivos.
 */
export function rotateLogFiles(filePath: string, maxFiles = LOG_MAX_FILES): void {
  const nth = (n: number): string => (n === 0 ? filePath : filePath.replace(/\.log$/, `.${n}.log`));
  const oldest = nth(maxFiles - 1);
  if (existsSync(oldest)) rmSync(oldest, { force: true });
  for (let n = maxFiles - 2; n >= 0; n--) {
    if (existsSync(nth(n))) renameSync(nth(n), nth(n + 1));
  }
}

export function setupLog(userDataDir: string): typeof log {
  const dir = join(userDataDir, 'logs');
  log.transports.file.resolvePathFn = () => join(dir, LOG_FILE_NAME);
  log.transports.file.maxSize = LOG_MAX_BYTES;
  log.transports.file.archiveLogFn = (oldLogFile) => {
    try {
      rotateLogFiles(oldLogFile.path);
    } catch (e) {
      // Sem conseguir girar (arquivo preso por outro programa), recomeça o arquivo.
      console.error('Falha ao girar o log', e);
      oldLogFile.clear();
    }
  };
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
  log.initialize();
  return log;
}

/** Registra um evento com campos estruturados, como `output.open` ou `voice.state`. */
export function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  let text: string;
  try {
    text = JSON.stringify(fields);
  } catch {
    text = String(fields);
  }
  log.info(event, text);
}

interface CrashSources {
  on(event: 'uncaughtException', cb: (err: Error) => void): unknown;
  on(event: 'unhandledRejection', cb: (reason: unknown) => void): unknown;
}

/** Liga o tratamento de exceções inesperadas do principal: só registram no log. */
export function catchUnexpected(
  proc: CrashSources,
  write: (event: string, fields: Record<string, unknown>) => void = logEvent,
): void {
  proc.on('uncaughtException', (e: Error) => {
    write('main.uncaughtException', { message: e?.message, stack: e?.stack });
  });
  proc.on('unhandledRejection', (reason: unknown) => {
    const e = reason instanceof Error ? reason : new Error(String(reason));
    write('main.unhandledRejection', { message: e.message, stack: e.stack });
  });
}

export { log };
