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

/**
 * Código do Worker do Vosk (ADR-007). O `vosk-browser` traz o Worker embutido em base64 e
 * o abre como `blob:`, que herda a política de conteúdo da janela de controle; o
 * WebAssembly dele usa `new Function` (embind) e seria bloqueado. Este módulo virtual
 * extrai o mesmo código para virar um arquivo do programa (`vosk-worker.ts`), um Worker
 * com URL própria em que a janela não precisa liberar `unsafe-eval`.
 */
export const VOSK_WORKER_MODULE = 'virtual:vosk-worker';
export function voskWorkerCode(): Plugin {
  const resolved = `\0${VOSK_WORKER_MODULE}`;
  return {
    name: 'tp-vosk-worker',
    resolveId: (id) => (id === VOSK_WORKER_MODULE ? resolved : null),
    load(id) {
      if (id !== resolved) return null;
      const lib = readFileSync(resolve(root, 'node_modules/vosk-browser/dist/vosk.js'), 'utf8');
      const b64 = /createBase64WorkerFactory\('([A-Za-z0-9+/=]+)'/.exec(lib)?.[1];
      if (!b64) throw new Error('Não achei o Worker do vosk-browser');
      // Igual ao que o vosk-browser faz antes de criar o blob: descarta a primeira linha.
      const source = Buffer.from(b64, 'base64').toString('latin1');
      return source.substring(source.indexOf('\n', 10) + 1);
    },
  };
}

/**
 * O `Icon` do design system da Chiaro carrega os SVGs do Solar por CDN (jsDelivr), o que
 * não funciona sem internet e é barrado pela política de conteúdo das janelas. Sem editar
 * `design-system/chiaro/`, toda importação de `Icon.jsx` feita pelos componentes de lá vai
 * para `src/renderer/shared/ui/Icon.tsx`, que desenha os mesmos ícones do pacote
 * `@solar-icons/react`, instalado com o programa.
 */
const slashes = (p: string): string => p.split('\\').join('/').toLowerCase();
const CHIARO_COMPONENTS = slashes(resolve(root, 'design-system/chiaro/components'));
export const OFFLINE_ICON = resolve(root, 'src/renderer/shared/ui/Icon.tsx');
export function chiaroOfflineIcon(): Plugin {
  return {
    name: 'tp-chiaro-offline-icon',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !/(^|\/)Icon\.jsx$/.test(source)) return null;
      return slashes(importer).startsWith(CHIARO_COMPONENTS) ? OFFLINE_ICON : null;
    },
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
        rollupOptions: {
          input: {
            index: resolve(root, 'src/main/index.ts'),
            // Corpo do utilityProcess do Parakeet (ADR-007), aberto só quando ele está ativo.
            'parakeet-host': resolve(root, 'src/main/parakeet-host.ts'),
          },
        },
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
      plugins: [chiaroOfflineIcon(), react()],
      worker: { format: 'iife', plugins: () => [voskWorkerCode()] },
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
