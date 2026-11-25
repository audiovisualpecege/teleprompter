import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { aliases, buildDefines, chiaroOfflineIcon } from './electron.vite.config';

// Os testes enxergam as mesmas constantes do build de teste (versão e ganchos).
export default defineConfig({
  plugins: [chiaroOfflineIcon(), react()],
  define: buildDefines('test'),
  resolve: { alias: aliases },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
          exclude: ['tests/**/*.voice.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['tests/unit/**/*.test.tsx', 'tests/integration/**/*.test.tsx'],
          setupFiles: ['tests/setup-dom.ts'],
        },
      },
      {
        // Integração com os motores de voz reais e o modelo baixado (npm run test:voice).
        extends: true,
        test: {
          name: 'voice',
          environment: 'node',
          include: ['tests/**/*.voice.test.ts'],
          testTimeout: 120_000,
          // Um arquivo por vez: todos compilam o mesmo banco de medição em out-voice/ e
          // medem atraso em tempo real, que outro Electron rodando junto atrapalharia.
          fileParallelism: false,
        },
      },
    ],
  },
});
