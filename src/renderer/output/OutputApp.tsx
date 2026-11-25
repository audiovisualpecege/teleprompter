/**
 * Saída de TP (TechSpec, "Janela de saída"; ADR-006, ADR-010; US-016, US-035).
 *
 * - O mesmo `Stage` da prévia, em tela cheia, com as linhas já quebradas pelo principal.
 * - `mirrorH` é `scale(-1, 1)` e `flipV` é `scale(1, -1)`, aplicados ao palco inteiro; o
 *   sinal de voz e o número de identificação ficam dentro dele e invertem junto.
 * - A área de texto usa as cores escolhidas pela pessoa (conteúdo de leitura no vidro); o
 *   sinal de voz e o número usam os tokens da Chiaro.
 * - A saída nunca mostra versão, aviso, alerta nem controle: só o texto, a faixa, o sinal e,
 *   por `ID_BADGE_MS` ao abrir pela tela de controle, o número.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { DEFAULT_APPEARANCE, ID_BADGE_MS, LONG_FRAME_MS, STAGE_WIDTH, VOICE_SIGNAL_EDGE, VOICE_SIGNAL_SIZE } from '@shared/defaults';
import type { VoiceState } from '@shared/types';
import { Stage } from '../shared/Stage';
import { stageScale, type Viewport } from '../shared/stage-frame';
import { registerProbe } from '../shared/test-hooks';
import type { OutputStore } from './output-store';

/** `transform` das inversões: nenhuma, espelhar, inverter vertical ou as duas. */
export function flipTransform(mirrorH: boolean, flipV: boolean): string {
  if (!mirrorH && !flipV) return 'none';
  return `scale(${mirrorH ? -1 : 1}, ${flipV ? -1 : 1})`;
}

/** Distância do sinal até a borda direita, em px lógicos: no meio da margem, ou 24 px com margem 0%. */
export function signalRight(marginPct: number): number {
  const margin = (marginPct / 100) * STAGE_WIDTH;
  if (margin <= 0) return VOICE_SIGNAL_EDGE;
  return Math.max(0, (margin - VOICE_SIGNAL_SIZE) / 2);
}

const SIGNAL_SHAPES: Partial<Record<VoiceState, 'circle' | 'bars' | 'triangle'>> = {
  listening: 'circle',
  waiting: 'bars',
  failed: 'triangle',
};

export interface VoiceSignalProps {
  state: VoiceState;
  scale: number;
  marginPct: number;
}

