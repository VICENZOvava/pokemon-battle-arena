async function request(path, { method = 'GET', token, body, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(path, {
      method, headers, signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor online.');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Erro do servidor (${response.status}).`);
  return result;
}
export function createPvpRoom() {
  return request('/api/pvp/rooms', { method: 'POST' });
}
export function joinPvpRoom(roomCode) {
  return request(`/api/pvp/rooms/${encodeURIComponent(roomCode.toUpperCase())}/join`, { method: 'POST' });
}
export function getPvpState(session, signal) {
  return request(`/api/pvp/rooms/${encodeURIComponent(session.roomCode)}/state`, { token: session.token, signal });
}
export function setPvpTeam(session, ids) {
  return request(`/api/pvp/rooms/${encodeURIComponent(session.roomCode)}/team`, { method: 'POST', token: session.token, body: { ids } });
}
export function submitPvpAction(session, action) {
  return request(`/api/pvp/rooms/${encodeURIComponent(session.roomCode)}/action`, { method: 'POST', token: session.token, body: action });
}
export function leavePvpRoom(session) {
  if (!session) return Promise.resolve(null);
  return request(`/api/pvp/rooms/${encodeURIComponent(session.roomCode)}/leave`, { method: 'POST', token: session.token });
}