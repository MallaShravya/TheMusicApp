package expo.modules.musiclibrary

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * Decodes a track and measures it, so the visualiser never has to listen to playback.
 *
 * The obvious way to drive an audio visualiser on Android is `android.media.audiofx.Visualizer`,
 * which taps the output session — that is what `expo-audio`'s sampling does. It requires
 * `RECORD_AUDIO`, because tapping an output session can capture audio regardless of whether a
 * microphone is involved. Since we already have read access to the file, decoding it directly
 * asks for nothing extra.
 *
 * Decoding also buys something live sampling cannot: the whole waveform is known before the
 * first frame is drawn, so each track can be normalised against its own range rather than a
 * fixed guess. That normalising happens in TypeScript — see `src/visualiser/trackAnalysis.ts`.
 */
internal class TrackAnalyser(private val context: Context) {

  /**
   * Returns per-frame RMS and spectral centroid for a track.
   *
   * Raw measurements only. Every perceptual decision — decibels, octaves, percentile ranges —
   * is made on the JavaScript side where it is covered by tests.
   */
  fun analyse(uri: String, hopMs: Int): Map<String, Any?> {
    val extractor = MediaExtractor()

    return try {
      extractor.setDataSource(context, Uri.parse(uri), null)

      val trackIndex = firstAudioTrack(extractor)
        ?: return empty(hopMs)

      extractor.selectTrack(trackIndex)
      val inputFormat = extractor.getTrackFormat(trackIndex)
      decode(extractor, inputFormat, hopMs)
    } catch (e: Exception) {
      // A track that will not decode is not an error worth failing playback over — the fire
      // simply idles. Corrupt files and unsupported codecs both land here.
      empty(hopMs)
    } finally {
      runCatching { extractor.release() }
    }
  }

  private fun firstAudioTrack(extractor: MediaExtractor): Int? {
    for (index in 0 until extractor.trackCount) {
      val mime = extractor.getTrackFormat(index).getString(MediaFormat.KEY_MIME) ?: continue
      if (mime.startsWith("audio/")) return index
    }
    return null
  }

  private fun decode(
    extractor: MediaExtractor,
    inputFormat: MediaFormat,
    hopMs: Int,
  ): Map<String, Any?> {
    val mime = inputFormat.getString(MediaFormat.KEY_MIME) ?: return empty(hopMs)
    val sourceRate = inputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
    val channels = inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)

    // Decimate toward TARGET_RATE by an integer factor, and report the rate we actually got.
    // A non-integer resample would need a proper filter for no benefit here.
    val decimation = max(1, (sourceRate.toDouble() / TARGET_RATE).roundToInt())
    val analysisRate = sourceRate / decimation

    val hopSamples = max(1, analysisRate * hopMs / 1000)

    val codec = MediaCodec.createDecoderByType(mime)
    codec.configure(inputFormat, null, null, 0)
    codec.start()

    val rms = ArrayList<Double>()
    val centroid = ArrayList<Double>()

    // The decoded stream is consumed as it arrives rather than collected: a four-minute track
    // would otherwise be tens of megabytes of PCM held at once, on a phone, for nothing.
    val window = DoubleArray(FRAME_SIZE)
    var windowWrite = 0
    var windowFilled = 0
    var sinceLastFrame = 0

    // Leftovers of a partially averaged decimation block, carried across output buffers.
    var blockSum = 0.0
    var blockCount = 0

    val info = MediaCodec.BufferInfo()
    var sawInputEnd = false
    var sawOutputEnd = false
    var idleRounds = 0

