import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';

interface RuleCardProps {
  pattern: string;
  label: string;
  isActive: boolean;
  blockedCount: number;
  onToggle: (value: boolean) => void;
  onPress: () => void;
}

export function RuleCard({ pattern, label, isActive, blockedCount, onToggle, onPress }: RuleCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, !isActive && styles.cardInactive]}
      onPress={onPress}
      activeOpacity={0.7}>
      <View style={styles.left}>
        <View style={[styles.patternBadge, !isActive && styles.patternBadgeInactive]}>
          <Text style={[styles.patternText, !isActive && styles.patternTextInactive]}>
            {pattern}
          </Text>
        </View>
        <Text style={[styles.label, !isActive && styles.labelInactive]}>{label}</Text>
        <Text style={styles.blockedCount}>
          {blockedCount} call{blockedCount !== 1 ? 's' : ''} blocked
        </Text>
      </View>
      <Switch
        value={isActive}
        onValueChange={onToggle}
        trackColor={{ false: Colors.borderDark, true: Colors.coralPale }}
        thumbColor={isActive ? Colors.coral : Colors.textLight}
        ios_backgroundColor={Colors.borderDark}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardInactive: {
    opacity: 0.6,
  },
  left: {
    flex: 1,
    marginRight: Spacing.md,
  },
  patternBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.coralPale,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  patternBadgeInactive: {
    backgroundColor: Colors.borderLight,
  },
  patternText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 14,
    color: Colors.coralDark,
    letterSpacing: 0.5,
  },
  patternTextInactive: {
    color: Colors.textMuted,
  },
  label: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  labelInactive: {
    color: Colors.textMuted,
  },
  blockedCount: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: Colors.textMuted,
  },
});
