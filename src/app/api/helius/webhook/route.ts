import type { NextRequest } from "next/server";
import { enqueueMint } from "@/lib/queue";
import { isValidMint } from "@/lib/util";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/helius/webhook → new-mint deploy notifications (§2 new-token
 * detection). Validates the configured auth header, extracts candidate mints
 * from the (flexible) Helius payload, and enqueues them for the worker.
 */
function extractMints(payload: unknown): string[] {
  const found = new Set<string>();
  const visit = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "mint" && typeof v === "string" && isValidMint(v)) found.add(v);
        else visit(v);
      }
    }
  };
  visit(payload);
  return [...found];
}

export async function POST(req: NextRequest) {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (secret && req.headers.get("authorization") !== secret) {
    return fail("Unauthorized", 401);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return fail("Invalid JSON", 422);
  }

  // Accept either an explicit { mints: [...] } or any Helius enhanced payload.
  const explicit = (payload as { mints?: unknown }).mints;
  const mints = Array.isArray(explicit)
    ? explicit.filter((m): m is string => typeof m === "string" && isValidMint(m))
    : extractMints(payload);

  await Promise.all(mints.map(enqueueMint));
  return ok({ enqueued: mints.length });
}
