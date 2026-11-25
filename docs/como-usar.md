# Como usar o Teleprompter

O Teleprompter da Chiaro Filmes passa o roteiro nos monitores de TP do estúdio, com a rolagem feita por um operador ou acompanhando a sua voz. Funciona sem internet, no Windows e no Mac.

Versão deste guia: 1.0.0.

## 1. Baixar o instalador

Os instaladores ficam na página de versões do programa: <https://github.com/audiovisualpecege/teleprompter/releases/latest>.

| Computador | Arquivo |
|---|---|
| Windows 10 ou 11 (64 bits) | `Teleprompter-1.0.0-win-x64.exe` |
| Mac com Apple Silicon (M1, M2, M3, M4) | `Teleprompter-1.0.0-mac-arm64.dmg` |
| Mac com processador Intel | `Teleprompter-1.0.0-mac-x64.dmg` |

No Mac, para saber qual é o seu: menu Apple, "Sobre Este Mac". Se aparecer "Chip Apple M...", use o `arm64`; se aparecer "Processador Intel", use o `x64`.

O instalador já traz tudo, inclusive o reconhecimento de voz. Depois de instalado, o programa não precisa de internet.

## 2. Instalar no Windows

1. Abra `Teleprompter-1.0.0-win-x64.exe`.
2. O instalador não tem assinatura de código, então o Windows pode mostrar a tela azul "O Windows protegeu o computador". Clique em **Mais informações** e depois em **Executar assim mesmo**. Isso só acontece na primeira vez.
3. Escolha a pasta (ou deixe a sugerida) e conclua.
4. O Teleprompter aparece no menu Iniciar e na Área de Trabalho, com o ícone do teleprompter.

Para atualizar, instale a versão nova por cima. Os ajustes deste computador (saídas, atalhos, microfone, voz, velocidade e aparência) e os roteiros salvos continuam como estavam.

## 3. Instalar no Mac e liberar na primeira abertura

1. Abra o arquivo `.dmg` e arraste o **Teleprompter** para a pasta **Aplicativos**.
2. Abra a pasta Aplicativos e dê dois cliques no Teleprompter.
3. O programa não tem assinatura da Apple, então o Mac avisa que não pode verificar o desenvolvedor. Faça uma vez:
   - No macOS 15 (Sequoia) ou mais novo: clique em **OK** no aviso, abra **Ajustes do Sistema**, **Privacidade e Segurança**, role até o fim e clique em **Abrir Mesmo Assim** ao lado do Teleprompter. Confirme com a senha do Mac e clique em **Abrir**.
   - No macOS 14 (Sonoma) ou anterior: na pasta Aplicativos, clique no Teleprompter com o botão direito (ou Control e clique), escolha **Abrir** e, no aviso, clique em **Abrir** de novo.
4. Se o Mac disser que o app "está danificado", abra o Terminal e rode o comando abaixo, depois abra o programa de novo:

   ```
   xattr -dr com.apple.quarantine /Applications/Teleprompter.app
   ```

Depois da primeira vez, o Teleprompter abre normalmente, pelo Dock ou pelo Launchpad.

## 4. Permissão do microfone

A rolagem por voz precisa do microfone. O áudio é processado só neste computador e nada sai dele.

- **Mac:** na primeira vez que você liga a voz, o Mac pergunta se o Teleprompter pode usar o microfone. Clique em **Permitir**. Se negou sem querer: **Ajustes do Sistema**, **Privacidade e Segurança**, **Microfone**, ligue o Teleprompter e ligue a voz de novo.
- **Windows:** se a voz disser que não tem permissão, abra **Configurações**, **Privacidade e segurança**, **Microfone** e ligue "Permitir que aplicativos da área de trabalho acessem o microfone".

## 5. Preparar o roteiro

Na primeira abertura, a tela de controle mostra os três passos: colar ou importar o texto, abrir uma saída e ligar a voz, se quiser.

