# Test Specification: Teleprompter para uso interno (ideia #34)

Contrato canônico de testes do teleprompter. Acompanha o `_techspec.md`. O comportamento vem do `_user_stories.md`; os componentes, do `_techspec.md`.

## Estratégia

- **Ferramentas:**
  - **Unitário e integração:** Vitest, com React Testing Library e `jsdom` nos componentes de tela.
  - **Ponta a ponta:** Playwright `_electron.launch` sobre o programa empacotado.
- **Falsos só nas bordas:** `src/main/platform.ts` (`screen`, `BrowserWindow`, `powerSaveBlocker`, `dialog`, `net`, `shell`), relógio falso e `measure` falso de 10 px por caractere. Disco real em pasta temporária.
- **Execução:**
  - `npm test`: unitários e integração sem modelo de voz.
  - `npm run test:voice`: integração com Vosk. O Parakeet roda só no job noturno.
  - `npm run test:e2e`: Playwright no build de teste, com `TP_FAKE_DISPLAYS` e áudio falso do Chromium (`--use-file-for-fake-audio-capture`).
- **Convenções:**
  - casos em tabela quando a entrada varia (`it.each`);
  - nomes `componente: comportamento`;
  - nenhum teste depende de outro;
  - fixtures em `tests/fixtures/`: `.txt` em UTF-8 e em Windows-1252, `.docx` com tabela, imagem, caixa de texto, marcas de revisão, só imagens, corrompido e protegido, `.roteiro` válidos e inválidos, WAVs de leitura da equipe.
- **Layout de referência dos testes de rolagem:** 10 linhas de 100 px (`y` de 0 a 900), 60 palavras, palco 1920.

## Matriz de cobertura

