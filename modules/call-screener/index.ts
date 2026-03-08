import CallScreenerModule from './src/CallScreenerModule';

/**
 * Request the user to set this app as the default call screening app.
 * Opens the system dialog to change the caller ID & spam app.
 */
export function requestScreeningRole(): Promise<string> {
  return CallScreenerModule.requestScreeningRole();
}

/**
 * Check if this app is currently set as the default call screening app.
 */
export function isScreeningEnabled(): Promise<boolean> {
  return CallScreenerModule.isScreeningEnabled();
}

/**
 * Get the current status of the call screening service.
 */
export function getServiceStatus(): Promise<string> {
  return CallScreenerModule.getServiceStatus();
}

/**
 * Sync active SQLite rules to Native SharedPreferences JSON layer.
 * This completely circumvents sqlite WAL flush contention across bridge.
 */
export function syncRules(rulesJson: string): Promise<boolean> {
  return CallScreenerModule.syncRules(rulesJson);
}

/**
 * Open system Default Apps settings so user can manually select call screening app.
 */
export function openScreeningSettings(): Promise<boolean> {
  return CallScreenerModule.openScreeningSettings();
}

/**
 * Drain the pending blocked calls queue from SharedPreferences.
 * Returns a JSON string of [{phone_number, matched_rule_id, blocked_at}, ...].
 * The queue is cleared after reading.
 */
export function getPendingBlockedCalls(): Promise<string> {
  return CallScreenerModule.getPendingBlockedCalls();
}

/**
 * Developer test method to verify match logic without a real call.
 */
export function testMatch(phoneNumber: string): Promise<any> {
  return CallScreenerModule.testMatch(phoneNumber);
}
