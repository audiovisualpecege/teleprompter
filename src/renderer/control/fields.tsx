/**
 * Campos do painel de aparência. O valor só vale ao sair do campo (ou com Enter):
 * - número fora da faixa é preso ao limite; texto que não é número volta ao valor anterior;
 * - cor que não é um código válido volta à cor anterior.
 *
 * O seletor de cor é um popover escuro próprio (`react-colorful` com os tokens da Chiaro),
 * no lugar do seletor nativo do sistema, que seria claro.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { HexAlphaColorPicker, HexColorPicker } from 'react-colorful';
import { parseColor } from '@shared/text';
import { Input } from '../shared/ui/chiaro';

/** Interpreta o que foi digitado: número com vírgula ou ponto. `null` quando não é número. */
export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function commitNumber(raw: string, previous: number, min: number, max: number): number {
  const n = parseNumber(raw);
  if (n === null) return previous;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Código de cor válido em maiúsculas, ou a cor anterior. */
export function commitColor(raw: string, previous: string): string {
  const s = raw.trim();
  const withHash = s.startsWith('#') ? s : `#${s}`;
  return parseColor(withHash) ? withHash.toUpperCase() : previous;
}

const blurOnEnter = (e: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
  if (e.key === 'Enter') (e.target as HTMLElement).blur();
};

export interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onCommit(value: number): void;
}

export function NumberField({ label, value, min, max, suffix, onCommit }: NumberFieldProps) {
  const [raw, setRaw] = useState(String(value));
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setRaw(String(value));
  }, [value]);
  return (
    <Input
      label={suffix ? `${label} (${suffix})` : label}
      inputMode="numeric"
      title={`De ${min} a ${max}`}
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onFocus={() => {
        editing.current = true;
      }}
      onBlur={() => {
        editing.current = false;
        const next = commitNumber(raw, value, min, max);
        setRaw(String(next));
        if (next !== value) onCommit(next);
      }}
      onKeyDown={blurOnEnter}
    />
  );
}

/** Tamanho do seletor (220 x 180 mais o respiro), para escolher onde ele cabe. */
const POPOVER_WIDTH = 248;
const POPOVER_HEIGHT = 208;
const POPOVER_GAP = 8;

/** Abre abaixo da amostra, ou acima quando não cabe, sempre dentro da janela. */
function placeFor(el: HTMLElement | null): { left: number; top: number } | null {
  const r = el?.getBoundingClientRect();
  if (!r) return null;
  const below = r.bottom + POPOVER_GAP;
  const top = below + POPOVER_HEIGHT <= window.innerHeight ? below : Math.max(POPOVER_GAP, r.top - POPOVER_HEIGHT - POPOVER_GAP);
  return { left: Math.max(POPOVER_GAP, Math.min(r.left, window.innerWidth - POPOVER_WIDTH - POPOVER_GAP)), top };
}

export interface ColorFieldProps {
  label: string;
  value: string;
  /** Aceita transparência (#RRGGBBAA), como a faixa. */
  alpha?: boolean;
  onCommit(value: string): void;
}

export function ColorField({ label, value, alpha, onCommit }: ColorFieldProps) {
  const [raw, setRaw] = useState(value);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const editing = useRef(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const popId = useId();
  useEffect(() => {
    if (!editing.current) setRaw(value);
  }, [value]);

  // Fecha o seletor ao clicar fora dele ou com Esc.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: PointerEvent): void => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    // O seletor acompanha a amostra quando o painel rola ou a janela muda de tamanho.
    const onMove = (): void => setPlace(placeFor(boxRef.current));
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  const toggle = (): void => {
    if (!open) setPlace(placeFor(boxRef.current));
    setOpen((o) => !o);
  };

  const Picker = alpha ? HexAlphaColorPicker : HexColorPicker;
  const pickerValue = alpha ? value : value.slice(0, 7);

  return (
    <div className="tp-color-field" ref={boxRef}>
      <button
        type="button"
        className="tp-color-swatch"
        aria-label={`Escolher ${label.toLowerCase()}`}
        aria-expanded={open}
        aria-controls={popId}
        onClick={toggle}
      >
        <span className="tp-color-swatch-fill" style={{ background: value }} />
      </button>
      <Input
        label={label}
        value={raw}
        spellCheck={false}
        maxLength={9}
        onChange={(e) => setRaw(e.target.value)}
        onFocus={() => {
          editing.current = true;
        }}
        onBlur={() => {
          editing.current = false;
          const next = commitColor(raw, value);
          setRaw(next);
          if (next !== value) onCommit(next);
        }}
        onKeyDown={blurOnEnter}
      />
      {open && (
        <div
          className="tp-color-popover"
          id={popId}
          role="dialog"
          aria-label={label}
          ref={popRef}
          style={place ? { left: place.left, top: place.top } : undefined}
        >
          <Picker
            color={pickerValue}
            onChange={(c: string) => {
              const next = c.toUpperCase();
              setRaw(next);
              onCommit(next);
            }}
          />
        </div>
      )}
    </div>
  );
}
