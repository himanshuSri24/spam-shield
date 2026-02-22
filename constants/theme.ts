/**
 * Hang Up — Design Tokens
 *
 * Retro pastel theme inspired by editorial design.
 * Warm cream backgrounds, coral accents, clean typography.
 */

export const Colors = {
  // Backgrounds
  cream: '#FFF5EC',
  creamDark: '#F5EBE0',
  white: '#FFFFFF',
  cardBg: '#FFFBF7',

  // Primary accent — coral/red-orange
  coral: '#D4613A',
  coralLight: '#E8845F',
  coralPale: '#FFE5D9',
  coralDark: '#B84E2B',

  // Secondary — muted sage/olive
  sage: '#8B9A7E',
  sagePale: '#E8EDE4',

  // Neutral text
  charcoal: '#2D2D2D',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted: '#9B9B9B',
  textLight: '#B8B8B8',

  // Borders & dividers
  border: '#E8DDD3',
  borderLight: '#F0E8DF',
  borderDark: '#D4C8BC',

  // Status
  success: '#5B8A5A',
  successPale: '#E4F0E4',
  error: '#C44B4B',
  errorPale: '#FCE8E8',

  // Tab bar
  tabActive: '#D4613A',
  tabInactive: '#9B9B9B',
  tabBarBg: '#FFF5EC',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  massive: 64,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  round: 999,
};

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardLifted: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
};

export const Typography = {
  // Headers — will use Playfair Display when fonts loaded
  displayLarge: {
    fontSize: 36,
    fontWeight: '700' as const,
    lineHeight: 42,
    letterSpacing: -0.5,
    color: Colors.charcoal,
  },
  displayMedium: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: Colors.charcoal,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 28,
    color: Colors.charcoal,
  },
  subheading: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: Colors.textPrimary,
  },

  // Body
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: Colors.textPrimary,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  caption: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 14,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },

  // Numbers — for stats
  statLarge: {
    fontSize: 48,
    fontWeight: '700' as const,
    lineHeight: 52,
    color: Colors.charcoal,
  },
  statMedium: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 32,
    color: Colors.charcoal,
  },

  // Interactive
  button: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 20,
    letterSpacing: 0.3,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 14,
  },
};
