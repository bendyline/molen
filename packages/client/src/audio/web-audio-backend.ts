import { AUDIO_BUSES } from '@bendyline/molen-schema';
import type { AssetProvider } from '../assets';
import type { AudioBackend, AudioBackendStats, AudioVec3, VoiceCommand } from './types';

type StartCommand = Extract<VoiceCommand, { op: 'start' }>;

export interface WebAudioBackendOptions {
  /** Loads clip bytes by ref (a pack set's `assetProvider()`, or `createUrlAssetProvider`). */
  provider: AssetProvider;
  /** Supply a context (tests, shared graphs); default a new interactive AudioContext. */
  context?: AudioContext;
  /** Drop a one-shot whose clip is still decoding this many seconds after it was requested. */
  staleOneShotS?: number;
  onError?: (message: string) => void;
}

interface Voice {
  cmd: StartCommand;
  gain: GainNode;
  panner: PannerNode | undefined;
  src: AudioBufferSourceNode | undefined;
  stopped: boolean;
  requestedAt: number;
  targetGain: number;
  pitch: number;
}

/** Plays director commands through Web Audio: buses, panners, looped buffers, fades. */
export class WebAudioBackend implements AudioBackend {
  readonly context: AudioContext;
  private readonly provider: AssetProvider;
  private readonly staleS: number;
  private readonly onError: ((message: string) => void) | undefined;
  private readonly master: GainNode;
  private readonly buses = new Map<string, GainNode>();
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly voices = new Map<string, Voice>();
  private decoded = 0;
  private pending = 0;
  private hostSuspended = false;
  private disposed = false;

  constructor(opts: WebAudioBackendOptions) {
    this.provider = opts.provider;
    this.staleS = opts.staleOneShotS ?? 0.35;
    this.onError = opts.onError;
    this.context = opts.context ?? new AudioContext({ latencyHint: 'interactive' });
    this.master = this.context.createGain();
    this.master.connect(this.context.destination);
    for (const bus of AUDIO_BUSES) this.bus(bus);
  }

  get unlocked(): boolean {
    return this.context.state === 'running';
  }

  async unlock(): Promise<void> {
    if (this.disposed || this.hostSuspended || this.context.state !== 'suspended') return;
    await this.context.resume();
  }

  setSuspended(suspended: boolean): void {
    this.hostSuspended = suspended;
    if (this.disposed) return;
    const op = suspended ? this.context.suspend() : this.context.resume();
    op.catch(() => {});
  }

  async preload(refs: readonly string[]): Promise<void> {
    await Promise.all(refs.map((ref) => this.load(ref)));
  }

  stats(): AudioBackendStats {
    return {
      voices: this.voices.size,
      decoded: this.decoded,
      pending: this.pending,
      state:
        this.context.state === 'interrupted'
          ? 'suspended'
          : (this.context.state as AudioBackendStats['state']),
    };
  }

