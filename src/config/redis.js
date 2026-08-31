const Redis = require('ioredis');

let client = null;

/**
 * StreamX uses Redis for caching popular content (Trending, Homepage,
 * Search results) so we don't hammer the external content API on every
 * request. This is OPTIONAL in Grade 1 — if REDIS_URL is not set, the
 * app still runs fine, just without caching (cache functions become no-ops).
 */
if (process.env.REDIS_URL) {
  client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
  });

  client.on('connect', () => console.log('[Redis] Connected'));
  client.on('error', (err) => console.error('[Redis] Error:', err.message));
} else {
  console.warn('[Redis] REDIS_URL not set — running without cache (fine for Grade 1).');
}

/**
 * Get a cached JSON value by key. Returns null if not found or if
 * Redis is not configured.
 */
const getCache = async (key) => {
  if (!client) return null;
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('[Redis] getCache error:', err.message);
    return null;
  }
};

/**
 * Store a JSON value under a key with an expiry (in seconds).
 * Silently does nothing if Redis is not configured.
 */
const setCache = async (key, value, ttlSeconds = 3600) => {
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.error('[Redis] setCache error:', err.message);
  }
};

module.exports = { client, getCache, setCache };
