# Low-Level Design (LLD)

This document covers the internal implementation details of every module — the "how" behind the "what".

---

## 1. Database Layer (`database/db.ts`)

### Initialization Flow

```
getDB() called (first time)
  │
  ├── openDatabaseAsync('hangup.db')  ← creates/opens the SQLite file
  │
  ├── initDB(database)
  │   ├── execAsync(CREATE TABLE rules ...)
  │   ├── execAsync(CREATE TABLE blocked_calls ...)
  │   │
  │   └── Migration check:
  │       ├── PRAGMA table_info(rules)  ← get column names
  │       ├── If 'match_type' column missing:
  │       │   ├── ALTER TABLE rules ADD COLUMN match_type
  │       │   └── For each existing rule:
  │       │       ├── *pattern* → match_type='contains', strip asterisks
  │       │       ├── pattern* → match_type='starts_with', strip trailing *
  │       │       ├── *pattern → match_type='ends_with', strip leading *
  │       │       └── pattern  → match_type='exact' (no change)
  │       └── If column exists: skip migration
  │
  └── Return database handle (cached in module-level `db` variable)
```

### Why the migration exists

Early versions of the app used wildcard patterns (`140*` meaning "starts with 140"). The migration converts those to the explicit `match_type` column approach, which is cleaner and supports `regex`.

### Singleton Pattern

`db` is a module-level variable. `getDB()` creates the connection on first call and reuses it for all subsequent calls. This is safe because React Native runs on a single JS thread.

### flushDB() — Syncing Rules to Native

```typescript
export async function flushDB(): Promise<void> {
  const activeRules = await database.getAllAsync(
    "SELECT id, pattern, match_type FROM rules WHERE is_active = 1",
  );
  await syncRules(JSON.stringify(activeRules));
}
```

This is called **after every rule mutation** (add, update, toggle, delete). It:

1. Queries only active rules from SQLite
2. Serializes them as JSON
3. Sends the JSON string to Kotlin via the native bridge
4. Kotlin stores it in SharedPreferences

**Why send JSON, not query SQLite from Kotlin?**
SQLite WAL mode + React Native's JS thread + Android's CallScreeningService (separate process) = deadlocks. Passing a JSON string through SharedPreferences avoids this entirely.

### drainPendingBlockedCalls() — Importing from Native

```typescript
export async function drainPendingBlockedCalls(): Promise<number> {
  const pendingJson = await getPendingBlockedCalls(); // reads + clears the queue
  const pending = JSON.parse(pendingJson);
  for (const call of pending) {
    await database.runAsync(
      "INSERT INTO blocked_calls (...) VALUES (?, ?, ?)",
      [call.phone_number, call.matched_rule_id, call.blocked_at],
    );
  }
  return pending.length;
}
```

Called on every screen focus (`useFocusEffect`). If 3 calls were blocked while the app was in the background, this imports all 3 into SQLite.

---

## 2. React Hooks (`hooks/useDatabase.ts`)

Each hook follows the same pattern:

```typescript
export function useXxx() {
  const [data, setData] = useState(initialValue);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await dbQuery();
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, refresh };
}
```

### Hooks provided

| Hook                     | Returns                                                                    | Used in        |
| ------------------------ | -------------------------------------------------------------------------- | -------------- |
| `useRules()`             | `{ rules, loading, refresh, addRule, updateRule, toggleRule, removeRule }` | Rules screen   |
| `useBlockedCalls(limit)` | `{ calls, loading, refresh }`                                              | History screen |
| `useRecentBlocks()`      | `{ calls, loading, refresh }` (last 5)                                     | Dashboard      |
| `useStats()`             | `{ stats, loading, refresh }`                                              | Dashboard      |
| `useRuleBlockedCounts()` | `{ counts, refresh }` (ruleId → count map)                                 | Rules screen   |

### Optimistic Updates in `useRules()`

When you toggle or delete a rule, the hook **updates local state immediately** (optimistic update) rather than re-querying the database:

```typescript
const toggleRule = useCallback(async (id: number, isActive: boolean) => {
  await dbUpdateRuleActive(id, isActive); // DB write
  setRules(
    (
      prev, // Immediate state update
    ) =>
      prev.map((r) =>
        r.id === id ? { ...r, is_active: isActive ? 1 : 0 } : r,
      ),
  );
}, []);
```

This makes toggling feel instant — no loading spinner.

---

## 3. Native Module Architecture

### Module Registration Chain

```
app.json
  └── plugins: ["./plugins/withCallScreener"]
        └── withCallScreener.js (Expo Config Plugin)
              └── Injects into AndroidManifest.xml:
                    <service
                      android:name="expo.modules.callscreener.HangUpCallScreeningService"
                      android:permission="android.permission.BIND_SCREENING_SERVICE"
                      android:exported="true">
                      <intent-filter>
                        <action android:name="android.telecom.CallScreeningService" />
                      </intent-filter>
                    </service>

modules/call-screener/expo-module.config.json
  └── "android": { "modules": ["expo.modules.callscreener.CallScreenerModule"] }
        └── Tells Expo Modules to auto-link this Kotlin module

modules/call-screener/src/CallScreenerModule.ts
  └── requireNativeModule('CallScreener')
        └── Loads the JSI binding created by Expo Modules runtime

modules/call-screener/index.ts
  └── Exports typed wrapper functions (requestScreeningRole, syncRules, etc.)
```