1. Cole o texto no editor, à direita, ou use **Importar** para trazer um `.txt` ou `.docx`. Do `.docx` vem só o texto; tabelas e imagens ficam de fora, e o programa avisa o que deixou de fora.
2. Clique em **Confirmar alterações**. Só o texto confirmado vai para a prévia e para as saídas. Enquanto você edita, as saídas continuam no texto anterior, sem pular; **Descartar** volta ao texto confirmado.
3. Na aba **Aparência**, escolha a fonte, o tamanho, as cores do texto, do fundo e da faixa de leitura, a caixa, o alinhamento, as margens e a posição da faixa. A prévia mostra o resultado na hora.
4. **Salvar** grava o roteiro como arquivo `.roteiro`, com o texto e a aparência. Dois cliques num `.roteiro` abrem o programa com ele pronto.

Se o programa fechar sem salvar (queda de energia, por exemplo), na próxima abertura ele oferece recuperar o texto.

## 6. Montar o estúdio

1. Ligue os monitores de TP antes de abrir as saídas.
2. Na aba **Saídas**, cada monitor aparece com o nome e a resolução. O monitor da tela de controle não recebe saída.
3. Clique em **Abrir saída** no monitor de cada TP. A saída abre em tela cheia e mostra o número dela por alguns segundos, para você saber qual é qual.
4. Em cada saída, ligue o que o vidro daquele TP pede:
   - **Espelhar**: inverte esquerda e direita (o caso mais comum no vidro do teleprompter).
   - **Inverter vertical**: vira de cabeça para baixo, para monitores montados invertidos.
   - **Sinal de voz**: mostra, no canto, se a voz está ouvindo.
5. O programa lembra as saídas deste computador e as reabre na próxima abertura, com as mesmas inversões.

Com alguma saída aberta, o computador não apaga a tela nem entra em suspensão. Se um monitor de TP for desligado, as outras saídas continuam e a tela de controle avisa qual caiu; quando ele volta, a saída reabre sozinha.

## 7. Gravar com operador

Use os botões grandes abaixo da prévia ou os atalhos:

- **Iniciar** e **Pausar** a rolagem automática.
- **-** e **+** mudam a velocidade (de 0,25x a 3,00x, de 0,25 em 0,25). A velocidade fica guardada.
- **Subir** e **Descer** movem uma linha. A roda do mouse sobre a prévia também rola.
- **Voltar ao início** leva a primeira linha à faixa.

Todas as telas (prévia e saídas) ficam sempre no mesmo ponto.

## 8. Gravar sozinho, com a voz

1. Na aba **Voz**, escolha o microfone (cada entrada de uma interface de áudio aparece separada) e confira o nível no medidor enquanto fala.
2. O motor padrão é o **Vosk**. O **Parakeet** aparece onde ele roda e pode ser mais preciso em algumas vozes, mas pede um computador mais forte.
3. Escolha o modo:
   - **Perto** (padrão): o texto avança só um pouco à frente do que você lê.
   - **Pulos para a frente**: o texto também salta para uma frase dita com clareza mais à frente.
4. Aperte **Voz** (ou a tecla **V**). O estado aparece ao lado das ações: **Preparando**, **Ouvindo**, **Esperando** (quando você improvisa ou pausa) ou **Falhou**.
5. Leia normalmente. O texto acompanha a leitura, espera quando você sai do roteiro e nunca volta sozinho.

Os botões, as teclas e o pedal valem sempre por cima da voz, e a voz continua dali. Ligar a voz pausa a rolagem automática, e iniciar a automática desliga a voz. Se o microfone cair ou o computador não der conta, uma faixa vermelha diz o motivo, o texto fica parado e visível nas saídas, e a voz volta sozinha quando o problema se resolve.

## 9. Atalhos, pedal e passador

| Ação | Atalho padrão |
|---|---|
| Iniciar ou pausar a rolagem automática | Espaço |
| Descer uma linha | Seta para baixo ou Page Down |
| Subir uma linha | Seta para cima ou Page Up |
| Mais velocidade | + |
| Menos velocidade | - |
| Voltar ao início | Home |
| Ligar ou desligar a voz | V |
| Fechar a saída em foco | Ctrl+Shift+W (no Mac, Cmd+Shift+W) |

