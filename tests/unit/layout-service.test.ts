import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE } from '@shared/defaults';
import { layoutScript } from '@shared/layout';
import type { LayoutResult } from '@shared/types';
import { bindLayoutService, LayoutService, type FontSetLike, type TextMeasurer } from '../../src/renderer/control/layout-service';

/** Canvas falso: Archivo mede 10 px por caractere; outras famílias reais, 12; genéricas, 8. */
function fakeContext(real: string[] = []): TextMeasurer & { fonts: string[] } {
  const ctx = {
    font: '',
    fonts: [] as string[],
    measureText(text: string) {
      ctx.fonts.push(ctx.font);
      const first = /"([^"]+)"/.exec(ctx.font)?.[1];
      const per = first === 'Archivo' ? 10 : first && real.includes(first) ? 12 : 8;
      return { width: Array.from(text).length * per };
    },
  };
  return ctx;
}

const fonts = (fail: string[] = [], faces: string[] = ['Archivo']): FontSetLike & { loaded: string[] } => {
  const set = {
    loaded: [] as string[],
    load(font: string) {
      set.loaded.push(font);
      const family = /"([^"]+)"/.exec(font)?.[1] ?? '';
      if (fail.includes(family)) return Promise.reject(new Error('NetworkError'));
      return Promise.resolve(faces.includes(family) ? [{}] : []);
    },
  };
  return set;
};

const req = (fontFamily: string, text = 'Bom dia a todos os presentes nesta gravação') => ({
  revision: 7,
  text,
  appearance: { ...DEFAULT_APPEARANCE, fontFamily },
});

describe('LayoutService', () => {
  it('UT-023 com document.fonts.load rejeitando "Fonte Sumida", diagrama em Archivo e devolve missingFont', async () => {
    const ctx = fakeContext();
    const service = new LayoutService({ fonts: fonts(['Fonte Sumida']), context: () => ctx });
    const r = await service.layout(req('Fonte Sumida'));
    expect(r.missingFont).toBe('Fonte Sumida');
    expect(r.revision).toBe(7);
    // As medidas foram feitas com a Archivo (10 px por caractere no canvas falso).
    const archivo = layoutScript(req('Fonte Sumida').text, req('Fonte Sumida').appearance, (s) => Array.from(s).length * 10, {
      revision: 7,
      missingFont: 'Fonte Sumida',
    });
    expect(r).toEqual(archivo);
    expect(ctx.fonts.every((f) => f.includes('"Archivo"'))).toBe(true);
  });

  it('fonte que não existe no computador (load sem faces e medida igual à genérica) também cai para Archivo', async () => {
    const service = new LayoutService({ fonts: fonts(), context: () => fakeContext(['Georgia']) });
    expect((await service.layout(req('Fonte Inexistente'))).missingFont).toBe('Fonte Inexistente');
    const ok = await service.layout(req('Georgia'));
    expect(ok.missingFont).toBeNull();
  });

  it('a fonte escolhida e carregada mede com ela mesma', async () => {
    const ctx = fakeContext(['Fonte Boa']);
    const service = new LayoutService({ fonts: fonts([], ['Archivo', 'Fonte Boa']), context: () => ctx });
    const r = await service.layout(req('Fonte Boa'));
    expect(r.missingFont).toBeNull();
    expect(ctx.fonts.at(-1)).toContain('"Fonte Boa"');
  });

  it('UT-024 listFonts devolve as famílias de queryLocalFonts sem repetição e em ordem; sem permissão, só Archivo', async () => {
    const service = new LayoutService({
      fonts: fonts(),
      context: () => fakeContext(),
      queryLocalFonts: async () => [
        { family: 'Verdana' },
        { family: 'Arial' },
        { family: 'Arial' },
        { family: 'Calibri' },
        { family: 'Ébano Sans' },
        { family: 'Verdana' },
      ],
    });
    expect(await service.listFonts()).toEqual(['Arial', 'Calibri', 'Ébano Sans', 'Verdana']);

    const denied = new LayoutService({
      fonts: fonts(),
      context: () => fakeContext(),
      queryLocalFonts: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
    });
    expect(await denied.listFonts()).toEqual(['Archivo']);
    const missing = new LayoutService({ fonts: fonts(), context: () => fakeContext() });
    expect(await missing.listFonts()).toEqual(['Archivo']);
  });

  it('bindLayoutService responde a layout:request e pula pedidos que ficaram velhos', async () => {
    let cb: ((r: ReturnType<typeof req>) => void) | null = null;
    const sent: LayoutResult[] = [];
    const service = new LayoutService({ fonts: fonts(), context: () => fakeContext() });
    bindLayoutService(service, {
      on: (_c, fn) => {
        cb = fn;
        return () => undefined;
      },
      send: (_c, l) => void sent.push(l),
    });
    cb!({ ...req('Archivo'), revision: 1 });
    cb!({ ...req('Archivo'), revision: 2 });
    cb!({ ...req('Archivo'), revision: 3 });
    await new Promise((r) => setTimeout(r, 0));
    expect(sent.map((l) => l.revision).at(-1)).toBe(3);
    expect(sent.map((l) => l.revision)).not.toContain(2);
  });
});
