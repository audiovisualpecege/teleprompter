# PRD: Teleprompter para uso interno (ideia #34)

## Visão geral

A Produção e a Técnica (Av) da Chiaro Filmes usam toda semana o "Operador Teleprompter Multilaudas 2010_B", da Apotec. A falha mais grave dele é a dessincronia entre o monitor de controle e o espelho de onde a pessoa lê. Ele também não atende bem às gravações com dois aparelhos de TP ao mesmo tempo, quando um precisa de imagem espelhada e o outro não. E não acompanha a voz de quem lê, o que obriga a ter alguém operando o TP o tempo todo.

Este produto é um programa de teleprompter instalado no Windows e no Mac. Um único computador controla o texto e desenha a prévia e todas as saídas de TP a partir da mesma posição de rolagem. O texto pode ser rolado à mão, por velocidade automática ou pela voz de quem lê, reconhecida no próprio computador, sem internet.

Ele serve ao operador de TP, a quem lê (apresentador, professor, mediador), a quem prepara o roteiro e a quem monta o estúdio. A tela de controle precisa ser simples para qualquer pessoa da empresa, não só para a Técnica.

O projeto parte do zero: o repositório tem só o design system da Chiaro (`design-system/chiaro/`), que é a base de toda a interface.

## Objetivos

- Prévia e saídas de TP mostram sempre o mesmo ponto do texto, ao mesmo tempo. A dessincronia de hoje deixa de existir.
- Duas ou mais telas de TP funcionam na mesma gravação, cada uma com o seu espelhamento.
- Quem lê consegue gravar sozinho: a voz acompanha a leitura, e pedal, passador ou teclado corrigem a posição quando preciso.
- Quem lê sabe, por um sinal discreto no TP, se a voz está acompanhando. Quem opera recebe um alerta forte quando ela falha, e o texto nunca some da tela.
- O operador corrige o texto no meio da gravação sem que quem lê veja a edição acontecendo: a correção só chega às saídas quando ele confirma.
- O operador limita a largura do texto no TP, para que o movimento dos olhos de quem lê não apareça na gravação.
- O roteiro e a sua aparência são salvos num arquivo e reabertos prontos para gravar. Os ajustes do estúdio ficam guardados no computador.
- Nada sai do computador: sem nuvem, sem login, sem serviço cobrado. A voz funciona sem internet.

## Histórias de usuário

Catálogo completo: [Histórias de usuário](_user_stories.md)

- US-001 a US-007: roteiro (colar, importar `.txt` e `.docx`, salvar, abrir, editar durante o uso com confirmação, alterações não salvas).
- US-008 a US-014: aparência (fonte, cores, caixa, alinhamento, margens laterais, posição da faixa de referência, prévia sincronizada).
- US-015 a US-020: saídas de TP (abrir por monitor, espelhar, sincronia, monitor desconectado, fechar, reabrir ao abrir o programa).
- US-021 a US-025: rolagem manual (botões, roda do mouse, teclado com pedal e passador, atalhos trocáveis, voltar ao início).
- US-026 a US-027: rolagem automática (iniciar e pausar, velocidade em passos de 0,25x).
- US-028 a US-035: voz (liga e desliga, microfone, acompanhar a leitura, improviso, modo "Pulos para a frente", manual por cima, alerta de falha, sinal discreto no TP).
- US-036 a US-039: ajustes e programa (ajustes no computador, versão, aviso de versão nova, instalação e primeira abertura).

## Funcionalidades principais

### 1. Roteiro

O roteiro é o texto que vai para o TP. Ele entra por três caminhos: colar na caixa de edição, importar um `.txt` ou importar um `.docx`. Entra sempre como texto puro, com os parágrafos preservados. Formatação, imagens e tabelas ficam de fora, e a tela avisa quando algo foi ignorado.

