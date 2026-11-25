/**
 * Ponto de entrada dos ganchos de teste das janelas, que só existem no build de
 * teste (`__TP_TEST__`). No build de produção estas funções não fazem nada e o
 * `installTestHooks` some do pacote.
 *
 * - `window.__tpProbe(nome?)`: lê o que a janela desenhou (cada tarefa acrescenta
 *   as suas leituras com `registerProbe`).
 * - `window.__tpTest.<nome>(...)`: ações de teste. As registradas na janela com
 *   `registerTestAction` rodam aqui; as demais vão ao principal (`registerTestHook`).
 */
type Probe = () => unknown;
type Action = (...args: unknown[]) => unknown;

const probes = new Map<string, Probe>();
const actions = new Map<string, Action>();

export function registerProbe(name: string, fn: Probe): void {
  if (!__TP_TEST__) return;
  probes.set(name, fn);
}

export function registerTestAction(name: string, fn: Action): void {
  if (!__TP_TEST__) return;
  actions.set(name, fn);
}

export function installTestHooks(role: 'control' | 'output'): void {
  if (!__TP_TEST__) return;
  registerProbe('role', () => role);
  registerProbe('version', () => __APP_VERSION__);
  registerProbe('theme', () => document.documentElement.dataset.theme ?? null);
  registerProbe('background', () => getComputedStyle(document.body).backgroundColor);
  registerProbe('colorScheme', () => getComputedStyle(document.body).colorScheme);
  // Estado do bloqueio de proteção de tela, que mora no principal (devolve uma promessa).
  registerProbe('powerBlocker', () => window.__tpTestBridge?.call('powerBlocker'));

  window.__tpProbe = (name?: string) => {
    if (name !== undefined) return probes.get(name)?.();
    return Object.fromEntries([...probes].map(([k, f]) => [k, f()]));
  };
  window.__tpTest = new Proxy({} as Record<string, Action>, {
    get(_target, name) {
      if (typeof name !== 'string') return undefined;
      const local = actions.get(name);
      if (local) return local;
      return (...args: unknown[]) => window.__tpTestBridge?.call(name, ...args);
    },
  });
}
