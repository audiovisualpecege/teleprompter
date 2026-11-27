import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, LINE_HEIGHT, PARAGRAPH_GAP } from '@shared/defaults';
import { layoutScript, usableWidth, wordCount } from '@shared/layout';
import type { Appearance } from '@shared/types';

/** `measure` falso de 10 px por caractere visível. */
const measure10 = (s: string): number => Array.from(s).length * 10;
const look = (over: Partial<Appearance> = {}): Appearance => ({ ...DEFAULT_APPEARANCE, ...over });

describe('layout', () => {
  it('UT-010 layout: dois parágrafos viram 2 linhas com o espaço de parágrafo entre elas', () => {
    const r = layoutScript('Primeiro.\n\nSegundo.', look(), measure10);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0].text).toBe('Primeiro.');
    expect(r.lines[1].text).toBe('Segundo.');
    expect(r.lines[1].y).toBe(r.lines[0].y + 1.25 * 80 + 0.6 * 80);
  });

  it('UT-011 layout: margem de 10% respeita 1536 px sem cortar palavras', () => {
    expect(usableWidth(look({ marginPct: 10 }))).toBe(1536);
    const words = Array.from({ length: 40 }, (_, i) => String.fromCharCode(97 + (i % 26)).repeat(5));
    const r = layoutScript(words.join(' '), look({ marginPct: 10 }), measure10);
    expect(r.lines.length).toBeGreaterThan(1);
    for (const line of r.lines) {
      expect(measure10(line.text)).toBeLessThanOrEqual(1536);
      for (const w of line.text.split(' ')) expect(w).toHaveLength(5);
    }
    expect(r.lines.flatMap((l) => l.text.split(' '))).toEqual(words);
  });

  it('UT-012 layout: palavra de 300 letras quebra por caractere em linhas consecutivas', () => {
    const word = Array.from({ length: 300 }, (_, i) => 'abcdefghij'[i % 10]).join('');
    const r = layoutScript(word, look(), measure10);
    expect(r.lines.length).toBeGreaterThan(1);
    expect(r.lines.map((l) => l.text).join('')).toBe(word);
    r.lines.forEach((l, i) => {
      expect(measure10(l.text)).toBeLessThanOrEqual(1536);
      if (i > 0) expect(l.start).toBe(r.lines[i - 1].end);
    });
    expect(r.lines.at(-1)!.end).toBe(300);
  });

  it('UT-013 layout: caixa alta em pt-BR muda só o texto exibido', () => {
    const text = 'ação e coração';
    const r = layoutScript(text, look({ letterCase: 'upper' }), measure10);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].text).toBe('AÇÃO E CORAÇÃO');
    expect(r.lines[0].start).toBe(0);
    expect(r.lines[0].end).toBe(text.length);
    expect(text.slice(r.lines[0].start, r.lines[0].end)).toBe('ação e coração');
  });

  it('UT-014 layout: caixa baixa exibe "ação"', () => {
    expect(layoutScript('AÇÃO', look({ letterCase: 'lower' }), measure10).lines[0].text).toBe('ação');
  });

  it('UT-015 layout: caixa normal exibe como foi escrito, sem mudar o texto guardado', () => {
    const text = 'Ação';
    const r = layoutScript(text, look({ letterCase: 'normal' }), measure10);
    expect(r.lines[0].text).toBe('Ação');
    expect(text).toBe('Ação');
    expect(text.slice(r.lines[0].start, r.lines[0].end)).toBe('Ação');
  });

  it.each([200, 300])('UT-016 layout: margem 40% e fonte %i deixam ao menos uma palavra por linha', (fontSize) => {
    const text = 'Uma frase com palavras curtas e uma muito comprida: inconstitucionalissimamenteeeeeeeeeeeeeeeee fim';
    const r = layoutScript(text, look({ marginPct: 40, fontSize }), measure10);
    expect(r.lines.length).toBeGreaterThan(1);
    for (const line of r.lines) {
      expect(line.text.trim().length).toBeGreaterThan(0);
      expect(line.end).toBeGreaterThan(line.start);
      expect(measure10(line.text)).toBeLessThanOrEqual(384);
    }
  });

  it('UT-017 layout: não recebe tamanho de tela e a mesma entrada dá as mesmas linhas', () => {
    expect(layoutScript.length).toBe(3); // texto, aparência, medida (+ opções com padrão)
    const text = 'Um roteiro qualquer, com várias palavras.\n\nE outro parágrafo para conferir.';
    const a = layoutScript(text, look({ marginPct: 25 }), measure10);
    const b = layoutScript(text, look({ marginPct: 25 }), measure10);
    expect(a.lines).toEqual(b.lines);
  });

  it('UT-018 layout: fonte 80 dá linhas de 100 e totalHeight soma alturas e espaços', () => {
    const text = 'Um.\nDois.\n\nTrês.\n\n\nQuatro.';
    const r = layoutScript(text, look({ fontSize: 80 }), measure10);
    expect(r.lines).toHaveLength(4);
    for (const l of r.lines) expect(l.height).toBe(100);
    const gaps = 2 * PARAGRAPH_GAP * 80;
    expect(r.totalHeight).toBe(4 * LINE_HEIGHT * 80 + gaps);
    expect(r.lines.map((l) => l.y)).toEqual([0, 100, 248, 396]);
  });

  it('UT-019 layout: acentos e emojis chegam às linhas com os mesmos caracteres', () => {
    const text = 'Olá, coração 🎬 ñ';
    const r = layoutScript(text, look(), measure10);
    expect(r.lines.map((l) => l.text).join(' ')).toBe(text);
  });

  it('UT-020 layout: 300.000 caracteres em menos de 500 ms', () => {
    const para = 'Roteiro de teste com palavras de tamanhos variados para encher a página inteira. ';
    let text = '';
    while (text.length < 300_000) text += para + (text.length % 3 === 0 ? '\n\n' : '');
    text = text.slice(0, 300_000);
    const t0 = performance.now();
    const r = layoutScript(text, look(), measure10);
    const ms = performance.now() - t0;
    expect(r.lines.length).toBeGreaterThan(1000);
    expect(ms).toBeLessThan(500);
  });

  it('UT-021 layout: wordCount de "Um dois, três.\\nQuatro" é 4', () => {
    expect(wordCount('Um dois, três.\nQuatro')).toBe(4);
    expect(layoutScript('Um dois, três.\nQuatro', look(), measure10).wordCount).toBe(4);
  });

  it('UT-022 layout: centralizado e à esquerda produzem as mesmas quebras', () => {
    const text = 'Sim.\nNão.\nTalvez uma linha bem mais longa que precisa quebrar no meio do caminho por causa da margem.';
    const center = layoutScript(text, look({ align: 'center', marginPct: 30 }), measure10);
    const left = layoutScript(text, look({ align: 'left', marginPct: 30 }), measure10);
    expect(center.lines).toEqual(left.lines);
    expect(center.lines[0].text).toBe('Sim.');
    expect(center.lines[1].text).toBe('Não.');
  });

  it('layout: texto vazio não tem linhas', () => {
    const r = layoutScript('  \n\n ', look(), measure10, { revision: 7, missingFont: 'Fonte X' });
    expect(r.lines).toEqual([]);
    expect(r.totalHeight).toBe(0);
    expect(r.revision).toBe(7);
    expect(r.missingFont).toBe('Fonte X');
  });
});
