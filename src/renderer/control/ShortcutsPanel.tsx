/**
 * Tela de atalhos (US-024), na aba "Atalhos":
 * - cada ação com o atalho atual; "Gravar" espera a próxima tecla ou combinação, e Esc
 *   cancela sem mudar nada;
 * - tecla já usada por outra ação: pergunta (no `Dialog` da Chiaro) se quer trocar;
 * - tecla reservada do sistema: mensagem, sem aceitar;
 * - "Sem atalho" deixa a ação só no botão; "Voltar ao padrão" devolve os atalhos padrão.
 *
 * Enquanto grava, a tela avisa o principal (`ui:keyCapture`) para as teclas não virarem ação.
 */
import { useEffect, useRef, useState } from 'react';
import type { KeymapFailure } from '@shared/ipc';
import { comboFromInput } from '@shared/keys';
import type { ActionId, KeyCombo, Result, Keymap } from '@shared/types';
import { Button, Dialog } from '../shared/ui/chiaro';
import { useControlStore, useSnapshot } from './hooks';
import { ACTION_LABELS, ACTION_ORDER, comboLabel, isMacPlatform, shortcutHint } from './shortcuts';

export const RECORDING_HINT = 'Aperte a tecla ou a combinação. Esc cancela';
export const reservedMessage = (label: string): string => `${label} é reservada pelo sistema e não pode ser usada`;

interface Conflict {
  action: ActionId;
  combo: KeyCombo;
  with: ActionId;
}

export function ShortcutsPanel() {
  const store = useControlStore();
  const { keymap } = useSnapshot();
  const [recording, setRecording] = useState<ActionId | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const mac = isMacPlatform();

  const submit = async (action: ActionId, combo: KeyCombo, force = false): Promise<void> => {
    const r = (await store.bridge
      ?.invoke('cmd:keymap', { op: 'set', action, combo, force })
      .catch(() => undefined)) as Result<Keymap, KeymapFailure> | undefined;
    if (!r || r.ok) {
      setMessage(null);
      return;
    }
    if (r.error === 'reserved') setMessage(reservedMessage(comboLabel(combo, mac)));
    else setConflict({ action, combo, with: r.error.conflictWith });
  };

  // Gravação: a próxima tecla (sem contar as modificadoras sozinhas) vira o atalho.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (!recording) return undefined;
    const bridge = store.bridge;
    bridge?.send('ui:keyCapture', true);
    // Sem foco no botão: Espaço e Enter não o clicam de novo ao soltar a tecla gravada.
    (document.activeElement as HTMLElement | null)?.blur?.();
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      const combo = comboFromInput({ key: e.key, control: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey, alt: e.altKey }, mac);
      if (!combo) return;
      setRecording(null);
      if (combo.key === 'Escape' && !combo.ctrlOrCmd && !combo.alt && !combo.shift) return;
      void submitRef.current(recording, combo);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      bridge?.send('ui:keyCapture', false);
    };
  }, [recording, store, mac]);

  const clear = (action: ActionId): void => {
    setMessage(null);
    void store.bridge?.invoke('cmd:keymap', { op: 'clear', action }).catch(() => undefined);
  };
  const reset = (): void => {
    setMessage(null);
    setRecording(null);
    void store.bridge?.invoke('cmd:keymap', { op: 'reset' }).catch(() => undefined);
  };

  return (
    <div className="tp-shortcuts-panel">
      <table className="tp-shortcuts">
        <thead>
          <tr>
            <th scope="col">Ação</th>
            <th scope="col">Atalho</th>
            <th scope="col">
              <span className="tp-visually-hidden">Trocar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ACTION_ORDER.map((action) => {
            const label = ACTION_LABELS[action];
            const isRecording = recording === action;
            return (
              <tr key={action} data-action={action} aria-label={label}>
                <th scope="row">{label}</th>
                <td className="tp-shortcut-keys" data-testid={`keys-${action}`}>
                  {isRecording ? <span className="tp-recording">{RECORDING_HINT}</span> : shortcutHint(action, keymap, mac)}
                </td>
                <td className="tp-shortcut-actions">
                  <Button
                    variant={isRecording ? 'primary' : 'secondary'}
                    size="sm"
                    iconLeft="keyboard"
                    aria-label={`Gravar atalho de ${label}`}
                    onClick={() => {
                      setMessage(null);
                      setRecording(isRecording ? null : action);
                    }}
                  >
                    {isRecording ? 'Gravando' : 'Gravar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft="minus-circle"
                    aria-label={`Deixar ${label} sem atalho`}
                    disabled={(keymap[action] ?? []).length === 0}
                    onClick={() => clear(action)}
                  >
                    Sem atalho
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {message && (
        <p className="tp-field-error" role="alert">
          {message}
        </p>
      )}
      <div className="tp-shortcuts-footer">
        <p className="tp-muted">Pedais e passadores funcionam como a tecla que imitam. Os atalhos valem com qualquer janela do programa em foco.</p>
        <Button variant="secondary" iconLeft="rewind-back" onClick={reset}>
          Voltar ao padrão
        </Button>
      </div>
      <Dialog
        open={conflict !== null}
        title="Atalho em uso"
        onClose={() => setConflict(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConflict(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const c = conflict;
                setConflict(null);
                if (c) void submit(c.action, c.combo, true);
              }}
            >
              Trocar
            </Button>
          </>
        }
      >
        {conflict &&
          `${comboLabel(conflict.combo, mac)} já é o atalho de "${ACTION_LABELS[conflict.with]}". Quer passar para "${ACTION_LABELS[conflict.action]}"? "${ACTION_LABELS[conflict.with]}" fica só no botão.`}
      </Dialog>
    </div>
  );
}
