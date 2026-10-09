import { readCache, writeCache } from './cache.js';
import { TYPE_CHART } from '../battle/typeChart.js';

const API = 'https://pokeapi.co/api/v2';
const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const DATA = new URL('../../data/', import.meta.url);
const TYPE_TTL = 3 * 24 * 60 * 60 * 1000;
const POKEMON_TTL = 14 * 24 * 60 * 60 * 1000;

export const TYPE_LABELS = {
  normal: 'Normal', fire: 'Fogo', water: 'Água', electric: 'Elétrico',
  grass: 'Grama', ice: 'Gelo', fighting: 'Lutador', poison: 'Veneno',
  ground: 'Terrestre', flying: 'Voador', psychic: 'Psíquico', bug: 'Inseto',
  rock: 'Pedra', ghost: 'Fantasma', dragon: 'Dragão',
};

let seedPromise;
let movePromise;
async function loadData(filename) {
  const response = await fetch(new URL(filename, DATA));
  if (!response.ok) throw new Error('Não foi possível ler data/' + filename + '.');
  return response.json();
}
function getSeed() {
  seedPromise ??= loadData('pokemon.json');
  return seedPromise;
}
function getMoveBook() {
  movePromise ??= loadData('moves.json');
  return movePromise;
}
async function requestJson(url, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('A API respondeu com HTTP ' + response.status + '.');
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
function titleCase(value) {
  return String(value || '').split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}
function selectMoves(types, book) {
  const selected = [];
  const seen = new Set();
  const add = (move) => {
    if (move && !seen.has(move.id)) {
      seen.add(move.id);
      selected.push(move);
    }
  };
  (types || []).forEach((type) => {
    const moves = book[type] || [];
    if (moves.length) add(moves.reduce((best, move) => {
      const score = move.power * (move.accuracy / 100);
      return !best || score > best.power * best.accuracy / 100 ? move : best;
    }, null));
  });
  const relevant = [...(types || []).flatMap((type) => book[type] || []), ...(book.normal || [])];
  relevant.sort((a, b) => b.power - a.power).forEach(add);
  return selected.slice(0, 4);
}
function mapStats(rawStats) {
  const keys = {
    hp: 'hp', attack: 'attack', defense: 'defense',
    'special-attack': 'specialAttack', 'special-defense': 'specialDefense', speed: 'speed',
  };
  const result = {};
  (rawStats || []).forEach((entry) => {
    if (keys[entry.stat?.name]) result[keys[entry.stat.name]] = Number(entry.base_stat) || 1;
  });
  return result;
}
function spriteSet(raw, id) {
  const versions = raw.sprites?.versions?.['generation-iii']?.['firered-leafgreen'];
  return {
    front: versions?.front_default || raw.sprites?.front_default || SPRITES + '/' + id + '.png',
    back: versions?.back_default || raw.sprites?.back_default || SPRITES + '/back/' + id + '.png',
  };
}

export function getSpriteUrl(id, view = 'front') {
  return view === 'back' ? SPRITES + '/back/' + id + '.png' : SPRITES + '/' + id + '.png';
}

let catalogRequest;
export async function getCatalog() {
  const seed = await getSeed();
  const cached = readCache('catalog:first-gen');
  if (Array.isArray(cached) && cached.length) return cached;
  return seed.map((pokemon) => ({
    id: pokemon.id, name: pokemon.name, englishName: pokemon.englishName || pokemon.name,
  }));
}

export function refreshCatalog() {
  if (catalogRequest) return catalogRequest;
  catalogRequest = (async () => {
    const seed = await getSeed();
    const cached = readCache('catalog:first-gen');
    if (Array.isArray(cached) && cached.length) return cached;
    try {
      const result = await requestJson(API + '/pokemon?limit=151&offset=0', 5000);
      const localNames = new Map(seed.map((pokemon) => [pokemon.id, pokemon.name]));
      const catalog = result.results.map((entry, index) => ({
        id: index + 1, name: localNames.get(index + 1) || titleCase(entry.name), englishName: entry.name,
      }));
      writeCache('catalog:first-gen', catalog, TYPE_TTL);
      return catalog;
    } catch {
      return getCatalog();
    }
  })().finally(() => { catalogRequest = null; });
  return catalogRequest;
}

export async function getPokemon(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId < 1 || numericId > 151) {
    throw new Error('Escolha um Pokémon da primeira geração.');
  }
  const [seed, book] = await Promise.all([getSeed(), getMoveBook()]);
  const local = seed.find((pokemon) => pokemon.id === numericId);
  const cached = readCache('pokemon:' + numericId);
  if (cached) return { ...cached, moves: selectMoves(cached.types, book) };

  try {
    const raw = await requestJson(API + '/pokemon/' + numericId);
    const types = raw.types.slice().sort((a, b) => a.slot - b.slot)
      .map((entry) => entry.type.name).filter((type) => TYPE_LABELS[type]);
    const pokemon = {
      id: numericId, name: local?.name || titleCase(raw.name), englishName: raw.name,
      types: types.length ? types : ['normal'], baseStats: mapStats(raw.stats),
      sprites: spriteSet(raw, numericId), moves: [],
    };
    writeCache('pokemon:' + numericId, pokemon, POKEMON_TTL);
    return { ...pokemon, moves: selectMoves(pokemon.types, book) };
  } catch {
    if (local) {
      return {
        ...local, englishName: local.englishName || local.name,
        sprites: { front: getSpriteUrl(numericId), back: getSpriteUrl(numericId, 'back') },
        moves: selectMoves(local.types, book),
      };
    }
    return {
      id: numericId, name: 'Pokémon #' + String(numericId).padStart(3, '0'),
      englishName: 'pokemon-' + numericId, types: ['normal'],
      baseStats: { hp: 60, attack: 60, defense: 60, specialAttack: 60, specialDefense: 60, speed: 60 },
      sprites: { front: getSpriteUrl(numericId), back: getSpriteUrl(numericId, 'back') },
      moves: selectMoves(['normal'], book), dataUnavailable: true,
    };
  }
}

export async function getRandomOpponent(excludedId) {
  const catalog = await getCatalog();
  const choices = catalog.filter((pokemon) => pokemon.id !== Number(excludedId));
  const choice = choices[Math.floor(Math.random() * choices.length)] || catalog[0];
  return getPokemon(choice.id);
}
export async function getTypeChart() {
  return TYPE_CHART;
}
