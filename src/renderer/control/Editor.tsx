/**
 * Editor do roteiro (US-001, US-006): um `textarea` (só texto puro entra ao colar), com
 * "Confirmar alterações" e "Descartar". O que se digita não vai às saídas até confirmar.
 * A roda do mouse aqui rola só o editor, e os trechos de movimento nunca mexem na rolagem
 * nem na seleção dele (o editor não assina o movimento).
 */
import { useControlStore, useSnapshot, type DraftState } from './hooks';
import { Button, Input } from '../shared/ui/chiaro';

export interface EditorProps {
  draft: DraftState;
}

export function Editor({ draft }: EditorProps) {
  const store = useControlStore();
  const snapshot = useSnapshot();
  const empty = draft.text.trim() === '';
  const pending = draft.text !== snapshot.doc.confirmedText;

  const confirm = async (): Promise<void> => {
    if (empty || !store.bridge) return;
    await draft.flush();
    await store.bridge.invoke('cmd:doc', { op: 'confirm' }).catch(() => undefined);
  };
  const discard = async (): Promise<void> => {
    if (!store.bridge) return;
    await draft.flush();
    await store.bridge.invoke('cmd:doc', { op: 'discard' }).catch(() => undefined);
  };
  const focus = (focused: boolean) => () => store.bridge?.send('ui:editorFocus', focused);

  return (
    <section className="tp-editor" aria-label="Editor do roteiro">
      <Input
        multiline
        rows={18}
        label="Texto do roteiro"
        className="tp-editor-text"
        placeholder="Cole aqui o texto do roteiro ou use Importar"
        spellCheck={false}
        value={draft.text}
        onChange={(e) => draft.change(e.target.value)}
        onFocus={focus(true)}
        onBlur={focus(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') (e.target as HTMLElement).blur();
        }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      />
      <p className="tp-editor-state" aria-live="polite">
        {pending && !empty ? 'Alterações ainda não estão nas saídas' : ' '}
      </p>
      <div className="tp-editor-actions">
        <Button fullWidth disabled={empty || !pending} onClick={() => void confirm()}>
          Confirmar alterações
        </Button>
        <Button variant="secondary" fullWidth disabled={!pending} onClick={() => void discard()}>
          Descartar
        </Button>
      </div>
    </section>
  );
}
