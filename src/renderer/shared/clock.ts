/**
 * Relógio comum (ADR-006). Cada janela mede o desvio entre o seu relógio local e o
 * do processo principal com `clock:ping`, ao abrir e a cada `CLOCK_RESYNC_MS`, e
 * desenha `positionAt(trecho, clock.now())`. Cada medição substitui a anterior.
 */
import { CLOCK_RESYNC_MS } from '@shared/defaults';
import type { ClockPong } from '@shared/ipc';
import { processNow } from '@shared/motion';

export interface ClockDeps {
  /** Pergunta ao principal: manda `t0` local e recebe `{ t0, mainNow }`. */
  ping(t0: number): Promise<ClockPong>;
  /** Relógio local da janela (padrão: `performance.timeOrigin + performance.now()`). */
  localNow?: () => number;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
  resyncMs?: number;
}

export interface CommonClock {
  /** Instante atual no relógio comum (o do principal). */
  now(): number;
  /** Desvio atual: relógio comum menos relógio local. */
  readonly offset: number;
  /** Quantas medições já foram aplicadas. */
  readonly syncCount: number;
  /** Mede o desvio agora. */
  sync(): Promise<void>;
  /** Mede agora e passa a medir a cada `resyncMs`. */
  start(): Promise<void>;
  stop(): void;
}

/**
 * Desvio por uma ida e volta: supõe que a resposta do principal foi lida no meio do
 * caminho, entre o envio (`t0`) e a chegada (`t1`).
 */
export function computeOffset(t0: number, mainNow: number, t1: number): number {
  return mainNow - (t0 + t1) / 2;
}

export function createCommonClock(deps: ClockDeps): CommonClock {
  const localNow = deps.localNow ?? processNow;
  const setI = deps.setInterval ?? ((fn: () => void, ms: number) => globalThis.setInterval(fn, ms));
  const clearI =
    deps.clearInterval ?? ((h: unknown) => globalThis.clearInterval(h as ReturnType<typeof setInterval>));
  const resyncMs = deps.resyncMs ?? CLOCK_RESYNC_MS;

  let offset = 0;
  let syncCount = 0;
  let seq = 0;
  let applied = 0;
  let timer: unknown = null;

  const sync = async (): Promise<void> => {
    const mine = ++seq;
    const t0 = localNow();
    try {
      const pong = await deps.ping(t0);
      const t1 = localNow();
      // Uma resposta atrasada de uma medição antiga não desfaz uma mais nova.
      if (mine < applied) return;
      applied = mine;
      offset = computeOffset(pong.t0, pong.mainNow, t1);
      syncCount++;
    } catch {
      // Sem resposta, vale o último desvio medido.
    }
  };

  return {
    now: () => localNow() + offset,
    get offset() {
      return offset;
    },
    get syncCount() {
      return syncCount;
    },
    sync,
    async start() {
      if (timer === null) timer = setI(() => void sync(), resyncMs);
      await sync();
    },
    stop() {
      if (timer !== null) clearI(timer);
      timer = null;
    },
  };
}
