// Pokémon Battle Arena — Inteligência Artificial do adversário
// Integrante 4: IA e testes

const IA = (() => {
  // Multiplicadores esperados: 2 = super eficaz; 0.5 = pouco eficaz; 0 = imune.
  function pontuarAtaque(ataque, defensor) {
    if (!ataque || ataque.disponivel === false || (ataque.pp !== undefined && ataque.pp <= 0)) {
      return -Infinity;
    }

    const poder = Math.max(0, Number(ataque.poder) || 0);
    const precisao = Math.min(100, Math.max(0, Number(ataque.precisao ?? 100))) / 100;
    const efetividade = Math.max(0, Number(ataque.efetividade ?? 1));
    const hpDefensor = Math.max(0, Number(defensor.hp) || 0);

    // Estimativa simples. O motor de batalha calcula e aplica o dano real.
    const danoEsperado = poder * precisao * efetividade;

    // Bônus para uma chance realista de nocaute: usamos dano estimado como heurística.
    const bonusNocaute = danoEsperado >= hpDefensor && hpDefensor > 0 ? 20 : 0;

    return danoEsperado + bonusNocaute;
  }

  function escolherAtaque({ ataques, defensor, dificuldade = "normal", aleatorio = Math.random }) {
    if (!Array.isArray(ataques) || ataques.length === 0) return null;

    const disponiveis = ataques.filter(a =>
      a &&
      a.disponivel !== false &&
      !(a.pp !== undefined && a.pp <= 0)
    );

    if (disponiveis.length === 0) return null;

    if (dificuldade === "facil") {
      return disponiveis[Math.floor(aleatorio() * disponiveis.length)];
    }

    const avaliados = disponiveis
      .map((ataque, indice) => ({
        ataque,
        indice,
        pontuacao: pontuarAtaque(ataque, defensor || { hp: 1 })
      }))
      .sort((a, b) => b.pontuacao - a.pontuacao || a.indice - b.indice);

    if (dificuldade === "dificil") {
      // No modo difícil, prioriza ainda mais ataques que podem nocautear.
      const hp = Math.max(0, Number(defensor?.hp) || 0);
      const nocaute = avaliados.find(item =>
        (Number(item.ataque.poder) || 0) *
        (Math.min(100, Math.max(0, Number(item.ataque.precisao ?? 100))) / 100) *
        Math.max(0, Number(item.ataque.efetividade ?? 1)) >= hp
      );
      if (nocaute) return nocaute.ataque;
    }

    return avaliados[0].ataque;
  }

  return { pontuarAtaque, escolherAtaque };
})();

// Também permite usar este arquivo com módulos ES.
// No navegador, inclua ia.js antes de testes-ia.js.
if (typeof module !== "undefined" && module.exports) {
  module.exports = IA;
}
