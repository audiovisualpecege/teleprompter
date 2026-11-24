import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultKeymap, defaultSettings } from '@shared/defaults';
import { nodeFileSystem, type FileSystem } from '../../src/main/safe-write';
import { settingsPath, SettingsStore } from '../../src/main/settings';

let dir: string;
let logs: { event: string; fields?: Record<string, unknown> }[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tp-ajustes-'));
  logs = [];
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const store = (fs?: FileSystem): SettingsStore =>
  new SettingsStore({ userDataDir: dir, fs, log: (event, fields) => logs.push({ event, fields }) });

describe('SettingsStore', () => {
  it('UT-157 sem ajustes.json, load devolve os padrões', () => {
    const { settings, corrupt } = store().load();
    expect(corrupt).toBe(false);
    expect(settings.speed).toBe(1);
    expect(settings.voiceMode).toBe('near');
    expect(settings.voiceEngine).toBe('vosk');
    expect(settings.keymap).toEqual(defaultKeymap());
    expect(settings.outputs).toEqual([]);
    expect(settings).toEqual(defaultSettings());
  });

  it('UT-158 save seguido de load devolve o mesmo objeto', async () => {
    const s = store();
    const next = {
      ...defaultSettings(),
      speed: 1.75,
      voiceMode: 'forwardJumps' as const,
      micDeviceId: 'abc',
      micLabel: 'Microfone USB',
      outputs: [{ displayKey: '2|DELL|1920x1080', label: 'DELL', size: '1920x1080', mirrorH: true, flipV: false, voiceSignal: false }],
    };
    await s.save(next);
    expect(store().load().settings).toEqual(next);
  });

  it('UT-159 ajustes.json "{quebrado" devolve os padrões e um aviso; a próxima abertura não avisa', async () => {
    writeFileSync(settingsPath(dir), '{quebrado');
    const s = store();
    const first = s.load();
    expect(first.corrupt).toBe(true);
    expect(first.settings).toEqual(defaultSettings());
    expect(logs.filter((l) => l.event === 'settings.corrupt')).toHaveLength(1);
    await s.flush();
    const second = store().load();
    expect(second.corrupt).toBe(false);
    expect(logs.filter((l) => l.event === 'settings.corrupt')).toHaveLength(1);
  });

  it('UT-160 campos fora de faixa ficam presos aos limites ou voltam ao padrão', () => {
    writeFileSync(
      settingsPath(dir),
      JSON.stringify({
        schemaVersion: 1,
        speed: 7,
        voiceEngine: 'x',
        lastAppearance: { fontSize: 500, marginPct: -5, bandPositionPct: 70 },
      }),
    );
    const { settings, corrupt } = store().load();
    expect(corrupt).toBe(false);
    expect(settings.speed).toBe(3);
    expect(settings.lastAppearance.fontSize).toBe(200);
    expect(settings.lastAppearance.marginPct).toBe(0);
    expect(settings.lastAppearance.bandPositionPct).toBe(60);
    expect(settings.voiceEngine).toBe('vosk');
  });

  it('UT-161 resetAll grava os padrões e devolve o mesmo que load sem arquivo', async () => {
    const s = store();
    await s.save({ ...defaultSettings(), speed: 2.5 });
    const reset = await s.resetAll();
    expect(reset).toEqual(defaultSettings());
    expect(JSON.parse(readFileSync(settingsPath(dir), 'utf8'))).toEqual(defaultSettings());
    expect(logs.some((l) => l.event === 'settings.reset')).toBe(true);
  });

  it('UT-162 falha entre gravar o temporário e renomear deixa o ajustes.json anterior intacto', async () => {
    await store().save({ ...defaultSettings(), speed: 2 });
    const before = readFileSync(settingsPath(dir), 'utf8');
    const failing: FileSystem = {
      ...nodeFileSystem,
      rename: async () => {
        throw Object.assign(new Error('queda simulada'), { code: 'EIO' });
      },
    };
    await store(failing).save({ ...defaultSettings(), speed: 3 });
    expect(readFileSync(settingsPath(dir), 'utf8')).toBe(before);
    expect(store().load().settings.speed).toBe(2);
    expect(logs.some((l) => l.event === 'file.error')).toBe(true);
  });

  it('UT-163 o caminho é userData/ajustes.json', () => {
    expect(settingsPath(dir)).toBe(join(dir, 'ajustes.json'));
    expect(store().path).toBe(join(dir, 'ajustes.json'));
  });
});