- Os atalhos valem com qualquer janela do programa em foco, inclusive uma saída.
- Com o cursor no editor, os atalhos ficam inativos e a tela avisa. Aperte **Esc** para sair do editor.
- Pedais e passadores funcionam como a tecla que imitam (a maioria dos passadores manda Page Down e Page Up). Se o seu manda outra tecla, troque na aba **Atalhos**: clique em **Gravar** na ação e aperte o pedal ou o botão do passador.
- **Voltar ao padrão**, na aba Atalhos, devolve só os atalhos padrão.

## 10. Versão, versão nova e voltar ao padrão

- A versão aparece no canto inferior direito da tela de controle (por exemplo, `v1.0.0`) e na aba **Sobre**.
- Quando sai uma versão nova, a tela de controle avisa ao abrir. **Baixar e instalar** baixa o instalador para a pasta Downloads e o abre; siga o instalador como na primeira vez. **Fechar** esconde o aviso até a próxima abertura. Sem internet, nada aparece. As saídas nunca mostram o aviso.
- A aba **Sobre** mostra também o motor de voz em uso, o atraso médio da voz e o botão **Abrir pasta de registros**. Ao relatar um problema, diga a versão e envie os arquivos dessa pasta.
- **Voltar ao padrão**, na aba Sobre, pede confirmação e devolve todos os ajustes deste computador: velocidade 1,00x, voz no modo "Perto" com o Vosk, atalhos padrão e saídas sem inversão. Os roteiros salvos não mudam.

## 11. Lista de conferência do estúdio

Faça esta conferência na instalação de cada estúdio e a cada versão nova, com o computador do estúdio, dois monitores de TP reais, o pedal e o passador.

**Instalação**

- [ ] O programa instala e abre no tema escuro, com `v1.0.0` no canto inferior direito.
- [ ] O atalho do menu Iniciar (Windows) ou o Dock (Mac) mostra o ícone do teleprompter.
- [ ] Com o cabo de rede desligado e o Wi-Fi desligado, o programa abre e a voz chega a "Ouvindo".

**Duas saídas reais com inversões diferentes**

- [ ] Abra uma saída em cada monitor de TP. Cada uma mostra o seu número ao abrir.
- [ ] Na saída 1, ligue **Espelhar**; na saída 2, ligue **Inverter vertical** (ou a combinação que cada vidro pede).
- [ ] Olhando pelo vidro de cada TP, o texto aparece legível e na orientação certa.
- [ ] Inicie a rolagem automática: as duas saídas e a prévia andam juntas, sem diferença visível.
- [ ] Desligue o monitor da saída 2: a saída 1 continua e a tela de controle avisa. Religue: a saída 2 volta sozinha, com a mesma inversão.
- [ ] Feche e abra o programa: as duas saídas reabrem nos mesmos monitores, com as mesmas inversões.

**Pedal**

- [ ] Com a janela de controle em foco, o pedal desce o texto (ou faz a ação gravada para ele).
- [ ] Clique numa saída para dar foco a ela: o pedal continua funcionando.
- [ ] Com o cursor no editor, o pedal não mexe no texto e a tela avisa que os atalhos estão inativos; Esc volta ao normal.

**Passador**

- [ ] Os botões de avançar e voltar do passador descem e sobem uma linha nas duas saídas.
- [ ] Se o passador manda outra tecla, grave-a na aba Atalhos e confira de novo.

**Voz**

- [ ] Com o microfone do estúdio escolhido na aba Voz, o medidor de nível se mexe quando você fala.
- [ ] Ligue a voz e leia um trecho: o texto acompanha. Improvise: o estado vai a "Esperando" e o texto para.
- [ ] Durante a leitura, use o pedal para descer uma linha: a voz continua dali.

**Ajustes**

- [ ] Na aba Sobre, clique em **Voltar ao padrão** e depois em **Cancelar**: nada muda, e as saídas continuam com as inversões do estúdio.
