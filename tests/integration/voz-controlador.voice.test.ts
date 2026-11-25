/**
 * Voz de ponta a ponta no principal, com o motor real (npm run test:voice): o Vosk real
 * ouve a fixture em tempo real no banco de medição, e as hipóteses, com os instantes em
 * que chegaram, são repetidas no `VoiceController` real com o `AppStore` e o
 * `ScrollEngine` reais, no relógio falso (IT-013, IT-014).
 *
 * Usam a gravação real da equipe quando ela existe em `tests/fixtures/voz/`; enquanto
 * não existe, a voz sintética de `sintetica/`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { segmentTarget } from '@shared/motion';
import type { VoiceState } from '@shared/types';
import { createTestVoice, type TestVoice } from '../fakes/voice';
import { FIXTURES_DIR, fixtureExists, runHarness, type Measured } from '../voice/harness/run';

const fixture = (name: string): string => (fixtureExists(`${name}.wav`) ? `${name}.wav` : `sintetica/${name}.wav`);

interface Replay {
  v: TestVoice;
  start: number;
  /** Instante do relógio falso para um tempo da fixture (ms desde o começo do áudio). */
  at(ms: number): number;
  states: { t: number; state: VoiceState }[];
  cursors: { t: number; cursor: number }[];
}

/**
 * Repete as hipóteses do motor real no `VoiceController`. `beforeEach` roda antes de cada
 * hipótese, no instante dela, para o teste injetar comandos manuais.
 */
async function replay(m: Measured, onTime?: (r: Replay, fixtureMs: number) => void): Promise<Replay> {
  const v = await createTestVoice();
  await v.confirm(readFileSync(join(FIXTURES_DIR, m.marks.roteiro), 'utf8'));
  const start = v.clock.now;
  const r: Replay = { v, start, at: (ms) => start + ms, states: [], cursors: [] };
  v.store.onSnapshot((s) => {
    if (r.states.at(-1)?.state !== s.voice.state) r.states.push({ t: v.clock.now - start, state: s.voice.state });
  });
  await v.listen();
  for (const h of m.heard) {
    const ms = h.t - m.t0;
    v.clock.advanceTo(Math.max(v.clock.now, start + ms));
    onTime?.(r, ms);
    v.vc.hypothesis({ session: v.vc.currentSession, words: h.words, final: h.final, audioEndMs: 0 });
    if (r.cursors.at(-1)?.cursor !== v.vc.trackerCursor) r.cursors.push({ t: ms, cursor: v.vc.trackerCursor });
  }
  v.clock.advanceTo(start + m.durationMs + 5000);
  return r;
}

const stateAt = (r: Replay, ms: number): VoiceState => r.states.filter((s) => s.t <= ms).at(-1)?.state ?? 'off';
const cursorAt = (r: Replay, ms: number): number => r.cursors.filter((c) => c.t <= ms).at(-1)?.cursor ?? 0;

describe('voz no VoiceController com o motor real', () => {
  it('IT-013: improviso real, o texto não anda, vai a Esperando e volta a Ouvindo quando a leitura retoma', async () => {
    const m = await runHarness({ engine: 'vosk', mode: 'near', fixture: fixture('improviso') });
    const marks = m.marks.marcas;
    const first = marks.findIndex((x) => x.token === null);
    expect(first).toBeGreaterThan(0);
    let end = first;
    while (end < marks.length && marks[end].token === null) end++;
    const lastRead = marks[first - 1].token!;
    const improvStart = marks[first].inicioMs ?? marks[first - 1].fimMs;
    const resumeAt = marks[end].inicioMs ?? marks[end - 1].fimMs;

    const r = await replay(m);
    // Durante o improviso o cursor não passa da última palavra lida.
    const during = r.cursors.filter((c) => c.t >= improvStart && c.t <= resumeAt).map((c) => c.cursor);
    expect(Math.max(cursorAt(r, improvStart), ...during)).toBeLessThanOrEqual(lastRead);
    // O estado vai a Esperando durante o improviso, sem falha.
    const states = r.states.filter((s) => s.t > improvStart && s.t < resumeAt).map((s) => s.state);
    expect(stateAt(r, resumeAt - 1)).toBe('waiting');
    expect(states).not.toContain('failed');
    // A leitura retomada volta a Ouvindo e o cursor volta a andar.
    const back = r.states.find((s) => s.t > resumeAt && s.state === 'listening');
    expect(back, 'não voltou a Ouvindo').toBeDefined();
    expect(back!.t - resumeAt).toBeLessThan(5000);
    expect(r.v.vc.trackerCursor).toBeGreaterThan(lastRead + 20);
    expect(m.network).toEqual([]);
  }, 300_000);

  it('IT-014: trecho pulado no modo Perto, o cursor para antes do pulo e volta a andar depois do comando manual', async () => {
    const m = await runHarness({ engine: 'vosk', mode: 'near', fixture: fixture('trecho-pulado') });
    const read = m.marks.marcas.filter((x) => x.token !== null);
    const gap = read.findIndex((x, i) => i > 0 && x.token! - read[i - 1].token! > 1);
    expect(gap).toBeGreaterThan(0);
    const before = read[gap - 1].token!;
    const after = read[gap].token!;
    const resumeAt = read[gap].inicioMs ?? read[gap - 1].fimMs;
    // O operador leva o texto à linha certa um instante depois de a leitura retomar.
    const manualAt = resumeAt + 1500;
    let moved = false;
    let cursorBeforeManual = -1;
    const r = await replay(m, (rr, ms) => {
      if (moved || ms < manualAt) return;
      moved = true;
      cursorBeforeManual = rr.v.vc.trackerCursor;
      const lines = rr.v.store.layout!.lines;
      const tokenLine = lineOfWord(rr.v, after);
      const dy = lines[tokenLine].y - segmentTarget(rr.v.store.engine.segment);
      expect(rr.v.store.scroll({ type: 'nudge', dy })).toBe('ok');
    });
    expect(moved).toBe(true);
    // Sem o comando manual, o "Perto" não saltou o trecho: o cursor parou antes do pulo.
    expect(cursorBeforeManual).toBeLessThanOrEqual(before);
    // Depois do comando manual, a voz voltou a acompanhar dali até perto do fim.
    const last = read.at(-1)!.token!;
    expect(r.v.vc.trackerCursor).toBeGreaterThan(after);
    expect(r.v.vc.trackerCursor).toBeGreaterThanOrEqual(last - 3);
    expect(m.network).toEqual([]);
  }, 300_000);
});

/** Linha da diagramação em que começa a palavra `index` do roteiro (contando por espaços). */
function lineOfWord(v: TestVoice, index: number): number {
  const text = v.store.confirmedText;
  const words = [...text.matchAll(/\S+/g)];
  const start = words[index].index ?? 0;
  const lines = v.store.layout!.lines;
  let line = 0;
  while (line + 1 < lines.length && lines[line + 1].start <= start) line++;
  return line;
}
