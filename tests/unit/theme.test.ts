import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTROL_BACKGROUND } from '../../src/main/windows';

const ROOT = join(__dirname, '..', '..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

/** Blocos `seletor { declarações }` de um CSS simples (sem aninhamento). */
function rules(css: string): { selector: string; decls: Record<string, string> }[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: { selector: string; decls: Record<string, string> }[] = [];
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls: Record<string, string> = {};
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i > 0) decls[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
    out.push({ selector: m[1].trim(), decls });
  }
  return out;
}

/** Resolve `var(--x)` com os tokens do tema Noite por cima dos de `:root`, como no `<html data-theme="noite">`. */
function resolveNoite(value: string): string {
  const colors = rules(read('design-system/chiaro/tokens/colors.css'));
  const vars: Record<string, string> = {};
  for (const r of colors.filter((r) => r.selector === ':root')) Object.assign(vars, r.decls);
  for (const r of colors.filter((r) => r.selector === '[data-theme="noite"]')) Object.assign(vars, r.decls);
  let v = value;
  for (let i = 0; i < 10 && v.includes('var('); i++) {
    v = v.replace(/var\((--[\w-]+)\)/g, (_, name: string) => vars[name] ?? `?${name}`);
  }
  return v;
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

describe('tema Noite', () => {
  it('UT-244 tema: os dois index.html começam com data-theme="noite", o body resolve #070010 e dark, sem seletor de tema', () => {
    for (const page of ['control', 'output']) {
      const html = read(`src/renderer/${page}/index.html`);
      const first = html.replace(/^<!doctype html>\s*/i, '');
      expect(first.startsWith('<html data-theme="noite">')).toBe(true);
      // A folha de tema (com os tokens da Chiaro) entra pelo ponto de entrada de cada tela.
      expect(read(`src/renderer/${page}/main.tsx`)).toContain("import '../shared/theme.css';");
    }

    const theme = read('src/renderer/shared/theme.css');
    expect(theme).toMatch(/@import ['"]@chiaro\/styles\.css['"]/);
    const body = rules(theme).find((r) => r.selector === 'body');
    expect(body).toBeDefined();
    expect(body!.decls['color-scheme']).toBe('dark');
    expect(resolveNoite(body!.decls['background']).toUpperCase()).toBe('#070010');
    // O `:root{color-scheme:light}` do tema claro é substituído no documento com tema Noite.
    const rootDark = rules(theme).find((r) => r.selector.includes("[data-theme='noite']"));
    expect(rootDark?.decls['color-scheme']).toBe('dark');
    // A janela de controle nasce com o mesmo fundo, sem piscar claro.
    expect(CONTROL_BACKGROUND).toBe('#070010');

    // Nenhum seletor de tema nem leitura da preferência do sistema.
    const src = filesUnder(join(ROOT, 'src'))
      .filter((f) => /\.(tsx?|css|html)$/.test(f))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    expect(src).not.toMatch(/prefers-color-scheme/);
    expect(src).not.toMatch(/data-theme=["'](?!noite)/);
    expect(src).not.toMatch(/shouldUseDarkColors|themeSource\s*=\s*['"](?!dark)/);
    expect(src).not.toMatch(/setTheme|toggleTheme|themeToggle|data-theme=['"]claro/i);
    expect(read('src/main/index.ts')).toContain("nativeTheme.themeSource = 'dark'");
  });
});
