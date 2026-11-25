/**
 * Tela de voz, estado da voz e faixa de alerta (UT-229, UT-230, UT-238), e a voz da
 * janela de controle (`VoiceRuntime`) com captura, motor e microfones falsos.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { VoiceRunCommand } from '@shared/ipc';
import type { EngineFault, EngineId, Hypothesis, MicDevice, VoiceState } from '@shared/types';
import { VOICE_FAULT_NOTICE } from '@shared/voice';
import { App } from '../../src/renderer/control/App';
import type { PcmChunk } from '../../src/renderer/control/asr/engine';
import type { CaptureFault } from '../../src/renderer/control/audio/capture';
import { createControlStore, type VoiceView } from '../../src/renderer/control/control-store';
import { levelPercent } from '../../src/renderer/control/VoicePanel';
import { micDevices, VoiceRuntime, type CaptureLike, type MediaDevicesLike, type RuntimeEngine } from '../../src/renderer/control/voice-runtime';
import { createFakeBridge, snapshotWith, type FakeControlBridge } from '../fakes/control-bridge';

const INTERFACE_MICS: MicDevice[] = [
  { deviceId: 'in-12', label: 'Entrada 1/2 (Focusrite USB)' },
  { deviceId: 'in-34', label: 'Entrada 3/4 (Focusrite USB)' },
  { deviceId: 'laptop', label: 'Microfone interno' },
];

function fakeVoiceView(initial: MicDevice[] = INTERFACE_MICS) {
  const devices = new Set<(l: MicDevice[]) => void>();
  const levels = new Set<(r: number) => void>();
  const view = {
    deviceList: initial,
    currentLevel: 0,
    monitors: [] as (string | null | undefined)[],
    onDevices: (cb: (l: MicDevice[]) => void) => (devices.add(cb), () => void devices.delete(cb)),
    onLevel: (cb: (r: number) => void) => (levels.add(cb), () => void levels.delete(cb)),
    monitor(id: string | null | undefined) {
      view.monitors.push(id);
    },
    setDevices(list: MicDevice[]) {
      view.deviceList = list;
      act(() => devices.forEach((cb) => cb(list)));
    },
    setLevel(r: number) {
      view.currentLevel = r;
      act(() => levels.forEach((cb) => cb(r)));
    },
  };
  return view satisfies VoiceView & Record<string, unknown>;
}

function renderWithVoice(initial = snapshotWith({ doc: { draftText: 'Texto', confirmedText: 'Texto' } }), voice = fakeVoiceView()) {
  const bridge = createFakeBridge();
  const store = createControlStore({ bridge, clock: { now: () => 0 }, initial, layoutService: null, voice });
  render(<App store={store} />);
  return { bridge, voice };
}

const voiceSnap = (state: VoiceState, extra: Partial<Parameters<typeof snapshotWith>[0]> = {}) =>
  snapshotWith({
    doc: { draftText: 'Texto', confirmedText: 'Texto' },
    voice: { state, fault: state === 'failed' ? 'mic-lost' : null, engine: 'vosk', mode: 'near', lagMs: null },
    ...extra,
  });

describe('Estado da voz e faixa de alerta', () => {
  it.each<[VoiceState, string, string]>([
    ['preparing', 'Preparando', '--info'],
    ['listening', 'Ouvindo', '--success'],
    ['waiting', 'Esperando', '--warning'],
    ['failed', 'Falhou', '--danger'],
  ])('UT-229: %s mostra "%s" com a cor %s', (state, text, token) => {
    renderWithVoice(voiceSnap(state));
    const badge = screen.getByRole('status', { name: 'Estado da voz' });
    expect(badge).toHaveTextContent(text);
    expect(badge).toHaveAttribute('data-color', token);
    const dot = badge.querySelector('.tp-voice-dot') as HTMLElement;
    expect(dot.style.background).toBe(`var(${token})`);
    expect((badge.querySelector('.tp-voice-label') as HTMLElement).style.color).toBe(`var(${token})`);
    // O estado fica ao lado das ações de gravação.
    expect(screen.getByRole('toolbar', { name: 'Ações de gravação' })).toContainElement(badge);
  });

  it('UT-230: em failed aparece a faixa com o motivo, e ela some ao voltar a listening', () => {
    const { bridge } = renderWithVoice(voiceSnap('listening'));
    expect(screen.queryByRole('alert')).toBeNull();
    const notices = [{ id: VOICE_FAULT_NOTICE, kind: 'danger' as const, message: 'O microfone foi desconectado', at: 1 }];
    bridge.emit('state:snapshot', voiceSnap('failed', { notices }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('tp-voice-alert');
    expect(alert).toHaveTextContent('Falhou: O microfone foi desconectado');
    // A falha não vira também um aviso comum.
    expect(document.querySelectorAll('.tp-notices')).toHaveLength(0);
    bridge.emit('state:snapshot', voiceSnap('listening'));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Tela de voz', () => {
  const openVoiceTab = () => fireEvent.click(screen.getByRole('tab', { name: 'Voz' }));

  it('UT-238: a lista mostra os nomes de enumerateDevices, inclusive as entradas de uma mesma interface', () => {
    const { voice } = renderWithVoice();
    openVoiceTab();
    const select = screen.getByLabelText('Entrada de áudio') as HTMLSelectElement;
    const labels = [...select.options].map((o) => o.textContent);
    expect(labels).toEqual(['Padrão do sistema', 'Entrada 1/2 (Focusrite USB)', 'Entrada 3/4 (Focusrite USB)', 'Microfone interno']);
    // `devicechange`: a lista se atualiza.
    voice.setDevices(INTERFACE_MICS.slice(0, 2));
    expect([...select.options].map((o) => o.textContent)).toEqual(['Padrão do sistema', 'Entrada 1/2 (Focusrite USB)', 'Entrada 3/4 (Focusrite USB)']);
  });

  it('UT-238: as entradas vêm de enumerateDevices sem as entradas virtuais e sem as câmeras', () => {
    expect(
      micDevices([
        { deviceId: 'default', kind: 'audioinput', label: 'Padrão - Entrada 1/2 (Focusrite USB)' },
        { deviceId: 'communications', kind: 'audioinput', label: 'Comunicações - Entrada 1/2 (Focusrite USB)' },
        { deviceId: 'in-12', kind: 'audioinput', label: 'Entrada 1/2 (Focusrite USB)' },
        { deviceId: 'in-34', kind: 'audioinput', label: 'Entrada 3/4 (Focusrite USB)' },
        { deviceId: 'cam', kind: 'videoinput', label: 'Câmera' },
        { deviceId: 'out', kind: 'audiooutput', label: 'Alto-falantes' },
      ]),
    ).toEqual([
      { deviceId: 'in-12', label: 'Entrada 1/2 (Focusrite USB)' },
      { deviceId: 'in-34', label: 'Entrada 3/4 (Focusrite USB)' },
    ]);
  });

  it('escolher microfone, motor e modo manda cmd:voice; o medidor acompanha o nível', () => {
    const { bridge, voice } = renderWithVoice(
      voiceSnap('off', { voiceSetup: { micDeviceId: null, micLabel: null, engines: ['vosk', 'parakeet'], parakeetUnavailable: null } }),
    );
    openVoiceTab();
    expect(voice.monitors.at(-1)).toBeNull(); // medidor no microfone padrão, com a voz desligada
    fireEvent.change(screen.getByLabelText('Entrada de áudio'), { target: { value: 'in-34' } });
    fireEvent.click(screen.getByLabelText('Parakeet'));
    fireEvent.click(screen.getByLabelText('Pulos para a frente'));
    const cmds = bridge.invokes.filter((i) => i.channel === 'cmd:voice').map((i) => i.payload);
    expect(cmds).toEqual([
      { op: 'setMic', deviceId: 'in-34' },
      { op: 'setEngine', engine: 'parakeet' },
      { op: 'setMode', mode: 'forwardJumps' },
    ]);
    const meter = screen.getByRole('meter', { name: 'Nível do microfone' });
    expect(meter).toHaveAttribute('aria-valuenow', '0');
    voice.setLevel(0.1);
    expect(meter).toHaveAttribute('aria-valuenow', String(levelPercent(0.1)));
    expect(levelPercent(0.1)).toBeGreaterThan(40);
    expect((meter.firstChild as HTMLElement).className).toBe('tp-level-fill');
  });

  it('o Parakeet fica indisponível onde não carrega, com o motivo', () => {
    renderWithVoice(
      voiceSnap('off', { voiceSetup: { micDeviceId: null, micLabel: null, engines: ['vosk'], parakeetUnavailable: 'O Parakeet não roda em linux-x64.' } }),
    );
    openVoiceTab();
    expect(screen.getByLabelText('Parakeet')).toBeDisabled();
    expect(within(screen.getByRole('region', { name: 'Motor de voz' })).getByText('O Parakeet não roda em linux-x64.')).toBeInTheDocument();
  });

  it('o microfone guardado ausente aparece marcado e com o aviso', () => {
    renderWithVoice(
      voiceSnap('off', {
        voiceSetup: { micDeviceId: 'lapela', micLabel: 'Microfone de lapela', engines: ['vosk'], parakeetUnavailable: null },
        notices: [{ id: 'mic-missing', kind: 'warning', message: 'O microfone guardado não está ligado. Escolha outro na aba Voz' }],
      }),
    );
    openVoiceTab();
    const select = screen.getByLabelText('Entrada de áudio') as HTMLSelectElement;
    expect(select.value).toBe('lapela');
    expect(select.selectedOptions[0].textContent).toBe('Microfone de lapela (não está ligado)');
  });
});

/* ---------- VoiceRuntime ---------- */

