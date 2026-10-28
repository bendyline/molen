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
}

const HEAD = new THREE.BoxGeometry(0.48, 0.12, 0.85);
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
        new THREE.Vector3(1, 1, 1),
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

/** Updates emission only; tile geometry and street-detail distance culling stay intact. */
export function updateTerrainStreetLights(object: THREE.Object3D, factor: number): void {
  if (!Number.isFinite(factor)) throw new Error('Night factor must be finite');
  const night = Math.max(0, Math.min(1, factor));
  for (const child of object.children) {
    if (!child.name.startsWith('surface:night-')) continue;
    const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
    material.opacity = night * (child.name === 'surface:night-pools' ? 0.38 : 1);
    material.visible = night > 0;
  }
}
