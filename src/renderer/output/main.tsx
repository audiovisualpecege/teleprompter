import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/theme.css';
import { installTestHooks } from '../shared/test-hooks';
import { OutputApp } from './OutputApp';

if (__TP_TEST__) installTestHooks('output');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OutputApp />
  </StrictMode>,
);
