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
  { id: 'molen.worldgen.structure.n0259_shanhai_pass', height: 25.7 },
  { id: 'molen.worldgen.structure.n0260_khotyn_fortress', height: 54 },
  { id: 'molen.worldgen.structure.n0261_royal_castle_in_warsaw', height: 44 },
  { id: 'molen.worldgen.structure.n0262_stirling_castle', height: 34 },
  { id: 'molen.worldgen.structure.n0263_toompea_castle', height: 45.6, minY: -12 },
  { id: 'molen.worldgen.structure.n0264_riga_castle', height: 56.75 },
  { id: 'molen.worldgen.structure.n0265_chateau_de_vincennes', height: 59, minY: -6 },
  { id: 'molen.worldgen.structure.n0266_eltz_castle', height: 36.5 },
  { id: 'molen.worldgen.structure.n0267_heidelberg_castle', height: 52 },
  { id: 'molen.worldgen.structure.n0268_hohensalzburg_fortress', height: 60 },
  { id: 'molen.worldgen.structure.n0269_vaduz_castle', height: 30 },
  { id: 'molen.worldgen.structure.n0270_conwy_castle', height: 30 },
  { id: 'molen.worldgen.structure.n0271_swallow_s_nest', height: 12 },
  { id: 'molen.worldgen.structure.n0272_kuressaare_castle', height: 38.2 },
  { id: 'molen.worldgen.structure.n0273_caernarfon_castle', height: 35 },
  { id: 'molen.worldgen.structure.n0274_hermann_castle', height: 51 },
  { id: 'molen.worldgen.structure.n0275_dublin_castle', height: 34 },
  { id: 'molen.worldgen.structure.n0276_miramare_castle', height: 29 },
  { id: 'molen.worldgen.structure.n0277_lubart_s_castle', height: 28 },
  { id: 'molen.worldgen.structure.n0278_kamianets_podilskyi_castle', height: 35 },
  { id: 'molen.worldgen.structure.n0279_gripsholm_castle', height: 42 },
  { id: 'molen.worldgen.structure.n0280_trakai_island_castle', height: 33 },
  { id: 'molen.worldgen.structure.n0281_acrocorinth', height: 312.85 },
  { id: 'molen.worldgen.structure.n0282_akershus_fortress', height: 54 },
  { id: 'molen.worldgen.structure.n0283_beaumaris_castle', height: 17.6 },
  { id: 'molen.worldgen.structure.n0284_dover_castle', height: 112.5049578006 },
  { id: 'molen.worldgen.structure.n0285_corvin_castle', height: 45 },
  { id: 'molen.worldgen.structure.n0286_kromeriz_castle', height: 84 },
  { id: 'molen.worldgen.structure.n0287_elmina_castle', height: 31 },
  { id: 'molen.worldgen.structure.n0288_konopiste_castle', height: 49.5 },
  { id: 'molen.worldgen.structure.n0289_castel_nuovo', height: 40 },
  { id: 'molen.worldgen.structure.n0290_warwick_castle', height: 40 },
  { id: 'molen.worldgen.structure.n0291_ksiaz_castle_and_park_complex', height: 60 },
])('keeps $id deterministic, within budget and free of mixed-type uploads', async ({
  id,
  height,
  minY = 0,
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
      expect(position.min[1]).toBe(minY);
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
  'n0259_shanhai_pass',
  'n0260_khotyn_fortress',
  'n0261_royal_castle_in_warsaw',
  'n0262_stirling_castle',
  'n0263_toompea_castle',
  'n0264_riga_castle',
  'n0265_chateau_de_vincennes',
  'n0266_eltz_castle',
  'n0267_heidelberg_castle',
  'n0268_hohensalzburg_fortress',
  'n0269_vaduz_castle',
  'n0270_conwy_castle',
  'n0271_swallow_s_nest',
  'n0272_kuressaare_castle',
  'n0273_caernarfon_castle',
  'n0274_hermann_castle',
  'n0275_dublin_castle',
  'n0276_miramare_castle',
  'n0277_lubart_s_castle',
  'n0278_kamianets_podilskyi_castle',
  'n0279_gripsholm_castle',
  'n0280_trakai_island_castle',
  'n0281_acrocorinth',
  'n0282_akershus_fortress',
  'n0283_beaumaris_castle',
  'n0284_dover_castle',
  'n0285_corvin_castle',
  'n0286_kromeriz_castle',
  'n0287_elmina_castle',
  'n0288_konopiste_castle',
  'n0289_castel_nuovo',
  'n0290_warwick_castle',
  'n0291_ksiaz_castle_and_park_complex',
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
          `matgraph:molen.worldgen.material.${['n0291_ksiaz_castle_and_park_complex', 'n0290_warwick_castle'].includes(key) ? 'stone_sandstone' : key === 'n0289_castel_nuovo' ? 'stone_basalt' : key === 'n0282_akershus_fortress' ? 'stone_granite' : key === 'n0251_kernave' ? 'wood_plain' : ['n0248_bran_castle', 'n0250_mir_castle_complex', 'n0253_bratislava_castle', 'n0254_nesvizh_castle'].includes(key) ? 'plaster_lime' : ['n0243_malbork_castle', 'n0258_sforza_castle', 'n0259_shanhai_pass', 'n0280_trakai_island_castle'].includes(key) ? 'brick' : ['n0267_heidelberg_castle', 'n0266_eltz_castle', 'n0262_stirling_castle', 'n0256_durham_castle', 'n0241_wartburg', 'n0242_edinburgh_castle', 'n0244_kronborg_castle', 'n0249_alamut_castle', 'n0252_hohenzollern_castle'].includes(key) ? 'stone_sandstone' : 'stone_limestone'}`,
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

it('leaves both n0288 courtyards open through all authored levels', async () => {
  const { buildKonopisteRuntime } = await import(
    '../../worldgen/scripts/konopiste-castle-model.mjs'
  );
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const triangles = [];
    buildKonopisteRuntime({ addTriangle: (_s, _r, p) => triangles.push(p) }, level);
    for (const [x, z] of [
      [-15, -3],
      [17, -1],
    ])
      for (const [a, b, c] of triangles) {
        const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
        if (Math.abs(denominator) < 1e-8) continue;
        const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator;
        const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator,
          w = 1 - u - v;
        if (u >= 0 && v >= 0 && w >= 0)
          expect(u * a[1] + v * b[1] + w * c[1], level + ' courtyard overhead').toBeLessThan(5);
      }
  }
});

it('preserves n0289 courtyard and actual gate and arcade openings', async () => {
  const { buildCastelNuovoRuntime } = await import('../../worldgen/scripts/castel-nuovo-model.mjs');
  function hits(triangles, axes, point) {
    const result = [];
    for (const p of triangles) {
      const [a, b, c] = p.map((v) => [v[axes[0]], v[axes[1]], v[axes[2]]]);
      const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(den) < 1e-8) continue;
      const u = ((b[1] - c[1]) * (point[0] - c[0]) + (c[0] - b[0]) * (point[1] - c[1])) / den;
      const v = ((c[1] - a[1]) * (point[0] - c[0]) + (a[0] - c[0]) * (point[1] - c[1])) / den,
        w = 1 - u - v;
      if (u >= 0 && v >= 0 && w >= 0) result.push(u * a[2] + v * b[2] + w * c[2]);
    }
    return result;
  }
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const triangles = [];
    buildCastelNuovoRuntime({ addTriangle: (_s, _r, p) => triangles.push(p) }, level);
    for (const y of hits(triangles, [0, 2, 1], [-5, 0]))
      expect(y, level + ' open court').toBeLessThanOrEqual(5);
    for (const y of [8, 25])
      for (const x of hits(triangles, [2, 1, 0], [6.5, y]))
        expect(x < -52 || x > -27, level + ' gate corridor').toBe(true);
    if (['street', 'closeup'].includes(level)) {
      const a = [17.031, 26.215],
        b = [-29.001, 10.515],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz),
        cx = (a[0] + b[0]) / 2,
        cz = (a[1] + b[1]) / 2;
      const local = triangles.map((t) =>
        t.map((p) => [
          ((p[0] - cx) * dx + (p[2] - cz) * dz) / length,
          p[1],
          (-(p[0] - cx) * dz + (p[2] - cz) * dx) / length,
        ]),
      );
      const crossings = hits(local, [0, 1, 2], [0, 7]);
      expect(crossings.length).toBeGreaterThan(0);
      for (const z of crossings) expect(Math.abs(z), level + ' arcade opening').toBeGreaterThan(1);
    }
  }
});

