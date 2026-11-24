---
status: pending
title: Esqueleto do programa, ícone, versão e núcleo compartilhado
type: infra
complexity: medium
---

# Task 1: Esqueleto do programa, ícone, versão e núcleo compartilhado

## Overview
Cria o projeto Electron com React e TypeScript que todas as outras tarefas usam: build, tema Noite da Chiaro nas duas telas, ícone próprio do teleprompter, versão única lida do `package.json`, instaladores e workflow de Release. Entrega também o núcleo compartilhado e puro (movimento, relógio comum, diagramação, normalização de texto, constantes e contratos de IPC) e a base de testes (Vitest e Playwright `_electron`) com o ponto de entrada dos ganchos de teste, para que as tarefas seguintes sejam implementáveis sem trabalho não declarado.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details: do not duplicate here
- FOCUS ON "WHAT": describe what needs to be accomplished, not how
- MINIMIZE CODE: show code only to illustrate current structure or problem areas
- TESTS REQUIRED: implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST criar o projeto com electron-vite, React e TypeScript na estrutura de pastas da seção "Estrutura do repositório" da TechSpec (`src/main`, `src/preload`, `src/renderer/control`, `src/renderer/output`, `src/renderer/shared`, `src/shared`, `tests/unit`, `tests/integration`, `tests/e2e`, `tests/fixtures`).
2. MUST seguir o design system da Chiaro Filmes (`design-system/chiaro/DESIGN.md` e os arquivos que ele indica): o `electron.vite.config.ts` cria o alias `@chiaro` para `design-system/chiaro/`, as duas telas importam `@chiaro/styles.css`, e as fontes Altivo e Archivo são empacotadas no build para funcionar sem internet. A pasta `design-system/chiaro/` nunca é editada.
3. MUST nascer no tema Noite, sem tema claro: os dois `index.html` (controle e saída) começam com `<html data-theme="noite">`, o `body` tem `color-scheme: dark` e `background: var(--surface-page)`, a janela de controle tem `backgroundColor: '#070010'`, `nativeTheme.themeSource = 'dark'`, e não existe alternância de tema nem leitura da preferência do sistema.
4. MUST ter o ícone próprio do produto, desenhado para ele, em `build/icone.svg`, como descrito em "Ícone do produto" da TechSpec (quadrado de cantos arredondados com `--gradient-chiaro`, vidro inclinado em traço Areia, linhas de texto e a faixa Pêssego), com uma variante legível em 16 px. O ícone e os logos da Chiaro nunca são o ícone do produto.
5. MUST gerar do SVG, por `scripts/gerar-icones.mjs`, os PNG de 16, 32, 48, 64, 128, 256, 512 e 1024 px, o `.ico` do Windows (16 a 256) e o `.icns` do Mac, usados pelo `electron-builder.yml` e pelas janelas (PNG de 256).
6. MUST ter a versão num lugar só: o `version` do `package.json`, começando em `1.0.0`. O `electron.vite.config.ts` injeta `__APP_VERSION__`, o principal usa `app.getVersion()`, e a tela de controle mostra `v1.0.0` fixo no canto inferior direito, em `--text-muted` e tamanho de legenda, sem número digitado à mão em nenhuma tela. As saídas nunca mostram a versão.
7. MUST criar `CHANGELOG.md` com a entrada da 1.0.0 (data e o que muda, nas palavras de quem usa).
8. MUST configurar o `electron-builder.yml` (NSIS x64, DMG x64 e arm64, associação de `.roteiro`, `extraResources` dos modelos, `NSMicrophoneUsageDescription`, nomes `Teleprompter-<versão>-win-x64.exe` e `Teleprompter-<versão>-mac-<arch>.dmg`) e o `.github/workflows/release.yml` que publica nas Releases de `github.com/audiovisualpecege/teleprompter`.
9. MUST criar as janelas com `contextIsolation` ligado, `nodeIntegration` desligado e preloads `control.ts` e `output.ts` expondo `window.tp` via `contextBridge`.
10. MUST criar `src/main/platform.ts` com adaptadores finos de `screen`, `BrowserWindow`, `powerSaveBlocker`, `dialog`, `net` e `shell`, substituíveis por falsos nos testes.
11. MUST implementar o núcleo compartilhado puro: `src/shared/motion.ts` (`MotionSegment`, `positionAt`, `easeOutCubic`), `src/renderer/shared/clock.ts` (relógio comum com `clock:ping` e correção a cada `CLOCK_RESYNC_MS`), `src/shared/layout.ts` (`layoutScript` com `measure` injetado, quebra gulosa, quebra por caractere, caixa pt-BR sem mudar o texto guardado, `wordCount`), `src/shared/text.ts` (`normalizeTokens` com números por extenso em pt-BR, `buildVocabulary`, `contrastRatio`, `isLowContrast`, `parseColor`), `src/shared/defaults.ts` (todas as constantes da tabela "Constantes de comportamento") e `src/shared/ipc.ts` (todos os canais tipados da tabela "Contratos de IPC").
12. MUST configurar Vitest (com `jsdom` e Testing Library) e Playwright `_electron.launch` sobre o build de teste, com os scripts `npm test`, `npm run test:voice` e `npm run test:e2e`, e criar o ponto de entrada dos ganchos só do build de teste (`window.__tpProbe` e `window.__tpTest`), que o build de produção não contém. Cada tarefa seguinte acrescenta os seus ganchos nesse ponto.
13. MUST configurar `electron-log` em `userData/logs/` com rotação de 5 arquivos de 1 MB e o tratamento de exceções inesperadas no principal (vão ao log e nunca derrubam janelas).
14. SHOULD deixar a janela de controle com uma casca mínima (fundo Noite, rodapé com a versão) que a tarefa da tela de controle preenche.
</requirements>