| Origem | Comportamento | Unitário | Integração | E2E |
|---|---|---|---|---|
| US-001 | Colar o texto e confirmar | UT-192, UT-194, UT-203 | - | E2E-001 |
| US-001.EC-1 | Só espaços: confirmar indisponível | UT-195, UT-224 | - | - |
| US-001.EC-2 | Texto de 100 páginas | UT-020, UT-247 | - | - |
| US-001.EC-3 | Acentos e emojis, fonte reserva | UT-019, UT-250 | - | - |
| US-001.EC-4 | Colar duas vezes | UT-193 | - | - |
| US-001.EC-5 | Colar durante a rolagem automática | UT-192 | - | E2E-006 |
| US-002 | Importar `.txt` | UT-176, UT-177, UT-208 | IT-005 | E2E-002 |
| US-002.EC-1 | Arquivo vazio | UT-178 | - | - |
| US-002.EC-2 | Não é texto | UT-179 | - | - |
| US-002.EC-3 | Alterações não salvas antes de importar | UT-200 | - | E2E-003 |
| US-002.EC-4 | Sem permissão ou indisponível | UT-180 | - | - |
| US-002.EC-5 | Cancelar a escolha | UT-191 | - | - |
| US-003 | Importar `.docx` | UT-182, UT-183, UT-239 | IT-006 | E2E-002 |
| US-003.EC-1 | Corrompido ou protegido | UT-184, UT-185 | IT-007 | - |
| US-003.EC-2 | `.doc`, `.pdf` e filtro do seletor | UT-188, UT-190 | - | - |
| US-003.EC-3 | Só imagens | UT-186 | - | - |
| US-003.EC-4 | Marcas de revisão | UT-187 | - | - |
| US-003.EC-5 | Documento grande e indicador de carregando | UT-189, UT-240 | - | - |
| US-004 | Salvar com aparência | UT-164, UT-165, UT-166, UT-236 | IT-008 | E2E-001 |
| US-004.EC-1 | Sem permissão ou disco cheio | UT-167, UT-168 | IT-009 | - |
| US-004.EC-2 | Arquivo movido por fora | UT-169 | - | - |
| US-004.EC-3 | Salvar com edição não confirmada | UT-199 | - | - |
| US-004.EC-4 | Nome inválido | UT-170 | - | - |
| US-004.EC-5 | Salvar duas vezes | UT-171 | - | - |
| US-005 | Abrir roteiro salvo | UT-172, UT-204 | IT-008, IT-023 | E2E-001, E2E-017 |
| US-005.EC-1 | Arquivo inválido | UT-173 | - | - |
| US-005.EC-2 | Versão mais nova do programa | UT-174 | - | - |
| US-005.EC-3 | Fonte que falta | UT-023 | IT-025 | - |
| US-005.EC-4 | Alterações não salvas antes de abrir | UT-200 | - | - |
| US-005.EC-5 | Abrir o mesmo arquivo | UT-207 | - | - |
| US-006 | Editar e confirmar sem salto | UT-192, UT-194, UT-197 | IT-003 | E2E-006 |
| US-006.EC-1 | Trecho da faixa apagado | UT-059 | - | - |
| US-006.EC-2 | Confirmar texto vazio | UT-195 | - | - |
| US-006.EC-3 | Confirmar com automação ligada | UT-060, UT-101 | IT-003 | - |
| US-006.EC-4 | Confirmar duas vezes | UT-196 | - | - |
| US-006.EC-5 | Editor não salta com a rolagem | UT-242 | - | E2E-006 |
| US-007 | Aviso de alterações não salvas | UT-200, UT-201 | - | E2E-003, E2E-018 |
| US-007.EC-1 | Queda inesperada e recuperação | UT-205, UT-206 | IT-022 | - |
| US-007.EC-2 | "Salvar" falha no aviso | UT-202 | - | - |
| US-007.EC-3 | Só aparência conta como alteração | UT-198 | - | - |
| US-008 | Fonte e tamanho | UT-024, UT-211 | IT-004 | E2E-001 |
| US-008.EC-1 | Valor fora da faixa ou não numérico | UT-211, UT-232 | - | - |
| US-008.EC-2 | Fonte removida | UT-023 | IT-025 | - |
| US-008.EC-3 | Tamanho grande, palavra maior que a linha | UT-012 | - | - |
| US-008.EC-4 | Mudar tamanho rolando | UT-061 | IT-004 | - |
| US-009 | Cores do texto, fundo e faixa | UT-212 | IT-004 | E2E-001 |
| US-009.EC-1 | Contraste baixo | UT-031, UT-032, UT-231 | - | - |
| US-009.EC-2 | Faixa opaca | UT-249 | - | - |
| US-009.EC-3 | Código de cor inválido | UT-033, UT-233 | - | - |
| US-010 | Caixa alta, baixa ou normal | UT-013, UT-014, UT-015 | - | E2E-001 |
| US-010.EC-1 | Acentos e "ç" | UT-013 | - | - |
| US-010.EC-2 | Trocar caixa com a voz ligada | UT-029, UT-080 | - | - |
| US-010.EC-3 | Caixa muda as linhas, faixa estável | UT-056 | IT-004 | - |
| US-011 | Alinhamento | UT-022 | - | E2E-001 |
| US-011.EC-1 | Alinhar rolando, sem salto | UT-061 | - | - |
| US-011.EC-2 | Linhas de uma palavra | UT-022 | - | - |
| US-012 | Margens laterais | UT-011, UT-235 | IT-004 | E2E-001 |
| US-012.EC-1 | Margem fora da faixa | UT-211 | - | - |
| US-012.EC-2 | Margem máxima com fonte grande | UT-016 | - | - |
| US-012.EC-3 | Resoluções diferentes, mesmas quebras | UT-017, UT-246 | IT-001 | E2E-004 |
| US-013 | Posição da faixa | UT-212, UT-246 | IT-004 | - |
| US-013.EC-1 | Faixa fora da faixa permitida | UT-211 | - | - |
| US-013.EC-2 | Início do texto | UT-035 | - | - |
| US-013.EC-3 | Fim do texto | UT-036, UT-040 | - | - |
| US-014 | Prévia sincronizada | UT-248 | IT-001, IT-026 | E2E-005 |
| US-014.EC-1 | Controle redimensionado ou minimizado | - | - | E2E-019, E2E-020 |
| US-014.EC-2 | Horas de uso sem diferença | UT-006, UT-009 | IT-002 | - |
| US-015 | Abrir saída num monitor | UT-114, UT-115, UT-118, UT-253 | - | E2E-004 |
| US-015.EC-1 | Só um monitor | UT-119 | - | - |
| US-015.EC-2 | Segunda saída no mesmo monitor | UT-117 | - | - |
| US-015.EC-3 | Monitor ligado com o programa aberto | UT-120 | - | E2E-007 |
| US-015.EC-4 | Resoluções diferentes | UT-246 | - | E2E-004 |
| US-016 | Espelhar cada saída | UT-121, UT-122, UT-123, UT-248 | - | E2E-004 |
| US-016.EC-1 | Espelhar rolando | UT-121 | IT-018 | - |
| US-016.EC-2 | Sinal de voz espelhado junto | UT-248, UT-252 | - | - |
| US-017 | Mesmo ponto em todas as saídas | UT-246 | IT-001 | E2E-005 |
| US-017.EC-1 | Computador modesto, voz e duas saídas | UT-247 | IT-012 | E2E-008 |
| US-017.EC-2 | Saída arrastada ou fora da tela cheia | UT-134 | - | - |
| US-018 | Monitor desconectado | UT-124, UT-125 | IT-018 | E2E-007 |
| US-018.EC-1 | Monitor da tela de controle cai | UT-136, UT-137 | - | - |
| US-018.EC-2 | Desliga e religa várias vezes | UT-126 | - | E2E-007 |
| US-018.EC-3 | Outro monitor no lugar | UT-127 | - | - |
| US-019 | Fechar uma saída | UT-129, UT-135, UT-154 | - | E2E-004 |
| US-019.EC-1 | Fechar todas rolando | UT-129 | IT-026 | - |
| US-019.EC-2 | Fechar a tela de controle | UT-200 | - | E2E-018 |
| US-020 | Reabrir saídas ao abrir | UT-130, UT-131 | IT-010 | E2E-004 |
| US-020.EC-1 | Primeira abertura | UT-133 | - | - |
| US-020.EC-2 | Monitor guardado é o do controle | UT-132 | - | - |
| US-021 | Botões subir e descer | UT-034, UT-038 | - | E2E-005 |
| US-021.EC-1 | Subir no início | UT-035 | - | - |
| US-021.EC-2 | Descer no fim | UT-036 | - | - |
| US-021.EC-3 | Cliques rápidos | UT-037 | - | - |
| US-021.EC-4 | Com a automática ligada | UT-052 | - | - |
| US-022 | Roda do mouse | UT-039, UT-234 | - | E2E-005 |
| US-022.EC-1 | Roda rápida e limites | UT-040, UT-041 | - | - |
| US-022.EC-2 | Rolagem inercial do trackpad | UT-039 | - | - |
| US-022.EC-3 | Com automação ligada | UT-052 | IT-024 | - |
| US-023 | Teclado, pedal e passador | UT-142, UT-143 | IT-019 | E2E-008 |
| US-023.EC-1 | Cursor no editor | UT-145, UT-146, UT-147, UT-226 | - | E2E-006 |
| US-023.EC-2 | Outro programa em foco | UT-142 | - | - |
| US-023.EC-3 | Tecla segurada | UT-143, UT-144 | - | - |
| US-023.EC-4 | Pedal com cursor no editor | UT-145, UT-192 | - | E2E-006 |
| US-024 | Trocar atalhos | UT-148, UT-153 | IT-010 | E2E-010 |
| US-024.EC-1 | Conflito de tecla | UT-149, UT-150 | - | E2E-010 |
| US-024.EC-2 | Tecla reservada | UT-151 | - | E2E-010 |
| US-024.EC-3 | Ação sem atalho | UT-152 | - | - |
| US-024.EC-4 | Gravar e cancelar | UT-245 | - | - |
| US-025 | Voltar ao início | UT-042, UT-103 | - | E2E-015 |
| US-025.EC-1 | Já no início | UT-043 | - | - |
| US-025.EC-2 | Duas vezes seguidas | UT-043 | - | - |
| US-025.EC-3 | Com alterações pendentes | UT-209 | - | - |
| US-026 | Iniciar e pausar a automática | UT-044, UT-045, UT-096 | - | E2E-005 |
| US-026.EC-1 | Fim do texto | UT-050 | - | - |
| US-026.EC-2 | Sem texto confirmado | UT-046, UT-225 | - | - |
| US-026.EC-3 | Iniciar e pausar rápido | UT-051 | - | - |
| US-026.EC-4 | Proteção de tela e suspensão | UT-139, UT-140 | IT-020 | E2E-016 |
| US-027 | Velocidade em passos de 0,25x | UT-048, UT-062, UT-243 | - | E2E-005 |
| US-027.EC-1 | Teto 3,00x | UT-048 | - | - |
| US-027.EC-2 | Piso 0,25x | UT-048 | - | - |
| US-027.EC-3 | Mudar com a rolagem pausada | UT-049 | - | - |
| US-027.EC-4 | Muitos toques seguidos | UT-156 | - | - |
| US-028 | Ligar e desligar a voz | UT-081, UT-090, UT-095 | IT-017 | E2E-008 |
| US-028.EC-1 | Sem microfone | UT-083, UT-107 | - | - |
| US-028.EC-2 | Permissão negada | UT-084, UT-106 | - | - |
| US-028.EC-3 | Sem texto confirmado | UT-082, UT-225 | - | - |
| US-028.EC-4 | Liga e desliga seguidos | UT-094 | - | - |
| US-028.EC-5 | "Preparando" com manual funcionando | UT-104 | - | - |
| US-029 | Escolher microfone e medidor | UT-109, UT-238 | IT-010 | E2E-008 |
| US-029.EC-1 | Microfone guardado ausente | UT-102 | - | - |
| US-029.EC-2 | Trocar microfone com a voz ligada | UT-098 | - | - |
| US-029.EC-3 | Interface com várias entradas | UT-238 | - | - |
| US-030 | Texto acompanha a leitura | UT-063, UT-053 | IT-012, IT-015 | E2E-008 |
| US-030.EC-1 | Pulo maior que a janela | UT-064 | IT-014 | - |
| US-030.EC-2 | Voltar atrás | UT-067, UT-054 | - | - |
| US-030.EC-3 | Frase repetida | UT-068 | - | - |
| US-030.EC-4 | Ruído e outra voz | UT-066 | IT-013 | - |
| US-030.EC-5 | Números, siglas, nomes | UT-026, UT-074, UT-075 | - | - |
| US-030.EC-6 | Fim do texto | UT-078, UT-097 | - | - |
| US-031 | Improvisar sem o texto andar | UT-085, UT-086 | IT-013 | E2E-008 |
| US-031.EC-1 | Improviso longo | UT-087 | - | - |
| US-031.EC-2 | Improviso com palavras adiante | UT-069 | - | - |
| US-032 | Modo "Pulos para a frente" | UT-070, UT-099 | IT-016 | - |
| US-032.EC-1 | Frase repetida adiante | UT-071 | - | - |
| US-032.EC-2 | Reconhecimento incerto | UT-072, UT-073 | - | - |
| US-032.EC-3 | Voltar atrás | UT-067 | - | - |
| US-033 | Manual com a voz ligada | UT-079, UT-052 | IT-024 | E2E-008 |
| US-033.EC-1 | Manual e voz no mesmo instante | UT-055 | IT-024 | - |
| US-033.EC-2 | Voltar ao início com a voz | UT-103 | - | E2E-015 |
| US-033.EC-3 | Mover para ponto ainda não lido | UT-079 | - | - |
| US-034 | Alerta forte na falha | UT-088, UT-089, UT-090, UT-230 | IT-017 | E2E-009 |
| US-034.EC-1 | Falha não apaga as saídas | UT-088 | IT-017 | E2E-009 |
| US-034.EC-2 | Falhas repetidas, um alerta | UT-091 | - | - |
| US-034.EC-3 | Computador lento | UT-093, UT-113 | - | - |
| US-034.EC-4 | Silêncio não é falha | UT-087 | - | - |
| US-035 | Sinal discreto no TP | UT-251, UT-138 | IT-017 | E2E-008 |
| US-035.EC-1 | Saída espelhada | UT-248, UT-252 | - | - |
| US-035.EC-2 | Sinal fora do texto | UT-252 | - | - |
| US-035.EC-3 | Sem piscar a cada palavra | UT-100 | - | - |
| US-036 | Ajustes guardados e voltar ao padrão | UT-158, UT-161, UT-210, UT-241 | IT-010 | E2E-011 |
| US-036.EC-1 | Ajustes corrompidos | UT-159 | IT-011 | - |
| US-036.EC-2 | Dois usuários do Windows | UT-163 | - | - |
| US-036.EC-3 | Nada sai do computador | UT-216 | - | E2E-013 |
| US-037 | Ver a versão | UT-223 | - | E2E-001, E2E-014 |
| US-037.EC-1 | Saídas nunca mostram a versão | UT-254 | - | E2E-012 |
| US-038 | Aviso de versão nova | UT-213, UT-214, UT-215, UT-221, UT-237 | IT-021 | E2E-012 |
| US-038.EC-1 | Sem internet ou GitHub fora | UT-216, UT-217, UT-218 | - | - |
| US-038.EC-2 | Fechar o aviso | UT-222 | - | - |
| US-038.EC-3 | Aviso nunca nas saídas nem na rolagem | UT-254 | - | E2E-012 |
| US-039 | Instalar e abrir | UT-227, UT-244 | - | E2E-001, E2E-013, E2E-014 |
| US-039.EC-1 | Windows não reconhece o programa | (Como usar; conferido na revisão do documento) | - | E2E-013 |
| US-039.EC-2 | Sem internet | - | - | E2E-013 |
| US-039.EC-3 | Instalar por cima | - | - | E2E-013 |
| motion.ts | `positionAt` dos três trechos | UT-001 a UT-006 | IT-002 | - |
| clock.ts | Relógio comum | UT-007 a UT-009 | IT-002 | - |
| layout.ts e LayoutService | Diagramação e fontes | UT-010 a UT-024 | IT-004, IT-025 | - |
| text.ts | Normalização, números, contraste, cores | UT-025 a UT-033 | - | - |
| ScrollEngine | Comandos, limites, âncora, automática | UT-034 a UT-062 | IT-001 a IT-004 | E2E-005 |
| VoiceTracker | Alinhamento | UT-063 a UT-080 | IT-012 a IT-016 | - |
| VoiceController | Estados da voz | UT-081 a UT-104 | IT-017, IT-024 | E2E-009 |
| AudioCapture, VoskEngine, ParakeetEngine, ParakeetHost | Captura e motores | UT-105 a UT-113 | IT-012 a IT-016 | E2E-008 |
| DisplayRegistry, OutputManager, PowerGuard | Saídas e monitores | UT-114 a UT-141 | IT-018, IT-020 | E2E-004, E2E-007 |
| KeymapService | Atalhos | UT-142 a UT-156 | IT-019 | E2E-010 |
| SettingsStore | Ajustes | UT-157 a UT-163 | IT-010, IT-011 | E2E-011 |
| ScriptFiles e importadores | `.roteiro`, `.txt`, `.docx` | UT-164 a UT-191 | IT-005 a IT-009 | E2E-002 |
| AppStore (documento) | Rascunho, confirmação, recuperação | UT-192 a UT-212 | IT-003, IT-022, IT-023 | E2E-003 |
| UpdateChecker | Versão nova | UT-213 a UT-222 | IT-021 | E2E-012 |
| ControlApp | Tela de controle | UT-223 a UT-245 | - | E2E-001 |
| Stage e OutputApp | Desenho das saídas | UT-246 a UT-254 | IT-001 | E2E-004 |
| Contratos de IPC | Canais `cmd:*`, `state:*`, `motion:*`, `layout:*`, `asr:*`, `clock:*` | UT-116, UT-117, UT-149, UT-151, UT-082, UT-083, UT-084, UT-221, UT-255, UT-256 | IT-001, IT-017, IT-019, IT-026 | - |

