# Ideia #34: Teleprompter para uso interno

## Campos

- Número: 34
- Status: Na forja
- Setores: Produção, Técnica (Av)
- Frequência: Semanalmente
- Ferramentas: nenhuma
- Prioridade: 4,7 de 5 chamas (3 avaliações)
- Seguidores: 3
- Repositório: nenhum
- Slug: 034-teleprompter-para-uso-interno
- Criada em: 12/11/2026 16:49

### Descrição

> O software atual que utilizamos apresenta diversas limitações que dificultam o controle do TP, por isso seria interessante se desenvolvêssemos internamente um opção que nos atende melhor.
>
> A ferramenta possui uma tela onde tem uma barra de edição onde o texto completo é colocado, há opção de ajuste da fonte, cor, cor de fundo, cor da referência (que é uma marcação retangular na tela que mostra o texto atual), alterar o texto para tudo caixa alta, tudo caixa baixa ou normal, centralização do texto, tamanho da fonte e tipo de fonte.
>
> Na ferramenta atual, é possível modificar o texto colado depois de iniciar a utilização, porém ela possui um botão para validar a alteração do texto.
>
> Seria importante ter um botão para voltar ao início do texto.
> Para o controle de velocidade há 3 opções: um botão para subir e outro para descer, o scroll do mouse e uma barra de controle de velocidade que faz o texto subir automaticamente na velocidade escolhida, neste caso, é importante ter múltiplas opções de velocidade automática para escolha com uma escala de velocidade com opções que aumentam e diminuem 0,25x para cada graduação, não precisa ter uma velocidade muito alta, pois seria humanamente impossível.
>
> É importante que seja possível controlar a margem até onde o texto aparece no espelho, pois se o texto ficar muito "espalhado", fica perceptível na gravação do vídeo que ela está lendo um TP.
>
> Em algumas ocasiões, são utilizados dois aparelhos de TP ao mesmo tempo, porém que têm o funcionamento um pouco diferente, por exemplo, em um dos aparelho o texto não precisa estar espelhado, já no outro precisa. Por isso, seria interessante, ter a opção de múltiplas saídas para TP e poder escolher individualmente se a imagem será espelhada ou não.
>
> Se possível, existem softwares de TP onde ele consegue ouvir o que a pessoa está lendo e já rola o texto automaticamente. Se fosse possível ter essa opção de uso, seria bastante útil.

### Processo atual

> Hoje é utilizado um software que se chama "Operador Teleprompter Multilaudas 2010_B" da www.apotec.com.br que tem muitas limitações, como dessincronização entre o monitor de controle e o espelho que a pessoa lê o texto.

## Autores

- Autor: Felipio

## Comentários

### Zerati, 12/11/2026 16:57 [comentário 30]

> acho que essa parada de ir falando e ele identificar o que foi falado para ter um scroll dinâmico de acordo com o que foi falado é importantíssimo

#### Zerati, 12/11/2026 16:58 [comentário 31]

> inclusive, reduz a necessidade de equipe operando o teleprompter

### Charbas, 16/11/2026 10:32 [comentário 32]

> também podendo usar  o Teleprompter, para scripts de aulas, avisos tecnicos, avisos de horarios, perguntas, etc. Pode facilitar pessoas que usam scripts para fazer as suas aulas, também ajudando os mediadores e tecnica conversar entre si para avisos de problemas tecnicos, avisos em geral.
> https://www.instagram.com/reel/DesJ6gToUWT/?exln=MW0zeWd6MWV0OTFzNg==
> Esse link é uma referencia do que pensei, algo no estilo do kurama para facilitar a instalação e a conversa entre as pessoas, podendo renomear o usuario que vai estar utilizando no momento

## Histórico

