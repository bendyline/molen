import { z } from 'zod';
import type { ValidationIssue } from './issues';
import type { JsonValue } from './json';
import { registerSchema } from './registry';
import { nearestWithDistance } from './zod-issues';

// Audio vocabulary: a sound-bank document plus three components. Audio is render-side only —
// nothing here is simulated, and playback never enters the state hash. The components are plain
// data the client's audio director reads (see guide/audio.md); `molen.audio.*` in scripts emits
// ordinary events, so headless runs can assert on them.

const finite = z.number().finite();
const vec3 = z.array(finite).length(3) as unknown as z.ZodType<[number, number, number]>;

/** Sound ids: lowercase dotted segments, e.g. `ambience.rain.medium`, `footstep.grass`. */
export const SOUND_ID_PATTERN: RegExp = /^[a-z0-9][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)*$/;
/** Bus names: lowercase, e.g. `music`, `ambience`, `sfx`, `ui`, `voice`. */
export const AUDIO_BUS_PATTERN: RegExp = /^[a-z][a-z0-9-]*$/;
/** The buses every audio backend creates; others are created on first use. */
export const AUDIO_BUSES: readonly string[] = ['music', 'ambience', 'sfx', 'ui', 'voice'];

const soundId = z
  .string()
  .regex(SOUND_ID_PATTERN)
  .describe('Sound id from a molen/soundbank@1 document, e.g. "ambience.rain.medium".');
const busName = z
  .string()
  .regex(AUDIO_BUS_PATTERN)
  .describe('Mixer bus: music, ambience, sfx, ui, voice, or a custom lowercase name.');
const gainValue = finite.min(0).max(4);
const pitchRange = z.array(finite.positive()).length(2) as unknown as z.ZodType<[number, number]>;
const seconds = finite.nonnegative();

// --- sound bank ---

export type SoundSpatial = {
  refDistance?: number;
  maxDistance?: number;
  rolloff?: number;
  model?: 'linear' | 'inverse' | 'exponential';
};

export type SoundSource = {
  license: string;
  site?: string;
  url?: string;
  author?: string;
  title?: string;
  prompt?: string;
  generator?: string;
  notes?: string;
};

export type SoundEntry = {
  clips: string[];
  description?: string;
  tags?: string[];
  loop?: boolean;
  loopStart?: number;
  loopEnd?: number;
  gain?: number;
  pitch?: [number, number];
  bus?: string;
  spatial?: SoundSpatial | false;
  durationS?: number;
  hash?: string;
  source: SoundSource;
};

export type SoundbankDoc = {
  format: 'molen/soundbank@1';
  id: string;
  title?: string;
  license?: string;
  sounds: Record<string, SoundEntry>;
};

const spatialSchema: z.ZodType<SoundSpatial> = z.strictObject({
  refDistance: finite
    .positive()
    .optional()
    .describe('Distance in meters at which the sound plays at full gain; default 1.'),
  maxDistance: finite
    .positive()
    .optional()
    .describe('Distance in meters beyond which the sound is culled; default 60.'),
  rolloff: finite
    .nonnegative()
    .optional()
    .describe('How fast gain falls off past refDistance; default 1.'),
  model: z
    .enum(['linear', 'inverse', 'exponential'])
    .optional()
    .describe('Distance attenuation model (Web Audio PannerNode.distanceModel); default inverse.'),
});

const spatialOrFlat = z
  .union([z.literal(false), spatialSchema])
  .describe('false = non-positional (2D); an object = positional with these distance settings.');

const soundSourceSchema: z.ZodType<SoundSource> = z.strictObject({
  license: z
    .string()
    .min(1)
    .describe('SPDX-style license of this recording, e.g. "CC0-1.0". Required provenance.'),
  site: z.string().optional().describe('Where it came from: freesound, kenney, opengameart, …'),
  url: z.string().optional().describe('Page of the original recording.'),
  author: z.string().optional().describe('Recordist or creator.'),
  title: z.string().optional().describe('Original title.'),
  prompt: z.string().optional().describe('Prompt text, when the clip was generated.'),
  generator: z.string().optional().describe('Generator/model name, when the clip was generated.'),
  notes: z.string().optional().describe('Edits made: trims, loudness normalization, loop points.'),
});