### CallScreenerModule.kt — Bridge Functions

Each function is an `AsyncFunction` that receives a `Promise` and resolves/rejects it:

| Function                   | What it does                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requestScreeningRole()`   | Uses `RoleManager.createRequestRoleIntent(ROLE_CALL_SCREENING)` to open the system dialog. Returns `"already_active"`, `"requested"`, or `"failed"`. |
| `isScreeningEnabled()`     | Checks `RoleManager.isRoleHeld(ROLE_CALL_SCREENING)`. Returns `true/false`.                                                                          |
| `getServiceStatus()`       | Returns `"active"`, `"inactive"`, `"unavailable"`, `"unsupported"`, or `"error"`.                                                                    |
| `syncRules(rulesJson)`     | Writes the JSON string to `SharedPreferences("HangUpRules", "active_rules")`.                                                                        |
| `getPendingBlockedCalls()` | Reads and clears the `"pending_blocked_calls"` key. Returns JSON array string.                                                                       |
| `openScreeningSettings()`  | Opens `ACTION_MANAGE_DEFAULT_APPS_SETTINGS` or falls back to `ACTION_SETTINGS`.                                                                      |
| `testMatch(phoneNumber)`   | Debug-only: runs the matching algorithm and returns a trace of what happened.                                                                        |

### normalizeNumber() (Kotlin)

```kotlin
fun normalizeNumber(number: String): String {
    return number
        .replace(" ", "")
        .replace("-", "")
        .replace("(", "")
        .replace(")", "")
        .trim()
}
```

Strips spaces, dashes, and parentheses. Preserves `+` prefix. This is **critically important** — Android passes numbers like `+91 9563 123456` and rules might store `+919563123456`.

The same logic exists in JavaScript (test files) to ensure both sides agree.

### HangUpCallScreeningService.kt — Call Interception

```
Android: Incoming call detected
  │
  ▼
onScreenCall(callDetails)
  │
  ├── Extract phone number from callDetails.handle.schemeSpecificPart
  │   (e.g., "+911401234567")
  │
  ├── If number is empty → allow the call
  │
  ├── checkAgainstRules(phoneNumber)
  │   │
  │   ├── Read SharedPreferences("HangUpRules", "active_rules")
  │   │   Parse JSON array of { id, pattern, match_type }
  │   │
  │   ├── normalizeNumber(phoneNumber) → strip formatting
  │   │
  │   ├── For each rule:
  │   │   ├── normalizeNumber(rule.pattern)
  │   │   ├── Match based on match_type:
  │   │   │   ├── exact:       normalizedNumber == normalizedPattern
  │   │   │   ├── starts_with: normalizedNumber.startsWith(normalizedPattern)
  │   │   │   ├── ends_with:   normalizedNumber.endsWith(normalizedPattern)
  │   │   │   ├── contains:    normalizedNumber.contains(normalizedPattern)
  │   │   │   └── regex:       Regex(pattern).containsMatchIn(normalizedNumber)
  │   │   └── First match wins → return MatchResult(ruleId, pattern, matchType)
  │   │
  │   └── No match → return null
  │
  ├── If match found:
  │   ├── respondToCall(REJECT, skipNotification=true) ← SILENT rejection
  │   └── logBlockedCall(phoneNumber, ruleId)
  │       └── Append to SharedPreferences "pending_blocked_calls" JSON array
  │
  └── If no match:
      └── respondToCall(ALLOW) ← let it ring
