/**
 * Saídas, atalhos e energia com as peças reais juntas (IT-001, IT-018, IT-019, IT-020,
 * IT-026): `AppStore` e `ScrollEngine` reais, `OutputManager` e `KeymapService` reais
 * sobre a plataforma falsa, e o barramento de IPC em memória fazendo o papel da tela.
 */
import { describe, expect, it } from 'vitest';
import { DISPLAY_STABLE_MS } from '@shared/defaults';
import type { OutputView } from '@shared/ipc';
import { positionAt, type MotionSegment } from '@shared/motion';
import type { LayoutResult } from '@shared/types';
import { DisplayRegistry } from '../../src/main/displays';
import { bindStore, bindStudio } from '../../src/main/ipc-main';
import { KeymapService } from '../../src/main/keymap';
import { OutputManager } from '../../src/main/outputs';
import { createIpcBus } from '../fakes/ipc-bus';
import type { FakeWindow } from '../fakes/platform';
import { createTestStore } from '../fakes/store';
import { A, B, C, keyOf } from '../fakes/studio';

const TEXT = Array.from({ length: 60 }, (_, i) => `Linha ${i} do roteiro para ler em voz alta no estúdio.`).join('\n');

async function setupStudio() {
  const t = await createTestStore({ autoLayout: false, init: false });
  t.platform.displays = [A(), B(), C()];
  const control = t.platform.windows.create({ x: 320, y: 130, width: 1280, height: 820 }) as FakeWindow;
  const bus = createIpcBus(0);
  const starts: string[] = [];
  const stops: number[] = [];
  const realStart = t.platform.powerSaveBlocker.start;
  const realStop = t.platform.powerSaveBlocker.stop;
  t.platform.powerSaveBlocker.start = (type) => {
    starts.push(type);
    return realStart(type);
  };
  t.platform.powerSaveBlocker.stop = (id) => {
    stops.push(id);
    realStop(id);
  };
  const windows = new Map<number, FakeWindow[]>();
  let keymap: KeymapService | null = null;
  const manager = new OutputManager({
    platform: t.platform,
    displays: new DisplayRegistry(t.platform.screen),
    settings: t.settings,
    scheduler: t.clock,
    now: () => t.clock.now,
    paths: { mainDir: '/app/out/main', icon: '/app/icone.png' },
    isMac: false,
    controlWindow: () => control,
    appearance: () => t.store.snapshot().appearance,
    onChange: () => t.store.refresh(),
    notices: { add: (id, kind, msg) => t.store.addNotice(id, kind, msg), remove: (id) => t.store.removeNotice(id) },
    onWindow: (win, id) => {
      windows.set(id, [...(windows.get(id) ?? []), win as FakeWindow]);
      keymap?.attach(win, { kind: 'output', id });
    },
  });
  keymap = new KeymapService({
    settings: t.settings,
    platform: 'win32',
    editorFocused: () => t.store.isEditorFocused,
    handlers: {
      scroll: (cmd) => void t.store.scroll(cmd),
      automation: () => t.store.engine.automation,
      speed: () => t.store.engine.speed,
      voiceToggle: () => undefined,
      closeOutput: (id) => void manager.close(id),
      editorBlur: () => undefined,
    },
  });
  keymap.attach(control, { kind: 'control' });
  bus.toOutputs = (channel, payload) => {
    if (channel === 'motion:segment') manager.setSegment(payload as MotionSegment);
  };
  bus.layoutToOutputs = (layout) => manager.setLayout(layout);
  bindStore(t.store, bus);
  bindStudio(t.store, manager, keymap, bus);
  await t.store.init();

  const win = (id: number): FakeWindow => (windows.get(id) ?? []).at(-1)!;
  const open = async (key: string): Promise<FakeWindow> => {
    const r = (await bus.invoke('cmd:output', { op: 'open', displayKey: key })) as { ok: boolean; value: { id: number } };
    expect(r.ok).toBe(true);
    const w = win(r.value.id);
    w.emitWeb('did-finish-load');
    return w;
  };
  const confirm = async (text = TEXT): Promise<void> => {
    await bus.invoke('cmd:doc', { op: 'setDraft', text });
    await bus.invoke('cmd:doc', { op: 'confirm' });
  };
  return { t, bus, manager, keymap, control, starts, stops, win, open, confirm };
}

