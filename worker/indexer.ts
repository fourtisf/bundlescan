import Redis from "ioredis";
import { SCAN_QUEUE } from "@/lib/queue";
import { scanToken } from "@/lib/scan";

/**
 * Live indexer (handoff §8). Consumes newly-detected mints from the durable
 * scan queue (fed by /api/helius/webhook) and scores each one. scanToken
 * publishes to the Redis feed channel, which powers the website's Live section.
 */
export function startIndexer(): void {
  // BRPOP needs a dedicated blocking connection, separate from the shared client.
  const conn = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

  const loop = async () => {
    console.log("[indexer] consuming", SCAN_QUEUE);
    for (;;) {
      try {
        const res = await conn.brpop(SCAN_QUEUE, 5);
        if (!res) continue; // timeout — keep polling
        const mint = res[1];
        const r = await scanToken(mint, {
          force: true,
          enhance: !!process.env.ANTHROPIC_API_KEY,
        });
        console.log(`[indexer] ${mint} → ${r.score}/${r.tier} (${r.insiderPct}% insider)`);
      } catch (e) {
        console.error("[indexer] error:", e instanceof Error ? e.message : e);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  };

  void loop();
}
