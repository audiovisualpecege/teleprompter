/**
 * Motor Parakeet (ADR-007): o áudio vai por `MessagePort` (canal `asr:pcm`) ao
 * `ParakeetHost`, que roda o Parakeet v3 com `sherpa-onnx-node` num
 * `utilityProcess`. A janela de controle só repassa o áudio e recebe as palavras.
 *
 * O atraso (`lag`) é agora menos o `audioEndMs` da resposta: o relógio é o mesmo dos
 * dois lados, porque o `audioEndMs` foi marcado aqui e só voltou do host.
 */
import type { AsrPcmRequest, AsrPcmResponse } from '@shared/ipc';
import {
  Listeners,
  type AudioSource,
  type EngineFault,
  type Hypothesis,
  type PcmChunk,
  type SpeechEngine,
} from './engine';

/** Ligação com o host: a porta do `asr:pcm` e o aviso de que o processo terminou. */
export interface ParakeetLink {
  post(message: AsrPcmRequest, transfer?: Transferable[]): void;
  onMessage(cb: (message: AsrPcmResponse) => void): () => void;
  /** O `utilityProcess` terminou sem ter sido mandado parar. */
  onExit(cb: (code: number | null) => void): () => void;
  close(): void;
}

export interface ParakeetDeps {
  /** Abre o `utilityProcess` (pelo principal) e devolve a ligação com ele. */
  connect(): Promise<ParakeetLink>;
  now(): number;
}

export class ParakeetEngine implements SpeechEngine {
  readonly id = 'parakeet' as const;
  private link: ParakeetLink | null = null;
  private loading: Promise<void> | null = null;
  private unsubscribers: (() => void)[] = [];
  private unsubscribeInput: (() => void) | null = null;
  private crashed = false;
  private readonly hyp = new Listeners<[Hypothesis]>();
  private readonly fault = new Listeners<[EngineFault, string | undefined]>();
  private readonly lag = new Listeners<[number]>();

  constructor(private readonly deps: ParakeetDeps) {}

  load(): Promise<void> {
    if (this.link) return Promise.resolve();
    this.loading ??= this.open().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  async start(input: AudioSource, _vocabulary: string[]): Promise<void> {
    await this.load();
    this.unsubscribeInput?.();
    this.unsubscribeInput = input.onPcm((chunk) => this.feed(chunk));
  }

  /** O Parakeet reconhece qualquer palavra; o roteiro só importa para o alinhador. */
  setVocabulary(_vocabulary: string[]): void {}

  async stop(): Promise<void> {
    this.unsubscribeInput?.();
    this.unsubscribeInput = null;
    this.link?.post({ stop: true });
  }

  /** Fecha a ligação; o principal encerra o processo. */
  dispose(): void {
    void this.stop();
    this.release();
  }

  onHypothesis(cb: (h: Hypothesis) => void): () => void {
    return this.hyp.add(cb);
  }

  onFault(cb: (f: EngineFault, detail?: string) => void): () => void {
    return this.fault.add(cb);
  }

  onLag(cb: (lagMs: number) => void): () => void {
    return this.lag.add(cb);
  }

  private async open(): Promise<void> {
    this.crashed = false;
    let link: ParakeetLink;
    try {
      link = await this.deps.connect();
    } catch (e) {
      this.crash(e instanceof Error ? e.message : String(e));
      throw e;
    }
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (err?: Error): void => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };
      this.unsubscribers.push(
        link.onMessage((m) => {
          if ('ready' in m) settle();
          else if ('fault' in m) {
            this.crash(m.detail ?? m.fault, m.fault);
            settle(new Error(m.detail ?? m.fault));
          } else this.onResult(m);
        }),
        link.onExit((code) => {
          this.crash(`o processo do Parakeet terminou (código ${code ?? 'nenhum'})`);
          settle(new Error('o processo do Parakeet terminou'));
        }),
      );
      this.link = link;
    });
  }

  private feed(chunk: PcmChunk): void {
    if (!this.link || this.crashed) return;
    // Vai copiado: o `MessagePortMain` do Electron descarta um `ArrayBuffer` transferido.
    this.link.post({ pcm: chunk.samples.slice(), endMs: chunk.endMs });
  }

  private onResult(m: { words: string[]; final: boolean; audioEndMs: number }): void {
    this.lag.emit(Math.max(0, this.deps.now() - m.audioEndMs));
    if (m.words.length) this.hyp.emit({ words: m.words, final: m.final, audioEndMs: m.audioEndMs });
  }

  private release(): void {
    for (const u of this.unsubscribers.splice(0)) u();
    this.link?.close();
    this.link = null;
  }

  private crash(detail: string, fault: EngineFault = 'engine-crashed'): void {
    if (this.crashed) return;
    this.crashed = true;
    this.unsubscribeInput?.();
    this.unsubscribeInput = null;
    this.release();
    this.fault.emit(fault, detail);
  }
}
