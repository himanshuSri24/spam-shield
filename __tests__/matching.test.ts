/**
 * Unit tests for rule matching logic.
 * Tests the same algorithm used by both the JS testMatch and the Kotlin service.
 */

type MatchType = 'exact' | 'starts_with' | 'ends_with' | 'contains' | 'regex';

// Mirrors normalizeNumber from CallScreenerModule.kt
function normalizeNumber(number: string): string {
  return number.replace(/[\s\-\(\)]/g, '').trim();
}

// Mirrors the matching logic from SpamShieldCallScreeningService.kt
function matchesRule(
  phoneNumber: string,
  pattern: string,
  matchType: MatchType
): boolean {
  const normalizedNumber = normalizeNumber(phoneNumber);
  const normalizedPattern = normalizeNumber(pattern);

  switch (matchType) {
    case 'exact':
      return normalizedNumber === normalizedPattern;
    case 'starts_with':
      return normalizedNumber.startsWith(normalizedPattern);
    case 'ends_with':
      return normalizedNumber.endsWith(normalizedPattern);
    case 'contains':
      return normalizedNumber.includes(normalizedPattern);
    case 'regex':
      try {
        return new RegExp(pattern, 'i').test(normalizedNumber);
      } catch {
        return false;
      }
    default:
      return normalizedNumber.includes(normalizedPattern);
  }
}

describe('normalizeNumber', () => {
  it('strips spaces', () => {
    expect(normalizeNumber('+91 95631 23456')).toBe('+919563123456');
  });

  it('strips dashes', () => {
    expect(normalizeNumber('+91-9563-123456')).toBe('+919563123456');
  });

  it('strips parentheses', () => {
    expect(normalizeNumber('(091) 9563123456')).toBe('0919563123456');
  });

  it('preserves + prefix', () => {
    expect(normalizeNumber('+919563123456')).toBe('+919563123456');
  });

  it('handles empty string', () => {
    expect(normalizeNumber('')).toBe('');
  });

  it('handles already clean number', () => {
    expect(normalizeNumber('+919563123456')).toBe('+919563123456');
  });
});

describe('matchesRule - exact', () => {
  it('matches identical numbers', () => {
    expect(matchesRule('+919563123456', '+919563123456', 'exact')).toBe(true);
  });

  it('matches after normalization', () => {
    expect(matchesRule('+91 9563 123456', '+919563123456', 'exact')).toBe(true);
  });

  it('does not match different numbers', () => {
    expect(matchesRule('+919563123456', '+919563999999', 'exact')).toBe(false);
  });

  it('does not match partial numbers', () => {
    expect(matchesRule('+919563123456', '+91956312', 'exact')).toBe(false);
  });
});

describe('matchesRule - starts_with', () => {
  it('matches number starting with pattern', () => {
    expect(matchesRule('+919563123456', '+91956', 'starts_with')).toBe(true);
  });

  it('matches with country code prefix', () => {
    expect(matchesRule('+919563123456', '+91', 'starts_with')).toBe(true);
  });

  it('does not match when pattern is not a prefix', () => {
    expect(matchesRule('+919563123456', '9999', 'starts_with')).toBe(false);
  });

  it('does not match reversed', () => {
    expect(matchesRule('+91956', '+919563123456', 'starts_with')).toBe(false);
  });
});

describe('matchesRule - ends_with', () => {
  it('matches number ending with pattern', () => {
    expect(matchesRule('+919563123456', '3456', 'ends_with')).toBe(true);
  });

  it('does not match when pattern is not a suffix', () => {
    expect(matchesRule('+919563123456', '9999', 'ends_with')).toBe(false);
  });
});

describe('matchesRule - contains', () => {
  it('matches number containing pattern in middle', () => {
    expect(matchesRule('+919563123456', '56312', 'contains')).toBe(true);
  });

  it('matches at start', () => {
    expect(matchesRule('+919563123456', '+919', 'contains')).toBe(true);
  });

  it('matches at end', () => {
    expect(matchesRule('+919563123456', '3456', 'contains')).toBe(true);
  });

  it('does not match absent digits', () => {
    expect(matchesRule('+919563123456', '7777', 'contains')).toBe(false);
  });
});

describe('matchesRule - regex', () => {
  it('matches regex pattern', () => {
    expect(matchesRule('+919563123456', '\\+91956[0-9]+', 'regex')).toBe(true);
  });

  it('rejects non-matching regex', () => {
    expect(matchesRule('+919563123456', '^\\+44', 'regex')).toBe(false);
  });

  it('is case insensitive', () => {
    expect(matchesRule('+91ABC123', '[a-z]+', 'regex')).toBe(true);
  });

  it('handles invalid regex gracefully', () => {
    expect(matchesRule('+919563123456', '[invalid', 'regex')).toBe(false);
  });
});

describe('multiple rules matching', () => {
  interface Rule {
    id: number;
    pattern: string;
    match_type: MatchType;
  }

  function findMatchingRule(phoneNumber: string, rules: Rule[]): Rule | null {
    for (const rule of rules) {
      if (matchesRule(phoneNumber, rule.pattern, rule.match_type)) {
        return rule;
      }
    }
    return null;
  }

  const rules: Rule[] = [
    { id: 1, pattern: '+919563123456', match_type: 'exact' },
    { id: 2, pattern: '+91140', match_type: 'starts_with' },
    { id: 3, pattern: '7777', match_type: 'ends_with' },
    { id: 4, pattern: '5555', match_type: 'contains' },
  ];

  it('matches exact rule first', () => {
    const match = findMatchingRule('+919563123456', rules);
    expect(match?.id).toBe(1);
  });

  it('matches starts_with rule', () => {
    const match = findMatchingRule('+911401234567', rules);
    expect(match?.id).toBe(2);
  });

  it('matches ends_with rule', () => {
    const match = findMatchingRule('+910001237777', rules);
    expect(match?.id).toBe(3);
  });

  it('matches contains rule', () => {
    const match = findMatchingRule('+911235555678', rules);
    expect(match?.id).toBe(4);
  });

  it('returns null for no match', () => {
    const match = findMatchingRule('+440000000000', rules);
    expect(match).toBeNull();
  });
});