- O roteiro é salvo num arquivo no computador, que guarda o texto e os ajustes de aparência. Abrir o arquivo devolve os dois.
- "Salvar", "Salvar como", "Abrir" e "Novo" funcionam como num editor comum, com aviso antes de perder alterações não salvas.
- Durante o uso, a caixa de edição é um rascunho. O texto editado só chega às saídas quando o operador aperta "Confirmar alterações". Até lá, as saídas mostram o texto confirmado anterior. "Descartar" volta o rascunho ao texto confirmado.
- Ao confirmar, o trecho que estava na faixa de referência continua na faixa.

### 2. Aparência

A aparência vale para a prévia e para todas as saídas ao mesmo tempo. Muda na hora, sem tirar o trecho atual da faixa de referência.

- **Fonte:** qualquer fonte instalada no computador e tamanho de 20 a 200.
- **Cores:** do texto, do fundo e da faixa de referência.
- **Caixa:** alta, baixa ou normal, só na exibição.
- **Alinhamento:** centralizado ou à esquerda.
- **Margens laterais:** em porcentagem da largura, com linhas-guia na prévia.
- **Faixa de referência:** posição vertical ajustável.

A tela de controle tem uma prévia que mostra, sem espelhamento, exatamente o que as saídas mostram.

### 3. Saídas de TP

Cada saída é uma janela em tela cheia num monitor ligado ao computador (ADR-001). Quem monta o estúdio escolhe o monitor numa lista com nome e resolução, e liga ou desliga o espelhamento horizontal de cada saída separadamente.

- As saídas mostram o mesmo ponto do texto que a prévia, com as mesmas quebras de linha, mesmo em resoluções diferentes.
- Se um monitor for desconectado, a saída dele fecha e o resto segue. Quando o monitor volta, a saída reabre sozinha.
- O programa lembra as saídas deste computador e as reabre ao abrir.

### 4. Rolagem manual

- **Botões:** "Subir" e "Descer" movem uma linha por clique e de forma contínua quando segurados.
- **Roda do mouse:** sobre a prévia, rola o texto de forma suave.
- **Teclado:** atalhos com combinação sugerida, que quem usa pode trocar. Pedais e passadores que imitam teclas funcionam como teclado.
- **Voltar ao início:** leva a primeira linha à faixa de referência.

O controle manual age na hora, com qualquer automação ligada ou não (ADR-005).

### 5. Rolagem automática

O texto sobe de forma contínua na velocidade escolhida, de 0,25x a 3,00x, em passos de 0,25x. Liga e pausa por botão ou atalho.

### 6. Rolagem por voz

O programa ouve o microfone escolhido e faz o texto acompanhar a leitura. O reconhecimento roda no próprio computador, sem internet e sem custo, e precisa ser leve para computadores modestos (ADR-003).

- **Modo "Perto" (padrão):** a voz procura as palavras numa janela curta logo depois da faixa de referência. Pulos grandes e voltas ficam com o controle manual.
- **Modo "Pulos para a frente" (selecionável):** além disso, salta para uma frase reconhecida com segurança mais adiante, desde que ela só apareça uma vez dali para a frente.
- **Improviso, pausa ou ruído:** o texto espera.
- **Estados:** a tela de controle mostra sempre o estado da voz. Na falha, mostra um alerta forte. Cada saída mostra um sinal discreto de estado num canto, que pode ser desligado por saída (ADR-004).

### 7. Ajustes e programa

- **Ajustes guardados no computador:** saídas, atalhos, microfone, modo da voz, velocidade e última aparência usada ficam só neste computador. Um botão volta tudo ao padrão.
- **Versão:** aparece como `v1.0.0` num canto fixo da tela de controle.
- **Atualização:** ao abrir, o programa verifica se há versão publicada mais nova e oferece o instalador.

### Interação entre funcionalidades

- **Uma só posição:** as rolagens manual, automática e por voz movem a mesma posição de rolagem, que a prévia e todas as saídas desenham.
- **Uma automação por vez:** ligar a voz pausa a rolagem automática, e iniciar a automática desliga a voz.
- **Edição e confirmação:** editar o roteiro não move as saídas. Confirmar troca o texto e mantém a posição.
- **Aparência e quebras de linha:** a aparência muda as quebras de linha em todas as telas juntas, sem tirar o trecho atual da faixa.

