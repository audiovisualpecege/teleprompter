/**
 * Preparar o roteiro (E2E-001, E2E-002, E2E-003, E2E-017) e a fonte ausente no renderer
 * real (IT-025). Cada teste usa a sua pasta de usuário (`TP_USER_DATA`), e os seletores de
 * arquivo do sistema são trocados por respostas prontas dentro do processo principal.
 */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { launchApp, ROOT } from './app';

const FIXTURES = join(ROOT, 'tests', 'fixtures');
const version = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }).version;

const freshDir = (): string => mkdtempSync(join(tmpdir(), 'tp-e2e-'));

async function open(userData: string, args: string[] = []): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await launchApp({ TP_USER_DATA: userData }, args);
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.tp-version')).toHaveText(`v${version}`);
  return { app, page };
}

/** O próximo seletor de arquivo (abrir ou importar) devolve este caminho. */
async function nextOpen(app: ElectronApplication, path: string): Promise<void> {
  await app.evaluate(({ dialog }, p) => {
    (dialog as unknown as { showOpenDialog: unknown }).showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
  }, path);
}

async function nextSave(app: ElectronApplication, path: string): Promise<void> {
  await app.evaluate(({ dialog }, p) => {
    (dialog as unknown as { showSaveDialog: unknown }).showSaveDialog = async () => ({ canceled: false, filePath: p });
  }, path);
}

const probe = <T>(page: Page, name: string): Promise<T> => page.evaluate((n) => window.__tpProbe?.(n), name) as Promise<T>;
const editor = (page: Page) => page.getByLabel('Texto do roteiro');
const dialog = (page: Page) => page.getByRole('dialog');
const toolbar = (page: Page, name: string) => page.getByRole('navigation', { name: 'Arquivo' }).getByRole('button', { name, exact: true });

const PARAGRAPHS = 'Bom dia a todos.\n\nHoje vamos falar sobre o novo estúdio.\n\nObrigado por assistir.';

