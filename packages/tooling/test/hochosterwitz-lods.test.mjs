import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { heightfieldFromPng } from '../../terrain/dist/kernel.mjs';
import {
  hochosterwitzParts,
  hochosterwitzPlanPoint,
} from '../../worldgen/scripts/hochosterwitz-castle-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/u2/u26/n0301_hochosterwitz_castle/',
  import.meta.url,
);
const read = (p) => JSON.parse(readFileSync(new URL(p, root)));
const frame = read('map-frame.json'),
  k = frame.controls;
const triangles = (part, d) => {
  const out = [];
  hochosterwitzParts[part]({ addTriangle: (slot, _r, p, n) => out.push({ p, n, slot }) }, d);
  return out;
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
function hit(origin, d, p) {
  const e1 = sub(p[1], p[0]),
    e2 = sub(p[2], p[0]),
    h = cross(d, e2),
    det = dot(e1, h);
  if (Math.abs(det) < 1e-8) return null;
  const q = sub(origin, p[0]),
    u = dot(q, h) / det,
    v = dot(d, cross(q, e1)) / det;
  return u < -1e-5 || v < -1e-5 || u + v > 1.00001 ? null : dot(e2, cross(q, e1)) / det;
}
it('rebuilds four bounded browser levels with five shared graphs and no embedded images', async () => {
  const id = 'molen.worldgen.structure.n0301_hochosterwitz_castle',
    bytes = [];
  for (const [level, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const build = () => (level === 'skyline' ? authoredSkyline(id) : authoredDetail(id, level)),
      a = await build(),
      b = await build();
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(a.triangles).toBeLessThanOrEqual(cap);
    bytes.push(a.bytes.length);
    const g = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials.length).toBeLessThanOrEqual(6);
    expect(g.materials.filter((m) => m.extras?.molenSurface)).toHaveLength(
      level === 'skyline' ? 0 : 5,
    );
    const types = new Map();
    for (const m of g.meshes)
      for (const p of m.primitives)
        for (const i of Object.values(p.attributes)) {
          const a = g.accessors[i];
          if (!types.has(a.bufferView)) types.set(a.bufferView, new Set());
          types.get(a.bufferView).add(a.componentType);
        }
    for (const s of types.values()) expect(s.size).toBe(1);
  }
  expect(bytes[0] + bytes[1]).toBeLessThan(3_000_000);
});
it('retains fourteen distinct mapped gate identities and their provisional elevation controls', () => {
  expect(k.gates).toHaveLength(14);
  expect(new Set(k.gates.map((g) => g.way)).size).toBe(14);
  expect(k.gates.map((g) => g.order)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
  for (const g of k.gates) {
    expect(frame.elements.find((e) => e.id === g.way).tags.name).toBe(g.name);
    expect(Number.isFinite(g.baseY)).toBe(true);
    expect(g.passage.length).toBeGreaterThanOrEqual(2);
  }
  expect(k.summitFloorY).toBeGreaterThan(85);
  expect(k.summitFloorY).toBeLessThan(100);
  for (let d = 0; d < 4; d++) {
    const p = triangles('gates', d);
    for (const g of k.gates) {
      const center = g.passage[0].map((v, i) => (v + g.passage[1][i]) / 2);
      expect(
        p.some((t) =>
          t.p.some(
            (v) => Math.hypot(v[0] - center[0], v[2] - center[1]) < 15 && v[1] >= g.baseY - 0.01,
          ),
        ),
      ).toBe(true);
    }
  }
});
it('opens every mapped gate passage at head height in district,street and closeup', () => {
  for (const d of [1, 2, 3]) {
    const mesh = triangles('gates', d);
    for (const g of k.gates)
      for (let i = 0; i < g.passage.length - 1; i++) {
        const a = g.passage[i],
          b = g.passage[i + 1],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          direction = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len],
          origin = [a[0] - direction[0], g.baseY + 1.7, a[1] - direction[2]];
        const hits = mesh
          .map((t) => hit(origin, direction, t.p))
          .filter((t) => t !== null && t > 0.02 && t < len + 1 - 0.02);
        expect(hits, `Gate ${g.order} detail ${d} segment ${i}`).toHaveLength(0);
      }
  }
});
it('keeps the summit courtyard open to the sky across levels', () => {
  for (const d of [0, 1, 2, 3]) {
    const mesh = triangles('summit', d);
    for (const p of [
      [5, 0],
      [13, 9],
      [9, 14],
    ]) {
      const q = hochosterwitzPlanPoint(...p),
        origin = [q[0], k.summitFloorY + 1.7, q[1]];
      expect(
        mesh.map((t) => hit(origin, [0, 1, 0], t.p)).filter((t) => t !== null && t > 0.02),
        `Court at ${p} detail ${d}`,
      ).toHaveLength(0);
    }
  }
});
it('keeps all seven principal west-front window bays visible outside the mapped facade', () => {
  const directionXZ = hochosterwitzPlanPoint(0, 1),
    direction = [directionXZ[0], 0, directionXZ[1]];
  for (const d of [2, 3]) {
    const mesh = triangles('summit', d);
    for (let bay = 0; bay < 7; bay++)
      for (const row of [4.1, 8.3])
        for (const offset of [-0.55, 0, 0.55]) {
          const xz = hochosterwitzPlanPoint(-6.4 + bay * 4.5 + offset, -30),
            origin = [xz[0], k.summitFloorY + row + 1.05, xz[1]],
            hits = mesh
              .map((t) => ({ distance: hit(origin, direction, t.p), slot: t.slot }))
              .filter((t) => t.distance !== null && t.distance > 0)
              .sort((a, b) => a.distance - b.distance);
          expect(hits[0]?.slot, `West bay ${bay + 1}, detail ${d}, offset ${offset}`).toBe('glass');
        }
  }
});
it('keeps the numerical research hill faithful and separate from runtime architecture', () => {
  const desc = read('qa-terrain.json'),
    t = read('terrain-samples.json'),
    f = heightfieldFromPng(desc, readFileSync(new URL('qa-heightmap.png', root)));
  let error = 0;
  for (let row = 0; row < 49; row++)
    for (let col = 0; col < 49; col++)
      error = Math.max(
        error,
        Math.abs(
          f.sampleHeight(-140 + col * 5, -150 + row * 5) -
            (t.grid.heights[row * 49 + col] - k.terrainDatumElevation),
        ),
      );
  expect(error).toBeLessThan(0.004);
  expect(frame.reconstruction.referenceState).toContain('Terrain is supplied by the host');
});
