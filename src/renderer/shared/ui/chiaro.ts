/**
 * Componentes do design system da Chiaro usados pelo programa, importados de
 * `@chiaro/components/...` (nunca copiados). Os `.d.ts` do export descrevem só as props
 * principais, mas `Button` e `Input` repassam o resto ao elemento nativo; aqui os tipos
 * são alargados uma vez, para as telas passarem `onBlur`, `aria-*` e afins sem conversões.
 */
import type { ComponentType, CSSProperties, ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Badge as ChiaroBadge } from '@chiaro/components/core/Badge.jsx';
import { Button as ChiaroButton } from '@chiaro/components/core/Button.jsx';
import { IconButton as ChiaroIconButton } from '@chiaro/components/core/IconButton.jsx';
import { Tag as ChiaroTag } from '@chiaro/components/core/Tag.jsx';
import { Checkbox as ChiaroCheckbox } from '@chiaro/components/forms/Checkbox.jsx';
import { Input as ChiaroInput } from '@chiaro/components/forms/Input.jsx';
import { Radio as ChiaroRadio } from '@chiaro/components/forms/Radio.jsx';
import { Select as ChiaroSelect } from '@chiaro/components/forms/Select.jsx';
import { Switch as ChiaroSwitch } from '@chiaro/components/forms/Switch.jsx';
import { Tabs as ChiaroTabs } from '@chiaro/components/navigation/Tabs.jsx';
import { Card as ChiaroCard } from '@chiaro/components/surfaces/Card.jsx';
import { Dialog as ChiaroDialog } from '@chiaro/components/surfaces/Dialog.jsx';
import { Toast as ChiaroToast } from '@chiaro/components/surfaces/Toast.jsx';
import { Tooltip as ChiaroTooltip } from '@chiaro/components/surfaces/Tooltip.jsx';
import { SectionTitle as ChiaroSectionTitle } from '@chiaro/components/brand/SectionTitle.jsx';

type Native<T> = Omit<T, 'style' | 'children' | 'onChange'>;

export interface ButtonProps extends Native<ButtonHTMLAttributes<HTMLButtonElement>> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'light' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  /** Nome do ícone Solar (peso linear). */
  iconLeft?: string;
  iconRight?: string;
  fullWidth?: boolean;
  type?: 'button' | 'submit';
  children?: ReactNode;
  style?: CSSProperties;
}

export interface IconButtonProps {
  icon: string;
  weight?: 'linear' | 'bold' | 'bold-duotone';
  label: string;
  variant?: 'ghost' | 'solid' | 'outline' | 'glass';
  size?: number;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

type InputNative = Native<InputHTMLAttributes<HTMLInputElement>> & Native<TextareaHTMLAttributes<HTMLTextAreaElement>>;
export interface InputProps extends Omit<InputNative, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  multiline?: boolean;
  rows?: number;
  style?: CSSProperties;
  onChange?: (e: { target: { value: string } }) => void;
}

export interface SelectProps {
  label?: string;
  options: (string | { value: string; label: string })[];
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange?: (e: { target: { value: string } }) => void;
  style?: CSSProperties;
}

export interface ChoiceProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  name?: string;
  value?: string;
}

export interface TabsProps {
  items: (string | { value: string; label: string })[];
  value?: string;
  onChange?: (value: string) => void;
  variant?: 'underline' | 'pill';
  style?: CSSProperties;
}

export interface CardProps {
  variant?: 'default' | 'raised' | 'noite' | 'warm' | 'brand';
  padding?: number | string;
  interactive?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  style?: CSSProperties;
}

export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export interface ToastProps {
  tone?: 'default' | 'success' | 'danger';
  title?: string;
  message?: string;
  onClose?: () => void;
  style?: CSSProperties;
}

export interface TooltipProps {
  label: string;
  placement?: 'top' | 'bottom';
  children: ReactNode;
}

export interface BadgeProps {
  tone?: 'brand' | 'soft' | 'warm' | 'dark' | 'live' | 'success';
  children?: ReactNode;
  style?: CSSProperties;
}

export interface TagProps {
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  children?: ReactNode;
  style?: CSSProperties;
}

export interface SectionTitleProps {
  light?: string;
  bold?: string;
  eyebrow?: string;
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  as?: 'h1' | 'h2' | 'h3';
  style?: CSSProperties;
}

export const Button = ChiaroButton as unknown as ComponentType<ButtonProps>;
export const IconButton = ChiaroIconButton as unknown as ComponentType<IconButtonProps>;
export const Input = ChiaroInput as unknown as ComponentType<InputProps>;
export const Select = ChiaroSelect as unknown as ComponentType<SelectProps>;
export const Checkbox = ChiaroCheckbox as unknown as ComponentType<ChoiceProps>;
export const Radio = ChiaroRadio as unknown as ComponentType<ChoiceProps>;
export const Switch = ChiaroSwitch as unknown as ComponentType<Omit<ChoiceProps, 'name' | 'value'>>;
export const Tabs = ChiaroTabs as unknown as ComponentType<TabsProps>;
export const Card = ChiaroCard as unknown as ComponentType<CardProps>;
export const Dialog = ChiaroDialog as unknown as ComponentType<DialogProps>;
export const Toast = ChiaroToast as unknown as ComponentType<ToastProps>;
export const Tooltip = ChiaroTooltip as unknown as ComponentType<TooltipProps>;
export const Badge = ChiaroBadge as unknown as ComponentType<BadgeProps>;
export const Tag = ChiaroTag as unknown as ComponentType<TagProps>;
export const SectionTitle = ChiaroSectionTitle as unknown as ComponentType<SectionTitleProps>;
