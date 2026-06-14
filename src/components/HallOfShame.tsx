"use client";
import { useEffect, useState } from "react";
import type { ShameItem } from "@/lib/types";

function tierName(score: number) {
  if (score < 25) return "TRAP";
  if (score < 55) return "RIGGED";
  if (score < 80) return "MILD";
  return "CLEAN";
}

/** Static fallback ported from the prototype (used until the DB has data). */
const FALLBACK: ShameItem[] = [
  { rank: 1, mint: "Dp4mNk6tWq", ticker: "$MOONPAD", ca: "Dp4mNk…6tWq", score: 9, tier: "TRAP", insiderPct: 79 },
  { rank: 2, mint: "9kWp2nLc", ticker: "$LUNAR", ca: "9kWp…2nLc", score: 11, tier: "TRAP", insiderPct: 74 },
  { rank: 3, mint: "Fv7m8qRa", ticker: "$GIGACHAD", ca: "Fv7m…8qRa", score: 14, tier: "TRAP", insiderPct: 71 },
  { rank: 4, mint: "Bp2x5sNe", ticker: "$ZACK", ca: "Bp2x…5sNe", score: 17, tier: "TRAP", insiderPct: 66 },
  { rank: 5, mint: "Lm9k3wDc", ticker: "$BWIRT", ca: "Lm9k…3wDc", score: 21, tier: "TRAP", insiderPct: 62 },
];

export default function HallOfShame() {
  const [rows, setRows] = useState<ShameItem[]>(FALLBACK);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/shame?range=week&limit=5")
      .then((r) => r.json())
      .then(({ items }) => {
        if (active && items?.length) {
          setRows(items);
          setLive(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="shame">
      <div className="wrap">
        <div className="sec-eyebrow">Hall of shame</div>
        <h2 className="sec-title">The most rigged launches this week.</h2>
        <div className="shame">
          {rows.map((s, i) => {
            const inner = (
              <>
                <div className="shame-l">
                  <span className="shame-rank">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="shame-tk">{s.ticker}</div>
                    <div className="shame-ca">{s.ca}</div>
                  </div>
                </div>
                <div className="shame-r">
                  <span className="shame-ins">{s.insiderPct}% insider</span>
                  <span className="shame-score">{s.score}</span>
                  <span className="shame-tier">{s.tier || tierName(s.score)}</span>
                </div>
              </>
            );
            return live ? (
              <a className="shame-row" key={s.mint + i} href={`/?mint=${s.mint}`}>
                {inner}
              </a>
            ) : (
              <div className="shame-row" key={s.mint + i}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
