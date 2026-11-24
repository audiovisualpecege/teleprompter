import { describe, expect, it } from 'vitest';
import {
  buildVocabulary,
  contrastRatio,
  isLowContrast,
  normalizeTokens,
  numberToWords,
  parseColor,
} from '@shared/text';

describe('text', () => {
  it('UT-025 text: minúsculas, sem acento e sem pontuação', () => {
    expect(normalizeTokens('Ação, é já!')).toEqual(['acao', 'e', 'ja']);
  });

  it('UT-026 text: números por extenso em pt-BR, uma palavra por token', () => {
    expect(normalizeTokens('Em 2026')).toEqual(['em', 'dois', 'mil', 'e', 'vinte', 'e', 'seis']);
  });

  it.each([
    ['0', 'zero'],
    ['1', 'um'],
    ['16', 'dezesseis'],
    ['100', 'cem'],
    ['101', 'cento e um'],
    ['345', 'trezentos e quarenta e cinco'],
    ['1000', 'mil'],
    ['1100', 'mil e cem'],
    ['1234', 'mil duzentos e trinta e quatro'],
    ['2000000', 'dois milhões'],
    ['1000001', 'um milhão e um'],
    ['007', 'zero zero sete'],
  ])('text: %s por extenso é "%s"', (digits, words) => {
    expect(numberToWords(digits).join(' ')).toBe(words);
  });

  it('text: separador de milhar e decimais', () => {
    expect(normalizeTokens('1.500 pessoas')).toEqual(['mil', 'e', 'quinhentos', 'pessoas']);
    expect(normalizeTokens('1,5')).toEqual(['um', 'virgula', 'cinco']);
  });

  it('UT-027 text: vocabulário com palavras únicas e [unk]', () => {
    expect(buildVocabulary('a casa a rua')).toEqual(['a', 'casa', 'rua', '[unk]']);
  });

  it('UT-028 text: só espaços não dá tokens e vocabulário vazio tem só [unk]', () => {
    expect(normalizeTokens('   ')).toEqual([]);
    expect(buildVocabulary('')).toEqual(['[unk]']);
  });

  it('UT-029 text: "AÇÃO" e "ação" dão os mesmos tokens', () => {
    expect(normalizeTokens('AÇÃO')).toEqual(normalizeTokens('ação'));
  });

  it('UT-030 text: branco sobre preto tem razão 21', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(21);
  });

  it('UT-031 text: cinzas próximos têm contraste baixo', () => {
    expect(isLowContrast('#777777', '#808080')).toBe(true);
  });

  it('UT-032 text: razão de 3,0 não é contraste baixo', () => {
    // #959595 sobre branco dá 3,00 com duas casas.
    expect(contrastRatio('#959595', '#FFFFFF')!.toFixed(2)).toBe('3.00');
    expect(isLowContrast('#959595', '#FFFFFF')).toBe(false);
    expect(isLowContrast('#969696', '#FFFFFF')).toBe(true);
  });

  it('UT-033 text: código de cor inválido devolve null e #RRGGBBAA é lido', () => {
    expect(parseColor('#GGG')).toBeNull();
    expect(parseColor('azul')).toBeNull();
    expect(parseColor('#12345')).toBeNull();
    const c = parseColor('#FACE9533');
    expect(c).not.toBeNull();
    expect(c!.r).toBe(0xfa);
    expect(c!.g).toBe(0xce);
    expect(c!.b).toBe(0x95);
    expect(c!.a).toBeCloseTo(0x33 / 255, 5);
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it('text: cor inválida não dá aviso de contraste nem lança erro', () => {
    expect(contrastRatio('#GGG', '#000000')).toBeNull();
    expect(isLowContrast('#GGG', '#000000')).toBe(false);
  });
});
