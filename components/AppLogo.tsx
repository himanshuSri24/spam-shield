import { Image } from "expo-image";
import React from "react";
import { StyleSheet, View } from "react-native";

type AppLogoProps = {
  size?: number;
};

export function AppLogo({ size = 28 }: AppLogoProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={require("../assets/branding/logo.svg")}
        style={StyleSheet.absoluteFill}
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
