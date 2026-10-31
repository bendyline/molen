import type {
  AircraftCollisionProbe,
  AircraftContact,
  VehicleCollisionPart,
  VehicleDamageState,
  VehicleSpec,
} from '@bendyline/molen-schema';
import type { TransformData } from './component';
import { dmath as m } from './dmath';
import { quatFromAxisAngle, quatRotateVec3 } from './math3d';

type Vec3 = [number, number, number];

export function vehiclePartProbes(
  t: TransformData,
  spec: VehicleSpec,
  state: VehicleDamageState & { actuators?: Record<string, number> },
): AircraftCollisionProbe[] {
  return (spec.collisionParts ?? []).flatMap((part) =>
    state.damage?.[part.id]?.detached
      ? []
      : part.probes.map((local) => {
          let point = local;
          if (part.hinge) {
            const hinge = part.hinge;
            const offset = local.map((v, i) => v - (hinge.pivot[i] ?? 0)) as Vec3;
            point = quatRotateVec3(
              quatFromAxisAngle(hinge.axis, hinge.angle * (state.actuators?.[hinge.actuator] ?? 0)),
              offset,
            ).map((v, i) => v + (hinge.pivot[i] ?? 0)) as Vec3;
          }
          const p = quatRotateVec3(t.rot, point);
          return {
            part: part.id,
            center: p.map((v, i) => v + (t.pos[i] ?? 0)) as Vec3,
            radius: part.radius,
          };
        }),
  );
}

export function vehiclePartAuthority(
  spec: VehicleSpec,
  state: VehicleDamageState,
  role: VehicleCollisionPart['role'],
): number {
  const parts = spec.collisionParts?.filter((p) => p.role === role) ?? [];
  return parts.length
    ? parts.reduce((sum, p) => sum + (state.damage?.[p.id]?.detached ? 0 : 1), 0) / parts.length
    : 1;
}

/** Contact speed damages only the touched joint. Returns the largest closing speed. */
export function resolveVehiclePartContacts(
  t: TransformData,
  state: VehicleDamageState,
  spec: VehicleSpec,
  contacts: readonly AircraftContact[],
  motion: { velocity: Vec3; yawRate: number },
  travel: number,
  transferImpulse = true,
): number {
  const seen = new Set<string>();
  const com = quatRotateVec3(t.rot, spec.centerOfMass).map((v, i) => v + (t.pos[i] ?? 0)) as Vec3;
  const inertia = spec.yawInertia ?? (spec.mass * (spec.length ** 2 + spec.width ** 2)) / 12;
  let impact = 0;
  const ordered = contacts
    .filter((c) => c.depth >= 0 && [...c.point, ...c.normal, c.depth].every(Number.isFinite))
    .map((c) => ({
      ...c,
      normal: c.normal.map((v) => v / m.max(1e-9, m.hypot(...c.normal))) as Vec3,
    }))
    .sort((a, b) => {
      if (a.part !== b.part) return a.part < b.part ? -1 : 1;
      return (
        b.depth - a.depth ||
        a.point[0] - b.point[0] ||
        a.point[1] - b.point[1] ||
        a.point[2] - b.point[2] ||
        a.normal[0] - b.normal[0] ||
        a.normal[1] - b.normal[1] ||
        a.normal[2] - b.normal[2]
      );
    });
  for (const contact of ordered) {
    const part = spec.collisionParts?.find((p) => p.id === contact.part);
    if (!part || state.damage?.[part.id]?.detached || seen.has(part.id)) continue;
    const arm: Vec3 = contact.point.map((v, i) => v - (com[i] ?? 0)) as Vec3;
    const velocity: Vec3 = [
      motion.velocity[0] + motion.yawRate * arm[2],
      motion.velocity[1],
      motion.velocity[2] - motion.yawRate * arm[0],
    ];
    const incoming = m.max(
      0,
      -velocity.reduce((sum, v, i) => sum + v * (contact.normal[i] ?? 0), 0),
    );
    if (incoming <= 0) continue;
    seen.add(part.id);
    impact = m.max(impact, incoming);
    const integrity = m.max(
      0,
      (state.damage?.[part.id]?.integrity ?? 1) -
        (incoming > 2 ? (incoming / part.breakSpeed) ** 2 : 0),
    );
    const detached = integrity === 0;
    if (incoming > 2) state.damage = { ...state.damage, [part.id]: { integrity, detached } };
    if (detached) {
      const offset = quatRotateVec3(t.rot, part.center);
      const center = offset.map((v, i) => v + (t.pos[i] ?? 0)) as Vec3;
      state.debris = [
        ...(state.debris ?? []),
        {
          part: part.id,
          pos: center,
          rot: [...t.rot],
          velocity: [
            (motion.velocity[0] +
              motion.yawRate * (center[2] - com[2]) +
              contact.normal[0] * incoming * 0.2) *
              travel,
            motion.velocity[1] + m.min(2, incoming * 0.1),
            (motion.velocity[2] -
              motion.yawRate * (center[0] - com[0]) +
              contact.normal[2] * incoming * 0.2) *
              travel,
          ],
          angularVelocity: [0, motion.yawRate, incoming * 0.15 * m.sign(part.center[0])],
          age: 0,
        },
      ];
    }
    // Ground support already resolves the vertical axis. Parts transfer horizontal impact
    // and yaw only; separation caps the impulse that a mirror or wheel can carry.
    if (!transferImpulse) continue;
    const [nx, , nz] = contact.normal;
    const horizontal = nx * nx + nz * nz;
    if (horizontal < 1e-6) continue;
    const lever = arm[2] * nx - arm[0] * nz;
    const joint = detached
      ? m.min(1, part.breakSpeed / incoming) * m.min(0.25, part.massFraction * 3)
      : 1;
    const j = (incoming * 1.05 * joint) / (horizontal / spec.mass + (lever * lever) / inertia);
    motion.velocity[0] += (j * nx) / spec.mass;
    motion.velocity[2] += (j * nz) / spec.mass;
    motion.yawRate += (j * lever) / inertia;
  }
  return impact;
}
