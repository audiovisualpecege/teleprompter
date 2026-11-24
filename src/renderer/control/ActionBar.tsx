/**
 * Ações de gravação, grandes e sempre visíveis (TechSpec, "Tela de controle"): Iniciar e
 * Pausar, velocidade com "-" e "+", Voltar ao início, Subir, Descer e Voz. Cada botão
 * mostra o atalho na dica. Sem texto confirmado, Iniciar e Voz ficam desabilitados.
 */
import { useEffect, useRef, useState } from 'react';
import { defaultKeymap, SPEED_MAX, SPEED_MIN, SPEED_STEP } from '@shared/defaults';
import { formatSpeed } from '@shared/speed';
import type { ActionId, KeyCombo, ManualScrollCommand, ScrollDir, VoiceState } from '@shared/types';
import { Button, Tooltip } from '../shared/ui/chiaro';
import { useControlStore, useSnapshot } from './hooks';

const KEY_NAMES: Record<string, string> = {
  ' ': 'Espaço',
  ArrowDown: 'Seta para baixo',
  ArrowUp: 'Seta para cima',
  PageDown: 'Page Down',
  PageUp: 'Page Up',
  Home: 'Home',
  End: 'End',
};

export function comboLabel(c: KeyCombo): string {
  const key = KEY_NAMES[c.key] ?? (c.key.length === 1 ? c.key.toUpperCase() : c.key);
  return [c.ctrlOrCmd && 'Ctrl', c.alt && 'Alt', c.shift && 'Shift', key].filter(Boolean).join('+');
}

export function shortcutHint(action: ActionId, keymap = defaultKeymap()): string {
  const combos = keymap[action] ?? [];
  if (combos.length === 0) return 'Sem atalho';
  return combos.map(comboLabel).join(' ou ');
}

const VOICE_LABEL: Record<VoiceState, string> = {
  off: 'Desligada',
  preparing: 'Preparando',
  listening: 'Ouvindo',
  waiting: 'Esperando',
  failed: 'Falhou',
};

/** Janela pequena (até a mínima, 960 x 640): botões médios, para a barra caber em duas linhas. */
const COMPACT_QUERY = '(max-height: 760px), (max-width: 1100px)';

const compactQuery = (): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(COMPACT_QUERY) : null;

export function useCompact(): boolean {
  const [compact, setCompact] = useState(() => compactQuery()?.matches ?? false);
  useEffect(() => {
    const query = compactQuery();
    if (!query) return undefined;
    const on = (): void => setCompact(query.matches);
    query.addEventListener('change', on);
    return () => query.removeEventListener('change', on);
  }, []);
  return compact;
}

/** Segurar Subir ou Descer rola sem parar; um clique curto anda uma linha. */
const HOLD_AFTER_MS = 350;

function StepButton({ dir, label, icon, size }: { dir: ScrollDir; label: string; icon: string; size: 'md' | 'lg' }) {
  const store = useControlStore();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holding = useRef(false);
  const send = (cmd: ManualScrollCommand): void => store.bridge?.send('cmd:scroll', cmd);
  const down = (): void => {
    holding.current = false;
    timer.current = setTimeout(() => {
      holding.current = true;
      send({ type: 'holdStart', dir });
    }, HOLD_AFTER_MS);
  };
  const up = (): void => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (holding.current) send({ type: 'holdEnd' });
  };
  return (
    <Tooltip label={`${label}: ${shortcutHint(dir === 1 ? 'down' : 'up')}`}>
      <Button
        variant="secondary"
        size={size}
        iconLeft={icon}
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onClick={() => {
          // O clique que encerra um "segurar" não anda mais uma linha.
          if (holding.current) {
            holding.current = false;
            return;
          }
          send({ type: 'lineStep', dir });
        }}
      >
        {label}
      </Button>
    </Tooltip>
  );
}

export function ActionBar() {
  const store = useControlStore();
  const snapshot = useSnapshot();
  const size = useCompact() ? 'md' : 'lg';
  const hasText = snapshot.doc.confirmedText !== '';
  const auto = snapshot.automation === 'auto';
  const voiceOn = snapshot.voice.state !== 'off';
  const send = (cmd: ManualScrollCommand): void => store.bridge?.send('cmd:scroll', cmd);
  const setSpeed = (delta: number) => () => send({ type: 'setSpeed', speed: snapshot.speed + delta });
  const toggleVoice = (): void => {
    void store.bridge?.invoke('cmd:voice', { op: 'toggle' }).catch(() => undefined);
  };

  return (
    <div className="tp-actionbar" role="toolbar" aria-label="Ações de gravação">
      <Tooltip label={`${auto ? 'Pausar' : 'Iniciar'}: ${shortcutHint('autoToggle')}`}>
        <Button
          size={size}
          iconLeft={auto ? 'pause' : 'play'}
          disabled={!hasText}
          onClick={() => send({ type: auto ? 'autoPause' : 'autoStart' })}
          style={{ minWidth: size === 'lg' ? 150 : 120 }}
        >
          {auto ? 'Pausar' : 'Iniciar'}
        </Button>
      </Tooltip>
      <div className="tp-speed" role="group" aria-label="Velocidade">
        <Tooltip label={`Mais devagar: ${shortcutHint('slower')}`}>
          <Button variant="secondary" size={size} aria-label="Mais devagar" disabled={snapshot.speed <= SPEED_MIN} onClick={setSpeed(-SPEED_STEP)}>
            -
          </Button>
        </Tooltip>
        <output className="tp-speed-value" aria-label="Velocidade atual" data-testid="speed">
          {formatSpeed(snapshot.speed)}
        </output>
        <Tooltip label={`Mais rápido: ${shortcutHint('faster')}`}>
          <Button variant="secondary" size={size} aria-label="Mais rápido" disabled={snapshot.speed >= SPEED_MAX} onClick={setSpeed(SPEED_STEP)}>
            +
          </Button>
        </Tooltip>
      </div>
      <Tooltip label={`Voltar ao início: ${shortcutHint('toStart')}`}>
        <Button variant="secondary" size={size} iconLeft="rewind-back" onClick={() => send({ type: 'toStart' })}>
          Voltar ao início
        </Button>
      </Tooltip>
      <StepButton dir={-1} label="Subir" icon="alt-arrow-up" size={size} />
      <StepButton dir={1} label="Descer" icon="alt-arrow-down" size={size} />
      <Tooltip label={`Voz: ${shortcutHint('voiceToggle')}`}>
        <Button variant={voiceOn ? 'primary' : 'secondary'} size={size} iconLeft="microphone-2" disabled={!hasText} onClick={toggleVoice}>
          Voz
        </Button>
      </Tooltip>
      <span className={`tp-voice-state tp-voice-${snapshot.voice.state}`} role="status" aria-label="Estado da voz">
        <span className="tp-voice-dot" aria-hidden="true" />
        {VOICE_LABEL[snapshot.voice.state]}
      </span>
    </div>
  );
}
