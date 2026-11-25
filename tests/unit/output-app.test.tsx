import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APPEARANCE, ID_BADGE_MS, STAGE_WIDTH, VOICE_SIGNAL_EDGE, VOICE_SIGNAL_SIZE } from '@shared/defaults';
import type { OutputBridge, OutputEvents, OutputView } from '@shared/ipc';
import type { Appearance, VoiceState } from '@shared/types';
import { flipTransform, OutputApp } from '../../src/renderer/output/OutputApp';
import { createOutputStore } from '../../src/renderer/output/output-store';
import { Stage } from '../../src/renderer/shared/Stage';
import { layoutOf } from '../fakes/layouts';

const TEXT = 'Bom dia a todos.\n\nHoje vamos falar sobre o novo estúdio.';

function fakeOutputBridge() {
  const listeners = new Map<string, Set<(p: unknown) => void>>();
  const bridge: OutputBridge & { emit<C extends keyof OutputEvents>(c: C, p: OutputEvents[C]): void } = {
    role: 'output',
    invoke: (() => Promise.resolve({ t0: 0, mainNow: 0 })) as never,
    send: () => undefined,
    on(channel, cb) {
      const set = listeners.get(channel) ?? new Set();
      set.add(cb as (p: unknown) => void);
      listeners.set(channel, set);
      return () => set.delete(cb as (p: unknown) => void);
    },
    emit(channel, payload) {
      act(() => listeners.get(channel)?.forEach((cb) => cb(payload)));
    },
  };
  return bridge;
}

function view(patch: Partial<OutputView> = {}, appearance: Partial<Appearance> = {}): OutputView {
  return {
    id: 2,
    layout: layoutOf(TEXT, { ...DEFAULT_APPEARANCE, ...appearance }),
    mirrorH: false,
    flipV: false,
    voiceSignal: true,
    voiceState: 'off',
    showBadge: false,
    ...patch,
  };
}

function renderOutput(initial: OutputView, viewport = { width: 1920, height: 1080 }) {
  const bridge = fakeOutputBridge();
  const store = createOutputStore({ bridge, clock: { now: () => 0 }, initial });
  const r = render(<OutputApp store={store} viewport={viewport} />);
  return { ...r, bridge };
}

const flip = (c: HTMLElement) => c.querySelector('.tp-output-flip') as HTMLElement;
const signal = (c: HTMLElement) => c.querySelector('.tp-voice-signal') as SVGElement | null;

afterEach(() => {
  vi.useRealTimers();
});

describe('OutputApp: inversões (ADR-010)', () => {
  it.each([
    [false, false, 'none'],
    [true, false, 'scale(-1, 1)'],
    [false, true, 'scale(1, -1)'],
    [true, true, 'scale(-1, -1)'],
  ])('UT-248 mirrorH %s e flipV %s aplicam %s ao palco inteiro', (mirrorH, flipV, expected) => {
    expect(flipTransform(mirrorH, flipV)).toBe(expected);
    const { container } = renderOutput(view({ mirrorH, flipV }));
    expect(flip(container).style.transform).toBe(expected);
    // O palco está dentro do que inverte.
    expect(flip(container).querySelector('.tp-stage')).not.toBeNull();
  });

  it('UT-248 a prévia nunca recebe inversão', () => {
    const layout = layoutOf(TEXT);
    const { container } = render(
      <Stage layout={layout} appearance={layout.appearance} segment={{ kind: 'hold', y: 0 }} now={() => 0} viewport={{ width: 960, height: 540 }} guides />,
    );
    const all = [...container.querySelectorAll<HTMLElement>('*')].map((el) => el.style.transform);
    expect(all.some((t) => /scale\(-1/.test(t) || /, -1\)/.test(t))).toBe(false);
  });
});

