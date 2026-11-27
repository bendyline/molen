// Does a loop drift? A recording cut from a pass-by, a start-up or a takeoff run glides in pitch
// and fades or swells across its loop; looped, it restarts every few seconds with a jump back:
// an engine "spooling down" over and over. This measures that glide.
//
//   node content/sounds/tools/drift.mjs bank [prefix...]    every built loop (ids by prefix)
//   node content/sounds/tools/drift.mjs clip <origin-id|file> [from] [to]
//   node content/sounds/tools/drift.mjs window <origin-id|file> <seconds> [--from=S] [--to=S]
//
// Every half second of the span is compared with its first second. Pitch glide: both spectra on
// a log-frequency axis, whitened (each bin against its third-octave neighbourhood, so tones and
// resonances stand out from broadband noise) and cross-correlated; the best-aligning shift, in
// cents, counts when the correlation (`match`) reaches 0.3. Centroid: the power-weighted mean
// pitch, which follows broadband sound (a Doppler fall, distance dulling the treble). Level: RMS,
// dB. Each reports its largest excursion. A built loop's end is crossfaded into its start, so
// comparing the two ends alone hides a pass-by. Generated loops stay within about 180 cents of
// centroid and 1.5 dB. `window` ranks the stretches of a recording, leaving out parts more than
// 8 dB below its loudest; a recipe clip reads `duration + crossfade` seconds, so search for that.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RATE = 22050;
const N = 4096;
const HOP = 1024;
const LOW = 250;
const HIGH = 8000;
/** Log-frequency bins per octave: 12.5 cents each. */
const PER_OCTAVE = 96;
const MAX_LAG = 48; // ±600 cents

function decode(path) {
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-nostdin', '-i', path, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'],
    { maxBuffer: 1024 * 1024 * 1024 },
  );
  if (r.status !== 0) throw new Error(`${path}: ffmpeg failed\n${r.stderr}`);
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4));
}

/** In-place radix-2 FFT of (re, im). */
function fft(re, im) {
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
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
  }
}

const hann = Float32Array.from(
  { length: N },
  (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N),
);
const octaves = Math.log2(HIGH / LOW);
const BINS = Math.floor(octaves * PER_OCTAVE);

/** Log-magnitude spectrum on the log-frequency axis for every frame, and each frame's RMS. */
function analyse(samples) {
  const frames = [];
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let start = 0; start + N <= samples.length; start += HOP) {
    let energy = 0;
    for (let i = 0; i < N; i++) {
      const s = samples[start + i];
      energy += s * s;
      re[i] = s * hann[i];
      im[i] = 0;
    }
    fft(re, im);
    const mag = new Float64Array(N / 2);
    for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    const log = new Float64Array(BINS);
    for (let b = 0; b < BINS; b++) {
      const f = LOW * 2 ** (b / PER_OCTAVE);
      const x = (f * N) / RATE;
      const k = Math.floor(x);
      const m = mag[k] + (mag[k + 1] - mag[k]) * (x - k);
      log[b] = Math.log(m + 1e-9);
    }
    frames.push({ t: (start + N / 2) / RATE, log, rms: Math.sqrt(energy / N) });
  }
  return frames;
}

/** Mean whitened spectrum and level (dB) of the frames in [from, to). */
function block(frames, from, to) {
  const inside = frames.filter((f) => f.t >= from && f.t < to);
  if (inside.length === 0) return undefined;
  const mean = new Float64Array(BINS);
  let power = 0;
  for (const f of inside) {
    for (let b = 0; b < BINS; b++) mean[b] += f.log[b] / inside.length;
    power += (f.rms * f.rms) / inside.length;
  }
  const third = PER_OCTAVE / 3;
  const white = new Float64Array(BINS);
  for (let b = 0; b < BINS; b++) {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, b - third); j <= Math.min(BINS - 1, b + third); j++) {
      sum += mean[j];
      n++;
    }
    white[b] = mean[b] - sum / n;
  }
  return { white, db: 10 * Math.log10(power + 1e-12) };
}

/** Shift (cents) that best aligns b onto a, and the correlation there. */
function glide(a, b) {
  let best = { cents: 0, match: -Infinity };
  for (let lag = -MAX_LAG; lag <= MAX_LAG; lag++) {
    let sab = 0;
    let saa = 0;
    let sbb = 0;
    for (let i = MAX_LAG; i < BINS - MAX_LAG; i++) {
      const x = a.white[i];
      const y = b.white[i + lag];
      sab += x * y;
      saa += x * x;
      sbb += y * y;
    }
    const match = sab / Math.sqrt(saa * sbb + 1e-12);
    // b's features sit `lag` bins above a's: positive is a rise.
    if (match > best.match) best = { cents: (lag * 1200) / PER_OCTAVE, match };
  }
  return best;
}

/** Power-weighted mean position on the log-frequency axis, cents above LOW. */
function centroid(frames, from, to) {
  const inside = frames.filter((f) => f.t >= from && f.t < to);
  let sum = 0;
  let weight = 0;
  for (const f of inside)
    for (let b = 0; b < BINS; b++) {
      const p = Math.exp(2 * f.log[b]);
      sum += p * b;
      weight += p;
    }
  return weight > 0 ? ((sum / weight) * 1200) / PER_OCTAVE : 0;
}

/**
 * How far a loop wanders from its first second: the largest glide (when something tonal can be
 * followed), centroid shift (broadband sound) and level change seen across [from, to]. A built
 * loop's end is crossfaded into its start, so comparing the ends alone hides a pass-by.
 */
