# High-Level Design (HLD)

## System Context

Hang Up is a **single-device, offline-only Android application**. No servers, no APIs, no cloud.

```
┌─────────────────────────────────────────────────┐
│                 USER'S PHONE                    │
│                                                 │
│  ┌──────────────┐     ┌──────────────────────┐  │
│  │  Android OS  │     │     Hang Up App      │  │
│  │              │     │                      │  │
│  │  Incoming    │────▶│  CallScreeningService │  │
│  │  Call Event  │     │  (Kotlin, background) │  │
│  │              │◀────│                      │  │
│  │  Allow /     │     │  React Native UI     │  │
│  │  Reject      │     │  (foreground)        │  │
│  └──────────────┘     └──────────────────────┘  │
│                                                 │
│             No network. No servers.             │
└─────────────────────────────────────────────────┘
```

---

## Component Architecture

The app has **three major layers**:

### 1. Presentation Layer (React Native)

All UI screens, navigation, and user interactions. Built with Expo Router for file-based routing.

### 2. Data Layer (SQLite + Hooks)

Local database with two tables (`rules`, `blocked_calls`). React hooks wrap all queries so components just call `useRules()`, `useStats()`, etc.

### 3. Native Layer (Kotlin)

The actual call interception happens here. A Kotlin `CallScreeningService` runs in the background (separate process) and reads rules from `SharedPreferences`.

```
┌───────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                  │
│                                                       │
│  ┌────────────┐ ┌────────────┐ ┌──────────────────┐  │
│  │ Dashboard  │ │   Rules    │ │    History        │  │
│  │ (index)    │ │ (rules)    │ │  (history)        │  │
│  └─────┬──────┘ └──────┬─────┘ └────────┬─────────┘  │
│        │               │                │             │
│  ┌─────┴───────────────┴────────────────┴──────────┐  │
│  │              useDatabase.ts Hooks               │  │
│  │  useRules() useStats() useBlockedCalls() etc.   │  │
│  └─────────────────────┬───────────────────────────┘  │
│                        │                              │
├────────────────────────┼──────────────────────────────┤
│                   DATA LAYER                          │
│                        │                              │
│  ┌─────────────────────▼───────────────────────────┐  │
│  │                database/db.ts                   │  │
│  │  addRule() deleteRule() logBlockedCall() etc.   │  │
│  │  flushDB() ─── syncs rules TO native ──────┐   │  │
│  │  drainPendingBlockedCalls() ◀── FROM native─┘   │  │
│  └─────────────────────┬───────────────────────────┘  │
│                        │                              │
│         ┌──────────────┼──────────────┐               │
│         ▼              │              ▼               │
│  ┌──────────┐          │      ┌──────────────────┐    │
│  │  SQLite  │          │      │ SharedPreferences │    │
│  │  hangup  │          │      │  (HangUpRules)    │    │
│  │  .db     │          │      │                   │    │
│  └──────────┘          │      └──────────────────┘    │
│                        │              ▲               │
├────────────────────────┼──────────────┼───────────────┤
│                   NATIVE LAYER        │               │
│                        │              │               │
│  ┌─────────────────────▼──────────────┴────────────┐  │
│  │        CallScreenerModule.kt (Bridge)           │  │
│  │  requestScreeningRole() syncRules() etc.        │  │
│  └─────────────────────────────────────────────────┘  │
│                        │                              │
│  ┌─────────────────────▼───────────────────────────┐  │
│  │     HangUpCallScreeningService.kt               │  │
│  │  onScreenCall() → checkAgainstRules()           │  │
│  │  → allow or reject silently                     │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

---

## Data Architecture

### Two Storage Systems

Hang Up uses **SQLite** for the main database and **SharedPreferences** for cross-process communication:

| Storage                               | What's in it                                   | Who reads         | Who writes        |
| ------------------------------------- | ---------------------------------------------- | ----------------- | ----------------- |
| **SQLite** (`hangup.db`)              | Rules, blocked call history                    | React Native (JS) | React Native (JS) |
| **SharedPreferences** (`HangUpRules`) | Active rules JSON, pending blocked calls queue | Kotlin service    | Both (see below)  |

### Why Two Systems?

The CallScreeningService runs in a **separate OS process** from React Native. SQLite uses WAL (Write-Ahead Logging) mode, and two processes accessing the same WAL file causes locking conflicts. The solution:

1. **JS writes rules → SharedPreferences** (via `flushDB()` → `syncRules()`)
2. **Kotlin reads rules from SharedPreferences** when a call comes in
3. **Kotlin writes blocked call records → SharedPreferences** (as a JSON queue)
4. **JS drains the queue → SQLite** (via `drainPendingBlockedCalls()`)

This avoids any multi-process SQLite access.

---

## Database Schema

```sql
-- Rules table: stores all blocking rules
CREATE TABLE rules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern     TEXT NOT NULL,           -- e.g., "+91140", "7777", "\\+91[0-9]+"
  label       TEXT DEFAULT '',         -- e.g., "Delhi telemarketers"
  match_type  TEXT DEFAULT 'starts_with',  -- exact|starts_with|ends_with|contains|regex
  is_active   INTEGER DEFAULT 1,       -- 0 or 1 (SQLite has no boolean)
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Blocked calls table: log of every rejected call
CREATE TABLE blocked_calls (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number    TEXT NOT NULL,        -- e.g., "+911401234567"
  matched_rule_id INTEGER,             -- FK → rules.id (SET NULL on delete)
  blocked_at      TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (matched_rule_id) REFERENCES rules(id) ON DELETE SET NULL
);
```

### Key Design Decisions

- **`ON DELETE SET NULL`** on `matched_rule_id`: When a rule is deleted, blocked call records survive (showing "Unknown rule" in the UI) instead of cascade-deleting history
- **`is_active` as INTEGER**: SQLite doesn't have a boolean type; 0 = inactive, 1 = active
- **`datetime('now')` default**: Timestamps are stored as ISO 8601 strings in UTC
- **No indexes explicitly**: SQLite auto-indexes the PRIMARY KEY. The dataset is small (dozens of rules, hundreds of calls) so no performance issues

---

## Navigation Architecture

Expo Router uses **file-based routing** — every file in `app/` becomes a route.

```
app/
├── _layout.tsx           →  Root Stack Navigator (wraps everything)
├── onboarding.tsx        →  /onboarding (fade animation)
├── add-rule.tsx          →  /add-rule (modal, slides up from bottom)
├── settings.tsx          →  /settings (modal, slides up from bottom)
└── (tabs)/
    ├── _layout.tsx       →  Tab Navigator (3 tabs)
    ├── index.tsx         →  / (Dashboard tab)
    ├── rules.tsx         →  /rules (Rules tab)
    └── history.tsx       →  /history (History tab)
