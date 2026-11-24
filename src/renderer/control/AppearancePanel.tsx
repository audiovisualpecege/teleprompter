/**
 * Painel de aparência (US-008 a US-013): fonte, tamanho, cores do texto, do fundo e da
 * faixa, caixa, alinhamento, margens e posição da faixa. Cada mudança vai ao principal
 * (`cmd:appearance`), que prende os valores aos limites e pede nova diagramação.
 * Contraste baixo entre texto e fundo mostra um aviso, sem bloquear.
 */
import { useEffect, useState } from 'react';
import {
  BAND_POSITION_PCT_MAX,
  BAND_POSITION_PCT_MIN,
  FALLBACK_FONT,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  MARGIN_PCT_MAX,
  MARGIN_PCT_MIN,
} from '@shared/defaults';
import { isLowContrast } from '@shared/text';
import type { Appearance, LetterCase, TextAlign } from '@shared/types';
import { Icon } from '../shared/ui/Icon';
import { Radio, Select } from '../shared/ui/chiaro';
import { ColorField, NumberField } from './fields';
import { useControlStore, useSnapshot } from './hooks';

export const LOW_CONTRAST_MESSAGE = 'O texto pode ficar ilegível com estas cores';

const CASES: { value: LetterCase; label: string }[] = [
  { value: 'normal', label: 'Como foi escrito' },
  { value: 'upper', label: 'Caixa alta' },
  { value: 'lower', label: 'Caixa baixa' },
];

const ALIGNS: { value: TextAlign; label: string }[] = [
  { value: 'center', label: 'Centralizado' },
  { value: 'left', label: 'À esquerda' },
];

export function fontOptions(installed: string[], current: string): string[] {
  return [...new Set([FALLBACK_FONT, current, ...installed])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function AppearancePanel() {
  const store = useControlStore();
  const { appearance } = useSnapshot();
  const [fonts, setFonts] = useState<string[]>([FALLBACK_FONT]);

  useEffect(() => {
    let alive = true;
    void store.listFonts().then((list) => {
      if (alive) setFonts(list);
    });
    return () => {
      alive = false;
    };
  }, [store]);

  const apply = (patch: Partial<Appearance>): void => {
    void store.bridge?.invoke('cmd:appearance', patch).catch(() => undefined);
  };
  const low = isLowContrast(appearance.textColor, appearance.backgroundColor);

  return (
    <div className="tp-appearance">
      <div className="tp-appearance-grid">
        <Select
          label="Fonte"
          value={appearance.fontFamily}
          options={fontOptions(fonts, appearance.fontFamily)}
          onChange={(e) => apply({ fontFamily: e.target.value })}
        />
        <NumberField
          label="Tamanho"
          value={appearance.fontSize}
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          onCommit={(fontSize) => apply({ fontSize })}
        />
        <NumberField
          label="Margens"
          suffix="%"
          value={appearance.marginPct}
          min={MARGIN_PCT_MIN}
          max={MARGIN_PCT_MAX}
          onCommit={(marginPct) => apply({ marginPct })}
        />
        <NumberField
          label="Posição da faixa"
          suffix="%"
          value={appearance.bandPositionPct}
          min={BAND_POSITION_PCT_MIN}
          max={BAND_POSITION_PCT_MAX}
          onCommit={(bandPositionPct) => apply({ bandPositionPct })}
        />
        <ColorField label="Cor do texto" value={appearance.textColor} onCommit={(textColor) => apply({ textColor })} />
        <ColorField
          label="Cor do fundo"
          value={appearance.backgroundColor}
          onCommit={(backgroundColor) => apply({ backgroundColor })}
        />
        <ColorField label="Cor da faixa" alpha value={appearance.bandColor} onCommit={(bandColor) => apply({ bandColor })} />
      </div>
      {low && (
        <p className="tp-warning" role="status">
          <Icon name="danger-triangle" size={18} />
          {LOW_CONTRAST_MESSAGE}
        </p>
      )}
      <div className="tp-appearance-choices">
        <fieldset className="tp-fieldset">
          <legend className="tp-field-label">Caixa</legend>
          {CASES.map((c) => (
            <Radio
              key={c.value}
              name="letterCase"
              value={c.value}
              label={c.label}
              checked={appearance.letterCase === c.value}
              onChange={(on) => on && apply({ letterCase: c.value })}
            />
          ))}
        </fieldset>
        <fieldset className="tp-fieldset">
          <legend className="tp-field-label">Alinhamento</legend>
          {ALIGNS.map((a) => (
            <Radio
              key={a.value}
              name="align"
              value={a.value}
              label={a.label}
              checked={appearance.align === a.value}
              onChange={(on) => on && apply({ align: a.value })}
            />
          ))}
        </fieldset>
      </div>
    </div>
  );
}
