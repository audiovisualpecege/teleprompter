/**
 * Aba "Sobre" (TechSpec, "Monitoramento e observabilidade"; US-036, US-037):
 * - a versão (`__APP_VERSION__`, lida do package.json no build), o motor de voz ativo e
 *   o atraso médio da voz, para relatar problemas;
 * - "Abrir pasta de registros" abre a pasta dos logs no sistema (`cmd:openLogs`);
 * - "Voltar ao padrão" pede confirmação no `Dialog` da Chiaro e só o botão do diálogo
 *   manda `cmd:settings resetAll` (US-036 AC-2);
 * - a assinatura "um produto Chiaro Filmes", com o logo branco da Chiaro. O logo é só a
 *   assinatura: o ícone do programa é o do teleprompter.
 */
import { useState } from 'react';
import type { EngineId } from '@shared/types';
import { Button, CHIARO_LOGO_BASE, Dialog, Logo } from '../shared/ui/chiaro';
import { useControlStore, useSnapshot } from './hooks';

const ENGINE_LABEL: Record<EngineId, string> = { vosk: 'Vosk', parakeet: 'Parakeet' };

export const RESET_TEXT =
  'Todos os ajustes deste computador voltam ao padrão: velocidade 1,00x, voz no modo "Perto" com o motor Vosk, atalhos padrão e saídas sem inversão. Os roteiros salvos não mudam.';

/** Atraso médio da voz em segundos, com vírgula ("0,8 s"). */
export function lagLabel(lagMs: number | null): string {
  if (lagMs === null || !Number.isFinite(lagMs)) return 'Sem medição. Ligue a voz para medir';
  return `${(lagMs / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
}

export function ResetSettings() {
  const store = useControlStore();
  const [asking, setAsking] = useState(false);
  const confirm = (): void => {
    setAsking(false);
    void store.bridge?.invoke('cmd:settings', { op: 'resetAll' }).catch(() => undefined);
  };
  return (
    <section className="tp-about-section" aria-label="Ajustes deste computador">
      <h3 className="tp-section-label">Ajustes deste computador</h3>
      <p className="tp-muted">Velocidade, voz, atalhos e saídas ficam guardados neste computador.</p>
      <div>
        <Button variant="secondary" iconLeft="restart" onClick={() => setAsking(true)}>
          Voltar ao padrão
        </Button>
      </div>
      <Dialog
        open={asking}
        title="Voltar ao padrão"
        onClose={() => setAsking(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAsking(false)}>
              Cancelar
            </Button>
            <Button onClick={confirm}>Voltar ao padrão</Button>
          </>
        }
      >
        {RESET_TEXT}
      </Dialog>
    </section>
  );
}

export function AboutPanel() {
  const store = useControlStore();
  const { voice } = useSnapshot();
  const openLogs = (): void => {
    void store.bridge?.invoke('cmd:openLogs', null).catch(() => undefined);
  };
  return (
    <div className="tp-about">
      <section className="tp-about-section" aria-label="Programa">
        <h3 className="tp-section-label">Teleprompter</h3>
        <dl className="tp-about-list">
          <div>
            <dt>Versão</dt>
            <dd data-testid="about-version">v{__APP_VERSION__}</dd>
          </div>
          <div>
            <dt>Motor de voz</dt>
            <dd data-testid="about-engine">{ENGINE_LABEL[voice.engine] ?? voice.engine}</dd>
          </div>
          <div>
            <dt>Atraso médio da voz</dt>
            <dd data-testid="about-lag">{lagLabel(voice.lagMs)}</dd>
          </div>
        </dl>
        <p className="tp-muted">Ao relatar um problema, diga a versão e envie os arquivos da pasta de registros.</p>
        <div>
          <Button variant="secondary" iconLeft="folder-with-files" onClick={openLogs}>
            Abrir pasta de registros
          </Button>
        </div>
      </section>
      <ResetSettings />
      <footer className="tp-signature" aria-label="um produto Chiaro Filmes">
        <span className="tp-signature-text">um produto</span>
        <Logo variant="filmesHorizontal" inverse height={18} base={CHIARO_LOGO_BASE} />
      </footer>
    </div>
  );
}
