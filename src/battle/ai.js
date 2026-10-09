import { TYPE_CHART, calculateEffectiveness } from './typeChart.js';

function normalizedDifficulty(value) {
  if (value === 'easy' || value === 'facil' || value === 'fácil') return 'easy';
  if (value === 'hard' || value === 'dificil' || value === 'difícil') return 'hard';
  return 'normal';
}

function estimate(attacker, defender, move, chart) {
  const power = Math.max(0, Number(move.power) || 0);
  if (!power) return 0;
  const effectiveness = calculateEffectiveness(move.type, defender.types, chart);
  if (!effectiveness) return 0;
  const attack = move.category === 'special' ? attacker.specialAttack : attacker.attack;
  const defense = move.category === 'special' ? defender.specialDefense : defender.defense;
  const base = Math.floor((Math.floor((2 * (attacker.level || 50)) / 5) + 2) * power * (attack || 1) / (defense || 1) / 50) + 2;
  return base * effectiveness * (attacker.types.includes(move.type) ? 1.5 : 1) * (Number(move.accuracy ?? 100) / 100);
}

export function chooseMove({ moves, attacker, defender, difficulty = 'normal', typeChart = TYPE_CHART, random = Math.random }) {
  const usable = (Array.isArray(moves) ? moves : []).filter(
    (move) => move && Number(move.power) > 0 && Number(move.accuracy ?? 100) > 0 && move.available !== false,
  );
  if (!usable.length) return null;
  if (normalizedDifficulty(difficulty) === 'easy') {
    return usable[Math.min(usable.length - 1, Math.floor(Math.max(0, random()) * usable.length))];
  }
  const ranked = usable.map((move, index) => ({
    move, index, score: estimate(attacker, defender, move, typeChart),
  })).sort((a, b) => b.score - a.score || a.index - b.index);
  if (normalizedDifficulty(difficulty) === 'hard') {
    const knockout = ranked.find((item) => item.score >= defender.hp);
    if (knockout) return knockout.move;
  }
  return ranked[0].move;
}
