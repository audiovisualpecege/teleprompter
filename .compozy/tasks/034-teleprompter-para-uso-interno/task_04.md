---
status: pending
title: Tela de controle, prévia, editor e aparência
type: frontend
complexity: high
---

# Task 4: Tela de controle, prévia, editor e aparência

## Overview
Entrega a tela de controle que qualquer pessoa da empresa usa para preparar e acompanhar a gravação: prévia sincronizada em destaque, barra de ações de gravação, editor com Confirmar e Descartar, painel de aparência, arquivos (novo, abrir, salvar, importar) e primeira abertura com os três passos. Inclui o `LayoutService`, que mede o texto com a fonte real, e o `Stage`, o desenho compartilhado com as saídas, tudo no design system da Chiaro em tema Noite.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details: do not duplicate here
- FOCUS ON "WHAT": describe what needs to be accomplished, not how
- MINIMIZE CODE: show code only to illustrate current structure or problem areas
- TESTS REQUIRED: implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST seguir o design system da Chiaro Filmes: ler `design-system/chiaro/DESIGN.md`, o `readme.md` e os `.prompt.md` dos componentes usados antes de codificar; usar os tokens de `@chiaro/styles.css` (cores, espaços, raios, sombras, `--ease-cine`), Altivo em caixa alta nos títulos e Archivo na interface, e Solar Icons pelo pacote `@solar-icons/react`, sem valores soltos copiados.
2. MUST usar os componentes de `@chiaro/components/...` que existem no export, inclusive `Button`, `Input`, `Checkbox`, `Radio`, `Switch`, `Tabs`, `Card`, `Tooltip`, `Badge`, `Select`, `Dialog`, `Toast` e `Tag` (o export atual já traz o `.jsx` de `Select`, `Dialog`, `Toast` e `Tag`, ao contrário do que a TechSpec previa). Só o que não tiver `.jsx` ganha implementação local em `src/renderer/shared/ui/`, seguindo o `.d.ts` e o `.prompt.md`; `design-system/chiaro/` nunca é editada.
3. MUST manter tudo no tema Noite: tela, diálogos (alterações não salvas, voltar ao padrão), menus, campos, dicas, avisos, popover de cor e barras de rolagem (`::-webkit-scrollbar` com `--surface-*` e `--accent`) em fundo escuro, sem nenhum elemento em fundo claro. As perguntas do programa usam o `Dialog` da Chiaro, não `dialog.showMessageBox`.
4. MUST implementar o `LayoutService` (`src/renderer/control/layout-service.ts`): responde a `layout:request` com `LayoutResult` medido por `CanvasRenderingContext2D.measureText` depois de `document.fonts.load`, cai para Archivo com `missingFont` quando a fonte não carrega, e lista as fontes de `queryLocalFonts()` (permissão `local-fonts` concedida pelo principal), devolvendo só `['Archivo']` sem permissão.
5. MUST implementar o `Stage` (`src/renderer/shared/Stage.tsx`), compartilhado com as saídas: escala o palco lógico de 1920 pela largura da tela, desenha as linhas recebidas com `white-space: pre` e `translate3d(0, bandY - y, 0)` a cada quadro a partir do `MotionSegment` e do relógio comum, monta só as linhas próximas da área visível, desenha a faixa numa camada abaixo do texto e usa a pilha de fontes com reserva de emoji.
6. MUST montar a tela como a TechSpec descreve: prévia no alto, sem inversão, com as linhas-guia das margens; barra de ações grandes e sempre visíveis (Iniciar e Pausar, "-" e "+" com o valor "1,25x", Voltar ao início, Subir, Descer, Voz); editor (`textarea`, só texto puro) com Confirmar e Descartar numa coluna; aparência e estúdio em abas.
7. MUST ligar a roda do mouse sobre a prévia a `cmd:scroll nudge`, e nunca sobre o editor; mensagens de movimento nunca alteram a rolagem nem a seleção do editor.
8. MUST implementar o painel de aparência (fonte, tamanho, cor do texto, do fundo e da faixa, caixa, alinhamento, margens, posição da faixa) com valores presos aos limites ao sair do campo, volta ao valor anterior em entrada inválida, seletor de cor escuro próprio (`react-colorful` estilizado com os tokens) e o aviso de contraste baixo sem bloquear.
9. MUST implementar as ações de arquivo (Novo, Abrir, Salvar, Salvar como, Importar), o nome do arquivo no topo com "(não salvo)", o diálogo de alterações não salvas, a oferta de recuperação, o aviso de itens ignorados do `.docx`, o indicador "Carregando" acima de 1 s, as mensagens de erro de `FileError` e o aviso de fonte ausente.
10. MUST mostrar, na primeira abertura sem texto confirmado nem saídas, os três passos "Cole ou importe o texto", "Abra uma saída" e "Ligue a voz, se quiser", e desabilitar "Confirmar alterações" com rascunho vazio e "Iniciar" e "Voz" sem texto confirmado.
11. MUST manter a versão `v1.0.0` fixa no rodapé, lida de `__APP_VERSION__`.
12. MUST usar textos em português do Brasil com acentos, títulos em caixa alta, sem emoji, sem ponto de exclamação e sem travessão.
</requirements>

