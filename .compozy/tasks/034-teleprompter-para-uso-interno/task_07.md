---
status: pending
title: Aviso de versão nova, Sobre, voltar ao padrão e entrega 1.0.0
type: infra
complexity: medium
---

# Task 7: Aviso de versão nova, Sobre, voltar ao padrão e entrega 1.0.0

## Overview
Fecha a primeira versão: o aviso de versão nova pela Release mais nova do GitHub, a tela Sobre (versão, motor de voz, atraso médio, pasta de registros e assinatura "um produto Chiaro Filmes"), o voltar ao padrão dos ajustes e o acabamento visual. Entrega os instaladores 1.0.0 para Windows e Mac publicados na Release de `audiovisualpecege/teleprompter`, o `_instaladores.txt` e o Como usar com a liberação na primeira abertura e a lista de conferência do estúdio.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details: do not duplicate here
- FOCUS ON "WHAT": describe what needs to be accomplished, not how
- MINIMIZE CODE: show code only to illustrate current structure or problem areas
- TESTS REQUIRED: implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST seguir o design system da Chiaro Filmes (`design-system/chiaro/DESIGN.md` e os arquivos que ele indica) no aviso de versão nova, no progresso do download, na tela Sobre e no diálogo de voltar ao padrão, com os componentes de `@chiaro/components/...`, os tokens e o tema Noite, sem nenhum elemento em fundo claro.
2. MUST implementar `src/main/updates.ts` (`UpdateChecker`): uma consulta por abertura a `GET https://api.github.com/repos/audiovisualpecege/teleprompter/releases/latest` por `net.fetch`, sem autenticação, limite de 5 s, comparação semver da tag com `app.getVersion()`, asset `-win-x64.exe` ou `-mac-<arch>.dmg`, e qualquer falha só no log (`update.check`), sem aviso. `TP_UPDATE_URL` só existe no build de teste.
3. MUST mostrar o aviso só na tela de controle, com "Baixar e instalar" e "Fechar": o download vai para `app.getPath('downloads')` com progresso, depois `shell.openPath` abre o instalador; conexão cortada não deixa arquivo parcial e mostra "Não foi possível baixar a versão nova"; "Fechar" esconde até o fim da sessão. As saídas nunca mostram o aviso.
4. MUST garantir que a única chamada de rede do programa é essa consulta e o download.
5. MUST implementar a tela Sobre com `v1.0.0` lida de `__APP_VERSION__`, o motor de voz ativo, o atraso médio da voz, o botão "Abrir pasta de registros" e a assinatura "um produto Chiaro Filmes" com o `Logo` branco da Chiaro seguindo `guidelines/brand-logos.html`; o logo e o ícone da Chiaro nunca substituem o ícone do produto.
6. MUST implementar "Voltar ao padrão" com o `Dialog` de confirmação da Chiaro, que só no botão do diálogo envia `cmd:settings resetAll` e devolve 1,00x, modo "Perto", motor Vosk, atalhos padrão e saídas sem inversão.
7. MUST fazer o acabamento visual da tela de controle conferindo cada tela contra o design system (tokens, Altivo em caixa alta nos títulos, cantos arredondados, `--shadow-glow` nas ações principais, textos sem emoji, sem ponto de exclamação e sem travessão).
8. MUST criar o repositório público `audiovisualpecege/teleprompter` com `gh repo create audiovisualpecege/teleprompter --public`, sem trocar a conta do `gh`, e publicar a Release `v1.0.0` pelo workflow com `Teleprompter-1.0.0-win-x64.exe`, `Teleprompter-1.0.0-mac-x64.dmg` e `Teleprompter-1.0.0-mac-arm64.dmg`, todos com o ícone do produto.
9. MUST atualizar `_instaladores.txt` com os instaladores da 1.0.0 e conferir que o `CHANGELOG.md` tem a entrada da 1.0.0 com a data da Release.
10. MUST escrever o Como usar em português: instalar no Windows (instalador sem assinatura: "Mais informações" e "Executar assim mesmo") e no Mac (liberar o app na primeira abertura), permissão de microfone, preparar o roteiro, montar o estúdio, gravar com operador e sozinho com voz, atalhos, pedal e passador, e a lista de conferência manual com duas saídas reais de inversões diferentes, pedal e passador.
</requirements>

