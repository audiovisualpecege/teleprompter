import { describe, expect, it, vi } from 'vitest';
import { AudioCapture, type AudioContextLike, type CaptureDeps, type WorkletNodeLike } from '../../src/renderer/control/audio/capture';
import { Resampler, resample, rms } from '../../src/renderer/control/audio/dsp';

function sine(n: number, rate: number, freq: number, amp: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / rate);
  return out;
}

class FakeTrack extends EventTarget {
  stopped = false;
  label = 'Microfone USB';
  stop(): void {
    this.stopped = true;
  }
}

function fakeStream(track = new FakeTrack()): MediaStream {
  return { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
}

function makeDeps(getUserMedia: CaptureDeps['getUserMedia']): { deps: CaptureDeps; node: WorkletNodeLike } {
  const node: WorkletNodeLike = { port: { onmessage: null }, disconnect: vi.fn() };
  const ctx: AudioContextLike = {
    audioWorklet: { addModule: vi.fn(async () => undefined) },
    state: 'running',
    createMediaStreamSource: () => ({ connect: vi.fn(), disconnect: vi.fn() }),
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
  let t = 1000;
  return {
    node,
    deps: {
      getUserMedia,
      createContext: () => ctx,
      createWorkletNode: () => node,
      workletUrl: 'worklet.js',
      now: () => (t += 100),
    },
  };
}

const domError = (name: string): Error => Object.assign(new Error(name), { name });

describe('audio-capture', () => {
  it('UT-105 audio-capture: 4.800 amostras a 48 kHz viram 1.600 a 16 kHz', () => {
    const input = sine(4800, 48000, 440, 0.5);
    const out = resample(input, 48000);
    expect(out.length).toBe(1600);
    // O tom continua com a mesma amplitude (filtro de caixa de 3 amostras atenua pouco 440 Hz).
    expect(rms(out)).toBeGreaterThan(0.34);
    // Em blocos de 128 (como no AudioWorklet), o total é o mesmo.
    const r = new Resampler(48000);
    let total = 0;
    for (let i = 0; i < input.length; i += 128) total += r.process(input.subarray(i, i + 128)).length;
    expect(total).toBe(1600);
    // 44,1 kHz também chega a 16 kHz.
    expect(resample(new Float32Array(44100), 44100).length).toBe(16000);
  });

  it('UT-106 audio-capture: NotAllowedError vira mic-denied', async () => {
    const { deps } = makeDeps(() => Promise.reject(domError('NotAllowedError')));
    const cap = new AudioCapture(deps);
    const faults: string[] = [];
    cap.onFault((f) => faults.push(f));
    expect(await cap.start('mic-1')).toBe('mic-denied');
    expect(faults).toEqual(['mic-denied']);
  });

  it('UT-107 audio-capture: NotFoundError vira no-mic', async () => {
    const { deps } = makeDeps(() => Promise.reject(domError('NotFoundError')));
    const cap = new AudioCapture(deps);
    const faults: string[] = [];
    cap.onFault((f) => faults.push(f));
    expect(await cap.start('sumiu')).toBe('no-mic');
    expect(faults).toEqual(['no-mic']);
  });

  it('UT-108 audio-capture: ended da trilha vira mic-lost', async () => {
    const track = new FakeTrack();
    const getUserMedia = vi.fn(async () => fakeStream(track));
    const { deps } = makeDeps(getUserMedia);
    const cap = new AudioCapture(deps);
    const faults: string[] = [];
    cap.onFault((f) => faults.push(f));
    expect(await cap.start('mic-1')).toBeNull();
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ audio: expect.objectContaining({ deviceId: { exact: 'mic-1' } }) }),
    );
    track.dispatchEvent(new Event('ended'));
    expect(faults).toEqual(['mic-lost']);
    expect(cap.active).toBe(false);
  });

  it('UT-109 audio-capture: medidor de nível dá 0,354 para seno de 0,5 e 0 no silêncio', async () => {
    expect(rms(sine(16000, 16000, 440, 0.5))).toBeCloseTo(0.354, 2);
    expect(Math.abs(rms(sine(16000, 16000, 440, 0.5)) - 0.354)).toBeLessThan(0.01);
    expect(rms(new Float32Array(1600))).toBe(0);
    expect(rms(new Float32Array(0))).toBe(0);

    // O nível chega a quem ouve junto com o áudio de 100 ms vindo do worklet.
    const { deps, node } = makeDeps(async () => fakeStream());
    const cap = new AudioCapture(deps);
    const levels: number[] = [];
    const chunks: number[] = [];
    cap.onLevel((l) => levels.push(l));
    cap.onPcm((c) => chunks.push(c.samples.length));
    await cap.start(null);
    const samples = sine(1600, 16000, 440, 0.5);
    node.port.onmessage!({ data: { samples, rms: rms(samples) } } as MessageEvent);
    expect(levels[0]).toBeCloseTo(0.354, 2);
    expect(chunks).toEqual([1600]);
  });
});
