import { FontFamily } from "@/constants/fonts";
import { BorderRadius, Colors, Spacing } from "@/constants/theme";
import {
  addRule as dbAddRule,
  updateRule as dbUpdateRule,
  getRuleById,
  getRuleDescription,
  MatchType,
} from "@/database/db";
import * as Localization from "expo-localization";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MATCH_TYPES: { type: MatchType; label: string; hint: string }[] = [
  {
    type: "exact",
    label: "Exact Number",
    hint: "Blocks this exact number only",
  },
  {
    type: "starts_with",
    label: "Starts With",
    hint: "Blocks numbers starting with these digits",
  },
  {
    type: "ends_with",
    label: "Ends With",
    hint: "Blocks numbers ending with these digits",
  },
  {
    type: "contains",
    label: "Contains",
    hint: "Blocks numbers containing these digits",
  },
  {
    type: "regex",
    label: "Regex",
    hint: "Advanced: blocks numbers matching a regular expression",
  },
];

const PRESETS = [
  {
    pattern: "+91140",
    matchType: "starts_with" as MatchType,
    label: "Telemarketers (+91140)",
  },
  {
    pattern: "+911800",
    matchType: "starts_with" as MatchType,
    label: "Toll-free spam (+911800)",
  },
  {
    pattern: "+91120",
    matchType: "starts_with" as MatchType,
    label: "Service calls (+91120)",
  },
  {
    pattern: "+91160",
    matchType: "starts_with" as MatchType,
    label: "Marketing (+91160)",
  },
];

