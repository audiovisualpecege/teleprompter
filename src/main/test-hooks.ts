/**
 * Ganchos do processo principal que só existem no build de teste (`__TP_TEST__`).
 * Cada tarefa registra aqui os seus (monitores simulados, microfone simulado...) com
 * `registerTestHook`, sempre dentro de `if (__TP_TEST__)`. As janelas os chamam por
 * `window.__tpTest.<nome>(...)`, que passa pela ponte de teste do preload.
 */
import { TEST_CHANNEL_PREFIX } from '@shared/ipc';

export type TestHook = (...args: unknown[]) => unknown;

const hooks = new Map<string, TestHook>();

export function registerTestHook(name: string, fn: TestHook): void {
  if (!__TP_TEST__) return;
  hooks.set(name, fn);
}

interface IpcMainLike {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
}

export function installMainTestHooks(ipcMain: IpcMainLike): void {
  if (!__TP_TEST__) return;
  ipcMain.handle(`${TEST_CHANNEL_PREFIX}call`, async (_event, name, args) => {
    const fn = hooks.get(String(name));
    if (!fn) throw new Error(`Gancho de teste desconhecido: ${String(name)}`);
    return fn(...(Array.isArray(args) ? args : []));
  });
  ipcMain.handle(`${TEST_CHANNEL_PREFIX}list`, () => [...hooks.keys()]);
}
