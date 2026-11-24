# Briefing: Teleprompter para uso interno (ideia #34)

## Problema

A equipe de Produção e da Técnica (Av) usa toda semana o "Operador Teleprompter Multilaudas 2010_B" (Apotec). Ele tem muitas limitações. A mais grave é que o monitor de controle e o espelho de onde a pessoa lê saem de sincronia. Ele também não atende bem às gravações com dois aparelhos de TP ao mesmo tempo, quando um precisa de imagem espelhada e o outro não. Além disso, ele não acompanha a voz de quem lê, recurso que reduziria a necessidade de ter alguém operando o TP o tempo todo.

## Decisões tomadas e por quê

As respostas vieram pelo Task Forge e foram dadas por Zerati.

1. **Todas as saídas de TP ficam em monitores ligados ao mesmo computador do operador.** Um único programa guarda uma única posição de rolagem, e a tela de controle e todas as saídas desenham o texto a partir dela. Isso acaba com a dessincronização de hoje e evita sincronizar pela rede. Cada saída tem a sua própria opção de espelhar.
2. **A primeira versão é só o teleprompter.** Avisos na tela do TP e conversa entre mediadores e técnica, como sugeriu o Charbas, ficam de fora e podem virar uma ideia separada. O escopo fica menor e a entrega sai mais cedo.
3. **A rolagem por voz entra na primeira versão, com liga e desliga.** O reconhecimento roda no próprio computador, sem internet e sem custo. O avanço só acontece quando o programa reconhece palavras do roteiro, e ele espera quando a pessoa improvisa. O controle manual (botões, roda do mouse, teclado) sempre passa por cima da voz. Se a voz falhar, o texto fica onde está e o operador recebe um alerta claro.
4. **O reconhecimento de voz precisa ser leve.** O TP não necessariamente roda num computador forte, como lembrou Zerati. Os candidatos são o Vosk (há um modelo pequeno em português, de uns 32 MB) e o Parakeet, a ser rodado de forma leve. A escolha vem de teste com voz real na TechSpec.
5. **O resumo do escopo abaixo foi confirmado sem mudanças** na pergunta de fechamento.

## Escopo

- **Programa de desktop instalado** para Windows e Mac, em tema escuro (Noite) do design system da Chiaro, com ícone próprio de teleprompter e versão `v1.0.0` visível num canto fixo da tela de controle.
- **Tela de controle:**
  - caixa de edição com o texto completo; dá para alterar o texto durante o uso, e a alteração só chega às saídas depois de um botão de confirmar;
  - aparência: tipo e tamanho da fonte, cor do texto, cor do fundo, cor da faixa de referência (o retângulo que marca a linha atual), caixa alta, caixa baixa ou normal, e alinhamento (centralizado ou não);
  - margens laterais, que limitam até onde o texto vai na tela do TP, para que os olhos de quem lê não se movam a ponto de aparecer na gravação;
  - prévia da saída sincronizada com a mesma rolagem.
- **Várias saídas de TP:** cada uma é uma janela em tela cheia num monitor escolhido, com espelhar sim ou não, e todas leem a mesma rolagem do controle.
- **Formas de controlar a rolagem:**
  - botões de subir e descer;
  - roda do mouse;
  - atalhos de teclado que quem usa pode trocar. Eles também atendem pedais e passadores que imitam teclas;
  - rolagem automática por velocidade, em passos de 0,25x, com um teto que uma pessoa ainda consegue ler;
  - botão de voltar ao início do texto;
  - rolagem por voz, que segue quem lê, com liga e desliga.
- **Roteiros:** colar texto, importar `.txt` e `.docx`, salvar e abrir roteiros como arquivo no computador, junto com os ajustes de aparência.
- **Ajustes de quem usa:** ficam só naquele computador e têm um botão de voltar ao padrão.
- **Atualização:** ao abrir, o programa compara a sua versão com a última publicada e, se estiver atrasado, mostra um aviso com um botão que abre o instalador novo.

## Fora de escopo

- Avisos rápidos na tela do TP e conversa entre mediadores, técnica e quem lê, com nomes de usuário (sugestão do Charbas).
- Saída de TP por rede para tablet ou celular, ou como fonte NDI.
- Dados na nuvem, login e sincronização de roteiros entre computadores.
- Reconhecimento de voz por serviço na internet ou cobrado por uso.
- Controle remoto próprio (app de celular ou rede). Pedais e passadores entram só como teclado.

