/**
 * Velocidade da rolagem automática (ADR-005): de 0,25x a 3,00x em passos de 0,25x.
 */
import { SPEED_DEFAULT, SPEED_MAX, SPEED_MIN, SPEED_STEP } from './defaults';

/** Arredonda ao passo de 0,25 mais próximo e prende entre 0,25 e 3,00. Valor inválido vira `fallback`. */
export function clampSpeed(speed: number, fallback: number = SPEED_DEFAULT): number {
  if (typeof speed !== 'number' || !Number.isFinite(speed)) return fallback;
  const stepped = Math.round(speed / SPEED_STEP) * SPEED_STEP;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, stepped));
}

/** Velocidade como aparece na tela: "1,25x", "1,00x". */
export function formatSpeed(speed: number): string {
  return `${clampSpeed(speed).toFixed(2).replace('.', ',')}x`;
}
