import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useLibrary } from '@/src/library/LibraryProvider';
import { colors, spacing, typography } from '@/src/theme';

import { EmptyState } from './EmptyState';

/**
 * Renders `children` only once the library has actually been read, and otherwise shows the
 * reason it has not: permission not granted, scan in progress, or a failed read.
 */
export function LibraryGate({ children }: { children: React.ReactNode }) {
  const { status, error, requestAccess, refresh } = useLibrary();

  if (status === 'needs-permission') {
    return (
      <EmptyState
        icon="lock-closed-outline"
        title="Swayve needs access to your music"
        message="Android keeps audio files behind a permission. Grant it and your library appears here — nothing leaves the device."
        actionLabel="Grant access"
        onAction={() => void requestAccess()}
      />
    );
  }

  if (status === 'error') {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title="Could not read the library"
        message={error ?? 'Something went wrong while scanning for music.'}
        actionLabel="Try again"
        onAction={() => void refresh()}
      />
    );
  }

  if (status === 'idle' || status === 'scanning') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>Scanning your music…</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: typography.label,
});
