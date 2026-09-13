<h1 align="center">Spam Shield</h1>

<p align="center"><em>Your calls, your rules.</em></p>

<p align="center">
  An Android call blocker that rejects spam <strong>before your phone rings</strong>.<br>
  No servers, no cloud spam list, no account. Nothing ever leaves the device.
</p>

<p align="center">
  <a href="https://github.com/himanshuSri24/spam-shield/releases/latest"><img alt="Download APK" src="https://img.shields.io/github/v/release/himanshuSri24/spam-shield?label=download%20apk&color=D4613A"></a>
  <img alt="Android 10+" src="https://img.shields.io/badge/android-10%2B-D4613A">
  <a href="./LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-8B9A7E"></a>
  <img alt="Offline" src="https://img.shields.io/badge/network%20calls-zero-8B9A7E">
</p>

<p align="center"><img src="docs/demo.gif" alt="Spam Shield demo" width="300"></p>

## How it's different

Most call blockers ask for your call log and your contacts, then check numbers
against somebody's cloud database. Spam Shield doesn't do any of that.

Android hands every incoming number to one registered app *before the ringer
fires*. Spam Shield is that app. It checks the number against rules **you**
wrote, and if it matches, the call is silently rejected. The caller hears a
normal ring. You hear nothing.

The entire app makes **zero network calls**. Your rules and history live in a
SQLite database on the phone and go nowhere else.

## Download

Grab the APK from [**Releases**](https://github.com/himanshuSri24/spam-shield/releases/latest).

> **Requires Android 10 (API 29) or newer.** `CallScreeningService` — the API
> this whole app is built on — does not exist below Android 10. The APK will
> install on older versions but screening will never activate.

After installing, open the app and grant it the **call screening** role when
prompted. That's the only permission it asks for. It does *not* request your
contacts or your call log.

## Features

- **Five ways to match** — exact number, starts with, ends with, contains, and full regex
- **Silent rejection** — the call never rings, and the caller can't tell
- **Works offline** — airplane-mode-proof, because there was never a network call to begin with
- **Dashboard** — calls blocked all-time, today, and active rule count
- **History** — every block, with the rule that caught it, searchable
- **Quick presets** — one tap for common Indian spam ranges (`+91140`, `+911800`, `+91120`, `+91160`)
- **Swipe to delete**, toggle rules on and off without losing them

## How it works

```
incoming call
     │
     ▼
Android CallScreeningService  ──►  SpamShieldCallScreeningService.kt
     │                                      │
     │                             reads active rules from
     │                             SharedPreferences (not SQLite)
     │                                      │
     │                             match? ──► respondToCall(disallow)
     │                                      │   + queue the block
     ▼                                      ▼
  rings normally                    JS drains the queue
                                    into SQLite on app focus
```

The non-obvious part is the **SharedPreferences bridge**. The Kotlin service
can be invoked when the JS runtime is dead, and it must not contend with
expo-sqlite's WAL file. So JS owns SQLite and pushes a JSON snapshot of the
active rules into SharedPreferences after every change; the service only ever
reads that. Blocks go back the other way through a queue that is peeked, then
cleared only after JS has committed the rows.

Full write-ups live in [`docs/`](./docs):

| | |
| --- | --- |
| [01 — Overview](docs/01-OVERVIEW.md) | what it is, the screens, the concepts |
| [02 — High-level design](docs/02-HIGH-LEVEL-DESIGN.md) | components and boundaries |
| [03 — Low-level design](docs/03-LOW-LEVEL-DESIGN.md) | schema, matching semantics |
| [04 — Code walkthrough](docs/04-CODE-WALKTHROUGH.md) | file by file |
| [05 — Data flows](docs/05-DATA-FLOWS.md) | the JS↔native round trips |
| [06 — Design decisions](docs/06-DESIGN-DECISIONS.md) | why SharedPreferences, why no cloud |
| [07 — Android deep dive](docs/07-ANDROID-DEEP-DIVE.md) | the CallScreeningService contract |

[`CODEBASE.md`](./CODEBASE.md) is the single operational guide — architecture,
every file, the concurrency and timezone contracts, and the release runbook.

## Tech

| Layer | What |
| --- | --- |
| App | React Native via Expo SDK 54, expo-router, TypeScript |
| Native | Kotlin — a custom Expo module wrapping `CallScreeningService` |
| Storage | expo-sqlite (WAL), plus SharedPreferences as the native-side bridge |
| Numbers | libphonenumber-js, normalising input to E.164 |
| Type | Playfair Display + Inter |

## Build from source

```bash
npm install
npx expo run:android          # debug build onto a connected device
```

Release APK (Windows — the script works around the 260-char `MAX_PATH` limit
that otherwise breaks CMake):

```bash
npm run android:apk
```

Signing expects a `signing.properties` and a keystore in the repo root. Both
are gitignored, and neither has ever been committed — if you fork this, make
your own.

## Privacy

There is no server to send anything to. See [PRIVACY_POLICY.md](./PRIVACY_POLICY.md).

## Contributing

Issues and PRs are welcome — bug reports from real devices especially, since
call screening behaviour varies a lot across OEM skins. If you hit a number
that should have been blocked and wasn't, open an issue with the rule and the
(redacted) number shape.

## License

[MIT](./LICENSE) © Himanshu Srivastava
