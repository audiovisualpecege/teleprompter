import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultKeymap } from '@shared/defaults';
import { formatSpeed } from '@shared/speed';
import type { ActionId, Automation, KeyCombo, ManualScrollCommand } from '@shared/types';
import { comboLabel, shortcutHint } from '../../src/renderer/control/shortcuts';
import { KeymapService, type KeyInput, type KeySource } from '../../src/main/keymap';
import { createScrollEngine } from '../../src/main/scroll-engine';
import { SettingsStore } from '../../src/main/settings';
import { referenceLayout } from '../fakes/layouts';
import { createFakePlatform } from '../fakes/platform';
import { createFakeScheduler } from '../fakes/scheduler';

const CONTROL: KeySource = { kind: 'control' };

function setup(options: { platform?: string; editor?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'tp-keymap-'));
  const settings = new SettingsStore({ userDataDir: dir });
  settings.load();
  const scrolls: ManualScrollCommand[] = [];
  const closed: number[] = [];
  const voice: number[] = [];
  const blurs: number[] = [];
  const state = { editor: options.editor ?? false, automation: 'none' as Automation, speed: 1 };
  const service = new KeymapService({
    settings,
    platform: options.platform ?? 'win32',
    editorFocused: () => state.editor,
    handlers: {
      scroll: (cmd) => void scrolls.push(cmd),
      automation: () => state.automation,
      speed: () => state.speed,
      voiceToggle: () => void voice.push(1),
      closeOutput: (id) => void closed.push(id),
      editorBlur: () => void blurs.push(1),
    },
  });
  const actions: ActionId[] = [];
  service.onEvent((e) => {
    if (e.kind === 'action') actions.push(e.action);
  });
  const press = (key: string, extra: Partial<KeyInput> = {}, source: KeySource = CONTROL): boolean =>
    service.handleInput(source, { type: 'keyDown', key, ...extra });
  return { dir, settings, service, scrolls, closed, voice, blurs, state, actions, press };
}

const combo = (key: string, mods: Partial<Omit<KeyCombo, 'key'>> = {}): KeyCombo => ({
  key,
  ctrlOrCmd: false,
  shift: false,
  alt: false,
  ...mods,
});