- 12/11/2026 16:49: Felipio criou a ideia
- 24/11/2026 10:26: Zerati mudou o status de Em discussão para Na forja
- 24/11/2026 10:26: Zerati via Claude Code registrou um passo da forja: Projeto criado em \\nas-av01\docker\taskforge\forja\034-teleprompter-para-uso-interno
- 24/11/2026 10:26: Zerati via Claude Code registrou um passo da forja: Briefing em andamento: as perguntas chegam na aba Perguntas da forja.
- 24/11/2026 10:38: Zerati via Claude Code publicou o briefing
- 24/11/2026 10:39: Zerati via Claude Code registrou um passo da forja: Briefing publicado. Próximo: PRD.
- 24/11/2026 10:39: Zerati via Claude Code registrou um passo da forja: PRD em andamento.
- 24/11/2026 10:55: Zerati via Claude Code publicou o PRD
- 24/11/2026 10:55: Zerati via Claude Code registrou um passo da forja: PRD publicado. Próximo: TechSpec.
- 24/11/2026 10:55: Zerati via Claude Code registrou um passo da forja: TechSpec em andamento.
- 24/11/2026 11:16: Zerati via Claude Code publicou o TechSpec
- 24/11/2026 11:17: Zerati via Claude Code registrou um passo da forja: TechSpec publicada. Próximo: tarefas.

## Perguntas da forja

### pf_haluu4sjav: Como as telas de TP se ligam ao computador do operador? Isso define a base do programa: se todas as saídas ficam no mesmo computador, um único programa controla o texto e desenha cada saída a partir do mesmo estado de rolagem (o que acaba com a dessincronização entre o monitor de controle e o espelho que existe hoje). Se alguma saída fica noutro aparelho, vira sincronização pela rede, que é um produto bem maior.

- Destinatário: Felipio
- Status: respondida
- Modo: escolha única
- Opções:
  - a) Telas ligadas no mesmo computador (Recomendado): Cada aparelho de TP é um monitor ligado por cabo (HDMI ou adaptador) ao computador do operador. O programa abre uma janela em tela cheia em cada monitor escolhido, cada uma com o seu espelhar sim ou não, todas lendo a mesma rolagem. Mais simples e sem atraso entre controle e espelho.
  - b) Mesmo computador e também tablet ou celular pela rede: Como a primeira opção, mais uma saída que abre num tablet ou celular pela rede local (por exemplo, um TP de tablet). Exige sincronizar a rolagem pela rede, com algum risco de pequeno atraso nessa saída.
  - c) Mesmo computador e também saída NDI: Como a primeira opção, mais a imagem do TP enviada como fonte NDI, para outro computador ou para o vMix exibir ou retornar.
- Resposta de Zerati em 24/11/2026 10:29:
  - Selecionadas: Telas ligadas no mesmo computador

### pf_fup4otxnln: O Charbas sugeriu usar o TP também para avisos (problema técnico, horário, perguntas) e para conversa entre mediadores e técnica, com nome de quem está usando. O que disso entra na primeira versão?

- Destinatário: Felipio
- Status: respondida
- Modo: escolha única
- Opções:
  - a) Avisos rápidos do operador na tela do TP (Recomendado): No próprio programa, o operador manda um aviso que aparece numa faixa por cima do texto nas saídas de TP, por botões prontos de um toque (lista editável pela equipe) ou texto livre, e some quando ele tirar. Sem rede e sem outros usuários. Atende avisos técnicos e de horário com pouco custo.
  - b) Só o teleprompter: A primeira versão é só o TP (texto, rolagem, saídas, voz). Avisos e conversa ficam para uma ideia separada no Task Forge.
  - c) Avisos também de outros computadores: Como a primeira opção, mais outros computadores da rede local (mediadores, técnica) mandando avisos para a tela do TP, com o nome de quem enviou, que pode ser trocado. Exige parte de rede e um app para quem envia.
  - d) Conversa completa entre mediadores e técnica: Um canal de mensagens de ida e volta entre várias pessoas e o TP, com nomes de usuário. É quase um segundo produto e aumenta bastante o prazo.
- Resposta de Zerati em 24/11/2026 10:32:
  - Selecionadas: Só o teleprompter

### pf_2dsadhxgva: A rolagem por voz (o TP ouve quem lê e acompanha o texto sozinho) entra na primeira versão? Pesquisei: o reconhecimento de voz embutido do navegador não funciona dentro de um programa de desktop, então seria um reconhecedor que roda no próprio computador, sem internet e sem custo (há modelos em português, como o do Vosk). A precisão em português e com microfone de estúdio ainda precisa ser testada na prática.

