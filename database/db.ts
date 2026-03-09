/**
 * Database initialization and CRUD operations for Hang Up.
 * Uses expo-sqlite for completely offline local storage.
 */

import * as SQLite from "expo-sqlite";
import { getPendingBlockedCalls, syncRules } from "../modules/call-screener";

export type MatchType =
  | "exact"
  | "starts_with"
  | "ends_with"
  | "contains"
  | "regex";

export interface Rule {
  id: number;
  pattern: string;
  label: string;
  match_type: MatchType;
  is_active: number; // 0 or 1 (SQLite doesn't have boolean)
  created_at: string;
}

export interface BlockedCall {
  id: number;
  phone_number: string;
  matched_rule_id: number;
  matched_pattern?: string; // joined from rules table
  blocked_at: string;
}

export interface Stats {
  totalBlocked: number;
  blockedToday: number;
  blockedThisWeek: number;
  activeRules: number;
}

let db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync("hangup.db");
    await initDB(db);
  }
  return db;
}

async function initDB(database: SQLite.SQLiteDatabase): Promise<void> {
  // Create tables
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL,
      label TEXT DEFAULT '',
      match_type TEXT DEFAULT 'starts_with',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blocked_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      matched_rule_id INTEGER,
      blocked_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (matched_rule_id) REFERENCES rules(id) ON DELETE SET NULL
    );
  `);
}

/**
 * Sync active rules directly to the Native Kotlin SharedPreferences.
 * By sending the JSON string across the bridge, we completely bypass
 * SQLite WAL file flushing/locking problems where Android couldn't read JS's active cache.
 */
export async function flushDB(): Promise<void> {
  const database = await getDB();
  try {
    const activeRules = await database.getAllAsync<{
      id: number;
      pattern: string;
      match_type: MatchType;
    }>("SELECT id, pattern, match_type FROM rules WHERE is_active = 1");
    await syncRules(JSON.stringify(activeRules));
  } catch (e) {
    if (__DEV__) console.error("Failed to sync rules to Native bridge:", e);
  }
}

/**
 * Drain pending blocked calls from Kotlin SharedPreferences into SQLite.
 * The native service writes blocked calls to a SharedPreferences queue
 * (since it can't write to expo-sqlite directly), and this function
 * moves them into the proper database on the JS side.
 * Returns the number of calls imported.
 */
export async function drainPendingBlockedCalls(): Promise<number> {
  try {
    const pendingJson = await getPendingBlockedCalls();
    const pending: Array<{
      phone_number: string;
      matched_rule_id: number;
      blocked_at: string;
    }> = JSON.parse(pendingJson);

    if (pending.length === 0) return 0;

    const database = await getDB();
    for (const call of pending) {
      await database.runAsync(
        "INSERT INTO blocked_calls (phone_number, matched_rule_id, blocked_at) VALUES (?, ?, ?)",
        [call.phone_number, call.matched_rule_id, call.blocked_at],
      );
    }

    if (__DEV__)
      console.log(
        `Imported ${pending.length} pending blocked call(s) from native queue`,
      );
    return pending.length;
  } catch (e) {
    if (__DEV__) console.error("Failed to drain pending blocked calls:", e);
    return 0;
  }
}

// ==================== RULES ====================

export async function getRules(): Promise<Rule[]> {
  const database = await getDB();
  return database.getAllAsync<Rule>(
    "SELECT * FROM rules ORDER BY created_at DESC",
  );
}

export async function getRuleById(id: number): Promise<Rule | null> {
  const database = await getDB();
  return database.getFirstAsync<Rule>("SELECT * FROM rules WHERE id = ?", [id]);
}

export async function addRule(
  pattern: string,
  label: string,
  matchType: MatchType = "starts_with",
): Promise<Rule> {
  const database = await getDB();
  const result = await database.runAsync(
    "INSERT INTO rules (pattern, label, match_type) VALUES (?, ?, ?)",
    [pattern, label, matchType],
  );
  await flushDB();
  return {
    id: result.lastInsertRowId,
    pattern,
    label,
    match_type: matchType,
    is_active: 1,
    created_at: new Date().toISOString(),
  };
}

export async function updateRule(
  id: number,
  pattern: string,
  label: string,
  matchType: MatchType,
): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    "UPDATE rules SET pattern = ?, label = ?, match_type = ? WHERE id = ?",
    [pattern, label, matchType, id],
  );
  await flushDB();
}

export async function updateRuleActive(
  id: number,
  isActive: boolean,
): Promise<void> {
  const database = await getDB();
  await database.runAsync("UPDATE rules SET is_active = ? WHERE id = ?", [
    isActive ? 1 : 0,
    id,
  ]);
  await flushDB();
}

export async function deleteRule(id: number): Promise<void> {
  const database = await getDB();
  await database.runAsync("DELETE FROM rules WHERE id = ?", [id]);
  await flushDB();
}

// ==================== BLOCKED CALLS ====================

export async function logBlockedCall(
  phoneNumber: string,
  matchedRuleId: number,
): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    "INSERT INTO blocked_calls (phone_number, matched_rule_id) VALUES (?, ?)",
    [phoneNumber, matchedRuleId],
  );
}

export async function getBlockedCalls(
  limit: number = 50,
): Promise<BlockedCall[]> {
  const database = await getDB();
  return database.getAllAsync<BlockedCall>(
    `SELECT bc.*, r.pattern as matched_pattern
     FROM blocked_calls bc
     LEFT JOIN rules r ON bc.matched_rule_id = r.id
     ORDER BY bc.blocked_at DESC
     LIMIT ?`,
    [limit],
  );
}

export async function getRecentBlockedCalls(
  limit: number = 5,
): Promise<BlockedCall[]> {
  return getBlockedCalls(limit);
}

// Returns a map of ruleId -> number of calls that rule has blocked
export async function getBlockedCountsByRule(): Promise<
  Record<number, number>
> {
  const database = await getDB();
  const rows = await database.getAllAsync<{
    matched_rule_id: number;
    count: number;
  }>(
    "SELECT matched_rule_id, COUNT(*) as count FROM blocked_calls WHERE matched_rule_id IS NOT NULL GROUP BY matched_rule_id",
  );
  const map: Record<number, number> = {};
  for (const row of rows) {
    map[row.matched_rule_id] = row.count;
  }
  return map;
}

// ==================== STATS ====================

export async function getStats(): Promise<Stats> {
  const database = await getDB();

  const total = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM blocked_calls",
  );

  const today = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM blocked_calls
     WHERE date(blocked_at) = date('now')`,
  );

  const week = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM blocked_calls
     WHERE blocked_at >= datetime('now', '-7 days')`,
  );

  const activeRules = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM rules WHERE is_active = 1",
  );

  return {
    totalBlocked: total?.count ?? 0,
    blockedToday: today?.count ?? 0,
    blockedThisWeek: week?.count ?? 0,
    activeRules: activeRules?.count ?? 0,
  };
}

// ==================== DATA MANAGEMENT ====================

export async function clearAllData(): Promise<void> {
  const database = await getDB();
  await database.execAsync(`
    DELETE FROM blocked_calls;
    DELETE FROM rules;
  `);
  await flushDB();
}

// ==================== HELPERS ====================

/** Get a human-readable description for a rule */
export function getRuleDescription(
  pattern: string,
  matchType: MatchType,
): string {
  switch (matchType) {
    case "exact":
      return `Blocks calls from ${pattern}`;
    case "starts_with":
      return `Blocks numbers starting with ${pattern}`;
    case "ends_with":
      return `Blocks numbers ending with ${pattern}`;
    case "contains":
      return `Blocks numbers containing ${pattern}`;
    case "regex":
      return `Regex pattern: ${pattern}`;
    default:
      return `Pattern: ${pattern}`;
  }
}
