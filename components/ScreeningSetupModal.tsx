import { FontFamily } from "@/constants/fonts";
import { BorderRadius, Colors, Spacing } from "@/constants/theme";
import { openScreeningSettings } from "@/modules/call-screener";
import React from "react";
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Segment = { text: string; bold?: boolean };
type Step = { num: string; segments: Segment[] };

const STEPS: Step[] = [
  {
    num: "1",
    segments: [
      { text: "Open the " },
      { text: "Settings", bold: true },
      { text: " app on your phone" },
    ],
  },
  {
    num: "2",
    segments: [
      { text: "Tap " },
      { text: "Apps", bold: true },
      { text: " → " },
      { text: "Default apps", bold: true },
    ],
  },
  {
    num: "3",
    segments: [
      { text: "Tap " },
      { text: "Caller ID & spam app", bold: true },
    ],
  },
  {
    num: "4",
    segments: [{ text: "Select " }, { text: "Spam Shield", bold: true }],
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ScreeningSetupModal({ visible, onClose }: Props) {
  const handleOpenSettings = async () => {
    try {
      await openScreeningSettings();
    } catch {
      // Native module failed — fall back to generic device settings
      try {
        await Linking.openSettings();
      } catch {
        // Nothing more we can do
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <Text style={styles.iconText}>!</Text>
          </View>

          <Text style={styles.title}>Enable Call{"\n"}Screening</Text>

          <Text style={styles.subtitle}>
            Your device needs manual setup.{"\n"}Follow these steps in
            Settings:
          </Text>

          <View style={styles.steps}>
            {STEPS.map((step) => (
              <View key={step.num} style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNum}>{step.num}</Text>
                </View>
                <Text style={styles.stepText}>
                  {step.segments.map((seg, i) =>
                    seg.bold ? (
                      <Text key={i} style={styles.stepBold}>
                        {seg.text}
                      </Text>
                    ) : (
                      seg.text
                    ),
                  )}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.note}>Steps may vary slightly on your device.</Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleOpenSettings}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>Open Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>{"I'll do it later"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.cream,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.coralPale,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  iconText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 24,
    color: Colors.coral,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 26,
    color: Colors.charcoal,
    textAlign: "center",
    lineHeight: 32,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  steps: {
    alignSelf: "stretch",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.coral,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNum: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    color: Colors.white,
  },
  stepText: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    color: Colors.charcoal,
    lineHeight: 22,
    flex: 1,
  },
  stepBold: {
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.charcoal,
  },
  note: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    marginBottom: Spacing.xl,
    fontStyle: "italic",
  },
  primaryBtn: {
    backgroundColor: Colors.coral,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
    alignSelf: "stretch",
    marginBottom: Spacing.sm,
  },
  primaryBtnText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    color: Colors.white,
  },
  secondaryBtn: {
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    color: Colors.textMuted,
  },
});
