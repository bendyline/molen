import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { smoothMeshNormals } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { buildHerculesMaster } from '../../worldgen/scripts/hercules-detail-model.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/ez/ezd/tower_of_hercules'),
  runtime = await runtimeLodFixture(
    source.replace('/source/', '/assets/').replace('\\source\\', '\\assets\\'),
  );
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
it('retains forty genuine recessed aperture backs at every near level', async () => {
  for (const name of ['district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    for (let face = 0; face < 4; face++)
      for (let row = 0; row < 5; row++)
        for (const column of [-1, 1]) {
          const a = (face * Math.PI) / 2,
            c = Math.cos(a),
            s = Math.sin(a),
            x = column * 2.25,
            y = 3 + face * 1.575 + row * 6.3 + 1.175,
            z = 6.875;
          expect(
            nearest(ts, [x * c + z * s, y, -x * s + z * c], [-s, 0, -c]),
            name + ' face ' + face + ' row ' + row,
          ).toBeCloseTo(1.3, 4);
        }
  }
});
it('keeps the complete podium, open landing, steps and full-height offset cylinder', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const b = await readFile(runtime + '/model.' + name + '.glb'),
      ts = geometry(b);
    expect(nearest(ts, [8, 5, 8], [0, -1, 0]), name + ' podium top').toBeCloseTo(3.6, 4);
    expect(nearest(ts, [0, 4, 16.75], [0, -1, 0]), name + ' landing steps').toBeCloseTo(2.94, 4);
    expect(nearest(ts, [0, 2, 19], [0, 0, -1]), name + ' parapet opening').toBeGreaterThan(12);
    expect(nearest(ts, [2.5, 56, -2.15], [0, -1, 0]), name + ' lightning rod').toBeCloseTo(1, 3);
  }
});
it('preserves a byte-reproducible original master recipe and an explicitly signed northeast landing', async () => {
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
  buildHerculesMaster(authoring.wrap(b));
  const m = b.finalize();
  smoothMeshNormals(m, ['trim', 'foundation'], 32);

  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json'),
    p = (await read('../../content/earth/structures/placements/authoring.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(f.anchor).toEqual([-8.406524144, 43.385941653]);
  expect(f.mappedIdentity.wikidataId).toBe('Q245151');
  expect(f.orientationControl.rotationDegrees).toBe(180);
  expect(p.heading).toBe(f.orientationControl.previousHeading + Math.PI);
  expect(f.orientationControl.entranceBearingDegrees).toBeCloseTo(58.933224, 5);
  expect(p.status).toBe('preview');
  expect(p.datum).toBe('terrain');
  expect(p.replaceFootprint).toBe(false);
  expect(s.sourceFacts.squareCoreSideMeters).toBe(11.75);
  expect(f.heightControl.excludeMappedHeightMeters).toBe(1);
});
it('rebuilds strict browser budgets with three reused graphs and no embedded images', async () => {
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
    ['stone_ashlar', 'metal_painted', 'stone_granite']
      .map((g) => 'matgraph:molen.worldgen.material.' + g)
      .sort(),
  );
});
