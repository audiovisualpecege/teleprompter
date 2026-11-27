/**
 * Montar o estúdio e gravar com operador (E2E-004, E2E-005, E2E-006, E2E-007, E2E-010,
 * E2E-016, E2E-018, E2E-019), com os monitores virtuais A (controle), B e C de
 * `TP_FAKE_DISPLAYS`. Cada teste usa a sua própria pasta de usuário.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { closeApp, controlPage, FAKE_DISPLAYS, launchApp, outputCount, outputPage, pressKey, probe } from './app';

const freshDir = (): string => mkdtempSync(join(tmpdir(), 'tp-e2e-'));
const LONG_TEXT = Array.from({ length: 120 }, (_, i) => `Linha ${i + 1} do roteiro de teste.`).join('\n');

interface Sample {
  y: number;
  t: number;
}

async function open(userData: string): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await launchApp({ TP_USER_DATA: userData, TP_FAKE_DISPLAYS: FAKE_DISPLAYS });
  const page = await controlPage(app);
  await expect(page.locator('.tp-version')).toBeVisible();
  return { app, page };
}

async function confirmText(page: Page, text = LONG_TEXT): Promise<void> {
  await page.getByLabel('Texto do roteiro').fill(text);
  await page.getByRole('button', { name: 'Confirmar alterações' }).click();
  await expect.poll(() => probe<string[]>(page, 'lines').then((l) => l.length)).toBeGreaterThan(0);
}

async function openOutput(app: ElectronApplication, page: Page, display: string, id: number): Promise<Page> {
  await page.getByRole('tab', { name: 'Saídas' }).click();
  await page.getByRole('group', { name: display }).getByRole('button', { name: 'Abrir saída' }).click();
  const out = await outputPage(app, id);
  const expected = (await probe<string[]>(page, 'lines')).length;
  await expect.poll(() => probe<string[]>(out, 'lines').then((l) => l.length)).toBe(expected);
  return out;
}

const outputGroup = (page: Page, id: number) => page.getByRole('group', { name: `Saída ${id}` });

/**
 * Posição desenhada de cada janela no mesmo instante: cada sonda devolve `{ y, t }` (t no
 * relógio comum), e as amostras são levadas ao instante mais novo pela velocidade medida.
 */
async function syncedPositions(pages: Page[]): Promise<number[]> {
  const a = await Promise.all(pages.map((p) => probe<Sample>(p, 'sample')));
  await new Promise((r) => setTimeout(r, 120));
  const b = await Promise.all(pages.map((p) => probe<Sample>(p, 'sample')));
  const v = b[0].t !== a[0].t ? (b[0].y - a[0].y) / (b[0].t - a[0].t) : 0;
  const T = Math.max(...b.map((s) => s.t));
  return b.map((s) => s.y + v * (T - s.t));
}

async function expectInSync(pages: Page[], tolerance = 2): Promise<void> {
  const ys = await syncedPositions(pages);
  for (const y of ys) expect(Math.abs(y - ys[0])).toBeLessThan(tolerance);
}

/** Fecha a janela de controle como o X faria. */
async function closeControl(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().includes('/control/'))
      ?.close();
  });
}

async function controlWindowCall(app: ElectronApplication, fn: 'minimize' | 'restore' | 'resize'): Promise<void> {
  await app.evaluate(({ BrowserWindow }, op) => {
    const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes('/control/'));
    if (!w) return;
    if (op === 'minimize') w.minimize();
    else if (op === 'restore') w.restore();
    else w.setSize(800, 600);
  }, fn);
}

