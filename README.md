# Spam Shield – Call Blocker

A clean, privacy-first call blocking app for Android. Create flexible blocking rules using exact numbers, prefixes, suffixes, patterns, or regex — and never be bothered by spam callers again.

## Features

- **Flexible blocking rules** — exact, starts-with, ends-with, contains, and regex
- **Privacy first** — 100% offline, no data leaves your device, no analytics
- **Dashboard** — see blocked call stats at a glance
- **History** — search and review all blocked calls
- **Quick presets** — one-tap templates for common spam patterns (Indian telemarketers, toll-free, etc.)

## Tech Stack

- **React Native** (Expo SDK 54) with file-based routing
- **Kotlin** native module for Android `CallScreeningService`
- **SQLite** (expo-sqlite) for local storage
- **SharedPreferences bridge** to avoid WAL contention between JS and native service

## Architecture

The app uses Android's `CallScreeningService` API (Android 10+). Active rules are synced from SQLite to `SharedPreferences` via a native bridge so the Kotlin service can read them without contending with expo-sqlite's WAL file. Blocked calls are queued in `SharedPreferences` by the native service and drained into SQLite by the JS layer on app focus.

## Setup

```bash
npm install
npx expo run:android
```

## Build Release APK

```bash
npm run android:apk
```

## Privacy

Spam Shield works entirely on your device. No data is ever sent to any server. See [PRIVACY_POLICY.md](./PRIVACY_POLICY.md) for details.

## License

All rights reserved. © devwithcoffee
