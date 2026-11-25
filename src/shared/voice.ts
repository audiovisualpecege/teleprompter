/**
 * Textos e identificadores da voz, num lugar só (TechSpec, "Estados da voz"; US-028,
 * US-029, US-034): o principal os usa nos avisos, e a tela de controle no estado da voz
 * e na faixa de alerta.
 */
import type { EngineFault, VoiceState } from './types';

/** Aviso da falha da voz: um só, atualizado, desenhado como a faixa de alerta. */
export const VOICE_FAULT_NOTICE = 'voice-fault';
/** Aviso de quando a voz não pôde ligar (sem microfone, sem permissão). */
export const VOICE_START_NOTICE = 'voice-start';
/** Aviso do microfone guardado que não está ligado (US-029 EC-1). */
export const MIC_MISSING_NOTICE = 'mic-missing';

export const MIC_MISSING_MESSAGE = 'O microfone guardado não está ligado. Escolha outro na aba Voz';
export const NO_MIC_MESSAGE = 'Nenhum microfone encontrado. Ligue um microfone e tente de novo';

/** Como dar a permissão de microfone em cada sistema (US-028 EC-2). */
export function micDeniedMessage(platform: string): string {
  if (platform === 'darwin') {
    return 'O programa não tem permissão para usar o microfone. Abra Ajustes do Sistema, Privacidade e Segurança, Microfone, ligue o Teleprompter e tente de novo';
  }
  return 'O programa não tem permissão para usar o microfone. Abra Configurações, Privacidade e segurança, Microfone, ligue "Permitir que aplicativos da área de trabalho acessem o microfone" e tente de novo';
}

/** O motivo de cada falha, como aparece na faixa ("Falhou: <motivo>"). */
export function faultReason(fault: EngineFault, platform: string): string {
  switch (fault) {
    case 'mic-lost':
      return 'O microfone foi desconectado';
    case 'engine-crashed':
      return 'O reconhecimento de voz parou';
    case 'too-slow':
      return 'O computador não está dando conta';
    case 'no-mic':
      return NO_MIC_MESSAGE;
    case 'mic-denied':
      return micDeniedMessage(platform);
  }
}

/** Texto de cada estado, sempre ao lado da cor. */
export const VOICE_STATE_LABEL: Record<VoiceState, string> = {
  off: 'Desligada',
  preparing: 'Preparando',
  listening: 'Ouvindo',
  waiting: 'Esperando',
  failed: 'Falhou',
};

/** Token de cor de cada estado (TechSpec, "Design system"). */
export const VOICE_STATE_COLOR: Record<VoiceState, string> = {
  off: '--text-muted',
  preparing: '--info',
  listening: '--success',
  waiting: '--warning',
  failed: '--danger',
};
