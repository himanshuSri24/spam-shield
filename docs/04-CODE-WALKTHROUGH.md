# Code Walkthrough — File by File

Every file in the project, explained line by line for someone reading the code for the first time.

---

## Configuration Files

### `package.json`

Standard npm project config. Key things:

- `"main": "expo-router/entry"` — Expo Router requires this exact entry point. It bootstraps file-based routing.
- Scripts: `start` launches Metro dev server, `android` builds native, `test` runs Jest.
- Dependencies are split into runtime (`dependencies`) and build-time (`devDependencies`).

### `app.json`

Expo configuration. Important fields:

- `"scheme": "spamshield"` — enables deep links (`spamshield://` URL scheme)
- `"newArchEnabled": true` — uses React Native's new architecture (Fabric + TurboModules)
- `"plugins"` — Expo plugins that modify the build:
  - `"expo-router"` — file-based routing
  - `"expo-splash-screen"` — native splash screen
  - `"expo-sqlite"` — SQLite native bindings
  - `"./plugins/withCallScreener"` — our custom plugin to register the CallScreeningService

### `tsconfig.json`

Extends Expo's TypeScript config. The `@/*` path alias maps to the project root, so `import { Colors } from '@/constants/theme'` works instead of `'../../constants/theme'`.

### `jest.config.js`

Uses `ts-jest` to run TypeScript tests directly without a separate compile step. The `moduleNameMapper` mirrors the `@/*` path alias from tsconfig.

### `eslint.config.js`

Uses Expo's recommended ESLint rules (flat config format). Nothing custom.

---

## Root Layout (`app/_layout.tsx`)

**Purpose**: App-wide setup that runs before any screen renders.

**What it does, step by step**:

1. **Load fonts** — `useFonts()` loads 8 font variants (Playfair Display + Inter) from Google Fonts. These are bundled into the app at build time.

2. **Keep splash screen visible** — `SplashScreen.preventAutoHideAsync()` is called at import time (not inside a component). This keeps the native splash screen showing while fonts download.

3. **Hide splash when ready** — Once fonts load, a `useEffect` fires a 400ms delayed `SplashScreen.hideAsync()`. The 400ms delay prevents a jarring flash.

4. **Define navigation** — Returns a `<Stack>` navigator with:
   - `(tabs)` — the main tab bar (default screen)
   - `onboarding` — full-screen with fade animation
   - `add-rule` — modal that slides up from the bottom
   - `settings` — modal that slides up from the bottom

5. **Status bar** — `<StatusBar style="dark" />` ensures dark text in the status bar (matches the cream background).

**Why no `<SQLiteProvider>`?** Unlike some Expo SQLite setups, this app uses `getDB()` imperatively rather than React context. Each database call opens/reuses the connection lazily.

---

## Tab Layout (`app/(tabs)/_layout.tsx`)

**Purpose**: The bottom tab bar with 3 tabs.

**TabIcon component**: A pure function that maps tab names to Unicode symbols:

- Dashboard → `◉`
- Rules → `⊘`
- History → `☰`

Why Unicode instead of icon libraries? Keeps the bundle small. No need for `@expo/vector-icons` (which was removed as unused).

**Tab bar styling**: Cream background matching the app theme, coral active tint, fixed 65px height.

---

## Dashboard (`app/(tabs)/index.tsx`)

**Purpose**: Home screen showing stats and recent blocks.

**Data flow**:

1. `useStats()` fetches total blocked, today's count, active rules from SQLite
2. `useRecentBlocks()` fetches last 5 blocked calls
3. `useFocusEffect` runs on every tab switch to drain pending calls and refresh

**Warning banner**: If `isScreeningEnabled()` returns false, shows a yellow banner with "Tap to enable". Tapping calls `requestScreeningRole()` → polls for result → falls back to opening settings.

