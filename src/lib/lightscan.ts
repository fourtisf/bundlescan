import { replayLaunch } from "./chain";
import { analyzeLaunchLight } from "./detect";
import { scoreLaunch } from "./score";
import { buildVerdict, buildNote, buildStats } from "./verdict";
import { persistLaunch } from "./persist";
import { feedItemFromResult, publishFeedItem } from "./stream";
import { shortAddr } from "./util";
import type { DeployInfo, LaunchFeatures, ScanResult, ScoreResult } from "./types";

/**
 * Hybrid realtime forensics. PumpPortal triggers on a new mint; this does a cheap
 * slot-level RPC replay (which DOES see the atomic same-slot bundle the WS stream
 * misses) and a light analysis (no funding-trace / balance calls) to keep RPC
 * cost low. This is what makes TRAP/RIGGED actually surface instead of everything
 * scoring CLEAN.
 */

export interface LaunchMeta {
  name?: string;
  ticker?: string;
  marketCapSol?: number;
}

function buildScanResult(
  deploy: DeployInfo,
  features: LaunchFeatures,
  score: ScoreResult,
  meta: LaunchMeta,
): ScanResult {
  const verdict = buildVerdict(features, score);
  return {
    mint: deploy.mint,
    ca: shortAddr(deploy.mint),
    name: meta.name || meta.ticker || shortAddr(deploy.mint),
    ticker: meta.ticker || "",
    platform: deploy.platform,
    deployer: deploy.deployer,
    deploySlot: deploy.deploySlot,
    deployTs: deploy.deployTs,
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
    scannedAt: new Date().toISOString(),
    cached: false,
  };
}

export async function lightScan(mint: string, meta: LaunchMeta = {}): Promise<ScanResult> {
  const replay = await replayLaunch(mint);
  const features = analyzeLaunchLight(replay);
  const score = scoreLaunch(features);
  const result = buildScanResult(replay.deploy, features, score, meta);

  const raw = {
    source: "hybrid",
    marketCapSol: meta.marketCapSol,
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

  const feed = feedItemFromResult(result);
  if (meta.marketCapSol != null) feed.marketCapSol = Math.round(meta.marketCapSol);
  await publishFeedItem(feed);

  return result;
}
