import type { NextRequest } from "next/server";
import { getShame, type ShameRange } from "@/lib/feed";
import { ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGES: ShameRange[] = ["day", "week", "month", "all"];

/** GET /api/shame?range=week&limit=10 → worst launches (hall of shame, §8). */
export async function GET(req: NextRequest) {
  const rangeParam = req.nextUrl.searchParams.get("range") || "week";
  const range = (RANGES.includes(rangeParam as ShameRange) ? rangeParam : "week") as ShameRange;
  const limit = Number(req.nextUrl.searchParams.get("limit") || 10);
  try {
    const items = await getShame(range, Number.isFinite(limit) ? limit : 10);
    return ok({ range, items });
  } catch {
    // Degrade gracefully — the client keeps its static fallback list.
    return ok({ range, items: [] });
  }
}
