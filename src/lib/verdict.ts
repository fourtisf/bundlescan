import { WINDOW_BLOCKS } from "./config";
import type { LaunchFeatures, ScoreResult, StatItem } from "./types";

/**
 * Forensic copy generation (handoff §9). Everything here is derived
 * deterministically from the numeric features — the optional LLM pass only
 * tightens phrasing and is discarded if it introduces any number not already
 * present. The model NEVER sees a blank slate and never invents data.
 */

export function buildNote(f: LaunchFeatures): string {
  if (f.insiderPct >= 40) {
    const funded = f.singleFunder
      ? ", and every flagged wallet was funded from a single source"
      : "";
    return `${f.insiderPct}% of supply was captured by coordinated wallets inside the first ${WINDOW_BLOCKS} blocks — before a single organic buyer could react${funded}.`;
  }
  return `Only ${f.insiderPct}% of supply went to flagged wallets at launch — distribution opened up to organic buyers almost immediately.`;
}

export function buildStats(f: LaunchFeatures): StatItem[] {
  const stats: StatItem[] = [
    {
      v: String(f.insiderPct),
      unit: "%",
      k: "insider supply at launch",
      sig: f.insiderPct >= 40,
    },
    {
      v: String(f.bundledCount),
      unit: "",
      k: f.bundledCount === 1 ? "bundled wallet" : "bundled wallets",
    },
  ];

  if (f.singleFunder) {
    stats.push({ v: "1", unit: "", k: "funding source for all", sig: true });
  } else if (f.insiderPct < 25) {
    stats.push({ v: String(f.organicPct), unit: "%", k: "organic float" });
  } else {
    stats.push({
      v: String(f.insiderHeldPct),
      unit: "%",
      k: "insider supply still held",
      sig: f.insiderHeldPct >= 50,
    });
  }
  return stats;
}

export function buildVerdict(f: LaunchFeatures, score: ScoreResult): string {
  const { tier } = score;
  const totalInsiders = f.bundledCount + f.sniperCount;
  switch (tier) {
    case "TRAP":
      return `This is a TRAP. ${f.insiderPct}% of supply sits in ${totalInsiders} wallets${
        f.singleFunder ? " all funded from one source minutes before launch" : ""
      }, and ${f.insiderHeldPct}% is still held. There is no organic float — a manufactured chart waiting for a single coordinated exit. Do not provide the liquidity.`;
    case "RIGGED":
      return `This launch is RIGGED. ${f.bundledCount} bundled wallets and ${f.sniperCount} same-block snipers captured ${f.insiderPct}% of supply before the token was tradeable, and ${f.insiderHeldPct}% is still held. The chart is being walked up on a loaded gun — when this cluster sells, retail is the exit liquidity.`;
    case "MILD":
      return `This reads MILD. Insiders took ${f.insiderPct}% across ${f.bundledCount} bundled and ${f.sniperCount} sniper wallets, but ${f.organicPct}% of supply is still out in the open market. Some coordination, not a loaded gun — watch whether that cluster starts moving.`;
    default:
      return `This launch reads CLEAN. Insiders captured just ${f.insiderPct}% across ${f.bundledCount} bundled and ${f.sniperCount} sniper wallets, leaving ${f.organicPct}% to organic buyers. No shared funding cluster. As fair as a memecoin launch realistically gets — though clean structure is not a price guarantee.`;
  }
}

/** Digits present in the deterministic draft + features — the LLM may use no others. */
function allowedNumbers(draft: string, f: LaunchFeatures): Set<string> {
  const nums = new Set<string>();
  const collect = (s: string) => {
    for (const m of s.matchAll(/\d+(?:\.\d+)?/g)) nums.add(m[0]);
  };
  collect(draft);
  collect(
    [
      f.insiderPct,
      f.organicPct,
      f.devPct,
      f.bundlePct,
      f.sniperPct,
      f.bundledCount,
      f.sniperCount,
      f.fundingSources,
      f.insiderHeldPct,
      WINDOW_BLOCKS,
    ].join(" "),
  );
  return nums;
}

/**
 * Optional LLM phrasing pass. Off unless ANTHROPIC_API_KEY is set. Falls back to
 * the deterministic draft on any error or if the model introduces a stray
 * number — guaranteeing the verdict never contains invented figures (§3/§9).
 */
export async function enhanceVerdict(draft: string, f: LaunchFeatures): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return draft;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

    const msg = await client.messages.create({
      model,
      max_tokens: 200,
      system:
        "You tighten one-line forensic verdicts for a Solana launch scanner. " +
        "Rephrase for punch and clarity in 1–2 sentences. You MUST keep every number " +
        "exactly as given and MUST NOT introduce any new number, percentage, or statistic. " +
        "Return only the rewritten verdict, no preamble.",
      messages: [{ role: "user", content: draft }],
    });

    const text = msg.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) return draft;

    const allowed = allowedNumbers(draft, f);
    for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) {
      if (!allowed.has(m[0])) return draft; // invented a number → reject
    }
    return text;
  } catch {
    return draft;
  }
}
