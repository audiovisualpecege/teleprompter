/**
 * `Icon` da Chiaro sem internet. Mesmas props do `design-system/chiaro/components/core/Icon.jsx`
 * (`name` em kebab-case do Solar, `weight`, `size`, `color`), mas desenhado com os
 * componentes do pacote `@solar-icons/react`, empacotado com o programa. O build troca
 * toda importação de `Icon.jsx` feita pelos componentes da Chiaro por este arquivo
 * (`chiaroOfflineIcon` em `electron.vite.config.ts`).
 *
 * Só os ícones usados pelo programa entram no mapa, para o pacote não levar os 9 mil.
 */
import type { ComponentType, CSSProperties } from 'react';
import {
  AddCircleLinearIcon,
  AltArrowDownBoldIcon,
  AltArrowDownLinearIcon,
  AltArrowUpBoldIcon,
  AltArrowUpLinearIcon,
  CheckBoldIcon,
  CheckLinearIcon,
  CloseCircleLinearIcon,
  CloseLinearIcon,
  DangerTriangleBoldIcon,
  DangerTriangleLinearIcon,
  DisketteLinearIcon,
  DocumentAddLinearIcon,
  DownloadMinimalisticLinearIcon,
  FolderOpenLinearIcon,
  FolderWithFilesLinearIcon,
  ImportLinearIcon,
  InfoCircleLinearIcon,
  KeyboardLinearIcon,
  Microphone2BoldIcon,
  Microphone2LinearIcon,
  MinusCircleLinearIcon,
  MonitorLinearIcon,
  PaletteLinearIcon,
  PauseBoldIcon,
  PlayBoldIcon,
  RestartLinearIcon,
  RewindBackLinearIcon,
  StarsMinimalisticBoldIcon,
  StarsMinimalisticLinearIcon,
  TextAlignCenterLinearIcon,
  TextAlignLeftLinearIcon,
} from '@solar-icons/react';

type SolarIcon = ComponentType<{ size?: number | string; color?: string; style?: CSSProperties }>;
export type IconWeight = 'linear' | 'bold' | 'bold-duotone';

const ICONS: Record<string, Partial<Record<IconWeight, SolarIcon>>> = {
  'add-circle': { linear: AddCircleLinearIcon },
  'alt-arrow-down': { linear: AltArrowDownLinearIcon, bold: AltArrowDownBoldIcon },
  'alt-arrow-up': { linear: AltArrowUpLinearIcon, bold: AltArrowUpBoldIcon },
  check: { linear: CheckLinearIcon, bold: CheckBoldIcon },
  close: { linear: CloseLinearIcon },
  'close-circle': { linear: CloseCircleLinearIcon },
  'danger-triangle': { linear: DangerTriangleLinearIcon, bold: DangerTriangleBoldIcon },
  diskette: { linear: DisketteLinearIcon },
  'document-add': { linear: DocumentAddLinearIcon },
  'download-minimalistic': { linear: DownloadMinimalisticLinearIcon },
  'folder-open': { linear: FolderOpenLinearIcon },
  'folder-with-files': { linear: FolderWithFilesLinearIcon },
  import: { linear: ImportLinearIcon },
  'info-circle': { linear: InfoCircleLinearIcon },
  keyboard: { linear: KeyboardLinearIcon },
  'microphone-2': { linear: Microphone2LinearIcon, bold: Microphone2BoldIcon },
  'minus-circle': { linear: MinusCircleLinearIcon },
  monitor: { linear: MonitorLinearIcon },
  palette: { linear: PaletteLinearIcon },
  pause: { bold: PauseBoldIcon },
  play: { bold: PlayBoldIcon },
  restart: { linear: RestartLinearIcon },
  'rewind-back': { linear: RewindBackLinearIcon },
  'stars-minimalistic': { linear: StarsMinimalisticLinearIcon, bold: StarsMinimalisticBoldIcon },
  'text-align-center': { linear: TextAlignCenterLinearIcon },
  'text-align-left': { linear: TextAlignLeftLinearIcon },
};

export interface IconProps {
  name: string;
  weight?: IconWeight;
  size?: number;
  color?: string;
  style?: CSSProperties;
}

export function Icon({ name, weight = 'linear', size = 20, color = 'currentColor', style }: IconProps) {
  const set = ICONS[name];
  const Glyph = set?.[weight] ?? set?.linear ?? set?.bold;
  return (
    <span
      aria-hidden="true"
      data-icon={name}
      style={{ display: 'inline-flex', flex: 'none', width: size, height: size, color, ...style }}
    >
      {Glyph ? <Glyph size={size} color="currentColor" /> : null}
    </span>
  );
}
