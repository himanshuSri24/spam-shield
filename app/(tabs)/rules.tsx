import { StyleSheet, Text, View } from 'react-native';

export default function RulesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Block Rules</Text>
      <Text style={styles.subtitle}>Manage your blocking patterns</Text>
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
