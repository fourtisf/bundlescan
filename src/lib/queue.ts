import { redis } from "./redis";

/**
 * Durable scan queue (handoff §8). The Helius webhook LPUSHes newly-detected
 * mints; the worker BRPOPs and scans them. A list (not pub/sub) so deploys
 * aren't dropped while the worker restarts.
 */
export const SCAN_QUEUE = "bundlescan:scanqueue";

export async function enqueueMint(mint: string): Promise<void> {
  // Dedup against an in-flight set with a short TTL so a burst of webhook
  // events for the same launch doesn't enqueue it repeatedly.
  const fresh = await redis.set(`enq:${mint}`, "1", "EX", 120, "NX");
  if (fresh) await redis.lpush(SCAN_QUEUE, mint);
}
