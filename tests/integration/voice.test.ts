/**
 * Voz com as peças reais juntas (IT-017, IT-024): `AppStore`, `ScrollEngine`,
 * `VoiceController` e `OutputManager` reais sobre a plataforma falsa, com o barramento de
 * IPC em memória fazendo o papel da janela de controle (que responde pelo motor de voz).
 */
import { describe, expect, it } from 'vitest';
import { MANUAL_PRIORITY_MS, SIGNAL_DEBOUNCE_MS } from '@shared/defaults';
import type { OutputView, VoiceRunCommand } from '@shared/ipc';
import { positionAt, segmentTarget, type MotionSegment } from '@shared/motion';
import { DisplayRegistry } from '../../src/main/displays';
import { bindStore, bindVoice } from '../../src/main/ipc-main';
import { OutputManager } from '../../src/main/outputs';
import { VoiceController } from '../../src/main/voice-controller';
import { createIpcBus } from '../fakes/ipc-bus';
import type { FakeWindow } from '../fakes/platform';
import { createTestStore } from '../fakes/store';
import { A, B, keyOf } from '../fakes/studio';
import { MIC } from '../fakes/voice';

/** Um roteiro de 12 linhas, uma frase por linha. */
const LINES = [
  'bom dia e bem vindos a mais uma aula',
  'hoje vamos falar sobre o teleprompter',
  'que acompanha a leitura de quem grava',
  'o texto anda conforme a pessoa fala',
  'e espera quando ela improvisa um pouco',
  'o operador pode mover o texto a mão',
  'com os botões o teclado ou o pedal',
  'a voz volta a acompanhar dali em diante',
  'no fim da aula agradecemos a atenção',
  'até a próxima gravação no estúdio',
  'lembrem de revisar o material de apoio',
  'obrigado e até logo',
];
const TEXT = LINES.join('\n');

async function setup() {
  const t = await createTestStore({ autoLayout: false, init: false });
  t.platform.displays = [A(), B()];
  const control = t.platform.windows.create({ x: 320, y: 130, width: 1280, height: 820 }) as FakeWindow;
  const bus = createIpcBus(0);
  const windows = new Map<number, FakeWindow>();
  const manager = new OutputManager({
    platform: t.platform,
    displays: new DisplayRegistry(t.platform.screen),
    settings: t.settings,
    scheduler: t.clock,
    now: () => t.clock.now,
    paths: { mainDir: '/app/out/main', icon: '/app/icone.png' },
    isMac: false,
    controlWindow: () => control,
    appearance: () => t.store.snapshot().appearance,
    onChange: () => t.store.refresh(),
    notices: { add: (id, kind, msg) => t.store.addNotice(id, kind, msg), remove: (id) => t.store.removeNotice(id) },
    onWindow: (win, id) => void windows.set(id, win as FakeWindow),
  });
  bus.toOutputs = (channel, payload) => {
    if (channel === 'motion:segment') manager.setSegment(payload as MotionSegment);
  };
  bus.layoutToOutputs = (layout) => manager.setLayout(layout);
  bindStore(t.store, bus);
  const voice = new VoiceController({
    store: t.store,
    settings: t.settings,
    scheduler: t.clock,
    now: () => t.clock.now,
    outputs: manager,
    engines: { engines: ['vosk'], parakeetUnavailable: null },
    platform: 'win32',
    port: { run: (cmd) => bus.toControl('voice:run', cmd) },
  });
  bindVoice(voice, bus);
  t.store.setStudio({ outputs: () => manager.outputs(), displays: () => manager.displays() });
  await t.store.init();
  bus.send('voice:devices', { devices: [MIC] });
  await bus.invoke('cmd:doc', { op: 'setDraft', text: TEXT });
  await bus.invoke('cmd:doc', { op: 'confirm' });

  const runs = (): VoiceRunCommand[] =>
    bus.control.messages.filter((m) => (m.channel as string) === 'voice:run').map((m) => m.payload as unknown as VoiceRunCommand);
  const session = (): number => voice.currentSession;
  const listen = async (): Promise<void> => {
    const r = (await bus.invoke('cmd:voice', { op: 'toggle' })) as { ok: boolean };
    expect(r.ok).toBe(true);
    bus.send('asr:ready', { session: session() });
  };
  const hear = (...words: string[]): void => bus.send('asr:hypothesis', { session: session(), words, final: false, audioEndMs: 0 });
  const open = async (): Promise<FakeWindow> => {
    const r = manager.command({ op: 'open', displayKey: keyOf(B()) }) as { ok: boolean; value: { id: number } };
    expect(r.ok).toBe(true);
    const w = windows.get(r.value.id)!;
    w.emitWeb('did-finish-load');
    return w;
  };
  const lineY = (i: number): number => t.store.layout!.lines[i].y;
  return { t, bus, voice, manager, runs, listen, hear, open, lineY };
}

