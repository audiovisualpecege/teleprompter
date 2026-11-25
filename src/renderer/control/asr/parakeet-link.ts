/**
 * Ligação da janela de controle com o `ParakeetHost` (ADR-007): pede o processo ao
 * principal (`voice:wantParakeet`) e recebe a porta do `asr:pcm`, que o preload repassa
 * com `window.postMessage`. O fim inesperado do processo chega do mesmo jeito.
 */
import { PARAKEET_EXIT_MESSAGE, PARAKEET_PORT_CHANNEL, type AsrPcmResponse, type ControlBridge } from '@shared/ipc';
import type { ParakeetLink } from './parakeet-engine';

/** Tempo para o principal abrir o processo e mandar a porta. */
const CONNECT_TIMEOUT_MS = 15_000;

export function connectParakeet(bridge: Pick<ControlBridge, 'send'>, win: Window = window): Promise<ParakeetLink> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      win.removeEventListener('message', onPort);
      reject(new Error('O processo do Parakeet não respondeu'));
    }, CONNECT_TIMEOUT_MS);
    const onPort = (e: MessageEvent): void => {
      if (e.data !== PARAKEET_PORT_CHANNEL || !e.ports[0]) return;
      clearTimeout(timer);
      win.removeEventListener('message', onPort);
      const port = e.ports[0];
      const messages = new Set<(m: AsrPcmResponse) => void>();
      const exits = new Set<(code: number | null) => void>();
      port.onmessage = (ev) => messages.forEach((cb) => cb(ev.data as AsrPcmResponse));
      const onExit = (ev: MessageEvent): void => {
        if ((ev.data as { type?: string } | null)?.type === PARAKEET_EXIT_MESSAGE) exits.forEach((cb) => cb(null));
      };
      win.addEventListener('message', onExit);
      resolve({
        post: (m, transfer) => port.postMessage(m, transfer ?? []),
        onMessage: (cb) => {
          messages.add(cb);
          return () => void messages.delete(cb);
        },
        onExit: (cb) => {
          exits.add(cb);
          return () => void exits.delete(cb);
        },
        close: () => {
          win.removeEventListener('message', onExit);
          port.close();
        },
      });
    };
    win.addEventListener('message', onPort);
    bridge.send('voice:wantParakeet', null);
  });
}
