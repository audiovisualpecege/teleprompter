# User Stories: Teleprompter para uso interno

Catálogo canônico de comportamento do teleprompter da ideia #34. Acompanha o `_prd.md`; é consumido pelo
`_techspec.md` (mapeamento para componentes) e pelo `_tests.md` (matriz de cobertura).

## Personas

- **Operador**: pessoa da Produção ou da Técnica (Av) que conduz o TP durante a gravação na tela de controle. Precisa de controle imediato do texto, saídas sincronizadas e alerta claro quando algo falha. Pode não ser da Técnica.
- **Quem lê**: apresentador, professor ou mediador que lê o texto no vidro do TP. Às vezes está sozinho, com a voz ligada, controlando por pedal, passador ou teclado. Precisa de texto legível, estável e de saber se a voz está acompanhando.
- **Quem prepara o roteiro**: pessoa da Produção que cola ou importa o texto, ajusta a aparência e salva o roteiro como arquivo para a gravação.
- **Quem monta o estúdio**: pessoa da Técnica que instala o programa, liga os monitores de TP, escolhe a saída de cada um, o espelhamento, o microfone e os atalhos daquele computador.

## Story Index

| ID     | Feature Area        | Persona                 | Story |
|--------|---------------------|-------------------------|-------|
| US-001 | Roteiro             | Quem prepara o roteiro  | Colar o texto do roteiro |
| US-002 | Roteiro             | Quem prepara o roteiro  | Importar um arquivo .txt |
| US-003 | Roteiro             | Quem prepara o roteiro  | Importar um arquivo .docx |
| US-004 | Roteiro             | Quem prepara o roteiro  | Salvar o roteiro como arquivo, com a aparência |
| US-005 | Roteiro             | Quem prepara o roteiro  | Abrir um roteiro salvo |
| US-006 | Roteiro             | Operador                | Alterar o texto durante o uso e confirmar |
| US-007 | Roteiro             | Operador                | Ser avisado de alterações não salvas |
| US-008 | Aparência           | Quem prepara o roteiro  | Escolher tipo e tamanho da fonte |
| US-009 | Aparência           | Quem prepara o roteiro  | Escolher cor do texto, do fundo e da faixa de referência |
| US-010 | Aparência           | Quem prepara o roteiro  | Mostrar o texto em caixa alta, caixa baixa ou normal |
| US-011 | Aparência           | Quem prepara o roteiro  | Alinhar o texto |
| US-012 | Aparência           | Operador                | Ajustar as margens laterais |
| US-013 | Aparência           | Operador                | Ajustar a posição da faixa de referência |
| US-014 | Aparência           | Operador                | Ver a prévia sincronizada na tela de controle |
| US-015 | Saídas              | Quem monta o estúdio    | Abrir uma saída de TP num monitor |
| US-016 | Saídas              | Quem monta o estúdio    | Espelhar ou não cada saída |
| US-017 | Saídas              | Quem lê                 | Ver o mesmo ponto do texto em todas as saídas |
| US-018 | Saídas              | Operador                | Continuar quando um monitor é desconectado |
| US-019 | Saídas              | Quem monta o estúdio    | Fechar uma saída |
| US-020 | Saídas              | Quem monta o estúdio    | Reabrir as saídas ao abrir o programa |
| US-021 | Rolagem manual      | Operador                | Subir e descer o texto por botões |
| US-022 | Rolagem manual      | Operador                | Rolar o texto pela roda do mouse |
| US-023 | Rolagem manual      | Quem lê                 | Controlar o TP por teclado, pedal ou passador |
| US-024 | Rolagem manual      | Quem monta o estúdio    | Trocar os atalhos de teclado |
| US-025 | Rolagem manual      | Operador                | Voltar ao início do texto |
| US-026 | Rolagem automática  | Operador                | Iniciar e pausar a rolagem automática |
| US-027 | Rolagem automática  | Operador                | Ajustar a velocidade em passos de 0,25x |
| US-028 | Voz                 | Operador                | Ligar e desligar a rolagem por voz |
| US-029 | Voz                 | Quem monta o estúdio    | Escolher o microfone da voz |
| US-030 | Voz                 | Quem lê                 | Ter o texto acompanhando a leitura |
| US-031 | Voz                 | Quem lê                 | Improvisar sem o texto andar |
| US-032 | Voz                 | Operador                | Escolher o modo "Pulos para a frente" |
| US-033 | Voz                 | Operador                | Mover o texto à mão com a voz ligada |
| US-034 | Voz                 | Operador                | Receber alerta forte quando a voz falha |
| US-035 | Voz                 | Quem lê                 | Ver o estado da voz num sinal discreto no TP |
| US-036 | Ajustes e programa  | Quem monta o estúdio    | Manter os ajustes no computador e voltar ao padrão |
| US-037 | Ajustes e programa  | Operador                | Ver a versão do programa |
| US-038 | Ajustes e programa  | Operador                | Ser avisado de versão nova |
| US-039 | Ajustes e programa  | Quem monta o estúdio    | Instalar e abrir o programa pela primeira vez |

## Roteiro

### US-001: Colar o texto do roteiro

**As a** quem prepara o roteiro, **I want** colar um texto na caixa de edição, **so that** ele vá para o TP sem passos extras.

Acceptance criteria:

- AC-1: Given a caixa de edição vazia, when a pessoa cola um texto, then o texto aparece na caixa com as quebras de parágrafo preservadas.
- AC-2: Given um texto colado e ainda não confirmado, when a pessoa confirma, then a prévia e todas as saídas mostram o texto a partir do início.
- AC-3: Given um texto copiado com formatação (negrito, cores, links), when ele é colado, then só o texto puro entra, sem formatação.

