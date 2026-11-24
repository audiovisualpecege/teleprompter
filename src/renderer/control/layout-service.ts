/**
 * Diagramação com a fonte real (TechSpec, "Algoritmos principais: Diagramação").
 *
 * - Responde a `layout:request` com um `LayoutResult` medido por
 *   `CanvasRenderingContext2D.measureText`, depois de `document.fonts.load` da fonte.
 * - Fonte que não carrega (ou que não existe no computador) vira Archivo, com
 *   `missingFont` preenchido para a tela avisar.
 * - Lista as fontes instaladas por `queryLocalFonts()` (permissão `local-fonts` dada
 *   pelo processo principal); sem permissão, só a Archivo.
 */
import { FALLBACK_FONT } from '@shared/defaults';
import type { LayoutRequest } from '@shared/ipc';
import { layoutScript, type Measure } from '@shared/layout';
import type { LayoutResult } from '@shared/types';

export interface FontSetLike {
  load(font: string, text?: string): Promise<unknown[]>;
}

export interface TextMeasurer {
  font: string;
  measureText(text: string): { width: number };
}

export interface LayoutServiceDeps {
  fonts: FontSetLike;
  /** Contexto de canvas (ou equivalente) para medir o texto. */
  context: () => TextMeasurer;
  /** `window.queryLocalFonts`, quando existe. */
  queryLocalFonts?: () => Promise<{ family: string }[]>;
}

/** Fonte CSS do canvas com o tamanho e a família (entre aspas). */
export function cssFont(size: number, family: string): string {
  return `400 ${size}px "${family.replace(/["\\]/g, '')}"`;
}

/** Fontes genéricas de comparação para saber se uma família existe de fato. */
const PROBE_TEXT = 'mmmmmmmmmmlliWW@#0Ãçé';
const GENERICS = ['monospace', 'serif', 'sans-serif'] as const;

export class LayoutService {
  private readonly deps: LayoutServiceDeps;
  /** Famílias já conferidas: `true` existe, `false` não. */
  private readonly known = new Map<string, boolean>([[FALLBACK_FONT, true]]);

  constructor(deps: LayoutServiceDeps) {
    this.deps = deps;
  }

  /**
   * A família está disponível? Primeiro carrega pelo `document.fonts` (fontes do
   * programa e instaladas). Se o carregamento falha, não existe. Se ele não devolve
   * nenhuma face (fonte do sistema ou inexistente), compara a largura medida com a das
   * fontes genéricas: uma fonte inexistente cai na genérica e mede igual a ela.
   */
  async available(family: string, size = 80): Promise<boolean> {
    const cached = this.known.get(family);
    if (cached !== undefined) return cached;
    let ok: boolean;
    try {
      const faces = await this.deps.fonts.load(cssFont(size, family));
      ok = faces.length > 0 || this.differsFromGenerics(family);
    } catch {
      ok = false;
    }
    this.known.set(family, ok);
    return ok;
  }

  private differsFromGenerics(family: string): boolean {
    const ctx = this.deps.context();
    const safe = family.replace(/["\\]/g, '');
    return GENERICS.some((g) => {
      ctx.font = `400 72px ${g}`;
      const base = ctx.measureText(PROBE_TEXT).width;
      ctx.font = `400 72px "${safe}", ${g}`;
      return ctx.measureText(PROBE_TEXT).width !== base;
    });
  }

  /** Mede com a fonte e o tamanho dados. */
  measurer(family: string, size: number): Measure {
    const ctx = this.deps.context();
    const font = cssFont(size, family);
    return (text: string) => {
      ctx.font = font;
      return ctx.measureText(text).width;
    };
  }

  async layout(req: LayoutRequest): Promise<LayoutResult> {
    const wanted = req.appearance.fontFamily;
    const found = wanted === FALLBACK_FONT || (await this.available(wanted, req.appearance.fontSize));
    if (!found) await this.available(FALLBACK_FONT);
    const family = found ? wanted : FALLBACK_FONT;
    // A Archivo vem do programa: garante que ela já carregou antes de medir.
    if (family === FALLBACK_FONT) await this.deps.fonts.load(cssFont(req.appearance.fontSize, family)).catch(() => []);
    return layoutScript(req.text, req.appearance, this.measurer(family, req.appearance.fontSize), {
      revision: req.revision,
      missingFont: found ? null : wanted,
    });
  }

  /** Famílias instaladas, sem repetição e em ordem alfabética; sem permissão, só a Archivo. */
  async listFonts(): Promise<string[]> {
    const query = this.deps.queryLocalFonts;
    if (!query) return [FALLBACK_FONT];
    try {
      const faces = await query();
      const families = [...new Set(faces.map((f) => f.family).filter((f) => typeof f === 'string' && f.trim() !== ''))];
      if (families.length === 0) return [FALLBACK_FONT];
      return families.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    } catch {
      return [FALLBACK_FONT];
    }
  }
}

/** O serviço ligado ao documento da janela de controle. */
export function createBrowserLayoutService(doc: Document = document, win: Window = window): LayoutService {
  let ctx: CanvasRenderingContext2D | null = null;
  const query = (win as unknown as { queryLocalFonts?: () => Promise<{ family: string }[]> }).queryLocalFonts;
  return new LayoutService({
    fonts: doc.fonts as unknown as FontSetLike,
    context: () => {
      if (!ctx) ctx = doc.createElement('canvas').getContext('2d');
      if (!ctx) throw new Error('Canvas indisponível para medir o texto');
      return ctx;
    },
    queryLocalFonts: query ? () => query.call(win) : undefined,
  });
}

export interface LayoutBridge {
  on(channel: 'layout:request', cb: (req: LayoutRequest) => void): () => void;
  send(channel: 'layout:result', layout: LayoutResult): void;
}

/**
 * Responde a cada `layout:request`, um de cada vez e na ordem; um pedido que ficou
 * velho enquanto outro esperava é pulado (o principal só aceita a revisão mais nova).
 */
export function bindLayoutService(service: LayoutService, bridge: LayoutBridge, onResult?: (l: LayoutResult) => void): () => void {
  let latest: LayoutRequest | null = null;
  let running = false;
  const pump = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      while (latest) {
        const req = latest;
        latest = null;
        try {
          const result = await service.layout(req);
          if (latest && (latest as LayoutRequest).revision > req.revision) continue;
          bridge.send('layout:result', result);
          onResult?.(result);
        } catch (e) {
          console.error('Falha ao diagramar o roteiro', e);
        }
      }
    } finally {
      running = false;
    }
  };
  return bridge.on('layout:request', (req) => {
    latest = req;
    void pump();
  });
}
