import {
  type AudioEnvironmentData,
  type AudioSignalDrive,
  type AudioSourceData,
  type AudioZoneData,
  audioSignalBindings,
  audioSignalIssues,
  audioSignalRefs,
  type EngineEvent,
  type EntityId,
  type JsonObject,
  type JsonValue,
  nearestWithDistance,
  type SoundSpatial,
} from '@bendyline/molen-schema';
import { type ResolvedSound, type SoundBank, unitRandom } from './bank';
import {
  curve,
  type EntityMotion,
  evalWhen,
  Gate,
  resolveSignal,
  type SignalContext,
} from './signals';
import type {
  AudioEntitySource,
  AudioListenerState,
  AudioVec3,
  DirectorInput,
  VoiceCommand,
  VoiceSpatial,
} from './types';

// The audio director: documents + signals + events in, voice commands out. Pure — no Web Audio,
// no clocks of its own, no Math.random — so the same code drives a browser backend, unit tests
// and `molen audio plan`. Clip and pitch variation come from a hash of (tick, voice key), so a
// replayed run picks the same clips.

export interface AudioDirectorOptions {
  bank: SoundBank;
  /** Host soundscape rules; a scene's audioEnvironment entity overrides these key by key. */
  environment?: AudioEnvironmentData;
  /** Concurrent one-shot budget; the oldest is cut when exceeded. Default 16. */
  maxOneShots?: number;
  /** Seed mixed into clip/pitch variation. */
  seed?: string | number;
  /** Called once per distinct warning (unknown sound ids, unknown signals). */
  onWarning?: (message: string) => void;
}

/** A persistent voice the director is keeping alive. */
export interface VoiceSnapshot {
  key: string;
  voice: string;
  sound: string;
  bus: string;
  gain: number;
  pitch: number;
  loop: boolean;
  position?: AudioVec3;
  entity?: EntityId;
}

interface Desired {
  key: string;
  sound: ResolvedSound;
  loop: boolean;
  gain: number;
  pitchMul: number;
  bus: string;
  spatial?: Omit<VoiceSpatial, 'position'>;
  position?: AudioVec3;
  fadeInS: number;
  fadeOutS: number;
  rampS: number;
  priority: number;
  entity?: EntityId;
}

interface LiveVoice {
  key: string;
  voice: string;
  sound: string;
  bus: string;
  loop: boolean;
  gain: number;
  pitch: number;
  basePitch: number;
  position?: AudioVec3;
  fadeOutS: number;
  entity?: EntityId;
}

interface OneShot {
  voice: string;
  sound: string;
  handle?: string;
  entity?: EntityId;
  endsAt: number;
}

interface ScriptLoop {
  sound: string;
  entity?: EntityId;
  position?: AudioVec3;
  gain: number;
  pitch: number;
  bus?: string;
}

interface MusicState {
  key: string;
  order: string[];
  index: number;
  round: number;
  voice?: string;
  sound?: string;
  endsAt?: number;
}

interface TriggerState {
  last?: number;
  lastRaw?: string | number | boolean;
  acc: number;
}

const DEFAULT_SPATIAL: Omit<VoiceSpatial, 'position'> = {
  refDistance: 1,
  maxDistance: 60,
  rolloff: 1,
  model: 'inverse',
};
const ONE_SHOT_MIN_INTERVAL_MS = 30;
const TELEPORT_SPEED = 400; // m/s: a jump faster than this is a teleport, not travel

type ListenerCtx = SignalContext['listener'];

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return 0;
}

function vec3(v: unknown): AudioVec3 | undefined {
  return Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number')
    ? [v[0] as number, v[1] as number, v[2] as number]
    : undefined;
}

