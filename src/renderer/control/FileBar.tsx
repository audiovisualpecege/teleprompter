/**
 * Topo da tela de controle: o nome do arquivo (com "(não salvo)") e as ações de arquivo
 * Novo, Abrir, Salvar, Salvar como e Importar (ADR-008). As perguntas de alterações não
 * salvas usam o `Dialog` da Chiaro, no tema Noite; só os seletores de arquivo são do sistema.
 */
import { useCallback, useRef, useState } from 'react';
import { IMPORT_LOADING_MS } from '@shared/defaults';
import type { DocCommand, DocFailure, UnsavedChoice } from '@shared/ipc';
import type { Result } from '@shared/types';
import { Badge, Button, Dialog } from '../shared/ui/chiaro';
import { useControlStore, useSnapshot, type DraftState } from './hooks';

/** Só o nome do arquivo, sem a pasta, em Windows ou Mac. */
export function fileName(path: string | null): string {
  if (!path) return 'Roteiro sem nome';
  return path.split(/[\\/]/).pop() || path;
}

export function docTitle(path: string | null, dirty: boolean): string {
  return dirty ? `${fileName(path)} (não salvo)` : fileName(path);
}

const needsConfirmation = (r: Result<void, DocFailure>): boolean =>
  !r.ok && typeof r.error === 'object' && r.error !== null && (r.error as { code?: string }).code === 'needs-confirmation';

type Op = 'new' | 'open' | 'import';

export interface UnsavedDialogProps {
  open: boolean;
  onChoose(choice: UnsavedChoice): void;
}

/** "Salvar", "Não salvar" e "Cancelar". Fechar pelo X ou clicando fora vale como Cancelar. */
export function UnsavedDialog({ open, onChoose }: UnsavedDialogProps) {
  return (
    <Dialog
      open={open}
      title="Alterações não salvas"
      onClose={() => onChoose('cancel')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onChoose('cancel')}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => onChoose('discard')}>
            Não salvar
          </Button>
          <Button onClick={() => onChoose('save')}>Salvar</Button>
        </>
      }
    >
      O roteiro tem alterações que ainda não foram salvas. Quer salvar antes de continuar?
    </Dialog>
  );
}

/**
 * Executa uma operação de documento: manda antes o texto do editor, mostra "Carregando"
 * se passar de 1 s e, quando o principal pede, abre a pergunta de alterações não salvas.
 */
export function useDocActions(draft: DraftState) {
  const store = useControlStore();
  const [asking, setAsking] = useState<DocCommand | null>(null);
  const [loading, setLoading] = useState(false);
  const busy = useRef(0);

  const invoke = useCallback(
    async (cmd: DocCommand): Promise<Result<void, DocFailure> | null> => {
      const bridge = store.bridge;
      if (!bridge) return null;
      busy.current += 1;
      const timer = setTimeout(() => setLoading(true), IMPORT_LOADING_MS);
      try {
        return await bridge.invoke('cmd:doc', cmd);
      } catch (e) {
        console.error('Falha na operação de arquivo', e);
        return null;
      } finally {
        clearTimeout(timer);
        busy.current -= 1;
        if (busy.current === 0) setLoading(false);
      }
    },
    [store],
  );

  const run = useCallback(
    async (cmd: DocCommand): Promise<void> => {
      await draft.flush();
      const r = await invoke(cmd);
      if (r && needsConfirmation(r)) setAsking(cmd);
    },
    [draft, invoke],
  );

  const answer = useCallback(
    async (choice: UnsavedChoice): Promise<void> => {
      const cmd = asking;
      setAsking(null);
      if (!cmd || choice === 'cancel') return;
      await invoke({ ...cmd, unsaved: choice } as DocCommand);
    },
    [asking, invoke],
  );

  return { run, invoke, answer, asking, loading };
}

export interface FileBarProps {
  draft: DraftState;
}

export function FileBar({ draft }: FileBarProps) {
  const snapshot = useSnapshot();
  const { run, answer, asking, loading } = useDocActions(draft);
  const act = (op: Op | 'save' | 'saveAs') => () => void run({ op } as DocCommand);

  return (
    <header className="tp-filebar">
      <div className="tp-filebar-title">
        <h1 className="tp-brand-title">
          <span className="tp-title-light">Tele</span>
          <span className="tp-title-bold">prompter</span>
        </h1>
        <span className="tp-filename" data-testid="file-name" title={snapshot.doc.filePath ?? undefined}>
          {docTitle(snapshot.doc.filePath, snapshot.doc.dirty)}
        </span>
        {loading && (
          <Badge tone="soft" style={{ marginLeft: 'var(--space-2)' }}>
            Carregando
          </Badge>
        )}
      </div>
      <nav className="tp-filebar-actions" aria-label="Arquivo">
        <Button variant="ghost" size="sm" iconLeft="document-add" onClick={act('new')}>
          Novo
        </Button>
        <Button variant="ghost" size="sm" iconLeft="folder-open" onClick={act('open')}>
          Abrir
        </Button>
        <Button variant="ghost" size="sm" iconLeft="diskette" onClick={act('save')}>
          Salvar
        </Button>
        <Button variant="ghost" size="sm" onClick={act('saveAs')}>
          Salvar como
        </Button>
        <Button variant="secondary" size="sm" iconLeft="import" onClick={act('import')}>
          Importar
        </Button>
      </nav>
      <UnsavedDialog open={asking !== null} onChoose={(c) => void answer(c)} />
    </header>
  );
}