**`formatTimestamp()`**: Converts ISO dates to relative strings ("Just now", "3 min ago", "Yesterday"). Defined locally in this file and also in history.tsx (duplicated — a minor imperfection you could refactor, but it's only 10 lines).

**Layout structure**:

```
ScrollView
├── Header (app name + settings gear)
├── Warning banner (conditional)
├── Decorative divider (✦ diamond between lines)
├── Stats grid
│   ├── StatCard (total blocked, full width, accent)
│   └── Row: StatCard (today) | StatCard (active rules)
└── Recent blocks section
    └── BlockedCallItem × 5
```

---

## Rules Screen (`app/(tabs)/rules.tsx`)

**Purpose**: List all blocking rules with toggle, swipe-to-delete, and tap-to-edit.

**Key patterns**:

- Wrapped in `<GestureHandlerRootView>` — required for swipe gestures to work
- Each rule card is inside `<Animated.View>` with `FadeOutUp` exit animation and `LinearTransition` layout animation. When you delete a rule, it fades up and the remaining cards smoothly rearrange.
- FAB (Floating Action Button) at bottom-right navigates to `/add-rule`
- Tap on a rule navigates to `/add-rule?ruleId=123` for editing

**Data refresh**: On focus, `drainPendingBlockedCalls()` imports any new blocks, then refreshes rules and blocked counts.

---

## History Screen (`app/(tabs)/history.tsx`)

**Purpose**: Full log of all blocked calls with search.

**Search implementation**: Simple client-side filter — checks if the search string appears in the phone number or matched pattern:

```typescript
const filteredCalls = search.trim()
  ? calls.filter(
      (c) =>
        c.phone_number.includes(search) ||
        (c.matched_pattern && c.matched_pattern.includes(search)),
    )
  : calls;
```

No debouncing (the list is small enough). No server-side search.

---

## Add Rule Screen (`app/add-rule.tsx`)

**Purpose**: Create new or edit existing blocking rules.

**Dual mode**: Checks `useLocalSearchParams<{ ruleId?: string }>()`. If `ruleId` is present, loads the existing rule and switches to edit mode.

**Match type selector**: A grid of 5 touchable cards. The active one gets coral highlighting. Below the grid, a hint explains the selected type.

**Pattern input**: Changes keyboard type based on match type — `phone-pad` for number-based types, `default` for regex (needs brackets, backslashes, etc.).

**Preview card**: Shows a live description of what the rule will do:

```
WILL DO
Blocks numbers starting with +91140

EXAMPLES
✓ +911401234567 → blocked
✓ +911409999999 → blocked
✗ Other numbers → allowed
```

**Presets**: Quick-select common Indian telemarketer prefixes (140, 1800, 120, 160, 180). Hidden when editing or using regex.

**Save flow**:

1. Trim pattern
2. If exact match: normalize to E.164 using `libphonenumber-js` with device locale
3. Call `dbAddRule()` or `dbUpdateRule()` (which auto-calls `flushDB()` to sync to native)
4. `router.back()` to return to the rules screen

---

## Onboarding (`app/onboarding.tsx`)

**Purpose**: First-time setup wizard with 4 steps.

**Conditional native module loading**: Uses `try/catch` around `require('../modules/call-screener')` because the native module isn't available in Expo Go. If unavailable, step 2 shows an alert explaining that a dev build is required.

**Step 2 — Enable Screening**: Calls `requestScreeningRole()` which opens a system dialog. Since there's no callback when the dialog closes, the code **polls** `isScreeningEnabled()` up to 10 times (1 second apart). If the user grants permission during that window, the UI updates.

**Persistence**: On completion, sets `AsyncStorage('spamshield_onboarding_complete', 'true')`. The dashboard would check this to decide whether to redirect to onboarding (though currently the routing relies on Expo Router's initial route).

**Animation**: Each step uses `FadeInDown.duration(400)` from reanimated for a smooth slide-in.

---

## Settings Screen (`app/settings.tsx`)

**Purpose**: Call screening toggle, FAQ, about info, data management.

**Call screening toggle**: A `<Switch>` that:

- ON → OFF: Shows an alert explaining how to disable via system settings (can't be done programmatically)
- OFF → ON: Calls `requestScreeningRole()` → polls for result → falls back to `openScreeningSettings()`

**FAQ accordion**: `expandedFAQ` state tracks which question is open. Tapping a question toggles it (closes others). 7 hardcoded Q&A entries covering common questions.

**Clear All Data**: Shows a destructive confirmation alert. Calls `clearAllData()` which DELETEs all rows from both tables and flushes empty rules to native.

**Made by section**: Links to `buymeacoffee.com/devwithcoffee` and `devwithcoffee.com` via `Linking.openURL()`.

---

## Components

### `BlockedCallItem.tsx`

Simple presentational component. Takes `phoneNumber`, `matchedPattern`, `timestamp` as props. Shows a red ✕ badge, number, pattern, and time. No state, no logic.

### `EmptyState.tsx`

Shows a large emoji icon, title, and message centered vertically. Used in rules (no rules yet) and history (no blocked calls yet) screens.

### `RuleCard.tsx`

Most complex component. Features:

- **Match type badge**: Shows icon (🎯/▶️/◀️/🔍/⚙️) and label ("Exact"/"Starts with"/etc.)
- **Pattern badge**: Coral background with the pattern text
- **Label**: Optional human-readable name
- **Blocked count**: "3 calls blocked"
- **Toggle switch**: Enable/disable the rule
- **Swipe-to-delete**: `<Swipeable>` from gesture handler. Swipe left reveals a red delete button. The delete animation uses `Animated.View` with `interpolate` on `dragX` for smooth reveal.
- **Tap to edit**: `onPress` on the card → `onEdit()` callback

### `StatCard.tsx`

Box showing a large number, label, and optional sublabel. `accent` prop makes it coral background with white text (used for the primary "total blocked" stat).

---

## Constants

### `fonts.ts`

Maps semantic names to actual font variant strings:

```typescript
FontFamily.displayBold    → 'PlayfairDisplay_700Bold'
FontFamily.bodyRegular    → 'Inter_400Regular'
```

This avoids typos and makes it easy to swap fonts later.

### `theme.ts`

Design tokens:

- **Colors**: Cream (#FFF5EC), coral (#D4613A), sage (#8B9A7E), charcoal (#2D2D2D), plus light/dark variants
- **Spacing**: Scale from xs (4px) to massive (64px)
- **BorderRadius**: Scale from sm (6px) to round (999px for pills)

---

## Native Module (`modules/call-screener/`)

### `index.ts` — JS Bridge

Exports typed wrapper functions. Each function calls the corresponding `AsyncFunction` on the Kotlin side via `requireNativeModule('CallScreener')`.

### `src/CallScreenerModule.ts` — Module Loader

One line: `requireNativeModule('CallScreener')`. This uses Expo Modules' JSI (JavaScript Interface) binding to load the Kotlin module.

### `expo-module.config.json`

Tells Expo's autolinking system where to find the Kotlin module class.

### `CallScreenerModule.kt` — Kotlin Bridge

Implements the `Module()` class from Expo Modules. Each `AsyncFunction` receives a `Promise` and resolves it. Key implementation details:

- **`requestScreeningRole()`**: Uses Android's `RoleManager` API (API 29+). First checks if already active. If not, creates a role request intent and launches it via `startActivityForResult`. Has a fallback path using `context.startActivity` if the activity-based approach fails (some OEMs).

- **`syncRules()`**: Just writes a string to SharedPreferences. That's it. The simplicity is the point — no SQLite, no file I/O, just a key-value store.

- **`getPendingBlockedCalls()`**: Reads the pending queue from SharedPreferences, then **immediately clears it**. This is an atomic read-and-clear to prevent double-processing.

- **`testMatch()`**: Dev-only function. Runs the same matching algorithm as the service and returns a detailed trace of what happened. Useful for debugging "why didn't this number get blocked?"

### `SpamShieldCallScreeningService.kt` — The Core

This is the file that actually blocks calls. It extends Android's `CallScreeningService` and implements `onScreenCall()`.

**Critical behavior**: If anything goes wrong (exception, null number, parse error), it **allows the call**. This is a deliberate safety measure — false negatives (letting spam through) are preferable to false positives (blocking legitimate calls).

---

## Config Plugin (`plugins/withCallScreener.js`)

Runs at build time. Uses Expo's `withAndroidManifest` modifier to inject the service declaration. Handles idempotency — if the service is already registered (from a previous build), it updates instead of duplicating.

---

## Test Files

### `__tests__/database.test.ts`

Mocks `expo-sqlite` with an in-memory object store. Tests:

- CRUD operations (add, get, update, toggle, delete rules)
- Blocked call logging and retrieval with joined patterns
- Stats calculations
- Data clearing
- Native sync after mutations (checks `syncRules` was called)
- Active-only rule filtering in `flushDB()`

### `__tests__/helpers.test.ts`

Tests pure functions without database:

- `getRuleDescription()` for each match type
- Wildcard migration logic (old `*pattern*` format)
- Phone number formatting edge cases

### `__tests__/matching.test.ts`

Tests the matching algorithm (mirrors both JS and Kotlin implementations):

- `normalizeNumber()` formatting
- Each match type (exact, starts_with, ends_with, contains, regex)
- Multiple rules priority (first match wins)
- Edge cases (empty strings, invalid regex)
