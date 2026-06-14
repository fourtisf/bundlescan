import type { NextRequest } from "next/server";
import { z } from "zod";
import { redis } from "@/lib/redis";
import { verifyWalletSignature, signSession, SESSION_COOKIE, cookieOptions } from "@/lib/auth";
import { ensureUser } from "@/lib/watchlist";
import { effectiveTier } from "@/lib/subscribe";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  wallet: z.string().min(32).max(50),
  signature: z.string().min(1),
});

/** POST /api/auth/verify { wallet, signature } → set session cookie (§11). */
export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return fail("Body must be { wallet, signature }", 422);
  }
  const wallet = parsed.wallet.trim();

  const nonce = await redis.get(`nonce:${wallet}`);
  if (!nonce) return fail("Nonce expired — request a new one", 401);

  const message = `BundleScan login: ${nonce}`;
  if (!verifyWalletSignature(wallet, message, parsed.signature)) {
    return fail("Signature verification failed", 401);
  }
  await redis.del(`nonce:${wallet}`);

  const user = await ensureUser(wallet);
  const res = ok({ wallet, tier: effectiveTier(user) });
  res.cookies.set(SESSION_COOKIE, signSession(wallet), cookieOptions);
  return res;
}
