import { defineConfig } from '@playwright/test';

// Ponta a ponta sobre o build de teste (out-test), com Playwright `_electron.launch`.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
});
