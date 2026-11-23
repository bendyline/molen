import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createBuildingDetailLod } from '../../src/client/building-lod';
import { createVertexColorMaterialSet } from '../../src/client/materials';
import { NightWindowLighting } from '../../src/client/night-windows';
import { StructureModelLibrary } from '../../src/client/structure-models';
import { buffersToObject3D, disposeWorldgenObject } from '../../src/client/upload';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';

function windows() {
  const builder = new MeshBufferBuilder();
  for (let i = 0; i < 40; i++) {
    const x = (i % 10) * 3,
      y = Math.floor(i / 10) * 3;
    builder.addQuad(
      'window',
      'palette:#53657a',
      [
        [x, y, 0],
        [x + 1, y, 0],
        [x + 1, y + 1, 0],
        [x, y + 1, 0],
      ],
      [0, 0, 1],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [0.2, 0.3, 0.4],
    );
  }
  builder.addQuad(
    'wall',
    'palette:#cccccc',
    [
      [0, 0, -0.1],
      [30, 0, -0.1],
      [30, 12, -0.1],
      [0, 12, -0.1],
    ],
    [0, 0, 1],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    [0.5, 0.5, 0.5],
  );
  return builder.finalize();
}

describe('night window layers', () => {
  it('recognizes existing shared glass metadata before replacing its daytime material', async () => {
    const night = new NightWindowLighting();
    const materials = createVertexColorMaterialSet();
    const source = buffersToObject3D(windows(), materials);
    for (const material of source.material as THREE.Material[])
      if (material.name === 'worldgen:window')
        material.userData.molenSurface = { slot: 'window', uv: 'repeats', ref: 'matgraph:glass' };
    const scene = new THREE.Group();
    scene.add(source);
    const glass = new THREE.MeshStandardMaterial();
    const library = new StructureModelLibrary(async () => scene, {
      nightWindows: night,
      resolveSurface: () => glass,
    });
    const disposed = vi.spyOn(night.material, 'dispose');
    await library.acquire('shared-glass');
    expect(source.children[0]?.name).toBe('worldgen:night-windows');
    expect(source.material).toContain(glass);
    library.release('shared-glass');
    expect(disposed).not.toHaveBeenCalled();
    library.dispose();
    glass.dispose();
    night.dispose();
  });

  it('lights whole panes reproducibly, leaves some dark, and never emits from walls', () => {
    const night = new NightWindowLighting();
    const materials = createVertexColorMaterialSet();
    materials.nightWindows = night;
    const buffers = windows();
    const before = buffers.indices.slice();
    const a = buffersToObject3D(buffers, materials),
      b = buffersToObject3D(buffers, materials);
    const layer = a.children[0] as THREE.Mesh;
    const repeat = b.children[0] as THREE.Mesh;
    const count = layer.geometry.index?.count ?? 0;
    expect(count).toBeGreaterThan(40);
    expect(count).toBeLessThan(40 * 6);
    expect(count % 6).toBe(0);
    expect(
      Array.from(layer.geometry.getAttribute('position').array)
        .filter((_, i) => i % 3 === 2)
        .every((z) => z === 0),
    ).toBe(true);
    expect(layer.geometry.getAttribute('position').array).toEqual(
      repeat.geometry.getAttribute('position').array,
    );
    expect(layer.geometry.getAttribute('color').array).toEqual(
      repeat.geometry.getAttribute('color').array,
    );
    expect(buffers.indices).toEqual(before);
    night.setNightFactor(1);
    expect(night.material.visible).toBe(true);
    night.setNightFactor(0);
    expect(night.material.visible).toBe(false);
    expect(() => night.setNightFactor(NaN)).toThrow();
    disposeWorldgenObject(a);
    disposeWorldgenObject(b);
    materials.dispose?.();
    night.dispose();
  });

  it('retains exactly the same illuminated panes at all three building LODs', () => {
    const materials = createVertexColorMaterialSet();
    const night = new NightWindowLighting();
    materials.nightWindows = night;
    const lod = createBuildingDetailLod(windows(), materials, materials.materialFor('wall', ''), {
      maxPixelError: 2,
      viewportHeight: 700,
    });
    const levels = lod.children.find((cell) => cell.children[0]?.children.length)?.children;
    if (!levels) throw new Error('Missing window cell');
    const layers = levels.map((level) => level.children[0] as THREE.Mesh);
    expect(layers).toHaveLength(3);
    const first = layers[0];
    if (!first) throw new Error('Missing light layer');
    expect(layers[1]?.geometry).toBe(first.geometry);
    expect(layers[2]?.geometry).toBe(first.geometry);
    const disposed = vi.spyOn(first.geometry, 'dispose');
    disposeWorldgenObject(lod);
    expect(disposed).toHaveBeenCalledTimes(1);
    materials.dispose?.();
    night.dispose();
  });

  it('loads explicit glTF lamp extras without disposing the view material on eviction', async () => {
    const night = new NightWindowLighting();
    const material = new THREE.MeshStandardMaterial();
    material.userData.molenNightLight = { kind: 'lamp', color: '#ffcc77' };
    const scene = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    const library = new StructureModelLibrary(async () => scene, { nightWindows: night });
    const disposed = vi.spyOn(night.material, 'dispose');
    const model = await library.acquire('lamp');
    expect(mesh.children).toHaveLength(1);
    const instance = library.instantiate(model);
    const layer = instance.children[0]?.children[0] as THREE.Mesh;
    expect(layer).toBeInstanceOf(THREE.Mesh);
    const geometryDisposed = vi.spyOn(layer.geometry, 'dispose');
    disposeWorldgenObject(instance);
    expect(geometryDisposed).not.toHaveBeenCalled();
    library.release('lamp');
    expect(geometryDisposed).toHaveBeenCalledTimes(1);
    expect(disposed).not.toHaveBeenCalled();
    library.dispose();
    night.dispose();
  });

  it('lights the same panes, in the same order, as grouping them by position text did', () => {
    // The first implementation: a Map per vertex and a string for each position. Kept here as
    // the reference the faster one must match vertex for vertex.
    const reference = (
      source: THREE.BufferGeometry,
      ranges: ReadonlyArray<{
        start: number;
        count: number;
        light?: { kind: 'window' | 'lamp'; occupancy?: number; color?: string };
      }>,
    ): { positions: number[]; colors: number[]; indices: number[] } => {
      const colorsOf = ['#ffd28c', '#ffe4b0', '#fff0d0', '#dce8ff'].map((c) => new THREE.Color(c));
      const hash = (value: number): number => {
        let h = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
        h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
      };
      const position = source.getAttribute('position');
      const indexAt = (i: number): number => source.index?.getX(i) ?? i;
      const positions: number[] = [],
        colors: number[] = [],
        indices: number[] = [];
      for (const range of ranges) {
        const light = range.light;
        const occupancy = light?.occupancy ?? (light?.kind === 'lamp' ? 1 : 0.55);
        if (!Number.isFinite(occupancy) || occupancy <= 0) continue;
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
          const seed = vertices.reduce((min, v) => Math.min(min, v), Infinity) + range.start * 31;
          if (hash(seed + 17) >= Math.min(1, occupancy)) continue;
          const color = light?.color
            ? new THREE.Color(light.color)
            : (colorsOf[Math.floor(hash(seed + 91) * colorsOf.length)] as THREE.Color);
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
      return { positions, colors, indices };
    };
    // Panes on a jittered grid, some sharing an edge (joined by their vertices' positions) and
    // some standing on -0; drawn indexed, with every quad's own four vertices, and unindexed.
    let state = 12345;
    const random = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const quads: number[][] = [];
    for (let i = 0; i < 400; i++) {
      const x = Math.floor(random() * 30) * (random() < 0.5 ? 1 : 1.5);
      const y = Math.floor(random() * 12) * 2;
      const z = random() < 0.1 ? -0 : Math.floor(random() * 3);
      quads.push([x, y, z, x + 1, y, z, x + 1, y + 2, z, x, y + 2, z]);
    }
    const indexed = new THREE.BufferGeometry();
    indexed.setAttribute('position', new THREE.Float32BufferAttribute(quads.flat(), 3));
    indexed.setIndex(
      quads.flatMap((_, q) => [q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3]),
    );
    const soup = indexed.toNonIndexed();
    const night = new NightWindowLighting();
    const total = quads.length * 6;
    for (const geometry of [indexed, soup, indexed]) {
      for (const ranges of [
        [{ start: 0, count: total }],
        // Two ranges that share vertices along their seam, and one that lights nothing.
        [
          { start: 0, count: 600 },
          { start: 600, count: total - 600, light: { kind: 'lamp' as const, color: '#ffcc77' } },
          { start: 0, count: 300, light: { kind: 'window' as const, occupancy: 0 } },
          { start: 300, count: 900, light: { kind: 'window' as const, occupancy: 0.9 } },
        ],
      ]) {
        const expected = reference(geometry, ranges);
        const made = night.createGeometry(geometry, ranges);
        expect(expected.indices.length).toBeGreaterThan(300);
        expect([...(made?.getAttribute('position').array ?? [])]).toEqual([
          ...new Float32Array(expected.positions),
        ]);
        expect([...(made?.getAttribute('color').array ?? [])]).toEqual([
          ...new Float32Array(expected.colors),
        ]);
        expect([...(made?.index?.array ?? [])]).toEqual(expected.indices);
        made?.dispose();
      }
    }
    night.dispose();
  });
});