```

**Route hierarchy**:

```
Stack (Root)
├── Tab Navigator ─── Dashboard | Rules | History
├── Onboarding (full screen, fade transition)
├── Add Rule (modal, slides up)
└── Settings (modal, slides up)
```

The `(tabs)` folder name with parentheses is an Expo Router convention for **layout routes** — it creates a group without adding a URL segment.

---

## Security & Privacy Design

| Concern              | Decision                                                          |
| -------------------- | ----------------------------------------------------------------- |
| **Data storage**     | SQLite on device only, never exfiltrated                          |
| **Network**          | Zero network calls in the entire codebase                         |
| **Permissions**      | Only `BIND_SCREENING_SERVICE` (required for CallScreeningService) |
| **Contact access**   | None. Android skips screening for saved contacts automatically    |
| **Analytics**        | None. No Firebase, no Sentry, no tracking                         |
| **Third-party SDKs** | None that phone home                                              |

---

## Match Types

The matching algorithm is **identical** on both JS (for testing/preview) and Kotlin (for actual blocking):

| Type          | Description        | Example Pattern | Blocks                           |
| ------------- | ------------------ | --------------- | -------------------------------- |
| `exact`       | Full number match  | `+919563123456` | Only that exact number           |
| `starts_with` | Prefix match       | `+91140`        | `+911401234567`, `+911409999999` |
| `ends_with`   | Suffix match       | `7777`          | `+910001237777`, `+441237777`    |
| `contains`    | Substring match    | `5555`          | Any number with `5555` anywhere  |
| `regex`       | Regular expression | `\\+91[0-9]+`   | Any Indian number                |

Numbers are **normalized** before matching (spaces, dashes, parentheses stripped). The `+` prefix is preserved.
