import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import {
  buildGrazieLevel,
  grazieArchY,
  grazieControls,
  grazieDeckY,
  grazieGroundY,
  grazieSurfaces,
} from '../../../content/worldgen/source/places/sr/srb/ponte_alle_grazie/models/grazie-model.mjs';
import { createEmptyTerrainSemanticTile, heightfieldFromPng } from '../../terrain/dist/kernel.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { hashBytes } from '../../worldgen/scripts/structure-model-files.mjs';
import { withoutStructureRoads } from '../../worldgen-earth/src/client/structure-geometry.ts';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/sr/srb/ponte_alle_grazie'),
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

it('rebuilds exact source with four asymmetric mapped cutwaters and native-embedded foundations', async () => {
  const brief = await read(source + '/model-brief.json'),
    frame = await read(source + '/map-frame.json'),
    alignment = await read(source + '/alignment.json'),
    grid = await read(source + '/terrain-grid.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(grazieSurfaces);
  buildGrazieLevel(a.wrap(b), 'master');
  const m = b.finalize(),
    bytes = Buffer.from(encodeGlb(m, a.materials(m.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([11.258727686, 43.766196261]);
  expect(frame.heading).toBe(1.250553400381);
  expect(alignment.piers.map((p) => p.station)).toEqual([
    -48.415499999999994, -18.880499999999998, 10.768, 42.852,
  ]);
  expect(alignment.arches).toHaveLength(5);
  for (const p of alignment.piers)
    for (const tip of p.mappedTips) {
      expect(frame.geometry.outline).toContainEqual(tip);
      expect(p.outline).toContainEqual(tip);
    }
  for (const p of alignment.roadLine) expect(Math.abs(p[1])).toBeLessThan(0.6);
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png),
    ts = await triangles(source + '/models/source.glb');
  for (const p of alignment.piers) {
    const min = Math.min(...p.outline.map(([x, z]) => field.sampleHeight(x, z))),
      hit = nearest(ts, [p.station, min - 3, 0], [0, 1, 0]);
    expect(hit).toBeCloseTo(2, 2);
  }
  for (const x of alignment.limits)
    expect(grazieDeckY(x) - field.sampleHeight(x, 0)).toBeGreaterThan(7);
  const placed = (await read(source + '/placement-report.json')).entry;
  expect(placed.elevation).toBe(46);
  expect(placed.replaceFootprint).toBe(false);
  expect(placed.replaceRoads.deckEndpoints).toEqual(alignment.roadLine);
  expect(placed.replaceRoads.outline).toEqual(frame.geometry.outline);
  expect(placed.replaceRoads.includeTransverseBridges).toBe(true);
  expect(alignment.crossingLine).toHaveLength(2);
}, 30000);
it('retains five physical full-width arch passages, continuous road/pavements and all mapped pier tips in every tier', async () => {
  const asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file);
    for (const a of grazieControls.arches) {
      for (const k of [-0.7, 0, 0.7]) {
        const x = a.center + a.halfSpan * k,
          y = grazieArchY(a, x) - 0.7;
        expect(nearest(ts, [x, y, -15], [0, 0, 1]), l.name + ' physical arch').toBe(Infinity);
      }
      for (const z of [0, -6.1, 6.1]) {
        const y = grazieDeckY(a.center) + (z === 0 ? 0 : 0.17),
          hit = nearest(ts, [a.center, y + 2, z], [0, -1, 0]);
        expect(hit).toBeGreaterThan(1.96);
        expect(hit).toBeLessThan(2.04);
      }
    }
    for (const p of grazieControls.piers)
      for (const tip of p.mappedTips) {
        const hit = nearest(ts, [tip[0], 12, tip[1] * 0.94], [0, -1, 0]);
        expect(hit).toBeGreaterThan(1);
        expect(hit).toBeLessThan(4);
      }
    if (l.name !== 'skyline') {
      const x = grazieControls.crossingLine.reduce((s, p) => s + p[0], 0) / 2;
      expect(nearest(ts, [x, grazieDeckY(x) + 2, 0.1], [0, -1, 0])).toBeLessThan(1.99);
      expect(nearest(ts, [x, grazieDeckY(x) + 2, 0.7], [0, -1, 0])).toBeGreaterThan(1.995);
    }
  }
}, 60000);
it('replaces the mapped road and both bridge pavements while retaining the connected riverside streets', async () => {
  const p = (await read(source + '/placement-report.json')).entry,
    map = await read(source + '/pmtiles-map.json'),
    frame = await read(source + '/map-frame.json'),
    local = ([lon, lat]) => {
      const E =
          (lon - frame.anchor[0]) * 111319.490793 * Math.cos((frame.anchor[1] * Math.PI) / 180),
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
        ).map((line) => ({ properties: f.properties, points: line.map(local) })),
      ),
    bridge = roads.filter(
      (r) =>
        r.properties.is_bridge && r.points.some(([x, z]) => Math.abs(x) < 80 && Math.abs(z) < 12),
    ),
    bank = roads.filter((r) =>
      ['Lungarno delle Grazie', 'Lungarno Torrigiani', 'Lungarno Serristori'].includes(
        r.properties.name,
      ),
    );
  expect(bridge).toHaveLength(4);
  expect(bank.length).toBeGreaterThanOrEqual(3);
  const c = Math.cos(p.heading),
    s = Math.sin(p.heading),
    point = ([x, z]) => [(c * x + s * z + 200) / 400, (-s * x + c * z + 200) / 400],
    tile = createEmptyTerrainSemanticTile();
  for (const [i, r] of bridge.entries())
    tile.transportation.push({
      id: 'bridge-' + i,
      class: r.properties.kind,
      subclass: r.properties.kind_detail,
      bridge: true,
      layer: 1,
      lines: [r.points.map(point)],
    });
  for (const [i, r] of bank.entries())
    tile.transportation.push({
      id: 'bank-' + i,
      class: r.properties.kind,
      subclass: r.properties.kind_detail,
      layer: 0,
      lines: [r.points.map(point)],
    });
  const field = heightfieldFromPng(
      await read(source + '/terrain-review.terrain.json'),
      await readFile(source + '/terrain-review.height.png'),
    ),
    result = withoutStructureRoads(
      tile,
      { origin: [-200, -200], tileSize: 400, heightfield: field },
      [{ ...p, anchor: [0, 0] }],
      1,
    );
  for (let i = 0; i < bank.length; i++)
    expect(result.transportation.find((f) => f.id === 'bank-' + i)?.lines).toEqual([
      bank[i].points.map(point),
    ]);
  for (let i = 0; i < bridge.length; i++) {
    const remain = result.transportation.find((f) => f.id === 'bridge-' + i),
      meters = (remain?.lines ?? []).reduce(
        (n, l) =>
          n +
          l.slice(1).reduce((n, q, j) => n + Math.hypot(q[0] - l[j][0], q[1] - l[j][1]) * 400, 0),
        0,
      );
    expect(meters).toBeLessThan(2);
  }
}, 30000);
it('rebuilds all four exact tiers within browser budgets with five shared graphs and separate GPU streams', async () => {
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
      bytes = await readFile(runtime + '/' + l.file),
      g = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    expect(hashBytes(bytes)).toBe(asset.runtimeLods.levels.find((l) => l.name === name).hash);
    expect(l.triangles).toBeLessThanOrEqual(cap);
    expect(l.drawCalls).toBeLessThanOrEqual(6);
    expect(g.images ?? []).toHaveLength(0);
    if (name !== 'skyline')
      for (const graph of [
        'concrete_plain',
        'stone_sandstone',
        'stone_granite',
        'gravel',
        'metal_painted',
      ])
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
