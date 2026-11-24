import type { ControlBridge, OutputBridge } from './shared/ipc';

declare global {
  /** Versão do `package.json`, injetada no build pelo `electron.vite.config.ts`. */
  const __APP_VERSION__: string;
  /** Verdadeiro só no build de teste (`--mode test`): liga `__tpProbe` e `__tpTest`. */
  const __TP_TEST__: boolean;

  interface TpTestBridge {
    call(name: string, ...args: unknown[]): Promise<unknown>;
    list(): Promise<string[]>;
  }

  interface Window {
    tp: ControlBridge | OutputBridge;
    /** Só no build de teste. */
    __tpProbe?: (name?: string) => unknown;
    /** Só no build de teste. */
    __tpTest?: Record<string, (...args: unknown[]) => unknown>;
    /** Só no build de teste: ponte do preload para os ganchos do principal. */
    __tpTestBridge?: TpTestBridge;
  }
}

export {};
