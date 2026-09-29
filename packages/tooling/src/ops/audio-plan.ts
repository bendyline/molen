import { readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import {
  AudioDirector,
  type AudioListenerState,
  entitySourceFromWorld,
  mergeSoundbanks,
  type SoundbankInput,
  type VoiceCommand,
} from '@bendyline/molen-client/audio';
import type { World } from '@bendyline/molen-kernel';
import { quatRotateVec3, type ResolvedTypes, type WorldSetup } from '@bendyline/molen-kernel';
import { runHeadless } from '@bendyline/molen-kernel/testing';
import {
  audioSignalIssues,
  audioSignalRefs,
  audioSoundRefs,
  type Command,
  type JsonObject,
  nearestWithDistance,
  type SceneManifest,
  type SoundbankDoc,
  validate,
  type WeatherProfile,
  weatherProfile,
} from '@bendyline/molen-schema';
import { openProjectPacks } from '../content';
import {
  loadSceneDocument,
  loadSetupLike,
  type ProjectContext,
  resolveSetupModule,
} from '../project';
import {
  parseJson,
  prepareSceneBuilder,
  type SceneBuildOptions,
  sceneBuildOptionsFor,
} from './build';
import { guardOp } from './errors';

export interface PlanAudioInput {
  /** Scene file path, or a scene NAME from the surrounding project.json. */
  scenePath?: string;
  scene?: SceneManifest;
  ticks: number;
  commandsPath?: string;
  commands?: Command[];
  projectPath?: string;
  setupModule?: string;
  /** Sound bank files; default every `provides.soundbank` of the project's packs. */
  bankPaths?: string[];
  /** Entity whose transform is the listener; default the scene camera. */
  listener?: string;
  /** Listener mode for `listener.mode` rules (walk, drive, fly…). */
  mode?: string;
  /** Weather profile to hear the scene under (sunny, rain, snow, fog…). */
  weather?: string;
  /** 0 (night) – 1 (day) for `sky.daylight` rules. */
  daylight?: number;
}

export interface PlannedVoice {
  voice: string;
  sound: string;
  bus: string;
  startTick: number;
  stopTick?: number;
  entity?: string;
  peakGain: number;
  pitch: [number, number];
}

export interface PlannedOneShot {
  tick: number;
  sound: string;
  bus: string;
  position?: [number, number, number];
}

export interface PlanAudioIssue {
  path: string;
  message: string;
}

export interface PlanAudioOutput {
  ok: boolean;
  ticks: number;
  tickRate: number;
  banks: string[];
  voices: PlannedVoice[];
  oneShots: PlannedOneShot[];
  /** `audio.*` events scripts emitted (molen.audio.play/stop/music). */
  events: { tick: number; type: string; payload: unknown }[];
  /** Static problems: unknown sound ids and signals in the scene's audio components. */
  issues: PlanAudioIssue[];
  /** Director warnings raised while running. */
  warnings: string[];
  timeline: string;
  error?: string;
}

const fail = (error: string): PlanAudioOutput => ({
  ok: false,
  ticks: 0,
  tickRate: 0,
  banks: [],
  voices: [],
  oneShots: [],
  events: [],
  issues: [],
  warnings: [],
  timeline: '',
  error,
});

/** Run a scene headlessly and report the sounds it would play, tick by tick. */
export function planAudio(input: PlanAudioInput): Promise<PlanAudioOutput> {
  return guardOp(fail, () => planAudioImpl(input));
}

type Vec3 = [number, number, number];

function vec(v: unknown): Vec3 | undefined {
  return Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number')
    ? (v as Vec3)
    : undefined;
}

function towards(from: Vec3, to: Vec3 | undefined): Vec3 {
  if (!to) return [0, 0, -1];
  const d: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const len = Math.hypot(...d);
  return len > 1e-9 ? [d[0] / len, d[1] / len, d[2] / len] : [0, 0, -1];
}

function transformOf(
  world: World,
  id: string,
): { pos?: Vec3; rot?: [number, number, number, number] } {
  const t = world.get(id, { name: 'transform' }) as JsonObject | undefined;
  return {
    ...(vec(t?.pos) ? { pos: vec(t?.pos) } : {}),
    ...(Array.isArray(t?.rot) ? { rot: t?.rot as never } : {}),
  };
}

/** Where the ears are for a headless run: a named entity, else the scene camera. */
function listenerFor(
  world: World,
  manifest: SceneManifest,
  entity: string | undefined,
): Partial<AudioListenerState> {
  if (entity !== undefined) {
    const { pos, rot } = transformOf(world, entity);
    if (!pos) return {};
    const forward = rot ? (quatRotateVec3(rot, [0, 0, -1]) as Vec3) : ([0, 0, -1] as Vec3);
    return { position: pos, forward, up: [0, 1, 0] };
  }
  const c = manifest.camera;
  if (!c) return { position: [0, 0, 0] };
  if (c.mode === 'top-down-ortho')
    return {
      position: [c.center[0], c.cameraHeight ?? 50, c.center[1]],
      forward: [0, -1, 0],
      up: [0, 0, -1],
    };
  if (c.mode === 'follow') {
    const { pos } = transformOf(world, c.entity);
    if (!pos) return {};
    const eye: Vec3 = [pos[0] + c.offset[0], pos[1] + c.offset[1], pos[2] + c.offset[2]];
    const look: Vec3 = [
      pos[0] + c.lookOffset[0],
      pos[1] + c.lookOffset[1],
      pos[2] + c.lookOffset[2],
    ];
    return { position: eye, forward: towards(eye, look), up: [0, 1, 0] };
  }
  return { position: c.position, forward: towards(c.position, c.lookAt), up: [0, 1, 0] };
}

async function loadBanks(
  paths: string[] | undefined,
  project: ProjectContext | undefined,
): Promise<{ inputs: SoundbankInput[]; labels: string[] } | string> {
  const inputs: SoundbankInput[] = [];
  const labels: string[] = [];
  if (paths && paths.length > 0) {
    for (const path of paths) {
      const v = validate('soundbank', parseJson(await readFile(path, 'utf8')));
      if (!v.ok) return `${path}:\n${v.formatted}`;
      inputs.push({
        doc: v.value as SoundbankDoc,
        base: relative(process.cwd(), dirname(resolve(path))),
      });
      labels.push(path);
    }
    return { inputs, labels };
  }
  const set = project?.packs ?? (await openProjectPacks(undefined));
  for (const { pack, path } of set.provided('soundbank')) {
    const v = validate('soundbank', await pack.readJson(path));
    if (!v.ok) return `${pack.manifest.id}/${path}:\n${v.formatted}`;
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    inputs.push({ doc: v.value as SoundbankDoc, base: `pack:${pack.manifest.id}/${dir}` });
    labels.push(`${pack.manifest.id}@${pack.manifest.version}:${path}`);
  }
  if (inputs.length === 0)
    return 'no sound bank: pass --bank <file>, add a pack providing "soundbank" to project.json, or set MOLEN_PACKS';
  return { inputs, labels };
}

async function planAudioImpl(input: PlanAudioInput): Promise<PlanAudioOutput> {
  let manifest: SceneManifest;
  let types: ResolvedTypes | undefined;
  let project: ProjectContext | undefined;
  let buildOpts: SceneBuildOptions = {};
  if (input.scene !== undefined) {
    const v = validate('scene', input.scene);
    if (!v.ok) return fail(v.formatted);
    manifest = v.value;
  } else {
    if (input.scenePath === undefined) return fail('planAudio: provide scenePath or scene');
    const loaded = await loadSceneDocument(input.scenePath, {
      ...(input.projectPath !== undefined ? { projectPath: input.projectPath } : {}),
    });
    manifest = loaded.manifest;
    types = loaded.project?.resolvedTypes;
    project = loaded.project;
    buildOpts = await sceneBuildOptionsFor(loaded);
  }

  let commands = input.commands ?? [];
  if (input.commandsPath !== undefined) {
    const raw = parseJson(await readFile(input.commandsPath, 'utf8'));
    const list = Array.isArray(raw) ? raw : (raw as { commands?: unknown }).commands;
    if (!Array.isArray(list)) return fail(`${input.commandsPath}: expected an array of commands`);
    commands = [];
    for (const [i, c] of list.entries()) {
      const v = validate('command', c);
      if (!v.ok) return fail(`command[${i}] invalid:\n${v.formatted}`);
      commands.push(v.value);
    }
  }

  let setup: WorldSetup | undefined;
  const setupModule = resolveSetupModule(input.setupModule, project);
  if (setupModule !== undefined) setup = await loadSetupLike(setupModule);

  const banks = await loadBanks(input.bankPaths, project);
  if (typeof banks === 'string') return fail(banks);
  const bank = mergeSoundbanks(banks.inputs);
  const warnings: string[] = [];
  const director = new AudioDirector({ bank, onWarning: (m) => warnings.push(m) });

  const build = await prepareSceneBuilder(manifest, setup, {
    ...buildOpts,
    ...(types !== undefined ? { types } : {}),
  });

  let weather = undefined as ReturnType<typeof weatherProfile> | undefined;
  if (input.weather !== undefined) {
    try {
      weather = weatherProfile(input.weather as WeatherProfile);
    } catch {
      return fail(
        `unknown weather profile "${input.weather}" (sunny, partly-cloudy, overcast, rain, snow, fog)`,
      );
    }
  }

  const issues: PlanAudioIssue[] = [];
  const voices = new Map<string, PlannedVoice>();
  const done: PlannedVoice[] = [];
  const oneShots: PlannedOneShot[] = [];
  const events: PlanAudioOutput['events'] = [];
  let tickRate = 30;
  let detach: (() => void) | undefined;
  let lastTick = 0;

  const record = (cmds: VoiceCommand[], tick: number): void => {
    for (const cmd of cmds) {
      if (cmd.op === 'start') {
        if (cmd.loop || cmd.voice.startsWith('music:')) {
          const entity = cmd.voice.startsWith('src:')
            ? cmd.voice.slice(4, cmd.voice.lastIndexOf('~'))
            : undefined;
          voices.set(cmd.voice, {
            voice: cmd.voice,
            sound: cmd.sound,
            bus: cmd.bus,
            startTick: tick,
            peakGain: cmd.gain,
            pitch: [cmd.pitch, cmd.pitch],
            ...(entity !== undefined ? { entity } : {}),
          });
        } else {
          oneShots.push({
            tick,
            sound: cmd.sound,
            bus: cmd.bus,
            ...(cmd.spatial ? { position: cmd.spatial.position } : {}),
          });
        }
      } else if (cmd.op === 'set') {
        const v = voices.get(cmd.voice);
        if (v && cmd.gain !== undefined) v.peakGain = Math.max(v.peakGain, cmd.gain);
        if (v && cmd.pitch !== undefined)
          v.pitch = [Math.min(v.pitch[0], cmd.pitch), Math.max(v.pitch[1], cmd.pitch)];
      } else if (cmd.op === 'stop') {
        const v = voices.get(cmd.voice);
        if (v) {
          voices.delete(cmd.voice);
          done.push({ ...v, stopTick: tick });
        }
      }
    }
  };

  const staticCheck = (world: World): void => {
    const source = entitySourceFromWorld(world);
    for (const component of ['audioSource', 'audioZone', 'audioEnvironment'] as const) {
      for (const [id, data] of source.each(component)) {
        for (const ref of audioSoundRefs(component, data as never)) {
          if (bank.resolve(ref.sound)) continue;
          const near = nearestWithDistance(ref.sound, [...bank.ids()]);
          issues.push({
            path: `/entities/${id}/components/${component}${ref.path}`,
            message: `unknown sound "${ref.sound}"${near ? `; did you mean "${near.candidate}"?` : ''}`,
          });
        }
        for (const ref of audioSignalRefs(component, data as never)) {
          for (const issue of audioSignalIssues(ref.signal))
            issues.push({
              path: `/entities/${id}/components/${component}${ref.path}`,
              message: `${issue.message}${issue.hint ? `; ${issue.hint}` : ''}`,
            });
        }
      }
    }
  };

  runHeadless(build, {
    commands,
    ticks: input.ticks,
    onTick(world) {
      if (!detach) {
        tickRate = world.tickRate;
        const source = entitySourceFromWorld(world);
        director.setBank(bank);
        detach = source.onEvent?.((event, tick) => {
          director.handleEvent(event, tick);
          if (event.type.startsWith('audio.'))
            events.push({ tick, type: event.type, payload: event.payload });
        });
        staticCheck(world);
      }
      lastTick = world.tick;
      const listener = listenerFor(world, manifest, input.listener);
      const cmds = director.update({
        nowMs: (world.tick * 1000) / world.tickRate,
        listener: { ...listener, ...(input.mode !== undefined ? { mode: input.mode } : {}) },
        source: entitySourceFromWorld(world),
        signals: {
          ...(weather ? { weather } : {}),
          ...(input.daylight !== undefined ? { sky: { daylight: input.daylight } } : {}),
        },
      });
      record(cmds, world.tick);
    },
  });
  detach?.();

  const all = [...done, ...voices.values()].sort((a, b) => a.startTick - b.startTick);
  const lines: string[] = [];
  lines.push(`${input.ticks} ticks at ${tickRate} Hz, banks: ${banks.labels.join(', ')}`);
  lines.push(all.length > 0 ? 'loops:' : 'loops: none');
  for (const v of all) {
    const span = `[${v.startTick} → ${v.stopTick ?? 'end'}]`.padEnd(14);
    const at = v.entity !== undefined ? ` @${v.entity}` : '';
    const pitch =
      v.pitch[0] === v.pitch[1]
        ? v.pitch[0].toFixed(2)
        : `${v.pitch[0].toFixed(2)}–${v.pitch[1].toFixed(2)}`;
    lines.push(
      `  ${span} ${v.sound}${at}  bus ${v.bus}  peak ${v.peakGain.toFixed(2)}  pitch ${pitch}`,
    );
  }
  lines.push(oneShots.length > 0 ? `one-shots (${oneShots.length}):` : 'one-shots: none');
  for (const s of oneShots.slice(0, 200)) {
    const at = s.position
      ? ` at [${s.position.map((x) => Math.round(x * 10) / 10).join(', ')}]`
      : '';
    lines.push(`  t=${String(s.tick).padEnd(6)} ${s.sound}${at}  (${s.bus})`);
  }
  if (oneShots.length > 200) lines.push(`  … ${oneShots.length - 200} more`);
  for (const i of issues) lines.push(`✗ ${i.path}: ${i.message}`);
  for (const w of warnings) lines.push(`! ${w}`);

  return {
    ok: issues.length === 0 && !warnings.some((w) => w.startsWith('unknown sound')),
    ticks: lastTick,
    tickRate,
    banks: banks.labels,
    voices: all,
    oneShots,
    events,
    issues,
    warnings,
    timeline: lines.join('\n'),
  };
}