const lastView = (w: FakeWindow): OutputView => w.sent.filter((m) => m.channel === 'state:output').at(-1)!.args[0] as OutputView;

describe('IT-017 microfone perdido durante a rolagem por voz', () => {
  it('o estado vai a failed com o motivo, o trecho vira hold e as saídas recebem failed depois de 700 ms, com o mesmo layout', async () => {
    const s = await setup();
    const out = await s.open();
    await s.listen();
    s.t.clock.advance(SIGNAL_DEBOUNCE_MS);
    expect(lastView(out).voiceState).toBe('listening');
    s.t.clock.advance(400);
    s.hear('bom', 'dia', 'e', 'bem', 'vindos', 'a', 'mais', 'uma', 'aula', 'hoje', 'vamos', 'falar');
    expect(s.t.store.engine.segment.kind).toBe('glide');
    s.t.clock.advance(100);
    const here = positionAt(s.t.store.engine.segment, s.t.clock.now);
    const layoutBefore = lastView(out).layout;

    s.bus.send('asr:fault', { session: s.voice.currentSession, fault: 'mic-lost' });

    const snap = s.bus.control.snapshot!;
    expect(snap.voice).toMatchObject({ state: 'failed', fault: 'mic-lost' });
    expect(snap.notices.find((n) => n.id === 'voice-fault')?.message).toBe('O microfone foi desconectado');
    expect(s.t.store.engine.segment).toEqual({ kind: 'hold', y: here });
    // As saídas receberam o mesmo `hold` e continuam com o texto.
    const segs = out.sent.filter((m) => m.channel === 'motion:segment').map((m) => m.args[0] as MotionSegment);
    expect(segs.at(-1)).toEqual({ kind: 'hold', y: here });
    s.t.clock.advance(SIGNAL_DEBOUNCE_MS - 1);
    expect(lastView(out).voiceState).toBe('listening');
    s.t.clock.advance(1);
    const view = lastView(out);
    expect(view.voiceState).toBe('failed');
    expect(view.layout).toBe(layoutBefore);
    expect(view.layout?.lines.length).toBe(LINES.length);
    expect(out.isDestroyed()).toBe(false);
  });
});

describe('IT-024 voz e comando manual no mesmo instante', () => {
  it('o manual define a posição, o alvo seguinte em menos de 300 ms é ignorado, e o próximo parte do cursor ressincronizado', async () => {
    const s = await setup();
    await s.listen();
    s.t.clock.advance(400);
    // A leitura vai pela linha 1, com hipóteses a cada 100 ms.
    const words = `${LINES[0]} ${LINES[1]}`.split(' ');
    for (let i = 3; i <= words.length; i++) {
      s.hear(...words.slice(0, i));
      s.t.clock.advance(100);
    }
    expect(segmentTarget(s.t.store.engine.segment)).toBe(s.lineY(1));
    // O operador desce uma linha no meio das hipóteses.
    s.t.clock.advance(1000);
    const manualAt = s.t.clock.now;
    s.bus.send('cmd:scroll', { type: 'lineStep', dir: 1 });
    expect(segmentTarget(s.t.store.engine.segment)).toBe(s.lineY(2));
    // O cursor foi ressincronizado: antes da linha 2.
    const tokensBeforeLine2 = `${LINES[0]} ${LINES[1]}`.split(' ').length;
    expect(s.voice.trackerCursor).toBe(tokensBeforeLine2 - 1);
    // Hipóteses a cada 100 ms dentro da prioridade do manual: nada muda.
    const line3 = LINES[2].split(' ');
    const line4 = LINES[3].split(' ');
    s.t.clock.advance(100);
    s.hear(...line4.slice(0, 4)); // a voz "ouve" a linha 3 (índice 3) cedo demais
    s.t.clock.advance(100);
    s.hear(...line4.slice(0, 5));
    expect(s.t.clock.now - manualAt).toBeLessThan(MANUAL_PRIORITY_MS);
    expect(segmentTarget(s.t.store.engine.segment)).toBe(s.lineY(2));
    expect(s.voice.trackerCursor).toBe(tokensBeforeLine2 - 1);
    // Passada a prioridade, a leitura da linha 2 avança a partir do cursor ressincronizado.
    s.t.clock.advance(MANUAL_PRIORITY_MS);
    s.hear(...line3.slice(0, 4));
    expect(s.voice.trackerCursor).toBe(tokensBeforeLine2 + 3);
    expect(segmentTarget(s.t.store.engine.segment)).toBe(s.lineY(2));
    s.t.clock.advance(200);
    s.hear(...line3, ...line4.slice(0, 3));
    expect(segmentTarget(s.t.store.engine.segment)).toBe(s.lineY(3));
  });
});
