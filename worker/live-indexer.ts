import { PumpPortalClient, type PumpCreateEvent } from "@/lib/pumpportal";
import { lightScan } from "@/lib/lightscan";
import {
  LIVE_SCAN_CONCURRENCY,
  LIVE_SCAN_DELAY_MS,
  LIVE_QUEUE_MAX,
  MIN_SOL_RAISED,
} from "@/lib/config";

/**
 * Hybrid realtime indexer (free). PumpPortal WS = free realtime trigger for new
 * pump.fun mints; each one is then scored with a cheap slot-level RPC replay that
 * catches the atomic bundle (the WS stream can't). Throttled + sampled so it
 * stays within free-RPC limits.
 */
interface Job {
  mint: string;
  meta: { name?: string; ticker?: string; marketCapSol?: number };
}

export function startLiveIndexer(): void {
  const client = new PumpPortalClient();
  const queue: Job[] = [];
  const seen = new Set<string>();
  let active = 0;
  let scanned = 0;
  let skipped = 0;

  const pump = () => {
    while (active < LIVE_SCAN_CONCURRENCY && queue.length > 0) {
      const job = queue.shift()!;
      active++;
      // Delay so the deploy slot + first blocks are on-chain before we replay.
      setTimeout(async () => {
        try {
          const r = await lightScan(job.mint, job.meta);
          scanned++;
          // Log the interesting ones (and an occasional heartbeat).
          if (r.tier === "TRAP" || r.tier === "RIGGED" || scanned % 10 === 0) {
            console.log(
              `[live] ${r.ticker || r.mint} → ${r.score}/${r.tier} ` +
                `(${r.insiderPct}% insider · ${r.bundledCount}b/${r.sniperCount}s)`,
            );
          }
        } catch (e) {
          console.error("[live] scan failed", job.mint, e instanceof Error ? e.message : e);
        } finally {
          active--;
          pump();
        }
      }, LIVE_SCAN_DELAY_MS);
    }
  };

  client.on("open", () => {
    console.log("[live] PumpPortal connected — subscribing to new tokens");
    client.subscribeNewToken();
  });

  client.on("newToken", (ev: PumpCreateEvent) => {
    if (!ev.mint || seen.has(ev.mint)) return;
    // Spam guard: skip launches that raised less than the floor at create.
    const raised = ev.solAmount ?? ev.marketCapSol ?? 0;
    if (MIN_SOL_RAISED > 0 && raised < MIN_SOL_RAISED) {
      skipped++;
      return;
    }
    seen.add(ev.mint);
    if (seen.size > 5000) seen.clear(); // bound memory
    // Cost guard: if the backlog is full, sample (drop) rather than blow RPC limits.
    if (queue.length >= LIVE_QUEUE_MAX) {
      skipped++;
      return;
    }
    queue.push({
      mint: ev.mint,
      meta: { name: ev.name, ticker: ev.symbol, marketCapSol: ev.marketCapSol },
    });
    pump();
  });

  client.on("error", (e) => console.error("[live] ws error:", e.message));
  client.connect();

  setInterval(
    () =>
      console.log(
        `[live] queue=${queue.length} active=${active} scanned=${scanned} skipped=${skipped}`,
      ),
    30_000,
  );
  console.log("[live] hybrid realtime indexer started (PumpPortal → light RPC replay)");
}
