/**
 * Turns samples into a WAV file's bytes.
 *
 * This is the bridge between the generator and the rest of the app. Everything upstream is
 * maths producing numbers between -1 and 1; everything downstream — the player, the queue,
 * the lock screen, the visualiser's own analyser — expects an audio file on disk. This is the
 * only place that knows about either.
 *
 * **16-bit signed PCM, little-endian, mono.** Not a default worth changing casually:
 *
 * - *16-bit integer, not 32-bit float.* WAV can carry float samples, but Android's decoders
 *   are only reliably obliged to handle integer PCM. A file that plays in a desktop editor
 *   and silently fails on the device would be a poor trade for precision nobody can hear.
 * - *Mono.* The generator writes one voice at a time and there is no spatialisation yet.
 *   Stereo would double the file for two identical channels.
 *
 * Nothing here is async and nothing here touches the filesystem, which is the point: it can
 * be tested exactly, and the same bytes can be handed to a browser for an audible preview.
 */

/** Bytes in the canonical WAV header this writes. */
export const WAV_HEADER_BYTES = 44;

/** The full-scale value for signed 16-bit audio. */
const FULL_SCALE = 32767;

export type WavOptions = {
  /** Samples per second. 44100 unless there is a reason. */
  sampleRate: number;
};

/**
 * Encodes samples as a complete WAV file.
 *
 * Values outside -1..1 are clipped rather than scaled: a generator that overshoots has a bug
 * in its gain staging, and quietly normalising the whole piece would hide it while changing
 * every other note's level. Clipping is audible, which is the correct behaviour for a fault.
 *
 * Non-finite values become silence. They should never arrive — but a NaN written into an
 * audio file is a burst of full-scale noise, and that is worth one comparison per sample to
 * avoid.
 */
export function encodeWav(samples: Float32Array, options: WavOptions): Uint8Array {
  const { sampleRate } = options;

  if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
    throw new Error(`sampleRate must be a positive integer, got ${sampleRate}`);
  }

  const channels = 1;
  const bytesPerSample = 2;
  const dataBytes = samples.length * bytesPerSample;

  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);

  // --- RIFF chunk -------------------------------------------------------------------
  writeAscii(view, 0, 'RIFF');
  // Everything after this field. The header is 44 bytes, 8 of which precede it.
  view.setUint32(4, WAV_HEADER_BYTES - 8 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');

  // --- fmt subchunk -----------------------------------------------------------------
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk size for PCM
  view.setUint16(20, 1, true); // 1 = uncompressed PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true); // byte rate
  view.setUint16(32, channels * bytesPerSample, true); // block align
  view.setUint16(34, bytesPerSample * 8, true); // bits per sample

  // --- data subchunk ----------------------------------------------------------------
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(WAV_HEADER_BYTES + i * bytesPerSample, toPcm16(samples[i]), true);
  }

  return new Uint8Array(buffer);
}

/** How long a run of samples lasts, in seconds. */
export function durationSeconds(sampleCount: number, sampleRate: number): number {
  if (!(sampleRate > 0)) return 0;
  return sampleCount / sampleRate;
}

/**
 * One sample, as signed 16-bit.
 *
 * Scaled by 32767 rather than 32768 so that +1 lands exactly on the positive maximum instead
 * of wrapping to the negative one — an off-by-one that turns the loudest peaks into a click.
 */
function toPcm16(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const clipped = value > 1 ? 1 : value < -1 ? -1 : value;
  return Math.round(clipped * FULL_SCALE);
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