const soundEntrySchema: z.ZodType<SoundEntry> = z.strictObject({
  clips: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      'Audio files relative to the bank document (MP3 plays in every browser). Several clips = variations picked per play.',
    ),
  description: z
    .string()
    .optional()
    .describe('What it sounds like, for agents choosing sounds ("steady medium rain on leaves").'),
  tags: z.array(z.string()).optional().describe('Search tags.'),
  loop: z.boolean().optional().describe('Loop the clip (ambience, engines); default false.'),
  loopStart: seconds.optional().describe('Loop start in seconds (trims encoder padding).'),
  loopEnd: seconds.optional().describe('Loop end in seconds; must exceed loopStart.'),
  gain: gainValue.optional().describe('Linear base gain; default 1.'),
  pitch: pitchRange
    .optional()
    .describe('[min, max] playback-rate range; each play picks a value in it. Default [1, 1].'),
  bus: busName.optional().describe('Default bus; default sfx.'),
  spatial: spatialOrFlat.optional(),
  durationS: seconds
    .optional()
    .describe('Clip duration in seconds (written by molen audio import).'),
  hash: z.string().optional().describe('sha256 of the first clip, "sha256:<hex>".'),
  source: soundSourceSchema.describe('Provenance: license plus origin or generation prompt.'),
});

export const soundbankSchema: z.ZodType<SoundbankDoc> = z.strictObject({
  format: z.literal('molen/soundbank@1').describe("Format envelope; always 'molen/soundbank@1'."),
  id: z.string().min(1).describe('Bank id, usually the content pack id, e.g. "molen.sounds".'),
  title: z.string().optional().describe('Human title.'),
  license: z
    .string()
    .optional()
    .describe(
      'Bank-wide license policy. When set, every sound must carry exactly this source.license.',
    ),
  sounds: z
    .record(z.string().regex(SOUND_ID_PATTERN), soundEntrySchema)
    .describe('Sound id → entry. Later banks override earlier ones with the same id.'),
}) as unknown as z.ZodType<SoundbankDoc>;

/** Cross-field checks Zod cannot express (loop ranges, pitch order, license policy, paths). */
export function validateSoundbank(data: unknown): ValidationIssue[] {
  const doc = data as SoundbankDoc;
  const issues: ValidationIssue[] = [];
  for (const [id, entry] of Object.entries(doc.sounds)) {
    const at = `/sounds/${id}`;
    if (entry.loopStart !== undefined && entry.loopEnd !== undefined) {
      if (entry.loopEnd <= entry.loopStart)
        issues.push({
          path: `${at}/loopEnd`,
          code: 'loop_range',
          message: `loopEnd (${entry.loopEnd}) must be greater than loopStart (${entry.loopStart})`,
        });
    }
    if (entry.durationS !== undefined && entry.loopEnd !== undefined) {
      if (entry.loopEnd > entry.durationS + 1e-6)
        issues.push({
          path: `${at}/loopEnd`,
          code: 'loop_range',
          message: `loopEnd (${entry.loopEnd}) is past the clip end (${entry.durationS}s)`,
        });
    }
    if (entry.pitch && entry.pitch[0] > entry.pitch[1])
      issues.push({
        path: `${at}/pitch`,
        code: 'pitch_range',
        message: 'pitch is [min, max]; min must not exceed max',
      });
    entry.clips.forEach((clip, i) => {
      if (clip.startsWith('/') || clip.split('/').includes('..') || /^[a-z]+:/i.test(clip))
        issues.push({
          path: `${at}/clips/${i}`,
          code: 'clip_path',
          message: `clip "${clip}" must be a relative path inside the bank's directory`,
        });
    });
    if (new Set(entry.clips).size !== entry.clips.length)
      issues.push({ path: `${at}/clips`, code: 'duplicate_clip', message: 'clips repeat a file' });
    if (doc.license !== undefined && entry.source.license !== doc.license)
      issues.push({
        path: `${at}/source/license`,
        code: 'license_policy',
        message: `sound is licensed "${entry.source.license}" but the bank requires "${doc.license}"`,
        hint: 'move it to a bank with a compatible license, or replace the recording',
      });
  }
  return issues;
}

// --- rule vocabulary ---

export type AudioScalar = string | number | boolean;
export type AudioCondition =
  | AudioScalar
  | AudioScalar[]
  | { min?: number; max?: number }
  | { exists: boolean };
export type AudioWhen = Record<string, AudioCondition>;

export type AudioSignalBinding = {
  signal: string;
  curve: [number, number][];
  smoothS?: number;
};

