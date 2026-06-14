import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getStoredResult, scanToken } from "@/lib/scan";
import { isValidMint } from "@/lib/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Prototype tier palette (hex, since satori can't resolve CSS vars). */
const INK = "#ECE9E2";
const INK2 = "#84817C";
const INK3 = "#4A4844";
const SIGNAL = "#D9594A";
const SIGNAL2 = "#E87A6A";
const ORGANIC = "#22222A";

function hexForScore(score: number): string {
  if (score < 25) return SIGNAL;
  if (score < 55) return SIGNAL2;
  if (score < 80) return "#B0AEA7";
  return "#7FA894";
}

/**
 * GET /api/card/:mint.png → share-card PNG (handoff §10). Renders the `.scard`
 * block from the prototype: wordmark, ticker, big ember score, tier verdict,
 * two-tone insider strip, footer.
 */
export async function GET(_req: NextRequest, { params }: { params: { mint: string } }) {
  const mint = params.mint.replace(/\.png$/i, "").trim();
  if (!isValidMint(mint)) {
    return new Response("Invalid mint", { status: 422 });
  }

  const result = (await getStoredResult(mint)) ?? (await scanToken(mint).catch(() => null));
  if (!result) return new Response("Not found", { status: 404 });

  const accent = hexForScore(result.score);
  const base = process.env.PUBLIC_BASE_URL?.replace(/^https?:\/\//, "") || "bundlescan.io";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(160deg, #101013, #0A0A0C)",
          padding: "72px 80px",
          fontFamily: "sans-serif",
          color: INK,
          position: "relative",
        }}
      >
        {/* ember glow */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-80px",
            width: "520px",
            height: "420px",
            background: "radial-gradient(closest-side, rgba(217,89,74,0.18), transparent)",
            display: "flex",
          }}
        />
        {/* brand row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "30px", fontWeight: 600 }}>
            <div style={{ width: "16px", height: "16px", background: SIGNAL, transform: "rotate(45deg)", display: "flex" }} />
            BundleScan
          </div>
          <div style={{ display: "flex", fontSize: "18px", letterSpacing: "4px", color: SIGNAL, textTransform: "uppercase" }}>
            Launch X-Ray
          </div>
        </div>

        {/* ticker */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "20px", marginTop: "64px" }}>
          <div style={{ display: "flex", fontSize: "72px", fontWeight: 700, letterSpacing: "-2px" }}>
            {result.name}
          </div>
          <div style={{ display: "flex", fontSize: "28px", color: INK2 }}>{result.ticker}</div>
        </div>

        {/* score + verdict */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "40px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", color: accent }}>
            <div style={{ display: "flex", fontSize: "168px", fontWeight: 700, lineHeight: 1, letterSpacing: "-6px" }}>
              {result.score}
            </div>
            <div style={{ display: "flex", fontSize: "44px", color: INK3, marginBottom: "20px" }}>/100</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: "30px", letterSpacing: "6px", color: accent, textTransform: "uppercase" }}>
              {result.tier}
            </div>
            <div style={{ display: "flex", fontSize: "24px", color: INK2, marginTop: "12px" }}>
              {result.insiderPct}% insider · {result.insiderHeldPct}% held
            </div>
          </div>
        </div>

        {/* two-tone insider strip */}
        <div
          style={{
            display: "flex",
            height: "16px",
            borderRadius: "10px",
            background: ORGANIC,
            marginTop: "44px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              width: `${Math.min(100, Math.max(0, result.insiderPct))}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${SIGNAL}, ${SIGNAL2})`,
            }}
          />
        </div>

        {/* footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "32px", fontSize: "22px", color: INK3 }}>
          <div style={{ display: "flex" }}>
            {result.bundledCount} bundled · {result.sniperCount} snipers
          </div>
          <div style={{ display: "flex" }}>
            {base} / {result.ca}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
