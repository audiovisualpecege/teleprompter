import { describe, expect, it } from 'vitest';
import { positionAt, type MotionSegment } from '@shared/motion';
import { createScrollEngine, formatSpeed, type ScrollEngine } from '../../src/main/scroll-engine';
import { createFakeScheduler, type FakeScheduler } from '../fakes/scheduler';
import { gridLayout, layoutOf, referenceLayout } from '../fakes/layouts';

interface Rig {
  engine: ScrollEngine;
  clock: FakeScheduler;
  segs: MotionSegment[];
  ended: number[];
}

/** Motor com o layout de referência, parado em `y` no instante `t` (sem comando manual recente). */
function rig(y = 0, t = 0, speed = 1): Rig {
  const clock = createFakeScheduler(0);
  const engine = createScrollEngine({ scheduler: clock, speed });
  engine.load(referenceLayout(), 0);
  if (y !== 0) {
    engine.apply({ type: 'nudge', dy: y }, 0);
    clock.advanceTo(200);
  }
  clock.advanceTo(t);
  const segs: MotionSegment[] = [];
  const ended: number[] = [];
  engine.onSegment((s) => segs.push(s));
  engine.onAutoEnded(() => ended.push(clock.now));
  return { engine, clock, segs, ended };
}

const at = (r: Rig, t: number): number => positionAt(r.engine.segment, t);

describe('ScrollEngine: comandos manuais e limites', () => {
  it('UT-034 lineStep +1 em y=0 desliza de 0 a 100 em 150 ms', () => {
    const r = rig();
    expect(r.engine.apply({ type: 'lineStep', dir: 1 }, 1000)).toBe('ok');
    expect(r.segs).toEqual([{ kind: 'glide', y0: 0, y1: 100, t0: 1000, durMs: 150 }]);
  });

  it('UT-035 lineStep -1 em y=0 não emite trecho e fica em 0', () => {
    const r = rig();
    expect(r.engine.apply({ type: 'lineStep', dir: -1 }, 1000)).toBe('ignored');
    expect(r.segs).toEqual([]);
    expect(at(r, 1000)).toBe(0);
  });

  it('UT-036 lineStep +1 em y=900 não emite trecho', () => {
    const r = rig(900, 1000);
    expect(at(r, 1000)).toBe(900);
    r.engine.apply({ type: 'lineStep', dir: 1 }, 1000);
    expect(r.segs).toEqual([]);
  });

  it('UT-037 cinco lineStep +1 no mesmo instante terminam com alvo 500', () => {
    const r = rig();
    for (let i = 0; i < 5; i++) r.engine.apply({ type: 'lineStep', dir: 1 }, 1000);
    const last = r.segs.at(-1)!;
    expect(last.kind).toBe('glide');
    expect(last.kind === 'glide' && last.y1).toBe(500);
    expect(at(r, 2000)).toBe(500);
  });

  it('UT-038 holdStart +1 em y=200 vira cruise de 400 px/s; holdEnd 500 ms depois para em 400', () => {
    const r = rig(200, 1000);
    r.engine.apply({ type: 'holdStart', dir: 1 }, 1000);
    expect(r.segs).toEqual([{ kind: 'cruise', y0: 200, t0: 1000, pxPerSec: 400, yEnd: 900 }]);
    r.engine.apply({ type: 'holdEnd' }, 1500);
    expect(r.segs.at(-1)).toEqual({ kind: 'hold', y: 400 });
  });

  it('UT-039 nudge de 37 em y=0 desliza até 37 em 120 ms e nada mais é emitido', () => {
    const r = rig();
    r.engine.apply({ type: 'nudge', dy: 37 }, 1000);
    expect(r.segs).toEqual([{ kind: 'glide', y0: 0, y1: 37, t0: 1000, durMs: 120 }]);
    r.clock.advanceTo(5000);
    expect(r.segs).toHaveLength(1);
    expect(at(r, 5000)).toBe(37);
  });

  it('UT-040 nudge de 5000 em y=850 vai até 900', () => {
    const r = rig(850, 1000);
    r.engine.apply({ type: 'nudge', dy: 5000 }, 1000);
    expect(r.segs.at(-1)).toMatchObject({ kind: 'glide', y0: 850, y1: 900 });
  });

  it('UT-041 nudge de -1000 em y=37 vai até 0', () => {
    const r = rig(37, 1000);
    r.engine.apply({ type: 'nudge', dy: -1000 }, 1000);
    expect(r.segs.at(-1)).toMatchObject({ kind: 'glide', y0: 37, y1: 0 });
  });

  it('UT-042 toStart com cruise em curso emite hold em 0, dispara onAutoEnded e deixa a automação em none', () => {
    const r = rig();
    r.engine.apply({ type: 'autoStart' }, 1000);
    r.clock.advanceTo(3000);
    r.engine.apply({ type: 'toStart' }, 3000);
    expect(r.segs.at(-1)).toEqual({ kind: 'hold', y: 0 });
    expect(r.ended).toEqual([3000]);
    expect(r.engine.automation).toBe('none');
    r.clock.advanceTo(100_000);
    expect(r.ended).toHaveLength(1);
  });

  it('UT-043 toStart em y=0 duas vezes não emite trecho nem evento', () => {
    const r = rig();
    r.engine.apply({ type: 'toStart' }, 1000);
    r.engine.apply({ type: 'toStart' }, 1001);
    expect(r.segs).toEqual([]);
    expect(r.ended).toEqual([]);
  });
});

