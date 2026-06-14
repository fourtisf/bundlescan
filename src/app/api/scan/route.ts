import type { NextRequest } from "next/server";
import { z } from "zod";
import { scanToken } from "@/lib/scan";
import { checkScoutRateLimit, logScan } from "@/lib/ratelimit";
import { getAuthUser } from "@/lib/auth";
import { ok, fail, getClientIp } from "@/lib/http";
import { isValidMint } from "@/lib/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ mint: z.string().min(32).max(50) });

/** POST /api/scan { mint } → ScanResult (cached; scans synchronously if missing). */
export async function POST(req: NextRequest) {
  let mint: string;
  try {
    mint = Body.parse(await req.json()).mint.trim();
  } catch {
    return fail("Body must be { mint: string }", 422);
  }
  if (!isValidMint(mint)) return fail("Invalid Solana mint address", 422);

  const ip = getClientIp(req);
  const user = await getAuthUser(req);

  const rl = await checkScoutRateLimit({ ip, wallet: user?.wallet, tier: user?.tier });
  if (!rl.allowed) {
    return fail("Daily scan limit reached — upgrade to Operator for unlimited scans.", 429, {
      remaining: 0,
      limit: rl.limit,
    });
  }

  try {
    const result = await scanToken(mint, { enhance: !!process.env.ANTHROPIC_API_KEY });
    // Only count a scan against the quota once it actually ran fresh.
    if (!result.cached) await logScan({ ip, wallet: user?.wallet, mint });
    return ok({ ...result, rateLimit: { remaining: rl.remaining, limit: rl.limit } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Scan failed";
    const status = /no transaction history|not found/i.test(msg) ? 404 : 502;
    return fail(msg, status);
  }
}
