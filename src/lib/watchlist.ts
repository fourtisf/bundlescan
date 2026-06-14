import { prisma } from "./prisma";

/** Watchlist + feature gating (handoff §8/§11). */

const ORDER: Record<string, number> = { scout: 0, operator: 1, syndicate: 2 };

/** True if `tier` meets or exceeds `min`. */
export function tierMeets(tier: string, min: string): boolean {
  return (ORDER[tier] ?? 0) >= (ORDER[min] ?? 0);
}

export async function ensureUser(wallet: string) {
  return prisma.user.upsert({
    where: { wallet },
    create: { wallet },
    update: {},
  });
}

export async function addToWatchlist(wallet: string, mint: string) {
  const user = await ensureUser(wallet);
  return prisma.watchlist.upsert({
    where: { userId_mint: { userId: user.id, mint } },
    create: { userId: user.id, mint },
    update: {},
  });
}

export async function removeFromWatchlist(wallet: string, mint: string) {
  const user = await prisma.user.findUnique({ where: { wallet } });
  if (!user) return;
  await prisma.watchlist.deleteMany({ where: { userId: user.id, mint } });
}

export async function listWatchlist(wallet: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { wallet },
    include: { watchlist: true },
  });
  return user?.watchlist.map((w) => w.mint) ?? [];
}
