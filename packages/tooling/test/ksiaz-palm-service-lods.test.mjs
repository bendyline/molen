import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  buildKsiazPalmService,
  ksiazPalmServiceModels,
} from '../../worldgen/scripts/ksiaz-palm-service-models.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const frame = (m) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../../../content/worldgen/source/places/u3/u35/${m.key}/map-frame.json`,
        import.meta.url,
      ),
    ),
  );
const rings = (f) =>
  [f.geometry.outline, ...f.geometry.components.map((c) => c.outline)].map((p) => p.slice(0, -1));
function inside(x, z, p) {
  let hit = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i],
      b = p[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      hit = !hit;
  }
  return hit;
}
function bary(x, y, t) {
  const [a, b, c] = t,
    den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(den) < 1e-8) return null;
  const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den,
    v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den;
  return u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001 ? [u, v, 1 - u - v] : null;
}
const geometry = (key, level) => {
  const tri = [];
  buildKsiazPalmService({ addTriangle: (slot, _r, p, n) => tri.push({ slot, p, n }) }, key, level);
  return tri;
};
for (const model of ksiazPalmServiceModels) {
  it(`${model.id} builds deterministic, shared-material LODs within mobile budgets`, async () => {
    const id = `molen.worldgen.structure.${model.key}`,
      levels = [];
    for (const [name, cap] of Object.entries({
      skyline: 1000,
      district: 4000,
      street: 16000,
      closeup: 64000,
    })) {
      const build = () => (name === 'skyline' ? authoredSkyline(id) : authoredDetail(id, name)),
        a = await build(),
        b = await build();
      expect(a.bytes.equals(b.bytes)).toBe(true);
      expect(a.triangles).toBeLessThanOrEqual(cap);
      levels.push(a);
      const g = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12))),
        types = new Map(),
        pos = [];
      expect(g.images ?? []).toHaveLength(0);
      expect(g.materials).toHaveLength(name === 'skyline' ? 1 : 6);
      if (name !== 'skyline') {
        const shared = g.materials.filter((m) => m.extras?.molenSurface);
        expect(shared).toHaveLength(5);
        for (const material of shared)
          expect(['wall', 'roof', 'trim', 'foundation', 'window', 'door']).toContain(
            material.extras.molenSurface.slot,
          );
      }
      for (const m of g.meshes)
        for (const p of m.primitives) {
          pos.push(g.accessors[p.attributes.POSITION]);
          for (const i of Object.values(p.attributes)) {
            const v = g.accessors[i];
            if (!types.has(v.bufferView)) types.set(v.bufferView, new Set());
            types.get(v.bufferView).add(v.componentType);
          }
        }
      for (const t of types.values()) expect(t.size).toBe(1);
      expect(Math.min(...pos.map((p) => p.min[1]))).toBe(0);
      expect(Math.max(...pos.map((p) => p.max[1]))).toBeLessThan(17);
    }
    expect(levels[0].bytes.length + levels[1].bytes.length).toBeLessThan(3_000_000);
  });
  it(`${model.id} keeps every mapped component roofed and ground walls closed at every LOD`, () => {
    const f = frame(model);
    for (const level of ['skyline', 'district', 'street', 'closeup']) {
      const tri = geometry(model.key, level),
        roofs = tri.filter((t) => ['tile', 'plaster'].includes(t.slot) && t.n[1] > 0.01);
      for (const ring of rings(f)) {
        const xs = ring.map((p) => p[0]),
          zs = ring.map((p) => p[1]);
        for (let x = Math.min(...xs) + 0.31; x < Math.max(...xs); x += 0.79)
          for (let z = Math.min(...zs) + 0.27; z < Math.max(...zs); z += 0.77) {
            if (!inside(x, z, ring)) continue;
            expect(
              roofs.some((t) =>
                bary(
                  x,
                  z,
                  t.p.map((p) => [p[0], p[2]]),
                ),
              ),
              `${model.id}/${level} roof at ${x},${z}`,
            ).toBe(true);
          }
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length],
            l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (l < 0.01) continue;
          const tangent = [(b[0] - a[0]) / l, (b[1] - a[1]) / l],
            norm = [tangent[1], -tangent[0]];
          for (const t of [0.23, 0.61])
            for (const y of [0.2, 1.9]) {
              const v = a.map((q, k) => q + (b[k] - q) * t),
                candidates = tri.filter((t) =>
                  t.p.every(
                    (p) => Math.abs((p[0] - a[0]) * norm[0] + (p[2] - a[1]) * norm[1]) < 0.002,
                  ),
                );
              expect(
                candidates.some((t) =>
                  bary(
                    (v[0] - a[0]) * tangent[0] + (v[1] - a[1]) * tangent[1],
                    y,
                    t.p.map((p) => [(p[0] - a[0]) * tangent[0] + (p[2] - a[1]) * tangent[1], p[1]]),
                  ),
                ),
                `${model.id}/${level} wall ${i}`,
              ).toBe(true);
            }
        }
      }
    }
  });
}
it('keeps the administration oculus and utility cross-gable visible from their outward facades', () => {
  for (const level of ['district', 'street', 'closeup']) {
    const admin = geometry('ksiaz_palm_administration', level),
      hits = admin
        .flatMap((t) => {
          const w = bary(
            -2.35,
            8.1,
            t.p.map((p) => [p[2], p[1]]),
          );
          return w ? [{ slot: t.slot, depth: w.reduce((s, v, i) => s + v * t.p[i][0], 0) }] : [];
        })
        .sort((a, b) => b.depth - a.depth);
    expect(hits[0].slot).toBe('glass');
    const m = ksiazPalmServiceModels.find((m) => m.component === 'utility-building'),
      f = frame(m),
      p = f.geometry.components[0].outline,
      a = p[0],
      b = p[1],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      area = p.slice(0, -1).reduce((s, a, i) => {
        const b = p[(i + 1) % (p.length - 1)];
        return s + a[0] * b[1] - b[0] * a[1];
      }, 0),
      sign = Math.sign(area),
      n = [(sign * (b[1] - a[1])) / length, (-sign * (b[0] - a[0])) / length],
      u = [n[1], -n[0]],
      center = a.map((v, k) => (v + b[k]) / 2);
    const local = (p) => [
        (p[0] - center[0]) * u[0] + (p[2] - center[1]) * u[1],
        p[1],
        (p[0] - center[0]) * n[0] + (p[2] - center[1]) * n[1],
      ],
      utility = geometry(m.key, level)
        .flatMap((t) => {
          const pts = t.p.map(local),
            w = bary(0.1, 4.65, pts);
          return w ? [{ slot: t.slot, depth: w.reduce((s, v, i) => s + v * pts[i][2], 0) }] : [];
        })
        .sort((a, b) => b.depth - a.depth);
    expect(utility[0].slot).toBe('glass');
  }
});
