/**
 * Bakes the app's real fonts (Playfair Display + Inter) into a single
 * self-contained fonts.css with data: URLs.
 *
 * Why: the reel must render identically every time, with zero network.
 * Loading from fonts.googleapis.com would make frame capture race against
 * the network and could silently fall back to a system font mid-render.
 *
 *   node gen-fonts.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const NM = join(ROOT, "node_modules", "@expo-google-fonts");

// [css family name, weight, style, path within @expo-google-fonts]
const FACES = [
  ["Playfair", 400, "normal", "playfair-display/400Regular/PlayfairDisplay_400Regular.ttf"],
  ["Playfair", 400, "italic", "playfair-display/400Regular_Italic/PlayfairDisplay_400Regular_Italic.ttf"],
  ["Playfair", 600, "normal", "playfair-display/600SemiBold/PlayfairDisplay_600SemiBold.ttf"],
  ["Playfair", 700, "normal", "playfair-display/700Bold/PlayfairDisplay_700Bold.ttf"],
  ["Playfair", 900, "normal", "playfair-display/900Black/PlayfairDisplay_900Black.ttf"],
  ["Inter", 400, "normal", "inter/400Regular/Inter_400Regular.ttf"],
  ["Inter", 500, "normal", "inter/500Medium/Inter_500Medium.ttf"],
  ["Inter", 600, "normal", "inter/600SemiBold/Inter_600SemiBold.ttf"],
  ["Inter", 700, "normal", "inter/700Bold/Inter_700Bold.ttf"],
];

const out = [];
let embedded = 0;
for (const [family, weight, style, rel] of FACES) {
  const p = join(NM, rel);
  if (!existsSync(p)) {
    console.warn(`  skip (not found): ${rel}`);
    continue;
  }
  const b64 = readFileSync(p).toString("base64");
  out.push(
    `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};` +
      `font-display:block;src:url(data:font/ttf;base64,${b64}) format("truetype")}`,
  );
  embedded++;
}

if (!embedded) {
  console.error("No fonts found. Run `npm install` in the app root first.");
  process.exit(1);
}

const dest = join(import.meta.dirname, "fonts.css");
writeFileSync(dest, out.join("\n") + "\n");
const mb = (Buffer.byteLength(out.join("\n")) / 1048576).toFixed(2);
console.log(`fonts.css written — ${embedded} faces, ${mb} MB`);