## Subtasks
- [ ] 4.1 Implementar a medição e a diagramação com a fonte real, a lista de fontes instaladas e a fonte reserva.
- [ ] 4.2 Implementar o palco compartilhado com escala, movimento por trechos, faixa e desenho só das linhas visíveis.
- [ ] 4.3 Montar o layout da tela de controle com prévia, barra de ações e abas, nos componentes e tokens da Chiaro.
- [ ] 4.4 Implementar o editor com Confirmar e Descartar, isolado da rolagem.
- [ ] 4.5 Implementar o painel de aparência com limites, seletor de cor escuro e aviso de contraste.
- [ ] 4.6 Implementar as ações de arquivo, os diálogos escuros e os avisos de importação e de erro.
- [ ] 4.7 Implementar a primeira abertura com os três passos e os estados desabilitados.
- [ ] 4.8 Cobrir a tela com os testes de componente e as jornadas de ponta a ponta de preparo do roteiro.

## Implementation Details
Siga as seções "Visão dos componentes" (janela de controle), "Algoritmos principais: Diagramação" e "Posição e limites", "Contratos de IPC" e "Design system" (tokens, tema Noite, componentes, casos fora do design system, tela de controle) da TechSpec.

Arquivos a criar ou modificar: `src/renderer/control/App.tsx` e os painéis em `src/renderer/control/` (prévia, barra de ações, editor, aparência, arquivos, primeira abertura), `src/renderer/control/layout-service.ts`, `src/renderer/shared/Stage.tsx`, `src/renderer/shared/ui/` (só o que faltar no export), `src/preload/control.ts`, `src/main/index.ts` (permissão `local-fonts`).

As abas de estúdio (saídas, atalhos, voz) e a tela Sobre ficam como espaços que as tarefas de saídas, voz e entrega preenchem. O `__tpProbe` da prévia (posição desenhada e texto das linhas) é acrescentado ao ponto de ganchos de teste criado na tarefa 1.

### Relevant Files
- `design-system/chiaro/DESIGN.md` e `design-system/chiaro/readme.md`: regras e fundamentos a ler antes da tela.
- `design-system/chiaro/components/`: `core`, `forms`, `surfaces`, `navigation` e `brand`, cada um com o seu `.prompt.md`.
- `design-system/chiaro/tokens/colors.css`: bloco `[data-theme="noite"]`.
- `design-system/chiaro/ui_kits/`: telas de exemplo montadas com os componentes.
- `src/shared/layout.ts`, `src/shared/motion.ts`, `src/renderer/shared/clock.ts`: diagramação pura, trechos e relógio (tarefa 1).
- `src/main/store.ts`: comandos e `StateSnapshot` consumidos pela tela (tarefa 3).

### Dependent Files
- `src/renderer/output/OutputApp.tsx`: usa o mesmo `Stage` na tarefa das saídas.
- Abas de estúdio da tela de controle: preenchidas pelas tarefas de saídas e atalhos, de voz e de entrega.

### Related ADRs
- [ADR-006: Processo principal dono da rolagem, janelas desenham por trechos de movimento sobre um palco lógico fixo](adrs/adr-006.md): palco lógico fixo e desenho por trechos.
- [ADR-008: Roteiro em arquivo `.roteiro` (JSON) e ajustes em JSON na pasta do usuário](adrs/adr-008.md): ações de arquivo e recuperação.

## Deliverables
- Tela de controle completa para preparar o roteiro, com prévia sincronizada.
- `LayoutService` e `Stage`.
- Componentes locais só onde o export da Chiaro não tem `.jsx`.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract: read each ID's full definition there before writing tests.

- [ ] UT-023, UT-024: fonte ausente e lista de fontes instaladas no `LayoutService`.
- [ ] UT-224, UT-225, UT-227: estados desabilitados e primeira abertura.
- [ ] UT-231, UT-232, UT-233: aviso de contraste e campos de tamanho e cor.
- [ ] UT-234, UT-235, UT-236: roda do mouse na prévia, linhas-guia e nome do arquivo.
- [ ] UT-239, UT-240: aviso de itens ignorados e indicador de carregando.
- [ ] UT-242, UT-243: editor isolado da rolagem e valor da velocidade.
- [ ] UT-246, UT-247, UT-249, UT-250: escala do palco, linhas visíveis, camada da faixa e pilha de fontes.
- [ ] IT-004: mudanças de aparência durante a rolagem mantêm o token da faixa.
- [ ] IT-025: roteiro com fonte ausente diagramado em Archivo, com aviso.
- [ ] E2E-001: primeira abertura, colar, aparência, salvar e reabrir.
- [ ] E2E-002: importar `.txt` e `.docx`.
- [ ] E2E-003: diálogo escuro de alterações não salvas.
- [ ] E2E-017: abrir o programa com um `.roteiro` como argumento.

## Success Criteria
- Every assigned test case implemented and passing
- Design system: toda a tela usa os componentes e tokens da Chiaro, sem cores, raios ou fontes soltos no código.
- Tema escuro: nenhuma tela, diálogo, menu, campo, dica, popover de cor ou barra de rolagem aparece em fundo claro; o `body` resolve para `#070010`.
- Versão: `v1.0.0` continua fixa no rodapé em todas as telas da janela de controle.
- A prévia mostra as mesmas quebras de linha para a mesma entrada em qualquer tamanho de janela.
