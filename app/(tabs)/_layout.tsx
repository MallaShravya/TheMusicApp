import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, BottomTabBar, type BottomTabBarProps } from 'expo-router/js-tabs';

import { MiniPlayer } from '@/components/MiniPlayer';
import { colors } from '@/src/theme';

/**
 * The mini player is rendered as part of the tab bar rather than as a floating overlay, so
 * it never covers the last row of a list and it disappears correctly behind modals.
 */
function TabBarWithMiniPlayer(props: BottomTabBarProps) {
  return (
    <View style={{ backgroundColor: colors.surface }}>
      <MiniPlayer />
      <BottomTabBar {...props} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={TabBarWithMiniPlayer}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Songs',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="musical-notes" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="albums"
        options={{
          title: 'Albums',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="artists"
        options={{
          title: 'Artists',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="playlists"
        options={{
          title: 'Playlists',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="generate"
        options={{
          title: 'Generate',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="color-wand" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
