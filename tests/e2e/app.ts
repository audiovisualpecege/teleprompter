import { _electron as electron, type ElectronApplication } from '@playwright/test';
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
