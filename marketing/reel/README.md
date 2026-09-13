# Spam Shield — launch reel

A 22.9s, 1080×1920 motion-graphics film for Instagram Reels, rendered from code.

Nothing here is a screen recording. `reel.html` is a deterministic timeline —
every visual property is a pure function of `t` — and `capture.mjs` steps
headless Chrome through it one frame at a time. Re-running produces the same
bytes. Change a word, re-render, get a new master.

```bash
node build.mjs            # fonts -> frames -> audio -> mp4   (~4 min at 60fps)
node build.mjs --fast     # 30fps draft, ~90s, for checking timing
node build.mjs --skip-frames   # re-encode without re-capturing
```

Output lands in `out/`:

| file | use |
| --- | --- |
| `spam-shield-reel.mp4` | the reel, with the sound design |
| `spam-shield-reel-silent.mp4` | same picture, no audio — for dropping a trending sound on in the IG editor |
| `cover.jpg` | the end card, as the reel cover image |

## Editing it

**Copy, stats, and the CTA** live in one `CONFIG` block at the top of the
`<script>` in `reel.html`. That is where the GitHub URL and the dashboard
numbers are set.

**Timing** lives in the `T` object just below it — one line per act. Shifting
a beat means changing one number.

**Working on a single moment** without rendering the whole film:

```bash
node capture.mjs --still 7.6          # one frame -> stills/t7.60.png
node capture.mjs --still 2,5,9,14     # several at once
```

Or open it in a browser and scrub:

- `reel.html?play=1` — plays on loop, scaled to fit the window
- `reel.html?fit=1&t=7.6` — parks on one frame
- `reel.html?fit=1&guides=1` — shows the Instagram safe-area guides

## The structure

| time | beat |
| --- | --- |
| 0.0–4.1 | **The problem.** Night. Unknown numbers stack up, accelerating. |
| 4.1–6.4 | **The turn.** A coral line sweeps through and strikes them all out; the ground flips to cream. *"What if it never rang?"* |
| 6.4–9.3 | **The mechanism.** The call reaches Spam Shield, gets matched, gets rejected — *before your phone ever rings.* |
| 9.3–11.3 | **Them vs you.** They hear a normal ring. You hear silence. |
| 11.3–15.7 | **The product.** A rule is written; the dashboard counts up. |
| 15.7–19.1 | **Privacy.** Nothing leaves your phone. |
| 19.1–22.9 | **End card.** Logo, tagline, repo. |

## Why it looks like the app

The palette, type and UI are pulled from the real source, not approximated:

- colours from `constants/theme.ts`
- Playfair Display + Inter, the actual `.ttf` files from
  `node_modules/@expo-google-fonts`, baked into `fonts.css` as data URLs
  (run `node gen-fonts.mjs` if that file is missing — it needs `npm install`
  in the app root first)
- the shield mark is the real path data from `assets/branding/logo.svg`
- the dashboard and add-rule screens are rebuilt from `app/(tabs)/index.tsx`
  and `app/add-rule.tsx`, including the five match-type labels and hint copy

## Sound

`audio.mjs` synthesises the whole bed from scratch — no samples, no licensing.
The ring tone accelerates through Act I, gets cut dead by the sweep, and the
Act III-b ring plays **only in the left channel** against a silent right one.
`build.mjs` normalises to −14 LUFS, which is what Instagram targets.

## Claims

Everything stated in the film is checked against `docs/` and the source:
screening happens before the phone rings, five match types including regex,
no servers or cloud lists, no contacts or call-log permission, works offline.

Two things are **not** facts and are yours to set:

- `CONFIG.github` — the repo URL is a placeholder
- `CONFIG.stats` — the dashboard numbers are a product mockup

## Requirements

Node 20+ (uses the built-in `WebSocket`), `ffmpeg` on PATH, and a Chromium.
`capture.mjs` finds Playwright's bundled Chromium, then Chrome, then Edge, or
takes `--chrome <path>`.

`.frames/`, `.chrome-profile/`, `stills/` and `fonts.css` are build artifacts.
