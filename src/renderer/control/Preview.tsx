/**
 * Prévia sincronizada (US-014): o mesmo `Stage` das saídas, sem inversão, com as
 * linhas-guia das margens. A roda do mouse sobre ela manda `cmd:scroll nudge` (px lógicos).
 * Na primeira abertura, sem texto confirmado nem saídas, mostra os três passos.
 */
import { useEffect, useRef } from 'react';
import { registerProbe } from '../shared/test-hooks';
import { Stage } from '../shared/Stage';
import { stageScale } from '../shared/stage-frame';
import { useControlStore, useLayout, useSegment, useSnapshot } from './hooks';

/** Altura de uma "linha" da roda do mouse quando o sistema rola por linhas. */
const WHEEL_LINE_PX = 40;

export const FIRST_STEPS = ['Cole ou importe o texto', 'Abra uma saída', 'Ligue a voz, se quiser'] as const;

export function FirstSteps() {
  return (
    <div className="tp-first-steps" role="note" aria-label="Primeiros passos">
      <h2 className="tp-panel-title">
        <span className="tp-title-light">Primeiros</span> <span className="tp-title-bold">passos</span>
      </h2>
      <ol>
        {FIRST_STEPS.map((step, i) => (
          <li key={step}>
            <span className="tp-step-number" aria-hidden="true">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Preview() {
  const store = useControlStore();
  const snapshot = useSnapshot();
  const layout = useLayout();
  const segment = useSegment();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const drawn = useRef({ y: 0, t: 0 });

  // Roda do mouse: ouvinte nativo não passivo, para a página não rolar junto.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const scale = stageScale({ width: rect.width, height: rect.height }) || 1;
      const unit = e.deltaMode === 1 ? WHEEL_LINE_PX : e.deltaMode === 2 ? rect.height || WHEEL_LINE_PX * 10 : 1;
      const dy = (e.deltaY * unit) / scale;
      if (dy !== 0 && Number.isFinite(dy)) store.bridge?.send('cmd:scroll', { type: 'nudge', dy });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [store]);

  // Ganchos de teste: posição desenhada e texto das linhas da prévia.
  useEffect(() => {
    registerProbe('position', () => drawn.current.y);
    registerProbe('sample', () => ({ ...drawn.current }));
    registerProbe('lineYs', () => store.getLayout()?.lines.map((l) => l.y) ?? []);
    registerProbe('lines', () => store.getLayout()?.lines.map((l) => l.text) ?? []);
    registerProbe('layoutRevision', () => store.getLayout()?.revision ?? null);
    registerProbe('appearance', () => store.getLayout()?.appearance ?? null);
    registerProbe('fontFamily', () => (boxRef.current?.querySelector('.tp-stage-lines') as HTMLElement | null)?.style.fontFamily ?? null);
  }, [store]);

  const firstRun = snapshot.doc.confirmedText === '' && snapshot.outputs.length === 0;

  return (
    <section className="tp-preview" aria-label="Prévia">
      <div className="tp-preview-frame" ref={boxRef} data-testid="preview">
        <Stage
          layout={snapshot.doc.confirmedText === '' ? null : layout}
          appearance={snapshot.appearance}
          segment={segment}
          now={store.clock.now}
          guides
          onDraw={(y) => {
            drawn.current = { y, t: store.clock.now() };
          }}
          className="tp-preview-stage"
          style={{ position: 'absolute', inset: 0 }}
        />
        {firstRun && <FirstSteps />}
      </div>
    </section>
  );
}
