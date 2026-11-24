import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeOffset, createCommonClock } from '../../src/renderer/shared/clock';
import { CLOCK_RESYNC_MS } from '@shared/defaults';
import { positionAt, type MotionSegment } from '@shared/motion';

describe('clock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('UT-007 clock: desvio de uma ida e volta é mainNow menos o meio do caminho', async () => {
    expect(computeOffset(1000, 5000, 1010)).toBe(3995);
    let local = 1000;
    const clock = createCommonClock({
      localNow: () => local,
      ping: async (t0) => {
        local = 1010;
        return { t0, mainNow: 5000 };
      },
    });
    await clock.sync();
    expect(clock.offset).toBe(3995);
    expect(clock.now()).toBe(1010 + 3995);
  });

  it('UT-008 clock: nova medição a cada 10.000 ms substitui a anterior', async () => {
    let mainShift = 100;
    const ping = vi.fn(async (t0: number) => ({ t0, mainNow: Date.now() + mainShift }));
    const clock = createCommonClock({ localNow: () => Date.now(), ping });
    await clock.start();
    expect(ping).toHaveBeenCalledTimes(1);
    expect(clock.offset).toBe(100);

    mainShift = 250;
    await vi.advanceTimersByTimeAsync(CLOCK_RESYNC_MS - 1);
    expect(ping).toHaveBeenCalledTimes(1);
    expect(clock.offset).toBe(100);
    await vi.advanceTimersByTimeAsync(1);
    expect(ping).toHaveBeenCalledTimes(2);
    expect(clock.offset).toBe(250);

    mainShift = -40;
    await vi.advanceTimersByTimeAsync(CLOCK_RESYNC_MS);
    expect(ping).toHaveBeenCalledTimes(3);
    expect(clock.offset).toBe(-40);
    expect(clock.syncCount).toBe(3);

    clock.stop();
    await vi.advanceTimersByTimeAsync(CLOCK_RESYNC_MS * 3);
    expect(ping).toHaveBeenCalledTimes(3);
  });

  it('UT-009 clock: duas janelas com timeOrigin diferentes em 7 ms desenham a mesma posição', async () => {
    const mainNow = (): number => Date.now();
    const ping = async (t0: number) => ({ t0, mainNow: mainNow() });
    const a = createCommonClock({ localNow: () => Date.now() - 1_000_000, ping });
    const b = createCommonClock({ localNow: () => Date.now() - 1_000_000 + 7, ping });
    await a.sync();
    await b.sync();
    const seg: MotionSegment = { kind: 'cruise', y0: 0, t0: mainNow(), pxPerSec: 300, yEnd: 1e9 };
    await vi.advanceTimersByTimeAsync(12_345);
    expect(Math.abs(positionAt(seg, a.now()) - positionAt(seg, b.now()))).toBeLessThan(0.5);
  });

  it('clock: resposta atrasada de uma medição antiga não desfaz a mais nova', async () => {
    const resolvers: ((v: { t0: number; mainNow: number }) => void)[] = [];
    const clock = createCommonClock({
      localNow: () => 0,
      ping: (t0) => new Promise((r) => resolvers.push((v) => r({ ...v, t0 }))),
    });
    const first = clock.sync();
    const second = clock.sync();
    resolvers[1]({ t0: 0, mainNow: 20 });
    await second;
    resolvers[0]({ t0: 0, mainNow: 999 });
    await first;
    expect(clock.offset).toBe(20);
  });

  it('clock: sem resposta do principal, vale o último desvio', async () => {
    let fail = false;
    const clock = createCommonClock({
      localNow: () => 0,
      ping: async (t0) => {
        if (fail) throw new Error('sem resposta');
        return { t0, mainNow: 30 };
      },
    });
    await clock.sync();
    fail = true;
    await clock.sync();
    expect(clock.offset).toBe(30);
  });
});
