# Changelog

Todas as versões do Teleprompter, com o que muda para quem usa.
A versão segue o padrão MAJOR.MINOR.PATCH e mora só no `version` do `package.json`.

## 1.0.0 (2026-11-24)

Primeira versão do Teleprompter da Chiaro Filmes, para Windows e Mac.

- O programa abre na tela de controle, no tema escuro da Chiaro, com a versão no canto inferior direito.
- Na tela de controle você cola ou importa o roteiro (`.txt` e `.docx`), confirma as alterações e vê a prévia com a faixa de leitura.
- Dá para escolher a fonte, o tamanho, as cores do texto, do fundo e da faixa, a caixa, o alinhamento, as margens e a posição da faixa.
- Os roteiros são salvos e abertos como arquivos `.roteiro`, e o programa avisa antes de perder alterações não salvas.
- Na aba Saídas você abre uma saída de TP em tela cheia em cada monitor, vê o número de cada uma por alguns segundos e liga, em cada saída, "Espelhar", "Inverter vertical" e o sinal de voz. O programa lembra as saídas deste computador e as reabre ao abrir.
- Se um monitor de TP for desligado, as outras saídas continuam e a tela de controle avisa qual saída caiu. Quando o monitor volta, a saída reabre sozinha, com as inversões que tinha.
- Com alguma saída aberta, o computador não apaga a tela nem entra em suspensão.
- Os atalhos de teclado funcionam com qualquer janela do programa em foco, inclusive com pedais e passadores, e podem ser trocados na aba Atalhos. Com o cursor no editor, os atalhos ficam inativos e a tela avisa; Esc sai do editor.
- Fechar a tela de controle fecha o programa e todas as saídas, perguntando antes se há alterações não salvas.
- Tem ícone próprio de teleprompter no menu Iniciar, no Dock e nos arquivos de roteiro (`.roteiro`).
- Instala no Windows com um instalador próprio e no Mac com uma imagem de disco para Intel e Apple Silicon.
- Funciona sem internet: as fontes da Chiaro vão junto com o programa.
