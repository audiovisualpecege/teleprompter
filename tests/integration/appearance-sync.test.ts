import { describe, expect, it } from 'vitest';
import { positionAt, type MotionSegment } from '@shared/motion';
import type { Appearance, LayoutResult } from '@shared/types';
import { bindStore } from '../../src/main/ipc-main';
import { createIpcBus } from '../fakes/ipc-bus';
import { createTestStore } from '../fakes/store';

interface Drawn {
  layout: LayoutResult | null;
  segment: MotionSegment | null;
}

/** Linha na faixa de uma janela: a última cujo `y` não passa da posição desenhada. */
function bandLine(w: Drawn, now: number) {
  const y = positionAt(w.segment!, now);
  return w.layout!.lines.findLast((l) => l.y <= y + 1e-6)!;
}

describe('IT-004 mudanças de aparência durante a rolagem automática', () => {
  it('mantém o mesmo token na faixa em todas as janelas depois de cada mudança', async () => {
    const t = await createTestStore({ autoLayout: false, init: false });
    const bus = createIpcBus(2);
    bindStore(t.store, bus);
    await t.store.init();

    const text = Array.from({ length: 60 }, (_, i) => `Frase número ${i} do roteiro que está sendo lido agora.`).join('\n');
    await bus.invoke('cmd:doc', { op: 'setDraft', text });
    await bus.invoke('cmd:doc', { op: 'confirm' });
    bus.send('cmd:scroll', { type: 'autoStart' });
    t.clock.advance(20_000);

    const windows: Drawn[] = [bus.control, ...bus.outputs];
    const changes: Partial<Appearance>[] = [{ fontSize: 120 }, { letterCase: 'upper' }, { marginPct: 30 }, { bandPositionPct: 50 }];
    for (const patch of changes) {
      const now = t.clock.now;
      const anchor = t.store.engine.anchorAt(now).charOffset;
      await bus.invoke('cmd:appearance', patch);

      // Todas as janelas têm o layout novo, com a mesma revisão.
      const revisions = windows.map((w) => w.layout!.revision);
      expect(new Set(revisions).size).toBe(1);
      expect(windows[0].layout!.appearance).toMatchObject(patch);

      // O token da faixa é o mesmo em todas as janelas, e é o que estava na faixa antes.
      const lines = windows.map((w) => bandLine(w, now));
      for (const line of lines) {
        expect(line.start).toBe(lines[0].start);
        expect(anchor).toBeGreaterThanOrEqual(line.start);
        expect(anchor).toBeLessThanOrEqual(line.end);
      }
      // A rolagem continua.
      expect(t.store.engine.automation).toBe('auto');
      for (const w of windows) expect(positionAt(w.segment!, now + 1000)).toBeGreaterThan(positionAt(w.segment!, now));
      t.clock.advance(3_000);
    }
  });
});
