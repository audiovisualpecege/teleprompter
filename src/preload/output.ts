/**
 * Ponte da saída de TP: recebe o que desenhar, mede o relógio comum e avisa os quadros
 * longos. As teclas não passam por aqui: o principal as captura no `before-input-event`.
 */
import { OUTPUT_EVENT_CHANNELS, OUTPUT_INVOKE_CHANNELS, OUTPUT_SEND_CHANNELS } from '@shared/ipc';
import { exposeBridge } from './bridge';

exposeBridge({
  role: 'output',
  invoke: OUTPUT_INVOKE_CHANNELS,
  send: OUTPUT_SEND_CHANNELS,
  events: OUTPUT_EVENT_CHANNELS,
});
