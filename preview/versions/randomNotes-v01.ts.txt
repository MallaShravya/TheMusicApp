import { toSargam } from './swara';

/**
 * A random phrase under a few constraints, and nothing else.
 *
 * There is still no scale and no weighting toward any particular note. What has been added is
 * shape: steps are small and mostly very small, one note recurs on a fixed beat, a second
 * recurs halfway between, and some beats hold or fall silent instead of sounding a new note.
 * None of that says anything about *which* notes are good — it only stops the sequence
 * wandering and gives it somewhere to arrive.
 *
 * Anything that makes this sound like music is meant to go on top, not in here.
 */

/** A written beat: a new note, a continuation of the last one, or silence. */
export type Token =
  | { kind: 'note'; semitones: number }
  | { kind: 'hold' }
  | { kind: 'rest' };

/**
 * How often each step size is chosen, indexed by the size itself.
 *
 * Index 0 is a repeated note and is off: every new note moves. Ones and twos carry the
 * sequence, threes give it somewhere to go, and a four is rare enough to be an event.
 *
 * These are *preferences*, not guarantees. The recurring notes have the final say — the
 * generator reports the distribution it actually produced for that reason.
 */
export const DEFAULT_STEP_WEIGHTS = [0, 36, 36, 25, 3];

/**
 * The seven natural swaras, as semitones from Sa: S R G M P D N.
 *
 * Not a raga — a raga chooses from these *and* the komal and tivra ones, and adds rules about
 * direction and emphasis that none of this knows. It is only the plainest available way to
 * stop the generator using all twelve.
 */
export const SHUDDHA_SWARAS = [0, 2, 4, 5, 7, 9, 11];

export type RandomPhraseOptions = {
  /** How many beats. Not how many notes: holds and rests take a beat and sound no new note. */
  count: number;
  /** Lowest and highest note, in semitones relative to Sa. */
  lowest: number;
  highest: number;
  /**
   * Every this many beats, the phrase lands on the same note. `0` turns it off.
   *
   * Which note is chosen at random for the phrase, not fixed to Sa — a recurring note is
   * doing the work of a tonic whether or not it is one, and hearing that with an arbitrary
   * note is the point of being able to change it.
   */
  anchorEvery?: number;
  /** The recurring note, in semitones from Sa. Chosen at random when absent. */
  anchorNote?: number;
  /** Whether the halfway point between two anchors is also fixed. */
  midpointAnchor?: boolean;
  /** Chance that a free beat holds the previous note rather than sounding a new one. */
  holdChance?: number;
  /** Chance that a free beat is silent. */
  restChance?: number;
  /**
   * How many times a earlier stretch of the phrase is repeated verbatim later on.
   *
   * Repeats are taken and placed on the grid the recurring notes already define, and only
   * between stretches at the same position within it. That is what makes them safe: the note
   * a stretch begins on and the note it leads into are the same in both places, so every
   * constraint that held for the original holds for the copy.
   */
  loopBacks?: number;
  /**
   * Which pitch classes may be used, as semitones from Sa. All twelve when absent.
   *
   * Restricting this makes the notes unevenly spaced, and that has a consequence worth
   * knowing: among the shuddha swaras a step of one semitone exists only between Ga and Ma
   * and between Ni and Sa. Most single steps become twos, whatever the weights say.
   */
  allowedPitchClasses?: number[];
  /** Relative frequency of each step size, indexed by size. */
  stepWeights?: number[];
  /** Injectable for tests. Defaults to `Math.random`. */
  random?: () => number;
};

function maxStepFrom(weights: number[]): number {
  let largest = 0;
  for (let size = 0; size < weights.length; size += 1) {
    if (weights[size] > 0) largest = size;
  }
  return largest;
}

/**
 * The largest step the weights use often — anything carrying at least a tenth of the total.
 *
 * Measured, not assumed: judging reachability by the largest *possible* step lets the line
 * drift until only large steps will do, and the recurring notes then spend the rare ones on
 * themselves.
 */
