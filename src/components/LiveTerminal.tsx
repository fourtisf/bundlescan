"use client";
import { useEffect, useRef, useState } from "react";
import type { FeedItem } from "@/lib/types";

function tierColor(s: number) {
  if (s < 25) return "var(--signal)";
  if (s < 55) return "var(--signal-2)";
  if (s < 80) return "var(--mild)";
  return "var(--clean)";
}
function tierName(s: number) {
  if (s < 25) return "TRAP";
  if (s < 55) return "RIGGED";
  if (s < 80) return "MILD";
  return "CLEAN";
}
function bar(score: number) {
  const filled = Math.max(1, Math.round(score / 20));
  return "▰".repeat(filled) + "▱".repeat(5 - filled);
}
function now() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

interface Line extends FeedItem {
  t: string;
}

const TICKS = ["PEPE2", "WIF", "BONKAI", "MOG", "SOLER", "GIGA", "RETARDIO", "NEKO", "DADDY", "FWOG", "SIGMA", "BORK", "MUMU", "BWIRT", "POPCAT", "ZACK", "LUNAR"];
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const randCA = () => {
  const p = (n: number) => Array.from({ length: n }, () => B58[(Math.random() * B58.length) | 0]).join("");
  return `${p(4)}…${p(4)}`;
};
function simLine(): Line {
  const r = Math.random();
  const score = r < 0.45 ? (Math.random() * 24) | 0 : r < 0.75 ? 25 + ((Math.random() * 29) | 0) : r < 0.9 ? 55 + ((Math.random() * 24) | 0) : 80 + ((Math.random() * 20) | 0);
  return { t: now(), mint: randCA(), ticker: TICKS[(Math.random() * TICKS.length) | 0], ca: randCA(), score, tier: tierName(score) as FeedItem["tier"], color: tierColor(score), insiderPct: 30 + ((Math.random() * 60) | 0), scannedAt: new Date().toISOString(), agoSeconds: 0 };
}

export default function LiveTerminal() {
  const [lines, setLines] = useState<Line[]>([]);
  const [live, setLive] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let simTimer: ReturnType<typeof setInterval> | null = null;
    let gotReal = false;

    const push = (l: Line) => setLines((prev) => [...prev.slice(-60), l]);

    const startSim = () => {
      if (simTimer || gotReal) return;
      setLines(Array.from({ length: 8 }, simLine));
      simTimer = setInterval(() => !gotReal && push(simLine()), 1800);
    };

    try {
      es = new EventSource("/api/stream");
      es.addEventListener("launch", (e) => {
        gotReal = true;
        setLive(true);
        if (simTimer) {
          clearInterval(simTimer);
          simTimer = null;
        }
        try {
          const item = JSON.parse((e as MessageEvent).data) as FeedItem;
          push({ ...item, t: now() });
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => startSim();
    } catch {
      startSim();
    }
    // If nothing real arrives quickly, show the simulated stream.
    const fallback = setTimeout(() => !gotReal && startSim(), 3500);

    return () => {
      es?.close();
      if (simTimer) clearInterval(simTimer);
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [lines]);

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

        <div className="term">
          <div className="term-bar">
            <span className="term-dot" style={{ background: "#D9594A" }} />
            <span className="term-dot" style={{ background: "#B0AEA7" }} />
            <span className="term-dot" style={{ background: "#7FA894" }} />
            <span className="term-title">bundlescan — live launch feed</span>
            <span className="term-status">
              <span className="term-live" />
              {live ? "streaming" : "demo stream"}
            </span>
          </div>
          <div className="term-body" ref={bodyRef}>
            {lines.map((l, i) => {
              const color = l.color || tierColor(l.score);
              const tk = l.ticker?.startsWith("$") ? l.ticker : `$${l.ticker}`;
              return (
                <div className="term-line" key={`${l.mint}-${i}`}>
                  <span className="term-t">{l.t}</span>
                  <span className="term-tk">{tk}</span>
                  <span className="term-bar2" style={{ color }}>{bar(l.score)}</span>
                  <span className="term-sc" style={{ color }}>{l.score}</span>
                  <span className="term-tier" style={{ color }}>{l.tier || tierName(l.score)}</span>
                  <span className="term-ins">{l.insiderPct}% ins</span>
                  <span className="term-ca">{l.ca}</span>
                </div>
              );
            })}
            <div className="term-line">
              <span className="term-cursor" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