## Testes unitários

### motion.ts (TechSpec: Interfaces centrais)

- **UT-001** (happy): `positionAt({kind:'hold', y:250}, 99999)` devolve 250.
- **UT-002** (happy): `positionAt({kind:'cruise', y0:100, t0:1000, pxPerSec:50, yEnd:900}, 3000)` devolve 200.
- **UT-003** (boundary): o mesmo `cruise` em `now = 100000` devolve 900 (`yEnd`), nunca mais.
- **UT-004** (happy): `positionAt({kind:'glide', y0:0, y1:100, t0:0, durMs:200}, 100)` devolve 87,5 (`easeOutCubic(0,5) = 0,875`).
- **UT-005** (boundary): o mesmo `glide` em `now = -50` devolve 0 e em `now = 500` devolve 100.
- **UT-006** (state): `cruise` com `y0:0, t0:0, pxPerSec:10, yEnd:1e9` em `now = 36.000.000` (10 horas) devolve exatamente 360.000, sem soma de passos.

### clock.ts (TechSpec: ADR-006, Contratos de IPC)

- **UT-007** (happy): dado `clock:ping` com `t0 = 1000`, resposta `mainNow = 5000` recebida em `t1 = 1010`, o desvio calculado é `5000 - 1005 = 3995`.
- **UT-008** (state): com relógio falso, uma nova medição de desvio ocorre a cada 10.000 ms e substitui a anterior.
- **UT-009** (happy): duas janelas falsas com `timeOrigin` diferentes em 7 ms, depois de corrigidas, calculam `positionAt` do mesmo `cruise` com diferença menor que 0,5 px.

### layout.ts e LayoutService (TechSpec: Algoritmos principais, Diagramação)

- **UT-010** (happy): `layoutScript("Primeiro.\n\nSegundo.", aparência padrão, measure10)` devolve 2 linhas, e o `y` da segunda é `linha1.y + 1,25 x 80 + 0,6 x 80`.
- **UT-011** (happy): com margem 10% (largura útil 1536 px, 153 caracteres) e 40 palavras de 5 letras, nenhuma linha passa de 1536 px e nenhuma palavra é cortada.
- **UT-012** (boundary): uma palavra de 300 letras sem espaço vira linhas consecutivas cuja concatenação é a palavra inteira.
- **UT-013** (happy): `letterCase: 'upper'` sobre "ação e coração" exibe "AÇÃO E CORAÇÃO", com `start` e `end` iguais aos do texto original.
- **UT-014** (happy): `letterCase: 'lower'` sobre "AÇÃO" exibe "ação".
- **UT-015** (happy): `letterCase: 'normal'` exibe "Ação" como foi escrito, e o texto guardado não muda.
- **UT-016** (boundary): margem 40% e fonte 200 com `measure10` deixam ao menos uma palavra por linha, e nenhuma linha fica vazia.
- **UT-017** (happy): `layoutScript` não recebe tamanho de tela, e duas chamadas com a mesma entrada devolvem listas de linhas idênticas (`toEqual`).
- **UT-018** (happy): com fonte 80, cada linha tem `height = 100`, e `totalHeight` é a soma das alturas mais os espaços de parágrafo.
- **UT-019** (happy): "Olá, coração 🎬 ñ" aparece no `text` das linhas com os mesmos caracteres.
- **UT-020** (boundary): um texto de 300.000 caracteres (100 páginas) é diagramado em menos de 500 ms com `measure10`.
- **UT-021** (happy): `wordCount` de "Um dois, três.\nQuatro" é 4.
- **UT-022** (happy): `align: 'center'` e `align: 'left'` produzem as mesmas quebras, inclusive com linhas de uma palavra só.
- **UT-023** (error): `LayoutService` com `document.fonts.load` rejeitando "Fonte Sumida" diagrama em Archivo e devolve `missingFont: 'Fonte Sumida'`.
- **UT-024** (happy): `LayoutService.listFonts()` devolve as famílias de `queryLocalFonts()` sem repetição e em ordem alfabética. Se a permissão for negada, devolve só `['Archivo']`.

### text.ts (TechSpec: Algoritmos principais, Voz e Contraste)

- **UT-025** (happy): `normalizeTokens("Ação, é já!")` devolve `["acao", "e", "ja"]`.
- **UT-026** (happy): `normalizeTokens("Em 2026")` devolve `["em", "dois", "mil", "e", "vinte", "e", "seis"]`.
- **UT-027** (happy): `buildVocabulary("a casa a rua")` devolve `["a", "casa", "rua", "[unk]"]`.
- **UT-028** (boundary): `normalizeTokens("   ")` devolve `[]`, e `buildVocabulary("")` devolve `["[unk]"]`.
- **UT-029** (happy): os tokens de "AÇÃO" e de "ação" são iguais.
- **UT-030** (happy): `contrastRatio('#FFFFFF', '#000000')` devolve 21.
- **UT-031** (happy): `isLowContrast('#777777', '#808080')` devolve `true`.
- **UT-032** (boundary): um par com razão exata de 3,0 devolve `isLowContrast = false`.
- **UT-033** (error): `parseColor('#GGG')` devolve `null`, e `parseColor('#FACE9533')` devolve RGBA válido.

### ScrollEngine (TechSpec: Interfaces centrais, Algoritmos principais)

