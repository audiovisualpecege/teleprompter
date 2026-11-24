/** Preload do banco de medição: configuração, porta do Parakeet e resultado. */
import { contextBridge, ipcRenderer } from 'electron';

ipcRenderer.on('harness:port', (e) => {
  window.postMessage('harness:port', '*', e.ports);
});
ipcRenderer.on('harness:exit', (_e, detail: string) => {
  window.postMessage({ type: 'harness:exit', detail }, '*');
});

contextBridge.exposeInMainWorld('harness', {
  config: () => ipcRenderer.invoke('harness:config'),
  wantPort: () => ipcRenderer.send('harness:want-port'),
  done: (json: string) => ipcRenderer.send('harness:result', json),
});
