import * as THREE from 'three';

/**
 * Blades turn faster than a display can sample them. A C182 at 2400 rpm moves 240 degrees between
 * 60 Hz frames, exactly two blade spacings of its three-blade propeller, so drawn blades look
 * stopped at full power. An eye sees a faint disc instead, so draw one: below these speeds the
 * blades stay crisp, and between them the blades cross-fade into the disc. In radians per second,
 * about 20 and 45 degrees per frame at 60 Hz.
 */
const BLUR_START = 35;
const BLUR_FULL = 78;
const DISC_OPACITY = 0.09;
const TIP_OPACITY = 0.14;
/** A mesh reaching past this share of the radius is a blade; anything shorter is hub or spinner. */
const HUB_SHARE = 0.4;

export interface RotorBlur {
  /** Absolute shaft speed of this rotor, in radians per second. */
  update(angularSpeed: number): void;
}

const ACROSS = { x: [1, 2], y: [0, 2], z: [0, 1] } as const;
const ALONG = { x: 0, y: 1, z: 2 } as const;

/**
 * Prepares one rotor node. It reads the blades' real extent from the model, so nothing in the spec
 * needs a radius or blade count. Returns undefined for a node with no geometry. The disc and the
 * cloned blade materials join the model, so the visual's dispose releases them.
 */
export function createRotorBlur(
  node: THREE.Object3D,
  axis: keyof typeof ACROSS,
): RotorBlur | undefined {
  node.updateWorldMatrix(true, true);
  const toNode = node.matrixWorld.clone().invert();
  const [u, v] = ACROSS[axis];
  const along = ALONG[axis];
  const reach = new Map<THREE.Mesh, number>();
  const point = new THREE.Vector3();
  let radius = 0;
  let plane = 0;
  let vertices = 0;
  node.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.getAttribute('position');
    if (position === undefined) return;
    const toRotor = toNode.clone().multiply(object.matrixWorld);
    let furthest = 0;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(toRotor);
      furthest = Math.max(furthest, Math.hypot(point.getComponent(u), point.getComponent(v)));
    }
    reach.set(object, furthest);
    radius = Math.max(radius, furthest);
  });
  if (radius === 0) return undefined;
  const blades: THREE.Material[] = [];
  const copies = new Map<THREE.Material, THREE.Material>();
  for (const [mesh, furthest] of reach) {
    if (furthest < radius * HUB_SHARE || Array.isArray(mesh.material)) continue;
    // Materials are shared across the airframe, so fade a private copy of the blades' own.
    const original = mesh.material as THREE.Material;
    let copy = copies.get(original);
    if (copy === undefined) {
      copy = original.clone();
      copy.transparent = true;
      copies.set(original, copy);
      blades.push(copy);
    }
    mesh.material = copy;
    const position = mesh.geometry.getAttribute('position');
    const toRotor = toNode.clone().multiply(mesh.matrixWorld);
    for (let i = 0; i < position.count; i++) {
      plane += point.fromBufferAttribute(position, i).applyMatrix4(toRotor).getComponent(along);
      vertices++;
    }
  }
  const height = vertices === 0 ? 0 : plane / vertices;
  const ring = (inner: number, outer: number): THREE.Mesh<THREE.BufferGeometry, THREE.Material> => {
    const geometry = new THREE.RingGeometry(inner, outer, 48);
    if (axis === 'x') geometry.rotateY(Math.PI / 2);
    if (axis === 'y') geometry.rotateX(Math.PI / 2);
    const disc = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0x34383c,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    disc.position.setComponent(along, height);
    disc.visible = false;
    disc.castShadow = false;
    disc.receiveShadow = false;
    disc.userData.vehicleGeometry = true;
    node.add(disc);
    return disc;
  };
  const disc = ring(radius * 0.12, radius * 0.94);
  const tip = ring(radius * 0.94, radius);
  return {
    update(angularSpeed) {
      const t = THREE.MathUtils.clamp(
        (Math.abs(angularSpeed) - BLUR_START) / (BLUR_FULL - BLUR_START),
        0,
        1,
      );
      const blur = t * t * (3 - 2 * t);
      for (const material of blades) {
        material.opacity = 1 - blur;
        material.depthWrite = blur < 0.5;
      }
      for (const [mesh, opacity] of [
        [disc, DISC_OPACITY],
        [tip, TIP_OPACITY],
      ] as const) {
        mesh.visible = blur > 0;
        mesh.material.opacity = opacity * blur;
      }
      // Fully faded blades are skipped outright, so a frozen ghost cannot show through the disc.
      for (const mesh of reach.keys())
        if (blades.includes(mesh.material as THREE.Material)) mesh.visible = blur < 1;
    },
  };
}