- **UT-034** (happy): em `y = 0`, `apply({type:'lineStep', dir:1})` emite `glide` de 0 a 100 com `durMs` 150.
- **UT-035** (boundary): em `y = 0`, `lineStep` com `dir: -1` não emite trecho novo, e a posição fica em 0 (primeira linha na faixa).
- **UT-036** (boundary): em `y = 900`, `lineStep` com `dir: 1` não emite trecho novo.
- **UT-037** (ordering): cinco `lineStep +1` no mesmo instante a partir de 0 terminam com alvo 500.
- **UT-038** (happy): `holdStart +1` em `y = 200` emite `cruise` de 400 px/s, e `holdEnd` 500 ms depois emite `hold` em 400.
- **UT-039** (happy): `nudge dy: 37` em `y = 0` emite `glide` até 37 em 120 ms. Sem novos `nudge`, nenhum outro trecho é emitido.
- **UT-040** (boundary): `nudge dy: 5000` em `y = 850` vai até 900.
- **UT-041** (boundary): `nudge dy: -1000` em `y = 37` vai até 0.
- **UT-042** (happy): `toStart` com `cruise` em curso emite `hold` em 0, dispara `onAutoEnded` e deixa a automação em `none`.
- **UT-043** (idempotency): `toStart` em `y = 0` duas vezes não emite trecho novo nem evento.
- **UT-044** (happy): `autoStart` com velocidade 1,00 e layout de referência emite `cruise` com `pxPerSec = 1 x 140/60 x (1000/60) ≈ 38,89`.
- **UT-045** (happy): `autoPause` em `now` emite `hold` em `positionAt(cruise, now)`.
- **UT-046** (error): `autoStart` sem texto confirmado não emite trecho e devolve `no-text`.
- **UT-047** (happy): `setSpeed 2` durante `cruise` em `now = 5000` emite novo `cruise` com `y0` igual a `positionAt(anterior, 5000)`.
- **UT-048** (boundary): `setSpeed` com 3,25 dá 3,00, com 0 dá 0,25 e com 1,30 dá 1,25.
- **UT-049** (state): `setSpeed 1,5` com a rolagem parada não emite trecho, e o próximo `autoStart` usa 1,5.
- **UT-050** (state): `cruise` que chega a 900 dispara `onAutoEnded` no instante calculado e emite `hold` em 900.
- **UT-051** (ordering): sete alternâncias `autoStart`/`autoPause` intercaladas terminam rolando, e oito terminam paradas.
- **UT-052** (happy): `lineStep +1` durante `cruise` desliza uma linha e depois reemite `cruise` a partir da nova posição.
- **UT-053** (happy): `voiceTarget y: 300` em `y = 100` emite `glide` até 300 com `durMs` entre 250 e 900.
- **UT-054** (error): `voiceTarget y: 50` em `y = 100` é ignorado.
- **UT-055** (concurrency): `voiceTarget` recebido 200 ms depois de um `lineStep` é ignorado. Recebido 400 ms depois, é aplicado.
- **UT-056** (happy): `relayout` com a âncora no caractere 520 (linha 5, `fraction` 0,5) e um layout novo de linhas de 50 px põe `y` no início da linha que contém o caractere 520, mais 25.
- **UT-057** (happy): `replaceText` com edição só depois da âncora mantém o mesmo `charOffset`.
- **UT-058** (happy): `replaceText` com 20 caracteres inseridos antes da âncora desloca o `charOffset` em +20.
- **UT-059** (boundary): `replaceText` com a âncora dentro de um trecho apagado põe a âncora no início do trecho alterado no texto novo.
- **UT-060** (state): `replaceText` durante `cruise` reemite `cruise` a partir da posição reancorada, sem pausar a automação.
- **UT-061** (state): `relayout` durante `cruise` (fonte de 80 para 120) mantém o caractere da faixa, e a automação continua.
- **UT-062** (happy): `formatSpeed(1.25)` devolve "1,25x", e `formatSpeed(1)` devolve "1,00x".

### VoiceTracker (TechSpec: Algoritmos principais, Voz)

O roteiro de teste é "o teleprompter da chiaro acompanha a leitura de quem lê o texto no vidro com calma e atenção até o fim da gravação". Os índices são dos tokens normalizados.

- **UT-063** (happy): com `cursor: 0`, modo `near` e `heard: ["teleprompter", "da", "chiaro"]`, devolve `cursor: 3`, `matched: true`.
- **UT-064** (boundary): com `cursor: 0`, `heard` que só bate com tokens a partir do índice 17 devolve `matched: false` e `cursor: 0`.
- **UT-065** (happy): `heard: ["teleprompte", "da", "chiaro"]` (semelhança 0,91) devolve `cursor: 3`.
- **UT-066** (error): `heard: ["[unk]", "[unk]", "[unk]"]` devolve `matched: false`.
- **UT-067** (state): com `cursor: 10`, `heard: ["acompanha", "a", "leitura"]` (índices 4 a 6) devolve `cursor: 10`.
- **UT-068** (happy): num roteiro em que "a leitura" aparece nos índices 5-6 e 40-41, com `cursor: 3`, `heard: ["a", "leitura"]` devolve `cursor: 6`.
- **UT-069** (happy): no modo `near` com `cursor: 0`, `heard: ["fim", "da", "gravação"]` (fora da janela) devolve `matched: false`.
- **UT-070** (happy): no modo `forwardJumps` com `cursor: 0`, `heard: ["no", "vidro", "com", "calma", "e"]`, sequência única adiante, devolve `jumped: true` e `cursor` no índice de "e".
- **UT-071** (error): no modo `forwardJumps`, uma sequência de 5 palavras que aparece duas vezes adiante devolve `jumped: false`.
- **UT-072** (boundary): no modo `forwardJumps`, 4 palavras seguidas que batem devolvem `jumped: false`.
- **UT-073** (error): no modo `forwardJumps`, 5 palavras com uma delas de semelhança 0,8 devolvem `jumped: false`.
- **UT-074** (happy): no roteiro "lançado em 2026 pela equipe", `heard: ["dois", "mil", "e", "vinte", "e", "seis"]` avança até "seis".
- **UT-075** (happy): no roteiro "a PECEGE apresenta o curso", com `cursor` em "a", `heard: ["[unk]", "apresenta", "o"]` avança até "o", passando a sigla.
- **UT-076** (happy): `heard: ["acompanha"]` (9 letras) com o token em `cursor + 1` avança uma posição.
- **UT-077** (boundary): `heard: ["de"]` com o token em `cursor + 1` devolve `matched: false`.
- **UT-078** (state): com `cursor` no último token, qualquer `heard` devolve `matched: false`.
- **UT-079** (happy): `resyncFromBand(lineIndex: 2)` põe o cursor no primeiro token da linha 2 menos um.
- **UT-080** (happy): com `letterCase: 'upper'` na aparência, os tokens do tracker são os mesmos de `'normal'`.

### VoiceController (TechSpec: Estados da voz)

Os testes usam um `SpeechEngine` falso e um relógio falso.

- **UT-081** (happy): `toggle` com texto confirmado e microfone presente vai de `off` a `preparing`, e o `asr:ready` leva a `listening`.
- **UT-082** (error): `toggle` sem texto confirmado devolve `no-text`, e o estado fica `off`.
- **UT-083** (error): `toggle` sem microfone devolve `no-mic`, com a mensagem "Nenhum microfone encontrado. Ligue um microfone e tente de novo".
- **UT-084** (error): `toggle` com permissão negada devolve `mic-denied`, com a mensagem que explica como dar a permissão no sistema.
- **UT-085** (state): em `listening`, 2.500 ms sem casar levam a `waiting`.
- **UT-086** (state): em `waiting`, uma hipótese que casa leva a `listening`.
- **UT-087** (state): 10 minutos sem hipóteses mantêm `waiting`, nunca `failed`.
- **UT-088** (error): a falha `mic-lost` em `listening` leva a `failed` com o motivo "O microfone foi desconectado", e o `ScrollEngine` recebe `hold` na posição atual.
- **UT-089** (state): em `failed` por `mic-lost`, `devicechange` com o microfone de volta reinicia a captura e leva a `listening`, sem alerta.
- **UT-090** (state): `toggle` em `failed` leva a `off` e remove o alerta.
- **UT-091** (idempotency): cinco falhas `mic-lost` seguidas mantêm um único aviso com o mesmo `id`, com hora atualizada.
- **UT-092** (error): `engine-crashed` dispara reinícios após 1, 2 e 4 s. Se a quarta falha vier, fica em `failed` com o motivo "O reconhecimento de voz parou".
- **UT-093** (error): `lag` de 3.200 leva a `failed` com o motivo "O computador não está dando conta". `lag` de 700 depois leva a `listening`.
- **UT-094** (ordering): `toggle` quatro vezes seguidas durante `preparing` termina em `off`, sem carregamento pendente.
- **UT-095** (state): ligar a voz com a automática rolando pausa a automática e deixa `automation: 'voice'`.
- **UT-096** (state): `autoStart` com a voz em `listening` desliga a voz e deixa `automation: 'auto'`.
- **UT-097** (state): o cursor no último token leva a `waiting`, e a voz continua ligada.
- **UT-098** (happy): `setMic` em `listening` reinicia a captura no novo `deviceId`, sem passar por `off`.
- **UT-099** (happy): `setMode 'forwardJumps'` vale na próxima hipótese e é gravado em `ajustes.json`, assim como `setEngine 'parakeet'`.
- **UT-100** (state): `listening`, `waiting` e `listening` em 500 ms não mudam o `voiceState` enviado às saídas. Um estado estável por 700 ms muda.
- **UT-101** (state): confirmar um texto novo com a voz ligada chama `setVocabulary` com as palavras novas, sem mudar o estado.
- **UT-102** (error): ao abrir o programa com o microfone guardado ausente, há o aviso "O microfone guardado não está ligado", e a voz não liga noutro microfone.
- **UT-103** (state): `toStart` com a voz em `listening` mantém a voz ligada, e o cursor do tracker vai a 0.
- **UT-104** (happy): em `preparing`, `lineStep` move o texto normalmente.

