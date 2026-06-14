import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth";
import { addToWatchlist, listWatchlist, tierMeets } from "@/lib/watchlist";
import { ok, fail } from "@/lib/http";
import { isValidMint } from "@/lib/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ mint: z.string().min(32).max(50) });

/** GET /api/watchlist → caller's watched mints. */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return fail("Not authenticated", 401);
    return ok({ watchlist: await listWatchlist(user.wallet) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Lookup failed", 503);
  }
}

/** POST /api/watchlist { mint } → add (operator+ only, §8/§11). */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return fail("Not authenticated", 401);
  if (!tierMeets(user.tier, "operator")) {
    return fail("Watchlist requires an Operator subscription", 403);
  }

  let mint: string;
  try {
    mint = Body.parse(await req.json()).mint.trim();
  } catch {
    return fail("Body must be { mint }", 422);
  }
  if (!isValidMint(mint)) return fail("Invalid Solana mint address", 422);

  try {
    await addToWatchlist(user.wallet, mint);
    return ok({ watchlist: await listWatchlist(user.wallet) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Update failed", 503);
  }
}
