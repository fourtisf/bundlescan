import type { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { listWatchlist } from "@/lib/watchlist";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/me → authenticated user + tier + watchlist (§8). */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return fail("Not authenticated", 401);
    const watchlist = await listWatchlist(user.wallet);
    return ok({ ...user, watchlist });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Lookup failed", 503);
  }
}
