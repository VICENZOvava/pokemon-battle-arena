# Documentação — Inteligência Artificial e Testes

## Objetivo
A IA seleciona um ataque para o Pokémon adversário com base em uma pontuação heurística. Ela fica separada da interface e do motor de batalha.

## Critérios de decisão
- Poder do ataque.
- Precisão estimada.
- Multiplicador de efetividade fornecido pelos dados de batalha.
- Bônus heurístico quando o dano esperado pode derrotar o Pokémon.
- Disponibilidade do ataque e PP restante, se o projeto utilizar PP.

## Dificuldades
- `facil`: escolhe aleatoriamente entre ataques disponíveis.
- `normal`: escolhe o ataque com maior pontuação estimada.
- `dificil`: dá preferência a um ataque cujo dano estimado seja suficiente para nocautear; caso contrário, usa a pontuação.

## Limites
A pontuação é uma heurística inicial para o projeto, não uma implementação oficial dos jogos Pokémon. O motor de batalha continua responsável por calcular e aplicar o dano real, atualizar HP, processar turnos e decidir vitória/derrota. O multiplicador de efetividade deve ser fornecido pelo sistema de tipos desenvolvido pela equipe.

## Como executar os testes
Abra `testes.html` em um navegador. A página lista cada teste como PASSOU ou FALHOU.

## Casos cobertos
- Escolha do ataque de maior pontuação.
- Ataque sem PP.
- Ataque indisponível.
- Lista vazia ou sem ataques utilizáveis.
- Influência da precisão.
- Escolha no modo fácil.

## Integração com o motor de batalha
O motor de batalha deve chamar `IA.escolherAtaque({ ataques, defensor, dificuldade })`, validar o resultado e executar o ataque retornado. Se a função retornar `null`, o motor deve decidir a regra de contingência (por exemplo, usar um movimento padrão ou encerrar a ação).
