import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import {
  buildGrunwaldLevel,
  grunwaldBandY,
  grunwaldCenterZ,
  grunwaldControls,
  grunwaldDeckY,
  grunwaldSurfaces,
} from '../../../content/worldgen/source/places/u3/u3h/grunwald_bridge/models/grunwald-model.mjs';
import { createEmptyTerrainSemanticTile, heightfieldFromPng } from '../../terrain/dist/kernel.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { hashBytes } from '../../worldgen/scripts/structure-model-files.mjs';
import { withoutStructureRoads } from '../../worldgen-earth/src/client/structure-geometry.ts';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u3/u3h/grunwald_bridge'),
  installed = source.replace(/([\\/])source([\\/])/, '$1assets$2'),
  runtime = await runtimeLodFixture(installed);
const read = async (p) => JSON.parse(await readFile(p));
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
it('rebuilds the exact detailed source and retains distinct river span, portal axes, tram alignment and native bank profile', async () => {
  const brief = await read(source + '/model-brief.json'),
    frame = await read(source + '/map-frame.json'),
    alignment = await read(source + '/alignment.json'),
    grid = await read(source + '/terrain-grid.json');
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(grunwaldSurfaces);
  buildGrunwaldLevel(a.wrap(b), 'master');
  const mesh = b.finalize(),
    bytes = Buffer.from(encodeGlb(mesh, a.materials(mesh.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([17.052553228, 51.109484456]);
  expect(frame.heading).toBe(0.347095676446);
  const legacy = await read(resolve('../../content/earth/structures/georeferencing.json'));
  expect(frame.geometry.outline).toEqual(
    legacy.candidates.find((c) => c.candidateId === 'grunwald_bridge').geometry.outline,
  );
  expect(grunwaldControls.halfSpan * 2).toBe(112.5);
  expect(grunwaldControls.gates[1] - grunwaldControls.gates[0]).toBe(126.6);
  expect(alignment.waterCrossingX).toEqual([-57, 57]);
  expect(alignment.tramMapCenterlines).toHaveLength(2);
  expect(alignment.tramCenterlines.every((l) => l[0][0] === -88 && l.at(-1)[0] === 88)).toBe(true);
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png);
  for (const x of [-88, 88])
    expect(grunwaldDeckY(x) - field.sampleHeight(x, grunwaldCenterZ(x))).toBeCloseTo(0.22, 2);
  const placement = await read(source + '/placement-report.json');
  expect(placement.entry.elevation).toBe(grid.modelDatumElevationMeters);
  expect(placement.entry.replaceFootprint).toBe(false);
  expect(placement.entry.replaceRoads.includeConnectedApproaches).toBe(true);
  expect(placement.entry.bounds).toHaveLength(4);
}, 30000);
it('retains the complete road, genuinely open portal arches and near upper band chambers while keeping the river open', async () => {
  const asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file);
    for (const x of [-80, -40, 0, 40, 80])
      expect(
        Math.abs(
          // A pedestrian-height probe stays below the intended overhead tram cross-spans.
          nearest(ts, [x, grunwaldDeckY(x) + 1.5, grunwaldCenterZ(x) + 4], [0, -1, 0]) - 1.5,
        ),
        l.name + ' complete road ' + x,
      ).toBeLessThan(0.1);
    for (const x of grunwaldControls.gates) {
      const y = grunwaldDeckY(x),
        z = grunwaldCenterZ(x);
      expect(
        nearest(ts, [x - 3, y + 5, z], [1, 0, 0]),
        l.name + ' open roadway portal',
      ).toBeGreaterThan(6);
      expect(
        nearest(ts, [x - 3, y + 13.3, z], [1, 0, 0]),
        l.name + ' solid arch head',
      ).toBeLessThan(5);
      if (l.name !== 'skyline')
        for (const sign of [-1, 1])
          expect(
            nearest(ts, [x - 2, y + 12, z + sign * 9.45], [1, 0, 0]),
            l.name + ' upper band chamber',
          ).toBeGreaterThan(3.65);
    }
    expect(nearest(ts, [0, 1, grunwaldCenterZ(0)], [0, 0, 1]), l.name + ' open river').toBe(
      Infinity,
    );
    expect(grunwaldBandY(0) - grunwaldDeckY(0)).toBeCloseTo(2.56, 5);
  }
}, 60000);
it('removes mapped road/tram bridge duplicates and preserves the transverse northeast bank street', async () => {
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
  const bridge = roads.find(
      (r) =>
        r.properties.is_bridge &&
        r.properties.name === 'most Grunwaldzki' &&
        r.properties.kind === 'major_road',
    ),
    bank = roads.find(
      (r) =>
        r.properties.name === 'Fryderyka Joliot-Curie' &&
        r.points.some((p) => p[0] > 70 && p[0] < 75 && Math.abs(p[1]) < 5),
    );
  expect(bridge).toBeDefined();
  expect(bank).toBeDefined();
  const c = Math.cos(placement.heading),
    s = Math.sin(placement.heading),
    point = ([x, z]) => [(c * x + s * z + 180) / 360, (-s * x + c * z + 180) / 360],
    tile = createEmptyTerrainSemanticTile();
  const upper = {
      id: 'road-bridge',
      class: 'major_road',
      subclass: 'secondary',
      bridge: true,
      lines: [bridge.points.map(point)],
    },
    side = {
      id: 'bank-cross-street',
      class: 'minor_road',
      subclass: 'residential',
      lines: [bank.points.map(point)],
    };
  tile.transportation.push(upper, side);
  const trams = roads.filter(
    (r) =>
      r.properties.is_bridge &&
      r.properties.kind === 'rail' &&
      r.properties.kind_detail === 'tram' &&
      r.points.some((p) => Math.abs(p[0]) < 60),
  );
  for (const [i, r] of trams.entries())
    tile.transportation.push({
      id: 'tram-' + i,
      class: 'rail',
      subclass: 'tram',
      bridge: true,
      lines: [r.points.map(point)],
    });
  const field = heightfieldFromPng(
    await read(source + '/terrain-review.terrain.json'),
    await readFile(source + '/terrain-review.height.png'),
  );
  const result = withoutStructureRoads(
    tile,
    { origin: [-180, -180], tileSize: 360, heightfield: field },
    [{ ...placement, anchor: [0, 0] }],
    1,
  );
  expect(result.transportation.find((f) => f.id === side.id)).toEqual(side);
  expect(
    result.transportation.filter((f) => f.id === 'road-bridge' || f.id.startsWith('tram-')),
  ).toHaveLength(0);
}, 30000);
it('rebuilds exact browser tiers with shared granite/blue metal, no images and separate GPU streams within budgets', async () => {
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
    expect(l.drawCalls).toBeLessThanOrEqual(6);
    expect(g.images ?? []).toHaveLength(0);
    if (name !== 'skyline')
      for (const graph of ['stone_granite', 'metal_painted'])
        expect(
          g.materials.some(
            (m) => m.extras?.molenSurface?.ref === 'matgraph:molen.worldgen.material.' + graph,
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