Edge cases:

- EC-1: Colar só espaços ou linhas em branco → o botão de confirmar fica indisponível e a prévia continua mostrando o texto anterior.
- EC-2: Colar um texto muito longo (equivalente a 100 páginas) → o texto entra inteiro e a rolagem continua suave.
- EC-3: Colar com caracteres especiais, acentos ou emojis → aparecem como foram colados; o que a fonte não tiver aparece pela fonte reserva, sem quadradinhos vazios sempre que possível.
- EC-4: Colar duas vezes seguidas → o texto fica como na caixa de edição (colar é edição comum, sem duplicar nada sozinho).
- EC-5: Colar durante a rolagem automática → as saídas seguem com o texto confirmado anterior até a confirmação (ver US-006).

### US-002: Importar um arquivo .txt

**As a** quem prepara o roteiro, **I want** importar um arquivo `.txt`, **so that** eu não precise abrir e copiar o arquivo noutro programa.

Acceptance criteria:

- AC-1: Given a tela de controle, when a pessoa escolhe importar e seleciona um `.txt`, then o conteúdo vai para a caixa de edição, pronto para confirmar.
- AC-2: Given um `.txt` em UTF-8 ou na codificação comum do Windows (Latin-1), when ele é importado, then os acentos aparecem certos.

Edge cases:

- EC-1: Arquivo vazio → mensagem "O arquivo está vazio" e o roteiro atual continua intacto.
- EC-2: Arquivo que não é texto, com extensão `.txt` → mensagem de que o arquivo não pôde ser lido e o roteiro atual continua intacto.
- EC-3: Caixa de edição com alterações não salvas → o programa pergunta antes de substituir (ver US-007).
- EC-4: Arquivo em pasta de rede indisponível ou sem permissão de leitura → mensagem clara com o motivo; nada muda.
- EC-5: Cancelar a escolha do arquivo → nada muda.

### US-003: Importar um arquivo .docx

**As a** quem prepara o roteiro, **I want** importar um `.docx` do Word, **so that** o roteiro escrito pela equipe chegue ao TP direto.

Acceptance criteria:

- AC-1: Given um `.docx` com parágrafos de texto, when a pessoa o importa, then a caixa de edição recebe o texto com um parágrafo por parágrafo do documento.
- AC-2: Given um `.docx` com imagens, tabelas ou caixas de texto, when ele é importado, then entra só o texto corrido e a tela avisa que imagens e tabelas foram ignoradas.

Edge cases:

- EC-1: Arquivo `.docx` corrompido ou protegido por senha → mensagem de que o arquivo não pôde ser lido; o roteiro atual continua intacto.
- EC-2: Arquivo `.doc` antigo ou `.pdf` → o seletor só oferece `.txt` e `.docx`; se a pessoa forçar outro tipo, recebe a mensagem de formato não aceito.
- EC-3: Documento sem texto (só imagens) → mensagem "O arquivo não tem texto para importar"; nada muda.
- EC-4: Documento com marcas de revisão do Word → entra o texto como está na versão final (alterações aceitas).
- EC-5: Documento muito grande → importa inteiro, com indicação de que está carregando se demorar mais de um segundo.

### US-004: Salvar o roteiro como arquivo, com a aparência

**As a** quem prepara o roteiro, **I want** salvar o roteiro num arquivo no computador, **so that** eu possa reabri-lo na gravação com tudo do jeito que deixei.

Acceptance criteria:

- AC-1: Given um roteiro novo, when a pessoa salva, then o programa pede nome e pasta e grava um arquivo de roteiro com o texto e os ajustes de aparência (fonte, tamanho, cores, caixa, alinhamento, margens, posição da faixa).
- AC-2: Given um roteiro já salvo, when a pessoa salva de novo, then o mesmo arquivo é atualizado sem perguntar o nome; "Salvar como" grava uma cópia com outro nome.
- AC-3: Given um roteiro salvo, when a tela de controle é exibida, then o nome do arquivo aparece no topo, com indicação de alterações não salvas quando houver.

Edge cases:

- EC-1: Pasta sem permissão de escrita ou disco cheio → mensagem com o motivo; o roteiro continua aberto e as alterações não se perdem.
- EC-2: Arquivo apagado ou movido por fora enquanto estava aberto → o salvar pede um novo local.
- EC-3: Salvar com texto editado e ainda não confirmado → grava o texto da caixa de edição (o que a pessoa vê), sem mexer nas saídas.
- EC-4: Nome com caracteres que o sistema não aceita → o seletor do sistema impede ou o programa avisa; nada é gravado pela metade.
- EC-5: Salvar duas vezes seguidas → o arquivo fica igual; nenhum erro.

### US-005: Abrir um roteiro salvo

**As a** quem prepara o roteiro, **I want** abrir um arquivo de roteiro, **so that** o texto e a aparência voltem como foram salvos.

Acceptance criteria:

- AC-1: Given um arquivo de roteiro, when a pessoa o abre, then o texto vai para as saídas a partir do início e a aparência salva é aplicada à prévia e a todas as saídas.
- AC-2: Given o programa fechado, when a pessoa dá duplo clique num arquivo de roteiro, then o programa abre com esse roteiro.
- AC-3: Given um roteiro aberto, when a pessoa abre outro, then a rolagem automática pausa e a voz, se ligada, passa a acompanhar o novo texto do início.

Edge cases:

- EC-1: Arquivo corrompido ou de outro programa → mensagem de que não é um roteiro válido; o roteiro atual continua intacto.
- EC-2: Arquivo salvo por uma versão mais nova do programa → abre o que entender e avisa que algum ajuste pode não ter sido aplicado.
- EC-3: Arquivo pede uma fonte que não existe neste computador → o texto aparece na fonte padrão e a tela avisa qual fonte falta.
- EC-4: Roteiro atual com alterações não salvas → o programa pergunta antes (ver US-007).
- EC-5: Abrir o mesmo arquivo que já está aberto → recarrega do disco depois de perguntar, se houver alterações não salvas.

### US-006: Alterar o texto durante o uso e confirmar

**As a** operador, **I want** corrigir o texto no meio da gravação e só mandar a correção quando eu confirmar, **so that** quem lê não veja o texto mudando enquanto eu digito.

Acceptance criteria:

- AC-1: Given o TP em uso, when o operador edita a caixa de edição, then as saídas continuam mostrando o texto confirmado anterior e a tela de controle indica que há alterações pendentes.
- AC-2: Given alterações pendentes, when o operador aperta "Confirmar alterações", then as saídas passam a mostrar o texto novo e o trecho que estava na faixa de referência continua na faixa, sem salto para o início.
- AC-3: Given alterações pendentes, when o operador aperta "Descartar", then a caixa de edição volta ao texto confirmado.

Edge cases:

- EC-1: O trecho que estava na faixa foi apagado → depois de confirmar, a faixa fica no ponto mais próximo do trecho apagado.
- EC-2: Confirmar com o texto todo apagado → o botão fica indisponível; o texto confirmado continua nas saídas.
- EC-3: Confirmar com a rolagem automática ou a voz ligada → elas seguem a partir do ponto mantido, sem pausar.
- EC-4: Confirmar duas vezes seguidas sem nova edição → nada muda.
- EC-5: Editar enquanto o texto rola → a caixa de edição não salta sozinha para a posição da rolagem enquanto o operador digita.

### US-007: Ser avisado de alterações não salvas

**As a** operador, **I want** um aviso antes de perder alterações, **so that** um clique errado não apague o trabalho.

Acceptance criteria:

- AC-1: Given alterações não salvas, when a pessoa fecha o programa, abre outro roteiro, importa um arquivo ou cria um roteiro novo, then o programa oferece "Salvar", "Não salvar" e "Cancelar".
- AC-2: Given nenhuma alteração desde o último salvar, when a pessoa faz uma dessas ações, then nada é perguntado.

Edge cases:

- EC-1: O sistema desliga ou o programa fecha de forma inesperada → ao abrir de novo, o programa oferece recuperar o último texto em edição.
- EC-2: "Salvar" falha (sem permissão) → a ação original é cancelada e o roteiro continua aberto.
- EC-3: Mudar só a aparência também conta como alteração não salva.

## Aparência

### US-008: Escolher tipo e tamanho da fonte

**As a** quem prepara o roteiro, **I want** escolher a fonte e o tamanho, **so that** quem lê enxergue bem no vidro do TP.

Acceptance criteria:

- AC-1: Given a tela de controle, when a pessoa escolhe uma fonte da lista de fontes instaladas, then a prévia e todas as saídas passam a usá-la na hora.
- AC-2: Given o controle de tamanho, when a pessoa muda o tamanho entre 20 e 200 (padrão 80), then a prévia e todas as saídas mudam na mesma proporção e o trecho na faixa de referência continua na faixa.

Edge cases:

- EC-1: Valor digitado fora da faixa ou não numérico → o campo volta ao limite mais próximo.
- EC-2: Fonte removida do computador depois de escolhida → texto na fonte padrão e aviso na tela de controle.
- EC-3: Tamanho tão grande que só cabem poucas palavras por linha → o programa aceita; a quebra de linha nunca corta palavras no meio, salvo uma palavra maior que a linha.
- EC-4: Mudar o tamanho com a rolagem automática ligada → a rolagem continua sem salto.

### US-009: Escolher cor do texto, do fundo e da faixa de referência

**As a** quem prepara o roteiro, **I want** escolher as cores do TP, **so that** o texto tenha bom contraste para quem lê.

Acceptance criteria:

- AC-1: Given os controles de cor, when a pessoa escolhe a cor do texto, do fundo ou da faixa de referência, then a prévia e todas as saídas mudam na hora.
- AC-2: Given o padrão, when nada foi mudado, then o texto é branco, o fundo é preto e a faixa é um retângulo de cor suave e translúcida que não esconde o texto.

Edge cases:

- EC-1: Texto e fundo da mesma cor ou com contraste muito baixo → a tela de controle avisa que o texto pode ficar ilegível, sem impedir.
- EC-2: Faixa de referência totalmente opaca → o texto da linha atual continua visível por cima da faixa.
- EC-3: Código de cor inválido digitado → o campo volta à cor anterior.

### US-010: Mostrar o texto em caixa alta, caixa baixa ou normal

**As a** quem prepara o roteiro, **I want** trocar a caixa do texto, **so that** a leitura fique no formato que a pessoa prefere.

Acceptance criteria:

- AC-1: Given a opção de caixa, when a pessoa escolhe "Caixa alta", "Caixa baixa" ou "Normal", then a prévia e as saídas mostram o texto nesse formato.
- AC-2: Given qualquer opção, when a pessoa volta para "Normal", then o texto aparece como foi escrito; a caixa é só de exibição e não altera o texto guardado.

Edge cases:

- EC-1: Letras acentuadas e "ç" → mudam de caixa corretamente (por exemplo, "ação" vira "AÇÃO").
- EC-2: Trocar a caixa com a voz ligada → a voz continua acompanhando, porque reconhece o texto independentemente da caixa.
- EC-3: Trocar a caixa muda a largura das linhas → o trecho na faixa de referência continua na faixa.

### US-011: Alinhar o texto

