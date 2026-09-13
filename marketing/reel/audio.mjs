/**
 * Sound design for the reel — synthesised from scratch, so it is original
 * work with no licensing attached. Writes a 48kHz stereo WAV whose events
 * sit on the same timeline as reel.html.
 *
 *   node audio.mjs            -> audio.wav
 *
 * Design notes:
 *  - Act I is a ring tone that accelerates until it is oppressive.
 *  - The sweep cuts it dead. Silence is the loudest moment in the film.
 *  - Act III-b puts the ring ONLY in the left channel ("them") against a
 *    silent right channel ("you"). Worth wearing headphones for.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const SR = 48000, DUR = 22.9, N = Math.ceil(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N);

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** deterministic noise — no Math.random, so every render is identical */
let seed = 12345;
const noise = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x3fffffff) - 1; };

/** Mix a generator into the buffers. fn(u, tt) -> sample, u = 0..1 through the event. */
function at(start, len, gain, fn, pan = 0) {
  const i0 = Math.max(0, Math.round(start * SR)), i1 = Math.min(N, Math.round((start + len) * SR));
  const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  for (let i = i0; i < i1; i++) {
    const u = (i - i0) / (i1 - i0), s = fn(u, (i - i0) / SR);
    L[i] += s * gl; R[i] += s * gr;
  }
}
const decay = (u, k) => Math.exp(-k * u);
const hit   = (u, a) => (u < a ? u / a : Math.exp(-6 * (u - a) / (1 - a)));  // fast attack, tail

/* ------------------------------------------------------------------ *
 * 1. Bed — a low drone that carries the whole film
 * ------------------------------------------------------------------ */
at(0, 4.30, 0.085, (u, t) => {                       // night: minor, uneasy
  const env = Math.min(1, u * 14) * (u > .93 ? (1 - u) / .07 : 1);
  return env * (Math.sin(TAU * 55 * t) * .6 + Math.sin(TAU * 82.4 * t) * .28
    + Math.sin(TAU * 110.3 * t) * .12 + noise() * .012);
});
at(4.86, 18.0, 0.062, (u, t) => {                    // day: warm, open fifth
  const env = Math.min(1, u * 6) * (u > .90 ? (1 - u) / .10 : 1);
  const wob = 1 + Math.sin(TAU * 0.12 * t) * .0015;
  return env * (Math.sin(TAU * 73.4 * t * wob) * .55 + Math.sin(TAU * 110 * t) * .26
    + Math.sin(TAU * 220.5 * t) * .07 + noise() * .008);
});

/* ------------------------------------------------------------------ *
 * 2. Act I — the ring, accelerating
 * ------------------------------------------------------------------ */
const RINGS = [0.12, 0.86, 1.52, 2.04, 2.44, 2.76, 3.02];
RINGS.forEach((tt, i) => {
  const urgency = i / (RINGS.length - 1);
  const f = 400 + urgency * 34;                      // creeps sharp as it piles up
  at(tt, 0.40 - urgency * .10, 0.115 + urgency * .05, (u, t) => {
    const am = .55 + .45 * Math.sin(TAU * 25 * t);   // 25Hz warble = telephone ring
    return hit(u, .012) * am * (Math.sin(TAU * f * t) * .7 + Math.sin(TAU * (f * 1.125) * t) * .5);
  }, i % 2 ? .28 : -.28);
});

/* riser into the cut */
at(2.96, 1.22, 0.075, (u, t) => {
  const env = u * u;
  const f = 180 + 900 * u * u;
  return env * (Math.sin(TAU * f * t) * .35 + noise() * (.25 + u * .5));
});

/* ------------------------------------------------------------------ *
 * 3. The cut — impact, whoosh, then air
 * ------------------------------------------------------------------ */
at(4.18, 1.30, 0.42, (u, t) =>                       // sub thump
  decay(u, 7) * Math.sin(TAU * (56 - 16 * u) * t));
at(4.18, 0.16, 0.20, (u) => decay(u, 26) * noise()); // transient click
at(4.18, 0.62, 0.085, (u) => {                       // the sweep travelling down
  const n = noise();
  return Math.sin(Math.PI * u) * n * (1 - u * .4);
});
at(4.30, 1.50, 0.030, (u, t) =>                      // high tail = "ears ringing"
  decay(u, 3.4) * Math.sin(TAU * 3200 * t) * (.6 + .4 * Math.sin(TAU * 3.1 * t)));
at(4.86, 1.10, 0.075, (u, t) =>                      // warm swell as cream arrives
  Math.sin(Math.PI * u) * (Math.sin(TAU * 146.8 * t) * .5 + Math.sin(TAU * 220 * t) * .3));

/* ------------------------------------------------------------------ *
 * 4. UI ticks — small, dry, precise
 * ------------------------------------------------------------------ */
const tick = (tt, g = .05, f = 2100) =>
  at(tt, 0.09, g, (u, t) => decay(u, 40) * (Math.sin(TAU * f * t) * .7 + noise() * .3));
const thud = (tt, g = .30, f = 52) =>
  at(tt, 0.85, g, (u, t) => decay(u, 8) * Math.sin(TAU * (f - 10 * u) * t));

