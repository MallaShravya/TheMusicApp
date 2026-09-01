import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAudioPlayer } from 'expo-audio';

import { useLibrary } from '@/src/library';
import type { RepeatMode, Track } from '@/src/model';

import { requestPlaybackNotificationPermission } from './permissions';
import { nextMove } from './queueNavigation';
import { identityOrder, shuffledOrder } from './shuffle';
import { useAudioSession } from './useAudioSession';
import { useLockScreen } from './useLockScreen';

export type PlayerControls = {
  queue: Track[];
  /** Playback order as indices into `queue`; identity unless shuffle is on. */
  order: number[];
  position: number;
  currentTrack: Track | null;
  isPlaying: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  /** Starts a new queue. `startIndex` indexes into `tracks`, before any shuffling. */
  playQueue: (tracks: Track[], startIndex?: number) => void;
  /** Turns shuffle on and starts the collection from a random track. */
  shufflePlay: (tracks: Track[]) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seekTo: (seconds: number) => void;
  skipToPosition: (position: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  stop: () => void;
};

export type PlaybackProgress = {
  currentTime: number;
  duration: number;
  isBuffering: boolean;
};

const PlayerContext = createContext<PlayerControls | null>(null);
const ProgressContext = createContext<PlaybackProgress>({
  currentTime: 0,
  duration: 0,
  isBuffering: false,
});

/** Treat a `previous` press as "restart this track" once we are this far in. */
const RESTART_THRESHOLD_SECONDS = 3;

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { getArtwork } = useLibrary();

  // One player for the whole app. Tracks are swapped in with `replace()` rather than by
  // creating a player each time, which is what keeps a single lock-screen session alive
  // across the whole queue.
  const player = useAudioPlayer(null, { updateInterval: 500 });

  useAudioSession();
  const lockScreen = useLockScreen(player, getArtwork);

  const [queue, setQueue] = useState<Track[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [position, setPosition] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [shuffle, setShuffle] = useState(false);
  const [progress, setProgress] = useState<PlaybackProgress>({
    currentTime: 0,
    duration: 0,
    isBuffering: false,
  });

  // The status listener is registered once and lives for the life of the provider, so it
  // cannot read state directly — it would capture the first render's values forever. These
  // refs are the listener's view of the current world.
  const queueRef = useRef<Track[]>([]);
  const orderRef = useRef<number[]>([]);
  const positionRef = useRef(-1);
  const repeatRef = useRef<RepeatMode>('off');
  const shuffleRef = useRef(false);
  /** `didJustFinish` repeats across status ticks; this makes the advance fire exactly once. */
  const finishHandledRef = useRef(false);

  queueRef.current = queue;
  orderRef.current = order;
  positionRef.current = position;
  repeatRef.current = repeat;
  shuffleRef.current = shuffle;

  const loadTrackAt = useCallback(
    (nextPosition: number, autoPlay = true) => {
      const track = queueRef.current[orderRef.current[nextPosition]];
      if (!track) return;

      finishHandledRef.current = false;

      setPosition(nextPosition);
      positionRef.current = nextPosition;

      // Seed progress from the track's known length so the seek bar has a scale before the
      // player has loaded enough to report one itself.
      setProgress({ currentTime: 0, duration: track.durationMs / 1000, isBuffering: true });

      player.replace({ uri: track.uri, name: track.title });
      lockScreen.show(track);

      if (autoPlay) player.play();
    },
    [lockScreen, player],
  );

  const advance = useCallback(
    (direction: 1 | -1, { auto }: { auto: boolean }) => {
      const move = nextMove({
        position: positionRef.current,
        length: orderRef.current.length,
        direction,
        repeat: repeatRef.current,
        auto,
      });

      if (move.type === 'load') {
        loadTrackAt(move.position);
      } else if (move.type === 'stop') {
        player.pause();
        setIsPlaying(false);
      }
    },
    [loadTrackAt, player],
  );

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      setProgress({
        currentTime: status.currentTime ?? 0,
        duration: status.duration ?? 0,
        isBuffering: status.isBuffering ?? false,
      });

      // Only write when it actually flips, so the twice-a-second tick does not re-render
      // every consumer of `isPlaying`.
      setIsPlaying((previous) => (previous === status.playing ? previous : status.playing));

      if (status.didJustFinish && !finishHandledRef.current) {
        finishHandledRef.current = true;

        // Repeat-one is decided here rather than in `nextMove`: it is a choice about whether
        // to move at all, and a manual next should still cross tracks with it on.
        if (repeatRef.current === 'one') {
          void player.seekTo(0).then(() => {
            finishHandledRef.current = false;
            player.play();
          });
        } else {
          advance(1, { auto: true });
        }
      }
    });

    return () => subscription.remove();
  }, [advance, player]);

  const playQueue = useCallback(
    (tracks: Track[], startIndex = 0) => {
      if (tracks.length === 0) return;

      void requestPlaybackNotificationPermission();

      const nextOrder = shuffleRef.current
        ? shuffledOrder(tracks.length, startIndex)
        : identityOrder(tracks.length);

      setQueue(tracks);
      setOrder(nextOrder);
      // Written straight through as well: `loadTrackAt` below reads the refs, and React has
      // not re-rendered yet.
      queueRef.current = tracks;
      orderRef.current = nextOrder;

      // Shuffled orders put the chosen track first, so playback always starts at 0.
      loadTrackAt(shuffleRef.current ? 0 : startIndex);
    },
    [loadTrackAt],
  );

  /**
   * "Shuffle this collection" as one operation.
   *
   * Every screen with a Shuffle button used to open-code this as `if (!shuffle)
   * toggleShuffle(); playQueue(tracks, random)` — four copies, and the source of a real bug:
   * `playQueue` read `shuffle` from its render closure, which was still false in that same
   * tick, so it built an unshuffled order while the icon lit up.
   *
   * Note this sets the flag directly rather than calling `toggleShuffle`, which would waste
   * work rebuilding an order for the *outgoing* queue that `playQueue` is about to replace.
   */
  const shufflePlay = useCallback(
    (tracks: Track[]) => {
      if (tracks.length === 0) return;

      setShuffle(true);
      shuffleRef.current = true;

      // `playQueue` reads the ref, so the shuffled order is built on this same tick.
      playQueue(tracks, Math.floor(Math.random() * tracks.length));
    },
    [playQueue],
  );

  const toggle = useCallback(() => {
    if (positionRef.current < 0) return;

    if (player.playing) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, [player]);

  const next = useCallback(() => advance(1, { auto: false }), [advance]);

  const previous = useCallback(() => {
    // Matches every other music player: rewind first, step back only on a second press.
    if (player.currentTime > RESTART_THRESHOLD_SECONDS) {
      void player.seekTo(0);
      return;
    }
    advance(-1, { auto: false });
  }, [advance, player]);

  const seekTo = useCallback(
    (seconds: number) => {
      const target = Math.max(0, seconds);
      void player.seekTo(target);
      // Optimistic, so the thumb lands where it was dropped rather than snapping back until
      // the next status tick catches up.
      setProgress((current) => ({ ...current, currentTime: target }));
    },
    [player],
  );

  const skipToPosition = useCallback(
    (target: number) => {
      if (target < 0 || target >= orderRef.current.length) return;
      loadTrackAt(target);
    },
    [loadTrackAt],
  );

  const toggleShuffle = useCallback(() => {
    const nowShuffled = !shuffleRef.current;
    setShuffle(nowShuffled);
    shuffleRef.current = nowShuffled;

    const length = queueRef.current.length;
    if (length === 0) return;

    const currentQueueIndex = orderRef.current[positionRef.current] ?? 0;

    // Rebuild the order around whatever is playing, so toggling shuffle never interrupts the
    // current track — it only changes what comes after it.
    const nextOrder = nowShuffled
      ? shuffledOrder(length, currentQueueIndex)
      : identityOrder(length);
    const nextPosition = nowShuffled ? 0 : currentQueueIndex;

    setOrder(nextOrder);
    setPosition(nextPosition);
    orderRef.current = nextOrder;
    positionRef.current = nextPosition;
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((mode) => (mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'));
  }, []);

  const stop = useCallback(() => {
    player.pause();
    lockScreen.clear();

    setIsPlaying(false);
    setQueue([]);
    setOrder([]);
    setPosition(-1);
    queueRef.current = [];
    orderRef.current = [];
    positionRef.current = -1;
    setProgress({ currentTime: 0, duration: 0, isBuffering: false });
  }, [lockScreen, player]);

  const currentTrack = position >= 0 ? (queue[order[position]] ?? null) : null;

  // Deliberately excludes `progress`. This value must stay referentially stable across the
  // twice-a-second status tick, or every track row in the app re-renders with it.
  const controls = useMemo<PlayerControls>(
    () => ({
      queue,
      order,
      position,
      currentTrack,
      isPlaying,
      repeat,
      shuffle,
      playQueue,
      shufflePlay,
      toggle,
      next,
      previous,
      seekTo,
      skipToPosition,
      toggleShuffle,
      cycleRepeat,
      stop,
    }),
    [
      queue,
      order,
      position,
      currentTrack,
      isPlaying,
      repeat,
      shuffle,
      playQueue,
      shufflePlay,
      toggle,
      next,
      previous,
      seekTo,
      skipToPosition,
      toggleShuffle,
      cycleRepeat,
      stop,
    ],
  );

  return (
    <PlayerContext.Provider value={controls}>
      <ProgressContext.Provider value={progress}>{children}</ProgressContext.Provider>
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerControls {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return context;
}

/** Ticking playback position. Subscribe only where it is actually rendered. */
export function usePlaybackProgress(): PlaybackProgress {
  return useContext(ProgressContext);
}
