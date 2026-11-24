/** Layouts de teste (`_tests.md`, "Layout de referência dos testes de rolagem"). */
import { DEFAULT_APPEARANCE } from '@shared/defaults';
import { layoutScript } from '@shared/layout';
import type { Appearance, LayoutLine, LayoutResult } from '@shared/types';

/** `measure` falso de 10 px por caractere. */
export const measure10 = (s: string): number => Array.from(s).length * 10;

/** Diagrama como a tela faria, com o `measure` falso. */
export function layoutOf(text: string, appearance: Appearance = DEFAULT_APPEARANCE, revision = 0): LayoutResult {
  return layoutScript(text, appearance, measure10, { revision });
}

/** Layout feito à mão: `n` linhas de `height` px, `chars` caracteres cada, `words` palavras ao todo. */
export function gridLayout(n: number, height: number, chars: number, words: number, revision = 0): LayoutResult {
  const lines: LayoutLine[] = Array.from({ length: n }, (_, i) => ({
    text: 'x'.repeat(chars),
    start: i * chars,
    end: (i + 1) * chars,
    y: i * height,
    height,
  }));
  return {
    revision,
    appearance: { ...DEFAULT_APPEARANCE },
    lines,
    totalHeight: n * height,
    wordCount: words,
    missingFont: null,
  };
}

/** Layout de referência: 10 linhas de 100 px (`y` de 0 a 900), 60 palavras. */
export const referenceLayout = (): LayoutResult => gridLayout(10, 100, 30, 60);
