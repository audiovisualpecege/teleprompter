import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { availableEngines, hasSherpaBinary, modelsDir, resolveModelRequest } from '../../src/main/models';

const all = (): boolean => true;
const found = (id: string): string => `/node_modules/${id}`;
const missing = (): string => {
  throw new Error('Cannot find module');
};

describe('models', () => {
  it('models: Vosk sempre aparece; Parakeet some com motivo quando não pode rodar', () => {
    expect(availableEngines({ dir: '/m', platform: 'win32', arch: 'x64', exists: all, resolveModule: found })).toEqual({
      engines: ['vosk', 'parakeet'],
      parakeetUnavailable: null,
    });
    expect(availableEngines({ dir: '/m', platform: 'linux', arch: 'arm', exists: all, resolveModule: found }).engines).toEqual(['vosk']);
    const noBinary = availableEngines({ dir: '/m', platform: 'darwin', arch: 'x64', exists: all, resolveModule: missing });
    expect(noBinary.engines).toEqual(['vosk']);
    expect(noBinary.parakeetUnavailable).toBe('O Parakeet não carregou neste computador.');
    const noModel = availableEngines({ dir: '/m', platform: 'darwin', arch: 'arm64', exists: () => false, resolveModule: found });
    expect(noModel.parakeetUnavailable).toBe('O modelo do Parakeet não está instalado.');
  });

  it('models: confere o binário do sherpa-onnx desta plataforma', () => {
    const asked: string[] = [];
    expect(hasSherpaBinary('darwin-arm64', (id) => (asked.push(id), id))).toBe(true);
    expect(asked).toEqual(['sherpa-onnx-darwin-arm64/sherpa-onnx.node']);
    hasSherpaBinary('win32-x64', (id) => (asked.push(id), id));
    expect(asked[1]).toBe('sherpa-onnx-win-x64/sherpa-onnx.node');
    expect(hasSherpaBinary('darwin-x64', missing)).toBe(false);
    // Neste computador de teste o binário instalado é o da própria plataforma.
    expect(hasSherpaBinary(`${process.platform}-${process.arch}`)).toBe(true);
  });

  it('models: o protocolo tp-model só entrega o modelo do Vosk, dentro da pasta', () => {
    const dir = join('/r', 'models');
    expect(resolveModelRequest('tp-model://models/vosk-model-small-pt-0.3.tar.gz', dir)).toBe(
      join(dir, 'vosk-model-small-pt-0.3.tar.gz'),
    );
    expect(resolveModelRequest('tp-model://models/..%2F..%2Fsegredo.txt', dir)).toBeNull();
    expect(resolveModelRequest('tp-model://models/silero_vad.onnx', dir)).toBeNull();
    expect(resolveModelRequest('https://models/vosk-model-small-pt-0.3.tar.gz', dir)).toBeNull();
  });

  it('models: pasta dos modelos no pacote e no projeto', () => {
    expect(modelsDir({ isPackaged: true, resourcesPath: '/app/res', appPath: '/x' })).toBe(join('/app/res', 'models'));
    expect(modelsDir({ isPackaged: false, resourcesPath: '', appPath: '/proj', exists: () => true })).toBe(
      join('/proj', 'resources', 'models'),
    );
    const parent = join('/proj', 'out-test', '..', 'resources', 'models');
    expect(
      modelsDir({ isPackaged: false, resourcesPath: '', appPath: join('/proj', 'out-test'), exists: (p) => p === parent }),
    ).toBe(parent);
  });
});
