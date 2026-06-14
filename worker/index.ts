import "dotenv/config";
import type { Bot } from "grammy";
import { startIndexer } from "./indexer";
import { startAlerts } from "./alerts";
import { createBot } from "@/lib/telegram";

/**
 * BundleScan worker (handoff §2). Runs under PM2 as a separate process from the
 * Next web server, sharing the same lib/ pipeline. WORKER_MODE selects which
 * subsystems run: all | indexer | alerts | bot.
 */
async function main() {
  const mode = process.env.WORKER_MODE || "all";
  console.log(`[worker] starting (mode=${mode})`);

  let bot: Bot | null = null;
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      bot = createBot();
    } catch (e) {
      console.error("[worker] bot init failed:", e instanceof Error ? e.message : e);
    }
  }

  if (mode === "all" || mode === "indexer") startIndexer();
  if (mode === "all" || mode === "alerts") startAlerts(bot);

  // Long-poll the bot only when no webhook is configured (otherwise the Next
  // route /api/telegram/webhook handles updates).
  if ((mode === "all" || mode === "bot") && bot && !process.env.TELEGRAM_WEBHOOK_URL) {
    bot.start({
      onStart: (i) => console.log(`[worker] telegram polling as @${i.username}`),
    });
  }

  console.log("[worker] up");
}

main().catch((e) => {
  console.error("[worker] fatal:", e);
  process.exit(1);
});
