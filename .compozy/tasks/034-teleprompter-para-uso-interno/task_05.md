---
status: pending
title: Saídas de TP, monitores, energia e atalhos de teclado
type: frontend
complexity: critical
---

# Task 5: Saídas de TP, monitores, energia e atalhos de teclado

## Overview
Entrega o estúdio: várias saídas de TP em tela cheia, uma por monitor, cada uma com espelhar e inverter vertical próprios, número de identificação, queda e volta quando o monitor desliga e religa, reabertura ao iniciar o programa e bloqueio de proteção de tela. Entrega também os atalhos de teclado capturados em todas as janelas (serve a pedais e passadores), a tela de troca de atalhos e o painel de saídas na tela de controle, fechando a jornada de gravar com operador.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details: do not duplicate here
- FOCUS ON "WHAT": describe what needs to be accomplished, not how
- MINIMIZE CODE: show code only to illustrate current structure or problem areas
- TESTS REQUIRED: implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST seguir o design system da Chiaro Filmes (`design-system/chiaro/DESIGN.md` e os arquivos que ele indica) no painel de saídas, na tela de atalhos, na pergunta de conflito e nos avisos de saída caída, com os componentes de `@chiaro/components/...`, os tokens e o tema Noite, sem nenhum elemento em fundo claro.
2. MUST, nas saídas, usar as cores escolhidas pela pessoa só na área de texto (branco sobre preto por padrão, como conteúdo de leitura no vidro); o sinal de voz e o número de identificação usam os tokens da Chiaro, e a janela de saída nasce com o fundo da aparência, sem piscar claro.
3. MUST implementar `src/main/displays.ts` (`DisplayRegistry`) com a lista de monitores, a `displayKey` estável (`id|label|largura x altura`), `matchDisplay` (mesmo `id` e `label`, ou mesmo `label` e tamanho) e os eventos de ligar e desligar, com `TP_FAKE_DISPLAYS` e `__tpTest.addDisplay`/`removeDisplay` só no build de teste.
4. MUST implementar `src/main/outputs.ts` (`OutputManager`) como a TechSpec descreve: janela sem moldura com `backgroundThrottling: false` nos `bounds` do monitor (`fullscreen` no Windows, `simpleFullScreen` no Mac), menor número livre, número por `ID_BADGE_MS` só quando aberta pelo controle, `display-busy`, `control-display` e `display-missing`, queda para `down` com aviso, reabertura idempotente depois de 1 s de estabilidade com as inversões guardadas, reabertura silenciosa ao iniciar, devolução aos `bounds` quando arrastada ou fora da tela cheia, Esc anulado, e janela de controle levada ao primeiro monitor livre.
5. MUST guardar por monitor, no `SettingsStore`, as saídas, `mirrorH`, `flipV` e `voiceSignal` (começando ligado), sem emitir trecho de movimento ao mudar inversões.
6. MUST implementar `OutputApp` com o `Stage` em tela cheia, `mirrorH` como `scale(-1, 1)`, `flipV` como `scale(1, -1)`, o sinal de voz (círculo `--success`, duas barras `--warning`, triângulo `--danger`, 28 px lógicos no canto inferior direito dentro da margem ou a 24 px da borda com margem 0%, invertido junto com o palco) e o número de identificação. A saída nunca mostra versão, aviso, alerta nem controle.
7. MUST implementar `src/main/power.ts` (`PowerGuard`): `powerSaveBlocker.start('prevent-display-sleep')` enquanto houver ao menos uma saída `open`, e `stop` quando a última fecha ou cai.
8. MUST garantir que fechar a janela de controle passa pela pergunta de alterações não salvas e, confirmado, fecha o programa e todas as saídas; com a janela de controle minimizada ou redimensionada as saídas continuam sem salto (`backgroundThrottling: false` também no controle).
9. MUST implementar `src/main/keymap.ts` (`KeymapService`): captura por `before-input-event` em todas as janelas do programa e nada fora dele, os atalhos padrão da TechSpec (`Cmd+Shift+W` no Mac para fechar a saída), tecla segurada para subir e descer, alternâncias que ignoram `isAutoRepeat`, só combinações com Ctrl ou Cmd com o editor em foco e Esc para sair do editor, conflitos com `{ conflictWith }`, teclas reservadas, ação sem atalho e voltar ao padrão, gravando em `ajustes.json`.
10. MUST implementar a tela de troca de atalhos (gravar combinação, cancelar com Esc, pergunta de conflito, mensagem de tecla reservada, voltar ao padrão), o aviso fixo "Atalhos inativos enquanto você edita. Esc para sair do editor" com o editor em foco e as dicas dos botões de gravação lidas do mapa atual.
11. MUST acrescentar ao `__tpProbe` a posição desenhada e o texto de cada saída e o estado do bloqueio de energia, e registrar no log `output.open`, `output.down`, `output.reopen` e `render.longFrame`.
</requirements>