export default function AddRuleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ ruleId?: string }>();

  const isEditing = !!params.ruleId;
  const editId = params.ruleId ? parseInt(params.ruleId, 10) : null;

  const [pattern, setPattern] = useState("");
  const [label, setLabel] = useState("");
  const [matchType, setMatchType] = useState<MatchType>("starts_with");
  const [loadingRule, setLoadingRule] = useState(isEditing);

  // Load existing rule data when editing
  useEffect(() => {
    if (editId) {
      (async () => {
        try {
          const rule = await getRuleById(editId);
          if (rule) {
            setPattern(rule.pattern);
            setLabel(rule.label);
            setMatchType(rule.match_type);
          }
        } catch (e) {
          if (__DEV__) console.error("Failed to load rule for editing:", e);
        } finally {
          setLoadingRule(false);
        }
      })();
    }
  }, [editId]);

  const previewDescription = useMemo(() => {
    if (!pattern.trim()) return "";
    return getRuleDescription(pattern.trim(), matchType);
  }, [pattern, matchType]);

  const handlePresetSelect = (preset: (typeof PRESETS)[number]) => {
    setPattern(preset.pattern);
    setLabel(preset.label);
    setMatchType(preset.matchType);
  };

  const handleSave = async () => {
    if (!isValid) return;
    try {
      let cleanedPattern = pattern.trim();

      // For exact match, normalize to E.164 format (+919563123456) so it
      // matches what Android passes to the screening service. If the user
      // types something weird that can't be parsed, just strip formatting.
      if (matchType === "exact") {
        const regionCodes = Localization.getLocales();
        const defaultRegion = (
          regionCodes.length > 0 && regionCodes[0].regionCode
            ? regionCodes[0].regionCode
            : "IN"
        ) as CountryCode;
        const phoneNumber = parsePhoneNumberFromString(
          cleanedPattern,
          defaultRegion,
        );
        if (phoneNumber && phoneNumber.isValid()) {
          cleanedPattern = phoneNumber.number as string;
        } else {
          cleanedPattern = cleanedPattern.replace(/[\s\-\(\)]/g, "");
        }
      }

      const cleanedLabel = label.trim();

      if (isEditing && editId) {
        await dbUpdateRule(editId, cleanedPattern, cleanedLabel, matchType);
      } else {
        await dbAddRule(cleanedPattern, cleanedLabel, matchType);
      }
      router.back();
    } catch (error) {
      if (__DEV__) console.error("Failed to save rule:", error);
      Alert.alert("Error", "Failed to save rule. Please try again.");
    }
  };

  const isValid = pattern.trim().length > 0;

  if (loadingRule) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading rule…</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.inner, { paddingTop: insets.top + Spacing.md }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {isEditing ? "Edit Rule" : "New Rule"}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isValid}
            style={[styles.saveButton, !isValid && styles.saveButtonDisabled]}
          >
            <Text
              style={[styles.saveText, !isValid && styles.saveTextDisabled]}
            >
              {isEditing ? "Update" : "Save"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Accent bar */}
        <View style={styles.accentBar} />

        <ScrollView
          style={styles.form}
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Match Type Selector */}
          <View style={styles.matchTypeSection}>
            <Text style={styles.inputLabel}>MATCH TYPE</Text>
            <View style={styles.matchTypeGrid}>
              {MATCH_TYPES.map((mt) => (
                <TouchableOpacity
                  key={mt.type}
                  style={[
                    styles.matchTypeCard,
                    matchType === mt.type && styles.matchTypeCardActive,
                  ]}
                  onPress={() => setMatchType(mt.type)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.matchTypeLabel,
                      matchType === mt.type && styles.matchTypeLabelActive,
                    ]}
                  >
                    {mt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {matchType && (
              <Text style={styles.matchTypeHint}>
                {MATCH_TYPES.find((mt) => mt.type === matchType)?.hint}
              </Text>
            )}
          </View>

          {/* Pattern Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {matchType === "regex"
                ? "REGEX PATTERN"
                : "PHONE NUMBER / DIGITS"}
            </Text>
            <TextInput
              style={styles.input}
              value={pattern}
              onChangeText={setPattern}
              placeholder={
                matchType === "regex"
                  ? "e.g. \\+91956[0-9]+"
                  : matchType === "exact"
                    ? "e.g. +919563123456"
                    : "e.g. +919563 or 9563"
              }
              placeholderTextColor={Colors.textLight}
              autoFocus={!isEditing}
              keyboardType={matchType === "regex" ? "default" : "phone-pad"}
            />
            <Text style={styles.hint}>
              {matchType === "regex"
                ? "Enter a regular expression pattern. Use this for complex matching rules."
                : matchType === "exact"
                  ? "Enter the full phone number to block (including country code if needed)."
                  : matchType === "starts_with"
                    ? "Enter the digits that blocked numbers should start with. Include + and country code for international numbers."
                    : matchType === "ends_with"
                      ? "Enter the digits that blocked numbers should end with."
                      : "Enter digits that appear anywhere in the number."}
            </Text>
          </View>

          {/* Preview */}
          {previewDescription ? (
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>WILL DO</Text>
              <Text style={styles.previewDescription}>
                {previewDescription}
              </Text>
              {matchType === "starts_with" && pattern.trim() && (
                <View style={styles.previewExamples}>
                  <Text style={styles.previewExampleLabel}>EXAMPLES</Text>
                  <Text style={styles.previewExample}>
                    ✓ {pattern.trim()}1234567 → blocked
                  </Text>
                  <Text style={styles.previewExample}>
                    ✓ {pattern.trim()}9999999 → blocked
                  </Text>
                  <Text style={styles.previewExampleBlocked}>
                    ✗ Other numbers → allowed
                  </Text>
                </View>
              )}
              {matchType === "ends_with" && pattern.trim() && (
                <View style={styles.previewExamples}>
                  <Text style={styles.previewExampleLabel}>EXAMPLES</Text>
                  <Text style={styles.previewExample}>
                    ✓ +91XXXX{pattern.trim()} → blocked
                  </Text>
                  <Text style={styles.previewExampleBlocked}>
                    ✗ Numbers not ending with {pattern.trim()} → allowed
                  </Text>
                </View>
              )}
              {matchType === "contains" && pattern.trim() && (
                <View style={styles.previewExamples}>
                  <Text style={styles.previewExampleLabel}>EXAMPLES</Text>
                  <Text style={styles.previewExample}>
                    ✓ Any number containing {pattern.trim()} → blocked
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Label Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>LABEL (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Telemarketer calls"
              placeholderTextColor={Colors.textLight}
            />
          </View>

          {/* Preset Patterns (not when editing or using regex) */}
          {matchType !== "regex" && !isEditing && (
            <View style={styles.presetsSection}>
              <Text style={styles.presetsTitle}>Quick Presets</Text>
              <View style={styles.presetsList}>
                {PRESETS.map((preset, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.presetChip,
                      pattern === preset.pattern &&
                        matchType === preset.matchType &&
                        styles.presetChipActive,
                    ]}
                    onPress={() => handlePresetSelect(preset)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        pattern === preset.pattern &&
                          matchType === preset.matchType &&
                          styles.presetChipTextActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Saved contacts note */}
          <View style={styles.contactsNote}>
            <Text style={styles.contactsNoteText}>
              Android skips call screening for saved contacts. Rules only apply
              to unknown callers.
            </Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  inner: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 16,
    color: Colors.textMuted,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  backButton: {
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.md,
  },
  backText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    color: Colors.coral,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 20,
    color: Colors.charcoal,
  },
  saveButton: {
    backgroundColor: Colors.coral,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.borderDark,
  },
  saveText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 14,
    color: Colors.white,
  },
  saveTextDisabled: {
    color: Colors.textLight,
  },
  accentBar: {
    height: 3,
    backgroundColor: Colors.coral,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xxl,
    borderRadius: 2,
  },
  form: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.massive,
  },
  // Match Type
  matchTypeSection: {
    marginBottom: Spacing.xxl,
  },
  matchTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  matchTypeCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  matchTypeCardActive: {
    backgroundColor: Colors.coralPale,
    borderColor: Colors.coral,
  },
  matchTypeLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  matchTypeLabelActive: {
    color: Colors.coralDark,
  },
  matchTypeHint: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    fontStyle: "italic",
  },
  // Input
  inputGroup: {
    marginBottom: Spacing.xxl,
  },
  inputLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  input: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 18,
    color: Colors.textPrimary,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  hint: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  // Preview
  previewCard: {
    backgroundColor: Colors.creamDark,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  previewLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  previewDescription: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    color: Colors.coral,
    lineHeight: 22,
  },
  previewExamples: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  previewExampleLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  previewExample: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
    color: Colors.success,
    lineHeight: 22,
  },
  previewExampleBlocked: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  // Presets
  presetsSection: {
    marginBottom: Spacing.xxl,
  },
  presetsTitle: {
    fontFamily: FontFamily.displaySemiBold,
    fontSize: 18,
    color: Colors.charcoal,
    marginBottom: Spacing.md,
  },
  presetsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  presetChip: {
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  presetChipActive: {
    backgroundColor: Colors.coralPale,
    borderColor: Colors.coral,
  },
  presetChipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  presetChipTextActive: {
    color: Colors.coralDark,
  },
  contactsNote: {
    backgroundColor: Colors.sagePale,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.sage,
    padding: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  contactsNoteText: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
