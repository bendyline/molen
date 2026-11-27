#!/usr/bin/env node
// Generate molen.sounds' synthesized loops (in the engine repository): turbine whine, jet roar and
// reheat, propeller buzz, wind on a body, tire and runway rumble, warning horns and electric
// motors. Everything is computed from a fixed seed, so the same script always writes the same
// bytes, and the output is the project's own work, dedicated CC0 like the rest of the pack.
//
// Every loop is exactly 2^18 samples at 44.1 kHz (5.94 s) and periodic by construction: noise is
// shaped in the frequency domain over one period, and every tone completes whole cycles in it.
// `build.mjs` loops it with no crossfade (`"periodic": true`), so there is no seam to hear.
//
//   node content/sounds/tools/synth.mjs <recipe> <out.wav>
//   node content/sounds/tools/synth.mjs --list

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const RATE = 44100;
const N = 1 << 18;
const T = N / RATE;

function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-place iterative radix-2 FFT; `inverse` scales by 1/n. */
function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k];
        const ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br;
        im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br;
        im[i + k + len / 2] = ai - bi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) re[i] /= n;
}

/** Periodic noise whose amplitude spectrum is `shape(hz)`, normalized to unit RMS. */
function noise(seed, shape) {
  const random = prng(seed);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let k = 1; k < N / 2; k++) {
    const m = shape((k * RATE) / N);
    const phase = random() * 2 * Math.PI;
    re[k] = m * Math.cos(phase);
    im[k] = m * Math.sin(phase);
    re[N - k] = re[k];
    im[N - k] = -im[k];
  }
  fft(re, im, true);
  return normalize(re);
}

function normalize(x, rms = 1) {
  let sum = 0;
  for (const v of x) sum += v * v;
  const k = rms / Math.sqrt(sum / x.length || 1);
  for (let i = 0; i < x.length; i++) x[i] *= k;
  return x;
}

/** A frequency rounded so that it completes whole cycles in one period. */
const whole = (hz) => Math.max(1, Math.round(hz * T)) / T;

/**
 * A tone with harmonics `partials` ([multiple, level]) and a slow periodic wobble in pitch, as a
 * turbine's tones drift with small changes in shaft speed.
 */
function tone(hz, partials, { wobble = 0.002, wobbleCycles = 3, seed = 1 } = {}) {
  const random = prng(seed);
  const out = new Float64Array(N);
  for (const [multiple, level] of partials) {
    const f = whole(hz * multiple);
    const phase0 = random() * 2 * Math.PI;
    // Phase modulation of whole cycles keeps the period exact.
    const depth = (wobble * f * T) / (2 * Math.PI * wobbleCycles);
    for (let i = 0; i < N; i++) {
      const t = i / RATE;
      const pm = depth * Math.sin((2 * Math.PI * wobbleCycles * i) / N + phase0);
      out[i] += level * Math.sin(2 * Math.PI * f * t + phase0 + pm);
    }
  }
  return normalize(out);
}

/** A slow periodic level swell, 1 ± depth. */
function swell(x, depth, cycles = 2, seed = 7) {
  const random = prng(seed);
  const p1 = random() * 2 * Math.PI;
  const p2 = random() * 2 * Math.PI;
  for (let i = 0; i < N; i++) {
    const u = (2 * Math.PI * i) / N;
    x[i] *=
      1 + depth * (0.6 * Math.sin(cycles * u + p1) + 0.4 * Math.sin((cycles * 2 + 1) * u + p2));
  }
  return x;
}

/** Short decaying bursts at random times (wrapping at the period's end): crackle, seams. */
function bursts(seed, count, lengthS, colour) {
  const random = prng(seed);
  const out = new Float64Array(N);
  const base = noise(seed + 101, colour);
  const len = Math.round(lengthS * RATE);
  for (let b = 0; b < count; b++) {
    const at = Math.floor(random() * N);
    const level = 0.4 + random() * 0.6;
    const from = Math.floor(random() * N);
    for (let i = 0; i < len; i++) {
      const env = Math.exp((-5 * i) / len) * Math.min(1, i / 24);
      out[(at + i) % N] += level * env * base[(from + i) % N];
    }
  }
  return normalize(out);
}

function mix(...parts) {
  const out = new Float64Array(N);
  for (const [x, level] of parts) for (let i = 0; i < N; i++) out[i] += level * x[i];
  return out;
}

