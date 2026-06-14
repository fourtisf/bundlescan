"use client";
import { useEffect, useState } from "react";
import type { FeedItem } from "@/lib/types";

/** Tier helpers inlined client-side (score.ts pulls Prisma — server only). */
function tierColor(score: number) {
  if (score < 25) return "var(--signal)";
  if (score < 55) return "var(--signal-2)";
  if (score < 80) return "var(--mild)";
  return "var(--clean)";
}
function tierName(score: number) {
  if (score < 25) return "TRAP";
  if (score < 55) return "RIGGED";
  if (score < 80) return "MILD";
  return "CLEAN";
}

const TICKS = ["PEPE2", "WIF", "BONKAI", "MOG", "SOLER", "GIGA", "RETARDIO", "NEKO", "DADDY", "CHAD", "FWOG", "SIGMA", "BORK", "MUMU", "BWIRT", "POPCAT", "ZACK", "LUNAR"];
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function randCA() {
  const pick = (n: number) => Array.from({ length: n }, () => B58[(Math.random() * B58.length) | 0]).join("");
  return `${pick(4)}…${pick(4)}`;
}

/** Simulated row (ported from the prototype) used until the indexer has data. */
function simRow(): FeedItem {
  const r = Math.random();
  let score: number;
  if (r < 0.45) score = (Math.random() * 24) | 0;
  else if (r < 0.75) score = 25 + ((Math.random() * 29) | 0);
  else if (r < 0.9) score = 55 + ((Math.random() * 24) | 0);
  else score = 80 + ((Math.random() * 20) | 0);
  return {
    mint: randCA(),
    ticker: TICKS[(Math.random() * TICKS.length) | 0],
    ca: randCA(),
    score,
    tier: tierName(score) as FeedItem["tier"],
    color: tierColor(score),
    insiderPct: 0,
    scannedAt: new Date().toISOString(),
    agoSeconds: 1 + ((Math.random() * 9) | 0),
  };
}

export default function LiveFeed() {
  const [rows, setRows] = useState<FeedItem[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval>;

    const startSim = () => {
      setRows(Array.from({ length: 6 }, simRow));
      interval = setInterval(() => {
        setRows((prev) => [simRow(), ...prev].slice(0, 6));
      }, 2600);
    };

    const startLive = () => {
      interval = setInterval(async () => {
        try {
          const { items } = await fetch("/api/feed?limit=6").then((r) => r.json());
          if (active && items?.length) setRows(items);
        } catch {
          /* keep last */
        }
      }, 4000);
    };

    fetch("/api/feed?limit=6")
      .then((r) => r.json())
      .then(({ items }) => {
        if (!active) return;
        if (items?.length) {
          setRows(items);
          setLive(true);
          startLive();
        } else {
          startSim();
        }
      })
      .catch(() => active && startSim());

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <section id="feed">
      <div className="wrap">
        <div className="sec-eyebrow">
          <span className="live-d" />
          Live
        </div>
        <h2 className="sec-title">Launches, X-rayed as they happen.</h2>
        <p className="sec-lead">
          Every new Solana token is replayed and scored within seconds of deploy — long before the
          chart tells you anything.
        </p>
        <div className="feed">
          {rows.map((row, i) => {
            const color = row.color || tierColor(row.score);
            const tk = row.ticker.startsWith("$") ? row.ticker : `$${row.ticker}`;
            const content = (
              <>
                <div className="feed-l">
                  <span className="feed-tk">{tk}</span>
                  <span className="feed-ca">{row.ca}</span>
                </div>
                <div className="feed-r">
                  <span className="feed-time">{row.agoSeconds}s ago</span>
                  <span className="feed-score" style={{ color }}>
                    {row.score}
                  </span>
                  <span className="feed-tier" style={{ color }}>
                    {row.tier || tierName(row.score)}
                  </span>
                </div>
              </>
            );
            return live ? (
              <a className="feed-row" key={`${row.mint}-${i}`} href={`/?mint=${row.mint}`}>
                {content}
              </a>
            ) : (
              <div className="feed-row" key={`${row.mint}-${i}`}>
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
