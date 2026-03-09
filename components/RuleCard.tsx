import { FontFamily } from "@/constants/fonts";
import { BorderRadius, Colors, Spacing } from "@/constants/theme";
import { MatchType } from "@/database/db";
import React, { useRef } from "react";
import {
  Animated,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";

interface RuleCardProps {
  id: number;
  pattern: string;
  label: string;
  matchType: MatchType;
  isActive: boolean;
  blockedCount: number;
  onToggle: (value: boolean) => void;
  onDelete: () => void;
  onEdit: () => void;
}

const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  exact: "Exact",
  starts_with: "Starts with",
  ends_with: "Ends with",
  contains: "Contains",
  regex: "Regex",
};

export function RuleCard({
  id,
  pattern,
  label,
  matchType,
  isActive,
  blockedCount,
  onToggle,
  onDelete,
  onEdit,
}: RuleCardProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const handleDelete = () => {
    swipeableRef.current?.close();
    onDelete();
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: "clamp",
    });

    const opacity = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    return (
      <Animated.View
        style={[styles.deleteAction, { transform: [{ translateX }], opacity }]}
      >
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          activeOpacity={0.8}
        >
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      friction={2}
    >
      <TouchableOpacity
        style={[styles.card, !isActive && styles.cardInactive]}
        onPress={onEdit}
        activeOpacity={0.7}
      >
        <View style={styles.left}>
          <View style={styles.topRow}>
            <View
              style={[
                styles.matchTypeBadge,
                !isActive && styles.matchTypeBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.matchTypeText,
                  !isActive && styles.matchTypeTextInactive,
                ]}
              >
                {MATCH_TYPE_LABELS[matchType] ?? matchType}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.patternBadge,
              !isActive && styles.patternBadgeInactive,
            ]}
          >
            <Text
              style={[
                styles.patternText,
                !isActive && styles.patternTextInactive,
              ]}
            >
              {pattern}
            </Text>
          </View>
          {label ? (
            <Text style={[styles.label, !isActive && styles.labelInactive]}>
              {label}
            </Text>
          ) : null}
          <Text style={styles.blockedCount}>
            {blockedCount} call{blockedCount !== 1 ? "s" : ""} blocked
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
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  matchTypeBadge: {
    backgroundColor: Colors.sagePale,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  matchTypeBadgeInactive: {
    backgroundColor: Colors.borderLight,
  },
  matchTypeText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: Colors.sage,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  matchTypeTextInactive: {
    color: Colors.textMuted,
  },
  patternBadge: {
    alignSelf: "flex-start",
    backgroundColor: Colors.coralPale,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
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
  // Swipe delete action
  deleteAction: {
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
    marginLeft: -Spacing.sm,
  },
  deleteButton: {
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    minWidth: 72,
  },
  deleteText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.white,
  },
});
