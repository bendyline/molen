/**
 * `figures-locomotion` (late phase, before the hierarchy): derive each figure's compact
 * locomotion state from whatever moves it, turn it toward its velocity, and write `figureState`
 * only when something changed. Steady walking costs zero writes: the gait phase is anchored to
 * a tick and reconstructed from (phaseAt, phaseAtTick, strideRate).
 */

import {
  type ComponentType,
  componentHandle,
  type JsonObject,
  Transform,
  type World,
} from '@bendyline/molen-kernel';
import { Character, MoveIntent } from '@bendyline/molen-kernel/character';
import { dmath, quatFromYaw, type Vec3, yawOf } from '@bendyline/molen-kernel/determinism';
import { KinematicBody } from '@bendyline/molen-kernel/kinematics';
import { PlatformBody } from '@bendyline/molen-kernel/platformer';
import { groundFieldOf } from '@bendyline/molen-kernel/terrain';
import { Mounted } from '@bendyline/molen-kernel/vehicles';
import type { EntityId } from '@bendyline/molen-schema';
import {
  Figure,
  type FigureData,
  type FigureGait,
  FigureIntent,
  type FigureMode,
  FigureState,
  type FigureStateData,
} from './components';
import { bipedRunFor, froude, idleThresholds, quadrupedGaitFor, strideRateFor } from './gait';
import { figurePhase } from './pose';
import type { FigureRuntime } from './runtime';

const Velocity: ComponentType<JsonObject> = componentHandle('velocity');

const SPEED_QUANTUM = 0.05;
const SPEED_THRESHOLD = 0.06;
const TRAVEL_QUANTUM = dmath.TAU / 32;
const DEFAULT_TURN_RATE = 10;

export interface LocomotionOptions {
  /** Ground height at a world XZ (default: the world's ground field, else y = 0). */
  groundHeight?: (x: number, z: number) => number;
}

interface Motion {
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  mounted: boolean;
}

/** Previous positions of transform-delta figures, kept as a snapshot provider blob. */
export interface LocomotionMemory {
  prev: Record<EntityId, Vec3>;
}

function motionOf(
  w: World,
  id: EntityId,
  figure: FigureData,
  pos: Vec3,
  dt: number,
  memory: LocomotionMemory,
  groundAt: (x: number, z: number) => number,
): Motion {
  const groundedByHeight = (): boolean => pos[1] <= groundAt(pos[0], pos[2]) + 0.05;
  if (w.has(id, Mounted)) return { vx: 0, vy: 0, vz: 0, grounded: true, mounted: true };
  const source = figure.speedSource ?? 'auto';
  if (source === 'none') {
    return { vx: 0, vy: 0, vz: 0, grounded: groundedByHeight(), mounted: false };
  }
  if (source === 'auto') {
    const body = w.get(id, KinematicBody);
    const character = w.get(id, Character);
    if (body !== undefined) {
      return {
        vx: body.vel[0],
        vy: body.vel[1],
        vz: body.vel[2],
        grounded: character?.grounded ?? groundedByHeight(),
        mounted: false,
      };
    }
    if (character !== undefined) {
      const dir = w.get(id, MoveIntent)?.dir ?? [0, 0];
      const len = dmath.hypot(dir[0], dir[1]);
      const n = len > 1 ? len : 1;
      return {
        vx: (dir[0] / n) * character.speed,
        vy: character.vy,
        vz: (dir[1] / n) * character.speed,
        grounded: character.grounded,
        mounted: false,
      };
    }
    const platform = w.get(id, PlatformBody);
    if (platform !== undefined) {
      const vel = platform.vel ?? [0, 0];
      return { vx: vel[0], vy: vel[1], vz: 0, grounded: platform.grounded ?? true, mounted: false };
    }
    const linear = w.get(id, Velocity)?.linear;
    if (Array.isArray(linear) && linear.length === 3) {
      const [vx, vy, vz] = linear as Vec3;
      return { vx, vy, vz, grounded: groundedByHeight(), mounted: false };
    }
  }
  const prev = memory.prev[id];
  memory.prev[id] = [pos[0], pos[1], pos[2]];
  if (prev === undefined || dt <= 0) {
    return { vx: 0, vy: 0, vz: 0, grounded: groundedByHeight(), mounted: false };
  }
  return {
    vx: (pos[0] - prev[0]) / dt,
    vy: (pos[1] - prev[1]) / dt,
    vz: (pos[2] - prev[2]) / dt,
    grounded: groundedByHeight(),
    mounted: false,
  };
}

function sameState(a: FigureStateData | undefined, b: FigureStateData): boolean {
  if (a === undefined) return false;
  return (
    a.mode === b.mode &&
    a.gait === b.gait &&
    a.speed === b.speed &&
    a.travel === b.travel &&
    a.strideRate === b.strideRate &&
    a.phaseAt === b.phaseAt &&
    a.phaseAtTick === b.phaseAtTick &&
    a.modeAtTick === b.modeAtTick &&
    a.prevMode === b.prevMode &&
    a.lookAtTick === b.lookAtTick
  );
}

