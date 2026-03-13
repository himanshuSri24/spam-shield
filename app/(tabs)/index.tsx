import { AppLogo } from "@/components/AppLogo";
import { BlockedCallItem } from "@/components/BlockedCallItem";
import { StatCard } from "@/components/StatCard";
import { FontFamily } from "@/constants/fonts";
import { BorderRadius, Colors, Spacing } from "@/constants/theme";
import { drainPendingBlockedCalls, flushDB } from "@/database/db";
import { useRecentBlocks, useStats } from "@/hooks/useDatabase";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  isScreeningEnabled,
  openScreeningSettings,
  requestScreeningRole,
} from "../../modules/call-screener";

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHrs < 24) return `${diffHrs} hr${diffHrs > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { stats, refresh: refreshStats } = useStats();
  const { calls: recentBlocks, refresh: refreshRecent } = useRecentBlocks();
  const [screeningActive, setScreeningActive] = useState(true);
  const [enablingScreening, setEnablingScreening] = useState(false);
  const waitingForRole = useRef(false);

  // When user returns from system dialog, check role status
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && waitingForRole.current) {
        waitingForRole.current = false;
        setEnablingScreening(false);
        isScreeningEnabled()
          .then((enabled) => setScreeningActive(enabled))
          .catch(() => {});
      }
    });
    return () => subscription.remove();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      drainPendingBlockedCalls()
        .then((count) => {
          if (count > 0) {
            refreshStats();
            refreshRecent();
          }
        })
        .catch(() => {});
      refreshStats();
      refreshRecent();
      flushDB().catch(() => {});
      isScreeningEnabled()
        .then((enabled) => setScreeningActive(enabled))
        .catch(() => {});
    }, [refreshStats, refreshRecent]),
  );

  const handleEnableScreening = async () => {
    setEnablingScreening(true);
    try {
      const result = await requestScreeningRole();
      if (result === "already_active") {
        setScreeningActive(true);
        setEnablingScreening(false);
        return;
      }
      // System dialog opened — AppState listener will handle the result
      waitingForRole.current = true;
    } catch {
      try {
        await openScreeningSettings();
      } catch {}
      waitingForRole.current = true;
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.lg },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ width: 36 }} />
          <View style={styles.brandWrap}>
            <AppLogo size={30} />
            <Text style={styles.appName}>Spam Shield</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            style={styles.settingsButton}
            activeOpacity={0.7}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.tagline}>Your calls, your rules.</Text>
      </View>

      {/* Screening disabled warning */}
      {!screeningActive && (
        <View>
          <TouchableOpacity
            style={styles.warningBanner}
            onPress={handleEnableScreening}
            disabled={enablingScreening}
            activeOpacity={0.8}
          >
            {enablingScreening ? (
              <>
                <ActivityIndicator size="small" color="#92400E" />
                <Text style={[styles.warningText, { marginTop: Spacing.xs }]}>
                  Opening settings...
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.warningText}>
                  Call screening is disabled. Calls won't be blocked.
                </Text>
                <Text style={styles.warningAction}>Tap to enable</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
          />
        </View>
        <View style={styles.statRow}>
          <View style={styles.statHalf}>
            <StatCard value={stats.blockedToday} label="Today" />
          </View>
          <View style={styles.statHalf}>
            <StatCard value={stats.activeRules} label="Active Rules" />
          </View>
        </View>
      </View>

      {/* Recent Blocks */}
      {recentBlocks.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Blocks</Text>
          </View>
          <View style={styles.recentCard}>
            {recentBlocks.map((block) => (
              <BlockedCallItem
                key={block.id}
                phoneNumber={block.phone_number}
                matchedPattern={block.matched_pattern ?? "Unknown rule"}
                timestamp={formatTimestamp(block.blocked_at)}
              />
            ))}
          </View>
        </View>
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
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  settingsButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    alignItems: "center",
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
    flexDirection: "row",
    gap: Spacing.md,
  },
  statHalf: {
    flex: 1,
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    overflow: "hidden",
  },
  warningBanner: {
    backgroundColor: "#FEF3C7",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "#F59E0B",
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    alignItems: "center",
  },
  warningText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: "#92400E",
    textAlign: "center",
  },
  warningAction: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: "#D97706",
    marginTop: Spacing.xs,
  },
});