test('E2E-004 montar o estúdio com duas saídas e inversões', async () => {
  const userData = freshDir();
  let { app, page } = await open(userData);
  try {
    await confirmText(page);
    // 1. Cada saída mostra o seu número por cerca de 4 s.
    const one = await openOutput(app, page, 'B', 1);
    const two = await openOutput(app, page, 'C', 2);
    await expect.poll(() => probe(one, 'badge')).toBe('1');
    await expect.poll(() => probe(two, 'badge')).toBe('2');
    await expect(outputGroup(page, 1)).toContainText('B, 1920 x 1080');
    await expect.poll(() => probe(one, 'badge'), { timeout: 8000 }).toBeNull();
    await expect.poll(() => probe(two, 'badge'), { timeout: 8000 }).toBeNull();

    // 2. Espelhar na 1 e Inverter vertical na 2.
    await outputGroup(page, 1).getByText('Espelhar').click();
    await outputGroup(page, 2).getByText('Inverter vertical').click();
    await expect.poll(() => probe(one, 'transform')).toBe('matrix(-1, 0, 0, 1, 0, 0)');
    await expect.poll(() => probe(two, 'transform')).toBe('matrix(1, 0, 0, -1, 0, 0)');

    // 3. Mesmas quebras de linha nas saídas e na prévia.
    const lines = await probe<string[]>(page, 'lines');
    expect(await probe<string[]>(one, 'lines')).toEqual(lines);
    expect(await probe<string[]>(two, 'lines')).toEqual(lines);

    // 4. Fechar a 2 e reabri-la.
    await outputGroup(page, 2).getByRole('button', { name: 'Fechar' }).click();
    await expect.poll(() => outputCount(app)).toBe(1);
    await openOutput(app, page, 'C', 2);
    await expect.poll(() => outputCount(app)).toBe(2);

    // Reiniciar: a 1 reabre espelhada e sem número.
    await closeApp(app);
    ({ app, page } = await open(userData));
    // O roteiro não foi salvo: a cópia de recuperação é oferecida e aqui é descartada.
    const recovery = page.getByRole('dialog');
    if (await recovery.isVisible().catch(() => false)) await recovery.getByRole('button', { name: 'Descartar' }).click();
    const again = await outputPage(app, 1);
    await expect.poll(() => probe(again, 'transform')).toBe('matrix(-1, 0, 0, 1, 0, 0)');
    for (let i = 0; i < 4; i++) {
      expect(await probe(again, 'badge')).toBeNull();
      await again.waitForTimeout(250);
    }
    await page.getByRole('tab', { name: 'Saídas' }).click();
    await expect(outputGroup(page, 1).getByLabel('Espelhar')).toBeChecked();
  } finally {
    await closeApp(app);
  }
});

test('E2E-005 gravar com operador: velocidade, roda, Descer e Home', async () => {
  const { app, page } = await open(freshDir());
  try {
    await confirmText(page);
    const b = await openOutput(app, page, 'B', 1);
    const c = await openOutput(app, page, 'C', 2);

    // 2. Iniciar e "+" duas vezes: 1,50x.
    await page.getByRole('button', { name: 'Iniciar' }).click();
    await page.getByRole('button', { name: 'Mais rápido' }).click();
    await page.getByRole('button', { name: 'Mais rápido' }).click();
    await expect(page.getByTestId('speed')).toHaveText('1,50x');

    // 3. Em 5 amostras, prévia, B e C a menos de 2 px lógicos.
    await page.waitForTimeout(500);
    for (let i = 0; i < 5; i++) {
      await expectInSync([page, b, c]);
      await page.waitForTimeout(300);
    }

    // 4. Com a automática ligada, a roda sobre a prévia muda a velocidade (dois cliques: 2,00x),
    //    e as três continuam juntas.
    await page.getByTestId('preview').hover();
    await page.mouse.wheel(0, 100);
    await page.mouse.wheel(0, 100);
    await expect(page.getByTestId('speed')).toHaveText('2,00x');
    await page.waitForTimeout(500);
    await expectInSync([page, b, c]);

    // 5. Pausar e "Descer" 3 cliques: 3 linhas.
    await page.getByRole('button', { name: 'Pausar' }).click();
    await page.waitForTimeout(300);
    const ys = await probe<number[]>(page, 'lineYs');
    const p0 = await probe<number>(page, 'position');
    const k = ys.findLastIndex((y) => y <= p0 + 0.5);
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Descer', exact: true }).click();
    await expect.poll(() => probe<number>(b, 'position')).toBeCloseTo(ys[k + 3], 1);
    await expect.poll(() => probe<number>(page, 'position')).toBeCloseTo(ys[k + 3], 1);
    await expect.poll(() => probe<number>(c, 'position')).toBeCloseTo(ys[k + 3], 1);

    // 6. Home: primeira linha na faixa e automática pausada.
    await page.getByRole('button', { name: 'Iniciar' }).click();
    await page.waitForTimeout(300);
    expect(await pressKey(page, 'control', 'Home')).toBe(true);
    await expect.poll(() => probe<number>(b, 'position')).toBe(0);
    await expect.poll(() => probe<number>(page, 'position')).toBe(0);
    await expect(page.getByRole('button', { name: 'Iniciar' })).toBeVisible();
  } finally {
    await closeApp(app);
  }
});

