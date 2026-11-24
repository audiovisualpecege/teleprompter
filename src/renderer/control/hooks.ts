/** Ganchos da tela de controle sobre o `ControlStore`. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MotionSegment } from '@shared/motion';
import type { LayoutResult, StateSnapshot } from '@shared/types';
import type { ControlStore } from './control-store';

export const ControlStoreContext = createContext<ControlStore | null>(null);

export function useControlStore(): ControlStore {
  const store = useContext(ControlStoreContext);
  if (!store) throw new Error('ControlStore ausente');
  return store;
}

export function useSnapshot(): StateSnapshot {
  const store = useControlStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export function useLayout(): LayoutResult | null {
  const store = useControlStore();
  return useSyncExternalStore(store.subscribe, store.getLayout);
}

export function useSegment(): MotionSegment {
  const store = useControlStore();
  return useSyncExternalStore(store.subscribeSegment, store.getSegment);
}

export interface DraftState {
  text: string;
  change(text: string): void;
  /** Garante que o principal já tem o texto do editor antes de uma ação de arquivo. */
  flush(): Promise<void>;
}

/**
 * Texto do editor. Fica na tela (digitação sem atraso) e vai ao principal a cada mudança
 * (`cmd:doc setDraft`). Enquanto há envios no caminho, os estados que chegam não
 * sobrescrevem o editor; quando não há, um rascunho trocado pelo principal (importar,
 * novo, abrir, descartar, recuperar) entra no editor.
 */
export function useDraft(): DraftState {
  const store = useControlStore();
  const snapshot = useSnapshot();
  const [text, setText] = useState(snapshot.doc.draftText);
  const textRef = useRef(text);
  const sentRef = useRef(snapshot.doc.draftText);
  const inflight = useRef(0);

  const reconcile = useCallback(() => {
    if (inflight.current > 0) return;
    const draft = store.getSnapshot().doc.draftText;
    sentRef.current = draft;
    if (draft !== textRef.current) {
      textRef.current = draft;
      setText(draft);
    }
  }, [store]);

  useEffect(() => {
    reconcile();
  }, [snapshot.doc.draftText, reconcile]);

  const push = useCallback(
    async (value: string): Promise<void> => {
      const bridge = store.bridge;
      if (!bridge) {
        sentRef.current = value;
        return;
      }
      inflight.current += 1;
      sentRef.current = value;
      try {
        await bridge.invoke('cmd:doc', { op: 'setDraft', text: value });
      } catch (e) {
        console.error('Falha ao enviar o rascunho', e);
      } finally {
        inflight.current -= 1;
        reconcile();
      }
    },
    [store, reconcile],
  );

  const change = useCallback(
    (value: string) => {
      textRef.current = value;
      setText(value);
      void push(value);
    },
    [push],
  );

  const flush = useCallback(async () => {
    if (textRef.current !== sentRef.current) await push(textRef.current);
  }, [push]);

  return { text, change, flush };
}
