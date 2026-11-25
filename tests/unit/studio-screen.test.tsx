import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { defaultKeymap } from '@shared/defaults';
import type { DisplayInfo, OutputInfo } from '@shared/types';
import { App } from '../../src/renderer/control/App';
import { SHORTCUTS_INACTIVE } from '../../src/renderer/control/Editor';
import { createFakeBridge, snapshotWith, storeWith, type FakeControlBridge } from '../fakes/control-bridge';

function renderApp(bridge: FakeControlBridge = createFakeBridge(), initial = snapshotWith()) {
  const store = storeWith(bridge, initial);
  const view = render(<App store={store} />);
  return { bridge, store, view };
}

const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));
const invokesOn = (bridge: FakeControlBridge, channel: string) => bridge.invokes.filter((i) => i.channel === channel).map((i) => i.payload);
const sendsOn = (bridge: FakeControlBridge, channel: string) => bridge.sends.filter((s) => s.channel === channel).map((s) => s.payload);

const display = (id: number, label: string, size: string, patch: Partial<DisplayInfo> = {}): DisplayInfo => ({
  displayKey: `${id}|${label}|${size.replace(' x ', 'x')}`,
  id,
  label,
  size,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  primary: id === 1,
  hasControl: false,
  outputId: null,
  ...patch,
});

const output = (id: number, label: string, patch: Partial<OutputInfo> = {}): OutputInfo => ({
  id,
  displayKey: `${id + 1}|${label}|1920x1080`,
  label,
  size: '1920 x 1080',
  state: 'open',
  mirrorH: false,
  flipV: false,
  voiceSignal: true,
  ...patch,
});

describe('ControlApp: atalhos inativos e dicas', () => {
  it('UT-226 com editorFocused, aparece o aviso de atalhos inativos', () => {
    const { bridge } = renderApp();
    expect(screen.queryByText(SHORTCUTS_INACTIVE)).toBeNull();
    bridge.emit('state:snapshot', snapshotWith({ editorFocused: true }));
    expect(screen.getByText('Atalhos inativos enquanto você edita. Esc para sair do editor')).toBeInTheDocument();
    bridge.emit('state:snapshot', snapshotWith({ editorFocused: false }));
    expect(screen.queryByText(SHORTCUTS_INACTIVE)).toBeNull();
  });

  it('UT-228 a dica de "Descer" mostra "Seta para baixo ou Page Down" a partir do mapa atual', () => {
    const { bridge } = renderApp();
    expect(screen.getByRole('tooltip', { hidden: true, name: /Descer: Seta para baixo ou Page Down/ })).toBeTruthy();
    const keymap = { ...defaultKeymap(), down: [{ key: 'b', ctrlOrCmd: false, shift: false, alt: false }] };
    bridge.emit('state:snapshot', snapshotWith({ keymap }));
    expect(screen.getByRole('tooltip', { hidden: true, name: /Descer: B$/ })).toBeTruthy();
  });

  it('Esc capturado pelo principal tira o foco do editor', () => {
    const { bridge } = renderApp();
    const editor = screen.getByLabelText('Texto do roteiro');
    editor.focus();
    expect(document.activeElement).toBe(editor);
    act(() => bridge.emit('ui:blurEditor', null));
    expect(document.activeElement).not.toBe(editor);
  });
});

