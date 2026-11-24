/**
 * Processamento de áudio puro, usado pelo `AudioWorklet` e pelos testes: reamostragem
 * para 16 kHz mono e nível RMS para o medidor.
 */
export const TARGET_SAMPLE_RATE = 16000;

/**
 * Reamostrador contínuo: cada amostra de saída é a média das amostras de entrada que
 * caem no seu intervalo (filtro de caixa, que evita o serrilhado ao reduzir de 48 kHz
 * para 16 kHz). Guarda o resto entre um bloco e o outro, então o resultado não depende
 * do tamanho dos blocos. Para taxas menores que a de saída, repete a amostra.
 */
export class Resampler {
  private readonly ratio: number;
  private sum = 0;
  private filled = 0;

  constructor(
    readonly inputRate: number,
    readonly outputRate: number = TARGET_SAMPLE_RATE,
  ) {
    if (!(inputRate > 0) || !(outputRate > 0)) throw new RangeError('Taxa de amostragem inválida');
    this.ratio = inputRate / outputRate;
  }

  process(input: Float32Array): Float32Array {
    const r = this.ratio;
    const out = new Float32Array(Math.ceil((input.length + this.filled) / r) + 1);
    let n = 0;
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      let remaining = 1;
      while (remaining > 1e-9) {
        const take = Math.min(remaining, r - this.filled);
        this.sum += x * take;
        this.filled += take;
        remaining -= take;
        if (this.filled >= r - 1e-9) {
          out[n++] = this.sum / r;
          this.sum = 0;
          this.filled = 0;
        }
      }
    }
    return out.slice(0, n);
  }

  reset(): void {
    this.sum = 0;
    this.filled = 0;
  }
}

/** Reamostra um bloco inteiro de uma vez. */
export function resample(input: Float32Array, inputRate: number, outputRate = TARGET_SAMPLE_RATE): Float32Array {
  return new Resampler(inputRate, outputRate).process(input);
}

/** Nível RMS de 0 a 1. Silêncio (ou bloco vazio) devolve 0. */
export function rms(samples: Float32Array): number {
  if (!samples.length) return 0;
  let acc = 0;
  for (let i = 0; i < samples.length; i++) acc += samples[i] * samples[i];
  return Math.sqrt(acc / samples.length);
}

/** Mistura os canais em mono (média). */
export function downmix(channels: readonly Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];
  const n = channels[0].length;
  const out = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) out[i] += ch[i] / channels.length;
  return out;
}
