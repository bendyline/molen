import { AUDIO_BUSES } from '@bendyline/molen-schema';
import type { AssetProvider } from '../assets';
import type {
  AudioBackend,
  AudioBackendStats,
  AudioEnclosure,
  AudioReverb,
  AudioVec3,
  VoiceCommand,
  VoiceTone,
} from './types';

type StartCommand = Extract<VoiceCommand, { op: 'start' }>;

export interface WebAudioBackendOptions {
  /** Loads clip bytes by ref (a pack set's `assetProvider()`, or `createUrlAssetProvider`). */
  provider: AssetProvider;
  /** Supply a context (tests, shared graphs); default a new interactive AudioContext. */
  context?: AudioContext;
  /** Drop a one-shot whose clip is still decoding this many seconds after it was requested. */
  staleOneShotS?: number;
  /** Retain up to this many decoded PCM bytes; playing/fading clips are never evicted (default 96 MiB). */
  maxDecodedBytes?: number;
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
  /** One low-pass serves the rotor tone and air absorption: its cutoff is the lower of the two. */
  filter?: BiquadFilterNode;
  toneHz?: number;
  airHz?: number;
  tone?: { pulse: GainNode; oscillator: OscillatorNode; depth: GainNode };
}

/** Buses that never reverberate or pass through the listener's enclosure. */
const DRY_BUSES = new Set(['music', 'ui']);
const OPEN_HZ = 20000;

/** A deterministic, generated impulse response: no recording, so nothing to license. */
function impulse(ctx: AudioContext, preset: AudioReverb): AudioBuffer {
  const spec = {
    room: { seconds: 0.7, decay: 3.2, flutterS: 0, darkening: 0.35 },
    street: { seconds: 1.3, decay: 2.6, flutterS: 0.045, darkening: 0.25 },
    tunnel: { seconds: 2.8, decay: 1.6, flutterS: 0.032, darkening: 0.12 },
  }[preset];
  const rate = ctx.sampleRate;
  const length = Math.round(spec.seconds * rate);
  const buffer = ctx.createBuffer(2, length, rate);
  let seed = preset === 'room' ? 0x9e3779b9 : preset === 'street' ? 0x85ebca6b : 0xc2b2ae35;
  const random = (): number => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      // Darker as it decays: a one-pole filter whose cutoff falls with time.
      const k = Math.max(0.04, 1 - spec.darkening * t * 4);
      smooth += k * (random() * 2 - 1 - smooth);
      let v = smooth * Math.exp((-spec.decay * t * 6.9) / spec.seconds);
      // Parallel walls give a flutter of discrete early echoes.
      if (spec.flutterS > 0 && t < spec.seconds * 0.5) {
        const phase = (t % spec.flutterS) / spec.flutterS;
        if (phase < 0.02) v += (0.5 - t / spec.seconds) * (random() * 2 - 1) * 0.6;
      }
      data[i] = v * (i < 32 ? i / 32 : 1);
    }
  }
  return buffer;
}

/** Plays director commands through Web Audio: buses, panners, looped buffers, fades. */
export class WebAudioBackend implements AudioBackend {
  readonly context: AudioContext;
  private readonly provider: AssetProvider;
  private readonly staleS: number;
  private readonly onError: ((message: string) => void) | undefined;
  private readonly master: GainNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly buses = new Map<string, GainNode>();
  private readonly outsideBuses = new Map<string, GainNode>();
  private readonly busGainValues = new Map<string, number>();
  /** Every inside, reverberating bus sums here; every outside bus into `outsideSum`. */
  private readonly insideSum: GainNode;
  private readonly outsideSum: GainNode;
  /** Outside sound after the enclosure: its low-pass (created on first use) and level. */
  private readonly enclosureGain: GainNode;
  private enclosureFilter: BiquadFilterNode | undefined;
  private readonly reverbs = new Map<AudioReverb, { send: GainNode; convolver: ConvolverNode }>();
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly bufferSizes = new Map<string, number>();
  private readonly maxDecodedBytes: number;
  private decodedBytes = 0;
  private readonly voices = new Map<string, Voice>();
  private decoded = 0;
  private pending = 0;
  private hostSuspended = false;
  private disposed = false;

