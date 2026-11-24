/**
 * Registro local da voz (TechSpec, "Monitoramento"): `voice.lag` uma vez por minuto,
 * com o atraso mediano (p50) e o p95 das medições daquele minuto, e
 * `voice.engineRestart` a cada tentativa de reiniciar o motor. Nada sai do computador.
 */
import { logEvent } from './log';

type Write = (event: string, fields: Record<string, unknown>) => void;

export const LAG_LOG_PERIOD_MS = 60_000;

/** Percentil por posição mais próxima (p em 0..100) de uma lista já ordenada. */
export function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export class LagLog {
  private samples: number[] = [];
  private periodStart: number | null = null;

  constructor(
    private readonly engine: () => string,
    private readonly write: Write = logEvent,
    private readonly periodMs = LAG_LOG_PERIOD_MS,
  ) {}

  /** Uma medição de atraso, em ms, no instante `now`. */
  add(lagMs: number, now: number): void {
    if (!Number.isFinite(lagMs)) return;
    if (this.periodStart === null) this.periodStart = now;
    if (now - this.periodStart >= this.periodMs) this.flush(now);
    this.samples.push(lagMs);
  }

  /** Grava o minuto corrente (se houver medições) e começa outro. */
  flush(now: number): void {
    if (this.samples.length) {
      const sorted = [...this.samples].sort((a, b) => a - b);
      this.write('voice.lag', {
        engine: this.engine(),
        count: sorted.length,
        p50: Math.round(percentile(sorted, 50)!),
        p95: Math.round(percentile(sorted, 95)!),
      });
    }
    this.samples = [];
    this.periodStart = now;
  }
}

export function logEngineRestart(engine: string, attempt: number, write: Write = logEvent): void {
  write('voice.engineRestart', { engine, attempt });
}
