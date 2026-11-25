import { describe, expect, it } from 'vitest';
import { DISPLAY_STABLE_MS } from '@shared/defaults';
import { displayKey, matchDisplay } from '../../src/main/displays';
import { fakeDisplay } from '../fakes/platform';
import { A, B, C, createTestStudio, keyOf, lastView } from '../fakes/studio';

const saved = (key: string, patch: Partial<{ mirrorH: boolean; flipV: boolean; voiceSignal: boolean }> = {}) => {
  const [, label, size] = key.split('|');
  return { displayKey: key, label, size: size.replace('x', ' x '), mirrorH: false, flipV: false, voiceSignal: true, ...patch };
};

describe('DisplayRegistry e OutputManager: lista e abrir', () => {
  it('UT-114 a lista mostra B e C como livres e A como monitor do controle', () => {
    const s = createTestStudio();
    const list = s.manager.displays();
    expect(list.map((d) => `${d.label}, ${d.size}`)).toEqual(['A, 1920 x 1080', 'B, 1920 x 1080', 'C, 1280 x 1024']);
    expect(list.find((d) => d.label === 'A')?.hasControl).toBe(true);
    const free = list.filter((d) => !d.hasControl && d.outputId === null).map((d) => `${d.label}, ${d.size}`);
    expect(free).toEqual(['B, 1920 x 1080', 'C, 1280 x 1024']);
    expect(list[1].displayKey).toBe('2|B|1920x1080');
  });

  it('UT-115 open B cria a janela nos bounds de B, aberta, id 1 e showBadge', () => {
    const s = createTestStudio();
    const r = s.manager.open(keyOf(B()));
    expect(r).toEqual({ ok: true, value: expect.objectContaining({ id: 1, state: 'open', label: 'B', size: '1920 x 1080' }) });
    const [win] = s.windowsOf(1);
    expect(win.getBounds()).toEqual(B().bounds);
    expect(win.options.frame).toBe(false);
    expect(win.options.fullscreen).toBe(true);
    expect((win.options.webPreferences as Record<string, unknown>).backgroundThrottling).toBe(false);
    expect(win.options.backgroundColor).toBe('#000000');
    win.emitWeb('did-finish-load');
    expect(lastView(win)).toMatchObject({ id: 1, showBadge: true, mirrorH: false, flipV: false, voiceSignal: true });
    expect(s.logs.find((l) => l.event === 'output.open')?.fields).toEqual({ id: 1, displayKey: '2|B|1920x1080', label: 'B' });
  });

  it('Mac: a saída usa simpleFullScreen, sem tela cheia em Espaço novo', () => {
    const s = createTestStudio({ isMac: true });
    s.manager.open(keyOf(B()));
    const [win] = s.windowsOf(1);
    expect(win.options.simpleFullscreen).toBe(true);
    expect(win.options.fullscreen).toBe(false);
  });

  it('UT-116 open A devolve control-display', () => {
    const s = createTestStudio();
    expect(s.manager.open(keyOf(A()))).toEqual({ ok: false, error: 'control-display' });
    expect(s.liveOutputWindows()).toHaveLength(0);
  });

  it('UT-117 open B com B ocupado devolve display-busy', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    expect(s.manager.open(keyOf(B()))).toEqual({ ok: false, error: 'display-busy' });
    expect(s.liveOutputWindows()).toHaveLength(1);
  });

  it('UT-118 com as saídas 1 e 2 abertas, fechar a 1 e abrir outra dá id 1', () => {
    const s = createTestStudio({ displays: [A(), B(), C(), fakeDisplay(4, 'D', 5120)] });
    s.manager.open(keyOf(B()));
    s.manager.open(keyOf(C()));
    s.manager.close(1);
    const r = s.manager.open('4|D|1920x1080');
    expect(r.ok && r.value.id).toBe(1);
    expect(s.manager.outputs().map((o) => o.id)).toEqual([1, 2]);
  });

  it('UT-119 só com o monitor A, não há monitor livre', () => {
    const s = createTestStudio({ displays: [A()] });
    const free = s.manager.displays().filter((d) => !d.hasControl && d.outputId === null);
    expect(free).toEqual([]);
  });

  it('UT-120 display-added de D faz D aparecer como livre, sem reiniciar', () => {
    let changes = 0;
    const s = createTestStudio({ manager: { onChange: () => void changes++ } });
    s.platform.addDisplay(fakeDisplay(4, 'D', 5120));
    const d = s.manager.displays().find((x) => x.label === 'D');
    expect(d).toMatchObject({ hasControl: false, outputId: null, size: '1920 x 1080' });
    expect(changes).toBeGreaterThan(0);
    expect(s.liveOutputWindows()).toHaveLength(0);
  });

  it('UT-255 open com displayKey fora da lista devolve display-missing e não cria janela', () => {
    const s = createTestStudio();
    expect(s.manager.command({ op: 'open', displayKey: 'X|Sumido|1920x1080' })).toEqual({ ok: false, error: 'display-missing' });
    expect(s.liveOutputWindows()).toHaveLength(0);
  });
});