**As a** quem prepara o roteiro, **I want** alinhar o texto ao centro ou à esquerda, **so that** a leitura fique confortável.

Acceptance criteria:

- AC-1: Given a opção de alinhamento, when a pessoa escolhe "Centralizado" ou "À esquerda", then a prévia e as saídas mudam na hora.
- AC-2: Given uma saída espelhada, when o texto está "À esquerda", then quem lê no vidro vê o texto alinhado à esquerda (o espelhamento não inverte o alinhamento percebido).

Edge cases:

- EC-1: Mudar o alinhamento com a rolagem ligada → sem salto de posição.
- EC-2: Linhas muito curtas (uma palavra) → seguem o alinhamento escolhido.

### US-012: Ajustar as margens laterais

**As a** operador, **I want** limitar até onde o texto vai nas laterais do TP, **so that** os olhos de quem lê não se movam a ponto de aparecer na gravação.

Acceptance criteria:

- AC-1: Given o controle de margem, when o operador ajusta a margem entre 0% e 40% da largura de cada lado (padrão 10%), then o texto da prévia e das saídas passa a ocupar só a faixa central e as linhas se quebram de novo.
- AC-2: Given margens ajustadas, when a prévia é exibida, then ela mostra as linhas-guia das margens para o operador ver o limite.
- AC-3: Given a mudança de margem, when o texto se reorganiza, then o trecho na faixa de referência continua na faixa.

Edge cases:

- EC-1: Valor fora da faixa → volta ao limite mais próximo.
- EC-2: Margem máxima com fonte grande → cabe pelo menos uma palavra por linha; palavras maiores que a linha quebram sem sumir.
- EC-3: Saídas com resoluções diferentes → a margem é a mesma proporção da largura em todas, e as linhas se quebram nos mesmos pontos.

### US-013: Ajustar a posição da faixa de referência

**As a** operador, **I want** escolher a altura da faixa de referência na tela, **so that** a linha atual fique perto da lente da câmera.

Acceptance criteria:

- AC-1: Given o padrão, when nada foi mudado, then a faixa fica a um terço da altura a partir do topo.
- AC-2: Given o controle de posição, when o operador move a faixa entre 10% e 60% da altura, then a prévia e todas as saídas mudam e o mesmo trecho continua dentro da faixa.

Edge cases:

- EC-1: Valor fora da faixa → volta ao limite mais próximo.
- EC-2: Início do texto → a primeira linha aparece na faixa, com o espaço acima vazio.
- EC-3: Fim do texto → a última linha pode chegar à faixa; a rolagem não passa disso.

### US-014: Ver a prévia sincronizada na tela de controle

**As a** operador, **I want** ver na tela de controle exatamente o que as saídas mostram, **so that** eu não precise olhar para o TP para saber onde o texto está.

Acceptance criteria:

- AC-1: Given saídas abertas, when o texto rola por qualquer meio, then a prévia mostra a mesma linha na faixa de referência que as saídas, ao mesmo tempo.
- AC-2: Given nenhuma saída aberta, when o operador usa o programa, then a prévia funciona normalmente, servindo para ensaio.
- AC-3: Given a prévia, when ela é exibida, then aparece sem espelhamento, para o operador ler normalmente.

Edge cases:

- EC-1: Janela de controle redimensionada ou minimizada → as saídas não são afetadas; a prévia se ajusta mantendo as mesmas quebras de linha das saídas.
- EC-2: Rolagem longa (horas de uso) → nenhuma diferença de posição acumula entre prévia e saídas.

## Saídas

### US-015: Abrir uma saída de TP num monitor

**As a** quem monta o estúdio, **I want** escolher em qual monitor abrir uma saída de TP, **so that** cada aparelho de TP receba o texto.

Acceptance criteria:

- AC-1: Given monitores ligados ao computador, when a pessoa abre a lista de saídas, then vê cada monitor por nome e resolução e pode abrir uma saída em tela cheia em qualquer um, exceto no monitor da tela de controle.
- AC-2: Given duas ou mais saídas, when elas estão abertas, then cada uma ocupa um monitor diferente.
- AC-3: Given um monitor escolhido, when a saída abre, then a tela de controle mostra um número que identifica cada saída, e a saída mostra o mesmo número por alguns segundos para a pessoa saber qual é qual.

Edge cases:

- EC-1: Só um monitor (o da tela de controle) → a lista diz que não há monitor livre; a prévia segue funcionando.
- EC-2: Tentar abrir uma segunda saída no mesmo monitor → a opção fica indisponível para esse monitor.
- EC-3: Monitor ligado com o programa já aberto → aparece na lista sem reiniciar o programa.
- EC-4: Monitores com resoluções diferentes → cada saída usa a tela inteira do seu monitor, com o texto na mesma proporção.

### US-016: Espelhar ou não cada saída

**As a** quem monta o estúdio, **I want** ligar o espelhamento em cada saída separadamente, **so that** dois TPs com montagens diferentes funcionem juntos.

Acceptance criteria:

- AC-1: Given uma saída aberta, when a pessoa liga "Espelhar", then aquela saída mostra a imagem invertida na horizontal e as outras não mudam.
- AC-2: Given uma saída nova, when ela abre, then começa sem espelhamento, salvo se aquele monitor já tinha espelhamento guardado neste computador.

Edge cases:

- EC-1: Trocar o espelhamento durante a rolagem → a rolagem continua sem salto.
- EC-2: Sinal de estado da voz numa saída espelhada → aparece espelhado junto, no canto correspondente.

### US-017: Ver o mesmo ponto do texto em todas as saídas

**As a** quem lê, **I want** que todas as telas de TP mostrem o mesmo ponto do texto, **so that** eu possa olhar para qualquer câmera sem me perder.

