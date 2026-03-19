const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Fixes Windows MAX_PATH (260 char) build failures.
 *
 * Two changes are injected into android/app/build.gradle on every prebuild:
 *
 * 1. Inside defaultConfig: externalNativeBuild.cmake.arguments with
 *    CMAKE_OBJECT_PATH_MAX=150 (belt — tells CMake to MD5-hash any object
 *    filename that would otherwise exceed 150 chars).
 *
 * 2. Inside the android{} block: a global externalNativeBuild { cmake {
 *    buildStagingDirectory "D:/cxx" } } block (suspenders — redirects ALL
 *    CMake staging/build output, including autolinking sub-projects, to a
 *    short path so ninja never constructs a >260-char filename).
 *
 * Used together with scripts/build-apk.ps1 which maps the project root to
 * Z:\ via `subst`, shortening every source-encoded path by ~55 chars.
 */
const withShortCmakePath = (config) => {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // ── 1. defaultConfig cmake arguments ──────────────────────────────────
    if (!contents.includes("CMAKE_OBJECT_PATH_MAX")) {
      contents = contents.replace(
        /(ndk\s*\{[^}]*\})/,
        `$1
        externalNativeBuild {
            cmake {
                // Keep object file paths short to avoid Windows 260-char MAX_PATH limit
                arguments "-DCMAKE_OBJECT_PATH_MAX=150"
            }
        }`,
      );
    }

    // ── 2. android-level buildStagingDirectory ────────────────────────────
    if (!contents.includes("buildStagingDirectory")) {
      // Define isWindowsHost if not already present
      if (!contents.includes("isWindowsHost")) {
        contents = contents.replace(
          /(apply plugin: "com\.facebook\.react")/,
          `$1\n\ndef isWindowsHost = System.getProperty('os.name').toLowerCase().contains('windows')`,
        );
      }
      // Insert a global externalNativeBuild block guarded by isWindowsHost,
      // right before the closing brace of the android{} block.
      // We identify the end of the android block by the androidResources block.
      contents = contents.replace(
        /(androidResources\s*\{[^}]*\}\s*\n)(})/,
        `$1    if (isWindowsHost) {\n` +
          `        // Redirect CMake staging dir to a short path — avoids Windows 260-char MAX_PATH.\n` +
          `        // Use with scripts/build-apk.ps1 (subst Z:) for full effect.\n` +
          `        externalNativeBuild {\n` +
          `            cmake {\n` +
          `                buildStagingDirectory "D:/b"\n` +
          `            }\n` +
          `        }\n` +
          `    }\n` +
          `$2`,
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};

module.exports = withShortCmakePath;
