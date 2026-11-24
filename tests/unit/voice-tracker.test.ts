import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, NEAR_WINDOW_TOKENS } from '@shared/defaults';
import { layoutScript } from '@shared/layout';
import { buildSpokenVocabulary, normalizeTokens, spokenTokens } from '@shared/text';
import type { ScriptToken } from '@shared/types';
import {
  buildScriptTokens,
  resyncFromBand,
  track,
  wordSimilarity,
  type TrackerInput,
  type TrackerResult,
} from '../../src/main/voice-tracker';

const SCRIPT =
  'o teleprompter da chiaro acompanha a leitura de quem lê o texto no vidro com calma e atenção até o fim da gravação';
// o0 teleprompter1 da2 chiaro3 acompanha4 a5 leitura6 de7 quem8 le9 o10 texto11 no12
// vidro13 com14 calma15 e16 atencao17 ate18 o19 fim20 da21 gravacao22

const measure = (s: string): number => s.length * 10;
const tokensOf = (text: string): ScriptToken[] =>
  buildScriptTokens(text, layoutScript(text, DEFAULT_APPEARANCE, measure).lines);
const TOKENS = tokensOf(SCRIPT);

/** Todo resultado passa por aqui: o cursor nunca volta. */
function run(input: Partial<TrackerInput> & Pick<TrackerInput, 'heard'>): TrackerResult {
  const full: TrackerInput = { tokens: TOKENS, cursor: 0, mode: 'near', ...input };
  const r = track(full);
  expect(r.cursor).toBeGreaterThanOrEqual(full.cursor);
  return r;
}

