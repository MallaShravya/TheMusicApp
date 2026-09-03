import { durationSeconds, encodeWav, WAV_HEADER_BYTES } from '../wav';

/**
 * Checks the bytes against the WAV specification rather than against itself.
 *
 * A header that a test agrees with but Android does not is worth nothing, so every field is
 * read back at its documented offset with its documented type, and the samples are decoded
 * the way a player would decode them.
 */
function read(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, length: number) =>
    Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('');

  return {
    riff: ascii(0, 4),
    chunkSize: view.getUint32(4, true),
    wave: ascii(8, 4),
    fmt: ascii(12, 4),
    subchunkSize: view.getUint32(16, true),
    audioFormat: view.getUint16(20, true),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bitsPerSample: view.getUint16(34, true),
    data: ascii(36, 4),
    dataSize: view.getUint32(40, true),
    sample: (i: number) => view.getInt16(WAV_HEADER_BYTES + i * 2, true),
  };
}

describe('the WAV header', () => {
  const wav = encodeWav(new Float32Array(100), { sampleRate: 44100 });
  const header = read(wav);

  it('is a RIFF/WAVE file', () => {
    expect(header.riff).toBe('RIFF');
    expect(header.wave).toBe('WAVE');
    expect(header.fmt).toBe('fmt ');
    expect(header.data).toBe('data');
  });

  it('declares uncompressed 16-bit mono PCM', () => {
    expect(header.audioFormat).toBe(1);
    expect(header.channels).toBe(1);
    expect(header.bitsPerSample).toBe(16);
    expect(header.subchunkSize).toBe(16);
  });

  it('states a byte rate and block align consistent with that format', () => {
    // A player uses these to seek. If they disagree with the format, position is wrong
    // everywhere while the audio still sounds correct — a difficult bug to see.
    expect(header.blockAlign).toBe(header.channels * (header.bitsPerSample / 8));
    expect(header.byteRate).toBe(header.sampleRate * header.blockAlign);
  });

  it('sizes both chunks to the actual file', () => {
    expect(header.dataSize).toBe(100 * 2);
    expect(header.chunkSize).toBe(wav.byteLength - 8);
    expect(wav.byteLength).toBe(WAV_HEADER_BYTES + 100 * 2);
  });

  it('carries the sample rate it was given', () => {
    expect(read(encodeWav(new Float32Array(4), { sampleRate: 22050 })).sampleRate).toBe(22050);
  });
});

describe('sample conversion', () => {
  const encode = (values: number[]) =>
    read(encodeWav(Float32Array.from(values), { sampleRate: 44100 }));

  it('puts silence at zero', () => {
    expect(encode([0]).sample(0)).toBe(0);
  });

  it('maps full scale without wrapping', () => {
    // The failure this guards: scaling by 32768 makes +1 overflow to -32768, so the loudest
    // peak in a piece inverts and clicks.
    expect(encode([1]).sample(0)).toBe(32767);
    expect(encode([-1]).sample(0)).toBe(-32767);
  });

  it('clips rather than wrapping or normalising', () => {
    const header = encode([2, -2, 1.0001]);
    expect(header.sample(0)).toBe(32767);
    expect(header.sample(1)).toBe(-32767);
    expect(header.sample(2)).toBe(32767);
  });

  it('writes non-finite values as silence, not as noise', () => {
    // A NaN reaching a 16-bit conversion is full-scale noise: alarming, and hard to trace
    // back. The infinities go the same way — an infinite sample is a diverged oscillator, not
    // a request for maximum level, and clipping it would make a broken patch merely loud
    // rather than obviously wrong.
    const header = encode([NaN, Infinity, -Infinity]);
    expect(header.sample(0)).toBe(0);
    expect(header.sample(1)).toBe(0);
    expect(header.sample(2)).toBe(0);
  });

  it('round-trips a signal within one step of quantisation', () => {
    const values = Array.from({ length: 512 }, (_, i) => Math.sin((i / 512) * Math.PI * 8) * 0.8);
    const header = encode(values);

    for (let i = 0; i < values.length; i += 1) {
      expect(Math.abs(header.sample(i) / 32767 - values[i])).toBeLessThan(1 / 32767);
    }
  });

  it('is little-endian, as the format requires', () => {
    const bytes = encodeWav(Float32Array.from([1]), { sampleRate: 44100 });
    // 32767 = 0x7FFF, so low byte first.
    expect(bytes[WAV_HEADER_BYTES]).toBe(0xff);
    expect(bytes[WAV_HEADER_BYTES + 1]).toBe(0x7f);
  });
});

describe('edges', () => {
  it('writes a valid, empty file for no samples', () => {
    const wav = encodeWav(new Float32Array(0), { sampleRate: 44100 });
    expect(wav.byteLength).toBe(WAV_HEADER_BYTES);
    expect(read(wav).dataSize).toBe(0);
    expect(read(wav).riff).toBe('RIFF');
  });

  it('refuses a sample rate that cannot describe audio', () => {
    for (const rate of [0, -1, 44100.5, NaN]) {
      expect(() => encodeWav(new Float32Array(1), { sampleRate: rate })).toThrow(/sampleRate/);
    }
  });

  it('reports duration from the sample count', () => {
    expect(durationSeconds(44100, 44100)).toBe(1);
    expect(durationSeconds(22050, 44100)).toBe(0.5);
    expect(durationSeconds(0, 44100)).toBe(0);
    expect(durationSeconds(100, 0)).toBe(0);
  });
});
