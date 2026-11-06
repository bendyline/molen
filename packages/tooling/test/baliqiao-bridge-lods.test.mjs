import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import {
  baliqiaoControls,
  baliqiaoDeckY,
  baliqiaoSurfaces,
  buildBaliqiaoLevel,
} from '../../../content/worldgen/source/places/wx/wx4/baliqiao/models/baliqiao-model.mjs';
import { createEmptyTerrainSemanticTile, heightfieldFromPng } from '../../terrain/dist/kernel.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { hashBytes } from '../../worldgen/scripts/structure-model-files.mjs';
import { withoutStructureRoads } from '../../worldgen-earth/src/client/structure-geometry.ts';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/wx/wx4/baliqiao'),
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
it('rebuilds the exact original source with a signed historic bridge frame and native-fitting bounded approach ends', async () => {
  const brief = await read(source + '/model-brief.json'),
    frame = await read(source + '/map-frame.json'),
    grid = await read(source + '/terrain-grid.json');
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(baliqiaoSurfaces);
  buildBaliqiaoLevel(a.wrap(b), 'master');
  const mesh = b.finalize(),
    bytes = Buffer.from(encodeGlb(mesh, a.materials(mesh.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([116.61446774250331, 39.90655028368594]);
  expect(frame.heading).toBe(1.7187748077935978);
  expect(frame.mappedIdentity.name).toBe('永通桥');
  expect(baliqiaoControls.bodyLimits).toEqual([-25, 25]);
  expect(baliqiaoControls.approachLimits).toEqual([-65, 65]);
  expect(baliqiaoControls.arches.map((a) => a.spring + a.rise)).toEqual([3.5, 8.5, 3.5]);
  expect(baliqiaoControls.lionStations).toHaveLength(33);
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png);
  for (const x of [-65, 65])
    expect(baliqiaoDeckY(x) - field.sampleHeight(x, 0)).toBeCloseTo(0.25, 2);
  const placement = (await read(source + '/placement-report.json')).entry;
  expect(placement.elevation).toBe(grid.modelDatumElevationMeters);
  expect(placement.replaceFootprint).toBe(false);
  expect(placement.replaceRoads.length).toBe(130);
}, 30000);
it('keeps all three tunnels open through the stone body and all66 near lion silhouettes above the posts', async () => {
  const asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file);
    for (const x of [-11, 0, 11])
      expect(nearest(ts, [x, 2, 20], [0, 0, -1]), l.name + ' open arch ' + x).toBe(Infinity);
    expect(nearest(ts, [0, 7, 20], [0, 0, -1]), l.name + ' tall central opening').toBe(Infinity);
    expect(nearest(ts, [0, 9.1, 20], [0, 0, -1]), l.name + ' central solid spandrel').toBeLessThan(
      13,
    );
    for (const x of [-11, 11])
      expect(
        nearest(ts, [x, 4.2, 20], [0, 0, -1]),
        l.name + ' side arch solid upper wall',
      ).toBeLessThan(13);
    if (['street', 'closeup'].includes(l.name))
      for (const x of baliqiaoControls.lionStations)
        for (const side of [-1, 1]) {
          const y = baliqiaoDeckY(x),
            d = nearest(ts, [x, y + 3, side * 7.52], [0, -1, 0]);
          expect(d, l.name + ' lion ' + x + '/' + side).toBeLessThan(1.3);
          expect(d).toBeGreaterThan(0.7);
        }
  }
}, 60000);
it('removes only the modeled historic crossing interval and preserves the separate modern western bridge', async () => {
  const placement = (await read(source + '/placement-report.json')).entry,
    map = await read(source + '/pmtiles-map.json'),
    frame = await read(source + '/map-frame.json'),
    old = map.features.find((f) => f.layer === 'roads' && f.properties.name === '永通桥'),
    modern = map.features.find(
      (f) => f.layer === 'roads' && f.properties.name === '京榆旧线' && f.properties.is_bridge,
    );
  expect(old).toBeDefined();
  expect(modern).toBeDefined();
  const local = ([lon, lat]) => {
      const E =
          (lon - frame.anchor[0]) * 111319.490793 * Math.cos((frame.anchor[1] * Math.PI) / 180),
        S = -(lat - frame.anchor[1]) * 111319.490793;
      return [
        E * Math.cos(frame.heading) - S * Math.sin(frame.heading),
        E * Math.sin(frame.heading) + S * Math.cos(frame.heading),
      ];
    },
    c = Math.cos(frame.heading),
    s = Math.sin(frame.heading),
    point = ([x, z]) => [(c * x + s * z + 220) / 440, (-s * x + c * z + 220) / 440],
    tile = createEmptyTerrainSemanticTile();
  const historic = {
      id: 'historic-service-bridge',
      class: 'minor_road',
      subclass: 'service',
      bridge: true,
      lines: [old.geometry.coordinates.map(local).map(point)],
    },
    separate = {
      id: 'modern-western-bridge',
      class: 'major_road',
      subclass: 'tertiary',
      bridge: true,
      lines: [modern.geometry.coordinates.map(local).map(point)],
    };
  tile.transportation.push(historic, separate);
  const field = heightfieldFromPng(
      await read(source + '/terrain-review.terrain.json'),
      await readFile(source + '/terrain-review.height.png'),
    ),
    result = withoutStructureRoads(
      tile,
      { origin: [-220, -220], tileSize: 440, heightfield: field },
      [{ ...placement, anchor: [0, 0] }],
      1,
    );
  expect(result.transportation.find((f) => f.id === separate.id)).toEqual(separate);
  const pieces = result.transportation.filter((f) => f.id === historic.id).flatMap((f) => f.lines);
  expect(pieces).toHaveLength(2);
  const toLocal = ([u, v]) => {
    const E = u * 440 - 220,
      S = v * 440 - 220;
    return [E * c - S * s, E * s + S * c];
  };
  for (const line of pieces)
    for (const p of line) expect(Math.abs(toLocal(p)[0])).toBeGreaterThanOrEqual(64.9999);
  const endpoints = pieces
    .flatMap((l) => l.map(toLocal))
    .filter((p) => Math.abs(Math.abs(p[0]) - 65) < 0.001);
  expect(endpoints).toHaveLength(2);
}, 30000);
it('rebuilds exact browser tiers with two shared stone graphs and separate GPU streams within budgets', async () => {
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
    expect(l.drawCalls).toBeLessThanOrEqual(3);
    expect(g.images ?? []).toHaveLength(0);
    if (name !== 'skyline')
      for (const graph of ['stone_limestone_raw', 'stone_granite'])
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
