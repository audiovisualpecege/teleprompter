/**
 * Tela de controle (TechSpec, "Design system: tela de controle"), no tema Noite:
 * - no alto, a prévia sincronizada e, logo abaixo, a barra de ações de gravação;
 * - abaixo delas, as abas de aparência e de estúdio (saídas, voz, atalhos, sobre);
 * - numa coluna à direita, o editor com Confirmar e Descartar;
 * - no topo, o nome do arquivo e as ações de arquivo; a versão fica fixa no rodapé.
 */
import { useMemo, useState } from 'react';
import { Tabs } from '../shared/ui/chiaro';
import { ActionBar } from './ActionBar';
import { AppearancePanel } from './AppearancePanel';
import { createControlStore, type ControlStore } from './control-store';
import { Editor } from './Editor';
import { FileBar } from './FileBar';
import { ControlStoreContext, useDraft } from './hooks';
import { Notices, PromptDialogs } from './Notices';
import { Preview } from './Preview';

export function VersionTag() {
  // A versão vem só do package.json, pelo build; nunca é digitada aqui.
  return <span className="tp-version">v{__APP_VERSION__}</span>;
}

type TabId = 'aparencia' | 'saidas' | 'voz' | 'atalhos' | 'sobre';

const TABS: { value: TabId; label: string }[] = [
  { value: 'aparencia', label: 'Aparência' },
  { value: 'saidas', label: 'Saídas' },
  { value: 'voz', label: 'Voz' },
  { value: 'atalhos', label: 'Atalhos' },
  { value: 'sobre', label: 'Sobre' },
];

/** Espaço das abas de estúdio, preenchido pelas tarefas de saídas, voz, atalhos e entrega. */
const STUDIO_TEXT: Record<Exclude<TabId, 'aparencia'>, string> = {
  saidas: 'Aqui você abre uma saída de TP em cada monitor e escolhe as inversões.',
  voz: 'Aqui você escolhe o microfone e o jeito como a voz acompanha a leitura.',
  atalhos: 'Aqui você confere e troca os atalhos de teclado.',
  sobre: 'Versão do programa e pasta de registros.',
};

function ControlScreen() {
  const draft = useDraft();
  const [tab, setTab] = useState<TabId>('aparencia');
  return (
    <div className="tp-shell">
      <FileBar draft={draft} />
      <main className="tp-main">
        <div className="tp-stage-column">
          <Preview />
          <ActionBar />
          <section className="tp-tabs" aria-label="Aparência e estúdio">
            <Tabs items={TABS} value={tab} onChange={(v) => setTab(v as TabId)} />
            <div className="tp-tab-panel" role="tabpanel" data-tab={tab}>
              {tab === 'aparencia' ? <AppearancePanel /> : <p className="tp-muted">{STUDIO_TEXT[tab]}</p>}
            </div>
          </section>
        </div>
        <Editor draft={draft} />
      </main>
      <Notices />
      <PromptDialogs />
      <footer className="tp-footer">
        <VersionTag />
      </footer>
    </div>
  );
}

export interface AppProps {
  /** Estado da janela; sem ele (testes da casca), uma tela sem ponte. */
  store?: ControlStore;
}

export function App({ store }: AppProps) {
  const value = useMemo(() => store ?? createControlStore({ bridge: null }), [store]);
  return (
    <ControlStoreContext.Provider value={value}>
      <ControlScreen />
    </ControlStoreContext.Provider>
  );
}
