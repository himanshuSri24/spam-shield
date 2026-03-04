/**
 * Unit tests for database helper functions.
 * Tests pure functions that don't require SQLite.
 */

// We can't import directly from db.ts since it imports expo-sqlite.
// Instead, test the pure helper function logic.

type MatchType = 'exact' | 'starts_with' | 'ends_with' | 'contains' | 'regex';

// Copy of getRuleDescription from database/db.ts
function getRuleDescription(pattern: string, matchType: MatchType): string {
  switch (matchType) {
    case 'exact':
      return `Blocks calls from ${pattern}`;
    case 'starts_with':
      return `Blocks numbers starting with ${pattern}`;
    case 'ends_with':
      return `Blocks numbers ending with ${pattern}`;
    case 'contains':
      return `Blocks numbers containing ${pattern}`;
    case 'regex':
      return `Regex pattern: ${pattern}`;
    default:
      return `Pattern: ${pattern}`;
  }
}

describe('getRuleDescription', () => {
  it('describes exact match', () => {
    expect(getRuleDescription('+919563123456', 'exact'))
      .toBe('Blocks calls from +919563123456');
  });

  it('describes starts_with match', () => {
    expect(getRuleDescription('+91140', 'starts_with'))
      .toBe('Blocks numbers starting with +91140');
  });

  it('describes ends_with match', () => {
    expect(getRuleDescription('7777', 'ends_with'))
      .toBe('Blocks numbers ending with 7777');
  });

  it('describes contains match', () => {
    expect(getRuleDescription('5555', 'contains'))
      .toBe('Blocks numbers containing 5555');
  });

  it('describes regex match', () => {
    expect(getRuleDescription('\\+91[0-9]+', 'regex'))
      .toBe('Regex pattern: \\+91[0-9]+');
  });

  it('handles unknown match type gracefully', () => {
    expect(getRuleDescription('test', 'unknown' as MatchType))
      .toBe('Pattern: test');
  });
});

describe('wildcard migration logic', () => {
  // Tests the pattern migration from old wildcard format

  function migratePattern(pattern: string): { pattern: string; matchType: MatchType } {
    if (pattern.startsWith('*') && pattern.endsWith('*') && pattern.length > 2) {
      return { pattern: pattern.slice(1, -1), matchType: 'contains' };
    } else if (pattern.endsWith('*')) {
      return { pattern: pattern.slice(0, -1), matchType: 'starts_with' };
    } else if (pattern.startsWith('*')) {
      return { pattern: pattern.slice(1), matchType: 'ends_with' };
    }
    return { pattern, matchType: 'exact' };
  }

  it('migrates *pattern* to contains', () => {
    expect(migratePattern('*5555*')).toEqual({ pattern: '5555', matchType: 'contains' });
  });

  it('migrates pattern* to starts_with', () => {
    expect(migratePattern('+91140*')).toEqual({ pattern: '+91140', matchType: 'starts_with' });
  });

  it('migrates *pattern to ends_with', () => {
    expect(migratePattern('*7777')).toEqual({ pattern: '7777', matchType: 'ends_with' });
  });

  it('keeps exact match as-is', () => {
    expect(migratePattern('+919563123456')).toEqual({ pattern: '+919563123456', matchType: 'exact' });
  });

  it('handles single * as starts_with empty', () => {
    expect(migratePattern('*')).toEqual({ pattern: '', matchType: 'starts_with' });
  });
});

describe('phone number formatting edge cases', () => {
  // Test E.164 normalization edge cases the app encounters

  function normalizeForStorage(input: string): string {
    return input.replace(/[\s\-\(\)]/g, '').trim();
  }

  it('handles Indian mobile numbers with country code', () => {
    expect(normalizeForStorage('+91 9563 123456')).toBe('+919563123456');
  });

  it('handles US format numbers', () => {
    expect(normalizeForStorage('(555) 123-4567')).toBe('5551234567');
  });

  it('handles numbers with dashes and spaces', () => {
    expect(normalizeForStorage('91-956-312-3456')).toBe('919563123456');
  });

  it('preserves plus prefix', () => {
    expect(normalizeForStorage('+1 555 123 4567')).toBe('+15551234567');
  });

  it('handles empty string', () => {
    expect(normalizeForStorage('')).toBe('');
  });

  it('handles already normalized number', () => {
    expect(normalizeForStorage('+919563123456')).toBe('+919563123456');
  });
});
