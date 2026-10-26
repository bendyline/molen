import { readFile } from 'node:fs/promises';
import { Group, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { cleanGeometry, loft, outline, quad, sheet } from '../scripts/aircraft/mesh-kit.mjs';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

const material = new MeshStandardMaterial();
function fixture() {
  const root = new Group();
  return {
    root,
    add: (geometry, mat) => {
      const mesh = new Mesh(geometry, mat);
      root.add(mesh);
      return mesh;
    },
  };
}
function intersect(root, position, direction) {
  root.updateMatrixWorld(true);
  return new Raycaster(new Vector3(...position), new Vector3(...direction)).intersectObject(
    root,
    true,
  );
}
function boundaryEdges(root) {
  const edges = new Map();
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const g = mesh.geometry,
      p = g.getAttribute('position');
    const key = (i) => [p.getX(i), p.getY(i), p.getZ(i)].map((v) => Math.round(v * 1e6)).join(',');
    for (let i = 0; i < g.index.count; i += 3) {
      const vertices = [0, 1, 2].map((j) => key(g.index.getX(i + j)));
      for (let j = 0; j < 3; j++) {
        const edge = [vertices[j], vertices[(j + 1) % 3]].sort().join('/');
        edges.set(edge, (edges.get(edge) ?? 0) + 1);
      }
    }
  });
  return [...edges.entries()].filter(([, count]) => count !== 2);
}

describe('aircraft surface construction', () => {
  it('keeps duct side walls even when their winding hint points along the duct', () => {
    const d = fixture();
    quad(d, [1, 0, 0], [1, 1, 0], [1, 1, 2], [1, 0, 2], material, [0, 0, 1]);
    for (const y of [0.1, 0.5, 0.9])
      for (const z of [0.1, 0.8, 1.9])
        expect(intersect(d.root, [2, y, z], [-1, 0, 0]).length).toBeGreaterThan(0);
  });
  it('projects apertures in the actual sheet plane and keeps the hole open', () => {
    const d = fixture();
    sheet(
      d,
      [
        [1, 0, 0],
        [1, 2, 0],
        [1, 2, 2],
        [1, 0, 2],
      ],
      material,
      [0, 0, 1],
      [
        [
          [1, 0.8, 0.8],
          [1, 1.2, 0.8],
          [1, 1.2, 1.2],
          [1, 0.8, 1.2],
        ],
      ],
    );
    expect(intersect(d.root, [2, 0.5, 1], [-1, 0, 0]).length).toBeGreaterThan(0);
    expect(intersect(d.root, [2, 1, 1], [-1, 0, 0])).toHaveLength(0);
  });
  it('closes a tapered shell even when its first section is a single point', () => {
    const d = fixture();
    loft(
      d,
      [
        {
          z: 1,
          points: [
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0],
          ],
        },
        {
          z: 0,
          points: [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ],
        },
      ],
      material,
    );
    cleanGeometry(d.root);
    expect(boundaryEdges(d.root)).toEqual([]);
    expect(intersect(d.root, [0, 0, 2], [0, 0, -1]).length).toBeGreaterThan(0);
  });
  it.each([false, true])('joins bent trim into one closed surface (loop=%s)', (closed) => {
    const d = fixture();
    outline(
      d,
      [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0.2],
        [0, 1, 0],
      ],
      0.05,
      material,
      closed,
    );
    expect(d.root.children).toHaveLength(1);
    expect(boundaryEdges(d.root)).toEqual([]);
    expect(intersect(d.root, [1, 0, 1], [0, 0, -1]).length).toBeGreaterThan(0);
  });
});

async function load(slug, id, version) {
  const path =
    version === 'source'
      ? `source/aircraft/${slug}/models/source.glb`
      : `assets/molen/entities/aircraft/${id}/model.glb`;
  const bytes = await readFile(new URL(`../../../content/entities/${path}`, import.meta.url));
  return (
    await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene;
}
describe.each(['source', 'imported'])('joined aircraft (%s)', (version) => {
  it.each([
    ['cessna-172s', 'cessna_172s', 1.1, 1.38 + (147 * 0.29972) / 334 + 0.005],
    ['cessna-182t', 'cessna_182t', 1.5, 1.4 + (100 * 0.29972) / 232 + 0.002],
  ])('seals the %s panel-to-coaming edge', async (slug, id, z, y) => {
    const root = await load(slug, id, version);
    const hits = intersect(root.getObjectByName('cockpit'), [0, y, z - 0.1], [0, 0, 1]);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].point.z).toBeLessThan(z + 0.01);
    expect(hits[0].object.material.transparent).toBe(false);
  });
  it('closes both MiG-29 nozzle rims between the outer skin and inner liner', async () => {
    const root = await load('mig-29a', 'mig_29a', version);
    for (const side of [-1, 1])
      for (const direction of [-1, 1]) {
        const hits = intersect(root, [side * 1.15 + direction * 0.407, 1.59, -7], [0, 0, 1]);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].point.z).toBeCloseTo(-6.61, 3);
      }
  });
});
