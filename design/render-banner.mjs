import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Renders the launch-promo SVGs to 2× PNGs for social posting.
// Run from anywhere: `node design/render-banner.mjs`.
const here = dirname(fileURLToPath(import.meta.url));
const jobs = [
  ["banner-terminal.svg", "banner-terminal.png", 3200], // 2× of 1600
  ["banner-access.svg", "banner-access.png", 3200], // 2× of 1600
  ["x-header-terminal.svg", "x-header-terminal.png", 3000], // 2× of 1500
];

for (const [src, out, width] of jobs) {
  const svg = readFileSync(resolve(here, src), "utf8");
  const png = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
  writeFileSync(resolve(here, out), png);
  console.log("rendered", out, `(${width}px wide)`);
}
