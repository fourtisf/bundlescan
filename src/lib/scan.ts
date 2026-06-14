import type { Token, Wallet } from "@prisma/client";
import { prisma } from "./prisma";
import { redis, FEED_CHANNEL } from "./redis";
import { SCAN_CACHE_TTL_SECONDS } from "./config";
import { replayLaunch, getTokenMeta } from "./chain";
import { analyzeLaunch, type AnalyzeDeps } from "./detect";
import { scoreLaunch } from "./score";
import { buildVerdict, buildNote, buildStats, enhanceVerdict } from "./verdict";
import { isValidMint, shortAddr, bigintReplacer } from "./util";
import type {
  FeedItem,
  LaunchFeatures,
  ScanResult,
  WalletResult,
} from "./types";

/**
 * Scan pipeline + cache (handoff Prompt 5 / §2):
 *   cache-check (Redis 10m → DB persistent) → replay → detect → score →
 *   persist Token+Wallets → return ScanResult.
 */

const cacheKey = (mint: string) => `scan:${mint}`;

export interface ScanOptions {
  /** Re-scan even if a cached/stored result exists (worker live-tracking). */
  force?: boolean;
  /** Apply the optional LLM verdict phrasing pass (§9). */
  enhance?: boolean;
  /** Dependency injection for tests. */
  deps?: AnalyzeDeps;
}

/** Reconstruct the scalar feature view from a stored Token row (no wallets). */
function featuresFromToken(t: Token): LaunchFeatures {
  return {
    insiderPct: t.insiderPct,
    organicPct: t.organicPct,
    devPct: t.devPct,
    bundlePct: t.bundlePct,
    sniperPct: t.sniperPct,
    bundledCount: t.bundledCount,
    sniperCount: t.sniperCount,
    fundingSources: t.fundingSources,
    singleFunder: t.singleFunder,
    insiderHeldPct: t.insiderHeldPct,
    hasDevLinkedSnipers: false, // scoring-only; not needed for display copy
    wallets: [],
  };
}

function walletRowToResult(w: Wallet): WalletResult {
  return {
    address: w.address,
    short: shortAddr(w.address),
    role: w.role as WalletResult["role"],
    supplyPct: w.supplyPct,
    status: w.status as WalletResult["status"],
    held: w.status === "holding",
    entrySlot: Number(w.entrySlot),
    fundingSource: w.fundingSource,
  };
}

/** Build the API ScanResult from a persisted Token (+ its wallets). */
export function tokenToScanResult(
  token: Token,
  wallets: Wallet[],
  cached: boolean,
): ScanResult {
  const features = featuresFromToken(token);
  const score = {
    score: token.score,
    tier: token.tier as ScanResult["tier"],
    color:
      token.score < 25
        ? "var(--signal)"
        : token.score < 55
          ? "var(--signal-2)"
          : token.score < 80
            ? "var(--mild)"
            : "var(--clean)",
    risk: 100 - token.score,
  };
  const raw = token.raw as { verdict?: string } | null;

  return {
    mint: token.mint,
    ca: shortAddr(token.mint),
    name: token.name ?? token.ticker ?? shortAddr(token.mint),
    ticker: token.ticker ?? "",
    platform: token.platform,
    deployer: token.deployer,
    deploySlot: Number(token.deploySlot),
    deployTs: token.deployTs.toISOString(),
    score: token.score,
    tier: score.tier,
    color: score.color,
    insiderPct: token.insiderPct,
    organicPct: token.organicPct,
    devPct: token.devPct,
    bundlePct: token.bundlePct,
    sniperPct: token.sniperPct,
    bundledCount: token.bundledCount,
    sniperCount: token.sniperCount,
    fundingSources: token.fundingSources,
    singleFunder: token.singleFunder,
    insiderHeldPct: token.insiderHeldPct,
    wallets: wallets
      .slice()
      .sort((a, b) => b.supplyPct - a.supplyPct)
      .map(walletRowToResult),
    verdict: raw?.verdict ?? buildVerdict(features, score),
    note: buildNote(features),
    stats: buildStats(features),
    scannedAt: token.scannedAt.toISOString(),
    cached,
  };
}

/** Read a previously-scanned token (Redis → DB). No scan is triggered. */
export async function getStoredResult(mint: string): Promise<ScanResult | null> {
  const hit = await redis.get(cacheKey(mint)).catch(() => null);
  if (hit) {
    try {
      return { ...(JSON.parse(hit) as ScanResult), cached: true };
    } catch {
      /* fall through to DB */
    }
  }
  const token = await prisma.token.findUnique({
    where: { mint },
    include: { wallets: true },
  });
  if (!token) return null;
  const result = tokenToScanResult(token, token.wallets, true);
  await redis
    .set(cacheKey(mint), JSON.stringify(result), "EX", SCAN_CACHE_TTL_SECONDS)
    .catch(() => {});
  return result;
}

