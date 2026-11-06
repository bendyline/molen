import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import {
  buildVoroshilovskyLevel,
  voroshilovskyControls,
  voroshilovskyDeckY,
  voroshilovskySurfaces,
} from '../../../content/worldgen/source/places/ub/ubk/voroshilovsky_bridge/models/voroshilovsky-model.mjs';
import { createEmptyTerrainSemanticTile, heightfieldFromPng } from '../../terrain/dist/kernel.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { hashBytes } from '../../worldgen/scripts/structure-model-files.mjs';
import { withoutStructureRoads } from '../../worldgen-earth/src/client/structure-geometry.ts';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/ub/ubk/voroshilovsky_bridge'),
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
it('rebuilds the exact source with separate mapped road/path axes, four access connectors and native endpoints', async () => {
  const brief = await read(source + '/model-brief.json'),
    frame = await read(source + '/map-frame.json'),
    alignment = await read(source + '/alignment.json'),
    grid = await read(source + '/terrain-grid.json');
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(voroshilovskySurfaces);
  buildVoroshilovskyLevel(a.wrap(b), 'master');
  const mesh = b.finalize(),
    bytes = Buffer.from(encodeGlb(mesh, a.materials(mesh.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([39.7225821018219, 47.21405337319303]);
  expect(frame.heading).toBe(1.8769918226849933);
  expect(alignment.roadLines).toHaveLength(2);
  expect(alignment.footLines).toHaveLength(2);
  expect(alignment.lifts).toHaveLength(4);
  expect(alignment.waterCrossingX).toEqual([-99, 149]);
  for (const control of alignment.lifts) {
    const mapped = alignment.liftPathControls.find(
      (p) => p.side === control.side && Math.abs(p.station - control.x) < 0.001,
    );
    expect(mapped).toBeDefined();
    expect(control.z).toBeCloseTo(mapped.points.reduce((s, p) => s + p[1], 0) / 2, 6);
  }
  for (const line of alignment.footLines)
    for (const p of line) expect(Math.abs(Math.abs(p[1]) - 16.1433)).toBeLessThan(0.7);
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png);
  for (const x of alignment.limits)
    expect(voroshilovskyDeckY(x) - field.sampleHeight(x, 0)).toBeCloseTo(0.25, 2);
  const placement = await read(source + '/placement-report.json');
  expect(placement.entry.elevation).toBe(grid.modelDatumElevationMeters);
  expect(placement.entry.replaceFootprint).toBe(false);
  expect(placement.entry.replaceRoads.includeConnectedApproaches).toBe(true);
  expect(placement.entry.bounds).toHaveLength(4);
}, 30000);
it('keeps both decks continuous, the median physically open and daylight between the pier legs in every tier', async () => {
  const asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file);
    for (const x of [-300, -120, 0, 120, 300])
      for (const z of [-8.1433, 8.1433]) {
        const y = voroshilovskyDeckY(x),
          distance = nearest(ts, [x, y + 2, z], [0, -1, 0]);
        expect(Number.isFinite(distance), l.name + ' continuous deck').toBe(true);
        expect(Math.abs(distance - 1.965), l.name + ' deck grade').toBeLessThan(
          ['skyline', 'district'].includes(l.name) ? 1.6 : 0.1,
        );
      }
    expect(nearest(ts, [0, 60, 0], [0, -1, 0]), l.name + ' real median aperture').toBe(Infinity);
    expect(nearest(ts, [0, 4, 0], [0, 0, 1]), l.name + ' clear river').toBe(Infinity);
    expect(nearest(ts, [62, 10, 0], [1, 0, 0]), l.name + ' open pier legs').toBeGreaterThan(10);
  }
}, 60000);
it('replaces the two bridge roadways and outer paths without erasing the bank street or river promenade', async () => {
  const placement = (await read(source + '/placement-report.json')).entry,
    map = await read(source + '/pmtiles-map.json'),
    frame = await read(source + '/map-frame.json');
  const local = ([lon, lat]) => {
    const E = (lon - frame.anchor[0]) * 111319.490793 * Math.cos((frame.anchor[1] * Math.PI) / 180),
      S = -(lat - frame.anchor[1]) * 111319.490793;
    return [
      E * Math.cos(frame.heading) - S * Math.sin(frame.heading),
      E * Math.sin(frame.heading) + S * Math.cos(frame.heading),
    ];
  };
  const roads = map.features
    .filter((f) => f.layer === 'roads')
    .flatMap((f) =>
      (f.geometry.type === 'MultiLineString'
        ? f.geometry.coordinates
        : [f.geometry.coordinates]
      ).map((points) => ({ properties: f.properties, points: points.map(local) })),
    );
  const bridge = roads.filter(
      (r) => r.properties.is_bridge && r.properties.name === 'Ворошиловский мост',
    ),
    bank = roads.find((r) => r.properties.name === 'Береговая улица'),
    promenade = roads.find((r) => r.properties.name === 'Набережная улица');
  expect(bridge).toHaveLength(4);
  expect(bank).toBeDefined();
  expect(promenade).toBeDefined();
  const c = Math.cos(placement.heading),
    s = Math.sin(placement.heading),
    point = ([x, z]) => [(c * x + s * z + 400) / 800, (-s * x + c * z + 400) / 800],
    tile = createEmptyTerrainSemanticTile();
  for (const [i, r] of bridge.entries())
    tile.transportation.push({
      id: 'bridge-' + i,
      class: r.properties.kind === 'path' ? 'path' : 'major_road',
      subclass: r.properties.kind === 'path' ? 'footway' : 'primary',
      bridge: true,
      layer: 1,
      lines: [r.points.map(point)],
    });
  const lower = [bank, promenade].map((r, i) => ({
    id: 'lower-' + i,
    class: i ? 'path' : 'major_road',
    subclass: i ? 'footway' : 'tertiary',
    layer: 0,
    lines: [r.points.filter((p) => Math.abs(p[0]) < 350 && Math.abs(p[1]) < 350).map(point)],
  }));
  tile.transportation.push(...lower);
  const field = heightfieldFromPng(
    await read(source + '/terrain-review.terrain.json'),
    await readFile(source + '/terrain-review.height.png'),
  );
  const result = withoutStructureRoads(
    tile,
    { origin: [-400, -400], tileSize: 800, heightfield: field },
    [{ ...placement, anchor: [0, 0] }],
    1,
  );
  for (const r of lower) expect(result.transportation.find((f) => f.id === r.id)).toEqual(r);
  for (const f of result.transportation.filter((f) => f.id.startsWith('bridge-')))
    expect(f.lines.flat().length).toBeLessThan(3);
}, 30000);
it('rebuilds exact browser tiers within budgets with shared graphs, image-free glazing and separate GPU streams', async () => {
  const r = await buildModelLandmarkLods(runtime + '/asset.json', { force: true }),
    asset = await read(installed + '/asset.json');
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
    expect(hashBytes(b)).toBe(asset.runtimeLods.levels.find((l) => l.name === name).hash);
    expect(l.triangles).toBeLessThanOrEqual(cap);
    expect(l.drawCalls).toBeLessThanOrEqual(5);
    expect(g.images ?? []).toHaveLength(0);
    if (name !== 'skyline')
      for (const graph of ['concrete_plain', 'metal_painted', 'gravel'])
        expect(
          g.materials.some(
            (m) => m.extras?.molenSurface?.ref === 'matgraph:molen.worldgen.material.' + graph,
          ),
        ).toBe(true);
    if (['street', 'closeup'].includes(name))
      expect(
        g.materials.some(
          (m) =>
            m.alphaMode === 'BLEND' &&
            m.doubleSided &&
            m.pbrMetallicRoughness.baseColorFactor[3] < 0.5,
        ),
      ).toBe(true);
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const a = g.accessors[p.attributes.POSITION],
        n = g.accessors[p.attributes.NORMAL];
      expect(a.bufferView).not.toBe(n.bufferView);
      expect(g.bufferViews[a.bufferView].byteStride ?? 12).toBe(12);
      expect(g.bufferViews[n.bufferView].byteStride ?? 12).toBe(12);
    }
  }
}, 30000);
