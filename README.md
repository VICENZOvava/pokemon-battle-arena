# Pokémon Battle Arena

Jogo de batalha por turnos no navegador, com interface em português e visual inspirado nos jogos clássicos.

## Como jogar localmente

Use Node.js 18 ou mais recente. Execute `npm start` na pasta do projeto e abra **http://localhost:3000**. Clique em **APERTE START**, escolha um Pokémon e selecione **LUTAR** para ver seus golpes. Escape volta para a tela anterior; as setas navegam pelos menus e listas.

## Conteúdo

- Catálogo da primeira geração carregado pela PokéAPI quando há conexão.
- Pokédex local de reserva e golpes locais para iniciar partidas sem a API.
- Tipos, efetividade, dano, precisão, STAB, crítico e ordem por velocidade.
- IA com dificuldades fácil, normal e difícil.
- Preferências de música e dificuldade salvas no navegador.
- Modo batalha de torre (1 a 10).
- Música em loop carregada de `assets/audio`.

O catálogo usa a PokéAPI e sprites públicos do projeto PokeAPI. Sem conexão, a seleção local continua jogável; sprites remotos podem não aparecer.

## PvP online 6x6

No menu, escolha **PVP ONLINE 6X6**. Um jogador cria a sala e compartilha o código; o outro entra com esse código. Cada um seleciona seis Pokémon diferentes da primeira geração. Em cada turno, quem tem mais vida no Pokémon ativo escolhe primeiro; se a vida empatar, a ordem é aleatória. O turno só é resolvido depois que os dois jogadores escolhem. Trocas consomem a ação e, quando um Pokémon desmaia, seu treinador escolhe um substituto.

## Publicar no Render

O servidor Node serve a interface e as rotas PvP. O arquivo render.yaml configura um Web Service, a verificação de saúde em /healthz e um Render Key Value para manter as salas PvP salvas entre reinícios.

1. No Render, crie ou sincronize um Blueprint apontando para este repositório e para a branch publicada.
2. Confirme que o Web Service corresponde ao projeto atual e que o recurso Key Value pokemon-battle-arena-rooms será criado ou conectado.
3. O Blueprint configura npm install como build, npm start como comando inicial e liga o Redis por REDIS_URL.

Se o Web Service já foi criado manualmente, sincronize o Blueprint para conectar o Key Value. Também é possível criar o Key Value no painel e definir REDIS_URL nas variáveis do Web Service usando a URL interna do Redis. O app e o Key Value precisam estar na mesma região.

Sem Redis, as salas ficam apenas na memória do processo e se perdem quando o servidor reinicia. Com Redis conectado, elas ficam salvas por até duas horas após a última atividade. O Render pode suspender serviços gratuitos sem tráfego; o primeiro acesso depois da suspensão pode demorar enquanto o serviço inicia.

## Executar o servidor local

`npm start` serve os arquivos e o PvP no mesmo servidor Node. Nesse modo local, as salas ficam na memória do processo e são perdidas quando o servidor reinicia.
