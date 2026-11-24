// Baixa os modelos de voz das fontes oficiais para resources/models/ (fora do git),
// confere cada arquivo pelo SHA-256 fixado abaixo e prepara o formato que cada motor lê:
//
// - Vosk pequeno em português (alphacephei.com): o .zip oficial é reempacotado em
//   .tar.gz, o formato que o vosk-browser carrega.
// - Parakeet v3 no formato do sherpa-onnx (releases do k2-fsa/sherpa-onnx): o .tar.bz2
//   é extraído numa pasta com encoder, decoder, joiner e tokens.
// - Silero VAD (mesma release do sherpa-onnx), usado pelo Parakeet para pular silêncio.
//
// Os arquivos baixados ficam guardados em .cache/modelos/ e não são baixados de novo
// enquanto o hash bater. Uso: node scripts/baixar-modelos.mjs
// Só roda no build: o programa nunca baixa nada durante o reconhecimento.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MODELS_DIR = join(root, 'resources', 'models');
const CACHE_DIR = join(root, '.cache', 'modelos');

/** Modelos, fontes oficiais e hashes conferidos em 2026-11-24. */
export const MODELS = [
  {
    id: 'vosk',
    url: 'https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip',
    file: 'vosk-model-small-pt-0.3.zip',
    sha256: '6e1ce909032e1afa7a88e68a3d628ecafff302bdf195befab308826c395e93b7',
    output: 'vosk-model-small-pt-0.3.tar.gz',
    prepare: 'zip-to-targz',
    folder: 'vosk-model-small-pt-0.3',
  },
  {
    id: 'parakeet',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2',
    file: 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2',
    sha256: '1495e91b59d7fc53ddca91f3431758ec99f8fa253fdb0e1e851be0f72b14b0f9',
    output: 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8',
    prepare: 'extract-tarbz2',
    folder: 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8',
  },
  {
    id: 'vad',
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx',
    file: 'silero_vad.onnx',
    sha256: '9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6',
    output: 'silero_vad.onnx',
    prepare: 'copy',
  },
];

export async function sha256Of(path) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`Não foi possível baixar ${url} (HTTP ${res.status}).`);
  const tmp = `${dest}.parcial`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  renameSync(tmp, dest);
}

/**
 * O tar do sistema: no Windows, o bsdtar do próprio Windows (lê .zip); no Mac, o bsdtar
 * padrão. O GNU tar de outros ambientes não abre .zip, por isso o .zip usa `unzip` no Linux.
 */
function tarBin() {
  if (process.platform === 'win32') {
    const sys = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
    if (existsSync(sys)) return sys;
  }
  return 'tar';
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`Falhou: ${cmd} ${args.join(' ')}`);
}

function unzip(archive, destDir) {
  if (process.platform === 'linux') run('unzip', ['-q', '-o', archive, '-d', destDir]);
  else run(tarBin(), ['-xf', archive, '-C', destDir]);
}

async function prepare(model, archive) {
  const out = join(MODELS_DIR, model.output);
  rmSync(out, { recursive: true, force: true });
  if (model.prepare === 'copy') {
    await pipeline(createReadStream(archive), createWriteStream(out));
    return;
  }
  const work = join(CACHE_DIR, `${model.id}-extraido`);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  if (model.prepare === 'zip-to-targz') {
    unzip(archive, work);
    if (!existsSync(join(work, model.folder))) throw new Error(`O arquivo ${model.file} não tem a pasta ${model.folder}.`);
    // O vosk-browser espera um .tar.gz com uma pasta no topo (ele a descarta ao extrair).
    run(tarBin(), ['-czf', out, '-C', work, model.folder]);
  } else if (model.prepare === 'extract-tarbz2') {
    run(tarBin(), ['-xjf', archive, '-C', work]);
    const folder = join(work, model.folder);
    if (!existsSync(folder)) throw new Error(`O arquivo ${model.file} não tem a pasta ${model.folder}.`);
    renameSync(folder, out);
    // Os áudios de exemplo do pacote não vão para o instalador.
    rmSync(join(out, 'test_wavs'), { recursive: true, force: true });
  }
  rmSync(work, { recursive: true, force: true });
}

async function ensure(model) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const archive = join(CACHE_DIR, model.file);
  if (existsSync(archive) && (await sha256Of(archive)) !== model.sha256) rmSync(archive);
  if (!existsSync(archive)) {
    console.log(`Baixando ${model.url}`);
    await download(model.url, archive);
  }
  const got = await sha256Of(archive);
  if (got !== model.sha256) {
    rmSync(archive, { force: true });
    throw new Error(
      `O SHA-256 de ${model.file} não bate.\n  esperado: ${model.sha256}\n  recebido: ${got}\n` +
        'O arquivo foi apagado. Confira a fonte oficial antes de trocar o hash no script.',
    );
  }
  console.log(`Conferido ${model.file} (SHA-256 ok)`);
  await prepare(model, archive);
  console.log(`Pronto: resources/models/${model.output}`);
}

async function main() {
  mkdirSync(MODELS_DIR, { recursive: true });
  const only = process.argv.slice(2);
  for (const model of MODELS) {
    if (only.length && !only.includes(model.id)) continue;
    await ensure(model);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(`\nFalha ao preparar os modelos de voz: ${e.message}`);
    process.exit(1);
  });
}