describe('OutputApp: sinal de voz (US-035)', () => {
  it.each<[VoiceState, string, string]>([
    ['listening', 'circle', 'var(--success)'],
    ['waiting', 'bars', 'var(--warning)'],
    ['failed', 'triangle', 'var(--danger)'],
  ])('UT-251 em %s aparece como %s com %s', (state, shape, color) => {
    const { container } = renderOutput(view({ voiceState: state }));
    const s = signal(container)!;
    expect(s.getAttribute('data-shape')).toBe(shape);
    const fills = [...s.querySelectorAll('[fill]')].map((el) => el.getAttribute('fill'));
    expect(fills.length).toBeGreaterThan(0);
    expect(new Set(fills)).toEqual(new Set([color]));
    if (shape === 'bars') expect(s.querySelectorAll('rect')).toHaveLength(2);
  });

  it('UT-251 não aparece com a voz desligada nem com voiceSignal false', () => {
    expect(signal(renderOutput(view({ voiceState: 'off' })).container)).toBeNull();
    expect(signal(renderOutput(view({ voiceState: 'listening', voiceSignal: false })).container)).toBeNull();
  });

  it('UT-251 muda com o estado recebido em state:output', () => {
    const { container, bridge } = renderOutput(view({ voiceState: 'listening' }));
    bridge.emit('state:output', view({ voiceState: 'waiting' }));
    expect(signal(container)?.getAttribute('data-shape')).toBe('bars');
    bridge.emit('state:output', view({ voiceState: 'off' }));
    expect(signal(container)).toBeNull();
  });

  it('UT-252 o sinal fica no canto inferior direito, dentro da margem de 10%, invertido junto', () => {
    const vp = { width: 1280, height: 720 };
    const scale = vp.width / STAGE_WIDTH;
    const { container } = renderOutput(view({ voiceState: 'listening', mirrorH: true }), vp);
    const s = signal(container)! as unknown as HTMLElement;
    const right = parseFloat(s.style.right);
    const bottom = parseFloat(s.style.bottom);
    const size = parseFloat(s.style.width);
    expect(size).toBeCloseTo(VOICE_SIGNAL_SIZE * scale, 6);
    expect(bottom).toBeCloseTo(VOICE_SIGNAL_EDGE * scale, 6);
    const margin = 0.1 * vp.width;
    expect(right).toBeGreaterThan(0);
    expect(right + size).toBeLessThanOrEqual(margin);
    expect(flip(container).contains(s)).toBe(true);
    expect(flip(container).style.transform).toBe('scale(-1, 1)');
  });

  it('UT-252 com margem 0%, o sinal fica a 24 px da borda', () => {
    const { container } = renderOutput(view({ voiceState: 'failed' }, { marginPct: 0 }));
    const s = signal(container)! as unknown as HTMLElement;
    expect(parseFloat(s.style.right)).toBeCloseTo(VOICE_SIGNAL_EDGE, 6);
    expect(parseFloat(s.style.bottom)).toBeCloseTo(VOICE_SIGNAL_EDGE, 6);
  });
});

describe('OutputApp: número de identificação e o que a saída nunca mostra', () => {
  it('UT-253 com showBadge, o número 2 aparece e some depois de 4.000 ms', () => {
    vi.useFakeTimers();
    const { container, bridge } = renderOutput(view({ showBadge: true }));
    const badge = () => container.querySelector('.tp-output-badge');
    expect(badge()?.textContent).toBe('2');
    // Os estados seguintes chegam com showBadge false e não apagam antes da hora.
    bridge.emit('state:output', view({ showBadge: false, mirrorH: true }));
    act(() => void vi.advanceTimersByTime(ID_BADGE_MS - 1));
    expect(badge()?.textContent).toBe('2');
    act(() => void vi.advanceTimersByTime(1));
    expect(badge()).toBeNull();
  });

  it('UT-253 com showBadge false, o número não aparece', () => {
    const { container } = renderOutput(view({ showBadge: false }));
    expect(container.querySelector('.tp-output-badge')).toBeNull();
  });

  it('UT-254 a saída com update e avisos no estado só desenha texto, faixa e sinal', () => {
    const withExtras = { ...view({ voiceState: 'listening' }), update: { version: '9.9.9', url: 'x' }, notices: [{ id: 'n', kind: 'danger', message: 'Alerta' }] };
    const { container } = renderOutput(withExtras as OutputView);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/v\d+\.\d+\.\d+/);
    expect(text).not.toContain(__APP_VERSION__);
    expect(text).not.toContain('9.9.9');
    expect(text).not.toContain('Alerta');
    expect(container.querySelectorAll('button, input, select, textarea, [role="alert"], [role="status"]')).toHaveLength(0);
    expect(text).toBe(['Bom dia a todos.', 'Hoje vamos falar sobre o novo estúdio.'].join(''));
    expect(container.querySelector('.tp-stage-band')).not.toBeNull();
    expect(signal(container)).not.toBeNull();
  });

  it('a área de texto usa as cores da aparência; sem layout, nasce com o fundo da aparência', () => {
    const { container } = renderOutput(view({}, { textColor: '#FFFF00', backgroundColor: '#112233' }));
    expect((container.querySelector('.tp-stage-lines') as HTMLElement).style.color).toBe('rgb(255, 255, 0)');
    expect((container.querySelector('.tp-output') as HTMLElement).style.background).toBe('rgb(17, 34, 51)');
    const empty = renderOutput({ ...view(), layout: null });
    expect((empty.container.querySelector('.tp-output') as HTMLElement).style.background).toBe('rgb(0, 0, 0)');
  });
});
