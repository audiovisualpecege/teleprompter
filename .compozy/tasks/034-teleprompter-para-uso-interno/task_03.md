---
status: pending
title: Estado central, motor de rolagem, roteiros e ajustes
type: backend
complexity: high
---

# Task 3: Estado central, motor de rolagem, roteiros e ajustes

## Overview
Entrega o processo principal como dono do estado: o `AppStore` com o documento (rascunho, confirmação, descarte, alterações não salvas e recuperação), o `ScrollEngine` com todos os comandos de rolagem, limites, âncora e rolagem automática, o `SettingsStore` com `ajustes.json` e o `ScriptFiles` com `.roteiro`, importação de `.txt` e `.docx` e abertura por duplo clique. É a base sem interface que a tela de controle, as saídas, os atalhos e a voz consomem pelos canais de IPC.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details: do not duplicate here
- FOCUS ON "WHAT": describe what needs to be accomplished, not how
- MINIMIZE CODE: show code only to illustrate current structure or problem areas
- TESTS REQUIRED: implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST implementar `src/main/scroll-engine.ts` com a interface `ScrollEngine` da TechSpec: `lineStep` encadeado a partir do alvo pendente, `holdStart` e `holdEnd`, `nudge` preso aos limites, `toStart`, `autoStart`, `autoPause`, `setSpeed` (0,25 a 3,00 em passos de 0,25), `voiceTarget` só para a frente e ignorado até `MANUAL_PRIORITY_MS` depois de comando manual, `relayout` e `replaceText` mantendo o caractere da faixa, e fim do texto com `onAutoEnded`.
2. MUST publicar o movimento só como `MotionSegment` com instante no relógio comum, nunca a posição quadro a quadro; todo comando manual com automação ligada volta à automação a partir da nova posição.
3. MUST implementar `src/main/store.ts` (`AppStore`) como estado único: aplica os comandos de `cmd:scroll`, `cmd:doc`, `cmd:appearance` e `cmd:settings`, publica `StateSnapshot` e `MotionSegment`, pede diagramação por `layout:request` com `revision` e reancora a posição ao receber `layout:result`, garantindo que as janelas recebem o layout novo antes do trecho novo.
4. MUST implementar as operações de documento de `cmd:doc` (`setDraft`, `confirm`, `discard`, `new`, `open`, `save`, `saveAs`, `import`, `recover`) com os estados `dirty` e `pending` da TechSpec, a pergunta de alterações não salvas (`needs-confirmation` com "Salvar", "Não salvar" e "Cancelar") e a cópia de recuperação `recuperacao.json` a cada `RECOVERY_SAVE_MS`.
5. MUST implementar `cmd:appearance` com os limites e o padrão de `Appearance` (fonte Archivo, 80, `#FFFFFF`, `#000000`, `#FACE9533`, `normal`, `center`, 10 e 33), contando a aparência como alteração não salva.
6. MUST implementar `src/main/script-files.ts` com o formato `.roteiro` em JSON (ADR-008), validado com `zod` campo a campo, gravação segura (temporário e renomear), aviso de versão mais nova e todos os códigos de `FileError` com mensagem em português.
7. MUST implementar `src/main/import-txt.ts` (rejeição de binário, UTF-8 com volta para Windows-1252, quebras normalizadas, arquivo vazio) e `src/main/import-docx.ts` (`jszip` e `@xmldom/xmldom`, só parágrafos do corpo, revisões aceitas, contagem de tabelas, imagens e caixas de texto ignoradas, `unreadable` e `no-text-content`), com o filtro do seletor `[{ name: 'Texto', extensions: ['txt', 'docx'] }]`.
8. MUST implementar `src/main/settings.ts` (`SettingsStore`) com `ajustes.json` em `userData`, validação e limites por campo, padrão quando o arquivo falta ou está corrompido (um único aviso `settings.corrupt`), gravação segura e `resetAll`.
9. MUST implementar `src/main/recovery.ts` e a abertura por arquivo: `requestSingleInstanceLock` com o caminho em `argv` no Windows e `open-file` no Mac, repassando à instância aberta.
10. MUST registrar no log `file.error`, `settings.reset` e `settings.corrupt`, e nunca derrubar o programa por erro de arquivo.
</requirements>

## Subtasks
- [ ] 3.1 Implementar o motor de rolagem com comandos manuais, limites e encadeamento de cliques.
- [ ] 3.2 Implementar a rolagem automática com velocidade, fim do texto e voltar ao início.
- [ ] 3.3 Implementar a âncora na faixa para nova diagramação e para troca de texto confirmado.
- [ ] 3.4 Implementar o estado central com publicação de estado, movimento e pedidos de diagramação.
- [ ] 3.5 Implementar rascunho, confirmação, descarte, aparência e alterações não salvas do documento.
- [ ] 3.6 Implementar ler e gravar `.roteiro` com validação, gravação segura e erros traduzidos.
- [ ] 3.7 Implementar a importação de `.txt` e `.docx` com os avisos de itens ignorados.
- [ ] 3.8 Implementar os ajustes guardados no computador, com padrão, limites e voltar ao padrão.
- [ ] 3.9 Implementar a cópia de recuperação e a abertura por duplo clique numa única instância.

