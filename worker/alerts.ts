import type { Bot } from "grammy";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { scanToken } from "@/lib/scan";
import { ALERT_DROP } from "@/lib/config";

/**
 * Movement alerts (handoff §9). Each pass re-scans every watched token and
 * compares insiderHeldPct against the previous pass; a drop of ≥ ALERT_DROP
 * points means the insider cluster started selling → DM the watchers.
 */
export function startAlerts(bot: Bot | null): void {
  const intervalMs = Number(process.env.ALERT_INTERVAL_MS || 60_000);

  const pass = async () => {
    const mints = await prisma.watchlist.findMany({
      distinct: ["mint"],
      select: { mint: true },
    });
    for (const { mint } of mints) {
      try {
        const prevRaw = await redis.get(`held:${mint}`);
        const result = await scanToken(mint, { force: true });
        await redis.set(`held:${mint}`, String(result.insiderHeldPct));
        if (prevRaw == null) continue;
        const prev = Number(prevRaw);
        const drop = prev - result.insiderHeldPct;
        if (drop >= ALERT_DROP) {
          await notifyWatchers(mint, prev, result.insiderHeldPct, bot);
        }
      } catch (e) {
        console.error("[alerts]", mint, e instanceof Error ? e.message : e);
      }
    }
  };

  setInterval(() => void pass(), intervalMs);
  void pass();
  console.log(`[alerts] movement watch every ${intervalMs}ms (drop ≥ ${ALERT_DROP}pts)`);
}

async function notifyWatchers(
  mint: string,
  prev: number,
  now: number,
  bot: Bot | null,
): Promise<void> {
  const watchers = await prisma.watchlist.findMany({
    where: { mint },
    include: { user: true },
  });
  const msg =
    `⚠️ Insider cluster moving on ${mint}\n` +
    `Held ${prev}% → ${now}% (−${(prev - now).toFixed(1)} pts). They may be exiting — check the chart.`;

  for (const w of watchers) {
    const chatId = await redis.get(`tg:chat:${w.user.wallet}`).catch(() => null);
    if (chatId && bot) {
      await bot.api.sendMessage(chatId, msg).catch(() => {});
    }
  }
}
