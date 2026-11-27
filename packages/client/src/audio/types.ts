import type {
  AudioScalar,
  EngineEvent,
  EntityId,
  JsonObject,
  WeatherData,
} from '@bendyline/molen-schema';

export type AudioVec3 = [number, number, number];

export type AudioListenerSpace = 'open' | 'cabin' | 'building' | 'tunnel';

/** Reverberation presets the backend can add; generated, so no recording is needed. */
export type AudioReverb = 'room' | 'tunnel' | 'street';

/** What the listener's surroundings do to sound from outside them. */
export interface AudioEnclosure {
  /** Attenuation of outside sound, dB (0 in the open). */
  isolationDb: number;
  /** Low-pass cutoff on outside sound, Hz (20000 in the open). */
  cutoffHz: number;
  reverb?: AudioReverb;
  /** Reverberation level 0..1. */
  wet?: number;
}

/** Where the ears are, in world space (render origin already added back). */
export interface AudioListenerState {
  position: AudioVec3;
  /** Unit look direction. */
  forward: AudioVec3;
  /** Unit up direction. */
  up: AudioVec3;
  /** World velocity (m/s); when absent the director measures it between updates. */
  velocity?: AudioVec3;
  /** Speed (m/s); overrides the measured value. */
  speed?: number;
  /** Host navigation mode: walk, drive, fly, orbit, pilot… (the `listener.mode` signal). */
  mode?: string;
  /** false suppresses footsteps; undefined counts as grounded. */
  grounded?: boolean;
  /** Surface under the listener (grass, concrete, wood…), selects footstep sounds. */
  surface?: string;
  /** true when the listener is inside a building. */
  indoors?: boolean;
  /**
   * The space around the ears: open air, a vehicle's cabin, a building or a tunnel. It decides how
   * much everything outside is muffled and which reverberation plays. Default open (or building
   * when `indoors`).
   */
  space?: AudioListenerSpace;
  /** The entity the listener rides in: its sound profile's interior layers and cabin apply. */
  vehicle?: EntityId;
  /** Override the enclosure the space implies (how a cabin or building muffles the outside). */
  enclosure?: AudioEnclosure;
  /** Reverberant surroundings outside the space: a tunnel, a street between tall buildings. */
  reverb?: AudioReverb;
  /**
   * Height above the ground under the listener (m); the `listener.heightAboveGround` signal. Hosts
   * with terrain report it so ground-level ambience (birds, traffic) fades as the listener rises.
   */
  heightAboveGround?: number;
}

/** Sky state the director reads (a subset of the client's SkyFrame). */
export interface AudioSkySignals {
  sunDirection?: AudioVec3;
  daylight: number;
  starVisibility?: number;
}

/** World-level signals: weather, sky and anything else the host wants to expose as `host.*`. */
export interface AudioEnvironmentSignals {
  weather?: WeatherData;
  sky?: AudioSkySignals;
  host?: Record<string, AudioScalar | undefined>;
}

/**
 * The structural slice of an entity store the director reads. Implemented over a Worker-linked
 * `MolenClient` (`entitySourceFromClient`) and over a main-thread kernel `World`
 * (`entitySourceFromWorld`); a kernel-less viewer passes none.
 */
export interface AudioEntitySource {
  readonly tick: number | undefined;
  readonly tickRate?: number;
  /** Every entity carrying `component`, with that component's (read-only) data. */
  each(component: string): Iterable<[EntityId, JsonObject]>;
  get(id: EntityId, component: string): JsonObject | undefined;
  /** Subscribe to every engine event; returns an unsubscribe. */
  onEvent?(cb: (event: EngineEvent, tick: number) => void): () => void;
}

export interface DirectorInput {
  /** Wall-clock milliseconds (performance.now in browsers; simulated time headlessly). */
  nowMs: number;
  listener?: Partial<AudioListenerState>;
  source?: AudioEntitySource;
  signals?: AudioEnvironmentSignals;
}

export interface VoiceSpatial {
  position: AudioVec3;
  refDistance: number;
  maxDistance: number;
  rolloff: number;
  model: 'linear' | 'inverse' | 'exponential';
}

/** Optional rotor timbre and loading envelope; evaluated at audio rate by the backend. */
export interface VoiceTone {
  lowpassHz: number;
  pulseHz: number;
  pulseDepth: number;
}

/** The director's output: a diff the backend applies. */
export type VoiceCommand =
  | {
      op: 'start';
      voice: string;
      sound: string;
      /** Asset ref for `AssetProvider.load` (bank base + clip path). */
      ref: string;
      loop: boolean;
      loopStart?: number;
      loopEnd?: number;
      gain: number;
      pitch: number;
      bus: string;
      spatial?: VoiceSpatial;
      fadeInS?: number;
      tone?: VoiceTone;
      /** Outside the listener's enclosure: muffled by a cabin or building around the ears. */
      outside?: boolean;
      /** Low-pass for air absorption over distance, Hz; absent means none. */
      lowpassHz?: number;
    }
  | {
      op: 'set';
      voice: string;
      gain?: number;
      pitch?: number;
      position?: AudioVec3;
      rampS?: number;
      tone?: VoiceTone;
      lowpassHz?: number;
    }
  | { op: 'stop'; voice: string; fadeS?: number }
  | { op: 'listener'; position: AudioVec3; forward: AudioVec3; up: AudioVec3 }
  | { op: 'bus'; bus: string; gain: number }
  | { op: 'enclosure'; enclosure: AudioEnclosure; rampS?: number };

export interface AudioBackendStats {
  voices: number;
  decoded: number;
  pending: number;
  state: 'running' | 'suspended' | 'closed' | 'headless';
}

/** Realizes voice commands. `WebAudioBackend` plays them; `createRecordingBackend` logs them. */
export interface AudioBackend {
  apply(commands: readonly VoiceCommand[]): void;
  /** Resume audio output; browsers require a user gesture first. */
  unlock(): Promise<void>;
  readonly unlocked: boolean;
  /** Pause/resume output without losing voices (page hidden, game paused). */
  setSuspended?(suspended: boolean): void;
  /** Decode clips ahead of first use. */
  preload?(refs: readonly string[]): Promise<void>;
  stats(): AudioBackendStats;
  dispose(): void;
}