describe('ScrollEngine: rolagem automática e velocidade', () => {
  it('UT-044 autoStart a 1,00x emite cruise de 1 x 140/60 x 1000/60 px/s', () => {
    const r = rig();
    r.engine.apply({ type: 'autoStart' }, 1000);
    const seg = r.segs[0];
    expect(seg.kind).toBe('cruise');
    if (seg.kind !== 'cruise') return;
    expect(seg.pxPerSec).toBeCloseTo((140 / 60) * (1000 / 60), 6);
    expect(seg.pxPerSec).toBeCloseTo(38.89, 2);
    expect(seg).toMatchObject({ y0: 0, t0: 1000, yEnd: 900 });
  });

  it('UT-045 autoPause emite hold na posição do cruise naquele instante', () => {
    const r = rig();
    r.engine.apply({ type: 'autoStart' }, 1000);
    const cruise = r.segs[0];
    r.engine.apply({ type: 'autoPause' }, 4000);
    expect(r.segs.at(-1)).toEqual({ kind: 'hold', y: positionAt(cruise, 4000) });
    expect(r.engine.automation).toBe('none');
  });

  it('UT-046 autoStart sem texto confirmado não emite trecho e devolve no-text', () => {
    const clock = createFakeScheduler();
    const engine = createScrollEngine({ scheduler: clock });
    const segs: MotionSegment[] = [];
    engine.onSegment((s) => segs.push(s));
    expect(engine.apply({ type: 'autoStart' }, 0)).toBe('no-text');
    engine.load(gridLayout(0, 100, 0, 0), 0);
    segs.length = 0;
    expect(engine.apply({ type: 'autoStart' }, 10)).toBe('no-text');
    expect(segs).toEqual([]);
    expect(engine.automation).toBe('none');
  });

  it('UT-047 setSpeed 2 durante cruise reemite cruise a partir da posição daquele instante', () => {
    const r = rig();
    r.engine.apply({ type: 'autoStart' }, 0);
    const first = r.segs[0];
    r.clock.advanceTo(5000);
    r.engine.apply({ type: 'setSpeed', speed: 2 }, 5000);
    const next = r.segs.at(-1)!;
    expect(next.kind).toBe('cruise');
    if (next.kind !== 'cruise' || first.kind !== 'cruise') return;
    expect(next.y0).toBeCloseTo(positionAt(first, 5000), 9);
    expect(next.t0).toBe(5000);
    expect(next.pxPerSec).toBeCloseTo(first.pxPerSec * 2, 9);
  });

  it.each([
    [3.25, 3],
    [0, 0.25],
    [1.3, 1.25],
    [7, 3],
    [-1, 0.25],
    [1.875, 2],
  ])('UT-048 setSpeed %s fica %s', (asked, expected) => {
    const r = rig();
    r.engine.apply({ type: 'setSpeed', speed: asked }, 0);
    expect(r.engine.speed).toBe(expected);
  });

  it('UT-049 setSpeed 1,5 parado não emite trecho, e o próximo autoStart usa 1,5', () => {
    const r = rig();
    r.engine.apply({ type: 'setSpeed', speed: 1.5 }, 0);
    expect(r.segs).toEqual([]);
    r.engine.apply({ type: 'autoStart' }, 100);
    const seg = r.segs[0];
    expect(seg.kind === 'cruise' && seg.pxPerSec).toBeCloseTo(1.5 * (140 / 60) * (1000 / 60), 9);
  });

  it('UT-050 cruise que chega a 900 dispara onAutoEnded no instante calculado e para em 900', () => {
    const r = rig();
    r.engine.apply({ type: 'autoStart' }, 1000);
    const seg = r.segs[0];
    if (seg.kind !== 'cruise') throw new Error('esperava cruise');
    const endAt = 1000 + (900 / seg.pxPerSec) * 1000;
    r.clock.advanceTo(endAt - 1);
    expect(r.ended).toEqual([]);
    r.clock.advanceTo(endAt + 1);
    expect(r.ended).toEqual([endAt]);
    expect(r.segs.at(-1)).toEqual({ kind: 'hold', y: 900 });
    expect(r.engine.automation).toBe('none');
  });

  it.each([
    [7, 'auto'],
    [8, 'none'],
  ])('UT-051 %s alternâncias de autoStart e autoPause terminam em %s', (n, expected) => {
    const r = rig();
    for (let i = 0; i < n; i++) r.engine.apply({ type: i % 2 === 0 ? 'autoStart' : 'autoPause' }, 1000 + i * 10);
    expect(r.engine.automation).toBe(expected);
    expect(r.engine.segment.kind).toBe(expected === 'auto' ? 'cruise' : 'hold');
  });

  it('UT-052 lineStep +1 durante cruise desliza uma linha e volta ao cruise a partir da nova posição', () => {
    const r = rig();
    r.engine.apply({ type: 'autoStart' }, 0);
    r.clock.advanceTo(2000); // ~77,8 px
    r.engine.apply({ type: 'lineStep', dir: 1 }, 2000);
    const glide = r.segs.at(-1)!;
    expect(glide).toMatchObject({ kind: 'glide', y1: 100, t0: 2000, durMs: 150 });
    r.clock.advanceTo(2150);
    expect(r.segs.at(-1)).toMatchObject({ kind: 'cruise', y0: 100, t0: 2150, yEnd: 900 });
    expect(r.engine.automation).toBe('auto');
  });
});

