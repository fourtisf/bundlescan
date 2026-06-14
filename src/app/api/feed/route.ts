import type { NextRequest } from "next/server";
import { getFeed } from "@/lib/feed";
import { ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/feed?limit=20 → recent scored launches (live feed, §8). */
export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") || 20);
  try {
    const items = await getFeed(Number.isFinite(limit) ? limit : 20);
    return ok({ items });
  } catch {
    // Degrade gracefully — the client falls back to its simulated ticker.
    return ok({ items: [] });
  }
}
