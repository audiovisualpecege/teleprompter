/**
 * Reconhecedor trocável (TechSpec, "Interfaces centrais"; ADR-007).
 *
 * Os dois motores (Vosk e Parakeet) ficam atrás desta interface. Quem usa a voz não
 * sabe qual está ligado: recebe hipóteses (palavras ouvidas), falhas e o atraso medido.
 * Todo o áudio fica no computador.
 */
import type { EngineFault, EngineId, Hypothesis } from '@shared/types';

export type { EngineFault, EngineId, Hypothesis };

/** Um pedaço de áudio mono a 16 kHz e o instante (relógio de `epochNow`) do fim dele. */
export interface PcmChunk {
  samples: Float32Array;
  endMs: number;
}

/** Fonte de áudio já reamostrada para 16 kHz mono (o microfone ou um WAV nos testes). */
export interface AudioSource {
  readonly sampleRate: 16000;
  onPcm(cb: (chunk: PcmChunk) => void): () => void;
}

export interface SpeechEngine {
  readonly id: EngineId;
  /** "Preparando": carrega o modelo. */
  load(): Promise<void>;
  start(input: AudioSource, vocabulary: string[]): Promise<void>;
  /** Novo texto confirmado. */
  setVocabulary(vocabulary: string[]): void;
  stop(): Promise<void>;
  onHypothesis(cb: (h: Hypothesis) => void): () => void;
  onFault(cb: (f: EngineFault, detail?: string) => void): () => void;
  /** Atraso medido: agora menos o fim do áudio que gerou a hipótese. */
  onLag(cb: (lagMs: number) => void): () => void;
}

/**
 * Relógio comum entre a janela de controle e o `ParakeetHost`: milissegundos desde a
 * época, com a resolução do `performance.now()`.
 */
export function epochNow(): number {
  return performance.timeOrigin + performance.now();
}

/** Lista de ouvintes com cancelamento, usada pelos motores. */
export class Listeners<A extends unknown[]> {
  private readonly set = new Set<(...args: A) => void>();

  add(cb: (...args: A) => void): () => void {
    this.set.add(cb);
    return () => {
      this.set.delete(cb);
    };
  }

  emit(...args: A): void {
    for (const cb of [...this.set]) {
      try {
        cb(...args);
      } catch (e) {
        console.error('Ouvinte da voz falhou', e);
      }
    }
  }
}

/** Palavras de um texto reconhecido ("a casa" vira `["a", "casa"]`). */
export function splitWords(text: string | undefined | null): string[] {
  return typeof text === 'string' ? text.split(/\s+/).filter(Boolean) : [];
}
