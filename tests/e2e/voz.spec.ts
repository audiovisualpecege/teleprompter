/**
 * Gravar sozinho com voz (E2E-008, E2E-009, E2E-015, E2E-020): o programa real, com o
 * Vosk real e o microfone falso do Chromium tocando uma fixture
 * (`--use-file-for-fake-audio-capture`, que repete o arquivo em laço), e os monitores
 * virtuais A (controle), B e C. Usa a gravação real da equipe quando ela existe.
 */
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { closeApp, controlPage, FAKE_DISPLAYS, launchApp, outputPage, pressKey, probe, ROOT } from './app';

const VOZ = join(ROOT, 'tests', 'fixtures', 'voz');
const ROTEIRO = readFileSync(join(VOZ, 'roteiro.txt'), 'utf8');
const MODEL = join(ROOT, 'resources', 'models', 'vosk-model-small-pt-0.3.tar.gz');

function fixture(name: string): { wav: string; marks: { duracaoMs: number; marcas: { token: number | null; inicioMs?: number; fimMs: number }[] } } {
  const base = existsSync(join(VOZ, `${name}.wav`)) ? join(VOZ, name) : join(VOZ, 'sintetica', name);
  return { wav: `${base}.wav`, marks: JSON.parse(readFileSync(`${base}.json`, 'utf8')) };
}

interface Sample {
  y: number;
  t: number;
}

