import { BUNDLE_WINDOW_MS, LIVE_WINDOW_MS } from "./config";
import { scoreLaunch } from "./score";
import { buildVerdict, buildNote, buildStats } from "./verdict";
import { persistLaunch } from "./persist";
import { feedItemFromResult, publishFeedItem } from "./stream";
import { shortAddr, round } from "./util";
import type { PumpCreateEvent, PumpTradeEvent } from "./pumpportal";
import type { AnalyzedWallet, LaunchFeatures, ScanResult } from "./types";

/**
 * Free realtime forensics (no Helius, no RPC). pump.fun launches are caught at
 * creation via PumpPortal and we watch the first ~LIVE_WINDOW_MS of trades live
 * — literally observing block zero as it happens. Wallet holdings come straight
 * from the stream's `newTokenBalance`, so insider capture is computed without a
 * single RPC call.
 *
 * Trade-offs vs the RPC replay (lib/chain.ts): no slot-level bundle proof and no
 * SOL funding-trace, so `singleFunder`/dev-link bonuses are off — windows are
 * time-based instead. It's a "lite" score, but realtime and $0.
 */

const TOTAL_SUPPLY = 1_000_000_000; // pump.fun fixed supply (UI tokens)

interface WalletState {
  firstMs: number; // ms after create when first seen
  acquired: number; // peak tokens acquired
  current: number; // latest balance
}

export interface LiveLaunch {
  mint: string;
  dev: string;
  name: string;
  ticker: string;
  createdAt: number;
  wallets: Map<string, WalletState>;
}

export function startLiveLaunch(ev: PumpCreateEvent): LiveLaunch {
  const launch: LiveLaunch = {
    mint: ev.mint,
    dev: ev.traderPublicKey,
    name: ev.name || ev.symbol || shortAddr(ev.mint),
    ticker: ev.symbol || "",
    createdAt: Date.now(),
    wallets: new Map(),
  };
  if (ev.initialBuy && ev.initialBuy > 0) {
    launch.wallets.set(ev.traderPublicKey, {
      firstMs: 0,
      acquired: ev.initialBuy,
      current: ev.initialBuy,
    });
  }
  return launch;
}

/** Fold a trade into the launch state. Returns false once the window is closed. */
export function applyTrade(launch: LiveLaunch, ev: PumpTradeEvent): boolean {
  const elapsed = Date.now() - launch.createdAt;
  if (elapsed > LIVE_WINDOW_MS) return false;

  const w = launch.wallets.get(ev.traderPublicKey) ?? {
    firstMs: elapsed,
    acquired: 0,
    current: 0,
  };
  const balance =
    ev.newTokenBalance ??
    (ev.txType === "buy" ? w.current + ev.tokenAmount : Math.max(0, w.current - ev.tokenAmount));
  w.current = balance;
  if (balance > w.acquired) w.acquired = balance;
  launch.wallets.set(ev.traderPublicKey, w);
  return true;
}

export function computeLiveFeatures(launch: LiveLaunch): LaunchFeatures {
  const pct = (t: number) => round((t / TOTAL_SUPPLY) * 100, 2);

  let insiderSum = 0,
    devSum = 0,
    bundleSum = 0,
    sniperSum = 0,
    acquiredSum = 0,
    currentSum = 0,
    bundledCount = 0,
    sniperCount = 0;

  const wallets: AnalyzedWallet[] = [];
  for (const [address, w] of launch.wallets) {
    const isDev = address === launch.dev;
    const role: AnalyzedWallet["role"] = isDev
      ? "dev-link"
      : w.firstMs <= BUNDLE_WINDOW_MS
        ? "bundle"
        : "sniper";

    insiderSum += w.current;
    acquiredSum += w.acquired;
    currentSum += w.current;
    if (isDev) devSum += w.current;
    else if (role === "bundle") {
      bundleSum += w.current;
      bundledCount++;
    } else {
      sniperSum += w.current;
      sniperCount++;
    }

    const frac = w.acquired > 0 ? w.current / w.acquired : 0;
    wallets.push({
      address,
      role,
      supplyPct: pct(w.current),
      entrySlot: 0,
      acquiredRaw: BigInt(Math.round(w.acquired)),
      currentRaw: BigInt(Math.round(w.current)),
      status: frac >= 0.9 ? "holding" : frac <= 0.1 ? "dumped" : "partial",
      fundingSource: null,
    });
  }
  wallets.sort((a, b) => b.supplyPct - a.supplyPct);

  const insiderPct = pct(insiderSum);
  return {
    insiderPct,
    organicPct: round(100 - insiderPct, 2),
    devPct: pct(devSum),
    bundlePct: pct(bundleSum),
    sniperPct: pct(sniperSum),
    bundledCount,
    sniperCount,
    fundingSources: 0, // not available from the free stream
    singleFunder: false,
    insiderHeldPct: acquiredSum > 0 ? round((currentSum / acquiredSum) * 100, 1) : 100,
    hasDevLinkedSnipers: false,
    wallets,
  };
}

export function liveLaunchToResult(launch: LiveLaunch): {
  result: ScanResult;
  features: LaunchFeatures;
} {
  const features = computeLiveFeatures(launch);
  const score = scoreLaunch(features);
  const verdict = buildVerdict(features, score);
  const iso = new Date(launch.createdAt).toISOString();

  const result: ScanResult = {
    mint: launch.mint,
    ca: shortAddr(launch.mint),
    name: launch.name,
    ticker: launch.ticker,
    platform: "pumpfun",
    deployer: launch.dev,
    deploySlot: 0,
    deployTs: iso,
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
      entrySlot: 0,
      fundingSource: null,
    })),
    verdict,
    note: buildNote(features),
    stats: buildStats(features),
    scannedAt: new Date().toISOString(),
    cached: false,
  };
  return { result, features };
}

/** Finalize a live launch: persist to DB and push to the realtime feed. */
export async function finalizeAndStore(launch: LiveLaunch): Promise<ScanResult> {
  const { result, features } = liveLaunchToResult(launch);
  const raw = {
    source: "pumpportal",
    features: {
      insiderPct: features.insiderPct,
      bundlePct: features.bundlePct,
      sniperPct: features.sniperPct,
      insiderHeldPct: features.insiderHeldPct,
      singleFunder: features.singleFunder,
      hasDevLinkedSnipers: features.hasDevLinkedSnipers,
    },
    verdict: result.verdict,
  };
  await persistLaunch(result, features.wallets, raw).catch(() => {});
  await publishFeedItem(feedItemFromResult(result));
  return result;
}
