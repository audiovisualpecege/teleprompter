/**
 * Motor de rolagem (TechSpec, "Interfaces centrais" e "Algoritmos principais").
 *
 * - A posição nunca é publicada quadro a quadro: o motor publica `MotionSegment`
 *   com instante no relógio comum, e cada janela calcula a posição (ADR-006).
 * - `y` vai de 0 (primeira linha na faixa) até o `y` da última linha.
 * - Só uma automação por vez, e o manual sempre por cima: todo comando manual com a
 *   automática ligada volta à automática a partir da nova posição (ADR-005).
 * - Os instantes vêm de quem chama (`now`); os temporizadores (fim do texto, volta à
 *   automática depois de um deslizamento) usam um `Scheduler` injetado com horário absoluto.
 */
import {
  BASE_WPM,
  HOLD_LINES_PER_SEC,
  LINE_STEP_MS,
  MANUAL_PRIORITY_MS,
  NUDGE_GLIDE_MS,
  SPEED_DEFAULT,
  VOICE_GLIDE_MS,
} from '@shared/defaults';
import { positionAt, processNow, segmentTarget, type MotionSegment } from '@shared/motion';
import { clampSpeed } from '@shared/speed';
import type { Anchor, LayoutResult, ScrollCommand } from '@shared/types';

export { clampSpeed, formatSpeed } from '@shared/speed';
export type { ScrollCommand } from '@shared/types';

/** `no-text`: `autoStart` sem texto confirmado (US-026 EC-2). `ignored`: nada mudou. */
export type ScrollApplyResult = 'ok' | 'ignored' | 'no-text';

/** Agenda `fn` para o instante absoluto `time` do relógio comum; devolve o cancelamento. */
export interface Scheduler {
  at(time: number, fn: () => void): () => void;
}

export function realScheduler(now: () => number = processNow): Scheduler {
  return {
    at(time, fn) {
      const h = setTimeout(fn, Math.max(0, time - now()));
      return () => clearTimeout(h);
    },
  };
}

export interface ScrollEngine {
  apply(cmd: ScrollCommand, now: number): ScrollApplyResult;
  /** Novo layout do mesmo texto (aparência): mantém o caractere da faixa. */
  relayout(layout: LayoutResult, now: number): void;
  /** Novo texto confirmado: mantém o caractere da faixa pelo prefixo e sufixo comuns. */
  replaceText(oldText: string, newText: string, layout: LayoutResult, now: number): void;
  /** Outro roteiro (abrir, novo, primeiro confirmar): posição 0 e automática pausada. */
  load(layout: LayoutResult | null, now: number): void;
  anchorAt(now: number): Anchor;
  readonly segment: MotionSegment;
  readonly layout: LayoutResult | null;
  readonly automation: 'none' | 'auto';
  readonly speed: number;
  /** Instante do último comando manual (para a prioridade do manual sobre a voz). */
  readonly lastManualAt: number;
  onSegment(cb: (s: MotionSegment) => void): () => void;
  /** Fim do texto ou voltar ao início com a automática ligada. */
  onAutoEnded(cb: () => void): () => void;
}

export interface ScrollEngineOptions {
  scheduler?: Scheduler;
  speed?: number;
}

