# Fixtures de voz

Gravações usadas pelos testes de voz com os motores reais (`npm run test:voice`) e pela
calibração das constantes do alinhador (`src/shared/defaults.ts`).

## Gravações reais da equipe (pendentes)

Os testes IT-012, IT-015 e IT-016 procuram estes arquivos nesta pasta e ficam pulados
enquanto eles não existem:

| Arquivo | O que tem |
|---|---|
| `leitura-continua.wav` | O roteiro lido do começo ao fim, no ritmo normal de gravação. |
| `improviso.wav` | Duas frases do roteiro, uns 20 s de fala fora do roteiro, e a leitura retomada. |
| `trecho-pulado.wav` | O primeiro parágrafo, o segundo pulado inteiro, e o terceiro lido. |
| `leitura-com-improviso.wav` | A leitura inteira com um comentário curto no meio. |

O roteiro é `roteiro.txt`. São no mínimo 3 pessoas diferentes da equipe (uma pode gravar
mais de um arquivo). Grave no estúdio, com o microfone de uso, em WAV mono de 16 bits
(16 kHz ou 48 kHz; o teste reamostra).

Cada WAV tem ao lado um `.json` com o mesmo nome:

```json
{
  "origem": "gravacao",
  "quem": "Nome de quem gravou",
  "data": "2026-12-01",
  "roteiro": "roteiro.txt",
  "duracaoMs": 61000,
  "marcas": [
    { "token": 1, "fimMs": 820 },
    { "token": 2, "fimMs": 1130 },
    { "token": null, "inicioMs": 20500, "fimMs": 21000, "palavra": "improviso" }
  ]
}
```

- `token` é a posição da palavra no roteiro (a primeira palavra é 0), contando as
  palavras separadas por espaço. `null` marca fala fora do roteiro.
- `fimMs` é o fim da palavra no áudio, em milissegundos. `inicioMs` só é preciso nas
  marcas de improviso e na primeira palavra depois dele.
- As marcas podem ser feitas no Audacity (faixa de rótulos, um rótulo por palavra) e
  convertidas para este formato.

## Fixtures sintéticas (`sintetica/`)

Os mesmos quatro cenários falados pela voz pt-BR do Windows, gerados por
`node scripts/gerar-voz-sintetica.mjs`. Servem para provar que os motores, a captura e o
alinhador funcionam de ponta a ponta dentro do Electron. Não servem para calibrar: a voz
sintética é limpa e regular demais.
