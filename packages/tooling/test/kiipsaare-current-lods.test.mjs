import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import {
  kiipsaareHoles,
  kiipsaareRadius,
} from '../../worldgen/scripts/kiipsaare-browser-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u6/u6r/n0643_kiipsaare_lighthouse'),
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
  if (Math.abs(det) < 1e-8) return null;
  const q = sub(o, p[0]),
    u = dot(q, h) / det,
    v = dot(d, cross(q, a)) / det;
  return u < -0.00001 || v < -0.00001 || u + v > 1.00001 ? null : dot(b, cross(q, a)) / det;
}

const tilt = (-2 * Math.PI) / 180,
  pose = ([x, y, z]) => [
    x * Math.cos(tilt) + y * Math.sin(tilt),
    -x * Math.sin(tilt) + y * Math.cos(tilt),
    z,
  ];
it('keeps the true door and stair-window recesses in district, street and closeup', async () => {
  for (const name of ['district', 'street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    for (const h of kiipsaareHoles) {
      const y = h.y + h.h / 2,
        o = pose([0, y, kiipsaareRadius(y) + 1]),
        ds = ts.map((p) => hit(o, [0, 0, -1], p)).filter((t) => t !== null && t > 0 && t < 2);
      expect(ds.length).toBeGreaterThan(0);
      expect(Math.min(...ds), name + ' ' + h.y).toBeGreaterThan(1.2);
      expect(Math.min(...ds)).toBeLessThan(1.4);
    }
  }
});
it('preserves the source master and places the offshore base with an explicit water datum', async () => {
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json'),
    p = (await read('../../content/earth/structures/placements.json')).entries.find(
      (p) => p.asset === s.assetId,
    );
  expect(s.sourceFacts.heightMeters).toBe(26);
  expect(f.anchor).toEqual([21.8410796, 58.4957607]);
  expect(f.mappedIdentity.tags.wikidata).toBe('Q498583');
  expect(f.cameraControl.uncertaintyDegrees).toBe(20);
  expect(p.datum).toBe('sea-level');
  expect(p.elevation).toBe(0);
  expect(p.status).toBe('preview');
  expect(p.heading).toBe(f.heading);
  expect(p.replaceFootprint).toBe(false);
  expect(s.geographicProposal.groundContactReviewed).toBe(true);
  expect(f.limits).toContain('not surveyed');
  const scene = await read(source + '/scene.json');
  expect(scene.entities.find((e) => e.id === 'review-water').components.transform.pos[1]).toBe(
    -0.05,
  );
});
it('rebuilds all browser files within strict budgets and reuses two shared material graphs', async () => {
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
    expect(g.materials.some((m) => m.alphaMode === 'BLEND')).toBe(false);
    for (const m of g.materials)
      if (m.extras?.molenSurface?.ref) refs.add(m.extras.molenSurface.ref);
  }
  expect([...refs].sort()).toEqual(
    ['concrete_plain', 'metal_painted'].map((g) => 'matgraph:molen.worldgen.material.' + g).sort(),
  );
});
