import { AppLogo } from "@/components/AppLogo";
import { FontFamily } from "@/constants/fonts";
import { BorderRadius, Colors, Spacing } from "@/constants/theme";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  isScreeningEnabled,
  requestScreeningRole,
} from "../modules/call-screener";
import { setOnboardingComplete } from "./onboarding-state";

const STEPS = [
  {
    title: "Welcome to\nSpam Shield",
    body: "Take back control of your phone.\nBlock spam calls before they even ring.",
  },
  {
    title: "Enable Call\nScreening",
    body: "To silently block calls, Spam Shield needs to be set as your default call screening app.\n\nNo data ever leaves your device.",
  },
  {
    title: "How It\nWorks",
    body: '1. Add blocking rules with match types\n2. "Starts with" blocks numbers beginning with certain digits\n3. "Exact" blocks a specific number\n4. Calls matching your rules are silently rejected\n\nTip: Include the country code (like +91) for precise matching.',
  },
  {
    title: "You're All\nSet",
    body: "",
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [screeningEnabled, setScreeningEnabled] = useState(false);
  const waitingForRole = useRef(false);

  // When user returns from the system role dialog, check if they granted it
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && waitingForRole.current) {
        waitingForRole.current = false;
        isScreeningEnabled()
          .then((enabled) => {
            setScreeningEnabled(enabled);
            setStep(2);
          })
          .catch(() => setStep(2));
      }
    });
    return () => subscription.remove();
  }, []);

  const handleRequestRole = async () => {
    try {
      const result = await requestScreeningRole();

      if (result === "already_active") {
        setScreeningEnabled(true);
        setStep(2);
        return;
      }

      // System dialog opened — wait for user to return
      waitingForRole.current = true;
    } catch {
      setStep(2);
    }
  };

  const handleFinish = async () => {
    await setOnboardingComplete();
    router.replace("/(tabs)");
  };

  const currentStep = step;
  const totalSteps = STEPS.length;
  const stepData = STEPS[currentStep];

  const finalBody = screeningEnabled
    ? "Call screening is active! Add blocking rules and spam calls will be silently rejected."
    : "You can enable call screening later in Settings.\nStart by adding your first blocking rule.";

  const displayBody =
    currentStep === totalSteps - 1 ? finalBody : stepData.body;

  const buttonConfig = [
    { text: "Get Started", action: () => setStep(1) },
    { text: "Enable Screening", action: handleRequestRole },
    { text: "Next", action: () => setStep(3) },
    { text: "Start Blocking", action: handleFinish },
  ];

  const currentButton = buttonConfig[currentStep];

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === step && styles.dotActive,
              i < step && styles.dotCompleted,
            ]}
          />
        ))}
      </View>

      {/* Content */}
      <Animated.View
        key={step}
        entering={FadeInDown.duration(400)}
        style={styles.content}
      >
        <View style={styles.logoWrap}>
          <AppLogo size={36} />
        </View>
        <Text style={styles.title}>{stepData.title}</Text>
        <Text style={styles.body}>{displayBody}</Text>
      </Animated.View>

      {/* Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={currentButton.action}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>{currentButton.text}</Text>
        </TouchableOpacity>

        {step === 1 && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => setStep(2)}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}

        {step === 2 && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => setStep(3)}
          >
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
    flexDirection: "row",
    justifyContent: "center",
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
    justifyContent: "center",
    alignItems: "center",
  },
  logoWrap: {
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 36,
    color: Colors.charcoal,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: Spacing.lg,
    lineHeight: 44,
  },
  body: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
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
    alignItems: "center",
  },
  buttonText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 16,
    color: Colors.white,
    letterSpacing: 0.3,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  skipText: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    color: Colors.textMuted,
  },
});
