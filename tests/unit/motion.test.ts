import { describe, expect, it } from 'vitest';
import { easeOutCubic, positionAt, segmentTarget, type MotionSegment } from '@shared/motion';

describe('motion', () => {
  it('UT-001 motion: hold devolve sempre a mesma posição', () => {
    expect(positionAt({ kind: 'hold', y: 250 }, 99999)).toBe(250);
  });

  const cruise: MotionSegment = { kind: 'cruise', y0: 100, t0: 1000, pxPerSec: 50, yEnd: 900 };

  it('UT-002 motion: cruise anda pxPerSec a partir de t0', () => {
    expect(positionAt(cruise, 3000)).toBe(200);
  });

  it('UT-003 motion: cruise para em yEnd e nunca passa dele', () => {
    expect(positionAt(cruise, 100000)).toBe(900);
    expect(positionAt(cruise, Number.MAX_SAFE_INTEGER)).toBe(900);
  });

  it('UT-004 motion: glide no meio do tempo usa easeOutCubic(0,5) = 0,875', () => {
    expect(easeOutCubic(0.5)).toBe(0.875);
    expect(positionAt({ kind: 'glide', y0: 0, y1: 100, t0: 0, durMs: 200 }, 100)).toBe(87.5);
  });

  it.each([
    [-50, 0],
    [500, 100],
  ])('UT-005 motion: glide em now=%d fica preso em %d', (now, expected) => {
    expect(positionAt({ kind: 'glide', y0: 0, y1: 100, t0: 0, durMs: 200 }, now)).toBe(expected);
  });

  it('UT-006 motion: cruise de 10 horas dá exatamente 360.000, sem soma de passos', () => {
    const seg: MotionSegment = { kind: 'cruise', y0: 0, t0: 0, pxPerSec: 10, yEnd: 1e9 };
    expect(positionAt(seg, 36_000_000)).toBe(360_000);
  });

  it('motion: cruise para trás (segurar subir) para em yEnd abaixo de y0', () => {
    const up: MotionSegment = { kind: 'cruise', y0: 500, t0: 0, pxPerSec: -100, yEnd: 0 };
    expect(positionAt(up, 1000)).toBe(400);
    expect(positionAt(up, 60_000)).toBe(0);
  });

  it('motion: segmentTarget devolve o fim de cada trecho', () => {
    expect(segmentTarget({ kind: 'hold', y: 3 })).toBe(3);
    expect(segmentTarget(cruise)).toBe(900);
    expect(segmentTarget({ kind: 'glide', y0: 0, y1: 7, t0: 0, durMs: 1 })).toBe(7);
  });
});
