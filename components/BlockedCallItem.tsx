import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';

interface BlockedCallItemProps {
  phoneNumber: string;
  matchedPattern: string;
  timestamp: string;
}

export function BlockedCallItem({ phoneNumber, matchedPattern, timestamp }: BlockedCallItemProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>✕</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.phoneNumber}>{phoneNumber}</Text>
        <Text style={styles.pattern}>Matched: {matchedPattern}</Text>
      </View>
      <Text style={styles.timestamp}>{timestamp}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.coralPale,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  icon: {
    fontSize: 14,
    color: Colors.coral,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  phoneNumber: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  pattern: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  timestamp: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: Colors.textMuted,
  },
});
