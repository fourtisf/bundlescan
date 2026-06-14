import { prisma } from "./prisma";
import { bigintReplacer } from "./util";
import type { AnalyzedWallet, ScanResult } from "./types";

/**
 * Persist a scored launch (Token + suspect Wallets) — shared by the on-demand
 * scanner (lib/scan.ts) and the hybrid realtime indexer (lib/lightscan.ts).
 */
export async function persistLaunch(
  result: ScanResult,
  wallets: AnalyzedWallet[],
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
      data: wallets.map((w) => ({
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
