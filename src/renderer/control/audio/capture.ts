/**
 * Captura do microfone (TechSpec, "Voz"; US-028 e US-029): `getUserMedia` com o
 * microfone escolhido, `AudioWorklet` que entrega 16 kHz mono em pedaços de 100 ms e o
 * nível RMS para o medidor. As falhas do navegador viram as falhas da voz:
 *
 * - `NotAllowedError` (permissão negada) vira `mic-denied`;
 * - `NotFoundError` (nenhum microfone, ou o escolhido sumiu) vira `no-mic`;
 * - o `ended` da trilha (microfone desligado no meio) vira `mic-lost`.
 *
 * O áudio nunca sai do computador: vai só ao motor de voz local.
 */
import { Listeners, epochNow, type AudioSource, type PcmChunk } from '../asr/engine';
import type { WorkletChunk } from './pcm-worklet';

export type CaptureFault = 'mic-denied' | 'no-mic' | 'mic-lost';

/** O que a captura usa de `AudioContext` (troca por falso nos testes). */
export interface AudioContextLike {
  readonly audioWorklet: { addModule(url: string): Promise<void> };
  readonly state: string;
  createMediaStreamSource(stream: MediaStream): { connect(node: unknown): unknown; disconnect(): void };
  resume(): Promise<void>;
  close(): Promise<void>;
}

export interface WorkletNodeLike {
  readonly port: { onmessage: ((e: MessageEvent<WorkletChunk>) => void) | null };
  disconnect(): void;
}

export interface CaptureDeps {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  createContext(): AudioContextLike;
  createWorkletNode(ctx: AudioContextLike, name: string): WorkletNodeLike;
  workletUrl: string;
  now(): number;
}

/** Traduz o erro do `getUserMedia` na falha da voz. */
export function faultFromMediaError(e: unknown): CaptureFault {
  const name = (e as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'mic-denied';
  if (name === 'NotReadableError' || name === 'AbortError') return 'mic-lost';
  return 'no-mic';
}

export class AudioCapture implements AudioSource {
  readonly sampleRate = 16000 as const;
  private stream: MediaStream | null = null;
  private ctx: AudioContextLike | null = null;
  private node: WorkletNodeLike | null = null;
  private source: { disconnect(): void } | null = null;
  private generation = 0;
  private readonly pcm = new Listeners<[PcmChunk]>();
  private readonly level = new Listeners<[number]>();
  private readonly fault = new Listeners<[CaptureFault, string | undefined]>();

  constructor(private readonly deps: CaptureDeps) {}

  /**
   * Liga o microfone escolhido (`null` usa o padrão do sistema). Devolve a falha, se
   * houver, e também a emite em `onFault`.
   */
  async start(deviceId: string | null): Promise<CaptureFault | null> {
    await this.stop();
    const gen = ++this.generation;
    let stream: MediaStream;
    try {
      stream = await this.deps.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch (e) {
      const f = faultFromMediaError(e);
      this.fault.emit(f, (e as Error)?.message);
      return f;
    }
    if (gen !== this.generation) {
      for (const t of stream.getTracks()) t.stop();
      return null;
    }
    this.stream = stream;
    for (const track of stream.getAudioTracks()) {
      track.addEventListener('ended', () => {
        if (gen === this.generation) {
          this.fault.emit('mic-lost', track.label);
          void this.stop();
        }
      });
    }
    try {
      const ctx = this.deps.createContext();
      this.ctx = ctx;
      await ctx.audioWorklet.addModule(this.deps.workletUrl);
      if (gen !== this.generation) return null;
      const node = this.deps.createWorkletNode(ctx, 'tp-pcm');
      node.port.onmessage = (e) => {
        if (gen !== this.generation) return;
        const { samples, rms } = e.data;
        this.level.emit(rms);
        this.pcm.emit({ samples, endMs: this.deps.now() });
      };
      const source = ctx.createMediaStreamSource(stream);
      source.connect(node);
      this.node = node;
      this.source = source;
      if (ctx.state !== 'running') await ctx.resume();
    } catch (e) {
      await this.stop();
      this.fault.emit('mic-lost', (e as Error)?.message);
      return 'mic-lost';
    }
    return null;
  }

  async stop(): Promise<void> {
    this.generation++;
    this.source?.disconnect();
    this.node?.disconnect();
    if (this.node) this.node.port.onmessage = null;
    for (const t of this.stream?.getTracks() ?? []) t.stop();
    const ctx = this.ctx;
    this.source = null;
    this.node = null;
    this.stream = null;
    this.ctx = null;
    if (ctx && ctx.state !== 'closed') await ctx.close().catch(() => undefined);
  }

  get active(): boolean {
    return this.stream !== null;
  }

  onPcm(cb: (chunk: PcmChunk) => void): () => void {
    return this.pcm.add(cb);
  }

  /** Nível RMS de 0 a 1, a cada 100 ms, para o medidor. */
  onLevel(cb: (rms: number) => void): () => void {
    return this.level.add(cb);
  }

  onFault(cb: (f: CaptureFault, detail?: string) => void): () => void {
    return this.fault.add(cb);
  }
}

/** Dependências reais, na janela de controle. */
export function browserCaptureDeps(workletUrl: string): CaptureDeps {
  return {
    getUserMedia: (c) => navigator.mediaDevices.getUserMedia(c),
    createContext: () => new AudioContext({ latencyHint: 'interactive' }),
    createWorkletNode: (ctx, name) =>
      new AudioWorkletNode(ctx as unknown as AudioContext, name, { numberOfInputs: 1, numberOfOutputs: 0 }),
    workletUrl,
    now: epochNow,
  };
}
