/** Variable jet nozzles: rings of hinged petals that close and open on the engine's nozzle signal.
 *
 * An afterburning turbofan's exhaust nozzle opens at idle (to cut idle thrust), closes toward its
 * smallest area as the engine reaches military power, and opens again with reheat. The aircraft
 * renderer publishes `engines.<id>.nozzle` for it (0 closed, 1 open; see aircraft-exhaust.ts in the
 * client). Each petal here is its own node, hinged on the ring where the fixed shroud ends and
 * turned about its own tangent axis, so the ring closes like the real flaps rather than shrinking.
 * Adjacent petals overlap, as flaps and seals do, more so as the ring closes. The petals are built
 * open (the rest pose, as a parked aircraft stands) and every part of a petal shares its material,
 * so a petal is one draw.
 */
import { detailKit } from '../vehicle-detail.mjs';
import { group, sheet, T } from './mesh-kit.mjs';

const round = (v) => Math.round(v * 1e4) / 1e4;

/**
 * Build one petal ring under `parent` and return its bindings and a function giving its
 * `visual.exhausts` entry in model coordinates (call that once the builder has placed everything).
 *
 * - `name`: node prefix, unique in the model; `engine`: the engine id the petals follow.
 * - `hinge`, `exit`: centers of the hinge ring and of the open exit, in `parent` coordinates.
 * - `hingeRadius`, `openRadius`, `closedRadius`: distance from the axis to the middle of a petal
 *   at the hinge, and at the exit open and closed.
 * - `petals`: count; `phase`: angle of the first petal's middle from the top (default 0).
 * - `overlap`: petal width over its share of the ring (default 1.1).
 * - `point`: depth of a pointed trailing edge, m (default 0, straight).
 * - `rods`: actuator rods on each petal, `{ from, to, lift, radius }`: from/to are fractions of the
 *   petal's length from the hinge, lift is their height off its outer face (m).
 */
export function petalNozzle(parent, options) {
  const {
    name,
    engine,
    hinge,
    exit,
    hingeRadius,
    openRadius,
    closedRadius,
    petals,
    material,
    phase = 0,
    overlap = 1.1,
    point = 0,
    rods = [],
  } = options;
  const start = new T.Vector3(...hinge),
    end = new T.Vector3(...exit),
    aft = end.clone().sub(start),
    length = aft.length();
  aft.normalize();
  // Frame: origin at the hinge-ring center, local -Z down the nozzle axis.
  const frame = group(parent, name, hinge);
  frame.quaternion.setFromUnitVectors(new T.Vector3(0, 0, -1), aft);
  // The open petal runs from the hinge (y 0, z 0) to its exit edge (y = rise, z = -length).
  const rise = openRadius - hingeRadius,
    reach = Math.hypot(rise, length),
    open = Math.atan2(rise, length),
    // Turned about its hinge (local x) by `closing`, the exit edge stands at closedRadius.
    closing = Math.asin((closedRadius - hingeRadius) / reach) - open;
  const share = 2 * Math.tan(Math.PI / petals) * overlap,
    tip = new T.Vector3(0, rise, -length),
    along = tip.clone().normalize(),
    outward = new T.Vector3(0, length, rise).normalize();
  const bindings = [];
  for (let j = 0; j < petals; j++) {
    const label = String(j).padStart(2, '0'),
      roll = group(frame, `${name}-roll-${label}`);
    roll.rotation.z = -(phase + (j * 2 * Math.PI) / petals);
    const petal = group(roll, `${name}-petal-${label}`, [0, hingeRadius, 0]),
      k = detailKit(petal, `${petal.name}-skin`);
    const halfRoot = (hingeRadius * share) / 2,
      halfTip = (openRadius * share) / 2,
      contour = [
        [-halfRoot, 0, 0],
        [halfRoot, 0, 0],
        [halfTip, rise, -length],
        ...(point > 0 ? [tip.clone().addScaledVector(along, point).toArray()] : []),
        [-halfTip, rise, -length],
      ];
    sheet(k, contour, material, outward.toArray());
    for (const rod of rods) {
      const at = (f) =>
        along
          .clone()
          .multiplyScalar(f * reach)
          .addScaledVector(outward, rod.lift + rod.radius)
          .toArray();
      k.rod(at(rod.from), at(rod.to), rod.radius, material);
    }
    k.finish();
    bindings.push({
      node: petal.name,
      source: `engines.${engine}.nozzle`,
      property: 'rotation',
      axis: 'x',
      keys: [
        [0, round(closing)],
        [1, 0],
      ],
    });
  }
  const exhaust = (root) => {
    root.updateMatrixWorld(true);
    const toRoot = root.matrixWorld.clone().invert(),
      position = frame.localToWorld(new T.Vector3(0, 0, -length)).applyMatrix4(toRoot),
      direction = aft.clone().transformDirection(toRoot.multiply(parent.matrixWorld)).normalize();
    return {
      engine,
      position: position.toArray().map(round),
      radius: round(openRadius),
      closedRadius: round(closedRadius),
      ...(Math.abs(direction.z + 1) > 1e-4 ? { direction: direction.toArray().map(round) } : {}),
    };
  };
  return { bindings, exhaust };
}
