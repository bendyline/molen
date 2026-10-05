import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import {
  authoredDetail,
  authoredSkyline,
  buildModelLandmarkLods,
  landmarkLodRecipeHash,
} from '../scripts/authored-landmark-lods.mjs';

const id = 'molen.worldgen.structure.n0230_nina_tower';
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

it.each([
  { id, height: 320.4 },
  { id: 'molen.worldgen.structure.n0232_gran_torre_costanera', height: 300 },
  { id: 'molen.worldgen.structure.n0233_china_world_trade_center_tower_iii', height: 329.8114 },
  { id: 'molen.worldgen.structure.n0234_barolo_palace', height: 100 },
  { id: 'molen.worldgen.structure.n0235_millennium_tower', height: 202 },
  { id: 'molen.worldgen.structure.n0236_chateau_de_montsoreau', height: 38.4 },
  { id: 'molen.worldgen.structure.n0237_neuschwanstein_castle', height: 65 },
  { id: 'molen.worldgen.structure.n0239_windsor_castle', height: 52 },
  { id: 'molen.worldgen.structure.n0240_prague_castle', height: 99.3 },
  { id: 'molen.worldgen.structure.n0241_wartburg', height: 34 },
  { id: 'molen.worldgen.structure.n0242_edinburgh_castle', height: 49 },
  { id: 'molen.worldgen.structure.n0243_malbork_castle', height: 46 },
  { id: 'molen.worldgen.structure.n0244_kronborg_castle', height: 64 },
  { id: 'molen.worldgen.structure.n0245_hofburg_palace', height: 66 },
  { id: 'molen.worldgen.structure.n0246_takht_e_soleyman', height: 23.2 },
  { id: 'molen.worldgen.structure.n0247_karlstejn_castle', height: 75 },
  { id: 'molen.worldgen.structure.n0248_bran_castle', height: 40.4 },
  { id: 'molen.worldgen.structure.n0249_alamut_castle', height: 47.0286 },
  { id: 'molen.worldgen.structure.n0250_mir_castle_complex', height: 31.75 },
  { id: 'molen.worldgen.structure.n0251_kernave', height: 35.9431 },
  { id: 'molen.worldgen.structure.n0252_hohenzollern_castle', height: 78 },
  { id: 'molen.worldgen.structure.n0253_bratislava_castle', height: 57 },
  { id: 'molen.worldgen.structure.n0254_nesvizh_castle', height: 37 },
  { id: 'molen.worldgen.structure.n0255_buda_castle', height: 62 },
  { id: 'molen.worldgen.structure.n0256_durham_castle', height: 30.2 },
  { id: 'molen.worldgen.structure.n0257_citadel_of_salah_ed_din', height: 70 },
  { id: 'molen.worldgen.structure.n0258_sforza_castle', height: 73 },
])('keeps $id deterministic, within budget and free of mixed-type uploads', async ({
  id,
  height,
}) => {
  const a = await authoredSkyline(id),
    b = await authoredSkyline(id);
  expect(a.bytes.equals(b.bytes)).toBe(true);
  expect(a.bytes.length).toBeLessThan(200000);
  expect(a.triangles).toBeLessThanOrEqual(1000);
  const gltf = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12)));
  expect(gltf.images ?? []).toHaveLength(0);
  const types = new Map();
  for (const mesh of gltf.meshes)
    for (const p of mesh.primitives) {
      const position = gltf.accessors[p.attributes.POSITION];
      expect(position.min[1]).toBe(0);
      expect(position.max[1]).toBeCloseTo(height, 2);
      for (const index of Object.values(p.attributes)) {
        const a = gltf.accessors[index];
        if (!types.has(a.bufferView)) types.set(a.bufferView, new Set());
        types.get(a.bufferView).add(a.componentType);
      }
    }
  for (const values of types.values()) expect(values.size).toBe(1);
  expect(await authoredSkyline('unregistered')).toBeUndefined();
  expect(await landmarkLodRecipeHash(id)).not.toBe(await landmarkLodRecipeHash('unregistered'));
});

// Builds each of three detailed GLBs twice; this exceeded Vitest's 5 s default on CI.
it('keeps Barolo detail levels deterministic, within download budgets, and bound to shared surfaces', async () => {
  const id = 'molen.worldgen.structure.n0234_barolo_palace';
  const budgets = { district: 2_950_000, street: 9_000_000, closeup: 12_000_000 };
  let previousTriangles = 0;
  for (const [level, budget] of Object.entries(budgets)) {
    const a = await authoredDetail(id, level),
      b = await authoredDetail(id, level);
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(a.bytes.length).toBeLessThan(budget);
    expect(a.triangles).toBeGreaterThan(previousTriangles);
    previousTriangles = a.triangles;
    const g = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    expect(
      g.materials
        .flatMap((m) => (m.extras?.molenSurface ? [m.extras.molenSurface.ref] : []))
        .sort(),
    ).toEqual([
      'matgraph:molen.worldgen.material.concrete_plain',
      'matgraph:molen.worldgen.material.metal_painted',
      'matgraph:molen.worldgen.material.stone_marble',
    ]);
    expect(g.materials.filter((m) => m.alphaMode === 'BLEND')).toHaveLength(1);
    const types = new Map();
    for (const mesh of g.meshes)
      for (const p of mesh.primitives)
        for (const index of Object.values(p.attributes)) {
          const a = g.accessors[index];
          if (!types.has(a.bufferView)) types.set(a.bufferView, new Set());
          types.get(a.bufferView).add(a.componentType);
        }
    for (const typesInView of types.values()) expect(typesInView.size).toBe(1);
    if (level === 'district')
      expect(a.bytes.length + (await authoredSkyline(id)).bytes.length).toBeLessThan(3_000_000);
  }
}, 60_000);

