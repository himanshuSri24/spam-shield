import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';

interface StatCardProps {
  value: number;
  label: string;
  sublabel?: string;
  accent?: boolean;
  delay?: number;
  /** Change this value to re-trigger the entrance animation */
  animKey?: number;
}

export function StatCard({ value, label, sublabel, accent = false, delay = 0, animKey = 0 }: StatCardProps) {
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Reset to starting state then animate in
    scale.value = 0.92;
    opacity.value = 0;
    const timer = setTimeout(() => {
      scale.value = withSpring(1, { damping: 14, stiffness: 100 });
      opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) });
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, animKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.card, accent && styles.cardAccent, animatedStyle]}>
      <Text style={[styles.value, accent && styles.valueAccent]}>
        {value.toLocaleString()}
      </Text>
      <Text style={[styles.label, accent && styles.labelAccent]}>{label}</Text>
      {sublabel && (
        <Text style={[styles.sublabel, accent && styles.sublabelAccent]}>
          {sublabel}
        </Text>
      )}
    </Animated.View>
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