const EPS = 0.5;
/** Deslizamento da voz: ms por linha de distância, preso entre os limites. */
const VOICE_MS_PER_LINE = 300;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function createScrollEngine(options: ScrollEngineOptions = {}): ScrollEngine {
  const scheduler = options.scheduler ?? realScheduler();
  let layout: LayoutResult | null = null;
  let seg: MotionSegment = { kind: 'hold', y: 0 };
  let auto = false;
  let held: 1 | -1 | null = null;
  let speed = clampSpeed(options.speed ?? SPEED_DEFAULT);
  let lastManualAt = -Infinity;
  let cancelTimer: (() => void) | null = null;
  const segListeners = new Set<(s: MotionSegment) => void>();
  const endListeners = new Set<() => void>();

  const lines = (): LayoutResult['lines'] => layout?.lines ?? [];
  const hasText = (): boolean => lines().length > 0;
  const maxY = (): number => lines().at(-1)?.y ?? 0;
  const lineHeight = (): number => lines()[0]?.height ?? 0;
  const pos = (now: number): number => positionAt(seg, now);
  const glideActive = (now: number): boolean =>
    seg.kind === 'glide' && now < seg.t0 + seg.durMs;
  const moving = (now: number): boolean =>
    glideActive(now) || (seg.kind === 'cruise' && pos(now) !== seg.yEnd);
  /** Base dos comandos encadeados: o alvo pendente, não a posição desenhada (US-021 EC-3). */
  const base = (now: number): number => (glideActive(now) ? segmentTarget(seg) : pos(now));

  const emit = (s: MotionSegment): void => {
    seg = s;
    for (const cb of [...segListeners]) cb(s);
  };
  const stopTimer = (): void => {
    cancelTimer?.();
    cancelTimer = null;
  };
  const schedule = (time: number, fn: () => void): void => {
    stopTimer();
    const cancel = scheduler.at(time, () => {
      if (cancelTimer !== cancel) return; // temporizador velho
      cancelTimer = null;
      fn();
    });
    cancelTimer = cancel;
  };
  const autoEnded = (): void => {
    for (const cb of [...endListeners]) cb();
  };

  const autoPxPerSec = (): number => {
    const l = layout;
    if (!l) return 0;
    return (speed * BASE_WPM * l.totalHeight) / 60 / Math.max(1, l.wordCount);
  };

  /** Rolagem automática a partir de `y` no instante `t`, com o fim do texto agendado. */
  const startCruise = (y: number, t: number): void => {
    const end = maxY();
    const px = autoPxPerSec();
    if (y >= end - 1e-9 || px <= 0) {
      stopTimer();
      emit({ kind: 'hold', y: end });
      auto = false;
      autoEnded();
      return;
    }
    emit({ kind: 'cruise', y0: y, t0: t, pxPerSec: px, yEnd: end });
    schedule(t + ((end - y) / px) * 1000, () => {
      emit({ kind: 'hold', y: end });
      auto = false;
      autoEnded();
    });
  };

  /** Desliza até `y1` e, com a automática ligada, volta a ela no fim do deslizamento. */
  const glideTo = (now: number, y1: number, durMs: number): void => {
    stopTimer();
    emit({ kind: 'glide', y0: pos(now), y1, t0: now, durMs });
    if (auto) schedule(now + durMs, () => startCruise(y1, now + durMs));
  };

  const holdCruise = (y: number, now: number, dir: 1 | -1): void => {
    const yEnd = dir > 0 ? maxY() : 0;
    if ((dir > 0 && y >= yEnd) || (dir < 0 && y <= yEnd)) {
      emit({ kind: 'hold', y: yEnd });
      return;
    }
    emit({ kind: 'cruise', y0: y, t0: now, pxPerSec: dir * HOLD_LINES_PER_SEC * lineHeight(), yEnd });
  };

  const manual = (now: number): void => {
    lastManualAt = now;
  };

  /* ---------- Âncora ---------- */

  const span = (l: LayoutResult['lines'], i: number): number =>
    i + 1 < l.length ? l[i + 1].y - l[i].y : l[i].height;

  const anchorForY = (y: number): Anchor => {
    const l = lines();
    if (l.length === 0) return { charOffset: 0, fraction: 0 };
    let i = 0;
    while (i + 1 < l.length && l[i + 1].y <= y) i++;
    const s = span(l, i);
    const fraction = s > 0 ? clamp((y - l[i].y) / s, 0, 1) : 0;
    const len = l[i].end - l[i].start;
    const charOffset = l[i].start + Math.min(Math.max(0, len - 1), Math.floor(fraction * len));
    return { charOffset, fraction };
  };

  const yForAnchor = (a: Anchor): number => {
    const l = lines();
    if (l.length === 0) return 0;
    let i = 0;
    while (i + 1 < l.length && l[i + 1].start <= a.charOffset) i++;
    return clamp(l[i].y + a.fraction * span(l, i), 0, maxY());
  };

  /** Troca o layout mantendo o movimento em curso, a partir da posição reancorada. */
  const reanchor = (next: LayoutResult, now: number, map: (a: Anchor) => Anchor): void => {
    const wasGliding = glideActive(now);
    const gl = seg.kind === 'glide' ? seg : null;
    const here = map(anchorForY(pos(now)));
    const there = wasGliding && gl ? map(anchorForY(gl.y1)) : null;
    layout = next;
    stopTimer();
    if (!hasText()) {
      auto = false;
      held = null;
      emit({ kind: 'hold', y: 0 });
      return;
    }
    const y = yForAnchor(here);
    if (wasGliding && gl && there) {
      const remaining = gl.t0 + gl.durMs - now;
      const y1 = yForAnchor(there);
      emit({ kind: 'glide', y0: y, y1, t0: now, durMs: remaining });
      if (auto) schedule(now + remaining, () => startCruise(y1, now + remaining));
    } else if (held) {
      holdCruise(y, now, held);
    } else if (auto) {
      startCruise(y, now); // mesma velocidade, px/s recalculado para o layout novo
    } else {
      emit({ kind: 'hold', y });
    }
  };

  /* ---------- Comandos ---------- */

  const apply = (cmd: ScrollCommand, now: number): ScrollApplyResult => {
    switch (cmd.type) {
      case 'lineStep': {
        if (!hasText()) return 'ignored';
        const b = base(now);
        const l = lines();
        const next =
          cmd.dir > 0 ? l.find((x) => x.y > b + EPS) : [...l].reverse().find((x) => x.y < b - EPS);
        if (!next) return 'ignored';
        manual(now);
        held = null;
        glideTo(now, next.y, LINE_STEP_MS);
        return 'ok';
      }
      case 'holdStart': {
        if (!hasText() || held === cmd.dir) return 'ignored';
        manual(now);
        stopTimer();
        held = cmd.dir;
        holdCruise(pos(now), now, cmd.dir);
        return 'ok';
      }
      case 'holdEnd': {
        if (held === null) return 'ignored';
        manual(now);
        held = null;
        stopTimer();
        const y = pos(now);
        if (auto) startCruise(y, now);
        else emit({ kind: 'hold', y });
        return 'ok';
      }
      case 'nudge': {
        if (!hasText() || typeof cmd.dy !== 'number' || !Number.isFinite(cmd.dy) || cmd.dy === 0) return 'ignored';
        const target = clamp(base(now) + cmd.dy, 0, maxY());
        if (Math.abs(target - base(now)) < 1e-9) return 'ignored';
        manual(now);
        held = null;
        glideTo(now, target, NUDGE_GLIDE_MS);
        return 'ok';
      }
      case 'toStart': {
        manual(now);
        held = null;
        const wasAuto = auto;
        auto = false;
        stopTimer();
        if (moving(now) || pos(now) !== 0) emit({ kind: 'hold', y: 0 });
        if (wasAuto) autoEnded();
        return 'ok';
      }
      case 'autoStart': {
        if (!hasText()) return 'no-text';
        if (auto) return 'ignored';
        auto = true;
        if (held) return 'ok'; // volta à automática no `holdEnd`
        if (glideActive(now)) {
          const g = seg as Extract<MotionSegment, { kind: 'glide' }>;
          const end = g.t0 + g.durMs;
          schedule(end, () => startCruise(g.y1, end));
        } else {
          startCruise(pos(now), now);
        }
        return 'ok';
      }
      case 'autoPause': {
        if (!auto) return 'ignored';
        auto = false;
        stopTimer();
        if (held === null && !glideActive(now)) emit({ kind: 'hold', y: pos(now) });
        return 'ok';
      }
      case 'setSpeed': {
        const next = clampSpeed(cmd.speed, speed);
        if (next === speed) return 'ignored';
        speed = next;
        if (auto && held === null && seg.kind === 'cruise') startCruise(pos(now), now);
        return 'ok';
      }
      case 'voiceTarget': {
        if (!hasText() || auto || held !== null) return 'ignored';
        if (now - lastManualAt < MANUAL_PRIORITY_MS) return 'ignored';
        if (typeof cmd.y !== 'number' || !Number.isFinite(cmd.y)) return 'ignored';
        const from = Math.max(pos(now), base(now));
        const target = Math.min(cmd.y, maxY());
        if (target <= from + EPS) return 'ignored'; // nunca para trás
        const lh = lineHeight() || 1;
        const dur = clamp(Math.round(((target - from) / lh) * VOICE_MS_PER_LINE), VOICE_GLIDE_MS.min, VOICE_GLIDE_MS.max);
        stopTimer();
        emit({ kind: 'glide', y0: pos(now), y1: target, t0: now, durMs: dur });
        return 'ok';
      }
    }
  };

  const load = (next: LayoutResult | null, _now: number): void => {
    const wasAuto = auto;
    layout = next;
    auto = false;
    held = null;
    stopTimer();
    emit({ kind: 'hold', y: 0 });
    if (wasAuto) autoEnded();
  };

  return {
    apply,
    relayout(next, now) {
      if (!layout || !hasText()) return load(next, now);
      reanchor(next, now, (a) => a);
    },
    replaceText(oldText, newText, next, now) {
      if (!layout || !hasText()) return load(next, now);
      const max = Math.min(oldText.length, newText.length);
      let p = 0;
      while (p < max && oldText.charCodeAt(p) === newText.charCodeAt(p)) p++;
      let s = 0;
      while (
        s < max - p &&
        oldText.charCodeAt(oldText.length - 1 - s) === newText.charCodeAt(newText.length - 1 - s)
      )
        s++;
      const delta = newText.length - oldText.length;
      reanchor(next, now, (a) => {
        if (a.charOffset < p) return a; // antes da edição
        if (a.charOffset >= oldText.length - s) return { ...a, charOffset: a.charOffset + delta }; // depois
        return { charOffset: p, fraction: 0 }; // dentro do trecho alterado: o ponto mais próximo
      });
    },
    load,
    anchorAt: (now) => anchorForY(pos(now)),
    get segment() {
      return seg;
    },
    get layout() {
      return layout;
    },
    get automation() {
      return auto ? 'auto' : 'none';
    },
    get speed() {
      return speed;
    },
    get lastManualAt() {
      return lastManualAt;
    },
    onSegment(cb) {
      segListeners.add(cb);
      return () => segListeners.delete(cb);
    },
    onAutoEnded(cb) {
      endListeners.add(cb);
      return () => endListeners.delete(cb);
    },
  };
}
