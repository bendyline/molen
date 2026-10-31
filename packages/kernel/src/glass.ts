import {
  type GlassData,
  type GlassImpact,
  type GlassImpactEvent,
  type GlassStateData,
  type GlassSurfaceSpec,
  type GlassSurfaceState,
  glassImpactSchema,
  type Vec3,
} from '@bendyline/molen-schema';
import { type ComponentType, defineComponent, Transform } from './component';
import { dmath as m } from './dmath';
import { quatConjugate, quatMul, quatRotateVec3 } from './math3d';
import type { World } from './world';

export const Glass: ComponentType<GlassData> = defineComponent<GlassData>('glass');
export const GlassState: ComponentType<GlassStateData> =
  defineComponent<GlassStateData>('glassState');

export function initialGlassSurfaceState(): GlassSurfaceState {
  return {
    fracture: 'intact',
    retained: true,
    damage: 0,
    retentionDamage: 0,
    peakStress: 0,
    point: [0, 0],
  };
}

/**
 * Reduced thin-strip bending model: sigma = C F span / (width thickness²).
 * C = 1.5 for a centered point force, 0.75 for distributed inertia. Normal impulse / physical
 * pulse duration supplies F; tangential energy cannot fracture the pane. Strength initiates
 * cracks, excess normal energy grows them. Frame/interlayer failure has its own force/work
 * budget. This is a deterministic gameplay approximation, not a laminated-plate FEM solver.
 */
export function applyGlassImpact(
  pane: GlassSurfaceSpec,
  state: GlassSurfaceState,
  impact: GlassImpact,
): GlassSurfaceState {
  if (!state.retained) return state;
  if (
    !(impact.duration > 0) ||
    !Number.isFinite(impact.duration) ||
    !(impact.energy >= 0) ||
    !Number.isFinite(impact.energy) ||
    ![...impact.impulse, ...impact.point].every(Number.isFinite)
  )
    throw new Error(
      'Glass impact requires finite loads, nonnegative energy and positive duration.',
    );
  const [w, h] = pane.size;
  if (m.abs(impact.point[0]) > w / 2 || m.abs(impact.point[1]) > h / 2) return state;
  const local = quatRotateVec3(quatConjugate(pane.rotation), impact.impulse);
  const total = local[0] ** 2 + local[1] ** 2 + local[2] ** 2;
  if (total === 0 || local[2] === 0 || impact.energy === 0) return state;
  const force = m.abs(local[2]) / impact.duration;
  const energy = impact.energy * (local[2] ** 2 / total);
  const span = m.min(w, h),
    width = m.max(w, h);
  const coordinate = w < h ? impact.point[0] : impact.point[1];
  const bending = impact.distributed ? 0.75 : 1.5 * m.max(0, 1 - ((2 * coordinate) / span) ** 2);
  const stress = (bending * force * span) / (width * pane.thickness ** 2);
  const strength = pane.strength ?? (pane.material === 'tempered' ? 120e6 : 45e6);
  let damage = state.damage;
  let fracture = state.fracture;
  if (stress >= strength) {
    const work = energy * (1 - strength / stress);
    damage = m.min(1, m.max(damage, 0.05) + work / ((pane.fractureEnergy ?? 80) * w * h));
    fracture = pane.material !== 'laminated' || damage >= 1 ? 'shattered' : 'cracked';
    if (fracture === 'shattered') damage = 1;
  }
  const retentionForce = pane.retentionForce ?? 4000 * 2 * (w + h);
  const retentionDamage = m.min(
    1,
    state.retentionDamage +
      (force > retentionForce
        ? (energy * (1 - retentionForce / force)) / (pane.retentionEnergy ?? 3000 * w * h)
        : 0),
  );
  const retained =
    retentionDamage < 1 && !(fracture === 'shattered' && pane.material !== 'laminated');
  return {
    ...state,
    damage,
    fracture,
    retained,
    retentionDamage,
    peakStress: m.max(state.peakStress, stress),
    point: damage > state.damage ? [...impact.point] : state.point,
  };
}

