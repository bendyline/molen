import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  buildHaapsaluRuntime,
  haapsaluChurchPoint,
  haapsaluMuseumOpenings,
  haapsaluParts,
  haapsaluStudy,
} from '../../worldgen/scripts/haapsalu-castle-model.mjs';
import { authoredDetail, authoredSkyline } from '../scripts/authored-landmark-lods.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/ud/ud2/n0309_haapsalu_castle/',
  import.meta.url,
);
const frame = JSON.parse(readFileSync(new URL('map-frame.json', root))),
  k = frame.controls;
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const capture = (fn, d) => {
  const result = [];
  fn(
    {
      addTriangle(slot, _ref, p, n) {
        result.push({ slot, p, n });
      },
    },
    d,
  );
  return result;
};
function hit(origin, direction, p) {
  const a = sub(p[1], p[0]),
    b = sub(p[2], p[0]),
    h = cross(direction, b),
    det = dot(a, h);
  if (Math.abs(det) < 1e-8) return null;
  const q = sub(origin, p[0]),
    u = dot(q, h) / det,
    v = dot(direction, cross(q, a)) / det;
  return u < -1e-5 || v < -1e-5 || u + v > 1.00001 ? null : dot(b, cross(q, a)) / det;
}
const downward = (mesh, p) =>
  mesh
    .map((t) => ({ slot: t.slot, distance: hit([p[0], 50, p[1]], [0, -1, 0], t.p) }))
    .filter((t) => t.distance !== null && t.distance >= 0)
    .sort((a, b) => a.distance - b.distance);

it('preserves exact identity and independently attributed East/South physical controls', () => {
  expect(frame.wikidataId).toBe('Q866154');
  expect(frame.heading).toBe(0);
  const identity = frame.elements.find((e) => e.type === 'node' && e.id === 687056785);
  expect(identity.tags.wikidata).toBe('Q866154');
  expect(frame.elements.find((e) => e.id === 106803938).tags.wikidata).toBe('Q16412871');
  expect(frame.elements.find((e) => e.id === 112303709).tags.height).toBe('38');
  let count = 0;
  for (const feature of frame.geometry.rawFeatures)
    for (let i = 0; i < feature.points.length; i++) {
      const [x, z] = feature.points[i],
        [lon, lat] = feature.coordinates[i];
      const restored = [
        frame.anchor[0] + x / (111319.49079327358 * Math.cos((frame.anchor[1] * Math.PI) / 180)),
        frame.anchor[1] - z / 111319.49079327358,
      ];
      expect(Math.abs(restored[0] - lon) * 111319.49079327358).toBeLessThan(0.001);
      expect(Math.abs(restored[1] - lat) * 111319.49079327358).toBeLessThan(0.001);
      count++;
    }
  expect(count).toBe(146);
  expect(haapsaluStudy.geographic().replaceFootprint).toBe(false);
});

it('covers both nave roof slopes, lower side roofs and projecting baptismal chapel at every level', () => {
  for (const d of [0, 1, 2, 3]) {
    const mesh = capture(haapsaluParts.church, d);
    for (const u of [2, 10, 20, 30, 39])
      for (const v of [1, 4, 8, 12, 16]) {
        const hits = downward(mesh, haapsaluChurchPoint(u, v));
        expect(hits[0]?.slot).toBe('roof');
        expect(50 - hits[0].distance).toBeGreaterThan(19);
      }
    for (const wing of k.church.vestries) {
      const hits = downward(
        mesh,
        haapsaluChurchPoint((wing.u0 + wing.u1) / 2, (wing.v0 + wing.v1) / 2),
      );
      expect(hits[0]?.slot).toBe('roof');
      expect(50 - hits[0].distance).toBeGreaterThan(wing.eavesY);
    }
    const chapel = k.church.baptistry;
    const hits = downward(mesh, [chapel.center[0], chapel.center[1] + chapel.radius * 0.7]);
    expect(hits[0]?.slot).toBe('roof');
    expect(50 - hits[0].distance).toBeGreaterThan(chapel.eavesY);
  }
});

it('keeps the main courtyard open above its paving instead of capping it at the38m envelope height', () => {
  for (const d of [0, 1, 2, 3]) {
    const hits = downward(capture(haapsaluParts.museum, d), [11, -27]);
    expect(hits[0]?.slot).toBe('paving');
    expect(50 - hits[0].distance).toBeCloseTo(k.courtY, 4);
    expect(k.museum.outerTop.every((y) => y < 23)).toBe(true);
  }
});

it('leaves the large west arch clear through the exterior wall and across the lower terrace cap', () => {
  for (const d of [1, 2, 3]) {
    const h = haapsaluMuseumOpenings(d).find((h) => h.id === 'great-west-arch'),
      mesh = capture(haapsaluParts.museum, d);
    for (const height of [4.8, 6, 8, 10]) {
      const origin = h.point(0, height, -h.depth / 2 - 1),
        direction = [h.normal[0], 0, h.normal[1]];
      const hits = mesh
        .map((t) => hit(origin, direction, t.p))
        .filter((v) => v !== null && v > 1e-4 && v < h.depth + 2 - 1e-4);
      expect(hits).toEqual([]);
    }
  }
});

it('emits Float32 nondegenerate faces with normals that follow winding', () => {
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const mesh = capture((out) => buildHaapsaluRuntime(out, level));
    for (const t of mesh) {
      const n = cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0])),
        length = Math.hypot(...n);
      expect(length).toBeGreaterThan(1e-9);
      expect(
        dot(
          n.map((v) => v / length),
          t.n,
        ),
      ).toBeGreaterThan(0.9999);
      for (const p of t.p) for (const v of p) expect(v).toBe(Math.fround(v));
    }
  }
});

it('ships deterministic browser levels inside budgets with shared graphs and no embedded images', async () => {
  const id = 'molen.worldgen.structure.n0309_haapsalu_castle',
    sizes = [];
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
    expect(a.drawCalls).toBeLessThanOrEqual(8);
    const json = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12)));
    expect(json.images ?? []).toHaveLength(0);
    const refs = json.materials.flatMap((m) =>
      m.extras?.molenSurface ? [m.extras.molenSurface.ref] : [],
    );
    if (level === 'skyline') expect(refs).toHaveLength(0);
    else expect(refs).toContain('matgraph:molen.worldgen.material.stone_limestone_weathered');
    sizes.push(a.bytes.length);
  }
  expect(sizes[0] + sizes[1]).toBeLessThan(3_000_000);
});
