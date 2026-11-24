---
status: pending
title: Rolagem por voz completa, tela de voz e alertas
type: frontend
complexity: high
---

# Task 6: Rolagem por voz completa, tela de voz e alertas

## Overview
Liga os motores e o alinhador da prova da voz ao resto do programa: o `VoiceController` com a máquina de estados (Preparando, Ouvindo, Esperando, Falhou), a exclusividade com a rolagem automática, o manual sempre por cima, a recuperação de falhas e o envio do estado ao sinal discreto das saídas. Entrega a tela de voz (microfone, medidor, motor, modo) e o alerta forte na tela de controle, fechando a jornada de gravar sozinho com voz.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details: do not duplicate here
- FOCUS ON "WHAT": describe what needs to be accomplished, not how
- MINIMIZE CODE: show code only to illustrate current structure or problem areas
- TESTS REQUIRED: implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST seguir o design system da Chiaro Filmes (`design-system/chiaro/DESIGN.md` e os arquivos que ele indica) na tela de voz, no estado da voz e na faixa de alerta, com os componentes de `@chiaro/components/...`, os tokens e o tema Noite, sem nenhum elemento em fundo claro; o medidor de nível é uma barra em pílula com `--gradient-chiaro`.
2. MUST mostrar o estado da voz num lugar fixo ao lado das ações de gravação, sempre com texto e cor: "Preparando" `--info`, "Ouvindo" `--success`, "Esperando" `--warning`, "Falhou" `--danger`; em `failed`, uma faixa `--danger` com o motivo, que some quando a causa se resolve.
3. MUST implementar `src/main/voice-controller.ts` com a tabela de estados da TechSpec: ligar só com texto confirmado e microfone disponível (`no-text`, `no-mic`, `mic-denied` com as mensagens do catálogo), `waiting` depois de `WAITING_AFTER_MS` sem casar ou no fim do texto, `failed` por qualquer `EngineFault` com `hold` na posição atual, recuperação por `devicechange`, reinício do motor em até 3 tentativas (1, 2 e 4 s) e lentidão (`TOO_SLOW_LAG_MS` e `RECOVERED_LAG_MS`), um único aviso por falha repetida, e ligar e desligar seguidos cancelando o carregamento anterior.
4. MUST aplicar o ADR-005: ligar a voz pausa a automática, iniciar a automática desliga a voz, e todo comando manual vale por cima, com o cursor do alinhador ressincronizado pela linha da faixa depois de comando manual, voltar ao início ou abrir outro roteiro.
5. MUST levar as hipóteses de `asr:hypothesis` ao `VoiceTracker` e o alvo ao `ScrollEngine` como `voiceTarget`, e chamar `setVocabulary` a cada texto confirmado sem mudar o estado.
6. MUST enviar às saídas o `voiceState` só depois de `SIGNAL_DEBOUNCE_MS` de estado estável, respeitando o `voiceSignal` de cada saída.
7. MUST implementar a tela de voz: lista de microfones pelos nomes de `enumerateDevices` atualizada por `devicechange` (inclusive entradas de uma mesma interface), medidor de nível, motor (Vosk padrão, Parakeet onde carregar) e modo ("Perto" padrão, "Pulos para a frente"), guardados em `ajustes.json`; trocar o microfone com a voz ligada reinicia a captura sem desligar; microfone guardado ausente gera o aviso "O microfone guardado não está ligado" sem trocar de microfone sozinho.
8. MUST pedir a permissão de microfone no Mac (`systemPreferences.askForMediaAccess`) e explicar como dar a permissão quando negada.
9. MUST manter as saídas com o texto visível e parado em qualquer falha da voz, e manter a voz funcionando com a janela de controle minimizada.
10. MUST acrescentar ao `__tpTest` os ganchos de microfone simulado (`stopMicTrack`, `restoreMic`) só no build de teste e registrar no log `voice.state`.
</requirements>

## Subtasks
- [ ] 6.1 Implementar a máquina de estados da voz com falhas, recuperação e reinício do motor.
- [ ] 6.2 Ligar hipóteses, alinhador e motor de rolagem, com o manual por cima e a ressincronização do cursor.
- [ ] 6.3 Aplicar a exclusividade entre voz e rolagem automática e o vocabulário a cada texto confirmado.
- [ ] 6.4 Enviar o estado estável da voz ao sinal das saídas.
- [ ] 6.5 Implementar a tela de voz com microfone, medidor, motor e modo guardados.
- [ ] 6.6 Implementar o estado da voz e a faixa de alerta na tela de controle.
- [ ] 6.7 Implementar as permissões de microfone e os avisos de microfone ausente.
- [ ] 6.8 Cobrir as jornadas de voz com áudio falso do Chromium de ponta a ponta.