export type AudioTrigger = {
  signal: string;
  every?: number;
  onChange?: boolean;
  sound?: string;
};

const scalar = z.union([z.string(), finite, z.boolean()]);
const conditionSchema: z.ZodType<AudioCondition> = z.union([
  scalar,
  z.array(scalar).min(1),
  z.strictObject({
    min: finite.optional().describe('Inclusive lower bound.'),
    max: finite.optional().describe('Inclusive upper bound.'),
  }),
  z.strictObject({ exists: z.boolean().describe('true = the signal resolves to a value.') }),
]) as z.ZodType<AudioCondition>;

export const audioWhenSchema: z.ZodType<AudioWhen> = z
  .record(z.string().min(1), conditionSchema)
  .describe(
    'Conditions that must ALL hold, keyed by signal: a value (equality), a list (any of), {min,max} (inclusive range), or {exists}.',
  );

const curvePoint = z.array(finite).length(2) as unknown as z.ZodType<[number, number]>;

export const audioSignalBindingSchema: z.ZodType<AudioSignalBinding> = z.strictObject({
  signal: z
    .string()
    .min(1)
    .describe(
      'Signal path: <component>.<field> on the entity (vehicleState.speed), or self.*, listener.*, weather.*, sky.*, time.*, host.*.',
    ),
  curve: z
    .array(curvePoint)
    .min(1)
    .describe('Piecewise-linear [input, output] points, clamped at the ends.'),
  smoothS: seconds.optional().describe('Smoothing time constant in seconds; default 0.15.'),
});

/** One signal binding, or several whose outputs multiply (fade with height AND distance). */
export type AudioSignalDrive = AudioSignalBinding | AudioSignalBinding[];

export const audioSignalDriveSchema: z.ZodType<AudioSignalDrive> = z.union([
  audioSignalBindingSchema,
  z.array(audioSignalBindingSchema).min(1),
]) as z.ZodType<AudioSignalDrive>;

/** The bindings of a drive as a list. */
export function audioSignalBindings(drive: AudioSignalDrive | undefined): AudioSignalBinding[] {
  return drive === undefined ? [] : Array.isArray(drive) ? drive : [drive];
}

const triggerSchema: z.ZodType<AudioTrigger> = z.strictObject({
  signal: z.string().min(1).describe('Signal to watch (see signal paths).'),
  every: finite
    .positive()
    .optional()
    .describe('Fire each time the signal advances by this much (odometer-style, e.g. meters).'),
  onChange: z.boolean().optional().describe('Fire whenever the signal value changes.'),
  sound: soundId.optional().describe("Sound to fire; default the source's own sound."),
});

// --- components ---

export type AudioSourceData = {
  sound: string;
  loop?: boolean;
  autoplay?: boolean;
  gain?: number;
  pitch?: number;
  bus?: string;
  spatial?: SoundSpatial | false;
  when?: AudioWhen;
  gainFrom?: AudioSignalDrive;
  pitchFrom?: AudioSignalDrive;
  triggerFrom?: AudioTrigger;
  startTick?: number;
};

export const audioSourceSchema: z.ZodType<AudioSourceData> = z.strictObject({
  sound: soundId,
  loop: z.boolean().optional().describe("Loop while active; default the sound's own loop flag."),
  autoplay: z
    .boolean()
    .optional()
    .describe(
      'Play when the entity exists and `when` holds; default true. false = only triggerFrom/startTick fire it.',
    ),
  gain: gainValue.optional().describe('Gain multiplier; default 1.'),
  pitch: finite.positive().optional().describe('Playback-rate multiplier; default 1.'),
  bus: busName.optional(),
  spatial: spatialOrFlat
    .optional()
    .describe(
      "Override the sound's spatial settings. Positional sources follow the entity's transform.",
    ),
  when: audioWhenSchema.optional(),
  gainFrom: audioSignalDriveSchema
    .optional()
    .describe('Drive gain from a signal, or from several whose curves multiply.'),
  pitchFrom: audioSignalDriveSchema
    .optional()
    .describe('Drive pitch from a signal, or from several whose curves multiply.'),
  triggerFrom: triggerSchema
    .optional()
    .describe('Fire one-shots from a signal (footsteps from distance, clicks on change).'),
  startTick: finite
    .int()
    .nonnegative()
    .optional()
    .describe('Play once at this tick; changing it retriggers (like renderable.animation).'),
});