describe('OutputManager: inversões por saída guardadas por monitor (ADR-010)', () => {
  it('UT-121 set mirrorH muda só a saída 1, grava para a displayKey de B e não emite trecho', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    s.manager.open(keyOf(C()));
    s.loadAll();
    const [w1] = s.windowsOf(1);
    const [w2] = s.windowsOf(2);
    const before2 = w2.sent.length;
    const before1Segments = w1.sent.filter((m) => m.channel === 'motion:segment').length;
    const r = s.manager.command({ op: 'set', id: 1, mirrorH: true });
    expect(r.ok && r.value.mirrorH).toBe(true);
    expect(lastView(w1)).toMatchObject({ mirrorH: true, flipV: false, showBadge: false });
    expect(w2.sent.length).toBe(before2);
    expect(w1.sent.filter((m) => m.channel === 'motion:segment').length).toBe(before1Segments);
    expect(s.settings.settings.outputs.find((o) => o.displayKey === '2|B|1920x1080')).toMatchObject({ mirrorH: true, flipV: false });
    expect(s.settings.settings.outputs.find((o) => o.displayKey === keyOf(C()))).toMatchObject({ mirrorH: false });
  });

  it('UT-122 saída nova em B com mirrorH guardado abre espelhada; em C, sem nada guardado, sem inversões', () => {
    const s = createTestStudio({ saved: [saved(keyOf(B()), { mirrorH: true })] });
    const b = s.manager.open(keyOf(B()));
    const c = s.manager.open(keyOf(C()));
    expect(b.ok && b.value).toMatchObject({ mirrorH: true, flipV: false });
    expect(c.ok && c.value).toMatchObject({ mirrorH: false, flipV: false, voiceSignal: true });
  });

  it('UT-123 set flipV não altera mirrorH', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    s.manager.set(1, { mirrorH: true });
    const r = s.manager.set(1, { flipV: true });
    expect(r.ok && r.value).toMatchObject({ mirrorH: true, flipV: true });
    expect(s.settings.settings.outputs[0]).toMatchObject({ mirrorH: true, flipV: true });
  });
});

describe('OutputManager: queda e volta de monitores (US-018)', () => {
  it('UT-124 display-removed de B fecha a janela 1, deixa a saída 1 down, mantém a 2 e avisa', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    s.manager.open(keyOf(C()));
    s.platform.removeDisplay(2);
    const [o1, o2] = s.manager.outputs();
    expect(o1.state).toBe('down');
    expect(o2.state).toBe('open');
    expect(s.windowsOf(1)[0].isDestroyed()).toBe(true);
    expect(s.windowsOf(2)[0].isDestroyed()).toBe(false);
    expect(s.notices.map((n) => n.message)).toEqual(['Saída 1 caiu (B)']);
    expect(s.logs.find((l) => l.event === 'output.down')?.fields).toEqual({ id: 1, displayKey: '2|B|1920x1080', label: 'B' });
  });

  it('UT-125 display-added de B reabre a saída 1 depois de 1 s, com as inversões e sem número', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    s.manager.set(1, { mirrorH: true, flipV: true });
    s.platform.removeDisplay(2);
    s.platform.addDisplay(B());
    expect(s.manager.outputs()[0].state).toBe('down');
    s.clock.advance(DISPLAY_STABLE_MS - 1);
    expect(s.windowsOf(1)).toHaveLength(1);
    s.clock.advance(1);
    expect(s.manager.outputs()[0].state).toBe('open');
    const reopened = s.windowsOf(1)[1];
    expect(reopened.getBounds()).toEqual(B().bounds);
    reopened.emitWeb('did-finish-load');
    expect(lastView(reopened)).toMatchObject({ mirrorH: true, flipV: true, showBadge: false });
    expect(s.notices).toEqual([]);
    expect(s.logs.some((l) => l.event === 'output.reopen')).toBe(true);
  });

  it('UT-126 cinco ciclos de remoção e volta de B em 3 s terminam com uma janela da saída 1', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    for (let i = 0; i < 5; i++) {
      s.platform.removeDisplay(2);
      s.clock.advance(300);
      s.platform.addDisplay(B());
      s.clock.advance(300);
    }
    s.clock.advance(DISPLAY_STABLE_MS);
    expect(s.windowsOf(1).filter((w) => !w.isDestroyed())).toHaveLength(1);
    expect(s.liveOutputWindows()).toHaveLength(1);
    expect(s.manager.outputs()).toHaveLength(1);
    expect(s.manager.outputs()[0].state).toBe('open');
  });

  it('UT-127 monitor com o mesmo id de B e label "Outro" não reabre a saída 1 e aparece livre', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    s.platform.removeDisplay(2);
    s.platform.addDisplay(fakeDisplay(2, 'Outro', 1920));
    s.clock.advance(DISPLAY_STABLE_MS * 3);
    expect(s.manager.outputs()[0].state).toBe('down');
    expect(s.liveOutputWindows()).toHaveLength(0);
    expect(s.manager.displays().find((d) => d.label === 'Outro')).toMatchObject({ outputId: null, hasControl: false });
  });

  it('UT-128 B voltando com id novo, mesmo label e mesmo tamanho reabre a saída 1', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    s.platform.removeDisplay(2);
    s.platform.addDisplay(fakeDisplay(7, 'B', 1920));
    s.clock.advance(DISPLAY_STABLE_MS);
    expect(s.manager.outputs()[0]).toMatchObject({ state: 'open', displayKey: '7|B|1920x1080' });
    expect(s.settings.settings.outputs.map((o) => o.displayKey)).toEqual(['7|B|1920x1080']);
  });
});