function comfortableStepFrom(weights: number[]): number {
  let total = 0;
  for (const weight of weights) total += weight;
  if (total <= 0) return maxStepFrom(weights);

  let largest = 0;
  for (let size = 1; size < weights.length; size += 1) {
    if (weights[size] / total >= 0.1) largest = size;
  }
  return largest > 0 ? largest : maxStepFrom(weights);
}

/**
 * Whether a distance can be closed in exactly this many steps.
 *
 * Exactly, not at most — a recurring note falls on a fixed beat, so arriving early is as
 * wrong as arriving late. With one step left the distance has to be a single step: zero is
 * not allowed, because a step of nothing is not a step.
 */
function reachable(distance: number, steps: number, maxStep: number): boolean {
  if (steps <= 0) return distance === 0;
  if (distance > steps * maxStep) return false;
  if (steps === 1) return distance >= 1 && distance <= maxStep;
  return true;
}

/**
 * Builds a phrase.
 *
 * The rhythm is decided before the notes, and that order matters. A held or silent beat
 * sounds no new note, so the step from one note to the next is measured between the beats
 * that actually *sound* — deciding pitches first and then hiding some of them would let two
 * sounded notes end up eight semitones apart while every written step looked small.
 */
export function randomPhrase(options: RandomPhraseOptions): Token[] {
  const random = options.random ?? Math.random;
  const count = Math.max(0, Math.floor(options.count));
  if (count === 0) return [];

  const weights = options.stepWeights ?? DEFAULT_STEP_WEIGHTS;
  const maxStep = maxStepFrom(weights);
  const comfortable = comfortableStepFrom(weights);

  const lowest = Math.ceil(Math.min(options.lowest, options.highest));
  const highest = Math.floor(Math.max(options.lowest, options.highest));

  if (highest < lowest || maxStep === 0) {
    const still = Math.min(highest, Math.max(lowest, 0));
    const value = Number.isFinite(still) ? still : 0;
    return new Array(count).fill(null).map(() => ({ kind: 'note', semitones: value }) as Token);
  }

  const period = Math.max(0, Math.floor(options.anchorEvery ?? 0));
  const half = period >= 2 && (options.midpointAnchor ?? true) ? Math.floor(period / 2) : 0;

  const classes = new Set((options.allowedPitchClasses ?? []).map((c) => ((c % 12) + 12) % 12));
  const restricted = classes.size > 0;
  const isAllowed = (note: number): boolean =>
    !restricted || classes.has(((note % 12) + 12) % 12);

  /** The nearest usable note, for when a chosen one is not on the lattice. */
  const snap = (note: number): number => {
    if (isAllowed(note)) return note;
    for (let distance = 1; distance <= 12; distance += 1) {
      if (note - distance >= lowest && isAllowed(note - distance)) return note - distance;
      if (note + distance <= highest && isAllowed(note + distance)) return note + distance;
    }
    return note;
  };

  // Somewhere in the middle of the range, so the line has room on both sides of it.
  const anchor = snap(
    clamp(
      options.anchorNote ?? Math.round(lowest / 2 + random() * (highest / 2 - lowest / 2)),
      lowest,
      highest,
    ),
  );

  /**
   * Which notes can reach a target in exactly so many steps, when the lattice is uneven.
   *
   * The arithmetic test below is exact only when every semitone is available. Restrict the
   * pitch classes and it starts promising arrivals that cannot happen: among the shuddha
   * swaras there is no note one semitone above Sa, so "four away in two steps" may be true by
   * arithmetic and false in fact. Walking the lattice backwards from the target gives the
   * real answer, and it is cheap — a couple of targets, a handful of step limits, a few
   * layers each.
   */
  const reachCache = new Map<string, Set<number>[]>();

  const layersTo = (target: number, limit: number): Set<number>[] => {
    const key = `${target}:${limit}`;
    const cached = reachCache.get(key);
    if (cached) return cached;

    const layers: Set<number>[] = [new Set([target])];
    const depth = Math.max(2, period + 1);

    for (let step = 1; step <= depth; step += 1) {
      const next = new Set<number>();
      for (const note of layers[step - 1]) {
        for (let size = 1; size <= limit; size += 1) {
          for (const direction of [-1, 1]) {
            const from = note + direction * size;
            if (from < lowest || from > highest || !isAllowed(from)) continue;
            next.add(from);
          }
        }
      }
      layers.push(next);
    }

    reachCache.set(key, layers);
    return layers;
  };

  const canReach = (from: number, target: number, steps: number, limit: number): boolean => {
    if (!restricted) return reachable(Math.abs(target - from), steps, limit);
    if (steps <= 0) return from === target;
    const layers = layersTo(target, limit);
    return steps < layers.length ? layers[steps].has(from) : false;
  };

  /** One step size, drawn from the weights. */
  const drawStep = (): number => {
    let total = 0;
    for (let size = 1; size <= maxStep; size += 1) total += weights[size] ?? 0;
    if (total <= 0) return 1;

    let pick = random() * total;
    for (let size = 1; size <= maxStep; size += 1) {
      pick -= weights[size] ?? 0;
      if (pick < 0) return size;
    }
    return maxStep;
  };

  const isRequiredBeat = (index: number): boolean => {
    if (period <= 0) return index === 0;
    const phase = index % period;
    return phase === 0 || (half > 0 && phase === half);
  };

  /* ------------------------------------------------------------------- rhythm */

  const hold = clamp01(options.holdChance ?? 0.2);
  const rest = clamp01(options.restChance ?? 0.09);

  const kinds: Token['kind'][] = [];
  for (let i = 0; i < count; i += 1) {
    if (i === 0 || isRequiredBeat(i)) {
      kinds.push('note');
      continue;
    }

    // Nothing may follow a rest but a note. Two rests in a row is the obvious case; a hold
    // after a rest is the same thing written differently, because a hold extends whatever
    // came before it — including silence — and the ear hears two beats of nothing either way.
    if (kinds[i - 1] === 'rest') {
      kinds.push('note');
      continue;
    }

    const roll = random();
    kinds.push(roll < hold ? 'hold' : roll < hold + rest ? 'rest' : 'note');
  }

  // Every gap between recurring notes keeps at least two sounding beats. Without this a whole
  // gap can go silent, leaving one step to cover whatever distance separates the two notes —
  // which forces a leap larger than the weights allow, or an outright jump.
  for (let start = 1; start < count; start += 1) {
    if (kinds[start] !== 'note' || !isRequiredBeat(start)) continue;
  }
  enforceMinimumSounding(kinds, isRequiredBeat, random);

  const soundingAt: number[] = [];
  for (let i = 0; i < count; i += 1) if (kinds[i] === 'note') soundingAt.push(i);

  /* ------------------------------------------------------------------ midpoint */

  // The fewest sounded notes between any two recurring beats: the midpoint has to be
  // reachable in that many steps, so it is chosen by taking that many.
  let shortestGap = Infinity;
  let previousRequired = -1;
  for (const index of soundingAt) {
    if (!isRequiredBeat(index)) continue;
    if (previousRequired >= 0) {
      const between = soundingAt.filter((i) => i > previousRequired && i <= index).length;
      shortestGap = Math.min(shortestGap, between);
    }
    previousRequired = index;
  }
  if (!Number.isFinite(shortestGap)) shortestGap = 2;

  /**
   * One note for the whole phrase, used at every midpoint.
   *
   * Chosen by walking there under the same weights, rather than by picking a note and hoping
   * the line can reach it. Picking uniformly was the obvious approach and it quietly rewrote
   * the step distribution: a distant midpoint has to be reached in a fixed number of steps,
   * which means large ones the whole way.
   */
  let midpoint: number | null = null;
  if (half > 0) {
    for (let attempt = 0; attempt < 8 && midpoint === null; attempt += 1) {
      let value = anchor;
      for (let step = 0; step < Math.max(1, shortestGap); step += 1) {
        // Tries the drawn step first, then the other direction, then anything usable: on a
        // restricted lattice most of the twenty-four possible moves land on nothing.
        const wanted = drawStep();
        const order: number[] = [wanted];
        for (let size = 1; size <= maxStep; size += 1) if (size !== wanted) order.push(size);

        let moved = false;
        for (const size of order) {
          for (const direction of random() < 0.5 ? [-1, 1] : [1, -1]) {
            const to = value + direction * size;
            if (to < lowest || to > highest || !isAllowed(to)) continue;
            value = to;
            moved = true;
            break;
          }
          if (moved) break;
        }
      }
      if (value !== anchor && value >= lowest && value <= highest) midpoint = value;
    }

    // The nearest usable note that is not the anchor. Reaching for `anchor + 1` was the
    // obvious fallback and it was wrong the moment the lattice stopped being every semitone:
    // one above Sa is not a note in most of them, and the midpoint quietly left the set the
    // rest of the phrase was confined to.
    if (midpoint === null) {
      for (let distance = 1; distance <= 12 && midpoint === null; distance += 1) {
        for (const direction of [1, -1]) {
          const candidate = anchor + direction * distance;
          if (candidate < lowest || candidate > highest) continue;
          if (!isAllowed(candidate)) continue;
          midpoint = candidate;
          break;
        }
      }
    }
  }

  const requiredAt = (index: number): number | null => {
    if (period <= 0) return index === 0 ? anchor : null;
    const phase = index % period;
    if (phase === 0) return anchor;
    if (half > 0 && phase === half && midpoint !== null) return midpoint;
    return null;
  };

  /* -------------------------------------------------------------------- notes */

  const values = new Map<number, number>();
  let current = anchor;
  values.set(soundingAt[0], anchor);

  for (let n = 1; n < soundingAt.length; n += 1) {
    const index = soundingAt[n];
    const required = requiredAt(index);

    // How many sounded notes remain before the next one that is pinned, and what it must be.
    let target: { steps: number; value: number } | null = null;
    if (required === null) {
      for (let m = n + 1; m < soundingAt.length; m += 1) {
        const value = requiredAt(soundingAt[m]);
        if (value !== null) {
          target = { steps: m - n, value };
          break;
        }
      }
    }

    const candidates: { to: number; weight: number; need: number }[] = [];

    for (let size = 1; size <= maxStep; size += 1) {
      const weight = weights[size] ?? 0;
      if (weight <= 0) continue;

      for (const direction of [-1, 1]) {
        const to = current + direction * size;
        if (to < lowest || to > highest || !isAllowed(to)) continue;

        if (required !== null) {
          if (to === required) candidates.push({ to, weight, need: 1 });
          continue;
        }

        if (target) {
          if (!canReach(to, target.value, target.steps, maxStep)) continue;

          let need = maxStep;
          for (let size2 = 1; size2 <= maxStep; size2 += 1) {
            if (canReach(to, target.value, target.steps, size2)) {
              need = size2;
              break;
            }
          }
          candidates.push({ to, weight, need });
          continue;
        }

        candidates.push({ to, weight, need: 1 });
      }
    }

    if (candidates.length === 0) {
      current = required !== null ? required : current;
      values.set(index, current);
      continue;
    }

    /*
     * Prefer candidates that leave the line free, in tiers.
     *
     * Three attempts at this, and the numbers decided it. Judging reachability by the largest
     * possible step let the rarest step run at 7.5% against the 3% it was given; taking the
     * strict minimum made the line hug its target and was worse again at 5.2%. Grouping the
     * small steps into one tier leaves enough freedom to wander without needing a leap back.
     */
    let usable = candidates.filter((candidate) => candidate.need <= 2);
    if (usable.length === 0) usable = candidates.filter((candidate) => candidate.need <= comfortable);
    if (usable.length === 0) usable = candidates;

    let total = 0;
    for (const candidate of usable) total += candidate.weight;

    let pick = random() * total;
    let chosen = usable[usable.length - 1].to;
    for (const candidate of usable) {
      pick -= candidate.weight;
      if (pick < 0) {
        chosen = candidate.to;
        break;
      }
    }

    current = chosen;
    values.set(index, current);
  }

  const tokens: Token[] = kinds.map((kind, index) =>
    kind === 'note' ? { kind: 'note', semitones: values.get(index) ?? anchor } : { kind },
  );

  return applyLoopBacks(tokens, {
    loops: Math.max(0, Math.floor(options.loopBacks ?? 2)),
    block: half > 0 ? half : period,
    random,
  });
}

