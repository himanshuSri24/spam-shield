# Design Decisions & Trade-offs

Why things are built the way they are. These are the answers to "why did you do it this way?"

---

## 1. Why SharedPreferences over SQLite for Cross-Process Communication?

**Problem**: Android's `CallScreeningService` runs in a **separate OS process** from React Native. Expo-sqlite uses WAL (Write-Ahead Logging) mode. Two processes accessing the same WAL file causes `SQLITE_BUSY` errors and deadlocks.

**Considered alternatives**:

- **ContentProvider**: Too much boilerplate for what's essentially key-value storage
- **Room/native SQLite**: Would require duplicating the schema in Kotlin
- **File-based IPC**: No atomicity guarantees
- **AIDL/Binder**: Massive overkill for passing a JSON string

**Chosen solution**: SharedPreferences as a JSON relay.

- JS serializes active rules to JSON → writes to SharedPreferences
- Kotlin reads from SharedPreferences when a call comes in
- Kotlin writes blocked calls to a SharedPreferences queue → JS drains it

**Trade-off**: Slightly higher latency (JSON parse on every call) in exchange for zero multi-process database conflicts. The JSON is typically tiny (a few dozen rules, ~1KB), so parse time is negligible.

---

## 2. Why Expo Modules Instead of React Native's Native Modules?

**Expo Modules** (the framework used here) provides:

- Swift/Kotlin API instead of Java/Objective-C boilerplate
- JSI (JavaScript Interface) bindings — faster than the old bridge
- Typed module definitions (`AsyncFunction`, `Name`, etc.)
- Auto-linking via `expo-module.config.json`
- Compatible with Expo's build system

**React Native's TurboModules** would work too, but requires more manual C++ glue code and doesn't integrate as smoothly with `npx expo run:android`.

---

## 3. Why a Config Plugin (`withCallScreener.js`)?

Android requires the `CallScreeningService` to be declared in `AndroidManifest.xml` with specific permissions and intent filters. This can't be done at runtime.

With Expo, `AndroidManifest.xml` is auto-generated during builds. If you edit it directly, your changes get overwritten. **Config plugins** run during the build process and programmatically modify the manifest.

**Why not just edit the manifest manually?** Because we're using Expo's managed workflow. The manifest is regenerated on every `npx expo prebuild` or `npx expo run:android`. The plugin ensures our service entry survives rebuilds.

---

## 4. Why File-Based Routing (Expo Router)?

Traditional React Navigation requires manually defining screens and routes in code:

```javascript
// Manual route config
<Stack.Screen name="Settings" component={SettingsScreen} />
```

With Expo Router, each file in `app/` **is** a route:

```
app/settings.tsx  →  /settings (automatic)
```

**Benefits**:

- Less boilerplate
- Type-safe navigation (with `typedRoutes: true`)
- Deep linking works automatically (`spamshield://settings`)
- Familiar pattern if you've used Next.js

**Trade-off**: Folder structure = navigation structure. You can't have a file in `app/` that isn't a route.

---

## 5. Why Poll Instead of Using a Callback for Role Request?

When `requestScreeningRole()` opens the system dialog, Android launches it as a **separate activity**. The normal pattern is `onActivityResult()`, but:

1. Expo Modules doesn't have a built-in `onActivityResult` handler
2. The React context may not be the same when the result arrives
3. Some OEMs (MIUI, HyperOS) show custom dialogs that don't fire the standard result

**Polling approach**: After launching the dialog, loop up to 10 times checking `isRoleHeld()` every second. This works universally across all Android variants.

**Trade-off**: A 10-second window where the app is polling. If the user takes longer, `isScreeningEnabled()` is rechecked on every `useFocusEffect` anyway, so it self-corrects.

---

## 6. Why Local SQLite Instead of AsyncStorage for Everything?

AsyncStorage is a simple key-value store. It works for flags like "onboarding complete", but it's terrible for:

- Querying (e.g., "count blocked calls today")
- Joining (e.g., "get blocked call with its matched rule pattern")
- Sorting (e.g., "most recent first")
- Updating individual records

