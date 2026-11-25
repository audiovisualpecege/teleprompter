/**
 * Nomes dos atalhos na tela (dicas dos botões e tela de atalhos), lidos do mapa atual.
 * No Mac, `ctrlOrCmd` aparece como "Cmd"; nos outros sistemas, como "Ctrl".
 */
import { defaultKeymap } from '@shared/defaults';
import type { ActionId, KeyCombo, Keymap } from '@shared/types';

const KEY_NAMES: Record<string, string> = {
  ' ': 'Espaço',
  ArrowDown: 'Seta para baixo',
  ArrowUp: 'Seta para cima',
  ArrowLeft: 'Seta para a esquerda',
  ArrowRight: 'Seta para a direita',
  PageDown: 'Page Down',
  PageUp: 'Page Up',
  Home: 'Home',
  End: 'End',
  Enter: 'Enter',
  Escape: 'Esc',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Tab: 'Tab',
  Meta: 'Win',
};

/** Nome das ações, na ordem da tela de atalhos. */
export const ACTION_LABELS: Record<ActionId, string> = {
  autoToggle: 'Iniciar ou pausar a rolagem automática',
  down: 'Descer',
  up: 'Subir',
  faster: 'Mais velocidade',
  slower: 'Menos velocidade',
  toStart: 'Voltar ao início',
  voiceToggle: 'Ligar ou desligar a voz',
  closeOutput: 'Fechar a saída em foco',
};

export const ACTION_ORDER = Object.keys(ACTION_LABELS) as ActionId[];

/** O programa roda num Mac (a janela de controle descobre pelo navegador). */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac/i.test(navigator.platform || navigator.userAgent || '');
}

export function comboLabel(c: KeyCombo, mac = isMacPlatform()): string {
  const key = KEY_NAMES[c.key] ?? (Array.from(c.key).length === 1 ? c.key.toUpperCase() : c.key);
  return [c.ctrlOrCmd && (mac ? 'Cmd' : 'Ctrl'), c.alt && (mac ? 'Option' : 'Alt'), c.shift && 'Shift', key]
    .filter(Boolean)
    .join('+');
}

/** "Seta para baixo ou Page Down"; sem combinação, "Sem atalho". */
export function shortcutHint(action: ActionId, keymap: Keymap = defaultKeymap(), mac = isMacPlatform()): string {
  const combos = keymap[action] ?? [];
  if (combos.length === 0) return 'Sem atalho';
  return combos.map((c) => comboLabel(c, mac)).join(' ou ');
}