### AudioCapture, VoskEngine, ParakeetEngine e ParakeetHost (TechSpec: Voz, ADR-007)

- **UT-105** (happy): o reamostrador converte 4.800 amostras a 48 kHz em 1.600 amostras a 16 kHz.
- **UT-106** (error): `getUserMedia` rejeitado com `NotAllowedError` emite a falha `mic-denied`.
- **UT-107** (error): `getUserMedia` rejeitado com `NotFoundError` emite a falha `no-mic`.
- **UT-108** (error): o evento `ended` da trilha de áudio emite a falha `mic-lost`.
- **UT-109** (happy): o medidor de nível de um seno de amplitude 0,5 devolve RMS de 0,354 ± 0,01, e o silêncio devolve 0.
- **UT-110** (happy): `VoskEngine.start` cria o reconhecedor com a gramática `["a","casa","[unk]"]`, e um `partialresult` "a casa" vira `Hypothesis` com `words ["a","casa"]` e `final: false`.
- **UT-111** (error): erro no Worker do Vosk emite a falha `engine-crashed`.
- **UT-112** (error): a saída inesperada do `utilityProcess` do Parakeet emite a falha `engine-crashed`.
- **UT-113** (state): o `ParakeetHost` com decodificação falsa de 900 ms aumenta o intervalo de 600 para 900 ms. O `ParakeetEngine` emite `lag` igual a `agora - audioEndMs`.

### DisplayRegistry, OutputManager e PowerGuard (TechSpec: Saídas)

Os testes usam um `screen` falso com os monitores "A" (controle, 1920 x 1080), "B" (1920 x 1080) e "C" (1280 x 1024).

- **UT-114** (happy): a lista mostra "B, 1920 x 1080" e "C, 1280 x 1024" como livres e "A" como monitor do controle.
- **UT-115** (happy): `open B` cria a janela com os `bounds` de B, estado `open`, `id: 1` e `showBadge: true`.
- **UT-116** (error): `open A` devolve `control-display`.
- **UT-117** (error): `open B` com B ocupado devolve `display-busy`.
- **UT-118** (happy): com as saídas 1 e 2 abertas, fechar a 1 e abrir outra dá `id: 1`.
- **UT-119** (happy): só com o monitor A, a lista de livres fica vazia e mostra o texto "Não há monitor livre".
- **UT-120** (happy): `display-added` de D faz D aparecer como livre, sem reiniciar.
- **UT-121** (happy): `set {id:1, mirrorH:true}` muda só a saída 1, grava `mirrorH` para a `displayKey` de B e não emite trecho de movimento.
- **UT-122** (happy): uma saída nova em B, com `mirrorH: true` guardado, abre espelhada. Em C, sem nada guardado, abre com `mirrorH: false` e `flipV: false`.
- **UT-123** (happy): `set {id:1, flipV:true}` não altera `mirrorH`.
- **UT-124** (happy): `display-removed` de B fecha a janela 1, deixa a saída 1 em `down`, mantém a 2 em `open` e cria o aviso "Saída 1 caiu (B)".
- **UT-125** (happy): `display-added` de B com a mesma `displayKey` reabre a saída 1 depois de 1 s, com as inversões guardadas e `showBadge: false`.
- **UT-126** (idempotency): cinco ciclos de remoção e volta de B em 3 s terminam com exatamente uma janela da saída 1.
- **UT-127** (error): um monitor com o mesmo `id` de B mas `label` "Outro" não reabre a saída 1 e aparece como livre.
- **UT-128** (happy): B voltando com `id` novo, mesmo `label` e mesmo tamanho reabre a saída 1.
- **UT-129** (happy): `close 1` destrói a janela, deixa o estado `closed`, tira B das saídas guardadas e mantém o trecho de movimento das outras.
- **UT-130** (happy): ao abrir, com B e C guardados e ligados, reabre duas saídas com `showBadge: false`.
- **UT-131** (state): ao abrir, com C guardado e desligado, a saída fica `down` sem aviso.
- **UT-132** (state): ao abrir, com a `displayKey` guardada igual à do monitor do controle, não abre saída.
- **UT-133** (happy): sem saídas guardadas, nenhuma janela abre.
- **UT-134** (happy): o evento `leave-full-screen` ou um `move` para outros `bounds` devolve a janela aos `bounds` de B em tela cheia.
- **UT-135** (happy): `before-input-event` com Esc numa saída chama `preventDefault`, e a janela continua em tela cheia.
- **UT-136** (state): `display-removed` de A com C livre move a janela de controle para C.
- **UT-137** (state): `display-removed` de A com B e C ocupados mantém as duas saídas. Depois de `close 2` (em C), a janela de controle vai para C.
- **UT-138** (happy): `set {id:2, voiceSignal:false}` envia `voiceSignal: false` só à saída 2.
- **UT-139** (happy): a primeira saída aberta chama `powerSaveBlocker.start('prevent-display-sleep')` uma vez. A segunda não chama de novo.
- **UT-140** (state): fechar ou derrubar a última saída `open` chama `powerSaveBlocker.stop`.
- **UT-141** (happy): `matchDisplay` em tabela: mesmo id e label casa, id novo com mesmo label e tamanho casa, mesmo id com label diferente não casa, mesmo label com tamanho diferente não casa.

### KeymapService (TechSpec: Atalhos)

- **UT-142** (happy): os atalhos padrão em tabela:

  | Tecla | Ação |
  |---|---|
  | `Space` | `autoToggle` |
  | `ArrowDown` e `PageDown` | `down` |
  | `ArrowUp` e `PageUp` | `up` |
  | `+` | `faster` |
  | `-` | `slower` |
  | `Home` | `toStart` |
  | `V` | `voiceToggle` |
  | `Ctrl+Shift+W` | `closeOutput` |

  Um evento vindo de uma janela de fora do programa nunca chega ao serviço.
- **UT-143** (happy): `keyDown ArrowDown` emite `lineStep +1`. O primeiro `isAutoRepeat` emite `holdStart +1`. `keyUp` emite `holdEnd`.
- **UT-144** (happy): `Space` com 10 eventos `isAutoRepeat` emite um único `autoToggle`.
- **UT-145** (state): com `editorFocused: true`, `Space`, `PageDown` e `V` não emitem ação.
- **UT-146** (state): com `editorFocused: true`, `Ctrl+Shift+W` emite `closeOutput`.
- **UT-147** (happy): Esc com o editor em foco emite `editorBlur`.
- **UT-148** (happy): `set {action:'down', combo:'B'}` passa a mapear B para `down` e grava em `ajustes.json`.
- **UT-149** (error): `set {action:'down', combo:'Space'}` devolve `{conflictWith:'autoToggle'}` sem mudar nada.
- **UT-150** (happy): o mesmo pedido com `force: true` deixa Space em `down` e tira Space de `autoToggle`.
- **UT-151** (error): `Alt+F4`, `Cmd+Q`, `Alt+Tab` e `Esc` devolvem `reserved`.
- **UT-152** (happy): `clear {action:'faster'}` deixa a ação sem atalho, e o botão "+" continua funcionando.
- **UT-153** (happy): `reset` devolve exatamente os atalhos padrão.
- **UT-154** (happy): `Ctrl+Shift+W` vindo da janela da saída 2 fecha a saída 2. Vindo da janela de controle, não faz nada.
- **UT-155** (happy): no `darwin`, o atalho padrão de `closeOutput` é `Cmd+Shift+W`.
- **UT-156** (boundary): a partir de 1,00x, cinco toques em "+" dão 2,25x. Em 3,00x, mais um toque fica em 3,00x.

### SettingsStore (TechSpec: Modelos de dados, ADR-008)

- **UT-157** (happy): sem `ajustes.json`, `load()` devolve os padrões (velocidade 1, modo `near`, motor `vosk`, atalhos padrão, sem saídas).
- **UT-158** (happy): `save` seguido de `load` devolve o mesmo objeto.
- **UT-159** (error): `ajustes.json` com "{quebrado" devolve os padrões e um aviso `settings.corrupt`. A próxima abertura, com o arquivo já regravado, não avisa.
- **UT-160** (boundary): os campos fora de faixa ficam presos aos limites ou voltam ao padrão:

  | Campo | Valor no arquivo | Resultado |
  |---|---|---|
  | `speed` | 7 | 3 |
  | `lastAppearance.fontSize` | 500 | 200 |
  | `marginPct` | -5 | 0 |
  | `bandPositionPct` | 70 | 60 |
  | `voiceEngine` | "x" | `vosk` |
