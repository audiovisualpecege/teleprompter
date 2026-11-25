/**
 * Lado da janela de controle da voz (TechSpec, "Voz"; ADR-007): executa os comandos
 * `voice:run` do `VoiceController` (principal) com a captura e o motor reais, e devolve
 * `asr:ready`, `asr:hypothesis`, `asr:fault` e `asr:lag` com a sessão que os gerou.
 *
 * - Roda fora do React, criado junto com a janela: a voz continua com a janela minimizada
 *   e com qualquer aba aberta (US-014 EC-1; a janela tem `backgroundThrottling: false`).
 * - Os comandos rodam em fila, na ordem. Uma sessão trocada no meio de um carregamento faz
 *   o carregamento antigo terminar em silêncio (ligar e desligar seguidos, US-028 EC-4).
 * - Lista as entradas de áudio pelo nome do sistema (`enumerateDevices`) e manda a lista
 *   ao principal na abertura e a cada `devicechange` (US-029 EC-3).
 * - O nível do microfone fica aqui, para o medidor da tela de voz; com a voz desligada, a
 *   tela de voz aberta liga a captura só para o medidor (US-029 AC-2).
 * - O áudio nunca sai do computador: vai só ao motor local.
 */
import type { ControlBridge, VoiceRunCommand } from '@shared/ipc';
import type { EngineFault, EngineId, MicDevice } from '@shared/types';
import type { AudioSource, SpeechEngine } from './asr/engine';
import type { CaptureFault } from './audio/capture';

/** O que a voz usa da captura (a `AudioCapture` real ou uma falsa nos testes). */
export interface CaptureLike extends AudioSource {
  start(deviceId: string | null): Promise<CaptureFault | null>;
  stop(): Promise<void>;
  onLevel(cb: (rms: number) => void): () => void;
  onFault(cb: (f: CaptureFault, detail?: string) => void): () => void;
}

/** O que a voz usa de `navigator.mediaDevices`. */
export interface MediaDevicesLike {
  enumerateDevices(): Promise<Pick<MediaDeviceInfo, 'deviceId' | 'kind' | 'label' | 'groupId'>[]>;
  addEventListener(type: 'devicechange', cb: () => void): void;
  removeEventListener(type: 'devicechange', cb: () => void): void;
}

export type RuntimeEngine = SpeechEngine & { dispose?(): void };

export interface VoiceRuntimeDeps {
  bridge: Pick<ControlBridge, 'send' | 'on'>;
  capture: CaptureLike;
  createEngine(id: EngineId): RuntimeEngine;
  media: MediaDevicesLike | null;
}

/** Entradas virtuais do Chromium no Windows, que repetem uma entrada real. */
const VIRTUAL_IDS = new Set(['default', 'communications']);

/** Entradas de áudio pelo nome do sistema, sem as entradas virtuais repetidas. */
export function micDevices(list: readonly Pick<MediaDeviceInfo, 'deviceId' | 'kind' | 'label'>[]): MicDevice[] {
  const out: MicDevice[] = [];
  for (const d of list) {
    if (d.kind !== 'audioinput' || !d.deviceId || VIRTUAL_IDS.has(d.deviceId)) continue;
    out.push({ deviceId: d.deviceId, label: d.label || `Microfone ${out.length + 1}` });
  }
  return out;
}

export class VoiceRuntime {
  private session = 0;
  private engine: RuntimeEngine | null = null;
  private engineOffs: (() => void)[] = [];
  private queue: Promise<void> = Promise.resolve();
  private devices: MicDevice[] = [];
  private level = 0;
  private monitorWanted: { deviceId: string | null } | null = null;
  private monitoring = false;
  /** Hora (`Date.now()`) do último `asr:ready`: quando a captura começou a ouvir. */
  private readyAt: number | null = null;
  /** Só no build de teste: o microfone simulado foi "desligado". */
  private unplugged = false;
  private readonly levelListeners = new Set<(rms: number) => void>();
  private readonly deviceListeners = new Set<(list: MicDevice[]) => void>();
  private readonly offs: (() => void)[] = [];

  constructor(private readonly deps: VoiceRuntimeDeps) {
    const { bridge, capture, media } = deps;
    this.offs.push(
      bridge.on('voice:run', (cmd) => this.handle(cmd)),
      capture.onLevel((rms) => {
        this.level = rms;
        this.levelListeners.forEach((cb) => cb(rms));
      }),
      capture.onFault((f, detail) => {
        if (this.session) this.sendFault(f, detail);
        else this.monitoring = false;
      }),
    );
    if (media) {
      const onChange = (): void => void this.refreshDevices();
      media.addEventListener('devicechange', onChange);
      this.offs.push(() => media.removeEventListener('devicechange', onChange));
    }
    void this.refreshDevices();
  }

  /* ---------- Comandos do principal ---------- */

  handle(cmd: VoiceRunCommand): void {
    switch (cmd?.op) {
      case 'start':
        this.session = cmd.session;
        this.enqueue(() => this.start(cmd));
        break;
      case 'stop':
        this.session = 0;
        this.enqueue(async () => {
          await this.deps.capture.stop();
          this.monitoring = false;
          await this.engine?.stop().catch(() => undefined);
          await this.syncMonitor();
        });
        break;
      case 'setVocabulary':
        if (cmd.session === this.session) this.engine?.setVocabulary(cmd.vocabulary);
        break;
      case 'setMic':
        if (cmd.session !== this.session) return;
        // Troca só a captura: o motor continua carregado e ouvindo (US-029 EC-2).
        this.enqueue(async () => {
          if (cmd.session !== this.session) return;
          await this.deps.capture.start(cmd.deviceId);
        });
        break;
    }
  }