## Regras de negócio

### Invariantes

- **Uma posição, um texto:** existe uma única posição de rolagem e um único texto confirmado por programa aberto. Prévia e saídas nunca mostram pontos diferentes do texto.
- **Mesmas quebras de linha:** prévia e saídas quebram as linhas nos mesmos pontos, em qualquer resolução. Fonte, margens e faixa são proporções da tela, não pixels fixos.
- **Faixa estável:** mudanças de aparência ou confirmação de texto mantêm na faixa de referência o trecho que estava nela. Se esse trecho foi apagado, a faixa fica no ponto mais próximo.
- **Voz nunca volta o texto:** a voz nunca move o texto para trás. Voltar é sempre manual.
- **Manual por cima:** o controle manual sempre funciona e sempre vence a automação ativa no mesmo instante.
- **Uma automação por vez:** só uma automação de rolagem fica ativa: a automática ou a voz.
- **Nunca apagar a tela:** nenhuma falha apaga, pisca ou cobre o texto das saídas. Em falha da voz, o texto fica parado onde está.
- **Sem proteção de tela:** enquanto houver alguma saída aberta, o programa impede a proteção de tela e a suspensão do computador, com qualquer forma de rolagem, inclusive a voz sem ninguém tocar no teclado.
- **Saída não cede lugar:** nenhuma saída fecha sozinha. Se o monitor da tela de controle cair e não houver monitor livre, as saídas seguem mostrando o texto, os atalhos seguem funcionando e a tela de controle volta quando houver um monitor livre.
- **Nada sai do computador:** o áudio é processado só no computador, e nenhum texto, áudio ou ajuste vai para a internet. A única consulta à internet é a de versão nova.

### Validações

- **Texto vazio:** texto vazio ou só com espaços não pode ser confirmado; o botão fica indisponível.
- **Valores fora da faixa:** valores numéricos fora da faixa voltam ao limite mais próximo.
- **Arquivo ilegível:** arquivo ilegível, vazio, corrompido ou de formato não aceito gera mensagem com o motivo, e o roteiro atual continua intacto.
- **Contraste baixo:** texto e fundo com contraste muito baixo geram um aviso, sem impedir.
- **Atalhos:**
  - nunca há duas ações na mesma tecla: um conflito pergunta antes de trocar;
  - teclas reservadas do sistema não são aceitas.
- **Microfone indisponível:** microfone ausente, sem permissão ou desconectado impede ligar a voz, com mensagem que diz o que fazer.

### Estados

- **Rolagem automática:** parada ou rolando. Pausa sozinha no fim do texto e ao voltar ao início.
- **Voz:**

  | Estado | Quando |
  |---|---|
  | Desligada | Estado inicial, ou depois que o operador desliga. |
  | Preparando | Depois de ligar, até o reconhecedor ficar pronto. |
  | Ouvindo | Reconhecendo o texto do roteiro. |
  | Esperando | Silêncio, improviso, ruído ou fim do texto. |
  | Falhou | Microfone sumiu, o reconhecimento parou ou o computador não dá conta. |

  "Falhou" volta sozinho para "Ouvindo" quando a causa se resolve, ou vai para "Desligada" quando o operador desliga. Silêncio é sempre "Esperando", nunca "Falhou".
- **Saída:**

  | Estado | Quando |
  |---|---|
  | Aberta | Em tela cheia no monitor escolhido. |
  | Caída | O monitor foi desconectado; reabre sozinha quando ele volta. |
  | Fechada | Fechada pela tela de controle. |

- **Roteiro:** sem alterações, alterações não salvas, ou alterações pendentes de confirmação. As duas últimas podem coexistir.

### Valores e padrões

| Ajuste | Faixa | Padrão |
|---|---|---|
| Velocidade automática | 0,25x a 3,00x, passos de 0,25x (12 graus), exibida com vírgula ("1,25x") | 1,00x, um ritmo de fala comum, calibrado na TechSpec |
| Tamanho da fonte | 20 a 200, medido numa saída de 1080 linhas de altura e proporcional nas demais | 80 |
| Margem lateral | 0% a 40% da largura, de cada lado | 10% |
| Posição da faixa de referência | 10% a 60% da altura, a partir do topo | um terço (33%) |

