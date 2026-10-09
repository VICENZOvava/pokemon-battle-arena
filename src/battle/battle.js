
/* =========================================
   POKEMON BATTLE ARENA
   INTEGRANTE 2 - SISTEMA DE BATALHA
   Arquivo: src/battle.js
========================================= */

import {
    calcularDano,
    verificarPrecisao
} from "./damage.js";

// Prepara uma cópia do Pokémon para a batalha.
function prepararPokemon(pokemon) {
    if (!pokemon || !pokemon.nome) {
        throw new Error("Pokémon inválido.");
    }

    const hpMax = Number(pokemon.hpMax ?? pokemon.hp);

    if (!Number.isFinite(hpMax) || hpMax <= 0) {
        throw new Error(
            `${pokemon.nome} precisa ter HP máximo válido.`
        );
    }

    return {
        ...pokemon,
        tipos: [...pokemon.tipos],
        hpMax,
        hpAtual: hpMax,
        derrotado: false
    };
}

// Inicia uma batalha entre dois Pokémon.
export function criarBatalha(
    pokemonJogador,
    pokemonAdversario,
    typeChart
) {
    if (!pokemonJogador || !pokemonAdversario) {
        throw new Error(
            "Escolha os dois Pokémon para iniciar a batalha."
        );
    }

    if (!typeChart) {
        throw new Error(
            "A tabela de efetividade dos tipos não foi carregada."
        );
    }

    return {
        jogador: prepararPokemon(pokemonJogador),
        adversario: prepararPokemon(pokemonAdversario),
        typeChart,
        turno: 1,
        finalizada: false,
        vencedor: null,
        historico: []
    };
}

// Executa um ataque de um Pokémon contra o outro.
function executarAtaque(
    batalha,
    atacante,
    defensor,
    ataque
) {
    if (atacante.derrotado || defensor.derrotado) {
        return null;
    }

    if (!ataque || !ataque.nome || !ataque.tipo) {
        return {
            mensagem: "Ataque inválido.",
            dano: 0
        };
    }

    if (!verificarPrecisao(ataque)) {
        return {
            mensagem:
                `${atacante.nome} usou ${ataque.nome}, mas errou!`,
            dano: 0
        };
    }

    const resultado = calcularDano(
        atacante,
        defensor,
        ataque,
        batalha.typeChart
    );

    defensor.hpAtual = Math.max(
        0,
        defensor.hpAtual - resultado.dano
    );

    if (defensor.hpAtual === 0) {
        defensor.derrotado = true;
    }

    let mensagem =
        `${atacante.nome} usou ${ataque.nome}!`;

    if (resultado.efetividade === 0) {
        mensagem += " Não teve efeito!";
    } else if (resultado.efetividade > 1) {
        mensagem += " Foi super efetivo!";
    } else if (resultado.efetividade < 1) {
        mensagem += " Não foi muito efetivo...";
    }

    if (defensor.derrotado) {
        mensagem += ` ${defensor.nome} foi derrotado!`;
    }

    return {
        mensagem,
        dano: resultado.dano,
        efetividade: resultado.efetividade,
        hpRestante: defensor.hpAtual
    };
}

// Organiza os ataques por velocidade.
function definirOrdem(batalha, ataqueJogador, ataqueAdversario) {
    const jogador = batalha.jogador;
    const adversario = batalha.adversario;

    const velocidadeJogador = jogador.velocidade ?? 0;
    const velocidadeAdversario = adversario.velocidade ?? 0;

    if (velocidadeJogador === velocidadeAdversario) {
        return Math.random() < 0.5
            ? [
                [jogador, adversario, ataqueJogador],
                [adversario, jogador, ataqueAdversario]
            ]
            : [
                [adversario, jogador, ataqueAdversario],
                [jogador, adversario, ataqueJogador]
            ];
    }

    return velocidadeJogador > velocidadeAdversario
        ? [
            [jogador, adversario, ataqueJogador],
            [adversario, jogador, ataqueAdversario]
        ]
        : [
            [adversario, jogador, ataqueAdversario],
            [jogador, adversario, ataqueJogador]
        ];
}

// Executa um turno completo da batalha.
export function executarTurno(
    batalha,
    ataqueJogador,
    ataqueAdversario
) {
    if (batalha.finalizada) {
        return {
            turno: batalha.turno,
            mensagens: ["A batalha já terminou."],
            finalizada: true,
            vencedor: batalha.vencedor
        };
    }

    const ataques = definirOrdem(
        batalha,
        ataqueJogador,
        ataqueAdversario
    );

    const mensagens = [];

    for (const [atacante, defensor, ataque] of ataques) {
        // Se o primeiro golpe derrotar o adversário,
        // ele não terá oportunidade de atacar.
        if (batalha.finalizada) break;
        if (atacante.derrotado || defensor.derrotado) continue;

        const resultado = executarAtaque(
            batalha,
            atacante,
            defensor,
            ataque
        );

        if (resultado) {
            mensagens.push(resultado.mensagem);
            batalha.historico.push(resultado.mensagem);
        }

        if (batalha.jogador.derrotado) {
            batalha.vencedor = batalha.adversario;
            batalha.finalizada = true;
        } else if (batalha.adversario.derrotado) {
            batalha.vencedor = batalha.jogador;
            batalha.finalizada = true;
        }

        if (batalha.finalizada) {
            const mensagemFinal =
                `${batalha.vencedor.nome} venceu a batalha!`;

            mensagens.push(mensagemFinal);
            batalha.historico.push(mensagemFinal);
            break;
        }
    }

    if (!batalha.finalizada) {
        batalha.turno++;
    }

    return {
        turno: batalha.turno,
        mensagens,
        finalizada: batalha.finalizada,
        vencedor: batalha.vencedor,
        jogador: {
            nome: batalha.jogador.nome,
            hpAtual: batalha.jogador.hpAtual,
            hpMax: batalha.jogador.hpMax
        },
        adversario: {
            nome: batalha.adversario.nome,
            hpAtual: batalha.adversario.hpAtual,
            hpMax: batalha.adversario.hpMax
        }
    };
}
