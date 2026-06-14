import type { NextRequest } from "next/server";
import Redis from "ioredis";
import { FEED_CHANNEL } from "@/lib/redis";
import { getFeed } from "@/lib/feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stream → Server-Sent Events of scored launches in realtime. Relays
 * the Redis pub/sub feed channel (published by the live indexer / scanner) to
 * the browser's live terminal — push, not polling.
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const sub = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      send("hello", { ok: true, ts: Date.now() });

      // Seed with the most recent launches so the terminal isn't empty.
      try {
        const recent = await getFeed(15);
        for (const item of recent.reverse()) send("launch", item);
      } catch {
        /* DB not ready — stream live-only */
      }

      try {
        await sub.connect();
        await sub.subscribe(FEED_CHANNEL);
        sub.on("message", (_ch, payload) => {
          try {
            controller.enqueue(encoder.encode(`event: launch\ndata: ${payload}\n\n`));
          } catch {
            /* controller closed */
          }
        });
      } catch {
        send("error", { message: "feed unavailable" });
      }

      // Keep-alive comment every 25s (prevents proxy idle timeouts).
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 25_000);

      const cleanup = () => {
        clearInterval(ping);
        sub.removeAllListeners();
        sub.quit().catch(() => sub.disconnect());
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      sub.removeAllListeners();
      sub.quit().catch(() => sub.disconnect());
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no", // disable nginx buffering for SSE
    },
  });
}
