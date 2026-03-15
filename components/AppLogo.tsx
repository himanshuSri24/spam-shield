import { Image } from "expo-image";
import React from "react";
import { StyleSheet, View } from "react-native";

type AppLogoProps = {
  size?: number;
};

export function AppLogo({ size = 28 }: AppLogoProps) {
  return (
    <View style={[styles.container, { width: size * 1.2, height: size * 1.2 }]}>
      <Image
        source={require("../assets/branding/logo.svg")}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
