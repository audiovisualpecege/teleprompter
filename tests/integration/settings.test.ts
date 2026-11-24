import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultKeymap, defaultSettings } from '@shared/defaults';
import type { Settings } from '@shared/types';
import { settingsPath, SettingsStore } from '../../src/main/settings';
import { createTestStore } from '../fakes/store';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tp-ajustes-it-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('Ajustes com disco real', () => {
  it('IT-010 saídas, atalhos, microfone, modo, motor, velocidade e aparência voltam iguais', async () => {
    const keymap = defaultKeymap();
    keymap.down = [{ key: 'PageDown', ctrlOrCmd: false, shift: false, alt: false }];
    keymap.voiceToggle = [];
    const saved: Settings = {
      ...defaultSettings(),
      outputs: [
        { displayKey: '2|DELL P2419H|1920x1080', label: 'DELL P2419H', size: '1920x1080', mirrorH: true, flipV: false, voiceSignal: true },
        { displayKey: '3|LG|1280x720', label: 'LG', size: '1280x720', mirrorH: false, flipV: true, voiceSignal: false },
      ],
      keymap,
      micDeviceId: 'mic-123',
      micLabel: 'Microfone de lapela',
      voiceMode: 'forwardJumps',
      voiceEngine: 'parakeet',
      speed: 1.5,
      lastAppearance: { ...defaultSettings().lastAppearance, fontSize: 130, align: 'left', bandPositionPct: 45 },
      controlDisplayKey: '1|Monitor|1920x1080',
    };
    await new SettingsStore({ userDataDir: dir }).save(saved);
    const again = new SettingsStore({ userDataDir: dir }).load();
    expect(again).toEqual({ settings: saved, corrupt: false });
    // JSON legível no disco.
    expect(readFileSync(settingsPath(dir), 'utf8')).toContain('\n  "speed": 1.5,');
  });

  it('IT-011 ajustes corrompidos: sobe com o padrão e um único aviso; o segundo início não avisa', async () => {
    writeFileSync(settingsPath(dir), '{"speed": 2, quebrado');
    const first = await createTestStore({ userDataDir: dir });
    expect(first.last().speed).toBe(1);
    expect(first.last().notices.filter((n) => n.id === 'settings.corrupt')).toHaveLength(1);
    expect(first.logs.filter((l) => l.event === 'settings.corrupt')).toHaveLength(1);
    await first.store.flush();

    const second = await createTestStore({ userDataDir: dir });
    expect(second.last().notices).toEqual([]);
    expect(second.logs.filter((l) => l.event === 'settings.corrupt')).toHaveLength(0);
  });
});