function fakeBridge(): FakeControlBridge {
  return createFakeBridge();
}

function fakeCapture() {
  const faults = new Set<(f: CaptureFault, d?: string) => void>();
  const c = {
    sampleRate: 16000 as const,
    starts: [] as (string | null)[],
    stops: 0,
    nextFault: null as CaptureFault | null,
    onPcm: (_cb: (c: PcmChunk) => void) => () => undefined,
    onLevel: (_cb: (r: number) => void) => () => undefined,
    onFault: (cb: (f: CaptureFault, d?: string) => void) => (faults.add(cb), () => void faults.delete(cb)),
    async start(id: string | null) {
      c.starts.push(id);
      const f = c.nextFault;
      if (f) faults.forEach((cb) => cb(f));
      return f;
    },
    async stop() {
      c.stops++;
    },
    emitFault(f: CaptureFault) {
      faults.forEach((cb) => cb(f));
    },
  };
  return c satisfies CaptureLike & Record<string, unknown>;
}

function fakeEngine(id: EngineId) {
  const hyps = new Set<(h: Hypothesis) => void>();
  const faults = new Set<(f: EngineFault, d?: string) => void>();
  let release: () => void = () => undefined;
  const e = {
    id,
    loads: 0,
    vocab: [] as string[][],
    gate: null as Promise<void> | null,
    async load() {
      e.loads++;
      if (e.gate) await e.gate;
    },
    async start(_input: unknown, v: string[]) {
      e.vocab.push(v);
    },
    setVocabulary(v: string[]) {
      e.vocab.push(v);
    },
    async stop() {},
    onHypothesis: (cb: (h: Hypothesis) => void) => (hyps.add(cb), () => void hyps.delete(cb)),
    onFault: (cb: (f: EngineFault, d?: string) => void) => (faults.add(cb), () => void faults.delete(cb)),
    onLag: () => () => undefined,
    hold() {
      e.gate = new Promise((r) => (release = r));
    },
    release: () => release(),
    say(words: string[]) {
      hyps.forEach((cb) => cb({ words, final: false, audioEndMs: 0 }));
    },
  };
  return e satisfies RuntimeEngine & Record<string, unknown>;
}