describe('KeymapService: atalhos padrão', () => {
  it.each<[string, Partial<KeyInput>, ActionId]>([
    [' ', {}, 'autoToggle'],
    ['ArrowDown', {}, 'down'],
    ['PageDown', {}, 'down'],
    ['ArrowUp', {}, 'up'],
    ['PageUp', {}, 'up'],
    ['+', { shift: true }, 'faster'],
    ['+', {}, 'faster'],
    ['-', {}, 'slower'],
    ['Home', {}, 'toStart'],
    ['v', {}, 'voiceToggle'],
    ['W', { control: true, shift: true }, 'closeOutput'],
  ])('UT-142 a tecla %j %j aciona a ação padrão', (key, extra, action) => {
    const t = setup();
    t.press(key, extra, { kind: 'output', id: 1 });
    expect(t.actions).toEqual([action]);
  });

  it('UT-142 um evento de uma janela de fora do programa nunca chega ao serviço', () => {
    const platform = createFakePlatform();
    const t = setup();
    const mine = platform.windows.create({});
    const other = platform.windows.create({});
    t.service.attach(mine as never, CONTROL);
    (other as unknown as { key(i: object): boolean }).key({ key: 'PageDown' });
    expect(t.scrolls).toEqual([]);
    (mine as unknown as { key(i: object): boolean }).key({ key: 'PageDown' });
    expect(t.scrolls).toEqual([{ type: 'lineStep', dir: 1 }]);
  });

  it('UT-143 ArrowDown: aperto anda uma linha, a repetição segura e soltar para', () => {
    const t = setup();
    expect(t.press('ArrowDown')).toBe(true);
    t.press('ArrowDown', { isAutoRepeat: true });
    t.press('ArrowDown', { isAutoRepeat: true });
    t.service.handleInput(CONTROL, { type: 'keyUp', key: 'ArrowDown' });
    expect(t.scrolls).toEqual([
      { type: 'lineStep', dir: 1 },
      { type: 'holdStart', dir: 1 },
      { type: 'holdEnd' },
    ]);
  });

  it('UT-144 Space com 10 repetições emite um único autoToggle', () => {
    const t = setup();
    t.press(' ');
    for (let i = 0; i < 10; i++) t.press(' ', { isAutoRepeat: true });
    t.service.handleInput(CONTROL, { type: 'keyUp', key: ' ' });
    expect(t.actions).toEqual(['autoToggle']);
    expect(t.scrolls).toEqual([{ type: 'autoStart' }]);
  });

  it('UT-145 com o editor em foco, Space, PageDown e V não emitem ação', () => {
    const t = setup({ editor: true });
    expect(t.press(' ')).toBe(false);
    expect(t.press('PageDown')).toBe(false);
    expect(t.press('v')).toBe(false);
    expect(t.actions).toEqual([]);
    expect(t.scrolls).toEqual([]);
    // Numa saída, o editor da tela de controle não bloqueia o pedal.
    t.press('PageDown', {}, { kind: 'output', id: 1 });
    expect(t.scrolls).toEqual([{ type: 'lineStep', dir: 1 }]);
  });

  it('UT-146 com o editor em foco, Ctrl+Shift+W emite closeOutput', () => {
    const t = setup({ editor: true });
    expect(t.press('W', { control: true, shift: true })).toBe(true);
    expect(t.actions).toEqual(['closeOutput']);
  });

  it('UT-147 Esc com o editor em foco emite editorBlur', () => {
    const t = setup({ editor: true });
    const events: string[] = [];
    t.service.onEvent((e) => void events.push(e.kind));
    expect(t.press('Escape')).toBe(false);
    expect(events).toEqual(['editorBlur']);
    expect(t.blurs).toEqual([1]);
  });
});

