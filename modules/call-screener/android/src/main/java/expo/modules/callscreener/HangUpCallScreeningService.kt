package expo.modules.callscreener

import android.content.Context
import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * HangUpCallScreeningService — The core of the Hang Up app.
 *
 * Runs as a background service whenever a call comes in.
 * Reads blocking rules from SharedPreferences (synced from JS via the bridge),
 * checks the incoming number against all active rules using proper match_type
 * logic, and silently rejects matching calls without ringing.
 */
class HangUpCallScreeningService : CallScreeningService() {

    companion object {
        private const val TAG = "HangUpScreening"
    }

    override fun onScreenCall(callDetails: Call.Details) {
        val phoneNumber = callDetails.handle?.schemeSpecificPart ?: ""
        Log.d(TAG, "Screening call from: $phoneNumber")

        if (phoneNumber.isEmpty()) {
            respondToCall(callDetails, CallResponse.Builder().build())
            return
        }

        try {
            val matchResult = checkAgainstRules(phoneNumber)

            if (matchResult != null) {
                Log.d(TAG, "BLOCKING call from: $phoneNumber (rule #${matchResult.ruleId}, type=${matchResult.matchType}, pattern=${matchResult.pattern})")
                val response = CallResponse.Builder()
                    .setDisallowCall(true)
                    .setRejectCall(true)
                    .setSkipCallLog(false)
                    .setSkipNotification(true)
                    .build()
                respondToCall(callDetails, response)
                logBlockedCall(phoneNumber, matchResult.ruleId)
            } else {
                Log.d(TAG, "ALLOWING call from: $phoneNumber")
                respondToCall(callDetails, CallResponse.Builder().build())
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error screening call", e)
            respondToCall(callDetails, CallResponse.Builder().build())
        }
    }

    private data class MatchResult(val ruleId: Int, val pattern: String, val matchType: String)

    /**
     * Check the incoming phone number against all active blocking rules
     * from SharedPreferences, using proper match_type logic.
     */
    private fun checkAgainstRules(phoneNumber: String): MatchResult? {
        val prefs = applicationContext.getSharedPreferences("HangUpRules", Context.MODE_PRIVATE)
        val rulesJson = prefs.getString("active_rules", "[]") ?: "[]"
        val jsonArray = JSONArray(rulesJson)

        if (jsonArray.length() == 0) {
            Log.d(TAG, "No active rules in SharedPreferences")
            return null
        }

        val normalizedNumber = normalizeNumber(phoneNumber)
        Log.d(TAG, "Normalized: '$phoneNumber' -> '$normalizedNumber', checking ${jsonArray.length()} rules")

        for (i in 0 until jsonArray.length()) {
            val ruleObj = jsonArray.getJSONObject(i)
            val ruleId = ruleObj.optInt("id", -1)
            val pattern = ruleObj.optString("pattern", "")
            val matchType = ruleObj.optString("match_type", "starts_with")
            val normalizedPattern = normalizeNumber(pattern)

            val matches = when (matchType) {
                "exact" -> normalizedNumber == normalizedPattern
                "starts_with" -> normalizedNumber.startsWith(normalizedPattern)
                "ends_with" -> normalizedNumber.endsWith(normalizedPattern)
                "contains" -> normalizedNumber.contains(normalizedPattern)
                "regex" -> {
                    try {
                        Regex(pattern, RegexOption.IGNORE_CASE).containsMatchIn(normalizedNumber)
                    } catch (e: Exception) {
                        Log.w(TAG, "Invalid regex pattern '$pattern': ${e.message}")
                        false
                    }
                }
                else -> normalizedNumber.contains(normalizedPattern)
            }

            if (matches) {
                Log.d(TAG, "Match! Rule #$ruleId ($matchType): '$pattern' matched '$phoneNumber'")
                return MatchResult(ruleId, pattern, matchType)
            }
        }

        return null
    }

    /**
     * Log a blocked call to SharedPreferences as a pending entry.
     * The JS side drains this queue on focus and inserts into SQLite,
     * avoiding dual-writer WAL conflicts with expo-sqlite.
     */
    private fun logBlockedCall(phoneNumber: String, matchedRuleId: Int) {
        try {
            val prefs = applicationContext.getSharedPreferences("HangUpRules", Context.MODE_PRIVATE)
            val pendingJson = prefs.getString("pending_blocked_calls", "[]") ?: "[]"
            val pendingArray = JSONArray(pendingJson)

            val entry = JSONObject().apply {
                put("phone_number", phoneNumber)
                put("matched_rule_id", matchedRuleId)
                put("blocked_at", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US).format(java.util.Date()))
            }
            pendingArray.put(entry)

            prefs.edit().putString("pending_blocked_calls", pendingArray.toString()).apply()
            Log.d(TAG, "Queued blocked call from: $phoneNumber (rule ID: $matchedRuleId), pending count: ${pendingArray.length()}")
        } catch (e: Exception) {
            Log.e(TAG, "Error queuing blocked call", e)
        }
    }

    /**
     * Normalize a phone number by stripping formatting characters.
     * Preserves the + prefix and country code for accurate matching.
     */
    private fun normalizeNumber(number: String): String {
        return number
            .replace(" ", "")
            .replace("-", "")
            .replace("(", "")
            .replace(")", "")
            .trim()
    }
}
