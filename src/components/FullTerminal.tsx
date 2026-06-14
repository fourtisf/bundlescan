"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { tierColor, tierName, scoreBar } from "@/lib/tierClient";
import type { FeedItem } from "@/lib/types";

interface Line extends FeedItem {
  t: string;
}
type Filter = "ALL" | "TRAP" | "RIGGED" | "MILD" | "CLEAN";

const TICKS = ["PEPE2", "WIF", "BONKAI", "MOG", "SOLER", "GIGA", "RETARDIO", "NEKO", "DADDY", "FWOG", "SIGMA", "BORK", "MUMU", "BWIRT", "POPCAT", "ZACK", "LUNAR", "BNUT"];
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const rnd = (n: number) => Array.from({ length: n }, () => B58[(Math.random() * B58.length) | 0]).join("");
const clock = () => new Date().toLocaleTimeString("en-GB", { hour12: false });
function simLine(): Line {
  const r = Math.random();
  const score = r < 0.45 ? (Math.random() * 24) | 0 : r < 0.75 ? 25 + ((Math.random() * 29) | 0) : r < 0.9 ? 55 + ((Math.random() * 24) | 0) : 80 + ((Math.random() * 20) | 0);
  return { t: clock(), mint: rnd(8) + "pump", ticker: TICKS[(Math.random() * TICKS.length) | 0], ca: `${rnd(4)}…${rnd(4)}`, score, tier: tierName(score) as FeedItem["tier"], color: tierColor(score), insiderPct: 25 + ((Math.random() * 65) | 0), scannedAt: new Date().toISOString(), agoSeconds: 0 };
}

export default function FullTerminal() {
  const [lines, setLines] = useState<Line[]>([]);
  const [live, setLive] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [stats, setStats] = useState({ total: 0, TRAP: 0, RIGGED: 0, MILD: 0, CLEAN: 0 });
  const bodyRef = useRef<HTMLDivElement>(null);
  const times = useRef<number[]>([]);
  const [rate, setRate] = useState(0);

  useEffect(() => {
    let es: EventSource | null = null;
    let sim: ReturnType<typeof setInterval> | null = null;
    let real = false;

    const push = (l: Line) => {
      setLines((prev) => [...prev.slice(-300), l]);
      setStats((s) => {
        const k = (l.tier || tierName(l.score)) as keyof typeof s;
        return { ...s, total: s.total + 1, [k]: (s[k] ?? 0) + 1 };
      });
      times.current.push(Date.now());
    };

    const startSim = () => {
      if (sim || real) return;
      setLines(Array.from({ length: 14 }, simLine));
      sim = setInterval(() => !real && push(simLine()), 1400);
    };

    try {
      es = new EventSource("/api/stream");
      es.addEventListener("launch", (e) => {
        real = true;
        setLive(true);
        if (sim) {
          clearInterval(sim);
          sim = null;
        }
        try {
          push({ ...(JSON.parse((e as MessageEvent).data) as FeedItem), t: clock() });
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => startSim();
    } catch {
      startSim();
    }
    const fb = setTimeout(() => !real && startSim(), 3500);
    const rateTimer = setInterval(() => {
      const cut = Date.now() - 60_000;
      times.current = times.current.filter((t) => t > cut);
      setRate(times.current.length);
    }, 1000);

    return () => {
      es?.close();
      if (sim) clearInterval(sim);
      clearTimeout(fb);
      clearInterval(rateTimer);
    };
  }, []);

  const shown = useMemo(
    () => (filter === "ALL" ? lines : lines.filter((l) => (l.tier || tierName(l.score)) === filter)),
    [lines, filter],
  );

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [shown]);

  return (
    <div className="ft">
      <header className="ft-top">
        <a href="/" className="ft-brand">
          <span className="mk" />
          BundleScan <small>LIVE TERMINAL</small>
        </a>
        <div className="ft-status">
          <span className="d" style={{ background: live ? "var(--clean)" : "var(--signal)", boxShadow: `0 0 8px ${live ? "var(--clean)" : "var(--signal)"}` }} />
          {live ? "streaming · pump.fun" : "demo stream"}
        </div>
      </header>

      <div className="ft-stats">
        <div className="ft-stat">scored <b>{stats.total}</b></div>
        <div className="ft-stat" style={{ color: "var(--signal)" }}>trap <b style={{ color: "var(--signal)" }}>{stats.TRAP}</b></div>
        <div className="ft-stat" style={{ color: "var(--signal-2)" }}>rigged <b style={{ color: "var(--signal-2)" }}>{stats.RIGGED}</b></div>
        <div className="ft-stat" style={{ color: "var(--mild)" }}>mild <b style={{ color: "var(--mild)" }}>{stats.MILD}</b></div>
        <div className="ft-stat" style={{ color: "var(--clean)" }}>clean <b style={{ color: "var(--clean)" }}>{stats.CLEAN}</b></div>
        <div className="ft-stat">~<b>{rate}</b>/min</div>
      </div>

      <div className="ft-filters">
        {(["ALL", "TRAP", "RIGGED", "MILD", "CLEAN"] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      <div className="ft-head">
        <span>time</span>
        <span>token</span>
        <span>risk</span>
        <span>score</span>
        <span>tier</span>
        <span className="ft-ins">insider</span>
        <span className="ft-ca">contract</span>
      </div>

      <div className="ft-body" ref={bodyRef}>
        {shown.map((l, i) => {
          const color = l.color || tierColor(l.score);
          const tk = l.ticker?.startsWith("$") ? l.ticker : `$${l.ticker}`;
          return (
            <a className="ft-row" key={`${l.mint}-${i}`} href={`/?mint=${l.mint}`}>
              <span className="ft-t">{l.t}</span>
              <span className="ft-tk">{tk}</span>
              <span style={{ color, letterSpacing: 2 }}>{scoreBar(l.score)}</span>
              <span style={{ color, fontWeight: 500 }}>{l.score}</span>
              <span style={{ color }}>{l.tier || tierName(l.score)}</span>
              <span className="ft-ins" style={{ color: "var(--ink-2)" }}>{l.insiderPct}%</span>
              <span className="ft-ca">{l.ca}</span>
            </a>
          );
        })}
      </div>

      <footer className="ft-cmd">
        <span className="pr">bundlescan@live</span>:<span style={{ color: "var(--ink-3)" }}>~</span>${" "}
        watching pump.fun new mints
        <span className="ft-cur" />
      </footer>
    </div>
  );
}
