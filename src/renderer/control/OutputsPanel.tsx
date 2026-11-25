/**
 * Painel de saídas (US-015, US-016, US-018, US-019, US-035), na aba "Saídas":
 * - cada monitor por nome e resolução; o da tela de controle não recebe saída;
 * - "Abrir saída" num monitor livre (`cmd:output open`), com o número da saída;
 * - em cada saída, "Espelhar", "Inverter vertical", "Sinal de voz" e "Fechar";
 * - a saída caída mostra o aviso e reabre sozinha quando o monitor volta.
 */
import { useState } from 'react';
import type { OutputFailure } from '@shared/ipc';
import type { DisplayInfo, OutputInfo } from '@shared/types';
import { Badge, Button, Checkbox } from '../shared/ui/chiaro';
import { useControlStore, useSnapshot } from './hooks';

export const NO_FREE_DISPLAY = 'Não há monitor livre';

const FAILURE_MESSAGE: Record<OutputFailure, string> = {
  'display-busy': 'Este monitor já tem uma saída',
  'control-display': 'A tela de controle está neste monitor. Escolha outro',
  'display-missing': 'Este monitor não está mais ligado',
};

function OutputRow({ output }: { output: OutputInfo }) {
  const store = useControlStore();
  const set = (patch: Partial<Pick<OutputInfo, 'mirrorH' | 'flipV' | 'voiceSignal'>>) => (checked: boolean) => {
    const key = Object.keys(patch)[0] as keyof typeof patch;
    void store.bridge?.invoke('cmd:output', { op: 'set', id: output.id, [key]: checked }).catch(() => undefined);
  };
  const close = (): void => {
    void store.bridge?.invoke('cmd:output', { op: 'close', id: output.id }).catch(() => undefined);
  };
  const down = output.state === 'down';
  return (
    <li className={`tp-output-row${down ? ' tp-output-down' : ''}`} role="group" aria-label={`Saída ${output.id}`}>
      <div className="tp-output-head">
        <Badge tone={down ? 'live' : 'brand'}>Saída {output.id}</Badge>
        <span className="tp-output-name">
          {output.label}, {output.size}
        </span>
        <span className="tp-muted tp-output-state">{down ? 'Caiu. Reabre sozinha quando o monitor voltar' : 'Aberta'}</span>
      </div>
      <div className="tp-output-options">
        <Checkbox label="Espelhar" checked={output.mirrorH} onChange={set({ mirrorH: true })} />
        <Checkbox label="Inverter vertical" checked={output.flipV} onChange={set({ flipV: true })} />
        <Checkbox label="Sinal de voz" checked={output.voiceSignal} onChange={set({ voiceSignal: true })} />
        <Button variant="secondary" size="sm" iconLeft="close-circle" onClick={close}>
          Fechar
        </Button>
      </div>
    </li>
  );
}

function FreeDisplay({ display, onFailure }: { display: DisplayInfo; onFailure(message: string | null): void }) {
  const store = useControlStore();
  const open = async (): Promise<void> => {
    const r = await store.bridge?.invoke('cmd:output', { op: 'open', displayKey: display.displayKey }).catch(() => undefined);
    onFailure(r && !r.ok ? FAILURE_MESSAGE[r.error] : null);
  };
  return (
    <li className="tp-display-row" role="group" aria-label={display.label}>
      <span className="tp-output-name">
        {display.label}, {display.size}
      </span>
      <Button size="sm" iconLeft="monitor" onClick={() => void open()}>
        Abrir saída
      </Button>
    </li>
  );
}

export function OutputsPanel() {
  const { outputs, displays } = useSnapshot();
  const [failure, setFailure] = useState<string | null>(null);
  const control = displays.find((d) => d.hasControl);
  const free = displays.filter((d) => !d.hasControl && d.outputId === null);
  const visible = outputs.filter((o) => o.state !== 'closed');

  return (
    <div className="tp-outputs-panel">
      <section aria-label="Saídas abertas">
        <h3 className="tp-section-label">Saídas</h3>
        {visible.length === 0 ? (
          <p className="tp-muted">Nenhuma saída aberta. Abra uma saída num monitor livre abaixo.</p>
        ) : (
          <ul className="tp-output-list">
            {visible.map((o) => (
              <OutputRow key={o.id} output={o} />
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Monitores livres">
        <h3 className="tp-section-label">Monitores livres</h3>
        {free.length === 0 ? (
          <p className="tp-muted">{NO_FREE_DISPLAY}</p>
        ) : (
          <ul className="tp-output-list">
            {free.map((d) => (
              <FreeDisplay key={d.displayKey} display={d} onFailure={setFailure} />
            ))}
          </ul>
        )}
        {control && (
          <p className="tp-muted tp-control-display">
            {control.label}, {control.size}: monitor da tela de controle
          </p>
        )}
        {failure && (
          <p className="tp-field-error" role="alert">
            {failure}
          </p>
        )}
      </section>
    </div>
  );
}
