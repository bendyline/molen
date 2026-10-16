import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { smoothMeshNormals } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import {
  eddystoneHoles,
  eddystoneRadius,
} from '../../worldgen/scripts/eddystone-browser-model.mjs';
import { buildEddystoneOriginal } from '../../worldgen/scripts/eddystone-detail-model.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/gb/gbu/n0646_eddystone_lighthouse'),
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
  if (Math.abs(det) < 1e-8) return null;
  const q = sub(o, p[0]),
    u = dot(q, h) / det,
    v = dot(d, cross(q, a)) / det;
  return u < -0.00001 || v < -0.00001 || u + v > 1.00001 ? null : dot(b, cross(q, a)) / det;
}

it('closes the helideck top and underside at every detail level', async () => {
  for (const name of ['skyline', 'district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    for (const [x, z] of [
      [0, 0],
      [3, 2],
      [-3, -2],
      [4, 1],
    ]) {
      const ds = ts.map((p) => hit([x, 50, z], [0, -1, 0], p)).filter((t) => t !== null && t > 0);
      expect(Math.min(...ds), name + ' deck top').toBeGreaterThan(1.15);
      expect(Math.min(...ds)).toBeLessThan(1.22);
      const bs = ts.map((p) => hit([x, 48.3, z], [0, 1, 0], p)).filter((t) => t !== null && t > 0);
      expect(Math.min(...bs), name + ' underside').toBeCloseTo(0.25, 4);
    }
  }
});
it('retains the real staggered door and port recesses in all near levels', async () => {
  for (const name of ['district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    for (const h of eddystoneHoles) {
      const y = h.y + h.h * 0.2,
        a = h.angle,
        r = eddystoneRadius(y),
        o = [(r + 1) * Math.sin(a), y, (r + 1) * Math.cos(a)],
        d = [-Math.sin(a), 0, -Math.cos(a)],
        ds = ts.map((p) => hit(o, d, p)).filter((t) => t !== null && t > 0 && t < 2);
      expect(Math.min(...ds), name + ' port ' + h.y).toBeGreaterThan(1.14);
      expect(Math.min(...ds)).toBeLessThan(1.5);
    }
  }
});
it('preserves a byte-reproducible original master recipe and an explicitly reconstructed sea placement', async () => {
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
  buildEddystoneOriginal(authoring.wrap(b));
  const m = b.finalize();
  smoothMeshNormals(m, ['trim', 'foundation'], 32);
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json'),
    p = (await read('../../content/earth/structures/placements.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(f.anchor).toEqual([-4.2680422, 50.1837523]);
  expect(f.mappedIdentity.tags.wikidata).toBe('Q546122');
  expect(f.positionControl.operatorCoordinate).toEqual([-4.2656, 50.180716666667]);
  expect(f.cameraControl.uncertaintyDegrees).toBe(25);
  expect(p.heading).toBe((-22 * Math.PI) / 180);
  expect(p.datum).toBe('sea-level');
  expect(p.elevation).toBe(0);
  expect(p.status).toBe('preview');
  expect(p.replaceFootprint).toBe(false);
  expect(s.sourceFacts.heightMeters).toBe(49);
  expect(s.sourceFacts.lightHeightAboveMeanHighWaterMeters).toBe(41);
  expect((await read(source + '/scene.json')).entities.some((e) => e.id === 'review-water')).toBe(
    true,
  );
});
it('rebuilds strict browser budgets with four reused graphs and no embedded images', async () => {
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
    ['stone_ashlar', 'metal_painted', 'stone_granite', 'wood_plain']
      .map((g) => 'matgraph:molen.worldgen.material.' + g)
      .sort(),
  );
});
