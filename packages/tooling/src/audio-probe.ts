// Dependency-free audio header probing for `molen audio import|check`: duration, sample rate and
// channels of WAV, Ogg (Vorbis/Opus) and MP3 files. Enough to record `durationS` and sanity-check
// loop points; not a decoder.

export interface AudioProbe {
  format: 'wav' | 'ogg' | 'mp3' | 'unknown';
  durationS?: number;
  sampleRate?: number;
  channels?: number;
}

function ascii(b: Uint8Array, at: number, len: number): string {
  return String.fromCharCode(...b.subarray(at, at + len));
}

function probeWav(b: Uint8Array, v: DataView): AudioProbe {
  let at = 12;
  let byteRate = 0;
  let sampleRate: number | undefined;
  let channels: number | undefined;
  while (at + 8 <= b.length) {
    const id = ascii(b, at, 4);
    const size = v.getUint32(at + 4, true);
    if (id === 'fmt ') {
      channels = v.getUint16(at + 10, true);
      sampleRate = v.getUint32(at + 12, true);
      byteRate = v.getUint32(at + 16, true);
    } else if (id === 'data' && byteRate > 0) {
      const dataSize = Math.min(size, b.length - at - 8);
      return {
        format: 'wav',
        durationS: dataSize / byteRate,
        ...(sampleRate !== undefined ? { sampleRate } : {}),
        ...(channels !== undefined ? { channels } : {}),
      };
    }
    at += 8 + size + (size & 1);
  }
  return { format: 'wav' };
}

function probeOgg(b: Uint8Array, v: DataView): AudioProbe {
  let rate: number | undefined;
  let channels: number | undefined;
  let preSkip = 0;
  let opus = false;
  const head = ascii(b, 0, Math.min(b.length, 256));
  const vorbis = head.indexOf('\u0001vorbis');
  const opusHead = head.indexOf('OpusHead');
  if (vorbis >= 0) {
    channels = b[vorbis + 11];
    rate = v.getUint32(vorbis + 12, true);
  } else if (opusHead >= 0) {
    opus = true;
    channels = b[opusHead + 9];
    preSkip = v.getUint16(opusHead + 10, true);
    rate = 48000;
  }
  // The last page's granule position is the total sample count.
  for (let at = b.length - 27; at >= 0; at--) {
    if (b[at] === 0x4f && ascii(b, at, 4) === 'OggS') {
      const granule = Number(v.getBigUint64(at + 6, true));
      if (rate && granule > 0)
        return {
          format: 'ogg',
          durationS: (granule - (opus ? preSkip : 0)) / rate,
          sampleRate: opus ? v.getUint32(opusHead + 12, true) || 48000 : rate,
          ...(channels !== undefined ? { channels } : {}),
        };
      break;
    }
  }
  return { format: 'ogg' };
}

const MP3_BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MP3_BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const MP3_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
};

function probeMp3(b: Uint8Array, v: DataView): AudioProbe {
  let at = 0;
  if (ascii(b, 0, 3) === 'ID3') {
    const size = ((b[6] ?? 0) << 21) | ((b[7] ?? 0) << 14) | ((b[8] ?? 0) << 7) | (b[9] ?? 0);
    at = 10 + size;
  }
  for (; at + 4 < b.length; at++) {
    if (b[at] !== 0xff || ((b[at + 1] ?? 0) & 0xe0) !== 0xe0) continue;
    const h = v.getUint32(at, false);
    const version = (h >>> 19) & 3;
    const layer = (h >>> 17) & 3;
    const bitrateIndex = (h >>> 12) & 15;
    const rateIndex = (h >>> 10) & 3;
    if (
      version === 1 ||
      layer !== 1 ||
      bitrateIndex === 0 ||
      bitrateIndex === 15 ||
      rateIndex === 3
    )
      continue;
    const sampleRate = (MP3_RATES[version] as number[])[rateIndex] as number;
    const mono = ((h >>> 6) & 3) === 3;
    const v1 = version === 3;
    const samplesPerFrame = v1 ? 1152 : 576;
    const sideInfo = v1 ? (mono ? 17 : 32) : mono ? 9 : 17;
    const tag = ascii(b, at + 4 + sideInfo, 4);
    const channels = mono ? 1 : 2;
    if (tag === 'Xing' || tag === 'Info') {
      const flags = v.getUint32(at + 8 + sideInfo, false);
      if (flags & 1) {
        const frames = v.getUint32(at + 12 + sideInfo, false);
        return {
          format: 'mp3',
          durationS: (frames * samplesPerFrame) / sampleRate,
          sampleRate,
          channels,
        };
      }
    }
    const kbps = ((v1 ? MP3_BITRATES_V1 : MP3_BITRATES_V2)[bitrateIndex] as number) * 1000;
    return { format: 'mp3', durationS: ((b.length - at) * 8) / kbps, sampleRate, channels };
  }
  return { format: 'mp3' };
}

/** Probe a clip's header for duration, sample rate and channel count. */
export function probeAudio(bytes: Uint8Array): AudioProbe {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE')
    return probeWav(bytes, v);
  if (bytes.length >= 27 && ascii(bytes, 0, 4) === 'OggS') return probeOgg(bytes, v);
  if (
    bytes.length >= 4 &&
    (ascii(bytes, 0, 3) === 'ID3' || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0))
  )
    return probeMp3(bytes, v);
  return { format: 'unknown' };
}
