import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";
import { FontFamily } from "@/constants/fonts";

interface EmptyStateProps {
  icon: string;
  title: string;
  message: string;
}

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconBadge}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.massive,
    paddingHorizontal: Spacing.xxxl,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.coralPale,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  iconText: {
    fontFamily: FontFamily.displayBold,
    fontSize: 22,
    color: Colors.coral,
  },
  title: {
    fontFamily: FontFamily.displaySemiBold,
    fontSize: 20,
    color: Colors.charcoal,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  message: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});
