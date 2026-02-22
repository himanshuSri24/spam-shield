import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hang Up</Text>
      <Text style={styles.subtitle}>Your calls, your rules.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cream,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 36,
    color: Colors.charcoal,
  },
  subtitle: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
});
