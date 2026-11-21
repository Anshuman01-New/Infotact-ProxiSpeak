/**
 * ProxiSpeak - Redis Pub/Sub Adapter Setup
 *
 * Configures Redis Pub/Sub adapter for Socket.io to allow multi-instance horizontal scaling.
 * Week 3 requirement: "Implement Redis Pub/Sub to allow scaling the Socket.io server across multiple Node instances."
 *
 * If REDIS_ENABLED is false or Redis is unreachable, the server falls back to in-memory mode.
 */

const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const config = require('./environment');

let pubClient = null;
let subClient = null;

/**
 * Attaches the Redis adapter to the Socket.io server instance if enabled.
 *
 * @param {import('socket.io').Server} io
 * @returns {Promise<boolean>} True if Redis adapter was attached, false otherwise.
 */
async function setupRedisAdapter(io) {
  if (!config.redis.enabled) {
    console.log('[Redis] Redis adapter is DISABLED. Running Socket.io in single-node in-memory mode.');
    return false;
  }

  try {
    const redisUrl = config.redis.password
      ? `redis://:${config.redis.password}@${config.redis.host}:${config.redis.port}`
      : `redis://${config.redis.host}:${config.redis.port}`;

    console.log(`[Redis] Connecting to Redis Pub/Sub at ${config.redis.host}:${config.redis.port}...`);

    pubClient = createClient({ url: redisUrl });
    subClient = pubClient.duplicate();

    pubClient.on('error', (err) => console.error('[Redis Pub Error]:', err.message));
    subClient.on('error', (err) => console.error('[Redis Sub Error]:', err.message));

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Redis] Socket.io Redis adapter successfully initialized and attached.');
    return true;
  } catch (error) {
    console.warn(`[Redis Warning] Failed to initialize Redis adapter: ${error.message}`);
    console.warn('[Redis Warning] Falling back to default in-memory Socket.io adapter.');
    return false;
  }
}

/**
 * Gracefully close Redis connections on shutdown.
 */
async function closeRedis() {
  try {
    if (pubClient && pubClient.isOpen) await pubClient.quit();
    if (subClient && subClient.isOpen) await subClient.quit();
    console.log('[Redis] Redis clients disconnected cleanly.');
  } catch (err) {
    console.error('[Redis] Error disconnecting Redis clients:', err.message);
  }
}

module.exports = {
  setupRedisAdapter,
  closeRedis,
};
