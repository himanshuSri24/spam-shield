import { StyleSheet, Text, View } from 'react-native';

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
    backgroundColor: '#FFF5EC',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2D2D2D',
  },
  subtitle: {
    fontSize: 16,
    color: '#8A8A8A',
    marginTop: 8,
  },
});
