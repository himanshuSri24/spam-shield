import CallScreenerModule from './src/CallScreenerModule';

/**
 * Request the user to set this app as the default call screening app.
 * Opens the system dialog to change the caller ID & spam app.
 */
export function requestScreeningRole(): Promise<boolean> {
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