/**
 * Repeats a couple of earlier stretches later in the phrase.
 *
 * Copies are grid-aligned and only ever move between stretches at the same position within a
 * period, which is what makes this safe to do after the fact rather than during generation:
 * both stretches begin on the same recurring note and lead into the same one, so the step
 * limit at each seam, the recurring notes themselves, and the rule against two silences in a
 * row all hold for the copy exactly as they held for the original.
 *
 * The stretches either side of a copy always begin on a note, so a copy can never place a
 * rest against a rest.
 */
function applyLoopBacks(
  tokens: Token[],
  options: { loops: number; block: number; random: () => number },
): Token[] {
  const { loops, block, random } = options;
  if (loops <= 0 || block <= 0) return tokens;

  const blocks = Math.floor(tokens.length / block);
  if (blocks < 3) return tokens;

  const out = tokens.slice();
  const used = new Set<number>();

  for (let attempt = 0; attempt < loops * 6 && used.size < loops; attempt += 1) {
    // Somewhere past the opening, so there is something behind it to repeat.
    const destination = 2 + Math.floor(random() * (blocks - 2));
    if (used.has(destination)) continue;

    // Same position within the period, or the stretch would begin on the wrong note.
    const sources: number[] = [];
    for (let source = 0; source < destination; source += 1) {
      if (source % 2 === destination % 2) sources.push(source);
    }
    if (sources.length === 0) continue;

    const source = sources[Math.min(sources.length - 1, Math.floor(random() * sources.length))];

    for (let offset = 0; offset < block; offset += 1) {
      const from = source * block + offset;
      const to = destination * block + offset;
      if (to < out.length && from < out.length) out[to] = tokens[from];
    }

    used.add(destination);
  }

  return out;
}

