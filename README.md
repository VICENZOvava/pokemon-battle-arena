# Pokémon Battle Arena

Jogo de batalha por turnos no navegador, com interface em português e visual inspirado nos jogos clássicos.

## Como jogar

Abra a pasta no VS Code após baixar o repositório e inicie um servidor estático, por exemplo com a extensão Live Server. Também é possível executar **python -m http.server 8000** na pasta do projeto e abrir **http://localhost:8000** no navegador. O servidor é necessário porque o jogo usa módulos JavaScript e carrega dados JSON locais.

Clique em **APERTE START** para liberar a música, escolha um Pokémon e selecione **LUTAR** para ver seus golpes. Escape volta para a tela anterior; as setas navegam pelos menus e listas.

## Conteúdo

- Catálogo da primeira geração carregado pela PokéAPI quando há conexão.
- Pokédex local de reserva e golpes locais para iniciar partidas sem a API.
- Tipos, efetividade, dano, precisão, STAB, crítico e ordem por velocidade.
- IA com dificuldades fácil, normal e difícil.
- Preferências de música e dificuldade salvas no navegador.
- Música em loop carregada de assets/audio.

O catálogo usa a PokéAPI e sprites públicos do projeto PokeAPI. Sem conexão, a seleção local continua jogável; sprites remotos podem não aparecer.