export type AudioZoneData = {
  sound: string;
  shape:
    | { kind: 'sphere'; radius: number }
    | { kind: 'box'; halfExtents: [number, number, number] };
  fade?: number;
  gain?: number;
  bus?: string;
  when?: AudioWhen;
};

export const audioZoneSchema: z.ZodType<AudioZoneData> = z.strictObject({
  sound: soundId.describe('Looping ambience played while the listener is inside the zone.'),
  shape: z
    .discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('sphere').describe('Sphere around the entity.'),
        radius: finite.positive().describe('Radius in meters.'),
      }),
      z.strictObject({
        kind: z.literal('box').describe('Axis-aligned box around the entity.'),
        halfExtents: vec3.describe('Half sizes [x, y, z] in meters, axis-aligned.'),
      }),
    ])
    .describe("Zone volume, centered on the entity's transform."),
  fade: finite
    .nonnegative()
    .optional()
    .describe('Meters outside the shape over which gain fades to zero; default 5.'),
  gain: gainValue.optional().describe('Gain multiplier; default 1.'),
  bus: busName.optional().describe('Default ambience.'),
  when: audioWhenSchema.optional(),
});

export type AudioAmbienceLayer = {
  sound: string;
  when?: AudioWhen;
  gain?: number;
  gainFrom?: AudioSignalDrive;
  pitchFrom?: AudioSignalDrive;
  fadeS?: number;
};

export type AudioMusicSpec = {
  playlist: string[];
  mode?: 'sequence' | 'shuffle';
  crossfadeS?: number;
  gain?: number;
  when?: AudioWhen;
};

export type AudioEventRule = {
  sound: string;
  at?: string;
  gain?: number;
  pitch?: number;
  bus?: string;
};

export type AudioFootsteps = {
  sound: string;
  surfaces?: Record<string, string>;
  strideM?: number;
  gain?: number;
  when?: AudioWhen;
};

export type AudioEnvironmentData = {
  buses?: Record<string, number>;
  ambience?: AudioAmbienceLayer[];
  music?: AudioMusicSpec;
  events?: Record<string, AudioEventRule>;
  footsteps?: AudioFootsteps;
  listenerEntity?: string;
  maxVoices?: number;
};

const ambienceLayerSchema: z.ZodType<AudioAmbienceLayer> = z.strictObject({
  sound: soundId,
  when: audioWhenSchema.optional(),
  gain: gainValue.optional().describe('Gain multiplier; default 1.'),
  gainFrom: audioSignalDriveSchema
    .optional()
    .describe('Drive gain from a signal, or from several whose curves multiply.'),
  pitchFrom: audioSignalDriveSchema
    .optional()
    .describe('Drive pitch from a signal, or from several whose curves multiply.'),
  fadeS: seconds.optional().describe('Fade in/out time in seconds; default 1.5.'),
});

const eventRuleSchema: z.ZodType<AudioEventRule> = z.strictObject({
  sound: soundId,
  at: z
    .string()
    .optional()
    .describe(
      'Where it plays: "listener" (2D) or "payload.<field>" naming an entity id or [x,y,z]. Default: payload.entity, payload.position, payload.a, else listener.',
    ),
  gain: gainValue.optional(),
  pitch: finite.positive().optional(),
  bus: busName.optional(),
});

export const audioEnvironmentSchema: z.ZodType<AudioEnvironmentData> = z.strictObject({
  buses: z
    .record(z.string().regex(AUDIO_BUS_PATTERN), finite.min(0).max(2))
    .optional()
    .describe('Bus gains (music, ambience, sfx, ui, voice, custom), default 1 each.'),
  ambience: z
    .array(ambienceLayerSchema)
    .optional()
    .describe('Looping ambience layers, each active while its `when` holds.'),
  music: z
    .strictObject({
      playlist: z.array(soundId).min(1).describe('Tracks, played on the music bus.'),
      mode: z.enum(['sequence', 'shuffle']).optional().describe('Default sequence.'),
      crossfadeS: seconds.optional().describe('Crossfade between tracks; default 4.'),
      gain: gainValue.optional().describe('Music gain multiplier; default 1.'),
      when: audioWhenSchema.optional(),
    })
    .optional()
    .describe('Background music; scripts switch it with molen.audio.music().'),
  events: z
    .record(z.string().min(1), eventRuleSchema)
    .optional()
    .describe('Engine/script event type → one-shot sound (e.g. "crash", "delivery").'),
  footsteps: z
    .strictObject({
      sound: soundId.describe('Default footstep sound.'),
      surfaces: z
        .record(z.string(), soundId)
        .optional()
        .describe('listener.surface value → footstep sound (grass, concrete, wood…).'),
      strideM: finite.positive().optional().describe('Meters per step; default 0.75.'),
      gain: gainValue.optional().describe('Footstep gain multiplier; default 1.'),
      when: audioWhenSchema.optional().describe('Default { "listener.grounded": true }.'),
    })
    .optional()
    .describe('Listener footsteps from distance travelled (walk modes, first-person games).'),
  listenerEntity: z
    .string()
    .optional()
    .describe(
      "Entity treated as the listener's body; <component>.<field> signals in ambience/music/footsteps resolve on it.",
    ),
  maxVoices: finite.int().min(1).max(256).optional().describe('Voice budget; default 32.'),
});

