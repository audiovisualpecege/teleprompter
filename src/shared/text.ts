/**
 * Texto para a voz e cores para os avisos de contraste (TechSpec, "Voz" e "Contraste").
 * Funções puras: nunca lançam erro por entrada do usuário.
 */
import { LOW_CONTRAST_RATIO } from './defaults';

/* ---------- Números por extenso (pt-BR) ---------- */

const UNITS = [
  'zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
];
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const HUNDREDS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos',
];
const SCALES: [string, string][] = [
  ['', ''],
  ['mil', 'mil'],
  ['milhão', 'milhões'],
  ['bilhão', 'bilhões'],
  ['trilhão', 'trilhões'],
];

/** 1..999 por extenso. */
function below1000(n: number): string[] {
  if (n === 100) return ['cem'];
  const out: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h > 0) out.push(HUNDREDS[h]);
  if (rest > 0) {
    if (out.length) out.push('e');
    if (rest < 20) out.push(UNITS[rest]);
    else {
      out.push(TENS[Math.floor(rest / 10)]);
      if (rest % 10) out.push('e', UNITS[rest % 10]);
    }
  }
  return out;
}

/**
 * Um número inteiro escrito com algarismos, por extenso em pt-BR, uma palavra por item.
 * Números longos demais (mais de 15 algarismos) e os que começam com zero são lidos
 * algarismo por algarismo, como se fala um código.
 */
export function numberToWords(digits: string): string[] {
  if (!/^\d+$/.test(digits)) return [];
  if (digits.length > 15 || (digits.length > 1 && digits.startsWith('0'))) {
    return [...digits].map((d) => UNITS[Number(d)]);
  }
  let n = Number(digits);
  if (n === 0) return ['zero'];
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const parts: string[][] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    let words: string[];
    if (i === 1 && g === 1) words = ['mil'];
    else {
      words = below1000(g);
      if (i > 0) words.push(g === 1 ? SCALES[i][0] : SCALES[i][1]);
    }
    parts.push(words);
  }
  // "e" antes do último grupo quando ele é menor que 100 ou é centena redonda.
  const out: string[] = [];
  const lastGroup = groups[0];
  parts.forEach((p, idx) => {
    const isLast = idx === parts.length - 1;
    if (idx > 0 && isLast && lastGroup > 0 && (lastGroup < 100 || lastGroup % 100 === 0)) out.push('e');
    out.push(...p);
  });
  return out;
}

/* ---------- Normalização ---------- */

const stripAccents = (s: string): string => s.normalize('NFD').replace(/\p{M}+/gu, '');

/**
 * Tokens normalizados para comparar com a voz: minúsculas, sem acento, sem pontuação,
 * números por extenso (um token por palavra). "2026" vira "dois mil e vinte e seis".
 */
export function normalizeTokens(text: string): string[] {
  return tokenize(text, false);
}

/** Palavras faladas: como `normalizeTokens`, mas com os acentos (forma do léxico do Vosk). */
export function spokenTokens(text: string): string[] {
  return tokenize(text, true);
}

function tokenize(text: string, keepAccents: boolean): string[] {
  const fold = keepAccents ? (s: string): string => s.normalize('NFC') : stripAccents;
  const prepared = text
    .toLocaleLowerCase('pt-BR')
    // Separador de milhar ("1.000") e decimais ("1,5").
    .replace(/(\d)\.(?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d),(\d)/g, '$1 vírgula $2')
    .replace(/%/g, ' por cento ')
    // Algarismos colados a letras ("10h", "3d") viram palavras separadas.
    .replace(/(\d)(?=\p{L})|(\p{L})(?=\d)/gu, '$1$2 ');
  const out: string[] = [];
  for (const raw of fold(prepared).split(/[^\p{L}\p{M}\p{N}]+/u)) {
    if (!raw) continue;
    if (/^\d+$/.test(raw)) {
      for (const w of numberToWords(raw)) out.push(fold(w));
    } else out.push(raw);
  }
  return out;
}

/** Vocabulário do Vosk: palavras normalizadas únicas, na ordem em que aparecem, mais `[unk]`. */
export function buildVocabulary(text: string): string[] {
  return [...new Set(normalizeTokens(text)), '[unk]'];
}

/**
 * Gramática que o Vosk de fato usa: as palavras do roteiro COM acento, porque o léxico do
 * modelo em português guarda "atenção", não "atencao", e o Vosk descarta da gramática a
 * palavra que não conhece. O alinhador continua comparando sem acento.
 */
export function buildSpokenVocabulary(text: string): string[] {
  return [...new Set(spokenTokens(text)), '[unk]'];
}

/* ---------- Cores e contraste ---------- */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** 0..1 */
  a: number;
}

/** Lê `#RGB`, `#RGBA`, `#RRGGBB` ou `#RRGGBBAA`. Código inválido devolve `null`. */
export function parseColor(input: string): Rgba | null {
  if (typeof input !== 'string') return null;
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(input.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('');
  const byte = (i: number): number => parseInt(hex.slice(i, i + 2), 16);
  return { r: byte(0), g: byte(2), b: byte(4), a: hex.length === 8 ? byte(6) / 255 : 1 };
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance({ r, g, b }: Rgba): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Cor translúcida composta sobre um fundo opaco. */
function over(fg: Rgba, bg: Rgba): Rgba {
  const a = fg.a;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}

/**
 * Razão de contraste WCAG entre o texto e o fundo, de 1 a 21.
 * Cores inválidas devolvem `null`.
 */
export function contrastRatio(text: string, background: string): number | null {
  const fg = parseColor(text);
  const bg = parseColor(background);
  if (!fg || !bg) return null;
  const solidBg = bg.a < 1 ? over(bg, { r: 0, g: 0, b: 0, a: 1 }) : bg;
  const solidFg = fg.a < 1 ? over(fg, solidBg) : fg;
  const l1 = luminance(solidFg);
  const l2 = luminance(solidBg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Contraste abaixo de 3:1 (o aviso não bloqueia). A razão é comparada com duas casas,
 * como os verificadores de contraste a mostram, então 3,00 não gera aviso.
 * Cores inválidas não geram aviso de contraste (o aviso delas é outro).
 */
export function isLowContrast(text: string, background: string): boolean {
  const ratio = contrastRatio(text, background);
  if (ratio === null) return false;
  return Math.round(ratio * 100) / 100 < LOW_CONTRAST_RATIO;
}
