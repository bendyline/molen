import {
  type AircraftSpec,
  type AircraftStateData,
  aircraftGearLayout,
} from '@bendyline/molen-schema';
import * as THREE from 'three';

/**
 * Landing gear drawn on its struts. The flight model stands an aircraft on legs with springs and
 * reports how far the ground holds each strut closed (`aircraftState.wheels.travel`): the
 * airframe sinks onto its gear at touchdown and under braking, and rides up on it as the wing
 * takes the weight. A model's gear is rigid, so without this its tires sink into the runway by
 * that travel and hang short of full extension in flight. Each leg found in the model is slid
 * along the airframe's up axis to keep its tire where the ground is.
 */
export interface AircraftGearVisual {
  /** The legs found in the model: their nodes and where each tire stands, in model coordinates. */
  readonly legs: readonly { node: THREE.Object3D; x: number; z: number }[];
  /**
   * Take the travel last applied back out of the leg nodes. Call before anything else poses them
   * (the spec's animation bindings write some legs' positions as they retract).
   */
  release(): void;
  /**
   * Slide the legs to the travel `state` reports. `gear` is the gear position, 0 up to 1 down and
   * locked: the struts reach their full extension as the legs lock down, and are back at their
   * authored length, which is what fits the wells, before they leave it.
   */
  update(state: Pick<AircraftStateData, 'wheels'>, gear: number): void;
}

/** Names a leg's node carries in the catalog's models: `gear-0`, `F16-gear-1-hinge`, `tail-wheel`. */
const LEG_NAME = /gear|wheel|bogie/i;
/** A leg's tire stands on the ground the model's origin is on: within this of it, m. */
const ON_GROUND = 0.12;
/** The part of a leg within this of its lowest point is its tire, m. */
const TIRE_BAND = 0.1;
/**
 * A leg is drawn closed this many times its strut's travel and no further: the flight model's
 * stop is a stiff spring, not a wall, and a nose leg under hard braking goes some way past it.
 */
const DRAWN_STOP = 2;

interface Leg {
  node: THREE.Object3D;
  x: number;
  z: number;
  /** The model's up axis in the frame of the node's parent, per meter. */
  up: THREE.Vector3;
  applied: THREE.Vector3;
}

const vertex = new THREE.Vector3();

/**
 * Bounds of a node's meshes in the model's frame, from their vertices: a raked leg's own box,
 * turned into the model's frame, reaches well below its tire. `below` keeps only the meshes
 * that reach under that height.
 */
function boundsIn(
  node: THREE.Object3D,
  toModel: THREE.Matrix4,
  below = Number.POSITIVE_INFINITY,
): THREE.Box3 | undefined {
  const bounds = new THREE.Box3();
  const local = new THREE.Matrix4();
  const part = new THREE.Box3();
  node.traverse((object) => {
    const mesh = object as THREE.Mesh;
    const position = mesh.isMesh ? mesh.geometry?.getAttribute('position') : undefined;
    if (position === undefined) return;
    local.multiplyMatrices(toModel, mesh.matrixWorld);
    part.makeEmpty();
    for (let i = 0; i < position.count; i++)
      part.expandByPoint(vertex.fromBufferAttribute(position, i).applyMatrix4(local));
    if (!part.isEmpty() && part.min.y <= below) bounds.union(part);
  });
  return bounds.isEmpty() ? undefined : bounds;
}

/**
 * The gear legs of a loaded aircraft model, standing as authored (gear down): the outermost
 * nodes named as gear whose geometry reaches the ground the model stands on and is no larger
 * than a leg. `skip` holds nodes whose subtrees are not searched (the cabin: a control wheel is
 * not a wheel). Gear that is part of the shell's own mesh, as on most fixed-gear light
 * aircraft, has no node to find, and skids are left alone: they bend, they do not slide.
 */
export function aircraftGearLegs(
  model: THREE.Object3D,
  spec: Pick<AircraftSpec, 'length' | 'span'>,
  skip: ReadonlySet<THREE.Object3D> = new Set(),
): { node: THREE.Object3D; x: number; z: number }[] {
  model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const widest = 0.35 * Math.max(spec.length, spec.span);
  const legs: { node: THREE.Object3D; x: number; z: number }[] = [];
  const size = new THREE.Vector3();
  const visit = (node: THREE.Object3D): void => {
    if (skip.has(node)) return;
    if (node !== model && LEG_NAME.test(node.name)) {
      const bounds = boundsIn(node, toModel);
      if (bounds !== undefined && bounds.min.y <= ON_GROUND && bounds.min.y >= -ON_GROUND) {
        bounds.getSize(size);
        if (size.x <= widest && size.z <= widest) {
          // Where it stands: the middle of its tire, the part nearest the ground.
          const tire = boundsIn(node, toModel, bounds.min.y + TIRE_BAND) ?? bounds;
          legs.push({
            node,
            x: (tire.min.x + tire.max.x) / 2,
            z: (tire.min.z + tire.max.z) / 2,
          });
          return;
        }
      }
    }
    for (const child of node.children) visit(child);
  };
  visit(model);
  return legs;
}

