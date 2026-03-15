import { isOnboardingComplete } from "@/app/onboarding-state";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Colors } from "@/constants/theme";

type StartupRoute = "/(tabs)" | "/onboarding";

export default function StartupGateScreen() {
  const [targetRoute, setTargetRoute] = useState<StartupRoute | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkOnboarding = async () => {
      try {
        const completed = await Promise.race<boolean>([
          isOnboardingComplete(),
          new Promise((resolve) => setTimeout(() => resolve(false), 2000)),
        ]);

        if (isMounted) {
          setTargetRoute(completed ? "/(tabs)" : "/onboarding");
        }
      } catch {
        if (isMounted) {
          setTargetRoute("/onboarding");
        }
      }
    };

    checkOnboarding();

    return () => {
      isMounted = false;
    };
  }, []);

  if (targetRoute) {
    return <Redirect href={targetRoute} />;
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={Colors.coral} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
});