function swing(frames, from, to) {
  const first = block(frames, from, from + 1);
  if (!first) return undefined;
  const c0 = centroid(frames, from, from + 1);
  let glideCents = 0;
  let centroidCents = 0;
  let levelDb = 0;
  let match = 1;
  for (let t = from + 0.5; t + 1 <= to; t += 0.5) {
    const b = block(frames, t, t + 1);
    if (!b) continue;
    const g = glide(first, b);
    match = Math.min(match, g.match);
    if (g.match >= 0.3 && Math.abs(g.cents) > Math.abs(glideCents)) glideCents = g.cents;
    const c = centroid(frames, t, t + 1) - c0;
    if (Math.abs(c) > Math.abs(centroidCents)) centroidCents = c;
    if (Math.abs(b.db - first.db) > Math.abs(levelDb)) levelDb = b.db - first.db;
  }
  return {
    glideCents: Math.round(glideCents),
    centroidCents: Math.round(centroidCents),
    levelDb: Math.round(levelDb * 10) / 10,
    match: Math.round(match * 100) / 100,
  };
}

function originFile(ref) {
  if (existsSync(ref)) return ref;
  const dir = join(root, '.cache', ref);
  const file = existsSync(dir) ? readdirSync(dir).find((f) => !f.startsWith('.')) : undefined;
  if (!file) throw new Error(`${ref}: not a file and nothing downloaded for that origin`);
  return join(dir, file);
}

const [command, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(
  rest.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')),
);
const args = rest.filter((a) => !a.startsWith('--'));

if (command === 'bank') {
  const bank = JSON.parse(readFileSync(join(root, 'sounds.soundbank.json'), 'utf8'));
  const prefixes = args.length ? args : ['aircraft.', 'vehicle.', 'rail.', 'boat.', 'road.'];
  const rows = [];
  for (const [id, s] of Object.entries(bank.sounds)) {
    if (!s.loop || !prefixes.some((p) => id.startsWith(p))) continue;
    for (const clip of s.clips) {
      const frames = analyse(decode(join(root, clip)));
      const end = frames.length ? frames[frames.length - 1].t : 0;
      const d = swing(frames, s.loopStart ?? 0, Math.min(s.loopEnd ?? end, end));
      const loopS = Math.round(((s.loopEnd ?? end) - (s.loopStart ?? 0)) * 10) / 10;
      if (d) rows.push({ id, loopS, ...d, generated: s.source?.site === 'molen' });
    }
  }
  const badness = (r) =>
    Math.abs(r.glideCents) / 50 + Math.abs(r.centroidCents) / 150 + Math.abs(r.levelDb) / 3;
  rows.sort((x, y) => badness(y) - badness(x));
  for (const r of rows)
    console.log(
      `${r.id.padEnd(36)} loop ${String(r.loopS).padStart(5)} s  glide ${String(r.glideCents).padStart(5)} c  centroid ${String(r.centroidCents).padStart(5)} c  level ${String(r.levelDb).padStart(5)} dB${r.generated ? '  (generated)' : ''}`,
    );
} else if (command === 'clip') {
  const frames = analyse(decode(originFile(args[0])));
  const end = frames.length ? frames[frames.length - 1].t : 0;
  const from = Number(args[1] ?? 0);
  const to = Number(args[2] ?? end);
  console.log(JSON.stringify(swing(frames, from, to)));
  // Level (dB) and centroid (cents) second by second, to see where it moves.
  const steps = [];
  for (let t = from; t + 1 <= to; t += 1)
    steps.push(
      `${t}s:${Math.round(block(frames, t, t + 1).db)}dB/${Math.round(centroid(frames, t, t + 1))}c`,
    );
  console.log(steps.join(' '));
} else if (command === 'window') {
  const path = originFile(args[0]);
  const seconds = Number(args[1] ?? 6);
  const frames = analyse(decode(path));
  const end = frames.length ? frames[frames.length - 1].t : 0;
  const from = Number(flags.from ?? 0);
  const to = Math.min(Number(flags.to ?? end), end);
  const windows = [];
  for (let start = from; start + seconds <= to; start += 0.25) {
    const d = swing(frames, start, start + seconds);
    const level = block(frames, start, start + seconds)?.db;
    if (d && level !== undefined) windows.push({ start, level, ...d });
  }
  // The subject, not the silence before it or the fade after it.
  const loudest = Math.max(...windows.map((w) => w.level));
  const found = windows
    .filter((w) => w.level >= loudest - 8)
    .map((w) => ({
      ...w,
      level: Math.round(w.level - loudest),
      score:
        Math.round(
          (Math.abs(w.glideCents) / 50 +
            Math.abs(w.centroidCents) / 150 +
            Math.abs(w.levelDb) / 3) *
            100,
        ) / 100,
    }));
  found.sort((a, b) => a.score - b.score);
  console.log(`${path} (${end.toFixed(1)} s): best ${seconds} s windows`);
  const shown = [];
  for (const f of found) {
    if (shown.some((s) => Math.abs(s.start - f.start) < seconds / 2)) continue;
    shown.push(f);
    console.log(JSON.stringify(f));
    if (shown.length === 5) break;
  }
} else {
  console.log(
    readFileSync(fileURLToPath(import.meta.url), 'utf8')
      .split('\n')
      .slice(0, 15)
      .join('\n'),
  );
}