describe('OutputManager: fechar e reabrir ao iniciar (US-019, US-020)', () => {
  it('UT-129 close 1 destrói a janela, estado closed, esquece B e mantém o trecho das outras', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    s.manager.open(keyOf(C()));
    s.loadAll();
    s.manager.setSegment({ kind: 'cruise', y0: 0, t0: 0, pxPerSec: 50, yEnd: 900 });
    const w2 = s.windowsOf(2)[0];
    const before = w2.sent.length;
    const r = s.manager.close(1);
    expect(r.ok && r.value.state).toBe('closed');
    expect(s.windowsOf(1)[0].isDestroyed()).toBe(true);
    expect(s.manager.outputs().map((o) => o.id)).toEqual([2]);
    expect(s.settings.settings.outputs.map((o) => o.displayKey)).toEqual([keyOf(C())]);
    expect(w2.sent.length).toBe(before);
    expect(w2.sent.filter((m) => m.channel === 'motion:segment').at(-1)?.args[0]).toMatchObject({ kind: 'cruise' });
  });

  it('UT-130 ao abrir, com B e C guardados e ligados, reabre duas saídas sem número', () => {
    const s = createTestStudio({ saved: [saved(keyOf(B()), { mirrorH: true }), saved(keyOf(C()), { flipV: true })] });
    s.manager.restore();
    expect(s.manager.outputs()).toEqual([
      expect.objectContaining({ id: 1, state: 'open', label: 'B', mirrorH: true }),
      expect.objectContaining({ id: 2, state: 'open', label: 'C', flipV: true }),
    ]);
    s.loadAll();
    expect(lastView(s.windowsOf(1)[0])).toMatchObject({ showBadge: false, mirrorH: true });
    expect(lastView(s.windowsOf(2)[0])).toMatchObject({ showBadge: false, flipV: true });
  });

  it('UT-131 ao abrir, com C guardado e desligado, a saída fica down sem aviso', () => {
    const s = createTestStudio({ displays: [A(), B()], saved: [saved(keyOf(C()))] });
    s.manager.restore();
    expect(s.manager.outputs()).toEqual([expect.objectContaining({ id: 1, state: 'down', label: 'C' })]);
    expect(s.notices).toEqual([]);
    expect(s.liveOutputWindows()).toHaveLength(0);
    // E reabre quando o monitor aparece.
    s.platform.addDisplay(C());
    s.clock.advance(DISPLAY_STABLE_MS);
    expect(s.manager.outputs()[0].state).toBe('open');
  });

  it('UT-132 ao abrir, com a displayKey guardada igual à do controle, não abre saída', () => {
    const s = createTestStudio({ saved: [saved(keyOf(A()))] });
    s.manager.restore();
    expect(s.manager.outputs()).toEqual([]);
    expect(s.liveOutputWindows()).toHaveLength(0);
  });

  it('UT-133 sem saídas guardadas, nenhuma janela abre', () => {
    const s = createTestStudio();
    s.manager.restore();
    expect(s.liveOutputWindows()).toHaveLength(0);
    expect(s.manager.outputs()).toEqual([]);
  });
});

