const PREFIX = 'pba:cache:v1:';

export function readCache(key, now = Date.now()) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || entry.expiresAt <= now) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

export function writeCache(key, value, ttlMs, now = Date.now()) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ expiresAt: now + Math.max(0, ttlMs), value }));
    return true;
  } catch {
    return false;
  }
}
