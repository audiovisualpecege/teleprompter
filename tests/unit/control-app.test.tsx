import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/renderer/control/App';

const ROOT = join(__dirname, '..', '..');

describe('ControlApp', () => {
  it('UT-223 ControlApp: o rodapé mostra a versão do package.json com a classe em --text-muted', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
    expect(__APP_VERSION__).toBe(pkg.version);

    render(<App />);
    const tag = screen.getByText(`v${__APP_VERSION__}`);
    expect(tag).toHaveTextContent(`v${pkg.version}`);
    expect(tag).toHaveClass('tp-version');
    expect(tag.closest('footer')).not.toBeNull();

    const css = readFileSync(join(ROOT, 'src/renderer/control/app.css'), 'utf8');
    const rule = /\.tp-version\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/color:\s*var\(--text-muted\)/);
    expect(rule).toMatch(/font-size:\s*var\(--text-caption\)/);
    const footer = /\.tp-footer\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(footer).toMatch(/position:\s*fixed/);
    expect(footer).toMatch(/right:/);
    expect(footer).toMatch(/bottom:/);

    // Nenhum número de versão digitado à mão nas telas; as saídas nunca mostram a versão.
    const appSrc = readFileSync(join(ROOT, 'src/renderer/control/App.tsx'), 'utf8');
    expect(appSrc).not.toMatch(/\d+\.\d+\.\d+/);
    const outputSrc = readFileSync(join(ROOT, 'src/renderer/output/OutputApp.tsx'), 'utf8');
    expect(outputSrc).not.toMatch(/__APP_VERSION__|\d+\.\d+\.\d+/);
  });
});
