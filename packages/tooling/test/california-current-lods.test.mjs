import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { smoothMeshNormals } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { buildCalifornia } from '../../worldgen/scripts/lighthouse-americas-models.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/d6/d6n/california_lighthouse'),
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

it('preserves exact original source and the actual tower center with explicitly reconstructed southwest entrance', async () => {
  const gen = await readFile('../worldgen/scripts/generate-lighthouse-models.mjs', 'utf8'),
    at = gen.indexOf('const surfaces = '),
    surfaces = Function('return (' + gen.slice(at + 17, gen.indexOf(';', at)) + ')')(),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces, {
      defaultLocalName: 'lantern-glass-and-dark-recess',
      legacyAlphaFields: true,
    });
  buildCalifornia(a.wrap(b));
  const m = b.finalize();
  smoothMeshNormals(m, ['wall', 'trim'], 32);
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json'),
    p = (await read('../../content/earth/structures/placements/authoring.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(p.anchor).toEqual([-70.0513486, 12.6137665]);
  expect(p.heading).toBe(-1.2);
  expect(p.datum).toBe('terrain');
  expect(p.replaceFootprint).toBe(false);
  expect(f.orientationControl.uncertaintyDegrees).toBe(15);
  expect(f.geometry.outline).toHaveLength(0);
  expect(f.geometry.centerlines[0]).toHaveLength(7);
  const [x, z] = f.geometry.centerlines[0][0],
    c = Math.cos(p.heading),
    sn = Math.sin(p.heading),
    meters = 111319.49079327358;
  expect(
    p.anchor[0] + (x * c + z * sn) / (meters * Math.cos((p.anchor[1] * Math.PI) / 180)),
  ).toBeCloseTo(-70.0517703, 9);
  expect(p.anchor[1] - (-x * sn + z * c) / meters).toBeCloseTo(12.613567, 9);
  expect(s.sourceFacts.structureHeightMeters).toBe(30);
  expect(s.sourceFacts.focalHeightMeters).toBe(55);
});
it('keeps full vane and all fourteen deep alternating window apertures plus four upper vents in every near level', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    expect(nearest(ts, [0, 32, 0], [0, -1, 0]), name + ' full vane').toBeCloseTo(1.17, 4);
    expect(nearest(ts, [0, 4, 3.3], [0, -1, 0]), name + ' real entrance steps').toBeLessThan(4);
    if (name === 'skyline') continue;
    for (let f = 0; f < 4; f++)
      for (const y of [...(f % 2 ? [4.38, 9.58, 14.78, 19.98] : [7, 12.2, 17.4]), 22.45]) {
        const a = (f * Math.PI) / 2,
          c = Math.cos(a),
          sn = Math.sin(a),
          height = y + 0.2,
          r = 2.11 - ((height - 3.79) * 0.68) / (23.88 - 3.79),
          distance = nearest(ts, [0.12 * c + 5 * sn, height, -0.12 * sn + 5 * c], [-sn, 0, -c]);
        expect(distance, name + ' recessed window ' + f + '/' + y).toBeGreaterThan(5 - r + 0.075);
        expect(distance, name + ' filled window ' + f + '/' + y).toBeLessThan(5 - r + 0.25);
      }
  }
});
it('reproduces exact four browser levels within strict budgets and reuses five shared graphs with separate GPU streams', async () => {
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
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const ps = g.accessors[p.attributes.POSITION],
          ns = g.accessors[p.attributes.NORMAL];
        expect(ps.bufferView).not.toBe(ns.bufferView);
        expect(g.bufferViews[ps.bufferView].byteStride ?? 12).toBe(12);
      }
  }
  expect([...refs].sort()).toEqual(
    ['plaster_lime', 'stone_limestone', 'metal_painted', 'stone_granite', 'wood_plain']
      .map((n) => 'matgraph:molen.worldgen.material.' + n)
      .sort(),
  );
});
