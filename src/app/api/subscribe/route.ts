import type { NextRequest } from "next/server";
import { z } from "zod";
import { applySubscription } from "@/lib/subscribe";
import { signSession, SESSION_COOKIE, cookieOptions } from "@/lib/auth";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ txSig: z.string().min(32) });

/** POST /api/subscribe { txSig } → verify SOL payment, set tier (§11). */
export async function POST(req: NextRequest) {
  let txSig: string;
  try {
    txSig = Body.parse(await req.json()).txSig.trim();
  } catch {
    return fail("Body must be { txSig }", 422);
  }

  try {
    const result = await applySubscription(txSig);
    // The payment proves wallet ownership → issue a session for convenience.
    const res = ok(result);
    res.cookies.set(SESSION_COOKIE, signSession(result.wallet), cookieOptions);
    return res;
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Subscription failed", 400);
  }
}