test('E2E-001 primeira abertura, colar, aparência, salvar e reabrir', async () => {
  const userData = freshDir();
  const saved = join(freshDir(), 'aula.roteiro');
  let { app, page } = await open(userData);
  try {
    // 1. Fundo Noite, os três passos e a versão.
    expect(await probe(page, 'background')).toBe('rgb(7, 0, 16)');
    const steps = page.getByRole('note', { name: 'Primeiros passos' });
    await expect(steps).toContainText('Cole ou importe o texto');
    await expect(steps).toContainText('Abra uma saída');
    await expect(steps).toContainText('Ligue a voz, se quiser');
    await expect(page.getByRole('button', { name: 'Iniciar' })).toBeDisabled();

    // 2. Colar 3 parágrafos e confirmar: a primeira linha na faixa da prévia.
    await editor(page).fill(PARAGRAPHS);
    await page.getByRole('button', { name: 'Confirmar alterações' }).click();
    await expect.poll(() => probe<string[]>(page, 'lines')).toEqual(['Bom dia a todos.', 'Hoje vamos falar sobre o novo estúdio.', 'Obrigado por assistir.']);
    await expect(steps).toHaveCount(0);
    expect(await probe(page, 'position')).toBe(0);
    const firstLine = page.locator('.tp-preview .tp-stage-line[data-line="0"]');
    const band = await page.locator('.tp-preview .tp-stage-band').boundingBox();
    const line = await firstLine.boundingBox();
    expect(Math.abs(line!.y - band!.y)).toBeLessThan(2);

    // 3. Aparência: cada mudança aparece na prévia.
    const fontOptions = await page.getByLabel('Fonte').locator('option').allTextContents();
    expect(fontOptions.length).toBeGreaterThan(1);
    const known = ['Arial', 'Segoe UI', 'Helvetica', 'Verdana', 'Georgia'];
    const otherFont = known.find((f) => fontOptions.includes(f)) ?? fontOptions.find((f) => f !== 'Archivo')!;
    await page.getByLabel('Fonte').selectOption(otherFont);
    await expect.poll(async () => (await probe<{ fontFamily: string }>(page, 'appearance')).fontFamily).toBe(otherFont);
    // A fonte instalada é a desenhada de fato, sem o aviso de fonte ausente.
    await expect.poll(() => probe<string>(page, 'fontFamily').then((f) => f.replace(/'/g, '"'))).toMatch(new RegExp(`^"?${otherFont}"?,`));
    await expect(page.getByText(/não está instalada/)).toHaveCount(0);

    const setField = async (label: string, value: string): Promise<void> => {
      await page.getByLabel(label, { exact: true }).fill(value);
      await page.getByLabel(label, { exact: true }).press('Enter');
    };
    await setField('Tamanho', '100');
    await setField('Cor do texto', '#FFCC00');
    await setField('Cor do fundo', '#101010');
    await page.getByText('Caixa alta', { exact: true }).click();
    await page.getByText('À esquerda', { exact: true }).click();
    await setField('Margens (%)', '20');

    const lines = page.locator('.tp-preview .tp-stage-lines');
    await expect.poll(() => probe<string[]>(page, 'lines').then((l) => l[0])).toBe('BOM DIA A TODOS.');
    await expect(lines).toHaveCSS('font-size', '100px');
    await expect(lines).toHaveCSS('color', 'rgb(255, 204, 0)');
    await expect(page.locator('.tp-preview .tp-stage')).toHaveCSS('background-color', 'rgb(16, 16, 16)');
    await expect(firstLine).toHaveCSS('text-align', 'left');
    await expect(page.locator('.tp-preview [data-guide="left"]')).toHaveAttribute('style', /left: 20%/);
    const appearance = await probe<Record<string, unknown>>(page, 'appearance');
    expect(appearance).toMatchObject({ fontSize: 100, textColor: '#FFCC00', backgroundColor: '#101010', letterCase: 'upper', align: 'left', marginPct: 20 });

    // 4. Salvar como, fechar, reabrir e abrir o mesmo arquivo.
    await nextSave(app, saved);
    await toolbar(page, 'Salvar como').click();
    await expect(page.getByTestId('file-name')).toHaveText('aula.roteiro');
    expect(existsSync(saved)).toBe(true);
    await app.close();

    ({ app, page } = await open(userData));
    await nextOpen(app, saved);
    await toolbar(page, 'Abrir').click();
    await expect(editor(page)).toHaveValue(PARAGRAPHS);
    await expect(page.getByTestId('file-name')).toHaveText('aula.roteiro');
    await expect.poll(() => probe<Record<string, unknown>>(page, 'appearance')).toMatchObject({ ...appearance });
    await expect.poll(() => probe<string[]>(page, 'lines').then((l) => l[0])).toBe('BOM DIA A TODOS.');
  } finally {
    await app.close();
  }
});

test('E2E-002 importar .txt em Latin-1 e .docx com tabela e imagem', async () => {
  const { app, page } = await open(freshDir());
  try {
    await nextOpen(app, join(FIXTURES, 'latin1.txt'));
    await toolbar(page, 'Importar').click();
    await expect(editor(page)).toHaveValue('Ação\nCoração não é ação');

    await nextOpen(app, join(FIXTURES, 'com-tabela-e-imagem.docx'));
    await toolbar(page, 'Importar').click();
    // O texto anterior não foi salvo: a pergunta aparece antes de trocar.
    await dialog(page).getByRole('button', { name: 'Não salvar' }).click();
    await expect(page.getByText(/Tabelas, imagens e caixas de texto foram ignoradas/)).toBeVisible();
    // Só os parágrafos do corpo; a tabela, a imagem e a caixa de texto ficam de fora.
    await expect(editor(page)).toHaveValue('Texto antes da tabela.\n\nTexto depois.');

    await page.getByRole('button', { name: 'Confirmar alterações' }).click();
    await expect.poll(() => probe<string[]>(page, 'lines')).toEqual(['Texto antes da tabela.', 'Texto depois.']);
  } finally {
    await app.close();
  }
});

test('E2E-003 diálogo escuro de alterações não salvas em "Novo" e em "Importar"', async () => {
  const { app, page } = await open(freshDir());
  try {
    await editor(page).fill('Texto que ainda não foi salvo.');
    await expect(page.getByTestId('file-name')).toHaveText(/\(não salvo\)$/);
    await toolbar(page, 'Novo').click();
    const d = dialog(page);
    await expect(d).toBeVisible();
    await expect(d.getByRole('button', { name: 'Salvar', exact: true })).toBeVisible();
    await expect(d.getByRole('button', { name: 'Não salvar' })).toBeVisible();
    await expect(d.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    // Escuro: o fundo do diálogo é a superfície de cartão do tema Noite.
    await expect(d).toHaveCSS('background-color', 'rgb(20, 10, 38)');
    await d.getByRole('button', { name: 'Cancelar' }).click();
    await expect(d).toHaveCount(0);
    await expect(editor(page)).toHaveValue('Texto que ainda não foi salvo.');

    await toolbar(page, 'Importar').click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: 'Não salvar' })).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Cancelar' }).click();
    await expect(editor(page)).toHaveValue('Texto que ainda não foi salvo.');
  } finally {
    await app.close();
  }
});

test('E2E-017 abrir o programa com um .roteiro como argumento', async () => {
  const dir = freshDir();
  const file = join(dir, 'aula.roteiro');
  writeFileSync(
    file,
    JSON.stringify({ formato: 'teleprompter-roteiro', versao: 1, texto: 'Roteiro aberto pelo sistema.\n\nSegunda parte.', aparencia: { fontSize: 90 } }),
  );
  const { app, page } = await open(freshDir(), [file]);
  try {
    await expect(editor(page)).toHaveValue('Roteiro aberto pelo sistema.\n\nSegunda parte.');
    await expect(page.getByTestId('file-name')).toHaveText('aula.roteiro');
    // Carregado e confirmado: a prévia mostra o texto e Iniciar está liberado.
    await expect.poll(() => probe<string[]>(page, 'lines')).toEqual(['Roteiro aberto pelo sistema.', 'Segunda parte.']);
    await expect(page.getByRole('button', { name: 'Iniciar' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Confirmar alterações' })).toBeDisabled();
  } finally {
    await app.close();
  }
});

test('IT-025 roteiro com fonte ausente é diagramado em Archivo, com aviso', async () => {
  const { app, page } = await open(freshDir());
  try {
    await nextOpen(app, join(FIXTURES, 'fonte-ausente.roteiro'));
    await toolbar(page, 'Abrir').click();
    await expect(page.getByText(/A fonte Fonte Inexistente não está instalada neste computador/)).toBeVisible();
    await expect.poll(() => probe<string[]>(page, 'lines').then((l) => l.length)).toBeGreaterThan(0);
    expect(await probe<string>(page, 'fontFamily')).toMatch(/^"?Archivo/);
    // A medida bate com a Archivo: a primeira linha cabe na largura útil do palco.
    const width = await page.evaluate(async () => {
      await document.fonts.load('400 96px "Archivo"');
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = '400 96px "Archivo"';
      const lines = window.__tpProbe?.('lines') as string[];
      return Math.max(...lines.map((l) => ctx.measureText(l).width));
    });
    expect(width).toBeLessThanOrEqual(1920 * (1 - 2 * 0.15));
  } finally {
    await app.close();
  }
});