SQLite gives us relational queries, indexes, foreign keys, and structured data — all offline.

---

## 7. Why Two Font Families?

| Font                 | Used For                  | Personality                |
| -------------------- | ------------------------- | -------------------------- |
| **Playfair Display** | Headings, app name, stats | Editorial, high-end, retro |
| **Inter**            | Body text, labels, inputs | Clean, readable, modern    |

This pairing creates visual hierarchy. The serif headers catch the eye, while the sans-serif body text is easy to scan. It's a pattern borrowed from editorial/magazine design.

---

## 8. Why `setSkipCallLog(false)` When Blocking?

When Spam Shield blocks a call, it sets `setSkipCallLog(false)`. This means the blocked call **still appears in the phone's native call log** as a missed call.

**Why not hide it?** Users want to know what was blocked. If they check their phone's call log and see a missed call, they can cross-reference with Spam Shield's history to verify it was spam.

Setting `setSkipCallLog(true)` would make blocked calls completely invisible — which could be dangerous if a legitimate call is accidentally blocked.

---

## 9. Why `ON DELETE SET NULL` on blocked_calls?

When a rule is deleted, its `matched_rule_id` in `blocked_calls` becomes `NULL`. The alternative was `ON DELETE CASCADE` — deleting the rule would delete all associated blocked call records.

**Choice rationale**: History should be permanent. If a user deletes a "block 140\*" rule, they should still see that 47 calls from 140-numbers were blocked in the past. The UI shows "Unknown rule" for deleted rules.

---

## 10. Why No State Management Library?

No Redux, no MobX, no Zustand. Just:

- `useState` for component-local state
- Custom hooks wrapping database queries
- `useFocusEffect` for data refresh on screen focus

**Why this works**: The data model is simple (rules + blocked calls). There's no complex cross-screen state synchronization needed. Each screen loads its own data independently.

**Trade-off**: If two screens show the same data (e.g., dashboard's "active rules" count and rules screen's list), they query independently. This means a brief moment of inconsistency during navigation. In practice, this is invisible because `useFocusEffect` refreshes data as soon as a screen appears.

---

## 11. Why `try/catch` for Native Module Import?

```typescript
let CallScreener: any = null;
try {
  CallScreener = require("../modules/call-screener");
} catch (e) {
  console.warn("CallScreener native module not available");
}
```

This pattern appears in `onboarding.tsx`, `settings.tsx`, and `index.tsx`. The native Kotlin module only exists in **dev builds** (`npx expo run:android`), not in **Expo Go** (the development app).

By wrapping the import in `try/catch`, the UI still works in Expo Go — you just can't test call screening. Buttons that need the native module check `if (!CallScreener)` and show an alert.

---

## 12. Why No Push Notifications or Background Sync?

The app uses a **pull model**: data is refreshed when the user looks at a screen. There's no background sync timer, no push notifications for blocked calls.

**Why**:

- Push notifications require a server (we have none)
- Background sync wastes battery for marginal benefit
- `useFocusEffect` already ensures fresh data when the user opens the app
- The native service operates independently — it doesn't need the JS side running to block calls

---

## 13. Why Duplicate `formatTimestamp()` in Two Files?

`formatTimestamp()` is defined identically in both `index.tsx` (Dashboard) and `history.tsx`. This is a minor code smell, but intentionally not refactored because:

- It's 10 lines of pure logic
- Extracting it to a utility file adds a file for one function
- Both copies are in leaf components (not libraries), so they won't drift independently

If the app grew larger, this would be worth extracting to `utils/format.ts`.

---

## 14. Why Unicode Symbols Instead of an Icon Library?

Tab bar icons use `◉ ⊘ ☰` instead of vector icon libraries like `@expo/vector-icons`.

**Benefits**:

- Smaller bundle (removed `@expo/vector-icons` as unused)
- No additional native dependencies
- Consistent across all Android versions
- Loads instantly (no font file to parse)

**Trade-off**: Less polished than custom SVG icons. Acceptable for an MVP, could be upgraded later.
