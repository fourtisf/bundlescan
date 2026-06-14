import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
const files = [
  ["logo-lockup-pro.svg", 720, 180, 1440],
  ["logo-gem.svg", 256, 256, 512],
];
for (const [file, w, h] of files) {
  const raw = readFileSync(file, "utf8");
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const pad = Math.round(w * 0.1);
  const W = w + pad * 2, H = h + pad * 2;
  const wrapped =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" rx="${Math.round(W*0.05)}" fill="#0A0A0C"/>` +
    `<g transform="translate(${pad} ${pad})">${inner}</g></svg>`;
  const png = new Resvg(wrapped, { fitTo: { mode: "width", value: W*2 } }).render().asPng();
  writeFileSync(file.replace(".svg",".png"), png);
  console.log("rendered", file.replace(".svg",".png"));
}
