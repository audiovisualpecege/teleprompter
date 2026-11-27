/**
 * VoiceController (UT-081 a UT-104, UT-204): máquina de estados da voz com o `AppStore`
 * e o `ScrollEngine` reais, relógio falso e o motor falso (o teste responde por ele).
 */
import { describe, expect, it } from 'vitest';
import { SIGNAL_DEBOUNCE_MS, WAITING_AFTER_MS } from '@shared/defaults';
import { positionAt, segmentTarget } from '@shared/motion';
import { buildSpokenVocabulary } from '@shared/text';
import { MIC_MISSING_NOTICE, NO_MIC_MESSAGE, VOICE_FAULT_NOTICE, VOICE_START_NOTICE } from '@shared/voice';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { settingsPath } from '../../src/main/settings';
import { createTestVoice, MIC, VOICE_TEXT } from '../fakes/voice';

const lineY = (v: Awaited<ReturnType<typeof createTestVoice>>, i: number): number => v.store.layout!.lines[i].y;
const notice = (v: Awaited<ReturnType<typeof createTestVoice>>, id: string) => v.store.snapshot().notices.find((n) => n.id === id);

describe('VoiceController: ligar e recusar', () => {
  it('UT-081: toggle com texto e microfone vai de off a preparing, e o asr:ready leva a listening', async () => {
    const v = await createTestVoice();
    await v.confirm();
    const r = await v.vc.toggle();
    expect(r.ok).toBe(true);
    expect(v.state()).toBe('preparing');
    const start = v.lastRun();
    expect(start).toMatchObject({ op: 'start', engine: 'vosk', deviceId: null, vocabulary: buildSpokenVocabulary(VOICE_TEXT) });
    v.ready();
    expect(v.state()).toBe('listening');
    expect(v.store.snapshot().automation).toBe('voice');
    expect(v.logs.filter((l) => l.event === 'voice.state').map((l) => l.fields?.to)).toEqual(['preparing', 'listening']);
  });

  it('UT-082: toggle sem texto confirmado devolve no-text e fica off', async () => {
    const v = await createTestVoice();
    const r = await v.vc.toggle();
    expect(r).toEqual({ ok: false, error: 'no-text' });
    expect(v.state()).toBe('off');
    expect(v.runs).toEqual([]);
  });

  it('UT-083: toggle sem microfone devolve no-mic com a mensagem', async () => {
    const v = await createTestVoice({ devices: [] });
    await v.confirm();
    const r = await v.vc.toggle();
    expect(r).toEqual({ ok: false, error: 'no-mic' });
    expect(v.state()).toBe('off');
    expect(notice(v, VOICE_START_NOTICE)?.message).toBe('Nenhum microfone encontrado. Ligue um microfone e tente de novo');
    expect(NO_MIC_MESSAGE).toBe('Nenhum microfone encontrado. Ligue um microfone e tente de novo');
  });

  it.each([
    ['win32', 'Configurações, Privacidade e segurança, Microfone'],
    ['darwin', 'Ajustes do Sistema, Privacidade e Segurança, Microfone'],
  ])('UT-084: toggle com permissão negada (%s) devolve mic-denied e explica como dar a permissão', async (platform, how) => {
    const v = await createTestVoice({ platform });
    await v.confirm();
    v.access.value = 'denied';
    const r = await v.vc.toggle();
    expect(r).toEqual({ ok: false, error: 'mic-denied' });
    expect(v.state()).toBe('off');
    expect(notice(v, VOICE_START_NOTICE)?.message).toContain(how);
  });
});

