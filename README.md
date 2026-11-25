# Teleprompter

Teleprompter para uso interno da Chiaro Filmes, para Windows e Mac. Passa o roteiro em um ou mais monitores de TP, cada um com a sua inversão, com a rolagem feita por um operador, por pedal ou passador, ou acompanhando a voz de quem lê. Funciona sem internet.

- **Baixar:** <https://github.com/audiovisualpecege/teleprompter/releases/latest>
- **Instalar, liberar na primeira abertura e usar no estúdio:** [docs/como-usar.md](docs/como-usar.md)
- **O que mudou em cada versão:** [CHANGELOG.md](CHANGELOG.md)

Um produto Chiaro Filmes.

## Para quem desenvolve

- `npm ci` instala as dependências; `node scripts/baixar-modelos.mjs` baixa os modelos de voz (fora do git).
- `npm run dev` abre o programa em desenvolvimento.
- `npm test` roda os testes de unidade e integração; `npm run test:e2e` roda os de ponta a ponta.
- A versão mora só no `version` do `package.json`. Uma tag `v1.2.3` igual a ela publica os instaladores nas Releases pelo workflow `.github/workflows/release.yml`.
