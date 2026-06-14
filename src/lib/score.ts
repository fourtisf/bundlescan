import { SCORE_WEIGHTS, TIERS, type TierName } from "./config";
import { clamp } from "./util";
import { prisma } from "./prisma";
import type { LaunchFeatures, ScoreResult } from "./types";

/**
 * Launch Health Score (handoff §7). Compute a risk value (0–100) from the
 * launch features, then score = clamp(0,100, round(100 - risk)). Weights are
 * tunable in config.ts; re-scoring from Token.raw applies new weights without
 * re-pulling chain data.
 */

/** The subset of features the score formula consumes. */
export type ScorableFeatures = Pick<
  LaunchFeatures,
  | "insiderPct"
  | "bundlePct"
  | "sniperPct"
  | "insiderHeldPct"
  | "singleFunder"
  | "hasDevLinkedSnipers"
>;

export function tierForScore(score: number): TierName {
  const t = TIERS.find((t) => score >= t.min && score <= t.max);
  return (t?.name ?? "TRAP") as TierName;
}

export function colorForScore(score: number): string {
  const t = TIERS.find((t) => score >= t.min && score <= t.max);
  return t?.color ?? "var(--signal)";
}

export function scoreLaunch(f: ScorableFeatures): ScoreResult {
  const w = SCORE_WEIGHTS;
  let risk =
    w.insider * f.insiderPct +
    w.bundle * f.bundlePct +
    w.sniper * f.sniperPct +
    w.loadedGun * f.insiderPct * (f.insiderHeldPct / 100) + // loaded-gun multiplier
    (f.singleFunder ? w.singleFunder : 0) +
    (f.hasDevLinkedSnipers ? w.devLinkedSnipers : 0);

  risk = Math.min(100, risk);
  const score = clamp(0, 100, Math.round(100 - risk));

  return {
    score,
    tier: tierForScore(score),
    color: colorForScore(score),
    risk: Math.round(risk * 10) / 10,
  };
}

/**
 * Re-score a stored token from its persisted features (Token.raw.features),
 * with no chain calls. Used after tuning weights in config.ts (§7 note).
 */
export async function rescore(mint: string): Promise<ScoreResult> {
  const token = await prisma.token.findUnique({ where: { mint } });
  if (!token) throw new Error(`Token ${mint} not found`);
  const raw = token.raw as { features?: ScorableFeatures } | null;
  if (!raw?.features) {
    throw new Error(`Token ${mint} has no stored features to re-score from`);
  }

  const result = scoreLaunch(raw.features);
  await prisma.token.update({
    where: { mint },
    data: { score: result.score, tier: result.tier },
  });
  return result;
}
