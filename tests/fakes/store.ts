/**
 * `AppStore` de teste: plataforma falsa, relógio falso e um respondedor de
 * `layout:request` que diagrama com `layoutScript` e `measure` de 10 px por caractere.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LayoutRequest } from '@shared/ipc';
import { layoutScript } from '@shared/layout';
import type { MotionSegment } from '@shared/motion';
import type { LayoutResult, StateSnapshot } from '@shared/types';
import { RecoveryStore } from '../../src/main/recovery';
import type { FileSystem } from '../../src/main/safe-write';
import { ScriptFiles } from '../../src/main/script-files';
import { SettingsStore } from '../../src/main/settings';
import { AppStore } from '../../src/main/store';
import { measure10 } from './layouts';
import { createFakePlatform, type FakePlatform } from './platform';
import { createFakeScheduler, type FakeScheduler } from './scheduler';

export interface TestStore {
  store: AppStore;
  settings: SettingsStore;
  platform: FakePlatform;
  clock: FakeScheduler;
  userDataDir: string;
  requests: LayoutRequest[];
  segments: MotionSegment[];
  snapshots: StateSnapshot[];
  logs: { event: string; fields?: Record<string, unknown> }[];
  /** Responde ao pedido de diagramação mais novo (no modo manual). */
  respond(req?: LayoutRequest): LayoutResult;
  last(): StateSnapshot;
}

export interface TestStoreOptions {
  fs?: FileSystem;
  userDataDir?: string;
  /** Responde a todo `layout:request` na hora (padrão: sim). */
  autoLayout?: boolean;
  init?: boolean;
}

export async function createTestStore(options: TestStoreOptions = {}): Promise<TestStore> {
  const platform = createFakePlatform();
  const clock = createFakeScheduler(1_000_000);
  const userDataDir = options.userDataDir ?? mkdtempSync(join(tmpdir(), 'tp-store-'));
  const logs: TestStore['logs'] = [];
  const log = (event: string, fields?: Record<string, unknown>): void => void logs.push({ event, fields });
  const settings = new SettingsStore({ userDataDir, log });
  const store = new AppStore({
    files: new ScriptFiles({ dialog: platform.dialog, fs: options.fs }),
    settings,
    recovery: new RecoveryStore(userDataDir, options.fs),
    scheduler: clock,
    now: () => clock.now,
    log,
  });
  const requests: LayoutRequest[] = [];
  const segments: MotionSegment[] = [];
  const snapshots: StateSnapshot[] = [];
  const respond = (req: LayoutRequest = requests.at(-1)!): LayoutResult => {
    const layout = layoutScript(req.text, req.appearance, measure10, { revision: req.revision });
    store.layoutResult(layout);
    return layout;
  };
  store.onLayoutRequest((r) => {
    requests.push(r);
    if (options.autoLayout !== false) respond(r);
  });
  store.onSegment((s) => segments.push(s));
  store.onSnapshot((s) => snapshots.push(s));
  if (options.init !== false) await store.init();
  return { store, settings, platform, clock, userDataDir, requests, segments, snapshots, logs, respond, last: () => store.snapshot() };
}