  constructor(opts: WebAudioBackendOptions) {
    this.provider = opts.provider;
    this.staleS = opts.staleOneShotS ?? 0.35;
    this.maxDecodedBytes = Math.max(0, opts.maxDecodedBytes ?? 96 * 1024 * 1024);
    this.onError = opts.onError;
    this.context = opts.context ?? new AudioContext({ latencyHint: 'interactive' });
    this.master = this.context.createGain();
    // Gentle safety ceiling for overlapping engines, impacts and ambience crossfades.
    this.limiter = this.context.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 3;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.2;
    this.master.connect(this.limiter);
    this.limiter.connect(this.context.destination);
    this.insideSum = this.context.createGain();
    this.insideSum.connect(this.master);
    this.outsideSum = this.context.createGain();
    this.enclosureGain = this.context.createGain();
    this.outsideSum.connect(this.enclosureGain);
    this.enclosureGain.connect(this.master);
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
          this.busGainValues.set(cmd.bus, cmd.gain);
          this.bus(cmd.bus).gain.setTargetAtTime(cmd.gain, this.context.currentTime, 0.05);
          this.outsideBuses
            .get(cmd.bus)
            ?.gain.setTargetAtTime(cmd.gain, this.context.currentTime, 0.05);
          break;
        case 'enclosure':
          this.setEnclosure(cmd.enclosure, cmd.rampS ?? 0.4);
          break;
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    for (const id of [...this.voices.keys()]) this.stop(id, 0);
    this.disposed = true;
    this.buffers.clear();
    this.bufferSizes.clear();
    this.decodedBytes = 0;
    this.limiter.disconnect();
    for (const { send, convolver } of this.reverbs.values()) {
      send.disconnect();
      convolver.disconnect();
    }
    this.reverbs.clear();
    this.context.close().catch(() => {});
  }

  // --- internals ---

  private bus(name: string): GainNode {
    if (name === 'master') return this.master;
    let g = this.buses.get(name);
    if (!g) {
      g = this.context.createGain();
      g.connect(DRY_BUSES.has(name) ? this.master : this.insideSum);
      this.buses.set(name, g);
    }
    return g;
  }

  /** The bus's twin on the outside route: same level, then the listener's enclosure. */
  private outsideBus(name: string): GainNode {
    if (name === 'master' || DRY_BUSES.has(name)) return this.bus(name);
    let g = this.outsideBuses.get(name);
    if (!g) {
      g = this.context.createGain();
      g.gain.value = this.busGainValues.get(name) ?? 1;
      g.connect(this.outsideSum);
      this.outsideBuses.set(name, g);
    }
    return g;
  }

