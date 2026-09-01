import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TrackActionsProvider } from '@/components/TrackActions';
import { LibraryProvider } from '@/src/library/LibraryProvider';
import { PlayerProvider } from '@/src/player/PlayerProvider';
import { PlaylistProvider } from '@/src/storage/PlaylistProvider';
import { FlameSettingsProvider } from '@/src/visualiser';
import { colors } from '@/src/theme';

/**
 * Provider order matters: PlayerProvider reads album art through the library, and the
 * track-action sheet writes through the playlist store, so each sits inside what it needs.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LibraryProvider>
          <PlaylistProvider>
            <PlayerProvider>
              <FlameSettingsProvider>
                <TrackActionsProvider>
                  <StatusBar style="light" />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: colors.bg },
                    }}
                  >
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen
                      name="player"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                        gestureEnabled: true,
                      }}
                    />
                    <Stack.Screen
                      name="flame-settings"
                      options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                        gestureEnabled: true,
                      }}
                    />
                  </Stack>
                </TrackActionsProvider>
              </FlameSettingsProvider>
            </PlayerProvider>
          </PlaylistProvider>
        </LibraryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
