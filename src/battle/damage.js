import { TYPE_CHART, calculateEffectiveness } from './typeChart.js';

function randomValue(random) {
  return Math.min(0.999999999, Math.max(0, Number(random()) || 0));
}

export function accuracyCheck(move, random = Math.random) {
  const accuracy = Number(move?.accuracy ?? move?.precisao ?? 100);
  if (accuracy >= 100) return true;
  if (accuracy <= 0) return false;
  return randomValue(random) * 100 < accuracy;
}

export function calculateDamage(attacker, defender, move, chart = TYPE_CHART, random = Math.random) {
  if (!attacker || !defender || !move) throw new Error('Atacante, defensor e golpe são obrigatórios.');
  if (!Array.isArray(attacker.types) || !Array.isArray(defender.types)) {
    throw new Error('Os Pokémon precisam informar seus tipos.');
  }
  const type = move.type ?? move.tipo;
  const power = Math.max(0, Number(move.power ?? move.poder) || 0);
  const effectiveness = calculateEffectiveness(type, defender.types, chart);
  const stab = attacker.types.includes(type) ? 1.5 : 1;
  if (!power || move.category === 'status' || effectiveness === 0) {
    return { damage: 0, effectiveness, stab, critical: false, missed: false };
  }
  if (!accuracyCheck(move, random)) {
    return { damage: 0, effectiveness, stab, critical: false, missed: true };
  }

  const level = Math.max(1, Number(attacker.level) || 50);
  const attackStat = move.category === 'special'
    ? Number(attacker.specialAttack ?? attacker.attack ?? attacker.ataqueEspecial ?? attacker.ataque) || 1
    : Number(attacker.attack ?? attacker.ataque) || 1;
  const defenseStat = move.category === 'special'
    ? Number(defender.specialDefense ?? defender.defense ?? defender.defesaEspecial ?? defender.defesa) || 1
    : Number(defender.defense ?? defender.defesa) || 1;
  const baseDamage = Math.floor(
    (Math.floor((2 * level) / 5) + 2) * power * Math.max(1, attackStat) / Math.max(1, defenseStat) / 50,
  ) + 2;
  const critical = randomValue(random) < 1 / 16;
  const variance = 85 + Math.floor(randomValue(random) * 16);
  const damage = Math.max(1, Math.floor(baseDamage * (critical ? 2 : 1) * stab * effectiveness * variance / 100));
  return { damage, effectiveness, stab, critical, missed: false };
}

export function calcularEfetividade(type, defenderTypes, chart = TYPE_CHART) {
  return calculateEffectiveness(type, defenderTypes, chart);
}
export function verificarPrecisao(move, random = Math.random) {
  return accuracyCheck(move, random);
}
export function calcularDano(attacker, defender, move, chart = TYPE_CHART, random = Math.random) {
  const result = calculateDamage(attacker, defender, {
    ...move,
    type: move?.type ?? move?.tipo,
    power: move?.power ?? move?.poder,
    accuracy: move?.accuracy ?? move?.precisao,
    category: move?.category ?? (move?.categoria === 'especial' ? 'special' : 'physical'),
  }, chart, random);
  return { dano: result.damage, efetividade: result.effectiveness, stab: result.stab, critico: result.critical };
}
