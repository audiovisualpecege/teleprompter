/**
 * Ajustes do estúdio em `ajustes.json`, na pasta do usuário (ADR-008, US-036).
 *
 * - Cada campo é validado com `zod`: número fora da faixa é preso ao limite; campo
 *   inválido volta ao padrão daquele campo.
 * - Arquivo ausente: padrão, sem aviso. Arquivo ilegível: padrão e um único aviso
 *   `settings.corrupt`; o arquivo é regravado na hora, então a próxima abertura não avisa.
 * - Toda gravação é segura (temporário e renomear).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { sanitizeAppearance } from '@shared/appearance';
import { defaultKeymap, defaultSettings, SETTINGS_FILE } from '@shared/defaults';
import { clampSpeed } from '@shared/speed';
import type { ActionId, KeyCombo, Keymap, SavedOutput, Settings } from '@shared/types';
import { atomicWrite, nodeFileSystem, type FileSystem } from './safe-write';

export type LogFn = (event: string, fields?: Record<string, unknown>) => void;

/** `path.join(app.getPath('userData'), 'ajustes.json')`. */
export function settingsPath(userDataDir: string): string {
  return join(userDataDir, SETTINGS_FILE);
}

const ACTIONS: ActionId[] = ['autoToggle', 'down', 'up', 'faster', 'slower', 'toStart', 'voiceToggle', 'closeOutput'];

const comboSchema = z.object({
  key: z.string().min(1),
  ctrlOrCmd: z.boolean().catch(false),
  shift: z.boolean().catch(false),
  alt: z.boolean().catch(false),
});

const outputSchema = z.object({
  displayKey: z.string().min(1),
  label: z.string().catch(''),
  size: z.string().catch(''),
  mirrorH: z.boolean().catch(false),
  flipV: z.boolean().catch(false),
  voiceSignal: z.boolean().catch(true),
});

const nullableString = z.string().nullable().catch(null);

/** Valida campo a campo sobre os padrões. Nunca lança erro. */
export function parseSettings(raw: unknown): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;
  const r = raw as Record<string, unknown>;

  const outputs: SavedOutput[] = Array.isArray(r.outputs)
    ? r.outputs.flatMap((o) => {
        const p = outputSchema.safeParse(o);
        return p.success ? [p.data] : [];
      })
    : d.outputs;

  const keymap: Keymap = defaultKeymap();
  if (r.keymap && typeof r.keymap === 'object') {
    const km = r.keymap as Record<string, unknown>;
    for (const action of ACTIONS) {
      const list = km[action];
      if (!Array.isArray(list)) continue;
      keymap[action] = list.flatMap((c): KeyCombo[] => {
        const p = comboSchema.safeParse(c);
        return p.success ? [p.data] : [];
      });
    }
  }

  return {
    schemaVersion: 1,
    outputs,
    keymap,
    micDeviceId: nullableString.parse(r.micDeviceId ?? null),
    micLabel: nullableString.parse(r.micLabel ?? null),
    voiceEngine: z.enum(['vosk', 'parakeet']).catch(d.voiceEngine).parse(r.voiceEngine),
    voiceMode: z.enum(['near', 'forwardJumps']).catch(d.voiceMode).parse(r.voiceMode),
    speed: z.number().transform((v) => clampSpeed(v, d.speed)).catch(d.speed).parse(r.speed),
    lastAppearance: sanitizeAppearance(
      r.lastAppearance && typeof r.lastAppearance === 'object' ? (r.lastAppearance as Record<string, unknown>) : null,
      d.lastAppearance,
    ),
    controlDisplayKey: nullableString.parse(r.controlDisplayKey ?? null),
  };
}

/** JSON legível, com a ordem de chaves de `Settings`. */
export function serializeSettings(s: Settings): string {
  return `${JSON.stringify(parseSettings(s), null, 2)}\n`;
}

export interface SettingsStoreOptions {
  userDataDir: string;
  fs?: FileSystem;
  log?: LogFn;
  /** Leitura síncrona na abertura (o arquivo é pequeno). */
  readFileSync?: (path: string) => string;
}

export interface SettingsLoad {
  settings: Settings;
  /** O arquivo estava ilegível nesta abertura (um único aviso). */
  corrupt: boolean;
}

export class SettingsStore {
  readonly path: string;
  private current: Settings = defaultSettings();
  private readonly fs: FileSystem;
  private readonly log: LogFn;
  private readonly readSync: (path: string) => string;
  private writing: Promise<void> = Promise.resolve();

  constructor(options: SettingsStoreOptions) {
    this.path = settingsPath(options.userDataDir);
    this.fs = options.fs ?? nodeFileSystem;
    this.log = options.log ?? (() => undefined);
    this.readSync = options.readFileSync ?? ((p) => readFileSync(p, 'utf8'));
  }

  get settings(): Settings {
    return this.current;
  }

  /** Lê o arquivo. Sem arquivo, padrão; ilegível, padrão com aviso e o arquivo regravado. */
  load(): SettingsLoad {
    let text: string;
    try {
      text = this.readSync(this.path);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'ENOENT') this.log('file.error', { op: 'settings.read', code: code ?? 'unknown' });
      this.current = defaultSettings();
      return { settings: this.current, corrupt: false };
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text.replace(/^﻿/, ''));
    } catch {
      raw = undefined;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      this.log('settings.corrupt', { path: this.path });
      this.current = defaultSettings();
      void this.persist();
      return { settings: this.current, corrupt: true };
    }
    this.current = parseSettings(raw);
    return { settings: this.current, corrupt: false };
  }

  /** Grava os ajustes (validados). Falha de disco vai ao log e não derruba o programa. */
  save(next: Settings): Promise<void> {
    this.current = parseSettings(next);
    return this.persist();
  }

  /** Aplica uma mudança parcial e grava. */
  update(patch: Partial<Settings>): Promise<void> {
    return this.save({ ...this.current, ...patch });
  }

  /** Volta todos os ajustes ao padrão e grava. */
  async resetAll(): Promise<Settings> {
    this.log('settings.reset', {});
    this.current = defaultSettings();
    await this.persist();
    return this.current;
  }

  /** Espera as gravações em curso (testes e fechamento do programa). */
  flush(): Promise<void> {
    return this.writing;
  }

  private persist(): Promise<void> {
    const data = serializeSettings(this.current);
    const run = async (): Promise<void> => {
      try {
        await atomicWrite(this.path, data, this.fs);
      } catch (e) {
        this.log('file.error', { op: 'settings.write', code: (e as { code?: string }).code ?? 'unknown' });
      }
    };
    // Gravações em fila: a última sempre ganha.
    this.writing = this.writing.then(run, run);
    return this.writing;
  }
}
