import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';
import { RuleCard } from '@/components/RuleCard';
import { EmptyState } from '@/components/EmptyState';

// Mock data — will be replaced with SQLite later
const MOCK_RULES = [
  { id: 1, pattern: '140*', label: 'Telemarketer (140)', isActive: true, blockedCount: 89 },
  { id: 2, pattern: '1800*', label: 'Toll-free spam', isActive: true, blockedCount: 34 },
  { id: 3, pattern: '120*', label: 'Service calls (120)', isActive: false, blockedCount: 12 },
  { id: 4, pattern: '+91 78*', label: 'Unknown 78 prefix', isActive: true, blockedCount: 7 },
  { id: 5, pattern: '160*', label: 'Marketing (160)', isActive: true, blockedCount: 5 },
];

export default function RulesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [rules, setRules] = useState(MOCK_RULES);

  const handleToggle = (id: number, value: boolean) => {
    setRules(prev =>
      prev.map(rule =>
        rule.id === id ? { ...rule, isActive: value } : rule
      )
    );
  };

  const activeCount = rules.filter(r => r.isActive).length;

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
              isActive={rule.isActive}
              blockedCount={rule.blockedCount}
              onToggle={(value) => handleToggle(rule.id, value)}
              onPress={() => {}}
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
