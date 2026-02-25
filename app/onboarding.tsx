import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Conditionally import native module (only available in dev builds, not Expo Go)
let CallScreener: any = null;
try {
  CallScreener = require('@/modules/call-screener');
} catch (e) {
  // Native module not available (e.g., running in Expo Go)
}

const ONBOARDING_KEY = 'hangup_onboarding_complete';

export async function isOnboardingComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_KEY);
  return value === 'true';
}

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
      await CallScreener.requestScreeningRole();
      // Check if it was granted
      const enabled = await CallScreener.isScreeningEnabled();
      setScreeningEnabled(enabled);
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

  const steps = [
    // Step 0: Welcome
    {
      icon: '📵',
      title: 'Welcome to\nHang Up',
      body: 'Take back control of your phone.\nBlock spam calls before they even ring.',
      buttonText: 'Get Started',
      onPress: () => setStep(1),
    },
    // Step 1: Permission
    {
      icon: '🛡️',
      title: 'Enable Call\nScreening',
      body: 'To silently block calls, Hang Up needs to be set as your default call screening app.\n\nNo data ever leaves your device.',
      buttonText: 'Enable Screening',
      onPress: handleRequestRole,
    },
    // Step 2: Done
    {
      icon: '✨',
      title: 'You\'re All\nSet',
      body: screeningEnabled
        ? 'Call screening is active! Add blocking rules and spam calls will be silently rejected.'
        : 'You can enable call screening later in Settings. Start by adding your first blocking rule.',
      buttonText: 'Start Blocking',
      onPress: handleFinish,
    },
  ];

  const currentStep = steps[step];

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotCompleted]}
          />
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.icon}>{currentStep.icon}</Text>
        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.body}>{currentStep.body}</Text>
      </View>

      {/* Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={currentStep.onPress}
          activeOpacity={0.8}>
          <Text style={styles.buttonText}>{currentStep.buttonText}</Text>
        </TouchableOpacity>

        {step === 1 && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => setStep(2)}>
            <Text style={styles.skipText}>Skip for now</Text>
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