    try {
      while (!sawOutputEnd) {
        if (!sawInputEnd) {
          val inputIndex = codec.dequeueInputBuffer(TIMEOUT_US)
          if (inputIndex >= 0) {
            val buffer = codec.getInputBuffer(inputIndex)!!
            val size = extractor.readSampleData(buffer, 0)

            if (size < 0) {
              codec.queueInputBuffer(
                inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM,
              )
              sawInputEnd = true
            } else {
              codec.queueInputBuffer(inputIndex, 0, size, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }

        val outputIndex = codec.dequeueOutputBuffer(info, TIMEOUT_US)
        if (outputIndex < 0) {
          // INFO_TRY_AGAIN_LATER and INFO_OUTPUT_FORMAT_CHANGED both mean "nothing yet". A
          // decoder that never reaches end-of-stream would spin here forever, so an idle
          // budget bounds it — a malformed file must not hang the app.
          idleRounds += 1
          if (idleRounds > MAX_IDLE_ROUNDS) break
          continue
        }
        idleRounds = 0

        val output = codec.getOutputBuffer(outputIndex)
        if (output != null && info.size > 0) {
          output.position(info.offset)
          output.limit(info.offset + info.size)

          val isFloat = pcmEncoding(codec.outputFormat) == AudioFormat.ENCODING_PCM_FLOAT
          val samples = readMonoSamples(output, channels, isFloat)

          for (sample in samples) {
            // Averaging each decimation block is a crude low-pass, which keeps content above
            // the new Nyquist from folding back down and biasing the centroid upward.
            blockSum += sample
            blockCount += 1
            if (blockCount < decimation) continue

            val decimated = blockSum / blockCount
            blockSum = 0.0
            blockCount = 0

            window[windowWrite] = decimated
            windowWrite = (windowWrite + 1) % FRAME_SIZE
            if (windowFilled < FRAME_SIZE) windowFilled += 1
            sinceLastFrame += 1

            if (windowFilled == FRAME_SIZE && sinceLastFrame >= hopSamples) {
              sinceLastFrame = 0
              val frame = orderedWindow(window, windowWrite)
              rms.add(frameRms(frame))
              centroid.add(Fft.spectralCentroid(frame, analysisRate))
            }
          }
        }

        codec.releaseOutputBuffer(outputIndex, false)
        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) sawOutputEnd = true
      }
    } finally {
      runCatching { codec.stop() }
      runCatching { codec.release() }
    }

    return mapOf(
      "sampleRate" to analysisRate,
      "hopMs" to hopMs,
      "rms" to rms.toDoubleArray(),
      "centroidHz" to centroid.toDoubleArray(),
    )
  }

  /** Downmixes to mono as it reads; the visualiser has no use for a stereo image. */
  private fun readMonoSamples(buffer: ByteBuffer, channels: Int, isFloat: Boolean): DoubleArray {
    buffer.order(ByteOrder.nativeOrder())

    val bytesPerSample = if (isFloat) 4 else 2
    val totalSamples = buffer.remaining() / bytesPerSample
    val frames = totalSamples / max(1, channels)
    val mono = DoubleArray(frames)

    for (frame in 0 until frames) {
      var sum = 0.0
      for (channel in 0 until channels) {
        sum += if (isFloat) {
          buffer.float.toDouble()
        } else {
          // 16-bit PCM is signed; scaling to ±1 keeps RMS comparable with the float path.
          buffer.short.toDouble() / 32768.0
        }
      }
      mono[frame] = sum / channels
    }

    return mono
  }

  private fun pcmEncoding(format: MediaFormat): Int =
    if (format.containsKey(MediaFormat.KEY_PCM_ENCODING)) {
      format.getInteger(MediaFormat.KEY_PCM_ENCODING)
    } else {
      AudioFormat.ENCODING_PCM_16BIT
    }

  /** Copies the circular buffer out in chronological order, oldest sample first. */
  private fun orderedWindow(window: DoubleArray, writeIndex: Int): DoubleArray {
    val frame = DoubleArray(FRAME_SIZE)
    for (i in 0 until FRAME_SIZE) {
      frame[i] = window[(writeIndex + i) % FRAME_SIZE]
    }
    return frame
  }

  private fun frameRms(frame: DoubleArray): Double {
    var sum = 0.0
    for (sample in frame) sum += sample * sample
    return sqrt(sum / frame.size)
  }

  private fun empty(hopMs: Int): Map<String, Any?> = mapOf(
    "sampleRate" to 0,
    "hopMs" to hopMs,
    "rms" to DoubleArray(0),
    "centroidHz" to DoubleArray(0),
  )

  companion object {
    /** Nyquist here is comfortably above the 6 kHz top of the brightness range. */
    private const val TARGET_RATE = 16000

    /** Power of two, as the FFT requires. ~35 ms at the analysis rate. */
    private const val FRAME_SIZE = 512

    private const val TIMEOUT_US = 10_000L

    /** ~10 s of empty polls at TIMEOUT_US. Reached only by a decoder that has stalled. */
    private const val MAX_IDLE_ROUNDS = 1000
  }
}