describe('VoiceController: Ouvindo, Esperando e silêncio', () => {
  it('UT-085: em listening, 2.500 ms sem casar levam a waiting', async () => {
    const v = await createTestVoice();
    await v.listen();
    v.clock.advance(WAITING_AFTER_MS - 1);
    v.hear('xyz', 'qwe');
    expect(v.state()).toBe('listening');
    v.clock.advance(1);
    expect(v.state()).toBe('waiting');
  });

  it('UT-086: em waiting, uma hipótese que casa leva a listening', async () => {
    const v = await createTestVoice();
    await v.listen();
    v.clock.advance(WAITING_AFTER_MS);
    expect(v.state()).toBe('waiting');
    v.hear('teleprompter', 'da', 'chiaro');
    expect(v.state()).toBe('listening');
    expect(v.vc.trackerCursor).toBe(3);
  });

  it('UT-087: 10 minutos sem hipóteses mantêm waiting, nunca failed', async () => {
    const v = await createTestVoice();
    await v.listen();
    for (let i = 0; i < 600; i++) v.clock.advance(1000);
    expect(v.state()).toBe('waiting');
    expect(notice(v, VOICE_FAULT_NOTICE)).toBeUndefined();
  });
});

describe('VoiceController: falhas, recuperação e lentidão', () => {
  it('UT-088: mic-lost em listening leva a failed com o motivo e hold na posição atual', async () => {
    const v = await createTestVoice();
    await v.listen();
    v.clock.advance(400);
    v.hear('teleprompter', 'da', 'chiaro', 'acompanha', 'a', 'leitura');
    const seg = v.store.engine.segment;
    expect(seg.kind).toBe('glide');
    v.clock.advance(100); // no meio do deslizamento da voz
    const here = positionAt(seg, v.clock.now);
    v.fault('mic-lost');
    expect(v.state()).toBe('failed');
    expect(v.store.snapshot().voice.fault).toBe('mic-lost');
    expect(notice(v, VOICE_FAULT_NOTICE)?.message).toBe('O microfone foi desconectado');
    expect(v.store.engine.segment).toEqual({ kind: 'hold', y: here });
  });

  it('UT-089: em failed por mic-lost, devicechange com o microfone de volta reinicia a captura e volta a listening, sem alerta', async () => {
    const v = await createTestVoice();
    await v.listen();
    v.fault('mic-lost');
    v.vc.devicesChanged([]);
    expect(v.state()).toBe('failed');
    const before = v.runs.length;
    v.vc.devicesChanged([MIC]);
    expect(v.runs.length).toBe(before + 1);
    expect(v.lastRun()?.op).toBe('start');
    v.ready();
    expect(v.state()).toBe('listening');
    expect(notice(v, VOICE_FAULT_NOTICE)).toBeUndefined();
  });

  it('UT-090: toggle em failed leva a off e remove o alerta', async () => {
    const v = await createTestVoice();
    await v.listen();
    v.fault('mic-lost');
    await v.vc.toggle();
    expect(v.state()).toBe('off');
    expect(v.lastRun()?.op).toBe('stop');
    expect(notice(v, VOICE_FAULT_NOTICE)).toBeUndefined();
    expect(v.store.snapshot().automation).toBe('none');
  });

  it('UT-091: cinco mic-lost seguidos mantêm um único aviso com o mesmo id e hora atualizada', async () => {
    const v = await createTestVoice();
    await v.listen();
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      v.clock.advance(1000);
      v.fault('mic-lost');
      const n = v.store.snapshot().notices.filter((x) => x.id === VOICE_FAULT_NOTICE);
      expect(n).toHaveLength(1);
      times.push(n[0].at!);
    }
    expect(new Set(times).size).toBe(5);
    expect(times.at(-1)).toBe(v.clock.now);
  });

  it('UT-092: engine-crashed reinicia após 1, 2 e 4 s; a quarta falha fica em failed', async () => {
    const v = await createTestVoice();
    await v.listen();
    const starts = () => v.runs.filter((r) => r.op === 'start').length;
    const s0 = starts();
    for (const delay of [1000, 2000, 4000]) {
      v.fault('engine-crashed');
      expect(v.state()).toBe('failed');
      expect(notice(v, VOICE_FAULT_NOTICE)?.message).toBe('O reconhecimento de voz parou');
      const before = starts();
      v.clock.advance(delay - 1);
      expect(starts()).toBe(before);
      v.clock.advance(1);
      expect(starts()).toBe(before + 1);
      expect(v.state()).toBe('failed');
      v.ready();
      expect(v.state()).toBe('listening');
    }
    expect(starts()).toBe(s0 + 3);
    expect(v.logs.filter((l) => l.event === 'voice.engineRestart').map((l) => l.fields?.attempt)).toEqual([1, 2, 3]);
    v.fault('engine-crashed');
    v.clock.advance(60_000);
    expect(starts()).toBe(s0 + 3);
    expect(v.state()).toBe('failed');
    expect(notice(v, VOICE_FAULT_NOTICE)?.message).toBe('O reconhecimento de voz parou');
  });

  it('UT-093: lag de 3.200 leva a failed por lentidão; lag de 700 depois volta a listening', async () => {
    const v = await createTestVoice();
    await v.listen();
    v.lag(3200);
    expect(v.state()).toBe('failed');
    expect(v.store.snapshot().voice.fault).toBe('too-slow');
    expect(notice(v, VOICE_FAULT_NOTICE)?.message).toBe('O computador não está dando conta');
    v.lag(1500);
    expect(v.state()).toBe('failed');
    v.lag(700);
    expect(v.state()).toBe('listening');
    expect(notice(v, VOICE_FAULT_NOTICE)).toBeUndefined();
  });
});

