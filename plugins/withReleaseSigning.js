const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to configure release signing with a proper keystore.
 *
 * Reads credentials from signing.properties at the project root:
 *   storeFile, storePassword, keyAlias, keyPassword
 *
 * Injects a `release` signingConfig into android/app/build.gradle
 * and wires it to the release buildType.
 */
const withReleaseSigning = (config) => {
  return withAppBuildGradle(config, (config) => {
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
};

module.exports = withReleaseSigning;