describe('OutputManager: tela cheia, Esc, janela de controle e sinal', () => {
  it('UT-134 leave-full-screen ou move para outros bounds devolve a janela a B em tela cheia', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    const win = s.windowsOf(1)[0];
    win.setFullScreen(false);
    win.emit('leave-full-screen');
    expect(win.isFullScreen()).toBe(true);
    win.setBounds({ x: 100, y: 50, width: 800, height: 600 });
    win.emit('move');
    expect(win.getBounds()).toEqual(B().bounds);
    expect(win.isFullScreen()).toBe(true);
  });

  it('UT-135 Esc numa saída é anulado e a janela continua em tela cheia', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    const win = s.windowsOf(1)[0];
    expect(win.key({ key: 'Escape' })).toBe(true);
    expect(win.isFullScreen()).toBe(true);
    expect(win.isDestroyed()).toBe(false);
    // Nem o fechamento do sistema (Alt+F4) a fecha.
    win.close();
    expect(win.isDestroyed()).toBe(false);
  });

  it('UT-136 display-removed de A com C livre move a janela de controle para C', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    s.platform.removeDisplay(1);
    const b = s.control.getBounds();
    const c = C().bounds;
    expect(b.x).toBeGreaterThanOrEqual(c.x);
    expect(b.x + b.width).toBeLessThanOrEqual(c.x + c.width);
    expect(s.manager.outputs()[0].state).toBe('open');
  });

  it('UT-137 display-removed de A com B e C ocupados mantém as saídas; fechar a 2 leva o controle a C', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    s.manager.open(keyOf(C()));
    const before = s.control.getBounds();
    s.platform.removeDisplay(1);
    expect(s.manager.outputs().map((o) => o.state)).toEqual(['open', 'open']);
    expect(s.control.getBounds()).toEqual(before);
    s.manager.close(2);
    const b = s.control.getBounds();
    expect(b.x).toBeGreaterThanOrEqual(C().bounds.x);
    expect(s.manager.outputs().map((o) => o.state)).toEqual(['open']);
  });

  it('UT-138 set voiceSignal false vai só à saída 2', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    s.manager.open(keyOf(C()));
    s.loadAll();
    const w1 = s.windowsOf(1)[0];
    const before1 = w1.sent.length;
    s.manager.set(2, { voiceSignal: false });
    expect(lastView(s.windowsOf(2)[0])).toMatchObject({ voiceSignal: false });
    expect(w1.sent.length).toBe(before1);
    expect(lastView(w1)).toMatchObject({ voiceSignal: true });
  });

  it('o estado da voz chega a todas as saídas abertas', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    s.loadAll();
    s.manager.setVoiceState('listening');
    expect(lastView(s.windowsOf(1)[0])).toMatchObject({ voiceState: 'listening', showBadge: false });
  });
});

describe('PowerGuard e casamento de monitores', () => {
  it('UT-139 a primeira saída liga o bloqueio uma vez; a segunda não liga de novo', () => {
    const s = createTestStudio();
    const starts: string[] = [];
    const start = s.platform.powerSaveBlocker.start;
    s.platform.powerSaveBlocker.start = (type) => {
      starts.push(type);
      return start(type);
    };
    s.manager.open(keyOf(B()));
    s.manager.open(keyOf(C()));
    expect(starts).toEqual(['prevent-display-sleep']);
    expect(s.platform.blockers.size).toBe(1);
    expect(s.manager.power.active).toBe(true);
  });

  it('UT-140 fechar ou derrubar a última saída aberta desliga o bloqueio', () => {
    const s = createTestStudio();
    s.manager.open(keyOf(B()));
    s.manager.open(keyOf(C()));
    s.manager.close(2);
    expect(s.platform.blockers.size).toBe(1);
    s.platform.removeDisplay(2);
    expect(s.platform.blockers.size).toBe(0);
    expect(s.manager.power.active).toBe(false);
    // E volta a ligar quando a saída reabre.
    s.platform.addDisplay(B());
    s.clock.advance(DISPLAY_STABLE_MS);
    expect(s.platform.blockers.size).toBe(1);
  });

  it.each([
    ['mesmo id e label', '2|B|1920x1080', fakeDisplay(2, 'B', 0), true],
    ['id novo com mesmo label e tamanho', '2|B|1920x1080', fakeDisplay(9, 'B', 0), true],
    ['mesmo id com label diferente', '2|B|1920x1080', fakeDisplay(2, 'Outro', 0), false],
    ['mesmo label com tamanho diferente', '2|B|1920x1080', fakeDisplay(9, 'B', 0, 1280, 1024), false],
  ])('UT-141 matchDisplay: %s', (_name, key, display, expected) => {
    expect(matchDisplay(key, display)).toBe(expected);
  });

  it('displayKey usa id|label|largura x altura', () => {
    expect(displayKey(C())).toBe('3|C|1280x1024');
  });
});