/** Os trechos e o layout que uma janela de saída recebeu, na ordem. */
function received(w: FakeWindow): { segments: MotionSegment[]; layouts: LayoutResult[]; order: string[] } {
  const segments: MotionSegment[] = [];
  const layouts: LayoutResult[] = [];
  const order: string[] = [];
  for (const m of w.sent) {
    if (m.channel === 'motion:segment') {
      segments.push(m.args[0] as MotionSegment);
      order.push('segment');
    } else if (m.channel === 'state:output') {
      const v = m.args[0] as OutputView;
      if (v.layout && layouts.at(-1) !== v.layout) {
        layouts.push(v.layout);
        order.push('layout');
      }
    }
  }
  return { segments, layouts, order };
}

describe('IT-001 prévia e duas saídas com os mesmos trechos e o mesmo layout', () => {
  it('lineStep, nudge, autoStart e setSpeed chegam iguais às três janelas', async () => {
    const s = await setupStudio();
    const w1 = await s.open(keyOf(B()));
    const w2 = await s.open(keyOf(C()));
    await s.confirm();
    const startCount = s.bus.control.messages.filter((m) => m.channel === 'motion:segment').length;
    const startOut = received(w1).segments.length;

    s.bus.send('cmd:scroll', { type: 'lineStep', dir: 1 });
    s.t.clock.advance(500);
    s.bus.send('cmd:scroll', { type: 'nudge', dy: 230 });
    s.t.clock.advance(500);
    s.bus.send('cmd:scroll', { type: 'autoStart' });
    s.t.clock.advance(2000);
    s.bus.send('cmd:scroll', { type: 'setSpeed', speed: 1.5 });
    s.t.clock.advance(2000);

    const preview = s.bus.control.messages.filter((m) => m.channel === 'motion:segment').map((m) => m.payload as MotionSegment).slice(startCount);
    const out1 = received(w1).segments.slice(startOut);
    const out2 = received(w2).segments.slice(startOut);
    expect(preview.length).toBeGreaterThanOrEqual(4);
    expect(out1).toEqual(preview);
    expect(out2).toEqual(preview);
    // Mesmo layout (mesma revisão) nas três.
    const rev = s.bus.control.layout!.revision;
    expect(received(w1).layouts.at(-1)!.revision).toBe(rev);
    expect(received(w2).layouts.at(-1)!.revision).toBe(rev);
    expect(received(w1).layouts.at(-1)!.lines).toEqual(s.bus.control.layout!.lines);
    // Em 20 instantes, as posições diferem menos de 0,5 px.
    const segP = s.bus.control.segment!;
    const seg1 = out1.at(-1)!;
    const seg2 = out2.at(-1)!;
    for (let i = 0; i < 20; i++) {
      const now = s.t.clock.now + i * 137;
      const p = positionAt(segP, now);
      expect(Math.abs(positionAt(seg1, now) - p)).toBeLessThan(0.5);
      expect(Math.abs(positionAt(seg2, now) - p)).toBeLessThan(0.5);
    }
    // A saída e a prévia aparecem no estado publicado.
    expect(s.bus.control.snapshot!.outputs.map((o) => o.id)).toEqual([1, 2]);
  });
});

