import type { ScanResult, WalletResult } from "./types";

/**
 * Showcase data ported 1:1 from the prototype's DATA object (handoff §12). The
 * three demo tabs ($WAGMI / $MOONPAD / $VERDE) render through the same
 * ScanResult-driven component as a real scan, so the page looks identical to
 * the approved prototype out of the box. Illustrative placeholders (see the
 * site disclaimer) — real scans replace these via POST /api/scan.
 */

type DemoWallet = { a: string; role: WalletResult["role"]; sup: string; held: boolean };

function wallets(list: DemoWallet[]): WalletResult[] {
  return list.map((w) => ({
    address: w.a,
    short: w.a,
    role: w.role,
    supplyPct: parseFloat(w.sup),
    status: w.held ? "holding" : "dumped",
    held: w.held,
    entrySlot: 0,
    fundingSource: null,
  }));
}

const COMMON = {
  platform: "pumpfun",
  deployer: "",
  deploySlot: 0,
  deployTs: new Date(0).toISOString(),
  scannedAt: new Date(0).toISOString(),
  cached: false,
  fundingSources: 1,
};

export const DEMO: Record<"rigged" | "trap" | "clean", ScanResult> = {
  rigged: {
    ...COMMON,
    mint: "7xKpVeR4nQ2mL8sD3wYt9fQa",
    ca: "7xKpVeR4nQ2mL8sD3wYt…9fQa",
    name: "WAGMI",
    ticker: "$WAGMI",
    score: 24,
    tier: "RIGGED",
    color: "var(--signal)",
    insiderPct: 61,
    organicPct: 39,
    devPct: 9,
    bundlePct: 29,
    sniperPct: 22,
    bundledCount: 14,
    sniperCount: 9,
    singleFunder: false,
    insiderHeldPct: 71,
    note: "61% of supply was captured by coordinated wallets inside the first 12 blocks — before a single organic buyer could react.",
    stats: [
      { v: "61", unit: "%", k: "insider supply at launch", sig: true },
      { v: "14", unit: "", k: "bundled wallets" },
      { v: "71", unit: "%", k: "insider supply still held", sig: true },
    ],
    wallets: wallets([
      { a: "Hq8f…2nLp", role: "bundle", sup: "11.2%", held: true },
      { a: "3kRm…9wXc", role: "dev-link", sup: "9.0%", held: true },
      { a: "Bv2p…7qDa", role: "bundle", sup: "7.8%", held: true },
      { a: "9xNt…4mKe", role: "sniper", sup: "6.4%", held: false },
    ]),
    verdict:
      "This launch is RIGGED. 14 bundled wallets and 9 same-block snipers captured 61% of supply before the token was tradeable, and 71% is still held. The chart is being walked up on a loaded gun — when this cluster sells, retail is the exit liquidity.",
  },
  trap: {
    ...COMMON,
    mint: "Dp4mNkrL2vXu6tWq",
    ca: "Dp4mNk…rL2vXu…6tWq",
    name: "MoonPad",
    ticker: "$MOONPAD",
    score: 9,
    tier: "TRAP",
    color: "var(--signal)",
    insiderPct: 79,
    organicPct: 21,
    devPct: 14,
    bundlePct: 41,
    sniperPct: 24,
    bundledCount: 22,
    sniperCount: 12,
    singleFunder: true,
    insiderHeldPct: 94,
    note: "79% of supply is insider-controlled, and every flagged wallet was funded from a single source 9 minutes before deploy.",
    stats: [
      { v: "79", unit: "%", k: "insider supply at launch", sig: true },
      { v: "22", unit: "", k: "bundled wallets" },
      { v: "1", unit: "", k: "funding source for all", sig: true },
    ],
    wallets: wallets([
      { a: "Fn9k…0pLm", role: "dev-link", sup: "14.0%", held: true },
      { a: "Wq2x…5rTb", role: "bundle", sup: "9.7%", held: true },
      { a: "Kp8v…3nDc", role: "bundle", sup: "8.9%", held: true },
      { a: "Zx4m…7qWa", role: "bundle", sup: "8.1%", held: true },
    ]),
    verdict:
      "This is a TRAP. 79% of supply sits in 22 wallets all funded from one source minutes before launch, and 94% is still held. There is no organic float — a manufactured chart waiting for a single coordinated exit. Do not provide the liquidity.",
  },
  clean: {
    ...COMMON,
    mint: "Gm7tPk4wNv8sLc",
    ca: "Gm7tPk…4wNv…8sLc",
    name: "Verde",
    ticker: "$VERDE",
    score: 88,
    tier: "CLEAN",
    color: "var(--clean)",
    insiderPct: 7,
    organicPct: 93,
    devPct: 2,
    bundlePct: 2,
    sniperPct: 4,
    bundledCount: 1,
    sniperCount: 4,
    singleFunder: false,
    insiderHeldPct: 57,
    note: "Only 7% of supply went to flagged wallets at launch — distribution opened up to organic buyers almost immediately.",
    stats: [
      { v: "7", unit: "%", k: "insider supply at launch" },
      { v: "1", unit: "", k: "bundled wallet" },
      { v: "92", unit: "%", k: "organic float" },
    ],
    wallets: wallets([
      { a: "Cv3k…8nPm", role: "dev-link", sup: "2.0%", held: true },
      { a: "Bp7w…2rLa", role: "sniper", sup: "1.6%", held: false },
      { a: "Nt4m…9qWc", role: "sniper", sup: "1.4%", held: true },
      { a: "Hk9v…5sDe", role: "sniper", sup: "1.0%", held: false },
    ]),
    verdict:
      "This launch reads CLEAN. The dev held just 2% and snipers picked up only 4% across dispersed blocks, leaving 92% to organic buyers. No bundle cluster, no shared funding source. As fair as a memecoin launch realistically gets — though clean structure is not a price guarantee.",
  },
};

export type DemoKey = keyof typeof DEMO;
export const DEMO_TABS: { key: DemoKey; label: string }[] = [
  { key: "rigged", label: "$WAGMI" },
  { key: "trap", label: "$MOONPAD" },
  { key: "clean", label: "$VERDE" },
];
