/**
 * One command, one finished reel.
 *
 *   node build.mjs            # fonts -> frames -> audio -> mp4
 *   node build.mjs --fast     # 30fps draft, for checking timing quickly
 *   node build.mjs --skip-frames   # re-encode using frames already captured
 *
 * Outputs into out/:
 *   spam-shield-reel.mp4          1080x1920, with the sound design
 *   spam-shield-reel-silent.mp4   same picture, no audio (for trending audio)
 *   cover.jpg                     a still to use as the reel cover
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIR = import.meta.dirname;
const args = process.argv.slice(2);
const has = n => args.includes("--" + n);
const OUT = join(DIR, "out");
const FRAMES = join(DIR, ".frames");
mkdirSync(OUT, { recursive: true });

const run = (cmd, a, label) => {
  process.stdout.write(`\n▸ ${label}\n`);
  const r = spawnSync(cmd, a, { stdio: "inherit", cwd: DIR, shell: false });
  if (r.status !== 0) { console.error(`\n✗ ${label} failed (exit ${r.status})`); process.exit(1); }
};

/* 1. fonts */
if (!existsSync(join(DIR, "fonts.css"))) run("node", ["gen-fonts.mjs"], "embedding fonts");

/* 2. frames — captured at exactly the rate we will encode at */
const FPS = has("fast") ? 30 : 60;
if (!has("skip-frames"))
  run("node", ["capture.mjs", "--fps", String(FPS)], "capturing frames (this is the slow part)");
if (!existsSync(FRAMES) || !readdirSync(FRAMES).length) {
  console.error("No frames captured."); process.exit(1);
}
const frameCount = readdirSync(FRAMES).filter(f => f.endsWith(".png")).length;

/* 3. audio */
run("node", ["audio.mjs"], "synthesising sound design");

/* 4. encode.
   loudnorm brings the bed up to the ~-14 LUFS that Instagram/TikTok target,
   so the reel is not noticeably quieter than everything else in the feed. */
const mp4 = join(OUT, "spam-shield-reel.mp4");
const silent = join(OUT, "spam-shield-reel-silent.mp4");
const V = ["-c:v", "libx264", "-preset", "slow", "-crf", "18",
           "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.2",
           "-movflags", "+faststart", "-r", String(FPS)];

run("ffmpeg", ["-y", "-framerate", String(FPS), "-i", join(FRAMES, "f%05d.png"),
  "-i", join(DIR, "audio.wav"),
  // loudnorm runs its filter chain at 192kHz, so resample back to 48k —
  // otherwise the AAC lands at 96kHz, which some players and IG re-encode badly.
  ...V, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000",
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
  "-shortest", mp4], "encoding mp4 (with audio)");

run("ffmpeg", ["-y", "-framerate", String(FPS), "-i", join(FRAMES, "f%05d.png"),
  ...V, "-an", silent], "encoding mp4 (silent)");

/* 5. a cover frame — the end card reads best as a thumbnail */
run("ffmpeg", ["-y", "-ss", "21.4", "-i", mp4, "-frames:v", "1", "-q:v", "2", "-update", "1",
  join(OUT, "cover.jpg")], "extracting cover frame");

const mb = p => (statSync(p).size / 1048576).toFixed(1) + " MB";
console.log(`\n✓ done — ${frameCount} frames @ ${FPS}fps`);
console.log(`  ${mp4}  (${mb(mp4)})`);
console.log(`  ${silent}  (${mb(silent)})`);
console.log(`  ${join(OUT, "cover.jpg")}`);
