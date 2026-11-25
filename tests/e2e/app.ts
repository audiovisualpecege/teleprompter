import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';
import { join } from 'node:path';

export const ROOT = join(__dirname, '..', '..');

/** Abre o programa do build de teste (`npm run build:test`) com uma pasta de usuário própria. */
export async function launchApp(env: Record<string, string> = {}, args: string[] = []): Promise<ElectronApplication> {
  return electron.launch({
    args: [join(ROOT, 'out-test'), ...args],
    cwd: ROOT,
    env: { ...process.env, ...env } as Record<string, string>,
  });
}

/** Monitores virtuais dos testes de estúdio: A (controle), B e C. */
export const FAKE_DISPLAYS = JSON.stringify([
  { label: 'A', width: 1920, height: 1080 },
  { label: 'B', width: 1920, height: 1080 },
  { label: 'C', width: 1280, height: 1024 },
]);

const isControl = (p: Page): boolean => /[\/]control[\/]index\.html/.test(p.url());
const isOutput = (p: Page): boolean => /[\/]output[\/]index\.html/.test(p.url());

/** A janela de controle (as saídas podem abrir antes dela). */
export async function controlPage(app: ElectronApplication): Promise<Page> {
  await expect.poll(() => app.windows().some(isControl), { timeout: 20_000 }).toBe(true);
  const page = app.windows().find(isControl)!;
  await page.waitForLoadState('domcontentloaded');
  return page;
}

export const probe = <T>(page: Page, name: string): Promise<T> =>
  page.evaluate((n) => window.__tpProbe?.(n), name) as Promise<T>;

/** As janelas de saída abertas, por número (`outputId` de cada uma). */
export async function outputPages(app: ElectronApplication): Promise<Map<number, Page>> {
  const map = new Map<number, Page>();
  for (const p of app.windows().filter(isOutput)) {
    if (p.isClosed()) continue;
    try {
      await p.waitForLoadState('domcontentloaded');
      const id = await probe<number | null>(p, 'outputId');
      if (typeof id === 'number') map.set(id, p);
    } catch {
      // Janela fechando no meio da leitura.
    }
  }
  return map;
}

/** Espera a saída `id` abrir e devolve a página dela. */
export async function outputPage(app: ElectronApplication, id: number): Promise<Page> {
  let found: Page | undefined;
  await expect
    .poll(async () => {
      found = (await outputPages(app)).get(id);
      return Boolean(found);
    }, { timeout: 20_000 })
    .toBe(true);
  return found!;
}

/** Quantas janelas de saída estão abertas agora. */
export async function outputCount(app: ElectronApplication): Promise<number> {
  return (await outputPages(app)).size;
}

/**
 * Fecha o programa no fim de um teste. Com alterações não salvas, sair pergunta antes
 * (US-019 EC-2) e a pergunta fica esperando: aí o teste encerra o processo à força.
 */
export async function closeApp(app: ElectronApplication): Promise<void> {
  let proc: ReturnType<ElectronApplication['process']> | undefined;
  try {
    proc = app.process();
  } catch {
    return;
  }
  if (!proc || proc.exitCode !== null) return;
  const closed = new Promise<void>((resolve) => proc.once('exit', () => resolve()));
  await app.evaluate(({ app: a }) => void a.quit()).catch(() => undefined);
  const done = await Promise.race([closed.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 5000))]);
  if (!done) {
    await app.evaluate(({ app: a }) => void setTimeout(() => a.exit(0), 0)).catch(() => undefined);
    await Promise.race([closed, new Promise((r) => setTimeout(r, 5000))]);
    if (proc.exitCode === null) proc.kill();
  }
}

export interface KeyMods {
  control?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

/**
 * Aperta uma tecla como o sistema faria: o principal recebe o `before-input-event` na
 * janela `target` ('control' ou o número da saída) e, se não virou atalho, a página recebe
 * a tecla (`page`). O Playwright sozinho entrega a tecla direto à página, sem esse evento.
 */
export async function pressKey(
  control: Page,
  target: 'control' | number,
  key: string,
  options: { mods?: KeyMods; page?: Page; pw?: string } = {},
): Promise<boolean> {
  const input = { key, ...options.mods };
  const emit = (type: string) =>
    control.evaluate(([t, i]) => window.__tpTest?.emitKey(t, i), [target, { ...input, type }] as const) as Promise<boolean>;
  const prevented = await emit('keyDown');
  if (!prevented && options.page) await options.page.keyboard.press(options.pw ?? key);
  await emit('keyUp');
  return prevented;
}
