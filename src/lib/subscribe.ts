import { prisma } from "./prisma";
import { SUB_DURATION_DAYS } from "./config";
import { verifySolPayment } from "./solana";

/** Redeem a SOL payment into a tier upgrade (handoff §11). */

export interface SubscribeResult {
  wallet: string;
  tier: string;
  amountSol: number;
  expiresAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function applySubscription(txSig: string): Promise<SubscribeResult> {
  // Replay protection: a given tx can only ever be redeemed once.
  const existing = await prisma.subscription.findUnique({ where: { txSig } });
  if (existing) throw new Error("This payment has already been redeemed");

  const payment = await verifySolPayment(txSig);

  const user = await prisma.user.findUnique({ where: { wallet: payment.wallet } });
  const now = Date.now();
  // Stack on top of any remaining time the user already has.
  const base =
    user?.subExpiresAt && user.subExpiresAt.getTime() > now
      ? user.subExpiresAt.getTime()
      : now;
  const expiresAt = new Date(base + SUB_DURATION_DAYS * DAY_MS);

  await prisma.$transaction([
    prisma.user.upsert({
      where: { wallet: payment.wallet },
      create: { wallet: payment.wallet, tier: payment.tier, subExpiresAt: expiresAt },
      update: { tier: payment.tier, subExpiresAt: expiresAt },
    }),
    prisma.subscription.create({
      data: {
        userWallet: payment.wallet,
        txSig: payment.txSig,
        amountSol: payment.amountSol,
        tier: payment.tier,
        expiresAt,
      },
    }),
  ]);

  return {
    wallet: payment.wallet,
    tier: payment.tier,
    amountSol: payment.amountSol,
    expiresAt: expiresAt.toISOString(),
  };
}

/** Resolve a user's effective tier, accounting for expiry. */
export function effectiveTier(user: {
  tier: string;
  subExpiresAt: Date | null;
}): string {
  if (user.tier === "scout") return "scout";
  if (!user.subExpiresAt || user.subExpiresAt.getTime() < Date.now()) return "scout";
  return user.tier;
}
