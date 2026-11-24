import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), transports: { file: {} }, initialize: vi.fn() } }));

const { catchUnexpected, rotateLogFiles } = await import('../../src/main/log');

describe('log', () => {
  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('log: a rotação mantém no máximo 5 arquivos, do mais novo ao mais antigo', () => {
    dir = mkdtempSync(join(tmpdir(), 'tp-log-'));
    const file = join(dir, 'teleprompter.log');
    for (let i = 1; i <= 7; i++) {
      writeFileSync(file, `geração ${i}`);
      rotateLogFiles(file, 5);
    }
    expect(existsSync(file)).toBe(false);
    expect(readFileSync(join(dir, 'teleprompter.1.log'), 'utf8')).toBe('geração 7');
    expect(readFileSync(join(dir, 'teleprompter.4.log'), 'utf8')).toBe('geração 4');
    expect(existsSync(join(dir, 'teleprompter.5.log'))).toBe(false);
  });

  it('log: exceções inesperadas do principal vão ao log e não derrubam nada', () => {
    const handlers: Record<string, (x: unknown) => void> = {};
    const write = vi.fn();
    catchUnexpected({ on: (ev: string, cb: (x: never) => void) => (handlers[ev] = cb as (x: unknown) => void) }, write);
    expect(() => handlers.uncaughtException(new Error('falhou'))).not.toThrow();
    expect(() => handlers.unhandledRejection('recusado')).not.toThrow();
    expect(write).toHaveBeenCalledWith('main.uncaughtException', expect.objectContaining({ message: 'falhou' }));
    expect(write).toHaveBeenCalledWith('main.unhandledRejection', expect.objectContaining({ message: 'recusado' }));
  });
});
