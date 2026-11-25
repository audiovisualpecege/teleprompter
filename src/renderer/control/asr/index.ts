/** Motores reais na janela de controle. */
import voskWorkerUrl from './vosk-worker.ts?worker&url';
import { VoskEngine, voskDeps } from './vosk-engine';
import type { ControlBridge } from '@shared/ipc';
import { epochNow } from './engine';
import { connectParakeet } from './parakeet-link';
import { ParakeetEngine } from './parakeet-engine';

export function createVoskEngine(): VoskEngine {
  return new VoskEngine(voskDeps(voskWorkerUrl));
}

/** O Parakeet roda no `utilityProcess` aberto pelo principal (ADR-007). */
export function createParakeetEngine(bridge: Pick<ControlBridge, 'send'>): ParakeetEngine {
  return new ParakeetEngine({ connect: () => connectParakeet(bridge), now: epochNow });
}
