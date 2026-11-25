// How a vehicle's own pedals stand in the console. Models build their pads every way (upright
// plates, a slight lean, boards lying flat, a tube on an arm), and the console sees them from
// above and enlarged, where an upright pad's nearer top edge reads as leaning at the viewer. So
// the copies all stand as real pedals do, tops leaning away.

import * as THREE from 'three';
import { PEDAL_LEAN } from './camera';

/**
 * Share of a pedal's surface its broad face and back must hold to be a pad and not a tube: the
 * catalog's pads hold 0.43 or more, its tubes 0.22 or less.
 */
const PAD_SHARE = 0.33;

/**
 * How far forward of upright a pedal's top leans, radians, in world axes (+Z forward, +Y up): by
 * its pad's broad face, or without one (a tube across an arm) by the line of its arm. World
 * matrices must be current.
 */
export function pedalLean(pedal: THREE.Object3D): number {
  // Area of the faces near each lean, a face and its back together; and, for a tube, the sums
  // that give the line the surface stretches along in the fore-aft plane.
  const faces: { lean: number; area: number }[] = [];
  let total = 0;
  const sum = { y: 0, z: 0, yy: 0, zz: 0, yz: 0 };
  const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const normal = new THREE.Vector3();
  pedal.traverse((node) => {
    const mesh = node as THREE.Mesh;
    const position = mesh.isMesh ? mesh.geometry.getAttribute('position') : undefined;
    if (!position) return;
    const index = mesh.geometry.index;
    const count = index?.count ?? position.count;
    const read = (out: THREE.Vector3, at: number): THREE.Vector3 =>
      out.fromBufferAttribute(position, index ? index.getX(at) : at).applyMatrix4(mesh.matrixWorld);
    for (let i = 0; i + 2 < count; i += 3) {
      read(a, i);
      read(b, i + 1);
      read(c, i + 2);
      const y = (a.y + b.y + c.y) / 3;
      const z = (a.z + b.z + c.z) / 3;
      normal.subVectors(b, a).cross(c.sub(a));
      const area = normal.length() / 2;
      if (area < 1e-10) continue;
      total += area;
      sum.y += y * area;
      sum.z += z * area;
      sum.yy += y * y * area;
      sum.zz += z * z * area;
      sum.yz += y * z * area;
      // A face across the pedal (not its sides): the lean of the pad it would be the front of.
      if (Math.abs(normal.x) > normal.length() * 0.5) continue;
      const lean = fold(Math.atan2(normal.y, -normal.z));
      const near = faces.find((face) => Math.abs(fold(face.lean - lean)) < 0.05);
      if (near) near.area += area;
      else faces.push({ lean, area });
    }
  });
  if (total === 0) return 0;
  const broad = faces.reduce((most, face) => (face.area > most.area ? face : most), {
    lean: 0,
    area: 0,
  });
  if (broad.area >= total * PAD_SHARE) return broad.lean;
  const yy = sum.yy / total - (sum.y / total) ** 2;
  const zz = sum.zz / total - (sum.z / total) ** 2;
  const yz = sum.yz / total - (sum.y / total) * (sum.z / total);
  return Math.atan2(2 * yz, yy - zz) / 2;
}

/**
 * The lean of a face or its back as one lean, within a quarter turn of `PEDAL_LEAN`: from a pad
 * leaning toward the viewer, through upright (0) and a board lying flat with its tread up (a
 * quarter turn), to one past flat. Turning a pad to `PEDAL_LEAN` then never shows its underside.
 */
function fold(angle: number): number {
  return angle - Math.PI * Math.ceil((angle - PEDAL_LEAN) / Math.PI - 0.5);
}

/**
 * Turn each lifted pedal under `root` (`liftControls`, before its copies are bound; its axes are
 * the world's) about its middle so its top leans away by `PEDAL_LEAN`.
 */
export function leanPedals(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  for (const proxy of root.children)
    for (const pedal of proxy.children) {
      const box = new THREE.Box3().setFromObject(pedal, true);
      if (box.isEmpty()) continue;
      const middle = box.getCenter(new THREE.Vector3());
      const turn = new THREE.Matrix4()
        .makeTranslation(middle)
        .multiply(new THREE.Matrix4().makeRotationX(PEDAL_LEAN - pedalLean(pedal)))
        .multiply(new THREE.Matrix4().makeTranslation(middle.clone().negate()));
      turn.multiply(pedal.matrixWorld).premultiply(proxy.matrixWorld.clone().invert());
      turn.decompose(pedal.position, pedal.quaternion, pedal.scale);
    }
}
