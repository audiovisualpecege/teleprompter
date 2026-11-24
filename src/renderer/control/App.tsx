/**
 * Casca da tela de controle: fundo Noite e a versão no rodapé. A tarefa da tela de
 * controle preenche a prévia, as ações de gravação, o editor, a aparência e o estúdio.
 */
export function VersionTag() {
  // A versão vem só do package.json, pelo build; nunca é digitada aqui.
  return <span className="tp-version">v{__APP_VERSION__}</span>;
}

export function App() {
  return (
    <div className="tp-shell">
      <main className="tp-main" />
      <footer className="tp-footer">
        <VersionTag />
      </footer>
    </div>
  );
}