## Subtasks
- [ ] 7.1 Implementar a consulta da Release mais nova e a comparação de versões, com falhas silenciosas.
- [ ] 7.2 Implementar o aviso de versão nova com download, progresso e abertura do instalador.
- [ ] 7.3 Implementar a tela Sobre com versão, voz, registros e a assinatura da Chiaro.
- [ ] 7.4 Implementar o voltar ao padrão com o diálogo de confirmação escuro.
- [ ] 7.5 Fazer o acabamento visual de todas as telas contra o design system.
- [ ] 7.6 Criar o repositório, gerar os instaladores 1.0.0 e publicar a Release.
- [ ] 7.7 Atualizar `_instaladores.txt` e o `CHANGELOG.md`.
- [ ] 7.8 Escrever o Como usar com a liberação na primeira abertura e a lista de conferência do estúdio.
- [ ] 7.9 Rodar as jornadas de ponta a ponta de ajustes, atualização e instalação no Windows e no Mac.

## Implementation Details
Siga as seções "Pontos de integração: API do GitHub", "Versão", "Design system" (logo da Chiaro, ícone do produto), "Monitoramento e observabilidade" (tela Sobre) e "Análise de impacto" da TechSpec.

Arquivos a criar: `src/main/updates.ts`, aviso de versão nova, tela Sobre e diálogo de voltar ao padrão em `src/renderer/control/`, `_instaladores.txt`, o Como usar. Arquivos a modificar: `src/main/index.ts`, `src/main/store.ts` (`update` no `StateSnapshot`), `CHANGELOG.md`, `.github/workflows/release.yml` (jobs de E2E no Windows e no Mac, se preciso).

### Relevant Files
- `package.json`: fonte única da versão (tarefa 1).
- `electron-builder.yml`, `.github/workflows/release.yml`, `build/icone.svg` e os ícones gerados (tarefa 1).
- `scripts/baixar-modelos.mjs`: modelos que entram no instalador (tarefa 2).
- `src/main/settings.ts`: `resetAll` (tarefa 3).
- `design-system/chiaro/guidelines/brand-logos.html` e `design-system/chiaro/components/brand/Logo.jsx`: assinatura da Chiaro.

### Dependent Files
- `README` ou Como usar do repositório: ponto de partida de quem instala.
- Próximas versões: seguem o semver e o `CHANGELOG.md`.

### Related ADRs
- [ADR-009: Build com electron-vite, instaladores com electron-builder publicados pelo GitHub Actions](adrs/adr-009.md): Releases e aviso de versão pela API do GitHub.
- [ADR-008: Roteiro em arquivo `.roteiro` (JSON) e ajustes em JSON na pasta do usuário](adrs/adr-008.md): voltar ao padrão e ajustes preservados ao instalar por cima.

## Deliverables
- `UpdateChecker`, aviso de versão nova, tela Sobre e voltar ao padrão.
- Repositório `audiovisualpecege/teleprompter` com a Release `v1.0.0` e os três instaladores.
- `_instaladores.txt`, `CHANGELOG.md` e Como usar atualizados.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract: read each ID's full definition there before writing tests.

- [ ] UT-213, UT-214, UT-215, UT-216, UT-217, UT-218, UT-219, UT-220, UT-221, UT-222: consulta, comparação, falhas, plataforma, download e fechar o aviso.
- [ ] UT-237: aviso de versão nova na tela de controle.
- [ ] UT-241: voltar ao padrão só pelo diálogo de confirmação.
- [ ] UT-256: download cortado no meio.
- [ ] IT-021: aviso e download contra um servidor local.
- [ ] E2E-011: ajustes guardados ao reiniciar e voltar ao padrão.
- [ ] E2E-012: aviso só na tela de controle, nunca nas saídas.
- [ ] E2E-013: instalar no Windows, sem rede, por cima, com uma única tentativa de rede.
- [ ] E2E-014: abrir o DMG no Mac com `v1.0.0` e tema Noite.

## Success Criteria
- Every assigned test case implemented and passing
- Design system: aviso, Sobre e diálogo de voltar ao padrão usam os componentes e tokens da Chiaro; o logo da Chiaro aparece só como assinatura no Sobre.
- Tema escuro: nenhuma tela, aviso, diálogo ou barra de progresso aparece em fundo claro, no Windows e no Mac.
- Ícone do produto: o instalador, o atalho do menu Iniciar, o Dock e os arquivos `.roteiro` mostram o ícone do teleprompter, não o da Chiaro.
- Versão: a tela de controle e o Sobre mostram `v1.0.0`, os instaladores se chamam `Teleprompter-1.0.0-*`, e o `CHANGELOG.md` tem a 1.0.0 com data.
- Os links de download e atualização apontam só para `github.com/audiovisualpecege/teleprompter`.
