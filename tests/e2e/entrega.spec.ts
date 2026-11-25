/**
 * Ajustes, versão e atualização (E2E-011, E2E-012), no build de teste, com os monitores
 * virtuais de `TP_FAKE_DISPLAYS` e, no aviso de versão nova, um servidor HTTP local que
 * imita `releases/latest` (`TP_UPDATE_URL`, que só existe no build de teste).
 */
import { mkdtempSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { closeApp, controlPage, FAKE_DISPLAYS, launchApp, outputPage, probe } from './app';

const freshDir = (): string => mkdtempSync(join(tmpdir(), 'tp-e2e-'));
const TEXT = Array.from({ length: 40 }, (_, i) => `Linha ${i + 1} do roteiro de teste.`).join('\n');

async function open(userData: string, env: Record<string, string> = {}): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await launchApp({ TP_USER_DATA: userData, TP_FAKE_DISPLAYS: FAKE_DISPLAYS, ...env });
  const page = await controlPage(app);
  await expect(page.locator('.tp-version')).toBeVisible();
  return { app, page };
}

async function confirmText(page: Page): Promise<void> {
  await page.getByLabel('Texto do roteiro').fill(TEXT);
  await page.getByRole('button', { name: 'Confirmar alterações' }).click();
  await expect.poll(() => probe<string[]>(page, 'lines').then((l) => l.length)).toBeGreaterThan(0);
}

const outputGroup = (page: Page, id: number) => page.getByRole('group', { name: `Saída ${id}` });

test('E2E-011 ajustes guardados ao reiniciar e voltar ao padrão', async () => {
  const dir = freshDir();
  let { app, page } = await open(dir);
  try {
    await confirmText(page);
    // Velocidade 1,50x.
    await page.getByRole('button', { name: 'Mais rápido' }).click();
    await page.getByRole('button', { name: 'Mais rápido' }).click();
    await expect(page.getByTestId('speed')).toHaveText('1,50x');
    // Modo da voz "Pulos para a frente".
    await page.getByRole('tab', { name: 'Voz' }).click();
    await page.locator('label', { hasText: 'Pulos para a frente' }).first().click();
    await expect(page.getByLabel('Pulos para a frente')).toBeChecked();
    // Saída em B com as duas inversões.
    await page.getByRole('tab', { name: 'Saídas' }).click();
    await page.getByRole('group', { name: 'B' }).getByRole('button', { name: 'Abrir saída' }).click();
    await outputPage(app, 1);
    await outputGroup(page, 1).getByText('Espelhar').click();
    await outputGroup(page, 1).getByText('Inverter vertical').click();
    await expect(outputGroup(page, 1).getByLabel('Espelhar')).toBeChecked();
    await expect(outputGroup(page, 1).getByLabel('Inverter vertical')).toBeChecked();
  } finally {
    await closeApp(app);
  }

  // Reiniciar: tudo volta igual.
  ({ app, page } = await open(dir));
  try {
    // O roteiro não foi salvo: a abertura oferece recuperar o texto.
    const recovery = page.getByRole('dialog').filter({ hasText: 'recuperar o texto' });
    await expect(recovery).toBeVisible();
    await recovery.getByRole('button', { name: 'Descartar' }).click();
    await expect(recovery).toBeHidden();
    await expect(page.getByTestId('speed')).toHaveText('1,50x');
    const out = await outputPage(app, 1);
    await page.getByRole('tab', { name: 'Saídas' }).click();
    await expect(outputGroup(page, 1).getByLabel('Espelhar')).toBeChecked();
    await expect(outputGroup(page, 1).getByLabel('Inverter vertical')).toBeChecked();
    await page.getByRole('tab', { name: 'Voz' }).click();
    await expect(page.getByLabel('Pulos para a frente')).toBeChecked();

    // "Voltar ao padrão" e confirmar no diálogo.
    await page.getByRole('tab', { name: 'Sobre' }).click();
    await page.getByRole('button', { name: 'Voltar ao padrão' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // O diálogo é escuro, como toda a tela.
    const dialogBg = await dialog.evaluate((el) => {
      let node: HTMLElement | null = el as HTMLElement;
      while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        node = node.parentElement;
      }
      return '';
    });
    const [r, g, b] = (dialogBg.match(/\d+/g) ?? ['255', '255', '255']).map(Number);
    expect(r + g + b).toBeLessThan(200);
    await dialog.getByRole('button', { name: 'Voltar ao padrão' }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByTestId('speed')).toHaveText('1,00x');
    await page.getByRole('tab', { name: 'Voz' }).click();
    await expect(page.getByLabel('Perto')).toBeChecked();
    await page.getByRole('tab', { name: 'Saídas' }).click();
    await expect(outputGroup(page, 1).getByLabel('Espelhar')).not.toBeChecked();
    await expect(outputGroup(page, 1).getByLabel('Inverter vertical')).not.toBeChecked();
    // A saída aberta desenha sem inversão na hora.
    await expect.poll(() => probe<string | null>(out, 'transform')).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  } finally {
    await closeApp(app);
  }
});

test('E2E-012 aviso de versão nova só na tela de controle, nunca nas saídas', async () => {
  let server: Server | null = null;
  const dir = freshDir();
  try {
    server = createServer((req, res) => {
      if (req.url === '/releases/latest') {
        const base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            tag_name: 'v9.9.9',
            assets: ['win-x64.exe', 'mac-x64.dmg', 'mac-arm64.dmg'].map((s) => ({
              name: `Teleprompter-9.9.9-${s}`,
              browser_download_url: `${base}/download/Teleprompter-9.9.9-${s}`,
            })),
          }),
        );
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()));
    const env = { TP_UPDATE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/releases/latest` };

    let { app, page } = await open(dir, env);
    try {
      const notice = page.getByRole('status', { name: 'Versão nova' });
      await expect(notice).toBeVisible({ timeout: 15_000 });
      await expect(notice).toContainText('9.9.9');
      await expect(notice.getByRole('button', { name: 'Baixar e instalar' })).toBeVisible();

      // As saídas não mostram aviso nem versão: só o roteiro.
      await confirmText(page);
      await page.getByRole('tab', { name: 'Saídas' }).click();
      await page.getByRole('group', { name: 'B' }).getByRole('button', { name: 'Abrir saída' }).click();
      const out = await outputPage(app, 1);
      await expect.poll(() => probe<string>(out, 'outputText')).toContain('Linha 1 do roteiro de teste.');
      const outText = await probe<string>(out, 'outputText');
      expect(outText).not.toContain('9.9.9');
      expect(outText).not.toContain('Versão nova');
      expect(outText).not.toMatch(/v\d+\.\d+\.\d+/);
      for (const line of outText.split('\n').map((l) => l.trim()).filter(Boolean)) {
        expect(TEXT.toUpperCase()).toContain(line.toUpperCase());
      }

      // "Fechar" esconde o aviso.
      await notice.getByRole('button', { name: 'Fechar' }).click();
      await expect(notice).toBeHidden();
    } finally {
      await closeApp(app);
    }

    // Reiniciar: o aviso volta.
    ({ app, page } = await open(dir, env));
    try {
      await expect(page.getByRole('status', { name: 'Versão nova' })).toBeVisible({ timeout: 15_000 });
    } finally {
      await closeApp(app);
    }
  } finally {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  }
});
