import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';

const source = resolve('../../content/worldgen/source/places/u6/u6r/ristna_lighthouse'),
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

it('preserves all sixteen service ports and four stair windows at both near levels', async () => {
  const holes = [
    ...Array.from({ length: 16 }, (_, i) => ({
      angle: (i * Math.PI * 2) / 16,
      y: 21.355,
      r: 2.49,
      depth: 0.035,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      angle: 0,
      y: 4.005 + i * 4.55,
      r: 1.16,
      depth: 0.055,
    })),
  ];
  for (const name of ['street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    for (const h of holes) {
      const radial = [Math.sin(h.angle), 0, Math.cos(h.angle)],
        o = radial.map((v, i) => v * (h.r + 1) + (i === 1 ? h.y : 0)),
        ds = ts
          .map((p) =>
            hit(
              o,
              radial.map((v) => -v),
              p,
            ),
          )
          .filter((t) => t !== null && t > 0 && t < 2);
      expect(ds.length).toBeGreaterThan(0);
      expect(Math.min(...ds), name + ' ' + JSON.stringify(h)).toBeGreaterThan(1 + h.depth * 0.7);
      expect(Math.min(...ds)).toBeLessThan(1 + h.depth * 2);
    }
  }
});
it('retains the exact source master and distinguishes authority location from reconstructed orientation', async () => {
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json');
  expect(s.sourceFacts.heightMeters).toBe(27.2);
  expect(s.sourceFacts.structuralRibs).toBe(8);
  expect(s.sourceFacts.basis).toContain('Mehikoorma');
  expect(f.anchor).toEqual([22.05526516, 58.9400605]);
  expect(f.heading).toBe(0.7853981634);
  expect(f.geometry.centerlines[0]).toHaveLength(2);
  expect(f.limits).toContain('no mapped tower footprint or surveyed doorway azimuth');
  expect(f.evidenceDate).toBe('2026-09-28T01:56:51Z');
});
it('reproduces independent budgeted browser levels with three canonical shared textures', async () => {
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
    if (i > 1) {
      expect(
        g.materials.some(
          (m) => m.alphaMode === 'BLEND' && m.pbrMetallicRoughness.baseColorFactor[3] === 0.22,
        ),
      ).toBe(true);
      for (const p of g.meshes.flatMap((m) => m.primitives))
        expect(g.accessors[p.attributes.POSITION].max[1]).toBeLessThan(27.201);
    }
  }
  expect([...refs].sort()).toEqual(
    ['plaster_lime', 'metal_painted', 'stone_granite']
      .map((g) => 'matgraph:molen.worldgen.material.' + g)
      .sort(),
  );
});
