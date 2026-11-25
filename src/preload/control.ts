/** Ponte da janela de controle: `window.tp` com os canais de controle de `src/shared/ipc.ts`. */
import { ipcRenderer } from 'electron';
import { CONTROL_EVENT_CHANNELS, CONTROL_INVOKE_CHANNELS, CONTROL_SEND_CHANNELS, PARAKEET_EXIT_MESSAGE, PARAKEET_PORT_CHANNEL } from '@shared/ipc';
import { exposeBridge } from './bridge';

exposeBridge({
  role: 'control',
  invoke: CONTROL_INVOKE_CHANNELS,
  send: CONTROL_SEND_CHANNELS,
  events: CONTROL_EVENT_CHANNELS,
});

/** A página da janela (o preload compila sem os tipos do DOM). */
const page = globalThis as unknown as { postMessage(message: unknown, targetOrigin: string, transfer?: unknown[]): void };

// Parakeet: a porta do `asr:pcm` não atravessa o `contextBridge`; vai à página por
// `window.postMessage`, que transfere a porta. O fim do processo vai do mesmo jeito.
ipcRenderer.on(PARAKEET_PORT_CHANNEL, (e) => {
  page.postMessage(PARAKEET_PORT_CHANNEL, '*', e.ports);
});
ipcRenderer.on(PARAKEET_EXIT_MESSAGE, (_e, detail: unknown) => {
  page.postMessage({ type: PARAKEET_EXIT_MESSAGE, detail: String(detail ?? '') }, '*');
});