Acceptance criteria:

- AC-1: Given duas ou mais saídas abertas, when o texto rola por qualquer meio, then todas mostram a mesma linha na faixa de referência ao mesmo tempo, sem atraso visível entre elas e a prévia.
- AC-2: Given saídas com resoluções diferentes, when o texto é exibido, then as linhas se quebram nos mesmos pontos em todas.

Edge cases:

- EC-1: Computador modesto com voz ligada e duas saídas → a rolagem continua suave e sincronizada.
- EC-2: Uma saída arrastada ou com tela cheia perdida por engano → o programa devolve a saída à tela cheia no seu monitor.

### US-018: Continuar quando um monitor é desconectado

**As a** operador, **I want** que o programa siga funcionando se um monitor de TP for desconectado, **so that** a gravação nas outras telas não pare.

Acceptance criteria:

- AC-1: Given uma saída aberta, when o monitor dela é desconectado, then aquela saída fecha, as outras saídas e a prévia continuam no mesmo ponto e a tela de controle avisa qual saída caiu.
- AC-2: Given uma saída que caiu, when o mesmo monitor é ligado de novo, then a saída reabre sozinha nele, com o espelhamento que tinha, no ponto atual do texto, sem mostrar o número de identificação da saída.

Edge cases:

- EC-1: O monitor da tela de controle é desconectado → a tela de controle passa para um monitor sem saída. Se todos os monitores restantes têm saída, as saídas continuam mostrando o texto, os atalhos continuam funcionando e a tela de controle volta assim que houver um monitor livre (por exemplo, depois de fechar uma saída pelo atalho "Fechar a saída em foco"). Nenhuma saída fecha sozinha para dar lugar ao controle.
- EC-2: Monitor desconectado e religado várias vezes seguidas → reabre uma única saída a cada vez, sem duplicar.
- EC-3: Outro monitor é ligado no lugar → não abre saída sozinho; aparece na lista como livre.

### US-019: Fechar uma saída

**As a** quem monta o estúdio, **I want** fechar uma saída pela tela de controle, **so that** um monitor volte ao uso normal.

Acceptance criteria:

- AC-1: Given uma saída aberta, when a pessoa a fecha na tela de controle, then a janela some daquele monitor e as outras saídas continuam.
- AC-2: Given uma saída em tela cheia, when alguém aperta a tecla de sair da tela cheia (Esc) nela, then a saída não fecha nem sai da tela cheia; fechar é só pela tela de controle ou pelo atalho "Fechar a saída em foco" (padrão Ctrl+Shift+W no Windows, Cmd+Shift+W no Mac).

Edge cases:

- EC-1: Fechar todas as saídas durante a rolagem → a rolagem continua na prévia.
- EC-2: Fechar a tela de controle → o programa inteiro fecha, com o aviso de alterações não salvas quando houver.

### US-020: Reabrir as saídas ao abrir o programa

**As a** quem monta o estúdio, **I want** que o programa lembre as saídas deste computador, **so that** eu não precise configurar tudo a cada gravação.

Acceptance criteria:

- AC-1: Given saídas configuradas, when o programa é aberto de novo, then reabre uma saída em cada monitor que estiver ligado, com o espelhamento guardado.
- AC-2: Given um monitor guardado que não está ligado, when o programa abre, then aquela saída não abre e a tela de controle não mostra erro, só a lista atual.

Edge cases:

- EC-1: Primeira abertura → nenhuma saída abre sozinha; a tela de controle indica onde abrir uma.
- EC-2: Monitor guardado agora é o da tela de controle → a saída não abre ali.

## Rolagem manual

### US-021: Subir e descer o texto por botões

**As a** operador, **I want** botões de subir e descer, **so that** eu ajuste a posição do texto com precisão.

Acceptance criteria:

- AC-1: Given a tela de controle, when o operador clica em "Descer", then o texto avança uma linha nas saídas e na prévia; "Subir" volta uma linha.
- AC-2: Given o botão segurado, when o operador mantém o clique, then o texto se move de forma contínua até soltar.

Edge cases:

- EC-1: No início do texto, clicar "Subir" → nada acontece.
- EC-2: No fim do texto, clicar "Descer" → nada acontece.
- EC-3: Cliques muito rápidos seguidos → cada clique move uma linha, sem perder nem pular cliques.
- EC-4: Com a rolagem automática ligada → move a posição e a automática continua dali.

### US-022: Rolar o texto pela roda do mouse

**As a** operador, **I want** rolar o texto com a roda do mouse, **so that** eu corrija a posição sem procurar botões.

Acceptance criteria:

- AC-1: Given o ponteiro sobre a prévia, when o operador gira a roda, then o texto avança ou volta nas saídas e na prévia de forma suave.
- AC-2: Given o ponteiro sobre a caixa de edição, when o operador gira a roda, then só a caixa de edição rola; as saídas não mudam.

Edge cases:

- EC-1: Roda girada rápido → o texto acompanha sem trancos e para nos limites do início e do fim.
- EC-2: Trackpad com rolagem inercial → o texto para quando o movimento termina, sem continuar sozinho além disso.
- EC-3: Com a rolagem automática ou a voz ligada → move a posição e a automação continua dali.

### US-023: Controlar o TP por teclado, pedal ou passador

**As a** quem lê, **I want** controlar o TP por teclas, **so that** eu use pedal ou passador de slides mesmo sem operador.

Acceptance criteria:

