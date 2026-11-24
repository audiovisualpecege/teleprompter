/** Motores reais na janela de controle. */
import voskWorkerUrl from './vosk-worker.ts?worker&url';
import { VoskEngine, voskDeps } from './vosk-engine';

export function createVoskEngine(): VoskEngine {
  return new VoskEngine(voskDeps(voskWorkerUrl));
}