/**
 * The plane `t = a + b x + c z` nearest the given points, by least squares: exact through three
 * legs, the best fit through four. Points in a line (or fewer than three) give their mean.
 */
function planeThrough(
  points: readonly { x: number; z: number; t: number }[],
): [number, number, number] {
  const n = points.length;
  let sx = 0;
  let sz = 0;
  let st = 0;
  for (const p of points) {
    sx += p.x;
    sz += p.z;
    st += p.t;
  }
  if (n === 0) return [0, 0, 0];
  const mx = sx / n;
  const mz = sz / n;
  const mt = st / n;
  let xx = 0;
  let xz = 0;
  let zz = 0;
  let xt = 0;
  let zt = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dz = p.z - mz;
    xx += dx * dx;
    xz += dx * dz;
    zz += dz * dz;
    xt += dx * (p.t - mt);
    zt += dz * (p.t - mt);
  }
  const determinant = xx * zz - xz * xz;
  if (!(Math.abs(determinant) > 1e-9 * (xx + zz) * (xx + zz)) || determinant === 0)
    return [mt, 0, 0];
  const b = (xt * zz - zt * xz) / determinant;
  const c = (zt * xx - xt * xz) / determinant;
  return [mt - b * mx - c * mz, b, c];
}

/**
 * Bind a loaded aircraft model's gear legs to the strut travel its state reports. Returns
 * undefined for a model with no legs to move. `skip` is as for `aircraftGearLegs`.
 */
export function createAircraftGearVisual(
  model: THREE.Object3D,
  spec: AircraftSpec,
  skip?: ReadonlySet<THREE.Object3D>,
): AircraftGearVisual | undefined {
  const found = aircraftGearLegs(model, spec, skip);
  if (found.length === 0) return undefined;
  const layout = aircraftGearLayout(spec);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const legs: Leg[] = found.map(({ node, x, z }) => {
    const parent = new THREE.Matrix4().multiplyMatrices(
      toModel,
      node.parent?.matrixWorld ?? model.matrixWorld,
    );
    return {
      node,
      x,
      z,
      up: new THREE.Vector3(0, 1, 0).applyMatrix3(
        new THREE.Matrix3().setFromMatrix4(parent.invert()),
      ),
      applied: new THREE.Vector3(),
    };
  });
  // Where the flight model's own legs stand, in model coordinates: the plane through their
  // travel says how far the ground is from the airframe anywhere under it.
  const stands = layout.legs.map((leg) => ({
    x: leg.x + spec.centerOfMass[0],
    z: leg.z + spec.centerOfMass[2],
    t: 0,
  }));
  // Whether a state has ever reported travel: a host that never does leaves the gear as authored.
  let sprung = false;
  return {
    legs: found,
    release() {
      for (const leg of legs) {
        leg.node.position.sub(leg.applied);
        leg.applied.set(0, 0, 0);
      }
    },
    update(state, gear) {
      const travel = state.wheels?.travel;
      let plane: [number, number, number] | undefined;
      if (
        travel !== undefined &&
        travel.length === stands.length &&
        travel.every((value) => Number.isFinite(value))
      ) {
        for (const [i, stand] of stands.entries()) stand.t = travel[i] ?? 0;
        plane = planeThrough(stands);
        sprung = true;
      }
      // In transit the legs carry no travel of their own: the struts run out to their reach
      // over the last of the way down, and are in by the time the legs start up.
      const down = Math.min(1, Math.max(0, (gear - 0.8) / 0.2));
      const hanging = sprung && gear < 1 ? -layout.reach * down * down * (3 - 2 * down) : 0;
      for (const leg of legs) {
        const lift =
          plane === undefined
            ? hanging
            : Math.min(
                DRAWN_STOP * layout.travel,
                Math.max(-layout.reach, plane[0] + plane[1] * leg.x + plane[2] * leg.z),
              );
        leg.applied.copy(leg.up).multiplyScalar(lift);
        leg.node.position.add(leg.applied);
      }
    },
  };
}
