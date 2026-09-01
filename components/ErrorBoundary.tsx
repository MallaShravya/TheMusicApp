import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/theme';

type Props = {
  /** Names the thing that failed, so the message says what broke. */
  label: string;
  children: React.ReactNode;
};

type State = { error: Error | null };

/**
 * Catches a render error and shows it, rather than letting it take the app down.
 *
 * In a release build an unhandled JavaScript error closes the app to the home screen with no
 * message and no log — indistinguishable from a native crash, and impossible to diagnose
 * without a cable. This turns that into text on screen that can be read or photographed.
 *
 * Note the limit: React error boundaries only catch errors thrown during render, lifecycle,
 * or in a constructor. Anything thrown from a timer, a promise, or an animation frame
 * callback goes straight past this — those have to be wrapped where they are raised.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>{this.props.label} failed</Text>
        <ScrollView style={styles.body}>
          <Text selectable style={styles.message}>
            {error.message || String(error)}
          </Text>
          {error.stack ? (
            // Truncated by characters rather than lines: enough to identify the frame, short
            // enough to read on a phone.
            <Text selectable style={styles.stack}>
              {error.stack.slice(0, 600)}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  title: { ...typography.body, fontWeight: '600', color: colors.danger },
  body: { flex: 1 },
  message: { ...typography.label, color: colors.text, lineHeight: 20 },
  stack: { ...typography.caption, marginTop: spacing.sm, lineHeight: 16 },
});