## Implementation Details
Siga as seções "Interfaces centrais" (`ScrollCommand`, `ScrollEngine`), "Modelos de dados", "Algoritmos principais" (posição e limites, âncora e troca de texto, rolagem automática, rolagem manual, importação), "Contratos de IPC" e "Pontos de integração: Sistema operacional" da TechSpec.

Arquivos a criar: `src/main/scroll-engine.ts`, `src/main/store.ts`, `src/main/settings.ts`, `src/main/script-files.ts`, `src/main/import-txt.ts`, `src/main/import-docx.ts`, `src/main/recovery.ts`, um barramento de IPC em memória para os testes de integração e as fixtures de arquivo em `tests/fixtures/` (`.txt` UTF-8 e Windows-1252, `.docx` com tabela, imagem, caixa de texto, revisões, só imagens, corrompido e protegido, `.roteiro` válidos e inválidos). Arquivo a modificar: `src/main/index.ts`.

Nos testes, a diagramação vem de um respondedor falso de `layout:request` que usa `layoutScript` com `measure` de 10 px por caractere. O cursor da voz ao abrir outro roteiro é ligado na tarefa da voz completa.

### Relevant Files
- `src/shared/motion.ts`, `src/shared/layout.ts` e `src/shared/defaults.ts`: trechos, diagramação e constantes (tarefa 1).
- `src/shared/ipc.ts`: canais `cmd:*`, `state:snapshot`, `motion:segment` e `layout:*` (tarefa 1).
- `src/main/platform.ts`: adaptadores de `dialog` para os seletores de arquivo (tarefa 1).
- `.compozy/tasks/034-teleprompter-para-uso-interno/adrs/adr-005.md` e `adr-008.md`: automação exclusiva e formato dos arquivos.

### Dependent Files
- `src/renderer/control/`: a tela de controle envia comandos e desenha o `StateSnapshot`.
- `src/main/outputs.ts`: assina `MotionSegment` e o layout para as saídas.
- `src/main/keymap.ts`: converte teclas em `ScrollCommand` e grava atalhos no `SettingsStore`.
- `src/main/voice-controller.ts`: envia `voiceTarget` e reage a `toStart` e à confirmação de texto.

### Related ADRs
- [ADR-005: Uma automação de rolagem por vez, controle manual sempre por cima](adrs/adr-005.md): velocidade de 0,25x a 3,00x e manual por cima.
- [ADR-006: Processo principal dono da rolagem, janelas desenham por trechos de movimento sobre um palco lógico fixo](adrs/adr-006.md): estado no principal e movimento por trechos.
- [ADR-008: Roteiro em arquivo `.roteiro` (JSON) e ajustes em JSON na pasta do usuário](adrs/adr-008.md): formato, gravação segura e recuperação.

## Deliverables
- `ScrollEngine` e `AppStore` completos, sem interface, testados com relógio falso.
- `ScriptFiles`, importadores, recuperação e abertura por arquivo.
- `SettingsStore` com `ajustes.json`.
- Fixtures de arquivo em `tests/fixtures/`.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract: read each ID's full definition there before writing tests.

- [ ] UT-034, UT-035, UT-036, UT-037, UT-038, UT-039, UT-040, UT-041, UT-042, UT-043: comandos manuais, limites e voltar ao início.
- [ ] UT-044, UT-045, UT-046, UT-047, UT-048, UT-049, UT-050, UT-051, UT-052: rolagem automática e velocidade.
- [ ] UT-053, UT-054, UT-055: alvo de voz só para a frente e prioridade do manual.
- [ ] UT-056, UT-057, UT-058, UT-059, UT-060, UT-061, UT-062: âncora, troca de texto e formato da velocidade.
- [ ] UT-157, UT-158, UT-159, UT-160, UT-161, UT-162, UT-163: ajustes guardados.
- [ ] UT-164, UT-165, UT-166, UT-167, UT-168, UT-169, UT-170, UT-171, UT-172, UT-173, UT-174, UT-175: salvar e abrir `.roteiro`.
- [ ] UT-176, UT-177, UT-178, UT-179, UT-180, UT-181: importar `.txt`.
- [ ] UT-182, UT-183, UT-184, UT-185, UT-186, UT-187, UT-188, UT-189, UT-190, UT-191: importar `.docx` e seletor.
- [ ] UT-192, UT-193, UT-194, UT-195, UT-196, UT-197, UT-198, UT-199, UT-200, UT-201, UT-202, UT-203: rascunho, confirmação e alterações não salvas.
- [ ] UT-205, UT-206, UT-207, UT-208, UT-209, UT-210, UT-211, UT-212: recuperação, reabrir, importar, aparência e padrões.
- [ ] IT-003: confirmar texto durante a rolagem automática sem salto.
- [ ] IT-005, IT-006, IT-007: importação com disco real.
- [ ] IT-008, IT-009: salvar e abrir com disco real, pasta somente leitura.
- [ ] IT-010, IT-011: ajustes com disco real, arquivo corrompido.
- [ ] IT-022: recuperação depois de queda.
- [ ] IT-023: segunda instância repassa o arquivo à primeira.

## Success Criteria
- Every assigned test case implemented and passing
- Nenhum erro de arquivo derruba o programa nem perde o texto em edição.
- O caractere da faixa é o mesmo antes e depois de confirmar texto, mudar a aparência ou rediagramar.
- `ajustes.json` e `.roteiro` são JSON legíveis, e uma falha no meio da gravação deixa o arquivo anterior intacto.
