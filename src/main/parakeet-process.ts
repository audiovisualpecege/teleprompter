/**
 * Lado do principal do Parakeet (ADR-007): abre o `ParakeetHost` num `utilityProcess`
 * só quando o Parakeet está ativo, cria o canal `asr:pcm` (um par de `MessagePort`),
 * entrega uma ponta ao processo e devolve a outra para ir à janela de controle.
 * Saída do processo sem ter sido mandado parar é falha do motor (`engine-crashed`).
 */
import type { EngineFault } from '@shared/types';
import type { ParakeetInit } from './parakeet-host';

export interface PortMainLike {
  close(): void;
}

export interface UtilityProcessLike {
  postMessage(message: ParakeetInit, transfer?: PortMainLike[]): void;
  on(event: 'exit', cb: (code: number) => void): unknown;
  kill(): boolean;
}

export interface ParakeetProcessDeps {
  /** `utilityProcess.fork(modulePath, [], { serviceName })`. */
  fork(modulePath: string): UtilityProcessLike;
  /** `new MessageChannelMain()`. */
  createChannel(): { port1: PortMainLike; port2: PortMainLike };
  modulePath: string;
  modelsDir: string;
  onFault(fault: EngineFault, detail: string): void;
}

export interface ParakeetProcess {
  /** A ponta do `asr:pcm` que vai à janela de controle (`webContents.postMessage`). */
  readonly rendererPort: PortMainLike;
  /** Para o processo; a saída depois disso não é falha. */
  stop(): void;
}

export function launchParakeet(deps: ParakeetProcessDeps): ParakeetProcess {
  const child = deps.fork(deps.modulePath);
  const { port1, port2 } = deps.createChannel();
  let stopping = false;
  child.on('exit', (code) => {
    if (stopping) return;
    stopping = true;
    port2.close();
    deps.onFault('engine-crashed', `o processo do Parakeet terminou (código ${code})`);
  });
  child.postMessage({ type: 'init', modelsDir: deps.modelsDir }, [port1]);
  return {
    rendererPort: port2,
    stop() {
      if (stopping) return;
      stopping = true;
      port2.close();
      child.kill();
    },
  };
}