/** Apply a contact to an authored pane and publish transitions after committing persistent state. */
export function damageGlass(world: World, input: GlassImpactEvent): void {
  const impact = glassImpactSchema.parse(input);
  const pane = world.get(impact.entity, Glass)?.surfaces.find((s) => s.id === impact.surface);
  const transform = world.get(impact.entity, Transform);
  if (!pane || !transform) return;
  const states = world.get(impact.entity, GlassState)?.surfaces ?? {};
  const before = Object.hasOwn(states, pane.id)
    ? (states[pane.id] as GlassSurfaceState)
    : initialGlassSurfaceState();
  let after = applyGlassImpact(pane, before, impact);
  if (after === before) return;
  if (before.retained && !after.retained) {
    const center = quatRotateVec3(transform.rot, pane.center);
    const mass = (pane.density ?? 2500) * pane.size[0] * pane.size[1] * pane.thickness;
    const impulse = quatRotateVec3(transform.rot, impact.impulse);
    const magnitude = m.hypot(...impulse);
    // Only a direct strike transfers additional momentum to the pane. Crash loads already carry
    // its pre-collision world velocity; adding inertia again would double the launch speed.
    const speed = impact.distributed
      ? 0
      : m.min(magnitude / mass, m.sqrt((2 * impact.energy) / mass));
    const velocity = impact.velocity ?? [0, 0, 0];
    after = {
      ...after,
      release: {
        time: world.tick / world.tickRate,
        position: [
          transform.pos[0] + center[0],
          transform.pos[1] + center[1],
          transform.pos[2] + center[2],
        ],
        rotation: quatMul(transform.rot, pane.rotation),
        velocity: [
          velocity[0] + (magnitude ? (impulse[0] / magnitude) * speed : 0),
          velocity[1] + (magnitude ? (impulse[1] / magnitude) * speed : 0),
          velocity[2] + (magnitude ? (impulse[2] / magnitude) * speed : 0),
        ],
        fragmentSpeed: m.min(2, 0.15 * m.sqrt((2 * impact.energy) / mass)),
      },
    };
  }
  world.set(impact.entity, GlassState, { surfaces: { ...states, [pane.id]: after } });
  const payload = {
    entity: impact.entity,
    surface: pane.id,
    material: pane.material,
    stress: after.peakStress,
    retained: after.retained,
  };
  if (before.fracture === 'intact' && after.fracture !== 'intact')
    world.emit('glass-cracked', payload);
  if (before.fracture !== 'shattered' && after.fracture === 'shattered')
    world.emit('glass-shattered', payload);
  if (before.retained && !after.retained) world.emit('glass-released', payload);
}

/** One resolved chassis collision. Vectors are world-space; angular change is rad/s. */
export interface GlassCrashLoad {
  deltaVelocity: Vec3;
  deltaAngularVelocity: Vec3;
  velocity: Vec3;
  angularVelocity: Vec3;
  centerOfMass: Vec3;
}
function atPoint(linear: Vec3, angular: Vec3, arm: Vec3): Vec3 {
  return [
    linear[0] + angular[1] * arm[2] - angular[2] * arm[1],
    linear[1] + angular[2] * arm[0] - angular[0] * arm[2],
    linear[2] + angular[0] * arm[1] - angular[1] * arm[0],
  ];
}

/** Chassis impulse loads each pane by its mass and normal acceleration, including yaw shock. */
export function applyGlassCrash(world: World, entity: string, crash: GlassCrashLoad): void {
  const glass = world.get(entity, Glass),
    transform = world.get(entity, Transform);
  if (!glass || !transform) return;
  for (const pane of glass.surfaces) {
    const arm = quatRotateVec3(transform.rot, [
      pane.center[0] - crash.centerOfMass[0],
      pane.center[1] - crash.centerOfMass[1],
      pane.center[2] - crash.centerOfMass[2],
    ]);
    const dv = atPoint(crash.deltaVelocity, crash.deltaAngularVelocity, arm);
    const local = quatRotateVec3(quatConjugate(transform.rot), dv);
    const mass = (pane.density ?? 2500) * pane.size[0] * pane.size[1] * pane.thickness;
    damageGlass(world, {
      entity,
      surface: pane.id,
      point: [0, 0],
      distributed: true,
      impulse: [-mass * local[0], -mass * local[1], -mass * local[2]],
      energy: 0.5 * mass * (local[0] ** 2 + local[1] ** 2 + local[2] ** 2),
      duration: glass.crashPulseSeconds ?? 0.06,
      velocity: atPoint(crash.velocity, crash.angularVelocity, arm),
    });
  }
}

const installed = new WeakSet<World>();
/** Enables `glass-impact` contacts from scripts/physics adapters. State lives entirely in ECS. */
export function installGlass(world: World): void {
  if (installed.has(world)) return;
  installed.add(world);
  world.on('glass-impact', (event) => damageGlass(world, event.payload as GlassImpactEvent));
}
