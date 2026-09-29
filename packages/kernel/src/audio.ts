import type {
  AudioEnvironmentData,
  AudioSourceData,
  AudioZoneData,
  JsonObject,
} from '@bendyline/molen-schema';
import { type ComponentType, defineComponent } from './component';
import type { Vec3 } from './math3d';
import type { World } from './world';

// Audio in the kernel is only vocabulary and events. Components are plain data the client's
// audio director reads; `molen.audio.*` emits ordinary events, so a headless run records and
// asserts them while nothing about playback enters the state hash.

export const AudioSource: ComponentType<AudioSourceData> =
  defineComponent<AudioSourceData>('audioSource');
export const AudioZone: ComponentType<AudioZoneData> = defineComponent<AudioZoneData>('audioZone');
export const AudioEnvironment: ComponentType<AudioEnvironmentData> =
  defineComponent<AudioEnvironmentData>('audioEnvironment');

/** Event emitted by `molen.audio.play`. */
export const AUDIO_PLAY: 'audio.play' = 'audio.play';
/** Event emitted by `molen.audio.stop`. */
export const AUDIO_STOP: 'audio.stop' = 'audio.stop';
/** Event emitted by `molen.audio.music`. */
export const AUDIO_MUSIC: 'audio.music' = 'audio.music';

export interface AudioPlayPayload extends JsonObject {
  handle: string;
  sound: string;
  entity?: string;
  position?: Vec3;
  gain?: number;
  pitch?: number;
  bus?: string;
  loop?: boolean;
}

export interface AudioStopPayload extends JsonObject {
  handle?: string;
  entity?: string;
  sound?: string;
  fadeS?: number;
}

export interface AudioMusicPayload extends JsonObject {
  playlist: string[] | null;
  crossfadeS?: number;
}

export interface AudioPlayOptions {
  /** Play at (and follow) this entity's transform. */
  entity?: string;
  /** Play at a fixed world position. Omit both for a non-positional sound. */
  position?: Vec3;
  gain?: number;
  pitch?: number;
  bus?: string;
  /** Loop until `stop(handle)`; default the sound's own loop flag. */
  loop?: boolean;
}

export interface AudioScriptApi {
  /** Play a sound-bank id; returns a handle for `stop`. Emits `audio.play`. */
  play(sound: string, opts?: AudioPlayOptions): string;
  /** Stop by handle, or every voice matching an entity and/or sound. Emits `audio.stop`. */
  stop(target: string | { entity?: string; sound?: string }, fadeS?: number): void;
  /** Switch background music to a track or playlist; null stops it. Emits `audio.music`. */
  music(playlist: string | string[] | null, opts?: { crossfadeS?: number }): void;
}

/**
 * The `molen.audio` namespace: thin wrappers that emit `audio.play|stop|music` events. Handles
 * are `${sound}@${tick}#${n}` (n counts calls within the tick), so they are deterministic.
 */
export function audioScriptApi(world: World): AudioScriptApi {
  let lastTick = -1;
  let count = 0;
  return {
    play(sound, opts = {}) {
      if (typeof sound !== 'string' || sound.length === 0)
        throw new Error('molen.audio.play needs a sound id');
      if (world.tick !== lastTick) {
        lastTick = world.tick;
        count = 0;
      }
      const handle = `${sound}@${world.tick}#${count++}`;
      const payload: AudioPlayPayload = { handle, sound };
      if (opts.entity !== undefined) payload.entity = opts.entity;
      if (opts.position !== undefined) payload.position = [...opts.position] as Vec3;
      if (opts.gain !== undefined) payload.gain = opts.gain;
      if (opts.pitch !== undefined) payload.pitch = opts.pitch;
      if (opts.bus !== undefined) payload.bus = opts.bus;
      if (opts.loop !== undefined) payload.loop = opts.loop;
      world.emit(AUDIO_PLAY, payload);
      return handle;
    },
    stop(target, fadeS) {
      const payload: AudioStopPayload =
        typeof target === 'string' ? { handle: target } : { ...target };
      if (fadeS !== undefined) payload.fadeS = fadeS;
      world.emit(AUDIO_STOP, payload);
    },
    music(playlist, opts = {}) {
      const payload: AudioMusicPayload = {
        playlist: playlist === null ? null : Array.isArray(playlist) ? [...playlist] : [playlist],
      };
      if (opts.crossfadeS !== undefined) payload.crossfadeS = opts.crossfadeS;
      world.emit(AUDIO_MUSIC, payload);
    },
  };
}

/** First audioEnvironment entity in world order (the singleton), like `weatherOf`. */
export function audioEnvironmentOf(world: World): Readonly<AudioEnvironmentData> | undefined {
  return world.query(AudioEnvironment).first()?.[1];
}