it('leaves n0290 court and gate/barbican passage open at all levels', async () => {
  const { buildWarwickRuntime } = await import('../../worldgen/scripts/warwick-castle-model.mjs');
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const triangles = [];
    buildWarwickRuntime({ addTriangle: (_s, _r, p) => triangles.push(p) }, level);
    for (const [axes, point] of [
      [
        [0, 2, 1],
        [-10, 0],
      ],
      [
        [2, 1, 0],
        [6.6, 14],
      ],
    ])
      for (const triangle of triangles) {
        const [a, b, c] = triangle.map((p) => [p[axes[0]], p[axes[1]], p[axes[2]]]),
          den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        if (Math.abs(den) < 1e-8) continue;
        const u = ((b[1] - c[1]) * (point[0] - c[0]) + (c[0] - b[0]) * (point[1] - c[1])) / den;
        const v = ((c[1] - a[1]) * (point[0] - c[0]) + (a[0] - c[0]) * (point[1] - c[1])) / den,
          w = 1 - u - v;
        if (u < 0 || v < 0 || w < 0) continue;
        const hit = u * a[2] + v * b[2] + w * c[2];
        if (axes[2] === 1) expect(hit, level + ' court overhead').toBeLessThanOrEqual(11);
        else expect(hit < 52 || hit > 82, level + ' gate passage').toBe(true);
      }
  }
});

