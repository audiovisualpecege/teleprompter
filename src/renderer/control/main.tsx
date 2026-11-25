import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/theme.css';
import './app.css';
import type { ControlBridge } from '@shared/ipc';
import { installTestHooks, registerProbe, registerTestAction } from '../shared/test-hooks';
import { App } from './App';
import { createParakeetEngine, createVoskEngine } from './asr';
import { createAudioCapture } from './audio';
import { createControlStore } from './control-store';
import { createBrowserLayoutService } from './layout-service';
import { VoiceRuntime } from './voice-runtime';

if (__TP_TEST__) installTestHooks('control');

const bridge = window.tp as ControlBridge;

// A voz roda fora do React, desde a abertura: continua com a janela minimizada e com
// qualquer aba aberta.
const voice = new VoiceRuntime({
  bridge,
  capture: createAudioCapture(),
  createEngine: (id) => (id === 'parakeet' ? createParakeetEngine(bridge) : createVoskEngine()),
  media: navigator.mediaDevices ?? null,
});

if (__TP_TEST__) {
  // Microfone simulado (E2E-009): o microfone "some" e "volta".
  registerTestAction('stopMicTrack', () => voice.simulateUnplug());
  registerTestAction('restoreMic', () => voice.simulateReplug());
  registerProbe('micLevel', () => voice.currentLevel);
  registerProbe('mics', () => voice.deviceList);
  registerProbe('voiceReadyAt', () => voice.lastReadyAt);
}

// A ponte é assinada antes de a tela montar: o principal manda o primeiro estado e o
// primeiro pedido de diagramação assim que a página carrega.
const store = createControlStore({
  bridge,
  layoutService: createBrowserLayoutService(),
  voice,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
);
