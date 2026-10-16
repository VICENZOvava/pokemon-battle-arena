import { randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { handleApi, rooms } from '../../server.mjs';

const ROOM_TTL_SECONDS = 2 * 60 * 60;
const LOCK_TTL_SECONDS = 15;
const RELEASE_LOCK_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

let redisClient;

function jsonError(status, message) {
  return Response.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  redisClient ??= new Redis({ url, token });
  return redisClient;
}

class CapturedResponse {
  statusCode = 200;
  headers = {};
  body = '';

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = headers;
    return this;
  }

  end(body = '') {
    this.body = body;
  }

  toResponse() {
    return new Response(this.body, {
      status: this.statusCode,
      headers: this.headers,
    });
  }
}

async function createNodeRequest(request) {
  const body = ['GET', 'HEAD'].includes(request.method) ? '' : await request.text();
  if (body.length > 16000) return { error: jsonError(413, 'Requisição muito grande.') };

  return {
    request: {
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      async *[Symbol.asyncIterator]() {
        if (body) yield Buffer.from(body);
      },
    },
  };
}

async function invokeApi(request, url) {
  const response = new CapturedResponse();
  try {
    await handleApi(request, response, url);
  } catch (error) {
    response.writeHead(error.status || 500, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(JSON.stringify({
      error: error.status ? error.message : 'Erro interno do servidor.',
    }));
  }
  return response.toResponse();
}

async function createPersistentRoom(request, url, redis) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await invokeApi(request, url);
    if (response.status !== 201) return response;

    const { roomCode } = await response.clone().json();
    const room = rooms.get(roomCode);
    const stored = room && await redis.set(
      `pvp:room:${roomCode}`,
      room,
      { ex: ROOM_TTL_SECONDS, nx: true },
    );
    rooms.delete(roomCode);
    if (stored === 'OK') return response;
  }

  return jsonError(503, 'Não foi possível criar uma sala agora. Tente novamente.');
}

async function acquireRoomLock(redis, roomCode) {
  const key = `pvp:lock:${roomCode}`;
  const token = randomUUID();

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await redis.set(key, token, { nx: true, ex: LOCK_TTL_SECONDS });
    if (result === 'OK') return { key, token };
    await new Promise((resolve) => setTimeout(resolve, 40));
  }

  return null;
}

async function withPersistentRoom(request, url, roomCode, redis) {
  const lock = await acquireRoomLock(redis, roomCode);
  if (!lock) return jsonError(503, 'A sala está ocupada. Tente novamente.');

  const roomKey = `pvp:room:${roomCode}`;
  try {
    const room = await redis.get(roomKey);
    if (room) rooms.set(roomCode, room);
    else rooms.delete(roomCode);

    const response = await invokeApi(request, url);
    const updatedRoom = rooms.get(roomCode);
    if (updatedRoom) {
      await redis.set(roomKey, updatedRoom, { ex: ROOM_TTL_SECONDS });
    }
    return response;
  } finally {
    rooms.delete(roomCode);
    await redis.eval(RELEASE_LOCK_SCRIPT, [lock.key], [lock.token]);
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const isCreate = url.pathname === '/api/pvp/rooms' && request.method === 'POST';
    const roomMatch = url.pathname.match(
      /^\/api\/pvp\/rooms\/([A-Z0-9]{6})(?:\/(join|team|action|leave|state))?$/i,
    );

    if (!isCreate && !roomMatch) {
      const parsed = await createNodeRequest(request);
      if (parsed.error) return parsed.error;
      return invokeApi(parsed.request, url);
    }

    const redis = getRedis();
    if (!redis) {
      return jsonError(
        503,
        'O PvP online precisa de um banco Upstash Redis conectado à Vercel.',
      );
    }

    try {
      const parsed = await createNodeRequest(request);
      if (parsed.error) return parsed.error;

      if (isCreate) return await createPersistentRoom(parsed.request, url, redis);
      return await withPersistentRoom(parsed.request, url, roomMatch[1].toUpperCase(), redis);
    } catch (error) {
      console.error('Falha no armazenamento das salas PvP:', error);
      return jsonError(503, 'Não foi possível acessar as salas PvP agora. Tente novamente.');
    }
  },
};