import type {
  AudioEnvironmentData,
  EntityId,
  SoundbankDoc,
  WeatherData,
} from '@bendyline/molen-schema';
import type { AssetProvider } from '../assets';
import {
  type AudioClientLike,
  type AudioWorldLike,
  entitySourceFromClient,
  entitySourceFromWorld,
} from './adapters';
import { mergeSoundbanks, type SoundbankInput } from './bank';
import { AudioDirector } from './director';
import { type AudioCameraLike, listenerFromCamera } from './listener';
import { createRecordingBackend } from './recording-backend';
import type {
  AudioBackend,
  AudioBackendStats,
  AudioEntitySource,
  AudioEnvironmentSignals,
  AudioListenerState,
  AudioSkySignals,
  AudioVec3,
  VoiceCommand,
} from './types';
import { WebAudioBackend } from './web-audio-backend';

/** The renderer slice the layer reads: camera pose, world origin, sky and weather state. */
export interface AudioRendererLike {
  readonly camera: AudioCameraLike;
  getWorldOrigin(): ArrayLike<number>;
  readonly sky?: { readonly frame?: AudioSkySignals } | undefined;
  readonly weather?: { readonly data?: WeatherData } | undefined;
}

export interface AudioLayerOptions {
  /** Sound banks, earliest first; later banks override sounds with the same id. */
  banks: readonly (SoundbankDoc | SoundbankInput)[];
  /** Loads clip bytes; required for the default Web Audio backend. */
  provider?: AssetProvider;
  /** Default: Web Audio when available (and a provider is given), else a silent recorder. */
  backend?: AudioBackend;
  /** Host soundscape rules; a scene's audioEnvironment entity overrides them key by key. */
  environment?: AudioEnvironmentData;
  /** Listener from this camera and sky/weather signals from this renderer, when given. */
  renderer?: AudioRendererLike;
  /** Extra signals merged over the renderer's each update (e.g. `host.landcover`). */
  signals?: () => AudioEnvironmentSignals | undefined;
  /** Master volume 0–1 (default 1) and mute. */
  volume?: number;
  muted?: boolean;
  /** Suspend output while the page is hidden; default true. */
  suspendWhenHidden?: boolean;
  maxOneShots?: number;
  seed?: string | number;
  onWarning?: (message: string) => void;
}

export interface AudioLayerStats {
  voices: number;
  warnings: number;
  backend: AudioBackendStats;
}

export interface AudioLayer {
  readonly director: AudioDirector;
  readonly backend: AudioBackend;
  readonly volume: number;
  readonly muted: boolean;
  readonly unlocked: boolean;
  /** Advance one frame: resolve rules against the listener and signals, then play the diff. */
  update(
    nowMs: number,
    listener?: Partial<AudioListenerState>,
    signals?: AudioEnvironmentSignals,
  ): void;
  /** Read entities and events from a Worker-linked client (game samples). */
  attachClient(client: AudioClientLike, opts?: { tickRate?: number }): () => void;
  /** Read entities and events from a main-thread kernel World (vehicles, aircraft). */
  attachWorld(world: AudioWorldLike): () => void;
  /** Plug in any entity source; undefined detaches. */
  setSource(source: AudioEntitySource | undefined): void;
  play(
    sound: string,
    opts?: {
      entity?: EntityId;
      position?: AudioVec3;
      gain?: number;
      pitch?: number;
      bus?: string;
      loop?: boolean;
    },
  ): string;
  stop(target: string | { entity?: EntityId; sound?: string }, fadeS?: number): void;
  music(playlist: string | string[] | null, opts?: { crossfadeS?: number }): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  /** Host-side bus trim, multiplied with the environment's bus gain. */
  setBusGain(bus: string, gain: number): void;
  setEnvironment(environment: AudioEnvironmentData | undefined): void;
  setBanks(banks: readonly (SoundbankDoc | SoundbankInput)[]): void;
  unlock(): Promise<void>;
  setSuspended(suspended: boolean): void;
  stats(): AudioLayerStats;
  dispose(): void;
}

function defaultBackend(opts: AudioLayerOptions): AudioBackend {
  if (opts.backend) return opts.backend;
  if (opts.provider && typeof AudioContext !== 'undefined')
    return new WebAudioBackend({
      provider: opts.provider,
      ...(opts.onWarning ? { onError: opts.onWarning } : {}),
    });
  return createRecordingBackend();
}

