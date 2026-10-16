# Pokémon Battle Arena

Jogo de batalha por turnos no navegador, com interface em português e visual inspirado nos jogos clássicos.

## Como jogar

Use **Node.js 18 ou mais recente**. Execute `npm start` na pasta do projeto e abra **http://localhost:3000**. Clique em **APERTE START**, escolha um Pokémon e selecione **LUTAR** para ver seus golpes. Escape volta para a tela anterior; as setas navegam pelos menus e listas. O servidor integrado também habilita o modo PvP.

## Conteúdo

- Catálogo da primeira geração carregado pela PokéAPI quando há conexão.
- Pokédex local de reserva e golpes locais para iniciar partidas sem a API.
- Tipos, efetividade, dano, precisão, STAB, crítico e ordem por velocidade.
- IA com dificuldades fácil, normal e difícil.
- Preferências de música e dificuldade salvas no navegador.
- Modo batalha de torre (1 a 10) disponivel.
- Música em loop carregada de assets/audio.

O catálogo usa a PokéAPI e sprites públicos do projeto PokeAPI. Sem conexão, a seleção local continua jogável; sprites remotos podem não aparecer.

## PvP online 6x6

No menu, escolha **PVP ONLINE 6X6**. Um jogador cria a sala e compartilha o código; o outro entra com esse código. Cada um seleciona seis Pokémon diferentes da primeira geração. As ações são por turno, as trocas consomem a ação e, quando um Pokémon desmaia, seu treinador escolhe um substituto. A partida termina quando uma equipe perde os seis Pokémon.

Para partidas pela internet, hospede o projeto em um serviço que execute o servidor Node e disponibilize a mesma origem para os dois jogadores. Salas e partidas ficam na memória do processo e são encerradas quando o servidor reinicia.
