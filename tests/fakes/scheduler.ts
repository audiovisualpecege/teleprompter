/**
 * Relógio falso para o motor de rolagem e o `AppStore`: os temporizadores são
 * agendados em horário absoluto e só disparam quando o teste avança o relógio.
 */
import type { Scheduler } from '../../src/main/scroll-engine';

export interface FakeScheduler extends Scheduler {
  now: number;
  /** Avança até `time`, disparando em ordem os temporizadores vencidos. */
  advanceTo(time: number): void;
  advance(ms: number): void;
  pending(): number;
}

export function createFakeScheduler(start = 0): FakeScheduler {
  let seq = 0;
  let timers: { time: number; seq: number; fn: () => void }[] = [];
  const s: FakeScheduler = {
    now: start,
    at(time, fn) {
      const t = { time, seq: seq++, fn };
      timers.push(t);
      return () => {
        timers = timers.filter((x) => x !== t);
      };
    },
    advanceTo(time) {
      for (;;) {
        const due = timers.filter((t) => t.time <= time).sort((a, b) => a.time - b.time || a.seq - b.seq)[0];
        if (!due) break;
        timers = timers.filter((x) => x !== due);
        s.now = Math.max(s.now, due.time);
        due.fn();
      }
      s.now = Math.max(s.now, time);
    },
    advance(ms) {
      s.advanceTo(s.now + ms);
    },
    pending: () => timers.length,
  };
  return s;
}
