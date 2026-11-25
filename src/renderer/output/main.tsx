import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/theme.css';
import './output.css';
import type { OutputBridge } from '@shared/ipc';
import { installTestHooks } from '../shared/test-hooks';
import { OutputApp } from './OutputApp';
import { createOutputStore } from './output-store';

if (__TP_TEST__) installTestHooks('output');

// A ponte é assinada antes de a tela montar: o principal manda o estado e o trecho em
// curso assim que a página carrega.
const store = createOutputStore({ bridge: window.tp as OutputBridge });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OutputApp store={store} />
  </StrictMode>,
);
