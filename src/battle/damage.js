
/* =========================================
   POKEMON BATTLE ARENA
   INTEGRANTE 2 - CALCULO DE DANO
   Arquivo: src/damage.js
========================================= */

// Calcula a efetividade do golpe contra os
// tipos do Pokémon defensor.
export function calcularEfetividade(
    tipoAtaque,
    tiposDefensor,
    typeChart
) {
    let multiplicador = 1;

    for (const tipoDefensor of tiposDefensor) {
        multiplicador *=
            typeChart[tipoAtaque]?.[tipoDefensor] ?? 1;
    }

    return multiplicador;
}

// Verifica se o ataque acertou.
export function verificarPrecisao(ataque) {
    const precisao = ataque.precisao ?? 100;

    if (precisao <= 0) return false;
    if (precisao >= 100) return true;

    return Math.random() * 100 < precisao;
}

// Calcula o dano causado pelo ataque.
export function calcularDano(
    atacante,
    defensor,
    ataque,
    typeChart
) {
    if (!atacante || !defensor || !ataque) {
        throw new Error(
            "Atacante, defensor e ataque são obrigatórios."
        );
    }

    if (!Array.isArray(atacante.tipos) ||
        !Array.isArray(defensor.tipos)) {
        throw new Error(
            "Os Pokémon precisam possuir uma lista de tipos."
        );
    }

    const poder = Number(ataque.poder) || 0;

    // Golpes sem poder não causam dano direto.
    if (poder <= 0) {
        return {
            dano: 0,
            efetividade: 1,
            stab: 1,
            critico: false
        };
    }

    const nivel = atacante.nivel ?? 50;

    // O integrante 3 deve cadastrar estes atributos
    // dentro de cada Pokémon.
    const categoria = ataque.categoria ?? "fisico";

    const atributoAtaque =
        categoria === "especial"
            ? atacante.ataqueEspecial
            : atacante.ataque;

    const atributoDefesa =
        categoria === "especial"
            ? defensor.defesaEspecial
            : defensor.defesa;

    const ataqueStat = Math.max(1, atributoAtaque ?? 1);
    const defesaStat = Math.max(1, atributoDefesa ?? 1);

    // Bônus de ataque do mesmo tipo (STAB).
    const stab = atacante.tipos.includes(ataque.tipo)
        ? 1.5
        : 1;

    const efetividade = calcularEfetividade(
        ataque.tipo,
        defensor.tipos,
        typeChart
    );

    // Imunidade: o ataque não causa dano.
    if (efetividade === 0) {
        return {
            dano: 0,
            efetividade,
            stab,
            critico: false
        };
    }

    // Fórmula de dano inspirada na terceira geração.
    const danoBase = Math.floor(
        (
            Math.floor(
                (2 * nivel) / 5
            ) + 2
        ) * poder * ataqueStat / defesaStat / 50
    ) + 2;

    // Variação aleatória de 85% a 100%.
    const variacao = Math.floor(
        Math.random() * 16
    ) + 85;

    const dano = Math.max(
        1,
        Math.floor(
            danoBase * stab * efetividade * variacao / 100
        )
    );

    return {
        dano,
        efetividade,
        stab,
        critico: false
    };
}
