/**
 * Tela de controle: aviso de versão nova (UT-237), tela Sobre e voltar ao padrão só pelo
 * diálogo de confirmação (UT-241).
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/renderer/control/App';
import { lagLabel } from '../../src/renderer/control/AboutPanel';
import { createFakeBridge, snapshotWith, storeWith, type FakeControlBridge } from '../fakes/control-bridge';

function renderApp(initial = snapshotWith(), bridge: FakeControlBridge = createFakeBridge()) {
  const store = storeWith(bridge, initial);
  const view = render(<App store={store} />);
  return { bridge, store, view };
}

const invokesOn = (bridge: FakeControlBridge, channel: string) => bridge.invokes.filter((i) => i.channel === channel).map((i) => i.payload);
const UPDATE = { version: '1.1.0', url: 'https://github.com/audiovisualpecege/teleprompter/releases/download/v1.1.0/Teleprompter-1.1.0-win-x64.exe', progress: null, error: null };

describe('aviso de versão nova', () => {
  it('UT-237: com update presente, aparece o aviso com "Baixar e instalar" e "Fechar"; "Fechar" o esconde', () => {
    const { bridge } = renderApp(snapshotWith({ update: UPDATE }));
    const notice = screen.getByRole('status', { name: 'Versão nova' });
    expect(notice).toHaveTextContent('A versão 1.1.0 do Teleprompter está disponível.');

    fireEvent.click(within(notice).getByRole('button', { name: 'Baixar e instalar' }));
    expect(invokesOn(bridge, 'cmd:update')).toEqual([{ op: 'download' }]);

    fireEvent.click(within(notice).getByRole('button', { name: 'Fechar' }));
    expect(invokesOn(bridge, 'cmd:update')).toEqual([{ op: 'download' }, { op: 'dismiss' }]);
    // O principal guarda o "Fechar" e manda o estado sem o aviso.
    bridge.emit('state:snapshot', snapshotWith({ update: null }));
    expect(screen.queryByRole('status', { name: 'Versão nova' })).toBeNull();
  });

  it('sem update, não há aviso', () => {
    renderApp();
    expect(screen.queryByRole('status', { name: 'Versão nova' })).toBeNull();
  });

  it('mostra o progresso do download e a falha', () => {
    const { bridge } = renderApp(snapshotWith({ update: { ...UPDATE, progress: 42 } }));
    const bar = screen.getByRole('progressbar', { name: 'Baixando a versão nova' });
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByRole('button', { name: 'Baixando 42%' })).toBeDisabled();

    bridge.emit('state:snapshot', snapshotWith({ update: { ...UPDATE, error: 'Não foi possível baixar a versão nova' } }));
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível baixar a versão nova');
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Baixar e instalar' })).toBeEnabled();
  });
});

describe('aba Sobre', () => {
  it('mostra a versão do build, o motor de voz, o atraso médio e a assinatura da Chiaro', () => {
    const { bridge } = renderApp(snapshotWith({ voice: { state: 'listening', fault: null, engine: 'vosk', mode: 'near', lagMs: 820 } }));
    fireEvent.click(screen.getByRole('tab', { name: 'Sobre' }));
    expect(screen.getByTestId('about-version')).toHaveTextContent(`v${__APP_VERSION__}`);
    expect(screen.getByTestId('about-version')).toHaveTextContent('v1.1.0');
    expect(screen.getByTestId('about-engine')).toHaveTextContent('Vosk');
    expect(screen.getByTestId('about-lag')).toHaveTextContent('0,8 s');

    const signature = screen.getByLabelText('um produto Chiaro Filmes');
    expect(signature).toHaveTextContent('um produto');
    const logo = within(signature).getByRole('img', { name: 'Chiaro Filmes' });
    expect(logo.getAttribute('src')).toBe('../chiaro/assets/logos/chiaro-filmes-horizontal-white.png');

    fireEvent.click(screen.getByRole('button', { name: 'Abrir pasta de registros' }));
    expect(invokesOn(bridge, 'cmd:openLogs')).toEqual([null]);
  });

  it('sem medição da voz, diz como medir', () => {
    expect(lagLabel(null)).toBe('Sem medição. Ligue a voz para medir');
    expect(lagLabel(1250)).toBe('1,3 s');
  });

  it('UT-241: "Voltar ao padrão" abre o Dialog, e só o botão do diálogo envia cmd:settings resetAll', () => {
    const { bridge } = renderApp();
    fireEvent.click(screen.getByRole('tab', { name: 'Sobre' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão' }));
    expect(invokesOn(bridge, 'cmd:settings')).toEqual([]);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('velocidade 1,00x');
    expect(dialog).toHaveTextContent('"Perto"');
    expect(dialog).toHaveTextContent('Vosk');
    expect(dialog).toHaveTextContent('saídas sem inversão');

    // Cancelar não muda nada.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(invokesOn(bridge, 'cmd:settings')).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao padrão' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Voltar ao padrão' }));
    expect(invokesOn(bridge, 'cmd:settings')).toEqual([{ op: 'resetAll' }]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
