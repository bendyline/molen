import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import {
  buildLyduvenaiLevel,
  lyduvenaiControls,
  lyduvenaiDeckY,
  lyduvenaiSurfaces,
} from '../../../content/worldgen/source/places/u9/u9b/lyduvenai_bridge/models/lyduvenai-model.mjs';
import { createEmptyTerrainSemanticTile, heightfieldFromPng } from '../../terrain/dist/kernel.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { hashBytes } from '../../worldgen/scripts/structure-model-files.mjs';
import { withoutStructureRoads } from '../../worldgen-earth/src/client/structure-geometry.ts';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u9/u9b/lyduvenai_bridge'),
  installed = source.replace(/([\\/])source([\\/])/, '$1assets$2'),
  runtime = await runtimeLodFixture(installed),
  read = async (p) => JSON.parse(await readFile(p));
async function triangles(path) {
  const d = await new NodeIO().readBinary(await readFile(path));
  return d
    .getRoot()
    .listMeshes()
    .flatMap((m) =>
      m.listPrimitives().flatMap((p) => {
        const a = p.getAttribute('POSITION').getArray(),
          ids = p.getIndices().getArray();
        return Array.from({ length: ids.length / 3 }, (_, i) =>
          Array.from(ids.slice(i * 3, i * 3 + 3), (j) => Array.from(a.slice(j * 3, j * 3 + 3))),
        );
      }),
    );
}
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
function nearest(ts, o, d) {
  return ts.reduce((best, p) => {
    const a = sub(p[1], p[0]),
      b = sub(p[2], p[0]),
      h = cross(d, b),
      det = dot(a, h);
    if (Math.abs(det) < 1e-8) return best;
    const q = sub(o, p[0]),
      u = dot(q, h) / det,
      v = dot(d, cross(q, a)) / det,
      t = dot(b, cross(q, a)) / det;
    return u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7 || t <= 1e-5 ? best : Math.min(best, t);
  }, Infinity);
}

