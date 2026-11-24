/**
 * Integração da voz com os motores reais (npm run test:voice), num Electron real:
 * Vosk no Worker do vosk-browser e Parakeet no utilityProcess, alimentados por WAV em
 * tempo real, com o alinhador de verdade.
 *
 * - IT-012, IT-015 e IT-016 usam as gravações reais da equipe em `tests/fixtures/voz/`.
 *   Enquanto elas não existem, os casos ficam pulados com o motivo.
 * - Os casos "sintética" usam a voz do Windows (`tests/fixtures/voz/sintetica/`) para
 *   provar que os motores, o vocabulário restrito, os parciais e o alinhador funcionam
 *   dentro do Electron. Não servem para calibrar.
 * - O Parakeet só roda com `TP_VOICE_PARAKEET=1` (job noturno, por tamanho).
 */
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixtureExists, median, MODELS_DIR, OUT, percentileOf, runHarness, type Measured } from '../voice/harness/run';

const withParakeet = process.env.TP_VOICE_PARAKEET === '1';
const real = (name: string): boolean => fixtureExists(`${name}.wav`);
const SEM_GRAVACAO = 'gravação real da equipe ainda não está em tests/fixtures/voz/';

/** Mostra a medição e a guarda em out-voice/medicoes.jsonl (relatório do job). */
function report(label: string, m: Measured): void {
  const lags = m.tokenLags;
  mkdirSync(OUT, { recursive: true });
  appendFileSync(
    join(OUT, 'medicoes.jsonl'),
    `${JSON.stringify({
      label,
      origem: m.marks.origem,
      data: new Date().toISOString(),
      plataforma: `${process.platform}-${process.arch}`,
      cobertura: m.coverage,
      atrasoP50: median(lags),
      atrasoP95: percentileOf(lags, 95),
      motorP50: median(m.lags),
      motorP95: percentileOf(m.lags, 95),
      parciais: m.hypotheses.partial,
      finais: m.hypotheses.final,
      cargaMs: m.loadMs,
      saltos: m.events.filter((e) => e.jumped).length,
      rede: m.network.length,
      improviso: m.improvAdvance,
    })}
`,
  );
  console.log(
    `[voz] ${label}: cobertura ${(m.coverage * 100).toFixed(1)}%, atraso p50 ${median(lags).toFixed(0)} ms, ` +
      `p95 ${percentileOf(lags, 95).toFixed(0)} ms, motor p50 ${median(m.lags).toFixed(0)} ms, ` +
      `parciais ${m.hypotheses.partial}, finais ${m.hypotheses.final}, carga ${m.loadMs.toFixed(0)} ms, ` +
      `saltos ${m.events.filter((e) => e.jumped).length}`,
  );
}

function expectSane(m: Measured): void {
  expect(m.network).toEqual([]);
  expect(m.faults).toEqual([]);
  // O cursor nunca volta.
  for (let i = 1; i < m.events.length; i++) expect(m.events[i].cursor).toBeGreaterThan(m.events[i - 1].cursor);
}

