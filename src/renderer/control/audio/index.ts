/** Captura real do microfone na janela de controle. */
import workletUrl from './pcm-worklet.ts?worker&url';
import { AudioCapture, browserCaptureDeps } from './capture';

export { AudioCapture } from './capture';
export type { CaptureFault } from './capture';

export function createAudioCapture(): AudioCapture {
  return new AudioCapture(browserCaptureDeps(workletUrl));
}
