import { SNIPE_BLOCKS, HOLDING_THRESHOLD, DUMPED_THRESHOLD } from "./config";
import { getFundingSource, getTokenBalance } from "./chain";
import { supplyPct as toPct, round } from "./util";
import type {
  AnalyzedWallet,
  LaunchFeatures,
  ReplayResult,
  Role,
  WalletStatus,
} from "./types";

/**
 * Detection + clustering (handoff §6.2–6.6). The chain-touching steps
 * (funding trace, current balances) are injected so the pure detection math can
 * be unit-tested against hand-calculated launches without RPC (Prompt 3
 * acceptance).
 */

export interface WalletAgg {
  address: string;
  acquiredRaw: bigint;
  /** First slot this wallet acquired in. */
  entrySlot: number;
  supplyPct: number;
}

/** Collapse repeated buys into one row per wallet, summing acquired supply. */
export function aggregateBuys(replay: ReplayResult): WalletAgg[] {
  const byWallet = new Map<string, { raw: bigint; slot: number }>();
  for (const buy of replay.buys) {
    const cur = byWallet.get(buy.wallet);
    if (cur) {
      cur.raw += buy.tokensReceived;
      cur.slot = Math.min(cur.slot, buy.slot);
    } else {
      byWallet.set(buy.wallet, { raw: buy.tokensReceived, slot: buy.slot });
    }
  }
  // The deployer itself is not a "buyer"; exclude from the cluster math.
  byWallet.delete(replay.deploy.deployer);

  return [...byWallet.entries()].map(([address, v]) => ({
    address,
    acquiredRaw: v.raw,
    entrySlot: v.slot,
    supplyPct: toPct(v.raw, replay.totalSupply),
  }));
}

/** §6.2 — bundled wallets bought in the same slot as the deploy. */
export function detectBundles(aggs: WalletAgg[], deploySlot: number): Set<string> {
  return new Set(aggs.filter((w) => w.entrySlot === deploySlot).map((w) => w.address));
}

/** §6.3 — snipers first bought in deploySlot+1 .. deploySlot+SNIPE_BLOCKS, not bundled. */
export function detectSnipers(
  aggs: WalletAgg[],
  deploySlot: number,
  bundled: Set<string>,
  snipeBlocks = SNIPE_BLOCKS,
): Set<string> {
  const lo = deploySlot + 1;
  const hi = deploySlot + snipeBlocks;
  return new Set(
    aggs
      .filter((w) => !bundled.has(w.address) && w.entrySlot >= lo && w.entrySlot <= hi)
      .map((w) => w.address),
  );
}

export type FundingResolver = (wallet: string) => Promise<string | null>;
export type BalanceResolver = (wallet: string, mint: string) => Promise<bigint>;

/** §6.4 — resolve each candidate wallet's first-inbound-SOL funding source. */
export async function traceFunding(
  addresses: string[],
  resolver: FundingResolver = getFundingSource,
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  await Promise.all(
    addresses.map(async (a) => {
      try {
        out.set(a, await resolver(a));
      } catch {
        out.set(a, null);
      }
    }),
  );
  return out;
}

/**
 * §6.4 — wallets funded from the deployer (or the deployer's own funder) are
 * tagged dev-link.
 */
export function classifyDevLink(
  funding: Map<string, string | null>,
  deployer: string,
  deployerFunder: string | null,
): Set<string> {
  const devSources = new Set([deployer, ...(deployerFunder ? [deployerFunder] : [])]);
  const out = new Set<string>();
  for (const [wallet, src] of funding) {
    if (src && devSources.has(src)) out.add(wallet);
  }
  return out;
}

/** §6.6 — held / dumped / partial vs the supply this wallet originally acquired. */
export function computeHeldStatus(acquiredRaw: bigint, currentRaw: bigint): WalletStatus {
  if (acquiredRaw <= 0n) return "dumped";
  const frac = Number(currentRaw) / Number(acquiredRaw);
  if (frac >= HOLDING_THRESHOLD) return "holding";
  if (frac <= DUMPED_THRESHOLD) return "dumped";
  return "partial";
}