describe('voz com motores reais', () => {
  it('os modelos estão baixados (node scripts/baixar-modelos.mjs)', () => {
    expect(existsSync(join(MODELS_DIR, 'vosk-model-small-pt-0.3.tar.gz'))).toBe(true);
  });

  it.skipIf(!real('leitura-continua'))(
    `IT-012 vosk: leitura contínua cobre 90% do roteiro com atraso mediano abaixo de 1.000 ms${real('leitura-continua') ? '' : ` (${SEM_GRAVACAO})`}`,
    async () => {
      const m = await runHarness({ engine: 'vosk', mode: 'near', fixture: 'leitura-continua.wav' });
      report('IT-012 vosk leitura-continua', m);
      expectSane(m);
      expect(m.marks.origem).toBe('gravacao');
      expect(m.coverage).toBeGreaterThanOrEqual(0.9);
      expect(median(m.tokenLags)).toBeLessThan(1000);
    },
    300_000,
  );

  it.skipIf(!withParakeet || !real('leitura-continua'))(
    `IT-015 parakeet (noturno): leitura contínua com atraso mediano até 1.500 ms${real('leitura-continua') ? '' : ` (${SEM_GRAVACAO})`}`,
    async () => {
      const m = await runHarness({ engine: 'parakeet', mode: 'near', fixture: 'leitura-continua.wav' });
      report('IT-015 parakeet leitura-continua', m);
      expectSane(m);
      expect(median(m.tokenLags)).toBeLessThanOrEqual(1500);
    },
    300_000,
  );

  it.skipIf(!real('trecho-pulado'))(
    `IT-016 vosk: trecho pulado no modo "Pulos para a frente" salta sem comando manual${real('trecho-pulado') ? '' : ` (${SEM_GRAVACAO})`}`,
    async () => {
      const m = await runHarness({ engine: 'vosk', mode: 'forwardJumps', fixture: 'trecho-pulado.wav' });
      report('IT-016 vosk trecho-pulado', m);
      expectSane(m);
      assertJumpedOverGap(m);
    },
    300_000,
  );

  it('sintética vosk: vocabulário restrito, parciais e alinhador dentro do Electron (leitura contínua)', async () => {
    const m = await runHarness({ engine: 'vosk', mode: 'near', fixture: 'sintetica/leitura-continua.wav' });
    report('sintética vosk leitura-continua', m);
    expectSane(m);
    expect(m.hypotheses.partial).toBeGreaterThan(0);
    expect(m.coverage).toBeGreaterThanOrEqual(0.9);
    expect(median(m.tokenLags)).toBeLessThan(1000);
  }, 300_000);

  it('sintética vosk: trecho pulado no modo "Pulos para a frente"', async () => {
    const m = await runHarness({ engine: 'vosk', mode: 'forwardJumps', fixture: 'sintetica/trecho-pulado.wav' });
    report('sintética vosk trecho-pulado', m);
    expectSane(m);
    assertJumpedOverGap(m);
  }, 300_000);

  it('sintética captura: microfone falso do Chromium, AudioWorklet a 16 kHz e Vosk', async () => {
    const m = await runHarness({ engine: 'vosk', mode: 'near', fixture: 'sintetica/leitura-continua.wav', source: 'mic' });
    report('sintética vosk captura (microfone falso)', m);
    expectSane(m);
    expect(m.coverage).toBeGreaterThanOrEqual(0.9);
  }, 300_000);

  it.each(['improviso', 'leitura-com-improviso'])('sintética vosk: medição do improviso (%s)', async (nome) => {
    for (const mode of ['near', 'forwardJumps'] as const) {
      const m = await runHarness({ engine: 'vosk', mode, fixture: `sintetica/${nome}.wav` });
      report(`sintética vosk ${nome} ${mode}`, m);
      expectSane(m);
      expect(m.coverage).toBeGreaterThanOrEqual(0.9);
    }
  }, 600_000);

  it.skipIf(!withParakeet)('sintética parakeet: utilityProcess com sherpa-onnx-node (leitura contínua)', async () => {
    const m = await runHarness({ engine: 'parakeet', mode: 'near', fixture: 'sintetica/leitura-continua.wav' });
    report('sintética parakeet leitura-continua', m);
    expectSane(m);
    expect(m.coverage).toBeGreaterThanOrEqual(0.9);
    expect(median(m.tokenLags)).toBeLessThanOrEqual(1500);
  }, 300_000);
});

/** O cursor parou antes do pulo e depois saltou para a frase seguinte ao trecho pulado. */
function assertJumpedOverGap(m: Measured): void {
  const read = m.marks.marcas.filter((x) => x.token !== null).map((x) => x.token!);
  let gapAt = -1;
  for (let i = 1; i < read.length; i++) if (read[i] - read[i - 1] > 1) gapAt = i;
  expect(gapAt).toBeGreaterThan(0);
  const before = read[gapAt - 1];
  const after = read[gapAt];
  const jump = m.events.find((e) => e.jumped);
  expect(jump, 'o cursor não saltou').toBeDefined();
  expect(jump!.cursor).toBeGreaterThanOrEqual(after);
  // Antes do salto, o cursor não passou do fim do que foi lido.
  const beforeJump = m.events.filter((e) => e.t < jump!.t).at(-1);
  expect(beforeJump?.cursor ?? 0).toBeLessThanOrEqual(before);
  expect(m.events.at(-1)!.cursor).toBeGreaterThanOrEqual(read.at(-1)! - 3);
}
