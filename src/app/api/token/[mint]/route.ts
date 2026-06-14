import type { NextRequest } from "next/server";
import { getStoredResult } from "@/lib/scan";
import { ok, fail } from "@/lib/http";
import { isValidMint } from "@/lib/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/token/:mint → previously-scanned ScanResult (no scan triggered). */
export async function GET(_req: NextRequest, { params }: { params: { mint: string } }) {
  const mint = params.mint.trim();
  if (!isValidMint(mint)) return fail("Invalid Solana mint address", 422);

  try {
    const result = await getStoredResult(mint);
    if (!result) return fail("Not scanned yet — POST /api/scan first", 404);
    return ok(result);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Lookup failed", 503);
  }
}
