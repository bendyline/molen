#!/usr/bin/env node
// Build the molen.sounds pack from sources.json (in the engine repository): trim, make loops
// seamless with a crossfade, normalize loudness, encode MP3 into audio/, and write
// sounds.soundbank.json and NOTICE.md. Needs ffmpeg/ffprobe with libmp3lame and a prior
// `node content/sounds/tools/fetch.mjs`. Unchanged recipes are skipped; --force rebuilds all.
//
//   node content/sounds/tools/build.mjs [--force]

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, '.cache');
const force = process.argv.includes('--force');
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const stampsPath = join(cache, 'build-stamps.json');
const stamps = existsSync(stampsPath) ? JSON.parse(readFileSync(stampsPath, 'utf8')) : {};

// Mix targets: ambience sits under effects, music under both, one-shots peak-normalized.
const LOUDNESS = { loop: -20, music: -18 };
const PEAK_DB = { sfx: -3, ui: -6, music: -3, ambience: -3 };
const LOOP_MARGIN_S = 0.05; // loop points stay clear of MP3 encoder delay and padding
const MIN_ONESHOT_S = 0.3;

/** Run ffmpeg and write an output file. */
function run(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
}

/** Run an ffmpeg analysis pass (no output file) and return its log. */
function analyze(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args, '-f', 'null', '-'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stderr;
}

function probeDuration(file) {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  );
  return Number(r.stdout.trim());
}

function sha256(file) {
  return `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}`;
}

function outputPath(id, index, count) {
  const [head, ...rest] = id.split('.');
  const name = rest.length > 0 ? rest.join('-') : head;
  return `audio/${head}/${name}${count > 1 ? `-${index + 1}` : ''}.mp3`;
}

/** The filter chain before normalization, and the input options, for one clip. */
function shape(sound, clip) {
  const input = [];
  const x = clip.crossfade ?? 0;
  if (clip.start !== undefined) input.push('-ss', String(clip.start));
  if (clip.duration !== undefined) input.push('-t', String(clip.duration + x));
  const filters = [];
  if (sound.kind === 'loop' && x > 0) {
    filters.push(
      `asplit=2[s1][s2];[s1]atrim=start=${x},asetpts=PTS-STARTPTS[a];[s2]atrim=end=${x},asetpts=PTS-STARTPTS[b];[a][b]acrossfade=d=${x}:c1=qsin:c2=qsin`,
    );
  }
  if (clip.fadeOut !== undefined && clip.duration !== undefined) {
    filters.push(`afade=t=out:st=${Math.max(0, clip.duration - clip.fadeOut)}:d=${clip.fadeOut}`);
  }
  return { input, filters };
}

