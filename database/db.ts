/**
 * Database initialization and CRUD operations for Hang Up.
 * Uses expo-sqlite for completely offline local storage.
 */

import * as SQLite from 'expo-sqlite';

export interface Rule {
  id: number;
  pattern: string;
  label: string;
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
    db = await SQLite.openDatabaseAsync('hangup.db');
    await initDB(db);
  }
  return db;
}

async function initDB(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL,
      label TEXT DEFAULT '',
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

// ==================== RULES ====================

export async function getRules(): Promise<Rule[]> {
  const database = await getDB();
  return database.getAllAsync<Rule>(
    'SELECT * FROM rules ORDER BY created_at DESC'
  );
}

export async function addRule(pattern: string, label: string): Promise<Rule> {
  const database = await getDB();
  const result = await database.runAsync(
    'INSERT INTO rules (pattern, label) VALUES (?, ?)',
    [pattern, label]
  );
  return {
    id: result.lastInsertRowId,
    pattern,
    label,
    is_active: 1,
    created_at: new Date().toISOString(),
  };
}

export async function updateRuleActive(id: number, isActive: boolean): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    'UPDATE rules SET is_active = ? WHERE id = ?',
    [isActive ? 1 : 0, id]
  );
}

export async function deleteRule(id: number): Promise<void> {
  const database = await getDB();
  await database.runAsync('DELETE FROM rules WHERE id = ?', [id]);
}

export async function getActiveRulesPatterns(): Promise<string[]> {
  const database = await getDB();
  const rules = await database.getAllAsync<{ pattern: string }>(
    'SELECT pattern FROM rules WHERE is_active = 1'
  );
  return rules.map(r => r.pattern);
}

// ==================== BLOCKED CALLS ====================

export async function logBlockedCall(
  phoneNumber: string,
  matchedRuleId: number
): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    'INSERT INTO blocked_calls (phone_number, matched_rule_id) VALUES (?, ?)',
    [phoneNumber, matchedRuleId]
  );
}

export async function getBlockedCalls(limit: number = 50): Promise<BlockedCall[]> {
  const database = await getDB();
  return database.getAllAsync<BlockedCall>(
    `SELECT bc.*, r.pattern as matched_pattern
     FROM blocked_calls bc
     LEFT JOIN rules r ON bc.matched_rule_id = r.id
     ORDER BY bc.blocked_at DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getRecentBlockedCalls(limit: number = 5): Promise<BlockedCall[]> {
  return getBlockedCalls(limit);
}

// ==================== STATS ====================

export async function getStats(): Promise<Stats> {
  const database = await getDB();

  const total = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM blocked_calls'
  );

  const today = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM blocked_calls
     WHERE date(blocked_at) = date('now')`
  );

  const week = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM blocked_calls
     WHERE blocked_at >= datetime('now', '-7 days')`
  );

  const activeRules = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM rules WHERE is_active = 1'
  );

  return {
    totalBlocked: total?.count ?? 0,
    blockedToday: today?.count ?? 0,
    blockedThisWeek: week?.count ?? 0,
    activeRules: activeRules?.count ?? 0,
  };
}

// ==================== SEED DATA (for dev/demo) ====================

export async function seedDemoData(): Promise<void> {
  const database = await getDB();

  // Check if we already have data
  const existing = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM rules'
  );
  if (existing && existing.count > 0) return;

  // Seed some rules
  const rules = [
    { pattern: '140*', label: 'Telemarketers (140)' },
    { pattern: '1800*', label: 'Toll-free spam' },
    { pattern: '120*', label: 'Service calls (120)' },
    { pattern: '160*', label: 'Marketing (160)' },
  ];

  for (const rule of rules) {
    await database.runAsync(
      'INSERT INTO rules (pattern, label) VALUES (?, ?)',
      [rule.pattern, rule.label]
    );
  }

  // Seed some blocked calls
  const blockedCalls = [
    { phone: '+91 140-2839-4721', ruleId: 1, minutesAgo: 2 },
    { phone: '+91 140-9182-6374', ruleId: 1, minutesAgo: 65 },
    { phone: '+91 1800-123-4567', ruleId: 2, minutesAgo: 180 },
    { phone: '+91 140-7291-8834', ruleId: 1, minutesAgo: 1440 },
    { phone: '+91 120-4455-6677', ruleId: 3, minutesAgo: 2880 },
    { phone: '+91 160-1122-3344', ruleId: 4, minutesAgo: 4320 },
  ];

  for (const call of blockedCalls) {
    const blockedAt = new Date(Date.now() - call.minutesAgo * 60 * 1000).toISOString();
    await database.runAsync(
      'INSERT INTO blocked_calls (phone_number, matched_rule_id, blocked_at) VALUES (?, ?, ?)',
      [call.phone, call.ruleId, blockedAt]
    );
  }
}
