/**
 * Tunable constants for the forensic pipeline (handoff §6/§7/§9/§13).
 * Everything that ALFA may want to tune on real launches lives here so the
 * scoring math can be adjusted without touching the algorithms. Re-scoring from
 * `Token.raw` (see lib/score.ts `rescore`) lets weight changes apply cheaply.
 */

const num = (v: string | undefined, fallback: number): number => {
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Replay/detection windows, in slots after the deploy slot. */
export const WINDOW_BLOCKS = num(process.env.WINDOW_BLOCKS, 12); // §6.1
export const SNIPE_BLOCKS = num(process.env.SNIPE_BLOCKS, 2); // §6.3

/** Held-vs-dumped thresholds (§6.6), as a fraction of acquired supply. */
export const HOLDING_THRESHOLD = num(process.env.HOLDING_THRESHOLD, 0.9);
export const DUMPED_THRESHOLD = num(process.env.DUMPED_THRESHOLD, 0.1);

/** Movement-alert sensitivity (§9): drop in insiderHeldPct between passes. */
export const ALERT_DROP = num(process.env.ALERT_DROP, 8);

/** Launch Health Score weights (§7). risk → score = clamp(0,100, 100 - risk). */
export const SCORE_WEIGHTS = {
  insider: num(process.env.W_INSIDER, 0.55),
  bundle: num(process.env.W_BUNDLE, 0.2),
  sniper: num(process.env.W_SNIPER, 0.1),
  loadedGun: num(process.env.W_LOADED_GUN, 0.15), // × insiderPct × heldFraction
  singleFunder: num(process.env.W_SINGLE_FUNDER, 15), // flat add
  devLinkedSnipers: num(process.env.W_DEV_SNIPERS, 10), // flat add
} as const;

/** Tier thresholds (§7). Lower bound inclusive. */
export const TIERS = [
  { name: "TRAP", min: 0, max: 24, color: "var(--signal)" },
  { name: "RIGGED", min: 25, max: 54, color: "var(--signal-2)" },
  { name: "MILD", min: 55, max: 79, color: "var(--mild)" },
  { name: "CLEAN", min: 80, max: 100, color: "var(--clean)" },
] as const;

export type TierName = (typeof TIERS)[number]["name"];

/** Cache + rate-limit knobs. */
export const SCAN_CACHE_TTL_SECONDS = num(process.env.SCAN_CACHE_TTL, 600); // 10m (§2 / Prompt 5)
export const SCOUT_DAILY_SCANS = num(process.env.SCOUT_DAILY_SCANS, 5); // §8 rate limit

/** Subscription pricing & duration (§11). Placeholders — ALFA to finalize. */
export const PRICE_OPERATOR_SOL = num(process.env.PRICE_OPERATOR_SOL, 2);
export const PRICE_SYNDICATE_SOL = num(process.env.PRICE_SYNDICATE_SOL, 8);
export const SUB_DURATION_DAYS = num(process.env.SUB_DURATION_DAYS, 30);
/** How recent a payment tx must be to be accepted (anti-replay window). */
export const PAYMENT_MAX_AGE_SECONDS = num(process.env.PAYMENT_MAX_AGE, 60 * 60 * 24);

export const TOTAL_SUPPLY_FALLBACK = 1_000_000_000; // pump.fun default mint supply

/**
 * Free-stack realtime config (no paid Helius). New launches stream from the
 * PumpPortal WebSocket (free, no key); on-demand scans of arbitrary mints use a
 * free public RPC. Helius stays optional — set HELIUS_API_KEY to upgrade
 * precision/limits, otherwise everything runs on free infrastructure.
 */
export const PUMPPORTAL_WS_URL =
  process.env.PUMPPORTAL_WS_URL || "wss://pumpportal.fun/api/data";

/** Free public RPC fallback when no Helius key is present (no key required). */
export const FREE_RPC_URL =
  process.env.RPC_URL || "https://solana-rpc.publicnode.com";

/** Live forensic windows (time-based, since the WS stream has no slot numbers). */
export const LIVE_WINDOW_MS = num(process.env.LIVE_WINDOW_MS, 8000); // total insider window
export const BUNDLE_WINDOW_MS = num(process.env.BUNDLE_WINDOW_MS, 1500); // bundle vs sniper cut
/** Max concurrent token-trade subscriptions held open on the WS. */
export const LIVE_MAX_TRACKED = num(process.env.LIVE_MAX_TRACKED, 200);

/**
 * Hybrid indexer (PumpPortal trigger → light RPC replay). PumpPortal catches new
 * mints free/realtime; a cheap slot-level RPC replay then catches the atomic
 * bundle the WS stream can't see. Throttled to stay within free-RPC limits.
 */
export const LIVE_SCAN_CONCURRENCY = num(process.env.LIVE_SCAN_CONCURRENCY, 2);
export const LIVE_SCAN_DELAY_MS = num(process.env.LIVE_SCAN_DELAY_MS, 4000); // let blocks settle
export const LIVE_QUEUE_MAX = num(process.env.LIVE_QUEUE_MAX, 40); // backlog cap → sample/drop excess
/** Spam guard: skip launches whose create raised less than this many SOL. */
export const MIN_SOL_RAISED = num(process.env.MIN_SOL_RAISED, 0);
