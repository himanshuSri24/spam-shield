/**
 * Integration tests for the database layer.
 * Mocks expo-sqlite to test the logic of CRUD operations and data flow.
 */

// Mock the native module
jest.mock('../modules/call-screener', () => ({
  syncRules: jest.fn().mockResolvedValue(undefined),
}));

// In-memory store for mock database
let mockRows: Record<string, any[]> = {};
let autoIncrementId = 0;

const mockDatabase = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  getAllAsync: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
    if (sql.includes('PRAGMA table_info')) {
      return [
        { name: 'id' },
        { name: 'pattern' },
        { name: 'label' },
        { name: 'match_type' },
        { name: 'is_active' },
        { name: 'created_at' },
      ];
    }
    if (sql.includes('FROM rules') && sql.includes('is_active = 1')) {
      return (mockRows['rules'] || []).filter(r => r.is_active === 1);
    }
    if (sql.includes('FROM rules')) {
      return (mockRows['rules'] || []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    if (sql.includes('FROM blocked_calls')) {
      const limit = params?.[0] ?? 50;
      return (mockRows['blocked_calls'] || [])
        .map(bc => {
          const rule = (mockRows['rules'] || []).find(r => r.id === bc.matched_rule_id);
          return { ...bc, matched_pattern: rule?.pattern ?? null };
        })
        .sort((a, b) => new Date(b.blocked_at).getTime() - new Date(a.blocked_at).getTime())
        .slice(0, limit);
    }
    return [];
  }),
  getFirstAsync: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
    if (sql.includes('FROM rules WHERE id')) {
      return (mockRows['rules'] || []).find(r => r.id === params?.[0]) ?? null;
    }
    if (sql.includes('COUNT(*)')) {
      if (sql.includes('blocked_calls')) {
        return { count: (mockRows['blocked_calls'] || []).length };
      }
      if (sql.includes('rules') && sql.includes('is_active = 1')) {
        return { count: (mockRows['rules'] || []).filter(r => r.is_active === 1).length };
      }
    }
    return null;
  }),
  runAsync: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
    if (sql.includes('INSERT INTO rules')) {
      autoIncrementId++;
      const newRule = {
        id: autoIncrementId,
        pattern: params?.[0],
        label: params?.[1],
        match_type: params?.[2] ?? 'starts_with',
        is_active: 1,
        created_at: new Date().toISOString(),
      };
      if (!mockRows['rules']) mockRows['rules'] = [];
      mockRows['rules'].push(newRule);
      return { lastInsertRowId: autoIncrementId, changes: 1 };
    }
    if (sql.includes('INSERT INTO blocked_calls')) {
      autoIncrementId++;
      const newCall = {
        id: autoIncrementId,
        phone_number: params?.[0],
        matched_rule_id: params?.[1],
        blocked_at: new Date().toISOString(),
      };
      if (!mockRows['blocked_calls']) mockRows['blocked_calls'] = [];
      mockRows['blocked_calls'].push(newCall);
      return { lastInsertRowId: autoIncrementId, changes: 1 };
    }
    if (sql.includes('UPDATE rules SET is_active')) {
      const rule = (mockRows['rules'] || []).find(r => r.id === params?.[1]);
      if (rule) rule.is_active = params?.[0];
      return { changes: 1 };
    }
    if (sql.includes('UPDATE rules SET pattern')) {
      const rule = (mockRows['rules'] || []).find(r => r.id === params?.[3]);
      if (rule) {
        rule.pattern = params?.[0];
        rule.label = params?.[1];
        rule.match_type = params?.[2];
      }
      return { changes: 1 };
    }
    if (sql.includes('DELETE FROM rules WHERE id')) {
      mockRows['rules'] = (mockRows['rules'] || []).filter(r => r.id !== params?.[0]);
      return { changes: 1 };
    }
    return { changes: 0 };
  }),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn().mockResolvedValue(mockDatabase),
}));

import {
  getDB,
  getRules,
  addRule,
  updateRule,
  updateRuleActive,
  deleteRule,
  logBlockedCall,
  getBlockedCalls,
  getStats,
  clearAllData,
  getRuleById,
  getRuleDescription,
  flushDB,
} from '../database/db';
import { syncRules } from '../modules/call-screener';

beforeEach(() => {
  mockRows = {};
  autoIncrementId = 0;
  jest.clearAllMocks();
});

