import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Colors } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: '◉',
    Rules: '⊘',
    History: '☰',
  };
  return (
    <Text style={{ fontSize: 20, color: focused ? Colors.coral : Colors.textMuted }}>
      {icons[label] ?? '•'}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.coral,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon label="Dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="rules"
        options={{
          title: 'Rules',
          tabBarIcon: ({ focused }) => <TabIcon label="Rules" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => <TabIcon label="History" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.cream,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 65,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabBarLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  tabBarItem: {
    paddingVertical: 2,
  },
});
