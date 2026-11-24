/**
 * Ponte falsa da janela de controle (`window.tp`) para os testes de componente: guarda
 * os `invoke` e `send`, deixa o teste responder e publicar eventos do principal.
 */
import { act } from '@testing-library/react';
import type { ControlBridge, ControlEvents } from '@shared/ipc';
import type { StateSnapshot } from '@shared/types';
import { createControlStore, emptySnapshot, type ControlStore } from '../../src/renderer/control/control-store';

type Handler = (channel: string, payload: unknown) => unknown;

export interface FakeControlBridge extends ControlBridge {
  invokes: { channel: string; payload: unknown }[];
  sends: { channel: string; payload: unknown }[];
  /** Resposta dos `invoke` (padrão: `{ ok: true }`). */
  respond: Handler;
  emit<C extends keyof ControlEvents>(channel: C, payload: ControlEvents[C]): void;
}

export function createFakeBridge(): FakeControlBridge {
  const listeners = new Map<string, Set<(p: unknown) => void>>();
  const bridge: FakeControlBridge = {
    role: 'control',
    invokes: [],
    sends: [],
    respond: () => ({ ok: true, value: undefined }),
    invoke(channel, payload) {
      bridge.invokes.push({ channel, payload });
      return Promise.resolve(bridge.respond(channel, payload)) as never;
    },
    send(channel, payload) {
      bridge.sends.push({ channel, payload });
    },
    on(channel, cb) {
      const set = listeners.get(channel) ?? new Set();
      set.add(cb as (p: unknown) => void);
      listeners.set(channel, set);
      return () => set.delete(cb as (p: unknown) => void);
    },
    emit(channel, payload) {
      act(() => {
        listeners.get(channel)?.forEach((cb) => cb(payload));
      });
    },
  };
  return bridge;
}

export function snapshotWith(
  patch: Partial<Omit<StateSnapshot, 'doc'>> & { doc?: Partial<StateSnapshot['doc']> } = {},
): StateSnapshot {
  const base = emptySnapshot();
  return { ...base, ...patch, doc: { ...base.doc, ...patch.doc } };
}

export function storeWith(bridge: FakeControlBridge, initial: StateSnapshot = snapshotWith()): ControlStore {
  return createControlStore({ bridge, clock: { now: () => 0 }, initial, layoutService: null });
}