- AC-1: Given o programa em foco (tela de controle ou qualquer saída), when uma tecla de atalho é apertada, then a ação correspondente acontece.
- AC-2: Given os atalhos padrão, when ninguém mudou nada, then valem: Espaço inicia ou pausa a rolagem automática; Seta para baixo e Page Down descem; Seta para cima e Page Up sobem; + e - mudam a velocidade; Home volta ao início; V liga ou desliga a voz; Ctrl+Shift+W (Cmd+Shift+W no Mac) fecha a saída em foco.
- AC-3: Given um pedal ou passador que imita teclas, when ele é acionado, then funciona como a tecla que imita.

Edge cases:

- EC-1: Cursor dentro da caixa de edição → as teclas digitam texto e não acionam atalhos, exceto atalhos com Ctrl ou Cmd. A tela de controle mostra um aviso visível de que os atalhos estão inativos enquanto o cursor está no editor, e Esc tira o cursor do editor, reativando os atalhos.
- EC-4: Operador sai deixando o cursor no editor e quem lê aciona o pedal → o pedal digita no editor, mas nada chega às saídas sem confirmação; o aviso de atalhos inativos fica visível para quem voltar à tela de controle.
- EC-2: Outro programa em foco → os atalhos não agem (o programa não captura teclas fora dele).
- EC-3: Tecla segurada → para subir e descer, move de forma contínua; para iniciar ou pausar e ligar ou desligar a voz, conta um só acionamento.

### US-024: Trocar os atalhos de teclado

**As a** quem monta o estúdio, **I want** trocar a tecla de cada ação, **so that** o pedal ou passador do estúdio funcione.

Acceptance criteria:

- AC-1: Given a tela de atalhos, when a pessoa escolhe uma ação e aperta uma tecla ou combinação, then essa passa a ser o atalho da ação.
- AC-2: Given atalhos alterados, when a pessoa aperta "Voltar ao padrão", then todos voltam aos atalhos padrão.

Edge cases:

- EC-1: Tecla já usada por outra ação → a tela avisa o conflito e pergunta se quer trocar; nunca ficam duas ações na mesma tecla.
- EC-2: Tecla reservada pelo sistema (por exemplo, Alt+F4 ou Cmd+Q) → não é aceita, com mensagem.
- EC-3: Ação sem atalho → permitido; a ação continua disponível pelo botão.
- EC-4: Gravar atalho e cancelar → nada muda.

### US-025: Voltar ao início do texto

**As a** operador, **I want** um botão para voltar ao início, **so that** eu recomece uma tomada na hora.

Acceptance criteria:

- AC-1: Given o texto em qualquer ponto, when o operador aperta "Voltar ao início", then a prévia e todas as saídas mostram a primeira linha na faixa de referência.
- AC-2: Given a rolagem automática ligada, when o operador volta ao início, then a automática pausa, para não começar a rolar antes da hora.
- AC-3: Given a voz ligada, when o operador volta ao início, then a voz continua ligada e passa a acompanhar a partir da primeira linha.

Edge cases:

- EC-1: Já no início → nada muda.
- EC-2: Apertar duas vezes seguidas → mesmo resultado de uma vez.
- EC-3: Com alterações pendentes de confirmação → volta ao início do texto confirmado.

## Rolagem automática

### US-026: Iniciar e pausar a rolagem automática

**As a** operador, **I want** iniciar e pausar a rolagem automática, **so that** o texto suba sozinho no ritmo de quem lê.

Acceptance criteria:

- AC-1: Given a rolagem parada, when o operador aperta "Iniciar", then o texto sobe de forma contínua e suave na velocidade escolhida, em todas as saídas e na prévia.
- AC-2: Given a rolagem ligada, when o operador aperta "Pausar", then o texto para na hora, no ponto em que estava.
- AC-3: Given a voz ligada, when o operador inicia a rolagem automática, then a voz desliga e a tela de controle mostra que a automática assumiu.

Edge cases:

- EC-1: O texto chega ao fim → a rolagem pausa sozinha com a última linha na faixa.
- EC-2: Iniciar sem texto confirmado → o botão fica indisponível.
- EC-3: Iniciar e pausar muito rápido várias vezes → cada acionamento alterna o estado, sem ficar preso.
- EC-4: O tempo de proteção de tela ou suspensão do sistema se esgota → enquanto houver alguma saída aberta, o programa impede a proteção de tela e a suspensão, com qualquer forma de rolagem (manual, automática ou voz).

### US-027: Ajustar a velocidade em passos de 0,25x

**As a** operador, **I want** escolher a velocidade em passos de 0,25x, **so that** eu acompanhe o ritmo de quem lê sem saltos bruscos.

Acceptance criteria:

- AC-1: Given a barra de velocidade, when o operador sobe ou desce um passo, then a velocidade muda em 0,25x, entre 0,25x e 3,00x, e o valor aparece na tela (por exemplo, "1,25x").
- AC-2: Given o programa aberto pela primeira vez, when nada foi mudado, then a velocidade é 1,00x.
- AC-3: Given a rolagem ligada, when a velocidade muda, then o texto passa à nova velocidade sem tranco.

Edge cases:

- EC-1: Já em 3,00x, subir → fica em 3,00x.
- EC-2: Já em 0,25x, descer → fica em 0,25x; parar é com "Pausar".
- EC-3: Mudar a velocidade com a rolagem pausada → a nova velocidade vale ao iniciar.
- EC-4: Muitos toques seguidos no atalho → cada toque conta um passo, até o limite.

## Voz

### US-028: Ligar e desligar a rolagem por voz

**As a** operador, **I want** ligar e desligar a rolagem por voz, **so that** eu use a voz quando ela ajudar e o manual quando não.

Acceptance criteria:

