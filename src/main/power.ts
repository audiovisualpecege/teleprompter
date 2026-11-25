/**
 * Bloqueio da proteção de tela e da suspensão (US-026 EC-4): enquanto houver ao menos
 * uma saída aberta, com qualquer forma de rolagem, o sistema não apaga o monitor.
 */
import type { PowerSaveAdapter } from './platform';

export class PowerGuard {
  private readonly adapter: PowerSaveAdapter;
  private blockerId: number | null = null;

  constructor(adapter: PowerSaveAdapter) {
    this.adapter = adapter;
  }

  /** O bloqueio está ligado agora. */
  get active(): boolean {
    return this.blockerId !== null && this.adapter.isStarted(this.blockerId);
  }

  /** Liga com a primeira saída aberta e desliga quando a última fecha ou cai. */
  update(openOutputs: number): void {
    if (openOutputs > 0 && this.blockerId === null) {
      this.blockerId = this.adapter.start('prevent-display-sleep');
    } else if (openOutputs <= 0 && this.blockerId !== null) {
      this.adapter.stop(this.blockerId);
      this.blockerId = null;
    }
  }

  dispose(): void {
    this.update(0);
  }
}
