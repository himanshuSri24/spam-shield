# Android Deep Dive

Understanding the Android-specific parts: how CallScreeningService works, what the manifest does, and how the build system ties it together.

---

## Android's CallScreeningService API

### What is it?

`CallScreeningService` is an Android API (introduced in API 24, enhanced in API 29) that lets an app inspect **incoming calls** before the phone rings.

Only **one app** can be the default call screening app at a time. The user must explicitly grant this role (via a system dialog or settings).

### How Android calls our service

```
Phone call arrives
  │
  ▼
Android Telecom framework
  │
  ├── Is caller in contacts?
  │   └── Yes → Skip screening, ring immediately
  │
  ├── Is there a default screening app?
  │   └── No → Ring immediately
  │
  └── Yes → Start HangUpCallScreeningService (separate process)
            └── onScreenCall(Call.Details)
                │
                ├── Number extracted from Call.Details.handle
                │   (a "tel:" URI, .schemeSpecificPart = "+911401234567")
                │
                └── Service must call respondToCall() with a CallResponse
                    ├── Allow: CallResponse.Builder().build()
                    └── Reject: .setDisallowCall(true).setRejectCall(true)...build()
```

### Important constraints

| Constraint                           | Implication                                                          |
| ------------------------------------ | -------------------------------------------------------------------- |
| Runs in a **separate process**       | Can't access React Native's JS runtime or SQLite directly            |
| Saved contacts **bypass screening**  | Can't block numbers in the user's contact list                       |
| Must respond **quickly**             | No long-running operations; reading SharedPreferences is fast        |
| Only **one** screening app at a time | User must choose between Hang Up and other caller ID apps            |
| API 29+ required for `RoleManager`   | Older Android can have the service but can't easily request the role |

---

## AndroidManifest.xml Explained

### Main Manifest (`android/app/src/main/AndroidManifest.xml`)

```xml
<!-- Permissions -->
<uses-permission android:name="android.permission.INTERNET" />
<!-- ^ Required by React Native for dev server communication -->

<!-- Service registration (injected by withCallScreener plugin) -->
<service
    android:name="expo.modules.callscreener.HangUpCallScreeningService"
    android:permission="android.permission.BIND_SCREENING_SERVICE"
    android:exported="true">
    <intent-filter>
        <action android:name="android.telecom.CallScreeningService" />
    </intent-filter>
</service>
```

**Key attributes**:

- `android:permission="BIND_SCREENING_SERVICE"` — Only the Android system can bind to this service. No other app can invoke it.
- `android:exported="true"` — Required because the system needs to start the service from outside the app.
- `intent-filter` with `android.telecom.CallScreeningService` — Tells Android "this service can screen calls."

### Module Manifest (`modules/call-screener/android/src/main/AndroidManifest.xml`)

Empty. All manifest entries are injected by the config plugin at build time.

---

## Gradle Build System

### Root `android/build.gradle`

- Defines plugin versions (Android Gradle Plugin, Kotlin, React Native Gradle Plugin)
- Specifies Maven repositories (Google, Maven Central, JitPack)

### App `android/app/build.gradle`

Key configurations:

- `minSdkVersion` — from Expo defaults (currently 24)
- `targetSdkVersion` — from Expo defaults (currently 35)
- `applicationId` — `com.devwithcoffee.hangup`
- Hermes engine enabled (JavaScript engine that supports React Native's new architecture)
- ProGuard configured for release builds (`proguard-rules.pro`)

### Module `modules/call-screener/android/build.gradle`

Uses `expo-module-gradle-plugin` — Expo's wrapper that auto-configures:

- Kotlin compilation
- Dependency resolution
- Module registration

---

## RoleManager API

Android 10 (API 29) introduced `RoleManager` as the way to designate default apps for specific tasks:

```kotlin
val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager

// Check if the role exists on this device
roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)

// Check if we currently hold the role
roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)

// Create an intent to request the role (shows system dialog)
val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
startActivityForResult(intent, REQUEST_CODE)
```

The system dialog shows something like:

```
┌─────────────────────────────────────┐
│  Set Hang Up as your caller ID     │
│  and spam app?                      │
│                                     │
│  This app will be used to identify  │
│  callers and filter spam calls.     │
│                                     │
│  [Cancel]              [Set as app] │
└─────────────────────────────────────┘
```

**OEM variations**: Some manufacturers (Xiaomi MIUI, Samsung One UI) customize this dialog or replace it with their own settings page. The fallback `openScreeningSettings()` handles this by opening the system's Default Apps settings.

---

## SharedPreferences as IPC

SharedPreferences is Android's built-in key-value store. It's file-backed (XML), process-safe for reads, and fast.

### Storage layout

```
File: /data/data/com.devwithcoffee.hangup/shared_prefs/HangUpRules.xml

Keys:
├── "active_rules" (String)
│   Value: '[{"id":1,"pattern":"+91140","match_type":"starts_with"}, ...]'
│
└── "pending_blocked_calls" (String)
    Value: '[{"phone_number":"+911401234567","matched_rule_id":1,"blocked_at":"2026-03-08T10:30:00"}, ...]'
```

### Write patterns

| Writer             | Key                     | When                                      |
| ------------------ | ----------------------- | ----------------------------------------- |
| JS → Kotlin bridge | `active_rules`          | After every rule add/update/toggle/delete |
| Kotlin service     | `pending_blocked_calls` | After blocking a call                     |

### Read patterns

| Reader             | Key                     | When                                  |
| ------------------ | ----------------------- | ------------------------------------- |
| Kotlin service     | `active_rules`          | On every incoming call                |
| JS → Kotlin bridge | `pending_blocked_calls` | On `getPendingBlockedCalls()` (drain) |

---

## Process Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Android OS                       │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ Process 1: com.devwithcoffee.hangup         │    │
│  │                                             │    │
│  │  ┌─────────────────────────────────┐        │    │
│  │  │ React Native (JS Thread)       │        │    │
│  │  │    app/ screens                │        │    │
│  │  │    database/db.ts (SQLite)     │        │    │
│  │  │    hooks/useDatabase.ts        │        │    │
│  │  └────────────┬────────────────────┘        │    │
│  │               │ JSI Bridge                  │    │
│  │  ┌────────────▼────────────────────┐        │    │
│  │  │ CallScreenerModule.kt          │        │    │
│  │  │  (Native bridge functions)     │        │    │
│  │  └────────────┬────────────────────┘        │    │
│  │               │ SharedPreferences           │    │
│  │               │ (read/write)                │    │
│  └───────────────┼─────────────────────────────┘    │
│                  │                                  │
│  ┌───────────────▼─────────────────────────────┐    │
│  │ Process 2 (or same, depends on config)      │    │
│  │                                             │    │
│  │  HangUpCallScreeningService.kt              │    │
│  │  (Started by Android Telecom on call)       │    │
│  │                                             │    │
│  │  Reads: SharedPreferences("active_rules")   │    │
│  │  Writes: SharedPreferences("pending_blocked")│    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

The service and the app **may** run in the same process or separate processes depending on Android's process management. The SharedPreferences approach works correctly in both cases.

---

## Debug Tools

### testMatch() — Rule Testing Without Real Calls

```kotlin
AsyncFunction("testMatch") { phoneNumber: String, promise: Promise ->
    // Same logic as HangUpCallScreeningService.checkAgainstRules()
    // But returns a trace of every step for debugging
    // Returns: { blocked: true/false, ruleId, pattern, matchType, trace: [...] }
}
```

Usage from JS (during development):

```typescript
const result = await testMatch("+911401234567");
console.log(result.trace);
// ["Loaded 3 rules from SharedPreferences",
//  "Input: '+911401234567' -> '+911401234567'",
//  "Rule #1 (starts_with): '+91140'",
//  "  -> MATCH"]
```

This is invaluable for debugging "why isn't my rule working?" without needing to simulate an actual phone call.