## Riscos

- **Precisão da voz em português:** não há medição publicada da precisão do modelo pequeno do Vosk em português, e não há teste nosso com microfone de estúdio, sotaques e ruído de set. Mitigação: testar o Vosk e o Parakeet com gravações reais antes de fechar a TechSpec. A voz sempre tem liga e desliga, e o controle manual sempre funciona.
- **Computador fraco:** a voz e várias saídas em tela cheia ao mesmo tempo podem pesar numa máquina modesta. Mitigação: escolher o modelo pela leveza, medir o uso do processador e manter a rolagem suave mesmo com a voz ligada.
- **Reconhecimento do navegador:** o reconhecimento de voz embutido do Chromium costuma falhar dentro do Electron, com erro de rede. Por isso o reconhecimento precisa ser um componente próprio que roda no computador, o que aumenta o instalador.
- **Parakeet em português:** ainda falta confirmar se há um modelo do Parakeet em português leve o bastante para CPU comum. Se não houver, o Vosk fica como padrão.
- **Mac sem assinatura:** o instalador vai sem assinatura de código, então na primeira abertura é preciso liberar o programa à mão em cada máquina. O Como usar vai explicar o passo a passo. No Mac, o programa também precisa de permissão para usar o microfone.
- **Monitores:** o operador precisa associar cada saída ao monitor certo. Se um monitor for desconectado durante o uso, o programa não pode travar nem perder a posição do texto.

## Preferências aplicadas

- [2026-10-13 · #28] No Windows, o produto é um programa instalado de verdade, com instalador próprio.
- [2026-10-13 · #24] Programas de desktop saem para Windows e Mac.
- [2026-10-13 · #24] Instaladores de uso interno vão sem assinatura de código, e o Como usar explica como liberar o app.
- [2026-10-13 · #24] App de desktop é feito com Electron, React e TypeScript, com os componentes e tokens do design system da Chiaro.
- [2026-10-16 · #31] Instaladores e versões novas saem por Releases de um repositório público no GitHub (`audiovisualpecege`), já que nada é sigiloso. Essa regra vale sobre a da pasta na rede (#24); o aviso de versão nova com botão que abre o instalador (#24) continua.
- [2026-10-13 · #24] Toda automação tem liga e desliga (aplicada à rolagem por voz e à automática).
- [2026-10-16 · #26] O produto continua usável à mão quando a parte inteligente falha.
- [2026-10-20 · #18] Quando uma automação falha ao vivo, a imagem segue na tela e quem opera recebe um alerta forte; o produto não congela nem tira a tela sozinho.
- [2026-10-20 · #18] Mídia da empresa é processada no próprio computador (aplicada ao áudio de quem lê).
- [2026-10-13 · #28] Nada de serviço cobrado por uso.
- [2026-10-16 · #31] Configurações ficam só no aparelho onde foram feitas.
- [2026-10-16 · #31] Ajustes de quem usa são poucos e globais, com um botão de voltar ao padrão.
- [2026-10-16 · #31] Ações usadas várias vezes ao dia ganham atalho de teclado, que quem usa pode trocar.
- [2026-10-13 · #28] Produtos são desenhados para qualquer pessoa da empresa, então a tela de controle precisa ser simples para quem não é da Técnica.

## Entregável

Um programa de teleprompter para Windows e Mac, versão 1.0.0, com instaladores publicados nas Releases de `github.com/audiovisualpecege/` e listados em `_instaladores.txt`. Ele terá:
- tela de controle com edição do texto e todos os ajustes de aparência e de margem;
- várias saídas de TP em monitores ligados ao mesmo computador, cada uma com o seu espelhamento e todas sincronizadas;
- rolagem manual, rolagem automática em passos de 0,25x, botão de voltar ao início e rolagem por voz no próprio computador, com liga e desliga;
- roteiros salvos como arquivo e importação de `.txt` e `.docx`;
- ícone próprio, versão visível, aviso de versão nova, `CHANGELOG.md` e um Como usar com a liberação do programa na primeira abertura.
