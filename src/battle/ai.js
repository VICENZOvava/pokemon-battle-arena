import { TYPE_CHART, calculateEffectiveness } from './typeChart.js';

function normalizedDifficulty(value) {
  const normalized = String(value ?? 'normal').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalized === 'easy' || normalized === 'facil') return 'easy';
  if (normalized === 'hard' || normalized === 'dificil') return 'hard';
  return 'normal';
}

function moveDamage(attacker, defender, move, chart, minimumRoll = false) {
  const power = Math.max(0, Number(move.power) || 0);
  if (!power) return 0;
  const effectiveness = calculateEffectiveness(move.type, defender.types, chart);
  if (!effectiveness) return 0;
  const attack = move.category === 'special' ? attacker.specialAttack : attacker.attack;
  const defense = move.category === 'special' ? defender.specialDefense : defender.defense;
  const base = Math.floor((Math.floor((2 * (attacker.level || 50)) / 5) + 2) * power * (attack || 1) / (defense || 1) / 50) + 2;
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  return Math.max(1, Math.floor(base * stab * effectiveness * (minimumRoll ? 0.85 : 1)));
}

function estimate(attacker, defender, move, chart) {
  return moveDamage(attacker, defender, move, chart) * (Number(move.accuracy ?? 100) / 100);
}

function pickRandom(items, random) {
  const value = Math.min(0.999999999, Math.max(0, Number(random()) || 0));
  return items[Math.floor(value * items.length)];
}

export function chooseMove({ moves, attacker, defender, difficulty = 'normal', typeChart = TYPE_CHART, random = Math.random }) {
  const usable = (Array.isArray(moves) ? moves : []).filter(
    (move) => move && Number(move.power) > 0 && Number(move.accuracy ?? 100) > 0 && move.available !== false,
  );
  if (!usable.length) return null;
  const level = normalizedDifficulty(difficulty);
  if (level === 'easy') return pickRandom(usable, random);

  const ranked = usable.map((move, index) => ({
    move,
    index,
    score: estimate(attacker, defender, move, typeChart),
  })).sort((a, b) => b.score - a.score || a.index - b.index);

  if (level === 'hard') {
    const reliableFinishers = ranked.filter(({ move }) =>
      Number(move.accuracy ?? 100) >= 90
      && moveDamage(attacker, defender, move, typeChart, true) >= defender.hp,
    );
    if (reliableFinishers.length) {
      return reliableFinishers.sort((a, b) =>
        Number(b.move.accuracy ?? 100) - Number(a.move.accuracy ?? 100)
        || b.score - a.score
        || a.index - b.index,
      )[0].move;
    }
    return ranked[0].move;
  }

  // Normal often uses its strongest move, but occasionally picks the runner-up.
  if (ranked.length > 1 && Number(random()) >= 0.7) return ranked[1].move;
  return ranked[0].move;
}