describe('voice-tracker', () => {
  it('normaliza o roteiro de teste nos índices esperados', () => {
    expect(TOKENS.map((t) => t.norm)).toEqual(
      'o teleprompter da chiaro acompanha a leitura de quem le o texto no vidro com calma e atencao ate o fim da gravacao'.split(' '),
    );
    expect(NEAR_WINDOW_TOKENS).toBeLessThan(17);
  });

  it('UT-063 voice-tracker: duas de três palavras em ordem avançam o cursor', () => {
    expect(run({ heard: ['teleprompter', 'da', 'chiaro'] })).toEqual({ cursor: 3, matched: true, jumped: false });
  });

  it('UT-064 voice-tracker: palavras só depois da janela curta não movem no "Perto"', () => {
    // "atenção até o fim": índices 17 a 20, além de cursor + 15.
    expect(run({ heard: ['atenção', 'até', 'o', 'fim'] })).toEqual({ cursor: 0, matched: false, jumped: false });
  });

  it('UT-065 voice-tracker: palavra parecida (0,91) também bate', () => {
    expect(wordSimilarity('teleprompte', 'teleprompter')).toBeCloseTo(11 / 12, 5);
    expect(run({ heard: ['teleprompte', 'da', 'chiaro'] }).cursor).toBe(3);
  });

  it('UT-066 voice-tracker: só [unk] não casa', () => {
    expect(run({ heard: ['[unk]', '[unk]', '[unk]'] }).matched).toBe(false);
  });

  it('UT-067 voice-tracker: frase já lida não faz voltar', () => {
    expect(run({ cursor: 10, heard: ['acompanha', 'a', 'leitura'] })).toEqual({
      cursor: 10,
      matched: false,
      jumped: false,
    });
  });

  it('UT-068 voice-tracker: frase repetida casa a ocorrência mais próxima', () => {
    const filler = Array.from({ length: 33 }, (_, i) => `palavra${'abcdefghijklmnopqrstuvwxyz'[i % 26]}${'xyz'[i % 3]}`);
    const words = ['um', 'dois', 'tres', 'quatro', 'cinco', 'a', 'leitura', ...filler, 'a', 'leitura', 'fim'];
    const tokens = tokensOf(words.join(' '));
    expect(tokens[5].norm).toBe('a');
    expect(tokens[6].norm).toBe('leitura');
    expect(tokens[40].norm).toBe('a');
    expect(tokens[41].norm).toBe('leitura');
    expect(run({ tokens, cursor: 3, heard: ['a', 'leitura'] }).cursor).toBe(6);
  });

  it('UT-069 voice-tracker: improviso com palavras adiante não move no "Perto"', () => {
    expect(run({ heard: ['fim', 'da', 'gravação'] }).matched).toBe(false);
  });

  it('UT-070 voice-tracker: sequência única de 5 palavras salta no "Pulos para a frente"', () => {
    const r = run({ mode: 'forwardJumps', heard: ['no', 'vidro', 'com', 'calma', 'e'] });
    expect(r).toEqual({ cursor: 16, matched: true, jumped: true });
    expect(TOKENS[16].norm).toBe('e');
  });

  it('UT-071 voice-tracker: sequência que aparece duas vezes adiante não salta', () => {
    const tokens = tokensOf(
      'abertura do programa de hoje com muitas novidades para todos ' +
        'primeiro bloco sobre cinema nacional e producao ' +
        'leia com calma e atencao agora ' +
        'segundo bloco sobre cinema internacional ' +
        'leia com calma e atencao agora fim',
    );
    const r = run({ tokens, mode: 'forwardJumps', heard: ['leia', 'com', 'calma', 'e', 'atencao'] });
    expect(r.jumped).toBe(false);
    expect(r.cursor).toBe(0);
  });

  it('UT-072 voice-tracker: 4 palavras seguidas não bastam para saltar', () => {
    const r = run({ mode: 'forwardJumps', heard: ['atenção', 'até', 'o', 'fim'] });
    expect(r.jumped).toBe(false);
    expect(r.cursor).toBe(0);
  });

  it('UT-073 voice-tracker: uma das 5 palavras com semelhança 0,8 não deixa saltar', () => {
    expect(wordSimilarity('calmo', 'calma')).toBeCloseTo(0.8, 3);
    const ok = run({ mode: 'forwardJumps', heard: ['vidro', 'com', 'calma', 'e', 'atenção'] });
    expect(ok.jumped).toBe(true);
    const r = run({ mode: 'forwardJumps', heard: ['vidro', 'com', 'calmo', 'e', 'atenção'] });
    expect(r.jumped).toBe(false);
  });

  it('UT-074 voice-tracker: número por extenso avança até o último token', () => {
    const tokens = tokensOf('lançado em 2026 pela equipe');
    expect(tokens.map((t) => t.norm)).toEqual(['lancado', 'em', 'dois', 'mil', 'e', 'vinte', 'e', 'seis', 'pela', 'equipe']);
    expect(run({ tokens, cursor: 1, heard: ['dois', 'mil', 'e', 'vinte', 'e', 'seis'] }).cursor).toBe(7);
  });

  it('UT-075 voice-tracker: sigla não reconhecida ([unk]) é pulada', () => {
    const tokens = tokensOf('a PECEGE apresenta o curso');
    expect(run({ tokens, cursor: 0, heard: ['[unk]', 'apresenta', 'o'] })).toEqual({
      cursor: 3,
      matched: true,
      jumped: false,
    });
  });

  it('UT-076 voice-tracker: palavra longa isolada em cursor + 1 avança uma posição', () => {
    expect(run({ cursor: 3, heard: ['acompanha'] })).toEqual({ cursor: 4, matched: true, jumped: false });
  });

  it('UT-077 voice-tracker: palavra curta isolada em cursor + 1 não avança', () => {
    expect(TOKENS[7].norm).toBe('de');
    expect(run({ cursor: 6, heard: ['de'] })).toEqual({ cursor: 6, matched: false, jumped: false });
  });

  it.each([
    [['gravação']],
    [['fim', 'da', 'gravação']],
    [['o', 'teleprompter', 'da', 'chiaro', 'acompanha']],
  ])('UT-078 voice-tracker: no último token nada casa (%j)', (heard) => {
    for (const mode of ['near', 'forwardJumps'] as const) {
      expect(run({ cursor: TOKENS.length - 1, mode, heard })).toEqual({
        cursor: TOKENS.length - 1,
        matched: false,
        jumped: false,
      });
    }
  });

  it('UT-079 voice-tracker: resyncFromBand põe o cursor no primeiro token da linha menos um', () => {
    const tokens = tokensOf('um dois tres\nquatro cinco\nseis sete oito\nnove');
    expect(tokens.map((t) => t.line)).toEqual([0, 0, 0, 1, 1, 2, 2, 2, 3]);
    expect(resyncFromBand(tokens, 2)).toBe(4);
    expect(resyncFromBand(tokens, 0)).toBe(0);
    expect(resyncFromBand(tokens, 9)).toBe(tokens.length - 1);
    expect(resyncFromBand([], 2)).toBe(0);
  });

  it('UT-080 voice-tracker: caixa alta na aparência não muda os tokens', () => {
    const upper = layoutScript(SCRIPT, { ...DEFAULT_APPEARANCE, letterCase: 'upper' }, measure);
    const normal = layoutScript(SCRIPT, DEFAULT_APPEARANCE, measure);
    expect(buildScriptTokens(SCRIPT, upper.lines)).toEqual(buildScriptTokens(SCRIPT, normal.lines));
  });

  it('voice-tracker: o cursor nunca volta, com qualquer entrada', () => {
    const heards = [
      [],
      ['o'],
      ['o', 'teleprompter'],
      ['texto', 'no', 'vidro'],
      ['acompanha', 'a', 'leitura'],
      ['fim', 'da', 'gravação'],
      ['o', 'fim', 'da', 'gravação', 'x'],
      ['xyz', 'abc', 'def', 'ghi', 'jkl'],
    ];
    for (let cursor = -2; cursor < TOKENS.length + 2; cursor++) {
      for (const heard of heards) {
        for (const mode of ['near', 'forwardJumps'] as const) {
          const r = track({ tokens: TOKENS, cursor, mode, heard });
          expect(r.cursor).toBeGreaterThanOrEqual(cursor);
          expect(r.cursor).toBeLessThanOrEqual(Math.max(cursor, TOKENS.length - 1));
        }
      }
    }
    expect(track({ tokens: [], cursor: 0, mode: 'near', heard: ['o'] }).matched).toBe(false);
  });
});

describe('vocabulário do Vosk', () => {
  it('mantém os acentos do léxico do modelo e expande números', () => {
    expect(buildSpokenVocabulary('Atenção! Lê o texto em 2023, à câmera.')).toEqual([
      'atenção', 'lê', 'o', 'texto', 'em', 'dois', 'mil', 'e', 'vinte', 'três', 'à', 'câmera', '[unk]',
    ]);
    // O alinhador compara sem acento: as duas formas dão os mesmos tokens.
    expect(normalizeTokens(spokenTokens('Gravação no estúdio').join(' '))).toEqual(normalizeTokens('Gravação no estúdio'));
  });
});
