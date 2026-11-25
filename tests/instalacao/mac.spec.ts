/**
 * E2E-014 (CI Mac), sobre o DMG de produção gerado pelo workflow de Release: montar o
 * DMG, copiar o app e abrir com `--no-sandbox`: a janela de controle abre com a versão
 * do package.json (`v1.0.0`) e o tema Noite, e o app traz o ícone do teleprompter.
 * O build de produção não tem ganchos de teste: tudo é lido do DOM e do pacote.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';

const ROOT = join(__dirname, '..', '..');
const VERSION = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }).version;
const DMG = process.env.TP_DMG ?? '';

test.skip(process.platform !== 'darwin' || !DMG, 'só no CI do Mac, com TP_DMG');

test('E2E-014 abrir o DMG no Mac com a versão e o tema Noite', async () => {
  const work = mkdtempSync(join(tmpdir(), 'tp-dmg-'));
  const mount = join(work, 'volume');
  execFileSync('hdiutil', ['attach', DMG, '-nobrowse', '-readonly', '-mountpoint', mount], { stdio: 'inherit' });
  const app = join(work, 'Teleprompter.app');
  try {
    cpSync(join(mount, 'Teleprompter.app'), app, { recursive: true, verbatimSymlinks: true });
  } finally {
    execFileSync('hdiutil', ['detach', mount, '-force'], { stdio: 'inherit' });
  }

  // O ícone do Dock é o do teleprompter, o mesmo .icns gerado do SVG do produto.
  const plist = readFileSync(join(app, 'Contents', 'Info.plist'), 'utf8');
  const iconName = /<key>CFBundleIconFile<\/key>\s*<string>([^<]+)<\/string>/.exec(plist)?.[1] ?? '';
  expect(iconName).not.toBe('');
  const icns = readFileSync(join(app, 'Contents', 'Resources', iconName.endsWith('.icns') ? iconName : `${iconName}.icns`));
  expect(icns.equals(readFileSync(join(ROOT, 'build', 'icons', 'icone.icns')))).toBe(true);
  expect(plist).toContain('NSMicrophoneUsageDescription');
  expect(plist).toContain(`<string>${VERSION}</string>`);

  const electronApp = await electron.launch({
    executablePath: join(app, 'Contents', 'MacOS', 'Teleprompter'),
    args: ['--no-sandbox'],
  });
  try {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.tp-version')).toHaveText(`v${VERSION}`, { timeout: 30_000 });
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('noite');
    const look = await page.evaluate(() => ({
      background: getComputedStyle(document.body).backgroundColor,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
    }));
    expect(look.background).toBe('rgb(7, 0, 16)');
    expect(look.colorScheme).toBe('dark');
    const bg = await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBackgroundColor());
    expect(bg.toUpperCase()).toContain('070010');
  } finally {
    const proc = electronApp.process();
    await electronApp.evaluate(({ app: a }) => setTimeout(() => a.exit(0), 0)).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 2000));
    if (proc.exitCode === null) proc.kill();
    rmSync(work, { recursive: true, force: true });
  }
});