## Implementation Details
Siga as seções "Algoritmos principais: Voz" e "Estados da voz (`VoiceController`)", "Contratos de IPC" (`cmd:voice`, `asr:*`, `state:output`), "Design system" (cores dos estados, medidor, sinal discreto) e "Monitoramento e observabilidade" da TechSpec.

Arquivos a criar: `src/main/voice-controller.ts`, tela de voz e componente de estado da voz em `src/renderer/control/`. Arquivos a modificar: `src/main/store.ts` (estado `voice`, `automation: 'voice'`, cursor da voz ao abrir outro roteiro), `src/main/outputs.ts` (envio do `voiceState`), `src/main/settings.ts` (microfone, motor, modo), `src/main/index.ts`, `src/preload/control.ts`.

### Relevant Files
- `src/main/voice-tracker.ts`, `src/renderer/control/audio/` e `src/renderer/control/asr/`: alinhador, captura e motores (tarefa 2).
- `src/main/scroll-engine.ts` e `src/main/store.ts`: `voiceTarget`, prioridade do manual e documento (tarefa 3).
- `src/main/outputs.ts` e `src/renderer/output/OutputApp.tsx`: sinal de voz nas saídas (tarefa 5).
- `src/main/keymap.ts`: atalho `voiceToggle` (tarefa 5).
- `tests/fixtures/voz/`: gravações da equipe (tarefa 2).

### Dependent Files
- Tela Sobre: mostra o motor ativo e o atraso médio da voz na tarefa de entrega.
- Voltar ao padrão: devolve o modo "Perto" e o motor Vosk na tarefa de entrega.

### Related ADRs
- [ADR-003: A voz acompanha só um pouco à frente, com modo de pulos para a frente selecionável](adrs/adr-003.md): modos e nunca para trás.
- [ADR-004: Estado da voz na tela de controle e num sinal discreto nas saídas](adrs/adr-004.md): alerta forte e sinal.
- [ADR-005: Uma automação de rolagem por vez, controle manual sempre por cima](adrs/adr-005.md): voz e automática exclusivas.
- [ADR-007: Voz com Vosk pequeno em português como padrão e Parakeet v3 escolhível, atrás de uma peça trocável](adrs/adr-007.md): troca de motor.

## Deliverables
- `VoiceController` completo, ligado ao `AppStore`, ao `ScrollEngine` e às saídas.
- Tela de voz, estado da voz e faixa de alerta na tela de controle.
- Ganchos de microfone simulado no build de teste.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract: read each ID's full definition there before writing tests.

- [ ] UT-081, UT-082, UT-083, UT-084: ligar a voz e suas recusas.
- [ ] UT-085, UT-086, UT-087: Ouvindo, Esperando e silêncio.
- [ ] UT-088, UT-089, UT-090, UT-091, UT-092, UT-093: falhas, recuperação, reinício e lentidão.
- [ ] UT-094, UT-095, UT-096, UT-097: ligar e desligar seguidos, exclusividade com a automática e fim do texto.
- [ ] UT-098, UT-099, UT-100, UT-101, UT-102, UT-103, UT-104: microfone, modo, motor, sinal estável, vocabulário, microfone ausente, voltar ao início e manual em Preparando.
- [ ] UT-204: abrir outro roteiro pausa a automática e zera posição e cursor da voz.
- [ ] UT-229, UT-230: estado da voz com texto e cor e faixa de alerta.
- [ ] UT-238: lista de microfones com entradas da mesma interface.
- [ ] IT-013: improviso real sem o texto andar.
- [ ] IT-014: trecho pulado no modo "Perto" e retomada depois do manual.
- [ ] IT-017: microfone perdido durante a rolagem por voz.
- [ ] IT-024: voz e comando manual no mesmo instante.
- [ ] E2E-008: gravar sozinho com voz e improviso.
- [ ] E2E-009: alerta forte com o microfone desconectado.
- [ ] E2E-015: voltar ao início com a voz ligada.
- [ ] E2E-020: voz com a janela de controle minimizada.

## Success Criteria
- Every assigned test case implemented and passing
- Design system: tela de voz, estado e faixa de alerta usam os componentes e tokens da Chiaro, com texto em todo estado e não só cor.
- Tema escuro: nenhuma tela, lista, medidor, diálogo ou aviso da voz aparece em fundo claro.
- Em nenhuma falha da voz as saídas apagam ou perdem o texto.
- O texto nunca anda para trás por causa da voz.