function fakeMedia(list: { deviceId: string; kind: MediaDeviceKind; label: string }[]) {
  const cbs = new Set<() => void>();
  const m = {
    list,
    enumerateDevices: async () => m.list.map((d) => ({ ...d, groupId: 'g' })),
    addEventListener: (_t: 'devicechange', cb: () => void) => void cbs.add(cb),
    removeEventListener: (_t: 'devicechange', cb: () => void) => void cbs.delete(cb),
    change() {
      cbs.forEach((cb) => cb());
    },
  };
  return m satisfies MediaDevicesLike & Record<string, unknown>;
}

async function runtime(media = fakeMedia([{ deviceId: 'mic-1', kind: 'audioinput', label: 'Microfone USB' }])) {
  const bridge = fakeBridge();
  const capture = fakeCapture();
  const engines: ReturnType<typeof fakeEngine>[] = [];
  const rt = new VoiceRuntime({
    bridge,
    capture,
    media,
    createEngine: (id) => {
      const e = fakeEngine(id);
      engines.push(e);
      return e;
    },
  });
  await rt.idle();
  await new Promise((r) => setTimeout(r, 0));
  const run = async (cmd: VoiceRunCommand) => {
    bridge.emit('voice:run', cmd);
    await rt.idle();
  };
  const sent = (channel: string) => bridge.sends.filter((s) => s.channel === channel).map((s) => s.payload);
  return { bridge, capture, engines, rt, run, sent, media };
}