- **UT-161** (happy): `resetAll` grava os padrões e devolve o mesmo que `load()` sem arquivo.
- **UT-162** (error): uma falha simulada entre gravar o temporário e renomear deixa o `ajustes.json` anterior intacto.
- **UT-163** (happy): o caminho do arquivo é `path.join(app.getPath('userData'), 'ajustes.json')`.

### ScriptFiles e importadores (TechSpec: Importação, ADR-008)

- **UT-164** (happy): `save` sem caminho, com o seletor falso devolvendo `C:/tmp/a.roteiro`, grava um JSON com `formato`, `versao: 1`, o rascunho em `texto` e a aparência atual.
- **UT-165** (happy): `save` com o caminho já definido grava sem chamar o seletor.
- **UT-166** (happy): `saveAs` grava em `b.roteiro` e atualiza o `filePath` do documento.
- **UT-167** (error): uma gravação com `EACCES` devolve `permission-denied`, e o documento continua com `dirty: true`.
- **UT-168** (error): uma gravação com `ENOSPC` devolve `disk-full`.
- **UT-169** (error): uma gravação com a pasta inexistente (`ENOENT`) chama o seletor de novo local.
- **UT-170** (error): uma gravação com `EINVAL` (nome inválido) devolve `invalid-name`, e nenhum arquivo é criado.
- **UT-171** (idempotency): dois `save` seguidos produzem arquivos com bytes idênticos.
- **UT-172** (happy): `open` de um `.roteiro` válido devolve o texto e a aparência gravados.
- **UT-173** (error): `open` de um JSON sem `formato: "teleprompter-roteiro"` ou de um arquivo não JSON devolve `invalid-roteiro`.
- **UT-174** (happy): `open` com `versao: 2` e campos desconhecidos devolve o texto, a aparência conhecida e o aviso `newer-version`.
- **UT-175** (boundary): `open` com `fontSize: 999` no arquivo aplica 200.
- **UT-176** (happy): o `.txt` UTF-8 "Ação\nCoração" é importado igual.
- **UT-177** (happy): o `.txt` Windows-1252 com os bytes `41 E7 E3 6F` é importado como "Ação".
- **UT-178** (error): um `.txt` de 0 bytes ou só com espaços devolve `empty`, com a mensagem "O arquivo está vazio".
- **UT-179** (error): um PNG renomeado para `.txt` devolve `not-text`.
- **UT-180** (error): `EACCES` na leitura devolve `permission-denied`, e `ENOENT` (pasta de rede ausente) devolve `not-found`, cada um com o motivo na mensagem.
- **UT-181** (happy): "a\r\nb\rc" é importado como "a\nb\nc".
- **UT-182** (happy): um `.docx` com 3 parágrafos vira 3 parágrafos separados por `\n\n`.
- **UT-183** (happy): um `.docx` com 1 tabela, 1 imagem e 1 caixa de texto importa só os parágrafos do corpo e devolve `ignored: {tables:1, images:1, textboxes:1}`.
- **UT-184** (error): um `.docx` com zip truncado devolve `unreadable`.
- **UT-185** (error): um `.docx` protegido por senha (contêiner OLE) devolve `unreadable`.
- **UT-186** (error): um `.docx` só com imagens devolve `no-text-content`, com a mensagem "O arquivo não tem texto para importar".
- **UT-187** (happy): um `.docx` com `w:ins` "novo" e `w:del` "velho" importa "novo" e não importa "velho".
- **UT-188** (error): importar `roteiro.pdf` ou `roteiro.doc` devolve `unsupported-format`.
- **UT-189** (boundary): um `.docx` de 500 páginas importa todos os parágrafos.
- **UT-190** (happy): o seletor de importação é chamado com o filtro `[{ name: 'Texto', extensions: ['txt', 'docx'] }]`.
- **UT-191** (happy): o seletor cancelado devolve `cancelled`, e o documento não muda.

### AppStore, documento (TechSpec: Modelos de dados, Contratos de IPC `cmd:doc`)

- **UT-192** (happy): `setDraft "novo"` deixa `pending: true`, mantém `confirmedText` e não pede diagramação.
- **UT-193** (idempotency): `setDraft "x"` duas vezes deixa o rascunho "x", não "xx".
- **UT-194** (happy): `confirm` copia o rascunho para `confirmedText`, deixa `pending: false` e emite `layout:request` com `revision + 1`.
- **UT-195** (error): `confirm` com o rascunho "  \n " devolve `empty-text`, e o texto confirmado não muda.
- **UT-196** (idempotency): `confirm` sem mudança desde o último não emite `layout:request` nem trecho de movimento.
- **UT-197** (happy): `discard` devolve o rascunho ao `confirmedText` e deixa `pending: false`.
- **UT-198** (state): mudar só `textColor` deixa `dirty: true`.
- **UT-199** (state): `save` com edição pendente grava o rascunho, deixa `dirty: false` e mantém `pending: true`.
- **UT-200** (happy): `new`, `open`, `import` e o fechamento do programa com `dirty: true` devolvem `needs-confirmation` com as opções "Salvar", "Não salvar" e "Cancelar".
- **UT-201** (happy): as mesmas ações com `dirty: false` seguem sem perguntar.
- **UT-202** (error): escolher "Salvar" quando a gravação falha com `EACCES` cancela a ação original e deixa o documento intacto.
- **UT-203** (happy): o primeiro `confirm` de um documento novo põe a posição em 0.
- **UT-204** (state): abrir outro roteiro com a automática rolando pausa a automática, põe a posição em 0 e o cursor da voz em 0.
- **UT-205** (state): com `dirty: true` por 5 s, `recuperacao.json` é gravado com o rascunho. `save` ou fechamento normal o apagam.
- **UT-206** (happy): ao abrir com `recuperacao.json` presente, oferece a recuperação. `recover` restaura o rascunho com `dirty: true`.
- **UT-207** (happy): `open` do arquivo já aberto com `dirty: true` pede confirmação e depois recarrega do disco. Com `dirty: false`, recarrega direto.
- **UT-208** (happy): a importação bem-sucedida troca o rascunho, deixa `pending: true` e não muda as saídas.
- **UT-209** (state): `toStart` com edição pendente leva a posição a 0 do layout confirmado.
- **UT-210** (happy): `new` usa `lastAppearance` dos ajustes.
- **UT-211** (boundary): `cmd:appearance` com `fontSize 10` aplica 20, com `marginPct 55` aplica 40 e com `bandPositionPct 5` aplica 10.
- **UT-212** (happy): a aparência padrão é `Archivo`, 80, `#FFFFFF`, `#000000`, `#FACE9533`, `normal`, `center`, 10 e 33.

### UpdateChecker (TechSpec: Pontos de integração)

- **UT-213** (happy): a Release `v1.1.0` com o asset `Teleprompter-1.1.0-win-x64.exe`, na versão 1.0.0 do Windows, devolve `{version:'1.1.0', url: <asset>}`.
- **UT-214** (happy): a Release `v1.0.0` na versão 1.0.0 devolve `null`.
- **UT-215** (happy): a Release `v0.9.0` devolve `null`.
- **UT-216** (error): `net.fetch` rejeitado (sem rede) devolve `null`, grava `update.check result=network` e não lança erro. É a única chamada de rede do programa, conferida por um espião em `net.fetch`.
- **UT-217** (error): a resposta 403 (limite da API) devolve `null`.
- **UT-218** (error): sem resposta em 5 s, devolve `null`.
- **UT-219** (error): uma Release sem asset da plataforma devolve `null` e grava `no-asset`.
- **UT-220** (happy): no `darwin arm64`, escolhe `Teleprompter-1.1.0-mac-arm64.dmg`.
- **UT-221** (happy): `download` grava o arquivo em `app.getPath('downloads')` e chama `shell.openPath` com ele.
- **UT-222** (state): fechar o aviso o esconde até o fim da sessão. Uma nova instância do serviço volta a mostrar.

### ControlApp (TechSpec: Design system, tela de controle)

- **UT-223** (happy): o rodapé mostra `v${__APP_VERSION__}` (`v1.0.0` no build de teste) com a classe que aplica `--text-muted`.
- **UT-224** (state): "Confirmar alterações" fica desabilitado com o rascunho "   ".
- **UT-225** (state): "Iniciar" e "Voz" ficam desabilitados sem texto confirmado.
- **UT-226** (state): com `editorFocused: true`, aparece o aviso "Atalhos inativos enquanto você edita. Esc para sair do editor".
- **UT-227** (happy): sem texto confirmado e sem saídas, aparecem os três passos "Cole ou importe o texto", "Abra uma saída" e "Ligue a voz, se quiser".
- **UT-228** (happy): a dica do botão "Descer" mostra "Seta para baixo ou Page Down" a partir do mapa atual.
- **UT-229** (happy): o estado da voz mostra o texto e a cor de cada estado:

  | Estado | Texto | Cor |
  |---|---|---|
  | `preparing` | "Preparando" | `--info` |
  | `listening` | "Ouvindo" | `--success` |
  | `waiting` | "Esperando" | `--warning` |
  | `failed` | "Falhou" | `--danger` |
