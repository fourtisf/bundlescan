import { redis, FEED_CHANNEL } from "./redis";
import { colorForScore } from "./score";
import type { FeedItem, ScanResult } from "./types";

/** Realtime feed plumbing — publish scored launches to the Redis channel that
 *  the SSE endpoint (/api/stream) relays to the live terminal. */

export function feedItemFromResult(result: ScanResult): FeedItem {
  return {
    mint: result.mint,
    ticker: result.ticker || result.name,
    ca: result.ca,
    score: result.score,
    tier: result.tier,
    color: result.color || colorForScore(result.score),
    insiderPct: result.insiderPct,
    scannedAt: result.scannedAt,
    agoSeconds: 0,
  };
}

export async function publishFeedItem(item: FeedItem): Promise<void> {
  await redis.publish(FEED_CHANNEL, JSON.stringify(item)).catch(() => {});
}
