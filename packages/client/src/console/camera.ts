// Cameras for the vehicle console's parts: each part is a small scene of its own, seen from where
// its operator sees it and fitted to the rectangle it is drawn in.

import * as THREE from 'three';
import type { ModelSignals } from '../model-signals';

/** Bounds of `root` over every pose in `samples` (its swept volume), in its own scene's frame. */
export function sweptBounds(
  root: THREE.Object3D,
  pose: (signals: ModelSignals) => void,
  samples: readonly ModelSignals[],
): THREE.Box3 {
  const box = new THREE.Box3();
  for (const signals of samples.length > 0 ? samples : [{}]) {
    pose(signals);
    root.updateMatrixWorld(true);
    box.union(new THREE.Box3().setFromObject(root, true));
  }
  return box;
}

/** Where a part's camera stands: `direction` from the part toward the camera, and its up. */
export interface ConsoleView {
  direction: THREE.Vector3;
  up?: THREE.Vector3;
  /** Vertical field of view in degrees (default 24): narrow, close to a drawing's projection. */
  fov?: number;
  /** Room left around the swept part (default 1.06: 6%). */
  margin?: number;
  /** Toward the key light, as right, up and back of the view (default above and to the left). */
  key?: readonly [right: number, up: number, back: number];
}

/**
 * A camera looking at `box` along `view.direction`, its projection centered and fitted to a
 * rectangle of `aspect` (width / height).
 */
export function fitCamera(
  box: THREE.Box3,
  view: ConsoleView,
  aspect: number,
): THREE.PerspectiveCamera {
  const fov = view.fov ?? 24;
  const margin = view.margin ?? 1.06;
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.002, 20);
  camera.up.copy(view.up ?? new THREE.Vector3(0, 1, 0));
  const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  const direction = view.direction.clone().normalize();
  camera.position.copy(center).addScaledVector(direction, 5);
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const corner = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    corner
      .set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      )
      .applyMatrix4(camera.matrixWorldInverse);
    min.min(corner);
    max.max(corner);
  }
  const halfW = Math.max(1e-4, ((max.x - min.x) / 2) * margin);
  const halfH = Math.max(1e-4, ((max.y - min.y) / 2) * margin);
  const halfD = Math.max(1e-4, (max.z - min.z) / 2);
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const distance = Math.max(halfH / tanV, halfW / (tanV * aspect)) + halfD;
  // Center the swept box's projection, not its 3D center.
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const target = center
    .clone()
    .addScaledVector(right, (max.x + min.x) / 2)
    .addScaledVector(up, (max.y + min.y) / 2);
  camera.position.copy(target).addScaledVector(direction, distance);
  camera.lookAt(target);
  camera.near = Math.max(0.001, distance - halfD * 3);
  camera.far = distance + halfD * 3 + 0.1;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * The view from the operator's side of a control, in cockpit axes (+Z forward, +Y up, +X the
 * pilot's left): from behind, `elevation` radians up, turned `azimuth` radians toward +X (the
 * console uses `DECK_AZIMUTH`, none); `mirror` turns it the other way, for a deck on the left.
 */
export function deckView(azimuth: number, elevation: number, mirror = false): ConsoleView {
  const side = mirror ? -1 : 1;
  return {
    direction: new THREE.Vector3(
      side * Math.sin(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      -Math.cos(azimuth) * Math.cos(elevation),
    ),
  };
}

/**
 * Azimuth and elevation of the deck view: head-on from the operator's seat, as the owner asked
 * (no turn to the side), from far enough above that a lever's travel shows.
 */
export const DECK_AZIMUTH = 0;
export const DECK_ELEVATION: number = THREE.MathUtils.degToRad(28);

/** From the seat behind a stick, yoke or cyclic, a little to the side and well above. */
export const SEAT_VIEW: ConsoleView = { direction: new THREE.Vector3(-0.12, 0.62, -0.78) };
/**
 * Pedals from the seat, 17 degrees above, near enough that their pads narrow going away. The key
 * light is centered overhead: from a side it catches one metal pad of a pair more than the other.
 */
export const PEDAL_VIEW: ConsoleView = {
  direction: new THREE.Vector3(0, 0.3, -1),
  fov: 34,
  margin: 1.08,
  key: [0, 1.6, 0.4],
};
/**
 * How far forward of upright the top of every pedal leans, radians: away from the viewer. It must
 * be well over the angle `PEDAL_VIEW` looks down at, or a pad's top edge is the nearer one and it
 * reads as leaning toward the viewer.
 */
export const PEDAL_LEAN: number = THREE.MathUtils.degToRad(33);
/** A steering wheel or helm from the driver's seat, nearly square-on. */
export const WHEEL_VIEW: ConsoleView = { direction: new THREE.Vector3(0, 0.32, -1), margin: 1.08 };
/** Handlebars from above and behind the rider. */
export const HANDLEBAR_VIEW: ConsoleView = { direction: new THREE.Vector3(0, 0.8, -0.6) };