[5.34, 6.46, 6.60, 7.44, 7.76, 9.36].forEach(t => tick(t, .04));
at(6.98, 0.42, 0.05, (u, t) => Math.sin(Math.PI * u) * Math.sin(TAU * (300 + 500 * u) * t)); // dot travels
thud(7.36, .34);                                     // the call hits the shield
tick(7.36, .07, 3000);
at(8.02, 0.30, 0.11, (u, t) =>                       // "REJECTED"
  decay(u, 11) * (Math.sin(TAU * (220 - 90 * u) * t) * .7 + noise() * .25));
at(8.42, 0.90, 0.055, (u, t) =>                      // hero line swell
  Math.sin(Math.PI * u) * Math.sin(TAU * 110 * t));

/* ------------------------------------------------------------------ *
 * 5. Them vs you — the ring lives in the LEFT ear only
 * ------------------------------------------------------------------ */
[9.78, 10.26, 10.74].forEach(tt => {
  at(tt, 0.34, 0.10, (u, t) => {
    const am = .55 + .45 * Math.sin(TAU * 25 * t);
    return hit(u, .012) * am * (Math.sin(TAU * 400 * t) * .7 + Math.sin(TAU * 450 * t) * .5);
  }, -1);                                            // hard left: "them"
});

/* ------------------------------------------------------------------ *
 * 6. Product — phone rise, typing, save, dashboard
 * ------------------------------------------------------------------ */
at(11.30, 0.70, 0.070, (u, t) =>
  Math.sin(Math.PI * u) * (noise() * .5 + Math.sin(TAU * (120 + 260 * u) * t) * .5));
for (let i = 0; i < 6; i++) tick(11.90 + i * 0.113, .038, 1750 + i * 60);   // keystrokes
tick(12.60, .05, 2400);                              // "Starts With" selects
at(12.82, 0.24, 0.10, (u, t) => decay(u, 14) * (Math.sin(TAU * 180 * t) * .6 + noise() * .3)); // save
at(13.05, 0.80, 0.070, (u, t) =>                     // dashboard arrives
  Math.sin(Math.PI * u) * (Math.sin(TAU * 146.8 * t) * .5 + Math.sin(TAU * 293.7 * t) * .22));
at(13.33, 1.05, 0.030, (u, t) => {                   // the counter climbing
  const f = 700 + 900 * u;
  return Math.sin(Math.PI * u) * .5 * Math.sin(TAU * f * t) * (.5 + .5 * Math.sin(TAU * 18 * t));
});
[14.48, 14.70].forEach(t => tick(t, .035));

/* ------------------------------------------------------------------ *
 * 7. Privacy — four clean strikes
 * ------------------------------------------------------------------ */
[16.62, 16.92, 17.22, 17.52].forEach((tt, i) => {
  at(tt, 0.22, 0.075, (u, t) => {
    const n = noise() * Math.exp(-13 * u);
    return n * .8 + Math.sin(TAU * (900 - 260 * u) * t) * Math.exp(-16 * u) * .35;
  }, i % 2 ? .22 : -.22);
});
at(15.98, 0.80, 0.055, (u, t) => Math.sin(Math.PI * u) * Math.sin(TAU * 98 * t));

/* ------------------------------------------------------------------ *
 * 8. End card — a resolved chord
 * ------------------------------------------------------------------ */
at(19.05, 3.60, 0.105, (u, t) => {
  const env = Math.min(1, u * 5) * (u > .62 ? clamp(1 - (u - .62) / .38, 0, 1) : 1);
  return env * (Math.sin(TAU * 73.4 * t) * .42 + Math.sin(TAU * 146.8 * t) * .34
    + Math.sin(TAU * 220 * t) * .20 + Math.sin(TAU * 277.2 * t) * .13
    + Math.sin(TAU * 329.6 * t) * .09);
});
at(19.11, 1.40, 0.060, (u, t) =>                     // soft bell on the logo
  decay(u, 3.2) * (Math.sin(TAU * 880 * t) * .5 + Math.sin(TAU * 1320 * t) * .22));
thud(19.05, .22);

/* ------------------------------------------------------------------ *
 * 9. Master — soft clip, top & tail
 * ------------------------------------------------------------------ */
const softclip = x => Math.tanh(x * 1.18) * .90;
const fadeIn = Math.round(.03 * SR), fadeOut = Math.round(.45 * SR);
for (let i = 0; i < N; i++) {
  let l = softclip(L[i]), r = softclip(R[i]);
  if (i < fadeIn) { const g = i / fadeIn; l *= g; r *= g; }
  if (i > N - fadeOut) { const g = (N - i) / fadeOut; l *= g; r *= g; }
  L[i] = l; R[i] = r;
}

/* ---- write a 16-bit stereo WAV ---- */
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(clamp(L[i], -1, 1) * 32767), i * 4);
  data.writeInt16LE(Math.round(clamp(R[i], -1, 1) * 32767), i * 4 + 2);
}
const head = Buffer.alloc(44);
head.write("RIFF", 0); head.writeUInt32LE(36 + data.length, 4); head.write("WAVE", 8);
head.write("fmt ", 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20);
head.writeUInt16LE(2, 22); head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 4, 28);
head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34);
head.write("data", 36); head.writeUInt32LE(data.length, 40);

const out = join(import.meta.dirname, "audio.wav");
writeFileSync(out, Buffer.concat([head, data]));
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
console.log(`audio.wav written — ${DUR}s, peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS`);
