import Redis from "ioredis";

/**
 * Redis is used for: scan-result caching (10m TTL, §2) and pub/sub between the
 * indexer worker and the web layer for the live feed (§8). Two connections are
 * exposed because a connection in subscriber mode can't issue normal commands.
 */
const globalForRedis = globalThis as unknown as {
  redis?: Redis;
  redisSub?: Redis;
};

const url = process.env.REDIS_URL || "redis://localhost:6379";

const make = () =>
  new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  });

export const redis = globalForRedis.redis ?? make();
/** Dedicated connection for SUBSCRIBE (cannot run normal commands). */
export const redisSub = globalForRedis.redisSub ?? make();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
  globalForRedis.redisSub = redisSub;
}

/** Redis pub/sub channel for newly-scored launches (powers the live feed). */
export const FEED_CHANNEL = "bundlescan:feed";
