import { prisma } from "./prisma";
import { SCOUT_DAILY_SCANS } from "./config";

/**
 * Scout rate limiting (handoff §8): 5 scans/day by IP + wallet via ScanLog.
 * Operator/Syndicate are unlimited.
 */

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  limit: number;
}

export interface RateLimitCtx {
  ip?: string | null;
  wallet?: string | null;
  tier?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function checkScoutRateLimit(ctx: RateLimitCtx): Promise<RateLimitInfo> {
  const limit = SCOUT_DAILY_SCANS;
  if (ctx.tier && ctx.tier !== "scout") {
    return { allowed: true, remaining: Infinity, limit: Infinity };
  }

  const since = new Date(Date.now() - DAY_MS);
  const ors: Array<Record<string, unknown>> = [];
  if (ctx.wallet) ors.push({ userWallet: ctx.wallet });
  if (ctx.ip) ors.push({ ip: ctx.ip });
  if (ors.length === 0) return { allowed: true, remaining: limit, limit };

  const used = await prisma.scanLog.count({
    where: { createdAt: { gte: since }, OR: ors },
  });
  const remaining = Math.max(0, limit - used);
  return { allowed: used < limit, remaining, limit };
}

export async function logScan(ctx: RateLimitCtx & { mint: string }): Promise<void> {
  await prisma.scanLog.create({
    data: { ip: ctx.ip ?? null, userWallet: ctx.wallet ?? null, mint: ctx.mint },
  });
}
