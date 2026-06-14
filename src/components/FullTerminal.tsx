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
  return { t: clock(), mint: rnd(8) + "pump", ticker: TICKS[(Math.random() * TICKS.length) | 0], ca: `${rnd(4)}…${rnd(4)}`, score, tier: tierName(score) as FeedItem["tier"], color: tierColor(score), insiderPct: 25 + ((Math.random() * 65) | 0), marketCapSol: 5 + ((Math.random() * 80) | 0), scannedAt: new Date().toISOString(), agoSeconds: 0 };
}
const mcap = (s?: number) => (s == null ? "—" : s >= 1000 ? `${(s / 1000).toFixed(1)}k` : `${s}`);

export default function FullTerminal() {
  const [view, setView] = useState<Line[]>([]);
  const [live, setLive] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(false);
  const [stats, setStats] = useState({ total: 0, TRAP: 0, RIGGED: 0, MILD: 0, CLEAN: 0 });
  const [rate, setRate] = useState(0);

  const all = useRef<Line[]>([]);
  const pausedRef = useRef(false);
  const soundRef = useRef(false);
  const times = useRef<number[]>([]);
  const audio = useRef<AudioContext | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) setView([...all.current]);
  }, [paused]);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const beep = () => {
    try {
      const ac = (audio.current ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)());
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "square";
      o.frequency.value = 170;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.18);
      o.stop(ac.currentTime + 0.2);
    } catch {
      /* audio not allowed */
    }
  };

  useEffect(() => {
    let es: EventSource | null = null;
    let sim: ReturnType<typeof setInterval> | null = null;
    let real = false;

    const push = (l: Line) => {
      all.current = [...all.current.slice(-300), l];
      const k = (l.tier || tierName(l.score)) as keyof typeof stats;
      setStats((s) => ({ ...s, total: s.total + 1, [k]: (s[k] ?? 0) + 1 }));
      times.current.push(Date.now());
      if (soundRef.current && k === "TRAP") beep();
      if (!pausedRef.current) setView([...all.current]);
    };

    const startSim = () => {
      if (sim || real) return;
      all.current = Array.from({ length: 14 }, simLine);
      setView([...all.current]);
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
    const rt = setInterval(() => {
      const cut = Date.now() - 60_000;
      times.current = times.current.filter((t) => t > cut);
      setRate(times.current.length);
    }, 1000);

    return () => {
      es?.close();
      if (sim) clearInterval(sim);
      clearTimeout(fb);
      clearInterval(rt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return view.filter((l) => {
      if (filter !== "ALL" && (l.tier || tierName(l.score)) !== filter) return false;
      if (q && !(`${l.ticker}`.toLowerCase().includes(q) || `${l.ca}`.toLowerCase().includes(q) || `${l.mint}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [view, filter, search]);

  useEffect(() => {
    if (!paused) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [shown, paused]);

  const buffered = all.current.length - view.length;

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

      <div className="ft-controls">
        <div className="ft-filters">
          {(["ALL", "TRAP", "RIGGED", "MILD", "CLEAN"] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <input className="ft-search" placeholder="search ticker / CA…" value={search} onChange={(e) => setSearch(e.target.value)} spellCheck={false} />
        <button className={`ft-toggle${sound ? " on" : ""}`} onClick={() => setSound((v) => !v)} title="Sound on TRAP">
          {sound ? "🔔" : "🔕"} trap
        </button>
        <button className={`ft-toggle${paused ? " on" : ""}`} onClick={() => setPaused((v) => !v)}>
          {paused ? `▶ resume${buffered > 0 ? ` (${buffered})` : ""}` : "❚❚ pause"}
        </button>
      </div>

      <div className="ft-head">
        <span>time</span>
        <span>token</span>
        <span>risk</span>
        <span>score</span>
        <span>tier</span>
        <span className="ft-ins">insider</span>
        <span className="ft-mc">mcap</span>
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
              <span className="ft-mc" style={{ color: "var(--ink-2)" }}>{mcap(l.marketCapSol)}<small style={{ color: "var(--ink-3)" }}> ◎</small></span>
              <span className="ft-ca">{l.ca}</span>
            </a>
          );
        })}
      </div>

      <footer className="ft-cmd">
        <span className="pr">bundlescan@live</span>:<span style={{ color: "var(--ink-3)" }}>~</span>${" "}
        {paused ? "stream paused" : "watching pump.fun new mints"}
        <span className="ft-cur" />
      </footer>
    </div>
  );
}