- **UT-230** (happy): em `failed`, aparece a faixa de alerta com o motivo recebido, e ela some ao voltar a `listening`.
- **UT-231** (happy): texto `#777777` sobre fundo `#808080` mostra o aviso "O texto pode ficar ilegível com estas cores".
- **UT-232** (boundary): o campo de tamanho com "250" vira 200 ao sair do campo. Com "abc", volta ao valor anterior.
- **UT-233** (error): o campo de cor com "#GGG" volta à cor anterior ao sair do campo.
- **UT-234** (happy): a roda do mouse sobre a prévia envia `cmd:scroll nudge`. Sobre o editor, não envia nada.
- **UT-235** (happy): a prévia desenha duas linhas-guia nas posições `marginPct` e `100 - marginPct` da largura.
- **UT-236** (happy): o topo mostra "aula-01.roteiro". Com `dirty: true`, mostra "aula-01.roteiro (não salvo)".
- **UT-237** (happy): com `update` presente, aparece o aviso com "Baixar e instalar" e "Fechar". "Fechar" o esconde.
- **UT-238** (happy): a lista de microfones mostra os nomes de `enumerateDevices`, inclusive "Entrada 1/2" e "Entrada 3/4" de uma mesma interface.
- **UT-239** (happy): a importação com `ignored.tables = 1` mostra "Tabelas, imagens e caixas de texto foram ignoradas".
- **UT-240** (state): uma importação que demora mais de 1.000 ms mostra "Carregando". Uma que leva 300 ms não mostra.
- **UT-241** (happy): "Voltar ao padrão" abre o `Dialog` de confirmação, e só "Voltar ao padrão" do diálogo envia `cmd:settings resetAll`.
- **UT-242** (state): mensagens de `motion:segment` não alteram `scrollTop` nem a seleção do editor.
- **UT-243** (happy): o controle de velocidade mostra "1,00x" e, depois de "+", "1,25x".
- **UT-244** (happy): os dois `index.html` começam com `<html data-theme="noite">`, o CSS do `body` resolve `background-color` para `#070010` e `color-scheme` para `dark`, e não existe seletor de tema na interface.
- **UT-245** (happy): na tela de atalhos, começar a gravar o atalho de "Descer" e apertar Esc cancela, sem mudar o mapa.

### Stage e OutputApp (TechSpec: ADR-006, ADR-010, Design system)

- **UT-246** (happy): numa tela de 1280 x 1024, com a faixa em 33% e `y = 300`, o palco usa escala `1280/1920` e `translate3d(0, 337,92 - 300 x escala, 0)` nas mesmas linhas recebidas.
- **UT-247** (boundary): com 5.000 linhas, o Stage monta no DOM só as linhas a até uma tela de distância da área visível.
- **UT-248** (happy): `mirrorH` aplica `scale(-1, 1)`, `flipV` aplica `scale(1, -1)`, os dois juntos aplicam `scale(-1, -1)`, e a prévia nunca recebe inversão.
- **UT-249** (happy): a faixa é desenhada numa camada abaixo do texto (`z-index` menor), e com `bandColor #FACE95FF` o texto continua visível.
- **UT-250** (happy): o `font-family` do palco é `"<fonte escolhida>", "Archivo", "Segoe UI Emoji", "Apple Color Emoji", sans-serif`.
- **UT-251** (happy): o sinal de voz:
  - aparece como círculo `--success` em `listening`, duas barras `--warning` em `waiting` e triângulo `--danger` em `failed`;
  - não aparece com a voz `off`;
  - não aparece com `voiceSignal: false`.
- **UT-252** (boundary): o sinal fica no canto inferior direito, dentro da margem de 10%. Com margem 0%, fica a 24 px da borda, dentro do palco invertido junto com o resto.
- **UT-253** (state): com `showBadge: true`, o número "2" aparece e some depois de 4.000 ms. Com `showBadge: false`, não aparece.
- **UT-254** (happy): o `OutputApp` com `update` e avisos no estado não desenha versão, aviso, alerta nem controle, só o texto, a faixa e o sinal.

### Falhas restantes dos contratos de IPC (TechSpec: Contratos de IPC)

- **UT-255** (error): `cmd:output {op:'open', displayKey:'X|Sumido|1920x1080'}` com `displayKey` fora da lista atual devolve `display-missing`, e nenhuma janela é criada.
- **UT-256** (error): `cmd:update {op:'download'}` com a conexão cortada no meio devolve `network`, não deixa arquivo parcial na pasta Downloads, mostra o aviso "Não foi possível baixar a versão nova" e não chama `shell.openPath`.

## Testes de integração

### Sincronia (ScrollEngine, AppStore, barramento de IPC, Stage)

- **IT-001**: `AppStore` real com duas saídas e a prévia ligadas por barramento em memória. Depois de `lineStep`, `nudge`, `autoStart` e `setSpeed`, as três recebem os mesmos `MotionSegment` e o mesmo `LayoutResult` (mesma `revision`). `positionAt` em 20 instantes difere menos de 0,5 px entre elas.
- **IT-002**: `cruise` simulado por 1 hora com relógio falso, correção de relógio a cada 10 s e um desvio de relógio de 15 ms numa saída. Ao fim, a posição da saída e a da prévia diferem menos de 1 px.
- **IT-003**: confirmar um texto com uma frase inserida antes da faixa, durante `cruise`. O caractere da faixa antes e depois é o mesmo, a automação continua, e as saídas recebem o novo layout antes do novo trecho.
- **IT-004**: mudar a fonte de 80 para 120, a caixa para `upper`, a margem para 30% e a faixa para 50% durante `cruise`. Depois de cada mudança, o token na faixa é o mesmo em todas as janelas.

### Arquivos (ScriptFiles, importadores, AppStore, disco real)

- **IT-005**: importar `tests/fixtures/latin1.txt` pela operação `cmd:doc import`. O rascunho fica com os acentos certos, e o texto confirmado não muda.
- **IT-006**: importar `tests/fixtures/com-tabela-e-imagem.docx`. O rascunho tem só os parágrafos do corpo, e o `StateSnapshot.notices` traz o aviso de itens ignorados.
- **IT-007**: importar `tests/fixtures/corrompido.docx` e `tests/fixtures/protegido.docx`. O documento continua igual, e o aviso é "O arquivo não pôde ser lido".
- **IT-008**: salvar um roteiro com aparência personalizada em pasta temporária, criar um `AppStore` novo e abrir o arquivo. O texto e a aparência são iguais, e a posição é 0.
- **IT-009**: salvar numa pasta somente leitura. O aviso traz o motivo, e o documento continua com `dirty: true` e o texto intacto.
- **IT-022**: com `dirty: true`, esperar 5 s, encerrar o processo sem fechamento normal e criar um `AppStore` novo. A recuperação é oferecida com o último rascunho.
- **IT-023**: uma segunda instância recebe `argv` com `aula.roteiro`. A primeira instância abre o arquivo (com o aviso de alterações não salvas, se houver), e a segunda encerra.
- **IT-025**: abrir `tests/fixtures/fonte-ausente.roteiro` (fonte "Fonte Inexistente") pelo caminho real até o `LayoutService` num renderer de teste. O texto é diagramado em Archivo, e o aviso diz "A fonte Fonte Inexistente não está instalada neste computador".

### Ajustes (SettingsStore com disco real)

- **IT-010**: gravar saídas, atalhos, microfone, modo, motor, velocidade e aparência, e criar um `SettingsStore` novo na mesma pasta. Todos os valores voltam iguais.
- **IT-011**: começar com `ajustes.json` corrompido. O programa sobe com os padrões e mostra um único aviso. O segundo início não avisa.

### Voz (motores reais, VoiceTracker, VoiceController, ScrollEngine)

