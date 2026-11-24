/** Ponte da janela de controle: `window.tp` com os canais de controle de `src/shared/ipc.ts`. */
import { CONTROL_EVENT_CHANNELS, CONTROL_INVOKE_CHANNELS, CONTROL_SEND_CHANNELS } from '@shared/ipc';
import { exposeBridge } from './bridge';

exposeBridge({
  role: 'control',
  invoke: CONTROL_INVOKE_CHANNELS,
  send: CONTROL_SEND_CHANNELS,
  events: CONTROL_EVENT_CHANNELS,
});
