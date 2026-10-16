import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { buildKsiazSwiss, ksiazSwissModels } from '../../worldgen/scripts/ksiaz-swiss-models.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

for (const model of ksiazSwissModels) {
  it(`${model.id} preserves deterministic shared-material LODs within browser budgets`, async () => {
    const id = `molen.worldgen.structure.${model.key}`,
      levels = [];
    for (const [name, cap] of Object.entries({
      skyline: 1000,
      district: 4000,
      street: 16000,
      closeup: 64000,
    })) {
      const build = () => (name === 'skyline' ? authoredSkyline(id) : authoredDetail(id, name));
      const a = await build(),
        b = await build();
      expect(a.bytes.equals(b.bytes)).toBe(true);
      expect(a.triangles).toBeLessThanOrEqual(cap);
      const g = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12))),
        types = new Map(),
        positions = [];
      expect(g.images ?? []).toHaveLength(0);
      expect(g.materials).toHaveLength(name === 'skyline' ? 1 : 6);
      if (name !== 'skyline') {
        const shared = g.materials.filter((m) => m.extras?.molenSurface);
        expect(shared).toHaveLength(5);
        for (const m of shared)
          expect(['wall', 'roof', 'foundation', 'trim', 'door']).toContain(
            m.extras.molenSurface.slot,
          );
      }
      for (const m of g.meshes)
        for (const p of m.primitives) {
          positions.push(g.accessors[p.attributes.POSITION]);
          for (const index of Object.values(p.attributes)) {
            const a = g.accessors[index];
            if (!types.has(a.bufferView)) types.set(a.bufferView, new Set());
            types.get(a.bufferView).add(a.componentType);
          }
        }
      for (const t of types.values()) expect(t.size).toBe(1);
      expect(Math.min(...positions.map((a) => a.min[1]))).toBe(0);
      expect(Math.max(...positions.map((a) => a.max[1]))).toBeLessThan(8);
      levels.push(a);
    }
    expect(levels[0].bytes.length + levels[1].bytes.length).toBeLessThan(3_000_000);
  });
}

function barycentric(x, y, t) {
  const [a, b, c] = t,
    den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(den) < 1e-8) return null;
  const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den;
  const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den;
  return u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001 ? [u, v, 1 - u - v] : null;
}

it('keeps the oval window open to view and the hip roof continuous across both houses', () => {
  for (const model of ksiazSwissModels) {
    const frame = JSON.parse(
      readFileSync(
        new URL(
          `../../../content/worldgen/source/places/u3/u35/${model.key}/map-frame.json`,
          import.meta.url,
        ),
      ),
    );
    const loop = frame.geometry.outline.slice(0, -1).filter((a, i, ring) => {
      const b = ring[(i + ring.length - 1) % ring.length],
        c = ring[(i + 1) % ring.length];
      const u = [a[0] - b[0], a[1] - b[1]],
        v = [c[0] - a[0], c[1] - a[1]];
      return Math.abs(u[0] * v[1] - u[1] * v[0]) / (Math.hypot(...u) * Math.hypot(...v)) > 0.02;
    });
    const i = frame.controls.mainDormerWall,
      a = loop[i],
      b = loop[(i + 1) % loop.length];
    const sign = Math.sign(
      loop.reduce(
        (n, p, j) =>
          n + p[0] * loop[(j + 1) % loop.length][1] - loop[(j + 1) % loop.length][0] * p[1],
        0,
      ),
    );
    const angle = Math.atan2(sign * (b[1] - a[1]), -sign * (b[0] - a[0]));
    const local = (p) => {
      const x = p[0] - (a[0] + b[0]) / 2,
        z = p[2] - (a[1] + b[1]) / 2;
      return [
        x * Math.cos(angle) - z * Math.sin(angle),
        p[1],
        x * Math.sin(angle) + z * Math.cos(angle),
      ];
    };
    for (const level of ['skyline', 'district', 'street', 'closeup']) {
      const triangles = [];
      buildKsiazSwiss(
        { addTriangle: (slot, _r, p) => triangles.push({ slot, p, front: p.map(local) }) },
        model.key,
        level,
      );
      for (const x of [-2.8, -1.8, -0.5, 0.5, 1.8, 2.8])
        for (const z of [-2.8, -1.8, -0.5, 0.5, 1.8, 2.8]) {
          expect(
            triangles.some(
              (t) =>
                t.slot === 'tile' &&
                barycentric(
                  x,
                  z,
                  t.p.map((p) => [p[0], p[2]]),
                ),
            ),
          ).toBe(true);
        }
      // Off-center rays avoid the deliberate closeup crossbars in the oval opening.
      for (const [x, y] of [
        [0.15, 5.72],
        [-0.15, 5.32],
      ]) {
        const hits = triangles
          .flatMap((t) => {
            const w = barycentric(x, y, t.front);
            return w
              ? [{ slot: t.slot, depth: w.reduce((n, v, j) => n + v * t.front[j][2], 0) }]
              : [];
          })
          .sort((a, b) => b.depth - a.depth);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].slot).toBe('glass');
      }
    }
  }
});
