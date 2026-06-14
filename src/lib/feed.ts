import { prisma } from "./prisma";
import { colorForScore } from "./score";
import { shortAddr } from "./util";
import type { FeedItem, ShameItem } from "./types";

/** Live feed + hall of shame queries (handoff §8). */

export type ShameRange = "day" | "week" | "month" | "all";

function sinceFor(range: ShameRange): Date | undefined {
  const now = Date.now();
  switch (range) {
    case "day":
      return new Date(now - 24 * 60 * 60 * 1000);
    case "week":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "month":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    default:
      return undefined;
  }
}

export async function getFeed(limit = 20): Promise<FeedItem[]> {
  const rows = await prisma.token.findMany({
    orderBy: { scannedAt: "desc" },
    take: Math.min(100, Math.max(1, limit)),
  });
  const now = Date.now();
  return rows.map((t) => ({
    mint: t.mint,
    ticker: t.ticker || t.name || shortAddr(t.mint),
    ca: shortAddr(t.mint),
    score: t.score,
    tier: t.tier as FeedItem["tier"],
    color: colorForScore(t.score),
    insiderPct: t.insiderPct,
    scannedAt: t.scannedAt.toISOString(),
    agoSeconds: Math.max(0, Math.round((now - t.scannedAt.getTime()) / 1000)),
  }));
}

export async function getShame(range: ShameRange = "week", limit = 10): Promise<ShameItem[]> {
  const since = sinceFor(range);
  const rows = await prisma.token.findMany({
    where: since ? { scannedAt: { gte: since } } : undefined,
    orderBy: [{ score: "asc" }, { insiderPct: "desc" }],
    take: Math.min(50, Math.max(1, limit)),
  });
  return rows.map((t, i) => ({
    rank: i + 1,
    mint: t.mint,
    ticker: t.ticker || t.name || shortAddr(t.mint),
    ca: shortAddr(t.mint),
    score: t.score,
    tier: t.tier as ShameItem["tier"],
    insiderPct: t.insiderPct,
  }));
}
