package expo.modules.musiclibrary

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin

/**
 * Radix-2 Cooley-Tukey FFT.
 *
 * A direct port of `src/visualiser/fft.ts`, kept deliberately line-for-line comparable with it.
 * The TypeScript version is the reference implementation and carries the tests that pin the
 * behaviour down — a 440 Hz sine must produce a centroid of 440 Hz, and so on. This copy exists
 * only because running it here avoids moving megabytes of PCM across the bridge.
 *
 * If the two ever disagree, the TypeScript one is right.
 */
internal object Fft {

  /**
   * A Hann window, built once per size.
   *
   * An FFT treats its input as one period of a repeating signal. A raw buffer almost never ends
   * where it began, and that discontinuity smears energy across every bin, which would drag the
   * centroid upward on every frame.
   */
  private val windowCache = HashMap<Int, DoubleArray>()

  fun hannWindow(size: Int): DoubleArray = windowCache.getOrPut(size) {
    DoubleArray(size) { i -> 0.5 * (1 - cos(2.0 * PI * i / (size - 1))) }
  }

  /** In-place complex FFT. `re` and `im` must be the same length and a power of two. */
  fun transform(re: DoubleArray, im: DoubleArray) {
    val n = re.size

    // Bit-reversal permutation; the butterflies below assume this ordering.
    var j = 0
    for (i in 1 until n) {
      var bit = n shr 1
      while (j and bit != 0) {
        j = j xor bit
        bit = bit shr 1
      }
      j = j xor bit

      if (i < j) {
        val tr = re[i]; re[i] = re[j]; re[j] = tr
        val ti = im[i]; im[i] = im[j]; im[j] = ti
      }
    }

    var len = 2
    while (len <= n) {
      val angle = -2.0 * PI / len
      val wr = cos(angle)
      val wi = sin(angle)
      val half = len shr 1

      var start = 0
      while (start < n) {
        // The twiddle factor is advanced by multiplication rather than a cos/sin per butterfly.
        var cr = 1.0
        var ci = 0.0

        for (k in 0 until half) {
          val a = start + k
          val b = a + half

          val vr = re[b] * cr - im[b] * ci
          val vi = re[b] * ci + im[b] * cr

          re[b] = re[a] - vr
          im[b] = im[a] - vi
          re[a] += vr
          im[a] += vi

          val nextCr = cr * wr - ci * wi
          ci = cr * wi + ci * wr
          cr = nextCr
        }
        start += len
      }
      len = len shl 1
    }
  }

  /**
   * Energy-weighted mean frequency of one windowed frame, in Hz.
   *
   * Bin 0 is skipped: it is DC, a constant offset with no pitch, and including it drags the
   * centroid toward zero on any signal with even a slight bias.
   */
  fun spectralCentroid(frame: DoubleArray, sampleRate: Int): Double {
    val size = frame.size
    val re = DoubleArray(size)
    val im = DoubleArray(size)
    val window = hannWindow(size)

    for (i in 0 until size) re[i] = frame[i] * window[i]

    transform(re, im)

    var weighted = 0.0
    var total = 0.0
    for (bin in 1..size / 2) {
      val magnitude = hypot(re[bin], im[bin])
      weighted += (bin.toDouble() * sampleRate / size) * magnitude
      total += magnitude
    }

    return if (total > 0.0) weighted / total else 0.0
  }
}
