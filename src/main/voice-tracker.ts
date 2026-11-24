/**
 * Alinhador da voz (TechSpec, "Algoritmos principais: Voz"; ADR-003 e ADR-007).
 *
 * Função pura: recebe os tokens do roteiro, o cursor atual (o último token já lido),
 * o modo e as palavras ouvidas, e devolve o novo cursor. O cursor nunca volta.
 *
 * - "Perto" (`near`): procura só numa janela curta à frente do cursor. Avança quando ao
 *   menos 2 das 3 últimas palavras ouvidas batem em ordem, ou quando uma palavra longa
 *   isolada bate logo à frente.
 * - "Pulos para a frente" (`forwardJumps`): além do "Perto", aceita um salto para além
 *   da janela quando 5 palavras seguidas batem com segurança e a sequência é única dali
 *   para a frente.
 *
 * Igual para os dois motores: o comportamento não depende de quem reconhece.
 */
import {
  JUMP_MIN_RUN,
  MIN_MATCH_RUN,
  NEAR_HEARD_WORDS,
  NEAR_LONG_WORD_MIN,
  NEAR_MAX_GAP,
  NEAR_WINDOW_TOKENS,
  WORD_SIMILARITY,
} from '@shared/defaults';
import { normalizeTokens } from '@shared/text';
import type { LayoutLine, ScriptToken, VoiceMode } from '@shared/types';

export interface TrackerInput {
  tokens: ScriptToken[];
  cursor: number;
  mode: VoiceMode;
  heard: string[];
}

export interface TrackerResult {
  cursor: number;
  matched: boolean;
  jumped: boolean;
}

/** Constantes do alinhador. Os padrões vêm de `defaults.ts`; os testes podem trocá-las. */
export interface TrackerParams {
  nearWindow: number;
  nearHeardWords: number;
  minMatchHits: number;
  minMatchOf: number;
  longWordMin: number;
  maxGap: number;
  wordSimilarity: number;
  jumpWords: number;
  jumpSimilarity: number;
}

export const DEFAULT_TRACKER_PARAMS: Readonly<TrackerParams> = Object.freeze({
  nearWindow: NEAR_WINDOW_TOKENS,
  nearHeardWords: NEAR_HEARD_WORDS,
  minMatchHits: MIN_MATCH_RUN.hits,
  minMatchOf: MIN_MATCH_RUN.of,
  longWordMin: NEAR_LONG_WORD_MIN,
  maxGap: NEAR_MAX_GAP,
  wordSimilarity: WORD_SIMILARITY,
  jumpWords: JUMP_MIN_RUN.words,
  jumpSimilarity: JUMP_MIN_RUN.similarity,
});

export const UNKNOWN_WORD = '[unk]';

/* ---------- Tokens do roteiro ---------- */

/**
 * Tokens normalizados do texto guardado, com a posição de caractere da palavra de origem
 * e a linha da diagramação em que ela começa. A caixa da aparência não muda nada aqui:
 * os tokens vêm do texto guardado, nunca do texto exibido.
 */
export function buildScriptTokens(text: string, lines: readonly Pick<LayoutLine, 'start' | 'end'>[]): ScriptToken[] {
  const out: ScriptToken[] = [];
  let line = 0;
  for (const m of text.matchAll(/\S+/g)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    while (line + 1 < lines.length && lines[line + 1].start <= start) line++;
    for (const norm of normalizeTokens(m[0])) out.push({ norm, start, end, line });
  }
  return out;
}

/* ---------- Semelhança ---------- */

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Semelhança de 0 a 1: 1 menos a distância de Levenshtein dividida pelo tamanho maior. */
export function wordSimilarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/** Palavras ouvidas normalizadas como o roteiro, sem `[unk]`. */
export function normalizeHeard(heard: readonly string[]): string[] {
  const out: string[] = [];
  for (const w of heard) {
    if (typeof w !== 'string' || w.trim().toLowerCase() === UNKNOWN_WORD) continue;
    out.push(...normalizeTokens(w));
  }
  return out;
}

/* ---------- Modo "Perto" ---------- */

interface NearMatch {
  cursor: number;
  /** A última palavra ouvida bateu (o cursor está no que acabou de ser dito). */
  lastWordMatched: boolean;
}