// Spectral shapes. `band(f, lo, hi)` is a soft band-pass; `tilt` a slope in dB per octave.
const band = (f, lo, hi, order = 2) =>
  1 / Math.sqrt(1 + (lo / f) ** (2 * order)) / Math.sqrt(1 + (f / hi) ** (2 * order));
const tilt = (f, dbPerOctave, ref = 1000) => 10 ** ((dbPerOctave * Math.log2(f / ref)) / 20);
const peak = (f, centre, q, gainDb) =>
  1 + (10 ** (gainDb / 20) - 1) / (1 + (q * (f / centre - centre / f)) ** 2);

const RECIPES = {
  'jet-whine': {
    title: 'Turbine whine (jet engine compressor and fan tones)',
    make: () =>
      mix(
        [
          tone(
            1180,
            [
              [1, 1],
              [2, 0.35],
              [3, 0.12],
            ],
            { seed: 11, wobble: 0.003 },
          ),
          0.55,
        ],
        [
          tone(
            3650,
            [
              [1, 1],
              [1.5, 0.4],
              [2, 0.25],
            ],
            { seed: 12, wobble: 0.002 },
          ),
          0.5,
        ],
        [
          tone(
            7420,
            [
              [1, 1],
              [1.27, 0.5],
            ],
            { seed: 13, wobble: 0.0015 },
          ),
          0.3,
        ],
        [noise(14, (f) => band(f, 900, 9000) * peak(f, 3600, 2, 6)), 0.35],
      ),
  },
  'jet-roar': {
    title: 'Jet exhaust roar (broadband mixing noise)',
    make: () =>
      swell(
        mix(
          [noise(21, (f) => band(f, 35, 4500, 1) * peak(f, 260, 0.8, 7) * tilt(f, -2)), 1],
          [bursts(22, 220, 0.03, (f) => band(f, 300, 6000)), 0.12],
        ),
        0.07,
        3,
      ),
  },
  'jet-reheat': {
    title: 'Afterburner rumble and crackle',
    make: () =>
      swell(
        mix(
          [noise(31, (f) => band(f, 22, 1800, 1) * peak(f, 90, 0.9, 9) * tilt(f, -3)), 1],
          [bursts(32, 520, 0.045, (f) => band(f, 120, 5000) * tilt(f, -1.5)), 0.5],
        ),
        0.1,
        4,
      ),
  },
  'turbine-small': {
    title: 'Small gas turbine whine (turboshaft or turboprop)',
    make: () =>
      mix(
        [
          tone(
            2650,
            [
              [1, 1],
              [2, 0.3],
              [2.53, 0.25],
            ],
            { seed: 41, wobble: 0.003 },
          ),
          0.6,
        ],
        [
          tone(
            6100,
            [
              [1, 1],
              [1.33, 0.35],
            ],
            { seed: 42, wobble: 0.002 },
          ),
          0.35,
        ],
        [noise(43, (f) => band(f, 400, 9000) * peak(f, 2600, 3, 5)), 0.45],
      ),
  },
  'prop-buzz': {
    title: 'Propeller blade-pass buzz (fundamental near 80 Hz, pitch it with rpm)',
    make: () => {
      const f0 = whole(80);
      const partials = [];
      for (let h = 1; h <= 24; h++) partials.push([h, 1 / h ** 0.9]);
      return mix(
        [tone(f0, partials, { seed: 51, wobble: 0.004, wobbleCycles: 2 }), 1],
        [noise(52, (f) => band(f, 60, 2500) * tilt(f, -3)), 0.25],
      );
    },
  },
  'wind-airframe': {
    title: 'Airflow over an airframe (broadband, slow swell)',
    make: () =>
      swell(
        noise(61, (f) => band(f, 120, 7000, 1) * peak(f, 900, 0.7, 4) * tilt(f, -2)),
        0.18,
        2,
      ),
  },
  'wind-body': {
    title: 'Wind noise on a car body at speed (from inside)',
    make: () =>
      swell(
        noise(71, (f) => band(f, 150, 5000, 1) * peak(f, 600, 0.8, 5) * tilt(f, -2.5)),
        0.12,
        3,
      ),
  },
  'tire-road': {
    title: 'Tire roar on asphalt (road noise peaking near 900 Hz)',
    make: () =>
      swell(
        noise(81, (f) => band(f, 180, 4000, 2) * peak(f, 900, 1.5, 8) * tilt(f, -1)),
        0.06,
        5,
      ),
  },
  'ground-roll': {
    title: 'Runway roll: tire rumble and joint thumps',
    make: () =>
      mix(
        [noise(91, (f) => band(f, 25, 900, 2) * peak(f, 70, 1.2, 8)), 1],
        [bursts(92, 22, 0.08, (f) => band(f, 30, 400)), 0.6],
      ),
  },
  'stall-horn': {
    title: 'Stall warning horn (reed horn near 1.7 kHz)',
    make: () =>
      tone(
        1700,
        [
          [1, 1],
          [2, 0.5],
          [3, 0.3],
          [4, 0.15],
        ],
        { seed: 101, wobble: 0.006, wobbleCycles: 30 },
      ),
  },
  'gear-horn': {
    title: 'Landing gear warning horn (steady, pulsed)',
    make: () => {
      const x = tone(
        660,
        [
          [1, 1],
          [3, 0.4],
          [5, 0.2],
        ],
        { seed: 111, wobble: 0.001 },
      );
      // 2 pulses a second, whole pulses in the period.
      const pulses = Math.round(2 * T);
      for (let i = 0; i < N; i++) {
        const p = ((i * pulses) / N) % 1;
        x[i] *= p < 0.55 ? Math.min(1, p / 0.01, (0.55 - p) / 0.01) : 0;
      }
      return x;
    },
  },
  'electric-motor': {
    title: 'Electric car motor and inverter whine (pitch it with speed)',
    make: () =>
      mix(
        [
          tone(
            420,
            [
              [1, 1],
              [2, 0.5],
              [3, 0.2],
            ],
            { seed: 121, wobble: 0.001 },
          ),
          0.5,
        ],
        [
          tone(
            1870,
            [
              [1, 1],
              [2, 0.3],
            ],
            { seed: 122, wobble: 0.001 },
          ),
          0.25,
        ],
        [noise(123, (f) => band(f, 200, 3000) * peak(f, 700, 2, 4)), 0.2],
      ),
  },
  'electric-hum': {
    title: 'Low-speed pedestrian warning hum of an electric car',
    make: () =>
      swell(
        mix(
          [
            tone(
              310,
              [
                [1, 1],
                [1.5, 0.6],
                [2, 0.5],
                [3, 0.2],
              ],
              { seed: 131, wobble: 0.002 },
            ),
            1,
          ],
          [noise(132, (f) => band(f, 250, 1800)), 0.15],
        ),
        0.15,
        6,
      ),
  },
  'traction-hum': {
    title: 'Electric traction motor hum (tram, light rail)',
    make: () =>
      mix(
        [
          tone(
            300,
            [
              [1, 1],
              [2, 0.6],
              [3, 0.4],
              [6, 0.2],
            ],
            { seed: 141, wobble: 0.001 },
          ),
          0.6,
        ],
        [
          tone(
            1130,
            [
              [1, 1],
              [2, 0.3],
            ],
            { seed: 142, wobble: 0.001 },
          ),
          0.3,
        ],
        [noise(143, (f) => band(f, 60, 2500) * tilt(f, -2)), 0.35],
      ),
  },
  'cycle-tire': {
    title: 'Bicycle tires rolling on pavement',
    make: () => noise(151, (f) => band(f, 200, 6000, 1) * peak(f, 1800, 1, 4) * tilt(f, -2)),
  },
};

function wav(samples) {
  let peakAbs = 0;
  for (const v of samples) peakAbs = Math.max(peakAbs, Math.abs(v));
  const k = peakAbs > 0 ? 0.89 / peakAbs : 0;
  const data = Buffer.alloc(N * 2);
  for (let i = 0; i < N; i++)
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(samples[i] * k * 32767))), i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

export const SYNTH_PERIOD_S = T;
export const SYNTH_RECIPES = Object.fromEntries(
  Object.entries(RECIPES).map(([id, r]) => [id, r.title]),
);

const [name, out] = process.argv.slice(2);
if (import.meta.url === `file:///${process.argv[1]?.replaceAll('\\', '/').replace(/^\//, '')}`) {
  if (name === '--list' || !name) {
    for (const [id, r] of Object.entries(RECIPES)) console.log(`${id}\t${r.title}`);
    console.log(`period ${T} s (${N} samples at ${RATE} Hz)`);
  } else {
    const recipe = RECIPES[name];
    if (!recipe) throw new Error(`Unknown recipe ${name}; --list shows them`);
    if (!out) throw new Error('Name an output .wav file');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, wav(recipe.make()));
    console.log(`✓ ${name} -> ${out}`);
  }
}