test('E2E-006 editor em foco durante a rolagem automática', async () => {
  const { app, page } = await open(freshDir());
  try {
    await confirmText(page);
    const out = await openOutput(app, page, 'B', 1);
    await page.getByRole('button', { name: 'Iniciar' }).click();
    await page.waitForTimeout(1500);

    // 1. Clicar no editor: o aviso aparece.
    const editor = page.getByLabel('Texto do roteiro');
    await editor.click();
    await page.keyboard.press('Control+Home');
    const notice = page.getByText('Atalhos inativos enquanto você edita. Esc para sair do editor');
    await expect(notice).toBeVisible();

    // 2. PageDown: o editor muda, as saídas não.
    const caret0 = await editor.evaluate((el) => (el as HTMLTextAreaElement).selectionStart);
    const s0 = await probe<Sample>(out, 'sample');
    expect(await pressKey(page, 'control', 'PageDown', { page })).toBe(false);
    await expect.poll(() => editor.evaluate((el) => (el as HTMLTextAreaElement).selectionStart)).toBeGreaterThan(caret0);
    await page.waitForTimeout(200);
    const s1 = await probe<Sample>(out, 'sample');
    const lineHeight = (await probe<number[]>(page, 'lineYs'))[1];
    // Só a rolagem automática andou (menos que meia linha nesse intervalo), sem o passo de uma linha.
    expect(s1.y - s0.y).toBeLessThan(lineHeight / 2);
    await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();

    // 3. Corrigir antes da faixa: as saídas continuam no texto antigo.
    await page.keyboard.press('Control+Home');
    await page.keyboard.type('Correção. ');
    await page.waitForTimeout(300);
    expect((await probe<string[]>(out, 'lines'))[0]).toBe('Linha 1 do roteiro de teste.');
    const band = await probe<string>(out, 'bandText');

    // 4. Confirmar: a mesma linha na faixa e a rolagem continua.
    await page.getByRole('button', { name: 'Confirmar alterações' }).click();
    await expect.poll(() => probe<string[]>(out, 'lines').then((l) => l[0])).toBe('Correção. Linha 1 do roteiro de teste.');
    const bandAfter = await probe<string>(out, 'bandText');
    const n = (s: string): number => Number(/Linha (\d+)/.exec(s)?.[1]);
    expect(Math.abs(n(bandAfter) - n(band))).toBeLessThanOrEqual(1);
    const a = await probe<number>(out, 'position');
    await page.waitForTimeout(400);
    expect(await probe<number>(out, 'position')).toBeGreaterThan(a);

    // 5. Esc: o aviso some e Espaço pausa.
    await editor.click();
    await expect(notice).toBeVisible();
    await pressKey(page, 'control', 'Escape', { page });
    await expect(notice).toBeHidden();
    expect(await pressKey(page, 'control', ' ', { page, pw: 'Space' })).toBe(true);
    await expect(page.getByRole('button', { name: 'Iniciar' })).toBeVisible();
  } finally {
    await closeApp(app);
  }
});

test('E2E-007 monitor desligado e religado', async () => {
  const { app, page } = await open(freshDir());
  try {
    await confirmText(page);
    await openOutput(app, page, 'B', 1);
    await openOutput(app, page, 'C', 2);
    await outputGroup(page, 2).getByText('Inverter vertical').click();
    await expect(outputGroup(page, 2).getByLabel('Inverter vertical')).toBeChecked();
    const C = { label: 'C', width: 1280, height: 1024 };

    // Remover C: a saída 2 fecha e o aviso aparece.
    await page.evaluate(() => window.__tpTest?.removeDisplay('C'));
    await expect.poll(() => outputCount(app)).toBe(1);
    await expect(page.getByText('Saída 2 caiu (C)')).toBeVisible();

    // Religar C: reabre sem número, com a inversão guardada.
    await page.evaluate((spec) => window.__tpTest?.addDisplay(spec), C);
    const back = await outputPage(app, 2);
    await expect.poll(() => probe(back, 'transform')).toBe('matrix(1, 0, 0, -1, 0, 0)');
    expect(await probe(back, 'badge')).toBeNull();
    await expect(page.getByText('Saída 2 caiu (C)')).toHaveCount(0);

    // Três vezes em 2 s: uma janela só.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.__tpTest?.removeDisplay('C'));
      await page.waitForTimeout(300);
      await page.evaluate((spec) => window.__tpTest?.addDisplay(spec), C);
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(2000);
    expect(await outputCount(app)).toBe(2);
    const outputs = (await page.evaluate(() => window.__tpTest?.outputs())) as { id: number; state: string }[];
    expect(outputs.map((o) => `${o.id}:${o.state}`)).toEqual(['1:open', '2:open']);

    // Ligar D: aparece livre e não abre saída.
    await page.evaluate(() => window.__tpTest?.addDisplay({ label: 'D', width: 1920, height: 1080 }));
    await expect(page.getByRole('region', { name: 'Monitores livres' })).toContainText('D, 1920 x 1080');
    await page.waitForTimeout(1500);
    expect(await outputCount(app)).toBe(2);
  } finally {
    await closeApp(app);
  }
});

