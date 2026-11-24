# Preferências da equipe

O que a equipe da Chiaro Filmes já decidiu nas ideias anteriores e vale para as próximas. A forja lê este
arquivo antes de fazer qualquer pergunta: o que está aqui não se pergunta de novo. Cada linha é uma regra
curta, com a data, a ideia de origem e quem aprovou. Para mudar uma regra, acrescente a nova no fim: a mais
recente vale. Para tirar uma, apague a linha. O vigia acrescenta aqui só o que um admin aprovou no Task Forge.

## Preferências

- [2026-10-13 · #28 · Zerati] No Windows, o produto é um programa instalado de verdade, com instalador próprio; no celular, a mesma interface vai como app web instalável (PWA), sem passar por loja de aplicativos.
- [2026-10-13 · #28 · Zerati] Dados que precisam ser acessados de qualquer lugar ficam no Supabase (plano gratuito), com login por e-mail e senha, em vez de servidor no NAS ou arquivo em pasta sincronizada.
- [2026-10-13 · #28 · Zerati] Apps com dados na nuvem funcionam inteiros sem internet, com cópia local e envio das mudanças ao reconectar; ver a mudança aparecer em tempo real no outro aparelho é desejável, mas não trava o offline.
- [2026-10-13 · #28 · Zerati] Nunca usar serviços cobrados por uso, como a API da Anthropic com créditos pré-pagos: integrações com o Claude vão pela assinatura da equipe, por um conector (MCP) adicionado no próprio app do Claude.
- [2026-10-13 · #28 · Zerati] O que o Claude gera (tarefas, textos, propostas) entra como proposta e só é salvo depois que a pessoa confirma; o resultado salvo fica guardado para reler sem gerar de novo.
- [2026-10-13 · #28 · Zerati] Produtos são desenhados para qualquer pessoa da empresa, em qualquer função, não só para o setor que pediu a ideia.
- [2026-10-13 · #24 · Zerati] Programas de desktop saem para Windows e Mac, e caminhos de rede são traduzidos entre o formato do PC (\\servidor\pasta) e o do Mac (/Volumes/pasta).
- [2026-10-13 · #24 · Zerati] Instaladores de uso interno vão sem assinatura de código (Apple ou Windows); o Como usar explica como liberar o app na primeira abertura em cada máquina.
- [2026-10-13 · #24 · Zerati] App de desktop é construído com Electron, React e TypeScript, usando direto os componentes React e os tokens CSS do design system da Chiaro, sem reescrever a interface noutra tecnologia.
- [2026-10-13 · #24 · Zerati] Versão nova chega por instaladores numa pasta central na rede: ao abrir, o app compara a sua versão com a atual e, se estiver atrasado, mostra um aviso com botão que abre o instalador do sistema; sem servidor de atualização nem atualização silenciosa.
- [2026-10-13 · #24 · Zerati] Na edição a equipe usa Premiere Pro e After Effects (versões 2025 em diante); o DaVinci Resolve não precisa ser atendido.
- [2026-10-13 · #24 · Zerati] Padrões da casa (estruturas de pastas, regras, formatos de nome, modelos) ficam em arquivos YAML com comentários numa pasta central na rede, em caminho configurável no app; um responsável edita, quem usa não altera, e o app confere os arquivos ao abrir, aponta arquivo, linha e campo com erro e segue com a última versão boa sem travar ninguém.
- [2026-10-13 · #24 · Zerati] Antes de mover, copiar ou apagar arquivos em massa, o produto mostra uma tela de revisão com o destino de cada item, destaca os duvidosos e só aplica depois da confirmação, com backup antes e desfazer da última operação.
- [2026-10-13 · #24 · Zerati] Toda cópia de arquivo é conferida contra o original (impressão digital, não só tamanho), e o produto grava no destino um relatório legível do que fez e do que falhou.
- [2026-10-13 · #24 · Zerati] Toda automação que o produto faz por conta própria tem um liga/desliga para quem usa.
- [2026-10-16 · #26 · Zerati] Integração com IA por API fica atrás de um fornecedor trocável (Gemini, OpenAI, Claude), começando pelo plano gratuito, e o produto continua usável à mão quando a IA falha.
- [2026-10-16 · #26 · Zerati] Quando um sistema externo já é a origem dos dados (como a Google Agenda), o produto só lê dele, nunca escreve, e avisa quem usa quando algo muda lá.
- [2026-10-16 · #26 · Zerati] Avisos a quem usa saem dentro do próprio produto e como notificação no celular, e cada pessoa pode desligar as notificações.
- [2026-10-16 · #26 · Zerati] Quando o produto organiza atividades por pessoa, oferece um link opcional de agenda pessoal (iCal) para cada um assinar no seu calendário.
- [2026-10-16 · #26 · Zerati] Serviço de fundo que precisa rodar sozinho (releituras, IA, notificações) roda em Docker no NAS da empresa, só com conexões de saída.
- [2026-10-16 · #26 · Zerati] Acesso a agendas e dados do Google é feito por conta de serviço de um projeto gratuito do Google Cloud, com o dono compartilhando só leitura com ela.
- [2026-10-16 · #26 · Zerati] App web e app instalável no celular são hospedados no GitHub Pages da conta audiovisualpecege, com os dados no Supabase.
- [2026-10-16 · #26 · Zerati] A cópia local para funcionar sem internet usa um mecanismo próprio e simples (banco do navegador, fila de envio e conflito escolhido pela pessoa), sem serviço de sincronização externo.
- [2026-10-16 · #26 · Zerati] Quando o produto lê itens de uma fonte externa, ele também permite criar itens internos direto nele, sem tocar na fonte.
- [2026-10-16 · #31 · Zerati] Instaladores e versões novas saem por Releases de um repositório público no GitHub, não por pasta na rede (NAS), quando o produto não tem nada sigiloso.
- [2026-10-16 · #31 · Zerati] Extensões de navegador atendem Chrome, Edge, Firefox, Opera e Opera GX, e são distribuídas fora das lojas: pacote para Chromium carregado pela pasta e pacote do Firefox assinado pela Mozilla sem publicar.
- [2026-10-16 · #31 · Zerati] Extensões de navegador são feitas com WXT e TypeScript, com o popup em React usando os componentes da Chiaro, gerando do mesmo código os pacotes de Chromium e Firefox.
- [2026-10-16 · #31 · Zerati] Configurações de quem usa ficam só no aparelho e no navegador onde foram feitas, sem sincronização por conta do Google, Microsoft, Opera ou Mozilla.
- [2026-10-16 · #31 · Zerati] Quando o produto age sozinho, ele começa ligado para tudo e quem usa marca as exceções, em vez de ligar item a item.
- [2026-10-16 · #31 · Zerati] Ajustes de quem usa são poucos e globais (por exemplo, brilho e contraste), com um botão de voltar ao padrão; nada de ajuste fino por item.
- [2026-10-16 · #31 · Zerati] Ações usadas várias vezes ao dia ganham um atalho de teclado, com uma combinação sugerida que quem usa pode trocar.
- [2026-10-20 · #18 · Zerati] Quando uma ideia serve a mais de uma ferramenta da equipe (por exemplo vMix e Premiere), um mesmo núcleo atende todas as frentes, em vez de um produto separado para cada uma.
- [2026-10-20 · #18 · Zerati] Para o vMix, o produto é um programa à parte que recebe a imagem por NDI e a devolve como nova entrada NDI, já que o vMix não aceita plugins que mexam na imagem.
- [2026-10-20 · #18 · Zerati] Painéis para o Premiere são feitos no formato novo da Adobe (UXP), mesmo que isso exija Premiere 25.6 ou mais novo, em vez do formato antigo (CEP).
- [2026-10-20 · #18 · Zerati] Na edição, o resultado de uma automação entra como camada ou item separado acima do original, que fica intacto e pode ser desligado ou refeito.
- [2026-10-20 · #18 · Zerati] Efeitos automáticos sobre a imagem (borrão, máscara, correção) atingem só a área que precisa deles, nunca o quadro inteiro.
- [2026-10-20 · #18 · Zerati] Em transmissão ao vivo, quando uma automação falha, a imagem segue no ar e quem opera recebe um alerta forte; o produto não congela nem tira a tela do ar sozinho.
- [2026-10-20 · #18 · Zerati] Imagens e vídeos da empresa são processados no próprio computador, sem envio para nuvem nem para IA externa.
- [2026-10-27 · #33 · Zerati] App web e app instalável no celular são feitos com React, TypeScript e Vite, usando direto os componentes e tokens do design system da Chiaro.
- [2026-10-27 · #33 · Zerati] E-mails automáticos de um app (convite, recuperação de senha) saem pelo plano gratuito do Brevo com o domínio da empresa verificado no DNS, e a tela oferece também um botão para copiar o link.
- [2026-10-27 · #33 · Zerati] Documentos exportados para ler e imprimir (PDF, DOCX) saem em fundo branco com a identidade da Chiaro, mesmo quando as telas do app são escuras.
- [2026-10-27 · #33 · Zerati] Marcações feitas ao vivo usam botões rápidos de um toque, que guardam o momento exato do toque, a partir de uma lista editável pela equipe, mais uma opção de texto livre com ditado.
- [2026-11-24 · #34 · Zerati] Quando uma automação tem mais de um comportamento viável, o mais estável é o padrão e o outro fica como opção selecionável por quem usa.
- [2026-11-24 · #34 · Zerati] Uma opção barata que pode servir a algum equipamento ou caso de uso entra na primeira versão, e a equipe decide tirá-la depois de testar no uso real.
