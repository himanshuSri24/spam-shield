# Hang Up — Project Overview

## What is Hang Up?

Hang Up is a **privacy-first Android call blocking app** built with React Native and Expo. It lets users create rules to silently block unwanted calls — **no data ever leaves the device**.

When someone calls you, Android hands the phone number to Hang Up _before your phone rings_. Hang Up checks it against your rules. If it matches, the call is silently rejected. If not, it rings normally. The caller has no idea they were screened.

---

## Why does this app exist?

Most call-blocking apps send your call data to remote servers, use cloud-based spam databases, or require invasive permissions. Hang Up takes a different approach:

- **Zero data collection** — everything stays in a local SQLite database on the device
- **No internet required** — works fully offline
- **No cloud dependencies** — no APIs, no analytics, no tracking
- **Minimal permissions** — only the CallScreeningService API (no call log access, no contacts read)

---

## Tech Stack

| Layer                 | Technology                   | Why                                                            |
| --------------------- | ---------------------------- | -------------------------------------------------------------- |
| **Framework**         | Expo (React Native)          | Managed build tooling + native module support via Expo Modules |
| **Language (JS)**     | TypeScript                   | Type safety across screens, hooks, and database logic          |
| **Language (Native)** | Kotlin                       | Android's CallScreeningService must run as native code         |
| **Navigation**        | Expo Router (file-based)     | Each file in `app/` = a route. No manual route config needed   |
| **Database**          | expo-sqlite (SQLite)         | Offline-first local storage, zero network, fast queries        |
| **Animations**        | react-native-reanimated      | Smooth list deletions & onboarding transitions                 |
| **Gestures**          | react-native-gesture-handler | Swipe-to-delete on rule cards                                  |
| **Fonts**             | @expo-google-fonts           | Playfair Display (editorial headers) + Inter (body text)       |
| **Phone parsing**     | libphonenumber-js            | Normalize user input to E.164 format (+919563123456)           |
| **Async Storage**     | @react-native-async-storage  | Track onboarding completion (one boolean flag)                 |
| **Testing**           | Jest + ts-jest               | Unit & integration tests for matching logic and database CRUD  |

---

## What the app looks like (screens)

```
┌──────────────────────────────┐
│         ONBOARDING           │  ← First-time setup (4 steps)
│  Welcome → Enable → How →   │
│       You're All Set         │
└──────────────┬───────────────┘
               │ (completes once, stored in AsyncStorage)
               ▼
┌──────────────────────────────┐
│        TAB NAVIGATION        │
├──────────┬─────────┬─────────┤
│Dashboard │  Rules  │ History │
│ (index)  │         │         │
│          │         │         │
│ Stats    │ List of │ All     │
│ Recent   │ rules   │ blocked │
│ blocks   │ + FAB   │ calls   │
│ Warning  │ to add  │ Search  │
│ banner   │         │         │
└──────────┴─────────┴─────────┘
     │            │
     │            └──→ /add-rule (modal) — create/edit rule
     │
     └──→ /settings (modal) — toggle screening, FAQ, data management
```

---

## Core Concepts

### 1. Rules

A rule defines what to block. Each rule has:

- **Pattern** — the digits or regex to match against (e.g., `+91140`, `7777`, `\\+91[0-9]+`)
- **Match Type** — how to compare: `exact`, `starts_with`, `ends_with`, `contains`, or `regex`
- **Label** — optional human-readable name (e.g., "Delhi telemarketers")
- **Active/Inactive** — toggle without deleting

### 2. Blocked Calls

When a call is blocked, a record is created with:

- The phone number that called
- Which rule matched (by ID)
- Timestamp of when it happened

### 3. Call Screening

Android's `CallScreeningService` API (Android 10+) lets one app at a time inspect calls before they ring. The user must set Hang Up as the "default call screening app" via a system dialog. Once set, every incoming call from an unsaved contact passes through the service.

---

## Project Structure (high-level)

```
hang-up/
├── app/                    ← Screens (file-based routing via Expo Router)
│   ├── _layout.tsx         ← Root layout (fonts, splash, navigation stack)
│   ├── onboarding.tsx      ← First-time setup wizard
│   ├── add-rule.tsx        ← Create/edit a blocking rule (modal)
│   ├── settings.tsx        ← Settings & FAQ (modal)
│   └── (tabs)/             ← Bottom tab screens
│       ├── _layout.tsx     ← Tab bar config
│       ├── index.tsx       ← Dashboard (stats + recent blocks)
│       ├── rules.tsx       ← Rule management (list, toggle, delete)
│       └── history.tsx     ← Blocked call history with search
│
├── components/             ← Reusable UI pieces
│   ├── BlockedCallItem.tsx ← Single blocked call row
│   ├── EmptyState.tsx      ← "Nothing here" placeholder
│   ├── RuleCard.tsx        ← Rule card with swipe-to-delete
│   └── StatCard.tsx        ← Numeric stat display
│
├── constants/              ← Design tokens
│   ├── fonts.ts            ← Font family name constants
│   └── theme.ts            ← Colors, spacing, border radius
│
├── database/               ← Data layer
│   └── db.ts               ← SQLite CRUD, syncing, migrations
│
├── hooks/                  ← React hooks
│   └── useDatabase.ts      ← Hooks wrapping every database query
│
├── modules/                ← Native (Kotlin) module
│   └── call-screener/      ← Expo Module for Android CallScreeningService
│       ├── index.ts        ← JS bridge functions
│       ├── src/CallScreenerModule.ts  ← requireNativeModule loader
│       └── android/src/main/java/expo/modules/callscreener/
│           ├── CallScreenerModule.kt          ← Bridge implementation
│           └── HangUpCallScreeningService.kt  ← The actual call blocker
│
├── plugins/                ← Expo config plugins
│   └── withCallScreener.js ← Injects service into AndroidManifest.xml
│
├── __tests__/              ← Unit & integration tests
│   ├── database.test.ts    ← Database CRUD tests
│   ├── helpers.test.ts     ← Helper function tests
│   └── matching.test.ts    ← Rule matching algorithm tests
│
└── android/                ← Native Android project (generated + customized)
```

---

## How to run it

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Build and run on connected Android device/emulator (dev build)
npx expo run:android

# Run tests
npm test
```

> **Note**: Call screening only works in dev builds (`npx expo run:android`), not in Expo Go, because it requires native Kotlin modules.
