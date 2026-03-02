import React, { useState, useEffect, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';
import {
  addRule as dbAddRule,
  updateRule as dbUpdateRule,
  getRuleById,
  MatchType,
  getRuleDescription,
} from '@/database/db';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import * as Localization from 'expo-localization';

type Mode = 'simple' | 'advanced';

const MATCH_TYPES: { type: MatchType; label: string; icon: string; hint: string }[] = [
  { type: 'exact', label: 'Exact Number', icon: '🎯', hint: 'Blocks this exact number only' },
  { type: 'starts_with', label: 'Starts With', icon: '▶️', hint: 'Blocks numbers starting with these digits' },
  { type: 'ends_with', label: 'Ends With', icon: '◀️', hint: 'Blocks numbers ending with these digits' },
  { type: 'contains', label: 'Contains', icon: '🔍', hint: 'Blocks numbers containing these digits' },
];

const PRESETS = [
  { pattern: '140', matchType: 'starts_with' as MatchType, label: 'Telemarketers (140)' },
  { pattern: '1800', matchType: 'starts_with' as MatchType, label: 'Toll-free spam' },
  { pattern: '120', matchType: 'starts_with' as MatchType, label: 'Service calls (120)' },
  { pattern: '160', matchType: 'starts_with' as MatchType, label: 'Marketing (160)' },
  { pattern: '180', matchType: 'starts_with' as MatchType, label: 'Toll-free (180)' },
];

export default function AddRuleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ ruleId?: string }>();

  const isEditing = !!params.ruleId;
  const editId = params.ruleId ? parseInt(params.ruleId, 10) : null;

  const [mode, setMode] = useState<Mode>('simple');
  const [pattern, setPattern] = useState('');
  const [label, setLabel] = useState('');
  const [matchType, setMatchType] = useState<MatchType>('starts_with');
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
            if (rule.match_type === 'regex') {
              setMode('advanced');
            }
          }
        } catch (e) {
          console.error('Failed to load rule for editing:', e);
        } finally {
          setLoadingRule(false);
        }
      })();
    }
  }, [editId]);

  const previewDescription = useMemo(() => {
    if (!pattern.trim()) return '';
    const effectiveMatchType = mode === 'advanced' ? 'regex' : matchType;
    return getRuleDescription(pattern.trim(), effectiveMatchType);
  }, [pattern, matchType, mode]);

  const handlePresetSelect = (preset: typeof PRESETS[number]) => {
    setPattern(preset.pattern);
    setLabel(preset.label);
    setMatchType(preset.matchType);
    setMode('simple');
  };

  const handleSave = async () => {
    if (!isValid) return;
    try {
      const effectiveMatchType = mode === 'advanced' ? 'regex' as MatchType : matchType;
      let cleanedPattern = pattern.trim();
      
      // Strictly format 'Exact Match' using E.164 so it marries perfectly with Native screening.
      if (effectiveMatchType === 'exact') {
         const regionCodes = Localization.getLocales();
         const defaultRegion = regionCodes.length > 0 && regionCodes[0].regionCode ? regionCodes[0].regionCode : 'US';
         // @ts-ignore
         const phoneNumber = parsePhoneNumberFromString(cleanedPattern, defaultRegion);
         if (phoneNumber && phoneNumber.isValid()) {
             cleanedPattern = phoneNumber.number as string;
         } else {
             // If parsing fails, fall back to stripping spaces
             cleanedPattern = cleanedPattern.replace(/[\s\-\(\)]/g, '');
         }
      }

      const cleanedLabel = label.trim();

      if (isEditing && editId) {
        await dbUpdateRule(editId, cleanedPattern, cleanedLabel, effectiveMatchType);
      } else {
        await dbAddRule(cleanedPattern, cleanedLabel, effectiveMatchType);
      }
      router.back();
    } catch (error) {
      console.error('Failed to save rule:', error);
      Alert.alert('Error', 'Failed to save rule. Please try again.');
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.inner, { paddingTop: insets.top + Spacing.md }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isEditing ? 'Edit Rule' : 'New Rule'}</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isValid}
            style={[styles.saveButton, !isValid && styles.saveButtonDisabled]}>
            <Text style={[styles.saveText, !isValid && styles.saveTextDisabled]}>
              {isEditing ? 'Update' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Accent bar */}
        <View style={styles.accentBar} />

        <ScrollView
          style={styles.form}
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'simple' && styles.modeButtonActive]}
              onPress={() => setMode('simple')}
              activeOpacity={0.7}>
              <Text style={[styles.modeText, mode === 'simple' && styles.modeTextActive]}>
                Simple
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'advanced' && styles.modeButtonActive]}
              onPress={() => setMode('advanced')}
              activeOpacity={0.7}>
              <Text style={[styles.modeText, mode === 'advanced' && styles.modeTextActive]}>
                Advanced
              </Text>
            </TouchableOpacity>
          </View>

          {/* Simple Mode: Match Type Selector */}
          {mode === 'simple' && (
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
                    activeOpacity={0.7}>
                    <Text style={styles.matchTypeIcon}>{mt.icon}</Text>
                    <Text
                      style={[
                        styles.matchTypeLabel,
                        matchType === mt.type && styles.matchTypeLabelActive,
                      ]}>
                      {mt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {matchType && (
                <Text style={styles.matchTypeHint}>
                  {MATCH_TYPES.find(mt => mt.type === matchType)?.hint}
                </Text>
              )}
            </View>
          )}

          {/* Pattern Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {mode === 'advanced' ? 'REGEX PATTERN' : 'PHONE NUMBER / DIGITS'}
            </Text>
            <TextInput
              style={styles.input}
              value={pattern}
              onChangeText={setPattern}
              placeholder={
                mode === 'advanced'
                  ? 'e.g. \\+91956[0-9]+'
                  : matchType === 'exact'
                  ? 'e.g. +919563123456'
                  : 'e.g. +919563 or 9563'
              }
              placeholderTextColor={Colors.textLight}
              autoFocus={!isEditing}
              keyboardType={mode === 'simple' ? 'phone-pad' : 'default'}
            />
            <Text style={styles.hint}>
              {mode === 'advanced'
                ? 'Enter a regular expression pattern. Use this for complex matching rules.'
                : matchType === 'exact'
                ? 'Enter the full phone number to block (including country code if needed).'
                : matchType === 'starts_with'
                ? 'Enter the digits that blocked numbers should start with. Include + and country code for international numbers.'
                : matchType === 'ends_with'
                ? 'Enter the digits that blocked numbers should end with.'
                : 'Enter digits that appear anywhere in the number.'}
            </Text>
          </View>

          {/* Preview */}
          {previewDescription ? (
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>WILL DO</Text>
              <Text style={styles.previewDescription}>{previewDescription}</Text>
              {mode === 'simple' && matchType === 'starts_with' && pattern.trim() && (
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
              {mode === 'simple' && matchType === 'ends_with' && pattern.trim() && (
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
              {mode === 'simple' && matchType === 'contains' && pattern.trim() && (
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

          {/* Preset Patterns (only in simple mode, not editing) */}
          {mode === 'simple' && !isEditing && (
            <View style={styles.presetsSection}>
              <Text style={styles.presetsTitle}>Quick Presets</Text>
              <View style={styles.presetsList}>
                {PRESETS.map((preset, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.presetChip,
                      pattern === preset.pattern && matchType === preset.matchType && styles.presetChipActive,
                    ]}
                    onPress={() => handlePresetSelect(preset)}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.presetChipText,
                        pattern === preset.pattern && matchType === preset.matchType && styles.presetChipTextActive,
                      ]}>
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
              ℹ️  Android skips call screening for saved contacts. Rules only apply to unknown callers.
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 16,
    color: Colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  // Mode Toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.creamDark,
    borderRadius: BorderRadius.md,
    padding: 3,
    marginBottom: Spacing.xxl,
  },
  modeButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  modeButtonActive: {
    backgroundColor: Colors.cardBg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  modeText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 14,
    color: Colors.textMuted,
  },
  modeTextActive: {
    color: Colors.charcoal,
  },
  // Match Type
  matchTypeSection: {
    marginBottom: Spacing.xxl,
  },
  matchTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  matchTypeCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  matchTypeCardActive: {
    backgroundColor: Colors.coralPale,
    borderColor: Colors.coral,
  },
  matchTypeIcon: {
    fontSize: 18,
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
    fontStyle: 'italic',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
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
