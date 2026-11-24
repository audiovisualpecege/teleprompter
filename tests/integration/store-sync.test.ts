import { describe, expect, it } from 'vitest';
import { positionAt } from '@shared/motion';
import { bindStore } from '../../src/main/ipc-main';
import { createIpcBus } from '../fakes/ipc-bus';
import { createTestStore } from '../fakes/store';

/** Caractere na faixa de uma janela: o começo da linha do layout que ela tem, na posição que ela desenha. */
function bandLineStart(w: { layout: import('@shared/types').LayoutResult | null; segment: import('@shared/motion').MotionSegment | null }, now: number): number {
  const y = positionAt(w.segment!, now);
  const line = w.layout!.lines.findLast((l) => l.y <= y + 1e-6)!;
  return line.start;
}

describe('IT-003 confirmar texto durante a rolagem automática', () => {
  it('mantém o caractere da faixa, continua rolando e entrega o layout antes do trecho', async () => {
    const t = await createTestStore({ autoLayout: false, init: false });
    const bus = createIpcBus(2);
    bindStore(t.store, bus);
    await t.store.init();

    const text = Array.from({ length: 40 }, (_, i) => `Frase ${i} do roteiro lido em voz alta.`).join('\n');
    await bus.invoke('cmd:doc', { op: 'setDraft', text });
    await bus.invoke('cmd:doc', { op: 'confirm' });
    bus.send('cmd:scroll', { type: 'autoStart' });
    t.clock.advance(30_000);
    const now = t.clock.now;
    const anchor = t.store.engine.anchorAt(now);
    const lineBefore = bandLineStart(bus.outputs[0], now);
    expect(lineBefore).toBeGreaterThan(0);

    for (const o of bus.outputs) o.messages.length = 0;
    const inserted = 'Uma frase nova inserida bem no começo do roteiro.\n';
    await bus.invoke('cmd:doc', { op: 'setDraft', text: inserted + text });
    await bus.invoke('cmd:doc', { op: 'confirm' });

    // O caractere da faixa é o mesmo, deslocado pelo trecho inserido.
    expect(t.store.engine.anchorAt(now).charOffset).toBe(anchor.charOffset + inserted.length);
    expect(t.store.engine.automation).toBe('auto');
    expect(t.store.engine.segment.kind).toBe('cruise');
    for (const o of bus.outputs) {
      // Layout novo antes do trecho novo.
      expect(o.messages.map((m) => m.channel)).toEqual(['layout', 'motion:segment']);
      expect(bandLineStart(o, now)).toBe(lineBefore + inserted.length);
      // E a rolagem segue: um segundo depois, a posição andou.
      expect(positionAt(o.segment!, now + 1000)).toBeGreaterThan(positionAt(o.segment!, now));
    }
    expect(bus.control.snapshot?.automation).toBe('auto');
    expect(bus.control.snapshot?.doc.confirmedText).toBe(inserted + text);
  });
});
