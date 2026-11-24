---
schema_version: "compozy.tasks/v2"
workflow: 034-teleprompter-para-uso-interno
graph:
  nodes:
    - id: task_01
      file: task_01.md
    - id: task_02
      file: task_02.md
    - id: task_03
      file: task_03.md
    - id: task_04
      file: task_04.md
    - id: task_05
      file: task_05.md
    - id: task_06
      file: task_06.md
    - id: task_07
      file: task_07.md
  edges:
    - from: task_01
      to: task_02
    - from: task_01
      to: task_03
    - from: task_01
      to: task_04
    - from: task_03
      to: task_04
    - from: task_03
      to: task_05
    - from: task_04
      to: task_05
    - from: task_02
      to: task_06
    - from: task_03
      to: task_06
    - from: task_05
      to: task_06
    - from: task_06
      to: task_07
---

# Teleprompter para uso interno Task List

Decomposição da TechSpec (seção "Sequência de desenvolvimento") em sete fatias completas. A prova da voz (tarefa 2) e o estado central (tarefa 3) correm em paralelo depois do esqueleto.

| Tarefa | Título | Tipo | Complexidade | Depende de | Casos de teste |
|---|---|---|---|---|---|
| task_01 | Esqueleto do programa, ícone, versão e núcleo compartilhado | infra | medium | nenhuma | 33 UT, 1 IT |
| task_02 | Prova da voz, motores Vosk e Parakeet e alinhador | backend | high | task_01 | 27 UT, 3 IT |
| task_03 | Estado central, motor de rolagem, roteiros e ajustes | backend | high | task_01 | 84 UT, 10 IT |
| task_04 | Tela de controle, prévia, editor e aparência | frontend | high | task_01, task_03 | 19 UT, 2 IT, 4 E2E |
| task_05 | Saídas de TP, monitores, energia e atalhos de teclado | frontend | critical | task_03, task_04 | 52 UT, 5 IT, 8 E2E |
| task_06 | Rolagem por voz completa, tela de voz e alertas | frontend | high | task_02, task_03, task_05 | 28 UT, 4 IT, 4 E2E |
| task_07 | Aviso de versão nova, Sobre, voltar ao padrão e entrega 1.0.0 | infra | medium | task_06 | 13 UT, 1 IT, 4 E2E |

Regras que valem para todas as tarefas com interface (4, 5, 6 e 7, e a casca da 1): design system da Chiaro Filmes (`design-system/chiaro/DESIGN.md`), tema Noite sem tema claro. O ícone próprio do produto e a versão na interface são entregues na tarefa 1 e conferidos nos instaladores na tarefa 7.

Divergência encontrada na exploração: o export atual do design system já traz o `.jsx` de `Select`, `Dialog`, `Toast`, `Tag` e `MediaCard`, que a TechSpec dava como ausentes. As tarefas mandam importar esses componentes de `@chiaro/components` e implementar localmente só o que ainda faltar.

## Preferências aplicadas

- [2026-10-13 · #24] Electron, React e TypeScript com os componentes e tokens da Chiaro: tarefas 1 e 4.
- [2026-10-13 · #28] Programa instalado de verdade, com instalador próprio (NSIS): tarefas 1 e 7.
- [2026-10-13 · #24] Desktop para Windows e Mac (DMG x64 e arm64): tarefas 1 e 7.
- [2026-10-13 · #24] Instaladores sem assinatura de código, com a liberação explicada no Como usar: tarefa 7.
- [2026-10-16 · #31] Instaladores e versões novas pelas Releases de um repositório público em `audiovisualpecege`: tarefas 1 e 7.
- [2026-10-13 · #24] Aviso de versão nova com botão que abre o instalador, sem atualização silenciosa: tarefa 7.
- [2026-10-13 · #24] Toda automação tem liga e desliga (rolagem automática e voz): tarefas 3 e 6.
- [2026-10-16 · #31] O que age sozinho começa ligado (sinal de voz ligado em toda saída): tarefa 5.
- [2026-10-16 · #26] Fornecedor trocável e produto usável à mão quando a parte inteligente falha (`SpeechEngine`, manual por cima): tarefas 2 e 6.
- [2026-10-20 · #18] Falha ao vivo mantém a imagem e dá alerta forte: tarefa 6.
- [2026-10-20 · #18] Mídia processada no próprio computador (áudio nunca sai da máquina): tarefa 2.
- [2026-10-13 · #28] Sem serviço cobrado por uso (motores de voz locais e gratuitos): tarefa 2.
- [2026-10-16 · #31] Configurações só no aparelho (`ajustes.json` em `userData`): tarefa 3.
- [2026-10-16 · #31] Ajustes poucos e globais, com voltar ao padrão: tarefas 3 e 7.
- [2026-10-16 · #31] Atalhos de teclado com combinação sugerida e trocável: tarefa 5.
- [2026-10-13 · #28] Produto para qualquer pessoa da empresa (tela de controle simples, ações grandes): tarefa 4.

A ordem e o recorte das tarefas seguem a "Sequência de desenvolvimento" da TechSpec e não mudam nenhuma decisão do autor, por isso não houve pergunta nesta etapa.