// --- signals ---

/** Built-in signal names (besides `<component>.<field>` on an entity and host-supplied `host.*`). */
export const AUDIO_SIGNALS: Readonly<Record<string, string>> = {
  'listener.x': 'Listener world X (m).',
  'listener.y': 'Listener world Y (m).',
  'listener.z': 'Listener world Z (m).',
  'listener.altitude': 'Listener world Y (m); alias of listener.y.',
  'listener.heightAboveGround':
    'Host-reported height of the listener above the ground (m); 0 when the host does not report it.',
  'listener.speed': 'Listener speed (m/s).',
  'listener.distance': 'Odometer: meters the listener has travelled.',
  'listener.mode': 'Host navigation mode: walk, drive, fly, orbit, pilot…',
  'listener.grounded': 'true when the listener stands or rolls on the ground.',
  'listener.surface': 'Host-reported surface under the listener: grass, concrete, wood…',
  'listener.indoors': 'Host-reported: true when the listener is inside a building.',
  'weather.precipitation.kind': 'none | rain | snow.',
  'weather.precipitation.intensity': '0–1 precipitation intensity.',
  'weather.windSpeed': 'Wind speed (m/s), |atmosphere.windVelocity|.',
  'weather.visibility': 'Visibility (m).',
  'weather.clouds.coverage': '0–1 cloud coverage.',
  'weather.atmosphere.temperatureK': 'Temperature (K).',
  'sky.daylight': '0 (night) – 1 (full day).',
  'sky.starVisibility': '0–1 star visibility.',
  'sky.sunElevation': 'Sun elevation in degrees.',
  'self.x': "The source entity's world X (m), from its transform.",
  'self.y': "The source entity's world Y (m).",
  'self.z': "The source entity's world Z (m).",
  'self.speed': "The source entity's speed (m/s), measured from its transform between frames.",
  'self.distance': 'Odometer: meters the source entity has moved.',
  'self.occupied':
    'true while someone rides the source entity (a `mounted` component names it): engines that run only with a driver.',
  'time.seconds': 'Seconds since the audio layer started.',
};

const BUILTIN_PREFIXES = ['listener.', 'weather.', 'sky.', 'time.', 'self.'];

/** Issues for a signal path (unknown built-ins get did-you-mean); component paths pass. */
export function audioSignalIssues(signal: string, path = ''): ValidationIssue[] {
  if (signal.startsWith('host.')) return [];
  if (signal.startsWith('weather.atmosphere.')) return [];
  if (!BUILTIN_PREFIXES.some((p) => signal.startsWith(p))) {
    return signal.includes('.')
      ? []
      : [
          {
            path,
            code: 'audio_signal',
            message: `signal "${signal}" is not a path; use <component>.<field>, self.*, listener.*, weather.*, sky.*, time.* or host.*`,
          },
        ];
  }
  if (signal in AUDIO_SIGNALS) return [];
  const near = nearestWithDistance(signal, Object.keys(AUDIO_SIGNALS));
  return [
    {
      path,
      code: 'audio_signal',
      message: `unknown built-in signal "${signal}"`,
      ...(near ? { hint: `did you mean "${near.candidate}"?` } : {}),
    },
  ];
}