  private setEnclosure(enclosure: AudioEnclosure, rampS: number): void {
    const ctx = this.context;
    const now = ctx.currentTime;
    const tau = Math.max(0.01, rampS / 3);
    const gain = 10 ** (-Math.max(0, enclosure.isolationDb) / 20);
    this.enclosureGain.gain.setTargetAtTime(gain, now, tau);
    const cutoff = Math.max(80, Math.min(OPEN_HZ, enclosure.cutoffHz));
    if (!this.enclosureFilter && cutoff < OPEN_HZ * 0.95) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.5;
      filter.frequency.value = OPEN_HZ;
      this.outsideSum.disconnect();
      this.outsideSum.connect(filter);
      filter.connect(this.enclosureGain);
      this.enclosureFilter = filter;
    }
    this.enclosureFilter?.frequency.setTargetAtTime(cutoff, now, tau);
    const wet = Math.max(0, Math.min(1, enclosure.wet ?? 0));
    if (enclosure.reverb && wet > 0) this.reverb(enclosure.reverb);
    for (const [preset, node] of this.reverbs)
      node.send.gain.setTargetAtTime(preset === enclosure.reverb ? wet * 0.5 : 0, now, tau);
  }

  private reverb(preset: AudioReverb): void {
    const ctx = this.context;
    if (this.reverbs.has(preset) || typeof ctx.createConvolver !== 'function') return;
    const send = ctx.createGain();
    send.gain.value = 0;
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse(ctx, preset);
    this.insideSum.connect(send);
    this.enclosureGain.connect(send);
    send.connect(convolver);
    convolver.connect(this.master);
    this.reverbs.set(preset, { send, convolver });
  }

  private load(ref: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(ref);
    if (p) {
      // Map order is least-recently-used first.
      this.buffers.delete(ref);
      this.buffers.set(ref, p);
    }
    if (!p) {
      this.pending++;
      p = this.provider
        .load(ref)
        .then((bytes) => this.context.decodeAudioData(bytes.slice(0)))
        .then((buffer) => {
          this.decoded++;
          if (!this.disposed) {
            const bytes = buffer.length * buffer.numberOfChannels * 4;
            this.bufferSizes.set(ref, bytes);
            this.decodedBytes += bytes;
          }
          return buffer;
        })
        .catch((error: unknown) => {
          this.onError?.(`audio clip "${ref}" failed to load: ${String(error)}`);
          return null;
        })
        .finally(() => {
          this.pending--;
          this.trimBuffers();
        });
      this.buffers.set(ref, p);
    }
    return p;
  }

  private trimBuffers(): void {
    if (this.decodedBytes <= this.maxDecodedBytes) return;
    const playing = new Set([...this.voices.values()].map((v) => v.cmd.ref));
    for (const ref of this.buffers.keys()) {
      const bytes = this.bufferSizes.get(ref);
      if (bytes === undefined || playing.has(ref)) continue;
      this.buffers.delete(ref);
      this.bufferSizes.delete(ref);
      this.decodedBytes -= bytes;
      if (this.decodedBytes <= this.maxDecodedBytes) break;
    }
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
      panner.connect(cmd.outside ? this.outsideBus(cmd.bus) : this.bus(cmd.bus));
    } else {
      gain.connect(cmd.outside ? this.outsideBus(cmd.bus) : this.bus(cmd.bus));
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
    if (cmd.tone) this.setTone(voice, cmd.tone, 0.01);
    if (cmd.lowpassHz !== undefined) this.setAir(voice, cmd.lowpassHz, 0.01);
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
      src.connect(voice.filter ?? gain);
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
    if (cmd.tone) this.setTone(v, cmd.tone, tau);
    if (cmd.lowpassHz !== undefined) this.setAir(v, cmd.lowpassHz, tau);
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

  /** The voice's low-pass, created on first need and placed between the source and the rest. */
  private ensureFilter(v: Voice, to: AudioNode = v.tone?.pulse ?? v.gain): BiquadFilterNode {
    if (v.filter) return v.filter;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.frequency.value = OPEN_HZ;
    filter.connect(to);
    if (v.src) {
      v.src.disconnect();
      v.src.connect(filter);
    }
    v.filter = filter;
    return filter;
  }

  private applyCutoff(v: Voice, tau: number): void {
    if (!v.filter) return;
    const hz = Math.max(100, Math.min(OPEN_HZ, v.toneHz ?? OPEN_HZ, v.airHz ?? OPEN_HZ));
    v.filter.frequency.setTargetAtTime(hz, this.context.currentTime, tau);
  }

  /** Air absorption: distant sound loses its treble. Until it matters, no filter is made. */
  private setAir(v: Voice, hz: number, tau: number): void {
    v.airHz = hz;
    if (!v.filter && hz >= OPEN_HZ * 0.95) return;
    this.ensureFilter(v);
    this.applyCutoff(v, tau);
  }

  private setTone(v: Voice, tone: VoiceTone, tau: number): void {
    const ctx = this.context;
    const amount = Math.max(0, Math.min(0.9, tone.pulseDepth)) / 2;
    const rate = Math.max(0.1, Math.min(60, tone.pulseHz));
    v.toneHz = Math.max(100, Math.min(OPEN_HZ, tone.lowpassHz));
    if (!v.tone) {
      const pulse = ctx.createGain();
      pulse.gain.value = 1 - amount;
      const oscillator = ctx.createOscillator();
      oscillator.frequency.value = rate;
      const depth = ctx.createGain();
      depth.gain.value = amount;
      oscillator.type = 'sine';
      oscillator.connect(depth);
      depth.connect(pulse.gain);
      if (v.filter) {
        v.filter.disconnect();
        v.filter.connect(pulse);
      } else this.ensureFilter(v, pulse);
      pulse.connect(v.gain);
      v.tone = { pulse, oscillator, depth };
      oscillator.start();
    }
    // The envelope only attenuates (1-depth .. 1), preserving the master headroom.
    const now = ctx.currentTime;
    this.applyCutoff(v, tau);
    v.tone.oscillator.frequency.setTargetAtTime(rate, now, tau);
    v.tone.depth.gain.setTargetAtTime(amount, now, tau);
    v.tone.pulse.gain.setTargetAtTime(1 - amount, now, tau);
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
      v.tone?.oscillator.stop();
      v.tone?.oscillator.disconnect();
      v.tone?.depth.disconnect();
      v.filter?.disconnect();
      v.tone?.pulse.disconnect();
    } catch {
      // already disconnected
    }
    this.trimBuffers();
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