- **Cores padrão:** texto branco e fundo preto. A faixa de referência é translúcida e não esconde o texto.
- **Fonte padrão:** a fonte de texto do design system da Chiaro.
- **Caixa e alinhamento padrão:** caixa normal e texto centralizado.
- **Espelhamento:** começa desligado em cada saída nova, a não ser que aquele monitor já tenha um espelhamento guardado.
- **Sinal de estado da voz:** ligado em toda saída.
- **Modo da voz padrão:** "Perto".
- **Atalhos padrão:**

  | Ação | Teclas |
  |---|---|
  | Iniciar ou pausar a rolagem automática | Espaço |
  | Descer | Seta para baixo ou Page Down |
  | Subir | Seta para cima ou Page Up |
  | Mais velocidade | + |
  | Menos velocidade | - |
  | Voltar ao início | Home |
  | Ligar ou desligar a voz | V |
  | Fechar a saída em foco | Ctrl+Shift+W (Cmd+Shift+W no Mac) |

  Os atalhos agem com qualquer janela do programa em foco, exceto quando o cursor está na caixa de edição, onde valem só combinações com Ctrl ou Cmd. Nesse caso, a tela de controle mostra um aviso visível de que os atalhos estão inativos, e Esc tira o cursor do editor. Esc numa saída não a fecha nem a tira da tela cheia.

### Visibilidade

- **Saídas de TP:** mostram só o texto, a faixa de referência e, com a voz ligada, o sinal de estado. Nunca mostram versão, avisos de atualização, alertas ou controles.
- **Única exceção:** o número de identificação da saída aparece por alguns segundos quando ela é aberta pela tela de controle. Esse número não reaparece quando a saída reabre sozinha depois de o monitor voltar, porque isso pode acontecer no meio de uma gravação.
- **Tela de controle:** mostra prévia, controles, estado da voz, alertas, avisos de saída caída, versão e aviso de versão nova.
- **Permissões:** não há perfis nem login. Quem está no computador usa tudo.

## Experiência de uso

### Personas

- **Operador:** conduz a gravação na tela de controle e quer controle imediato e alertas claros.
- **Quem lê:** lê no vidro, às vezes sozinho, com pedal ou passador. Quer texto estável e saber se a voz está acompanhando.
- **Quem prepara o roteiro:** cola ou importa o texto, ajusta a aparência e salva.
- **Quem monta o estúdio:** instala o programa, liga os monitores e escolhe saídas, espelhamento, microfone e atalhos.

### Fluxos principais

1. **Preparar:**
   1. Quem prepara o roteiro abre o programa, cola ou importa o texto e confirma.
   2. Ajusta fonte, cores, caixa, alinhamento e margens olhando a prévia.
   3. Salva o roteiro num arquivo.
2. **Montar o estúdio:**
   1. Quem monta o estúdio liga os monitores de TP e abre uma saída em cada um.
   2. Identifica cada saída pelo número que aparece na tela e liga o espelhamento onde o vidro pede.
   3. Escolhe o microfone e confere o medidor de nível.
   4. Se precisar, troca os atalhos para o pedal ou passador.
3. **Gravar com operador:** o operador abre o roteiro, volta ao início e grava de um destes jeitos:
   - inicia a rolagem automática e ajusta a velocidade em passos de 0,25x;
   - corrige a posição pela roda do mouse ou pelos botões;
   - corrige um erro no texto e confirma, sem que o texto salte.
4. **Gravar sozinho com voz:**
   1. Quem lê (ou o operador antes de sair) liga a voz.
   2. Quem lê fala o texto e ele acompanha. No improviso, o texto espera.
   3. Se pular um trecho, quem lê usa o pedal para levar o texto ao ponto certo, e a voz retoma dali.
   4. O sinal no canto do TP mostra se a voz está ouvindo, esperando ou falhou.
5. **Recomeçar uma tomada:** "Voltar ao início" (Home). A rolagem automática pausa; a voz, se ligada, acompanha do início.