```

The **silent rejection** is key: `setSkipNotification(true)` means the user's phone never rings, never vibrates, never shows any notification. The call just disappears.

`setSkipCallLog(false)` keeps the call in the phone's native call log so the user can see missed calls if needed.

---

## 4. Expo Config Plugin (`plugins/withCallScreener.js`)

This runs at **build time** (not runtime) to modify `AndroidManifest.xml`:

```javascript
const withCallScreener = (config) => {
  return withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application[0];

    // Create the service entry
    const serviceEntry = {
      $: {
        "android:name": "expo.modules.callscreener.HangUpCallScreeningService",
        "android:permission": "android.permission.BIND_SCREENING_SERVICE",
        "android:exported": "true",
      },
      "intent-filter": [
        {
          action: [
            { $: { "android:name": "android.telecom.CallScreeningService" } },
          ],
        },
      ],
    };

    // Add or update the service
    if (existingService) {
      mainApplication.service[idx] = serviceEntry; // update
    } else {
      mainApplication.service.push(serviceEntry); // add
    }
  });
};
```

**Why `android:exported="true"`?** The Android system needs to start this service from outside the app (when a call comes in). Without `exported=true`, the system can't invoke it.

**Why `BIND_SCREENING_SERVICE` permission?** This is Android's security mechanism — only the system can bind to this service, preventing malicious apps from triggering it.

---

## 5. UI Component Internals

### RuleCard — Swipe-to-Delete

Uses `react-native-gesture-handler`'s `<Swipeable>`:

```
┌──────────────────────────────────────────┐
│  🎯 [Starts with]                        │
│  [+91140]            ← pattern badge     │  ←── swipe left reveals ──→  │ 🗑️ Delete │
│  Delhi telemarketers ← label             │
│  3 calls blocked     ← count       [🔘] │  ← toggle switch
└──────────────────────────────────────────┘
```

The swipe action uses `Animated.View` with `interpolate` on the gesture's `dragX` to slide/fade the delete button.

### StatCard — Accent Variant

```
Normal:                    Accent (primary stat):
┌──────────┐              ┌──────────┐
│    12    │ charcoal     │    12    │ white text
│  TODAY   │ on cream     │ BLOCKED  │ on coral bg
└──────────┘              └──────────┘
```

The `accent` prop swaps colors via conditional styles.

### BlockedCallItem

```
┌─ ✕ ─┬─ +911401234567 ─────── 3 min ago ─┐
│     │  Matched: +91140                    │
└─────┴────────────────────────────────────-┘
```

Simple row layout with circular icon badge, number, matched pattern, and relative timestamp.

---

## 6. Phone Number Normalization (add-rule.tsx)

When a user saves a rule with `match_type: 'exact'`, the pattern is normalized to E.164 format:

```typescript
if (matchType === "exact") {
  const regionCodes = Localization.getLocales();
  const defaultRegion = regionCodes[0]?.regionCode ?? "US";
  const phoneNumber = parsePhoneNumberFromString(cleanedPattern, defaultRegion);

  if (phoneNumber?.isValid()) {
    cleanedPattern = phoneNumber.number; // "+919563123456"
  } else {
    cleanedPattern = cleanedPattern.replace(/[\s\-\(\)]/g, "");
  }
}
```

This uses `libphonenumber-js` to parse "09563123456" into "+919563123456" based on the device's locale. If parsing fails (weird input), it just strips formatting.

**Why normalize?** Android's `CallScreeningService` receives numbers in E.164 format (`+919563123456`). If the user types "9563123456" without the country code, it wouldn't match. Normalizing ensures the exact match actually works.

---

## 7. Onboarding State Machine

```
Step 0: WELCOME
  │ → "Get Started"
  ▼
Step 1: ENABLE SCREENING
  │ → "Enable Screening" → requestScreeningRole() → poll for result
  │   OR "Skip for now"
  ▼
Step 2: HOW IT WORKS
  │ → "Next"
  │   OR "Skip"
  ▼
Step 3: YOU'RE ALL SET
  │ → "Start Blocking" → AsyncStorage.setItem('hangup_onboarding_complete', 'true')
  │                     → router.replace('/(tabs)')
  ▼
  Done (onboarding never shown again)
```

### Polling after role request

When `requestScreeningRole()` launches the system dialog, there's no callback. The app polls `isScreeningEnabled()` up to 10 times (1 second apart) to detect when the user grants permission. If they do, `screeningEnabled` is set to `true`, which changes the final step's message.

---

## 8. Screen Focus Refresh Pattern

Every tab screen uses `useFocusEffect` to refresh data when the user navigates to it:

```typescript
useFocusEffect(
  React.useCallback(() => {
    // 1. Import any calls blocked while we were away
    drainPendingBlockedCalls().then((count) => {
      if (count > 0) {
        refreshStats(); // only re-query if something changed
        refreshRecent();
      }
    });

    // 2. Refresh displayed data
    refreshStats();
    refreshRecent();

    // 3. Re-sync rules to native (belt and suspenders)
    flushDB();

    // 4. Check if we're still the default screening app
    CallScreener.isScreeningEnabled().then((enabled) =>
      setScreeningActive(enabled),
    );
  }, [refreshStats, refreshRecent]),
);
```

This is a "pull" model. No push notifications, no WebSockets, no polling timers. Just refresh when the user looks at the screen.

---

## 9. Error Handling Strategy

| Location               | Strategy                                                                |
| ---------------------- | ----------------------------------------------------------------------- |
| Database queries       | `try/catch` with `console.error`, return safe defaults                  |
| Native module calls    | Wrapped in `try/catch`, fallback to `openScreeningSettings()`           |
| Native module import   | `try { require() } catch {}` — graceful degradation in Expo Go          |
| Invalid regex in rules | `try/catch` around `new RegExp()`, return `false` (don't block)         |
| Migration failures     | `catch` with checking `duplicate column name` message                   |
| Kotlin side            | All `AsyncFunction`s wrapped in `try/catch`, always resolve the promise |

The philosophy is: **never crash, never block legitimate calls by accident**. If anything goes wrong, allow the call.