describe('ScrollEngine: alvo de voz', () => {
  it('UT-053 voiceTarget 300 em y=100 desliza até 300 em 250 a 900 ms', () => {
    const r = rig(100, 5000);
    r.engine.apply({ type: 'voiceTarget', y: 300 }, 5000);
    const seg = r.segs.at(-1)!;
    expect(seg).toMatchObject({ kind: 'glide', y0: 100, y1: 300, t0: 5000 });
    if (seg.kind !== 'glide') return;
    expect(seg.durMs).toBeGreaterThanOrEqual(250);
    expect(seg.durMs).toBeLessThanOrEqual(900);
  });

  it('UT-054 voiceTarget 50 em y=100 é ignorado (nunca para trás)', () => {
    const r = rig(100, 5000);
    expect(r.engine.apply({ type: 'voiceTarget', y: 50 }, 5000)).toBe('ignored');
    expect(r.segs).toEqual([]);
  });

  it('UT-055 voiceTarget 200 ms depois de lineStep é ignorado; 400 ms depois, aplicado', () => {
    const r = rig(0, 5000);
    r.engine.apply({ type: 'lineStep', dir: 1 }, 5000);
    expect(r.engine.apply({ type: 'voiceTarget', y: 500 }, 5200)).toBe('ignored');
    expect(r.segs).toHaveLength(1);
    expect(r.engine.apply({ type: 'voiceTarget', y: 500 }, 5400)).toBe('ok');
    expect(r.segs.at(-1)).toMatchObject({ kind: 'glide', y1: 500, t0: 5400 });
  });
});