## Subtasks
- [ ] 5.1 Implementar a lista de monitores com identidade estável e monitores simulados no build de teste.
- [ ] 5.2 Implementar abrir, fechar, numerar e guardar saídas, com as duas inversões por monitor.
- [ ] 5.3 Implementar a queda e a volta de monitores, a reabertura ao iniciar e a posição da janela de controle.
- [ ] 5.4 Implementar a janela de saída com o palco, as inversões, o sinal de voz e o número de identificação.
- [ ] 5.5 Implementar o bloqueio de proteção de tela e suspensão com saída aberta.
- [ ] 5.6 Implementar o painel de saídas na tela de controle e o fechamento do programa com as saídas.
- [ ] 5.7 Implementar os atalhos capturados em todas as janelas, com tecla segurada e editor em foco.
- [ ] 5.8 Implementar a tela de troca de atalhos, conflitos, reservadas, dicas dos botões e aviso de atalhos inativos.
- [ ] 5.9 Cobrir a sincronia entre prévia e saídas e as jornadas de estúdio e de operador de ponta a ponta.

## Implementation Details
Siga as seções "Algoritmos principais: Saídas (`OutputManager`)" e "Atalhos (`KeymapService`)", "Modelos de dados" (`OutputInfo`, `Settings`, identidade de monitor), "Contratos de IPC" (`cmd:output`, `cmd:keymap`, `state:output`) e "Design system" (exceção das saídas, sinal discreto) da TechSpec.

Arquivos a criar: `src/main/displays.ts`, `src/main/outputs.ts`, `src/main/power.ts`, `src/main/keymap.ts`, painéis de saídas e de atalhos em `src/renderer/control/`. Arquivos a modificar: `src/renderer/output/OutputApp.tsx`, `src/preload/output.ts`, `src/main/index.ts`, `src/main/store.ts` (estado das saídas no `StateSnapshot`), `src/main/settings.ts` (saídas e atalhos).

O sinal de voz desenha o `voiceState` recebido em `state:output`; quem produz esse estado é a tarefa da voz completa. Aqui ele é testado com estados fornecidos pelos testes.

### Relevant Files
- `src/renderer/shared/Stage.tsx`: palco usado pela janela de saída (tarefa 4).
- `src/main/store.ts` e `src/main/scroll-engine.ts`: estado, `MotionSegment` e comandos de rolagem (tarefa 3).
- `src/main/settings.ts`: onde as saídas e os atalhos são guardados (tarefa 3).
- `src/main/platform.ts`: adaptadores de `screen`, `BrowserWindow` e `powerSaveBlocker` (tarefa 1).
- `design-system/chiaro/DESIGN.md` e `design-system/chiaro/components/`: painel de saídas, tela de atalhos e diálogos.

