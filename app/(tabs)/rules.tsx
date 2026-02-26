import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';
import { RuleCard } from '@/components/RuleCard';
import { EmptyState } from '@/components/EmptyState';
import { useRules } from '@/hooks/useDatabase';

export default function RulesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { rules, refresh, toggleRule, removeRule } = useRules();

  // Refresh when screen comes into focus (e.g., after adding a new rule)
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  const activeCount = rules.filter(r => r.is_active === 1).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Block Rules</Text>
        <Text style={styles.subtitle}>
          {activeCount} active rule{activeCount !== 1 ? 's' : ''}
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
          rules.map(rule => (
            <RuleCard
              key={rule.id}
              pattern={rule.pattern}
              label={rule.label}
              isActive={rule.is_active === 1}
              blockedCount={0}
              onToggle={(value) => toggleRule(rule.id, value)}
              onDelete={() => removeRule(rule.id)}
            />
          ))
        )}
      </ScrollView>

      {/* FAB — Add Rule */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        activeOpacity={0.8}
        onPress={() => router.push('/add-rule')}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
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