  private async start(cmd: Extract<VoiceRunCommand, { op: 'start' }>): Promise<void> {
    const stale = (): boolean => cmd.session !== this.session;
    if (stale()) return;
    const engine = this.engineFor(cmd.engine);
    try {
      await engine.load();
    } catch (e) {
      if (!stale()) this.sendFault('engine-crashed', e instanceof Error ? e.message : String(e));
      return;
    }
    if (stale()) return;
    await engine.start(this.deps.capture, cmd.vocabulary);
    if (stale()) return;
    this.monitoring = false;
    const fault = await this.deps.capture.start(cmd.deviceId);
    if (stale()) return;
    // A falha da captura já foi mandada pelo `onFault`.
    if (fault) return;
    this.readyAt = Date.now();
    this.deps.bridge.send('asr:ready', { session: cmd.session });
  }

  /** O motor pedido; trocar de motor desliga o anterior de vez. */
  private engineFor(id: EngineId): RuntimeEngine {
    if (this.engine?.id === id) return this.engine;
    this.engineOffs.splice(0).forEach((off) => off());
    if (this.engine) {
      const old = this.engine;
      void old.stop().catch(() => undefined);
      old.dispose?.();
    }
    const engine = this.deps.createEngine(id);
    this.engine = engine;
    this.engineOffs.push(
      engine.onHypothesis((h) => {
        if (this.session && this.engine === engine) this.deps.bridge.send('asr:hypothesis', { ...h, session: this.session });
      }),
      engine.onFault((f, detail) => {
        if (this.session && this.engine === engine) this.sendFault(f, detail);
      }),
      engine.onLag((lagMs) => {
        if (this.session && this.engine === engine) this.deps.bridge.send('asr:lag', { session: this.session, lagMs });
      }),
    );
    return engine;
  }

  private sendFault(fault: EngineFault, detail?: string): void {
    this.deps.bridge.send('asr:fault', { session: this.session, fault, ...(detail ? { detail } : {}) });
  }

  private enqueue(fn: () => Promise<void>): void {
    const run = (): Promise<void> =>
      fn().catch((e: unknown) => {
        console.error('Voz: comando falhou', e);
      });
    this.queue = this.queue.then(run, run);
  }

  /** Espera a fila de comandos (testes). */
  idle(): Promise<void> {
    return this.queue;
  }

  /* ---------- Microfones ---------- */

  async refreshDevices(): Promise<MicDevice[]> {
    const media = this.deps.media;
    let list: MicDevice[] = [];
    if (media) {
      try {
        list = micDevices(await media.enumerateDevices());
      } catch (e) {
        console.error('Voz: não deu para listar os microfones', e);
      }
    }
    if (this.unplugged) list = [];
    this.devices = list;
    this.deps.bridge.send('voice:devices', { devices: list });
    this.deviceListeners.forEach((cb) => cb(list));
    return list;
  }

  get deviceList(): MicDevice[] {
    return this.devices;
  }

  onDevices(cb: (list: MicDevice[]) => void): () => void {
    this.deviceListeners.add(cb);
    return () => this.deviceListeners.delete(cb);
  }

  /* ---------- Medidor de nível ---------- */

  get lastReadyAt(): number | null {
    return this.readyAt;
  }

  get currentLevel(): number {
    return this.level;
  }

  onLevel(cb: (rms: number) => void): () => void {
    this.levelListeners.add(cb);
    return () => this.levelListeners.delete(cb);
  }

  /**
   * A tela de voz aberta pede o medidor. Com a voz desligada, a captura liga só para o
   * nível, no microfone escolhido; com a voz ligada, o medidor usa a captura da voz.
   */
  monitor(deviceId: string | null | undefined): void {
    this.monitorWanted = deviceId === undefined ? null : { deviceId };
    if (deviceId === undefined) this.level = 0;
    this.enqueue(() => this.syncMonitor());
  }

  private async syncMonitor(): Promise<void> {
    if (this.session) return;
    const want = this.monitorWanted;
    if (!want) {
      if (this.monitoring) {
        this.monitoring = false;
        await this.deps.capture.stop();
      }
      return;
    }
    this.monitoring = true;
    const fault = await this.deps.capture.start(want.deviceId);
    if (fault) this.monitoring = false;
  }

  /* ---------- Microfone simulado (só no build de teste) ---------- */

  /** O microfone "some": a trilha termina (`mic-lost`) e ele sai da lista. */
  simulateUnplug(): void {
    this.unplugged = true;
    const fault: CaptureFault = 'mic-lost';
    void this.deps.capture.stop().then(() => {
      if (this.session) this.sendFault(fault, 'microfone simulado desligado');
      void this.refreshDevices();
    });
  }

  /** O microfone "volta": a lista é mandada de novo, como num `devicechange`. */
  simulateReplug(): Promise<MicDevice[]> {
    this.unplugged = false;
    return this.refreshDevices();
  }

  dispose(): void {
    this.session = 0;
    this.offs.splice(0).forEach((off) => off());
    this.engineOffs.splice(0).forEach((off) => off());
    void this.deps.capture.stop();
    this.engine?.dispose?.();
    this.engine = null;
  }
}
