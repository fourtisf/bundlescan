/**
 * Static editorial sections ported 1:1 from the prototype (handoff §12):
 * Capabilities, Tiers, Method, Share-card, Access, Footer. Pure server
 * components — no interactivity.
 */

export function Capabilities() {
  const caps = [
    ["Bundle", <>Wallets that bought in the <b>same bundle</b> as the deploy transaction — coordinated supply capture before the market opened.</>],
    ["Snipe", <>Same-block and first-block buyers who <b>front-ran</b> every organic trader to the token.</>],
    ["Fund-trace", <>Funding followed back to its origin — flagging wallets seeded from the <b>deployer&apos;s own source</b>, or all fanned out from a single funder.</>],
    ["Cluster", <>Bundles, snipers and dev-linked wallets unified into <b>one insider group</b>, so you see total controlled supply, not scattered rows.</>],
    ["Track", <>Live <b>held-vs-dumped</b> status on every insider wallet — the difference between a closed risk and a loaded gun.</>],
    ["Alert", <>A Telegram ping the moment that insider supply <b>starts moving</b> — you hear it before the candle does.</>],
  ] as const;
  return (
    <section id="caps">
      <div className="wrap">
        <div className="sec-eyebrow">Capabilities</div>
        <h2 className="sec-title">What the X-Ray sees.</h2>
        <div className="caps">
          {caps.map(([tag, desc]) => (
            <div className="cap-row" key={tag}>
              <div className="cap-tag">{tag}</div>
              <div className="cap-desc">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Tiers() {
  const tiers = [
    ["var(--signal)", "TRAP", "0 – 24", "Majority insider supply, single funding source. A coordinated dump is the base case."],
    ["var(--signal-2)", "RIGGED", "25 – 54", "Insiders hold a meaningful share from block zero. You're exit liquidity unless they sell first."],
    ["var(--mild)", "MILD", "55 – 79", "Some coordination, but supply is still mostly out in the open market."],
    ["var(--clean)", "CLEAN", "80 – 100", "Organic distribution. Minimal bundling, low sniper supply, no insider cluster."],
  ] as const;
  return (
    <section id="tiers">
      <div className="wrap">
        <div className="sec-eyebrow">The classification</div>
        <h2 className="sec-title">One score for how loaded the gun is.</h2>
        <div className="scale-bar" />
        <div className="tier-row">
          {tiers.map(([color, name, rng, ds]) => (
            <div className="tier" key={name}>
              <div className="nm">
                <span className="sq" style={{ background: color }} />
                {name}
              </div>
              <div className="rng">{rng}</div>
              <div className="ds">{ds}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Method() {
  const steps = [
    ["01", "Replay block zero", "We pull the deploy transaction and the first blocks of trades, reconstructing who bought before the chart existed."],
    ["02", "Cluster the insiders", "Bundled buys, same-block snipers, and wallets funded from the deployer's source link into one cluster."],
    ["03", "Score & track", "A single Launch Health Score, plus live tracking of whether that insider supply is still held or already dumped."],
  ] as const;
  return (
    <section id="how">
      <div className="wrap">
        <div className="sec-eyebrow">Method</div>
        <h2 className="sec-title">Paste a mint. We rebuild the launch.</h2>
        <div className="flow">
          {steps.map(([n, st, sd]) => (
            <div className="fstep" key={n}>
              <div className="n">{n}</div>
              <div className="st">{st}</div>
              <div className="sd">{sd}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ShareCardSection() {
  return (
    <section id="share">
      <div className="wrap">
        <div className="sec-eyebrow">Built to be screenshotted</div>
        <h2 className="sec-title">One card. The whole verdict.</h2>
        <p className="sec-lead">
          Every scan generates a share card — drop it in a group chat or quote-tweet a launch, and
          the receipt speaks for itself.
        </p>
        <div className="card-wrap">
          <div className="scard">
            <div className="scard-top">
              <div className="scard-brand">
                <span className="m" />
                BundleScan
              </div>
              <div className="scard-tag">Launch X-Ray</div>
            </div>
            <div className="scard-tk">
              WAGMI<small>$WAGMI</small>
            </div>
            <div className="scard-mid">
              <div className="scard-score">
                24<small>/100</small>
              </div>
              <div className="scard-verdict">
                <div className="t">Rigged</div>
                <div className="i">61% insider · 71% held</div>
              </div>
            </div>
            <div className="scard-strip">
              <div className="ins" />
            </div>
            <div className="scard-foot">
              <span>14 bundled · 9 snipers</span>
              <span>bundlescan.io / 7xKp…9fQa</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-in">
          <div className="foot-eco">
            Part of the <b>Fourtis</b> ecosystem · pairs with <b>DevRadar</b>
          </div>
          <div className="foot-links">
            <a href="#top">Scan</a>
            <a href="#caps">Capabilities</a>
            <a href="#access">Access</a>
          </div>
        </div>
        <div className="disclaimer">
          BundleScan is an on-chain analytics tool, not financial advice. Forensic scores are
          probabilistic signals derived from block-level data and may misclassify. Always do your
          own research. Demo data and SOL pricing shown are illustrative placeholders.
        </div>
      </div>
    </footer>
  );
}