describe('VoiceController: ligar e desligar seguidos, automática e fim do texto', () => {
  it('UT-094: quatro toggles seguidos durante preparing terminam em off, sem carregamento pendente', async () => {
    const v = await createTestVoice();
    await v.confirm();
    const sessions: number[] = [];
    for (let i = 0; i < 4; i++) {
      await v.vc.toggle();
      sessions.push(v.vc.currentSession);
    }
    expect(v.state()).toBe('off');
    expect(v.runs.map((r) => r.op)).toEqual(['start', 'stop', 'start', 'stop']);
    // As respostas atrasadas dos carregamentos cancelados não religam nada.
    for (const session of sessions) v.vc.ready({ session });
    expect(v.state()).toBe('off');
    expect(v.store.snapshot().automation).toBe('none');
  });

  it('UT-095: ligar a voz com a automática rolando pausa a automática e deixa automation voice', async () => {
    const v = await createTestVoice();
    await v.confirm();
    v.store.scroll({ type: 'autoStart' });
    expect(v.store.snapshot().automation).toBe('auto');
    await v.vc.toggle();
    expect(v.store.engine.automation).toBe('none');
    expect(v.store.engine.segment.kind).toBe('hold');
    expect(v.store.snapshot().automation).toBe('voice');
  });

  it('UT-096: autoStart com a voz em listening desliga a voz e deixa automation auto', async () => {
    const v = await createTestVoice();
    await v.listen();
    v.store.scroll({ type: 'autoStart' });
    expect(v.state()).toBe('off');
    expect(v.lastRun()?.op).toBe('stop');
    expect(v.store.snapshot().automation).toBe('auto');
    expect(v.store.engine.segment.kind).toBe('cruise');
  });

  it('UT-097: o cursor no último token leva a waiting, e a voz continua ligada', async () => {
    const v = await createTestVoice({});
    await v.listen();
    // Modo "Pulos para a frente": salta até o fim com 5 palavras seguras.
    await v.vc.command({ op: 'setMode', mode: 'forwardJumps' });
    v.hear('ate', 'o', 'fim', 'da', 'gravação');
    expect(v.vc.trackerCursor).toBe(22);
    expect(v.state()).toBe('waiting');
    v.clock.advance(60_000);
    expect(v.state()).toBe('waiting');
    expect(segmentTarget(v.store.engine.segment)).toBe(lineY(v, 3));
  });

  it('Correção 1: ao ler a última palavra de uma linha, a linha seguinte já vai para a faixa', async () => {
    const v = await createTestVoice();
    await v.listen();
    v.clock.advance(400);
    v.hear('o', 'teleprompter', 'da', 'chiaro', 'acompanha');
    expect(v.vc.trackerCursor).toBe(4);
    expect(segmentTarget(v.store.engine.segment)).toBeCloseTo(lineY(v, 1), 3);
  });

  it('Correção 1: no meio de uma linha, o texto sobe na proporção do que já foi lido dela', async () => {
    const v = await createTestVoice();
    await v.listen();
    v.clock.advance(400);
    v.hear('chiaro', 'acompanha', 'a', 'leitura', 'de', 'quem');
    expect(v.vc.trackerCursor).toBe(8);
    const y = segmentTarget(v.store.engine.segment);
    expect(y).toBeGreaterThan(lineY(v, 1));
    expect(y).toBeLessThan(lineY(v, 2));
  });
});