async function persist(
  result: ScanResult,
  features: LaunchFeatures,
  rawArtifact: unknown,
): Promise<void> {
  const tokenData = {
    name: result.name,
    ticker: result.ticker,
    deployer: result.deployer,
    deploySlot: BigInt(result.deploySlot),
    deployTs: new Date(result.deployTs),
    platform: result.platform,
    score: result.score,
    tier: result.tier,
    insiderPct: result.insiderPct,
    organicPct: result.organicPct,
    devPct: result.devPct,
    bundlePct: result.bundlePct,
    sniperPct: result.sniperPct,
    bundledCount: result.bundledCount,
    sniperCount: result.sniperCount,
    fundingSources: result.fundingSources,
    singleFunder: result.singleFunder,
    insiderHeldPct: result.insiderHeldPct,
    scannedAt: new Date(result.scannedAt),
    // Strip BigInt before handing to Prisma's Json column.
    raw: JSON.parse(JSON.stringify(rawArtifact, bigintReplacer)),
  };

  await prisma.$transaction([
    prisma.token.upsert({
      where: { mint: result.mint },
      create: { mint: result.mint, ...tokenData },
      update: tokenData,
    }),
    prisma.wallet.deleteMany({ where: { tokenMint: result.mint } }),
    prisma.wallet.createMany({
      data: features.wallets.map((w) => ({
        tokenMint: result.mint,
        address: w.address,
        role: w.role,
        supplyPct: w.supplyPct,
        entrySlot: BigInt(w.entrySlot),
        acquiredRaw: w.acquiredRaw,
        currentRaw: w.currentRaw,
        status: w.status,
        fundingSource: w.fundingSource,
      })),
    }),
  ]);
}

/** Publish a freshly-scored launch to the live-feed channel (§8). */
async function publishFeed(result: ScanResult): Promise<void> {
  const item: FeedItem = {
    mint: result.mint,
    ticker: result.ticker || result.name,
    ca: result.ca,
    score: result.score,
    tier: result.tier,
    color: result.color,
    insiderPct: result.insiderPct,
    scannedAt: result.scannedAt,
    agoSeconds: 0,
  };
  await redis.publish(FEED_CHANNEL, JSON.stringify(item)).catch(() => {});
}

/**
 * Full on-demand / indexer scan. Returns a cached result when available unless
 * `force` is set.
 */
export async function scanToken(mint: string, opts: ScanOptions = {}): Promise<ScanResult> {
  const m = mint.trim();
  if (!isValidMint(m)) throw new Error(`Invalid Solana mint address: ${mint}`);

  if (!opts.force) {
    const cached = await getStoredResult(m);
    if (cached) return cached;
  }

  // ── replay → detect → score (§6, §7) ──────────────────────────────────────
  const [replay, meta] = await Promise.all([replayLaunch(m), getTokenMeta(m)]);
  const features = await analyzeLaunch(replay, opts.deps);
  const score = scoreLaunch(features);

  const draft = buildVerdict(features, score);
  const verdict = opts.enhance ? await enhanceVerdict(draft, features) : draft;

  const ticker = meta.ticker ?? "";
  const name = meta.name ?? meta.ticker ?? shortAddr(m);

  const now = new Date().toISOString();
  const result: ScanResult = {
    mint: m,
    ca: shortAddr(m),
    name,
    ticker,
    platform: replay.deploy.platform,
    deployer: replay.deploy.deployer,
    deploySlot: replay.deploy.deploySlot,
    deployTs: replay.deploy.deployTs,
    score: score.score,
    tier: score.tier,
    color: score.color,
    insiderPct: features.insiderPct,
    organicPct: features.organicPct,
    devPct: features.devPct,
    bundlePct: features.bundlePct,
    sniperPct: features.sniperPct,
    bundledCount: features.bundledCount,
    sniperCount: features.sniperCount,
    fundingSources: features.fundingSources,
    singleFunder: features.singleFunder,
    insiderHeldPct: features.insiderHeldPct,
    wallets: features.wallets.map((w) => ({
      address: w.address,
      short: shortAddr(w.address),
      role: w.role,
      supplyPct: w.supplyPct,
      status: w.status,
      held: w.status === "holding",
      entrySlot: w.entrySlot,
      fundingSource: w.fundingSource,
    })),
    verdict,
    note: buildNote(features),
    stats: buildStats(features),
    scannedAt: now,
    cached: false,
  };

  const rawArtifact = {
    features: {
      insiderPct: features.insiderPct,
      bundlePct: features.bundlePct,
      sniperPct: features.sniperPct,
      insiderHeldPct: features.insiderHeldPct,
      singleFunder: features.singleFunder,
      hasDevLinkedSnipers: features.hasDevLinkedSnipers,
    },
    verdict,
    deploy: replay.deploy,
    buys: replay.buys,
    totalSupply: replay.totalSupply,
  };

  await persist(result, features, rawArtifact);
  await redis
    .set(cacheKey(m), JSON.stringify(result), "EX", SCAN_CACHE_TTL_SECONDS)
    .catch(() => {});
  await publishFeed(result);

  return result;
}