- AC-1: Given a voz desligada, when o operador a liga, then o estado passa a "Ouvindo" e o texto passa a acompanhar a fala a partir da faixa de referência.
- AC-2: Given a rolagem automática ligada, when o operador liga a voz, then a automática pausa e a tela mostra que a voz assumiu.
- AC-3: Given a voz ligada, when o operador a desliga, then o texto fica parado onde está.
- AC-4: Given a voz, when ela é ligada, then nada sai do computador: o áudio é processado só nele, sem internet.

Edge cases:

- EC-1: Nenhum microfone no computador → a voz não liga e a tela explica que falta um microfone.
- EC-2: Permissão de microfone negada (Mac ou Windows) → a voz não liga e a tela explica como dar a permissão.
- EC-3: Ligar sem texto confirmado → o botão fica indisponível.
- EC-4: Ligar e desligar várias vezes seguidas → o estado final é o do último toque, sem ficar preso em "carregando".
- EC-5: Primeira vez que liga, com o reconhecedor ainda carregando → estado "Preparando" até ficar pronto; o controle manual funciona enquanto isso.

### US-029: Escolher o microfone da voz

**As a** quem monta o estúdio, **I want** escolher qual entrada de áudio a voz escuta, **so that** ela use o microfone de quem lê e não o do computador.

Acceptance criteria:

- AC-1: Given a tela de voz, when a pessoa abre a lista, then vê as entradas de áudio do computador e escolhe uma, que fica guardada neste computador.
- AC-2: Given um microfone escolhido, when a pessoa fala, then a tela mostra um medidor de nível para conferir que o som chega.

Edge cases:

- EC-1: O microfone guardado não está ligado ao abrir o programa → a tela avisa e oferece escolher outro; a voz não liga sozinha noutro microfone.
- EC-2: Microfone trocado com a voz ligada → a voz passa a ouvir o novo sem precisar desligar.
- EC-3: Interface de áudio com várias entradas → cada entrada aparece na lista pelo nome que o sistema dá.

### US-030: Ter o texto acompanhando a leitura

**As a** quem lê, **I want** que o texto avance conforme eu leio, **so that** eu grave sem depender de um operador.

Acceptance criteria:

- AC-1: Given a voz ligada no modo "Perto", when quem lê fala o texto do roteiro, then o texto avança de modo que a linha lida fique na faixa de referência, de forma suave, sem saltos de linha em linha.
- AC-2: Given a voz ligada, when quem lê faz uma pausa, then o texto para e espera.
- AC-3: Given a voz ligada, when quem lê fala uma palavra igual ao texto da linha de baixo, then o texto avança só até ali, sem ir além da janela curta à frente.

Edge cases:

- EC-1: Quem lê pula um trecho maior que a janela curta → o texto espera; o operador ou quem lê leva o texto ao ponto certo e a voz volta a acompanhar dali (US-033).
- EC-2: Quem lê volta atrás para refazer uma frase → o texto não volta sozinho; voltar é manual.
- EC-3: Frase que aparece mais de uma vez no roteiro → o texto só considera a ocorrência dentro da janela curta à frente.
- EC-4: Ruído de set, outra pessoa falando ou música → o texto não avança enquanto o que se ouve não bater com o roteiro.
- EC-5: Números, siglas e nomes próprios lidos por extenso → o texto não trava; se não reconhecer, avança pelas palavras seguintes que reconhecer.
- EC-6: Fim do texto → o texto para com a última linha na faixa e a voz continua ligada, em "Esperando".

### US-031: Improvisar sem o texto andar

**As a** quem lê, **I want** que o texto espere quando eu falo algo fora do roteiro, **so that** eu possa improvisar e voltar ao texto.

Acceptance criteria:

- AC-1: Given a voz ligada, when quem lê fala algo que não está no roteiro, then o texto fica parado e o estado passa a "Esperando".
- AC-2: Given o estado "Esperando", when quem lê volta a falar o texto do ponto onde parou, then o estado volta a "Ouvindo" e o texto volta a acompanhar.

Edge cases:

- EC-1: Improviso longo (minutos) → o texto continua parado; nenhum alerta de falha aparece só por isso.
- EC-2: Improviso com palavras que existem no roteiro mais à frente → no modo "Perto", o texto não salta.

### US-032: Escolher o modo "Pulos para a frente"

**As a** operador, **I want** escolher um modo em que a voz acompanha pulos para a frente, **so that** quem corta trechos com frequência não precise de ajuda manual.

Acceptance criteria:

- AC-1: Given a tela de voz, when o operador escolhe entre "Perto" (padrão) e "Pulos para a frente", then o modo escolhido vale na hora e fica guardado neste computador.
- AC-2: Given o modo "Pulos para a frente", when quem lê fala com clareza uma frase que só aparece uma vez dali para a frente, then o texto salta até ela de forma suave.

Edge cases:

- EC-1: A frase falada aparece duas ou mais vezes adiante → o texto não salta e espera.
- EC-2: Reconhecimento incerto → o texto não salta.
- EC-3: Quem lê volta atrás → o texto não volta, como no modo "Perto".

### US-033: Mover o texto à mão com a voz ligada

**As a** operador, **I want** que botões, roda do mouse e teclado sempre funcionem com a voz ligada, **so that** eu corrija a posição sem desligar a voz.

Acceptance criteria:

- AC-1: Given a voz ligada, when qualquer comando manual move o texto, then o texto vai para onde o comando mandou, na hora.
- AC-2: Given um movimento manual, when ele termina, then a voz volta a acompanhar a partir da nova posição, sem devolver o texto ao ponto anterior.

Edge cases:

- EC-1: Comando manual ao mesmo tempo que a voz reconhece uma palavra → vale o comando manual.
- EC-2: Voltar ao início com a voz ligada → ver US-025 AC-3.
- EC-3: Mover o texto para um ponto que quem lê ainda não leu → a voz passa a procurar a partir desse ponto.

