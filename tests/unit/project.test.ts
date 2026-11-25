import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = join(__dirname, '..', '..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const pkg = JSON.parse(read('package.json')) as { version: string; main: string; scripts: Record<string, string> };

describe('projeto: versão, ícone e instaladores', () => {
  it('versão: o CHANGELOG tem a entrada da versão do package.json, com data', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(read('CHANGELOG.md')).toMatch(new RegExp(`^## ${pkg.version.replace(/\./g, '\\.')} \\(\\d{4}-\\d{2}-\\d{2}\\)`, 'm'));
  });

  it('electron-builder: nomes dos instaladores com a versão, NSIS x64, DMG x64 e arm64, .roteiro e modelos', () => {
    const cfg = parse(read('electron-builder.yml'));
    expect(cfg.win.artifactName).toBe('Teleprompter-${version}-win-${arch}.${ext}');
    expect(cfg.mac.artifactName).toBe('Teleprompter-${version}-mac-${arch}.${ext}');
    expect(cfg.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }]);
    expect(cfg.mac.target).toEqual([{ target: 'dmg', arch: ['x64', 'arm64'] }]);
    expect(cfg.fileAssociations[0].ext).toBe('roteiro');
    expect(cfg.extraResources[0]).toMatchObject({ from: 'resources/models', to: 'models' });
    expect(cfg.mac.extendInfo.NSMicrophoneUsageDescription).toBeTruthy();
    expect(cfg.publish).toMatchObject({ provider: 'github', owner: 'audiovisualpecege', repo: 'teleprompter' });
    expect(existsSync(join(ROOT, cfg.win.icon))).toBe(true);
    expect(existsSync(join(ROOT, cfg.mac.icon))).toBe(true);
    // Nem o ícone nem os logos da Chiaro são o ícone do produto.
    expect(JSON.stringify(cfg)).not.toMatch(/icone-chiaro|logos\//);
  });

  it('release: workflow em tag v*, Windows e Mac, testes de instalação e publicação só na tag', () => {
    const wf = parse(read('.github/workflows/release.yml'));
    expect(wf.on.push.tags).toEqual(['v*']);
    expect(wf.permissions.contents).toBe('write');
    const oses = wf.jobs.instaladores.strategy.matrix.include.map((m: { os: string }) => m.os);
    expect(oses).toEqual(['windows-latest', 'macos-15-intel', 'macos-latest']);
    const steps = JSON.stringify(wf.jobs.instaladores.steps);
    expect(steps).toContain('npm ci');
    expect(steps).toContain('npm test');
    expect(steps).toContain('npm run build');
    // Os instaladores nunca publicam sozinhos: só o job "publicar", na tag e com tudo verde.
    for (const m of wf.jobs.instaladores.strategy.matrix.include) expect(m.dist).toContain('--publish never');
    expect(wf.jobs.publicar.if).toBe("startsWith(github.ref, 'refs/tags/')");
    expect(wf.jobs.publicar.needs).toEqual(['instaladores', 'instalar-windows', 'instalar-mac']);
    const publish = JSON.stringify(wf.jobs.publicar.steps);
    expect(publish).toContain('GH_TOKEN');
    for (const suffix of ['win-x64.exe', 'mac-x64.dmg', 'mac-arm64.dmg']) expect(publish).toContain(`Teleprompter-$VERSAO-${suffix}`);
    expect(JSON.stringify(wf.jobs['instalar-windows'].steps)).toContain('tests/instalacao/windows.spec.ts');
    expect(JSON.stringify(wf.jobs['instalar-mac'].steps)).toContain('tests/instalacao/mac.spec.ts');
    const builder = parse(read('electron-builder.yml'));
    expect(`${builder.publish.owner}/${builder.publish.repo}`).toBe('audiovisualpecege/teleprompter');
  });

  it('ícone: todos os tamanhos gerados do SVG próprio existem', () => {
    const svg = read('build/icone.svg');
    expect(svg).toContain('<svg');
    expect(svg).not.toMatch(/icone-chiaro|chiaro\.png/);
    for (const s of [16, 32, 48, 64, 128, 256, 512, 1024]) {
      const png = readFileSync(join(ROOT, `build/icons/${s}x${s}.png`));
      expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
      expect(png.readUInt32BE(16)).toBe(s);
      expect(png.readUInt32BE(20)).toBe(s);
    }
    const ico = readFileSync(join(ROOT, 'build/icons/icone.ico'));
    expect(ico.readUInt16LE(2)).toBe(1);
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => ico.readUInt8(6 + i * 16) || 256);
    expect(sizes).toEqual([16, 32, 48, 64, 128, 256]);
    const icns = readFileSync(join(ROOT, 'build/icons/icone.icns'));
    expect(icns.subarray(0, 4).toString('ascii')).toBe('icns');
    expect(icns.readUInt32BE(4)).toBe(icns.length);
  });

  it('scripts: build, testes e ponta a ponta', () => {
    expect(pkg.main).toBe('./out/main/index.js');
    for (const s of ['build', 'build:test', 'test', 'test:voice', 'test:e2e', 'icons']) {
      expect(pkg.scripts[s]).toBeTruthy();
    }
  });
});