  apply(commands: readonly VoiceCommand[]): void {
    if (this.disposed) return;
    for (const cmd of commands) {
      switch (cmd.op) {
        case 'start':
          this.start(cmd);
          break;
        case 'set':
          this.set(cmd);
          break;
        case 'stop':
          this.stop(cmd.voice, cmd.fadeS);
          break;
        case 'listener':
          this.setListener(cmd.position, cmd.forward, cmd.up);
          break;
        case 'bus':
          this.bus(cmd.bus).gain.setTargetAtTime(cmd.gain, this.context.currentTime, 0.05);
          break;
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    for (const id of [...this.voices.keys()]) this.stop(id, 0);
    this.disposed = true;
    this.context.close().catch(() => {});
  }

  // --- internals ---

  private bus(name: string): GainNode {
    if (name === 'master') return this.master;
    let g = this.buses.get(name);
    if (!g) {
      g = this.context.createGain();
      g.connect(this.master);
      this.buses.set(name, g);
    }
    return g;
  }

  private load(ref: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(ref);
    if (!p) {
      this.pending++;
      p = this.provider
        .load(ref)
        .then((bytes) => this.context.decodeAudioData(bytes.slice(0)))
        .then((buffer) => {
          this.decoded++;
          return buffer;
        })
        .catch((error: unknown) => {
          this.onError?.(`audio clip "${ref}" failed to load: ${String(error)}`);
          return null;
        })
        .finally(() => {
          this.pending--;
        });
      this.buffers.set(ref, p);
    }
    return p;
  }

  private start(cmd: StartCommand): void {
    // A one-shot requested while muted by the browser would all fire at once on unlock.
    if (!cmd.loop && !this.unlocked) return;
    this.stop(cmd.voice, 0);
    const ctx = this.context;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    let panner: PannerNode | undefined;
    if (cmd.spatial) {
      const s = cmd.spatial;
      panner = new PannerNode(ctx, {
        panningModel: 'equalpower',
        distanceModel: s.model,
        refDistance: s.refDistance,
        maxDistance: s.maxDistance,
        rolloffFactor: s.rolloff,
        positionX: s.position[0],
        positionY: s.position[1],
        positionZ: s.position[2],
      });
      gain.connect(panner);
      panner.connect(this.bus(cmd.bus));
    } else {
      gain.connect(this.bus(cmd.bus));
    }
    const voice: Voice = {
      cmd,
      gain,
      panner,
      src: undefined,
      stopped: false,
      requestedAt: ctx.currentTime,
      targetGain: cmd.gain,
      pitch: cmd.pitch,
    };
    this.voices.set(cmd.voice, voice);
    void this.load(cmd.ref).then((buffer) => {
      if (voice.stopped || this.disposed || !buffer) {
        if (!buffer) this.cleanup(cmd.voice, voice);
        return;
      }
      if (!cmd.loop && ctx.currentTime - voice.requestedAt > this.staleS) {
        this.cleanup(cmd.voice, voice);
        return;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = cmd.loop;
      if (cmd.loop && cmd.loopStart !== undefined) src.loopStart = cmd.loopStart;
      if (cmd.loop && cmd.loopEnd !== undefined) src.loopEnd = cmd.loopEnd;
      src.playbackRate.value = voice.pitch;
      src.connect(gain);
      const now = ctx.currentTime;
      const fade = cmd.fadeInS ?? 0;
      gain.gain.setValueAtTime(fade > 0 ? 0 : voice.targetGain, now);
      if (fade > 0) gain.gain.linearRampToValueAtTime(voice.targetGain, now + fade);
      src.onended = () => this.cleanup(cmd.voice, voice);
      voice.src = src;
      // Loops start at their loop point so the encoder's leading padding never plays.
      src.start(now, cmd.loop && cmd.loopStart !== undefined ? cmd.loopStart : 0);
    });
  }

  private set(cmd: Extract<VoiceCommand, { op: 'set' }>): void {
    const v = this.voices.get(cmd.voice);
    if (!v || v.stopped) return;
    const now = this.context.currentTime;
    const tau = Math.max(0.01, (cmd.rampS ?? 0.1) / 3);
    if (cmd.gain !== undefined) {
      v.targetGain = cmd.gain;
      if (v.src) v.gain.gain.setTargetAtTime(cmd.gain, now, tau);
    }
    if (cmd.pitch !== undefined) {
      v.pitch = cmd.pitch;
      v.src?.playbackRate.setTargetAtTime(cmd.pitch, now, tau);
    }
    if (cmd.position && v.panner) {
      const [x, y, z] = cmd.position;
      v.panner.positionX.setTargetAtTime(x, now, 0.02);
      v.panner.positionY.setTargetAtTime(y, now, 0.02);
      v.panner.positionZ.setTargetAtTime(z, now, 0.02);
    }
  }

  private stop(id: string, fadeS = 0.05): void {
    const v = this.voices.get(id);
    if (!v || v.stopped) return;
    v.stopped = true;
    if (!v.src) {
      this.cleanup(id, v);
      return;
    }
    const now = this.context.currentTime;
    const g = v.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + Math.max(0.005, fadeS));
    try {
      v.src.stop(now + Math.max(0.005, fadeS) + 0.02);
    } catch {
      this.cleanup(id, v);
    }
  }

  private cleanup(id: string, v: Voice): void {
    if (this.voices.get(id) === v) this.voices.delete(id);
    v.stopped = true;
    try {
      v.src?.disconnect();
      v.gain.disconnect();
      v.panner?.disconnect();
    } catch {
      // already disconnected
    }
  }

  private setListener(p: AudioVec3, f: AudioVec3, u: AudioVec3): void {
    const l = this.context.listener;
    const now = this.context.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(p[0], now, 0.02);
      l.positionY.setTargetAtTime(p[1], now, 0.02);
      l.positionZ.setTargetAtTime(p[2], now, 0.02);
      l.forwardX.setTargetAtTime(f[0], now, 0.02);
      l.forwardY.setTargetAtTime(f[1], now, 0.02);
      l.forwardZ.setTargetAtTime(f[2], now, 0.02);
      l.upX.setTargetAtTime(u[0], now, 0.02);
      l.upY.setTargetAtTime(u[1], now, 0.02);
      l.upZ.setTargetAtTime(u[2], now, 0.02);
    } else {
      l.setPosition(p[0], p[1], p[2]);
      l.setOrientation(f[0], f[1], f[2], u[0], u[1], u[2]);
    }
  }
}
