import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { calculateDamage } from './src/battle/damage.js';
import { TYPE_CHART } from './src/battle/typeChart.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const ROOM_TTL = 2 * 60 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const pokemonSeed = JSON.parse(await readFile(resolve(ROOT, 'data/pokemon.json'), 'utf8'));
const moveBook = JSON.parse(await readFile(resolve(ROOT, 'data/moves.json'), 'utf8'));
const pokemonById = new Map(pokemonSeed.map((pokemon) => [pokemon.id, pokemon]));
const rooms = new Map();

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function sendJson(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}
async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16000) fail(413, 'Requisição muito grande.');
  }
  if (!body) return {};
  try { return JSON.parse(body); }
  catch { fail(400, 'JSON inválido.'); }
}
function selectMoves(types) {
  const selected = [];
  const seen = new Set();
  const add = (move) => {
    if (move && !seen.has(move.id)) {
      seen.add(move.id);
      selected.push(move);
    }
  };
  for (const type of types) {
    const moves = moveBook[type] || [];
    if (moves.length) add(moves.reduce((best, move) => {
      const score = move.power * (move.accuracy / 100);
      return !best || score > best.power * best.accuracy / 100 ? move : best;
    }, null));
  }
  const relevant = [...types.flatMap((type) => moveBook[type] || []), ...(moveBook.normal || [])];
  relevant.sort((a, b) => b.power - a.power).forEach(add);
  return selected.slice(0, 4).map((move) => ({ ...move }));
}
function scaledStats(pokemon, level = 50) {
  const base = pokemon.baseStats;
  const stat = (key) => Math.max(1, Math.floor((2 * (Number(base[key]) || 1) * level) / 100) + 5);
  const hpMax = Math.floor((2 * (Number(base.hp) || 50) * level) / 100) + level + 10;
  return {
    id: pokemon.id, name: pokemon.name, types: [...pokemon.types], level,
    hpMax, hp: hpMax,
    attack: stat('attack'), defense: stat('defense'),
    specialAttack: stat('specialAttack'), specialDefense: stat('specialDefense'), speed: stat('speed'),
    moves: selectMoves(pokemon.types),
  };
}
function makeCode() {
  let code = '';
  for (const byte of randomBytes(6)) code += CODE_CHARS[byte % CODE_CHARS.length];
  return code;
}
function createRoom() {
  let code = makeCode();
  while (rooms.has(code)) code = makeCode();
  const now = Date.now();
  const room = {
    code,
    createdAt: now,
    lastSeen: [now, 0],
    players: [{ token: randomUUID(), team: null }, null],
    active: [0, 0],
    actions: [null, null],
    phase: 'team',
    turn: 1,
    winnerSeat: null,
    events: [],
    eventId: 0,
  };
  rooms.set(code, room);
  return { room, seat: 0 };
}
function addEvent(room, message) {
  room.events.push({ id: ++room.eventId, message });
  if (room.events.length > 30) room.events.shift();
}
function getRoom(code) {
  const room = rooms.get(String(code || '').toUpperCase());
  if (!room) fail(404, 'Sala não encontrada ou expirada.');
  return room;
}
function authorize(room, request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  const seat = room.players.findIndex((player) => player?.token === token);
  if (seat < 0) fail(401, 'Sessão inválida. Entre novamente na sala.');
  room.lastSeen[seat] = Date.now();
  return seat;
}
function activePokemon(room, seat) {
  return room.players[seat]?.team?.[room.active[seat]] || null;
}
function requiredSwitches(room) {
  return [0, 1].filter((seat) => {
    const team = room.players[seat]?.team;
    return team && team[room.active[seat]]?.hp <= 0 && team.some((pokemon) => pokemon.hp > 0);
  });
}
function applySwitch(room, seat, index) {
  room.active[seat] = index;
  addEvent(room, `Treinador ${seat + 1} enviou ${room.players[seat].team[index].name}.`);
}
function completeForcedSwitches(room) {
  const required = requiredSwitches(room);
  if (required.some((seat) => !room.actions[seat])) return;
  for (const seat of required) applySwitch(room, seat, room.actions[seat].index);
  room.actions = [null, null];
  room.phase = 'battle';
  room.turn += 1;
  addEvent(room, `Turno ${room.turn} começou.`);
}
function finishIfNeeded(room) {
  const defeated = [0, 1].map((seat) => room.players[seat].team.every((pokemon) => pokemon.hp <= 0));
  if (!defeated[0] && !defeated[1]) return false;
  room.phase = 'finished';
  room.winnerSeat = defeated[0] ? 1 : 0;
  addEvent(room, `Treinador ${room.winnerSeat + 1} venceu a batalha!`);
  return true;
}
function resolveTurn(room) {
  for (const seat of [0, 1]) {
    const action = room.actions[seat];
    if (action?.type === 'switch') applySwitch(room, seat, action.index);
  }
  const moveSeats = [0, 1].filter((seat) => room.actions[seat]?.type === 'move');
  moveSeats.sort((a, b) => {
    const speedDifference = activePokemon(room, b).speed - activePokemon(room, a).speed;
    return speedDifference || (Math.random() < 0.5 ? -1 : 1);
  });
  for (const seat of moveSeats) {
    const attacker = activePokemon(room, seat);
    const defender = activePokemon(room, 1 - seat);
    if (!attacker || !defender || attacker.hp <= 0 || defender.hp <= 0) continue;
    const move = attacker.moves[room.actions[seat].index];
    const result = calculateDamage(attacker, defender, move, TYPE_CHART);
    defender.hp = Math.max(0, defender.hp - result.damage);
    let message = result.missed
      ? `${attacker.name} usou ${move.name}, mas errou.`
      : `${attacker.name} usou ${move.name} e causou ${result.damage} de dano.`;
    if (!result.missed && result.effectiveness > 1) message += ' Foi super efetivo!';
    else if (!result.missed && result.effectiveness > 0 && result.effectiveness < 1) message += ' Não foi muito efetivo.';
    else if (!result.missed && result.effectiveness === 0) message += ' Não teve efeito.';
    if (result.critical) message += ' Acerto crítico!';
    addEvent(room, message);
    if (defender.hp <= 0) addEvent(room, `${defender.name} foi derrotado!`);
  }
  room.actions = [null, null];
  if (finishIfNeeded(room)) return;
  const switches = requiredSwitches(room);
  if (switches.length) {
    room.phase = 'switch';
    addEvent(room, 'Escolha um substituto para continuar.');
    return;
  }
  room.turn += 1;
  addEvent(room, `Turno ${room.turn} começou.`);
}
function publicState(room, mySeat) {
  const now = Date.now();
  return {
    roomCode: room.code,
    phase: room.phase,
    turn: room.turn,
    winnerSeat: room.winnerSeat,
    mySeat,
    players: room.players.map((player, seat) => {
      if (!player) return null;
      const team = player.team?.map((pokemon) => ({
        id: pokemon.id, name: pokemon.name, types: pokemon.types,
        hp: pokemon.hp, hpMax: pokemon.hpMax,
        ...(seat === mySeat ? { moves: pokemon.moves } : {}),
      })) || null;
      return {
        seat,
        nickname: `Treinador ${seat + 1}`,
        ready: Boolean(team),
        activeIndex: room.active[seat],
        hasSubmitted: Boolean(room.actions[seat]),
        mustSwitch: room.phase === 'switch' && requiredSwitches(room).includes(seat),
        online: now - room.lastSeen[seat] < 30000,
        team,
      };
    }),
    events: room.events.slice(-20),
  };
}
function validateTeam(ids) {
  if (!Array.isArray(ids) || ids.length !== 6) fail(400, 'Escolha exatamente 6 Pokémon.');
  const unique = new Set();
  return ids.map((value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || !pokemonById.has(id) || unique.has(id)) {
      fail(400, 'A equipe deve ter 6 Pokémon diferentes da primeira geração.');
    }
    unique.add(id);
    return scaledStats(pokemonById.get(id));
  });
}
async function handleApi(request, response, url) {
  const pathname = url.pathname;
  if (pathname === '/api/pvp/rooms' && request.method === 'POST') {
    const { room, seat } = createRoom();
    return sendJson(response, 201, { roomCode: room.code, token: room.players[seat].token, seat });
  }
  const match = pathname.match(/^\/api\/pvp\/rooms\/([A-Z0-9]{6})(?:\/(join|team|action|leave|state))?$/i);
  if (!match) return sendJson(response, 404, { error: 'Rota não encontrada.' });
  const code = match[1].toUpperCase();
  const operation = match[2] || '';
  const room = getRoom(code);
  if (operation === 'join' && request.method === 'POST') {
    if (room.phase !== 'team' || room.players[1]) fail(409, 'Esta sala já está cheia ou a batalha começou.');
    room.players[1] = { token: randomUUID(), team: null };
    room.lastSeen[1] = Date.now();
    addEvent(room, 'Um adversário entrou na sala.');
    return sendJson(response, 201, { roomCode: code, token: room.players[1].token, seat: 1 });
  }
  const seat = authorize(room, request);
  if (operation === 'state' && request.method === 'GET') return sendJson(response, 200, publicState(room, seat));
  if (operation === 'team' && request.method === 'POST') {
    if (room.phase !== 'team') fail(409, 'A seleção da equipe já foi encerrada.');
    const body = await readBody(request);
    if (room.players[seat].team) fail(409, 'Sua equipe já foi confirmada.');
    room.players[seat].team = validateTeam(body.ids);
    addEvent(room, `Treinador ${seat + 1} confirmou a equipe.`);
    if (room.players[0]?.team && room.players[1]?.team) {
      room.phase = 'battle';
      room.turn = 1;
      addEvent(room, 'A batalha começou! Turno 1.');
    }
    return sendJson(response, 200, publicState(room, seat));
  }
  if (operation === 'action' && request.method === 'POST') {
    const body = await readBody(request);
    if (room.phase !== 'battle' && room.phase !== 'switch') fail(409, 'A batalha não está recebendo ações.');
    if (!room.players[seat].team) fail(409, 'Confirme sua equipe primeiro.');
    if (room.actions[seat]) fail(409, 'Sua ação deste turno já foi enviada.');
    const index = Number(body.index);
    if (!Number.isInteger(index)) fail(400, 'Ação inválida.');
    const active = activePokemon(room, seat);
    if (room.phase === 'switch') {
      if (!requiredSwitches(room).includes(seat)) fail(409, 'Aguarde a troca do adversário.');
      if (index < 0 || index >= 6 || index === room.active[seat] || room.players[seat].team[index].hp <= 0) {
        fail(400, 'Escolha um Pokémon disponível para continuar.');
      }
      room.actions[seat] = { type: 'switch', index };
      completeForcedSwitches(room);
    } else if (body.type === 'switch') {
      if (index < 0 || index >= 6 || index === room.active[seat] || room.players[seat].team[index].hp <= 0) {
        fail(400, 'Escolha um Pokémon disponível para trocar.');
      }
      room.actions[seat] = { type: 'switch', index };
      if (room.actions[1 - seat]) resolveTurn(room);
    } else if (body.type === 'move') {
      if (active.hp <= 0 || index < 0 || index >= active.moves.length) fail(400, 'Golpe inválido.');
      room.actions[seat] = { type: 'move', index };
      if (room.actions[1 - seat]) resolveTurn(room);
    } else {
      fail(400, 'Ação inválida.');
    }
    return sendJson(response, 200, publicState(room, seat));
  }
  if (operation === 'leave' && request.method === 'POST') {
    if (room.phase !== 'finished') {
      room.phase = 'finished';
      room.winnerSeat = room.players[1 - seat] ? 1 - seat : null;
      addEvent(room, `Treinador ${seat + 1} saiu da sala.`);
    }
    return sendJson(response, 200, publicState(room, seat));
  }
  return sendJson(response, 405, { error: 'Método não permitido.' });
}
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon',
};
async function serveStatic(request, response, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { error: 'Método não permitido.' });
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { return sendJson(response, 400, { error: 'Caminho inválido.' }); }
  if (pathname === '/') pathname = '/index.html';
  const path = resolve(ROOT, `.${pathname}`);
  const relative = path.slice(ROOT.length + 1).split(sep);
  if (!path.startsWith(ROOT + sep) || relative.some((part) => part.startsWith('.')) || ['server.mjs', 'package.json', 'README.md'].includes(relative.at(-1))) {
    return sendJson(response, 404, { error: 'Arquivo não encontrado.' });
  }
  try {
    const info = await stat(path);
    if (!info.isFile()) return sendJson(response, 404, { error: 'Arquivo não encontrado.' });
    const content = await readFile(path);
    response.writeHead(200, {
      'Content-Type': MIME[extname(path).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    sendJson(response, 404, { error: 'Arquivo não encontrado.' });
  }
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  for (const [code, room] of rooms) if (Date.now() - Math.max(...room.lastSeen) > ROOM_TTL) rooms.delete(code);
  if (url.pathname.startsWith('/api/')) {
    try { await handleApi(request, response, url); }
    catch (error) { sendJson(response, error.status || 500, { error: error.status ? error.message : 'Erro interno do servidor.' }); }
    return;
  }
  await serveStatic(request, response, url);
});
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Pokémon Battle Arena disponível em http://localhost:${PORT}`);
});