describe('IT-018 monitor removido e devolvido durante a rolagem automática', () => {
  it('a remoção de B não mexe nos trechos das outras; B volta com o layout e o trecho em curso', async () => {
    const s = await setupStudio();
    await s.open(keyOf(B()));
    const w2 = await s.open(keyOf(C()));
    await s.confirm();
    s.bus.send('cmd:scroll', { type: 'autoStart' });
    s.t.clock.advance(3000);
    const before = received(w2).segments.length;
    const previewBefore = s.bus.control.segment;

    s.t.platform.removeDisplay(2);
    expect(received(w2).segments.length).toBe(before);
    expect(s.bus.control.segment).toBe(previewBefore);
    expect(s.bus.control.snapshot!.notices.map((n) => n.message)).toContain('Saída 1 caiu (B)');

    s.t.clock.advance(2000);
    s.t.platform.addDisplay(B());
    s.t.clock.advance(DISPLAY_STABLE_MS);
    const back = s.win(1);
    expect(back.isDestroyed()).toBe(false);
    back.emitWeb('did-finish-load');
    const r = received(back);
    expect(r.order.slice(0, 2)).toEqual(['layout', 'segment']);
    expect(r.layouts[0].revision).toBe(s.bus.control.layout!.revision);
    expect(r.segments[0]).toEqual(s.t.store.engine.segment);
    expect(r.segments[0].kind).toBe('cruise');
    expect(s.bus.control.snapshot!.notices.map((n) => n.message)).not.toContain('Saída 1 caiu (B)');
    expect(received(w2).segments.length).toBe(before);
  });
});

describe('IT-019 tecla vinda de uma saída move o texto', () => {
  it('PageDown na webContents da saída chega ao KeymapService e anda uma linha', async () => {
    const s = await setupStudio();
    const w1 = await s.open(keyOf(B()));
    await s.confirm();
    const lines = s.bus.control.layout!.lines;
    expect(w1.key({ key: 'PageDown' })).toBe(true);
    s.t.clock.advance(1000);
    expect(positionAt(s.t.store.engine.segment, s.t.clock.now)).toBeCloseTo(lines[1].y, 6);
    expect(positionAt(received(w1).segments.at(-1)!, s.t.clock.now)).toBeCloseTo(lines[1].y, 6);
  });
});

describe('IT-020 bloqueio de energia com duas saídas', () => {
  it('abrir e fechar duas saídas registra um start e um stop', async () => {
    const s = await setupStudio();
    await s.open(keyOf(B()));
    await s.open(keyOf(C()));
    await s.bus.invoke('cmd:output', { op: 'close', id: 1 });
    await s.bus.invoke('cmd:output', { op: 'close', id: 2 });
    expect(s.starts).toEqual(['prevent-display-sleep']);
    expect(s.stops).toHaveLength(1);
    expect(s.manager.power.active).toBe(false);
  });
});

describe('IT-026 rolagem sem saídas e fechar todas rolando', () => {
  it('sem saída, autoStart rola a prévia; fechar todas durante o cruise mantém o trecho da prévia', async () => {
    const s = await setupStudio();
    await s.confirm();
    s.bus.send('cmd:scroll', { type: 'autoStart' });
    const seg = s.bus.control.segment!;
    expect(seg.kind).toBe('cruise');
    const p0 = positionAt(seg, s.t.clock.now);
    s.t.clock.advance(2000);
    expect(positionAt(s.bus.control.segment!, s.t.clock.now)).toBeGreaterThan(p0);

    await s.open(keyOf(B()));
    await s.open(keyOf(C()));
    const during = s.bus.control.segment;
    const count = s.bus.control.messages.length;
    await s.bus.invoke('cmd:output', { op: 'close', id: 1 });
    await s.bus.invoke('cmd:output', { op: 'close', id: 2 });
    expect(s.bus.control.segment).toBe(during);
    expect(s.bus.control.messages.slice(count).some((m) => m.channel === 'motion:segment')).toBe(false);
    expect(s.t.store.engine.automation).toBe('auto');
    const at = s.t.clock.now;
    s.t.clock.advance(1000);
    expect(positionAt(s.bus.control.segment!, s.t.clock.now)).toBeGreaterThan(positionAt(s.bus.control.segment!, at));
  });
});
