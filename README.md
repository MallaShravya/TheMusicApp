# Swayve

An offline Android music player. It reads the audio files already on your phone, plays them
with background playback and lock-screen controls, and keeps playlists and favourites
locally. Nothing is uploaded anywhere.

**You never pick a file or a folder.** One permission prompt on first launch, and from then
on the library is whatever music is on the device — including anything added later, which
shows up on its own.

Math-based music generation is the next phase — the library already models generated tracks
as first-class citizens, so the generator only has to produce audio.

## Getting it onto your phone

There is no Java, Android SDK, or Android Studio on this machine, so the APK is built in the
cloud with EAS Build. You only need a free Expo account.

```bash
npm install -g eas-cli
eas login                      # free account, sign up at expo.dev
eas build --profile preview --platform android
```

`preview` produces a plain APK you can download and sideload. When the build finishes, EAS
prints a URL and a QR code — open it on the phone and install. Android will ask you to allow
installing from an unknown source the first time.

The other profiles: `development` builds a dev client (an APK with the Metro dev server
attached, so you can hot-reload against real device audio), and `production` builds an
`.aab` for the Play Store.

### Working on it day to day

```bash
npm run typecheck              # tsc --noEmit
npx expo export --platform android   # proves the whole app bundles
npx expo start --dev-client    # after installing a development build
```

Expo Go will **not** work for this app: background playback and the lock-screen service are
added by a config plugin, and `modules/music-library` is custom native code. Both need a real
build.

## How it is put together

| Path | What lives there |
| --- | --- |
| `modules/music-library/` | Kotlin native module. One `MediaStore` query returns the whole library with tags; album art is resolved lazily and cached to disk. |
| `src/library/` | Permission flow, the scan, and grouping tracks into albums and artists. |
| `src/player/` | The queue manager wrapped around a single `expo-audio` player. |
| `src/storage/` | Playlists and favourites, persisted with AsyncStorage. |
| `src/generator/` | Storage for generated tracks. The synthesis itself is not written yet. |
| `app/` | expo-router screens: five tabs, a Now Playing modal, and album/artist/playlist detail. |

### Why a native module

`expo-media-library` can list audio files but exposes only filenames — no artist, album,
track number, or artwork. A music player without tags is a file browser, so
`MusicLibraryModule.kt` queries `MediaStore.Audio.Media` directly. It is about 200 lines and
gives the full tag set in a single cursor pass.

### How the library stays current

Nothing polls. The module registers a `ContentObserver` on the MediaStore audio collection,
so Android pushes a notification whenever the media database changes — a track downloaded,
copied over USB, deleted, or retagged by another app. `LibraryProvider` debounces those by a
second (the system scanner fires one per file, so copying an album would otherwise trigger a
rescan per track) and re-queries once.

The observer only covers changes while the app is running, so a second trigger rescans
whenever the app returns to the foreground. Between the two, the list matches the device
without the user doing anything.

### What counts as library content

**In:** music and voice recordings. **Out:** ringtones, alarms, notification sounds,
podcasts, and audiobooks. MediaStore keeps a separate boolean column per category, so this
is stated directly in `INCLUDE_FLAGS` / `EXCLUDE_FLAGS` — moving a category across is a
one-line edit.

Two things make that filter safe across Android versions:

- **The columns are discovered, not assumed.** `is_recording` only exists from Android 12
  and `is_audiobook` from Android 10, and naming a missing column in a WHERE clause is a
  crash, not an empty result. `availableColumns()` reads the cursor's schema once and builds
  the clause from what is actually there. On Android 11 and below, recordings fall back to a
  path match on the system recorder's folder.
- **Every flag is wrapped in `COALESCE(col, 0)`.** These columns are nullable, and `NULL = 0`
  evaluates to NULL in SQLite — comparing directly would silently drop every untagged file
  in the library. This is verified: the generated clause was run against real SQLite with
  music, recordings, ringtones, alarms, notifications, podcasts, audiobooks, and a
  NULL-tagged track, on both the Android 12+ and Android 11 column sets.

Album art is deliberately *not* part of that query. Android 10 removed reliable access to the
album-art provider, so covers are fetched per album through `ContentResolver.loadThumbnail`,
compressed once, and cached in `cacheDir/albumart/`. Albums with no art get a zero-length
tombstone file so a failed decode is never retried.

### Why one player instead of a playlist

`expo-audio` ships an `AudioPlaylist` class with gapless playback, but it has no
`setActiveForLockScreen` — only `AudioPlayer` does. Lock-screen and notification controls
matter more for a music player than gapless transitions, so `PlayerProvider` keeps a single
`AudioPlayer` and swaps tracks with `replace()`, driving its own queue, shuffle order, and
repeat mode.

Playback state is split across two React contexts on purpose. The player ticks a status
update twice a second; if that shared one context with the queue, every visible track row
would re-render on every tick. `usePlayer()` is referentially stable, and
`usePlaybackProgress()` is subscribed to only by the seek bar and the mini player's progress
line.

## Known limits

- **Lock-screen next/previous.** `expo-audio` exposes play, pause, and seek to the media
  notification, and reports status back to JS — but it has no event for a next/previous press,
  so those buttons are not wired to the queue. Skipping works in-app and from the mini player.
  Getting it on the lock screen means either an upstream change or a media3 `MediaSession`
  in the native module.
- **The Kotlin module has not been compiled.** There is no JDK or Android SDK on this
  machine, so `MusicLibraryModule.kt` has been checked against the `expo-modules-core` API
  surface but never run through `kotlinc`. The first `eas build` is what will actually prove
  it. Everything on the JavaScript side is verified: `tsc` is clean and the full app bundles.
- **No playback resume.** Closing the app clears the queue; it does not restore what was
  playing on next launch.

## Next: the generator

`src/generator/store.ts` already persists generated tracks and `LibraryProvider` merges them
into the library, so they sort, queue, and go into playlists exactly like scanned files. What
is missing is synthesis: turn a recipe into PCM samples, write a WAV into app storage, and
save the record. The `Generate` tab sketches the intended directions — sequences mapped onto
scale degrees, Euclidean rhythms, and additive/FM synthesis with an ADSR envelope.
