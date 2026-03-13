const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to register the SpamShieldCallScreeningService
 * in AndroidManifest.xml with the required permission and intent filter.
 */
const withCallScreener = (config) => {
  return withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application[0];

    // Check if service is already registered
    const existingService = mainApplication.service?.find(
      (s) => s.$?.['android:name'] === 'expo.modules.callscreener.SpamShieldCallScreeningService'
    );

    const serviceEntry = {
      $: {
        'android:name': 'expo.modules.callscreener.SpamShieldCallScreeningService',
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
    };

    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    if (existingService) {
      // Update existing entry to ensure correct permission
      const idx = mainApplication.service.indexOf(existingService);
      mainApplication.service[idx] = serviceEntry;
    } else {
      mainApplication.service.push(serviceEntry);
    }

    return config;
  });
};

module.exports = withCallScreener;
