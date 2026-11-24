/**
 * Monta e roda o banco de medição da voz: compila a página, o preload, o principal e o
 * `ParakeetHost` com o Vite em `out-voice/`, abre o Electron real e devolve o resultado
 * com as medidas de cobertura e atraso calculadas a partir das marcas da fixture.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { build, type InlineConfig } from 'vite';
import { voskWorkerCode } from '../../../electron.vite.config';
import type { HarnessConfig, HarnessResult } from './renderer';

export const ROOT = resolve(__dirname, '..', '..', '..');
export const OUT = join(ROOT, 'out-voice');
export const MODELS_DIR = join(ROOT, 'resources', 'models');
export const FIXTURES_DIR = join(ROOT, 'tests', 'fixtures', 'voz');

const alias = { '@shared': join(ROOT, 'src', 'shared') };

let built: Promise<void> | null = null;

function nodeBuild(entry: string, name: string): InlineConfig {
  return {
    configFile: false,
    logLevel: 'warn',
    resolve: { alias },
    build: {
      ssr: entry,
      outDir: OUT,
      emptyOutDir: false,
      minify: false,
      target: 'node22',
      rollupOptions: { external: ['electron', 'sherpa-onnx-node'], output: { format: 'cjs', entryFileNames: name } },
    },
  };
}

/** Compila tudo uma vez por execução de testes. */
export function buildHarness(): Promise<void> {
  built ??= (async () => {
    mkdirSync(OUT, { recursive: true });
    for (const f of ['renderer.js', 'vosk-worker.js', 'pcm-worklet.js', 'preload.js', 'main.js', 'parakeet-host.js']) rmSync(join(OUT, f), { force: true });
    const h = join(ROOT, 'tests', 'voice', 'harness');
    await build({
      configFile: false,
      logLevel: 'warn',
      resolve: { alias },
      build: {
        outDir: OUT,
        emptyOutDir: false,
        minify: false,
        lib: { entry: join(h, 'renderer.ts'), formats: ['iife'], name: 'harness', fileName: () => 'renderer.js' },
        rollupOptions: { output: { inlineDynamicImports: true } },
      },
    });
    // AudioWorklet da captura, como arquivo próprio.
    await build({
      configFile: false,
      logLevel: 'warn',
      build: {
        outDir: OUT,
        emptyOutDir: false,
        minify: false,
        lib: {
          entry: join(ROOT, 'src', 'renderer', 'control', 'audio', 'pcm-worklet.ts'),
          formats: ['iife'],
          name: 'pcmWorklet',
          fileName: () => 'pcm-worklet.js',
        },
      },
    });
    // Worker do Vosk como arquivo próprio, igual ao do programa.
    await build({
      configFile: false,
      logLevel: 'warn',
      plugins: [voskWorkerCode()],
      build: {
        outDir: OUT,
        emptyOutDir: false,
        minify: false,
        lib: {
          entry: join(ROOT, 'src', 'renderer', 'control', 'asr', 'vosk-worker.ts'),
          formats: ['iife'],
          name: 'voskWorker',
          fileName: () => 'vosk-worker.js',
        },
      },
    });
    await build(nodeBuild(join(h, 'preload.ts'), 'preload.js'));
    await build(nodeBuild(join(h, 'main.ts'), 'main.js'));
    await build(nodeBuild(join(ROOT, 'src', 'main', 'parakeet-host.ts'), 'parakeet-host.js'));
    // A página usa a mesma política de conteúdo da janela de controle, mais o esquema das fixtures.
    const control = readFileSync(join(ROOT, 'src', 'renderer', 'control', 'index.html'), 'utf8');
    const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(control)?.[1];
    if (!csp) throw new Error('A janela de controle não tem Content-Security-Policy');
    const harnessCsp = `${csp}; connect-src 'self' tp-fixture:`;
    writeFileSync(
      join(OUT, 'index.html'),
      `<!doctype html><html data-theme="noite"><head><meta charset="UTF-8" />` +
        `<meta http-equiv="Content-Security-Policy" content="${harnessCsp}" /></head>` +
        `<body><script src="./renderer.js"></script></body></html>`,
    );
  })();
  return built;
}

