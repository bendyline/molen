import type {
  AircraftCollisionPart,
  AircraftCollisionProbe,
  AircraftContact,
  AircraftDebris,
  AircraftSpec,
  AircraftStateData,
} from '@bendyline/molen-schema';

export type { AircraftCollisionProbe, AircraftContact } from '@bendyline/molen-schema';

import type { TransformData } from './component';
import { dmath as m } from './dmath';
import { quatFromAxisAngle, quatMul, quatNormalize, quatRotateVec3 } from './math3d';

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

export interface AircraftContactEnvironment {
  groundHeight(x: number, z: number, y?: number): number | undefined;
  /** Static obstacle contacts, in the same absolute coordinate frame as the simulation. */
  contacts?(probes: readonly AircraftCollisionProbe[], entity: string): readonly AircraftContact[];
}

export function aircraftCollisionParts(spec: AircraftSpec): readonly AircraftCollisionPart[] {
  return (
    spec.collisionParts ?? [
      {
        id: 'body',
        role: 'body',
        probes: spec.collisionProbes,
        center: spec.centerOfMass,
        radius: 0.3,
        massFraction: 1,
        nodes: [],
      },
    ]
  );
}
export function aircraftCollisionProbes(
  t: TransformData,
  spec: AircraftSpec,
  state?: AircraftStateData,
): AircraftCollisionProbe[] {
  return aircraftCollisionParts(spec).flatMap((part): AircraftCollisionProbe[] => {
    if (state?.damage?.[part.id]?.detached) return [];
    if (part.disc) {
      const disc = part.disc;
      let center = disc.center,
        normal = disc.normal;
      if (disc.tilt) {
        const rotation = quatFromAxisAngle(
          disc.tilt.axis,
          disc.tilt.angle * (state?.thrustVectorPosition ?? 0),
        );
        center = add(disc.tilt.pivot, quatRotateVec3(rotation, sub(center, disc.tilt.pivot)));
        normal = quatRotateVec3(rotation, normal);
      }
      const binding = spec.visual.rotors.find((rotor) => rotor.node === disc.rotor);
      const engineId = binding?.engine ?? spec.engines?.[0]?.id ?? 'main';
      const engine = spec.engines?.find((engine) => engine.id === engineId) ?? spec.engine;
      return [
        {
          part: part.id,
          center: add(t.pos, quatRotateVec3(t.rot, center)),
          radius: disc.radius,
          disc: {
            normal: quatRotateVec3(t.rot, normal),
            halfThickness: disc.halfThickness,
            angularSpeed:
              (state?.engines?.[engineId]?.rpm ?? state?.rpm ?? 0) *
              (engine?.rotorAngularSpeed ?? 0) *
              (binding?.multiplier ?? 1),
          },
        },
      ];
    }
    return part.probes.map((local) => ({
      part: part.id,
      center: add(t.pos, quatRotateVec3(t.rot, local)),
      radius: part.radius,
    }));
  });
}
export function aircraftSectionAuthority(
  spec: AircraftSpec,
  state: AircraftStateData,
  role: AircraftCollisionPart['role'],
): number {
  const parts = aircraftCollisionParts(spec).filter((part) => part.role === role);
  if (parts.length === 0) return 1;
  return (
    parts.reduce((total, part) => {
      const damage = state.damage?.[part.id];
      return total + (damage?.detached ? 0 : 0.65 + 0.35 * (damage?.integrity ?? 1));
    }, 0) / parts.length
  );
}
export function aircraftWrecked(spec: AircraftSpec, state: AircraftStateData): boolean {
  return (
    (state.crashed && !state.damage) ||
    aircraftCollisionParts(spec).some(
      (part) => part.role === 'body' && (state.damage?.[part.id]?.integrity ?? 1) <= 0.2,
    ) ||
    (spec.model === 'airplane' &&
      aircraftSectionAuthority(spec, state, 'leftWing') === 0 &&
      aircraftSectionAuthority(spec, state, 'rightWing') === 0) ||
    aircraftSectionAuthority(spec, state, 'rotor') === 0
  );
}
export function damageAircraftBody(spec: AircraftSpec, state: AircraftStateData): void {
  const body = aircraftCollisionParts(spec).find((part) => part.role === 'body');
  if (body) state.damage = { ...state.damage, [body.id]: { integrity: 0, detached: false } };
  state.crashed = true;
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function scale(a: Vec3, value: number): Vec3 {
  return [a[0] * value, a[1] * value, a[2] * value];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function inverse(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}
function omega(state: AircraftStateData): Vec3 {
  return [-state.pitchRate, state.yawRate ?? 0, state.rollRate];
}
function inertia(spec: AircraftSpec): Vec3 {
  return [
    spec.airplane?.pitchInertia ?? spec.mass * (0.18 * spec.length) ** 2,
    spec.airplane?.yawInertia ?? (spec.mass * (spec.span ** 2 + spec.length ** 2)) / 12,
    spec.airplane?.rollInertia ?? spec.mass * (0.14 * spec.span) ** 2,
  ];
}
function rotate(rot: Quat, rate: Vec3, h: number): Quat {
  const speed = m.hypot(...rate);
  return speed > 0
    ? quatNormalize(quatMul(rot, quatFromAxisAngle(scale(rate, 1 / speed), speed * h)))
    : rot;
}

/** Includes terrain; undefined means a probe reached unloaded terrain. No mutations. */
function contactsFor(
  probes: readonly AircraftCollisionProbe[],
  env: AircraftContactEnvironment,
  id: string,
): AircraftContact[] | undefined {
  const contacts: AircraftContact[] = [];
  for (const probe of probes) {
    let deepest: AircraftContact | undefined;
    for (const point of terrainPoints(probe)) {
      const ground = env.groundHeight(point[0], point[2], point[1]);
      if (ground === undefined || !Number.isFinite(ground)) return undefined;
      const depth = ground - point[1];
      if (depth > 0 && (!deepest || depth > deepest.depth))
        deepest = { part: probe.part, point, normal: [0, 1, 0], depth };
    }
    if (deepest) contacts.push(deepest);
  }
  contacts.push(...(env.contacts?.(probes, id) ?? []));
  // Host iteration order cannot decide which joint breaks first.
  return contacts
    .filter(
      (c) =>
        Number.isFinite(c.depth) &&
        c.depth >= 0 &&
        [...c.point, ...c.normal].every(Number.isFinite) &&
        m.hypot(...c.normal) > 0.0001,
    )
    .map((c) => ({ ...c, normal: scale(c.normal, 1 / m.hypot(...c.normal)) }))
    .sort((a, b) => {
      if (a.part !== b.part) return a.part < b.part ? -1 : 1;
      const aa = [...a.point, ...a.normal, a.depth],
        bb = [...b.point, ...b.normal, b.depth];
      for (let i = 0; i < aa.length; i++) {
        const delta = (aa[i] ?? 0) - (bb[i] ?? 0);
        if (delta !== 0) return delta;
      }
      return 0;
    });
}

/** Height fields expose samples, not triangles: cover the interior, rim and exact low point. */
function terrainPoints(probe: AircraftCollisionProbe): Vec3[] {
  if (!probe.disc) return [add(probe.center, [0, -probe.radius, 0])];
  const { normal, halfThickness } = probe.disc;
  const down: Vec3 = [0, -1, 0];
  const projection = sub(down, scale(normal, dot(down, normal)));
  const length = m.hypot(...projection);
  const u = length > 1e-8 ? scale(projection, 1 / length) : ([1, 0, 0] as Vec3);
  const v = cross(normal, u);
  const base = add(probe.center, scale(normal, normal[1] >= 0 ? -halfThickness : halfThickness));
  const points = [base];
  for (const fraction of [0.5, 1])
    for (let i = 0; i < 16; i++) {
      const angle = (i * m.TAU) / 16;
      points.push(
        add(
          base,
          scale(add(scale(u, m.cos(angle)), scale(v, m.sin(angle))), probe.radius * fraction),
        ),
      );
    }
  return points;
}

/** Resolve contact impulses about the center of mass, with friction and finite joint strength. */
export function resolveAircraftContacts(
  t: TransformData,
  state: AircraftStateData,
  spec: AircraftSpec,
  env: AircraftContactEnvironment,
  id: string,
  travelScale = 1,
): boolean {
  const probes = aircraftCollisionProbes(t, spec, state);
  const contacts = contactsFor(probes, env, id);
  if (!contacts) return false;
  const parts = aircraftCollisionParts(spec);
  const com = add(t.pos, quatRotateVec3(t.rot, spec.centerOfMass));
  const inv = inverse(t.rot);
  const lostMass = parts.reduce(
    (sum, part) => sum + (state.damage?.[part.id]?.detached ? part.massFraction : 0),
    0,
  );
  const mass = spec.mass * m.max(0.2, 1 - lostMass);
  const inert = scale(inertia(spec), m.max(0.2, 1 - lostMass));
  let correction: Vec3 = [0, 0, 0];
  const damaged = new Set<string>();
  for (const contact of contacts) {
    const part = parts.find((p) => p.id === contact.part);
    if (!part || state.damage?.[part.id]?.detached) continue;
    const arm = quatRotateVec3(inv, sub(contact.point, com));
    const normal = quatRotateVec3(inv, contact.normal);
    const pointVelocity = add(state.velocity, quatRotateVec3(t.rot, cross(omega(state), arm)));
    const incoming = m.max(0, -dot(pointVelocity, contact.normal));
    const tangent = sub(pointVelocity, scale(contact.normal, dot(pointVelocity, contact.normal)));
    const slide = m.hypot(...tangent);
    // A runway scrape also loads the joint in shear; airborne tangential speed alone does not.
    const rotor = probes.find((probe) => probe.part === part.id && probe.disc);
    // A rotating blade can strike a post while the hub is stationary. The swept-volume
    // proxy conservatively uses blade speed at the contact radius, independent of phase.
    // Shaft energy damages the joint; it must not become a fictitious chassis impulse.
    const bladeSpeed =
      rotor?.disc && contact.depth > 0
        ? m.abs(rotor.disc.angularSpeed) *
          m.min(
            rotor.radius,
            m.max(rotor.radius * 0.25, m.hypot(...sub(contact.point, rotor.center))),
          )
        : 0;
    const impactSpeed = m.sqrt(incoming ** 2 + 0.35 * incoming * slide + bladeSpeed ** 2);
    let detached = false;
    if ((incoming > 0.5 || bladeSpeed > 0.5) && impactSpeed > 2 && !damaged.has(part.id)) {
      damaged.add(part.id);
      const strength = part.breakSpeed ?? spec.hardLandingSpeed * 4;
      const integrity = m.max(
        0,
        (state.damage?.[part.id]?.integrity ?? 1) - (impactSpeed / strength) ** 2,
      );
      detached = integrity === 0 && part.breakSpeed !== undefined;
      state.damage = { ...state.damage, [part.id]: { integrity, detached } };
      state.crashed = true;
      if (detached) {
        const released = [part];
        // Resolve by dependency, not authored order. Each smaller part retains its own
        // geometry and mass, including when its support breaks in the same contact.
        for (let i = 0; i < released.length; i++)
          for (const child of parts)
            if (
              child.parent === released[i]?.id &&
              !state.damage?.[child.id]?.detached &&
              !released.includes(child)
            )
              released.push(child);
        for (const section of released) {
          state.damage = { ...state.damage, [section.id]: { integrity: 0, detached: true } };
          const center = add(t.pos, quatRotateVec3(t.rot, section.center));
          const velocity = add(
            state.velocity,
            quatRotateVec3(t.rot, cross(omega(state), sub(section.center, spec.centerOfMass))),
          );
          const piece: AircraftDebris = {
            part: section.id,
            pos: center,
            rot: [...t.rot],
            velocity: scale(add(velocity, scale(contact.normal, incoming * 0.8)), travelScale),
            angularVelocity: [...omega(state)],
            age: 0,
          };
          const spin = probes.find((probe) => probe.part === section.id)?.disc;
          if (spin)
            piece.angularVelocity = add(
              piece.angularVelocity,
              quatRotateVec3(inv, scale(spin.normal, spin.angularSpeed)),
            );
          const kick = cross(sub(contact.point, center), scale(contact.normal, incoming));
          piece.angularVelocity = add(
            piece.angularVelocity,
            scale(
              quatRotateVec3(inv, kick),
              0.15 / m.max(0.5, m.hypot(...sub(section.center, spec.centerOfMass))),
            ),
          );
          state.debris = [...(state.debris ?? []), piece];
          if (state.engines) {
            state.engines = Object.fromEntries(
              Object.entries(state.engines).map(([key, engine]) => [
                key,
                section.engines?.includes(key)
                  ? { ...engine, failed: true, thrust: 0, shaftPower: 0, afterburner: 0 }
                  : engine,
              ]),
            );
          }
        }
      }
    }
    const angularImpulse = (direction: Vec3): Vec3 => {
      const torque = cross(arm, direction);
      return [torque[0] / inert[0], torque[1] / inert[1], torque[2] / inert[2]];
    };
    const effectiveInverseMass = (direction: Vec3): number =>
      1 / mass + dot(cross(angularImpulse(direction), arm), direction);
    // Once a joint lets go, it can transfer only a bounded impulse back to the fuselage.
    const joint = detached
      ? m.min(1, (part.breakSpeed ?? incoming) / m.max(0.001, incoming)) * 0.25
      : 1;
    const impulse = (incoming * 1.08 * joint) / effectiveInverseMass(normal);
    let localImpulse = scale(normal, impulse);
    if (slide > 0.0001 && impulse > 0) {
      const direction = quatRotateVec3(inv, scale(tangent, -1 / slide));
      localImpulse = add(
        localImpulse,
        scale(direction, m.min(impulse * 0.35, slide / effectiveInverseMass(direction))),
      );
    }
    state.velocity = add(state.velocity, scale(quatRotateVec3(t.rot, localImpulse), 1 / mass));
    let turn = add(omega(state), angularImpulse(localImpulse));
    if (!detached && aircraftWrecked(spec, state)) {
      // Point friction cannot resist rolling or spin about the contact normal. A scraping
      // wreck has a finite contact patch. Dissipate that rotation in proportion to the load
      // impulse, so sustained support damps it consistently across substeps/probe counts,
      // while a wreck in free fall keeps tumbling. 0.5 s/m gives about 5/s at rest under gravity.
      turn = scale(turn, 1 / (1 + (0.5 * impulse) / mass));
    }
    state.pitchRate = -turn[0];
    state.yawRate = turn[1];
    state.rollRate = turn[2];
    if (!detached)
      correction = add(
        correction,
        scale(contact.normal, m.max(0, contact.depth - dot(correction, contact.normal))),
      );
  }
  t.pos = add(t.pos, correction);
  return true;
}

/** Ballistic motion for a destroyed fuselage. It still collides, tumbles and slides. */
export function stepAircraftWreck(
  t: TransformData,
  state: AircraftStateData,
  spec: AircraftSpec,
  h: number,
  travel: number,
): TransformData {
  state.velocity = scale(
    add(state.velocity, [0, -9.81 * h, 0]),
    1 / (1 + h * 0.003 * m.hypot(...state.velocity)),
  );
  const rot = rotate(t.rot, omega(state), h);
  const center = add(
    add(t.pos, quatRotateVec3(t.rot, spec.centerOfMass)),
    scale(state.velocity, h * travel),
  );
  return { ...t, rot, pos: sub(center, quatRotateVec3(rot, spec.centerOfMass)) };
}

/** Detached pieces have their own gravity, spin, obstacle/ground bounce and sliding friction. */
export function stepAircraftDebris(
  state: AircraftStateData,
  spec: AircraftSpec,
  env: AircraftContactEnvironment,
  id: string,
  h: number,
): void {
  stepPartDebris(state, aircraftCollisionParts(spec), env, id, h);
}

/** Shared ballistic debris integrator for aircraft and grounded vehicles. */
export function stepPartDebris(
  state: { debris?: AircraftDebris[] },
  parts: readonly Pick<AircraftCollisionPart, 'id' | 'radius'>[],
  env: AircraftContactEnvironment,
  id: string,
  h: number,
): void {
  if (!state.debris?.length) return;
  const pieces: AircraftDebris[] = [];
  for (const old of state.debris) {
    if (old.age + h >= 20) continue;
    const part = parts.find((p) => p.id === old.part);
    if (!part) continue;
    const velocity = scale(
      add(old.velocity, [0, -9.81 * h, 0]),
      1 / (1 + h * 0.025 * m.hypot(...old.velocity)),
    );
    const piece: AircraftDebris = {
      ...old,
      velocity,
      pos: add(old.pos, scale(velocity, h)),
      rot: rotate(old.rot, old.angularVelocity, h),
      age: old.age + h,
    };
    const contacts = contactsFor(
      [{ part: part.id, center: piece.pos, radius: part.radius }],
      env,
      id,
    );
    if (!contacts) {
      pieces.push(old);
      continue;
    }
    let correction: Vec3 = [0, 0, 0];
    for (const contact of contacts) {
      const inward = m.max(0, -dot(piece.velocity, contact.normal));
      const normalSpeed = dot(piece.velocity, contact.normal);
      const tangent = sub(piece.velocity, scale(contact.normal, normalSpeed));
      const speed = m.hypot(...tangent);
      piece.velocity = add(
        scale(contact.normal, normalSpeed + inward * 1.12),
        scale(tangent, m.max(0, speed - inward * 0.55) / m.max(0.0001, speed)),
      );
      piece.angularVelocity = scale(piece.angularVelocity, m.max(0, 1 - 5 * h));
      correction = add(
        correction,
        scale(contact.normal, m.max(0, contact.depth - dot(correction, contact.normal))),
      );
    }
    piece.pos = add(piece.pos, correction);
    pieces.push(piece);
  }
  state.debris = pieces;
}
