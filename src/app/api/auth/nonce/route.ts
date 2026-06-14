import type { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { redis } from "@/lib/redis";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ wallet: z.string().min(32).max(50) });

/** POST /api/auth/nonce { wallet } → a one-time message to sign (§11 connect). */
export async function POST(req: NextRequest) {
  let wallet: string;
  try {
    wallet = Body.parse(await req.json()).wallet.trim();
  } catch {
    return fail("Body must be { wallet }", 422);
  }
  const nonce = randomBytes(16).toString("hex");
  await redis.set(`nonce:${wallet}`, nonce, "EX", 300);
  return ok({ nonce, message: `BundleScan login: ${nonce}` });
}