/** Every signal path an audio component or environment references, with its JSON Pointer. */
export function audioSignalRefs(
  component: 'audioSource' | 'audioZone' | 'audioEnvironment',
  data: AudioSourceData | AudioZoneData | AudioEnvironmentData,
): { signal: string; path: string }[] {
  const out: { signal: string; path: string }[] = [];
  const when = (w: AudioWhen | undefined, at: string): void => {
    for (const key of Object.keys(w ?? {})) out.push({ signal: key, path: `${at}/when/${key}` });
  };
  const bind = (b: AudioSignalDrive | AudioTrigger | undefined, at: string): void => {
    if (Array.isArray(b)) {
      for (const [i, one] of b.entries())
        out.push({ signal: one.signal, path: `${at}/${i}/signal` });
    } else if (b) out.push({ signal: b.signal, path: `${at}/signal` });
  };
  if (component === 'audioSource') {
    const s = data as AudioSourceData;
    when(s.when, '');
    bind(s.gainFrom, '/gainFrom');
    bind(s.pitchFrom, '/pitchFrom');
    bind(s.triggerFrom, '/triggerFrom');
  } else if (component === 'audioZone') {
    when((data as AudioZoneData).when, '');
  } else {
    const e = data as AudioEnvironmentData;
    (e.ambience ?? []).forEach((l, i) => {
      when(l.when, `/ambience/${i}`);
      bind(l.gainFrom, `/ambience/${i}/gainFrom`);
      bind(l.pitchFrom, `/ambience/${i}/pitchFrom`);
    });
    when(e.music?.when, '/music');
    when(e.footsteps?.when, '/footsteps');
  }
  return out;
}

/** Every sound id an audio component or environment references, with its JSON Pointer. */
export function audioSoundRefs(
  component: 'audioSource' | 'audioZone' | 'audioEnvironment',
  data: AudioSourceData | AudioZoneData | AudioEnvironmentData,
): { sound: string; path: string }[] {
  const out: { sound: string; path: string }[] = [];
  if (component === 'audioSource') {
    const s = data as AudioSourceData;
    out.push({ sound: s.sound, path: '/sound' });
    if (s.triggerFrom?.sound) out.push({ sound: s.triggerFrom.sound, path: '/triggerFrom/sound' });
  } else if (component === 'audioZone') {
    out.push({ sound: (data as AudioZoneData).sound, path: '/sound' });
  } else {
    const e = data as AudioEnvironmentData;
    for (const [i, l] of (e.ambience ?? []).entries())
      out.push({ sound: l.sound, path: `/ambience/${i}/sound` });
    for (const [i, s] of (e.music?.playlist ?? []).entries())
      out.push({ sound: s, path: `/music/playlist/${i}` });
    for (const [type, rule] of Object.entries(e.events ?? {}))
      out.push({ sound: rule.sound, path: `/events/${type}/sound` });
    if (e.footsteps) {
      out.push({ sound: e.footsteps.sound, path: '/footsteps/sound' });
      for (const [surface, s] of Object.entries(e.footsteps.surfaces ?? {}))
        out.push({ sound: s, path: `/footsteps/surfaces/${surface}` });
    }
  }
  return out;
}

export const SOUNDBANK_EXAMPLE: SoundbankDoc = {
  format: 'molen/soundbank@1',
  id: 'my.sounds',
  license: 'CC0-1.0',
  sounds: {
    'ambience.rain.medium': {
      clips: ['ambience/rain-medium.mp3'],
      description: 'Steady medium rain on foliage and pavement.',
      loop: true,
      loopStart: 0.05,
      loopEnd: 29.9,
      gain: 0.8,
      bus: 'ambience',
      spatial: false,
      durationS: 30,
      source: { license: 'CC0-1.0', site: 'freesound', url: 'https://freesound.org/s/000000/' },
    },
    'footstep.grass': {
      clips: ['footsteps/grass-1.mp3', 'footsteps/grass-2.mp3', 'footsteps/grass-3.mp3'],
      description: 'Single footstep on short grass.',
      pitch: [0.94, 1.06],
      gain: 0.6,
      bus: 'sfx',
      source: { license: 'CC0-1.0', site: 'kenney', notes: 'trimmed, normalized to -16 LUFS' },
    },
  },
};

registerSchema('soundbank', soundbankSchema, {
  id: 'molen/soundbank@1',
  title: 'Sound bank',
  description:
    'Named sounds for the audio director: clip files (relative to the bank), loop points, gain, pitch range, bus, spatial defaults and required provenance. Content packs expose banks under provides.soundbank.',
  examples: [SOUNDBANK_EXAMPLE as unknown as JsonValue],
  docsRef: 'guide/audio.md',
  validate: validateSoundbank,
});
