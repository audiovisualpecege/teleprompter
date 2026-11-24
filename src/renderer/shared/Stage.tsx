/**
 * Palco compartilhado pela prévia e pelas saídas (ADR-006).
 *
 * - Recebe as linhas já quebradas (`LayoutResult`) e o trecho de movimento; nunca
 *   quebra linhas sozinho, por isso as quebras são as mesmas em qualquer tela.
 * - A cada quadro calcula `positionAt(trecho, relógio comum)` e move as linhas só por
 *   `transform`, sem refazer o React. O React só redesenha quando muda o conjunto de
 *   linhas montadas (as próximas da área visível).
 * - A faixa fica numa camada abaixo do texto.
 * - A área de texto usa as cores escolhidas pela pessoa (é o conteúdo lido no vidro).
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { STAGE_WIDTH } from '@shared/defaults';
import { positionAt, type MotionSegment } from '@shared/motion';
import type { Appearance, LayoutResult } from '@shared/types';
import { stageFontStack, stageFrame, type Viewport } from './stage-frame';

export interface StageProps {
  layout: LayoutResult | null;
  /** Aparência atual, usada enquanto ainda não há layout (fundo e faixa). */
  appearance: Appearance;
  segment: MotionSegment;
  /** Relógio comum. */
  now: () => number;
  /** Tamanho da tela; sem ele, o palco mede o próprio elemento. */
  viewport?: Viewport;
  /** Linhas-guia das margens (só na prévia). */
  guides?: boolean;
  /** Chamado a cada quadro com a posição desenhada (ganchos de teste). */
  onDraw?: (y: number) => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const ZERO: Viewport = { width: 0, height: 0 };

function useViewport(fixed: Viewport | undefined): [RefObject<HTMLDivElement | null>, Viewport] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<Viewport>(ZERO);
  useLayoutEffect(() => {
    if (fixed) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const read = (): void => {
      const r = el.getBoundingClientRect();
      setMeasured((v) => (v.width === r.width && v.height === r.height ? v : { width: r.width, height: r.height }));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixed]);
  return [ref, fixed ?? measured];
}

export function Stage({ layout, appearance: current, segment, now, viewport: fixed, guides, onDraw, className, style, children }: StageProps) {
  const [rootRef, viewport] = useViewport(fixed);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const appearance = layout?.appearance ?? current;
  const lines = layout?.lines ?? [];
  const y = positionAt(segment, now());
  const frame = stageFrame(lines, appearance, y, viewport);
  const [, setRange] = useState(`${frame.first}:${frame.last}`);

  // Os valores do quadro ficam em refs para o laço de desenho ler sem recriar o efeito.
  const live = useRef({ lines, appearance, segment, now, viewport, onDraw, range: `${frame.first}:${frame.last}` });
  live.current = { ...live.current, lines, appearance, segment, now, viewport, onDraw, range: `${frame.first}:${frame.last}` };

  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined') return undefined;
    let handle = 0;
    const draw = (): void => {
      const l = live.current;
      const yNow = positionAt(l.segment, l.now());
      const f = stageFrame(l.lines, l.appearance, yNow, l.viewport);
      if (scrollRef.current) scrollRef.current.style.transform = `translate3d(0px, ${f.translateY}px, 0px)`;
      l.onDraw?.(yNow);
      const range = `${f.first}:${f.last}`;
      if (range !== l.range) {
        l.range = range;
        setRange(range);
      }
      handle = requestAnimationFrame(draw);
    };
    handle = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(handle);
  }, []);

  const margin = (appearance.marginPct / 100) * STAGE_WIDTH;
  const fontFamily = stageFontStack(layout?.missingFont ? 'Archivo' : appearance.fontFamily);

  return (
    <div
      ref={rootRef}
      className={['tp-stage', className].filter(Boolean).join(' ')}
      data-scale={frame.scale}
      style={{ position: 'relative', overflow: 'hidden', background: appearance.backgroundColor, ...style }}
    >
      <div
        className="tp-stage-band"
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: frame.bandY,
          height: frame.bandHeight,
          background: appearance.bandColor,
          zIndex: 0,
        }}
      />
      <div
        ref={scrollRef}
        className="tp-stage-scroll"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 1,
          transform: `translate3d(0px, ${frame.translateY}px, 0px)`,
          willChange: 'transform',
        }}
      >
        <div
          className="tp-stage-lines"
          style={{
            position: 'relative',
            width: STAGE_WIDTH,
            transformOrigin: '0 0',
            transform: `scale(${frame.scale})`,
            fontFamily,
            fontSize: appearance.fontSize,
            fontWeight: 400,
            color: appearance.textColor,
            whiteSpace: 'pre',
          }}
        >
          {lines.slice(frame.first, frame.last + 1).map((line, i) => (
            <div
              key={frame.first + i}
              className="tp-stage-line"
              data-line={frame.first + i}
              style={{
                position: 'absolute',
                top: line.y,
                left: margin,
                width: STAGE_WIDTH - 2 * margin,
                height: line.height,
                lineHeight: `${line.height}px`,
                textAlign: appearance.align,
              }}
            >
              {line.text}
            </div>
          ))}
        </div>
      </div>
      {guides && (
        <>
          <div className="tp-stage-guide" data-guide="left" aria-hidden="true" style={{ left: `${appearance.marginPct}%` }} />
          <div className="tp-stage-guide" data-guide="right" aria-hidden="true" style={{ left: `${100 - appearance.marginPct}%` }} />
        </>
      )}
      {children}
    </div>
  );
}
