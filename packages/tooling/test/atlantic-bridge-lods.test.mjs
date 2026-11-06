import '../../worldgen/scripts/install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { expect, it } from 'vitest';
import {
  atlanticCenterZ,
  atlanticControls,
  atlanticDeckY,
  atlanticSurfaces,
  buildAtlanticLevel,
} from '../../../content/worldgen/source/places/d1/d1x/atlantic_bridge/models/atlantic-model.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { hashBytes } from '../../worldgen/scripts/structure-model-files.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/d1/d1x/atlantic_bridge'),
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
it('reconstitutes the complete detailed source and preserves the named PMTiles crossing and off-center main span', async () => {
  const brief = await read(source + '/model-brief.json'),
    spec = await read(source + '/spec.json'),
    m = await read(source + '/map-frame.json'),
    alignment = await read(source + '/alignment.json'),
    map = await read(source + '/pmtiles-map.json');
  const b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(atlanticSurfaces);
  buildAtlanticLevel(a.wrap(b), 'master');
  const mesh = b.finalize(),
    bytes = Buffer.from(encodeGlb(mesh, a.materials(mesh.groups), brief.exportLabel));
  expect(hashBytes(bytes)).toBe(brief.expectedDraftMasterHash);
  expect(bytes.equals(await readFile(source + '/models/source.glb'))).toBe(true);
  expect(mesh.triangleCount).toBe(103718);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(m.anchor).toEqual([-79.917758854, 9.307713221]);
  expect(m.heading).toBe(0.148826467718);
  const legacy = await read(resolve('../../content/earth/structures/georeferencing.json'));
  expect(m.geometry.outline).toEqual(
    legacy.candidates.find((c) => c.candidateId === 'atlantic_bridge').geometry.outline,
  );
  expect(map.tiles).toHaveLength(9);
  expect(
    map.features.some((f) => f.properties.name === 'Puente Atlántico' && f.properties.is_bridge),
  ).toBe(true);
  expect(alignment.waterCrossingX).toEqual([-305, 155]);
  expect(atlanticControls.pylons).toEqual([-340, 190]);
  expect(atlanticControls.pylons[1] - atlanticControls.pylons[0]).toBe(530);
  // Approach ends and high western ground must fit the regular terrain samples, not a flat road.
  const terrain = await read(source + '/terrain-samples.json');
  for (const x of [-1570, -1250, 1570])
    expect(
      atlanticDeckY(x) - terrain.samples.find((s) => s.x === x).heightMeters,
    ).toBeGreaterThanOrEqual(1.5);
  const placement = await read(source + '/placement-report.json');
  expect(placement.entry.bounds).toHaveLength(4);
  expect(placement.entry.replaceRoads.deckProfile).toHaveLength(127);
  expect(placement.entry.elevation).toBe(0);
}, 30000);
it('retains both inverted-Y portals, navigation clearance, curved approaches and complete deck at every tier', async () => {
  const asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const ts = await triangles(runtime + '/' + l.file);
    expect(
      ts.flat().reduce((h, p) => Math.max(h, p[1]), 0),
      l.name + ' pylons',
    ).toBeCloseTo(212.5, 3);
    const center = -75,
      z = atlanticCenterZ(center) + 5;
    expect(nearest(ts, [center, 60, z], [0, 1, 0]), l.name + ' navigation opening').toBeCloseTo(
      15,
      2,
    );
    expect(nearest(ts, [center, 100, z], [0, -1, 0]), l.name + ' main roadway').toBeCloseTo(
      100 - 77.825,
      2,
    );
    for (const x of [-340, 190]) {
      const z = atlanticCenterZ(x);
      expect(nearest(ts, [x - 20, 110, z], [1, 0, 0]), l.name + ' open Y portal').toBe(Infinity);
      expect(nearest(ts, [x - 20, 211, z], [1, 0, 0]), l.name + ' closed pylon crown').toBeLessThan(
        20,
      );
    }
    for (const x of [-1500, -1250, -750, 750, 1250, 1500]) {
      const z = atlanticCenterZ(x) + 5,
        y = atlanticDeckY(x);
      expect(
        Math.abs(nearest(ts, [x, y + 5, z], [0, -1, 0]) - 4.975),
        l.name + ' approach ' + x,
      ).toBeLessThan(l.name === 'skyline' ? 1.2 : 0.4);
    }
  }
}, 60000);
it('rebuilds exact pinned LODs within transfer, triangle and draw caps with shared materials and separate GPU streams', async () => {
  const r = await buildModelLandmarkLods(runtime + '/asset.json', { force: true }),
    current = await read(installed + '/asset.json');
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
    expect(hashBytes(bytes)).toBe(current.runtimeLods.levels.find((l) => l.name === name).hash);
    expect(l.triangles).toBeLessThanOrEqual(cap);
    expect(l.drawCalls).toBeLessThanOrEqual(5);
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