### Interface

- **Design system da Chiaro:** toda a interface do programa usa o tema escuro Noite, sem tema claro nem alternância. Usa os componentes, tokens, fontes e ícones de `design-system/chiaro/`, inclusive em diálogos, menus, campos, dicas e barras de rolagem.
- **Saídas de TP:** a área de texto usa as cores escolhidas pela pessoa, não as do design system, porque é conteúdo de leitura no vidro. O padrão é texto branco em fundo preto.
- **Tela de controle:**
  - simples para quem não é da Técnica;
  - as ações de gravação (iniciar ou pausar, velocidade, voltar ao início, voz) ficam sempre visíveis e grandes;
  - ajustes de estúdio (saídas, microfone, atalhos) ficam numa área separada;
  - a prévia fica em destaque;
  - o estado da voz e os alertas aparecem num lugar fixo, com cor e texto, não só cor.
- **Ícone:** o produto tem ícone próprio, desenhado para ele, que mostra um teleprompter. Não é o ícone nem o logo da Chiaro. O logo da Chiaro aparece só como assinatura ("um produto Chiaro Filmes"), por exemplo na tela Sobre.
- **Versão:** `v1.0.0` num canto discreto e fixo da tela de controle, lida do arquivo de versão do projeto.

### Primeira abertura e descoberta

- **Tela de controle vazia:** indica três passos: colar ou importar o texto, abrir uma saída e, se quiser, ligar a voz.
- **Atalhos:** cada botão mostra o seu atalho na dica.
- **Como usar:** explica a instalação, a liberação do programa sem assinatura no Windows e no Mac, a permissão de microfone no Mac e o uso de pedais e passadores.

## Limites técnicos de alto nível

- **Plataformas:** Windows e Mac, com instalador próprio em cada um.
- **Distribuição:** os instaladores saem nas Releases de um repositório público em `github.com/audiovisualpecege/` e são listados em `_instaladores.txt`. O aviso de versão nova consulta esse repositório.
- **Sem internet:**
  - o programa funciona inteiro sem internet, inclusive a voz;
  - o reconhecimento de voz roda no computador, sem serviço externo nem cobrança por uso;
  - o reconhecimento de voz embutido do navegador não serve: costuma falhar dentro de programas de desktop.
- **Computador modesto:** o TP pode rodar num computador comum. Com a voz ligada e duas saídas abertas, a rolagem continua suave, sem trancos visíveis.
- **Sincronia:** prévia e saídas mostram o mesmo ponto ao mesmo tempo, sem diferença visível a olho nu. Nenhuma diferença se acumula com horas de uso.
- **Resposta da voz:** o texto começa a acompanhar a fala em menos de um segundo depois de a palavra ser dita. O valor exato é medido na TechSpec.
- **Privacidade:** áudio, roteiros e ajustes ficam só no computador. Sem nuvem, login nem telemetria.
- **Versão:** semântica, num único arquivo de projeto. A primeira entrega é 1.0.0, com `CHANGELOG.md`.

## Fora de escopo

- **Avisos e conversa:** avisos rápidos na tela do TP e conversa entre mediadores, técnica e quem lê, com nomes de usuário. É a sugestão do Charbas, que pode virar ideia separada (ADR-002).
- **Saídas por rede:** saída de TP por rede para tablet ou celular, ou como fonte NDI (ADR-001).
- **Nuvem:** dados na nuvem, login e sincronização de roteiros entre computadores.
- **Voz pela internet:** reconhecimento de voz por serviço na internet ou cobrado por uso.
- **Controle remoto próprio:** app de celular ou controle pela rede. Pedais e passadores entram só como teclado.
- **Voz para trás:** a voz não move o texto para trás em nenhum modo (ADR-003).
- **Voz somada à automática:** voz e velocidade automática não funcionam ao mesmo tempo (ADR-005).
- **Formatação no TP:** formatação de texto no TP (negrito, cores por palavra), marcadores de trecho, contagem regressiva e cronômetro. Ninguém pediu.
- **Ajustes por saída:** aparência diferente por saída. A aparência é uma só; por saída há só monitor, espelhamento e sinal de voz.