function dist(a: AudioVec3, b: AudioVec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function spatialOf(s: SoundSpatial): Omit<VoiceSpatial, 'position'> {
  return {
    refDistance: s.refDistance ?? DEFAULT_SPATIAL.refDistance,
    maxDistance: s.maxDistance ?? DEFAULT_SPATIAL.maxDistance,
    rolloff: s.rolloff ?? DEFAULT_SPATIAL.rolloff,
    model: s.model ?? DEFAULT_SPATIAL.model,
  };
}

/** Approximate audible gain after distance attenuation, for budgeting only. */
function audibility(gain: number, spatial: Desired['spatial'], d: number): number {
  if (!spatial) return gain;
  const ref = spatial.refDistance;
  return (gain * ref) / (ref + spatial.rolloff * Math.max(0, d - ref));
}

/** Vehicles someone is riding: every `mounted` component names one. */
function occupiedBy(source: AudioEntitySource | undefined): Set<EntityId> {
  const out = new Set<EntityId>();
  if (!source) return out;
  for (const [, mounted] of source.each('mounted')) {
    if (typeof mounted.vehicle === 'string') out.add(mounted.vehicle);
  }
  return out;
}

export class AudioDirector {
  private bank: SoundBank;
  private hostEnvironment: AudioEnvironmentData | undefined;
  private readonly maxOneShots: number;
  private readonly seed: string | number;
  private readonly onWarning: ((message: string) => void) | undefined;

  private readonly live = new Map<string, LiveVoice>();
  private readonly oneShots: OneShot[] = [];
  private readonly scriptLoops = new Map<string, ScriptLoop>();
  private readonly stopFades = new Map<string, number>();
  private readonly gates = new Map<string, Gate>();
  private readonly motion = new Map<EntityId, EntityMotion>();
  private readonly firedOnce = new Set<EntityId>();
  private readonly startTickFired = new Map<EntityId, number>();
  private readonly triggers = new Map<EntityId, TriggerState>();
  private readonly lastFire = new Map<string, number>();
  private readonly lastClip = new Map<string, number>();
  private readonly busGains = new Map<string, number>();
  private readonly events: { event: EngineEvent; tick: number }[] = [];
  private readonly warned = new Set<string>();
  private readonly warningList: string[] = [];
  private readonly checked = new WeakSet<object>();

  private musicState: MusicState | undefined;
  private musicOverride: { playlist: string[]; crossfadeS?: number } | undefined;
  private listenerState: ListenerCtx | undefined;
  private footAcc = 0;
  private footLast: number | undefined;
  private startMs: number | undefined;
  private lastNow: number | undefined;
  private frame = 0;
  private serial = 0;
  private hostHandles = 0;

  constructor(opts: AudioDirectorOptions) {
    this.bank = opts.bank;
    this.hostEnvironment = opts.environment;
    this.maxOneShots = opts.maxOneShots ?? 16;
    this.seed = opts.seed ?? 'molen-audio';
    this.onWarning = opts.onWarning;
  }

  setBank(bank: SoundBank): void {
    this.bank = bank;
  }

  setEnvironment(environment: AudioEnvironmentData | undefined): void {
    this.hostEnvironment = environment;
  }

  /** Queue an engine event (`audio.play|stop|music` or a type mapped under `events`). */
  handleEvent(event: EngineEvent, tick = 0): void {
    if (this.events.length >= 256) this.events.shift();
    this.events.push({ event, tick });
  }

  /** Host-side one-shot or loop (UI clicks, host-owned engines). Returns a handle for `stop`. */
  play(
    sound: string,
    opts: {
      entity?: EntityId;
      position?: AudioVec3;
      gain?: number;
      pitch?: number;
      bus?: string;
      loop?: boolean;
    } = {},
  ): string {
    const handle = `host:${sound}#${this.hostHandles++}`;
    this.handleEvent({ type: 'audio.play', payload: { handle, sound, ...opts } as JsonObject });
    return handle;
  }

  stop(target: string | { entity?: EntityId; sound?: string }, fadeS?: number): void {
    const payload: JsonObject =
      typeof target === 'string' ? { handle: target } : ({ ...target } as JsonObject);
    if (fadeS !== undefined) payload.fadeS = fadeS;
    this.handleEvent({ type: 'audio.stop', payload });
  }

  music(playlist: string | string[] | null, opts: { crossfadeS?: number } = {}): void {
    const list = playlist === null ? null : Array.isArray(playlist) ? playlist : [playlist];
    const payload: JsonObject = { playlist: list };
    if (opts.crossfadeS !== undefined) payload.crossfadeS = opts.crossfadeS;
    this.handleEvent({ type: 'audio.music', payload });
  }

  /** Persistent voices currently alive (loops, ambience, zones, music). */
  voices(): VoiceSnapshot[] {
    const out: VoiceSnapshot[] = [...this.live.values()].map((v) => ({
      key: v.key,
      voice: v.voice,
      sound: v.sound,
      bus: v.bus,
      gain: v.gain,
      pitch: v.pitch,
      loop: v.loop,
      ...(v.position ? { position: v.position } : {}),
      ...(v.entity !== undefined ? { entity: v.entity } : {}),
    }));
    if (this.musicState?.voice && this.musicState.sound)
      out.push({
        key: 'music',
        voice: this.musicState.voice,
        sound: this.musicState.sound,
        bus: 'music',
        gain: 1,
        pitch: 1,
        loop: this.musicState.endsAt === undefined,
      });
    return out;
  }

  warnings(): readonly string[] {
    return this.warningList;
  }

  /** Stop everything (fading) and forget all state except warnings. */
  reset(fadeS = 0.2): VoiceCommand[] {
    const cmds: VoiceCommand[] = [];
    for (const v of this.live.values()) cmds.push({ op: 'stop', voice: v.voice, fadeS });
    for (const s of this.oneShots) cmds.push({ op: 'stop', voice: s.voice, fadeS });
    if (this.musicState?.voice) cmds.push({ op: 'stop', voice: this.musicState.voice, fadeS });
    this.live.clear();
    this.oneShots.length = 0;
    this.scriptLoops.clear();
    this.musicState = undefined;
    this.musicOverride = undefined;
    this.events.length = 0;
    this.gates.clear();
    return cmds;
  }

  update(input: DirectorInput): VoiceCommand[] {
    const now = input.nowMs;
    this.startMs ??= now;
    const dtMs = this.lastNow === undefined ? 0 : Math.min(250, Math.max(0, now - this.lastNow));
    this.lastNow = now;
    const source = input.source;
    const tick = source?.tick ?? this.frame;
    this.frame++;

    const listener = this.measureListener(input.listener, dtMs);
    const env = this.environmentFor(source);
    this.measureEntities(source, dtMs);
    const ctx: SignalContext = {
      listener,
      signals: input.signals ?? {},
      source,
      entity: env?.listenerEntity,
      motion: this.motion,
      occupied: occupiedBy(source),
      seconds: (now - this.startMs) / 1000,
    };

    const cmds: VoiceCommand[] = [
      { op: 'listener', position: listener.position, forward: listener.forward, up: listener.up },
    ];
    this.syncBuses(env, cmds);
    const desired: Desired[] = [];
    this.processEvents(env, ctx, now, tick, cmds);
    this.collectAmbience(env, ctx, now, desired);
    this.collectZones(ctx, now, desired);
    this.collectSources(ctx, now, tick, desired, cmds);
    this.collectScriptLoops(ctx, desired);
    this.footsteps(env, ctx, now, tick, cmds);
    this.updateMusic(env, ctx, now, cmds);
    this.reconcile(desired, env, listener, tick, cmds);
    this.pruneOneShots(now);
    return cmds;
  }

  // --- inputs ---

  private measureListener(
    partial: Partial<AudioListenerState> | undefined,
    dtMs: number,
  ): ListenerCtx {
    const prev = this.listenerState;
    const position = partial?.position ?? prev?.position ?? [0, 0, 0];
    let distance = prev?.distance ?? 0;
    let measured = prev?.speed ?? 0;
    if (prev && dtMs > 0) {
      const d = dist(position, prev.position);
      if (d <= Math.max(5, (TELEPORT_SPEED * dtMs) / 1000)) {
        distance += d;
        measured = measured + (d / (dtMs / 1000) - measured) * 0.3;
      }
    }
    const velocity = partial?.velocity;
    const speed = partial?.speed ?? (velocity ? Math.hypot(...velocity) : measured);
    const next: ListenerCtx = {
      position,
      forward: partial?.forward ?? prev?.forward ?? [0, 0, -1],
      up: partial?.up ?? prev?.up ?? [0, 1, 0],
      speed,
      distance,
      ...(velocity ? { velocity } : {}),
      ...(partial?.mode !== undefined ? { mode: partial.mode } : {}),
      ...(partial?.grounded !== undefined ? { grounded: partial.grounded } : {}),
      ...(partial?.surface !== undefined ? { surface: partial.surface } : {}),
      ...(partial?.indoors !== undefined ? { indoors: partial.indoors } : {}),
      ...(partial?.heightAboveGround !== undefined
        ? { heightAboveGround: partial.heightAboveGround }
        : {}),
    };
    // Keep the measured speed (not an override) for smoothing on the next update.
    this.listenerState = { ...next, speed: partial?.speed ?? measured };
    return next;
  }

  private measureEntities(source: AudioEntitySource | undefined, dtMs: number): void {
    if (!source) {
      this.motion.clear();
      return;
    }
    const seen = new Set<EntityId>();
    for (const [id] of source.each('audioSource')) {
      const pos = this.entityPos(source, id);
      if (!pos) continue;
      seen.add(id);
      const prev = this.motion.get(id);
      if (!prev) {
        this.motion.set(id, { pos, speed: 0, distance: 0 });
        continue;
      }
      let { speed, distance } = prev;
      if (dtMs > 0) {
        const d = dist(pos, prev.pos);
        if (d <= Math.max(5, (TELEPORT_SPEED * dtMs) / 1000)) {
          distance += d;
          speed += (d / (dtMs / 1000) - speed) * 0.3;
        }
      }
      this.motion.set(id, { pos, speed, distance });
    }
    for (const id of this.motion.keys()) if (!seen.has(id)) this.motion.delete(id);
  }

  private environmentFor(source: AudioEntitySource | undefined): AudioEnvironmentData | undefined {
    let scene: AudioEnvironmentData | undefined;
    if (source) {
      for (const [, data] of source.each('audioEnvironment')) {
        scene = data as AudioEnvironmentData;
        break;
      }
    }
    const env =
      scene && this.hostEnvironment
        ? { ...this.hostEnvironment, ...scene }
        : (scene ?? this.hostEnvironment);
    if (env) this.checkSignals('audioEnvironment', env, 'audioEnvironment');
    return env;
  }

  private entityPos(source: AudioEntitySource | undefined, id: EntityId): AudioVec3 | undefined {
    return vec3(source?.get(id, 'transform')?.pos);
  }

  // --- warnings ---

  private warn(key: string, message: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.warningList.push(message);
    this.onWarning?.(message);
  }

  private sound(id: string, where: string): ResolvedSound | undefined {
    const found = this.bank.resolve(id);
    if (!found) {
      const near = nearestWithDistance(id, [...this.bank.ids()]);
      this.warn(
        `sound:${id}`,
        `unknown sound "${id}" (${where})${near ? `; did you mean "${near.candidate}"?` : ''}`,
      );
    }
    return found;
  }

  private checkSignals(
    component: 'audioSource' | 'audioZone' | 'audioEnvironment',
    data: AudioSourceData | AudioZoneData | AudioEnvironmentData,
    where: string,
  ): void {
    if (this.checked.has(data)) return;
    this.checked.add(data);
    for (const ref of audioSignalRefs(component, data)) {
      for (const issue of audioSignalIssues(ref.signal)) {
        this.warn(
          `signal:${ref.signal}`,
          `${where}${ref.path}: ${issue.message}${issue.hint ? ` (${issue.hint})` : ''}`,
        );
      }
    }
  }

  // --- helpers ---

  private gate(key: string): Gate {
    let g = this.gates.get(key);
    if (!g) {
      g = new Gate();
      this.gates.set(key, g);
    }
    return g;
  }

  /** A drive's value: the product of its bindings' curves (1 when there is none). */
  private bound(drive: AudioSignalDrive | undefined, ctx: SignalContext): number {
    let value = 1;
    for (const b of audioSignalBindings(drive))
      value *= curve(b.curve, num(resolveSignal(b.signal, ctx)));
    return value;
  }

  /** The smoothing time of the first binding that sets one. */
  private smoothing(fallback: number, ...drives: (AudioSignalDrive | undefined)[]): number {
    for (const drive of drives)
      for (const b of audioSignalBindings(drive)) if (b.smoothS !== undefined) return b.smoothS;
    return fallback;
  }

  private spatialFor(
    override: SoundSpatial | false | undefined,
    sound: ResolvedSound,
    position: AudioVec3 | undefined,
  ): Omit<VoiceSpatial, 'position'> | undefined {
    if (!position) return undefined;
    const pick = override ?? sound.entry.spatial;
    if (pick === false) return undefined;
    return pick ? spatialOf(pick) : DEFAULT_SPATIAL;
  }

  private pickClip(sound: ResolvedSound, ...parts: (string | number)[]): number {
    const n = sound.refs.length;
    if (n <= 1) return 0;
    let i = Math.floor(unitRandom(this.seed, sound.id, ...parts) * n);
    if (i === this.lastClip.get(sound.id)) i = (i + 1) % n;
    this.lastClip.set(sound.id, i);
    return i;
  }

  private basePitch(sound: ResolvedSound, ...parts: (string | number)[]): number {
    const [lo, hi] = sound.entry.pitch ?? [1, 1];
    return lo === hi ? lo : lo + (hi - lo) * unitRandom(this.seed, 'pitch', sound.id, ...parts);
  }

  private fireOneShot(
    shot: {
      sound: ResolvedSound;
      gain: number;
      pitchMul: number;
      bus: string;
      spatial?: Omit<VoiceSpatial, 'position'>;
      position?: AudioVec3;
      entity?: EntityId;
      handle?: string;
      key: string;
    },
    listener: ListenerCtx,
    now: number,
    tick: number,
    cmds: VoiceCommand[],
  ): void {
    const { sound } = shot;
    const last = this.lastFire.get(sound.id);
    if (last !== undefined && now - last < ONE_SHOT_MIN_INTERVAL_MS) return;
    if (shot.spatial && shot.position) {
      if (dist(shot.position, listener.position) > shot.spatial.maxDistance) return;
    }
    this.lastFire.set(sound.id, now);
    while (this.oneShots.length >= this.maxOneShots) {
      const oldest = this.oneShots.shift();
      if (oldest) cmds.push({ op: 'stop', voice: oldest.voice, fadeS: 0.05 });
    }
    const clip = this.pickClip(sound, tick, shot.key);
    const pitch = this.basePitch(sound, tick, shot.key) * shot.pitchMul;
    const voice = `shot:${this.serial++}`;
    const { entry } = sound;
    cmds.push({
      op: 'start',
      voice,
      sound: sound.id,
      ref: sound.refs[clip] as string,
      loop: false,
      gain: shot.gain,
      pitch,
      bus: shot.bus,
      ...(shot.spatial && shot.position
        ? { spatial: { ...shot.spatial, position: shot.position } }
        : {}),
    });
    const lengthS = (entry.durationS ?? 5) / Math.max(0.05, pitch);
    this.oneShots.push({
      voice,
      sound: sound.id,
      endsAt: now + lengthS * 1000 + 100,
      ...(shot.handle !== undefined ? { handle: shot.handle } : {}),
      ...(shot.entity !== undefined ? { entity: shot.entity } : {}),
    });
  }

  private pruneOneShots(now: number): void {
    for (let i = this.oneShots.length - 1; i >= 0; i--) {
      if ((this.oneShots[i] as OneShot).endsAt <= now) this.oneShots.splice(i, 1);
    }
  }

  // --- rules ---

  private syncBuses(env: AudioEnvironmentData | undefined, cmds: VoiceCommand[]): void {
    const wanted = env?.buses ?? {};
    const names = new Set([...this.busGains.keys(), ...Object.keys(wanted)]);
    for (const bus of names) {
      const gain = wanted[bus] ?? 1;
      if (this.busGains.get(bus) !== gain) {
        this.busGains.set(bus, gain);
        cmds.push({ op: 'bus', bus, gain });
      }
    }
  }

  private collectAmbience(
    env: AudioEnvironmentData | undefined,
    ctx: SignalContext,
    now: number,
    desired: Desired[],
  ): void {
    (env?.ambience ?? []).forEach((layer, i) => {
      const key = `amb:${i}:${layer.sound}`;
      const gate = this.gate(key);
      if (!gate.update(evalWhen(layer.when, ctx, gate.active), now)) return;
      const sound = this.sound(layer.sound, `audioEnvironment.ambience[${i}]`);
      if (!sound) return;
      const gain = (sound.entry.gain ?? 1) * (layer.gain ?? 1) * this.bound(layer.gainFrom, ctx);
      if (gain < (this.live.has(key) ? 0.002 : 0.01)) return;
      const fade = layer.fadeS ?? 1.5;
      desired.push({
        key,
        sound,
        loop: true,
        gain,
        pitchMul: this.bound(layer.pitchFrom, ctx),
        bus: sound.entry.bus ?? 'ambience',
        fadeInS: fade,
        fadeOutS: fade,
        rampS: this.smoothing(0.3, layer.gainFrom, layer.pitchFrom),
        priority: 1,
      });
    });
  }

  private collectZones(ctx: SignalContext, now: number, desired: Desired[]): void {
    const source = ctx.source;
    if (!source) return;
    const p = ctx.listener.position;
    for (const [id, data] of source.each('audioZone')) {
      const zone = data as AudioZoneData;
      this.checkSignals('audioZone', zone, `entity "${id}" audioZone`);
      const key = `zone:${id}`;
      const c = this.entityPos(source, id) ?? [0, 0, 0];
      let outside: number;
      if (zone.shape.kind === 'sphere') outside = dist(p, c) - zone.shape.radius;
      else {
        const h = zone.shape.halfExtents;
        const dx = Math.max(0, Math.abs(p[0] - c[0]) - h[0]);
        const dy = Math.max(0, Math.abs(p[1] - c[1]) - h[1]);
        const dz = Math.max(0, Math.abs(p[2] - c[2]) - h[2]);
        outside = Math.hypot(dx, dy, dz);
      }
      const fade = zone.fade ?? 5;
      const factor = outside <= 0 ? 1 : fade <= 0 ? 0 : Math.max(0, 1 - outside / fade);
      const gate = this.gate(key);
      const entityCtx = { ...ctx, entity: id };
      if (!gate.update(evalWhen(zone.when, entityCtx, gate.active), now)) continue;
      const sound = this.sound(zone.sound, `entity "${id}" audioZone`);
      if (!sound) continue;
      const gain = (sound.entry.gain ?? 1) * (zone.gain ?? 1) * factor;
      if (gain < (this.live.has(key) ? 0.002 : 0.01)) continue;
      desired.push({
        key,
        sound,
        loop: true,
        gain,
        pitchMul: 1,
        bus: zone.bus ?? sound.entry.bus ?? 'ambience',
        fadeInS: 1,
        fadeOutS: 1,
        rampS: 0.3,
        priority: 1,
        entity: id,
      });
    }
  }

  private collectSources(
    ctx: SignalContext,
    now: number,
    tick: number,
    desired: Desired[],
    cmds: VoiceCommand[],
  ): void {
    const source = ctx.source;
    const seen = new Set<EntityId>();
    if (source) {
      const lateTicks = source.tickRate ?? 30;
      for (const [id, data] of source.each('audioSource')) {
        const d = data as AudioSourceData;
        seen.add(id);
        this.checkSignals('audioSource', d, `entity "${id}" audioSource`);
        const sound = this.sound(d.sound, `entity "${id}" audioSource`);
        if (!sound) continue;
        const key = `src:${id}`;
        const entityCtx: SignalContext = { ...ctx, entity: id };
        const gate = this.gate(key);
        const active = gate.update(evalWhen(d.when, entityCtx, gate.active), now);
        const position = this.entityPos(source, id);
        const spatial = this.spatialFor(d.spatial, sound, position);
        const gain = (sound.entry.gain ?? 1) * (d.gain ?? 1) * this.bound(d.gainFrom, entityCtx);
        const pitchMul = (d.pitch ?? 1) * this.bound(d.pitchFrom, entityCtx);
        const bus = d.bus ?? sound.entry.bus ?? 'sfx';
        const loop = d.loop ?? sound.entry.loop ?? false;
        const autoplay = d.autoplay ?? true;
        const shotBase = {
          gain,
          pitchMul,
          bus,
          entity: id,
          ...(spatial ? { spatial } : {}),
          ...(position ? { position } : {}),
        };

        // A loop driven to silence (an aircraft engine at 0 rpm) holds no voice.
        const audible = gain >= (this.live.has(key) ? 0.002 : 0.01);
        if (loop && autoplay && active && audible) {
          desired.push({
            key,
            sound,
            loop: true,
            gain,
            pitchMul,
            bus,
            fadeInS: 0.3,
            fadeOutS: 0.5,
            rampS: this.smoothing(0.15, d.pitchFrom, d.gainFrom),
            priority: 3,
            entity: id,
            ...(spatial ? { spatial } : {}),
            ...(position ? { position } : {}),
          });
        }
        if (!loop && autoplay && active && !this.firedOnce.has(id)) {
          this.firedOnce.add(id);
          this.fireOneShot({ ...shotBase, sound, key }, ctx.listener, now, tick, cmds);
        }
        if (d.startTick !== undefined && this.startTickFired.get(id) !== d.startTick) {
          if (tick >= d.startTick) {
            this.startTickFired.set(id, d.startTick);
            if (tick - d.startTick <= lateTicks)
              this.fireOneShot({ ...shotBase, sound, key }, ctx.listener, now, tick, cmds);
          }
        }
        if (d.triggerFrom) {
          const t = d.triggerFrom;
          const state = this.triggers.get(id) ?? { acc: 0 };
          this.triggers.set(id, state);
          const raw = resolveSignal(t.signal, entityCtx);
          const value = num(raw);
          let fire = false;
          if (t.every !== undefined && state.last !== undefined && active) {
            state.acc += Math.abs(value - state.last);
            if (state.acc >= t.every) {
              fire = true;
              state.acc -= t.every;
              if (state.acc > t.every) state.acc = 0;
            }
          }
          if (t.onChange && active && state.lastRaw !== undefined && raw !== state.lastRaw)
            fire = true;
          state.last = value;
          if (raw !== undefined) state.lastRaw = raw;
          if (fire) {
            const shotSound = t.sound ? this.sound(t.sound, `entity "${id}" triggerFrom`) : sound;
            if (shotSound)
              this.fireOneShot(
                {
                  ...shotBase,
                  sound: shotSound,
                  bus: d.bus ?? shotSound.entry.bus ?? 'sfx',
                  key: `${key}:t`,
                },
                ctx.listener,
                now,
                tick,
                cmds,
              );
          }
        }
      }
    }
    for (const id of [...this.firedOnce]) if (!seen.has(id)) this.firedOnce.delete(id);
    for (const id of [...this.startTickFired.keys()])
      if (!seen.has(id)) this.startTickFired.delete(id);
    for (const id of [...this.triggers.keys()]) if (!seen.has(id)) this.triggers.delete(id);
    for (const key of [...this.gates.keys()]) {
      if (key.startsWith('src:') && !seen.has(key.slice(4))) this.gates.delete(key);
    }
  }

  private collectScriptLoops(ctx: SignalContext, desired: Desired[]): void {
    for (const [handle, loop] of this.scriptLoops) {
      const sound = this.sound(loop.sound, 'molen.audio.play');
      if (!sound) {
        this.scriptLoops.delete(handle);
        continue;
      }
      const position =
        loop.entity !== undefined ? this.entityPos(ctx.source, loop.entity) : loop.position;
      const spatial = this.spatialFor(undefined, sound, position);
      desired.push({
        key: `script:${handle}`,
        sound,
        loop: true,
        gain: (sound.entry.gain ?? 1) * loop.gain,
        pitchMul: loop.pitch,
        bus: loop.bus ?? sound.entry.bus ?? 'sfx',
        fadeInS: 0.1,
        fadeOutS: 0.3,
        rampS: 0.1,
        priority: 2,
        ...(loop.entity !== undefined ? { entity: loop.entity } : {}),
        ...(spatial ? { spatial } : {}),
        ...(position ? { position } : {}),
      });
    }
  }

  private resolveAt(
    at: string | undefined,
    payload: JsonValue,
    source: AudioEntitySource | undefined,
  ): { position?: AudioVec3; entity?: EntityId } {
    const obj =
      payload !== null && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as JsonObject)
        : {};
    const from = (
      v: JsonValue | undefined,
    ): { position?: AudioVec3; entity?: EntityId } | undefined => {
      if (typeof v === 'string') {
        const position = this.entityPos(source, v);
        return position ? { position, entity: v } : { entity: v };
      }
      const position = vec3(v);
      return position ? { position } : undefined;
    };
    if (at === 'listener') return {};
    if (at?.startsWith('payload.')) return from(obj[at.slice(8)]) ?? {};
    for (const field of ['entity', 'position', 'a', 'pos']) {
      const hit = from(obj[field]);
      if (hit?.position) return hit;
    }
    return {};
  }

  private processEvents(
    env: AudioEnvironmentData | undefined,
    ctx: SignalContext,
    now: number,
    tick: number,
    cmds: VoiceCommand[],
  ): void {
    const events = this.events.splice(0);
    for (const { event } of events) {
      const p = (event.payload ?? {}) as JsonObject;
      switch (event.type) {
        case 'audio.play': {
          const soundId = typeof p.sound === 'string' ? p.sound : undefined;
          const handle = typeof p.handle === 'string' ? p.handle : `anon#${this.serial}`;
          if (!soundId) break;
          const sound = this.sound(soundId, 'molen.audio.play');
          if (!sound) break;
          const entity = typeof p.entity === 'string' ? p.entity : undefined;
          const loop = typeof p.loop === 'boolean' ? p.loop : (sound.entry.loop ?? false);
          const gain = typeof p.gain === 'number' ? p.gain : 1;
          const pitch = typeof p.pitch === 'number' ? p.pitch : 1;
          const bus = typeof p.bus === 'string' ? p.bus : undefined;
          if (loop) {
            const position = vec3(p.position);
            this.scriptLoops.set(handle, {
              sound: soundId,
              gain,
              pitch,
              ...(entity !== undefined ? { entity } : {}),
              ...(position ? { position } : {}),
              ...(bus !== undefined ? { bus } : {}),
            });
          } else {
            const where =
              entity !== undefined ? this.entityPos(ctx.source, entity) : vec3(p.position);
            const spatial = this.spatialFor(undefined, sound, where);
            this.fireOneShot(
              {
                sound,
                gain: (sound.entry.gain ?? 1) * gain,
                pitchMul: pitch,
                bus: bus ?? sound.entry.bus ?? 'sfx',
                handle,
                key: handle,
                ...(entity !== undefined ? { entity } : {}),
                ...(where ? { position: where } : {}),
                ...(spatial ? { spatial } : {}),
              },
              ctx.listener,
              now,
              tick,
              cmds,
            );
          }
          break;
        }
        case 'audio.stop': {
          const fadeS = typeof p.fadeS === 'number' ? p.fadeS : 0.15;
          const matches = (m: { handle?: string; entity?: EntityId; sound: string }): boolean => {
            if (typeof p.handle === 'string') return m.handle === p.handle;
            if (p.entity === undefined && p.sound === undefined) return false;
            return (
              (p.entity === undefined || m.entity === p.entity) &&
              (p.sound === undefined || m.sound === p.sound)
            );
          };
          for (const [handle, loop] of [...this.scriptLoops]) {
            if (
              matches({
                handle,
                sound: loop.sound,
                ...(loop.entity ? { entity: loop.entity } : {}),
              })
            ) {
              this.scriptLoops.delete(handle);
              this.stopFades.set(`script:${handle}`, fadeS);
            }
          }
          for (let i = this.oneShots.length - 1; i >= 0; i--) {
            const s = this.oneShots[i] as OneShot;
            if (matches(s)) {
              cmds.push({ op: 'stop', voice: s.voice, fadeS });
              this.oneShots.splice(i, 1);
            }
          }
          break;
        }
        case 'audio.music': {
          const list = Array.isArray(p.playlist)
            ? p.playlist.filter((x): x is string => typeof x === 'string')
            : [];
          this.musicOverride = {
            playlist: list,
            ...(typeof p.crossfadeS === 'number' ? { crossfadeS: p.crossfadeS } : {}),
          };
          break;
        }
        default: {
          const rule = env?.events?.[event.type];
          if (!rule) break;
          const sound = this.sound(rule.sound, `audioEnvironment.events.${event.type}`);
          if (!sound) break;
          const { position, entity } = this.resolveAt(rule.at, event.payload, ctx.source);
          const spatial = this.spatialFor(undefined, sound, position);
          this.fireOneShot(
            {
              sound,
              gain: (sound.entry.gain ?? 1) * (rule.gain ?? 1),
              pitchMul: rule.pitch ?? 1,
              bus: rule.bus ?? sound.entry.bus ?? 'sfx',
              key: `event:${event.type}`,
              ...(entity !== undefined ? { entity } : {}),
              ...(position ? { position } : {}),
              ...(spatial ? { spatial } : {}),
            },
            ctx.listener,
            now,
            tick,
            cmds,
          );
        }
      }
    }
  }

  private footsteps(
    env: AudioEnvironmentData | undefined,
    ctx: SignalContext,
    now: number,
    tick: number,
    cmds: VoiceCommand[],
  ): void {
    const f = env?.footsteps;
    const travelled = ctx.listener.distance;
    const delta = this.footLast === undefined ? 0 : travelled - this.footLast;
    this.footLast = travelled;
    if (!f || ctx.listener.grounded === false || !evalWhen(f.when, ctx)) {
      this.footAcc = 0;
      return;
    }
    const stride = f.strideM ?? 0.75;
    this.footAcc += delta;
    if (this.footAcc < stride) return;
    this.footAcc -= stride;
    if (this.footAcc > stride) this.footAcc = 0;
    const surface = ctx.listener.surface;
    const id = (surface !== undefined ? f.surfaces?.[surface] : undefined) ?? f.sound;
    const sound = this.sound(id, 'audioEnvironment.footsteps');
    if (!sound) return;
    this.fireOneShot(
      {
        sound,
        gain: (sound.entry.gain ?? 1) * (f.gain ?? 1),
        pitchMul: 1,
        bus: sound.entry.bus ?? 'sfx',
        key: 'footstep',
      },
      ctx.listener,
      now,
      tick,
      cmds,
    );
  }

  private updateMusic(
    env: AudioEnvironmentData | undefined,
    ctx: SignalContext,
    now: number,
    cmds: VoiceCommand[],
  ): void {
    const spec = env?.music;
    const override = this.musicOverride;
    const playlist = override ? override.playlist : (spec?.playlist ?? []);
    const crossfadeS = override?.crossfadeS ?? spec?.crossfadeS ?? 4;
    const shuffle = !override && spec?.mode === 'shuffle';
    const gate = this.gate('music');
    const wanted =
      playlist.length > 0 &&
      (override !== undefined || gate.update(evalWhen(spec?.when, ctx, gate.active), now));
    const key = wanted ? `${shuffle ? 's' : 'q'}:${playlist.join('|')}` : '';
    const state = this.musicState;

    const stopCurrent = (fadeS: number): void => {
      if (state?.voice) cmds.push({ op: 'stop', voice: state.voice, fadeS });
    };
    const startTrack = (s: MusicState, fadeInS: number): void => {
      const id = s.order[s.index] as string;
      const sound = this.sound(id, 'audioEnvironment.music');
      if (!sound) {
        s.voice = undefined;
        s.sound = undefined;
        s.endsAt = undefined;
        return;
      }
      const multi = s.order.length > 1;
      const duration = sound.entry.durationS;
      if (multi && duration === undefined)
        this.warn(`music-duration:${id}`, `music track "${id}" has no durationS; it will loop`);
      const loop = !multi || duration === undefined;
      const voice = `music:${this.serial++}`;
      cmds.push({
        op: 'start',
        voice,
        sound: id,
        ref: sound.refs[this.pickClip(sound, s.round)] as string,
        loop,
        ...(loop && sound.entry.loopStart !== undefined
          ? { loopStart: sound.entry.loopStart }
          : {}),
        ...(loop && sound.entry.loopEnd !== undefined ? { loopEnd: sound.entry.loopEnd } : {}),
        gain: (sound.entry.gain ?? 1) * (override ? 1 : (spec?.gain ?? 1)),
        pitch: 1,
        bus: 'music',
        fadeInS,
      });
      s.voice = voice;
      s.sound = id;
      s.endsAt = loop ? undefined : now + (duration as number) * 1000;
    };
    const orderFor = (list: string[], round: number): string[] => {
      if (!shuffle) return [...list];
      return [...list]
        .map((id, i) => ({ id, r: unitRandom(this.seed, 'music', round, i) }))
        .sort((a, b) => a.r - b.r)
        .map((x) => x.id);
    };

    if (!wanted) {
      if (state) {
        stopCurrent(crossfadeS);
        this.musicState = undefined;
      }
      return;
    }
    if (!state || state.key !== key) {
      stopCurrent(crossfadeS);
      const next: MusicState = { key, order: orderFor(playlist, 0), index: 0, round: 0 };
      this.musicState = next;
      startTrack(next, state ? crossfadeS : 2);
      return;
    }
    if (state.endsAt !== undefined && now >= state.endsAt - crossfadeS * 1000) {
      stopCurrent(crossfadeS);
      state.index++;
      if (state.index >= state.order.length) {
        state.round++;
        state.index = 0;
        state.order = orderFor(playlist, state.round);
      }
      startTrack(state, crossfadeS);
    }
  }

  private reconcile(
    desired: Desired[],
    env: AudioEnvironmentData | undefined,
    listener: ListenerCtx,
    tick: number,
    cmds: VoiceCommand[],
  ): void {
    const scored = desired
      .map((d) => {
        const d2 = d.position ? dist(d.position, listener.position) : 0;
        return { d, distance: d2, score: audibility(d.gain, d.spatial, d2) };
      })
      .filter(({ d, distance }) => {
        if (!d.spatial) return true;
        return distance <= d.spatial.maxDistance * (this.live.has(d.key) ? 1.1 : 1);
      })
      .sort((a, b) => a.d.priority - b.d.priority || b.score - a.score);
    const budget = Math.max(0, (env?.maxVoices ?? 32) - (this.musicState?.voice ? 1 : 0));
    const kept = scored.slice(0, budget).map((s) => s.d);
    const keep = new Set(kept.map((d) => d.key));

    for (const [key, v] of [...this.live]) {
      if (keep.has(key)) continue;
      const fadeS = this.stopFades.get(key) ?? v.fadeOutS;
      this.stopFades.delete(key);
      cmds.push({ op: 'stop', voice: v.voice, fadeS });
      this.live.delete(key);
    }
    for (const d of kept) {
      const live = this.live.get(d.key);
      if (!live) {
        const basePitch = this.basePitch(d.sound, tick, d.key);
        const pitch = basePitch * d.pitchMul;
        const clip = this.pickClip(d.sound, tick, d.key);
        const voice = `${d.key}~${this.serial++}`;
        const { entry } = d.sound;
        cmds.push({
          op: 'start',
          voice,
          sound: d.sound.id,
          ref: d.sound.refs[clip] as string,
          loop: d.loop,
          ...(entry.loopStart !== undefined ? { loopStart: entry.loopStart } : {}),
          ...(entry.loopEnd !== undefined ? { loopEnd: entry.loopEnd } : {}),
          gain: d.gain,
          pitch,
          bus: d.bus,
          ...(d.spatial && d.position ? { spatial: { ...d.spatial, position: d.position } } : {}),
          fadeInS: d.fadeInS,
        });
        this.live.set(d.key, {
          key: d.key,
          voice,
          sound: d.sound.id,
          bus: d.bus,
          loop: d.loop,
          gain: d.gain,
          pitch,
          basePitch,
          fadeOutS: d.fadeOutS,
          ...(d.position ? { position: d.position } : {}),
          ...(d.entity !== undefined ? { entity: d.entity } : {}),
        });
        continue;
      }
      const pitch = live.basePitch * d.pitchMul;
      const set: Extract<VoiceCommand, { op: 'set' }> = { op: 'set', voice: live.voice };
      let changed = false;
      if (Math.abs(d.gain - live.gain) > 0.005) {
        set.gain = d.gain;
        live.gain = d.gain;
        changed = true;
      }
      if (Math.abs(pitch - live.pitch) > 0.002) {
        set.pitch = pitch;
        live.pitch = pitch;
        changed = true;
      }
      if (d.position && (!live.position || dist(d.position, live.position) > 0.05)) {
        set.position = d.position;
        live.position = d.position;
        changed = true;
      }
      live.fadeOutS = d.fadeOutS;
      if (changed) {
        set.rampS = d.rampS;
        cmds.push(set);
      }
    }
  }
}
