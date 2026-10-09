import { TYPE_CHART } from './typeChart.js';
import { calculateDamage } from './damage.js';

function scaleStat(base, level) {
  return Math.max(1, Math.floor((2 * Math.max(1, Number(base) || 1) * level) / 100) + 5);
}

function preparePokemon(pokemon, level) {
  if (!pokemon?.name) throw new Error('Pokémon inválido.');
  const base = pokemon.baseStats || pokemon.stats || {};
  const hpBase = Math.max(1, Number(base.hp) || 50);
  return {
    ...pokemon,
    types: [...(pokemon.types || ['normal'])],
    level,
    hpMax: Math.floor((2 * hpBase * level) / 100) + level + 10,
    hp: Math.floor((2 * hpBase * level) / 100) + level + 10,
    attack: scaleStat(base.attack, level),
    defense: scaleStat(base.defense, level),
    specialAttack: scaleStat(base.specialAttack ?? base.special_attack, level),
    specialDefense: scaleStat(base.specialDefense ?? base.special_defense, level),
    speed: scaleStat(base.speed, level),
    moves: [...(pokemon.moves || [])],
  };
}

export function createBattle(playerPokemon, enemyPokemon, typeChart = TYPE_CHART, { level = 50 } = {}) {
  if (!playerPokemon || !enemyPokemon) throw new Error('Escolha os dois Pokémon para iniciar a batalha.');
  return {
    player: preparePokemon(playerPokemon, level),
    enemy: preparePokemon(enemyPokemon, level),
    typeChart, round: 1, over: false, winner: null, history: [],
  };
}

export function performAttack(battle, side, move, random = Math.random) {
  if (!battle || battle.over) return null;
  const attacker = battle[side];
  const defender = battle[side === 'player' ? 'enemy' : 'player'];
  if (!attacker || !defender || defender.hp <= 0 || attacker.hp <= 0 || !move) return null;
  const result = calculateDamage(attacker, defender, move, battle.typeChart, random);
  defender.hp = Math.max(0, defender.hp - result.damage);
  if (defender.hp <= 0) {
    battle.over = true;
    battle.winner = side;
  }
  const action = {
    side, attacker, defender, move,
    damage: result.damage, effectiveness: result.effectiveness,
    critical: result.critical, missed: result.missed, hpRemaining: defender.hp,
  };
  battle.history.push(action);
  return action;
}

export function advanceRound(battle) {
  if (battle && !battle.over) battle.round += 1;
  return battle?.round ?? 0;
}