describe('ScrollEngine: âncora e troca de texto', () => {
  it('UT-056 relayout leva a âncora (caractere 520, fraction 0,5) ao início da nova linha mais 25', () => {
    const clock = createFakeScheduler();
    const engine = createScrollEngine({ scheduler: clock });
    // Linhas de 100 px e 100 caracteres, exceto a linha 5 (500..540).
    const old = gridLayout(10, 100, 100, 60);
    old.lines[5] = { ...old.lines[5], start: 500, end: 540 };
    old.lines[6] = { ...old.lines[6], start: 540 };
    engine.load(old, 0);
    engine.apply({ type: 'nudge', dy: 550 }, 0);
    clock.advanceTo(1000);
    expect(engine.anchorAt(1000)).toEqual({ charOffset: 520, fraction: 0.5 });
    const next = gridLayout(30, 50, 40, 60); // linhas de 50 px; o caractere 520 fica na linha 13
    engine.relayout(next, 1000);
    expect(engine.segment).toEqual({ kind: 'hold', y: 13 * 50 + 25 });
  });

  it('UT-057 replaceText com edição só depois da âncora mantém o charOffset', () => {
    const text = Array.from({ length: 10 }, (_, i) => `linha${i} aaaa bbbb`).join('\n');
    const clock = createFakeScheduler();
    const engine = createScrollEngine({ scheduler: clock });
    engine.load(layoutOf(text), 0);
    engine.apply({ type: 'nudge', dy: 300 }, 0);
    clock.advanceTo(1000);
    const before = engine.anchorAt(1000);
    const edited = `${text}\nlinha nova no fim`;
    engine.replaceText(text, edited, layoutOf(edited), 1000);
    expect(engine.anchorAt(1000).charOffset).toBe(before.charOffset);
  });

  it('UT-058 replaceText com 20 caracteres inseridos antes da âncora desloca o charOffset em +20', () => {
    const text = Array.from({ length: 10 }, (_, i) => `linha${i} aaaa bbbb`).join('\n');
    const clock = createFakeScheduler();
    const engine = createScrollEngine({ scheduler: clock });
    engine.load(layoutOf(text), 0);
    engine.apply({ type: 'nudge', dy: 500 }, 0);
    clock.advanceTo(1000);
    const before = engine.anchorAt(1000);
    const inserted = 'vinte caracteres!!!\n';
    expect(inserted).toHaveLength(20);
    const edited = inserted + text;
    engine.replaceText(text, edited, layoutOf(edited), 1000);
    expect(engine.anchorAt(1000).charOffset).toBe(before.charOffset + 20);
  });

  it('UT-059 replaceText com a âncora num trecho apagado leva a âncora ao início do trecho alterado', () => {
    const text = Array.from({ length: 10 }, (_, i) => `linha${i} aaaa bbbb`).join('\n');
    const clock = createFakeScheduler();
    const engine = createScrollEngine({ scheduler: clock });
    const old = layoutOf(text);
    engine.load(old, 0);
    engine.apply({ type: 'nudge', dy: old.lines[5].y }, 0);
    clock.advanceTo(1000);
    const anchor = engine.anchorAt(1000);
    // Apaga as linhas 4 a 6 inteiras.
    const cutStart = old.lines[4].start;
    const cutEnd = old.lines[7].start;
    expect(anchor.charOffset).toBeGreaterThanOrEqual(cutStart);
    expect(anchor.charOffset).toBeLessThan(cutEnd);
    const edited = text.slice(0, cutStart) + text.slice(cutEnd);
    const next = layoutOf(edited);
    engine.replaceText(text, edited, next, 1000);
    expect(engine.anchorAt(1000).charOffset).toBe(cutStart);
    const line = next.lines.find((l) => l.start === cutStart)!;
    expect(positionAt(engine.segment, 1000)).toBe(line.y);
  });

  it('UT-060 replaceText durante cruise reemite cruise a partir da posição reancorada, sem pausar', () => {
    const text = Array.from({ length: 10 }, (_, i) => `linha${i} aaaa bbbb`).join('\n');
    const clock = createFakeScheduler();
    const engine = createScrollEngine({ scheduler: clock });
    engine.load(layoutOf(text), 0);
    engine.apply({ type: 'autoStart' }, 0);
    clock.advanceTo(10_000);
    const before = engine.anchorAt(10_000);
    const edited = `Frase nova inserida.\n${text}`;
    const next = layoutOf(edited);
    engine.replaceText(text, edited, next, 10_000);
    expect(engine.automation).toBe('auto');
    expect(engine.segment.kind).toBe('cruise');
    expect(engine.segment).toMatchObject({ t0: 10_000 });
    expect(engine.anchorAt(10_000).charOffset).toBe(before.charOffset + 21);
  });

  it('UT-061 relayout durante cruise (fonte 80 para 120) mantém o caractere da faixa e a automação', () => {
    const text = Array.from({ length: 40 }, (_, i) => `palavra${i} um dois tres quatro cinco seis sete`).join(' ');
    const clock = createFakeScheduler();
    const engine = createScrollEngine({ scheduler: clock });
    const small = layoutOf(text);
    engine.load(small, 0);
    engine.apply({ type: 'autoStart' }, 0);
    clock.advanceTo(20_000);
    const before = engine.anchorAt(20_000);
    const lineOf = (l: typeof small, c: number): number => l.lines.findLastIndex((x) => x.start <= c);
    const big = layoutOf(text, { ...small.appearance, fontSize: 120 });
    engine.relayout(big, 20_000);
    expect(engine.automation).toBe('auto');
    expect(engine.segment.kind).toBe('cruise');
    const y = positionAt(engine.segment, 20_000);
    // A linha na faixa agora é a que contém o caractere que estava na faixa.
    const bandLine = big.lines.findLastIndex((l) => l.y <= y);
    expect(bandLine).toBe(lineOf(big, before.charOffset));
    // O px/s acompanha a nova altura total, com a mesma velocidade.
    const seg = engine.segment;
    if (seg.kind === 'cruise') expect(seg.pxPerSec).toBeCloseTo((140 / 60) * (big.totalHeight / big.wordCount), 9);
  });

  it('UT-062 formatSpeed mostra a velocidade com vírgula e x', () => {
    expect(formatSpeed(1.25)).toBe('1,25x');
    expect(formatSpeed(1)).toBe('1,00x');
    expect(formatSpeed(3)).toBe('3,00x');
  });
});