- **IT-012**: o `VoskEngine` real com o modelo pequeno é alimentado por `tests/fixtures/voz/leitura-continua.wav` em tempo real. O cursor chega a pelo menos 90% dos tokens do roteiro. O atraso mediano entre o fim de cada palavra (marcado na fixture) e o alvo emitido fica abaixo de 1.000 ms.
- **IT-013**: `improviso.wav`, com 20 s de fala fora do roteiro depois de 2 frases. O cursor não avança durante o improviso, o estado vai a `waiting` e volta a `listening` quando a leitura retoma.
- **IT-014**: `trecho-pulado.wav` no modo `near`. O cursor para antes do pulo. Depois de um `nudge` até a linha certa, volta a avançar.
- **IT-015** (noturno): IT-012 com o Parakeet real. Registra o atraso mediano e o p95 no relatório do job e falha se o mediano passar de 1.500 ms.
- **IT-016**: `trecho-pulado.wav` no modo `forwardJumps`. O cursor salta para a frase única depois do pulo, sem comando manual.
- **IT-017**: `VoiceController` com motor falso que emite `mic-lost` durante a rolagem por voz. O `StateSnapshot` traz `failed` com o motivo, o trecho vira `hold`, e as saídas recebem `voiceState: 'failed'` depois de 700 ms, com o layout inalterado.
- **IT-024**: hipóteses de voz chegando a cada 100 ms enquanto um `lineStep` é aplicado. O comando manual define a posição, o alvo de voz seguinte em menos de 300 ms é ignorado, e o seguinte parte do cursor ressincronizado.

### Saídas, atalhos, energia e atualização

- **IT-018**: `OutputManager` real com `screen` falso e `ScrollEngine` real em `cruise`. A remoção de B não altera os trechos das outras janelas. Quando B volta, a janela reaberta recebe na hora o layout atual e o trecho em curso.
- **IT-019**: o `before-input-event` com `PageDown` vindo da `webContents` de uma saída chega ao `KeymapService` e move o `ScrollEngine` uma linha.
- **IT-020**: abrir duas saídas e fechar as duas pelo `OutputManager` real. O `powerSaveBlocker` falso registra exatamente um `start` e um `stop`.
- **IT-021**: `UpdateChecker` contra um servidor HTTP local que imita `releases/latest` com `v9.9.9`. O `StateSnapshot.update` é preenchido, e o download grava o asset na pasta Downloads de teste.
- **IT-026**: sem nenhuma saída aberta, `autoStart` emite trechos para a prévia, e a posição avança normalmente. Fechar todas as saídas durante `cruise` mantém o trecho da prévia.

## Testes de ponta a ponta

O build de teste roda com `TP_FAKE_DISPLAYS='[A controle 1920x1080, B 1920x1080, C 1280x1024]'`, salvo indicação.

### Preparar o roteiro (US-001, US-004, US-005, US-008 a US-012, US-037, US-039)

- **E2E-001**: abrir o programa pela primeira vez.
  1. O fundo é `#070010`, aparecem os três passos e `v1.0.0` no rodapé.
  2. Colar um texto de 3 parágrafos e Confirmar: a primeira linha aparece na faixa da prévia.
  3. Mudar fonte, tamanho 100, cores, caixa alta, alinhamento à esquerda e margem 20%: a prévia reflete cada mudança.
  4. Salvar como `aula.roteiro`, fechar, reabrir e abrir `aula.roteiro`: o mesmo texto e a mesma aparência.
- **E2E-002**: importar `latin1.txt`: o editor mostra os acentos certos. Importar `com-tabela-e-imagem.docx`: aparece o aviso de itens ignorados. Confirmar: a prévia mostra o texto.
- **E2E-003**: editar o texto e clicar em "Novo": aparece o diálogo escuro com "Salvar", "Não salvar" e "Cancelar". "Cancelar" mantém o texto. "Importar" mostra o mesmo diálogo.

### Montar o estúdio (US-015, US-016, US-019, US-020)

- **E2E-004**:
  1. Abrir saídas em B e C: cada uma mostra o seu número por cerca de 4 s.
  2. Ligar "Espelhar" na 1 e "Inverter vertical" na 2: o `transform` computado de cada uma confere.
  3. As quebras de linha das duas saídas e da prévia são iguais, comparando o texto das linhas via `__tpProbe`.
  4. Fechar a 2 e reabri-la. Reiniciar o programa: a 1 reabre espelhada e sem número.
- **E2E-007**: remover C com `__tpTest.removeDisplay('C')`: a saída 2 fecha e o aviso "Saída 2 caiu" aparece. Religar C: a saída reabre sem número, com a inversão guardada. Repetir 3 vezes em 2 s: fica uma única janela. Ligar D: aparece como livre e não abre saída.
- **E2E-019**: com a rolagem automática ligada, redimensionar a janela de controle para 800 x 600 e minimizá-la por 5 s. As saídas continuam rolando sem salto, e a posição na volta é igual à das saídas.
- **E2E-020**: com a voz ligada e áudio falso de `leitura-continua.wav`, minimizar a janela de controle por 10 s. O texto continua acompanhando a leitura nas saídas, e o estado da voz fica em "Ouvindo".

### Gravar com operador (US-014, US-017, US-021, US-022, US-026, US-027)

- **E2E-005**:
  1. Confirmar um texto longo e abrir B e C.
  2. Iniciar e apertar "+" duas vezes: aparece "1,50x".
  3. Em 5 amostras, `__tpProbe.position()` da prévia, de B e de C diferem menos de 2 px lógicos.
  4. Rolar a roda sobre a prévia: as três telas mudam juntas.
  5. Pausar, depois "Descer" 3 cliques: 3 linhas.
  6. Home: primeira linha na faixa e automática pausada.
- **E2E-006**:
  1. Com a rolagem automática ligada, clicar no editor: aparece o aviso de atalhos inativos.
  2. Apertar PageDown: o editor muda, e as saídas não.
  3. Digitar uma correção antes da faixa: as saídas continuam no texto antigo.
  4. Confirmar: a linha da faixa é a mesma e a rolagem continua.
  5. Esc: o aviso some e Space pausa.
- **E2E-016**: com uma saída aberta, `__tpProbe.powerBlocker()` devolve `true`. Sem saída, devolve `false`.

### Gravar sozinho com voz (US-023, US-028 a US-035)

- **E2E-008**: iniciar com `--use-file-for-fake-audio-capture=leitura-com-improviso.wav` e duas saídas.
  1. Apertar V: o estado passa de "Preparando" a "Ouvindo", e as saídas mostram o círculo verde.
  2. O texto avança com a leitura.
  3. Durante o improviso, o estado vai a "Esperando", e o sinal das saídas vira barras âmbar sem piscar.
  4. Um PageDown durante a leitura move uma linha, e a voz continua dali.
  5. O microfone escolhido e o medidor de nível aparecem na tela de voz.
- **E2E-009**: com a voz ouvindo, `__tpTest.stopMicTrack()`:
  1. A faixa vermelha "Falhou: O microfone foi desconectado" aparece.
  2. As saídas continuam com o texto visível e parado, e o sinal vira triângulo.
  3. `__tpTest.restoreMic()` volta a "Ouvindo", e a faixa some.
- **E2E-015**: com a voz ligada no meio do texto, Home: a primeira linha vai à faixa, a voz continua "Ouvindo" e acompanha do início.

### Ajustes e atalhos (US-024, US-036)

- **E2E-010**: na tela de atalhos:
  1. Gravar "B" para "Descer": apertar B desce uma linha.
  2. Gravar Space para "Descer": aparece a pergunta de conflito, e "Cancelar" mantém tudo.
  3. Gravar Alt+F4: aparece a mensagem de tecla reservada.
  4. "Voltar ao padrão": PageDown volta a descer.
- **E2E-011**: mudar a velocidade, o modo da voz e as inversões, e reiniciar: tudo volta igual. Depois, "Voltar ao padrão" e confirmar: 1,00x, "Perto" e saídas sem inversão.

### Versão e atualização (US-037, US-038)

- **E2E-012**: com `TP_UPDATE_URL` apontando para um servidor local com `v9.9.9`, a tela de controle mostra o aviso. As saídas não mostram aviso nem versão (`__tpProbe.outputText()` só tem o roteiro). "Fechar" esconde o aviso. Reiniciar: o aviso volta.

### Instalação (US-039, US-036.EC-3)

- **E2E-013** (CI Windows):
  1. Instalar `Teleprompter-1.0.0-win-x64.exe /S`: existe o atalho no menu Iniciar com o ícone do produto.
  2. Bloquear a rede do processo e abrir o programa: a tela abre, e a voz com WAV falso chega a "Ouvindo".
  3. Instalar outra versão de teste por cima: `ajustes.json` continua igual.
  4. O log mostra uma única tentativa de rede (`update.check`).
  5. O Como usar tem as instruções "Mais informações" e "Executar assim mesmo", conferidas na revisão do documento.
- **E2E-014** (CI Mac): montar o DMG, copiar o app e abrir com `--no-sandbox` de teste: a janela de controle abre com `v1.0.0` e tema Noite.

### Abrir por arquivo e fechar (US-005, US-007, US-019)

- **E2E-017**: abrir o programa com `aula.roteiro` como argumento: o roteiro está carregado e confirmado.
- **E2E-018**: editar o texto e fechar a janela de controle: aparece o diálogo. "Cancelar" mantém o programa aberto. "Não salvar" fecha o programa e todas as saídas.
