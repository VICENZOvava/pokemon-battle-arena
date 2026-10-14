const FLOOR_POOLS = [
  [10, 13, 16, 19, 21, 41, 129],
  [11, 14, 17, 20, 22, 23, 43, 46, 69],
  [12, 15, 24, 25, 27, 37, 43, 46, 69],
  [26, 28, 31, 34, 36, 38, 45, 47, 51, 53],
  [55, 57, 59, 62, 65, 68, 71, 73, 76, 78, 80],
  [59, 62, 65, 68, 80, 89, 94, 103, 112],
  [94, 103, 112, 121, 130, 131, 134, 135, 136],
  [103, 112, 121, 130, 131, 134, 135, 136, 142, 143, 149],
  [130, 131, 142, 143, 149],
  [144, 145, 146, 150],
];

export const TOWER_FLOORS = FLOOR_POOLS.length;

export function createTowerRoster(excludedPokemonId, previousRoster = [], random = Math.random) {
  const excludedId = Number(excludedPokemonId);
  const previous = Array.isArray(previousRoster) ? previousRoster.map(Number) : [];
  const used = new Set();

  return FLOOR_POOLS.map((pool, index) => {
    const available = pool.filter((id) => id !== excludedId && !used.has(id));
    const fresh = available.filter((id) => id !== previous[index]);
    const choices = fresh.length ? fresh : available;
    const opponentId = choices[Math.floor(random() * choices.length)];
    used.add(opponentId);
    return opponentId;
  });
}

export function getTowerEnemyLevel(floor) {
  const currentFloor = Math.min(TOWER_FLOORS, Math.max(1, Number(floor) || 1));
  return 25 + currentFloor * 4;
}
