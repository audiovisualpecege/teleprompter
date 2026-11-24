/**
 * Trechos de movimento (ADR-006). O processo principal publica um trecho, e cada
 * janela calcula a posição a cada quadro no relógio comum. Nada é somado quadro a
 * quadro, então não existe diferença acumulada com o tempo.
 */
export type MotionSegment =
  | { kind: 'hold'; y: number }
  | { kind: 'cruise'; y0: number; t0: number; pxPerSec: number; yEnd: number }
  | { kind: 'glide'; y0: number; y1: number; t0: number; durMs: number };

/** Curva de saída suave usada nos deslizamentos. */
export function easeOutCubic(p: number): number {
  const q = 1 - p;
  return 1 - q * q * q;
}

/** Posição (px do palco lógico, topo do texto até a faixa) no instante `now` do relógio comum. */
export function positionAt(seg: MotionSegment, now: number): number {
  switch (seg.kind) {
    case 'hold':
      return seg.y;
    case 'cruise': {
      const y = seg.y0 + (seg.pxPerSec * (now - seg.t0)) / 1000;
      // Antes do início o trecho fica parado em y0; depois do fim, em yEnd.
      if (seg.pxPerSec >= 0) return Math.min(seg.yEnd, Math.max(seg.y0, y));
      return Math.max(seg.yEnd, Math.min(seg.y0, y));
    }
    case 'glide': {
      const p = seg.durMs <= 0 ? 1 : Math.min(1, Math.max(0, (now - seg.t0) / seg.durMs));
      return seg.y0 + (seg.y1 - seg.y0) * easeOutCubic(p);
    }
  }
}

/** Posição final do trecho, para onde ele vai quando termina. */
export function segmentTarget(seg: MotionSegment): number {
  switch (seg.kind) {
    case 'hold':
      return seg.y;
    case 'cruise':
      return seg.yEnd;
    case 'glide':
      return seg.y1;
  }
}

/**
 * Relógio local de alta resolução do processo, em ms desde a época
 * (`performance.timeOrigin + performance.now()`). O principal usa este valor como
 * relógio comum; cada janela o corrige pelo desvio medido com `clock:ping`.
 */
export function processNow(): number {
  return performance.timeOrigin + performance.now();
}
