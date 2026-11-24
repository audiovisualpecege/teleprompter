import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE } from '@shared/defaults';
import type { LayoutResult } from '@shared/types';
import { Stage } from '../../src/renderer/shared/Stage';
import { stageFrame } from '../../src/renderer/shared/stage-frame';
import { gridLayout, layoutOf } from '../fakes/layouts';

const translateOf = (el: Element): number => {
  const m = /translate3d\(0px, (-?[\d.]+)px, 0px\)/.exec((el as HTMLElement).style.transform);
  if (!m) throw new Error(`sem translate3d: ${(el as HTMLElement).style.transform}`);
  return Number(m[1]);
};

function stage(layout: LayoutResult, y: number, viewport = { width: 1920, height: 1080 }) {
  return render(
    <Stage layout={layout} appearance={layout.appearance} segment={{ kind: 'hold', y }} now={() => 0} viewport={viewport} />,
  );
}

describe('Stage', () => {
  it('UT-246 numa tela de 1280 x 1024, faixa em 33% e y = 300: escala 1280/1920 e translate3d(0, 337,92 - 300 x escala, 0)', () => {
    const layout = layoutOf('Bom dia.\n\nEste é o roteiro de teste com várias palavras para quebrar em linhas.', {
      ...DEFAULT_APPEARANCE,
      bandPositionPct: 33,
    });
    const { container } = stage(layout, 300, { width: 1280, height: 1024 });
    const scale = 1280 / 1920;
    expect(translateOf(container.querySelector('.tp-stage-scroll')!)).toBeCloseTo(337.92 - 300 * scale, 6);
    const lines = container.querySelector('.tp-stage-lines') as HTMLElement;
    expect(Number(/scale\(([\d.]+)\)/.exec(lines.style.transform)![1])).toBeCloseTo(scale, 9);
    expect(lines.style.width).toBe('1920px');
    // As mesmas linhas recebidas, sem nova quebra.
    expect([...container.querySelectorAll('.tp-stage-line')].map((l) => l.textContent)).toEqual(layout.lines.map((l) => l.text));
    // E a faixa a 33% da altura da tela.
    expect((container.querySelector('.tp-stage-band') as HTMLElement).style.top).toBe(`${0.33 * 1024}px`);
  });

  it('UT-247 com 5.000 linhas, monta só as linhas a até uma tela de distância da área visível', () => {
    const layout = gridLayout(5000, 100, 30, 25000);
    const y = 250_000;
    const viewport = { width: 1920, height: 1080 };
    const { container } = stage(layout, y, viewport);
    const mounted = [...container.querySelectorAll<HTMLElement>('.tp-stage-line')].map((l) => Number(l.dataset.line));
    // Área visível: de y - faixa até y - faixa + altura; mais uma tela acima e uma abaixo.
    const bandY = 0.33 * 1080;
    const lo = y - bandY - 1080;
    const hi = y - bandY + 2 * 1080;
    const expected = layout.lines.map((l, i) => ({ l, i })).filter(({ l }) => l.y + l.height >= lo && l.y <= hi).map(({ i }) => i);
    expect(mounted).toEqual(expected);
    expect(mounted.length).toBeLessThan(40);
    expect(mounted).toContain(2500);
    // Fora da faixa de distância, nenhuma linha.
    expect(mounted[0]).toBeGreaterThan(2400);
    expect(stageFrame(layout.lines, layout.appearance, 0, viewport).first).toBe(0);
  });

  it('UT-249 a faixa fica numa camada abaixo do texto, e com #FACE95FF o texto continua visível', () => {
    const layout = layoutOf('Uma linha de texto', { ...DEFAULT_APPEARANCE, bandColor: '#FACE95FF' });
    const { container } = stage(layout, 0);
    const band = container.querySelector('.tp-stage-band') as HTMLElement;
    const text = container.querySelector('.tp-stage-scroll') as HTMLElement;
    expect(band.style.background.replace(/\s/g, '').toLowerCase()).toMatch(/#face95ff|rgb\(250,206,149\)|rgba\(250,206,149,1\)/);
    expect(Number(band.style.zIndex)).toBeLessThan(Number(text.style.zIndex));
    // O texto vem depois da faixa no DOM e não recebe a cor da faixa.
    expect(band.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((container.querySelector('.tp-stage-lines') as HTMLElement).style.color).toBe('rgb(255, 255, 255)');
    expect(container.querySelector('.tp-stage-line')?.textContent).toBe('Uma linha de texto');
  });

  it('UT-250 a pilha de fontes do palco tem a escolhida, a Archivo e as de emoji', () => {
    const layout = layoutOf('Texto', { ...DEFAULT_APPEARANCE, fontFamily: 'Fonte Escolhida' });
    const { container } = stage(layout, 0);
    const family = (container.querySelector('.tp-stage-lines') as HTMLElement).style.fontFamily;
    expect(family.replace(/'/g, '"')).toBe('"Fonte Escolhida", "Archivo", "Segoe UI Emoji", "Apple Color Emoji", sans-serif');
    expect((container.querySelector('.tp-stage-lines') as HTMLElement).style.whiteSpace).toBe('pre');
  });

  it('com a fonte ausente, desenha em Archivo, a mesma usada para medir', () => {
    const layout = { ...layoutOf('Texto', { ...DEFAULT_APPEARANCE, fontFamily: 'Fonte Sumida' }), missingFont: 'Fonte Sumida' };
    const { container } = stage(layout, 0);
    const family = (container.querySelector('.tp-stage-lines') as HTMLElement).style.fontFamily.replace(/'/g, '"');
    expect(family.startsWith('"Archivo"')).toBe(true);
  });
});
