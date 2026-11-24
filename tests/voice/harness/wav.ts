/** Leitura de WAV PCM de 16 bits (as fixtures de voz) em Float32 mono. */
export interface Wav {
  rate: number;
  samples: Float32Array;
}

export function parseWav(buf: ArrayBuffer): Wav {
  const v = new DataView(buf);
  const tag = (o: number): string =>
    String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Não é um WAV');
  let off = 12;
  let channels = 1;
  let rate = 16000;
  let bits = 16;
  while (off + 8 <= v.byteLength) {
    const id = tag(off);
    const size = v.getUint32(off + 4, true);
    if (id === 'fmt ') {
      channels = v.getUint16(off + 10, true);
      rate = v.getUint32(off + 12, true);
      bits = v.getUint16(off + 22, true);
    } else if (id === 'data') {
      if (bits !== 16) throw new Error('O WAV precisa ter 16 bits');
      const frames = Math.floor(size / 2 / channels);
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let acc = 0;
        for (let c = 0; c < channels; c++) acc += v.getInt16(off + 8 + (i * channels + c) * 2, true);
        samples[i] = acc / channels / 32768;
      }
      return { rate, samples };
    }
    off += 8 + size + (size % 2);
  }
  throw new Error('WAV sem dados');
}