export interface Marks {
  origem: 'gravacao' | 'sintetica';
  roteiro: string;
  duracaoMs?: number;
  marcas: { token: number | null; inicioMs?: number; fimMs: number; palavra?: string }[];
  quem?: string;
  data?: string;
}

export interface Measured extends HarnessResult {
  network: string[];
  marks: Marks;
  /** Maior token alcançado sobre o último token do roteiro. */
  coverage: number;
  /** Atraso entre o fim de cada palavra lida e o momento em que o cursor chegou nela. */
  tokenLags: number[];
  /** Quantos tokens o cursor andou além do último lido durante cada trecho de improviso. */
  improvAdvance: number[];
  stderr: string;
}

export function readMarks(fixture: string): Marks {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, fixture.replace(/\.wav$/, '.json')), 'utf8')) as Marks;
}

export function fixtureExists(fixture: string): boolean {
  return existsSync(join(FIXTURES_DIR, fixture)) && existsSync(join(FIXTURES_DIR, fixture.replace(/\.wav$/, '.json')));
}

export function median(xs: readonly number[]): number {
  return percentileOf(xs, 50);
}

export function percentileOf(xs: readonly number[], p: number): number {
  if (!xs.length) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}

export async function runHarness(page: Omit<HarnessConfig, 'roteiro' | 'tailMs'> & { tailMs?: number }): Promise<Measured> {
  await buildHarness();
  const marks = readMarks(page.fixture);
  const electronPath = createRequire(join(ROOT, 'package.json'))('electron') as unknown as string;
  const cfg = {
    page: { tailMs: 3000, roteiro: marks.roteiro, ...page },
    modelsDir: MODELS_DIR,
    fixturesDir: FIXTURES_DIR,
    outDir: OUT,
    timeoutMs: (marks.duracaoMs ?? 120_000) + 90_000,
  };
  const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((res, rej) => {
    const env: NodeJS.ProcessEnv = { ...process.env, TP_HARNESS: JSON.stringify(cfg) };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(electronPath, [join(OUT, 'main.js')], { env, cwd: ROOT });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', rej);
    child.on('exit', () => {
      // A pasta de dados de cada execução é descartável.
      for (const d of readdirSync(OUT)) if (d.startsWith('user-data-')) rmSync(join(OUT, d), { recursive: true, force: true });
      res({ stdout: out, stderr: err });
    });
  });
  const line = stdout.split(/\r?\n/).find((l) => l.startsWith('RESULT:'));
  if (!line) throw new Error(`O banco de medição não respondeu.\n${stdout}\n${stderr}`);
  const r = JSON.parse(line.slice('RESULT:'.length)) as HarnessResult & { network: string[] };
  if (!r.ok) throw new Error(`O banco de medição falhou: ${r.error}\n${stderr}`);
  const last = r.tokens - 1;
  const reached = r.events.length ? r.events.at(-1)!.cursor : 0;
  const tokenLags: number[] = [];
  for (const m of marks.marcas) {
    if (m.token === null || m.token === 0) continue;
    const ev = r.events.find((e) => e.cursor >= m.token!);
    if (ev) tokenLags.push(ev.t - (r.t0 + m.fimMs));
  }
  const improvAdvance: number[] = [];
  const ms = marks.marcas;
  for (let i = 0; i < ms.length; i++) {
    if (ms[i].token !== null || i === 0 || ms[i - 1].token === null) continue;
    const lastRead = ms[i - 1].token!;
    let j = i;
    while (j < ms.length && ms[j].token === null) j++;
    const start = r.t0 + (ms[i].inicioMs ?? ms[i - 1].fimMs);
    const end = r.t0 + (j < ms.length ? (ms[j].inicioMs ?? ms[j - 1].fimMs) : ms[j - 1].fimMs);
    const during = r.events.filter((e) => e.t >= start && e.t <= end).map((e) => e.cursor);
    improvAdvance.push(Math.max(0, ...during.map((c) => c - lastRead)));
    i = j;
  }
  return { ...r, marks, coverage: reached / last, tokenLags, improvAdvance, stderr };
}
