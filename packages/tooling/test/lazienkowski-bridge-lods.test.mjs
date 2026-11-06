import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import {
  buildLazienkowskiLevel,
  lazienkowskiControls,
  lazienkowskiDeckY,
  lazienkowskiSurfaces,
} from '../../../content/worldgen/source/places/u3/u3q/azienkowski_bridge/models/lazienkowski-model.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { hashBytes } from '../../worldgen/scripts/structure-model-files.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u3/u3q/azienkowski_bridge'),
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
it('rebuilds the source exactly and distinguishes the five-span river unit from the mapped land viaduct and signed lower ramps', async () => {
  const brief = await read(source + '/model-brief.json'),
    spec = await read(source + '/spec.json'),
    frame = await read(source + '/map-frame.json'),
    map = await read(source + '/pmtiles-map.json'),
    alignment = await read(source + '/alignment.json');
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(lazienkowskiSurfaces);
  buildLazienkowskiLevel(a.wrap(b), 'master');
  const mesh = b.finalize(),
    bytes = Buffer.from(encodeGlb(mesh, a.materials(mesh.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(frame.anchor).toEqual([21.049177019, 52.225365347]);
  expect(frame.heading).toBe(0.321568078803);
  expect(
    map.features.some((f) => f.properties.name === 'Most Łazienkowski' && f.properties.is_bridge),
  ).toBe(true);
  expect(map.tiles).toHaveLength(9);
  expect(lazienkowskiControls.riverSpans).toEqual([76.5, 90, 90, 90, 76.5]);
  expect(lazienkowskiControls.riverEnd - lazienkowskiControls.riverStart).toBe(423);
  expect(spec.size[0]).toBeGreaterThan(860);
  expect(alignment.cyclePaths).toHaveLength(3);
  expect(alignment.cyclePaths.some((p) => p.points.some((p) => p[1] > 60))).toBe(true);
  expect(alignment.cyclePaths.some((p) => p.points.some((p) => p[1] < -45))).toBe(true);
  const terrain = await read(source + '/terrain-samples.json');
  for (const x of [-430, 430])
    expect(
      74 + lazienkowskiDeckY(x) - terrain.samples.find((s) => s.x === x).heightMeters,
    ).toBeGreaterThan(1.5);
  const placement = await read(source + '/placement-report.json');
  expect(placement.entry.elevation).toBe(74);
  expect(placement.entry.replaceFootprint).toBe(false);
  expect(placement.entry.replaceRoads.outline).toEqual(frame.geometry.outline);
  expect(placement.entry.bounds).toHaveLength(4);
}, 30000);
it('retains the complete road, separated lower paths, four girder lines and open water at every tier', async () => {
  const asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file);
    for (const x of [-400, -200, 0, 180, 400])
      expect(
        Math.abs(nearest(ts, [x, 32, 3], [0, -1, 0]) - (32 - lazienkowskiDeckY(x) - 0.035)),
        l.name + ' complete road ' + x,
      ).toBeLessThan(0.22);
    for (const z of [-12.2, 13.5])
      expect(nearest(ts, [35, 10, z], [0, -1, 0]), l.name + ' lower path').toBeCloseTo(1.2, 1);
    for (const z of lazienkowskiControls.girderZ)
      expect(nearest(ts, [50, 10, z], [0, 1, 0]), l.name + ' girder').toBeGreaterThan(2.4);
    expect(nearest(ts, [45, 6, 0], [0, 0, 1]), l.name + ' water opening').toBe(Infinity);
    const pierHit = nearest(ts, [11, 6, 20], [0, 0, -1]);
    expect(pierHit, l.name + ' river pier near the transverse bank').toBeGreaterThan(7);
    expect(pierHit, l.name + ' river pier remains present').toBeLessThan(10);
  }
}, 60000);
it('rebuilds all browser tiers with shared surfaces, no embedded images and separate GPU streams within scene budgets', async () => {
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
    expect(l.drawCalls).toBeLessThanOrEqual(4);
    expect(g.images ?? []).toHaveLength(0);
    if (name !== 'skyline')
      expect(
        g.materials.some(
          (m) => m.extras?.molenSurface?.ref === 'matgraph:molen.worldgen.material.concrete_plain',
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
