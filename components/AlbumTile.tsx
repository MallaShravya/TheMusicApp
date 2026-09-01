import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import type { Album } from '@/src/model';
import { UNKNOWN_ARTIST } from '@/src/model';
import { radius, spacing, typography } from '@/src/theme';

import { Artwork } from './Artwork';

/**
 * One album in the grid: cover, title, artist.
 *
 * `size` is passed in rather than measured here — the grid computes it once from the screen
 * width and the gutters, and every tile must agree or the columns drift apart.
 */
export function AlbumTile({
  album,
  size,
  onPress,
}: {
  album: Album;
  size: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={album.title}
      style={({ pressed }) => [{ width: size }, styles.tile, pressed && styles.pressed]}
    >
      <Artwork albumId={album.id} size={size} borderRadius={radius.md} />
      <Text numberOfLines={1} style={styles.title}>
        {album.title}
      </Text>
      <Text numberOfLines={1} style={styles.subtitle}>
        {album.artist ?? UNKNOWN_ARTIST}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { gap: spacing.xs },
  pressed: { opacity: 0.7 },
  title: { ...typography.body, fontSize: 14, marginTop: spacing.sm },
  subtitle: typography.caption,
});