/** Role label priority for display (most damning wins): dev-link > bundle > sniper. */
function roleFor(
  address: string,
  bundled: Set<string>,
  snipers: Set<string>,
  devLinked: Set<string>,
): Role {
  if (devLinked.has(address)) return "dev-link";
  if (bundled.has(address)) return "bundle";
  return snipers.has(address) ? "sniper" : "bundle";
}

function sumPct(aggs: WalletAgg[], set: Set<string>): number {
  return aggs.filter((w) => set.has(w.address)).reduce((s, w) => s + w.supplyPct, 0);
}

export interface AnalyzeDeps {
  fundingResolver?: FundingResolver;
  balanceResolver?: BalanceResolver;
}

/**
 * Full §6.2–6.6 pipeline → LaunchFeatures, ready for scoreLaunch (§7).
 * `replay` comes from lib/chain.ts `replayLaunch`.
 */
export async function analyzeLaunch(
  replay: ReplayResult,
  deps: AnalyzeDeps = {},
): Promise<LaunchFeatures> {
  const fundingResolver = deps.fundingResolver ?? getFundingSource;
  const balanceResolver = deps.balanceResolver ?? getTokenBalance;
  const { deploy, totalSupply } = replay;

  const aggs = aggregateBuys(replay);
  const bundled = detectBundles(aggs, deploy.deploySlot);
  const snipers = detectSnipers(aggs, deploy.deploySlot, bundled);

  // §6.4 — trace funding for the bundle ∪ sniper candidate set.
  const candidates = [...new Set([...bundled, ...snipers])];
  const funding = await traceFunding(candidates, fundingResolver);
  const deployerFunder = await fundingResolver(deploy.deployer).catch(() => null);
  const devLinked = classifyDevLink(funding, deploy.deployer, deployerFunder);

  // §6.5 — insider cluster = union(bundled, snipers, dev-linked).
  const cluster = new Set<string>([...bundled, ...snipers, ...devLinked]);
  const clusterAggs = aggs.filter((w) => cluster.has(w.address));

  // §6.6 — held vs dumped for every cluster wallet.
  const wallets: AnalyzedWallet[] = await Promise.all(
    clusterAggs.map(async (w): Promise<AnalyzedWallet> => {
      const currentRaw = await balanceResolver(w.address, deploy.mint).catch(() => 0n);
      return {
        address: w.address,
        role: roleFor(w.address, bundled, snipers, devLinked),
        supplyPct: round(w.supplyPct, 2),
        entrySlot: w.entrySlot,
        acquiredRaw: w.acquiredRaw,
        currentRaw,
        status: computeHeldStatus(w.acquiredRaw, currentRaw),
        fundingSource: funding.get(w.address) ?? null,
      };
    }),
  );
  wallets.sort((a, b) => b.supplyPct - a.supplyPct);

  const insiderPct = round(sumPct(aggs, cluster), 2);
  const acquiredSum = clusterAggs.reduce((s, w) => s + w.acquiredRaw, 0n);
  const currentSum = wallets.reduce((s, w) => s + w.currentRaw, 0n);
  const insiderHeldPct =
    acquiredSum > 0n ? round((Number(currentSum) / Number(acquiredSum)) * 100, 1) : 0;

  const fundingSources = new Set(
    [...funding.values()].filter((s): s is string => !!s),
  ).size;

  const hasDevLinkedSnipers = [...snipers].some((a) => devLinked.has(a));

  return {
    insiderPct,
    organicPct: round(100 - insiderPct, 2),
    devPct: round(sumPct(aggs, devLinked), 2),
    bundlePct: round(sumPct(aggs, bundled), 2),
    sniperPct: round(sumPct(aggs, snipers), 2),
    bundledCount: bundled.size,
    sniperCount: snipers.size,
    fundingSources,
    singleFunder: fundingSources === 1 && candidates.length > 1,
    insiderHeldPct,
    hasDevLinkedSnipers,
    wallets,
  };
}