/**
 * The audio layer a host creates once and updates each frame. It owns the director (rules) and
 * the backend (playback). Kernel-less viewers call `update` with listener state only; kernel hosts
 * also `attachClient` or `attachWorld` so entity components and events reach the director.
 */
export function createAudioLayer(opts: AudioLayerOptions): AudioLayer {
  const director = new AudioDirector({
    bank: mergeSoundbanks(opts.banks),
    ...(opts.environment ? { environment: opts.environment } : {}),
    ...(opts.maxOneShots !== undefined ? { maxOneShots: opts.maxOneShots } : {}),
    ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
    ...(opts.onWarning ? { onWarning: opts.onWarning } : {}),
  });
  const backend = defaultBackend(opts);
  let source: AudioEntitySource | undefined;
  let detachEvents: (() => void) | undefined;
  let volume = opts.volume ?? 1;
  let muted = opts.muted ?? false;
  const envBus = new Map<string, number>();
  const hostBus = new Map<string, number>();
  let disposed = false;

  const applyMaster = (): void => {
    backend.apply([{ op: 'bus', bus: 'master', gain: muted ? 0 : volume }]);
  };
  const busGain = (bus: string): number => (envBus.get(bus) ?? 1) * (hostBus.get(bus) ?? 1);
  applyMaster();

  const setSource = (next: AudioEntitySource | undefined): void => {
    detachEvents?.();
    detachEvents = undefined;
    source = next;
    if (next?.onEvent)
      detachEvents = next.onEvent((event, tick) => director.handleEvent(event, tick));
  };

  let removeVisibility: (() => void) | undefined;
  if (opts.suspendWhenHidden !== false && typeof document !== 'undefined') {
    const onVisibility = (): void => backend.setSuspended?.(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    removeVisibility = () => document.removeEventListener('visibilitychange', onVisibility);
  }

  return {
    director,
    backend,
    get volume() {
      return volume;
    },
    get muted() {
      return muted;
    },
    get unlocked() {
      return backend.unlocked;
    },
    update(nowMs, listener, signals) {
      if (disposed) return;
      const r = opts.renderer;
      const fromCamera = r ? listenerFromCamera(r.camera, r.getWorldOrigin()) : undefined;
      const rendererSignals: AudioEnvironmentSignals = {};
      if (r?.weather?.data) rendererSignals.weather = r.weather.data;
      if (r?.sky?.frame) rendererSignals.sky = r.sky.frame;
      const merged: AudioEnvironmentSignals = {
        ...rendererSignals,
        ...(opts.signals?.() ?? {}),
        ...(signals ?? {}),
      };
      const cmds = director.update({
        nowMs,
        listener: { ...fromCamera, ...listener },
        signals: merged,
        ...(source ? { source } : {}),
      });
      const out: VoiceCommand[] = cmds.map((cmd) => {
        if (cmd.op !== 'bus') return cmd;
        envBus.set(cmd.bus, cmd.gain);
        return { ...cmd, gain: busGain(cmd.bus) };
      });
      backend.apply(out);
    },
    attachClient(client, attachOpts) {
      setSource(entitySourceFromClient(client, attachOpts));
      return () => setSource(undefined);
    },
    attachWorld(world) {
      setSource(entitySourceFromWorld(world));
      return () => setSource(undefined);
    },
    setSource,
    play: (sound, playOpts) => director.play(sound, playOpts),
    stop: (target, fadeS) => director.stop(target, fadeS),
    music: (playlist, musicOpts) => director.music(playlist, musicOpts),
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      applyMaster();
    },
    setMuted(m) {
      muted = m;
      applyMaster();
    },
    setBusGain(bus, gain) {
      hostBus.set(bus, gain);
      backend.apply([{ op: 'bus', bus, gain: busGain(bus) }]);
    },
    setEnvironment: (environment) => director.setEnvironment(environment),
    setBanks: (banks) => director.setBank(mergeSoundbanks(banks)),
    unlock: () => backend.unlock(),
    setSuspended: (s) => backend.setSuspended?.(s),
    stats: () => ({
      voices: director.voices().length,
      warnings: director.warnings().length,
      backend: backend.stats(),
    }),
    dispose() {
      if (disposed) return;
      backend.apply(director.reset(0.1));
      setSource(undefined);
      removeVisibility?.();
      backend.dispose();
      disposed = true;
    },
  };
}
