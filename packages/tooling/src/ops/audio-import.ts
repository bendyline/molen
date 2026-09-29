import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { type SoundbankDoc, type SoundEntry, validate } from '@bendyline/molen-schema';
import { probeAudio } from '../audio-probe';
import { parseJson } from './build';
import { guardOp } from './errors';

export interface ImportSoundInput {
  /** Audio file to add (MP3 recommended; WAV/Ogg accepted). */
  file: string;
  /** Sound id, e.g. "ambience.rain.medium". */
  id: string;
  /** molen/soundbank@1 file to update (created when missing). */
  bankPath: string;
  /** SPDX-style license of the recording, e.g. "CC0-1.0". */
  license: string;
  /** Page of the original recording. */
  source?: string;
  site?: string;
  author?: string;
  /** Prompt text, when the clip was generated. */
  prompt?: string;
  generator?: string;
  description?: string;
  loop?: boolean;
  loopStart?: number;
  loopEnd?: number;
  bus?: string;
  gain?: number;
  /** Seconds; overrides the probed duration. */
  durationS?: number;
  /** Add the file as another variation of an existing sound instead of replacing it. */
  append?: boolean;
  /** Directory under the bank to copy files into (default "audio"). */
  copyTo?: string;
}

export interface ImportSoundOutput {
  ok: boolean;
  bankPath: string;
  id?: string;
  clip?: string;
  entry?: SoundEntry;
  warnings: string[];
  error?: string;
}

const fail = (error: string): ImportSoundOutput => ({
  ok: false,
  bankPath: '',
  warnings: [],
  error,
});

/** Add a clip to a sound bank: copy it beside the bank, hash and probe it, record provenance. */
export function importSound(input: ImportSoundInput): Promise<ImportSoundOutput> {
  return guardOp(fail, () => importSoundImpl(input));
}

async function importSoundImpl(input: ImportSoundInput): Promise<ImportSoundOutput> {
  const warnings: string[] = [];
  const bankPath = resolve(input.bankPath);
  const bankDir = dirname(bankPath);
  let bank: SoundbankDoc;
  try {
    bank = parseJson(await readFile(bankPath, 'utf8')) as SoundbankDoc;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    bank = { format: 'molen/soundbank@1', id: basename(bankDir), sounds: {} };
    warnings.push(`created ${bankPath}`);
  }

  const src = resolve(input.file);
  const bytes = new Uint8Array(await readFile(src));
  const inside = !relative(bankDir, src).startsWith('..') && !isAbsolute(relative(bankDir, src));
  let clip: string;
  if (inside) clip = relative(bankDir, src).split(sep).join('/');
  else {
    const dir = input.copyTo ?? 'audio';
    clip = `${dir}/${basename(src)}`;
    await mkdir(join(bankDir, dir), { recursive: true });
    await copyFile(src, join(bankDir, clip));
  }

  const probe = probeAudio(bytes);
  if (probe.format === 'unknown') warnings.push(`${basename(src)}: unrecognized audio format`);
  if (probe.format !== 'mp3' && probe.format !== 'unknown')
    warnings.push(
      `${basename(src)} is ${probe.format}; MP3 is the one format every browser decodes`,
    );
  const durationS = input.durationS ?? probe.durationS;
  const hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

  const previous = bank.sounds[input.id];
  const source = {
    license: input.license,
    ...(input.site !== undefined ? { site: input.site } : {}),
    ...(input.source !== undefined ? { url: input.source } : {}),
    ...(input.author !== undefined ? { author: input.author } : {}),
    ...(input.prompt !== undefined ? { prompt: input.prompt } : {}),
    ...(input.generator !== undefined ? { generator: input.generator } : {}),
  };
  let entry: SoundEntry;
  if (input.append && previous) {
    if (previous.clips.includes(clip))
      return { ...fail(`${clip} is already a clip of ${input.id}`), bankPath };
    entry = { ...previous, clips: [...previous.clips, clip] };
  } else {
    entry = {
      clips: [clip],
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.loop !== undefined ? { loop: input.loop } : {}),
      ...(input.loopStart !== undefined ? { loopStart: input.loopStart } : {}),
      ...(input.loopEnd !== undefined ? { loopEnd: input.loopEnd } : {}),
      ...(input.gain !== undefined ? { gain: input.gain } : {}),
      ...(input.bus !== undefined ? { bus: input.bus } : {}),
      ...(durationS !== undefined ? { durationS: Math.round(durationS * 1000) / 1000 } : {}),
      hash,
      source,
    };
    if (previous) warnings.push(`replaced existing sound ${input.id}`);
  }
  if (durationS === undefined) warnings.push('duration unknown; pass --duration for music tracks');

  const next: SoundbankDoc = { ...bank, sounds: { ...bank.sounds, [input.id]: entry } };
  const checked = validate('soundbank', next);
  if (!checked.ok) return { ...fail(checked.formatted), bankPath };
  await writeFile(bankPath, `${JSON.stringify(next, null, 2)}\n`);
  return { ok: true, bankPath, id: input.id, clip, entry, warnings };
}
