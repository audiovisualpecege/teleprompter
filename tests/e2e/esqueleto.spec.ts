import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { closeApp, launchApp, ROOT } from './app';

const version = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }).version;

test('esqueleto: abre a tela de controle no tema Noite com a versão no rodapé', async () => {
  const app = await launchApp();
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.tp-version')).toHaveText(`v${version}`);

    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('noite');
    const probe = (await page.evaluate(() => window.__tpProbe?.())) as Record<string, unknown>;
    expect(probe.role).toBe('control');
    expect(probe.version).toBe(version);
    expect(probe.background).toBe('rgb(7, 0, 16)');
    expect(probe.colorScheme).toBe('dark');

    // A cor da versão vem de --text-muted do tema Noite.
    const color = await page.locator('.tp-version').evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe('rgb(133, 124, 156)');

    // As fontes da Chiaro vão no pacote e carregam sem internet.
    const archivo = await page.evaluate(async () => {
      await document.fonts.load('16px Archivo');
      return document.fonts.check('16px Archivo');
    });
    expect(archivo).toBe(true);

    // Ganchos do build de teste: da janela e do principal.
    expect(await page.evaluate(() => window.__tpTest?.ping())).toBe('pong');
    expect(await page.evaluate(() => window.__tpTest?.appVersion())).toBe(version);

    // Ponte tipada e relógio comum.
    const pong = (await page.evaluate(() => (window.tp as { invoke: (c: string, p: number) => Promise<unknown> }).invoke('clock:ping', 123))) as {
      t0: number;
      mainNow: number;
    };
    expect(pong.t0).toBe(123);
    expect(pong.mainNow).toBeGreaterThan(1e12);
    const blocked = await page.evaluate(async () => {
      try {
        await (window.tp as unknown as { invoke: (c: string, p: unknown) => Promise<unknown> }).invoke('fora:da:lista', 1);
        return false;
      } catch {
        return true;
      }
    });
    expect(blocked).toBe(true);
    expect(await page.evaluate(() => typeof (window as unknown as { require?: unknown }).require)).toBe('undefined');

    const bg = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBackgroundColor());
    expect(bg.toUpperCase()).toContain('070010');
    const theme = await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource);
    expect(theme).toBe('dark');
  } finally {
    await closeApp(app);
  }
});
