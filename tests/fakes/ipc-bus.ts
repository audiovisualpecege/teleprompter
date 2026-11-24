/**
 * Barramento de IPC em memória para os testes de integração: faz o papel do
 * `ipcMain` e das janelas. A janela de controle falsa responde a `layout:request`
 * com `layoutScript` e `measure` de 10 px por caractere, como o `LayoutService`.
 * Cada janela guarda as mensagens na ordem em que chegaram.
 */
import type { LayoutRequest } from '@shared/ipc';
import { layoutScript } from '@shared/layout';
import type { MotionSegment } from '@shared/motion';
import type { LayoutResult, StateSnapshot } from '@shared/types';
import type { MainTransport } from '../../src/main/ipc-main';
import { measure10 } from './layouts';

export type BusMessage =
  | { channel: 'layout'; payload: LayoutResult }
  | { channel: 'motion:segment'; payload: MotionSegment }
  | { channel: 'state:snapshot'; payload: StateSnapshot }
  | { channel: 'layout:request'; payload: LayoutRequest };

export interface BusWindow {
  name: string;
  messages: BusMessage[];
  layout: LayoutResult | null;
  segment: MotionSegment | null;
}

export interface IpcBus extends MainTransport {
  control: BusWindow & { snapshot: StateSnapshot | null };
  outputs: BusWindow[];
  /** Comando da janela de controle com resposta (`ipcRenderer.invoke`). */
  invoke(channel: string, payload: unknown): Promise<unknown>;
  /** Comando da janela de controle sem resposta (`ipcRenderer.send`). */
  send(channel: string, payload: unknown): void;
}

function busWindow(name: string): BusWindow {
  return { name, messages: [], layout: null, segment: null };
}

export function createIpcBus(outputCount = 2): IpcBus {
  const handlers = new Map<string, (req: unknown) => unknown>();
  const listeners = new Map<string, ((p: unknown) => void)[]>();
  const control = { ...busWindow('controle'), snapshot: null as StateSnapshot | null };
  const outputs = Array.from({ length: outputCount }, (_, i) => busWindow(`saída ${i + 1}`));

  const bus: IpcBus = {
    control,
    outputs,
    handle(channel, fn) {
      handlers.set(channel, fn as (req: unknown) => unknown);
      return () => handlers.delete(channel);
    },
    on(channel, fn) {
      const list = [...(listeners.get(channel) ?? []), fn as (p: unknown) => void];
      listeners.set(channel, list);
      return () => listeners.set(channel, (listeners.get(channel) ?? []).filter((f) => f !== fn));
    },
    toControl(channel, payload) {
      control.messages.push({ channel, payload } as BusMessage);
      if (channel === 'state:snapshot') control.snapshot = payload as StateSnapshot;
      if (channel === 'motion:segment') control.segment = payload as MotionSegment;
      if (channel === 'layout:request') {
        // A tela diagrama com a fonte "real" (aqui, 10 px por caractere) e devolve.
        const req = payload as LayoutRequest;
        const layout = layoutScript(req.text, req.appearance, measure10, { revision: req.revision });
        control.layout = layout;
        bus.send('layout:result', layout);
      }
    },
    toOutputs(channel, payload) {
      for (const o of outputs) {
        o.messages.push({ channel, payload } as BusMessage);
        if (channel === 'motion:segment') o.segment = payload as MotionSegment;
      }
    },
    layoutToOutputs(layout) {
      for (const o of outputs) {
        o.messages.push({ channel: 'layout', payload: layout });
        o.layout = layout;
      }
    },
    async invoke(channel, payload) {
      const h = handlers.get(channel);
      if (!h) throw new Error(`Canal sem tratador: ${channel}`);
      return h(payload);
    },
    send(channel, payload) {
      for (const fn of listeners.get(channel) ?? []) fn(payload);
    },
  };
  return bus;
}
