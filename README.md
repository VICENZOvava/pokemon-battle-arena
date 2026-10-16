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

## Publicar na Vercel

O projeto publica a interface como arquivos estáticos e usa uma Vercel Function para as rotas do PvP.

1. Envie o projeto para um repositório GitHub e importe esse repositório em **vercel.com/new**. Deixe o diretório raiz como `.`.
2. A configuração do projeto já define o comando de build (`npm run build`) e a pasta publicada (`dist`).
3. No painel da Vercel, conecte um banco **Upstash Redis** pelo Marketplace. O PvP usa as variáveis `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`; confirme que elas estão disponíveis no ambiente **Production** (e também em Preview/Development, se for usar esses ambientes).
4. Faça o deploy. Após conectar ou alterar as variáveis do Redis, gere um novo deploy para que a função receba as configurações.

Sem o Redis configurado, o site e as batalhas locais continuam disponíveis, mas as salas PvP online retornam uma mensagem de configuração necessária. As salas online expiram após duas horas sem atividade.

## Executar o servidor local

`npm start` serve os arquivos e o PvP no mesmo servidor Node. Nesse modo local, as salas ficam na memória do processo e são perdidas quando o servidor reinicia.