async function open(wav: string): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await launchApp({ TP_USER_DATA: mkdtempSync(join(tmpdir(), 'tp-e2e-voz-')), TP_FAKE_DISPLAYS: FAKE_DISPLAYS }, [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${wav}`,
  ]);
  const page = await controlPage(app);
  await expect(page.locator('.tp-version')).toBeVisible();
  await page.getByLabel('Texto do roteiro').fill(ROTEIRO);
  await page.getByRole('button', { name: 'Confirmar alterações' }).click();
  await expect.poll(() => probe<string[]>(page, 'lines').then((l) => l.length)).toBeGreaterThan(3);
  return { app, page };
}

async function openOutput(app: ElectronApplication, page: Page, display: string, id: number): Promise<Page> {
  await page.getByRole('tab', { name: 'Saídas' }).click();
  await page.getByRole('group', { name: display }).getByRole('button', { name: 'Abrir saída' }).click();
  const out = await outputPage(app, id);
  await expect.poll(() => probe<string[]>(out, 'lines').then((l) => l.length)).toBeGreaterThan(3);
  return out;
}

const voiceState = (page: Page) => page.getByRole('status', { name: 'Estado da voz' });
const lineYs = (page: Page) => probe<number[]>(page, 'lineYs');
const y = async (p: Page): Promise<number> => (await probe<Sample>(p, 'sample')).y;

/** Liga a voz pela tecla V e espera "Ouvindo". */
async function voiceOn(page: Page): Promise<void> {
  await pressKey(page, 'control', 'v');
  await expect(voiceState(page)).toHaveText(/Preparando|Ouvindo/, { timeout: 5_000 });
  await expect(voiceState(page)).toHaveText('Ouvindo', { timeout: 60_000 });
}

/** Milissegundos de áudio já tocados desde que a captura começou a ouvir. */
async function audioMs(page: Page): Promise<number> {
  const readyAt = await probe<number | null>(page, 'voiceReadyAt');
  return readyAt === null ? 0 : Date.now() - readyAt;
}

async function waitAudio(page: Page, ms: number): Promise<void> {
  await expect.poll(() => audioMs(page), { timeout: ms + 60_000, intervals: [250] }).toBeGreaterThanOrEqual(ms);
}

test.beforeAll(() => {
  expect(existsSync(MODEL), 'baixe o modelo com node scripts/baixar-modelos.mjs vosk').toBe(true);
});

test('E2E-008: gravar sozinho com voz e improviso', async () => {
  test.setTimeout(240_000);
  const { wav, marks } = fixture('leitura-com-improviso');
  const m = marks.marcas;
  const first = m.findIndex((x) => x.token === null);
  let end = first;
  while (end < m.length && m[end].token === null) end++;
  const improvStart = m[first].inicioMs ?? m[first - 1].fimMs;
  const resumeAt = m[end].inicioMs ?? m[end - 1].fimMs;
  const { app, page } = await open(wav);
  try {
    const out1 = await openOutput(app, page, 'B', 1);
    const out2 = await openOutput(app, page, 'C', 2);

    // 1. V: "Preparando" e depois "Ouvindo"; as saídas mostram o círculo verde.
    await voiceOn(page);
    await expect.poll(() => probe(out1, 'signal'), { timeout: 5_000 }).toBe('circle');
    await expect.poll(() => probe(out2, 'signal'), { timeout: 5_000 }).toBe('circle');

    // 2. O texto avança com a leitura, nas saídas.
    await expect.poll(() => y(out1), { timeout: 20_000 }).toBeGreaterThan(0);

    // 3. Durante o improviso: "Esperando", e o sinal vira as barras sem piscar.
    await waitAudio(page, improvStart + 6_000);
    await expect(voiceState(page)).toHaveText('Esperando');
    const atImprov = await y(out1);
    const shapes: unknown[] = [];
    for (let i = 0; i < 12; i++) {
      shapes.push(await probe(out1, 'signal'));
      await page.waitForTimeout(200);
    }
    expect(new Set(shapes)).toEqual(new Set(['bars']));
    expect(await y(out1)).toBe(atImprov);

    // A leitura retomada volta a "Ouvindo" e o texto volta a andar.
    await waitAudio(page, resumeAt);
    await expect(voiceState(page)).toHaveText('Ouvindo', { timeout: 10_000 });
    await expect.poll(() => y(out1), { timeout: 15_000 }).toBeGreaterThan(atImprov);

    // 4. Um PageDown durante a leitura move uma linha, e a voz continua dali.
    const ys = await lineYs(page);
    await page.waitForTimeout(500);
    const before = await y(page);
    const idx = ys.findIndex((v) => v > before + 0.5);
    expect(idx).toBeGreaterThan(0);
    await pressKey(page, 'control', 'PageDown');
    await expect.poll(() => y(out1), { timeout: 3_000 }).toBeGreaterThanOrEqual(ys[idx] - 0.5);
    await expect(voiceState(page)).not.toHaveText('Desligada');
    await expect.poll(() => y(out1), { timeout: 20_000 }).toBeGreaterThan(ys[idx] + 0.5);

    // 5. O microfone escolhido e o medidor de nível aparecem na tela de voz.
    await page.getByRole('tab', { name: 'Voz' }).click();
    const select = page.getByLabel('Entrada de áudio');
    await expect(select).toBeVisible();
    const mics = await probe<{ label: string }[]>(page, 'mics');
    expect(mics.length).toBeGreaterThan(0);
    await expect(select.locator('option')).toContainText([mics[0].label]);
    await expect.poll(async () => Number(await page.getByRole('meter', { name: 'Nível do microfone' }).getAttribute('aria-valuenow')), { timeout: 10_000 }).toBeGreaterThan(0);
  } finally {
    await closeApp(app);
  }
});

test('E2E-009: alerta forte com o microfone desconectado', async () => {
  test.setTimeout(180_000);
  const { wav } = fixture('leitura-continua');
  const { app, page } = await open(wav);
  try {
    const out = await openOutput(app, page, 'B', 1);
    await voiceOn(page);
    await expect.poll(() => y(out), { timeout: 20_000 }).toBeGreaterThan(0);

    await page.evaluate(() => window.__tpTest?.stopMicTrack());
    // 1. A faixa vermelha com o motivo.
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Falhou: O microfone foi desconectado');
    expect(await alert.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(210, 66, 90)');
    await expect(voiceState(page)).toHaveText('Falhou');
    // 2. As saídas continuam com o texto visível e parado, e o sinal vira triângulo.
    await expect.poll(() => probe(out, 'signal'), { timeout: 3_000 }).toBe('triangle');
    const lines = await probe<string[]>(out, 'lines');
    expect(lines.length).toBeGreaterThan(3);
    expect(await probe<string>(out, 'bandText')).not.toBe('');
    const still = await y(out);
    await page.waitForTimeout(1500);
    expect(await y(out)).toBe(still);
    // 3. O microfone volta: "Ouvindo" e a faixa some.
    await page.evaluate(() => window.__tpTest?.restoreMic());
    await expect(voiceState(page)).toHaveText('Ouvindo', { timeout: 20_000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect.poll(() => probe(out, 'signal'), { timeout: 5_000 }).toBe('circle');
  } finally {
    await closeApp(app);
  }
});

test('E2E-015: voltar ao início com a voz ligada', async () => {
  test.setTimeout(240_000);
  const { wav, marks } = fixture('leitura-continua');
  const { app, page } = await open(wav);
  try {
    const out = await openOutput(app, page, 'B', 1);
    await voiceOn(page);
    const ys = await lineYs(page);
    // No meio do texto, pouco antes de o áudio recomeçar (o arquivo toca em laço).
    await waitAudio(page, marks.duracaoMs - 2_500);
    expect(await y(out)).toBeGreaterThan(ys[2]);
    await pressKey(page, 'control', 'Home');
    // A primeira linha vai à faixa e a voz continua ligada.
    await expect.poll(() => y(out), { timeout: 3_000 }).toBe(0);
    await expect(voiceState(page)).toHaveText(/Ouvindo|Esperando/);
    // A leitura recomeça do início e a voz acompanha dali.
    await expect.poll(() => y(out), { timeout: 30_000 }).toBeGreaterThan(ys[1] - 0.5);
    await expect(voiceState(page)).toHaveText('Ouvindo');
    expect(await y(out)).toBeLessThan(ys[Math.min(ys.length - 1, 6)]);
  } finally {
    await closeApp(app);
  }
});

test('E2E-020: voz com a janela de controle minimizada', async () => {
  test.setTimeout(180_000);
  const { wav } = fixture('leitura-continua');
  const { app, page } = await open(wav);
  try {
    const out = await openOutput(app, page, 'B', 1);
    await voiceOn(page);
    await waitAudio(page, 3_000);
    const before = await y(out);
    const ys = await lineYs(page);
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('/control/'))
        ?.minimize();
    });
    await page.waitForTimeout(10_000);
    // O texto continuou acompanhando a leitura nas saídas.
    const after = await y(out);
    const lineHeight = ys[1] - ys[0];
    expect(after - before).toBeGreaterThan(2 * lineHeight);
    // A voz ficou em "Ouvindo".
    await expect(voiceState(page)).toHaveText('Ouvindo');
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('/control/'))
        ?.restore();
    });
    await expect(voiceState(page)).toHaveText('Ouvindo');
  } finally {
    await closeApp(app);
  }
});
