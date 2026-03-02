import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Conditionally import native module (only available in dev builds, not Expo Go)
let CallScreener: any = null;
try {
  CallScreener = require('../modules/call-screener');
} catch (e: any) {
  console.warn('CallScreener native module not available:', e?.message);
}

const ONBOARDING_KEY = 'hangup_onboarding_complete';

export async function isOnboardingComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_KEY);
  return value === 'true';
}

const STEPS = [
  {
    icon: '📵',
    title: 'Welcome to\nHang Up',
    body: 'Take back control of your phone.\nBlock spam calls before they even ring.',
  },
  {
    icon: '🛡️',
    title: 'Enable Call\nScreening',
    body: 'To silently block calls, Hang Up needs to be set as your default call screening app.\n\nNo data ever leaves your device.',
  },
  {
    icon: '📋',
    title: 'How It\nWorks',
    body: '1. Add blocking rules with match types\n2. "Starts with" blocks numbers beginning with certain digits\n3. "Exact" blocks a specific number\n4. Calls matching your rules are silently rejected\n\nTip: Include the country code (like +91) for precise matching.',
  },
  {
    icon: '✨',
    title: "You're All\nSet",
    body: '', // Dynamic — set in the component
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [screeningEnabled, setScreeningEnabled] = useState(false);

  const handleRequestRole = async () => {
    if (!CallScreener) {
      Alert.alert(
        'Dev Build Required',
        'Call screening requires a native dev build. This feature won\'t work in Expo Go.',
        [{ text: 'OK', onPress: () => setStep(2) }]
      );
      return;
    }

    try {
      const result = await CallScreener.requestScreeningRole();

      if (result === 'already_active') {
        setScreeningEnabled(true);
        setStep(2);
        return;
      }

      // Poll for the result after the system dialog
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          const enabled = await CallScreener.isScreeningEnabled();
          if (enabled) {
            setScreeningEnabled(enabled);
            break;
          }
        } catch (e) {
          // Continue polling
        }
      }
      setStep(2);
    } catch (error) {
      console.error('Failed to request screening role:', error);
      setStep(2); // Move forward anyway
    }
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(tabs)');
  };

  const currentStep = step;
  const totalSteps = STEPS.length;
  const stepData = STEPS[currentStep];

  // Dynamic body for final step
  const finalBody = screeningEnabled
    ? 'Call screening is active! Add blocking rules and spam calls will be silently rejected.'
    : 'You can enable call screening later in Settings.\nStart by adding your first blocking rule.';

  const displayBody = currentStep === totalSteps - 1 ? finalBody : stepData.body;

  const buttonConfig = [
    { text: 'Get Started', action: () => setStep(1) },
    { text: 'Enable Screening', action: handleRequestRole },
    { text: 'Next', action: () => setStep(3) },
    { text: 'Start Blocking', action: handleFinish },
  ];

  const currentButton = buttonConfig[currentStep];

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotCompleted]}
          />
        ))}
      </View>

      {/* Content */}
      <Animated.View key={step} entering={FadeInDown.duration(400)} style={styles.content}>
        <Text style={styles.icon}>{stepData.icon}</Text>
        <Text style={styles.title}>{stepData.title}</Text>
        <Text style={styles.body}>{displayBody}</Text>
      </Animated.View>

      {/* Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={currentButton.action}
          activeOpacity={0.8}>
          <Text style={styles.buttonText}>{currentButton.text}</Text>
        </TouchableOpacity>

        {step === 1 && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => setStep(2)}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}

        {step === 2 && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => setStep(3)}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
    paddingHorizontal: Spacing.xxl,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xxl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.borderDark,
  },
  dotActive: {
    backgroundColor: Colors.coral,
    width: 24,
  },
  dotCompleted: {
    backgroundColor: Colors.coralLight,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: Spacing.xxl,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 36,
    color: Colors.charcoal,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: Spacing.lg,
    lineHeight: 44,
  },
  body: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
  },
  footer: {
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  button: {
    backgroundColor: Colors.coral,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 16,
    color: Colors.white,
    letterSpacing: 0.3,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  skipText: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    color: Colors.textMuted,
  },
});
