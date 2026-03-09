// React hooks that wrap all the database queries.
// Each hook manages its own loading state and exposes a refresh() for manual re-fetching.

import {
  BlockedCall,
  MatchType,
  Rule,
  Stats,
  addRule as dbAddRule,
  deleteRule as dbDeleteRule,
  getBlockedCalls as dbGetBlockedCalls,
  getBlockedCountsByRule as dbGetBlockedCountsByRule,
  getRecentBlockedCalls as dbGetRecentBlockedCalls,
  getRuleById as dbGetRuleById,
  getStats as dbGetStats,
  updateRule as dbUpdateRule,
  updateRuleActive as dbUpdateRuleActive,
  getRules,
} from "@/database/db";
import { useCallback, useEffect, useState } from "react";

export function useRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getRules();
      setRules(data);
    } catch (error) {
      if (__DEV__) console.error("Failed to load rules:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addRule = useCallback(
    async (
      pattern: string,
      label: string,
      matchType: MatchType = "starts_with",
    ) => {
      const newRule = await dbAddRule(pattern, label, matchType);
      setRules((prev) => [newRule, ...prev]);
      return newRule;
    },
    [],
  );

  const updateRule = useCallback(
    async (
      id: number,
      pattern: string,
      label: string,
      matchType: MatchType,
    ) => {
      await dbUpdateRule(id, pattern, label, matchType);
      setRules((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, pattern, label, match_type: matchType } : r,
        ),
      );
    },
    [],
  );

  const toggleRule = useCallback(async (id: number, isActive: boolean) => {
    await dbUpdateRuleActive(id, isActive);
    setRules((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, is_active: isActive ? 1 : 0 } : r,
      ),
    );
  }, []);

  const removeRule = useCallback(async (id: number) => {
    await dbDeleteRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return {
    rules,
    loading,
    refresh,
    addRule,
    updateRule,
    toggleRule,
    removeRule,
  };
}

export function useBlockedCalls(limit: number = 50) {
  const [calls, setCalls] = useState<BlockedCall[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await dbGetBlockedCalls(limit);
      setCalls(data);
    } catch (error) {
      if (__DEV__) console.error("Failed to load blocked calls:", error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { calls, loading, refresh };
}

export function useRecentBlocks() {
  const [calls, setCalls] = useState<BlockedCall[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await dbGetRecentBlockedCalls(5);
      setCalls(data);
    } catch (error) {
      if (__DEV__) console.error("Failed to load recent blocks:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { calls, loading, refresh };
}

export function useStats() {
  const [stats, setStats] = useState<Stats>({
    totalBlocked: 0,
    blockedToday: 0,
    blockedThisWeek: 0,
    activeRules: 0,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await dbGetStats();
      setStats(data);
    } catch (error) {
      if (__DEV__) console.error("Failed to load stats:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, refresh };
}

export function useRuleBlockedCounts() {
  const [counts, setCounts] = useState<Record<number, number>>({});

  const refresh = useCallback(async () => {
    try {
      const data = await dbGetBlockedCountsByRule();
      setCounts(data);
    } catch (error) {
      if (__DEV__) console.error("Failed to load blocked counts:", error);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { counts, refresh };
}

export { dbGetRuleById as getRuleById };
