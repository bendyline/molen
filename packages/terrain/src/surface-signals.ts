/** Instanced, self-lit signal lenses. Placement stays data-only for the surface worker. */
import * as THREE from 'three';

export type TerrainTrafficSignalColor = 'red' | 'amber' | 'green';

/** World-space junction and outward approach direction, shared by heads on that approach. */
export interface TerrainTrafficSignal {
  junction: readonly [number, number];
  direction: readonly [number, number];
  radius: number;
}

/** Return the simulation's colour, or undefined to use the decorative deterministic cycle. */
export type TerrainTrafficSignalResolver = (
  signal: TerrainTrafficSignal,
) => TerrainTrafficSignalColor | undefined;

export interface TerrainSignalHead extends TerrainTrafficSignal {
  x: number;
  y: number;
  z: number;
  yaw: number;
  group: number;
  groups: number;
  offset: number;
}

const LENS = new THREE.CircleGeometry(0.16, 16);
const DARK = new THREE.MeshStandardMaterial({ roughness: 0.78 });
// An illuminated lens remains bright with no sun/ambient light. Basic material works on both
// graphics backends and keeps all illuminated lenses in one instanced draw per tile.
const LIT = new THREE.MeshBasicMaterial({ toneMapped: false });
const COLORS = [new THREE.Color('#ff3425'), new THREE.Color('#ffbd18'), new THREE.Color('#21f581')];
const OFF = COLORS.map((color) => color.clone().multiplyScalar(0.035));
const STATES = new WeakMap<THREE.Object3D, TerrainTrafficSignalColor[]>();

function lensMatrix(head: TerrainSignalHead, lens: number, front: number): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(
      head.x + Math.sin(head.yaw) * front,
      head.y + 0.38 - lens * 0.38,
      head.z + Math.cos(head.yaw) * front,
    ),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), head.yaw),
    new THREE.Vector3(1, 1, 1),
  );
}

/** Two shared draws per tile: all unlit lenses, then one illuminated lens per head. */
export function appendTerrainSignalLenses(
  object: THREE.Group,
  heads: readonly TerrainSignalHead[],
): void {
  object.userData.trafficSignalHeads = heads;
  if (!heads.length) return;
  const dark = new THREE.InstancedMesh(LENS, DARK, heads.length * 3);
  dark.name = 'surface:signal-lenses';
  const lit = new THREE.InstancedMesh(LENS, LIT, heads.length);
  lit.name = 'surface:signal-lit';
  lit.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (const [i, head] of heads.entries())
    for (let lens = 0; lens < 3; lens++) {
      dark.setMatrixAt(i * 3 + lens, lensMatrix(head, lens, 0.205));
      dark.setColorAt(i * 3 + lens, OFF[lens] as THREE.Color);
    }
  dark.userData.terrainOwnedInstances = true;
  lit.userData.terrainOwnedInstances = true;
  object.add(dark, lit);
  updateTerrainSurfaceSignals(object, 0);
  dark.computeBoundingSphere();
}

/** Advance a direct/static surface object with an absolute time in seconds. */
export function updateTerrainSurfaceSignals(
  object: THREE.Object3D,
  elapsedSeconds: number,
  resolve?: TerrainTrafficSignalResolver,
): void {
  if (!Number.isFinite(elapsedSeconds)) throw new Error('Signal time must be finite');
  const heads = object.userData.trafficSignalHeads as TerrainSignalHead[] | undefined;
  if (!heads?.length) return;
  const lit = object.getObjectByName('surface:signal-lit') as THREE.InstancedMesh;
  const previous = STATES.get(object) ?? [];
  let changed = false;
  for (const [i, head] of heads.entries()) {
    // 24 s green, 3 s amber, 2 s all-red clearance; opposite approaches share a group.
    const cycle = head.groups * 29;
    const time = (((elapsedSeconds + head.offset) % cycle) + cycle) % cycle;
    const phase = Math.floor(time / 29);
    const within = time % 29;
    const color =
      resolve?.(head) ??
      (phase !== head.group || within >= 27 ? 'red' : within < 24 ? 'green' : 'amber');
    if (previous[i] === color) continue;
    previous[i] = color;
    const lens = color === 'red' ? 0 : color === 'amber' ? 1 : 2;
    lit.setMatrixAt(i, lensMatrix(head, lens, 0.212));
    lit.setColorAt(i, COLORS[lens] as THREE.Color);
    changed = true;
  }
  STATES.set(object, previous);
  if (changed) {
    lit.instanceMatrix.needsUpdate = true;
    if (lit.instanceColor) lit.instanceColor.needsUpdate = true;
    // A colour change moves the active lens; refresh its bounds at the same low frequency.
    lit.computeBoundingSphere();
  }
}