it('keeps n0291 both mapped courtyard spaces open at every runtime level', async () => {
  const { buildKsiazRuntime } = await import('../../worldgen/scripts/ksiaz-castle-model.mjs');
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const triangles = [];
    buildKsiazRuntime({ addTriangle: (_s, _r, p) => triangles.push(p) }, level);
    for (const [x, z] of [
      [2, 13],
      [-10, -8],
    ]) {
      let floor = false;
      for (const [a, b, c] of triangles) {
        const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
        if (Math.abs(den) < 1e-8) continue;
        const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den,
          v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den,
          w = 1 - u - v;
        if (u < 0 || v < 0 || w < 0) continue;
        const y = u * a[1] + v * b[1] + w * c[1];
        expect(y, level + ' court overhead').toBeLessThanOrEqual(13.1);
        if (Math.abs(y - 13.05) < 0.01) floor = true;
      }
      expect(floor, level + ' courtyard floor').toBe(true);
    }
  }
});

it('keeps n0291 west gable outward and roof joins covered', async () => {
  const { buildKsiazRuntime } = await import('../../worldgen/scripts/ksiaz-castle-model.mjs');
  function hits(triangles, axes, point) {
    const result = [];
    for (const triangle of triangles) {
      const [a, b, c] = triangle.p.map((p) => axes.map((i) => p[i]));
      const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(den) < 1e-8) continue;
      const u = ((b[1] - c[1]) * (point[0] - c[0]) + (c[0] - b[0]) * (point[1] - c[1])) / den,
        v = ((c[1] - a[1]) * (point[0] - c[0]) + (a[0] - c[0]) * (point[1] - c[1])) / den,
        w = 1 - u - v;
      if (u >= 0 && v >= 0 && w >= 0)
        result.push({ ...triangle, depth: u * a[2] + v * b[2] + w * c[2] });
    }
    return result;
  }
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const triangles = [];
    buildKsiazRuntime({ addTriangle: (s, _r, p, n) => triangles.push({ s, p, n }) }, level);
    const west = hits(triangles, [2, 1, 0], [-8, 38]).sort((a, b) => a.depth - b.depth)[0];
    expect(west, level + ' west gable must exist').toBeDefined();
    expect(west.depth).toBeLessThan(-47);
    expect(west.n[0], level + ' outward west normal').toBeLessThan(-0.9);
    for (const point of [
      [0, -17],
      [-30, 5],
      [20, 22],
      [28, -6],
      [43, 26],
    ]) {
      const roof = hits(triangles, [0, 2, 1], point).sort((a, b) => b.depth - a.depth)[0];
      expect(roof, level + ' covered roof junction ' + point).toBeDefined();
      expect(roof.depth).toBeGreaterThanOrEqual(33);
      expect(roof.s).toBe('tile');
      expect(roof.n[1]).toBeGreaterThan(0.1);
    }
  }
});
