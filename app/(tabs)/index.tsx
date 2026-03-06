import React, { useState, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';
import { StatCard } from '@/components/StatCard';
import { BlockedCallItem } from '@/components/BlockedCallItem';
import { useStats, useRecentBlocks } from '@/hooks/useDatabase';
import { flushDB, drainPendingBlockedCalls } from '@/database/db';

let CallScreener: any = null;
try {
  CallScreener = require('../../modules/call-screener');
} catch (e: any) {
  // Native module not available (e.g. Expo Go)
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHrs < 24) return `${diffHrs} hr${diffHrs > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { stats, refresh: refreshStats } = useStats();
  const { calls: recentBlocks, refresh: refreshRecent } = useRecentBlocks();
  const [screeningActive, setScreeningActive] = useState(true);
  const animKey = useRef(0);

  // Focus-driven fade/slide animations
  const headerOpacity = useSharedValue(0);
  const headerTranslateY = useSharedValue(18);
  const recentOpacity = useSharedValue(0);
  const recentTranslateY = useSharedValue(18);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }));
  const recentStyle = useAnimatedStyle(() => ({
    opacity: recentOpacity.value,
    transform: [{ translateY: recentTranslateY.value }],
  }));

  // Refresh data and check screening status whenever screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Trigger animations
      animKey.current += 1;
      headerOpacity.value = 0;
      headerTranslateY.value = 18;
      recentOpacity.value = 0;
      recentTranslateY.value = 18;
      headerOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) });
      headerTranslateY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.quad) });
      recentOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));
      recentTranslateY.value = withDelay(500, withTiming(0, { duration: 400 }));

      // Drain any blocked calls queued by the native screening service
      drainPendingBlockedCalls().then((count) => {
        if (count > 0) {
          refreshStats();
          refreshRecent();
        }
      }).catch(() => {});
      refreshStats();
      refreshRecent();
      // Re-sync rules to SharedPreferences on every focus
      flushDB().catch(() => {});
      // Check if call screening role is still held
      if (CallScreener) {
        CallScreener.isScreeningEnabled()
          .then((enabled: boolean) => setScreeningActive(enabled))
          .catch(() => {});
      }
    }, [refreshStats, refreshRecent])
  );

  const handleEnableScreening = async () => {
    if (!CallScreener) return;
    try {
      const result = await CallScreener.requestScreeningRole();
      if (result === 'already_active') {
        setScreeningActive(true);
        return;
      }
      // Poll briefly for the system dialog result
      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 800));
        const enabled = await CallScreener.isScreeningEnabled();
        if (enabled) { setScreeningActive(true); return; }
      }
      // System dialog likely didn't appear (MIUI/HyperOS) — open settings directly
      try { await CallScreener.openScreeningSettings(); } catch {}
    } catch (e) {
      try { await CallScreener.openScreeningSettings(); } catch {}
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
      showsVerticalScrollIndicator={false}>

      {/* Header */}
      <Animated.View style={[styles.header, headerStyle]}>
        <View style={styles.headerTop}>
          <View style={{ width: 36 }} />
          <Text style={styles.appName}>Hang Up</Text>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
            activeOpacity={0.7}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.tagline}>Your calls, your rules.</Text>
      </Animated.View>

      {/* Screening disabled warning */}
      {!screeningActive && (
        <Animated.View style={headerStyle}>
          <TouchableOpacity
            style={styles.warningBanner}
            onPress={handleEnableScreening}
            activeOpacity={0.8}>
            <Text style={styles.warningText}>
              ⚠ Call screening is disabled — calls won't be blocked.
            </Text>
            <Text style={styles.warningAction}>Tap to enable</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

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
            value={stats.totalBlocked}
            label="Calls Blocked"
            sublabel="All time"
            accent
            delay={200}
            animKey={animKey.current}
          />
        </View>
        <View style={styles.statRow}>
          <View style={styles.statHalf}>
            <StatCard
              value={stats.blockedToday}
              label="Today"
              delay={350}
              animKey={animKey.current}
            />
          </View>
          <View style={styles.statHalf}>
            <StatCard
              value={stats.activeRules}
              label="Active Rules"
              delay={500}
              animKey={animKey.current}
            />
          </View>
        </View>
      </View>

      {/* Recent Blocks */}
      {recentBlocks.length > 0 && (
        <Animated.View style={[styles.section, recentStyle]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Blocks</Text>
          </View>
          <View style={styles.recentCard}>
            {recentBlocks.map((block) => (
              <BlockedCallItem
                key={block.id}
                phoneNumber={block.phone_number}
                matchedPattern={block.matched_pattern ?? 'Unknown rule'}
                timestamp={formatTimestamp(block.blocked_at)}
              />
            ))}
          </View>
        </Animated.View>
      )}

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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  settingsButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 22,
    color: Colors.textMuted,
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
  recentCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  warningBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#F59E0B',
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  warningText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: '#92400E',
    textAlign: 'center',
  },
  warningAction: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: '#D97706',
    marginTop: Spacing.xs,
  },
});
