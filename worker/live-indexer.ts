import { PumpPortalClient, type PumpCreateEvent, type PumpTradeEvent } from "@/lib/pumpportal";
import { startLiveLaunch, applyTrade, finalizeAndStore, type LiveLaunch } from "@/lib/livescan";
import { LIVE_WINDOW_MS, LIVE_MAX_TRACKED } from "@/lib/config";

/**
 * Free realtime indexer (no Helius). Subscribes to every new pump.fun launch via
 * the PumpPortal WebSocket, watches its first LIVE_WINDOW_MS of trades, then
 * scores + stores + streams it to the live terminal.
 */
export function startLiveIndexer(): void {
  const client = new PumpPortalClient();
  const active = new Map<string, LiveLaunch>();

  const finalize = async (mint: string) => {
    const launch = active.get(mint);
    if (!launch) return;
    active.delete(mint);
    client.unsubscribeTokenTrade([mint]);
    try {
      const r = await finalizeAndStore(launch);
      console.log(`[live] ${r.ticker || r.mint} → ${r.score}/${r.tier} (${r.insiderPct}% insider, ${launch.wallets.size} wallets)`);
    } catch (e) {
      console.error("[live] finalize error:", e instanceof Error ? e.message : e);
    }
  };

  client.on("open", () => {
    console.log("[live] PumpPortal connected — subscribing to new tokens");
    client.subscribeNewToken();
  });

  client.on("newToken", (ev: PumpCreateEvent) => {
    if (!ev.mint || active.has(ev.mint)) return;
    const launch = startLiveLaunch(ev);
    active.set(ev.mint, launch);
    // Bound WS load: only follow trades if we're under the tracking cap.
    if (active.size <= LIVE_MAX_TRACKED) client.subscribeTokenTrade([ev.mint]);
    setTimeout(() => void finalize(ev.mint), LIVE_WINDOW_MS);
  });

  client.on("trade", (ev: PumpTradeEvent) => {
    const launch = active.get(ev.mint);
    if (launch) applyTrade(launch, ev);
  });

  client.on("error", (e) => console.error("[live] ws error:", e.message));

  client.connect();
  console.log("[live] free realtime indexer started");
}
