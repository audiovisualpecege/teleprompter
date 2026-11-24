---
status: pending
title: Prova da voz, motores Vosk e Parakeet e alinhador
type: backend
complexity: high
---

# Task 2: Prova da voz, motores Vosk e Parakeet e alinhador

## Overview
Entrega a parte de risco da voz antes do resto: captura de áudio, os dois motores locais atrás da interface `SpeechEngine` (Vosk pequeno em português num Worker e Parakeet v3 num `utilityProcess`), o alinhador `VoiceTracker` e o script que baixa e confere os modelos. Com gravações reais da equipe, mede precisão e atraso e calibra as constantes de voz e o `BASE_WPM`, gravando os valores finais em `defaults.ts` e na TechSpec, como a TechSpec pede para a "tarefa 2".

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details: do not duplicate here
- FOCUS ON "WHAT": describe what needs to be accomplished, not how
- MINIMIZE CODE: show code only to illustrate current structure or problem areas
- TESTS REQUIRED: implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST implementar `scripts/baixar-modelos.mjs`, que baixa das fontes oficiais o modelo Vosk pequeno em português e o Parakeet v3 (formato do `sherpa-onnx`) para `resources/models/`, confere cada arquivo por SHA-256 fixado no script e falha com mensagem clara se o hash não bater. `resources/models/` fica fora do git.
2. MUST implementar o `AudioCapture` (`getUserMedia` com o `deviceId` escolhido, `AudioWorklet` que reamostra para 16 kHz mono e medidor de nível RMS) e traduzir `NotAllowedError`, `NotFoundError` e o `ended` da trilha nas falhas `mic-denied`, `no-mic` e `mic-lost`.
3. MUST implementar a interface `SpeechEngine` de `src/renderer/control/asr/engine.ts` exatamente como na TechSpec, com `VoskEngine` (`vosk-browser` num Worker, gramática restrita ao vocabulário do roteiro mais `[unk]`, resultados parciais viram `Hypothesis` com `final: false`) e `ParakeetEngine` (repassa PCM ao `ParakeetHost` por `MessagePort` e emite `lag` igual a `agora - audioEndMs`).
4. MUST implementar o `ParakeetHost` em `src/main/parakeet-host.ts` como `utilityProcess` com `sherpa-onnx-node`, carregado só quando o Parakeet está ativo, com intervalo de decodificação adaptativo (cresce quando a decodificação demora). Saída inesperada do processo ou erro no Worker do Vosk viram `engine-crashed`.
5. MUST implementar `src/main/voice-tracker.ts` como função pura `track()` mais `resyncFromBand()`, com os modos "Perto" e "Pulos para a frente" do algoritmo "Voz" da TechSpec (janela curta, duas de três palavras em ordem, palavra longa isolada, sequência única de 5 palavras com semelhança mínima, nunca para trás, `[unk]` ignorado, números por extenso via `text.ts`).
6. MUST conferir, no Windows x64 e no Mac x64 e arm64, que o `vosk-browser` aceita vocabulário restrito e resultados parciais dentro do Electron e que o `sherpa-onnx-node` carrega. Se o Parakeet não carregar numa plataforma, ele some da lista dessa plataforma com aviso e o Vosk continua; se o `vosk-browser` falhar, aplicar o plano B da TechSpec (Vosk no `utilityProcess`) sem mudar `SpeechEngine`.
7. MUST medir, com no mínimo 3 gravações reais de pessoas da equipe (WAV com o texto lido, incluindo leitura contínua, improviso e trecho pulado), a precisão do alinhador e o atraso mediano e p95 de cada motor, e guardar essas gravações como fixtures em `tests/fixtures/voz/` (`leitura-continua.wav`, `improviso.wav`, `trecho-pulado.wav`, `leitura-com-improviso.wav`, cada uma com o roteiro e as marcas de fim de palavra).
8. MUST calibrar `NEAR_WINDOW_TOKENS`, `MIN_MATCH_RUN`, `JUMP_MIN_RUN`, `WORD_SIMILARITY`, `WAITING_AFTER_MS` e `BASE_WPM` com essas medições, gravar os valores finais em `src/shared/defaults.ts` e atualizar a tabela "Constantes de comportamento" do `_techspec.md` com o resultado e a data.
9. MUST manter todo o áudio no computador: nada de áudio, texto ou modelo é enviado para fora.
10. SHOULD registrar no log `voice.lag` (p50 e p95 por minuto) e `voice.engineRestart`.
</requirements>

## Subtasks
- [ ] 2.1 Baixar e conferir os modelos Vosk e Parakeet por um script reproduzível.
- [ ] 2.2 Capturar o áudio do microfone escolhido em 16 kHz mono, com medidor de nível e falhas traduzidas.
- [ ] 2.3 Implementar o motor Vosk com vocabulário restrito ao roteiro atrás de `SpeechEngine`.
- [ ] 2.4 Implementar o motor Parakeet no processo separado atrás de `SpeechEngine`, com medição de atraso.
- [ ] 2.5 Implementar o alinhador puro com os modos "Perto" e "Pulos para a frente".
- [ ] 2.6 Confirmar os dois motores nas três plataformas e aplicar o plano B onde precisar.
- [ ] 2.7 Gravar as fixtures de voz com a equipe e medir precisão e atraso de cada motor.
- [ ] 2.8 Calibrar as constantes de voz e o `BASE_WPM` e registrar os valores finais na TechSpec.