## Registros de decisão (ADRs)

- [ADR-001: Um computador, uma rolagem, várias saídas locais](adrs/adr-001.md): todas as saídas em monitores do mesmo computador, desenhadas da mesma posição de rolagem, com espelhamento por saída.
- [ADR-002: A primeira versão é só o teleprompter](adrs/adr-002.md): avisos e conversa entre pessoas ficam fora.
- [ADR-003: A voz acompanha só um pouco à frente, com modo de pulos para a frente selecionável](adrs/adr-003.md): modo "Perto" padrão, "Pulos para a frente" opcional, nunca para trás.
- [ADR-004: Estado da voz na tela de controle e num sinal discreto nas saídas](adrs/adr-004.md): alerta forte no controle e sinal desligável por saída.
- [ADR-005: Uma automação de rolagem por vez, controle manual sempre por cima](adrs/adr-005.md): voz e automática exclusivas; velocidade de 0,25x a 3,00x.

## Preferências aplicadas

- [2026-10-13 · #28] No Windows, o produto é um programa instalado de verdade, com instalador próprio.
- [2026-10-13 · #24] Programas de desktop saem para Windows e Mac.
- [2026-10-13 · #24] Instaladores de uso interno vão sem assinatura de código, e o Como usar explica como liberar o programa na primeira abertura.
- [2026-10-13 · #24] App de desktop é feito com Electron, React e TypeScript, com os componentes e tokens do design system da Chiaro. Essa escolha fica registrada para a TechSpec.
- [2026-10-16 · #31] Instaladores e versões novas saem por Releases de um repositório público no GitHub (`audiovisualpecege`). O aviso de versão nova com botão que abre o instalador (#24) continua.
- [2026-10-13 · #24] Toda automação tem liga e desliga: rolagem automática e voz.
- [2026-10-16 · #31] Quando o produto age sozinho, começa ligado para tudo e quem usa marca as exceções: o sinal de estado da voz começa ligado em toda saída.
- [2026-10-16 · #26] O produto continua usável à mão quando a parte inteligente falha.
- [2026-10-20 · #18] Quando uma automação falha ao vivo, a imagem segue na tela e quem opera recebe um alerta forte. O produto não congela nem tira a tela sozinho.
- [2026-10-20 · #18] Mídia da empresa é processada no próprio computador: o áudio de quem lê.
- [2026-10-13 · #28] Nada de serviço cobrado por uso.
- [2026-10-16 · #31] Configurações ficam só no aparelho onde foram feitas.
- [2026-10-16 · #31] Ajustes de quem usa são poucos e globais, com um botão de voltar ao padrão: a aparência é uma só para todas as saídas.
- [2026-10-16 · #31] Ações usadas várias vezes ao dia ganham atalho de teclado, com combinação sugerida que quem usa pode trocar.
- [2026-10-13 · #28] Produtos são desenhados para qualquer pessoa da empresa: a tela de controle precisa ser simples para quem não é da Técnica.

## Questões em aberto

- **Calibração do 1,00x:** quantas palavras ou linhas por minuto correspondem ao 1,00x da velocidade automática. Calibrar na TechSpec com leituras reais (a referência de fala é de 125 a 150 palavras por minuto).
- **Janela curta da voz:** o tamanho da janela curta do modo "Perto" e o critério de "reconhecer com segurança" do modo "Pulos para a frente". Calibrar na TechSpec com gravações reais.
- **Reconhecedor de voz:** Vosk (modelo pequeno em português) ou Parakeet, escolhido por teste de precisão e leveza na TechSpec. Falta confirmar se há Parakeet em português leve para um computador comum.
- **Espelho vertical:** alguma montagem de TP da equipe precisa de inversão vertical, além da horizontal? Se sim, entra como opção por saída.
- **Roda do mouse com a automática ligada:** a roda move a posição, como definido aqui. Confirmar no uso se a equipe prefere que ela mude a velocidade, como em alguns programas.
