const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to register the HangUpCallScreeningService
 * in AndroidManifest.xml with the required permission and intent filter.
 */
const withCallScreener = (config) => {
  return withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application[0];

    // Check if service is already registered
    const existingService = mainApplication.service?.find(
      (s) => s.$?.['android:name'] === 'expo.modules.callscreener.HangUpCallScreeningService'
    );

    if (!existingService) {
      if (!mainApplication.service) {
        mainApplication.service = [];
      }

      mainApplication.service.push({
        $: {
          'android:name': 'expo.modules.callscreener.HangUpCallScreeningService',
          'android:permission': 'android.permission.BIND_SCREENING_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.telecom.CallScreeningService',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
};

module.exports = withCallScreener;
