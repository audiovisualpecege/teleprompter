/**
 * Modelos de voz no computador (ADR-007): onde ficam, quais motores esta plataforma
 * consegue rodar e o protocolo `tp-model:` que entrega o modelo do Vosk ao Worker da
 * janela de controle sem passar pela rede.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import type { EngineId } from '@shared/types';

export const MODEL_SCHEME = 'tp-model';
export const VOSK_MODEL_FILE = 'vosk-model-small-pt-0.3.tar.gz';
export const PARAKEET_FILES = [
  'sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/encoder.int8.onnx',
  'sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/decoder.int8.onnx',
  'sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/joiner.int8.onnx',
  'sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/tokens.txt',
  'silero_vad.onnx',
];

/** Plataformas em que o `sherpa-onnx-node` tem binário pronto e o programa é distribuído. */
export const PARAKEET_PLATFORMS = ['win32-x64', 'darwin-x64', 'darwin-arm64'];

/**
 * Pasta dos modelos: `models` dentro dos recursos do pacote (extraResources) ou
 * `resources/models` na raiz do projeto (o build de teste roda de `out-test/`, um nível abaixo).
 */
export function modelsDir(opts: {
  isPackaged: boolean;
  resourcesPath: string;
  appPath: string;
  exists?: (p: string) => boolean;
}): string {
  if (opts.isPackaged) return join(opts.resourcesPath, 'models');
  const exists = opts.exists ?? existsSync;
  const own = join(opts.appPath, 'resources', 'models');
  const parent = join(opts.appPath, '..', 'resources', 'models');
  return !exists(own) && exists(parent) ? parent : own;
}

export interface EngineAvailability {
  engines: EngineId[];
  /** Por que o Parakeet não aparece nesta plataforma (para o aviso). */
  parakeetUnavailable: string | null;
}

/**
 * Motores que aparecem na lista. O Vosk é o padrão e sempre aparece; o Parakeet some,
 * com aviso, quando a plataforma não tem o binário ou o modelo não está instalado.
 */
export function availableEngines(opts: {
  dir: string;
  platform: string;
  arch: string;
  exists?: (p: string) => boolean;
  /** Acha um módulo instalado (padrão: `require.resolve`; no pacote, o Electron olha o `app.asar.unpacked`). */
  resolveModule?: (id: string) => string;
}): EngineAvailability {
  const exists = opts.exists ?? existsSync;
  const key = `${opts.platform}-${opts.arch}`;
  let reason: string | null = null;
  if (!PARAKEET_PLATFORMS.includes(key)) reason = `O Parakeet não roda em ${key}.`;
  else if (!hasSherpaBinary(key, opts.resolveModule)) reason = 'O Parakeet não carregou neste computador.';
  else if (!PARAKEET_FILES.every((f) => exists(join(opts.dir, f)))) reason = 'O modelo do Parakeet não está instalado.';
  return { engines: reason ? ['vosk'] : ['vosk', 'parakeet'], parakeetUnavailable: reason };
}

/** O binário do `sherpa-onnx-node` desta plataforma está instalado (`sherpa-onnx-<plataforma>-<arq>`). */
export function hasSherpaBinary(
  key: string,
  resolveModule: (id: string) => string = (id) => createRequire(import.meta.url).resolve(id),
): boolean {
  try {
    // Os pacotes do sherpa-onnx chamam o Windows de "win" (sherpa-onnx-win-x64).
    resolveModule(`sherpa-onnx-${key.replace(/^win32-/, 'win-')}/sherpa-onnx.node`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Arquivo pedido por `tp-model://models/<arquivo>`, preso à pasta de modelos. Só o
 * modelo do Vosk é servido por aqui (o Parakeet lê do disco no próprio processo).
 */
export function resolveModelRequest(url: string, dir: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${MODEL_SCHEME}:` || parsed.hostname !== 'models') return null;
  const name = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (name !== VOSK_MODEL_FILE) return null;
  const full = normalize(join(dir, name));
  return full.startsWith(normalize(dir) + sep) ? full : null;
}

interface ProtocolLike {
  registerSchemesAsPrivileged(schemes: unknown[]): void;
  handle(scheme: string, handler: (req: Request) => Promise<Response> | Response): void;
}

/**
 * Antes do `ready`: o esquema precisa aceitar `fetch` do Worker (CORS). O Electron
 * aceita uma única chamada de `registerSchemesAsPrivileged`, por isso outros esquemas
 * privilegiados do programa entram juntos em `extra`.
 */
export function registerModelScheme(protocol: ProtocolLike, extra: unknown[] = []): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MODEL_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
    },
    ...extra,
  ]);
}

/**
 * Depois do `ready`: serve o modelo do disco, com `Content-Length` (o Worker do Vosk
 * usa o tamanho para gravar o arquivo). Nada vem da rede.
 */
export function handleModelScheme(protocol: ProtocolLike, dir: string): void {
  protocol.handle(MODEL_SCHEME, (req) => {
    const file = resolveModelRequest(req.url, dir);
    if (!file || !existsSync(file)) return new Response('modelo não encontrado', { status: 404 });
    const body = Readable.toWeb(createReadStream(file)) as unknown as ReadableStream<Uint8Array>;
    return new Response(body, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/gzip',
        'Content-Length': String(statSync(file).size),
      },
    });
  });
}
