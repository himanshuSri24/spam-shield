import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';
import { BlockedCallItem } from '@/components/BlockedCallItem';
import { EmptyState } from '@/components/EmptyState';
import { useBlockedCalls } from '@/hooks/useDatabase';
import { drainPendingBlockedCalls } from '@/database/db';
import { formatTimestamp } from '@/utils/formatTimestamp';



export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { calls, loading, refresh } = useBlockedCalls(100);
  const [search, setSearch] = React.useState('');

  useFocusEffect(
    React.useCallback(() => {
      drainPendingBlockedCalls().then((count) => {
        if (count > 0) refresh();
      }).catch(() => {});
      refresh();
    }, [refresh])
  );

  const filteredCalls = search.trim()
    ? calls.filter(c =>
        c.phone_number.includes(search) ||
        (c.matched_pattern && c.matched_pattern.includes(search))
      )
    : calls;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>
          {calls.length} blocked call{calls.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Accent bar */}
      <View style={styles.accentBar} />

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search numbers or patterns..."
          placeholderTextColor={Colors.textLight}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : filteredCalls.length === 0 ? (
          <EmptyState
            icon="H"
            title={search ? 'No matches found' : 'No blocked calls yet'}
            message={
              search
                ? 'Try a different search term.'
                : "When calls are blocked, they'll appear here."
            }
          />
        ) : (
          <View style={styles.callsCard}>
            {filteredCalls.map((call) => (
              <BlockedCallItem
                key={call.id}
                phoneNumber={call.phone_number}
                matchedPattern={call.matched_pattern ?? 'Unknown rule'}
                timestamp={formatTimestamp(call.blocked_at)}
              />
            ))}
          </View>
        )}
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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: 32,
    color: Colors.charcoal,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  accentBar: {
    height: 3,
    backgroundColor: Colors.coral,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    borderRadius: 2,
  },
  searchContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  searchInput: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.massive,
  },
  callsCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  loadingContainer: {
    paddingVertical: Spacing.massive,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    color: Colors.textMuted,
  },
});
