# Data Flow & Lifecycle

Every important data flow in the app, from user action to final state change.

---

## Flow 1: Adding a New Rule

```
User taps "+" FAB on Rules screen
  │
  ▼
Router navigates to /add-rule (modal slides up)
  │
  ▼
User selects match type (e.g., "Starts with")
User types pattern (e.g., "+91140")
User types label (e.g., "Delhi telemarketers")
User taps "Save"
  │
  ▼
handleSave() in add-rule.tsx
  │
  ├── If match_type === 'exact':
  │   ├── Detect device locale (e.g., "IN" for India)
  │   ├── parsePhoneNumberFromString("+91140", "IN")
  │   ├── If valid → normalize to E.164 ("+91140" → "+91140")
  │   └── If invalid → strip formatting only
  │
  ├── dbAddRule("+91140", "Delhi telemarketers", "starts_with")
  │   │
  │   ├── INSERT INTO rules (pattern, label, match_type) VALUES (...)
  │   │   └── Returns { lastInsertRowId: 5, changes: 1 }
  │   │
  │   ├── flushDB()  ← AUTOMATIC after every rule mutation
  │   │   ├── SELECT id, pattern, match_type FROM rules WHERE is_active = 1
  │   │   ├── JSON.stringify([{id:5, pattern:"+91140", match_type:"starts_with"}, ...])
  │   │   └── syncRules(jsonString)
  │   │       └── Kotlin: SharedPreferences.putString("active_rules", jsonString)
  │   │
  │   └── Return Rule object { id: 5, pattern: "+91140", ... }
  │
  └── router.back()  ← modal dismisses
        │
        ▼
Rules screen regains focus
  │
  ├── useFocusEffect fires
  ├── refresh() re-queries getRules() from SQLite
  └── UI shows the new rule card
```

---

## Flow 2: Blocking an Incoming Call

```
Phone receives call from +911401234567
  │
  ▼
Android checks: Is there a default call screening app?
  ├── Yes → HangUpCallScreeningService.onScreenCall()
  └── No  → Phone rings normally
  │
  ▼
onScreenCall(callDetails)
  │
  ├── phoneNumber = callDetails.handle.schemeSpecificPart
  │   = "+911401234567"
  │
  ├── phoneNumber is not empty, proceed
  │
  ├── checkAgainstRules("+911401234567")
  │   │
  │   ├── Read SharedPreferences("HangUpRules", "active_rules")
  │   │   = '[{"id":5,"pattern":"+91140","match_type":"starts_with"}]'
  │   │
  │   ├── normalizeNumber("+911401234567") = "+911401234567"
  │   │
  │   ├── Rule #5: starts_with "+91140"
  │   │   normalizeNumber("+91140") = "+91140"
  │   │   "+911401234567".startsWith("+91140") → TRUE ✓
  │   │
  │   └── Return MatchResult(ruleId=5, pattern="+91140", matchType="starts_with")
  │
  ├── Match found! Build rejection response:
  │   CallResponse.Builder()
  │     .setDisallowCall(true)
  │     .setRejectCall(true)
  │     .setSkipCallLog(false)    ← keep in system call log
  │     .setSkipNotification(true) ← NO ring, NO vibration, NO popup
  │
  ├── respondToCall(callDetails, response) → call silently rejected
  │
  └── logBlockedCall("+911401234567", 5)
      │
      ├── Read SharedPreferences("pending_blocked_calls")
      │   = '[]' (empty queue)
      │
      ├── Append: [{"phone_number":"+911401234567","matched_rule_id":5,"blocked_at":"2026-03-08T10:30:00"}]
      │
      └── Write back to SharedPreferences
```

---

## Flow 3: Draining Pending Blocked Calls

