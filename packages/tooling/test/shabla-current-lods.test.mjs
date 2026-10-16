import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { smoothMeshNormals } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { buildShablaMaster } from '../../worldgen/scripts/shabla-detail-model.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/sx/sxs/n0656_shabla_lighthouse'),
  runtime = source.replace('/source/', '/assets/').replace('\\source\\', '\\assets\\');
const read = async (p) => JSON.parse(await readFile(p));
function geometry(b) {
  const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))),
    bin = 28 + b.readUInt32LE(12);
  const array = (i) => {
    const a = g.accessors[i],
      v = g.bufferViews[a.bufferView],
      n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type],
      w = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType],
      p = bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: n }, (_, c) => {
        const at = p + i * (v.byteStride ?? w * n) + c * w;
        return a.componentType === 5126
          ? b.readFloatLE(at)
          : a.componentType === 5125
            ? b.readUInt32LE(at)
            : a.componentType === 5123
              ? b.readUInt16LE(at)
              : b.readUInt8(at);
      }),
    );
  };
  return g.meshes.flatMap((m) =>
    m.primitives.flatMap((p) => {
      const ps = array(p.attributes.POSITION),
        ids = array(p.indices).flat();
      return Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((id) => ps[id]),
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
function hit(o, d, p) {
  const a = sub(p[1], p[0]),
    b = sub(p[2], p[0]),
    h = cross(d, b),
    det = dot(a, h);
  if (det < 1e-8) return null;
  const q = sub(o, p[0]),
    u = dot(q, h) / det,
    v = dot(d, cross(q, a)) / det;
  return u < -0.00001 || v < -0.00001 || u + v > 1.00001 ? null : dot(b, cross(q, a)) / det;
}

const nearest = (ts, o, d) =>
  Math.min(...ts.map((p) => hit(o, d, p)).filter((t) => t !== null && t > 0));
it('keeps both gallery decks open, their railings complete and the full32m tip in all browser levels', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    expect(nearest(ts, [3.6, 15, 3.6], [0, -1, 0]), name + ' lower gallery deck').toBeCloseTo(
      2.77,
      4,
    );
    expect(nearest(ts, [0.4, 12.45, 5], [0, 0, -1]), name + ' open lower gallery').toBeGreaterThan(
      1.5,
    );
    expect(nearest(ts, [0.4, 13.1, 5], [0, 0, -1]), name + ' lower top rail').toBeGreaterThan(0.8);
    expect(nearest(ts, [0.4, 13.1, 5], [0, 0, -1]), name + ' lower top rail').toBeLessThan(1);
    expect(nearest(ts, [0, 33, 0], [0, -1, 0]), name + ' conductor32m').toBeCloseTo(1, 3);
    expect(nearest(ts, [-5, 8, -11], [0, -1, 0]), name + ' complete keeper roof').toBeGreaterThan(
      3,
    );
    expect(nearest(ts, [-5, 8, -11], [0, -1, 0]), name + ' complete keeper roof').toBeLessThan(4.3);
  }
});
it('retains real recessed shaft openings at district, street and closeup', async () => {
  const apothem = (y) => 2.94 - ((y - 12.23) * 1.02) / 17.17;
  for (const name of ['district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    for (const [lo, y] of [
      [12.23, 13.35],
      [17.7, 18.65],
      [23.7, 24.65],
    ]) {
      expect(nearest(ts, [0.14, y, 4], [0, 0, -1]), name + ' recessed aperture').toBeCloseTo(
        4 - apothem(y) * (1 - 0.28 / apothem(lo)),
        4,
      );
    }
  }
});
it('reproduces the original source master and uses municipal tower position with the keeper house to the south', async () => {
  const gen = await readFile('../worldgen/scripts/generate-lighthouse-models.mjs', 'utf8'),
    surfaces = Function(
      'return (' +
        gen.slice(
          gen.indexOf('const surfaces = ') + 17,
          gen.indexOf(';', gen.indexOf('const surfaces = ')),
        ) +
        ')',
    )(),
    b = new MeshBufferBuilder(),
    authoring = createArchitecturalSurfaceAuthoring(surfaces, {
      defaultLocalName: 'lantern-glass-and-dark-recess',
      legacyAlphaFields: true,
    });
  buildShablaMaster(authoring.wrap(b));
  const m = b.finalize();
  smoothMeshNormals(m, ['trim', 'foundation'], 32);
  expect(m.triangleCount).toBe(7738);
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json'),
    p = (await read('../../content/earth/structures/placements.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(p.anchor).toEqual([28.606973081938126, 43.540340797833935]);
  expect(p.heading).toBe(Math.PI - 0.047379);
  expect(p.datum).toBe('terrain');
  expect(p.replaceFootprint).toBe(false);
  expect(f.mappedIdentity.serviceHouseCentroid[1]).toBeLessThan(p.anchor[1]);
  expect(f.mappedIdentity.identityAnchor).not.toEqual(p.anchor);
  const center = f.geometry.outline.reduce((a, b) => a.map((v, i) => v + b[i] / 4), [0, 0]);
  expect(center[0]).toBeCloseTo(-2.0643493377, 8);
  expect(center[1]).toBeCloseTo(-9.8148713641, 8);
  expect(s.sourceFacts.heightMeters).toBe(32);
  expect(f.heightControl.mappedFocalHeightMeters).toBe(36);
});
it('rebuilds budgeted levels with seven reused graphs and no embedded textures', async () => {
  const a = await read(runtime + '/asset.json');
  await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  const refs = new Set();
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    const b = await readFile(runtime + '/' + l.file),
      g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    expect(g.images ?? []).toHaveLength(0);
    for (const m of g.materials)
      if (m.extras?.molenSurface?.ref) refs.add(m.extras.molenSurface.ref);
  }
  expect([...refs].sort()).toEqual(
    [
      'plaster_lime',
      'stone_ashlar',
      'stone_limestone',
      'tile_ceramic',
      'metal_painted',
      'stone_granite',
      'wood_plain',
    ]
      .map((g) => 'matgraph:molen.worldgen.material.' + g)
      .sort(),
  );
});
