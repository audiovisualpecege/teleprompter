/**
 * Estúdio de teste: `screen` falso com os monitores "A" (controle, 1920 x 1080), "B"
 * (1920 x 1080) e "C" (1280 x 1024), a janela de controle em A, ajustes em pasta
 * temporária e o `OutputManager` real com relógio falso (`_tests.md`, "DisplayRegistry,
 * OutputManager e PowerGuard").
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_APPEARANCE } from '@shared/defaults';
import type { NoticeKind, SavedOutput } from '@shared/types';
import { DisplayRegistry } from '../../src/main/displays';
import { OutputManager, type OutputManagerOptions } from '../../src/main/outputs';
import type { PlatformDisplay } from '../../src/main/platform';
import { SettingsStore } from '../../src/main/settings';
import { createFakePlatform, fakeDisplay, type FakePlatform, type FakeWindow } from './platform';
import { createFakeScheduler, type FakeScheduler } from './scheduler';

export const A = (): PlatformDisplay => fakeDisplay(1, 'A', 0);
export const B = (): PlatformDisplay => fakeDisplay(2, 'B', 1920);
export const C = (): PlatformDisplay => fakeDisplay(3, 'C', 3840, 1280, 1024);
export const keyOf = (d: PlatformDisplay): string => `${d.id}|${d.label}|${d.size.width}x${d.size.height}`;

export interface TestStudio {
  platform: FakePlatform;
  settings: SettingsStore;
  clock: FakeScheduler;
  registry: DisplayRegistry;
  manager: OutputManager;
  control: FakeWindow;
  notices: { id: string; kind: NoticeKind; message: string }[];
  logs: { event: string; fields?: Record<string, unknown> }[];
  /** Janelas de cada saída, na ordem em que foram criadas. */
  windowsOf(id: number): FakeWindow[];
  /** Janelas de saída ainda abertas. */
  liveOutputWindows(): FakeWindow[];
  /** A página de cada janela de saída aberta termina de carregar. */
  loadAll(): void;
}

export interface TestStudioOptions {
  displays?: PlatformDisplay[];
  saved?: SavedOutput[];
  isMac?: boolean;
  /** Onde a janela de controle começa (padrão: dentro de A). */
  controlAt?: { x: number; y: number };
  manager?: Partial<OutputManagerOptions>;
}

export function createTestStudio(options: TestStudioOptions = {}): TestStudio {
  const platform = createFakePlatform(options.displays ?? [A(), B(), C()]);
  const settings = new SettingsStore({ userDataDir: mkdtempSync(join(tmpdir(), 'tp-studio-')) });
  settings.load();
  if (options.saved) void settings.update({ outputs: options.saved });
  const clock = createFakeScheduler(0);
  const at = options.controlAt ?? { x: 320, y: 130 };
  const control = platform.windows.create({ ...at, width: 1280, height: 820 }) as FakeWindow;
  const registry = new DisplayRegistry(platform.screen);
  const notices: TestStudio['notices'] = [];
  const logs: TestStudio['logs'] = [];
  const byOutput = new Map<number, FakeWindow[]>();
  const manager = new OutputManager({
    platform,
    displays: registry,
    settings,
    scheduler: clock,
    now: () => clock.now,
    paths: { mainDir: '/app/out/main', icon: '/app/icone.png' },
    isMac: options.isMac ?? false,
    controlWindow: () => control,
    appearance: () => ({ ...DEFAULT_APPEARANCE }),
    notices: {
      add: (id, kind, message) => {
        const i = notices.findIndex((n) => n.id === id);
        if (i >= 0) notices.splice(i, 1);
        notices.push({ id, kind, message });
      },
      remove: (id) => {
        const i = notices.findIndex((n) => n.id === id);
        if (i >= 0) notices.splice(i, 1);
      },
    },
    log: (event, fields) => void logs.push({ event, fields }),
    onWindow: (win, id) => byOutput.set(id, [...(byOutput.get(id) ?? []), win as FakeWindow]),
    ...options.manager,
  });
  const outputWindows = (): FakeWindow[] => platform.created.filter((w) => w !== control);
  return {
    platform,
    settings,
    clock,
    registry,
    manager,
    control,
    notices,
    logs,
    windowsOf: (id) => byOutput.get(id) ?? [],
    liveOutputWindows: () => outputWindows().filter((w) => !w.isDestroyed()),
    loadAll: () => outputWindows().filter((w) => !w.isDestroyed()).forEach((w) => w.emitWeb('did-finish-load')),
  };
}

/** O último `state:output` recebido por uma janela. */
export function lastView(w: FakeWindow): Record<string, unknown> | undefined {
  return w.sent.filter((m) => m.channel === 'state:output').at(-1)?.args[0] as Record<string, unknown> | undefined;
}
