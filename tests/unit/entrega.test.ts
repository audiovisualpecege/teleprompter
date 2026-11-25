/**
 * Documentos da entrega 1.0.0: Como usar (E2E-013, passo 5; US-039 EC-1 e AC-2),
 * `_instaladores.txt` e CHANGELOG. Também confere que a única chamada de rede do programa
 * é a do aviso de versão nova e que o build de teste é o único com `TP_UPDATE_URL`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const VERSION = (JSON.parse(read('package.json')) as { version: string }).version;

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((f) => {
    const p = join(dir, f);
    return statSync(join(ROOT, p)).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe('Como usar', () => {
  const doc = read('docs/como-usar.md');

  it('Windows sem assinatura: "Mais informações" e "Executar assim mesmo"', () => {
    expect(doc).toContain('**Mais informações**');
    expect(doc).toContain('**Executar assim mesmo**');
  });

  it('Mac: liberar na primeira abertura e permissão do microfone', () => {
    expect(doc).toContain('Abrir Mesmo Assim');
    expect(doc).toContain('Privacidade e Segurança');
    expect(doc).toMatch(/Microfone/);
  });

  it('cobre roteiro, estúdio, operador, voz, atalhos, pedal e passador e a lista de conferência', () => {
    for (const h of ['Preparar o roteiro', 'Montar o estúdio', 'Gravar com operador', 'Gravar sozinho, com a voz', 'Atalhos, pedal e passador', 'Lista de conferência do estúdio']) {
      expect(doc).toContain(h);
    }
    expect(doc).toContain('Duas saídas reais com inversões diferentes');
    expect(doc).toMatch(/\*\*Pedal\*\*/);
    expect(doc).toMatch(/\*\*Passador\*\*/);
  });

  it('links só para github.com/audiovisualpecege/teleprompter, nomes da versão atual e sem travessão', () => {
    for (const url of doc.match(/https?:\/\/[^\s)>]+/g) ?? []) expect(url).toMatch(/^https:\/\/github\.com\/audiovisualpecege\/teleprompter\//);
    for (const s of ['win-x64.exe', 'mac-arm64.dmg', 'mac-x64.dmg']) expect(doc).toContain(`Teleprompter-${VERSION}-${s}`);
    expect(doc).not.toMatch(/[—–]/);
    expect(read('README.md')).not.toMatch(/[—–]/);
  });
});

describe('_instaladores.txt e CHANGELOG', () => {
  it('lista os três instaladores da versão na Release de audiovisualpecege/teleprompter', () => {
    const lines = read('_instaladores.txt')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#'));
    const urls = lines.map((l) => l.split(' | ')[0]);
    const base = `https://github.com/audiovisualpecege/teleprompter/releases/download/v${VERSION}/Teleprompter-${VERSION}-`;
    expect(urls.sort()).toEqual([`${base}mac-arm64.dmg`, `${base}mac-x64.dmg`, `${base}win-x64.exe`]);
    for (const l of lines) expect(l.split(' | ')[1]).toBeTruthy();
  });

  it('o CHANGELOG tem a versão com data e sem travessão nem item duplicado', () => {
    const log = read('CHANGELOG.md');
    expect(log).toMatch(new RegExp(`^## ${VERSION.replace(/\./g, '\\.')} \\(\\d{4}-\\d{2}-\\d{2}\\)`, 'm'));
    expect(log).not.toMatch(/^- - /m);
    expect(log).not.toMatch(/[—–]/);
  });
});

describe('rede', () => {
  it('a única chamada de rede do programa é a do UpdateChecker, e TP_UPDATE_URL só existe no build de teste', () => {
    const calls = sources('src').filter((f) => /\b(net\.fetch|fetch\(|https?\.request|XMLHttpRequest|WebSocket\()/.test(read(f)));
    // `platform.ts` é o adaptador fino de `net.fetch`; `updates.ts` é quem o usa.
    expect(calls.map((f) => f.split(/[\\/]/).join('/')).sort()).toEqual(['src/main/platform.ts', 'src/main/updates.ts']);
    const index = read('src/main/index.ts');
    expect(index).toMatch(/if \(__TP_TEST__ && process\.env\.TP_UPDATE_URL\) updateUrl = process\.env\.TP_UPDATE_URL;/);
    for (const f of sources('src').filter((p) => !p.endsWith('index.ts'))) expect(read(f)).not.toContain('process.env.TP_UPDATE_URL');
  });
});
