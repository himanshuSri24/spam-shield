import React, { useState, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';

const PRESETS = [
  { pattern: '140*', label: 'Telemarketers (140)' },
  { pattern: '1800*', label: 'Toll-free spam' },
  { pattern: '120*', label: 'Service calls (120)' },
  { pattern: '160*', label: 'Marketing (160)' },
  { pattern: '180*', label: 'Toll-free (180)' },
];

// Convert user-friendly wildcard pattern to regex
function patternToRegex(pattern: string): string {
  return '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
}

// Generate example matching numbers for the preview
function getExampleMatches(pattern: string): string[] {
  if (!pattern.trim()) return [];

  const examples: string[] = [];
  const cleaned = pattern.replace(/[^0-9*?+]/g, '');

  if (!cleaned) return [];

  // Generate a few example numbers based on the prefix
  const prefix = cleaned.split('*')[0].split('?')[0];
  if (prefix.length > 0) {
    for (let i = 0; i < 3; i++) {
      let num = prefix;
      const remaining = 10 - num.length;
      for (let j = 0; j < remaining; j++) {
        num += Math.floor(Math.random() * 10).toString();
      }
      examples.push(num);
    }
  }

  return examples;
}

export default function AddRuleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [pattern, setPattern] = useState('');
  const [label, setLabel] = useState('');

  const regexPreview = useMemo(() => {
    if (!pattern.trim()) return '';
    return patternToRegex(pattern);
  }, [pattern]);

  const exampleMatches = useMemo(() => {
    return getExampleMatches(pattern);
  }, [pattern]);

  const handlePresetSelect = (preset: { pattern: string; label: string }) => {
    setPattern(preset.pattern);
    setLabel(preset.label);
  };

  const handleSave = () => {
    // Will wire to SQLite later
    router.back();
  };

  const isValid = pattern.trim().length > 0;

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
          <Text style={styles.title}>New Rule</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isValid}
            style={[styles.saveButton, !isValid && styles.saveButtonDisabled]}>
            <Text style={[styles.saveText, !isValid && styles.saveTextDisabled]}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Accent bar */}
        <View style={styles.accentBar} />

        <ScrollView
          style={styles.form}
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}>

          {/* Pattern Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PATTERN</Text>
            <TextInput
              style={styles.input}
              value={pattern}
              onChangeText={setPattern}
              placeholder="e.g. 140* or +91 78*"
              placeholderTextColor={Colors.textLight}
              autoFocus
            />
            <Text style={styles.hint}>
              Use * to match any characters. E.g. 140* blocks all numbers starting with 140.
            </Text>
          </View>

          {/* Regex Preview */}
          {regexPreview ? (
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>REGEX PATTERN</Text>
              <Text style={styles.previewRegex}>{regexPreview}</Text>
              {exampleMatches.length > 0 && (
                <>
                  <Text style={styles.previewMatchLabel}>WILL MATCH:</Text>
                  {exampleMatches.map((num, i) => (
                    <Text key={i} style={styles.previewMatch}>  {num}</Text>
                  ))}
                </>
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

          {/* Preset Patterns */}
          <View style={styles.presetsSection}>
            <Text style={styles.presetsTitle}>Quick Presets</Text>
            <View style={styles.presetsList}>
              {PRESETS.map((preset, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.presetChip,
                    pattern === preset.pattern && styles.presetChipActive,
                  ]}
                  onPress={() => handlePresetSelect(preset)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.presetChipText,
                      pattern === preset.pattern && styles.presetChipTextActive,
                    ]}>
                    {preset.pattern}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
  previewRegex: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 16,
    color: Colors.coral,
    marginBottom: Spacing.md,
  },
  previewMatchLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  previewMatch: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
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
    fontSize: 14,
    color: Colors.textSecondary,
  },
  presetChipTextActive: {
    color: Colors.coralDark,
  },
});