/** Install the locomotion system and its snapshot provider. */
export function installLocomotion(
  world: World,
  runtime: FigureRuntime,
  opts: LocomotionOptions = {},
): void {
  const memory: LocomotionMemory = { prev: {} };
  world.registerSnapshotProvider(
    'figures',
    () => ({ prev: { ...memory.prev } }),
    (blob) => {
      memory.prev = {};
      const prev = (blob as Partial<LocomotionMemory> | null)?.prev;
      if (prev !== undefined && prev !== null) {
        for (const [id, p] of Object.entries(prev)) memory.prev[id] = [p[0], p[1], p[2]];
      }
    },
  );
  const groundAt =
    opts.groundHeight ?? ((x: number, z: number) => groundFieldOf(world)?.sampleHeight(x, z) ?? 0);

  world.addSystem(
    (w, ctx) => {
      const tick = ctx.tick;
      const dt = ctx.dt;
      const seen = new Set<EntityId>();
      for (const [id, figure, t] of w.query(Figure, Transform)) {
        seen.add(id);
        const entry = runtime.entryFor(id);
        if (entry === undefined) continue;
        const rig = entry.rig;
        const state = w.get(id, FigureState);
        const intent = w.get(id, FigureIntent);
        const motion = motionOf(w, id, figure, t.pos, dt, memory, groundAt);
        const v = dmath.hypot(motion.vx, 0, motion.vz);
        const wasMoving = state !== undefined && (state.mode === 'walk' || state.mode === 'run');

        let mode: FigureMode;
        let gait: FigureGait | undefined = wasMoving ? state?.gait : undefined;
        if (intent?.mode !== undefined) {
          mode = intent.mode;
        } else if (motion.mounted) {
          mode = 'sit';
        } else if (!motion.grounded) {
          if (motion.vy > 0.5) mode = 'jump';
          else if (motion.vy < -0.5) mode = 'fall';
          else mode = state?.mode === 'jump' ? 'jump' : 'fall';
        } else {
          const thresholds = idleThresholds(rig.height);
          const moving = wasMoving ? v >= thresholds.enter : v > thresholds.exit;
          if (!moving) {
            mode = 'idle';
          } else {
            const fr = froude(v, rig.legLength);
            if (rig.archetype === 'biped') {
              mode = bipedRunFor(fr, state?.mode === 'run') ? 'run' : 'walk';
              gait = undefined;
            } else {
              gait = quadrupedGaitFor(fr, gait);
              mode = gait === 'walk' ? 'walk' : 'run';
            }
          }
        }
        if (mode !== 'walk' && mode !== 'run') gait = undefined;

        const moving = mode === 'walk' || mode === 'run';
        const prevSpeed = state?.speed ?? 0;
        let speed = 0;
        if (moving) {
          const keep =
            state !== undefined &&
            state.mode === mode &&
            dmath.abs(v - prevSpeed) <= SPEED_THRESHOLD;
          speed = keep ? prevSpeed : dmath.round(v / SPEED_QUANTUM) * SPEED_QUANTUM;
        }
        const strideRate = moving ? strideRateFor(speed, rig.legLength) : 0;

        const yaw = yawOf(t.rot);
        let travel: number | undefined;
        if (moving && v > 0.1) {
          const rel = dmath.wrapAngle(dmath.atan2(motion.vx, motion.vz) - yaw);
          const previous = state?.travel;
          if (
            previous !== undefined &&
            dmath.abs(dmath.wrapAngle(rel - previous)) <= 0.6 * TRAVEL_QUANTUM
          ) {
            travel = previous;
          } else {
            const quantized = dmath.round(rel / TRAVEL_QUANTUM) * TRAVEL_QUANTUM;
            travel = dmath.abs(quantized) < TRAVEL_QUANTUM ? undefined : quantized;
          }
        }

        if (figure.facing !== 'manual' && !motion.mounted && moving && v > 0.1) {
          const target = dmath.atan2(motion.vx, motion.vz);
          const delta = dmath.wrapAngle(target - yaw);
          if (dmath.abs(delta) > 1e-4) {
            const turnRate = figure.turnRate ?? DEFAULT_TURN_RATE;
            const step = dmath.clamp(delta, -turnRate * dt, turnRate * dt);
            w.patch(id, Transform, { rot: quatFromYaw(yaw + step) });
          }
        }

        let phaseAt = 0;
        let phaseAtTick = tick;
        if (state !== undefined) {
          if (state.strideRate === strideRate) {
            phaseAt = state.phaseAt;
            phaseAtTick = state.phaseAtTick;
          } else {
            phaseAt = figurePhase(state, tick, w.tickRate);
          }
        }
        const modeChanged = state === undefined || state.mode !== mode;
        const next: FigureStateData = {
          mode,
          speed,
          strideRate,
          phaseAt,
          phaseAtTick,
          modeAtTick: modeChanged ? tick : (state?.modeAtTick ?? tick),
        };
        if (gait !== undefined) next.gait = gait;
        if (travel !== undefined) next.travel = travel;
        if (modeChanged && state !== undefined) next.prevMode = state.mode;
        else if (!modeChanged && state?.prevMode !== undefined) next.prevMode = state.prevMode;
        if (intent?.lookAt !== undefined) next.lookAtTick = state?.lookAtTick ?? tick;
        if (!sameState(state, next)) w.set(id, FigureState, next);
      }
      for (const id of Object.keys(memory.prev)) if (!seen.has(id)) delete memory.prev[id];
    },
    { phase: 'late', name: 'figures-locomotion', priority: -20 },
  );
}
