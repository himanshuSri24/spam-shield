package expo.modules.callscreener

import android.database.sqlite.SQLiteDatabase
import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log
import java.io.File

/**
 * HangUpCallScreeningService — The core of the Hang Up app.
 *
 * Runs as a background service whenever a call comes in.
 * Reads blocking rules from the SQLite database, checks the incoming
 * number against all active regex patterns, and silently rejects
 * matching calls without ringing.
 */
class HangUpCallScreeningService : CallScreeningService() {

    companion object {
        private const val TAG = "HangUpScreening"
    }

    override fun onScreenCall(callDetails: Call.Details) {
        val phoneNumber = callDetails.handle?.schemeSpecificPart ?: ""
        Log.d(TAG, "Screening call from: $phoneNumber")

        if (phoneNumber.isEmpty()) {
            // Allow calls with no number (private/unknown) — user can add a rule for this
            respondToCall(callDetails, CallResponse.Builder().build())
            return
        }

        try {
            val shouldBlock = checkAgainstRules(phoneNumber)

            if (shouldBlock) {
                Log.d(TAG, "BLOCKING call from: $phoneNumber")
                val response = CallResponse.Builder()
                    .setDisallowCall(true)
                    .setRejectCall(true)
                    .setSkipCallLog(false)   // Keep it in call log for reference
                    .setSkipNotification(true) // Don't show notification
                    .build()
                respondToCall(callDetails, response)

                // Log the blocked call to our database
                logBlockedCall(phoneNumber)
            } else {
                Log.d(TAG, "ALLOWING call from: $phoneNumber")
                respondToCall(callDetails, CallResponse.Builder().build())
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error screening call", e)
            // On error, allow the call through (fail-open for safety)
            respondToCall(callDetails, CallResponse.Builder().build())
        }
    }

    /**
     * Check the incoming phone number against all active blocking rules.
     * Converts wildcard patterns (e.g. "140*") to regex and matches.
     */
    private fun checkAgainstRules(phoneNumber: String): Boolean {
        val db = openDatabase() ?: return false

        try {
            val cursor = db.rawQuery(
                "SELECT pattern FROM rules WHERE is_active = 1",
                null
            )

            cursor.use {
                while (it.moveToNext()) {
                    val pattern = it.getString(0)
                    val regex = wildcardToRegex(pattern)

                    // Clean the phone number (remove spaces, dashes, +country code)
                    val cleanedNumber = cleanPhoneNumber(phoneNumber)

                    if (regex.matches(cleanedNumber) || regex.matches(phoneNumber)) {
                        Log.d(TAG, "Match found! Pattern: $pattern matched number: $phoneNumber")
                        return true
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking rules", e)
        } finally {
            db.close()
        }

        return false
    }

    /**
     * Log a blocked call to the database for the history screen.
     */
    private fun logBlockedCall(phoneNumber: String) {
        val db = openDatabase() ?: return

        try {
            // Find the matching rule ID
            val cursor = db.rawQuery(
                "SELECT id, pattern FROM rules WHERE is_active = 1",
                null
            )

            var matchedRuleId: Int? = null
            cursor.use {
                while (it.moveToNext()) {
                    val ruleId = it.getInt(0)
                    val pattern = it.getString(1)
                    val regex = wildcardToRegex(pattern)
                    val cleanedNumber = cleanPhoneNumber(phoneNumber)

                    if (regex.matches(cleanedNumber) || regex.matches(phoneNumber)) {
                        matchedRuleId = ruleId
                        break
                    }
                }
            }

            db.execSQL(
                "INSERT INTO blocked_calls (phone_number, matched_rule_id, blocked_at) VALUES (?, ?, datetime('now'))",
                arrayOf(phoneNumber, matchedRuleId ?: 0)
            )

            Log.d(TAG, "Logged blocked call from: $phoneNumber (rule ID: $matchedRuleId)")
        } catch (e: Exception) {
            Log.e(TAG, "Error logging blocked call", e)
        } finally {
            db.close()
        }
    }

    /**
     * Open the expo-sqlite database directly.
     * expo-sqlite stores databases in the app's databases directory.
     */
    private fun openDatabase(): SQLiteDatabase? {
        return try {
            val dbDir = File(applicationContext.filesDir.parentFile, "databases")
            val dbFile = File(dbDir, "hangup.db")

            if (!dbFile.exists()) {
                Log.w(TAG, "Database file not found at: ${dbFile.absolutePath}")
                return null
            }

            SQLiteDatabase.openDatabase(
                dbFile.absolutePath,
                null,
                SQLiteDatabase.OPEN_READWRITE
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open database", e)
            null
        }
    }

    /**
     * Convert a user-friendly wildcard pattern to a Regex.
     * Supports * (match any) and ? (match single character).
     */
    private fun wildcardToRegex(pattern: String): Regex {
        val escaped = pattern
            .replace("\\", "\\\\")
            .replace(".", "\\.")
            .replace("(", "\\(")
            .replace(")", "\\)")
            .replace("[", "\\[")
            .replace("]", "\\]")
            .replace("{", "\\{")
            .replace("}", "\\}")
            .replace("^", "\\^")
            .replace("$", "\\$")
            .replace("|", "\\|")
            .replace("+", "\\+")
            .replace("*", ".*")
            .replace("?", ".")
            .replace(" ", "\\s*")  // Flexible spacing
            .replace("-", "-?")    // Optional dashes

        return Regex("^$escaped$", RegexOption.IGNORE_CASE)
    }

    /**
     * Clean a phone number by removing common formatting characters.
     */
    private fun cleanPhoneNumber(number: String): String {
        return number
            .replace("+91", "")
            .replace("+", "")
            .replace(" ", "")
            .replace("-", "")
            .replace("(", "")
            .replace(")", "")
            .trim()
    }
}