## Subtasks
- [ ] 1.1 Criar o projeto electron-vite com React e TypeScript, a estrutura de pastas e os scripts de build e teste.
- [ ] 1.2 Ligar o design system da Chiaro pelo alias `@chiaro`, com tokens, fontes empacotadas e tema Noite nas duas telas e nas janelas.
- [ ] 1.3 Desenhar o ícone próprio do teleprompter em SVG e gerar dele todos os tamanhos e formatos das duas plataformas.
- [ ] 1.4 Ligar a versão única do `package.json` ao rodapé da tela de controle e criar o `CHANGELOG.md`.
- [ ] 1.5 Configurar o electron-builder e o workflow de Release do GitHub Actions para Windows e Mac.
- [ ] 1.6 Criar as pontes de preload, os adaptadores de plataforma e o log local.
- [ ] 1.7 Implementar os módulos puros de movimento, relógio comum, diagramação, texto, constantes e IPC.
- [ ] 1.8 Montar a base de testes unitários, de integração e de ponta a ponta, com os ganchos só do build de teste.

## Implementation Details
O repositório está vazio, exceto por `design-system/chiaro/` (somente leitura) e `.compozy/`. Siga a TechSpec nas seções "Estrutura do repositório", "Interfaces centrais", "Constantes de comportamento", "Algoritmos principais: Diagramação", "Contratos de IPC", "Design system", "Ícone do produto", "Versão" e "Abordagem de testes".

Arquivos a criar: `package.json`, `CHANGELOG.md`, `electron.vite.config.ts`, `electron-builder.yml`, `build/icone.svg`, `scripts/gerar-icones.mjs`, `.github/workflows/release.yml`, `src/main/index.ts`, `src/main/platform.ts`, `src/preload/control.ts`, `src/preload/output.ts`, `src/renderer/control/index.html`, `src/renderer/control/App.tsx`, `src/renderer/output/index.html`, `src/renderer/output/OutputApp.tsx`, `src/renderer/shared/clock.ts`, `src/shared/motion.ts`, `src/shared/layout.ts`, `src/shared/text.ts`, `src/shared/defaults.ts`, `src/shared/ipc.ts`, configuração do Vitest e do Playwright.

O `scripts/baixar-modelos.mjs` e `resources/models/` são da tarefa da prova da voz; aqui o `electron-builder.yml` só declara o `extraResources`. O repositório `audiovisualpecege/teleprompter` é criado na tarefa de entrega; o workflow já aponta para ele.

