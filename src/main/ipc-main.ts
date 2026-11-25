/**
 * Liga o `AppStore` aos canais de IPC (TechSpec, "Contratos de IPC"). O transporte é
 * trocável: no programa, `ipcMain` e `webContents.send`; nos testes de integração, o
 * barramento em memória de `tests/fakes/ipc-bus.ts`.
 */
import type {
  ControlEvents,
  ControlInvokeChannels,
  ControlSendChannels,
  OutputEvents,
} from '@shared/ipc';
import type { LayoutResult } from '@shared/types';
import type { KeymapService } from './keymap';
import type { OutputManager } from './outputs';
import type { AppStore } from './store';

type StoreInvoke = Pick<ControlInvokeChannels, 'cmd:doc' | 'cmd:appearance' | 'cmd:settings' | 'cmd:output' | 'cmd:keymap'>;
type StoreSend = Pick<ControlSendChannels, 'cmd:scroll' | 'layout:result' | 'ui:editorFocus' | 'ui:keyCapture'>;

export interface MainTransport {
  handle<C extends keyof StoreInvoke>(
    channel: C,
    fn: (req: StoreInvoke[C]['req']) => Promise<StoreInvoke[C]['res']> | StoreInvoke[C]['res'],
  ): () => void;
  on<C extends keyof StoreSend>(channel: C, fn: (payload: StoreSend[C]) => void): () => void;
  toControl<C extends keyof ControlEvents>(channel: C, payload: ControlEvents[C]): void;
  toOutputs<C extends keyof OutputEvents>(channel: C, payload: OutputEvents[C]): void;
  /** O layout aplicado às saídas (o `OutputManager` o embrulha em `state:output`). */
  layoutToOutputs(layout: LayoutResult): void;
}

export function bindStore(store: AppStore, t: MainTransport): () => void {
  const offs: (() => void)[] = [
    t.handle('cmd:doc', (cmd) => store.doc(cmd)),
    t.handle('cmd:appearance', (patch) => store.setAppearance(patch)),
    t.handle('cmd:settings', (cmd) => store.settingsCommand(cmd)),
    t.on('cmd:scroll', (cmd) => {
      // A voz entra só pelo principal; a tela não manda `voiceTarget`.
      if (!cmd || (cmd as { type?: string }).type === 'voiceTarget') return;
      store.scroll(cmd);
    }),
    t.on('layout:result', (layout) => store.layoutResult(layout)),
    t.on('ui:editorFocus', (focused) => store.setEditorFocused(Boolean(focused))),
    store.onSnapshot((s) => t.toControl('state:snapshot', s)),
    store.onLayoutRequest((r) => t.toControl('layout:request', r)),
    store.onLayout((l) => t.layoutToOutputs(l)),
    store.onSegment((seg) => {
      t.toControl('motion:segment', seg);
      t.toOutputs('motion:segment', seg);
    }),
  ];
  return () => offs.forEach((off) => off());
}

/**
 * Liga as saídas e os atalhos ao estado e aos canais (`cmd:output`, `cmd:keymap`,
 * `ui:keyCapture`). Mudanças nas saídas, nos monitores e no mapa de atalhos republicam
 * o `StateSnapshot`.
 */
export function bindStudio(store: AppStore, outputs: OutputManager, keymap: KeymapService, t: MainTransport): () => void {
  store.setStudio({ outputs: () => outputs.outputs(), displays: () => outputs.displays() });
  const offs: (() => void)[] = [
    t.handle('cmd:output', (cmd) => outputs.command(cmd)),
    t.handle('cmd:keymap', (cmd) => keymap.command(cmd)),
    t.on('ui:keyCapture', (flag) => keymap.setCapturing(Boolean(flag))),
  ];
  return () => {
    offs.forEach((off) => off());
    store.setStudio(null);
  };
}
