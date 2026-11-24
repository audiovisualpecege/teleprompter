/**
 * Constantes de comportamento (TechSpec, "Constantes de comportamento").
 * Os valores de voz e o BASE_WPM nascem aqui e são recalibrados na prova da voz.
 */
import type { Appearance } from './types';

/** Palco lógico: largura fixa e altura de referência (ADR-006). */
export const STAGE_WIDTH = 1920;
export const STAGE_REF_HEIGHT = 1080;

/** Altura de linha, em múltiplos do tamanho da fonte. */
export const LINE_HEIGHT = 1.25;
/** Espaço entre parágrafos, em múltiplos do tamanho da fonte. */
export const PARAGRAPH_GAP = 0.6;

/** 1,00x da rolagem automática: px/s = velocidade x 140/60 x (altura total / palavras). */
export const BASE_WPM = 140;
export const SPEED_MIN = 0.25;
export const SPEED_MAX = 3.0;
export const SPEED_STEP = 0.25;
export const SPEED_DEFAULT = 1.0;

/** Deslizamento de uma linha (botão ou tecla). */
export const LINE_STEP_MS = 150;
/** Botão ou tecla segurada: linhas por segundo. */
export const HOLD_LINES_PER_SEC = 4;
/** Deslizamento da roda do mouse. */
export const NUDGE_GLIDE_MS = 120;

/** Janela curta do modo "Perto", a partir do cursor. */
export const NEAR_WINDOW_TOKENS = 15;
/** Quantas palavras ouvidas o modo "Perto" olha. */
export const NEAR_HEARD_WORDS = 4;
/** Critério do "Perto": ao menos `hits` das `of` palavras finais ouvidas, em ordem. */
export const MIN_MATCH_RUN = { hits: 2, of: 3 } as const;
/** Uma única palavra com ao menos este número de letras vale em cursor+1 ou cursor+2. */
export const NEAR_LONG_WORD_MIN = 6;
/**
 * No "Perto", quantos tokens do roteiro podem ficar entre duas palavras ouvidas que
 * batem (uma sigla que o reconhecedor não entende, uma palavra engolida). Evita que
 * palavras curtas soltas, como "o" e "e", casem longe uma da outra no improviso.
 */
export const NEAR_MAX_GAP = 2;
/** "Reconhecido com segurança": palavras seguidas e semelhança mínima de cada uma. */
export const JUMP_MIN_RUN = { words: 5, similarity: 0.85 } as const;
/** Semelhança (Levenshtein normalizado) para uma palavra "bater". */
export const WORD_SIMILARITY = 0.75;

/** Tempo sem casar para passar de Ouvindo a Esperando. */
export const WAITING_AFTER_MS = 2500;
/** O sinal discreto só muda com o estado estável por este tempo. */
export const SIGNAL_DEBOUNCE_MS = 700;
/** Alvos de voz ignorados logo após um comando manual. */
export const MANUAL_PRIORITY_MS = 300;
/** Deslizamento da voz, proporcional à distância, entre estes limites. */
export const VOICE_GLIDE_MS = { min: 250, max: 900 } as const;
/** Falha por lentidão e recuperação. */
export const TOO_SLOW_LAG_MS = 3000;
export const RECOVERED_LAG_MS = 800;
/** Esperas entre as tentativas de reiniciar o motor de voz. */
export const ENGINE_RESTART_DELAYS_MS = [1000, 2000, 4000] as const;

/** Número da saída ao abrir. */
export const ID_BADGE_MS = 4000;
/** Estabilidade do monitor antes de reabrir a saída. */
export const DISPLAY_STABLE_MS = 1000;
/** Correção do relógio comum. */
export const CLOCK_RESYNC_MS = 10000;
/** Cópia de recuperação. */
export const RECOVERY_SAVE_MS = 5000;
/** Importação acima disto mostra "Carregando". */
export const IMPORT_LOADING_MS = 1000;
/** Limite da consulta de versão nova. */
export const UPDATE_TIMEOUT_MS = 5000;
/** Quadros acima disto entram no log como quadro longo. */
export const LONG_FRAME_MS = 50;

/** Aviso de contraste (WCAG). */
export const LOW_CONTRAST_RATIO = 3;

/** Sinal discreto de voz nas saídas, em px lógicos, e distância da borda com margem 0%. */
export const VOICE_SIGNAL_SIZE = 28;
export const VOICE_SIGNAL_EDGE = 24;

/** Limites da aparência. */
export const FONT_SIZE_MIN = 20;
export const FONT_SIZE_MAX = 200;
export const MARGIN_PCT_MIN = 0;
export const MARGIN_PCT_MAX = 40;
export const BAND_POSITION_PCT_MIN = 10;
export const BAND_POSITION_PCT_MAX = 60;

/** Fonte de reserva quando a escolhida não carrega. */
export const FALLBACK_FONT = 'Archivo';

export const DEFAULT_APPEARANCE: Readonly<Appearance> = Object.freeze({
  fontFamily: 'Archivo',
  fontSize: 80,
  textColor: '#FFFFFF',
  backgroundColor: '#000000',
  bandColor: '#FACE9533',
  letterCase: 'normal',
  align: 'center',
  marginPct: 10,
  bandPositionPct: 33,
});