describe('KeymapService: troca de atalhos', () => {
  it('UT-148 set down B passa a mapear B para down e grava em ajustes.json', async () => {
    const t = setup();
    const r = t.service.command({ op: 'set', action: 'down', combo: combo('B') });
    expect(r.ok && r.value.down).toEqual([combo('b')]);
    t.press('b');
    expect(t.scrolls).toEqual([{ type: 'lineStep', dir: 1 }]);
    t.press('PageDown');
    expect(t.scrolls).toHaveLength(1);
    await t.settings.flush();
    const file = JSON.parse(readFileSync(join(t.dir, 'ajustes.json'), 'utf8')) as { keymap: Record<string, KeyCombo[]> };
    expect(file.keymap.down).toEqual([combo('b')]);
  });

  it('UT-149 set down Space devolve conflictWith autoToggle sem mudar nada', () => {
    const t = setup();
    const r = t.service.command({ op: 'set', action: 'down', combo: combo(' ') });
    expect(r).toEqual({ ok: false, error: { conflictWith: 'autoToggle' } });
    expect(t.service.keymap).toEqual(defaultKeymap());
  });

  it('UT-150 com force, Space vai para down e sai de autoToggle', () => {
    const t = setup();
    const r = t.service.command({ op: 'set', action: 'down', combo: combo(' '), force: true });
    expect(r.ok && r.value.down).toEqual([combo(' ')]);
    expect(r.ok && r.value.autoToggle).toEqual([]);
    t.press(' ');
    expect(t.scrolls).toEqual([{ type: 'lineStep', dir: 1 }]);
  });

  it.each<[string, KeyCombo]>([
    ['Alt+F4', combo('F4', { alt: true })],
    ['Cmd+Q', combo('q', { ctrlOrCmd: true })],
    ['Alt+Tab', combo('Tab', { alt: true })],
    ['Esc', combo('Escape')],
    ['Ctrl+Esc', combo('Escape', { ctrlOrCmd: true })],
    ['Ctrl+Alt+Delete', combo('Delete', { ctrlOrCmd: true, alt: true })],
    ['Cmd+Espaço', combo(' ', { ctrlOrCmd: true })],
    ['Win', combo('Meta')],
  ])('UT-151 %s devolve reserved', (_name, c) => {
    const t = setup();
    expect(t.service.command({ op: 'set', action: 'down', combo: c })).toEqual({ ok: false, error: 'reserved' });
    expect(t.service.keymap).toEqual(defaultKeymap());
  });

  it('UT-152 clear faster deixa a ação sem atalho (o botão "+" continua no ScrollEngine)', () => {
    const t = setup();
    const r = t.service.command({ op: 'clear', action: 'faster' });
    expect(r.ok && r.value.faster).toEqual([]);
    expect(t.press('+')).toBe(false);
    expect(t.scrolls).toEqual([]);
    expect(shortcutHint('faster', r.ok ? r.value : defaultKeymap())).toBe('Sem atalho');
    // O botão manda o comando direto ao motor, sem passar pelo mapa.
    const engine = createScrollEngine({ scheduler: createFakeScheduler() });
    engine.apply({ type: 'setSpeed', speed: engine.speed + 0.25 }, 0);
    expect(engine.speed).toBe(1.25);
  });

  it('UT-153 reset devolve exatamente os atalhos padrão', () => {
    const t = setup();
    t.service.command({ op: 'set', action: 'down', combo: combo('b') });
    t.service.command({ op: 'clear', action: 'up' });
    const r = t.service.command({ op: 'reset' });
    expect(r).toEqual({ ok: true, value: defaultKeymap() });
    expect(t.settings.settings.keymap).toEqual(defaultKeymap());
  });

  it('UT-154 Ctrl+Shift+W da saída 2 fecha a saída 2; da janela de controle, nada', () => {
    const t = setup();
    t.press('w', { control: true, shift: true }, { kind: 'output', id: 2 });
    expect(t.closed).toEqual([2]);
    t.press('w', { control: true, shift: true }, CONTROL);
    expect(t.closed).toEqual([2]);
  });

  it('UT-155 no darwin, fechar a saída é Cmd+Shift+W', () => {
    const t = setup({ platform: 'darwin' });
    expect(comboLabel(t.service.keymap.closeOutput[0], true)).toBe('Cmd+Shift+W');
    expect(comboLabel(t.service.keymap.closeOutput[0], false)).toBe('Ctrl+Shift+W');
    t.press('w', { control: true, shift: true }, { kind: 'output', id: 1 });
    expect(t.closed).toEqual([]);
    t.press('w', { meta: true, shift: true }, { kind: 'output', id: 1 });
    expect(t.closed).toEqual([1]);
  });

  it('UT-156 de 1,00x, cinco toques em "+" dão 2,25x; em 3,00x, mais um fica em 3,00x', () => {
    const t = setup();
    const engine = createScrollEngine({ scheduler: createFakeScheduler() });
    engine.load(referenceLayout(), 0);
    const service = new KeymapService({
      settings: t.settings,
      platform: 'win32',
      editorFocused: () => false,
      handlers: {
        scroll: (cmd) => void engine.apply(cmd, 0),
        automation: () => engine.automation,
        speed: () => engine.speed,
        voiceToggle: () => undefined,
        closeOutput: () => undefined,
        editorBlur: () => undefined,
      },
    });
    for (let i = 0; i < 5; i++) service.handleInput(CONTROL, { type: 'keyDown', key: '+', shift: true });
    expect(formatSpeed(engine.speed)).toBe('2,25x');
    for (let i = 0; i < 4; i++) service.handleInput(CONTROL, { type: 'keyDown', key: '+' });
    expect(formatSpeed(engine.speed)).toBe('3,00x');
    service.handleInput(CONTROL, { type: 'keyDown', key: '+' });
    expect(formatSpeed(engine.speed)).toBe('3,00x');
  });

  it('gravando um atalho, as teclas não viram ação', () => {
    const t = setup();
    t.service.setCapturing(true);
    expect(t.press(' ')).toBe(false);
    t.service.setCapturing(false);
    expect(t.press(' ')).toBe(true);
    expect(t.actions).toEqual(['autoToggle']);
  });
});
