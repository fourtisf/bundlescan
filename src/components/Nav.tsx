"use client";
import { useState } from "react";

const LINKS = [
  { href: "#feed", label: "Live", menu: "Live feed", n: "01" },
  { href: "#caps", label: "Capabilities", menu: "Capabilities", n: "02" },
  { href: "#tiers", label: "Tiers", menu: "Score tiers", n: "03" },
  { href: "#how", label: "Method", menu: "Method", n: "04" },
  { href: "#shame", label: "Hall of shame", menu: "Hall of shame", n: "05" },
  { href: "#share", label: "", menu: "Share card", n: "06" },
  { href: "#access", label: "Access", menu: "Access & pricing", n: "07" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <nav>
      <div className="wrap nav-in">
        <div className="brand">
          <span className="mark" />
          BundleScan
        </div>
        <div className="nav-r">
          {LINKS.filter((l) => l.label).map((l) => (
            <a key={l.href} href={l.href} className="lnk nav-link">
              {l.label}
            </a>
          ))}
          <a href="#top" className="nav-cta nav-link">
            Scan
          </a>
          <button
            className={`menu-btn${open ? " open" : ""}`}
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>
      <div className={`menu-panel${open ? " open" : ""}`}>
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="menu-item nav-link"
            onClick={() => setOpen(false)}
          >
            <span className="mi-n">{l.n}</span>
            {l.menu}
          </a>
        ))}
        <a href="#top" className="menu-item menu-cta nav-link" onClick={() => setOpen(false)}>
          <span className="mi-n">→</span>Scan a launch
        </a>
      </div>
    </nav>
  );
}
