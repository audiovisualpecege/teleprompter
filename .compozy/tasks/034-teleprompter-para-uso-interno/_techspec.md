# TechSpec: Teleprompter para uso interno (ideia #34)

## Resumo executivo

O teleprompter é um programa de desktop em Electron, React e TypeScript (preferência #24), para Windows e Mac, distribuído pelas Releases de `github.com/audiovisualpecege/teleprompter`. O processo principal do Electron é o dono de todo o estado e do motor de rolagem. A janela de controle e as saídas de TP só enviam comandos e desenham. A sincronia vem de dois mecanismos (ADR-006):

- **Trechos de movimento:** a posição não é transmitida quadro a quadro. O motor publica trechos de movimento com instante de início num relógio comum, e cada janela calcula a posição a cada quadro do seu monitor. Assim não há diferença acumulada.
- **Palco lógico fixo:** o texto é diagramado uma vez num palco lógico de 1920 de largura, e cada janela escala o palco inteiro. As quebras de linha são idênticas em qualquer resolução.

A voz roda no próprio computador, atrás de uma interface trocável `SpeechEngine` (ADR-007):

- **Vosk pequeno em português:** é o padrão, roda em WebAssembly num Worker da janela de controle e usa o vocabulário restrito ao roteiro.
- **Parakeet v3:** é escolhível na tela de voz e roda em `sherpa-onnx-node` num `utilityProcess`.

Um alinhador próprio (`VoiceTracker`) transforma as palavras reconhecidas num alvo de rolagem que só anda para a frente.

Principais trocas:

- **Instalador grande:** cerca de 750 MB, porque leva os dois modelos para a voz funcionar sem internet.
- **Escala pela largura:** em telas fora de 16:9, o palco escala pela largura. As quebras ficam iguais, e muda só quantas linhas cabem acima e abaixo da faixa.
- **Calibração no início:** as constantes de voz e o 1,00x da rolagem automática nascem com valores definidos aqui. A primeira tarefa da implementação as calibra com gravações reais da equipe.

## Arquitetura do sistema

### Visão dos componentes

```
Processo principal (Node)
  AppStore ............ estado único: roteiro, aparência, automação, voz, saídas; publica mudanças
  ScrollEngine ........ posição, trechos de movimento, limites, velocidade, âncora
  VoiceTracker ........ palavras reconhecidas -> alvo de rolagem (Perto / Pulos para a frente)
  VoiceController ..... máquina de estados da voz, motor ativo, falhas e recuperação
  OutputManager ....... janelas de saída, monitores, queda e volta, numeração, inversões
  DisplayRegistry ..... lista de monitores, identidade estável, eventos de ligar e desligar
  KeymapService ....... atalhos de todas as janelas (before-input-event), conflitos, reservadas
  SettingsStore ....... ajustes.json, validação, padrão, gravação segura
  ScriptFiles ......... .roteiro (ler/gravar), importar .txt e .docx, recuperação
  PowerGuard .......... impede proteção de tela e suspensão com saída aberta
  UpdateChecker ....... consulta a Release mais nova e baixa o instalador
  ParakeetHost ........ utilityProcess com sherpa-onnx-node (só quando o Parakeet está ativo)

Janela de controle (renderer React, tema Noite)
  ControlApp .......... layout da tela: prévia, ações de gravação, editor, aparência, estúdio, voz
  LayoutService ....... mede o texto com a fonte real e quebra as linhas no palco lógico
  Stage ............... desenha linhas + faixa a partir de LayoutResult e MotionSegment (compartilhado)
  AudioCapture ........ getUserMedia + AudioWorklet 16 kHz mono + medidor de nível
  VoskEngine .......... SpeechEngine com vosk-browser num Worker
  ParakeetEngine ...... SpeechEngine que repassa áudio ao ParakeetHost por MessagePort

Janela de saída (renderer mínimo, uma por monitor)
  OutputApp ........... Stage em tela cheia, inversões, sinal de voz, número de identificação
```

**Fluxo de dados:**

1. **Comandos para o principal:** a janela de controle e as saídas mandam comandos ao processo principal pelas pontes de preload (`window.tp`). Os comandos são botões, roda do mouse, edição confirmada, aparência, saídas e voz. As teclas chegam ao principal por `before-input-event` e nunca passam pela tela.
2. **Mudanças para as janelas:** o `AppStore` aplica o comando e publica `StateSnapshot` (mudanças de estado) e `MotionSegment` (rolagem) para todas as janelas.
3. **Diagramação:** quando o texto confirmado ou a aparência muda, o principal pede uma nova diagramação à janela de controle. O `LayoutService` devolve um `LayoutResult`, o principal reancora a posição (`ScrollEngine.relayout`) e repassa o `LayoutResult` às saídas.
4. **Voz:**
   1. O `AudioCapture` entrega PCM ao motor ativo.
   2. O motor emite `Hypothesis` (palavras) para o principal.
   3. O `VoiceTracker` calcula um alvo, e o `ScrollEngine` publica um deslizamento até ele.

**Sistemas externos:**

- **Release mais nova:** a API pública do GitHub, consultada só para saber se há versão nova.
- **Sistema operacional:** monitores, microfones, fontes instaladas, proteção de tela e seletores de arquivo.

### Estrutura do repositório

```
package.json                versão única (1.0.0), scripts, dependências
CHANGELOG.md
electron.vite.config.ts     alias @chiaro -> design-system/chiaro, define __APP_VERSION__
electron-builder.yml        NSIS x64, DMG x64+arm64, fileAssociations .roteiro, extraResources modelos
build/icone.svg             ícone do produto (fonte única) e tamanhos gerados
scripts/gerar-icones.mjs    SVG -> PNG 16..1024, .ico, .icns
scripts/baixar-modelos.mjs  baixa e confere (SHA-256) os modelos Vosk e Parakeet
resources/models/           modelos baixados (fora do git)
src/shared/                 tipos, motion.ts, layout.ts, text.ts, ipc.ts, defaults.ts
src/main/                   index.ts, store.ts, scroll-engine.ts, voice-tracker.ts, voice-controller.ts,
                            outputs.ts, displays.ts, keymap.ts, settings.ts, script-files.ts,
                            import-txt.ts, import-docx.ts, recovery.ts, power.ts, updates.ts,
                            parakeet-host.ts
src/preload/                control.ts, output.ts
src/renderer/control/       index.html, App.tsx, telas e painéis, layout-service.ts, audio/, asr/
src/renderer/output/        index.html, OutputApp.tsx
src/renderer/shared/        Stage.tsx, clock.ts, ui/ (componentes Chiaro que faltam no export)
tests/unit, tests/integration, tests/e2e, tests/fixtures
.github/workflows/release.yml
```

## Design de implementação

### Interfaces centrais

Movimento compartilhado por todas as janelas (`src/shared/motion.ts`):

```ts
export type MotionSegment =
  | { kind: 'hold'; y: number }
  | { kind: 'cruise'; y0: number; t0: number; pxPerSec: number; yEnd: number }
  | { kind: 'glide'; y0: number; y1: number; t0: number; durMs: number };

/** Posição (px do palco lógico, topo do texto até a faixa) no instante `now` do relógio comum. */
export function positionAt(seg: MotionSegment, now: number): number {
  switch (seg.kind) {
    case 'hold': return seg.y;
    case 'cruise': return Math.min(seg.yEnd, seg.y0 + (seg.pxPerSec * (now - seg.t0)) / 1000);
    case 'glide': {
      const p = Math.min(1, Math.max(0, (now - seg.t0) / seg.durMs));
      return seg.y0 + (seg.y1 - seg.y0) * easeOutCubic(p);
    }
  }
}
```

Motor de rolagem (`src/main/scroll-engine.ts`), do qual o `AppStore`, o `VoiceController` e o `KeymapService` dependem:

```ts
export type ScrollCommand =
  | { type: 'lineStep'; dir: 1 | -1 }            // botão ou tecla, uma linha
  | { type: 'holdStart'; dir: 1 | -1 } | { type: 'holdEnd' }
  | { type: 'nudge'; dy: number }                // roda do mouse, px lógicos
  | { type: 'toStart' }
  | { type: 'autoStart' } | { type: 'autoPause' } | { type: 'setSpeed'; speed: number }
  | { type: 'voiceTarget'; y: number };           // nunca menor que a posição atual

export interface ScrollEngine {
  apply(cmd: ScrollCommand, now: number): void;
  relayout(layout: LayoutResult, now: number): void;   // mantém o caractere da faixa
  replaceText(oldText: string, layout: LayoutResult, now: number): void;
  anchorAt(now: number): Anchor;                       // caractere na faixa
  readonly segment: MotionSegment;
  onSegment(cb: (s: MotionSegment) => void): () => void;
  onAutoEnded(cb: () => void): () => void;             // fim do texto ou voltar ao início
}
```

Reconhecedor trocável (`src/renderer/control/asr/engine.ts`):

```ts
export interface Hypothesis { words: string[]; final: boolean; audioEndMs: number }
export type EngineFault = 'mic-lost' | 'mic-denied' | 'no-mic' | 'engine-crashed' | 'too-slow';

export interface SpeechEngine {
  readonly id: 'vosk' | 'parakeet';
  load(): Promise<void>;                                 // "Preparando"
  start(input: AudioSource, vocabulary: string[]): Promise<void>;
  setVocabulary(vocabulary: string[]): void;             // novo texto confirmado
  stop(): Promise<void>;
  onHypothesis(cb: (h: Hypothesis) => void): () => void;
  onFault(cb: (f: EngineFault, detail?: string) => void): () => void;
  onLag(cb: (lagMs: number) => void): () => void;        // atraso medido
}
```

Alinhador (`src/main/voice-tracker.ts`), uma função pura:

```ts
export interface TrackerInput {
  tokens: ScriptToken[]; cursor: number; mode: 'near' | 'forwardJumps'; heard: string[];
}
export interface TrackerResult { cursor: number; matched: boolean; jumped: boolean }
export function track(input: TrackerInput): TrackerResult;
```

Convenção de erros:

- **Funções puras:** devolvem resultados tipados e nunca lançam erro por entrada do usuário. Valores fora da faixa são presos ao limite.
- **Operações de arquivo:** devolvem `Result<T, FileError>`, com `FileError.code` em `empty`, `not-text`, `unreadable`, `no-text-content`, `unsupported-format`, `invalid-roteiro`, `permission-denied`, `not-found`, `invalid-name` e `disk-full`. Quando o caminho salvo sumiu, a gravação volta a pedir um local, como em US-004 EC-2. Cada código tem uma mensagem em português na tela.
- **Exceções inesperadas no principal:** vão ao log local e nunca derrubam as saídas.

### Modelos de dados

```ts
interface Appearance {
  fontFamily: string;            // padrão 'Archivo'
  fontSize: number;              // 20..200, padrão 80 (px no palco 1920x1080)
  textColor: string;             // '#FFFFFF'
  backgroundColor: string;       // '#000000'
  bandColor: string;             // '#FACE9533' (#RRGGBBAA, translúcida)
  letterCase: 'normal' | 'upper' | 'lower';
  align: 'center' | 'left';
  marginPct: number;             // 0..40, padrão 10, de cada lado
  bandPositionPct: number;       // 10..60, padrão 33
}

interface ScriptToken { norm: string; start: number; end: number; line: number }
interface LayoutLine { text: string; start: number; end: number; y: number; height: number }
interface LayoutResult {
  revision: number; appearance: Appearance; lines: LayoutLine[];
  totalHeight: number; wordCount: number; missingFont: string | null;
}
interface Anchor { charOffset: number; fraction: number }

type VoiceState = 'off' | 'preparing' | 'listening' | 'waiting' | 'failed';
interface VoiceStatus { state: VoiceState; fault: EngineFault | null; engine: 'vosk' | 'parakeet';
  mode: 'near' | 'forwardJumps'; lagMs: number | null }

type OutputState = 'open' | 'down' | 'closed';
interface OutputInfo { id: number; displayKey: string; label: string; size: string; state: OutputState;
  mirrorH: boolean; flipV: boolean; voiceSignal: boolean }

interface StateSnapshot {
  doc: { filePath: string | null; draftText: string; confirmedText: string; dirty: boolean; pending: boolean };
  appearance: Appearance; automation: 'none' | 'auto' | 'voice'; speed: number;
  voice: VoiceStatus; outputs: OutputInfo[]; displays: DisplayInfo[];
  editorFocused: boolean; update: { version: string; url: string } | null; notices: Notice[];
}
```

**Arquivo `.roteiro`** (ADR-008):

```json
{ "formato": "teleprompter-roteiro", "versao": 1, "texto": "...", "aparencia": { } }
```

- `aparencia` segue o `Appearance` acima, com os nomes de campo em inglês.
- Na leitura, cada campo é validado com `zod`. Campo ausente ou inválido vira o padrão.
- `versao` maior que 1 abre o que for entendido e gera o aviso de US-005 EC-2.

**`ajustes.json`** fica em `userData`:

```ts
interface Settings {
  schemaVersion: 1;
  outputs: { displayKey: string; label: string; size: string; mirrorH: boolean; flipV: boolean; voiceSignal: boolean }[];
  keymap: Record<ActionId, KeyCombo[]>;    // ActionId: autoToggle, down, up, faster, slower, toStart, voiceToggle, closeOutput
  micDeviceId: string | null; micLabel: string | null;
  voiceEngine: 'vosk' | 'parakeet'; voiceMode: 'near' | 'forwardJumps';
  speed: number; lastAppearance: Appearance; controlDisplayKey: string | null;
}
```

**Estados do roteiro:**

- `dirty`: o rascunho ou a aparência difere do último salvo (US-007 EC-3).
- `pending`: o rascunho difere do texto confirmado.
- Os dois podem coexistir.

**Identidade de monitor (`displayKey`):** `id|label|largura x altura` do Electron.

- **Monitor que voltou:** casa por `id` e `label` iguais, ou por `label` e tamanho iguais quando o `id` mudou.
- **Monitor diferente na mesma porta:** tem outro `label` e não casa (US-018 EC-3).

### Constantes de comportamento (`src/shared/defaults.ts`)

| Constante | Valor inicial | Uso |
|---|---|---|
| `STAGE_WIDTH`, `STAGE_REF_HEIGHT` | 1920, 1080 | Palco lógico |
| `LINE_HEIGHT` | 1,25 x fonte | Altura de linha |
| `PARAGRAPH_GAP` | 0,6 x fonte | Espaço entre parágrafos |
| `BASE_WPM` | 140 palavras por minuto | 1,00x; px/s = velocidade x 140/60 x (altura total / palavras) |
| `SPEED_MIN`, `SPEED_MAX`, `SPEED_STEP` | 0,25, 3,00, 0,25 | Rolagem automática |
| `LINE_STEP_MS` | 150 ms | Deslizamento de uma linha (botão, tecla) |
| `HOLD_LINES_PER_SEC` | 4 | Botão ou tecla segurada |
| `NEAR_WINDOW_TOKENS` | 15 | Janela curta do modo "Perto", a partir do cursor |
| `MIN_MATCH_RUN` | 2 de 3 palavras finais ouvidas, em ordem | Critério para avançar no "Perto" |
| `JUMP_MIN_RUN` | 5 palavras seguidas, semelhança mínima de 0,85 cada | Critério de "reconhecido com segurança" |
| `WORD_SIMILARITY` | 0,75 (Levenshtein normalizado) | Palavra que "bate" |
| `NEAR_MAX_GAP` | 2 tokens | No "Perto", tokens que podem ficar entre duas palavras ouvidas que batem (acrescentada na tarefa 2) |
| `WAITING_AFTER_MS` | 2500 ms sem casar | Ouvindo para Esperando |
| `SIGNAL_DEBOUNCE_MS` | 700 ms | Sinal discreto só muda com estado estável |
| `MANUAL_PRIORITY_MS` | 300 ms | Alvos de voz ignorados logo após comando manual |
| `VOICE_GLIDE_MS` | 250 a 900 ms, proporcional à distância | Deslizamento da voz |
| `TOO_SLOW_LAG_MS`, `RECOVERED_LAG_MS` | 3000, 800 | Falha e recuperação por lentidão |
| `ID_BADGE_MS` | 4000 ms | Número da saída ao abrir |
| `CLOCK_RESYNC_MS` | 10000 ms | Correção de relógio |
| `RECOVERY_SAVE_MS` | 5000 ms | Cópia de recuperação |
| `LOW_CONTRAST_RATIO` | 3:1 (WCAG) | Aviso de contraste |

Esses valores atendem às questões em aberto do PRD sobre a calibração do 1,00x e a janela curta. Nascem aqui e são recalibrados na tarefa de prova da voz.

**Prova da voz (tarefa 2), medição de 2026-11-24, ainda sem calibração final:**

- **Situação:** as constantes de voz e o `BASE_WPM` continuam com os valores iniciais da tabela. A calibração final depende das gravações reais da equipe (3 pessoas, `tests/fixtures/voz/`), que ainda não foram feitas. Quando chegarem, `npm run test:voice` mede tudo de novo e os valores finais entram aqui, com a data.
- **Medição provisória:** Windows x64, voz sintética pt-BR do Windows lendo o roteiro de teste (112 palavras), em tempo real, dentro do Electron e com o alinhador de verdade. A voz sintética é limpa e regular demais para calibrar; os números só mostram que o caminho funciona.

| Motor e cenário | Cobertura do roteiro | Atraso p50 | Atraso p95 | Observação |
|---|---|---|---|---|
| Vosk, leitura contínua (WAV direto) | 100% | 480 ms | 1.256 ms | 87 parciais; motor leva 1 ms por pedaço de 100 ms |
| Vosk, leitura contínua (microfone falso do Chromium, `AudioCapture` real) | 100% | 536 ms | 2.729 ms | reamostragem no `AudioWorklet` |
| Vosk, trecho pulado, "Pulos para a frente" | 100% | 658 ms | 3.666 ms | um salto, sem comando manual |
| Vosk, improviso de 20 s ("Perto" e "Pulos") | 100% | 538 ms | 2.779 ms | o cursor não andou durante o improviso |
| Parakeet, leitura contínua (`utilityProcess`) | 100% | 966 ms | 1.839 ms | decodificação de 628 ms por janela de 3 s |

- **Atraso:** do fim da palavra no áudio até o cursor chegar nela. O p95 do Vosk ainda é alto em alguns cenários e não tem causa confirmada; a suspeita são as palavras curtas, que esperam a palavra seguinte para casar (2 de 3), e os fins de frase. É o ponto a olhar com as gravações reais.
- **Gramática do Vosk com acento:** o léxico do modelo em português guarda as palavras com acento ("atenção", "câmera") e o Vosk descarta da gramática a palavra que não conhece. Por isso a gramática enviada ao Vosk é `buildSpokenVocabulary` (minúsculas, sem pontuação, COM acento, números por extenso, mais `[unk]`), e não as palavras normalizadas sem acento da etapa 2 de "Voz". O alinhador continua comparando sem acento. Com essa troca, o p95 da leitura contínua caiu de 2.686 para 1.256 ms.
- **Rede:** nenhuma requisição de rede em nenhuma medição.

### Algoritmos principais

**Diagramação (`src/shared/layout.ts`, pura, com `measure(texto)` injetado):**

1. O texto vira parágrafos e palavras com as posições de caractere originais.
2. A caixa (`toLocaleUpperCase('pt-BR')` ou `toLocaleLowerCase('pt-BR')`) se aplica só à palavra exibida.
3. A quebra é gulosa por palavra dentro da largura útil `1920 x (1 - 2 x margem)`. Uma palavra maior que a linha é quebrada por caractere (US-008 EC-3, US-012 EC-2).
4. Cada linha guarda `start`, `end`, `y` e `height`.
5. O `LayoutService` mede com `CanvasRenderingContext2D.measureText`, depois de `document.fonts.load` da fonte escolhida. Se a fonte não carregar, usa Archivo e preenche `missingFont`.
6. A lista de fontes instaladas vem de `queryLocalFonts()`, com a permissão `local-fonts` concedida pelo principal.

**Posição e limites:**

- `y` vai de 0 (primeira linha na faixa) até `lines.at(-1).y` (última linha na faixa).
- O palco desenha as linhas com `translate3d(0, bandY - y, 0)`, com `bandY = bandPositionPct x altura da tela`.

**Âncora e troca de texto:**

- **`relayout`:** acha a linha da âncora pelo `charOffset` e aplica a `fraction` dentro dela.
- **`replaceText`:** calcula o prefixo e o sufixo comuns entre o texto confirmado antigo e o novo.
  - Âncora no prefixo: mantém o mesmo offset.
  - Âncora no sufixo: desloca pela diferença de tamanho.
  - Âncora dentro do trecho alterado: vai para o início do trecho novo, o "ponto mais próximo" de US-006 EC-1.
- **Trecho em curso:** o trecho atual é reemitido a partir da nova posição, com a mesma velocidade. A automação não pausa (US-006 EC-3).

**Rolagem automática:**

- **Iniciar:** emite `cruise` com `yEnd` igual ao fim do texto e agenda o fim. No fim, emite `hold` e `onAutoEnded`, e a automação volta a `none` (US-026 EC-1).
- **Mudar a velocidade rolando:** reemite `cruise` a partir de `positionAt(agora)`, sem tranco.
- **Voltar ao início:** pausa a automática (US-025 AC-2) e mantém a voz (AC-3).

**Rolagem manual:**

- **Botão ou tecla:** `lineStep` desliza até o `y` da linha seguinte ou anterior. Cliques seguidos encadeiam a partir do alvo pendente, não da posição desenhada, para que cada clique valha uma linha (US-021 EC-3).
- **Segurar:** `holdStart` vira `cruise` em ±4 linhas por segundo, até `holdEnd`. A repetição de tecla do sistema (`isAutoRepeat`) é ignorada.
- **Roda do mouse:** `nudge` soma `deltaY` convertido em px lógicos e desliza em 120 ms, preso aos limites.
- **Com automação ligada:** todo comando manual volta à automação ativa a partir da nova posição. Com a automática ligada, reemite `cruise` depois do movimento.

**Voz:**

1. **Normalização (`src/shared/text.ts`):** minúsculas, sem acento, sem pontuação. Números escritos com algarismos são expandidos por extenso em pt-BR, como "2026" para "dois mil e vinte e seis", com uma palavra-token cada.
2. **Vocabulário do Vosk:** as palavras únicas do roteiro mais `[unk]`, em minúsculas e sem pontuação, mas com acento (`buildSpokenVocabulary`), porque o léxico do modelo tem os acentos (tarefa 2).
3. **Modo "Perto":**
   1. Pega as últimas até 4 palavras ouvidas (sem `[unk]`).
   2. Procura em `tokens[cursor+1 .. cursor+NEAR_WINDOW_TOKENS]` o ponto `j` em que ao menos 2 das 3 palavras finais batem em ordem.
   3. Uma única palavra de 6 letras ou mais também vale quando é `cursor+1` ou `cursor+2`.
   4. Achando, `cursor = j`.
4. **Modo "Pulos para a frente":** se o "Perto" não casou, procura do fim da janela até o fim do texto uma sequência de 5 palavras ouvidas com semelhança mínima de 0,85 cada. A sequência precisa aparecer uma única vez dali para a frente (US-032 EC-1).
5. **Alvo:** o `y` da linha do token `cursor`. Só é aplicado se for maior que a posição atual e se nenhum comando manual chegou nos últimos 300 ms. O deslizamento leva de 250 a 900 ms.
6. **Depois de comando manual ou voltar ao início:** o cursor é reposicionado no último token da linha que está na faixa menos um. A voz procura a partir dali (US-033 AC-2, EC-3).

**Estados da voz (`VoiceController`):**

| De | Para | Quando |
|---|---|---|
| `off` | `preparing` | O operador liga a voz, com texto confirmado e microfone disponível. |
| `preparing` | `listening` | O motor fica pronto. |
| `listening` | `waiting` | 2,5 s sem casar ou fim do texto. |
| `waiting` | `listening` | A voz casa de novo. |
| Qualquer estado ligado | `failed` | Há uma `EngineFault`. |
| `failed` | `listening` | A causa se resolve. |
| Qualquer estado | `off` | O operador desliga a voz. |

- **Causas resolvidas:** o microfone voltou (`devicechange`, com captura reiniciada), o motor reiniciou (até 3 tentativas, com espera de 1, 2 e 4 s) ou o atraso caiu abaixo de 800 ms.
- **Ligar e desligar seguidos:** contam pela ordem e cancelam o carregamento anterior (US-028 EC-4).
- **Iniciar a automática:** desliga a voz. **Ligar a voz:** pausa a automática (ADR-005).
- **Sinal nas saídas:** só muda depois de 700 ms de estado estável.

**Saídas (`OutputManager`):**

- **Abrir:** cria uma `BrowserWindow` sem moldura com `backgroundThrottling: false`, ocupando os `bounds` do monitor.
  - No Windows: `fullscreen: true`.
  - No Mac: `simpleFullScreen`, para não criar um Espaço novo nem animar.
  - Fundo inicial com a cor de fundo da aparência, sem piscar.
- **Número de identificação:** cada saída recebe o menor número livre a partir de 1. O número aparece por 4 s só quando a saída é aberta pela tela de controle.
- **Monitor desligado:** em `display-removed`, a janela daquele monitor fecha e a saída vira `down`, com aviso na tela de controle.
- **Monitor ligado:** em `display-added`, cada saída guardada cujo monitor casou reabre sem o número, com as inversões e o sinal guardados. A reabertura espera 1 s de estabilidade e é idempotente por saída (US-018 EC-2).
- **Abertura do programa:** as saídas guardadas cujo monitor não está ligado ficam `down` em silêncio, sem aviso (US-020 AC-2), e reabrem quando o monitor aparece.
- **Saída arrastada ou fora da tela cheia:** se `move`, `resize` ou `leave-full-screen` tirarem a janela dos `bounds`, ela é devolvida (US-017 EC-2).
- **Esc numa saída:** é anulado em `before-input-event`.
- **Janela de controle minimizada:** a janela de controle também nasce com `backgroundThrottling: false`, porque abriga a captura de áudio, o Worker do Vosk e a diagramação. Minimizada ou escondida, ela não atrasa a voz nem as saídas (US-014 EC-1).
- **Monitor da tela de controle:** nunca recebe saída.
  - Se a janela de controle ficar sobre um monitor com saída, a saída continua por cima.
  - Em `display-added` ou quando uma saída fecha, a janela de controle vai para o primeiro monitor livre.
- **Proteção de tela:** o `PowerGuard` liga `powerSaveBlocker.start('prevent-display-sleep')` enquanto houver ao menos uma saída `open`, com qualquer forma de rolagem.

**Atalhos (`KeymapService`):**

- **Captura:** o `before-input-event` de todas as janelas do programa traduz o evento em `KeyCombo` (`{ key, ctrlOrCmd, shift, alt }`). Fora do programa nada é capturado (US-023 EC-2).
- **Com o editor em foco:** só combinações com Ctrl ou Cmd agem. Esc tira o foco do editor.
- **Tecla segurada:** subir e descer usam `keyDown`/`keyUp` para segurar. Alternâncias ignoram `isAutoRepeat` (US-023 EC-3).
- **Conflitos:** cada `KeyCombo` pertence a no máximo uma ação. Ao gravar uma combinação já usada, devolve `{ conflictWith: ActionId }` para a tela perguntar.
- **Reservadas:** Alt+F4, Alt+Tab, Ctrl+Alt+Delete, Win, Cmd+Q, Cmd+Tab, Cmd+H, Cmd+M, Cmd+Espaço, Ctrl+Esc e Esc.

**Importação:**

- **`.txt`:**
  1. Arquivo com bytes NUL ou mais de 10% de caracteres de controle é rejeitado como `not-text`.
  2. `TextDecoder('utf-8', { fatal: true })` decodifica o texto. Se falhar, `windows-1252`.
  3. Quebras de linha normalizadas para `\n`.
  4. Arquivo vazio ou só com espaços vira `empty`.
- **`.docx`:** `jszip` e `@xmldom/xmldom` sobre `word/document.xml`.
  1. Entram os `w:p` do corpo fora de `w:tbl` e `w:txbxContent`.
  2. O texto de `w:t` entra, inclusive dentro de `w:ins`. `w:del` e `w:delText` ficam de fora (versão final, US-003 EC-4).
  3. `w:tbl`, `w:drawing`, `w:pict` e `w:txbxContent` são contados para o aviso de itens ignorados.
  4. Um zip inválido, inclusive arquivo protegido por senha (que não é zip), vira `unreadable`. Um documento sem texto vira `no-text-content`.
  5. Importação acima de 1 s mostra "Carregando".
- **Colar:** o editor é um `textarea`, por isso só texto puro entra (US-001 AC-3).

**Contraste:** a razão de contraste WCAG entre a cor do texto e a do fundo abaixo de 3:1 mostra um aviso sem bloquear.

### Contratos de IPC

O programa não tem API HTTP própria. As fronteiras são canais tipados em `src/shared/ipc.ts`, expostos pelo preload via `contextBridge`, com `contextIsolation` ligado e `nodeIntegration` desligado.

| Canal | Direção | Conteúdo | Resposta e falhas |
|---|---|---|---|
| `cmd:scroll` | controle → principal | `ScrollCommand` (sem `voiceTarget`) | nenhuma; ignorado se não há texto confirmado |
| `cmd:doc` | controle → principal | `{ op: 'setDraft' \| 'confirm' \| 'discard' \| 'new' \| 'open' \| 'save' \| 'saveAs' \| 'import' \| 'recover', ... }` | `Result<void, FileError \| 'empty-text' \| 'cancelled'>` |
| `cmd:appearance` | controle → principal | `Partial<Appearance>` | `Appearance` aplicada (valores presos aos limites) |
| `cmd:output` | controle → principal | `{ op: 'open'; displayKey } \| { op: 'close'; id } \| { op: 'set'; id; mirrorH?; flipV?; voiceSignal? }` | `Result<OutputInfo, 'display-busy' \| 'control-display' \| 'display-missing'>` |
| `cmd:voice` | controle → principal | `{ op: 'toggle' } \| { op: 'setMic'; deviceId } \| { op: 'setEngine'; engine } \| { op: 'setMode'; mode }` | `Result<VoiceStatus, 'no-text' \| 'no-mic' \| 'mic-denied'>` |
| `cmd:keymap` | controle → principal | `{ op: 'set'; action; combo; force? } \| { op: 'clear'; action } \| { op: 'reset' }` | `Result<Keymap, { conflictWith: ActionId } \| 'reserved'>` |
| `cmd:settings` | controle → principal | `{ op: 'resetAll' }` | `Settings` |
| `cmd:update` | controle → principal | `{ op: 'download' }` | `Result<void, 'network' \| 'no-asset'>` |
| `asr:hypothesis` | controle → principal | `Hypothesis` | nenhuma |
| `asr:fault`, `asr:lag`, `asr:ready` | controle → principal | `EngineFault`, `number`, `void` | nenhuma |
| `ui:editorFocus` | controle → principal | `boolean` | nenhuma |
| `layout:request` | principal → controle | `{ revision, text, appearance }` | `layout:result` com `LayoutResult` |
| `state:snapshot` | principal → controle | `StateSnapshot` | nenhuma |
| `state:output` | principal → saída | `{ id, layout, mirrorH, flipV, voiceSignal, voiceState, showBadge }` | nenhuma |
| `motion:segment` | principal → todas | `MotionSegment` | nenhuma |
| `clock:ping` | janela → principal | `t0` | `{ t0, mainNow }` |
| `asr:pcm` | controle → ParakeetHost | `{ pcm: Float32Array 16 kHz, endMs }` ou `{ stop: true }` (MessagePort; o buffer vai copiado, porque o `MessagePortMain` do Electron descarta `ArrayBuffer` transferido) | `{ ready: true }`, `{ words, final, audioEndMs }` ou `{ fault }` |

## Pontos de integração

**API do GitHub (só a versão nova):**

- **Consulta:** `GET https://api.github.com/repos/audiovisualpecege/teleprompter/releases/latest` por `net.fetch` do Electron, sem autenticação, com limite de 5 s e uma consulta por abertura.
- **Comparação:** a versão da tag (`v1.2.3`) é comparada como semver com `app.getVersion()`.
- **Instalador:** o asset escolhido termina em `-win-x64.exe` no Windows e em `-mac-<arch>.dmg` no Mac, com `process.arch`.
- **Falha:** qualquer falha (sem rede, 403 por limite, 404, JSON inesperado) vai só ao log, e nenhum aviso aparece (US-038 EC-1).
- **Baixar:** o download vai para `app.getPath('downloads')`, com progresso na tela de controle, e depois `shell.openPath` abre o instalador.
- **Dados enviados:** nada sai do computador além dessa consulta e do download.

**Sistema operacional:**

- **Microfone no Mac:** `systemPreferences.askForMediaAccess('microphone')` e `NSMicrophoneUsageDescription` no `Info.plist`.
- **Dispositivos de áudio:** `navigator.mediaDevices.enumerateDevices()` lista as entradas pelo nome do sistema, e o evento `devicechange` atualiza a lista.
- **Monitores:** API `screen`, com os eventos `display-added`, `display-removed` e `display-metrics-changed`.
- **Abrir por duplo clique:**
  - **Windows:** o arquivo chega por `argv`, e `requestSingleInstanceLock` repassa à instância aberta.
  - **Mac:** o arquivo chega pelo evento `open-file`.
- **Seletores de arquivo:** `dialog.showOpenDialog` e `showSaveDialog`, filtrados para `.roteiro` ou para `.txt` e `.docx`. São janelas do sistema, e o `nativeTheme.themeSource = 'dark'` as deixa escuras onde o sistema permite.

## Design system

Toda tela do programa segue o design system da Chiaro Filmes (`design-system/chiaro/`, lido pelo `DESIGN.md`). Isso é regra da empresa.

**Tokens e fontes:**

- **Importação:** o `electron.vite.config.ts` cria o alias `@chiaro` para `design-system/chiaro/`. As duas telas importam `@chiaro/styles.css`, que traz `tokens/fonts.css`, `colors.css`, `typography.css`, `spacing.css` e `base.css`.
- **Sem valores soltos:** cores, espaços, raios, sombras e curvas vêm sempre das variáveis (`--surface-card`, `--text-primary`, `--accent`, `--radius-*`, `--shadow-*`, `--ease-cine`), nunca de valores copiados.
- **Fontes:** Altivo e Archivo vêm de `design-system/chiaro/fonts/` pelo `fonts.css`. O Vite as empacota no build, então o programa instalado funciona sem internet e não depende da pasta.
- **Uso das fontes:** títulos em Altivo e caixa alta, com o par Light 300 e Black 800. Interface em Archivo.

**Tema Noite, sempre:**

- **HTML:** os dois `index.html` (controle e saída) nascem com `<html data-theme="noite">`.
- **Corpo da página:** `color-scheme: dark` e `background: var(--surface-page)` (Noite `#070010`). A tela de controle pode usar `--gradient-noite` no fundo.
- **Janelas:** `BrowserWindow` com `backgroundColor: '#070010'` na janela de controle, sem piscar claro. `nativeTheme.themeSource = 'dark'` para menus e diálogos do sistema.
- **Sem tema claro:** não há alternância de tema nem leitura da preferência do sistema.
- **Elementos de interface:** diálogos (confirmações, alterações não salvas, voltar ao padrão), menus, campos, dicas, avisos e barras de rolagem usam os componentes e tokens do tema Noite. As barras de rolagem usam `::-webkit-scrollbar` com `--surface-*` e `--accent`.
- **Diálogos próprios:** as perguntas do programa usam o `Dialog` da Chiaro, não `dialog.showMessageBox`. Só os seletores de arquivo são do sistema.
- **Exceção das saídas:** a área de texto da saída usa as cores escolhidas pela pessoa, com texto branco em fundo preto por padrão. É conteúdo de leitura no vidro, como diz o PRD. O sinal de voz e o número de identificação usam os tokens Chiaro.

**Componentes:**

- **Importação:** os componentes de referência são importados de `@chiaro/components/...`: `Button`, `Input`, `Checkbox`, `Radio`, `Switch`, `Tabs`, `Card`, `Tooltip`, `Badge`, `Logo`, `SectionTitle`.
- **Componentes sem `.jsx`:** o export traz só a definição de tipos e o `.prompt.md` de `Select`, `Dialog`, `Toast`, `Tag` e `MediaCard`. Esses ganham uma implementação local em `src/renderer/shared/ui/`, seguindo o `.d.ts` e o `.prompt.md` de cada um, com os mesmos tokens. A pasta `design-system/chiaro/` nunca é editada.
- **Ícones:** Solar Icons (`@solar-icons/react`, pesos `linear`, `bold` e `bold-duotone`), instalados como pacote, sem CDN.
- **Cores dos estados da voz:** Ouvindo `--success`, Esperando `--warning`, Falhou `--danger`, Preparando `--info`. Todos aparecem sempre com texto, não só com cor.
- **Ações principais:** pílula com `--accent` (Lavanda no Noite) e `--shadow-glow` no hover.
- **Casos fora do design system, decididos aqui:**
  - **Seletor de cor:** um popover escuro próprio, com amostras e campo hexadecimal, usando `react-colorful` estilizado com os tokens. Evita o seletor nativo claro do sistema.
  - **Medidor de nível do microfone:** uma barra em pílula com `--gradient-chiaro`.
  - **Sinal discreto nas saídas:** forma e cor.
    - Ouvindo: círculo cheio `--success`.
    - Esperando: duas barras de pausa `--warning`.
    - Falhou: triângulo `--danger`.
    - Tamanho: 28 px lógicos, no canto inferior direito, dentro da margem lateral, ou a 24 px da borda quando a margem é 0%.
- **Textos da interface:** português do Brasil com acentos, títulos em caixa alta, sem emoji, sem ponto de exclamação e sem travessão.

**Tela de controle (como o PRD pede):**

- **Prévia:** em destaque no alto, sem inversão, com as linhas-guia das margens.
- **Ações de gravação:** grandes e sempre visíveis numa barra, com o atalho de cada botão na dica. São elas: Iniciar e Pausar, velocidade com "-" e "+" e o valor "1,25x", Voltar ao início, Subir, Descer e Voz.
- **Estado da voz e alertas:** num lugar fixo ao lado das ações, com cor e texto. A falha usa uma faixa `--danger` com o motivo.
- **Organização:** o editor e os botões Confirmar e Descartar ficam numa coluna. A aparência e o estúdio (saídas, microfone e voz, atalhos, voltar ao padrão) ficam em abas separadas.
- **Aviso de atalhos inativos:** fica fixo enquanto o editor está em foco.
- **Primeira abertura:** a tela vazia mostra três passos: colar ou importar, abrir uma saída, ligar a voz.

**Logo da Chiaro:** aparece só como assinatura "um produto Chiaro Filmes" na tela Sobre, com o `Logo` em versão branca, seguindo `guidelines/brand-logos.html`. Nunca é o ícone do programa.

**Ícone do produto:**

- **Desenho:** um símbolo de teleprompter desenhado para este programa, em `build/icone.svg`. É um quadrado de cantos bem arredondados com `--gradient-chiaro` (Lavanda, Violeta, Ametista) no fundo e, por cima, um vidro inclinado em traço Areia com três linhas de texto arredondadas. A linha do meio fica sobre uma faixa Pêssego, que é a faixa de referência e mostra o que o programa faz.
- **Versão de 16 px:** o símbolo fica com o vidro e duas linhas grossas mais a faixa, sem detalhes finos.
- **Tamanhos gerados:** `scripts/gerar-icones.mjs` gera, a partir do SVG, os PNG de 16, 32, 48, 64, 128, 256, 512 e 1024 px, o `.ico` do Windows (16 a 256) e o `.icns` do Mac. O `electron-builder.yml` os usa no instalador, no atalho do menu Iniciar, no Dock e na associação de `.roteiro`.
- **Janelas:** as janelas usam o PNG de 256 como ícone.

## Versão

- **Onde mora:** o número fica só no `version` do `package.json`. A primeira entrega é `1.0.0`.
- **Como chega às telas:** o `electron.vite.config.ts` lê o `package.json` e injeta `__APP_VERSION__` no build. O processo principal usa `app.getVersion()`, que vem do mesmo campo. Nenhuma tela tem o número digitado à mão.
- **Onde aparece:** como `v1.0.0` no canto inferior direito da tela de controle, fixo, em `--text-muted` e tamanho de legenda, e também na tela Sobre.
- **Onde não aparece:** as saídas de TP nunca mostram a versão (US-037 EC-1).
- **Aviso de versão nova:** compara a tag da Release com esse mesmo número.
- **Nome dos instaladores:** o `electron-builder` usa o mesmo número no nome dos arquivos (`Teleprompter-1.0.0-win-x64.exe`).
- **Changelog:** cada versão entra no `CHANGELOG.md`, com a data e o que mudou nas palavras de quem usa. A próxima versão segue o semver: PATCH para correção, MINOR para algo novo, MAJOR quando muda o jeito de usar.

## Mapa do PRD para os componentes

| Objetivo ou história | Componentes |
|---|---|
| Mesmo ponto em todas as telas (US-014, US-017) | ScrollEngine, `MotionSegment`, Stage, relógio comum |
| Várias saídas com inversão própria (US-015, US-016, US-019, US-020) | OutputManager, DisplayRegistry, SettingsStore, ADR-010 |
| Monitor desconectado (US-018) | OutputManager, DisplayRegistry |
| Roteiro: colar, importar, salvar, abrir (US-001 a US-005, US-007) | ControlApp (editor), ScriptFiles, import-txt, import-docx, recovery |
| Editar e confirmar sem salto (US-006) | AppStore, ScrollEngine.replaceText |
| Aparência e quebras (US-008 a US-013) | LayoutService, layout.ts, ScrollEngine.relayout, Stage |
| Rolagem manual e atalhos (US-021 a US-025) | ScrollEngine, KeymapService, ControlApp |
| Rolagem automática (US-026, US-027) | ScrollEngine, PowerGuard |
| Voz (US-028 a US-035) | AudioCapture, VoskEngine, ParakeetEngine, ParakeetHost, VoiceTracker, VoiceController, OutputApp (sinal) |
| Ajustes no computador (US-036) | SettingsStore |
| Versão e versão nova (US-037, US-038) | `__APP_VERSION__`, UpdateChecker |
| Instalação (US-039) | electron-builder, ícone, Como usar |

## Análise de impacto

| Componente | Tipo | Descrição e risco | Ação |
|---|---|---|---|
| Repositório `audiovisualpecege/teleprompter` | novo | Código, Actions e Releases públicas; risco baixo | Criar com `gh repo create audiovisualpecege/teleprompter --public` |
| Programa Electron (`src/`) | novo | Todo o produto; risco médio na voz e nas saídas | Implementar na ordem abaixo |
| `design-system/chiaro/` | lido, nunca editado | Tokens, fontes e componentes importados por alias; risco baixo | Implementar localmente os componentes sem `.jsx` |
| Modelos de voz (`resources/models/`) | novo, fora do git | Cerca de 670 MB baixados no build; risco de link quebrado | SHA-256 fixado e fontes oficiais |
| `_instaladores.txt` | novo | Lista os instaladores entregues | Atualizar a cada Release |
| Programa da Apotec em uso | substituído | O estúdio troca de programa; risco operacional baixo | Rodar os dois em paralelo na primeira semana |

## Abordagem de testes

O catálogo completo está em `_tests.md`.

- **Ferramentas:**
  - **Unitário e integração:** Vitest, com `jsdom` nos componentes React (Testing Library).
  - **Ponta a ponta:** Playwright `_electron.launch` sobre o programa empacotado.
- **Falsos só nas bordas:**
  - **Electron:** `screen`, `BrowserWindow`, `powerSaveBlocker`, `dialog`, `net` e `shell` entram por adaptadores finos (`src/main/platform.ts`), substituídos por falsos nos testes de unidade.
  - **Disco:** pasta temporária real do sistema de testes.
  - **Medidas de texto:** `measure` falso, de largura fixa por caractere.
- **Unitário:** funções puras (`motion`, `layout`, `text`, `voice-tracker`, codecs de arquivo, `keymap`, `settings`, `updates`, comparação de monitores, contraste) e máquinas de estado (`VoiceController`, `OutputManager`, `ScrollEngine`) com relógio falso.
- **Integração:**
  - **Componentes reais juntos:** `AppStore` com `ScrollEngine`, `VoiceTracker` e `OutputManager`, mais o barramento de IPC em memória.
  - **Disco real:** os importadores leem arquivos de verdade da pasta `tests/fixtures`.
  - **Voz:** os dois motores reais são alimentados por WAVs gravados (`tests/fixtures/voz/*.wav` com o roteiro correspondente). Rodam no CI com o modelo baixado.
- **Ponta a ponta:**
  - **Programa real:** a voz recebe áudio do Chromium com `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>`.
  - **Monitores simulados:** `TP_FAKE_DISPLAYS` (JSON com monitores virtuais, só no build de teste) injeta monitores no `DisplayRegistry`. Assim, ligar e desligar monitores é testado sem hardware.
  - **Sincronia:** um gancho de teste (`window.__tpProbe`) devolve a posição desenhada em cada janela.
  - **Ganchos só no build de teste:** `__tpTest` liga e desliga monitores e microfone simulados, e `TP_UPDATE_URL` aponta o aviso de versão para um servidor local. O build de produção não tem nenhum desses ganchos.
- **Dependências:** gravações reais da equipe para as fixtures de voz e o modelo Vosk no CI. O Parakeet roda só no job noturno, por tamanho.
- **Teste manual de estúdio:** duas saídas reais com inversões diferentes, pedal e passador. Fica como lista de conferência no Como usar, não como teste automático.

## Sequência de desenvolvimento

### Ordem de construção

1. **Esqueleto:** projeto electron-vite, React e TypeScript, alias `@chiaro`, tema Noite nas duas telas, `__APP_VERSION__`, ícone SVG e geração de tamanhos, `CHANGELOG.md`, electron-builder e workflow de Release. Sem dependências.
2. **Prova da voz:** `AudioCapture`, `VoskEngine` e `ParakeetHost` mínimos, script de modelos, medição de atraso e precisão com gravações da equipe, calibração das constantes do `VoiceTracker` e do `BASE_WPM`. Depende de 1.
3. **Núcleo compartilhado:** `motion.ts`, `layout.ts`, `text.ts`, `defaults.ts` e `ipc.ts`. Depende de 1.
4. **AppStore e ScrollEngine:** comandos, limites, âncora e troca de texto, rolagem automática. Depende de 3.
5. **LayoutService e Stage, prévia na tela de controle:** relógio comum. Depende de 3 e 4.
6. **SettingsStore e ScriptFiles:** `.roteiro`, `.txt`, `.docx`, recuperação e alterações não salvas. Depende de 4.
7. **Editor, confirmar e descartar, aparência na tela de controle:** depende de 5 e 6.
8. **DisplayRegistry, OutputManager e OutputApp:** inversões, número, queda e volta, PowerGuard. Depende de 5 e 6.
9. **KeymapService:** atalhos em todas as janelas, editor em foco, tela de troca de atalhos. Depende de 4, 7 e 8.
10. **VoiceTracker e VoiceController completos:** tela de voz, microfone, medidor, motor, modo, alerta e sinal nas saídas. Depende de 2, 4 e 8.
11. **UpdateChecker:** aviso na tela de controle. Depende de 1.
12. **Primeira abertura, Sobre, voltar ao padrão e acabamento visual:** depende de 7 a 11.
13. **E2E, instaladores 1.0.0, Release, `_instaladores.txt` e Como usar:** depende de tudo.

### Dependências técnicas

- **Gravações de voz:** 3 ou mais gravações de pessoas da equipe lendo um roteiro conhecido (WAV, com o texto), incluindo improviso e um trecho pulado, para a prova da voz e as fixtures.
- **Repositório público e Actions:** `audiovisualpecege/teleprompter` com GitHub Actions ligado, e runners `macos-latest` para o DMG.
- **Hardware para a conferência manual:** um computador com dois monitores extras, e um pedal ou passador.

## Monitoramento e observabilidade

Não há telemetria: nada sai do computador. A observabilidade é local.

- **Log:** `electron-log` em `userData/logs/`, com rotação de 5 arquivos de 1 MB. Eventos com campos estruturados:
  - `output.open`, `output.down` e `output.reopen`, com `id`, `displayKey` e `label`;
  - `voice.state`, com `from`, `to`, `fault` e `engine`;
  - `voice.lag`, um por minuto, com `p50` e `p95`;
  - `voice.engineRestart`, com `attempt`;
  - `file.error`, com `op` e `code`;
  - `settings.reset` e `settings.corrupt`;
  - `update.check`, com `result`;
  - `render.longFrame` nas saídas, para quadros acima de 50 ms, com `count` por minuto.
- **Alertas a quem opera:** voz em `failed` mostra o alerta forte. Saída `down` mostra o aviso com o número e o monitor. Lentidão (`lag` acima de 3 s) passa a voz para `failed`, com o motivo "o computador não está dando conta".
- **Tela Sobre:** versão, motor de voz ativo, atraso médio da voz e o botão "Abrir pasta de registros", para relatar problemas.

## Considerações técnicas

### Decisões principais

- **Estado no processo principal, movimento por trechos e palco lógico fixo (ADR-006):** garante a sincronia por construção.
  - **Abrimos mão de:** a escala pela largura em telas fora de 16:9.
  - **Rejeitadas:** a janela de controle como dona da rolagem, a posição enviada a cada quadro e a quebra de linhas pelo navegador em cada janela.
- **Vosk padrão e Parakeet escolhível, atrás de `SpeechEngine` (ADR-007):** a escolha é do autor.
  - **Abrimos mão de:** um instalador perto de 750 MB, e há dois motores para calibrar.
  - **Rejeitados:** só um motor e o Whisper.
- **Alinhador próprio e igual para os dois motores:** o comportamento de "Perto", "Pulos para a frente", "nunca para trás" e "manual por cima" não depende do motor e é testável como função pura.
- **Roteiro `.roteiro` em JSON e ajustes em JSON por usuário (ADR-008):** arquivo legível e copiável. Foi rejeitado o SQLite.
- **Build e distribuição (ADR-009):** electron-vite e electron-builder, Actions publicando nas Releases, aviso de versão pela API do GitHub. Foram rejeitados o Forge e a atualização silenciosa.
- **Duas inversões por saída (ADR-010):** a escolha é do autor, que pode tirar uma depois dos testes.
- **Importação de `.docx` com leitura própria do XML:** em vez de `mammoth`, para separar tabelas, caixas de texto e imagens e avisar o que foi ignorado.

### Riscos conhecidos

- **Precisão da voz em estúdio:** média. Mitigações:
  - vocabulário restrito ao roteiro no Vosk;
  - critério de duas palavras em ordem;
  - Parakeet como alternativa;
  - calibração na tarefa 2;
  - controle manual sempre por cima.
- **`vosk-browser` dentro do Electron:** baixa a média. A tarefa 2 confirma vocabulário restrito e resultados parciais. Plano B: Vosk no `utilityProcess` por outra ligação, sem mudar `SpeechEngine`.
- **`sherpa-onnx-node` no Mac x64, no arm64 e no Windows:** baixa a média. A tarefa 2 confirma os três. O Parakeet some da lista do sistema em que não carregar, com aviso, e o Vosk continua.
- **Monitor da tela de controle perdido com todos os outros ocupados:** baixa. As saídas e os atalhos continuam. A janela de controle volta no primeiro monitor livre.
- **Identidade de monitor no Windows:** média. O `id` pode mudar ao trocar de porta. O casamento por `label` e tamanho cobre o caso.
- **Rolagem com tranco em computador modesto:** baixa a média. Mitigações:
  - desenho só por `transform`;
  - linhas fora da tela não são desenhadas (virtualização por `y`);
  - `backgroundThrottling: false`;
  - medição de quadros longos no log.
- **Fonte instalada com métricas diferentes entre `measureText` e o desenho:** baixa. As linhas são desenhadas com `white-space: pre` e as quebras já calculadas, então uma diferença de medida não muda as quebras.
- **Pesquisa adicional:** a tarefa 2 mede e grava no `_techspec.md` os valores finais das constantes de voz e do `BASE_WPM`.

## Preferências aplicadas

- [2026-10-13 · #28] Programa instalado de verdade, com instalador próprio no Windows: NSIS.
- [2026-10-13 · #24] Desktop para Windows e Mac: DMG para x64 e arm64.
- [2026-10-13 · #24] Instaladores sem assinatura de código: o Como usar explica a liberação.
- [2026-10-13 · #24] Electron, React e TypeScript com os componentes e tokens da Chiaro, sem reescrever a interface.
- [2026-10-13 · #24] Aviso de versão nova com botão que abre o instalador, sem atualização silenciosa.
- [2026-10-16 · #31] Instaladores e versões novas pelas Releases de um repositório público em `audiovisualpecege`.
- [2026-10-13 · #24] Toda automação tem liga e desliga: rolagem automática e voz.
- [2026-10-16 · #31] O que age sozinho começa ligado: o sinal de voz começa ligado em toda saída.
- [2026-10-16 · #26] Usável à mão quando a parte inteligente falha: o manual vale sempre, e a voz falha sem apagar o texto.
- [2026-10-16 · #26] Fornecedor trocável para a parte inteligente: `SpeechEngine` com dois motores.
- [2026-10-20 · #18] Falha ao vivo mantém a imagem e dá alerta forte: as saídas nunca apagam, e a tela de controle mostra a faixa de falha.
- [2026-10-20 · #18] Mídia processada no próprio computador: o áudio nunca sai da máquina.
- [2026-10-13 · #28] Sem serviço cobrado por uso: os dois motores são locais e gratuitos.
- [2026-10-16 · #31] Configurações só no aparelho: `ajustes.json` em `userData`.
- [2026-10-16 · #31] Ajustes poucos e globais, com voltar ao padrão.
- [2026-10-16 · #31] Atalhos de teclado com combinação sugerida e trocável.
- [2026-10-13 · #28] Produto para qualquer pessoa da empresa: tela de controle simples, com ações grandes.

## Registros de decisão (ADRs)

- [ADR-001: Um computador, uma rolagem, várias saídas locais](adrs/adr-001.md): todas as saídas no mesmo computador, da mesma posição.
- [ADR-002: A primeira versão é só o teleprompter](adrs/adr-002.md): avisos e conversa ficam fora.
- [ADR-003: A voz acompanha só um pouco à frente, com modo de pulos para a frente selecionável](adrs/adr-003.md): "Perto" padrão, "Pulos para a frente" opcional, nunca para trás.
- [ADR-004: Estado da voz na tela de controle e num sinal discreto nas saídas](adrs/adr-004.md): alerta forte no controle e sinal desligável por saída.
- [ADR-005: Uma automação de rolagem por vez, controle manual sempre por cima](adrs/adr-005.md): voz e automática exclusivas, de 0,25x a 3,00x.
- [ADR-006: Processo principal dono da rolagem, janelas desenham por trechos de movimento sobre um palco lógico fixo](adrs/adr-006.md): sincronia e quebras idênticas por construção.
- [ADR-007: Voz com Vosk pequeno em português como padrão e Parakeet v3 escolhível, atrás de uma peça trocável](adrs/adr-007.md): dois motores locais, alinhador próprio.
- [ADR-008: Roteiro em arquivo `.roteiro` (JSON) e ajustes em JSON na pasta do usuário](adrs/adr-008.md): arquivo legível, gravação segura e recuperação.
- [ADR-009: Build com electron-vite, instaladores com electron-builder publicados pelo GitHub Actions](adrs/adr-009.md): NSIS, DMG x64 e arm64, Releases em `audiovisualpecege`.
- [ADR-010: Espelhamento horizontal e inversão vertical separados em cada saída](adrs/adr-010.md): duas inversões independentes, guardadas por monitor.

## Questões em aberto

- **Roda do mouse com a rolagem automática ligada:** a roda move a posição, como definido no PRD. A equipe confirma no uso se prefere que ela mude a velocidade.
- **Inversões:** depois dos testes no estúdio, a equipe pode tirar uma das duas inversões (ADR-010).