test('E2E-010 trocar atalhos', async () => {
  const { app, page } = await open(freshDir());
  try {
    await confirmText(page);
    await page.getByRole('tab', { name: 'Atalhos' }).click();
    const record = () => page.getByRole('button', { name: 'Gravar atalho de Descer' }).click();
    const position = () => probe<number>(page, 'position');
    const ys = await probe<number[]>(page, 'lineYs');

    // 1. Gravar B para Descer: B desce uma linha.
    await record();
    await pressKey(page, 'control', 'b', { page });
    await expect(page.getByTestId('keys-down')).toHaveText('B');
    expect(await pressKey(page, 'control', 'b', { page })).toBe(true);
    await expect.poll(position).toBeCloseTo(ys[1], 1);

    // 2. Gravar Espaço para Descer: pergunta de conflito; Cancelar mantém tudo.
    await record();
    await pressKey(page, 'control', ' ', { page, pw: 'Space' });
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Espaço já é o atalho de "Iniciar ou pausar a rolagem automática"');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('keys-down')).toHaveText('B');
    await expect(page.getByTestId('keys-autoToggle')).toHaveText('Espaço');

    // 3. Alt+F4: mensagem de tecla reservada.
    await record();
    await pressKey(page, 'control', 'F4', { page, pw: 'Alt+F4', mods: { alt: true } });
    await expect(page.getByRole('alert')).toContainText('Alt+F4 é reservada pelo sistema e não pode ser usada');
    await expect(page.getByTestId('keys-down')).toHaveText('B');

    // 4. Voltar ao padrão: Page Down volta a descer.
    await page.getByRole('button', { name: 'Voltar ao padrão' }).click();
    await expect(page.getByTestId('keys-down')).toHaveText('Seta para baixo ou Page Down');
    expect(await pressKey(page, 'control', 'PageDown')).toBe(true);
    await expect.poll(position).toBeCloseTo(ys[2], 1);
  } finally {
    await closeApp(app);
  }
});

test('E2E-016 bloqueio de energia com e sem saída', async () => {
  const { app, page } = await open(freshDir());
  try {
    const blocker = () => probe<boolean>(page, 'powerBlocker');
    expect(await blocker()).toBe(false);
    await openOutput(app, page, 'B', 1);
    await expect.poll(blocker).toBe(true);
    await outputGroup(page, 1).getByRole('button', { name: 'Fechar' }).click();
    await expect.poll(blocker).toBe(false);
  } finally {
    await closeApp(app);
  }
});

test('E2E-018 fechar a tela de controle com alterações não salvas', async () => {
  const { app, page } = await open(freshDir());
  try {
    const proc = app.process();
    await confirmText(page, 'Texto que ainda não foi salvo.');
    await openOutput(app, page, 'B', 1);
    await closeControl(app);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Alterações não salvas');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(proc.exitCode).toBeNull();
    expect(await outputCount(app)).toBe(1);

    await closeControl(app);
    const exited = new Promise<void>((resolve) => proc.once('exit', () => resolve()));
    await page.getByRole('dialog').getByRole('button', { name: 'Não salvar' }).click();
    await exited;
    // O programa inteiro fechou, com a saída junto.
    expect(proc.exitCode).not.toBeNull();
  } finally {
    await closeApp(app);
  }
});

test('E2E-019 janela de controle redimensionada e minimizada', async () => {
  const { app, page } = await open(freshDir());
  try {
    await confirmText(page);
    const out = await openOutput(app, page, 'B', 1);
    await page.getByRole('button', { name: 'Iniciar' }).click();
    await page.waitForTimeout(500);
    await controlWindowCall(app, 'resize');
    await expectInSync([page, out]);

    await controlWindowCall(app, 'minimize');
    // Minimizada por 5 s: a saída continua rolando, sem salto.
    const samples: Sample[] = [];
    for (let i = 0; i < 10; i++) {
      samples.push(await probe<Sample>(out, 'sample'));
      await out.waitForTimeout(500);
    }
    const rates = samples.slice(1).map((s, i) => (s.y - samples[i].y) / Math.max(1, s.t - samples[i].t));
    for (const r of rates) expect(r).toBeGreaterThan(0);
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    for (const r of rates) expect(Math.abs(r - mean)).toBeLessThan(mean * 0.25);

    await controlWindowCall(app, 'restore');
    await page.waitForTimeout(500);
    await expectInSync([page, out]);
  } finally {
    await closeApp(app);
  }
});
