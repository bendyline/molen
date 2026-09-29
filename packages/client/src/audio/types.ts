import type {
  AudioScalar,
  EngineEvent,
  EntityId,
  JsonObject,
  WeatherData,
} from '@bendyline/molen-schema';

export type AudioVec3 = [number, number, number];

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
    }
  | {
      op: 'set';
      voice: string;
      gain?: number;
      pitch?: number;
      position?: AudioVec3;
      rampS?: number;
    }
  | { op: 'stop'; voice: string; fadeS?: number }
  | { op: 'listener'; position: AudioVec3; forward: AudioVec3; up: AudioVec3 }
  | { op: 'bus'; bus: string; gain: number };

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
