import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';

interface StatCardProps {
  value: number;
  label: string;
  sublabel?: string;
  accent?: boolean;
}

export function StatCard({ value, label, sublabel, accent = false }: StatCardProps) {
  return (
    <View style={[styles.card, accent && styles.cardAccent]}>
      <Text style={[styles.value, accent && styles.valueAccent]}>
        {value.toLocaleString()}
      </Text>
      <Text style={[styles.label, accent && styles.labelAccent]}>{label}</Text>
      {sublabel && (
        <Text style={[styles.sublabel, accent && styles.sublabelAccent]}>
          {sublabel}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
  },
  cardAccent: {
    backgroundColor: Colors.coral,
    borderColor: Colors.coralDark,
  },
  value: {
    fontFamily: FontFamily.displayBold,
    fontSize: 42,
    color: Colors.charcoal,
    lineHeight: 48,
  },
  valueAccent: {
    color: Colors.white,
  },
  label: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  labelAccent: {
    color: 'rgba(255,255,255,0.85)',
  },
  sublabel: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sublabelAccent: {
    color: 'rgba(255,255,255,0.65)',
  },
});
