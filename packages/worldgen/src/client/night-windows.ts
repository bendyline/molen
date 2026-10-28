/** Night emission over actual glass faces; no extra lights or per-frame geometry work. */
import * as THREE from 'three';

/** glTF material extras.molenNightLight. Separate disconnected panes get independent occupancy. */
export interface ModelNightLight {
  kind: 'window' | 'lamp';
  /** Fraction of panes lit, 0..1 (windows 0.55, lamps 1). */
  occupancy?: number;
  /** sRGB light colour; omitted windows vary between warm and neutral white. */
  color?: string;
}

export interface NightWindowRange {
  start: number;
  count: number;
  light?: ModelNightLight;
}

const COLORS = ['#ffd28c', '#ffe4b0', '#fff0d0', '#dce8ff'].map((c) => new THREE.Color(c));

function hash(value: number): number {
  let h = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * One shared emission material per view. The generated overlay owns compact geometry, borrows
 * this material, follows the parent mesh's transforms/LOD and is absent from daytime draws.
 */
export class NightWindowLighting {
  readonly material: THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    opacity: 0,
    visible: false,
  });

  setNightFactor(factor: number): void {
    if (!Number.isFinite(factor)) throw new Error('Night factor must be finite');
    this.material.opacity = Math.max(0, Math.min(1, factor));
    this.material.visible = this.material.opacity > 0;
  }

  /** Indices are source ranges, before material batching reorders them. */
  createGeometry(
    source: THREE.BufferGeometry,
    ranges: readonly NightWindowRange[],
  ): THREE.BufferGeometry | undefined {
    const position = source.getAttribute('position');
    if (!position) return undefined;
    const indexAt = (i: number): number => source.index?.getX(i) ?? i;
    const positions: number[] = [],
      colors: number[] = [],
      indices: number[] = [];
    for (const range of ranges) {
      const light = range.light;
      const occupancy = light?.occupancy ?? (light?.kind === 'lamp' ? 1 : 0.55);
      if (!Number.isFinite(occupancy) || occupancy <= 0) continue;
      // Connectivity keeps the two triangles of a pane in the same room. Welding positions
      // also supports exported non-indexed glass. Only vertices in marked ranges participate.
      const parent = new Map<number, number>();
      const welded = new Map<string, number>();
      const root = (v: number): number => {
        let p = parent.get(v) ?? v;
        while (p !== (parent.get(p) ?? p)) p = parent.get(p) as number;
        let next = v;
        while (next !== p) {
          const old = parent.get(next) ?? p;
          parent.set(next, p);
          next = old;
        }
        return p;
      };
      const join = (a: number, b: number): void => {
        parent.set(root(b), root(a));
      };
      for (let i = range.start; i < range.start + range.count; i += 3) {
        const a = indexAt(i);
        for (let j = 0; j < 3; j++) {
          const v = indexAt(i + j);
          if (!parent.has(v)) {
            parent.set(v, v);
            const key = `${position.getX(v)},${position.getY(v)},${position.getZ(v)}`;
            const same = welded.get(key);
            if (same !== undefined) join(same, v);
            else welded.set(key, v);
          }
          join(a, v);
        }
      }
      const panes = new Map<number, number[]>();
      for (const v of parent.keys()) {
        const r = root(v);
        const vertices = panes.get(r) ?? [];
        vertices.push(v);
        panes.set(r, vertices);
      }
      const remap = new Map<number, number>();
      for (const vertices of panes.values()) {
        // Index identity is independent of floating origin and of daytime material upgrades.
        const seed = vertices.reduce((min, v) => Math.min(min, v), Infinity) + range.start * 31;
        const random = hash(seed + 17);
        if (random >= Math.min(1, occupancy)) continue;
        const color = light?.color
          ? new THREE.Color(light.color)
          : (COLORS[Math.floor(hash(seed + 91) * COLORS.length)] as THREE.Color);
        const intensity = 0.6 + hash(seed + 197) * 0.65;
        for (const v of vertices) {
          remap.set(v, positions.length / 3);
          positions.push(position.getX(v), position.getY(v), position.getZ(v));
          colors.push(color.r * intensity, color.g * intensity, color.b * intensity);
        }
      }
      for (let i = range.start; i < range.start + range.count; i += 3) {
        const a = remap.get(indexAt(i)),
          b = remap.get(indexAt(i + 1)),
          c = remap.get(indexAt(i + 2));
        if (a !== undefined && b !== undefined && c !== undefined) indices.push(a, b, c);
      }
    }
    if (!indices.length) return undefined;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
  }

  mesh(geometry: THREE.BufferGeometry): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.name = 'worldgen:night-windows';
    mesh.userData.worldgenOwnedGeometry = true;
    mesh.userData.walkIgnore = true;
    mesh.userData.shadowCaster = false;
    return mesh;
  }

  /** Attach before replacing glTF shared surfaces, so source material extras are still present. */
  attachModel(scene: THREE.Object3D): void {
    const meshes: THREE.Mesh[] = [];
    scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh);
    });
    for (const mesh of meshes) {
      if ((mesh as THREE.InstancedMesh).isInstancedMesh || mesh.name === 'worldgen:night-windows')
        continue;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const groups = mesh.geometry.groups.length
        ? mesh.geometry.groups
        : [
            {
              start: 0,
              count: mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count,
              materialIndex: 0,
            },
          ];
      const ranges: NightWindowRange[] = [];
      for (const group of groups) {
        const material = materials[group.materialIndex ?? 0];
        const tag = material?.userData.molenNightLight as ModelNightLight | undefined;
        const shared = material?.userData.molenSurface as { slot?: string } | undefined;
        if (tag?.kind === 'window' || tag?.kind === 'lamp') ranges.push({ ...group, light: tag });
        else if (shared?.slot === 'window') ranges.push(group);
      }
      const geometry = this.createGeometry(mesh.geometry, ranges);
      if (geometry) {
        const layer = this.mesh(geometry);
        // Structure instances borrow the source library's geometry. Removing one placement
        // must not dispose a layer that another placement (or a later LOD swap) still uses.
        layer.userData.worldgenOwnedGeometry = false;
        mesh.add(layer);
      }
    }
  }

  dispose(): void {
    this.material.dispose();
  }
}