- Destinatário: Felipio
- Status: respondida
- Modo: escolha única
- Opções:
  - a) Entra na primeira versão, com liga e desliga (Recomendado): A voz roda no próprio computador, só avança quando reconhece as palavras do roteiro, espera quando a pessoa improvisa e nunca bloqueia o controle manual: botões, roda do mouse e teclado sempre passam por cima. Se a voz falhar, o texto fica parado onde está e o operador recebe um alerta claro.
  - b) Fica para a segunda versão: A primeira versão sai mais cedo só com controle manual e rolagem automática por velocidade; a voz vem numa versão seguinte, já com o TP em uso pela equipe.
  - c) Entra, mas como teste opcional: A voz vem na primeira versão marcada como experimental e desligada por padrão, para a equipe avaliar a precisão antes de contar com ela nas gravações.
- Resposta de Zerati em 24/11/2026 10:34:
  - Selecionadas: Entra na primeira versão, com liga e desliga
  - Nota: lembrando que não necessariamente vai ser um computador forte que vai tá rodando o TP, então é melhor algo leve estilo parakeet para transcrição se for necessário

### pf_gqvbszif74: Posso fechar o briefing com este entendimento? Programa instalado para Windows e Mac (Electron, tema escuro da Chiaro, ícone próprio, versão visível). Uma tela de controle com o texto editável (alteração durante o uso aplicada com botão de confirmar), fonte, tamanho, cor do texto, do fundo e da faixa de referência, caixa alta, baixa ou normal, alinhamento e margens laterais. Várias saídas de TP em monitores ligados ao mesmo computador, cada uma com espelhar sim ou não, todas lendo a mesma rolagem do controle (sem dessincronizar). Rolagem por botões subir e descer, roda do mouse, teclado com atalhos trocáveis (serve também a pedais e passadores que imitam teclas) e velocidade automática em passos de 0,25x até um teto humano, mais botão de voltar ao início. Rolagem por voz no próprio computador, leve para máquina fraca (candidatos Vosk e Parakeet, escolhidos por teste na TechSpec), com liga e desliga e controle manual sempre por cima. Roteiros salvos e abertos como arquivo no computador, colar texto e importar .txt e .docx. Fora: avisos e conversa entre mediadores e técnica, saída por rede, tablet ou NDI, e dados na nuvem.

- Destinatário: Felipio
- Status: respondida
- Modo: escolha única
- Opções:
  - a) Pode fechar (Recomendado): O briefing sai com esse escopo e segue para o PRD.
  - b) Falta ou sobra algo: Use o campo Outro para dizer o que acrescentar, tirar ou mudar antes de fechar.
- Resposta de Zerati em 24/11/2026 10:37:
  - Selecionadas: Pode fechar

### pf_5yxfjesvak: Com a rolagem por voz ligada, o que o TP faz quando quem lê pula um trecho, volta atrás ou fala uma frase que aparece em dois lugares do roteiro? Na pesquisa, a queixa mais comum do PromptSmart (o TP com voz mais conhecido) é justamente o texto pular para a frente sozinho no meio da gravação.

- Destinatário: Felipio
- Status: respondida
- Modo: escolha única
- Opções:
  - a) Acompanha só um pouco à frente (Recomendado): A voz procura as palavras só nas próximas linhas a partir da faixa de referência. Se a pessoa pular um trecho grande ou voltar atrás, o texto espera, e quem opera (ou quem lê, pelo teclado ou pedal) leva o texto até o ponto certo; dali a voz volta a acompanhar. Mais estável: frase repetida noutro ponto do roteiro não causa salto.
  - b) Acompanha pulos para a frente: Como a primeira opção, mas se reconhecer com segurança uma frase mais adiante no roteiro, o texto salta até ela. Voltar atrás continua sendo manual. Ajuda quando quem lê corta trechos, com algum risco de salto errado em frases repetidas.
  - c) Acompanha pulos para a frente e para trás: A voz procura no roteiro todo e leva o texto para onde a pessoa estiver lendo, inclusive quando ela volta para refazer uma frase. É o mais automático e o mais sujeito a saltos errados.
- Resposta de Zerati em 24/11/2026 10:46:
  - Selecionadas: Acompanha só um pouco à frente
  - Nota: se tiver outra opção viável, podemos por como selecionável

### pf_35crram2d6: Anotado: a voz acompanha só um pouco à frente por padrão, e o modo que acompanha pulos para a frente fica como opção selecionável. Agora: com a voz ligada, às vezes quem lê vai estar sozinho, sem ninguém olhando a tela de controle. Onde aparece o estado da voz (ouvindo, esperando, falhou)?

