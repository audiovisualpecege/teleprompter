/**
 * Avisos e perguntas que nascem no principal:
 * - avisos (`StateSnapshot.notices`): erros de arquivo, itens ignorados do `.docx`,
 *   fonte ausente, ajustes corrompidos, em `Toast` da Chiaro;
 * - perguntas (`StateSnapshot.prompt`): alterações não salvas ao abrir por duplo clique
 *   ou ao fechar, e a oferta de recuperação, no `Dialog` da Chiaro.
 */
import { useState } from 'react';
import type { DocCommand, UnsavedChoice } from '@shared/ipc';
import type { Notice, NoticeKind } from '@shared/types';
import { Button, Dialog, Toast } from '../shared/ui/chiaro';
import { UnsavedDialog } from './FileBar';
import { useControlStore, useSnapshot } from './hooks';

const TONE: Record<NoticeKind, 'default' | 'success' | 'danger'> = {
  info: 'default',
  success: 'success',
  warning: 'danger',
  danger: 'danger',
};

const noticeKey = (n: Notice): string => `${n.id}|${n.message}`;

export function Notices() {
  const { notices } = useSnapshot();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const visible = notices.filter((n) => !hidden.has(noticeKey(n)));
  if (visible.length === 0) return null;
  return (
    <div className="tp-notices" aria-live="polite">
      {visible.map((n) => (
        <Toast
          key={noticeKey(n)}
          tone={TONE[n.kind]}
          message={n.message}
          onClose={() => setHidden((h) => new Set(h).add(noticeKey(n)))}
        />
      ))}
    </div>
  );
}

export function PromptDialogs() {
  const store = useControlStore();
  const { prompt } = useSnapshot();
  const [laterAt, setLaterAt] = useState<number | null>(null);
  const send = (cmd: DocCommand): void => {
    void store.bridge?.invoke('cmd:doc', cmd).catch(() => undefined);
  };

  if (prompt?.kind === 'unsaved') {
    const choose = (unsaved: UnsavedChoice): void =>
      send(prompt.op === 'open' ? { op: 'open', path: prompt.path ?? undefined, unsaved } : { op: 'close', unsaved });
    return <UnsavedDialog open onChoose={choose} />;
  }

  if (prompt?.kind === 'recovery') {
    const recover = (accept: boolean) => () => send({ op: 'recover', accept });
    // Fechar sem escolher não apaga nada: a cópia continua guardada para a próxima abertura.
    return (
      <Dialog
        open={laterAt !== prompt.savedAt}
        title="Recuperar texto"
        onClose={() => setLaterAt(prompt.savedAt)}
        footer={
          <>
            <Button variant="secondary" onClick={recover(false)}>
              Descartar
            </Button>
            <Button onClick={recover(true)}>Recuperar</Button>
          </>
        }
      >
        O programa foi fechado sem salvar o roteiro. Quer recuperar o texto que estava em edição?
      </Dialog>
    );
  }

  return null;
}
