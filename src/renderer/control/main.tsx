import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/theme.css';
import './app.css';
import type { ControlBridge } from '@shared/ipc';
import { installTestHooks } from '../shared/test-hooks';
import { App } from './App';
import { createControlStore } from './control-store';
import { createBrowserLayoutService } from './layout-service';

if (__TP_TEST__) installTestHooks('control');

// A ponte é assinada antes de a tela montar: o principal manda o primeiro estado e o
// primeiro pedido de diagramação assim que a página carrega.
const store = createControlStore({
  bridge: window.tp as ControlBridge,
  layoutService: createBrowserLayoutService(),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
);
