/**
 * E2E-013 (CI Windows), sobre o instalador de produção gerado pelo workflow de Release:
 * 1. instalar `Teleprompter-<versão>-win-x64.exe /S`: o atalho do menu Iniciar existe e
 *    mostra o ícone do teleprompter;
 * 2. com a rede do programa bloqueada no firewall, a tela abre e a voz com WAV falso
 *    chega a "Ouvindo";
 * 3. outra versão de teste instalada por cima mantém `ajustes.json` igual;
 * 4. o log mostra uma única tentativa de rede (`update.check`).
 * O passo 5 (instruções "Mais informações" e "Executar assim mesmo" no Como usar) é
 * conferido em tests/unit/entrega.test.ts.
 *
 * O build de produção não tem ganchos de teste: tudo é lido do DOM, do disco e do log.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';

const ROOT = join(__dirname, '..', '..');
const VERSION = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }).version;
const INSTALLER = process.env.TP_INSTALLER ?? '';
const INSTALLER_OVER = process.env.TP_INSTALLER_OVER ?? '';
const APPDATA = process.env.APPDATA ?? '';
const LOCALAPPDATA = process.env.LOCALAPPDATA ?? '';
const USER_DATA = join(APPDATA, 'Teleprompter');
const SETTINGS = join(USER_DATA, 'ajustes.json');
const LOG = join(USER_DATA, 'logs', 'teleprompter.log');
const SHORTCUT = join(APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Teleprompter.lnk');
const VOZ = join(ROOT, 'tests', 'fixtures', 'voz');
const WAV = join(VOZ, 'sintetica', 'leitura-continua.wav');
const ROTEIRO = readFileSync(join(VOZ, 'roteiro.txt'), 'utf8');
const RULE = 'Teleprompter E2E-013 sem rede';

test.skip(process.platform !== 'win32' || !INSTALLER, 'só no CI do Windows, com TP_INSTALLER');

function powershell(script: string): string {
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' }).trim();
}

/** Instala em silêncio e espera o instalador terminar. */
function install(file: string): void {
  powershell(`Start-Process -FilePath '${file}' -ArgumentList '/S' -Wait`);
}

function installedExe(): string {
  const candidates = [
    join(LOCALAPPDATA, 'Programs', 'teleprompter', 'Teleprompter.exe'),
    join(LOCALAPPDATA, 'Programs', 'Teleprompter', 'Teleprompter.exe'),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`Teleprompter.exe não encontrado em ${candidates.join(', ')}`);
  return found;
}

async function launch(exe: string): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    executablePath: exe,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${WAV}`],
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.tp-version')).toHaveText(`v${VERSION}`, { timeout: 30_000 });
  return { app, page };
}

async function quit(app: ElectronApplication): Promise<void> {
  const proc = app.process();
  const closed = new Promise<void>((resolve) => proc.once('exit', () => resolve()));
  await app.evaluate(({ app: a }) => setTimeout(() => a.exit(0), 0)).catch(() => undefined);
  await Promise.race([closed, new Promise((r) => setTimeout(r, 10_000))]);
  if (proc.exitCode === null) proc.kill();
}

test.afterAll(() => {
  try {
    powershell(`Remove-NetFirewallRule -DisplayName '${RULE}' -ErrorAction SilentlyContinue`);
  } catch {
    // Sem a regra, nada a remover.
  }
});

test('E2E-013 instalar no Windows, abrir sem rede e instalar por cima', async () => {
  rmSync(USER_DATA, { recursive: true, force: true });

  // 1. Instalar em silêncio: atalho no menu Iniciar com o ícone do produto.
  install(INSTALLER);
  const exe = installedExe();
  expect(existsSync(SHORTCUT)).toBe(true);
  const target = powershell(`(New-Object -ComObject WScript.Shell).CreateShortcut('${SHORTCUT}').TargetPath`);
  expect(target.toLowerCase()).toBe(exe.toLowerCase());
  // O ícone do programa instalado é o do teleprompter (comparado ao PNG de 32 px gerado do SVG).
  const iconDiff = Number(
    powershell(`
      Add-Type -AssemblyName System.Drawing
      $a = [System.Drawing.Icon]::ExtractAssociatedIcon('${exe}').ToBitmap()
      $b = New-Object System.Drawing.Bitmap('${join(ROOT, 'build', 'icons', '32x32.png')}')
      $sum = 0
      for ($x = 0; $x -lt 32; $x++) { for ($y = 0; $y -lt 32; $y++) {
        $p = $a.GetPixel($x, $y); $q = $b.GetPixel($x, $y)
        $sum += [Math]::Abs($p.R - $q.R) + [Math]::Abs($p.G - $q.G) + [Math]::Abs($p.B - $q.B) + [Math]::Abs($p.A - $q.A)
      } }
      [Math]::Round($sum / (32 * 32 * 4), 2)
    `),
  );
  expect(iconDiff).toBeLessThan(12);

  // 2. Rede do programa bloqueada: a tela abre e a voz chega a "Ouvindo".
  powershell(`New-NetFirewallRule -DisplayName '${RULE}' -Direction Outbound -Program '${exe}' -Action Block | Out-Null`);
  let { app, page } = await launch(exe);
  try {
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('noite');
    await page.getByLabel('Texto do roteiro').fill(ROTEIRO);
    await page.getByRole('button', { name: 'Confirmar alterações' }).click();
    // Um ajuste para haver ajustes.json: velocidade 1,25x.
    await page.getByRole('button', { name: 'Mais rápido' }).click();
    await expect(page.getByTestId('speed')).toHaveText('1,25x');
    await page.getByRole('button', { name: 'Voz', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Estado da voz' })).toHaveText('Ouvindo', { timeout: 90_000 });
  } finally {
    await quit(app);
  }

  // 4. Uma única tentativa de rede nessa abertura, e ela falhou em silêncio.
  const checks = readFileSync(LOG, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('update.check'));
  expect(checks).toHaveLength(1);
  expect(checks[0]).toMatch(/"result":"(network|timeout)"/);

  // 3. Instalar outra versão por cima: os ajustes continuam iguais.
  const before = readFileSync(SETTINGS, 'utf8');
  expect(JSON.parse(before).speed).toBe(1.25);
  install(INSTALLER_OVER);
  expect(readFileSync(SETTINGS, 'utf8')).toBe(before);
  // A versão de teste só muda o número do pacote; a tela abre com os ajustes guardados.
  ({ app, page } = await launch(installedExe()));
  try {
    await expect(page.getByTestId('speed')).toHaveText('1,25x', { timeout: 30_000 });
  } finally {
    await quit(app);
  }
});