```
User opens the app (or switches to Dashboard/Rules/History tab)
  │
  ▼
useFocusEffect fires in the active tab
  │
  ├── drainPendingBlockedCalls()
  │   │
  │   ├── getPendingBlockedCalls()
  │   │   │
  │   │   ├── Kotlin: Read SharedPreferences("pending_blocked_calls")
  │   │   │   = '[{"phone_number":"+911401234567","matched_rule_id":5,"blocked_at":"..."}]'
  │   │   │
  │   │   ├── Kotlin: Write SharedPreferences("pending_blocked_calls", "[]")
  │   │   │   ← CLEAR the queue immediately after reading
  │   │   │
  │   │   └── Return JSON string to JS
  │   │
  │   ├── JSON.parse(pendingJson) → array of 1 entry
  │   │
  │   ├── For each entry:
  │   │   INSERT INTO blocked_calls (phone_number, matched_rule_id, blocked_at)
  │   │   VALUES ("+911401234567", 5, "2026-03-08T10:30:00")
  │   │
  │   └── Return 1 (number of imported calls)
  │
  ├── count > 0, so:
  │   ├── refreshStats()  ← re-query total/today/active counts
  │   └── refreshRecent() ← re-query last 5 blocked calls
  │
  └── UI updates with new data
```

---

## Flow 4: Toggling a Rule On/Off

```
User taps switch on rule card
  │
  ▼
RuleCard.onToggle(false)
  │
  ▼
useRules().toggleRule(5, false)
  │
  ├── dbUpdateRuleActive(5, false)
  │   │
  │   ├── UPDATE rules SET is_active = 0 WHERE id = 5
  │   │
  │   └── flushDB()
  │       ├── SELECT ... FROM rules WHERE is_active = 1
  │       │   ← Rule #5 is now EXCLUDED from this query
  │       ├── JSON.stringify(remaining active rules)
  │       └── syncRules(json) → SharedPreferences updated
  │
  └── setRules(prev => prev.map(...))
      ← Optimistic update: immediately update UI state
      ← No loading spinner needed
```

**Result**: The rule stays in the list but appears dimmed (opacity: 0.6). Incoming calls against that pattern are no longer blocked because the rule was removed from SharedPreferences.

---

## Flow 5: Deleting a Rule (Swipe)

```
User swipes left on rule card
  │
  ▼
Swipeable reveals delete button (red, slides in from right)
  │
  ▼
User taps "Delete"
  │
  ▼
handleDelete()
  ├── swipeableRef.current.close() ← close the swipe panel
  └── onDelete()
        │
        ▼
useRules().removeRule(5)
  │
  ├── dbDeleteRule(5)
  │   │
  │   ├── DELETE FROM rules WHERE id = 5
  │   │   ← blocked_calls.matched_rule_id is SET NULL (ON DELETE SET NULL)
  │   │
  │   └── flushDB() → remove from SharedPreferences
  │
  └── setRules(prev => prev.filter(r => r.id !== 5))
        │
        ▼
Animated.View exit animation plays
  ├── FadeOutUp.duration(250) ← card fades upward
  └── LinearTransition.springify().damping(16) ← remaining cards slide into position
```

---

## Flow 6: Requesting Call Screening Role

```
User taps "Enable Screening" (onboarding or settings)
  │
  ▼
CallScreener.requestScreeningRole()
  │
  ▼ (Kotlin side)
  │
  ├── Check Android version ≥ Q (API 29)
  │   └── If too old → reject with ERR_UNSUPPORTED
  │
  ├── Get RoleManager
  │   ├── isRoleAvailable(ROLE_CALL_SCREENING)?
  │   │   └── No → reject with ERR_ROLE_NOT_AVAILABLE
  │   │
  │   ├── isRoleHeld(ROLE_CALL_SCREENING)?
  │   │   └── Yes → resolve("already_active")
  │   │
  │   └── Not held → create request intent
  │       ├── Try currentActivity.startActivityForResult(intent)
  │       │   └── If fails (some OEMs) → try context.startActivity(intent)
  │       └── resolve("requested")
  │
  ▼ (Back in JS)
  │
  ├── result === "already_active" → update UI, done
  │
  ├── result === "requested" → POLL for result
  │   │
  │   └── Loop 10 times, 1 second apart:
  │       ├── await isScreeningEnabled()
  │       ├── If true → break loop, update UI
  │       └── If false → continue polling
  │
  └── No response after polling → try openScreeningSettings() as fallback
```

