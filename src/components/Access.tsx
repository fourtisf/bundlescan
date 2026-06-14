"use client";
import { useState } from "react";
import { subscribe } from "@/lib/wallet";

/** Access & pricing (handoff §11). Plan CTAs wire to the wallet subscribe flow. */
export default function Access() {
  const operatorPrice = Number(process.env.NEXT_PUBLIC_PRICE_OPERATOR_SOL || 2);
  const syndicatePrice = Number(process.env.NEXT_PUBLIC_PRICE_SYNDICATE_SOL || 8);
  const [status, setStatus] = useState<string | null>(null);

  const buy = async (amount: number) => {
    setStatus("Confirm the payment in your wallet…");
    try {
      const res = await subscribe(amount);
      setStatus(`Upgraded to ${res.tier} — active until ${new Date(res.expiresAt).toLocaleDateString()}.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Subscription failed");
    }
  };

  return (
    <section id="access">
      <div className="wrap">
        <div className="sec-eyebrow">Access</div>
        <h2 className="sec-title">Scan free. Go deeper on-chain.</h2>
        <div className="plans">
          <div className="plan">
            <div className="pn">Scout</div>
            <div className="pp">
              <b>Free</b>
            </div>
            <ul>
              <li>5 scans per day</li>
              <li>Launch X-Ray &amp; health score</li>
              <li>Suspect wallet table</li>
              <li>Share cards</li>
            </ul>
            <a href="#top" className="pcta">
              Start scanning
            </a>
          </div>
          <div className="plan feat">
            <div className="pn">Operator</div>
            <div className="pp">
              <b>{operatorPrice} SOL</b> / month
            </div>
            <ul>
              <li>Unlimited scans</li>
              <li>Live launch feed access</li>
              <li>Held-vs-dumped tracking</li>
              <li>Telegram bot &amp; movement alerts</li>
              <li>DevRadar deployer cross-link</li>
            </ul>
            <span className="pcta" onClick={() => buy(operatorPrice)}>
              Connect wallet
            </span>
          </div>
          <div className="plan">
            <div className="pn">Syndicate</div>
            <div className="pp">
              <b>{syndicatePrice} SOL</b> / month
            </div>
            <ul>
              <li>Everything in Operator</li>
              <li>Watchlist &amp; per-token alerts</li>
              <li>Hall-of-shame data feed</li>
              <li>API access</li>
              <li>Priority indexing</li>
            </ul>
            <span className="pcta" onClick={() => buy(syndicatePrice)}>
              Connect wallet
            </span>
          </div>
        </div>
        {status && (
          <div className="scan-meta" style={{ marginTop: 24 }}>
            {status}
          </div>
        )}
      </div>
    </section>
  );
}
