import { describe, expect, it } from 'vitest';
import { CONTROL_BACKGROUND, createControlWindow, createOutputWindow } from '../../src/main/windows';
import { createFakePlatform, fakeDisplay } from '../fakes/platform';

const paths = { mainDir: '/app/out/main', icon: '/app/icone.png' };

describe('janelas', () => {
  it('janelas: controle nasce Noite, isolada, sem Node e com a ponte de controle', () => {
    const platform = createFakePlatform();
    const win = createControlWindow(platform, paths);
    const opts = platform.created[0].options as {
      backgroundColor: string;
      show: boolean;
      icon: string;
      webPreferences: Record<string, unknown>;
    };
    expect(win).toBe(platform.created[0]);
    expect(opts.backgroundColor).toBe(CONTROL_BACKGROUND);
    expect(opts.show).toBe(false);
    expect(opts.icon).toBe(paths.icon);
    expect(opts.webPreferences.contextIsolation).toBe(true);
    expect(opts.webPreferences.nodeIntegration).toBe(false);
    expect(opts.webPreferences.backgroundThrottling).toBe(false);
    expect(String(opts.webPreferences.preload)).toMatch(/preload[\\/]control\.js$/);
    expect(platform.created[0].loaded).toMatch(/renderer[\\/]control[\\/]index\.html$/);
  });

  it('janelas: saída sem moldura, no monitor, com a cor de fundo da aparência e a ponte de saída', () => {
    const platform = createFakePlatform([fakeDisplay(1, 'A'), fakeDisplay(2, 'B', 1920)]);
    createOutputWindow(platform, { ...paths, devServerUrl: 'http://localhost:5173' }, {
      bounds: platform.displays[1].bounds,
      backgroundColor: '#000000',
      isMac: false,
    });
    const w = platform.created[0];
    const opts = w.options as Record<string, unknown> & { webPreferences: Record<string, unknown> };
    expect(opts.frame).toBe(false);
    expect(opts.fullscreen).toBe(true);
    expect(opts.x).toBe(1920);
    expect(opts.backgroundColor).toBe('#000000');
    expect(opts.webPreferences.contextIsolation).toBe(true);
    expect(opts.webPreferences.nodeIntegration).toBe(false);
    expect(opts.webPreferences.backgroundThrottling).toBe(false);
    expect(String(opts.webPreferences.preload)).toMatch(/preload[\\/]output\.js$/);
    expect(w.loaded).toBe('http://localhost:5173/output/index.html');
  });

  it('plataforma falsa: monitores ligam e desligam com eventos', () => {
    const platform = createFakePlatform();
    const seen: string[] = [];
    platform.screen.on('display-added', (d) => seen.push(`+${d.label}`));
    platform.screen.on('display-removed', (d) => seen.push(`-${d.label}`));
    platform.addDisplay(fakeDisplay(9, 'Projetor', 1920));
    platform.removeDisplay(9);
    expect(seen).toEqual(['+Projetor', '-Projetor']);
    const id = platform.powerSaveBlocker.start('prevent-display-sleep');
    expect(platform.powerSaveBlocker.isStarted(id)).toBe(true);
  });
});