- Destinatário: Felipio
- Status: respondida
- Modo: escolha única
- Opções:
  - a) Controle e um sinal discreto no TP (Recomendado): A tela de controle mostra o estado e um alerta forte quando a voz falha. As saídas de TP mostram também um sinal pequeno num canto (por exemplo, um ponto colorido), que quem lê percebe sem atrapalhar a leitura e que pode ser desligado em cada saída.
  - b) Só na tela de controle: O estado e o alerta aparecem só para quem opera. As saídas de TP mostram apenas o texto. Se quem lê estiver sozinho, só percebe a falha quando o texto parar.
  - c) Controle e aviso grande no TP só na falha: Em funcionamento normal o TP mostra só o texto. Quando a voz falha, aparece nas saídas um aviso bem visível por cima do texto, além do alerta na tela de controle.
- Resposta de Zerati em 24/11/2026 10:47:
  - Selecionadas: Controle e um sinal discreto no TP

### pf_qhriz7vqbp: Qual reconhecedor de voz o TP usa para acompanhar a leitura? Pesquisei os dois candidatos. Na nota do briefing o Parakeet aparece como a opção leve, mas pela pesquisa ele é o mais pesado: o modelo que entende português tem 600 milhões de parâmetros, ocupa cerca de 640 MB e trabalha em trechos de uns 2 segundos, não palavra a palavra. O Vosk pequeno em português ocupa 31 MB e devolve as palavras enquanto a pessoa fala. Ele erra mais em fala livre (cerca de 1 palavra em 3), mas aqui o TP só precisa reconhecer o texto do roteiro: o vocabulário fica restrito às palavras dele, e o texto avança pelas palavras que batem. Em qualquer opção, o reconhecedor fica atrás de uma peça trocável, e a primeira tarefa mede precisão e atraso com gravações reais da equipe. O modelo vai dentro do instalador, para a voz funcionar sem internet.

- Destinatário: Felipio
- Status: respondida
- Modo: escolha única
- Opções:
  - a) Vosk pequeno em português (Recomendado): Leve (31 MB no instalador), devolve palavras enquanto a pessoa fala, o que permite responder em menos de 1 segundo, e roda bem num computador modesto com duas saídas abertas. Roda dentro do próprio programa, sem peça separada para Windows e Mac. Precisão menor em fala livre, compensada por procurar só as palavras do roteiro.
  - b) Parakeet v3: Mais preciso em português, mas o instalador cresce uns 640 MB e o texto anda em trechos de cerca de 2 segundos, o que tende a passar do limite de 1 segundo e a pesar no processador de um computador modesto, com risco de trancos na rolagem.
  - c) Os dois, escolhível na tela de voz: Vosk como padrão e Parakeet como opção para computadores mais fortes. Instalador perto de 700 MB e o dobro de testes e ajustes. Dá para decidir depois, porque a peça é trocável.
- Resposta de Zerati em 24/11/2026 10:58:
  - Selecionadas: Os dois, escolhível na tela de voz

### pf_fa2hypqjcd: Anotado: Vosk como padrão e Parakeet escolhível na tela de voz. Agora uma dúvida do PRD que só quem conhece os aparelhos responde: alguma montagem de TP da equipe precisa de inversão vertical (texto de cabeça para baixo no monitor), além da horizontal? Isso depende de como o monitor fica preso sob o vidro. Se sim, cada saída ganha a opção "Inverter vertical", independente do "Espelhar".

- Destinatário: Felipio
- Status: respondida
- Modo: escolha única
- Opções:
  - a) Incluir as duas inversões por saída (Recomendado): Cada saída tem "Espelhar" (horizontal) e "Inverter vertical", ligados e desligados separadamente e guardados por monitor. Custa pouco e cobre qualquer montagem, inclusive aparelhos que a equipe venha a comprar.
  - b) Só o espelhamento horizontal: Como está no PRD: cada saída tem só "Espelhar". Tela de saídas mais simples; se um aparelho novo pedir inversão vertical, entra numa versão seguinte.
- Resposta de Zerati em 24/11/2026 10:59:
  - Selecionadas: Incluir as duas inversões por saída
  - Nota: qualquer coisa depois de teste a gente tira e deixa só um
