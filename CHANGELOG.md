# Changelog

Todas as versões do Teleprompter, com o que muda para quem usa.
A versão segue o padrão MAJOR.MINOR.PATCH e mora só no `version` do `package.json`.

## 1.1.0 (2026-11-27)

Correções e ajustes pedidos depois do uso no estúdio.

- Rolagem por voz: a faixa agora fica no que você está lendo. Antes o texto só subia depois que você já estava na linha de baixo, e parecia sempre atrasado, mesmo abaixando a faixa. Agora a linha sobe conforme você a lê, e ao terminar a linha a seguinte já está na faixa.
- Roda do mouse sobre a prévia: com a rolagem automática ligada, ela muda a velocidade (para baixo, mais rápido; para cima, mais devagar; 0,25x por clique). Com a automática parada ou com a voz, continua movendo o texto.
- Tamanho do texto vai até 300 (antes, 200).
- Windows: a barra de tarefas não deve mais aparecer por cima da saída de TP no monitor do TP (o caso visto no TP USB da Elgato), mesmo com o foco na tela de controle.

## 1.0.0 (2026-11-25)

Primeira versão do Teleprompter da Chiaro Filmes, para Windows e Mac.

- O programa abre na tela de controle, no tema escuro da Chiaro, com a versão no canto inferior direito.
- Na tela de controle você cola ou importa o roteiro (`.txt` e `.docx`), confirma as alterações e vê a prévia com a faixa de leitura.
- Dá para escolher a fonte, o tamanho, as cores do texto, do fundo e da faixa, a caixa, o alinhamento, as margens e a posição da faixa.
- Os roteiros são salvos e abertos como arquivos `.roteiro`, e o programa avisa antes de perder alterações não salvas.
- Na aba Saídas você abre uma saída de TP em tela cheia em cada monitor, vê o número de cada uma por alguns segundos e liga, em cada saída, "Espelhar", "Inverter vertical" e o sinal de voz. O programa lembra as saídas deste computador e as reabre ao abrir.
- Se um monitor de TP for desligado, as outras saídas continuam e a tela de controle avisa qual saída caiu. Quando o monitor volta, a saída reabre sozinha, com as inversões que tinha.
- Com alguma saída aberta, o computador não apaga a tela nem entra em suspensão.
- Os atalhos de teclado funcionam com qualquer janela do programa em foco, inclusive com pedais e passadores, e podem ser trocados na aba Atalhos. Com o cursor no editor, os atalhos ficam inativos e a tela avisa; Esc sai do editor.
- A rolagem por voz liga pelo botão Voz ou pela tecla V: o texto acompanha a leitura, espera quando você improvisa ou faz uma pausa e nunca volta sozinho. Ligar a voz pausa a rolagem automática, e iniciar a automática desliga a voz. Os botões, as teclas e o pedal valem sempre por cima, e a voz continua dali.
- Na aba Voz você escolhe o microfone (inclusive cada entrada de uma interface de áudio), confere o nível num medidor, escolhe o motor (Vosk ou Parakeet, onde ele roda) e o modo ("Perto" ou "Pulos para a frente"). Tudo fica guardado neste computador.
- O estado da voz aparece ao lado das ações, com texto e cor: Preparando, Ouvindo, Esperando ou Falhou. Se o microfone cair, o reconhecimento parar ou o computador não der conta, uma faixa vermelha diz o motivo, o texto fica parado e visível nas saídas, e a voz volta sozinha quando o problema se resolve.
- Fechar a tela de controle fecha o programa e todas as saídas, perguntando antes se há alterações não salvas.
- Quando sai uma versão nova, a tela de controle avisa ao abrir, com "Baixar e instalar" (baixa o instalador para a pasta Downloads, mostra o andamento e o abre) e "Fechar" (o aviso volta só na próxima abertura). Sem internet, nada aparece e o programa funciona igual. As saídas nunca mostram o aviso.
- A aba Sobre mostra a versão, o motor de voz em uso, o atraso médio da voz e o botão "Abrir pasta de registros", para relatar problemas.
- "Voltar ao padrão", na aba Sobre, pede confirmação e devolve velocidade 1,00x, voz no modo "Perto" com o Vosk, atalhos padrão e saídas sem inversão.
- Tem ícone próprio de teleprompter no menu Iniciar, no Dock e nos arquivos de roteiro (`.roteiro`).
- Instala no Windows com um instalador próprio e no Mac com uma imagem de disco para Intel e Apple Silicon.
- Funciona sem internet: as fontes da Chiaro vão junto com o programa.