describe('VoiceController: microfone, modo, motor, sinal e vocabulário', () => {
  it('UT-098: setMic em listening reinicia a captura no novo deviceId sem passar por off', async () => {
    const v = await createTestVoice({ devices: [MIC, { deviceId: 'mic-2', label: 'Entrada 3/4 (Interface)' }] });
    await v.listen();
    const states: string[] = [];
    v.store.onSnapshot((s) => states.push(s.voice.state));
    await v.vc.command({ op: 'setMic', deviceId: 'mic-2' });
    expect(v.lastRun()).toEqual({ op: 'setMic', session: v.vc.currentSession, deviceId: 'mic-2' });
    expect(states).not.toContain('off');
    expect(v.state()).toBe('listening');
    expect(v.store.snapshot().voiceSetup).toMatchObject({ micDeviceId: 'mic-2', micLabel: 'Entrada 3/4 (Interface)' });
  });

  it('UT-099: setMode forwardJumps vale na próxima hipótese e é gravado, assim como setEngine parakeet', async () => {
    const v = await createTestVoice();
    await v.listen();
    v.hear('até', 'o', 'fim', 'da', 'gravação');
    expect(v.vc.trackerCursor).toBe(0); // "Perto": fora da janela curta
    await v.vc.command({ op: 'setMode', mode: 'forwardJumps' });
    v.hear('até', 'o', 'fim', 'da', 'gravação');
    expect(v.vc.trackerCursor).toBe(22);
    await v.vc.command({ op: 'setEngine', engine: 'parakeet' });
    expect(v.lastRun()).toMatchObject({ op: 'start', engine: 'parakeet' });
    await v.settings.flush();
    const saved = JSON.parse(await readFile(settingsPath(v.userDataDir), 'utf8')) as Record<string, unknown>;
    expect(saved.voiceMode).toBe('forwardJumps');
    expect(saved.voiceEngine).toBe('parakeet');
    expect(v.store.snapshot().voice).toMatchObject({ mode: 'forwardJumps', engine: 'parakeet' });
  });

  it('UT-099: setEngine parakeet onde ele não carrega é ignorado', async () => {
    const v = await createTestVoice({ engines: ['vosk'] });
    await v.vc.command({ op: 'setEngine', engine: 'parakeet' });
    expect(v.store.snapshot().voice.engine).toBe('vosk');
  });

  it('UT-100: listening, waiting e listening em 500 ms não mudam o sinal; estável por 700 ms muda', async () => {
    const v = await createTestVoice();
    await v.listen();
    v.clock.advance(SIGNAL_DEBOUNCE_MS);
    expect(v.signals).toEqual(['listening']);
    v.clock.advance(WAITING_AFTER_MS - SIGNAL_DEBOUNCE_MS);
    expect(v.state()).toBe('waiting');
    v.clock.advance(250);
    v.hear('teleprompter', 'da', 'chiaro');
    expect(v.state()).toBe('listening');
    v.clock.advance(250);
    expect(v.signals).toEqual(['listening']);
    v.clock.advance(SIGNAL_DEBOUNCE_MS);
    expect(v.signals).toEqual(['listening']);
    // Esperando estável por 700 ms muda o sinal.
    v.clock.advance(WAITING_AFTER_MS - 250 - SIGNAL_DEBOUNCE_MS);
    expect(v.state()).toBe('waiting');
    v.clock.advance(SIGNAL_DEBOUNCE_MS - 1);
    expect(v.signals).toEqual(['listening']);
    v.clock.advance(1);
    expect(v.signals).toEqual(['listening', 'waiting']);
  });

  it('UT-101: confirmar texto novo com a voz ligada chama setVocabulary sem mudar o estado', async () => {
    const v = await createTestVoice();
    await v.listen();
    const states: string[] = [];
    v.store.onSnapshot((s) => states.push(s.voice.state));
    const next = `${VOICE_TEXT}\nfim do roteiro com palavras novas`;
    await v.confirm(next);
    expect(v.lastRun()).toEqual({ op: 'setVocabulary', session: v.vc.currentSession, vocabulary: buildSpokenVocabulary(next) });
    expect(new Set(states)).toEqual(new Set(['listening']));
  });

  it('UT-102: microfone guardado ausente avisa e a voz não liga noutro microfone', async () => {
    const v = await createTestVoice({ devices: null });
    await v.settings.update({ micDeviceId: 'sumiu', micLabel: 'Microfone de lapela' });
    v.vc.devicesChanged([MIC]);
    expect(notice(v, MIC_MISSING_NOTICE)?.message).toContain('O microfone guardado não está ligado');
    await v.confirm();
    const r = await v.vc.toggle();
    expect(r).toEqual({ ok: false, error: 'no-mic' });
    expect(v.state()).toBe('off');
    expect(v.runs).toEqual([]);
    // O microfone guardado volta: o aviso some.
    v.vc.devicesChanged([MIC, { deviceId: 'sumiu', label: 'Microfone de lapela' }]);
    expect(notice(v, MIC_MISSING_NOTICE)).toBeUndefined();
    expect((await v.vc.toggle()).ok).toBe(true);
    expect(v.lastRun()).toMatchObject({ op: 'start', deviceId: 'sumiu' });
  });

  it('UT-103: toStart com a voz em listening mantém a voz ligada e o cursor vai a 0', async () => {
    const v = await createTestVoice();
    await v.listen();
    v.hear('teleprompter', 'da', 'chiaro', 'acompanha', 'a', 'leitura');
    expect(v.vc.trackerCursor).toBeGreaterThan(3);
    v.clock.advance(1000);
    v.store.scroll({ type: 'toStart' });
    expect(v.state()).toBe('listening');
    expect(v.vc.trackerCursor).toBe(0);
    expect(v.store.engine.segment).toEqual({ kind: 'hold', y: 0 });
    // A voz acompanha do início.
    v.clock.advance(400);
    v.hear('teleprompter', 'da', 'chiaro');
    expect(v.vc.trackerCursor).toBe(3);
  });

  it('UT-104: em preparing, lineStep move o texto normalmente', async () => {
    const v = await createTestVoice();
    await v.confirm();
    await v.vc.toggle();
    expect(v.state()).toBe('preparing');
    expect(v.store.scroll({ type: 'lineStep', dir: 1 })).toBe('ok');
    expect(segmentTarget(v.store.engine.segment)).toBe(lineY(v, 1));
    expect(v.state()).toBe('preparing');
  });
});

describe('AppStore com a voz', () => {
  it('UT-204: abrir outro roteiro com a automática rolando pausa, põe a posição em 0 e o cursor da voz em 0', async () => {
    const v = await createTestVoice();
    await v.listen();
    v.hear('teleprompter', 'da', 'chiaro', 'acompanha', 'a', 'leitura');
    expect(v.vc.trackerCursor).toBeGreaterThan(0);
    await v.vc.toggle(); // a automática e a voz não andam juntas
    v.store.scroll({ type: 'autoStart' });
    v.clock.advance(2000);
    expect(v.store.engine.automation).toBe('auto');
    const r = await v.store.doc({ op: 'open', path: join(__dirname, '..', 'fixtures', 'valido.roteiro'), unsaved: 'discard' });
    expect(r.ok).toBe(true);
    expect(v.store.engine.automation).toBe('none');
    expect(v.store.engine.segment).toEqual({ kind: 'hold', y: 0 });
    expect(v.vc.trackerCursor).toBe(0);
  });
});
