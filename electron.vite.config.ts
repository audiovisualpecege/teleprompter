import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

const root = __dirname;
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  name: string;
  productName: string;
  version: string;
};

/**
 * O build de teste abre direto de `out-test/`, sem o `package.json` da raiz. Este
 * plugin grava lá um `package.json` com a mesma versão (para `app.getVersion()`) e
 * outro nome, para que os testes usem uma pasta de usuário separada da do programa.
 */
const testPackageJson = (out: string): Plugin => ({
  name: 'tp-test-package-json',
  apply: 'build',
  writeBundle() {
    mkdirSync(resolve(root, out), { recursive: true });
    const testPkg = {
      name: `${pkg.name}-teste`,
      productName: `${pkg.productName} Teste`,
      version: pkg.version,
      main: 'main/index.js',
    };
    writeFileSync(resolve(root, out, 'package.json'), JSON.stringify(testPkg, null, 2));
  },
});

/**
 * Constantes injetadas no build. A versão vem só do `package.json`;
 * `__TP_TEST__` liga os ganchos de teste e é falso no build de produção,
 * o que deixa os ganchos fora do pacote por eliminação de código morto.
 */
export function buildDefines(mode: string): Record<string, string> {
  return {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __TP_TEST__: JSON.stringify(mode === 'test'),
  };
}

export const aliases = {
  '@chiaro': resolve(root, 'design-system/chiaro'),
  '@shared': resolve(root, 'src/shared'),
};

export default defineConfig(({ mode }) => {
  const define = buildDefines(mode);
  // O build de teste vai para outra pasta para nunca ser empacotado por engano.
  const out = mode === 'test' ? 'out-test' : 'out';
  return {
    main: {
      define,
      plugins: mode === 'test' ? [testPackageJson(out)] : [],
      resolve: { alias: aliases },
      build: {
        outDir: resolve(root, out, 'main'),
        rollupOptions: { input: { index: resolve(root, 'src/main/index.ts') } },
      },
    },
    preload: {
      define,
      resolve: { alias: aliases },
      build: {
        outDir: resolve(root, out, 'preload'),
        // Preload em sandbox não pode carregar outros arquivos: cada ponte sai num arquivo só.
        isolatedEntries: true,
        rollupOptions: {
          input: {
            control: resolve(root, 'src/preload/control.ts'),
            output: resolve(root, 'src/preload/output.ts'),
          },
          output: { format: 'cjs', entryFileNames: '[name].js' },
        },
      },
    },
    renderer: {
      root: resolve(root, 'src/renderer'),
      define,
      resolve: { alias: aliases },
      plugins: [react()],
      server: { fs: { allow: [root] } },
      build: {
        outDir: resolve(root, out, 'renderer'),
        // Fontes e imagens sempre como arquivo, nunca embutidas, e todas dentro do pacote.
        assetsInlineLimit: 0,
        rollupOptions: {
          input: {
            control: resolve(root, 'src/renderer/control/index.html'),
            output: resolve(root, 'src/renderer/output/index.html'),
          },
        },
      },
    },
  };
});
