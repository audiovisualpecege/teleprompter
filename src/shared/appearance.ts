/**
 * Aparência do roteiro com os limites de cada campo (TechSpec, "Modelos de dados").
 * Valores numéricos fora da faixa são presos ao limite; valores inválidos mantêm o
 * valor de base. Usada por `cmd:appearance`, pelo `.roteiro` e pelo `ajustes.json`.
 */
import {
  BAND_POSITION_PCT_MAX,
  BAND_POSITION_PCT_MIN,
  DEFAULT_APPEARANCE,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  MARGIN_PCT_MAX,
  MARGIN_PCT_MIN,
} from './defaults';
import { parseColor } from './text';
import type { Appearance } from './types';

const num = (v: unknown, lo: number, hi: number, base: number): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) return base;
  return Math.min(hi, Math.max(lo, n));
};

const color = (v: unknown, base: string): string =>
  typeof v === 'string' && parseColor(v) ? v.trim().toUpperCase() : base;

const oneOf = <T extends string>(v: unknown, options: readonly T[], base: T): T =>
  options.includes(v as T) ? (v as T) : base;

/**
 * Aplica `patch` sobre `base`, campo a campo, com os limites da aparência.
 * Campos ausentes ou inválidos ficam como em `base`. A ordem das chaves é sempre a
 * mesma, para que dois arquivos gravados com a mesma aparência tenham os mesmos bytes.
 */
export function sanitizeAppearance(
  patch: Partial<Record<keyof Appearance, unknown>> | null | undefined,
  base: Appearance = DEFAULT_APPEARANCE,
): Appearance {
  const p = patch && typeof patch === 'object' ? patch : {};
  const font = typeof p.fontFamily === 'string' && p.fontFamily.trim() !== '' ? p.fontFamily.trim() : base.fontFamily;
  return {
    fontFamily: font,
    fontSize: num(p.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX, base.fontSize),
    textColor: color(p.textColor, base.textColor),
    backgroundColor: color(p.backgroundColor, base.backgroundColor),
    bandColor: color(p.bandColor, base.bandColor),
    letterCase: oneOf(p.letterCase, ['normal', 'upper', 'lower'] as const, base.letterCase),
    align: oneOf(p.align, ['center', 'left'] as const, base.align),
    marginPct: num(p.marginPct, MARGIN_PCT_MIN, MARGIN_PCT_MAX, base.marginPct),
    bandPositionPct: num(p.bandPositionPct, BAND_POSITION_PCT_MIN, BAND_POSITION_PCT_MAX, base.bandPositionPct),
  };
}

export function sameAppearance(a: Appearance, b: Appearance): boolean {
  return (Object.keys(DEFAULT_APPEARANCE) as (keyof Appearance)[]).every((k) => a[k] === b[k]);
}
