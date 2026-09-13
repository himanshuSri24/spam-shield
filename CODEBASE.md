# Spam Shield — Complete Codebase Guide

> Single-source working document for developing, debugging, and shipping this app.
> Everything below was read off the actual source tree, not inferred.
> Companion docs live in `docs/01`…`docs/07` (narrative/teaching versions). This file is the operational one.

**App:** Spam Shield — offline Android call blocker
**Package:** `com.devwithcoffee.spamshield`
**Stack:** Expo SDK 54 · React Native 0.81.5 · React 19.1 · New Architecture ON · Hermes · Kotlin native module · expo-sqlite
**Current version:** `1.0.0`, `versionCode 3`
**Resolved SDK levels (from last release merged manifest):** `minSdk 24`, `targetSdk 36`
**Last release APK built:** `android/app/build/outputs/apk/release/app-release.apk` (~88 MB, universal)

---

## Table of contents

1. [Quickstart](#1-quickstart)
2. [The one architectural idea](#2-the-one-architectural-idea)
3. [Repo map — every file, what it does](#3-repo-map--every-file-what-it-does)
4. [Native layer (Kotlin)](#4-native-layer-kotlin)
5. [JS layer (TypeScript/React)](#5-js-layer-typescriptreact)
6. [Data model & database](#6-data-model--database)
7. [Matching semantics — the exact rules](#7-matching-semantics--the-exact-rules)
8. [Every data flow, end to end](#8-every-data-flow-end-to-end)
9. [The three hard-won contracts (don't break these)](#9-the-three-hard-won-contracts-dont-break-these)
10. [Build system: prebuild, plugins, Windows MAX_PATH](#10-build-system-prebuild-plugins-windows-max_path)
11. [Release runbook](#11-release-runbook)
12. [Production readiness — verified gaps](#12-production-readiness--verified-gaps)
13. [Debugging playbook](#13-debugging-playbook)
14. [Extension recipes](#14-extension-recipes)
15. [Dead code & inconsistencies found](#15-dead-code--inconsistencies-found)
16. [Invariants checklist](#16-invariants-checklist)

---

## 1. Quickstart

```bash
# Install
npm install

# Dev build on device/emulator (compiles native, installs debug APK)
npx expo run:android

# Metro only (after a dev build is already installed)
npm start

# Lint
npm run lint

# Release APK (Windows path-safe wrapper around gradlew assembleRelease)
npm run android:apk
```

**Environment prerequisites** (per this machine's setup):

- JDK 17 (installed via scoop)
- Android SDK at `D:/androidSDK` — hardcoded in `android/local.properties`
- Node + npm
- `D:/b` must be writable — the CMake staging redirect writes there (`build-apk.ps1` creates it)

**Critical**: `npx expo start --web` / Expo Go will **not** work for call screening. The native module only exists in a dev/release build. Expo Go has no `CallScreener` module — `requireNativeModule('CallScreener')` throws at import time.

---

## 2. The one architectural idea

Everything odd about this codebase follows from a single Android fact:

> **`CallScreeningService` runs in a different OS process from your React Native app, and it runs when your app is not open.**

That means the Kotlin service **cannot** read the app's SQLite database. `expo-sqlite` runs in WAL mode; two processes fighting over the same WAL file gives you `SQLITE_BUSY`, corrupt reads, and deadlocks. The service also can't call into JS — there is no JS runtime alive when a call comes in at 3am.

So the app uses **SharedPreferences as a one-file JSON message bus** between the two processes:

```
┌────────────────────────────────┐        ┌───────────────────────────────────┐
│  RN / JS PROCESS               │        │  SCREENING SERVICE PROCESS        │
│  (alive only when app is open) │        │  (spun up by Telecom per call)    │
│                                │        │                                   │
│  SQLite: spamshield.db         │        │  no DB access, no JS runtime      │
│    rules                       │        │                                   │
│    blocked_calls               │        │                                   │
│         │                      │        │                                   │
│         │ flushDB()            │        │                                   │
│         ▼                      │        │                                   │
│   syncRules(json) ─────────────┼───────►│  read "active_rules"              │
│                                │        │  match number → reject/allow      │
│                                │        │         │                         │
│   drainPendingBlockedCalls()   │        │         ▼                         │
│     peek  ◄────────────────────┼────────┤  append "pending_blocked_calls"   │
│     INSERT OR IGNORE into DB   │        │                                   │
│     clear(count) ──────────────┼───────►│  shrink queue by count            │
└────────────────────────────────┘        └───────────────────────────────────┘
        SharedPreferences file: "SpamShieldRules"
        ├── active_rules            (JS writes, Kotlin reads)   — rules going out
        └── pending_blocked_calls   (Kotlin writes, JS drains)  — events coming back
```

Two keys, one file, two directions. That's the whole IPC design.

**Consequences you must remember:**

- SQLite is *not* the source of truth for blocking. `active_rules` in SharedPreferences is. If you mutate rules without calling `flushDB()`, the DB and the blocker disagree and **nothing visible breaks in the UI** — you just silently stop blocking (or keep blocking a deleted rule).
- History is eventually consistent. A blocked call at 3am appears in the UI only after you next open the app and a screen's `useFocusEffect` drains the queue.
- The service is stateless between calls. It re-reads and re-parses the rules JSON on every single incoming call.

---

## 3. Repo map — every file, what it does

```
hang-up/
├── app/                              ← Expo Router: file = route
│   ├── _layout.tsx                   Root Stack. Loads Playfair+Inter fonts, gates splash screen.
│   ├── index.tsx                     Startup gate. Reads AsyncStorage → redirects to /(tabs) or /onboarding.
│   ├── onboarding.tsx                4-step first-run flow; requests the screening role at step 2.
│   ├── add-rule.tsx                  Create/edit rule modal. Match-type picker, live preview, presets.
│   ├── settings.tsx                  Screening toggle, 7-item FAQ, about, Clear All Data, credits.
│   └── (tabs)/
│       ├── _layout.tsx               Bottom tab bar (Dashboard ◉ / Rules ⊘ / History ☰), text glyph icons.
│       ├── index.tsx                 Dashboard: stats, warning banner, recent 5 blocks.
│       ├── rules.tsx                 Rule list, swipe-to-delete, toggle, FAB → add-rule.
│       └── history.tsx               Last 100 blocked calls + client-side substring search.
│
├── components/
│   ├── AppLogo.tsx                   SVG logo via expo-image.
│   ├── StatCard.tsx                  Number tile; `accent` = coral filled variant.
│   ├── BlockedCallItem.tsx           One history row (number / matched pattern / relative time).
│   ├── RuleCard.tsx                  Swipeable rule row + active Switch. Tap = edit.
│   ├── EmptyState.tsx                Icon badge + title + message.
│   └── ScreeningSetupModal.tsx       Manual 4-step fallback when the role dialog can't open (MIUI/HyperOS).
│
├── constants/
│   ├── theme.ts                      Colors / Spacing / BorderRadius tokens. Cream + coral + sage.
│   └── fonts.ts                      FontFamily name constants (must match _layout.tsx useFonts keys).
│
├── database/
│   └── db.ts                         ★ Schema, migrations, all CRUD, flushDB(), drain. The core file.
│
├── hooks/
│   └── useDatabase.ts                useRules / useBlockedCalls / useRecentBlocks / useStats / useRuleBlockedCounts.
│
├── utils/
│   ├── formatTimestamp.ts            UTC-safe relative time ("3 hrs ago"). Do not replace with new Date(str).
│   └── onboarding-state.ts           AsyncStorage boolean: spamshield_onboarding_complete.
│
├── modules/call-screener/            ★ Local Expo Module (autolinked, not an npm package)
│   ├── expo-module.config.json       Declares android platform + module class path.
│   ├── index.ts                      Typed JS API surface (7 exported functions).
│   ├── src/CallScreenerModule.ts     requireNativeModule('CallScreener').
│   └── android/
│       ├── build.gradle              com.android.library + expo-module-gradle-plugin.
│       ├── src/main/AndroidManifest.xml   Empty — service is registered by the config plugin instead.
│       └── src/main/java/expo/modules/callscreener/
│           ├── CallScreenerModule.kt              Bridge: role mgmt, prefs I/O, testMatch.
│           └── SpamShieldCallScreeningService.kt  ★ The actual blocker.
│
├── plugins/                          Expo config plugins — run on every prebuild
│   ├── withCallScreener.js           Injects <service> + BIND_SCREENING_SERVICE into AndroidManifest.
│   ├── withShortCmakePath.js         Windows MAX_PATH mitigations in app/build.gradle.
│   └── withReleaseSigning.js         Release signingConfig + R8/shrink flags + ProGuard keep rule.
│
├── scripts/build-apk.ps1             Ensures D:/b exists, runs gradlew assembleRelease, prints APK path.
├── android/                          ★ GITIGNORED prebuild output — regenerated, never hand-edit.
├── app.json                          Expo config: name, package, versionCode, plugin list, experiments.
├── signing.properties                ★ GITIGNORED. Keystore path + plaintext passwords.
├── spamshield-release.keystore       ★ GITIGNORED. Upload/signing key. BACK THIS UP.
├── docs/01..07                       Long-form explanation docs.
├── README.md / STORE_LISTING.md / PRIVACY_POLICY.md
└── package.json / tsconfig.json / eslint.config.js
```

**Path alias:** `@/*` → project root (tsconfig). Note `app/(tabs)/index.tsx` and `app/settings.tsx` import the native module by **relative** path (`../../modules/call-screener`) while `ScreeningSetupModal.tsx` uses `@/modules/call-screener`. Both resolve; it's just inconsistent.

---

## 4. Native layer (Kotlin)

### 4.1 `SpamShieldCallScreeningService.kt` — the blocker

Extends `android.telecom.CallScreeningService`. Android's Telecom framework instantiates it and calls `onScreenCall(Call.Details)` for an incoming call **before the phone rings**.

```kotlin
override fun onScreenCall(callDetails: Call.Details) {
    val phoneNumber = callDetails.handle?.schemeSpecificPart ?: ""
    // handle is a tel: URI → schemeSpecificPart is "+911401234567"
    if (phoneNumber.isEmpty()) { respondToCall(callDetails, CallResponse.Builder().build()); return }

    val matchResult = checkAgainstRules(phoneNumber)
    if (matchResult != null) {
        val response = CallResponse.Builder()
            .setDisallowCall(true)     // don't connect
            .setRejectCall(true)       // actively reject (caller hears busy/decline)
            .setSkipCallLog(false)     // ← DO write to the system call log
            .setSkipNotification(true) // ← no missed-call notification
            .build()
        respondToCall(callDetails, response)
        logBlockedCall(phoneNumber, matchResult.ruleId)   // queue to SharedPreferences
    } else {
        respondToCall(callDetails, CallResponse.Builder().build())  // empty = allow
    }
}
```

Behavioural notes worth knowing before you change anything here:

| Detail | Why it matters |
|---|---|
| `respondToCall()` **must** be called on every path | Including the exception path. If you don't respond, Telecom hangs waiting and the user gets a delayed/ghost ring. The `try/catch` already does the right thing: any exception falls through to *allow*. **Fail-open is the intended policy** — a bug should never eat a legit call. |
| `setSkipCallLog(false)` | The user can still see who called in their dialer's call log. Deliberate: blocked ≠ invisible. |
| `setSkipNotification(true)` | No missed-call notification. This is what makes blocking feel silent. |
| Empty number → allow | Withheld/private numbers are never blocked. There's no rule type that can target them today. |
| No wake locks, no coroutines | `onScreenCall` runs on the main thread of a short-lived process. Everything here is synchronous and fast (a JSON parse + a string loop). Do not add I/O or network here — Telecom has a hard timeout (~5s) after which it gives up and rings. |

`logBlockedCall()` writes the event as UTC in SQLite's exact text format:

```kotlin
val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
fmt.timeZone = TimeZone.getTimeZone("UTC")
```

This is not incidental — see [§9.2 Timezone contract](#92-timezone-contract).

### 4.2 `CallScreenerModule.kt` — the bridge

Expo Module named `CallScreener`. Seven `AsyncFunction`s:

| Function | Returns | Notes |
|---|---|---|
| `requestScreeningRole()` | `"already_active"` \| `"requested"` \| `"failed"` | API 29+ only, else **rejects** with `ERR_UNSUPPORTED`. Uses `RoleManager.createRequestRoleIntent(ROLE_CALL_SCREENING)` + `startActivityForResult`. |
| `isScreeningEnabled()` | `boolean` | `roleManager.isRoleHeld(...)`. Never throws — returns `false` on any error. |
| `getServiceStatus()` | `"active"` \| `"inactive"` \| `"unavailable"` \| `"unsupported"` \| `"error"` | Richer version of the above, used by Settings. |
| `openScreeningSettings()` | `boolean` | Fallback cascade: `ACTION_MANAGE_DEFAULT_APPS_SETTINGS` → `ACTION_SETTINGS`, each tried from the Activity first, then from app context with `NEW_TASK`. Four attempts total before rejecting. |
| `syncRules(json)` | `boolean` | Writes `active_rules`. Never throws. |
| `getPendingBlockedCalls()` | JSON string | **Peek only.** Returns `"[]"` on any failure. |
| `clearPendingBlockedCalls(count)` | `boolean` | Removes only the first `count` entries. |

Also present but **not exported to JS**: `testMatch(phoneNumber)` — runs the identical matching algorithm and returns `{blocked, ruleId, pattern, matchType, trace[]}` where `trace` is a human-readable line-by-line explanation. This is the single best debugging tool in the codebase and it's currently unreachable. See [§14.4](#144-wire-up-testmatch-15-minutes) to wire it up.

### 4.3 The role lifecycle (and why there's no `onActivityResult`)

`REQUEST_CODE_SCREENING_ROLE = 42` is passed to `startActivityForResult`, but **nothing ever reads the result** — there is no `onActivityResult` override anywhere in this project (verified: `MainActivity.kt` doesn't have one).

Instead every screen that requests the role uses the same **AppState pattern**:

```tsx
const waitingForRole = useRef(false);

useEffect(() => {
  const sub = AppState.addEventListener("change", (next) => {
    if (next === "active" && waitingForRole.current) {
      waitingForRole.current = false;
      isScreeningEnabled().then(setScreeningActive).catch(() => {});
    }
  });
  return () => sub.remove();
}, []);
```

Request → set the flag → the system dialog takes focus → user returns → app goes `active` → re-query the truth from `RoleManager`. Implemented identically in `app/onboarding.tsx`, `app/(tabs)/index.tsx`, and `app/settings.tsx`.

**Why it's done this way:** Expo Modules has no first-class `onActivityResult` plumbing, and on OEM skins (MIUI/HyperOS) the "dialog" is sometimes a full Settings screen that never returns a result code at all. Re-reading `isRoleHeld()` on resume is the only universally correct signal.

**Full fallback cascade when the user taps "Enable":**

```
requestScreeningRole()
 ├── "already_active"  → done, flip UI to active
 ├── "requested"       → set waitingForRole, let AppState resolve it
 ├── "failed"          ─┐
 └── throws (API < 29) ─┴→ openScreeningSettings()
                            ├── success → set waitingForRole
                            └── throws  → <ScreeningSetupModal /> (manual 4-step instructions)
```

### 4.4 Manifest registration

The service is **not** declared in `modules/call-screener/android/src/main/AndroidManifest.xml` (that file is intentionally empty). It's injected into the app manifest by `plugins/withCallScreener.js` on every prebuild:

```xml
<service
    android:name="expo.modules.callscreener.SpamShieldCallScreeningService"
    android:permission="android.permission.BIND_SCREENING_SERVICE"
    android:exported="true">
  <intent-filter>
    <action android:name="android.telecom.CallScreeningService"/>
  </intent-filter>
</service>
```

All three parts are mandatory: `exported="true"` so Telecom (a different process) can bind; `android:permission=BIND_SCREENING_SERVICE` so *only* the system can bind; the intent-filter action so the role picker discovers the app at all. Drop any one and the app silently stops appearing in "Caller ID & spam app".

No `<uses-permission>` is needed for screening — holding the **role** is the permission.

---

## 5. JS layer (TypeScript/React)

### 5.1 Routing

Expo Router, file-based, `typedRoutes: true`, `reactCompiler: true`.

```
/                 app/index.tsx        → gate, redirects
/onboarding       app/onboarding.tsx   → fade transition
/(tabs)           app/(tabs)/index.tsx → dashboard (default tab)
/(tabs)/rules
/(tabs)/history
/add-rule         modal, slide_from_bottom, accepts ?ruleId=N for edit mode
/settings         modal, slide_from_bottom
```

Deep link scheme: `spamshield://` (declared in `app.json` and the manifest's VIEW intent-filter).

`app/index.tsx` races the AsyncStorage read against a **2 s timeout that resolves `false`** — so a hung storage read sends the user to onboarding rather than leaving them on a spinner forever. Fail-safe, not fail-fast.

`app/_layout.tsx` holds the splash screen (`SplashScreen.preventAutoHideAsync()`) until all 8 font faces load, returning `null` meanwhile. **A font that fails to load = permanently blank app**, since `fontsLoaded` never flips. Keep `constants/fonts.ts` string values exactly in sync with the `useFonts({...})` keys.

### 5.2 Screens

**Dashboard `app/(tabs)/index.tsx`**
On focus, fires four things: `drainPendingBlockedCalls()` (refreshes stats+recent if it imported anything), `refreshStats()`, `refreshRecent()`, `flushDB()`, and `isScreeningEnabled()`. The unconditional `flushDB()` on every dashboard focus is a **self-healing safety net** — if rules and SharedPreferences ever drift (crash mid-write, app data restored from backup), opening the dashboard silently reconciles them.

`screeningActive` initial state is `true`, deliberately — the warning banner doesn't flash on cold start before the async check returns.

Renders `totalBlocked`, `blockedToday`, `activeRules`. (`blockedThisWeek` is computed but never displayed — see [§15](#15-dead-code--inconsistencies-found).)

**Rules `app/(tabs)/rules.tsx`**
Wrapped in `GestureHandlerRootView` (required for `Swipeable`). Reanimated `FadeOutUp` + `LinearTransition.springify()` for delete animation. Every row shows a live per-rule blocked count from `useRuleBlockedCounts()`.

**History `app/(tabs)/history.tsx`**
Fetches the most recent 100, filters **client-side** with plain `String.includes` on number OR matched pattern. Fine at this scale; if you raise the limit past a few thousand, push the filter into SQL.

**Add/Edit `app/add-rule.tsx`**
Same screen for both, distinguished by `?ruleId=`. Live "WILL DO" preview via `getRuleDescription()`, plus concrete example lines for starts/ends/contains. Four India-centric presets (`+91140`, `+911800`, `+91120`, `+91160`).

The one piece of real logic — **E.164 normalization, applied only to `exact`**:

```tsx
if (matchType === "exact") {
  const region = Localization.getLocales()[0]?.regionCode ?? "IN";   // fallback IN
  const parsed = parsePhoneNumberFromString(cleanedPattern, region);
  cleanedPattern = parsed?.isValid()
    ? parsed.number                              // → "+919563123456"
    : cleanedPattern.replace(/[\s\-\(\)]/g, ""); // unparseable → just strip formatting
}
```

Why only `exact`: Android hands the service a full E.164 number, so an exact comparison must be against E.164 too. Prefix/suffix/contains patterns are intentionally left raw — the user typing `9563` means "these four digits", and normalizing it would be wrong.

**Settings `app/settings.tsx`**
Screening toggle (turning *off* is not programmatically possible — Android only lets the user pick a different app, so it opens Settings with an explanation), 7 accordion FAQs, version/privacy rows, and `clearAllData()` behind a destructive confirm.

### 5.3 Hooks — `hooks/useDatabase.ts`

Five hooks, all the same shape: `useState` + `useCallback` refresh + `useEffect` on mount, returning `{ data, loading, refresh }`.

`useRules()` additionally does **optimistic local updates** — `addRule`/`updateRule`/`toggleRule`/`removeRule` write to SQLite and then patch React state directly, so the list never flickers through a refetch.

**Every hook swallows its errors** (`catch { if (__DEV__) console.error(...) }`). This is exactly what masked the original "database is locked" bug: queries failed, hooks logged nothing in release, screens rendered empty, and the native side kept blocking calls perfectly — so the app looked broken while working. If you're ever debugging "the UI is empty but blocking works", **start here** and temporarily surface these errors.

### 5.4 Design system

`constants/theme.ts` — warm editorial palette: cream `#FFF5EC` bg, coral `#D4613A` accent, sage `#8B9A7E` secondary, charcoal text. `Spacing` xs 4 → massive 64. `BorderRadius` sm 6 → round 999.
`constants/fonts.ts` — Playfair Display (display/headers, incl. italic for the tagline) + Inter (body). Light mode only (`userInterfaceStyle: "light"`, `StatusBar style="dark"`); there is no dark theme.

---

## 6. Data model & database

`database/db.ts`, SQLite file `spamshield.db`.

```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 3000;
PRAGMA foreign_keys = ON;

CREATE TABLE rules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern     TEXT NOT NULL,
  label       TEXT    DEFAULT '',
  match_type  TEXT    DEFAULT 'starts_with',
  is_active   INTEGER DEFAULT 1,             -- 0/1, no bool type in SQLite
  created_at  TEXT    DEFAULT (datetime('now'))   -- UTC
);

CREATE TABLE blocked_calls (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number    TEXT NOT NULL,
  matched_rule_id INTEGER,
  blocked_at      TEXT DEFAULT (datetime('now')),  -- UTC "YYYY-MM-DD HH:MM:SS"
  FOREIGN KEY (matched_rule_id) REFERENCES rules(id) ON DELETE SET NULL
);

-- added by migration v1
CREATE UNIQUE INDEX idx_blocked_dedup
  ON blocked_calls (phone_number, matched_rule_id, blocked_at);
```

`ON DELETE SET NULL` is why history survives rule deletion — the row stays, `matched_pattern` renders as "Unknown rule" via the `LEFT JOIN`.

### Migrations

Keyed on `PRAGMA user_version`, run inside `initDB()`. **v1** (already applied on existing installs) does three things:

1. Finds legacy `blocked_at` values containing `'T'` — the old service wrote *device-local* time as `yyyy-MM-dd'T'HH:mm:ss` while the schema default wrote *UTC* with a space. Mixed formats broke text sorting and the Today/Week counts. JS parses each as local and rewrites it as UTC.
2. Deletes duplicates, keeping `MIN(id)` per `(phone_number, matched_rule_id, blocked_at)`.
3. Creates the unique index that makes a re-drain idempotent.

**Adding migration v2:** append a new `if (version >= 2) return;` block *after* the v1 block, do your work, set `PRAGMA user_version = 2`. Never edit v1 — installed devices already passed it.

### Query notes

```sql
-- "Today" = the user's local day, over UTC-stored data
SELECT COUNT(*) FROM blocked_calls
 WHERE date(blocked_at, 'localtime') = date('now', 'localtime');

-- "This week" = trailing 7×24h, both sides UTC
SELECT COUNT(*) FROM blocked_calls
 WHERE blocked_at >= datetime('now', '-7 days');

-- History join; secondary sort on id breaks same-second ties deterministically
SELECT bc.*, r.pattern AS matched_pattern
  FROM blocked_calls bc
  LEFT JOIN rules r ON bc.matched_rule_id = r.id
 ORDER BY bc.blocked_at DESC, bc.id DESC
 LIMIT ?;
```

---

## 7. Matching semantics — the exact rules

The **same algorithm is written twice** — in `SpamShieldCallScreeningService.checkAgainstRules()` and in `CallScreenerModule.testMatch()`. If you change one, change both.

**Normalization** (both sides): strip `space`, `-`, `(`, `)`, then `trim()`. **`+` and country code are preserved.**

```kotlin
val matches = when (matchType) {
    "exact"       -> normalizedNumber == normalizedPattern
    "starts_with" -> normalizedNumber.startsWith(normalizedPattern)
    "ends_with"   -> normalizedNumber.endsWith(normalizedPattern)
    "contains"    -> normalizedNumber.contains(normalizedPattern)
    "regex"       -> Regex(pattern, IGNORE_CASE).containsMatchIn(normalizedNumber)
    else          -> normalizedNumber.contains(normalizedPattern)   // unknown type → contains
}
```

Five things to internalize:

1. **First match wins.** Iteration stops at the first matching rule; that rule gets credited in `blocked_calls.matched_rule_id`. Rule *order* is whatever `SELECT id, pattern, match_type FROM rules WHERE is_active = 1` returns — there is **no `ORDER BY`**. In practice that's rowid/insertion order, but it is not contractually guaranteed. If you ever add rule priority, add an explicit `ORDER BY` in `flushDB()`.
2. **`regex` uses the RAW pattern against the NORMALIZED number.** Every other type normalizes both sides. So a regex containing a literal space or `(` will never match. Deliberate — you need `(` for capture groups — but it's an asymmetry that surprises people.
3. **`containsMatchIn`, not `matches`.** A regex rule is a *search*, not a full-string anchor. `[0-9]` blocks every number containing a digit — i.e. everything. Tell users to anchor: `^\+91140`.
4. **An invalid regex evaluates to `false`** (caught, logged, skipped). A broken rule silently does nothing rather than crashing the service. There is **no regex validation in the UI** — a user can save `[` and it will never fire.
5. **An empty pattern is catastrophic for 3 of 5 types.** `"".startsWith("")`, `endsWith("")`, `contains("")` are all `true` → blocks *every* call. The only thing preventing this is `isValid = pattern.trim().length > 0` in `add-rule.tsx`. **Preserve that guard**, and add it server-side (in `addRule`/`updateRule`) if you ever add another write path.

**The contacts caveat** (surfaced in the UI, in the FAQ, and in the store listing): Android's Telecom framework does **not** route calls from saved contacts through the screening service on most devices. Rules only apply to unknown callers. This is OS behaviour, not a bug you can fix.

---

## 8. Every data flow, end to end

### 8.1 Adding a rule

```
FAB → /add-rule → pick match type, type pattern, Save
  └─ handleSave()
      ├─ if exact: libphonenumber-js → E.164 (locale region, fallback "IN")
      ├─ dbAddRule(pattern, label, matchType)
      │   ├─ INSERT INTO rules ...
      │   └─ flushDB()                                   ← THE IMPORTANT PART
      │       ├─ SELECT id, pattern, match_type FROM rules WHERE is_active = 1
      │       └─ syncRules(JSON.stringify(rows))  →  prefs["active_rules"]
      ├─ optimistic setRules([new, ...prev])  (via useRules)
      └─ router.back() → Rules screen useFocusEffect → refresh() + refreshCounts()
```

`flushDB()` is called by **`addRule`, `updateRule`, `updateRuleActive`, `deleteRule`, `clearAllData`** — every rule mutation, no exceptions. It's also called unconditionally on every Dashboard focus as a repair pass.

Note `flushDB()` sends only `{id, pattern, match_type}` — `label` and `is_active` never cross the bridge. The native side doesn't need them (inactive rules simply aren't in the payload), which keeps the JSON small.

### 8.2 A call being blocked (app closed)

```
+911401234567 rings
  └─ Telecom: contact? → no. screening app? → Spam Shield.
      └─ onScreenCall(details)
          ├─ number = handle.schemeSpecificPart
          ├─ prefs["active_rules"] → JSONArray → loop → first match
          ├─ respondToCall(disallow + reject + skipNotification)   ← phone never rings
          └─ logBlockedCall()
              └─ synchronized(PendingQueueLock) {
                   read prefs["pending_blocked_calls"] → append
                   {phone_number, matched_rule_id, blocked_at: UTC "yyyy-MM-dd HH:mm:ss"}
                   → write back
                 }
```

Total time budget: milliseconds. No DB, no JS, no network.

### 8.3 Draining the queue into history

Triggered by `useFocusEffect` on **Dashboard, Rules, and History**.

```
drainPendingBlockedCalls()          [single-flight: concurrent callers share one promise]
  └─ doDrain()
      ├─ getPendingBlockedCalls()             ← PEEK, does not clear
      ├─ if empty → return 0
      ├─ for each entry:
      │    normalize any legacy 'T' timestamp → UTC
      │    INSERT OR IGNORE INTO blocked_calls (...)     ← unique index makes this idempotent
      └─ clearPendingBlockedCalls(pending.length)        ← ONLY the first N; later appends survive
```

**Order is the whole point:** peek → insert → clear-by-count. The original implementation cleared on read, so any failed insert destroyed history permanently. And clearing *by count* rather than wiping the key means a call that arrives during the drain isn't lost.

### 8.4 Enabling screening

See [§4.3](#43-the-role-lifecycle-and-why-theres-no-onactivityresult) — request → AppState → re-query, with a settings/manual-instructions fallback cascade.

### 8.5 Clear All Data

`DELETE FROM blocked_calls; DELETE FROM rules;` then `flushDB()` — which pushes `[]` to `active_rules`, so blocking stops immediately even though the service process may never restart. If you ever add a data-wipe path that skips `flushDB()`, the app will keep blocking with deleted rules until the next dashboard visit.

---

## 9. The three hard-won contracts (don't break these)

These encode the 2026-07-17 five-bug fix pass. Each has a comment in the source explaining it; here's the consolidated version.

### 9.1 Single-connection contract

```ts
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
export function getDB() {
  if (!dbPromise) {
    dbPromise = (async () => { … openDatabaseAsync … initDB … })()
      .catch(e => { dbPromise = null; throw e; });   // don't cache a failure
  }
  return dbPromise;
}
```

**The promise is cached, not the handle.** On cold start the dashboard fires stats + recent + drain + flush simultaneously. If every caller that saw `db === null` opened its own connection, the concurrent `CREATE TABLE`s deadlocked with "database is locked". Because the hooks swallow errors, Rules and History rendered empty while the native side kept blocking perfectly. **That was THE bug.**

Similarly, `drainPendingBlockedCalls()` is **single-flight** — three tabs draining on focus would otherwise clear each other's entries by count and lose calls.

And `PendingQueueLock` is a shared Kotlin `object` monitor used by *both* the service (append) and the module (peek/clear), so an append landing between the module's read and write is never dropped.

> **Rule:** never call `SQLite.openDatabaseAsync` anywhere except inside `getDB()`. Never add a second drain entry point without routing it through `drainPendingBlockedCalls()`.

### 9.2 Timezone contract

**Everything in `blocked_calls.blocked_at` is UTC, in SQLite's exact `YYYY-MM-DD HH:MM:SS` text format.** Enforced at four places:

| Place | What it does |
|---|---|
| Kotlin `logBlockedCall()` | `SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)` with `TimeZone.getTimeZone("UTC")` |
| SQLite column default | `datetime('now')` — already UTC |
| JS `doDrain()` | Converts any legacy `'T'` timestamp to UTC before insert |
| Migration v1 | Rewrote all pre-existing local-time rows |

And on the read side, `utils/formatTimestamp.ts`:

```ts
function parseUtc(dateStr: string): Date {
  let iso = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) iso += "Z";   // force UTC
  return new Date(iso);
}
```

A bare `new Date("2026-07-17 09:30:00")` is **engine-dependent on Hermes**, and where it does parse it's read as *local*, shifting every timestamp by your UTC offset (+5:30 here — every block would show ~5.5 hours in the future, and "Just now" would read as "5 hrs ago"). Never replace `parseUtc` with a bare `new Date(str)`.

### 9.3 Never-lose-history contract

- Peek → insert → clear-by-count (never clear-on-read).
- `INSERT OR IGNORE` + `idx_blocked_dedup` unique index → re-draining the same entries is a no-op.
- `clearPendingBlockedCalls(count)` shrinks by exactly `count`; entries appended after the peek survive.
- `ON DELETE SET NULL` → deleting a rule never cascades away its history.

---

## 10. Build system: prebuild, plugins, Windows MAX_PATH

### 10.1 `android/` is generated

`.gitignore` contains `/android` and `/ios`. The `android/` folder present on disk is **prebuild output**. `npx expo prebuild` (implicitly run by `expo run:android`) regenerates it from `app.json` + the three config plugins.

> **Never hand-edit `android/app/build.gradle` or `android/app/src/main/AndroidManifest.xml`.** Your change survives until the next prebuild and then vanishes. Everything you need to change lives in `app.json` or `plugins/*.js`.

Same applies to `versionCode`: bump it in **`app.json`** (`expo.android.versionCode`), not in `build.gradle`. Both currently read `3`, which is prebuild doing its job.

### 10.2 The three plugins (order matters — they run in the `app.json` order)

**`withCallScreener.js`** — `withAndroidManifest`. Finds an existing service entry by class name and replaces it, or pushes a new one. Idempotent, so repeated prebuilds don't duplicate the `<service>`.

**`withShortCmakePath.js`** — the Windows survival plugin. Two regex injections into `app/build.gradle`:

1. Inside the `ndk { }` block: `arguments "-DCMAKE_OBJECT_PATH_MAX=150"` — tells CMake to MD5-hash any object filename that would exceed 150 chars.
2. Inside `android { }`, guarded by `isWindowsHost`: `externalNativeBuild { cmake { buildStagingDirectory "D:/b" } }` — redirects **all** CMake staging output (including autolinked subprojects) to a short path so ninja can never construct a >260-char filename.

Both injections are `contents.includes(...)`-guarded, so they're idempotent. **They are also regex-anchored to Expo's generated `build.gradle` shape** (`ndk { }`, `androidResources { }`, `apply plugin: "com.facebook.react"`). An Expo SDK upgrade that reshapes that template will make these silently no-op — you'll find out via a 260-char path failure, not an error from the plugin. If you upgrade SDK, diff the generated `build.gradle` and confirm both blocks are still present.

> The header comment in `withShortCmakePath.js` and `build-apk.ps1` mentions mapping the project root to `Z:\` via `subst`. **The current script does not do that** — it only creates `D:/b` and runs gradle. If you ever hit MAX_PATH again despite the plugin, `subst Z: "D:\THIS IS WHAT YOU WANT\Personal\Coding\Web-apps\hang-up"` and build from `Z:\` is the documented escape hatch (saves ~55 chars).

**`withReleaseSigning.js`** — three jobs:

1. Injects a `release { }` signingConfig into `signingConfigs` that reads `signing.properties` from the project root, and rewires the release buildType from `signingConfigs.debug` to `signingConfigs.release`.
2. Sets `android.enableMinifyInReleaseBuilds=true` and `android.enableShrinkResourcesInReleaseBuilds=true` in `gradle.properties` (R8 + resource shrinking).
3. Appends a ProGuard keep rule — **which targets the wrong package**, see [§12](#12-production-readiness--verified-gaps).

### 10.3 Gradle facts

- Gradle 8.14.3, JDK 17, Kotlin/AGP versions come from Expo's version catalog (`expoAutolinking.useExpoVersionCatalog()`), not pinned here.
- `minSdk 24` / `targetSdk 36` are resolved from the Expo version catalog via `expo-root-project`, not literals in `build.gradle`. Verify with `cd android && ./gradlew :app:properties | grep -i sdk`.
- `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64` — all four ABIs in one universal APK. That's most of the 88 MB. See [§12](#12-production-readiness--verified-gaps) for the fix.
- Hermes on, New Architecture on, `expo.useLegacyPackaging=false`.
- Existing ProGuard keeps: `com.swmansion.reanimated.**`, `com.facebook.react.turbomodule.**`.

---

## 11. Release runbook

```powershell
# 0. Bump the version in app.json (BOTH fields for a store release)
#    expo.version        "1.0.0"  → user-visible
#    expo.android.versionCode 3    → must strictly increase for Play

# 1. Confirm signing inputs exist (both are gitignored)
Test-Path .\signing.properties          # storeFile/storePassword/keyAlias/keyPassword
Test-Path .\spamshield-release.keystore

# 2. Regenerate native project from app.json + plugins
npx expo prebuild --platform android --clean

# 3. Sanity-check that the plugins actually fired
Select-String -Path android\app\src\main\AndroidManifest.xml -Pattern "CallScreeningService"
Select-String -Path android\app\build.gradle -Pattern "signingConfigs.release|buildStagingDirectory"

# 4. Build
npm run android:apk
#    → android\app\build\outputs\apk\release\app-release.apk

# 5. Verify the signature
& "$env:ANDROID_HOME\build-tools\<ver>\apksigner.bat" verify --print-certs `
    android\app\build\outputs\apk\release\app-release.apk

# 6. Install on a real device and smoke-test (see checklist below)
adb install -r android\app\build\outputs\apk\release\app-release.apk
```

**For Play Store you need an AAB, not an APK:**

```powershell
cd android; .\gradlew.bat bundleRelease
# → android\app\build\outputs\bundle\release\app-release.aab
```

`scripts/build-apk.ps1` only wires up `assembleRelease`; add a `bundleRelease` variant when you go to Play.

### Post-build smoke test (must pass on a real device, minified release build)

1. Fresh install → onboarding appears → "Enable Screening" opens the system role dialog.
2. Grant the role → return to app → Dashboard warning banner is **gone**.
3. Add rule: `starts_with` `+91140` → Rules list shows it, count 0.
4. Have someone call from a matching number → **phone does not ring**, no missed-call notification.
5. Reopen app → Dashboard "Today" increments, Recent Blocks shows the number with a sane relative time (not 5 hrs off).
6. History tab lists it; search by digits filters correctly.
7. Toggle the rule off → call again → **phone rings**.
8. Swipe-delete the rule → history row survives, shows "Unknown rule".
9. Force-stop the app, get a call, reopen → the block appears (the drain works cold).
10. Settings → Clear All Data → both tabs empty, and a subsequent matching call **rings**.

Steps 4, 7, 9 and 10 are the ones that actually exercise the cross-process contract. Do not ship without them. Run this against the **release** build specifically — R8 only runs there.

---

## 12. Production readiness — verified gaps

Each item below was verified against the source or the merged manifest of the last release build. Ordered by what I'd fix first.

| # | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| 1 | **High** | **`minSdk 24` but screening needs API 29.** On Android 7–9 the app installs, the role doesn't exist, `requestScreeningRole` rejects with `ERR_UNSUPPORTED`, and the app can never block anything. Play would serve it to those users. | merged manifest `minSdkVersion="24"`; `CallScreenerModule.kt` guards on `SDK_INT >= Q` | Set `expo.android.minSdkVersion: 29` in `app.json` (or `expo-build-properties`). Costs you nothing real — the app is non-functional below 29. |
| 2 | **High** | **Permissions contradict the privacy claim.** Release merged manifest requests `INTERNET`, `ACCESS_NETWORK_STATE`, `SYSTEM_ALERT_WINDOW`, `WRITE_EXTERNAL_STORAGE`, `VIBRATE`. The store listing and in-app FAQ say "100% offline, minimal permissions". A reviewer or a privacy-minded user *will* notice `INTERNET` + `SYSTEM_ALERT_WINDOW` on a call blocker. | `android/app/build/intermediates/merged_manifest/release/.../AndroidManifest.xml` | These come from Expo/RN defaults, not your code. Strip what you don't need with `tools:node="remove"` via a config plugin. Keep `INTERNET` only if you keep debug/dev-client parity — a production build genuinely doesn't need it. |
| 3 | **High** | **The signing key exists in exactly one place — this machine.** `.gitignore` excludes `*.keystore` and `signing.properties`. Lose the disk, lose the ability to ever update the app on Play. | `.gitignore` lines for `*.keystore`, `signing.properties` | Back up `spamshield-release.keystore` + credentials to an encrypted store *today*. Enroll in Play App Signing so Google holds the app signing key and you only manage the upload key. |
| 4 | Medium | **Passwords in plaintext** in `signing.properties` (`SpamShield2026` for both store and key). | `signing.properties` | Acceptable for a local-only, gitignored file; move to env vars (`ORG_GRADLE_PROJECT_*`) before any CI. Don't ever commit it. |
| 5 | Medium | **ProGuard keep rule targets a package that doesn't exist.** The rule is `-keep class com.devwithcoffee.spamshield.callscreener.** { *; }`; the service is `expo.modules.callscreener.SpamShieldCallScreeningService`. It matches nothing. | `proguard-rules.pro` vs the Kotlin package declaration | Currently harmless — R8 auto-keeps classes named in the merged manifest, which is why the release APK still blocks calls. Still, fix the string in `plugins/withReleaseSigning.js` to `expo.modules.callscreener.**` so the intent matches reality. |
| 6 | Medium | **88 MB universal APK** — all four ABIs bundled. | `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64`; APK size on disk | For Play, ship an **AAB** (`bundleRelease`) — Google splits per-device automatically. For direct distribution, enable ABI splits or drop to `arm64-v8a,armeabi-v7a`. Expect ~25–30 MB per device. |
| 7 | Medium | **No regex validation in the UI.** A user can save `[` (never fires, silently) or `[0-9]` (fires on everything, blocking all calls). | `add-rule.tsx` validates only `pattern.trim().length > 0` | Wrap `new RegExp(pattern)` in try/catch on save; warn on patterns that match a bare digit string. Bonus: run the pattern against a couple of sample numbers and show the result in the "WILL DO" preview. |
| 8 | Medium | **No tests exist.** `docs/01-OVERVIEW.md` lists "Jest + ts-jest — Unit & integration tests" in the tech stack table. There is no jest dependency, no config, and no test file in the repo. | `package.json` devDependencies; no `*.test.*` files | Either add them or correct the doc. The matching algorithm is pure logic duplicated in two Kotlin functions — it's the highest-value thing to test, and the cheapest. |
| 9 | Low | **`expo-localization` is pinned `^55.0.8` on Expo SDK 54.** Possible major-version skew. | `package.json` | Run `npx expo install --check` and let it align. Only used for the E.164 default region, so breakage would be quiet. |
| 10 | Low | **Rule evaluation order is unspecified.** `flushDB()` has no `ORDER BY`, but first-match-wins decides which rule gets credited in history. | `db.ts` `flushDB()` | Add `ORDER BY id ASC` now (documents intent, costs nothing) — or a real `priority` column if you want user-controlled ordering. |
| 11 | Low | **`allowBackup="true"`** — Android auto-backup will sync the rules DB to the user's Google Drive. Contradicts "data never leaves your phone". | `android/app/src/main/AndroidManifest.xml` | Set `android:allowBackup="false"` via a config plugin if you want the privacy claim to be literally true. |
| 12 | Low | Privacy Policy URL in `STORE_LISTING.md` points to `devwithcoffee.com/spamshield/privacy-policy`. Play rejects listings whose policy URL 404s. | `STORE_LISTING.md` | Publish `PRIVACY_POLICY.md` at that exact URL before submitting. |

---

## 13. Debugging playbook

### Log tags

```bash
adb logcat -c                                          # clear
adb logcat -s SpamShieldScreening:D SpamShieldModule:D # both native tags
```

`SpamShieldScreening` (the service) logs every screened call: the raw number, the normalized number, rule count, each match decision, and the resulting queue depth. `SpamShieldModule` (the bridge) logs role checks, sync writes, peeks, and clears.

### Inspect the IPC file directly (debug builds only)

```bash
adb shell run-as com.devwithcoffee.spamshield \
  cat /data/data/com.devwithcoffee.spamshield/shared_prefs/SpamShieldRules.xml
```

You'll see both keys. `active_rules` should mirror your active rules exactly; `pending_blocked_calls` should be `[]` right after you open the app. `run-as` fails on release builds — use a debug build to inspect.

### Simulate an incoming call (emulator)

```bash
adb emu gsm call +911401234567       # ring
adb emu gsm cancel +911401234567     # hang up
```

If the number matches a rule, the emulator should never ring and logcat should print `BLOCKING call from: ...`.

### Symptom → cause table

| Symptom | Most likely cause |
|---|---|
| Calls not blocked at all, banner says screening is off | Role not held. Some OEMs silently revoke it after an update — recheck in Settings → Default apps → Caller ID & spam app. |
| Role held, still not blocked | `active_rules` is stale or empty. Open the Dashboard (unconditional `flushDB()`) and re-check the prefs file. |
| Blocked, but nothing in History | Drain never ran, or an insert threw and got swallowed by the hook's empty catch. Check logcat for the peek/clear pair; temporarily un-swallow the errors in `hooks/useDatabase.ts`. |
| Timestamps off by ~5.5 hours | Something bypassed `parseUtc` / wrote local time. Check for a stray `new Date(row.blocked_at)`. |
| UI empty but blocking works fine | The classic signature of a swallowed DB error. See [§9.1](#91-single-connection-contract). |
| Calls from a saved contact aren't blocked | Working as designed — Android skips screening for contacts. Not fixable. |
| App is a blank screen on launch | A font failed to load; `_layout.tsx` returns `null` forever. |
| Blocked calls dedupe away | Two calls from the same number, same rule, in the same **second** collide on `idx_blocked_dedup`. Extremely rare; by design. |
| `requireNativeModule('CallScreener')` throws | You're running in Expo Go or a build made before the module existed. Rebuild with `expo run:android`. |
| Windows build dies on a long path | `withShortCmakePath` regexes stopped matching after an Expo upgrade, or `D:/b` isn't writable. See [§10.2](#102-the-three-plugins--order-matters--they-run-in-the-appjson-order). |

---

## 14. Extension recipes

### 14.1 Add a new match type

Five files, all required:

1. `database/db.ts` — add to the `MatchType` union and to `getRuleDescription()`.
2. `SpamShieldCallScreeningService.kt` — add a `when` branch in `checkAgainstRules()`.
3. `CallScreenerModule.kt` — add the same branch in `testMatch()`.
4. `app/add-rule.tsx` — add to `MATCH_TYPES` (label + hint) and to the placeholder/hint conditionals.
5. `components/RuleCard.tsx` — add to `MATCH_TYPE_LABELS`.

Old rules with an unknown `match_type` fall through to `contains` on the native side, so a downgrade degrades rather than crashes.

### 14.2 Add an allowlist (never-block list)

The service is a single-pass loop, so: add a `rule_kind TEXT DEFAULT 'block'` column (migration v2), include it in the `flushDB()` payload, and in `checkAgainstRules()` do a **first pass over `allow` rules that returns `null` immediately on match**, then the existing block pass. Allow must win, and must be checked first.

### 14.3 Notify on block

You can't post a notification from the screening service cheaply without adding a permission and a channel — and `POST_NOTIFICATIONS` on API 33+ needs a runtime grant, which contradicts the current zero-permission story. If you do it: create the channel in `MainApplication.onCreate()`, post from `logBlockedCall()`, and keep it under the Telecom time budget. Consider making it opt-in in Settings.

### 14.4 Wire up `testMatch` (15 minutes)

The highest-leverage debugging feature in the app is already written in Kotlin and just isn't exported. Add to `modules/call-screener/index.ts`:

```ts
export type TestMatchResult = {
  blocked: boolean;
  ruleId?: number;
  pattern?: string;
  matchType?: string;
  error?: string;
  trace: string[];
};

/** Run the real matching algorithm against a number without a real call. */
export function testMatch(phoneNumber: string): Promise<TestMatchResult> {
  return CallScreenerModule.testMatch(phoneNumber);
}
```

Then add a "Test a number" input to Settings that renders `trace` line by line. It prints exactly what the service sees: how many rules it loaded from SharedPreferences, the raw→normalized transform, and each rule's verdict. This turns "why didn't it block?" from a 20-minute logcat session into two seconds.

### 14.5 Export / import rules

`getRules()` → JSON → `expo-sharing`. On import, insert each row then call `flushDB()` **once** at the end rather than per-row. Validate `match_type` against the union and reject empty patterns on the way in.

---

## 15. Dead code & inconsistencies found

Not bugs — just things that will confuse you at 2am.

- **`db.ts: logBlockedCall()`** (line ~288) is **never called**. The only writer to `blocked_calls` is `doDrain()`. The real logging happens in Kotlin. Safe to delete, or keep as a manual-insert utility.
- **`Stats.blockedThisWeek`** is computed by `getStats()` and defaulted in `useStats()`, but **no screen renders it**. The Dashboard shows total / today / active-rules.
- **`testMatch`** exists in Kotlin, is documented in `docs/03` and `docs/07`, and is **not exported** from `modules/call-screener/index.ts` — unreachable from JS today. See [§14.4](#144-wire-up-testmatch-15-minutes).
- **`REQUEST_CODE_SCREENING_ROLE = 42`** is passed to `startActivityForResult` but no `onActivityResult` exists anywhere. The AppState listener is the actual mechanism. The constant is vestigial.
- **`docs/01-OVERVIEW.md` claims Jest + ts-jest tests.** There are none. (Gap #8 above.)
- **`withShortCmakePath.js` / `build-apk.ps1` headers describe a `subst Z:` step** the script doesn't perform. Documented as a manual escape hatch in [§10.2](#102-the-three-plugins--order-matters--they-run-in-the-appjson-order).
- **`android/app/src/debugOptimized/`** variant manifest exists from the RN template; unused by any documented workflow.
- **Mixed import styles** for the native module: `@/modules/call-screener` in components vs `../../modules/call-screener` in screens.
- **Mixed quote styles** across files (some Prettier-formatted with double quotes, older files single) — `.vscode/settings.json` runs `source.fixAll` + `organizeImports` on save, so this drifts naturally.

---

## 16. Invariants checklist

Print this. Violating any one of these produces a bug that is silent in the UI and only visible when a real call comes in.

- [ ] **Every** rule mutation calls `flushDB()`. No exceptions.
- [ ] SQLite is opened **only** inside `getDB()`. The promise is cached, not the handle.
- [ ] The drain sequence stays **peek → insert → clear(count)**. Never clear on read.
- [ ] Every append/peek/clear on `pending_blocked_calls` sits inside `synchronized(PendingQueueLock)`.
- [ ] `blocked_at` is written **only** as UTC `YYYY-MM-DD HH:MM:SS`, and read **only** through `parseUtc()`.
- [ ] `onScreenCall` calls `respondToCall()` on **every** path, including exceptions. Fail open.
- [ ] No I/O, network, or blocking work inside `onScreenCall`. Telecom has a hard timeout.
- [ ] A rule pattern is never empty — three match types treat `""` as "block everything".
- [ ] The matching `when` block stays identical in `checkAgainstRules()` and `testMatch()`.
- [ ] `android/` is never hand-edited. Change `app.json` or `plugins/*.js`.
- [ ] `versionCode` is bumped in `app.json`, and strictly increases per Play upload.
- [ ] After any Expo SDK upgrade: re-verify that both `withShortCmakePath` injections and the `withReleaseSigning` regexes still landed in the generated `build.gradle`.
- [ ] The release smoke test in [§11](#11-release-runbook) passes on a **real device** with the **minified release build** — steps 4, 7, 9, 10 especially.

---

*Generated 2026-08-07 by reading the tree at `D:\THIS IS WHAT YOU WANT\Personal\Coding\Web-apps\hang-up`. When behaviour and this document disagree, the source wins — and please update this file.*
