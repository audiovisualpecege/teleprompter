/**
 * AudioWorklet da captura: recebe os blocos do microfone na taxa do sistema, mistura
 * em mono, reamostra para 16 kHz e manda à janela pedaços de 100 ms com o nível RMS.
 */
import { downmix, Resampler, rms, TARGET_SAMPLE_RATE } from './dsp';

/** Pedaço enviado à janela: 100 ms a 16 kHz. */
export const CHUNK_SAMPLES = TARGET_SAMPLE_RATE / 10;

export interface WorkletChunk {
  samples: Float32Array;
  rms: number;
}

declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, ctor: unknown): void;

class PcmProcessor extends AudioWorkletProcessor {
  private readonly resampler = new Resampler(sampleRate, TARGET_SAMPLE_RATE);
  private buffer = new Float32Array(CHUNK_SAMPLES);
  private filled = 0;

  process(inputs: Float32Array[][]): boolean {
    const channels = inputs[0];
    if (!channels || channels.length === 0) return true;
    const mono = this.resampler.process(downmix(channels));
    let i = 0;
    while (i < mono.length) {
      const take = Math.min(CHUNK_SAMPLES - this.filled, mono.length - i);
      this.buffer.set(mono.subarray(i, i + take), this.filled);
      this.filled += take;
      i += take;
      if (this.filled === CHUNK_SAMPLES) {
        const samples = this.buffer;
        const msg: WorkletChunk = { samples, rms: rms(samples) };
        this.port.postMessage(msg, [samples.buffer]);
        this.buffer = new Float32Array(CHUNK_SAMPLES);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor('tp-pcm', PcmProcessor);
