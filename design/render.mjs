import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  ["logo-lockup.svg", 560, 150, 1120],
  ["logo-signal.svg", 256, 256, 512],
  ["logo-reticle.svg", 256, 256, 512],
  ["logo-cluster.svg", 256, 256, 512],
];

for (const [file, w, h, outW] of files) {
  const raw = readFileSync(file, "utf8");
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  // Wrap with the brand near-black background + padding so marks preview clearly.
  const pad = Math.round(w * 0.12);
  const W = w + pad * 2, H = h + pad * 2;
  const wrapped =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" rx="${Math.round(W*0.06)}" fill="#0A0A0C"/>` +
    `<g transform="translate(${pad} ${pad})">${inner}</g></svg>`;
  const png = new Resvg(wrapped, { fitTo: { mode: "width", value: Math.round(outW * (W/w)) } }).render().asPng();
  const out = file.replace(".svg", ".png");
  writeFileSync(out, png);
  console.log("rendered", out, png.length, "bytes");
}