function encode(sound, clip, src, dest) {
  const channels = sound.channels ?? (sound.kind === 'oneshot' ? 1 : 2);
  const bitrate = channels === 1 ? '64k' : '96k';
  const { input, filters } = shape(sound, clip);
  const pre = filters.length > 0 ? `${filters.join(',')},` : '';
  const base = [...input, '-i', src];
  let norm;
  if (sound.kind === 'oneshot') {
    const err = analyze([...base, '-filter_complex', `${pre}volumedetect`]);
    const max = Number(/max_volume: (-?[\d.]+) dB/.exec(err)?.[1] ?? '0');
    const target = PEAK_DB[sound.bus ?? 'sfx'] ?? -3;
    // Pad very short clips with silence: a handful of MP3 frames is too little for some decoders.
    norm = `volume=${(target - max).toFixed(2)}dB,apad=whole_dur=${MIN_ONESHOT_S}`;
  } else {
    const target = sound.loudness ?? LOUDNESS[sound.kind] ?? -20;
    const err = analyze([
      ...base,
      '-filter_complex',
      `${pre}loudnorm=I=${target}:TP=-2:LRA=11:print_format=json`,
    ]);
    const m = JSON.parse(err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1));
    norm = `loudnorm=I=${target}:TP=-2:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  }
  mkdirSync(dirname(dest), { recursive: true });
  run([
    ...base,
    '-filter_complex',
    `${pre}${norm},aresample=44100`,
    '-ac',
    String(channels),
    '-codec:a',
    'libmp3lame',
    '-b:a',
    bitrate,
    '-map_metadata',
    '-1',
    dest,
  ]);
  return { channels, bitrate };
}

function findSource(originId, file) {
  const dir = join(cache, originId);
  const direct = join(dir, file);
  if (existsSync(direct)) return direct;
  // Archives unpack with their own top folder; search by the relative tail.
  const stack = [dir];
  while (stack.length > 0) {
    const d = stack.pop();
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) stack.push(p);
      else if (p.endsWith(`/${file}`)) return p;
    }
  }
  throw new Error(`${originId}/${file} not found in .cache — run tools/fetch.mjs first`);
}

const bank = {
  format: 'molen/soundbank@1',
  id: 'molen.sounds',
  title: 'Molen sounds: CC0 ambience, vehicles, footsteps, impacts, UI and music',
  license: 'CC0-1.0',
  sounds: {},
};
const used = {};
for (const [id, sound] of Object.entries(sources.sounds)) {
  const clips = [];
  let first;
  for (const [i, clip] of sound.clips.entries()) {
    const origin = sources.origins[clip.origin];
    if (origin?.license !== 'CC0-1.0') throw new Error(`${id}: origin ${clip.origin} is not CC0`);
    const rel = outputPath(id, i, sound.clips.length);
    const dest = join(root, rel);
    const recipe = JSON.stringify({
      sound: { ...sound, clips: undefined, description: undefined, tags: undefined },
      clip,
      v: 3,
    });
    if (force || stamps[rel] !== recipe || !existsSync(dest)) {
      encode(sound, clip, findSource(clip.origin, clip.file), dest);
      stamps[rel] = recipe;
      process.stdout.write(`✓ ${rel}\n`);
    }
    clips.push(rel);
    first ??= { dest, clip, origin };
    used[clip.origin] ??= new Set();
    used[clip.origin].add(id);
  }
  const duration = Math.round(probeDuration(first.dest) * 1000) / 1000;
  const loop = sound.kind === 'loop';
  const edits = [];
  if (first.clip.start !== undefined || first.clip.duration !== undefined)
    edits.push(`trimmed from ${first.clip.start ?? 0}s`);
  if (first.clip.crossfade) edits.push(`${first.clip.crossfade}s crossfade loop`);
  edits.push(
    sound.kind === 'oneshot'
      ? 'peak-normalized'
      : `loudness ${sound.loudness ?? LOUDNESS[sound.kind]} LUFS`,
  );
  edits.push('MP3');
  const origin = first.origin;
  bank.sounds[id] = {
    clips,
    description: sound.description,
    ...(sound.tags ? { tags: sound.tags } : {}),
    ...(loop
      ? {
          loop: true,
          loopStart: LOOP_MARGIN_S,
          loopEnd: Math.round((duration - LOOP_MARGIN_S) * 1000) / 1000,
        }
      : {}),
    ...(sound.gain !== undefined ? { gain: sound.gain } : {}),
    ...(sound.pitch ? { pitch: sound.pitch } : {}),
    bus: sound.bus ?? (sound.kind === 'music' ? 'music' : 'ambience'),
    ...(sound.spatial !== undefined
      ? { spatial: sound.spatial }
      : sound.kind === 'music' || (loop && (sound.bus ?? 'ambience') === 'ambience')
        ? { spatial: false }
        : {}),
    durationS: duration,
    hash: sha256(first.dest),
    source: {
      license: 'CC0-1.0',
      site: origin.site,
      url: origin.page,
      author: origin.author,
      title: origin.title,
      notes: edits.join(', '),
    },
  };
}

mkdirSync(cache, { recursive: true });
writeFileSync(stampsPath, `${JSON.stringify(stamps, null, 2)}\n`);
writeFileSync(join(root, 'sounds.soundbank.json'), `${JSON.stringify(bank, null, 2)}\n`);

const lines = [
  '# molen.sounds — notices',
  '',
  'Every recording in this pack is dedicated to the public domain under',
  '[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) by its author. Attribution is not',
  'required; the credits below record where each sound came from. Files were trimmed, looped,',
  'loudness-normalized and re-encoded as MP3 by `tools/build.mjs`.',
  '',
  '| Source | Author | Site | Sounds |',
  '| --- | --- | --- | --- |',
];
for (const [id, origin] of Object.entries(sources.origins)) {
  const sounds = [...(used[id] ?? [])].sort();
  if (sounds.length === 0) continue;
  lines.push(
    `| [${origin.title}](${origin.page}) | ${origin.author} | ${origin.site} | ${sounds.map((s) => `\`${s}\``).join(', ')} |`,
  );
}
writeFileSync(join(root, 'NOTICE.md'), `${lines.join('\n')}\n`);
// Match the repository formatter so a rebuild leaves `pnpm lint` clean.
spawnSync('npx', ['biome', 'format', '--write', join(root, 'sounds.soundbank.json')], {
  stdio: 'ignore',
});
const total = Object.values(bank.sounds).reduce((n, s) => n + s.clips.length, 0);
console.log(
  `${Object.keys(bank.sounds).length} sounds, ${total} clips -> ${relative(process.cwd(), join(root, 'sounds.soundbank.json'))}`,
);