/**
 * Puts a sounding beat back wherever a gap between recurring notes fell entirely silent.
 *
 * A gap of one leaves a single step to cover whatever distance separates two pinned notes,
 * which either forces a leap past the limit or an outright jump. Two is the minimum that
 * leaves the walk any freedom at all.
 */
function enforceMinimumSounding(
  kinds: Token['kind'][],
  isRequiredBeat: (index: number) => boolean,
  random: () => number,
): void {
  let runStart = -1;

  for (let i = 1; i <= kinds.length; i += 1) {
    const ends = i === kinds.length || isRequiredBeat(i);

    if (!ends) {
      if (runStart < 0) runStart = i;
      continue;
    }

    if (runStart >= 0) {
      const run: number[] = [];
      for (let j = runStart; j < i; j += 1) run.push(j);
      const sounding = run.filter((j) => kinds[j] === 'note').length;

      if (sounding === 0 && run.length > 0) {
        kinds[run[Math.min(run.length - 1, Math.floor(random() * run.length))]] = 'note';
      }
      runStart = -1;
    }
  }
}

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.min(high, Math.max(low, Math.round(value)));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** The notes that actually sound, in order. */
export function soundedNotes(tokens: Token[]): number[] {
  const notes: number[] = [];
  for (const token of tokens) if (token.kind === 'note') notes.push(token.semitones);
  return notes;
}

/** The phrase as sargam, ready to be read, edited or parsed back. */
export function phraseToSargam(tokens: Token[]): string {
  return tokens
    .map((token) =>
      token.kind === 'note' ? toSargam(token.semitones) : token.kind === 'hold' ? '-' : '_',
    )
    .join(' ');
}

/** The largest jump between sounded notes. */
export function largestStep(notes: number[]): number {
  let worst = 0;
  for (let i = 1; i < notes.length; i += 1) {
    worst = Math.max(worst, Math.abs(notes[i] - notes[i - 1]));
  }
  return worst;
}

/**
 * How many times each step size was used between sounded notes.
 *
 * Reported rather than assumed: the recurring notes override the weights whenever they have
 * to, and the difference is worth being able to see.
 */
export function stepHistogram(notes: number[]): number[] {
  const counts: number[] = [];
  for (let i = 1; i < notes.length; i += 1) {
    const size = Math.abs(notes[i] - notes[i - 1]);
    counts[size] = (counts[size] ?? 0) + 1;
  }
  for (let i = 0; i < counts.length; i += 1) counts[i] = counts[i] ?? 0;
  return counts;
}
