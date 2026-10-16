# Pokémon Battle Arena

Jogo de batalha por turnos para navegador, com interface em português, partidas individuais, modo Torre e PvP online 6 contra 6.

## Requisitos

- Node.js 18 ou mais recente
- npm

## Rodar localmente

Na pasta do projeto, instale as dependências e inicie o servidor:

    npm install
    npm start

Abra <http://localhost:3000>. O servidor usa a porta definida pela variável PORT, ou 3000 quando ela não estiver definida.

As salas PvP funcionam localmente sem Redis, mas ficam apenas na memória e são apagadas quando o servidor reinicia. Para manter as salas entre reinícios, configure uma das opções de Redis descritas abaixo.

## Como jogar

Na tela inicial, pressione **APERTE START**. Use as setas para navegar, Enter para confirmar e Escape para voltar.

- **Nova batalha:** escolha um Pokémon e lute contra um adversário controlado pelo jogo.
- **Batalha da Torre:** enfrente até 10 andares consecutivos.
- **PvP Online 6x6:** um jogador cria uma sala e compartilha o código; o outro entra com esse código. Cada jogador escolhe seis Pokémon diferentes e confirma a equipe.
- **Dificuldade e música:** ajuste as preferências no menu.

No PvP, o jogador cujo Pokémon ativo tem mais HP escolhe sua ação primeiro. Se o HP for igual, a ordem é aleatória. Cada treinador escolhe uma ação por vez; o turno é resolvido depois das duas escolhas. Trocar de Pokémon consome a ação. Quando um Pokémon é derrotado, seu treinador escolhe um substituto.

## Publicar no Render

O arquivo render.yaml configura o servidor Node, a rota de verificação /healthz e um recurso Render Key Value para armazenar as salas PvP.

1. No painel do Render, crie ou sincronize um Blueprint usando este repositório.
2. Confirme a criação do Web Service e do Key Value definidos em render.yaml.
3. Aguarde o deploy. O Blueprint usa npm install para instalar as dependências e npm start para iniciar o servidor.
4. Abra o endereço do Web Service e teste o jogo em duas janelas ou dispositivos.

O Blueprint configura REDIS_URL com a conexão interna do Key Value. Para uma configuração manual, crie o Web Service com build command npm install, start command npm start e health check path /healthz. Configure REDIS_URL com a URL interna de um Redis na mesma região do serviço.

Também é possível usar Upstash Redis. Configure no ambiente do servidor UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN. Como alternativa, o servidor reconhece KV_REST_API_URL e KV_REST_API_TOKEN.

Sem uma conexão Redis válida, o servidor ainda permite criar salas, mas elas ficam apenas na memória do processo e se perdem quando ele reinicia. As salas expiram após duas horas sem atividade.

Hospedagens estáticas, como GitHub Pages, não executam o servidor Node necessário para o PvP. Para jogar online, use uma hospedagem que rode o servidor, como o Render configurado pelo Blueprint.

## Dados e créditos

O catálogo local contém os nomes dos 151 Pokémon da primeira geração. A PokéAPI fornece dados adicionais de espécies e sprites. Se o servidor não conseguir obter os dados de batalha de uma espécie, ele usa valores de contingência para permitir que a equipe seja confirmada.

Os golpes e a tabela de tipos também têm dados locais no diretório data. As preferências de música e dificuldade são salvas no navegador.

Pokémon e seus personagens pertencem aos respectivos titulares. Este projeto é independente e não é afiliado à Nintendo, à Game Freak ou à The Pokémon Company.

## Estrutura do projeto

- main.js: inicialização, navegação entre telas e modos de jogo.
- server.mjs: servidor web, API e estado das salas PvP.
- src/battle: dano, efetividade, regras de batalha, IA e Torre.
- src/api: comunicação com PokéAPI e API PvP.
- src/ui: telas de seleção, batalha e PvP.
- data: dados locais de Pokémon, golpes e tipos.
- render.yaml: configuração de hospedagem no Render.