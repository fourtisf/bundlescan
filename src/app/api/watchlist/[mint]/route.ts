import type { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { removeFromWatchlist, listWatchlist } from "@/lib/watchlist";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/watchlist/:mint → remove from the caller's watchlist (§8). */
export async function DELETE(req: NextRequest, { params }: { params: { mint: string } }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return fail("Not authenticated", 401);
    await removeFromWatchlist(user.wallet, params.mint.trim());
    return ok({ watchlist: await listWatchlist(user.wallet) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Update failed", 503);
  }
}
