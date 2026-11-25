/**
 * Tela de voz, na aba "Voz" (US-028, US-029, US-032; ADR-003 e ADR-007):
 * - o microfone, pelos nomes de `enumerateDevices`, atualizados a cada `devicechange`,
 *   inclusive as várias entradas de uma mesma interface de áudio;
 * - o medidor de nível, uma barra em pílula com `--gradient-chiaro`, para conferir que o
 *   som chega (com a voz desligada, a captura liga só para o medidor enquanto a aba está aberta);
 * - o motor: Vosk (padrão) e Parakeet, só onde ele carrega;
 * - o modo: "Perto" (padrão) e "Pulos para a frente".
 * Tudo fica guardado em `ajustes.json`, pelo principal.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { VoiceCommand } from '@shared/ipc';
import type { EngineId, MicDevice, VoiceMode } from '@shared/types';
import { MIC_MISSING_NOTICE, VOICE_STATE_LABEL } from '@shared/voice';
import { Radio, Select } from '../shared/ui/chiaro';
import { useControlStore, useSnapshot } from './hooks';

/** Valor do seletor para "o microfone padrão do sistema". */
const DEFAULT_MIC = '';

const ENGINES: { value: EngineId; label: string; hint: string }[] = [
  { value: 'vosk', label: 'Vosk', hint: 'Padrão. Leve, acompanha só as palavras do roteiro.' },
  { value: 'parakeet', label: 'Parakeet', hint: 'Mais preciso em algumas vozes, pede um computador mais forte.' },
];

const MODES: { value: VoiceMode; label: string; hint: string }[] = [
  { value: 'near', label: 'Perto', hint: 'Padrão. O texto só avança um pouco à frente; um pulo grande espera você levar o texto ao ponto certo.' },
  { value: 'forwardJumps', label: 'Pulos para a frente', hint: 'O texto também salta para uma frase dita com clareza mais à frente.' },
];

/** Microfones da janela, atualizados a cada `devicechange`. */
function useMics(): MicDevice[] {
  const store = useControlStore();
  const voice = store.voice;
  const [list, setList] = useState<MicDevice[]>(() => voice?.deviceList ?? []);
  useEffect(() => {
    if (!voice) return undefined;
    setList(voice.deviceList);
    return voice.onDevices(setList);
  }, [voice]);
  return list;
}

/** Nível do microfone (0 a 1), para o medidor. */
function useLevel(): number {
  const voice = useControlStore().voice;
  return useSyncExternalStore(
    (cb) => voice?.onLevel(cb) ?? (() => undefined),
    () => voice?.currentLevel ?? 0,
  );
}

/** RMS para a largura da barra: a fala comum fica no meio, sem precisar gritar. */
export function levelPercent(rms: number): number {
  if (!Number.isFinite(rms) || rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  return Math.round(Math.min(1, Math.max(0, (db + 60) / 60)) * 100);
}

export function LevelMeter({ level }: { level: number }) {
  const pct = levelPercent(level);
  return (
    <div className="tp-level" role="meter" aria-label="Nível do microfone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="tp-level-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function VoicePanel() {
  const store = useControlStore();
  const snapshot = useSnapshot();
  const { voice, voiceSetup, notices } = snapshot;
  const mics = useMics();
  const level = useLevel();
  const send = (cmd: VoiceCommand): void => {
    void store.bridge?.invoke('cmd:voice', cmd).catch(() => undefined);
  };

  // Medidor com a voz desligada: a captura liga só enquanto a aba está aberta.
  const voiceOn = voice.state !== 'off';
  const selected = voiceSetup.micDeviceId;
  useEffect(() => {
    const v = store.voice;
    if (!v || voiceOn) return undefined;
    const present = selected === null || mics.some((m) => m.deviceId === selected);
    if (!present) return undefined;
    v.monitor(selected);
    return () => v.monitor(undefined);
  }, [store, voiceOn, selected, mics]);

  const missing = selected !== null && !mics.some((m) => m.deviceId === selected);
  const options = [
    { value: DEFAULT_MIC, label: 'Padrão do sistema' },
    ...mics.map((m) => ({ value: m.deviceId, label: m.label })),
    ...(missing ? [{ value: selected, label: `${voiceSetup.micLabel ?? 'Microfone guardado'} (não está ligado)` }] : []),
  ];

  return (
    <div className="tp-voice-panel">
      <section aria-label="Microfone">
        <h3 className="tp-section-label">Microfone</h3>
        <Select
          label="Entrada de áudio"
          options={options}
          value={selected ?? DEFAULT_MIC}
          onChange={(e) => send({ op: 'setMic', deviceId: e.target.value })}
        />
        {mics.length === 0 && <p className="tp-field-error">Nenhum microfone encontrado. Ligue um microfone para usar a voz</p>}
        {missing && notices.some((n) => n.id === MIC_MISSING_NOTICE) && (
          <p className="tp-field-error" role="status">
            O microfone guardado não está ligado. Escolha outro na lista
          </p>
        )}
        <div className="tp-level-row">
          <span className="tp-field-label">Nível</span>
          <LevelMeter level={level} />
        </div>
        <p className="tp-muted">Fale perto do microfone: a barra deve chegar ao meio.</p>
      </section>
      <section aria-label="Motor de voz">
        <fieldset className="tp-fieldset tp-voice-choices">
          <legend className="tp-field-label">Motor</legend>
          {ENGINES.map((e) => {
            const available = voiceSetup.engines.includes(e.value);
            return (
              <div key={e.value} className="tp-voice-choice">
                <Radio
                  name="voiceEngine"
                  value={e.value}
                  label={e.label}
                  disabled={!available}
                  checked={voice.engine === e.value}
                  onChange={(on) => on && send({ op: 'setEngine', engine: e.value })}
                />
                <span className="tp-muted">{available ? e.hint : (voiceSetup.parakeetUnavailable ?? 'Não carrega neste computador.')}</span>
              </div>
            );
          })}
        </fieldset>
      </section>
      <section aria-label="Modo da voz">
        <fieldset className="tp-fieldset tp-voice-choices">
          <legend className="tp-field-label">Modo</legend>
          {MODES.map((m) => (
            <div key={m.value} className="tp-voice-choice">
              <Radio
                name="voiceMode"
                value={m.value}
                label={m.label}
                checked={voice.mode === m.value}
                onChange={(on) => on && send({ op: 'setMode', mode: m.value })}
              />
              <span className="tp-muted">{m.hint}</span>
            </div>
          ))}
        </fieldset>
      </section>
      <p className="tp-muted tp-voice-now" data-testid="voice-panel-state">
        Voz agora: {VOICE_STATE_LABEL[voice.state]}. O áudio é processado só neste computador.
      </p>
    </div>
  );
}
