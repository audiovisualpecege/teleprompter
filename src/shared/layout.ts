/**
 * Diagramação pura no palco lógico (TechSpec, "Algoritmos principais: Diagramação").
 *
 * - Não recebe tamanho de tela: as quebras são as mesmas em qualquer resolução.
 * - `measure` é injetado (na tela, `CanvasRenderingContext2D.measureText` com a fonte
 *   já carregada; nos testes, largura fixa por caractere).
 * - A caixa (alta ou baixa) muda só o texto exibido; `start` e `end` apontam sempre
 *   para o texto guardado, que nunca muda.
 * - Quebras do texto: cada `\n` começa uma linha nova; uma ou mais linhas em branco
 *   separam parágrafos e somam um `PARAGRAPH_GAP`.
 */
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  LINE_HEIGHT,
  MARGIN_PCT_MAX,
  MARGIN_PCT_MIN,
  PARAGRAPH_GAP,
  STAGE_WIDTH,
} from './defaults';
import type { Appearance, LayoutLine, LayoutResult, LetterCase } from './types';

/** Largura, em px lógicos, do texto desenhado com a fonte e o tamanho da aparência. */
export type Measure = (text: string) => number;

export interface LayoutOptions {
  revision?: number;
  missingFont?: string | null;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Aplica a caixa escolhida ao texto exibido, com as regras do português. */
export function applyCase(text: string, letterCase: LetterCase): string {
  if (letterCase === 'upper') return text.toLocaleUpperCase('pt-BR');
  if (letterCase === 'lower') return text.toLocaleLowerCase('pt-BR');
  return text;
}

/** Largura útil da linha no palco lógico: `1920 x (1 - 2 x margem)`. */
export function usableWidth(appearance: Pick<Appearance, 'marginPct'>): number {
  const margin = clamp(appearance.marginPct, MARGIN_PCT_MIN, MARGIN_PCT_MAX) / 100;
  return STAGE_WIDTH * (1 - 2 * margin);
}

const WORD_RE = /\S+/g;
const HAS_WORD_CHAR = /[\p{L}\p{N}]/u;

/** Número de palavras (sequências sem espaço com ao menos uma letra ou algarismo). */
export function wordCount(text: string): number {
  let n = 0;
  for (const m of text.matchAll(WORD_RE)) if (HAS_WORD_CHAR.test(m[0])) n++;
  return n;
}

/** Fronteiras dos caracteres visíveis (grafemas), para não partir acentos nem emojis. */
function graphemeEnds(word: string): number[] {
  const ends: number[] = [];
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) {
    for (const s of new Seg('pt-BR', { granularity: 'grapheme' }).segment(word)) {
      ends.push(s.index + s.segment.length);
    }
  } else {
    let i = 0;
    for (const ch of word) ends.push((i += ch.length));
  }
  return ends;
}

export function layoutScript(
  text: string,
  appearance: Appearance,
  measure: Measure,
  options: LayoutOptions = {},
): LayoutResult {
  const fontSize = clamp(appearance.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX);
  const lineHeight = fontSize * LINE_HEIGHT;
  const gap = fontSize * PARAGRAPH_GAP;
  const maxWidth = usableWidth(appearance);
  const show = (s: number, e: number): string => applyCase(text.slice(s, e), appearance.letterCase);
  const fits = (s: number, e: number): boolean => measure(show(s, e)) <= maxWidth;

  const lines: LayoutLine[] = [];
  let y = 0;
  let pendingGap = false;

  const push = (start: number, end: number): void => {
    if (lines.length > 0) {
      y += lineHeight;
      if (pendingGap) y += gap;
    }
    pendingGap = false;
    lines.push({ text: show(start, end), start, end, y, height: lineHeight });
  };

  let offset = 0;
  for (const raw of text.split('\n')) {
    const base = offset;
    offset += raw.length + 1;
    const words = [...raw.matchAll(WORD_RE)].map((m) => ({
      start: base + (m.index ?? 0),
      end: base + (m.index ?? 0) + m[0].length,
    }));
    if (words.length === 0) {
      if (lines.length > 0) pendingGap = true;
      continue;
    }

    let lineStart = -1;
    let lineEnd = -1;
    for (const w of words) {
      if (lineStart >= 0 && fits(lineStart, w.end)) {
        lineEnd = w.end;
        continue;
      }
      if (lineStart >= 0) push(lineStart, lineEnd);
      if (fits(w.start, w.end)) {
        lineStart = w.start;
        lineEnd = w.end;
        continue;
      }
      // Palavra maior que a linha: quebra por caractere, sempre ao menos um por linha.
      let chunkStart = w.start;
      let chunkEnd = w.start;
      for (const rel of graphemeEnds(text.slice(w.start, w.end))) {
        const next = w.start + rel;
        if (chunkEnd > chunkStart && !fits(chunkStart, next)) {
          push(chunkStart, chunkEnd);
          chunkStart = chunkEnd;
        }
        chunkEnd = next;
      }
      lineStart = chunkStart;
      lineEnd = chunkEnd;
    }
    push(lineStart, lineEnd);
  }

  const last = lines.at(-1);
  return {
    revision: options.revision ?? 0,
    appearance: { ...appearance },
    lines,
    totalHeight: last ? last.y + last.height : 0,
    wordCount: wordCount(text),
    missingFont: options.missingFont ?? null,
  };
}
