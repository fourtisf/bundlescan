import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
for (const f of readdirSync(".").filter(f => f.endsWith(".svg"))) {
  const png = new Resvg(readFileSync(f, "utf8"), { fitTo: { mode: "width", value: 1600 } }).render().asPng();
  writeFileSync(f.replace(".svg", ".png"), png);
  console.log("rendered", f.replace(".svg", ".png"));
}