### Relevant Files
- `design-system/chiaro/DESIGN.md`: regras da Chiaro para tema Noite, ícone do produto e versão.
- `design-system/chiaro/readme.md`: o design system completo, a ler antes de codificar tela.
- `design-system/chiaro/styles.css`: ponto de entrada dos tokens importado pelas duas telas.
- `design-system/chiaro/tokens/colors.css`: bloco `[data-theme="noite"]` com superfícies, textos e `--accent`.
- `design-system/chiaro/tokens/fonts.css` e `design-system/chiaro/fonts/`: Altivo e Archivo empacotadas no build.
- `design-system/chiaro/guidelines/brand-icone.html` e `colors-gradients.html`: linguagem e gradiente para o ícone.
- `.compozy/tasks/034-teleprompter-para-uso-interno/_techspec.md`: estrutura, interfaces, constantes e IPC.

### Dependent Files
- `src/shared/ipc.ts`: contrato usado por todas as tarefas seguintes.
- `src/shared/motion.ts` e `src/shared/layout.ts`: base do `ScrollEngine`, do `LayoutService` e do `Stage`.
- `src/shared/text.ts`: base do `VoiceTracker` e dos avisos de contraste.
- `src/shared/defaults.ts`: recalibrado pela tarefa da prova da voz.
- `src/renderer/control/App.tsx` e `src/renderer/output/OutputApp.tsx`: cascas preenchidas pelas tarefas de tela.

### Related ADRs
- [ADR-006: Processo principal dono da rolagem, janelas desenham por trechos de movimento sobre um palco lógico fixo](adrs/adr-006.md): define `MotionSegment`, relógio comum e palco de 1920.
- [ADR-009: Build com electron-vite, instaladores com electron-builder publicados pelo GitHub Actions](adrs/adr-009.md): ferramentas de build e distribuição.

## Deliverables
- Projeto que compila e abre a janela de controle no tema Noite, com `v1.0.0` no rodapé.
- `build/icone.svg` e todos os tamanhos gerados, usados no instalador e nas janelas.
- `CHANGELOG.md`, `electron-builder.yml` e `.github/workflows/release.yml`.
- Núcleo compartilhado puro e contratos de IPC tipados.
- Base de testes com `npm test`, `npm run test:voice` e `npm run test:e2e` funcionando.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract: read each ID's full definition there before writing tests.

- [ ] UT-001, UT-002, UT-003, UT-004, UT-005, UT-006: `positionAt` dos trechos `hold`, `cruise` e `glide`.
- [ ] UT-007, UT-008, UT-009: relógio comum e correção de desvio.
- [ ] UT-010, UT-011, UT-012, UT-013, UT-014, UT-015, UT-016, UT-017, UT-018, UT-019, UT-020, UT-021, UT-022: diagramação pura no palco lógico.
- [ ] UT-025, UT-026, UT-027, UT-028, UT-029, UT-030, UT-031, UT-032, UT-033: normalização, vocabulário, contraste e cores.
- [ ] UT-223: versão no rodapé da tela de controle.
- [ ] UT-244: tema Noite nos dois `index.html`, sem seletor de tema.
- [ ] IT-002: uma hora de `cruise` com correção de relógio, sem diferença acumulada.

## Success Criteria
- Every assigned test case implemented and passing
- Design system: as duas telas importam os tokens e as fontes de `@chiaro`, sem cores, raios ou fontes copiados soltos no código.
- Tema escuro: nenhuma tela, janela ou área abre em fundo claro, nem por um instante ao carregar; o fundo resolvido é `#070010`.
- Ícone do produto: `build/icone.svg` mostra um teleprompter (vidro, linhas e faixa de referência), não usa o ícone nem o logo da Chiaro, é legível em 16 px, e os PNG, o `.ico` e o `.icns` saem dele pelo script.
- Versão: mudar o `version` do `package.json` muda o `v1.0.0` do rodapé e o nome dos instaladores sem nenhuma outra edição.
- `npm run build` gera o programa, e o workflow de Release é válido para Windows e Mac.
