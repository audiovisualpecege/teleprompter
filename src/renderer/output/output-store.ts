/**
 * Estado da janela de saída fora do React. A ponte é assinada antes de a tela montar:
 * o principal manda o `state:output` e o trecho em curso assim que a página carrega.
 */
import type { OutputBridge, OutputView } from '@shared/ipc';
import type { MotionSegment } from '@shared/motion';
import { createCommonClock, type CommonClock } from '../shared/clock';

export interface OutputStore {
  readonly bridge: OutputBridge | null;
  readonly clock: { now(): number };
  getView(): OutputView | null;
  getSegment(): MotionSegment;
  subscribe(cb: () => void): () => void;
  subscribeSegment(cb: () => void): () => void;
  dispose(): void;
}

export interface OutputStoreOptions {
  bridge: OutputBridge | null;
  clock?: CommonClock | { now(): number };
  initial?: OutputView | null;
  segment?: MotionSegment;
}

export function createOutputStore(options: OutputStoreOptions): OutputStore {
  const { bridge } = options;
  let view: OutputView | null = options.initial ?? null;
  let segment: MotionSegment = options.segment ?? { kind: 'hold', y: 0 };
  const listeners = new Set<() => void>();
  const segmentListeners = new Set<() => void>();
  const offs: (() => void)[] = [];

  const clock: Partial<CommonClock> & { now(): number } =
    options.clock ??
    (bridge
      ? createCommonClock({ ping: (t0) => bridge.invoke('clock:ping', t0) })
      : { now: () => performance.timeOrigin + performance.now() });
  void clock.start?.();

  if (bridge) {
    offs.push(
      bridge.on('state:output', (v) => {
        view = v;
        listeners.forEach((cb) => cb());
      }),
      bridge.on('motion:segment', (s) => {
        segment = s;
        segmentListeners.forEach((cb) => cb());
      }),
    );
  }

  return {
    bridge,
    clock,
    getView: () => view,
    getSegment: () => segment,
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    subscribeSegment(cb) {
      segmentListeners.add(cb);
      return () => segmentListeners.delete(cb);
    },
    dispose() {
      offs.forEach((off) => off());
      clock.stop?.();
    },
  };
}
