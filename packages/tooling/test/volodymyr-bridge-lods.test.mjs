import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import {
  buildVolodymyrLevel,
  volodymyrControls,
  volodymyrDeckY,
  volodymyrSurfaces,
} from '../../../content/worldgen/source/places/u8/u8v/bridge_over_saint_volodymyr_descent/models/volodymyr-model.mjs';
import { createEmptyTerrainSemanticTile, heightfieldFromPng } from '../../terrain/dist/kernel.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { hashBytes } from '../../worldgen/scripts/structure-model-files.mjs';
import { withoutStructureRoads } from '../../worldgen-earth/src/client/structure-geometry.ts';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve(
    '../../content/worldgen/source/places/u8/u8v/bridge_over_saint_volodymyr_descent',
  ),
  installed = source.replace(/([\\/])source([\\/])/, '$1assets$2'),
  runtime = await runtimeLodFixture(installed);
const read = async (p) => JSON.parse(await readFile(p));
async function triangles(path, solidOnly = false) {
  const d = await new NodeIO().readBinary(await readFile(path));
  return d
    .getRoot()
    .listMeshes()
    .flatMap((m) =>
      m
        .listPrimitives()
        .filter((p) => !solidOnly || p.getMaterial()?.getAlphaMode() !== 'BLEND')
        .flatMap((p) => {
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
it('reconstitutes the exact source and fits both hill ends and column feet to the retained unmodified viewer terrain', async () => {
  const brief = await read(source + '/model-brief.json'),
    frame = await read(source + '/map-frame.json'),
    grid = await read(source + '/terrain-grid.json');
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(volodymyrSurfaces);
  buildVolodymyrLevel(a.wrap(b), 'master');
  const mesh = b.finalize(),
    bytes = Buffer.from(encodeGlb(mesh, a.materials(mesh.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(frame.anchor).toEqual([30.528425311, 50.45519774]);
  expect(frame.heading).toBe(-0.219431849013);
  const legacy = await read(resolve('../../content/earth/structures/georeferencing.json'));
  expect(frame.geometry.outline).toEqual(
    legacy.candidates.find((c) => c.candidateId === 'bridge_over_saint_volodymyr_descent').geometry
      .outline,
  );
  const png = await readFile(source + '/terrain-review.height.png');
  expect(hashBytes(png)).toBe(grid.reviewHeightfieldHash);
  const field = heightfieldFromPng(await read(source + '/terrain-review.terrain.json'), png);
  for (const p of [volodymyrControls.spine[0], volodymyrControls.spine.at(-1)])
    expect(volodymyrDeckY(p[0]) - field.sampleHeight(...p)).toBeCloseTo(0.3, 2);
  for (const p of volodymyrControls.columns)
    expect(p.ground - field.sampleHeight(p.x, p.z)).toBeCloseTo(0, 2);
  const placement = await read(source + '/placement-report.json');
  expect(placement.entry.elevation).toBe(grid.modelDatumElevationMeters);
  expect(placement.entry.replaceFootprint).toBe(false);
  expect(placement.entry.replaceRoads.outline).toEqual(frame.geometry.outline);
  expect(placement.entry.bounds).toHaveLength(4);
}, 30000);
it('retains the bent full deck, real see-through floor openings and both supporting columns at browser tiers', async () => {
  const asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file, true);
    for (const [x, z] of [
      [-80, 4.5],
      [0, 1.5],
      [65, 0],
    ])
      expect(
        Math.abs(nearest(ts, [x, 40, z], [0, -1, 0]) - (40 - volodymyrDeckY(x))),
        l.name + ' complete deck',
      ).toBeLessThan(0.06);
    for (const p of volodymyrControls.columns)
      expect(
        nearest(ts, [p.x, p.ground + 3, p.z + 10], [0, 0, -1]),
        l.name + ' supporting column',
      ).toBeLessThan(10);
    if (l.name !== 'skyline')
      for (const r of volodymyrControls.glassGroups) {
        const u = 1 / 6,
          v = 1 / 4,
          q = [0, 1].map(
            (k) =>
              (1 - v) * ((1 - u) * r[0][k] + u * r[1][k]) + v * ((1 - u) * r[3][k] + u * r[2][k]),
          );
        expect(nearest(ts, [q[0], 40, q[1]], [0, -1, 0]), l.name + ' real floor opening').toBe(
          Infinity,
        );
      }
  }
}, 60000);
it('replaces the mapped upper footbridge without removing the transverse lower descent road', async () => {
  const placement = (await read(source + '/placement-report.json')).entry,
    map = await read(source + '/pmtiles-map.json');
  const frame = await read(source + '/map-frame.json'),
    local = ([lon, lat]) => {
      const E =
          (lon - frame.anchor[0]) * 111319.490793 * Math.cos((frame.anchor[1] * Math.PI) / 180),
        S = -(lat - frame.anchor[1]) * 111319.490793;
      return [
        E * Math.cos(frame.heading) - S * Math.sin(frame.heading),
        E * Math.sin(frame.heading) + S * Math.cos(frame.heading),
      ];
    };
  const f = map.features
    .filter((f) => f.layer === 'roads' && f.properties.name === 'Володимирський узвіз')
    .flatMap((f) =>
      (f.geometry.type === 'MultiLineString'
        ? f.geometry.coordinates
        : [f.geometry.coordinates]
      ).map((points) => ({ points: points.map(local) })),
    )
    .find((r) => r.points.some((p) => Math.abs(p[0] + 57) < 2 && Math.abs(p[1]) < 15));
  expect(f).toBeDefined();
  expect(
    map.features.some(
      (f) =>
        f.properties['name:en'] === 'Bridge over Volodymyrskyi Descent' && f.properties.is_bridge,
    ),
  ).toBe(true);
  const c = Math.cos(placement.heading),
    s = Math.sin(placement.heading),
    point = ([x, z]) => [(c * x + s * z + 180) / 360, (-s * x + c * z + 180) / 360],
    tile = createEmptyTerrainSemanticTile();
  const upper = {
      id: 'upper-cycle-bridge',
      class: 'path',
      subclass: 'cycleway',
      bridge: true,
      layer: 1,
      lines: [volodymyrControls.spine.map(point)],
    },
    lower = {
      id: 'lower-descent-road',
      class: 'major_road',
      subclass: 'secondary',
      layer: 0,
      lines: [f.points.filter((p) => Math.abs(p[0]) < 160 && Math.abs(p[1]) < 160).map(point)],
    };
  tile.transportation.push(upper, lower);
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
  expect(result.transportation.find((f) => f.id === lower.id)).toEqual(lower);
  expect(result.transportation.find((f) => f.id === lower.id).bridgeConnections).toBeUndefined();
  expect(
    result.transportation
      .filter((f) => f.id === upper.id)
      .flatMap((f) => f.lines)
      .flat().length,
  ).toBeLessThan(4);
}, 30000);
it('rebuilds exact browser tiers within budgets using shared graphs, image-free clear glass and separate GPU streams', async () => {
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
    if (name !== 'skyline') {
      expect(
        g.materials.some(
          (m) =>
            m.extras?.molenSurface?.ref ===
            'matgraph:molen.worldgen.material.metal_stainless_polished',
        ),
      ).toBe(true);
      expect(
        g.materials.some(
          (m) =>
            m.alphaMode === 'BLEND' &&
            m.doubleSided &&
            m.pbrMetallicRoughness.baseColorFactor[3] < 0.5,
        ),
      ).toBe(true);
    }
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const a = g.accessors[p.attributes.POSITION],
        n = g.accessors[p.attributes.NORMAL];
      expect(a.bufferView).not.toBe(n.bufferView);
      expect(g.bufferViews[a.bufferView].byteStride ?? 12).toBe(12);
      expect(g.bufferViews[n.bufferView].byteStride ?? 12).toBe(12);
    }
  }
}, 30000);
