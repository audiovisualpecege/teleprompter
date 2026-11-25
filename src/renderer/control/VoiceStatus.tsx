/**
 * Estado da voz na tela de controle (ADR-004; TechSpec, "Design system"):
 * - o estado, num lugar fixo ao lado das ações de gravação, sempre com texto e cor
 *   ("Preparando" `--info`, "Ouvindo" `--success`, "Esperando" `--warning`, "Falhou" `--danger`);
 * - a faixa de alerta em `--danger` com o motivo, enquanto a voz está em "Falhou". Ela some
 *   sozinha quando a causa se resolve (US-034 AC-2) ou quando a voz é desligada.
 */
import type { VoiceState } from '@shared/types';
import { VOICE_FAULT_NOTICE, VOICE_STATE_COLOR, VOICE_STATE_LABEL } from '@shared/voice';
import { Icon } from '../shared/ui/Icon';
import { useSnapshot } from './hooks';

export function VoiceStateBadge({ state }: { state: VoiceState }) {
  const color = `var(${VOICE_STATE_COLOR[state]})`;
  return (
    <span
      className={`tp-voice-state tp-voice-${state}`}
      role="status"
      aria-label="Estado da voz"
      data-state={state}
      data-color={VOICE_STATE_COLOR[state]}
    >
      <span className="tp-voice-dot" aria-hidden="true" style={{ background: color }} />
      <span className="tp-voice-label" style={state === 'off' ? undefined : { color }}>
        {VOICE_STATE_LABEL[state]}
      </span>
    </span>
  );
}

/** Faixa de alerta forte da voz: só em "Falhou", com o motivo recebido do principal. */
export function VoiceAlert() {
  const { voice, notices } = useSnapshot();
  if (voice.state !== 'failed') return null;
  const reason = notices.find((n) => n.id === VOICE_FAULT_NOTICE)?.message;
  if (!reason) return null;
  return (
    <div className="tp-voice-alert" role="alert" data-testid="voice-alert">
      <Icon name="danger-triangle" size={22} />
      <span>
        <strong>Falhou:</strong> {reason}
      </span>
      <span className="tp-voice-alert-hint">O texto está parado. Use os botões, as teclas ou o pedal.</span>
    </div>
  );
}