## Implementation Details
Siga as seções "Interfaces centrais" (`SpeechEngine`, `TrackerInput`, `TrackerResult`), "Algoritmos principais: Voz", "Constantes de comportamento", "Riscos conhecidos" e "Abordagem de testes" da TechSpec.

Arquivos a criar: `scripts/baixar-modelos.mjs`, `src/renderer/control/audio/` (captura, worklet, medidor), `src/renderer/control/asr/engine.ts`, `src/renderer/control/asr/vosk-engine.ts` e o Worker, `src/renderer/control/asr/parakeet-engine.ts`, `src/main/parakeet-host.ts`, `src/main/voice-tracker.ts`, fixtures em `tests/fixtures/voz/`. Arquivos a modificar: `src/shared/defaults.ts`, `package.json` (dependências e `test:voice`), `.gitignore` (`resources/models/`), `_techspec.md` (constantes finais).

O `VoiceController`, a tela de voz e o sinal nas saídas são da tarefa da voz completa; aqui os motores e o alinhador são exercitados por testes e por um roteiro de medição.

Dependência externa: as gravações reais da equipe (ao menos 3 pessoas lendo um roteiro conhecido, com improviso e um trecho pulado). Sem elas a calibração não fecha; registre no próprio task file quem gravou e quando.

### Relevant Files
- `src/shared/text.ts`: `normalizeTokens` e `buildVocabulary`, base do vocabulário e do alinhador (tarefa 1).
- `src/shared/defaults.ts`: constantes iniciais que esta tarefa recalibra (tarefa 1).
- `src/shared/ipc.ts`: canais `asr:hypothesis`, `asr:fault`, `asr:lag`, `asr:ready` e `asr:pcm` (tarefa 1).
- `electron-builder.yml`: `extraResources` dos modelos (tarefa 1).
- `.compozy/tasks/034-teleprompter-para-uso-interno/adrs/adr-003.md` e `adr-007.md`: comportamento do alinhador e escolha dos motores.

### Dependent Files
- `src/main/voice-controller.ts`: consome os motores e o alinhador na tarefa da voz completa.
- `src/renderer/control/` (tela de voz): usa o medidor de nível e a lista de motores disponíveis.
- `.github/workflows/release.yml`: passa a rodar `baixar-modelos` antes do empacotamento.
- `_techspec.md`: tabela de constantes atualizada.

### Related ADRs
- [ADR-003: A voz acompanha só um pouco à frente, com modo de pulos para a frente selecionável](adrs/adr-003.md): regras do alinhador.
- [ADR-007: Voz com Vosk pequeno em português como padrão e Parakeet v3 escolhível, atrás de uma peça trocável](adrs/adr-007.md): motores, `SpeechEngine` e alinhador próprio.

## Deliverables
- Script de modelos com SHA-256 fixado e modelos fora do git.
- `AudioCapture`, `VoskEngine`, `ParakeetEngine` e `ParakeetHost` funcionando nas três plataformas (ou com o Parakeet retirado, com aviso, onde não carregar).
- `VoiceTracker` puro com os dois modos.
- Fixtures de voz gravadas pela equipe e relatório de precisão e atraso por motor, anotado neste arquivo.
- Constantes calibradas em `defaults.ts` e na TechSpec.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract: read each ID's full definition there before writing tests.

- [ ] UT-063, UT-064, UT-065, UT-066, UT-067, UT-068, UT-069, UT-070, UT-071, UT-072, UT-073, UT-074, UT-075, UT-076, UT-077, UT-078, UT-079, UT-080: alinhador nos modos "Perto" e "Pulos para a frente".
- [ ] UT-105, UT-106, UT-107, UT-108, UT-109: captura, reamostragem, falhas de microfone e medidor de nível.
- [ ] UT-110, UT-111, UT-112, UT-113: motores Vosk e Parakeet, falhas e medição de atraso.
- [ ] IT-012: Vosk real com leitura contínua, cobertura do roteiro e atraso mediano.
- [ ] IT-015: Parakeet real no job noturno, atraso mediano e p95.
- [ ] IT-016: trecho pulado no modo "Pulos para a frente" com áudio real.

## Success Criteria
- Every assigned test case implemented and passing
- Com o Vosk e a leitura contínua, o cursor chega a pelo menos 90% dos tokens, com atraso mediano abaixo de 1.000 ms.
- O alinhador nunca devolve cursor menor que o de entrada, em nenhum teste.
- Os valores finais das constantes de voz e do `BASE_WPM` estão em `defaults.ts` e na TechSpec, com a data da medição.
- Nenhuma chamada de rede acontece durante o reconhecimento.
