import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';
import { StatCard } from '@/components/StatCard';
import { BlockedCallItem } from '@/components/BlockedCallItem';

// Mock data — will be replaced with SQLite later
const MOCK_STATS = {
  totalBlocked: 147,
  blockedToday: 3,
  activeRules: 5,
};

const MOCK_RECENT_BLOCKS = [
  { phoneNumber: '+91 140-2839-4721', matchedPattern: '140*', timestamp: '2 min ago' },
  { phoneNumber: '+91 140-9182-6374', matchedPattern: '140*', timestamp: '1 hr ago' },
  { phoneNumber: '+91 1800-123-4567', matchedPattern: '1800*', timestamp: '3 hrs ago' },
  { phoneNumber: '+91 140-7291-8834', matchedPattern: '140*', timestamp: 'Yesterday' },
];

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
      showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>Hang Up</Text>
        <Text style={styles.tagline}>Your calls, your rules.</Text>
      </View>

      {/* Decorative divider */}
      <View style={styles.dividerContainer}>
        <View style={styles.divider} />
        <Text style={styles.dividerIcon}>✦</Text>
        <View style={styles.divider} />
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statPrimary}>
          <StatCard
            value={MOCK_STATS.totalBlocked}
            label="Calls Blocked"
            sublabel="All time"
            accent
          />
        </View>
        <View style={styles.statRow}>
          <View style={styles.statHalf}>
            <StatCard
              value={MOCK_STATS.blockedToday}
              label="Today"
            />
          </View>
          <View style={styles.statHalf}>
            <StatCard
              value={MOCK_STATS.activeRules}
              label="Active Rules"
            />
          </View>
        </View>
      </View>

      {/* Recent Blocks */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Blocks</Text>
          <Text style={styles.seeAll}>See All →</Text>
        </View>
        <View style={styles.recentCard}>
          {MOCK_RECENT_BLOCKS.map((block, index) => (
            <BlockedCallItem
              key={index}
              phoneNumber={block.phoneNumber}
              matchedPattern={block.matchedPattern}
              timestamp={block.timestamp}
            />
          ))}
        </View>
      </View>

      {/* Bottom padding */}
      <View style={{ height: Spacing.xxxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  content: {
    paddingHorizontal: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  appName: {
    fontFamily: FontFamily.displayBold,
    fontSize: 38,
    color: Colors.charcoal,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: FontFamily.displayItalic,
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.huge,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerIcon: {
    fontSize: 12,
    color: Colors.coral,
    marginHorizontal: Spacing.md,
  },
  statsGrid: {
    marginBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  statPrimary: {
    // Full width
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statHalf: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.displaySemiBold,
    fontSize: 20,
    color: Colors.charcoal,
  },
  seeAll: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.coral,
  },
  recentCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
});
