/** Batched streetlamp emitters and terrain-draped light pools, shared by both backends. */
import * as THREE from 'three';
import type { TerrainPyramidTileLayerContext } from './pyramid-stream';

/** Tile-local luminaire position and its pavement receiver height above the terrain. */
export interface TerrainStreetLight {
  x: number;
  y: number;
  z: number;
  yaw: number;
  groundLift: number;
  /** A post-top lantern (glowing all round), not a mast arm's downward lens. */
  post?: boolean;
}

const HEAD = new THREE.BoxGeometry(0.48, 0.12, 0.85);
/** The lens box stretched round a post-top lantern: just proud of its 0.38 m glass. */
const POST_HEAD_SCALE = new THREE.Vector3(0.42 / 0.48, 0.46 / 0.12, 0.42 / 0.85);
const UNIT_SCALE = new THREE.Vector3(1, 1, 1);
const LIGHT_COLOR = '#ffe1a1';

/** No point lights: two draws per tile, bounded by the surface fixture budget. */
export function appendTerrainStreetLights(
  group: THREE.Group,
  lights: readonly TerrainStreetLight[],
  context: TerrainPyramidTileLayerContext,
): void {
  group.userData.streetLights = lights;
  if (!lights.length) return;
  const headMaterial = new THREE.MeshBasicMaterial({
    color: LIGHT_COLOR,
    transparent: true,
    depthWrite: false,
    opacity: 0,
  });
  const heads = new THREE.InstancedMesh(HEAD, headMaterial, lights.length);
  heads.name = 'surface:night-lamps';
  heads.userData.terrainOwnedInstances = true;
  heads.userData.terrainOwnedMaterial = true;
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const tint = new THREE.Color(LIGHT_COLOR);
  const rotation = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  for (const [i, light] of lights.entries()) {
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), light.yaw);
    heads.setMatrixAt(
      i,
      matrix.compose(
        new THREE.Vector3(light.x, light.y, light.z),
        rotation,
        light.post ? POST_HEAD_SCALE : UNIT_SCALE,
      ),
    );
    // Several rings, sampled separately, keep the pool soft and seated on sloping roads.
    const start = positions.length / 3;
    for (const radius of [0, 0.3, 0.65, 1]) {
      const strength = (1 - radius * radius) ** 2;
      for (let sector = 0; sector < 16; sector++) {
        const angle = (sector * Math.PI) / 8;
        const x = light.x + Math.cos(angle) * radius * 9;
        const z = light.z + Math.sin(angle) * radius * 9;
        const y =
          context.heightfield.sampleHeight(context.origin[0] + x, context.origin[1] + z) +
          light.groundLift;
        positions.push(x, y, z);
        colors.push(tint.r * strength, tint.g * strength, tint.b * strength);
      }
    }
    for (let ring = 0; ring < 3; ring++)
      for (let sector = 0; sector < 16; sector++) {
        const a = start + ring * 16 + sector;
        const b = start + ring * 16 + ((sector + 1) % 16);
        indices.push(a, b + 16, b, a, a + 16, b + 16);
      }
  }
  heads.computeBoundingSphere();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  const poolMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    opacity: 0,
  });
  const pools = new THREE.Mesh(geometry, poolMaterial);
  pools.name = 'surface:night-pools';
  pools.userData.terrainOwnedGeometry = true;
  pools.userData.terrainOwnedMaterial = true;
  for (const mesh of [heads, pools]) {
    mesh.userData.walkIgnore = true;
    mesh.userData.shadowCaster = false;
    mesh.material.visible = false;
    group.add(mesh);
  }
}

/**
 * Sign faces that light up after dark, and how strongly. Street names read as lit panels; the
 * other boards as retroreflective faces caught by lamps and headlights. Blank backs never glow.
 */
const SIGN_GLOW: Readonly<Record<string, number>> = {
  'surface:street-names': 0.85,
  'surface:road-signs': 0.6,
};

/**
 * Night overlays for a surface tile's lettered sign faces: each shares its face mesh's geometry
 * (no copy) and draws it unlit, fading in with the night factor like the lamps. Call after the
 * face meshes are in `group`, on direct and worker-built tiles alike.
 */
export function appendTerrainSignGlow(group: THREE.Object3D): void {
  for (const [name, strength] of Object.entries(SIGN_GLOW)) {
    const faces = group.children.find((child) => child.name === name) as THREE.Mesh | undefined;
    if (!faces?.isMesh) continue;
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      opacity: 0,
      // Coplanar with the lit faces: pull forward so the overlay wins the depth test.
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
    });
    material.visible = false;
    const glow = new THREE.Mesh(faces.geometry, material);
    glow.name = `surface:night-${name.slice('surface:'.length)}`;
    // The face mesh owns (and disposes) the shared geometry.
    glow.userData.terrainOwnedMaterial = true;
    glow.userData.nightStrength = strength;
    glow.userData.walkIgnore = true;
    glow.userData.shadowCaster = false;
    group.add(glow);
  }
}

/** Updates emission only; tile geometry and street-detail distance culling stay intact. */
export function updateTerrainStreetLights(object: THREE.Object3D, factor: number): void {
  if (!Number.isFinite(factor)) throw new Error('Night factor must be finite');
  const night = Math.max(0, Math.min(1, factor));
  for (const child of object.children) {
    if (!child.name.startsWith('surface:night-')) continue;
    const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const strength =
      child.name === 'surface:night-pools'
        ? 0.38
        : ((child.userData.nightStrength as number | undefined) ?? 1);
    material.opacity = night * strength;
    material.visible = night > 0;
  }
}
