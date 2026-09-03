/**
 * A continuous pitch line through a sequence of notes.
 *
 * Each note becomes a turning point — a crest or a trough — and the pitch moves smoothly
 * between them instead of stepping. This is meend, and it is a large part of why a written
 * phrase and a played phrase sound like different things: the swaras are the same, but a
 * player arrives at them rather than jumping to them.
 *
 * Two decisions worth stating, because both are audible:
 *
 * - **Interpolation happens in log frequency, not hertz.** Halfway between 200 Hz and 400 Hz
 *   by ear is the octave's midpoint, about 283 Hz, not 300. Interpolating linearly in hertz
 *   makes every rising glide drag and every falling one hurry.
 * - **A monotone cubic, not smoothstep.** Smoothstep has zero derivative at *both* ends of
 *   every segment, which puts a flat spot on every note whether or not the line is turning
 *   there — a rising run comes out as a staircase of little plateaux rather than a climb.
 *   The tangents here come from the neighbouring secants and are forced to zero only where
 *   the direction actually reverses, so a note in the middle of a run is passed through and
 *   a note at the top of one is a genuine peak.
 *
 *   Fritsch and Carlson's condition keeps it monotone between nodes, which is what stops it
 *   overshooting: a glide never sounds a pitch that was not asked for, which an ordinary
 *   Catmull-Rom happily would.
 */

export type GlideNode = {
  /** The pitch to arrive at, in hertz. */
  hz: number;
  /** How long this note occupies, in beats. */
  beats: number;
};

export type GlideOptions = {
  nodes: GlideNode[];
  /** Resolution of the returned curve. */
  samplesPerBeat: number;
  /**
   * How much of the time between two notes is spent moving, from 0 to 1.
   *
   * At 1 the line is always travelling and every note is an instantaneous turning point — a
   * pure glide, no rest anywhere. At 0 it never travels and the result is the ordinary
   * stepped melody. In between, each note is held and then joined to the next, which is
   * nearer to how meend is actually played: the note is a place, not a corner.
   */
  glide: number;
};

/**
 * Tangents for a monotone cubic through these points.
 *
 * Each interior tangent starts as the average of the secants either side. Where those secants
 * disagree in sign the point is a turn and the tangent is set to zero; where they agree it is
 * kept, so the line runs through the note rather than stopping on it. Fritsch and Carlson's
 * circle condition then limits any tangent that would make the segment overshoot.
 */
function monotoneTangents(xs: number[], ys: number[]): number[] {
  const count = xs.length;
  if (count < 2) return new Array(count).fill(0);

  const secants: number[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    const run = xs[i + 1] - xs[i];
    secants.push(run === 0 ? 0 : (ys[i + 1] - ys[i]) / run);
  }

  const tangents: number[] = new Array(count);
  tangents[0] = secants[0];
  tangents[count - 1] = secants[count - 2];
  for (let i = 1; i < count - 1; i += 1) {
    // Opposite signs mean this note is a peak or a trough, and only then is it flat.
    tangents[i] =
      secants[i - 1] * secants[i] <= 0 ? 0 : (secants[i - 1] + secants[i]) / 2;
  }

  for (let i = 0; i < count - 1; i += 1) {
    if (secants[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }

    const alpha = tangents[i] / secants[i];
    const beta = tangents[i + 1] / secants[i];
    const size = alpha * alpha + beta * beta;

    if (size > 9) {
      const scale = 3 / Math.sqrt(size);
      tangents[i] = scale * alpha * secants[i];
      tangents[i + 1] = scale * beta * secants[i];
    }
  }

  return tangents;
}

/** One cubic Hermite segment. */
function hermite(
  t: number,
  from: number,
  to: number,
  fromTangent: number,
  toTangent: number,
  run: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;

  return (
    (2 * t3 - 3 * t2 + 1) * from +
    (t3 - 2 * t2 + t) * run * fromTangent +
    (-2 * t3 + 3 * t2) * to +
    (t3 - t2) * run * toTangent
  );
}

/**
 * Samples the pitch line.
 *
 * Returns hertz per sample. A node's pitch is reached at the *centre* of its slot, so a long
 * note dwells around its pitch rather than passing through it at the boundary — which is
 * what makes duration audible as emphasis rather than only as length.
 */
export function glideCurve(options: GlideOptions): Float32Array {
  const { nodes, samplesPerBeat } = options;
  const glide = Number.isFinite(options.glide)
    ? Math.min(1, Math.max(0, options.glide))
    : 1;

  const usable = nodes.filter((n) => Number.isFinite(n.hz) && n.hz > 0 && n.beats > 0);
  if (usable.length === 0 || !(samplesPerBeat > 0)) return new Float32Array(0);

  const totalBeats = usable.reduce((sum, n) => sum + n.beats, 0);
  const count = Math.max(1, Math.round(totalBeats * samplesPerBeat));

  // Centres, and pitch in log space where interpolation belongs.
  const centres: number[] = [];
  const pitches: number[] = [];
  let cursor = 0;
  for (const node of usable) {
    centres.push(cursor + node.beats / 2);
    pitches.push(Math.log2(node.hz));
    cursor += node.beats;
  }

  const tangents = monotoneTangents(centres, pitches);
  const out = new Float32Array(count);
  let node = 0;

  for (let i = 0; i < count; i += 1) {
    const beat = (i / count) * totalBeats;

    // Flat before the first note and after the last: there is nothing to glide from or to.
    if (beat <= centres[0]) {
      out[i] = Math.pow(2, pitches[0]);
      continue;
    }
    if (beat >= centres[centres.length - 1]) {
      out[i] = Math.pow(2, pitches[pitches.length - 1]);
      continue;
    }

    while (node < centres.length - 2 && beat > centres[node + 1]) node += 1;

    const from = centres[node];
    const to = centres[node + 1];
    const run = to - from;
    const across = run === 0 ? 1 : (beat - from) / run;

    /*
     * Where along this segment the line has got to.
     *
     * At a full glide this is simply how far through the gap we are, and the cubic does the
     * rest. Below that the note is held first and then travelled, which is the meend shape —
     * the flat is asked for there, unlike the ones smoothstep used to leave everywhere.
     */
    let t: number;
    if (glide <= 0) {
      t = across < 1 ? 0 : 1;
    } else if (glide >= 1) {
      t = across;
    } else {
      const edge = (1 - glide) / 2;
      t = Math.min(1, Math.max(0, (across - edge) / glide));
    }

    out[i] = Math.pow(
      2,
      hermite(t, pitches[node], pitches[node + 1], tangents[node], tangents[node + 1], run),
    );
  }

  return out;
}

/**
 * The largest jump in the curve, in cents.
 *
 * A glide that steps by more than a few cents between samples is not a glide, it is a
 * staircase with small steps — useful for checking that the resolution is high enough before
 * blaming the synthesis for sounding gritty.
 */
export function largestStepCents(curve: Float32Array): number {
  let worst = 0;
  for (let i = 1; i < curve.length; i += 1) {
    if (!(curve[i] > 0) || !(curve[i - 1] > 0)) continue;
    worst = Math.max(worst, Math.abs(1200 * Math.log2(curve[i] / curve[i - 1])));
  }
  return worst;
}
