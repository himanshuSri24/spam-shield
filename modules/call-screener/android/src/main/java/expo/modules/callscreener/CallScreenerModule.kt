package expo.modules.callscreener

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class CallScreenerModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("CallScreener")

        AsyncFunction("requestScreeningRole") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.reject("ERR_NO_CONTEXT", "React context is null", null)
                    return@AsyncFunction
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager
                    if (roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) {
                        if (roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) {
                            // Already the default screening app
                            promise.resolve(true)
                        } else {
                            // Need to request the role — this requires an activity
                            val currentActivity = appContext.currentActivity
                            if (currentActivity != null) {
                                val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
                                currentActivity.startActivityForResult(intent, REQUEST_CODE_SCREENING_ROLE)
                                // We can't easily get the result back in an async function,
                                // so we resolve true and let the UI check status separately
                                promise.resolve(true)
                            } else {
                                promise.reject("ERR_NO_ACTIVITY", "No active activity to show role request", null)
                            }
                        }
                    } else {
                        promise.reject("ERR_ROLE_NOT_AVAILABLE", "Call screening role is not available on this device", null)
                    }
                } else {
                    promise.reject("ERR_UNSUPPORTED", "Call screening requires Android 10 (API 29) or higher", null)
                }
            } catch (e: Exception) {
                promise.reject("ERR_REQUEST_ROLE", e.message ?: "Failed to request screening role", e)
            }
        }

        AsyncFunction("isScreeningEnabled") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.resolve(false)
                    return@AsyncFunction
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager
                    val isHeld = roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
                    promise.resolve(isHeld)
                } else {
                    promise.resolve(false)
                }
            } catch (e: Exception) {
                promise.resolve(false)
            }
        }

        AsyncFunction("getServiceStatus") { promise: Promise ->
            try {
                val context = appContext.reactContext
                if (context == null) {
                    promise.resolve("unavailable")
                    return@AsyncFunction
                }

                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                    promise.resolve("unsupported")
                    return@AsyncFunction
                }

                val roleManager = context.getSystemService(Context.ROLE_SERVICE) as RoleManager
                when {
                    !roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) -> promise.resolve("unavailable")
                    roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING) -> promise.resolve("active")
                    else -> promise.resolve("inactive")
                }
            } catch (e: Exception) {
                promise.resolve("error")
            }
        }
    }

    companion object {
        const val REQUEST_CODE_SCREENING_ROLE = 42
    }
}
