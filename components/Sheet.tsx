import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing } from '@/src/theme';

/**
 * A centred modal card over a dimmed backdrop.
 *
 * Extracted because the add-to-playlist sheet and the new-playlist dialog had grown
 * byte-identical backdrop, centring and card styles — two copies of the same fiddly
 * arrangement, including the part that is easy to get wrong.
 *
 * That part is the nested `Pressable`. The backdrop catches taps to dismiss, but without a
 * second Pressable swallowing them, every tap *inside* the card would bubble out and close
 * the sheet the user is trying to use.
 */
export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Android's back gesture must dismiss the sheet, not the screen behind it.
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          // Android already resizes the window for the keyboard; adding padding on top of
          // that pushes the card off screen.
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.centerer}
        >
          {/* Swallows the press so tapping inside the card does not dismiss it. */}
          <Pressable style={styles.card} onPress={() => {}}>
            {children}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  centerer: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    // Bounded so a long playlist list scrolls inside the card instead of growing past the
    // top and bottom of the screen.
    maxHeight: '75%',
  },
});
