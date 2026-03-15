package expo.modules.callscreener

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class CallScreenerModule : Module() {

    companion object {
        private const val TAG = "SpamShieldModule"
        const val REQUEST_CODE_SCREENING_ROLE = 42

        fun normalizeNumber(number: String): String {
            return number
                .replace(" ", "")
                .replace("-", "")
                .replace("(", "")
                .replace(")", "")
                .trim()
        }

        fun tryOpenSettings(context: Context, activity: android.app.Activity? = null): Boolean {
            val intents = listOf(
                Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS),
                Intent(Settings.ACTION_SETTINGS)
            )
            for (intent in intents) {
                // Try from current Activity first — no NEW_TASK flag needed, more reliable on custom ROMs
                if (activity != null) {
                    try {
                        activity.startActivity(Intent(intent))
                        Log.d(TAG, "openScreeningSettings: opened via activity ${intent.action}")
                        return true
                    } catch (e: Exception) {
                        Log.w(TAG, "openScreeningSettings: activity failed for ${intent.action}", e)
                    }
                }
                // Fall back to application context with NEW_TASK flag
                try {
                    val ctxIntent = Intent(intent).also { it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
                    context.startActivity(ctxIntent)
                    Log.d(TAG, "openScreeningSettings: opened via context ${intent.action}")
                    return true
                } catch (e: Exception) {
                    Log.w(TAG, "openScreeningSettings: ${intent.action} failed", e)
                }
            }
            return false
        }
    }

    override fun definition() = ModuleDefinition {
        Name("CallScreener")

        AsyncFunction("requestScreeningRole") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    Log.e(TAG, "requestScreeningRole: React context is null")
                    promise.reject("ERR_NO_CONTEXT", "React context is null", null)
                    return@AsyncFunction
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager

                    if (roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) {
                        if (roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) {
                            Log.d(TAG, "requestScreeningRole: Already the default screening app")
                            promise.resolve("already_active")
                        } else {
                            val currentActivity = appContext.currentActivity
                            if (currentActivity != null) {
                                Log.d(TAG, "requestScreeningRole: Launching role request dialog")
                                try {
                                    val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
                                    currentActivity.startActivityForResult(intent, REQUEST_CODE_SCREENING_ROLE)
                                    promise.resolve("requested")
                                } catch (e: Exception) {
                                    Log.e(TAG, "requestScreeningRole: startActivityForResult failed", e)
                                    promise.resolve("failed")
                                }
                            } else {
                                Log.e(TAG, "requestScreeningRole: No active activity")
                                promise.resolve("failed")
                            }
                        }
                    } else {
                        Log.e(TAG, "requestScreeningRole: Role not available on this device")
                        promise.reject("ERR_ROLE_NOT_AVAILABLE", "Call screening role is not available on this device", null)
                    }
                } else {
                    Log.e(TAG, "requestScreeningRole: Android version too old (API ${Build.VERSION.SDK_INT})")
                    promise.reject("ERR_UNSUPPORTED", "Call screening requires Android 10 (API 29) or higher", null)
                }
            } catch (e: Exception) {
                Log.e(TAG, "requestScreeningRole: Exception", e)
                promise.reject("ERR_REQUEST_ROLE", e.message ?: "Failed to request screening role", e)
            }
        }

        AsyncFunction("isScreeningEnabled") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    Log.d(TAG, "isScreeningEnabled: React context is null, returning false")
                    promise.resolve(false)
                    return@AsyncFunction
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager
                    val isHeld = roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
                    Log.d(TAG, "isScreeningEnabled: $isHeld")
                    promise.resolve(isHeld)
                } else {
                    Log.d(TAG, "isScreeningEnabled: false (unsupported API)")
                    promise.resolve(false)
                }
            } catch (e: Exception) {
                Log.e(TAG, "isScreeningEnabled: Exception", e)
                promise.resolve(false)
            }
        }

        AsyncFunction("getServiceStatus") { promise: Promise ->
            try {
                val context = appContext.reactContext
                if (context == null) {
                    Log.d(TAG, "getServiceStatus: unavailable (no context)")
                    promise.resolve("unavailable")
                    return@AsyncFunction
                }

                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                    Log.d(TAG, "getServiceStatus: unsupported")
                    promise.resolve("unsupported")
                    return@AsyncFunction
                }

                val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager
                val status = when {
                    !roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) -> "unavailable"
                    roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) -> "active"
                    else -> "inactive"
                }
                Log.d(TAG, "getServiceStatus: $status")
                promise.resolve(status)
            } catch (e: Exception) {
                Log.e(TAG, "getServiceStatus: Exception", e)
                promise.resolve("error")
            }
        }

        AsyncFunction("openScreeningSettings") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.reject("ERR_NO_CONTEXT", "React context is null", null)
                    return@AsyncFunction
                }

                val launched = tryOpenSettings(context, appContext.currentActivity)
                if (launched) {
                    promise.resolve(true)
                } else {
                    promise.reject("ERR_NO_SETTINGS", "Could not open settings", null)
                }
            } catch (e: Exception) {
                Log.e(TAG, "openScreeningSettings: Exception", e)
                promise.reject("ERR_OPEN_SETTINGS", e.message ?: "Failed to open settings", e)
            }
        }

        AsyncFunction("syncRules") { rulesJson: String, promise: Promise ->
            try {
                val context = appContext.reactContext
                if (context == null) {
                    promise.resolve(false)
                    return@AsyncFunction
                }
                val prefs = context.getSharedPreferences("SpamShieldRules", Context.MODE_PRIVATE)
                prefs.edit().putString("active_rules", rulesJson).apply()
                Log.d(TAG, "Successfully synced rules to SharedPreferences")
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to sync rules", e)
                promise.resolve(false)
            }
        }

        AsyncFunction("getPendingBlockedCalls") { promise: Promise ->
            try {
                val context = appContext.reactContext
                if (context == null) {
                    promise.resolve("[]")
                    return@AsyncFunction
                }
                val prefs = context.getSharedPreferences("SpamShieldRules", Context.MODE_PRIVATE)
                val pendingJson = prefs.getString("pending_blocked_calls", "[]") ?: "[]"
                // Clear the queue after reading
                prefs.edit().putString("pending_blocked_calls", "[]").apply()
                Log.d(TAG, "Drained pending blocked calls: $pendingJson")
                promise.resolve(pendingJson)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to get pending blocked calls", e)
                promise.resolve("[]")
            }
        }

        AsyncFunction("testMatch") { phoneNumber: String, promise: Promise ->
            val trace = mutableListOf<String>()
            try {
                val context = appContext.reactContext
                if (context == null) {
                    trace.add("ERROR: React context is null")
                    promise.resolve(mapOf("blocked" to false, "trace" to trace))
                    return@AsyncFunction
                }

                val prefs = context.getSharedPreferences("SpamShieldRules", Context.MODE_PRIVATE)
                val rulesJson = prefs.getString("active_rules", "[]") ?: "[]"
                val jsonArray = org.json.JSONArray(rulesJson)
                trace.add("Loaded ${jsonArray.length()} rules from SharedPreferences")

                val normalizedNumber = normalizeNumber(phoneNumber)
                trace.add("Input: '$phoneNumber' -> '$normalizedNumber'")

                for (i in 0 until jsonArray.length()) {
                    val ruleObj = jsonArray.getJSONObject(i)
                    val ruleId = ruleObj.optInt("id", -1)
                    val pattern = ruleObj.optString("pattern", "")
                    val matchType = ruleObj.optString("match_type", "starts_with")
                    val normalizedPattern = normalizeNumber(pattern)

                    trace.add("Rule #$ruleId ($matchType): '$normalizedPattern'")

                    val matches = when (matchType) {
                        "exact" -> normalizedNumber == normalizedPattern
                        "starts_with" -> normalizedNumber.startsWith(normalizedPattern)
                        "ends_with" -> normalizedNumber.endsWith(normalizedPattern)
                        "contains" -> normalizedNumber.contains(normalizedPattern)
                        "regex" -> {
                            try {
                                Regex(pattern, RegexOption.IGNORE_CASE).containsMatchIn(normalizedNumber)
                            } catch (e: Exception) {
                                trace.add("  Regex error: ${e.message}")
                                false
                            }
                        }
                        else -> normalizedNumber.contains(normalizedPattern)
                    }

                    trace.add("  -> ${if (matches) "MATCH" else "no match"}")

                    if (matches) {
                        promise.resolve(mapOf(
                            "blocked" to true,
                            "ruleId" to ruleId,
                            "pattern" to pattern,
                            "matchType" to matchType,
                            "trace" to trace
                        ))
                        return@AsyncFunction
                    }
                }

                trace.add("No rules matched.")
                promise.resolve(mapOf("blocked" to false, "trace" to trace))
            } catch (e: Exception) {
                Log.e(TAG, "testMatch: Exception", e)
                trace.add("ERROR: ${e.message}")
                promise.resolve(mapOf("blocked" to false, "error" to e.message, "trace" to trace))
            }
        }
    }
}
