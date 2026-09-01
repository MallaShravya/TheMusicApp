import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useLibrary } from '@/src/library/LibraryProvider';
import { colors, radius as radii } from '@/src/theme';

type Props = {
  albumId: string;
  size: number;
  borderRadius?: number;
};

/**
 * Album cover for a given MediaStore album id.
 *
 * Art is resolved lazily and cached in the library provider, so scrolling a long list
 * triggers one native decode per album rather than one per row.
 */
export function Artwork({ albumId, size, borderRadius = radii.md }: Props) {
  const { getArtwork, peekArtwork } = useLibrary();
  const [uri, setUri] = useState<string | null | undefined>(() => peekArtwork(albumId));

  useEffect(() => {
    const cached = peekArtwork(albumId);
    if (cached !== undefined) {
      setUri(cached);
      return;
    }

    let cancelled = false;
    setUri(undefined);
    void getArtwork(albumId).then((resolved) => {
      if (!cancelled) setUri(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [albumId, getArtwork, peekArtwork]);

  // Left un-annotated so it satisfies both ViewStyle (placeholder) and ImageStyle (cover),
  // which disagree on `overflow` and so have no common named type.
  const box = { width: size, height: size, borderRadius };

  if (!uri) {
    return (
      <View style={[styles.placeholder, box]}>
        <Ionicons name="musical-note" size={size * 0.4} color={colors.textFaint} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={box}
      contentFit="cover"
      transition={150}
      cachePolicy="memory-disk"
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