### US-034: Receber alerta forte quando a voz falha

**As a** operador, **I want** um alerta forte quando a voz para de funcionar, **so that** eu assuma o controle a tempo.

Acceptance criteria:

- AC-1: Given a voz ligada, when o microfone some ou o reconhecimento para, then o estado passa a "Falhou", a tela de controle mostra um alerta forte com o motivo e o texto fica parado onde estava, visível em todas as saídas.
- AC-2: Given o estado "Falhou", when o problema se resolve (por exemplo, o microfone volta), then a voz volta a "Ouvindo" sozinha e o alerta some.
- AC-3: Given o estado "Falhou", when o operador desliga a voz, then o alerta some e o controle manual segue normal.

Edge cases:

- EC-1: A falha acontece durante uma gravação → nenhuma saída apaga, pisca ou é coberta.
- EC-2: Falhas repetidas em sequência → um único alerta, atualizado, sem empilhar.
- EC-3: O computador fica lento demais para a voz → o alerta diz isso, e a rolagem manual continua suave.
- EC-4: Silêncio comum (ninguém fala) → é "Esperando", não "Falhou".

### US-035: Ver o estado da voz num sinal discreto no TP

**As a** quem lê, **I want** um sinal pequeno no canto do TP que mostre se a voz está acompanhando, **so that** eu saiba quando usar o pedal mesmo sozinho.

Acceptance criteria:

- AC-1: Given a voz ligada, when quem lê olha o TP, then vê num canto um sinal pequeno, só com forma e cor, diferente para "Ouvindo", "Esperando" e "Falhou".
- AC-2: Given a voz desligada, when quem lê olha o TP, then não há sinal.
- AC-3: Given a lista de saídas, when a pessoa desliga o sinal numa saída, then ele some só dela; o padrão é ligado em toda saída.

Edge cases:

- EC-1: Saída espelhada → o sinal aparece espelhado junto, no canto correspondente.
- EC-2: Sinal sobre o texto → fica num canto fora da área de margens, sem cobrir o texto.
- EC-3: Mudança rápida entre "Ouvindo" e "Esperando" → o sinal não pisca a cada palavra; muda só quando o estado se mantém por um instante.

## Ajustes e programa

### US-036: Manter os ajustes no computador e voltar ao padrão

**As a** quem monta o estúdio, **I want** que os ajustes fiquem guardados neste computador e possam voltar ao padrão, **so that** o estúdio esteja pronto a cada gravação.

Acceptance criteria:

- AC-1: Given ajustes de saídas, atalhos, microfone, modo da voz, velocidade e a última aparência usada, when o programa é fechado e aberto de novo, then os ajustes voltam como estavam.
- AC-2: Given ajustes alterados, when a pessoa aperta "Voltar ao padrão", then o programa pede confirmação e volta todos os ajustes ao padrão.
- AC-3: Given um roteiro novo, when ele é criado, then usa a última aparência usada neste computador.

Edge cases:

- EC-1: Arquivo de ajustes corrompido → o programa abre com o padrão e avisa uma vez.
- EC-2: Dois usuários do Windows no mesmo computador → cada um tem os seus ajustes.
- EC-3: Nada sai do computador: sem nuvem, sem login.

### US-037: Ver a versão do programa

**As a** operador, **I want** ver a versão do programa, **so that** eu saiba qual estou usando ao relatar um problema.

Acceptance criteria:

- AC-1: Given a tela de controle, when ela está aberta, then mostra a versão no formato `v1.0.0` num canto fixo e discreto.
- AC-2: Given uma nova versão instalada, when o programa abre, then a versão exibida é a nova.

Edge cases:

- EC-1: Saídas de TP → nunca mostram a versão.

### US-038: Ser avisado de versão nova

**As a** operador, **I want** saber quando há uma versão nova, **so that** eu atualize sem procurar.

Acceptance criteria:

- AC-1: Given internet disponível, when o programa abre e há uma versão publicada mais nova, then a tela de controle mostra um aviso com um botão que baixa e abre o instalador do sistema.
- AC-2: Given a versão em uso é a mais nova, when o programa abre, then nenhum aviso aparece.

Edge cases:

- EC-1: Sem internet ou GitHub fora do ar → nenhum aviso de erro; o programa funciona normalmente.
- EC-2: O operador fecha o aviso → o aviso volta só na próxima abertura do programa.
- EC-3: O aviso nunca aparece nas saídas de TP nem interrompe a rolagem.

### US-039: Instalar e abrir o programa pela primeira vez

**As a** quem monta o estúdio, **I want** instalar o programa no Windows ou no Mac e abri-lo pela primeira vez, **so that** o estúdio passe a usá-lo.

Acceptance criteria:

- AC-1: Given o instalador do Windows, when a pessoa o executa, then o programa é instalado com atalho no menu Iniciar e o ícone próprio do teleprompter.
- AC-2: Given o instalador do Mac, when a pessoa o abre, then o Como usar explica como liberar o programa sem assinatura na primeira abertura e como dar permissão ao microfone.
- AC-3: Given a primeira abertura, when a tela de controle aparece, then ela está no tema escuro da Chiaro e mostra onde colar o texto, abrir uma saída e ligar a voz.

Edge cases:

- EC-1: Windows avisa que o programa não é reconhecido → o Como usar mostra como seguir ("Mais informações", "Executar assim mesmo").
- EC-2: Computador sem internet → instala e funciona inteiro, inclusive a voz.
- EC-3: Instalar por cima de uma versão anterior → os ajustes e roteiros continuam.
