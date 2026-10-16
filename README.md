# Pokémon Battle Arena


## Sobre o projeto

Pokémon Battle Arena é um jogo de batalhas por turnos feito para navegador. O projeto combina uma interface em português com um visual inspirado nos jogos clássicos da franquia Pokémon.

É possível jogar batalhas individuais contra a IA, avançar por uma Torre de até 10 andares ou desafiar outra pessoa em partidas PvP online 6 contra 6. As batalhas incluem seleção de golpes, tipos, efetividade e estatísticas dos Pokémon.

## Recursos

- Pokédex da primeira geração, com 151 espécies.
- Batalha individual com três níveis de dificuldade.
- Modo Torre com 10 adversários.
- PvP online por salas com código.
- Equipes de seis Pokémon e batalha por turnos.
- Preferências de dificuldade e música salvas no navegador.

## API utilizada

O projeto utiliza a [PokéAPI v2](https://pokeapi.co/docs/v2) para consultar a lista de Pokémon e dados das espécies, como tipos e atributos.

- Lista da primeira geração: [pokemon?limit=151&offset=0](https://pokeapi.co/api/v2/pokemon?limit=151&offset=0)
- Dados de uma espécie: [pokemon/{id}](https://pokeapi.co/api/v2/pokemon/1)

Os golpes e a tabela de efetividade também contam com dados locais no projeto.

Pokémon e seus personagens pertencem aos respectivos titulares. Este projeto é independente e não é afiliado à Nintendo, à Game Freak ou à The Pokémon Company. Apenas um projeto para fins educacionais.
