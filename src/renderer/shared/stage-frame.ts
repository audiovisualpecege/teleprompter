/**
 * Conta pura de um quadro do palco (TechSpec, "Posição e limites"; ADR-006). Usada no
 * desenho inicial e a cada quadro, para a prévia e as saídas desenharem igual:
 *
 * - O palco lógico tem 1920 de largura e é escalado pela largura da tela.
 * - A faixa fica em `bandPositionPct` da altura da tela (`bandY`, px da tela).
 * - As linhas sobem com `translate3d(0, bandY - y x escala, 0)`.
 * - Só as linhas a até uma tela de distância da área visível são montadas.
 */
import { LINE_HEIGHT, STAGE_WIDTH } from '@shared/defaults';
import type { Appearance, LayoutLine } from '@shared/types';

export interface Viewport {
  width: number;
  height: number;
}

export interface StageFrame {
  scale: number;
  /** Topo da faixa, em px da tela. */
  bandY: number;
  /** Deslocamento vertical das linhas, em px da tela. */
  translateY: number;
  /** Altura da faixa, em px da tela (uma linha). */
  bandHeight: number;
  /** Primeira e última linha montadas (inclusive); `last < first` quando não há nenhuma. */
  first: number;
  last: number;
}

export function stageScale(viewport: Viewport): number {
  return viewport.width > 0 ? viewport.width / STAGE_WIDTH : 0;
}

/** Primeiro índice cujo `y + height` alcança `lo`. */
function firstFrom(lines: readonly LayoutLine[], lo: number): number {
  let a = 0;
  let b = lines.length;
  while (a < b) {
    const m = (a + b) >> 1;
    if (lines[m].y + lines[m].height < lo) a = m + 1;
    else b = m;
  }
  return a;
}

/** Último índice cujo `y` não passa de `hi`. */
function lastUntil(lines: readonly LayoutLine[], hi: number): number {
  let a = 0;
  let b = lines.length;
  while (a < b) {
    const m = (a + b) >> 1;
    if (lines[m].y <= hi) a = m + 1;
    else b = m;
  }
  return a - 1;
}

export function stageFrame(
  lines: readonly LayoutLine[],
  appearance: Pick<Appearance, 'bandPositionPct' | 'fontSize'>,
  y: number,
  viewport: Viewport,
): StageFrame {
  const scale = stageScale(viewport);
  const bandY = (appearance.bandPositionPct / 100) * viewport.height;
  const translateY = bandY - y * scale;
  const bandHeight = appearance.fontSize * LINE_HEIGHT * scale;
  if (scale <= 0 || lines.length === 0) return { scale, bandY, translateY, bandHeight, first: 0, last: -1 };
  // Área visível em px lógicos, mais uma tela acima e uma abaixo.
  const screen = viewport.height / scale;
  const top = y - bandY / scale;
  const lo = top - screen;
  const hi = top + screen + screen;
  return { scale, bandY, translateY, bandHeight, first: firstFrom(lines, lo), last: lastUntil(lines, hi) };
}

/** Pilha de fontes do palco: a escolhida, a Archivo e as de emoji do sistema. */
export function stageFontStack(fontFamily: string): string {
  const safe = fontFamily.replace(/["\\]/g, '');
  return `"${safe}", "Archivo", "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
}
