const {
  withAppBuildGradle,
  withGradleProperties,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo Config Plugin to configure release signing with a proper keystore,
 * enable R8 minification + resource shrinking, and add ProGuard keep rules.
 *
 * Reads credentials from signing.properties at the project root:
 *   storeFile, storePassword, keyAlias, keyPassword
 *
 * Injects a `release` signingConfig into android/app/build.gradle
 * and wires it to the release buildType.
 */
const withReleaseSigning = (config) => {
  // 1. Inject signing config into app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Skip if already configured
    if (contents.includes("signingConfigs.release")) {
      config.modResults.contents = contents;
      return config;
    }

    // Add release signing config alongside the existing debug config.
    // Loads from signing.properties at the project root (one level above android/).
    contents = contents.replace(
      /(signingConfigs\s*\{[\s\S]*?debug\s*\{[\s\S]*?\})\s*(\})/,
      `$1
        release {
            def signingPropsFile = rootProject.file("../signing.properties")
            if (signingPropsFile.exists()) {
                def signingProps = new Properties()
                signingProps.load(new FileInputStream(signingPropsFile))
                storeFile file(signingProps['storeFile'])
                storePassword signingProps['storePassword']
                keyAlias signingProps['keyAlias']
                keyPassword signingProps['keyPassword']
            }
        }
    $2`,
    );

    // Wire release buildType to use release signingConfig
    contents = contents.replace(
      /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/,
      `$1signingConfig signingConfigs.release`,
    );

    config.modResults.contents = contents;
    return config;
  });

  // 2. Enable R8 minification and resource shrinking via gradle.properties
  config = withGradleProperties(config, (config) => {
    const props = config.modResults;

    const ensureProp = (key, value) => {
      const existing = props.find(
        (p) => p.type === "property" && p.key === key,
      );
      if (existing) {
        existing.value = value;
      } else {
        props.push({ type: "property", key, value });
      }
    };

    ensureProp("android.enableMinifyInReleaseBuilds", "true");
    ensureProp("android.enableShrinkResourcesInReleaseBuilds", "true");

    return config;
  });

  // 3. Append ProGuard keep rules for the native call screening service
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const proguardPath = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "proguard-rules.pro",
      );
      if (fs.existsSync(proguardPath)) {
        let rules = fs.readFileSync(proguardPath, "utf8");
        const keepRule =
          "-keep class com.devwithcoffee.spamshield.callscreener.** { *; }";
        if (!rules.includes(keepRule)) {
          rules += `\n# Keep the native call screening service (registered in AndroidManifest)\n${keepRule}\n`;
          fs.writeFileSync(proguardPath, rules);
        }
      }
      return config;
    },
  ]);

  return config;
};

module.exports = withReleaseSigning;
