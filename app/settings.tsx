import React, { useState, useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';

let CallScreener: any = null;
try {
  CallScreener = require('../modules/call-screener');
} catch (e: any) {
  console.warn('CallScreener native module not available:', e?.message);
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [screeningEnabled, setScreeningEnabled] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<string>('checking...');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    if (!CallScreener) {
      setServiceStatus('Requires dev build');
      return;
    }

    try {
      const status = await CallScreener.getServiceStatus();
      setServiceStatus(status);
      const enabled = await CallScreener.isScreeningEnabled();
      setScreeningEnabled(enabled);
    } catch (e) {
      setServiceStatus('unavailable');
    }
  };

  const handleToggleScreening = async () => {
    if (!CallScreener) {
      Alert.alert('Dev Build Required', 'Call screening requires a native development build.');
      return;
    }

    if (!screeningEnabled) {
      try {
        await CallScreener.requestScreeningRole();
        await checkStatus();
      } catch (e) {
        console.error('Failed to request role:', e);
      }
    } else {
      Alert.alert(
        'Disable Screening',
        'To disable, go to your phone\'s Settings → Phone → Caller ID & Spam and choose a different app.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.accentBar} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}>

        {/* Call Screening Section */}
        <Text style={styles.sectionTitle}>CALL SCREENING</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Call Screening Active</Text>
              <Text style={styles.settingDescription}>
                Status: {serviceStatus}
              </Text>
            </View>
            <Switch
              value={screeningEnabled}
              onValueChange={handleToggleScreening}
              trackColor={{ false: Colors.borderDark, true: Colors.coralPale }}
              thumbColor={screeningEnabled ? Colors.coral : Colors.textLight}
            />
          </View>
        </View>

        {/* About Section */}
        <Text style={styles.sectionTitle}>ABOUT</Text>
        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Privacy</Text>
            <Text style={styles.aboutValue}>100% Offline</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Data Collection</Text>
            <Text style={[styles.aboutValue, { color: Colors.success }]}>None</Text>
          </View>
        </View>

        {/* Privacy Statement */}
        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>🔒 Privacy First</Text>
          <Text style={styles.privacyText}>
            Hang Up works entirely on your device. No data is ever sent to any server.
            Your blocking rules and call history never leave your phone.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.md,
    width: 60,
  },
  backText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    color: Colors.coral,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 20,
    color: Colors.charcoal,
  },
  accentBar: {
    height: 3,
    backgroundColor: Colors.coral,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xxl,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.massive,
  },
  sectionTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  settingDescription: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  aboutLabel: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  aboutValue: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.xs,
  },
  privacyCard: {
    backgroundColor: Colors.sagePale,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.sage,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  privacyTitle: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    color: Colors.charcoal,
    marginBottom: Spacing.sm,
  },
  privacyText: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
