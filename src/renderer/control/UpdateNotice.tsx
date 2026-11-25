/**
 * Aviso de versão nova (US-038), só na tela de controle:
 * - aparece quando o principal achou uma Release mais nova (`StateSnapshot.update`);
 * - "Baixar e instalar" baixa o instalador para a pasta Downloads, com a barra de
 *   progresso, e o abre; se a conexão cair, o aviso diz que não foi possível baixar;
 * - "Fechar" o esconde até o fim da sessão (guardado no principal).
 * Não é um diálogo: é uma faixa fina sob a barra do arquivo, que não cobre nenhum botão,
 * não toma o foco e não interrompe a rolagem.
 */
import { Button } from '../shared/ui/chiaro';
import { useControlStore, useSnapshot } from './hooks';

export function UpdateNotice() {
  const store = useControlStore();
  const { update } = useSnapshot();
  if (!update) return null;
  const downloading = update.progress !== null && update.progress < 100 && !update.error;
  const done = update.progress === 100 && !update.error;
  const send = (op: 'download' | 'dismiss'): void => {
    void store.bridge?.invoke('cmd:update', { op }).catch(() => undefined);
  };

  return (
    <aside className="tp-update" role="status" aria-label="Versão nova">
      <div className="tp-update-body">
        <p className="tp-update-title">Versão nova</p>
        <p className="tp-update-text">
          {done
            ? `O instalador da versão ${update.version} foi aberto. Siga as instruções dele para atualizar.`
            : `A versão ${update.version} do Teleprompter está disponível.`}
        </p>
      </div>
      {downloading && (
        <div
          className="tp-update-progress"
          role="progressbar"
          aria-label="Baixando a versão nova"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={update.progress ?? 0}
        >
          <span style={{ width: `${update.progress ?? 0}%` }} />
        </div>
      )}
      {update.error && (
        <p className="tp-update-error" role="alert">
          {update.error}
        </p>
      )}
      <div className="tp-update-actions">
        <Button variant="ghost" size="sm" onClick={() => send('dismiss')}>
          Fechar
        </Button>
        {!done && (
          <Button size="sm" iconLeft="download-minimalistic" disabled={downloading} onClick={() => send('download')}>
            {downloading ? `Baixando ${update.progress ?? 0}%` : 'Baixar e instalar'}
          </Button>
        )}
      </div>
    </aside>
  );
}