/** Sinal discreto da voz: só forma e cor, no canto inferior direito, dentro da margem. */
export function VoiceSignal({ state, scale, marginPct }: VoiceSignalProps) {
  const shape = SIGNAL_SHAPES[state];
  if (!shape) return null;
  const size = VOICE_SIGNAL_SIZE * scale;
  const style: CSSProperties = {
    position: 'absolute',
    right: signalRight(marginPct) * scale,
    bottom: VOICE_SIGNAL_EDGE * scale,
    width: size,
    height: size,
    zIndex: 2,
    pointerEvents: 'none',
  };
  return (
    <svg className="tp-voice-signal" data-shape={shape} data-state={state} viewBox="0 0 28 28" style={style} aria-hidden="true">
      {shape === 'circle' && <circle cx="14" cy="14" r="12" fill="var(--success)" />}
      {shape === 'bars' && (
        <>
          <rect x="5" y="4" width="6" height="20" rx="2" fill="var(--warning)" />
          <rect x="17" y="4" width="6" height="20" rx="2" fill="var(--warning)" />
        </>
      )}
      {shape === 'triangle' && (
        <path d="M14 3 L26 25 H2 Z" fill="var(--danger)" stroke="var(--danger)" strokeWidth="2" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** Número da saída por `ID_BADGE_MS`, só quando `showBadge` chega verdadeiro. */
export function useBadge(show: boolean, ms = ID_BADGE_MS): boolean {
  const [shownAt, setShownAt] = useState<number | null>(null);
  const prev = useRef(false);
  useEffect(() => {
    if (show && !prev.current) setShownAt(Date.now());
    prev.current = show;
  }, [show]);
  useEffect(() => {
    if (shownAt === null) return undefined;
    const t = setTimeout(() => setShownAt(null), Math.max(0, shownAt + ms - Date.now()));
    return () => clearTimeout(t);
  }, [shownAt, ms]);
  return shownAt !== null;
}

function IdBadge({ id, scale }: { id: number; scale: number }) {
  return (
    <div className="tp-output-badge" role="img" aria-label={`Saída ${id}`} style={{ fontSize: 360 * scale, zIndex: 3 }}>
      <span>{id}</span>
    </div>
  );
}

function useWindowViewport(fixed?: Viewport): Viewport {
  const read = (): Viewport =>
    typeof window === 'undefined' ? { width: 0, height: 0 } : { width: window.innerWidth, height: window.innerHeight };
  const [vp, setVp] = useState<Viewport>(fixed ?? read());
  useEffect(() => {
    if (fixed) return undefined;
    const on = (): void => setVp((v) => {
      const n = read();
      return v.width === n.width && v.height === n.height ? v : n;
    });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [fixed]);
  return fixed ?? vp;
}

/** Quadros acima de `LONG_FRAME_MS`, somados por minuto e mandados ao log do principal. */
function useLongFrames(store: OutputStore): void {
  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined' || !store.bridge) return undefined;
    let last = performance.now();
    let count = 0;
    let maxMs = 0;
    let handle = 0;
    const tick = (t: number): void => {
      const dt = t - last;
      last = t;
      // Janela escondida não desenha: um intervalo enorme não é quadro longo.
      if (dt > LONG_FRAME_MS && dt < 2000) {
        count++;
        maxMs = Math.max(maxMs, dt);
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    const timer = setInterval(() => {
      if (count > 0) store.bridge?.send('render:longFrame', { count, maxMs: Math.round(maxMs) });
      count = 0;
      maxMs = 0;
    }, 60_000);
    return () => {
      cancelAnimationFrame(handle);
      clearInterval(timer);
    };
  }, [store]);
}

export interface OutputAppProps {
  store: OutputStore;
  /** Tamanho da tela (testes); sem ele, o tamanho da janela. */
  viewport?: Viewport;
}

export function OutputApp({ store, viewport: fixed }: OutputAppProps) {
  const view = useSyncExternalStore(store.subscribe, store.getView);
  const segment = useSyncExternalStore(store.subscribeSegment, store.getSegment);
  const viewport = useWindowViewport(fixed);
  const badge = useBadge(Boolean(view?.showBadge));
  const drawn = useRef({ y: 0, t: 0 });
  const flipRef = useRef<HTMLDivElement | null>(null);
  useLongFrames(store);

  const layout = view?.layout ?? null;
  const appearance = layout?.appearance ?? DEFAULT_APPEARANCE;
  const scale = stageScale(viewport);
  const signalOn = Boolean(view?.voiceSignal) && view?.voiceState !== undefined;

  useEffect(() => {
    registerProbe('outputId', () => store.getView()?.id ?? null);
    registerProbe('position', () => drawn.current.y);
    registerProbe('sample', () => ({ ...drawn.current }));
    registerProbe('lines', () => store.getView()?.layout?.lines.map((l) => l.text) ?? []);
    registerProbe('bandText', () => {
      const lines = store.getView()?.layout?.lines ?? [];
      return lines.findLast((l) => l.y <= drawn.current.y + 0.5)?.text ?? null;
    });
    registerProbe('layoutRevision', () => store.getView()?.layout?.revision ?? null);
    registerProbe('transform', () => (flipRef.current ? getComputedStyle(flipRef.current).transform : null));
    registerProbe('badge', () => document.querySelector('.tp-output-badge')?.textContent ?? null);
    registerProbe('signal', () => document.querySelector('.tp-voice-signal')?.getAttribute('data-shape') ?? null);
    registerProbe('outputText', () => document.body.innerText);
  }, [store]);

  return (
    <div className="tp-output" style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: appearance.backgroundColor }}>
      <div
        ref={flipRef}
        className="tp-output-flip"
        data-testid="output-flip"
        style={{ position: 'absolute', inset: 0, transform: flipTransform(Boolean(view?.mirrorH), Boolean(view?.flipV)) }}
      >
        <Stage
          layout={layout}
          appearance={appearance}
          segment={segment}
          now={store.clock.now}
          viewport={viewport}
          onDraw={(y) => {
            drawn.current = { y, t: store.clock.now() };
          }}
          style={{ position: 'absolute', inset: 0 }}
        />
        {signalOn && view && <VoiceSignal state={view.voiceState} scale={scale} marginPct={appearance.marginPct} />}
        {badge && view && <IdBadge id={view.id} scale={scale} />}
      </div>
    </div>
  );
}
