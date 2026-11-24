import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/theme.css';
import './app.css';
import { installTestHooks } from '../shared/test-hooks';
import { App } from './App';

if (__TP_TEST__) installTestHooks('control');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
