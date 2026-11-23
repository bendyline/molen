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

const hashFloat = new Float32Array(1);
const hashBits = new Uint32Array(hashFloat.buffer);

/** A hash of a position: equal coordinates hash alike, 0 with -0 among them. */
function positionHash(x: number, y: number, z: number): number {
  hashFloat[0] = x + 0;
  let h = Math.imul(hashBits[0] as number, 73856093);
  hashFloat[0] = y + 0;
  h ^= Math.imul(hashBits[0] as number, 19349663);
  hashFloat[0] = z + 0;
  return h ^ Math.imul(hashBits[0] as number, 83492791);
}

/** Equal as their text is (the key these positions once had): 0 is -0, and NaN is NaN. */
function sameNumber(a: number, b: number): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
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

  /**
   * Per-vertex scratch for `createGeometry`, kept between calls and all -1 outside one: each
   * vertex's parent in the panes' union-find, its place in the overlay, and the next vertex
   * whose position hashes alike.
   */
  private parents = new Int32Array(0);
  private places = new Int32Array(0);
  private alike = new Int32Array(0);

  /**
   * Indices are source ranges, before material batching reorders them.
   *
   * This runs on the main thread for every cell of buildings as it is assembled, and a dense
   * cell holds tens of thousands of window vertices. The panes are found with integer arrays
   * and a numeric hash of each position: with a `Map` per vertex and a string key for its
   * position, this was 44 ms of each second while a dense city streamed in, and its garbage
   * more.
   */
  createGeometry(
    source: THREE.BufferGeometry,
    ranges: readonly NightWindowRange[],
  ): THREE.BufferGeometry | undefined {
    const position = source.getAttribute('position');
    if (!position) return undefined;
    // Straight from the arrays where an accessor would only index them.
    const index = source.index;
    const indexArray = index !== null && !index.normalized ? index.array : undefined;
    const indexAt = (i: number): number =>
      indexArray !== undefined ? (indexArray[i] ?? i) : (index?.getX(i) ?? i);
    const plain =
      (position as THREE.BufferAttribute).isBufferAttribute === true &&
      (position as unknown as { isInterleavedBufferAttribute?: boolean })
        .isInterleavedBufferAttribute !== true &&
      !position.normalized;
    const array = position.array;
    const size = position.itemSize;
    const x = (v: number): number => (plain ? (array[v * size] as number) : position.getX(v));
    const y = (v: number): number => (plain ? (array[v * size + 1] as number) : position.getY(v));
    const z = (v: number): number => (plain ? (array[v * size + 2] as number) : position.getZ(v));
    if (this.parents.length < position.count) {
      const length = Math.max(position.count, this.parents.length * 2);
      this.parents = new Int32Array(length).fill(-1);
      this.places = new Int32Array(length).fill(-1);
      this.alike = new Int32Array(length).fill(-1);
    }
    const parent = this.parents;
    const place = this.places;
    const alike = this.alike;
    const root = (v: number): number => {
      let p = parent[v] as number;
      while (p !== parent[p]) p = parent[p] as number;
      let next = v;
      while (next !== p) {
        const old = parent[next] as number;
        parent[next] = p;
        next = old;
      }
      return p;
    };
    const join = (a: number, b: number): void => {
      const from = root(b);
      parent[from] = root(a);
    };
    const positions: number[] = [],
      colors: number[] = [],
      indices: number[] = [];
    /** The vertices of the range under way, in the order met. */
    const seen: number[] = [];
    for (const range of ranges) {
      const light = range.light;
      const occupancy = light?.occupancy ?? (light?.kind === 'lamp' ? 1 : 0.55);
      if (!Number.isFinite(occupancy) || occupancy <= 0) continue;
      // Connectivity keeps the two triangles of a pane in the same room. Welding positions
      // also supports exported non-indexed glass. Only vertices in marked ranges participate.
      // The first vertex met at each position, by a hash of it; `alike` chains those that share one.
      const heads = new Map<number, number>();
      for (let i = range.start; i < range.start + range.count; i += 3) {
        const a = indexAt(i);
        for (let j = 0; j < 3; j++) {
          const v = indexAt(i + j);
          if (parent[v] === -1) {
            parent[v] = v;
            seen.push(v);
            const vx = x(v),
              vy = y(v),
              vz = z(v);
            const key = positionHash(vx, vy, vz);
            const head = heads.get(key);
            let same = head ?? -1;
            while (
              same !== -1 &&
              !(sameNumber(x(same), vx) && sameNumber(y(same), vy) && sameNumber(z(same), vz))
            )
              same = alike[same] as number;
            if (same !== -1) join(same, v);
            else {
              alike[v] = head ?? -1;
              heads.set(key, v);
            }
          }
          join(a, v);
        }
      }
      const panes = new Map<number, number[]>();
      for (const v of seen) {
        const r = root(v);
        const vertices = panes.get(r);
        if (vertices === undefined) panes.set(r, [v]);
        else vertices.push(v);
      }
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
          place[v] = positions.length / 3;
          positions.push(x(v), y(v), z(v));
          colors.push(color.r * intensity, color.g * intensity, color.b * intensity);
        }
      }
      for (let i = range.start; i < range.start + range.count; i += 3) {
        const a = place[indexAt(i)] as number,
          b = place[indexAt(i + 1)] as number,
          c = place[indexAt(i + 2)] as number;
        if (a >= 0 && b >= 0 && c >= 0) indices.push(a, b, c);
      }
      // The scratch as it was found, for the next range (a vertex may be in several) and call.
      for (const v of seen) {
        parent[v] = -1;
        place[v] = -1;
        alike[v] = -1;
      }
      seen.length = 0;
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
