import { describe, expect, it } from 'vitest';
import { createCommonClock } from '../../src/renderer/shared/clock';
import { CLOCK_RESYNC_MS } from '@shared/defaults';
import { positionAt, type MotionSegment } from '@shared/motion';

/**
 * IT-002: uma hora de `cruise` com relógio falso e correção a cada 10 s. A saída tem
 * o relógio 15 ms adiantado e ainda deriva (50 ppm, 180 ms por hora); a prévia está
 * em dia. Ao fim, e em cada segundo simulado, as posições diferem menos de 1 px.
 */
describe('IT-002 relógio comum: uma hora de cruise sem diferença acumulada', () => {
  it('saída com desvio de 15 ms e deriva fica a menos de 1 px da prévia', async () => {
    let t = 1_700_000_000_000; // relógio do principal
    const timers: { at: number; ms: number; fn: () => void }[] = [];
    const fakeSetInterval = (fn: () => void, ms: number): number => {
      timers.push({ at: t + ms, ms, fn });
      return timers.length - 1;
    };
    const ping = async (t0: number) => ({ t0, mainNow: t });
    const noClear = (): void => {};

    const start = t;
    const preview = createCommonClock({ localNow: () => t, ping, setInterval: fakeSetInterval, clearInterval: noClear });
    const outputLocal = (): number => t + 15 + (t - start) * 50e-6;
    const output = createCommonClock({ localNow: outputLocal, ping, setInterval: fakeSetInterval, clearInterval: noClear });
    await preview.start();
    await output.start();

    const seg: MotionSegment = { kind: 'cruise', y0: 0, t0: t, pxPerSec: 180, yEnd: 1e9 };
    const HOUR = 3_600_000;
    const FRAME = 1000 / 60;
    let worst = 0;
    let frames = 0;
    while (t - start < HOUR) {
      t += FRAME;
      for (const timer of timers) {
        if (timer.at <= t) {
          timer.at += timer.ms;
          timer.fn();
        }
      }
      await Promise.resolve();
      if (++frames % 60 === 0) {
        worst = Math.max(worst, Math.abs(positionAt(seg, output.now()) - positionAt(seg, preview.now())));
      }
    }
    const end = Math.abs(positionAt(seg, output.now()) - positionAt(seg, preview.now()));
    expect(output.syncCount).toBeGreaterThanOrEqual(HOUR / CLOCK_RESYNC_MS);
    expect(positionAt(seg, preview.now())).toBeCloseTo(180 * 3600, 0);
    expect(end).toBeLessThan(1);
    expect(worst).toBeLessThan(1);
  });
});
