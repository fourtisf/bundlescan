import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
const BG = "#08080A"; // brand near-black, full bleed (no rounded corners, no transparency)
const files = [
  ["logo-lockup-pro.svg", 720, 180],
  ["logo-lockup.svg", 560, 150],
  ["logo-gem.svg", 256, 256],
  ["logo-signal.svg", 256, 256],
  ["logo-cluster.svg", 256, 256],
  ["logo-reticle.svg", 256, 256],
];
for (const [file, w, h] of files) {
  const raw = readFileSync(file, "utf8");
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const pad = Math.round(w * 0.12);
  const W = w + pad * 2, H = h + pad * 2;
  const wrapped =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${BG}"/>` + // full rectangle, rx=0
    `<g transform="translate(${pad} ${pad})">${inner}</g></svg>`;
  const png = new Resvg(wrapped, { fitTo: { mode: "width", value: W * 2 } }).render().asPng();
  writeFileSync(file.replace(".svg", ".png"), png);
  console.log("rendered", file.replace(".svg", ".png"));
}
