import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
const render = (file, width) =>
  new Resvg(readFileSync(file, "utf8"), { fitTo: { mode: "width", value: width } }).render().asPng();

// Favicon + app icons (Next App Router auto-detects these in src/app/)
writeFileSync("../src/app/icon.png", render("icon.svg", 256));
writeFileSync("../src/app/apple-icon.png", render("icon.svg", 180));
// Social share images
const og = render("og.svg", 1200);
writeFileSync("../src/app/opengraph-image.png", og);
writeFileSync("../src/app/twitter-image.png", og);
// X header banner (delivered to user, not a site asset)
writeFileSync("x-header-banner.png", render("x-banner.svg", 1500));
console.log("assets written");