describe('ControlApp: tela de atalhos', () => {
  it('UT-245 gravar o atalho de "Descer" e apertar Esc cancela sem mudar o mapa', () => {
    const { bridge } = renderApp();
    tab('Atalhos');
    fireEvent.click(screen.getByRole('button', { name: 'Gravar atalho de Descer' }));
    expect(screen.getByText('Aperte a tecla ou a combinação. Esc cancela')).toBeInTheDocument();
    expect(sendsOn(bridge, 'ui:keyCapture')).toEqual([true]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(invokesOn(bridge, 'cmd:keymap')).toEqual([]);
    expect(sendsOn(bridge, 'ui:keyCapture')).toEqual([true, false]);
    expect(screen.getByTestId('keys-down')).toHaveTextContent('Seta para baixo ou Page Down');
  });

  it('gravar B para "Descer" manda cmd:keymap set com a combinação', () => {
    const { bridge } = renderApp();
    tab('Atalhos');
    fireEvent.click(screen.getByRole('button', { name: 'Gravar atalho de Descer' }));
    // Uma modificadora sozinha não encerra a gravação.
    fireEvent.keyDown(window, { key: 'Shift', shiftKey: true });
    expect(invokesOn(bridge, 'cmd:keymap')).toEqual([]);
    fireEvent.keyDown(window, { key: 'B' });
    expect(invokesOn(bridge, 'cmd:keymap')).toEqual([
      { op: 'set', action: 'down', combo: { key: 'b', ctrlOrCmd: false, shift: false, alt: false }, force: false },
    ]);
  });

  it('tecla já usada: pergunta de conflito; "Cancelar" mantém, "Trocar" manda com force', async () => {
    const bridge = createFakeBridge();
    bridge.respond = (channel, payload) =>
      channel === 'cmd:keymap' && !(payload as { force?: boolean }).force
        ? { ok: false, error: { conflictWith: 'autoToggle' } }
        : { ok: true, value: defaultKeymap() };
    renderApp(bridge);
    tab('Atalhos');
    fireEvent.click(screen.getByRole('button', { name: 'Gravar atalho de Descer' }));
    await act(async () => void fireEvent.keyDown(window, { key: ' ' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Espaço já é o atalho de "Iniciar ou pausar a rolagem automática"');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(invokesOn(bridge, 'cmd:keymap')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Gravar atalho de Descer' }));
    await act(async () => void fireEvent.keyDown(window, { key: ' ' }));
    await act(async () => void fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Trocar' })));
    expect(invokesOn(bridge, 'cmd:keymap').at(-1)).toMatchObject({ op: 'set', action: 'down', force: true });
  });

  it('tecla reservada: mensagem, sem aceitar', async () => {
    const bridge = createFakeBridge();
    bridge.respond = (channel) => (channel === 'cmd:keymap' ? { ok: false, error: 'reserved' } : { ok: true, value: undefined });
    renderApp(bridge);
    tab('Atalhos');
    fireEvent.click(screen.getByRole('button', { name: 'Gravar atalho de Descer' }));
    await act(async () => void fireEvent.keyDown(window, { key: 'F4', altKey: true }));
    expect(screen.getByRole('alert')).toHaveTextContent('Alt+F4 é reservada pelo sistema e não pode ser usada');
  });

  it('"Sem atalho" e "Voltar ao padrão" mandam clear e reset', () => {
    const { bridge } = renderApp();
    tab('Atalhos');
    fireEvent.click(screen.getByRole('button', { name: 'Deixar Mais velocidade sem atalho' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão' }));
    expect(invokesOn(bridge, 'cmd:keymap')).toEqual([{ op: 'clear', action: 'faster' }, { op: 'reset' }]);
  });
});

describe('ControlApp: painel de saídas', () => {
  it('UT-119 só com o monitor da tela de controle, mostra "Não há monitor livre"', () => {
    renderApp(createFakeBridge(), snapshotWith({ displays: [display(1, 'A', '1920 x 1080', { hasControl: true })] }));
    tab('Saídas');
    expect(screen.getByText('Não há monitor livre')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir saída' })).toBeNull();
  });

  it('UT-114 lista os livres por nome e resolução e abre uma saída no escolhido', () => {
    const displays = [display(1, 'A', '1920 x 1080', { hasControl: true }), display(2, 'B', '1920 x 1080'), display(3, 'C', '1280 x 1024')];
    const { bridge } = renderApp(createFakeBridge(), snapshotWith({ displays }));
    tab('Saídas');
    const free = screen.getByRole('region', { name: 'Monitores livres' });
    expect(within(free).getByText('B, 1920 x 1080')).toBeInTheDocument();
    expect(within(free).getByText('C, 1280 x 1024')).toBeInTheDocument();
    expect(within(free).getByText('A, 1920 x 1080: monitor da tela de controle')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'C' })).getByRole('button', { name: 'Abrir saída' }));
    expect(invokesOn(bridge, 'cmd:output')).toEqual([{ op: 'open', displayKey: '3|C|1280x1024' }]);
  });

  it('cada saída tem Espelhar, Inverter vertical, Sinal de voz e Fechar; a caída aparece com o aviso', () => {
    const outputs = [output(1, 'B', { mirrorH: true }), output(2, 'C', { state: 'down' })];
    const { bridge } = renderApp(createFakeBridge(), snapshotWith({ outputs }));
    tab('Saídas');
    const one = screen.getByRole('group', { name: 'Saída 1' });
    expect(within(one).getByLabelText('Espelhar')).toBeChecked();
    fireEvent.click(within(one).getByLabelText('Inverter vertical'));
    fireEvent.click(within(one).getByLabelText('Sinal de voz'));
    fireEvent.click(within(one).getByRole('button', { name: 'Fechar' }));
    expect(invokesOn(bridge, 'cmd:output')).toEqual([
      { op: 'set', id: 1, flipV: true },
      { op: 'set', id: 1, voiceSignal: false },
      { op: 'close', id: 1 },
    ]);
    expect(within(screen.getByRole('group', { name: 'Saída 2' })).getByText(/Caiu/)).toBeInTheDocument();
  });

  it('a falha ao abrir aparece em texto', async () => {
    const bridge = createFakeBridge();
    bridge.respond = () => ({ ok: false, error: 'display-busy' });
    renderApp(bridge, snapshotWith({ displays: [display(2, 'B', '1920 x 1080')] }));
    tab('Saídas');
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Abrir saída' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Este monitor já tem uma saída');
  });
});
