/**
 * Combinações de teclas, iguais no principal (`KeymapService`) e na tela de atalhos:
 * normalização, identidade e teclas reservadas do sistema.
 */
import type { KeyCombo } from './types';

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'OS', 'CapsLock', 'Fn', 'Hyper', 'Super']);

/** Tecla como guardada: letras em minúscula, Espaço como `' '`, Esc como `Escape`. */
export function normalizeKey(key: string): string {
  if (key === 'Spacebar') return ' ';
  if (key === 'Esc') return 'Escape';
  if (key === 'Win') return 'Meta';
  return Array.from(key).length === 1 ? key.toLocaleLowerCase('en-US') : key;
}

/** Um caractere só que não é letra ("+", "-"): o Shift já está no próprio caractere. */
const isSymbol = (key: string): boolean => Array.from(key).length === 1 && key !== ' ' && key.toLowerCase() === key.toUpperCase();

export function normalizeCombo(c: KeyCombo): KeyCombo {
  const key = normalizeKey(c.key);
  return { key, ctrlOrCmd: Boolean(c.ctrlOrCmd), shift: isSymbol(key) ? false : Boolean(c.shift), alt: Boolean(c.alt) };
}

export function comboId(c: KeyCombo): string {
  const n = normalizeCombo(c);
  return `${n.ctrlOrCmd ? 'C' : ''}${n.alt ? 'A' : ''}${n.shift ? 'S' : ''}|${n.key}`;
}

export const sameCombo = (a: KeyCombo, b: KeyCombo): boolean => comboId(a) === comboId(b);

export const isModifierKey = (key: string): boolean => MODIFIER_KEYS.has(key) && key !== 'Meta';

/** Uma tecla (do `before-input-event` ou do `KeyboardEvent`) como `KeyCombo`; `null` para uma modificadora sozinha. */
export function comboFromInput(
  input: { key: string; control?: boolean; meta?: boolean; shift?: boolean; alt?: boolean },
  mac: boolean,
): KeyCombo | null {
  if (!input.key || (MODIFIER_KEYS.has(input.key) && input.key !== 'Meta')) return null;
  return normalizeCombo({
    key: input.key,
    ctrlOrCmd: Boolean(mac ? input.meta : input.control),
    shift: Boolean(input.shift),
    alt: Boolean(input.alt),
  });
}

const c = (key: string, mods: Partial<Omit<KeyCombo, 'key'>> = {}): KeyCombo => ({
  key,
  ctrlOrCmd: mods.ctrlOrCmd ?? false,
  shift: mods.shift ?? false,
  alt: mods.alt ?? false,
});

/**
 * Teclas reservadas do sistema: Alt+F4, Alt+Tab, Ctrl+Alt+Delete, Win, Cmd+Q, Cmd+Tab,
 * Cmd+H, Cmd+M, Cmd+Espaço, Ctrl+Esc e Esc. Como `ctrlOrCmd` vale para os dois sistemas,
 * as do Mac ficam reservadas também no Windows (os ajustes são do computador, não do sistema).
 */
export const RESERVED_COMBOS: readonly KeyCombo[] = [
  c('F4', { alt: true }),
  c('Tab', { alt: true }),
  c('Delete', { ctrlOrCmd: true, alt: true }),
  c('q', { ctrlOrCmd: true }),
  c('Tab', { ctrlOrCmd: true }),
  c('h', { ctrlOrCmd: true }),
  c('m', { ctrlOrCmd: true }),
  c(' ', { ctrlOrCmd: true }),
];

export function isReserved(combo: KeyCombo): boolean {
  const n = normalizeCombo(combo);
  // Esc (com ou sem Ctrl) e a tecla Win/Cmd sozinha.
  if (n.key === 'Escape' || n.key === 'Meta') return true;
  const loose = (x: KeyCombo): string => comboId({ ...x, shift: false });
  return RESERVED_COMBOS.some((r) => loose(r) === loose(n));
}

