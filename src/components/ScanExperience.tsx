"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO, DEMO_TABS, type DemoKey } from "@/lib/demo";
import { isValidMint } from "@/lib/util";
import type { ScanResult } from "@/lib/types";

const SAMPLE_CA = "7xKpVeR4nQ2mL8sD3wYt…9fQa";

// ── Token contract address ─────────────────────────────────────────────────
// Set to the real Solana mint at launch; set back to null to show the
// "CA · COMING SOON" pill again. The pill auto-switches to click-to-copy.
// ⚠ PLACEHOLDER below so the live state can be previewed — REPLACE with the
//   real mint before deploying. Do not ship this fake address.
const TOKEN_CA: string | null = "SCAN7hX2kPq9mNvR4tB6yLgEaWcDsFj8uZ3nKpump";
const LOAD_MSGS = [
  "Pulling deploy transaction…",
  "Replaying blocks 0–12…",
  "Clustering bundled wallets…",
  "Scoring launch health…",
];

export default function ScanExperience() {
  const [ca, setCa] = useState("");
  const [current, setCurrent] = useState<DemoKey>("rigged");
  const [result, setResult] = useState<ScanResult>(DEMO.rigged);
  const [isLive, setIsLive] = useState(false);
  const [shown, setShown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadTxt, setLoadTxt] = useState(LOAD_MSGS[0]);
  const [error, setError] = useState<string | null>(null);

  // Animated bits.
  const [displayScore, setDisplayScore] = useState(0);
  const [stripWidth, setStripWidth] = useState(0);
  const [xrayGo, setXrayGo] = useState(false);
  const [copyTxt, setCopyTxt] = useState("copy");
  const [caCopied, setCaCopied] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const clearTimers = () => {
    timers.current.forEach(clearInterval);
    timers.current = [];
  };

  // Re-run the count-up + X-ray animations whenever the rendered result changes.
  useEffect(() => {
    if (!shown) return;
    const target = result.score;
    setDisplayScore(0);
    const step = Math.max(1, Math.ceil(target / 24));
    let c = 0;
    const iv = setInterval(() => {
      c += step;
      if (c >= target) {
        c = target;
        clearInterval(iv);
      }
      setDisplayScore(c);
    }, 20);

    setStripWidth(0);
    const raf = requestAnimationFrame(() => setStripWidth(result.insiderPct));
    setXrayGo(false);
    const raf2 = requestAnimationFrame(() => setXrayGo(true));

    return () => {
      clearInterval(iv);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(raf2);
    };
  }, [result, shown]);

  const reveal = useCallback((r: ScanResult, live: boolean) => {
    setResult(r);
    setIsLive(live);
    setShown(true);
    requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, []);

  const cycleMessages = () => {
    let i = 0;
    setLoadTxt(LOAD_MSGS[0]);
    const iv = setInterval(() => {
      i = (i + 1) % LOAD_MSGS.length;
      setLoadTxt(LOAD_MSGS[i]);
    }, 480);
    timers.current.push(iv);
    return iv;
  };

  const demoScan = useCallback(
    (key: DemoKey) => {
      setError(null);
      setCurrent(key);
      setLoading(true);
      cycleMessages();
      const done = setTimeout(() => {
        clearTimers();
        setLoading(false);
        reveal(DEMO[key], false);
      }, 1700);
      return () => clearTimeout(done);
    },
    [reveal],
  );

  const liveScan = useCallback(
    async (mint: string) => {
      setError(null);
      setLoading(true);
      cycleMessages();
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mint }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Scan failed");
        clearTimers();
        setLoading(false);
        reveal(data as ScanResult, true);
      } catch (e) {
        clearTimers();
        setLoading(false);
        setError(e instanceof Error ? e.message : "Scan failed");
      }
    },
    [reveal],
  );

  const onScan = useCallback(() => {
    const value = ca.trim();
    if (isValidMint(value)) {
      liveScan(value);
    } else {
      if (!value) setCa(SAMPLE_CA);
      demoScan("rigged");
    }
  }, [ca, demoScan, liveScan]);

  // Deep-link support: /?mint=<CA> (e.g. from the Telegram bot) auto-scans.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mint = params.get("mint");
    if (mint && isValidMint(mint)) {
      setCa(mint);
      liveScan(mint);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTab = (key: DemoKey) => {
    setCurrent(key);
    reveal(DEMO[key], false);
  };

  const copyCa = () => {
    navigator.clipboard?.writeText(isLive ? result.mint : result.ca).catch(() => {});
    setCopyTxt("copied");
    setTimeout(() => setCopyTxt("copy"), 1200);
  };

  const copyTokenCa = () => {
    if (!TOKEN_CA) return;
    navigator.clipboard?.writeText(TOKEN_CA).catch(() => {});
    setCaCopied(true);
    setTimeout(() => setCaCopied(false), 1200);
  };

  return (
    <>
      <a id="top" />
      <header className="hero">
        <div className="wrap">
          <div className="eyebrow">Block-zero launch forensics · Solana</div>
          <h1 className="hl">
            The launch was <em>rigged</em> before you bought.
          </h1>
          <p className="sub">
            BundleScan replays the first blocks of any token and exposes the wallets that captured
            supply alongside the deployer — then scores how loaded the launch really is.
          </p>
          <div
            className={`ca-pill${TOKEN_CA ? " live" : ""}`}
            onClick={copyTokenCa}
            role={TOKEN_CA ? "button" : undefined}
            tabIndex={TOKEN_CA ? 0 : undefined}
            onKeyDown={(e) => TOKEN_CA && e.key === "Enter" && copyTokenCa()}
            title={TOKEN_CA ? "Copy contract address" : "Contract address revealed at launch"}
          >
            <span className="dot" />
            <span className="ca-k">CA</span>
            <span className="ca-v">
              {TOKEN_CA ? `${TOKEN_CA.slice(0, 4)}…${TOKEN_CA.slice(-4)}` : "Coming soon"}
            </span>
            {TOKEN_CA && <span className="ca-act">{caCopied ? "copied" : "copy"}</span>}
          </div>
          <div className="scanbox">
            <div className="scan-field">
              <span className="pfx">CA</span>
              <input
                spellCheck={false}
                placeholder="Paste a Solana mint address…"
                autoComplete="off"
                value={ca}
                onChange={(e) => setCa(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onScan()}
              />
              <button className="scan-btn" onClick={onScan}>
                Scan <span className="arr">→</span>
              </button>
            </div>
            <div className="scan-meta">
              <a
                onClick={() => {
                  setCa(SAMPLE_CA);
                  setCurrent("rigged");
                  demoScan("rigged");
                }}
              >
                Try a live sample
              </a>
              &nbsp;·&nbsp; 41,208 launches X-rayed
            </div>
            <div className={`loading${loading ? " show" : ""}`}>
              <span className="spin" />
              <span>{loadTxt}</span>
            </div>
            {error && (
              <div className="scan-meta" style={{ color: "var(--signal)" }}>
                {error}
              </div>
            )}
          </div>
        </div>
      </header>

      <div id="result" className={shown ? "show" : ""} ref={resultRef}>
        <div className="wrap">
          <div className="r-inner">
            <div className="demo-tabs">
              {DEMO_TABS.map((t) => (
                <button
                  key={t.key}
                  className={!isLive && current === t.key ? "on" : ""}
                  onClick={() => selectTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="r-head">
              <div className="r-tk">
                <div className="nm">
                  <span>{result.name}</span>
                  <small>{result.ticker}</small>
                </div>
                <div className="ca">
                  <span className="mono">{isLive ? result.ca : result.ca}</span>
                  <span className="copy" onClick={copyCa}>
                    {copyTxt}
                  </span>
                </div>
              </div>
              <div className="r-score">
                <div className="lbl">Launch Health Score</div>
                <div className="num">
                  <span style={{ color: result.color }}>{displayScore}</span>
                  <small>/100</small>
                </div>
                <div className="tier" style={{ color: result.color }}>
                  {result.tier}
                </div>
              </div>
            </div>

            <div className={`xray${xrayGo ? " go" : ""}`}>
              <div className="xray-top">
                <div className="insider">
                  <span className="p">{result.insiderPct}%</span>
                  <span className="t">insider captured</span>
                </div>
                <div className="org">{result.organicPct}% organic</div>
              </div>
              <div className="strip">
                <div className="ins" style={{ width: `${stripWidth}%` }} />
                <div className="scan" key={`${result.mint}-${xrayGo}`} />
              </div>
              <div className="xray-break">
                dev <b>{result.devPct}%</b> &nbsp;·&nbsp; bundle <b>{result.bundlePct}%</b>{" "}
                &nbsp;·&nbsp; sniper <b>{result.sniperPct}%</b>
              </div>
              <div className="xray-note">{result.note}</div>
            </div>

            <div className="stats">
              {result.stats.map((s, i) => (
                <div className="stat" key={i}>
                  <div className={`v${s.sig ? " sig" : ""}`}>
                    {s.v}
                    <small>{s.unit}</small>
                  </div>
                  <div className="k">{s.k}</div>
                </div>
              ))}
            </div>

            <div className="wallets">
              <div className="w-h">Top suspect wallets</div>
              {result.wallets.slice(0, 8).map((w, i) => (
                <div className="w-row" key={i}>
                  <div className="w-l">
                    <span className="w-addr">{w.short}</span>
                    <span className="w-role">{w.role}</span>
                  </div>
                  <div className="w-r">
                    <span className="w-sup">{w.supplyPct}%</span>
                    <span className={`w-st ${w.held ? "hold" : "dump"}`}>
                      <span className="d" />
                      {w.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="vp">
              <div className="h">Forensic verdict</div>
              <p>{result.verdict}</p>
              {isLive && (
                <div className="scan-meta" style={{ marginTop: 24 }}>
                  <a href={`/api/card/${result.mint}.png`} target="_blank" rel="noreferrer">
                    Download share card →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
