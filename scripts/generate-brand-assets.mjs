import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "assets", "branding", "logo.svg");
const imagesDir = path.join(root, "assets", "images");

if (!fs.existsSync(source)) {
  throw new Error(`Missing source logo: ${source}`);
}

fs.mkdirSync(imagesDir, { recursive: true });

const logoSvg = fs.readFileSync(source);

const jobs = [
  { file: "icon.png", size: 1024 },
  { file: "favicon.png", size: 256 },
  { file: "android-icon-foreground.png", size: 1024 },
  { file: "android-icon-monochrome.png", size: 1024 },
  { file: "splash-icon.png", size: 512 },
];

for (const job of jobs) {
  const target = path.join(imagesDir, job.file);
  await sharp(logoSvg, { density: 2048 })
    .resize(job.size, job.size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(target);
  console.log(`Generated ${path.relative(root, target)}`);
}

console.log("Brand assets generated from assets/branding/logo.svg");