**Why polling?** Android's role request opens a system dialog as a separate activity. There's no intent result callback in the Expo Modules framework, so polling `isRoleHeld()` is the reliable workaround.

---

## Flow 7: App Startup

```
User taps app icon
  │
  ▼
Android loads MainActivity → React Native initializes
  │
  ▼
SplashScreen.preventAutoHideAsync() ← splash stays visible
  │
  ▼
app/_layout.tsx renders
  │
  ├── useFonts() begins loading 8 font files
  │   └── While loading: return null (splash still showing)
  │
  ├── Fonts loaded → useEffect fires
  │   └── setTimeout 400ms → SplashScreen.hideAsync()
  │
  └── Stack navigator renders
      │
      ├── Initial route: (tabs) → Dashboard
      │
      └── Dashboard renders
          │
          ├── useStats() → getDB() → first call → openDatabaseAsync('hangup.db')
          │   └── initDB() → CREATE TABLE IF NOT EXISTS ...
          │   └── Migration check → skip (columns exist)
          │
          ├── useFocusEffect fires
          │   ├── drainPendingBlockedCalls() → import any queued blocks
          │   ├── refreshStats() → query counts
          │   ├── refreshRecent() → query last 5
          │   ├── flushDB() → sync rules to native
          │   └── isScreeningEnabled() → check status
          │
          └── UI renders with data
```

---

## Flow 8: Editing an Existing Rule

```
User taps on a rule card in the Rules screen
  │
  ▼
onEdit() → router.push('/add-rule?ruleId=5')
  │
  ▼
add-rule.tsx renders with params.ruleId = "5"
  │
  ├── isEditing = true
  ├── editId = 5
  ├── loadingRule = true (shows "Loading rule…" spinner)
  │
  ├── useEffect fires → getRuleById(5)
  │   ├── SELECT * FROM rules WHERE id = 5
  │   └── Set state: pattern, label, matchType from loaded rule
  │
  ├── loadingRule = false → form renders pre-filled
  │
  ├── User makes changes
  │
  └── Save → dbUpdateRule(5, newPattern, newLabel, newMatchType)
      ├── UPDATE rules SET pattern=?, label=?, match_type=? WHERE id=5
      ├── flushDB() → re-sync to native
      └── router.back()
```

---

## Lifecycle Diagram

```
                    ┌──────────────┐
                    │   App Start  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Load Fonts  │
                    │ Show Splash  │
                    └──────┬───────┘
                           │
              ┌────────────▼────────────┐
              │  Is First Launch?       │
              │  (check onboarding key) │
              └────┬──────────────┬─────┘
                   │ Yes          │ No
          ┌────────▼────────┐     │
          │   Onboarding    │     │
          │   (4 steps)     │     │
          └────────┬────────┘     │
                   │              │
              ┌────▼──────────────▼─────┐
              │      Tab Navigator      │
              │                         │
              │  Dashboard │ Rules │ History
              │                         │
              │  On every focus:        │
              │  - drain pending calls  │
              │  - refresh data         │
              │  - sync rules to native │
              │  - check screening      │
              └─────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   Add Rule       Settings      Blocked Call
   (modal)        (modal)       arrives in BG
        │              │              │
        │              │         ┌────▼────────┐
   Save rule      Toggle        │ Kotlin       │
   + flushDB()    screening     │ screens call │
                  + FAQ         │ blocks/allows│
                  + clear data  │ queues to SP │
                                └──────────────┘
```
