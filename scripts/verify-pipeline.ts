/**
 * Offline acceptance checks for the forensic pipeline (handoff Prompts 3 & 4).
 * Runs detection on a hand-calculated rigged launch (injected funding/balance
 * resolvers, no RPC) and the score→tier mapping on the prototype demo tokens.
 *
 *   npx tsx scripts/verify-pipeline.ts
 */
import assert from "node:assert/strict";
import { analyzeLaunch } from "../src/lib/detect";
import { scoreLaunch, tierForScore } from "../src/lib/score";
import type { ReplayResult } from "../src/lib/types";

const approx = (a: number, b: number, eps = 0.05) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b}`);

async function testDetection() {
  const TOTAL = 1_000_000_000n; // 0-decimal mint → raw == whole tokens
  const deploySlot = 1000;
  const replay: ReplayResult = {
    deploy: {
      mint: "MINT",
      deployer: "DEPLOYER",
      deploySlot,
      deployTs: new Date().toISOString(),
      platform: "pumpfun",
    },
    totalSupply: TOTAL,
    buys: [
      { wallet: "A", tokensReceived: 110_000_000n, slot: 1000, signature: "s1" }, // bundle 11%
      { wallet: "B", tokensReceived: 90_000_000n, slot: 1000, signature: "s2" }, // bundle+dev 9%
      { wallet: "C", tokensReceived: 64_000_000n, slot: 1001, signature: "s3" }, // sniper 6.4%
      { wallet: "D", tokensReceived: 50_000_000n, slot: 1005, signature: "s4" }, // organic (>snipe window)
      { wallet: "E", tokensReceived: 200_000_000n, slot: 1008, signature: "s5" }, // organic
    ],
  };

  const funding: Record<string, string | null> = {
    A: "FUNDER1",
    B: "DEPLOYER", // funded by deployer → dev-link
    C: "FUNDER1",
    DEPLOYER: "DEPLOYERFUNDER",
  };
  const balances: Record<string, bigint> = {
    A: 110_000_000n, // holding
    B: 90_000_000n, // holding
    C: 0n, // dumped
  };

  const f = await analyzeLaunch(replay, {
    fundingResolver: async (w) => funding[w] ?? null,
    balanceResolver: async (w) => balances[w] ?? 0n,
  });

  assert.equal(f.bundledCount, 2, "bundledCount");
  assert.equal(f.sniperCount, 1, "sniperCount");
  approx(f.insiderPct, 26.4);
  approx(f.bundlePct, 20);
  approx(f.sniperPct, 6.4);
  approx(f.devPct, 9);
  assert.equal(f.fundingSources, 2, "fundingSources");
  assert.equal(f.singleFunder, false, "singleFunder");
  approx(f.insiderHeldPct, 75.8, 0.2);
  assert.equal(f.hasDevLinkedSnipers, false, "hasDevLinkedSnipers");

  const byAddr = Object.fromEntries(f.wallets.map((w) => [w.address, w]));
  assert.equal(byAddr.A.role, "bundle");
  assert.equal(byAddr.B.role, "dev-link");
  assert.equal(byAddr.C.role, "sniper");
  assert.equal(byAddr.A.status, "holding");
  assert.equal(byAddr.C.status, "dumped");
  console.log("✓ detection hand-calc matches (Prompt 3)");
}

function testScoring() {
  // Boundary mapping (handoff §7).
  for (const [score, tier] of [
    [0, "TRAP"],
    [24, "TRAP"],
    [25, "RIGGED"],
    [54, "RIGGED"],
    [55, "MILD"],
    [79, "MILD"],
    [80, "CLEAN"],
    [100, "CLEAN"],
  ] as const) {
    assert.equal(tierForScore(score), tier, `tier(${score})`);
  }

  // Prototype demo tokens' feature values → expected tier.
  const wagmi = scoreLaunch({
    insiderPct: 61,
    bundlePct: 29,
    sniperPct: 22,
    insiderHeldPct: 71,
    singleFunder: false,
    hasDevLinkedSnipers: false,
  });
  const moonpad = scoreLaunch({
    insiderPct: 79,
    bundlePct: 41,
    sniperPct: 24,
    insiderHeldPct: 94,
    singleFunder: true,
    hasDevLinkedSnipers: false,
  });
  const verde = scoreLaunch({
    insiderPct: 7,
    bundlePct: 2,
    sniperPct: 4,
    insiderHeldPct: 50,
    singleFunder: false,
    hasDevLinkedSnipers: false,
  });

  assert.equal(moonpad.tier, "TRAP", "MOONPAD → TRAP");
  assert.equal(wagmi.tier, "RIGGED", "WAGMI → RIGGED");
  assert.equal(verde.tier, "CLEAN", "VERDE → CLEAN");
  console.log(
    `✓ scoring tiers correct (Prompt 4): WAGMI=${wagmi.score}/${wagmi.tier}, ` +
      `MOONPAD=${moonpad.score}/${moonpad.tier}, VERDE=${verde.score}/${verde.tier}`,
  );
}

async function main() {
  await testDetection();
  testScoring();
  console.log("\nAll pipeline acceptance checks passed.");
}

main().catch((e) => {
  console.error("✗ pipeline check failed:", e);
  process.exit(1);
});