describe('VoiceRuntime', () => {
  it('manda a lista de microfones na abertura e a cada devicechange', async () => {
    const r = await runtime();
    expect(r.sent('voice:devices')).toEqual([{ devices: [{ deviceId: 'mic-1', label: 'Microfone USB' }] }]);
    r.media.list = [];
    r.media.change();
    await new Promise((res) => setTimeout(res, 0));
    expect(r.sent('voice:devices').at(-1)).toEqual({ devices: [] });
  });

  it('start carrega o motor, liga a captura no microfone e responde asr:ready com a sessão', async () => {
    const r = await runtime();
    await r.run({ op: 'start', session: 3, engine: 'vosk', deviceId: 'mic-1', vocabulary: ['a', '[unk]'] });
    expect(r.engines[0].vocab).toEqual([['a', '[unk]']]);
    expect(r.capture.starts).toEqual(['mic-1']);
    expect(r.sent('asr:ready')).toEqual([{ session: 3 }]);
    r.engines[0].say(['a', 'casa']);
    expect(r.sent('asr:hypothesis')).toEqual([{ words: ['a', 'casa'], final: false, audioEndMs: 0, session: 3 }]);
  });

  it('ligar e desligar durante o carregamento não deixa carregamento pendente nem resposta velha', async () => {
    const r = await runtime();
    const first = fakeEngine('vosk');
    first.hold();
    const rt = new VoiceRuntime({ bridge: r.bridge, capture: r.capture, media: null, createEngine: () => first });
    r.bridge.emit('voice:run', { op: 'start', session: 1, engine: 'vosk', deviceId: null, vocabulary: [] });
    r.bridge.emit('voice:run', { op: 'stop', session: 2 });
    first.release();
    await rt.idle();
    expect(r.sent('asr:ready')).toEqual([]);
    expect(r.capture.starts).toEqual([]);
  });

  it('a captura sem permissão vira asr:fault mic-denied da sessão', async () => {
    const r = await runtime();
    r.capture.nextFault = 'mic-denied';
    await r.run({ op: 'start', session: 5, engine: 'vosk', deviceId: null, vocabulary: [] });
    expect(r.sent('asr:fault')).toEqual([{ session: 5, fault: 'mic-denied' }]);
    expect(r.sent('asr:ready')).toEqual([]);
  });

  it('setMic troca só a captura; setVocabulary vai ao motor', async () => {
    const r = await runtime();
    await r.run({ op: 'start', session: 1, engine: 'vosk', deviceId: 'mic-1', vocabulary: ['a'] });
    await r.run({ op: 'setMic', session: 1, deviceId: 'mic-2' });
    await r.run({ op: 'setVocabulary', session: 1, vocabulary: ['b'] });
    expect(r.capture.starts).toEqual(['mic-1', 'mic-2']);
    expect(r.engines).toHaveLength(1);
    expect(r.engines[0].loads).toBe(1);
    expect(r.engines[0].vocab).toEqual([['a'], ['b']]);
  });

  it('trocar de motor desliga o anterior e carrega o novo', async () => {
    const r = await runtime();
    await r.run({ op: 'start', session: 1, engine: 'vosk', deviceId: null, vocabulary: [] });
    await r.run({ op: 'start', session: 2, engine: 'parakeet', deviceId: null, vocabulary: [] });
    expect(r.engines.map((e) => e.id)).toEqual(['vosk', 'parakeet']);
    expect(r.sent('asr:ready')).toEqual([{ session: 1 }, { session: 2 }]);
  });

  it('microfone simulado: stopMicTrack manda mic-lost e lista vazia; restoreMic manda a lista de volta', async () => {
    const r = await runtime();
    await r.run({ op: 'start', session: 7, engine: 'vosk', deviceId: null, vocabulary: [] });
    r.rt.simulateUnplug();
    await new Promise((res) => setTimeout(res, 0));
    await new Promise((res) => setTimeout(res, 0));
    expect(r.sent('asr:fault')).toEqual([{ session: 7, fault: 'mic-lost', detail: 'microfone simulado desligado' }]);
    expect(r.sent('voice:devices').at(-1)).toEqual({ devices: [] });
    await r.rt.simulateReplug();
    expect(r.sent('voice:devices').at(-1)).toEqual({ devices: [{ deviceId: 'mic-1', label: 'Microfone USB' }] });
  });
});
