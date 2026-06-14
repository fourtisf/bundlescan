import { Bot } from "grammy";
import { scanToken } from "./scan";
import { prisma } from "./prisma";
import { redis } from "./redis";
import { effectiveTier } from "./subscribe";
import { addToWatchlist, tierMeets } from "./watchlist";
import { isValidMint } from "./util";
import type { ScanResult } from "./types";

/**
 * Telegram bot (handoff §9). Commands: /scan, /watch (operator+), /link, /help.
 * Verdicts are formatted from stored numeric features — the bot never invents
 * data. Telegram chat ↔ wallet links live in Redis (no schema change); a chat
 * is linked by asserting a wallet, which gates /watch on that wallet's tier.
 */

const base = () => (process.env.PUBLIC_BASE_URL || "https://bundlescan.io").replace(/\/$/, "");

export function formatScanReply(r: ScanResult): string {
  const webUrl = `${base()}/?mint=${r.mint}`;
  const cardUrl = `${base()}/api/card/${r.mint}.png`;
  return [
    `*${r.name}* ${r.ticker ? `(${r.ticker})` : ""}`,
    `Launch Health: *${r.score}/100* — _${r.tier}_`,
    `Insider supply: *${r.insiderPct}%* · still held: *${r.insiderHeldPct}%*`,
    `${r.bundledCount} bundled · ${r.sniperCount} snipers${r.singleFunder ? " · single funder" : ""}`,
    "",
    r.verdict,
    "",
    `[Full result](${webUrl}) · [Share card](${cardUrl})`,
  ].join("\n");
}

async function walletForChat(chatId: number): Promise<string | null> {
  return redis.get(`tg:wallet:${chatId}`).catch(() => null);
}

export function createBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const bot = new Bot(token);

  bot.command("start", (ctx) =>
    ctx.reply(
      "BundleScan — block-zero launch forensics for Solana.\n\n" +
        "/scan <CA> — X-ray a launch\n" +
        "/watch <CA> — track insider supply (Operator+)\n" +
        "/link <wallet> — link your subscription wallet\n" +
        "/help — show this",
    ),
  );
  bot.command("help", (ctx) => ctx.reply("/scan <CA> · /watch <CA> · /link <wallet>"));

  bot.command("scan", async (ctx) => {
    const mint = (ctx.match || "").trim();
    if (!isValidMint(mint)) return ctx.reply("Usage: /scan <mint address>");
    const status = await ctx.reply("Replaying block zero…");
    try {
      const result = await scanToken(mint, { enhance: !!process.env.ANTHROPIC_API_KEY });
      await ctx.api.editMessageText(ctx.chat.id, status.message_id, formatScanReply(result), {
        parse_mode: "Markdown",
        link_preview_options: { is_disabled: true },
      });
    } catch (e) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        status.message_id,
        `Scan failed: ${e instanceof Error ? e.message : "unknown error"}`,
      );
    }
  });

  bot.command("link", async (ctx) => {
    const wallet = (ctx.match || "").trim();
    if (!isValidMint(wallet)) return ctx.reply("Usage: /link <your Solana wallet>");
    await redis.set(`tg:wallet:${ctx.chat.id}`, wallet);
    await redis.set(`tg:chat:${wallet}`, String(ctx.chat.id));
    await ctx.reply(
      "Wallet linked. Movement alerts for your watched tokens will arrive here.\n" +
        "Note: confirm ownership at bundlescan.io to unlock Operator features.",
    );
  });

  bot.command("watch", async (ctx) => {
    const mint = (ctx.match || "").trim();
    if (!isValidMint(mint)) return ctx.reply("Usage: /watch <mint address>");
    const wallet = await walletForChat(ctx.chat.id);
    if (!wallet) return ctx.reply("Link your wallet first: /link <wallet>");

    const user = await prisma.user.findUnique({ where: { wallet } });
    const tier = user ? effectiveTier(user) : "scout";
    if (!tierMeets(tier, "operator")) {
      return ctx.reply("Watchlist requires an Operator subscription. Upgrade at bundlescan.io.");
    }
    await addToWatchlist(wallet, mint);
    await ctx.reply(`Watching ${mint}. I'll DM you if the insider cluster starts selling.`);
  });

  return bot;
}
