import type { NextRequest } from "next/server";
import { webhookCallback } from "grammy";
import { createBot } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/telegram/webhook → Telegram updates (§8). Alternative to the
 * worker's long-polling mode; register this URL via setWebhook with a secret
 * token (TELEGRAM_WEBHOOK_SECRET), which grammY validates against the
 * X-Telegram-Bot-Api-Secret-Token header.
 */
let handler: ((req: Request) => Promise<Response>) | null = null;

function getHandler() {
  if (!handler) {
    const bot = createBot();
    handler = webhookCallback(bot, "std/http", {
      secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
    });
  }
  return handler;
}

export async function POST(req: NextRequest) {
  try {
    return await getHandler()(req);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "error", { status: 500 });
  }
}
