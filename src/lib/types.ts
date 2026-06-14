import type { TierName } from "./config";

export type Role = "bundle" | "sniper" | "dev-link";
export type WalletStatus = "holding" | "dumped" | "partial";
export type Platform = "pumpfun" | "raydium" | "pumpswap" | "other";

/** ── Replay artifact (lib/chain.ts) ──────────────────────────────────────── */
export interface ReplayBuy {
  /** Buyer wallet (owner). */
  wallet: string;
  /** Raw token base units received in this buy. */
  tokensReceived: bigint;
  /** Slot the buy landed in. */
  slot: number;
  /** Transaction signature, kept for debugging / fund-trace anchoring. */
  signature: string;
}

export interface DeployInfo {
  mint: string;
  deployer: string;
  deploySlot: number;
  deployTs: string; // ISO
  platform: Platform;
}

export interface ReplayResult {
  deploy: DeployInfo;
  /** Total mint supply (raw base units) used for % math. */
  totalSupply: bigint;
  /** All first-window buys, oldest-first. One wallet may appear multiple times. */
  buys: ReplayBuy[];
}

/** ── Detection / clustering output (lib/detect.ts) ───────────────────────── */
export interface AnalyzedWallet {
  address: string;
  role: Role;
  /** % of total supply this wallet acquired in the window. */
  supplyPct: number;
  entrySlot: number;
  acquiredRaw: bigint;
  currentRaw: bigint;
  status: WalletStatus;
  fundingSource: string | null;
}

export interface LaunchFeatures {
  insiderPct: number;
  organicPct: number;
  devPct: number;
  bundlePct: number;
  sniperPct: number;
  bundledCount: number;
  sniperCount: number;
  fundingSources: number;
  singleFunder: boolean;
  insiderHeldPct: number;
  hasDevLinkedSnipers: boolean;
  wallets: AnalyzedWallet[];
}

/** ── Scoring output (lib/score.ts) ───────────────────────────────────────── */
export interface ScoreResult {
  score: number;
  tier: TierName;
  color: string;
  risk: number;
}

/** ── API-facing result (handoff §8) ──────────────────────────────────────── */
export interface StatItem {
  v: string;
  unit: string;
  k: string;
  sig?: boolean;
}

export interface WalletResult {
  address: string;
  /** "Hq8f…2nLp" display form. */
  short: string;
  role: Role;
  supplyPct: number;
  status: WalletStatus;
  held: boolean;
  entrySlot: number;
  fundingSource: string | null;
}

export interface ScanResult {
  mint: string;
  /** Short display form of the mint, e.g. "7xKp…9fQa". */
  ca: string;
  name: string;
  ticker: string;
  platform: string;
  deployer: string;
  deploySlot: number;
  deployTs: string;
  score: number;
  tier: TierName;
  color: string;
  insiderPct: number;
  organicPct: number;
  devPct: number;
  bundlePct: number;
  sniperPct: number;
  bundledCount: number;
  sniperCount: number;
  fundingSources: number;
  singleFunder: boolean;
  insiderHeldPct: number;
  wallets: WalletResult[];
  /** One-line forensic verdict (§9, optionally LLM-templated). */
  verdict: string;
  /** Short X-ray note shown above the suspect-wallet table. */
  note: string;
  /** Three headline stats for the result grid. */
  stats: StatItem[];
  scannedAt: string;
  cached: boolean;
}

/** ── Live feed / hall of shame (§8) ──────────────────────────────────────── */
export interface FeedItem {
  mint: string;
  ticker: string;
  ca: string;
  score: number;
  tier: TierName;
  color: string;
  insiderPct: number;
  scannedAt: string;
  agoSeconds: number;
}

export interface ShameItem {
  rank: number;
  mint: string;
  ticker: string;
  ca: string;
  score: number;
  tier: TierName;
  insiderPct: number;
}
