/** Ponte da saída de TP: só recebe o que desenhar e mede o relógio comum. */
import { OUTPUT_EVENT_CHANNELS, OUTPUT_INVOKE_CHANNELS } from '@shared/ipc';
import { exposeBridge } from './bridge';

exposeBridge({
  role: 'output',
  invoke: OUTPUT_INVOKE_CHANNELS,
  send: [],
  events: OUTPUT_EVENT_CHANNELS,
});
