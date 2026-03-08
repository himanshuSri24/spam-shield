import React, { useState, useEffect } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';
import { clearAllData } from '@/database/db';

let CallScreener: any = null;
try {
  CallScreener = require('../modules/call-screener');
} catch (e: any) {
  console.warn('CallScreener native module not available:', e?.message);
}

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'How does call blocking work?',
    answer: 'When a call comes in, Android passes it through Hang Up before your phone rings. Hang Up checks the number against your rules and silently rejects matching calls. They never ring.',
  },
  {
    question: 'Why do I need to set Hang Up as default?',
    answer: 'Android requires apps to be the "default call screening app" to intercept calls. This is a security measure - only one app can screen calls at a time. Hang Up doesn\'t replace your dialer.',
  },
  {
    question: 'Does it block saved contacts?',
    answer: 'Android does not pass calls from your saved contacts through the call screening service. This means Hang Up cannot block numbers in your contacts - it only filters unknown/unsaved callers. To block a saved contact, remove them from your contacts first.',
  },
  {
    question: 'What are match types?',
    answer: '"Exact" blocks a specific number. "Starts with" blocks numbers beginning with certain digits. "Ends with" blocks numbers ending with certain digits. "Contains" blocks numbers with certain digits anywhere. "Regex" is for advanced pattern matching.',
  },
  {
    question: 'How do I block international spam?',
    answer: 'Use "Starts with" and include the country code. For example, to block Indian telemarketers starting with 140, use "+91140" as "Starts with". To block all calls from a country code, use that code as "Starts with" (e.g., "+234" for Nigeria).',
  },
  {
    question: 'Will this block legitimate calls?',
    answer: 'Only calls matching your rules will be blocked. Be careful with broad patterns. You can always check blocked calls in the History tab and adjust your rules.',
  },
  {
    question: 'Does Hang Up use the internet?',
    answer: 'No. Hang Up works 100% offline on your device. No data is ever sent anywhere. Your rules and call history stay on your phone.',
  },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [screeningEnabled, setScreeningEnabled] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<string>('checking...');
  const [isRequesting, setIsRequesting] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

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

  // System role request opens an external dialog, so we poll to detect the result
  const pollForStatusChange = async (maxAttempts: number = 10, delayMs: number = 1000) => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      try {
        const enabled = await CallScreener.isScreeningEnabled();
        if (enabled) {
          setScreeningEnabled(true);
          const status = await CallScreener.getServiceStatus();
          setServiceStatus(status);
          return true;
        }
      } catch (e) {
        // Continue polling
      }
    }
    // Final check
    await checkStatus();
    return false;
  };

  const handleToggleScreening = async () => {
    if (!CallScreener) {
      Alert.alert('Dev Build Required', 'Call screening requires a native development build.');
      return;
    }

    if (!screeningEnabled) {
      try {
        setIsRequesting(true);
        const result = await CallScreener.requestScreeningRole();

        if (result === 'already_active') {
          setScreeningEnabled(true);
          setServiceStatus('active');
        } else if (result === 'requested') {
          const success = await pollForStatusChange(3, 800);
          if (!success) {
            // System dialog didn't appear, open settings directly
            try { await CallScreener.openScreeningSettings(); } catch {}
          }
        } else {
          try { await CallScreener.openScreeningSettings(); } catch {}
        }
      } catch (e) {
        console.error('Failed to request role:', e);
        try { await CallScreener.openScreeningSettings(); } catch {}
      } finally {
        setIsRequesting(false);
      }
    } else {
      Alert.alert(
        'Disable Screening',
        'To disable, go to your phone\'s Settings → Default apps → Caller ID & Spam and choose a different app.',
        [{ text: 'OK' }]
      );
    }
  };

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
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
                Status: {serviceStatus === 'active' ? '🟢 Active' : serviceStatus === 'inactive' ? '🔴 Inactive' : serviceStatus}
              </Text>
            </View>
            {isRequesting ? (
              <ActivityIndicator color={Colors.coral} />
            ) : (
              <Switch
                value={screeningEnabled}
                onValueChange={handleToggleScreening}
                trackColor={{ false: Colors.borderDark, true: Colors.coralPale }}
                thumbColor={screeningEnabled ? Colors.coral : Colors.textLight}
              />
            )}
          </View>
          {!screeningEnabled && serviceStatus !== 'Requires dev build' && (
            <Text style={styles.enableHint}>
              Enable to start blocking unwanted calls
            </Text>
          )}
        </View>

        {/* Help & FAQ Section */}
        <Text style={styles.sectionTitle}>HELP & FAQ</Text>
        <View style={styles.card}>
          {FAQ_ITEMS.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && <View style={styles.divider} />}
              <TouchableOpacity
                style={styles.faqRow}
                onPress={() => toggleFAQ(index)}
                activeOpacity={0.7}>
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <Text style={styles.faqArrow}>
                  {expandedFAQ === index ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
              {expandedFAQ === index && (
                <Text style={styles.faqAnswer}>{item.answer}</Text>
              )}
            </React.Fragment>
          ))}
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

        {/* Clear Data */}
        <Text style={styles.sectionTitle}>DATA</Text>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={() => {
            Alert.alert(
              'Clear All Data',
              'This will delete all rules and blocked call history. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear',
                  style: 'destructive',
                  onPress: async () => {
                    await clearAllData();
                    Alert.alert('Done', 'All data has been cleared.');
                  },
                },
              ]
            );
          }}>
          <Text style={styles.dangerButtonText}>Clear All Data</Text>
        </TouchableOpacity>

        {/* Made by */}
        <View style={styles.madeByCard}>
          <Text style={styles.madeByTitle}>Made by devwithcoffee</Text>
          <View style={styles.madeByLinks}>
            <TouchableOpacity
              style={styles.madeByLink}
              onPress={() => Linking.openURL('https://buymeacoffee.com/devwithcoffee')}
              activeOpacity={0.7}>
              <Text style={styles.madeByLinkIcon}>☕</Text>
              <Text style={styles.madeByLinkText}>Buy Me a Coffee</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.madeByLink}
              onPress={() => Linking.openURL('https://devwithcoffee.com')}
              activeOpacity={0.7}>
              <Text style={styles.madeByLinkIcon}>🌐</Text>
              <Text style={styles.madeByLinkText}>devwithcoffee.com</Text>
            </TouchableOpacity>
          </View>
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
  enableHint: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: Colors.coral,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  // FAQ
  faqRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  faqQuestion: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  faqArrow: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  faqAnswer: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    paddingBottom: Spacing.sm,
    paddingLeft: Spacing.xs,
  },
  // About
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
  dangerButton: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.coralPale,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  dangerButtonText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 15,
    color: Colors.coral,
  },
  madeByCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.xxl,
  },
  madeByTitle: {
    fontFamily: FontFamily.displaySemiBold,
    fontSize: 15,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  madeByLinks: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  madeByLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  madeByLinkIcon: {
    fontSize: 14,
  },
  madeByLinkText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13,
    color: Colors.coral,
  },
});
