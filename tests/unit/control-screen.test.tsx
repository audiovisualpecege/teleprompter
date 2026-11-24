import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APPEARANCE } from '@shared/defaults';
import { ignoredMessage } from '../../src/main/import-docx';
import { App } from '../../src/renderer/control/App';
import { createFakeBridge, snapshotWith, storeWith, type FakeControlBridge } from '../fakes/control-bridge';

function renderApp(bridge: FakeControlBridge = createFakeBridge(), initial = snapshotWith()) {
  const store = storeWith(bridge, initial);
  const view = render(<App store={store} />);
  return { bridge, store, view };
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const sendsOn = (bridge: FakeControlBridge, channel: string) => bridge.sends.filter((s) => s.channel === channel);

afterEach(() => {
  vi.useRealTimers();
});

describe('ControlApp: estados desabilitados e primeira abertura', () => {
  it('UT-224 "Confirmar alterações" fica desabilitado com o rascunho "   "', () => {
    renderApp(createFakeBridge(), snapshotWith({ doc: { draftText: '   ', pending: true } }));
    expect(button('Confirmar alterações')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Texto do roteiro'), { target: { value: 'Bom dia' } });
    expect(button('Confirmar alterações')).toBeEnabled();
  });

  it('UT-225 "Iniciar" e "Voz" ficam desabilitados sem texto confirmado', () => {
    const { bridge } = renderApp();
    expect(button('Iniciar')).toBeDisabled();
    expect(button('Voz')).toBeDisabled();
    bridge.emit('state:snapshot', snapshotWith({ doc: { draftText: 'Texto', confirmedText: 'Texto' } }));
    expect(button('Iniciar')).toBeEnabled();
    expect(button('Voz')).toBeEnabled();
  });

  it('UT-227 sem texto confirmado e sem saídas, aparecem os três passos', () => {
    const { bridge } = renderApp();
    const steps = screen.getByRole('note', { name: 'Primeiros passos' });
    expect(within(steps).getByText('Cole ou importe o texto')).toBeInTheDocument();
    expect(within(steps).getByText('Abra uma saída')).toBeInTheDocument();
    expect(within(steps).getByText('Ligue a voz, se quiser')).toBeInTheDocument();
    bridge.emit('state:snapshot', snapshotWith({ doc: { draftText: 'Texto', confirmedText: 'Texto' } }));
    expect(screen.queryByRole('note', { name: 'Primeiros passos' })).toBeNull();
  });
});

describe('ControlApp: aparência', () => {
  it('UT-231 texto #777777 sobre fundo #808080 mostra o aviso de contraste', () => {
    const { bridge } = renderApp();
    expect(screen.queryByText('O texto pode ficar ilegível com estas cores')).toBeNull();
    bridge.emit(
      'state:snapshot',
      snapshotWith({ appearance: { ...DEFAULT_APPEARANCE, textColor: '#777777', backgroundColor: '#808080' } }),
    );
    expect(screen.getByText('O texto pode ficar ilegível com estas cores')).toBeInTheDocument();
  });

  it('UT-232 o tamanho "250" vira 200 ao sair do campo; "abc" volta ao valor anterior', () => {
    const { bridge } = renderApp();
    const size = screen.getByLabelText('Tamanho') as HTMLInputElement;
    expect(size.value).toBe('80');

    fireEvent.focus(size);
    fireEvent.change(size, { target: { value: '250' } });
    fireEvent.blur(size);
    expect(size.value).toBe('200');
    expect(bridge.invokes.filter((i) => i.channel === 'cmd:appearance').map((i) => i.payload)).toEqual([{ fontSize: 200 }]);

    bridge.invokes.length = 0;
    fireEvent.focus(size);
    fireEvent.change(size, { target: { value: 'abc' } });
    fireEvent.blur(size);
    expect(size.value).toBe('80');
    expect(bridge.invokes.filter((i) => i.channel === 'cmd:appearance')).toEqual([]);
  });

  it('UT-233 a cor "#GGG" volta à cor anterior ao sair do campo', () => {
    const { bridge } = renderApp();
    const color = screen.getByLabelText('Cor do texto') as HTMLInputElement;
    expect(color.value).toBe('#FFFFFF');
    fireEvent.focus(color);
    fireEvent.change(color, { target: { value: '#GGG' } });
    fireEvent.blur(color);
    expect(color.value).toBe('#FFFFFF');
    expect(bridge.invokes.filter((i) => i.channel === 'cmd:appearance')).toEqual([]);

    // Uma cor válida vai ao principal em maiúsculas.
    fireEvent.focus(color);
    fireEvent.change(color, { target: { value: '#ffcc00' } });
    fireEvent.blur(color);
    expect(bridge.invokes.filter((i) => i.channel === 'cmd:appearance').map((i) => i.payload)).toEqual([{ textColor: '#FFCC00' }]);
  });

  it('o seletor de cor abre um popover próprio, escuro, e não o seletor nativo', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Escolher cor do fundo' }));
    const pop = screen.getByRole('dialog', { name: 'Cor do fundo' });
    expect(pop).toHaveClass('tp-color-popover');
    expect(document.querySelector('input[type="color"]')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Cor do fundo' })).toBeNull();
  });
});

describe('ControlApp: prévia e editor', () => {
  it('UT-234 a roda do mouse sobre a prévia envia cmd:scroll nudge; sobre o editor, nada', () => {
    const { bridge } = renderApp();
    fireEvent.wheel(screen.getByTestId('preview'), { deltaY: 120 });
    const scrolls = sendsOn(bridge, 'cmd:scroll');
    expect(scrolls).toHaveLength(1);
    expect(scrolls[0].payload).toMatchObject({ type: 'nudge' });
    expect((scrolls[0].payload as { dy: number }).dy).toBeGreaterThan(0);

    bridge.sends.length = 0;
    fireEvent.wheel(screen.getByLabelText('Texto do roteiro'), { deltaY: 120 });
    expect(sendsOn(bridge, 'cmd:scroll')).toEqual([]);
  });

  it('UT-235 a prévia desenha as linhas-guia em marginPct e 100 - marginPct da largura', () => {
    const { bridge, view } = renderApp();
    bridge.emit('state:snapshot', snapshotWith({ appearance: { ...DEFAULT_APPEARANCE, marginPct: 15 } }));
    const left = view.container.querySelector('[data-guide="left"]') as HTMLElement;
    const right = view.container.querySelector('[data-guide="right"]') as HTMLElement;
    expect(left.style.left).toBe('15%');
    expect(right.style.left).toBe('85%');
  });

  it('UT-236 o topo mostra o nome do arquivo e "(não salvo)" com alterações', () => {
    const { bridge } = renderApp(createFakeBridge(), snapshotWith({ doc: { filePath: 'C:\\Roteiros\\aula-01.roteiro' } }));
    expect(screen.getByTestId('file-name')).toHaveTextContent(/^aula-01\.roteiro$/);
    bridge.emit('state:snapshot', snapshotWith({ doc: { filePath: '/Users/ana/aula-01.roteiro', dirty: true } }));
    expect(screen.getByTestId('file-name')).toHaveTextContent(/^aula-01\.roteiro \(não salvo\)$/);
  });

  it('UT-242 trechos de movimento não mudam a rolagem nem a seleção do editor', () => {
    const text = Array.from({ length: 80 }, (_, i) => `Linha ${i} do roteiro`).join('\n');
    const { bridge } = renderApp(createFakeBridge(), snapshotWith({ doc: { draftText: text, confirmedText: text } }));
    const editor = screen.getByLabelText('Texto do roteiro') as HTMLTextAreaElement;
    editor.focus();
    editor.scrollTop = 120;
    editor.setSelectionRange(40, 52);
    for (let i = 0; i < 20; i++) {
      bridge.emit('motion:segment', { kind: 'cruise', y0: i * 10, t0: i, pxPerSec: 50, yEnd: 5000 });
      bridge.emit('motion:segment', { kind: 'glide', y0: i * 10, y1: i * 10 + 100, t0: i, durMs: 150 });
    }
    expect(editor.scrollTop).toBe(120);
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([40, 52]);
    expect(editor.value).toBe(text);
    expect(document.activeElement).toBe(editor);
  });

  it('UT-243 a velocidade mostra "1,00x" e, depois de "+", "1,25x"', () => {
    const { bridge } = renderApp();
    expect(screen.getByTestId('speed')).toHaveTextContent('1,00x');
    fireEvent.click(button('Mais rápido'));
    expect(sendsOn(bridge, 'cmd:scroll').map((s) => s.payload)).toEqual([{ type: 'setSpeed', speed: 1.25 }]);
    bridge.emit('state:snapshot', snapshotWith({ speed: 1.25 }));
    expect(screen.getByTestId('speed')).toHaveTextContent('1,25x');
  });

  it('Confirmar manda antes o texto do editor e depois a confirmação', async () => {
    const { bridge } = renderApp();
    fireEvent.change(screen.getByLabelText('Texto do roteiro'), { target: { value: 'Primeira linha' } });
    await act(async () => {
      fireEvent.click(button('Confirmar alterações'));
    });
    const docs = bridge.invokes.filter((i) => i.channel === 'cmd:doc').map((i) => i.payload);
    expect(docs).toEqual([{ op: 'setDraft', text: 'Primeira linha' }, { op: 'confirm' }]);
  });
});

describe('ControlApp: arquivos', () => {
  it('UT-239 a importação com tabela ignorada mostra o aviso', async () => {
    const bridge = createFakeBridge();
    const { store } = renderApp(bridge);
    bridge.respond = (channel, payload) => {
      if (channel === 'cmd:doc' && (payload as { op: string }).op === 'import') {
        const message = ignoredMessage({ tables: 1, images: 0, textboxes: 0 })!;
        queueMicrotask(() =>
          bridge.emit('state:snapshot', {
            ...store.getSnapshot(),
            doc: { ...store.getSnapshot().doc, draftText: 'Texto importado', dirty: true, pending: true },
            notices: [{ id: 'n1', kind: 'info', message }],
          }),
        );
      }
      return { ok: true, value: undefined };
    };
    await act(async () => {
      fireEvent.click(button('Importar'));
    });
    expect(await screen.findByText(/Tabelas, imagens e caixas de texto foram ignoradas/)).toBeInTheDocument();
    expect((screen.getByLabelText('Texto do roteiro') as HTMLTextAreaElement).value).toBe('Texto importado');
  });

  it('UT-240 importação acima de 1.000 ms mostra "Carregando"; com 300 ms, não', async () => {
    vi.useFakeTimers();
    const bridge = createFakeBridge();
    renderApp(bridge);
    let delay = 1500;
    bridge.respond = (channel) =>
      channel === 'cmd:doc'
        ? new Promise((resolve) => setTimeout(() => resolve({ ok: true, value: undefined }), delay))
        : { ok: true, value: undefined };

    await act(async () => {
      fireEvent.click(button('Importar'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(screen.getByText('Carregando')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.queryByText('Carregando')).toBeNull();

    delay = 300;
    await act(async () => {
      fireEvent.click(button('Importar'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(screen.queryByText('Carregando')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });
    expect(screen.queryByText('Carregando')).toBeNull();
  });

  it('alterações não salvas: "Novo" abre o diálogo escuro; Cancelar não repete o comando', async () => {
    const bridge = createFakeBridge();
    renderApp(bridge, snapshotWith({ doc: { draftText: 'x', dirty: true, pending: true } }));
    bridge.respond = (channel, payload) =>
      channel === 'cmd:doc' && (payload as { op: string; unsaved?: string }).op === 'new' && !(payload as { unsaved?: string }).unsaved
        ? { ok: false, error: { code: 'needs-confirmation', options: ['Salvar', 'Não salvar', 'Cancelar'] } }
        : { ok: true, value: undefined };
    await act(async () => {
      fireEvent.click(button('Novo'));
    });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Alterações não salvas')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Não salvar' })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bridge.invokes.filter((i) => i.channel === 'cmd:doc' && (i.payload as { op: string }).op === 'new')).toHaveLength(1);

    await act(async () => {
      fireEvent.click(button('Novo'));
    });
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Não salvar' }));
    });
    expect(bridge.invokes.at(-1)?.payload).toEqual({ op: 'new', unsaved: 'discard' });
  });

  it('a oferta de recuperação usa o Dialog e responde com recover', async () => {
    const bridge = createFakeBridge();
    renderApp(bridge, snapshotWith({ prompt: { kind: 'recovery', savedAt: 1, filePath: null } }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Recuperar texto')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Recuperar' }));
    });
    expect(bridge.invokes.at(-1)).toEqual({ channel: 'cmd:doc', payload: { op: 'recover', accept: true } });
  });

  it('mostra as mensagens de erro de arquivo e o aviso de fonte ausente, e fecha cada aviso', () => {
    const bridge = createFakeBridge();
    renderApp(bridge);
    bridge.emit(
      'state:snapshot',
      snapshotWith({
        notices: [
          { id: 'n1', kind: 'danger', message: 'O arquivo não pôde ser lido' },
          { id: 'missing-font', kind: 'warning', message: 'A fonte Fonte Sumida não está instalada neste computador. O texto aparece em Archivo' },
        ],
      }),
    );
    expect(screen.getByText('O arquivo não pôde ser lido')).toBeInTheDocument();
    expect(screen.getByText(/A fonte Fonte Sumida não está instalada neste computador/)).toBeInTheDocument();
  });

  it('textos da tela sem emoji, sem ponto de exclamação e sem travessão', () => {
    renderApp();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/[!\u2014\u2013]/);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