it('reuses current outputs, repairs a missing derivative, and rejects a changed master', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'molen-authored-lod-'));
  if (dirname(resolve(directory)) !== resolve(tmpdir()))
    throw new Error('Unexpected test directory');
  try {
    const { bytes } = await authoredSkyline(id);
    const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    const position = gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
    await writeFile(join(directory, 'model.glb'), bytes);
    const path = join(directory, 'asset.json');
    await writeFile(
      path,
      JSON.stringify({
        id,
        files: { main: 'model.glb' },
        hash: hash(bytes),
        stats: {},
        bounds: { aabb: { min: position.min, max: position.max } },
      }),
    );
    const a = await buildModelLandmarkLods(path);
    const before = await readFile(path);
    expect(await buildModelLandmarkLods(path)).toEqual(a);
    expect((await readFile(path)).equals(before)).toBe(true);
    await rm(join(directory, 'model.skyline.glb'));
    expect(await buildModelLandmarkLods(path)).toEqual(a);
    await writeFile(join(directory, 'model.glb'), Buffer.from('altered master'));
    await expect(buildModelLandmarkLods(path)).rejects.toThrow('stale master import');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it.each([
  'n0239_windsor_castle',
  'n0240_prague_castle',
  'n0241_wartburg',
  'n0242_edinburgh_castle',
  'n0243_malbork_castle',
  'n0244_kronborg_castle',
  'n0245_hofburg_palace',
  'n0246_takht_e_soleyman',
  'n0247_karlstejn_castle',
  'n0248_bran_castle',
  'n0249_alamut_castle',
  'n0250_mir_castle_complex',
  'n0251_kernave',
  'n0252_hohenzollern_castle',
  'n0253_bratislava_castle',
  'n0254_nesvizh_castle',
  'n0255_buda_castle',
  'n0256_durham_castle',
  'n0257_citadel_of_salah_ed_din',
  'n0258_sforza_castle',
])('keeps %s detail levels within landmark budgets with reusable surfaces', async (key) => {
  const id = `molen.worldgen.structure.${key}`;
  let previous = 0;
  const byteBudgets = { district: 2_900_000, street: 6_000_000, closeup: 12_000_000 };
  const triangleBudgets = { district: 4_000, street: 16_000, closeup: 64_000 };
  for (const name of ['district', 'street', 'closeup']) {
    const a = await authoredDetail(id, name),
      b = await authoredDetail(id, name);
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(a.bytes.length).toBeLessThan(byteBudgets[name]);
    expect(a.triangles).toBeGreaterThan(previous);
    expect(a.triangles).toBeLessThanOrEqual(triangleBudgets[name]);
    previous = a.triangles;
    const g = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    expect(
      g.materials.some(
        (m) =>
          m.extras?.molenSurface?.ref ===
          `matgraph:molen.worldgen.material.${key === 'n0251_kernave' ? 'wood_plain' : ['n0248_bran_castle', 'n0250_mir_castle_complex', 'n0253_bratislava_castle', 'n0254_nesvizh_castle'].includes(key) ? 'plaster_lime' : ['n0243_malbork_castle', 'n0258_sforza_castle'].includes(key) ? 'brick' : ['n0256_durham_castle', 'n0241_wartburg', 'n0242_edinburgh_castle', 'n0244_kronborg_castle', 'n0249_alamut_castle', 'n0252_hohenzollern_castle'].includes(key) ? 'stone_sandstone' : 'stone_limestone'}`,
      ),
    ).toBe(true);
    const types = new Map();
    for (const mesh of g.meshes)
      for (const p of mesh.primitives)
        for (const index of Object.values(p.attributes)) {
          const a = g.accessors[index];
          if (!types.has(a.bufferView)) types.set(a.bufferView, new Set());
          types.get(a.bufferView).add(a.componentType);
        }
    for (const values of types.values()) expect(values.size).toBe(1);
  }
  const initial =
    (await authoredSkyline(id)).bytes.length + (await authoredDetail(id, 'district')).bytes.length;
  expect(initial).toBeLessThan(3_000_000);
});