### Dependent Files
- `src/main/voice-controller.ts`: envia o estado da voz às saídas e usa o atalho `voiceToggle`.
- Tela Sobre e voltar ao padrão: zeram as inversões e os atalhos na tarefa de entrega.

### Related ADRs
- [ADR-001: Um computador, uma rolagem, várias saídas locais](adrs/adr-001.md): todas as saídas no mesmo computador.
- [ADR-004: Estado da voz na tela de controle e num sinal discreto nas saídas](adrs/adr-004.md): sinal desligável por saída.
- [ADR-006: Processo principal dono da rolagem, janelas desenham por trechos de movimento sobre um palco lógico fixo](adrs/adr-006.md): sincronia por construção.
- [ADR-010: Espelhamento horizontal e inversão vertical separados em cada saída](adrs/adr-010.md): duas inversões independentes guardadas por monitor.

## Deliverables
- Saídas de TP com inversões, número, queda e volta, reabertura e bloqueio de energia.
- Atalhos em todas as janelas e tela de troca de atalhos.
- Painel de saídas na tela de controle.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract: read each ID's full definition there before writing tests.

- [ ] UT-114, UT-115, UT-116, UT-117, UT-118, UT-119, UT-120: lista de monitores, abrir saída e numeração.
- [ ] UT-121, UT-122, UT-123: inversões por saída guardadas por monitor.
- [ ] UT-124, UT-125, UT-126, UT-127, UT-128: queda e volta de monitores.
- [ ] UT-129, UT-130, UT-131, UT-132, UT-133: fechar saída e reabrir ao iniciar.
- [ ] UT-134, UT-135, UT-136, UT-137, UT-138: tela cheia, Esc, janela de controle e sinal por saída.
- [ ] UT-139, UT-140, UT-141: bloqueio de energia e casamento de monitores.
- [ ] UT-142, UT-143, UT-144, UT-145, UT-146, UT-147: atalhos padrão, tecla segurada e editor em foco.
- [ ] UT-148, UT-149, UT-150, UT-151, UT-152, UT-153, UT-154, UT-155, UT-156: troca de atalhos, conflitos, reservadas e velocidade pelo teclado.
- [ ] UT-226, UT-228, UT-245: aviso de atalhos inativos, dicas dos botões e cancelar a gravação de atalho.
- [ ] UT-248, UT-251, UT-252, UT-253, UT-254: inversões no palco, sinal de voz, número e saída sem versão nem avisos.
- [ ] UT-255: abrir saída num monitor que sumiu.
- [ ] IT-001: prévia e duas saídas com os mesmos trechos e o mesmo layout.
- [ ] IT-018: monitor removido e devolvido durante a rolagem automática.
- [ ] IT-019: tecla vinda de uma saída move o texto.
- [ ] IT-020: bloqueio de energia com duas saídas.
- [ ] IT-026: rolagem sem saídas e fechar todas rolando.
- [ ] E2E-004: montar o estúdio com duas saídas e inversões.
- [ ] E2E-005: gravar com operador, velocidade, roda, Descer e Home.
- [ ] E2E-006: editor em foco durante a rolagem automática.
- [ ] E2E-007: monitor desligado e religado.
- [ ] E2E-010: trocar atalhos.
- [ ] E2E-016: bloqueio de energia com e sem saída.
- [ ] E2E-018: fechar a tela de controle com alterações não salvas.
- [ ] E2E-019: janela de controle redimensionada e minimizada.

## Success Criteria
- Every assigned test case implemented and passing
- Design system: painel de saídas, tela de atalhos, pergunta de conflito e avisos usam os componentes e tokens da Chiaro.
- Tema escuro: nenhuma tela, diálogo ou aviso aparece em fundo claro, e nenhuma saída pisca branco ao abrir.
- Em 5 amostras, a posição desenhada da prévia e das saídas difere menos de 2 px lógicos.
- Nenhuma saída mostra a versão, avisos de atualização ou alertas da tela de controle.
