import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { kihnuPorts, kihnuRadius } from '../../worldgen/scripts/kihnu-browser-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/ud/ud3/n0671_kihnu_lighthouse'),
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
it('retains all 24 real recessed ports after reducing street and closeup meshes', async () => {
  expect(kihnuPorts).toHaveLength(24);
  for (const name of ['street', 'closeup']) {
    const ts = geometry(await readFile(runtime + '/model.' + name + '.glb'));
    for (const h of kihnuPorts) {
      const r = kihnuRadius(h.y),
        radial = [Math.sin(h.angle), 0, Math.cos(h.angle)],
        o = radial.map((v, i) => v * (r + 1) + (i === 1 ? h.y : 0)),
        ds = ts
          .map((p) =>
            hit(
              o,
              radial.map((v) => -v),
              p,
            ),
          )
          .filter((t) => t !== null && t > 0 && t < 2);
      expect(ds.length, name + ' port ' + JSON.stringify(h)).toBeGreaterThan(0);
      expect(Math.min(...ds)).toBeGreaterThan(1.06);
      expect(Math.min(...ds)).toBeLessThan(1.2);
    }
  }
});
it('preserves the original master and the authority-centered, mapped oil-store frame', async () => {
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json');
  expect(s.sourceFacts.heightMeters).toBe(28.3);
  expect(s.nativeAxes.front).toBe('+Z');
  expect(f.heading).toBe(Math.PI);
  expect(f.anchor).toEqual([23.97109316, 58.097058]);
  expect(f.elements.find((e) => e.id === 232111866).geometry).toHaveLength(5);
  const ps = f.geometry.outline.slice(0, -1),
    center = [0, 1].map((i) => ps.reduce((n, p) => n + p[i], 0) / 4);
  expect(center[0]).toBeCloseTo(2.655, 2);
  expect(center[1]).toBeCloseTo(-11.765, 2);
  expect(f.limits).toContain('not a surveyed entrance node');
});
it('reproduces four independent levels within budgets and with six canonical material graphs', async () => {
  const a = await read(runtime + '/asset.json');
  await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3_000_000);
  const graphs = new Set();
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    const b = await readFile(runtime + '/' + l.file);
    const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    for (const m of g.materials)
      if (m.extras?.molenSurface?.ref) graphs.add(m.extras.molenSurface.ref);
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const max = g.accessors[p.attributes.POSITION].max[1];
      expect(max).toBeLessThanOrEqual(28.325);
    }
  }
  expect([...graphs].sort()).toEqual(
    ['brick', 'concrete_plain', 'metal_painted', 'stone', 'stone_granite', 'wood_plain']
      .map((g) => 'matgraph:molen.worldgen.material.' + g)
      .sort(),
  );
});
