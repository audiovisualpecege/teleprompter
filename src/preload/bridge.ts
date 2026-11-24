/**
 * Monta a ponte `window.tp` de uma janela. Só passam os canais listados em
 * `src/shared/ipc.ts`; qualquer outro é recusado aqui, antes de chegar ao principal.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { TEST_CHANNEL_PREFIX } from '@shared/ipc';

export interface BridgeSpec {
  role: 'control' | 'output';
  invoke: readonly string[];
  send: readonly string[];
  events: readonly string[];
}

export function buildBridge(spec: BridgeSpec): Record<string, unknown> {
  const allowed = (list: readonly string[], channel: string): void => {
    if (!list.includes(channel)) throw new Error(`Canal não permitido: ${channel}`);
  };
  const bridge: Record<string, unknown> = {
    role: spec.role,
    invoke(channel: string, payload: unknown) {
      allowed(spec.invoke, channel);
      return ipcRenderer.invoke(channel, payload);
    },
    on(channel: string, cb: (payload: unknown) => void) {
      allowed(spec.events, channel);
      const listener = (_e: IpcRendererEvent, payload: unknown): void => cb(payload);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
  };
  if (spec.send.length > 0) {
    bridge.send = (channel: string, payload: unknown) => {
      allowed(spec.send, channel);
      ipcRenderer.send(channel, payload);
    };
  }
  return bridge;
}

export function exposeBridge(spec: BridgeSpec): void {
  contextBridge.exposeInMainWorld('tp', buildBridge(spec));
  if (__TP_TEST__) {
    // Só no build de teste: os ganchos do principal ficam ao alcance de `window.__tpTest`.
    contextBridge.exposeInMainWorld('__tpTestBridge', {
      call: (name: string, ...args: unknown[]) => ipcRenderer.invoke(`${TEST_CHANNEL_PREFIX}call`, name, args),
      list: () => ipcRenderer.invoke(`${TEST_CHANNEL_PREFIX}list`),
    });
  }
}
