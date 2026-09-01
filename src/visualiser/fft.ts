/**
 * A radix-2 Cooley-Tukey FFT, written out rather than pulled in as a dependency.
 *
 * The visualiser needs exactly one thing from the frequency domain — a magnitude spectrum
 * per audio buffer — and this runs roughly forty times a second on the JS thread, so it is
 * worth being small and allocation-free rather than general.
 */

/** Largest power of two that fits in `length`. FFT sizes must be exact powers of two. */
export function largestPowerOfTwo(length: number): number {
  if (length < 2) return 0;
  return 2 ** Math.floor(Math.log2(length));
}

/**
 * A Hann window, cached per size.
 *
 * An FFT treats its input as one period of an infinitely repeating signal. A raw buffer
 * almost never ends where it began, and that discontinuity smears energy across every bin —
 * spectral leakage, which would drag the centroid upward on every frame. Tapering the buffer
 * to zero at both ends removes the seam.
 */
const windowCache = new Map<number, Float64Array>();

export function hannWindow(size: number): Float64Array {
  const cached = windowCache.get(size);
  if (cached) return cached;

  const window = new Float64Array(size);
  for (let i = 0; i < size; i += 1) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }

  windowCache.set(size, window);
  return window;
}

/**
 * In-place complex FFT. `re` and `im` must be the same length and a power of two.
 *
 * Iterative rather than recursive: no call stack per stage, and no garbage per frame.
 */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;

  // Bit-reversal permutation. The butterflies below assume input in this order.
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;

    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    const half = len >> 1;

    for (let start = 0; start < n; start += len) {
      // The twiddle factor is advanced by repeated multiplication rather than a cos/sin per
      // butterfly — the same reason FFTs are fast in the first place.
      let cr = 1;
      let ci = 0;

      for (let k = 0; k < half; k += 1) {
        const a = start + k;
        const b = a + half;

        const vr = re[b] * cr - im[b] * ci;
        const vi = re[b] * ci + im[b] * cr;

        re[b] = re[a] - vr;
        im[b] = im[a] - vi;
        re[a] += vr;
        im[a] += vi;

        const nextCr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nextCr;
      }
    }
  }
}

/**
 * Magnitude spectrum of a real signal, windowed.
 *
 * Only bins `0 … size/2` are returned: a real input produces a spectrum that is mirrored
 * about Nyquist, so the upper half carries no additional information.
 */
export function magnitudeSpectrum(samples: ArrayLike<number>, size: number): Float64Array {
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const window = hannWindow(size);

  for (let i = 0; i < size; i += 1) {
    re[i] = (samples[i] ?? 0) * window[i];
  }

  fftInPlace(re, im);

  const bins = (size >> 1) + 1;
  const magnitudes = new Float64Array(bins);
  for (let i = 0; i < bins; i += 1) {
    magnitudes[i] = Math.hypot(re[i], im[i]);
  }

  return magnitudes;
}