it('reconstructs exact original source and its mapped railway frame, with native-fitting foundations', async () => {
  const brief = await read(source + '/model-brief.json'),
    frame = await read(source + '/map-frame.json'),
    alignment = await read(source + '/alignment.json'),
    grid = await read(source + '/terrain-grid.json');
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(lyduvenaiSurfaces);
  buildLyduvenaiLevel(a.wrap(b), 'master');
  const m = b.finalize(),
    bytes = Buffer.from(encodeGlb(m, a.materials(m.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([23.086682574, 55.505915036]);
  expect(frame.heading).toBe(0.75995116399);
  expect(alignment.limits[1] - alignment.limits[0]).toBeCloseTo(598.246, 5);
  expect(alignment.piers).toHaveLength(8);
  for (const p of alignment.railLine) expect(Math.abs(p[1])).toBeLessThan(0.3);
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png);
  const ts = await triangles(source + '/models/source.glb');
  for (const x of alignment.piers) {
    const ground = field.sampleHeight(x, 0),
      hit = nearest(ts, [x, ground - 3, 0], [0, 1, 0]);
    expect(hit).toBeGreaterThan(1.7);
    expect(hit).toBeLessThan(1.9);
  }
  for (const x of alignment.limits) {
    expect(lyduvenaiDeckY(x)).toBe(42.5);
    expect(lyduvenaiDeckY(x) - field.sampleHeight(x, 0)).toBeGreaterThan(13);
  }
  const placed = (await read(source + '/placement-report.json')).entry;
  expect(placed.elevation).toBe(66);
  expect(placed.replaceFootprint).toBe(false);
  expect(placed.replaceRoads.deckHeights).toEqual([108.5, 108.5]);
}, 30000);
it('keeps actual lattice apertures, two top rails and an unobstructed current lower visitor path', async () => {
  const asset = await read(runtime + '/asset.json');
  for (const [i, l] of asset.runtimeLods.levels.entries()) {
    const ts = await triangles(runtime + '/' + l.file),
      cells = [1, 4, 10, 10][i],
      start = lyduvenaiControls.spanEnds[4] + 0.14,
      end = lyduvenaiControls.spanEnds[5] - 0.14,
      x = start + ((end - start) / cells) * 0.25;
    expect(nearest(ts, [x, 37.7, -5], [0, 0, 1]), l.name + ' physical truss aperture').toBe(
      Infinity,
    );
    for (const z of [-0.76, 0.76])
      expect(nearest(ts, [12, 45, z], [0, -1, 0]), l.name + ' single track rails').toBeCloseTo(
        2.33,
        i > 1 ? 1 : 1,
      );
    if (i > 0) {
      expect(nearest(ts, [12, 34.9, 0], [0, -1, 0]), l.name + ' lower visitor floor').toBeCloseTo(
        1.28,
        1,
      );
      expect(nearest(ts, [-156, 35.2, 0], [1, 0, 0]), l.name + ' visitor headroom').toBeGreaterThan(
        200,
      );
    }
    expect(nearest(ts, [0, 5, -8], [0, 0, 1]), l.name + ' valley remains open').toBe(Infinity);
  }
}, 60000);
it('suppresses the actual mapped railway bridge while preserving the lower crossing street', async () => {
  const p = (await read(source + '/placement-report.json')).entry,
    map = await read(source + '/pmtiles-map.json'),
    f = await read(source + '/map-frame.json');
  const local = ([lon, lat]) => {
    const E = (lon - f.anchor[0]) * 111319.490793 * Math.cos((f.anchor[1] * Math.PI) / 180),
      S = -(lat - f.anchor[1]) * 111319.490793;
    return [
      E * Math.cos(f.heading) - S * Math.sin(f.heading),
      E * Math.sin(f.heading) + S * Math.cos(f.heading),
    ];
  };
  const roads = map.features
      .filter((f) => f.layer === 'roads')
      .flatMap((f) =>
        (f.geometry.type === 'MultiLineString'
          ? f.geometry.coordinates
          : [f.geometry.coordinates]
        ).map((line) => ({ properties: f.properties, points: line.map(local) })),
      ),
    rail = roads.find((f) => f.properties.kind === 'rail' && f.properties.is_bridge),
    street = roads.find(
      (f) =>
        f.properties.name === 'Tilto g.' &&
        f.points.some((p, i) => i > 0 && p[1] * f.points[i - 1][1] < 0 && Math.abs(p[0]) < 100),
    );
  expect(rail).toBeDefined();
  expect(street).toBeDefined();
  const c = Math.cos(p.heading),
    s = Math.sin(p.heading),
    point = ([x, z]) => [(c * x + s * z + 400) / 800, (-s * x + c * z + 400) / 800],
    tile = createEmptyTerrainSemanticTile();
  tile.transportation.push(
    {
      id: 'native-rail',
      class: 'rail',
      subclass: 'rail',
      bridge: true,
      layer: 1,
      lines: [rail.points.map(point)],
    },
    {
      id: 'lower-street',
      class: 'major_road',
      subclass: 'secondary',
      layer: 0,
      lines: [street.points.map(point)],
    },
  );
  const lower = tile.transportation[1],
    field = heightfieldFromPng(
      await read(source + '/terrain-review.terrain.json'),
      await readFile(source + '/terrain-review.height.png'),
    ),
    result = withoutStructureRoads(
      tile,
      { origin: [-400, -400], tileSize: 800, heightfield: field },
      [{ ...p, anchor: [0, 0] }],
      1,
    );
  expect(result.transportation.find((f) => f.id === 'lower-street')).toEqual(lower);
  const remain = result.transportation.find((f) => f.id === 'native-rail');
  const remainingMeters = (remain?.lines ?? []).reduce(
    (s, l) =>
      s + l.slice(1).reduce((t, p, i) => t + Math.hypot(p[0] - l[i][0], p[1] - l[i][1]) * 800, 0),
    0,
  );
  expect(remainingMeters).toBeLessThan(1);
}, 30000);
it('reconstructs all four exact browser tiers within shared-material, bandwidth and GPU-layout budgets', async () => {
  const r = await buildModelLandmarkLods(runtime + '/asset.json', { force: true }),
    a = await read(installed + '/asset.json');
  expect(r.levels[0].bytes + r.levels[1].bytes).toBeLessThan(3000000);
  for (const [name, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const l = r.levels.find((l) => l.name === name),
      b = await readFile(runtime + '/' + l.file),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(hashBytes(b)).toBe(a.runtimeLods.levels.find((l) => l.name === name).hash);
    expect(l.triangles).toBeLessThanOrEqual(cap);
    expect(l.drawCalls).toBeLessThanOrEqual(3);
    expect(g.images ?? []).toHaveLength(0);
    if (name !== 'skyline')
      for (const graph of ['concrete_plain', 'metal_painted', 'wood_plain'])
        expect(
          g.materials.some(
            (m) => m.extras?.molenSurface?.ref === 'matgraph:molen.worldgen.material.' + graph,
          ),
        ).toBe(true);
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const v = g.accessors[p.attributes.POSITION],
        n = g.accessors[p.attributes.NORMAL];
      expect(v.bufferView).not.toBe(n.bufferView);
      expect(g.bufferViews[v.bufferView].byteStride ?? 12).toBe(12);
      expect(g.bufferViews[n.bufferView].byteStride ?? 12).toBe(12);
    }
  }
}, 30000);
