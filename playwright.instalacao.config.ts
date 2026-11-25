import { defineConfig } from '@playwright/test';

// Testes de instalação (E2E-013 e E2E-014): rodam só no CI, sobre os instaladores gerados
// pelo workflow de Release, nunca no computador de quem desenvolve.
export default defineConfig({
  testDir: 'tests/instalacao',
  timeout: 300_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
});