function nearMatch(tokens: ScriptToken[], cursor: number, heard: string[], p: TrackerParams): NearMatch | null {
  const recent = heard.slice(-p.nearHeardWords).slice(-p.minMatchOf);
  if (recent.length === 0) return null;
  const lo = cursor + 1;
  const hi = Math.min(tokens.length - 1, cursor + p.nearWindow);
  if (lo > hi) return null;
  const hit = (w: string, i: number): boolean => wordSimilarity(w, tokens[i].norm) >= p.wordSimilarity;

  /**
   * Alinha em ordem as palavras ouvidas de `recent[0..k]` terminando no token `j`
   * (a palavra `recent[k]` está em `j`). Volta da direita para a esquerda pegando a
   * ocorrência mais próxima, com no máximo `maxGap` tokens pulados entre duas batidas.
   */
  const countEndingAt = (k: number, j: number): number => {
    let count = 1;
    let pos = j;
    let misses = 0;
    for (let h = k - 1; h >= 0; h--) {
      // Cada palavra ouvida que não bateu pode ocupar um token a mais entre as batidas.
      const limit = Math.max(lo, pos - 1 - p.maxGap - misses);
      let found = false;
      for (let i = pos - 1; i >= limit; i--) {
        if (hit(recent[h], i)) {
          count++;
          pos = i;
          found = true;
          break;
        }
      }
      if (found) misses = 0;
      else misses++;
    }
    return count;
  };

  if (recent.length >= p.minMatchHits) {
    const last = recent.length - 1;
    // Primeiro: o ponto mais próximo em que a última palavra ouvida bate.
    for (let j = lo; j <= hi; j++) {
      if (hit(recent[last], j) && countEndingAt(last, j) >= p.minMatchHits) {
        return { cursor: j, lastWordMatched: true };
      }
    }
    // Depois: a última palavra não bateu (erro do reconhecedor), mas as anteriores sim.
    for (let k = last - 1; k >= 0 && k + 1 >= p.minMatchHits; k--) {
      for (let j = lo; j <= hi; j++) {
        if (hit(recent[k], j) && countEndingAt(k, j) >= p.minMatchHits) {
          return { cursor: j, lastWordMatched: false };
        }
      }
    }
  }

  // Palavra longa isolada logo à frente do cursor.
  const lastWord = recent[recent.length - 1];
  if ([...lastWord].length >= p.longWordMin) {
    for (let j = lo; j <= Math.min(hi, cursor + 2); j++) {
      if (hit(lastWord, j)) return { cursor: j, lastWordMatched: true };
    }
  }
  return null;
}

/* ---------- Modo "Pulos para a frente" ---------- */

function jumpMatch(tokens: ScriptToken[], cursor: number, heard: string[], p: TrackerParams): number | null {
  if (heard.length < p.jumpWords) return null;
  const run = heard.slice(-p.jumpWords);
  const ends: number[] = [];
  // A sequência precisa ser única dali para a frente: conta todas as ocorrências depois do cursor.
  for (let s = cursor + 1; s + run.length <= tokens.length; s++) {
    let ok = true;
    for (let k = 0; k < run.length && ok; k++) {
      ok = wordSimilarity(run[k], tokens[s + k].norm) >= p.jumpSimilarity;
    }
    if (ok) ends.push(s + run.length - 1);
    if (ends.length > 1) return null;
  }
  if (ends.length !== 1) return null;
  // O salto é para além da janela curta; dentro dela quem decide é o "Perto".
  return ends[0] > cursor + p.nearWindow ? ends[0] : null;
}

/* ---------- Entrada pública ---------- */

export function track(input: TrackerInput, params: TrackerParams = DEFAULT_TRACKER_PARAMS): TrackerResult {
  const tokens = Array.isArray(input.tokens) ? input.tokens : [];
  const raw = Number.isFinite(input.cursor) ? Math.trunc(input.cursor) : 0;
  const same: TrackerResult = { cursor: input.cursor, matched: false, jumped: false };
  if (tokens.length === 0 || raw >= tokens.length - 1) return same;
  const cursor = Math.max(0, raw);
  const heard = normalizeHeard(Array.isArray(input.heard) ? input.heard : []);
  if (heard.length === 0) return same;

  const near = nearMatch(tokens, cursor, heard, params);
  if (near && (near.lastWordMatched || input.mode !== 'forwardJumps')) {
    return { cursor: near.cursor, matched: true, jumped: false };
  }
  if (input.mode === 'forwardJumps') {
    const jump = jumpMatch(tokens, cursor, heard, params);
    if (jump !== null) return { cursor: jump, matched: true, jumped: true };
  }
  if (near) return { cursor: near.cursor, matched: true, jumped: false };
  return same;
}

/**
 * Depois de um comando manual ou de voltar ao início: o cursor fica no token anterior
 * ao primeiro token da linha que está na faixa, para a voz procurar a partir dali.
 * Sem token na linha ou depois dela, o cursor vai ao último token. Nunca é negativo.
 */
export function resyncFromBand(tokens: readonly ScriptToken[], lineIndex: number): number {
  if (tokens.length === 0) return 0;
  const first = tokens.findIndex((t) => t.line >= lineIndex);
  if (first < 0) return tokens.length - 1;
  return Math.max(0, first - 1);
}
