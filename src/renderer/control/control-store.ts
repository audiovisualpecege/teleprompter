/**
 * Estado da janela de controle fora do React. A ponte é assinada antes da tela montar,
 * para não perder o primeiro `state:snapshot` nem o primeiro `layout:request`, que o
 * principal manda assim que a página carrega.
 *
 * - `snapshot`: o último `StateSnapshot`.
 * - `segment`: o último `MotionSegment`, guardado à parte (o React da tela não redesenha
 *   a cada trecho; só a prévia o assina).
 * - `layout`: o último `LayoutResult` produzido aqui pelo `LayoutService`, que é o mesmo
 *   que o principal repassa às saídas.
 */
import { DEFAULT_APPEARANCE } from '@shared/defaults';
import type { ControlBridge } from '@shared/ipc';
import type { MotionSegment } from '@shared/motion';
import type { LayoutResult, StateSnapshot } from '@shared/types';
import { createCommonClock, type CommonClock } from '../shared/clock';
import { bindLayoutService, type LayoutService } from './layout-service';

export interface ControlStore {
  readonly bridge: ControlBridge | null;
  readonly clock: { now(): number };
  getSnapshot(): StateSnapshot;
  getSegment(): MotionSegment;
  getLayout(): LayoutResult | null;
  /** Assina mudanças de estado ou de layout (não de trecho). */
  subscribe(cb: () => void): () => void;
  subscribeSegment(cb: () => void): () => void;
  listFonts(): Promise<string[]>;
  dispose(): void;
}

export function emptySnapshot(): StateSnapshot {
  return {
    doc: { filePath: null, draftText: '', confirmedText: '', dirty: false, pending: false },
    appearance: { ...DEFAULT_APPEARANCE },
    automation: 'none',
    speed: 1,
    voice: { state: 'off', fault: null, engine: 'vosk', mode: 'near', lagMs: null },
    outputs: [],
    displays: [],
    editorFocused: false,
    update: null,
    notices: [],
    prompt: null,
  };
}

export interface ControlStoreOptions {
  bridge: ControlBridge | null;
  layoutService?: LayoutService | null;
  clock?: CommonClock | { now(): number };
  initial?: StateSnapshot;
}

export function createControlStore(options: ControlStoreOptions): ControlStore {
  const { bridge } = options;
  let snapshot = options.initial ?? emptySnapshot();
  let segment: MotionSegment = { kind: 'hold', y: 0 };
  let layout: LayoutResult | null = null;
  const listeners = new Set<() => void>();
  const segmentListeners = new Set<() => void>();
  const emit = (): void => listeners.forEach((cb) => cb());
  const offs: (() => void)[] = [];

  const clock: Partial<CommonClock> & { now(): number } =
    options.clock ??
    (bridge
      ? createCommonClock({ ping: (t0) => bridge.invoke('clock:ping', t0) })
      : { now: () => performance.timeOrigin + performance.now() });
  void clock.start?.();

  if (bridge) {
    offs.push(
      bridge.on('state:snapshot', (s) => {
        snapshot = s;
        emit();
      }),
      bridge.on('motion:segment', (s) => {
        segment = s;
        segmentListeners.forEach((cb) => cb());
      }),
    );
    if (options.layoutService) {
      offs.push(
        bindLayoutService(options.layoutService, bridge, (l) => {
          layout = l;
          emit();
        }),
      );
    }
  }

  return {
    bridge,
    clock,
    getSnapshot: () => snapshot,
    getSegment: () => segment,
    getLayout: () => layout,
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    subscribeSegment(cb) {
      segmentListeners.add(cb);
      return () => segmentListeners.delete(cb);
    },
    listFonts: () => options.layoutService?.listFonts() ?? Promise.resolve(['Archivo']),
    dispose() {
      offs.forEach((off) => off());
      clock.stop?.();
    },
  };
}
