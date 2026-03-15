import AsyncStorage from "@react-native-async-storage/async-storage";

export const ONBOARDING_KEY = "spamshield_onboarding_complete";

export async function isOnboardingComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_KEY);
  return value === "true";
}

export async function setOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, "true");
}
