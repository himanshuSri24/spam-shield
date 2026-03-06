import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeOutUp, LinearTransition, useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';
import { RuleCard } from '@/components/RuleCard';
import { EmptyState } from '@/components/EmptyState';
import { useRules, useRuleBlockedCounts } from '@/hooks/useDatabase';
import { drainPendingBlockedCalls } from '@/database/db';

/** Wrapper that re-triggers a staggered fade-in on every focus */
function RuleCardAnimated({ children, index, focusCount }: { children: React.ReactNode; index: number; focusCount: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);

  React.useEffect(() => {
    opacity.value = 0;
    translateY.value = 14;
    opacity.value = withDelay(index * 50, withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) }));
    translateY.value = withDelay(index * 50, withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) }));
  }, [focusCount]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      exiting={FadeOutUp.duration(250)}
      layout={LinearTransition.springify().damping(16)}
      style={animStyle}>
      {children}
    </Animated.View>
  );
}

export default function RulesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { rules, refresh, toggleRule, removeRule } = useRules();
  const { counts: blockedCounts, refresh: refreshCounts } = useRuleBlockedCounts();
  const [focusCount, setFocusCount] = React.useState(0);

  // Focus-driven FAB animation
  const fabOpacity = useSharedValue(0);
  const fabScale = useSharedValue(0.7);
  const fabStyle = useAnimatedStyle(() => ({
    opacity: fabOpacity.value,
    transform: [{ scale: fabScale.value }],
  }));

  // Refresh when screen comes into focus (e.g., after adding a new rule)
  useFocusEffect(
    React.useCallback(() => {
      setFocusCount(c => c + 1);
      fabOpacity.value = 0;
      fabScale.value = 0.7;
      fabOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));
      fabScale.value = withDelay(200, withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.5)) }));

      drainPendingBlockedCalls().then((count) => {
        if (count > 0) refreshCounts();
      }).catch(() => {});
      refresh();
      refreshCounts();
    }, [refresh, refreshCounts])
  );

  const activeCount = rules.filter(r => r.is_active === 1).length;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Block Rules</Text>
          <Text style={styles.subtitle}>
            {activeCount} active rule{activeCount !== 1 ? 's' : ''} · Swipe to delete · Tap to edit
          </Text>
        </View>

        {/* Decorative accent bar */}
        <View style={styles.accentBar} />

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}>

          {rules.length === 0 ? (
            <EmptyState
              icon="🛡️"
              title="No rules yet"
              message="Add your first blocking rule to start filtering unwanted calls."
            />
          ) : (
            rules.map((rule, index) => (
              <RuleCardAnimated
                key={rule.id}
                index={index}
                focusCount={focusCount}>
                <RuleCard
                  id={rule.id}
                  pattern={rule.pattern}
                  label={rule.label}
                  matchType={rule.match_type}
                  isActive={rule.is_active === 1}
                  blockedCount={blockedCounts[rule.id] ?? 0}
                  onToggle={(value) => toggleRule(rule.id, value)}
                  onDelete={() => removeRule(rule.id)}
                  onEdit={() => router.push(`/add-rule?ruleId=${rule.id}`)}
                />
              </RuleCardAnimated>
            ))
          )}
        </ScrollView>

        {/* FAB — Add Rule */}
        <Animated.View style={[styles.fab, { bottom: insets.bottom + 20 }, fabStyle]}>
          <TouchableOpacity
            style={styles.fabInner}
            activeOpacity={0.8}
            onPress={() => router.push('/add-rule')}>
            <Text style={styles.fabIcon}>+</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 32,
    color: Colors.charcoal,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  accentBar: {
    height: 3,
    backgroundColor: Colors.coral,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    borderRadius: 2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  fab: {
    position: 'absolute',
    right: Spacing.xl,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.coral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: {
    fontSize: 28,
    color: Colors.white,
    fontWeight: '300',
    marginTop: -2,
  },
});