describe('Database CRUD - Rules', () => {
  it('initializes the database on first access', async () => {
    const db = await getDB();
    expect(db).toBeDefined();
    expect(mockDatabase.execAsync).toHaveBeenCalled();
  });

  it('adds a rule and returns it with correct fields', async () => {
    const rule = await addRule('+91140', 'Delhi spam', 'starts_with');

    expect(rule.id).toBe(1);
    expect(rule.pattern).toBe('+91140');
    expect(rule.label).toBe('Delhi spam');
    expect(rule.match_type).toBe('starts_with');
    expect(rule.is_active).toBe(1);
    expect(rule.created_at).toBeDefined();
  });

  it('syncs rules to native after adding', async () => {
    await addRule('+91140', 'Delhi spam', 'starts_with');
    expect(syncRules).toHaveBeenCalled();
  });

  it('retrieves all rules', async () => {
    await addRule('+91140', 'Delhi', 'starts_with');
    await addRule('+919999', 'Exact', 'exact');

    const rules = await getRules();
    expect(rules.length).toBe(2);
  });

  it('gets a rule by ID', async () => {
    const created = await addRule('+91140', 'Delhi', 'starts_with');
    const found = await getRuleById(created.id);
    expect(found).not.toBeNull();
    expect(found!.pattern).toBe('+91140');
  });

  it('updates a rule', async () => {
    const rule = await addRule('+91140', 'Delhi', 'starts_with');
    await updateRule(rule.id, '+91120', 'Noida', 'starts_with');

    const updated = (mockRows['rules'] || []).find(r => r.id === rule.id);
    expect(updated?.pattern).toBe('+91120');
    expect(updated?.label).toBe('Noida');
  });

  it('toggles rule active status', async () => {
    const rule = await addRule('+91140', 'Delhi', 'starts_with');
    await updateRuleActive(rule.id, false);

    const toggled = (mockRows['rules'] || []).find(r => r.id === rule.id);
    expect(toggled?.is_active).toBe(0);
  });

  it('syncs rules after toggling', async () => {
    const rule = await addRule('+91140', 'Delhi', 'starts_with');
    jest.clearAllMocks();
    await updateRuleActive(rule.id, false);
    expect(syncRules).toHaveBeenCalled();
  });

  it('deletes a rule', async () => {
    const rule = await addRule('+91140', 'Delhi', 'starts_with');
    await deleteRule(rule.id);

    expect(mockRows['rules']?.length).toBe(0);
  });

  it('syncs rules after deletion', async () => {
    const rule = await addRule('+91140', 'Delhi', 'starts_with');
    jest.clearAllMocks();
    await deleteRule(rule.id);
    expect(syncRules).toHaveBeenCalled();
  });
});

describe('Database CRUD - Blocked Calls', () => {
  it('logs a blocked call', async () => {
    const rule = await addRule('+91140', 'Delhi', 'starts_with');
    await logBlockedCall('+911401234567', rule.id);

    expect(mockRows['blocked_calls']?.length).toBe(1);
    expect(mockRows['blocked_calls']?.[0].phone_number).toBe('+911401234567');
  });

  it('retrieves blocked calls with joined rule pattern', async () => {
    const rule = await addRule('+91140', 'Delhi', 'starts_with');
    await logBlockedCall('+911401234567', rule.id);

    const calls = await getBlockedCalls();
    expect(calls.length).toBe(1);
    expect(calls[0].matched_pattern).toBe('+91140');
  });

  it('handles blocked call with deleted rule gracefully', async () => {
    const rule = await addRule('+91140', 'Delhi', 'starts_with');
    await logBlockedCall('+911401234567', rule.id);
    await deleteRule(rule.id);

    const calls = await getBlockedCalls();
    expect(calls.length).toBe(1);
    expect(calls[0].matched_pattern).toBeNull();
  });
});

describe('Database - Stats', () => {
  it('returns zero stats when database is empty', async () => {
    const stats = await getStats();
    expect(stats.totalBlocked).toBe(0);
    expect(stats.activeRules).toBe(0);
  });

  it('counts active rules', async () => {
    await addRule('+91140', 'Delhi', 'starts_with');
    await addRule('+91120', 'Noida', 'starts_with');

    const stats = await getStats();
    expect(stats.activeRules).toBe(2);
  });
});

describe('Database - clearAllData', () => {
  it('clears all rules and blocked calls', async () => {
    await addRule('+91140', 'Delhi', 'starts_with');
    await clearAllData();

    // clearAllData calls execAsync with DELETE statements
    expect(mockDatabase.execAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM blocked_calls')
    );
  });
});

describe('flushDB', () => {
  it('syncs only active rules to native', async () => {
    await addRule('+91140', 'Delhi', 'starts_with');
    const rule2 = await addRule('+91120', 'Noida', 'exact');
    await updateRuleActive(rule2.id, false);

    jest.clearAllMocks();
    await flushDB();

    expect(syncRules).toHaveBeenCalledTimes(1);
    const synced = JSON.parse((syncRules as jest.Mock).mock.calls[0][0]);
    expect(synced.length).toBe(1);
    expect(synced[0].pattern).toBe('+91140');
  });
});
