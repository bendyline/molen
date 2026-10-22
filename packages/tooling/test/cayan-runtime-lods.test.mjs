import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { runtimeLodFixture } from './fixtures/runtime-lod-fixture.mjs';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { buildCayan } from '../../worldgen/scripts/signature-tower-cayan-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/th/thr/n0202_cayan_tower'),
  runtime = await runtimeLodFixture(source.replace(/([\\/])source([\\/])/, '$1assets$2'));
const read = async (p) => JSON.parse(await readFile(p));
function decode(b) {
  const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))),
    bin = 28 + b.readUInt32LE(12);
  const values = (i) => {
    const a = g.accessors[i],
      v = g.bufferViews[a.bufferView],
      n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type],
      w = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType],
      start = bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: n }, (_, k) => {
        const at = start + i * (v.byteStride ?? n * w) + k * w;
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
  const windowTriangles = [],
    mainTriangles = [];
  const triangles = g.meshes.flatMap((m) =>
    m.primitives.flatMap((p) => {
      const ps = values(p.attributes.POSITION),
        ids = values(p.indices).flat();
      const decoded = Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((j) => ps[j]),
      );
      if (
        g.materials[p.material].pbrMetallicRoughness.roughnessFactor === 0.2 &&
        g.materials[p.material].pbrMetallicRoughness.metallicFactor === 0.28
      )
        windowTriangles.push(...decoded);
      const rough = g.materials[p.material].pbrMetallicRoughness.roughnessFactor;
      if (rough === 0.48 || rough === 0.2) mainTriangles.push(...decoded);
      return decoded;
    }),
  );
  return { g, values, triangles, windowTriangles, mainTriangles };
}
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
function nearest(ts, o, d) {
  return ts.reduce((best, p) => {
    const a = sub(p[1], p[0]),
      b = sub(p[2], p[0]),
      h = cross(d, b),
      det = dot(a, h);
    if (Math.abs(det) < 1e-8) return best;
    const q = sub(o, p[0]),
      u = dot(q, h) / det,
      v = dot(d, cross(q, a)) / det,
      t = dot(b, cross(q, a)) / det;
    return u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7 || t <= 1e-5 ? best : Math.min(best, t);
  }, Infinity);
}

function nearestWithNormal(ts, o, d) {
  let best = { distance: Infinity, normal: [0, 0, 0] };
  for (const p of ts) {
    const t = nearest([p], o, d);
    if (t >= best.distance) continue;
    const n = cross(sub(p[1], p[0]), sub(p[2], p[0])),
      len = Math.hypot(...n);
    best = { distance: t, normal: n.map((v) => v / len) };
  }
  return best;
}
const surfaces = {
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
  screen: { graph: 'metal_perforated_round_open', slot: 'wall', roughness: 0.5, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
  foliage: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
  clear_glass: {
    slot: 'window',
    localRef: 'palette:#feffff',
    roughness: 0.12,
    metallic: 0.05,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.52],
    doubleSided: true,
  },
};
it('reproduces detailed original Cayan and independently signs the northeast podium frame', async () => {
  const prior = await read(source + '/georeferencing-baseline.json'),
    m = await read(source + '/map-frame.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces);
  buildCayan(a.wrap(b));
  const mesh = b.finalize();
  expect(mesh.triangleCount).toBe(489408);
  const spec = await read(source + '/spec.json');
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.heading).toBeCloseTo(0.882804659892, 12);
  expect(m.geometry.outline).toEqual(prior.geometry.outline);
  expect(m.elements).toHaveLength(1);
  expect(m.elements[0].tags.wikidata).toBe('Q391648');
  expect(m.orientationControl.projectionResidualMeters).toBeLessThan(0.001);
  expect(Math.cos(m.heading)).toBeGreaterThan(0.63);
  expect(-Math.sin(m.heading)).toBeLessThan(-0.77);
  expect(spec.sourceFacts.totalTwistDegrees).toBe(90);
  expect(spec.sourceFacts.ownerFloorCount).toBe(73);
  expect(spec.sourceFacts.architectFloorCount).toBe(75);
  const d = decode(await readFile(source + '/models/source.glb'));
  expect(d.g.images).toHaveLength(1);
  expect(d.g.images[0].name).toBe('Canonical metal_perforated_round_open fallback');
  expect(d.g.materials).toHaveLength(4);
}, 60000);
it('keeps six closed twisting walls, recessed near balconies, open lattice crown and attached podium', async () => {
  const master = decode(await readFile(source + '/models/source.glb')).triangles,
    asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(runtime + '/' + l.file)),
      ts = d.triangles,
      allowance = { skyline: 2, district: 2, street: 1.8, closeup: 0.15 }[l.name];
    for (const y of [39, 78, 137, 198, 265, 289])
      for (let k = 0; k < 24; k++) {
        const t = ((k + 0.17) * Math.PI * 2) / 24,
          o = [70 * Math.cos(t), y, 70 * Math.sin(t)],
          v = [-Math.cos(t), 0, -Math.sin(t)],
          hit = nearestWithNormal(master, o, v),
          target = hit.distance;
        expect(Number.isFinite(target), l.name + ' source ' + y + '/' + k).toBe(true);
        expect(
          Math.abs(nearest(ts, o, v) - target) * Math.abs(dot(hit.normal, v)),
          l.name + ' projected wall ' + y + '/' + k,
        ).toBeLessThan(allowance);
      }
    expect(nearest(ts, [10, 320, 10], [0, -1, 0]), l.name + ' open crown').toBeCloseTo(28.3, 1);
    expect(nearest(ts, [0, 320, 3], [0, -1, 0]), l.name + ' mechanical core').toBeCloseTo(21.8, 1);
    expect(ts.flat().reduce((m, p) => Math.max(m, p[1]), 0)).toBeGreaterThanOrEqual(306.3);
    expect(nearest(ts, [27, 40, 18], [0, -1, 0]), l.name + ' northeast podium roof').toBeCloseTo(
      18.9,
      1,
    );

    if (l.name === 'closeup') {
      const ring = [
          [-17.6, -18.48],
          [17.6, -18.48],
          [16.7, 0],
          [19.96, 18.48],
          [-15.24, 18.48],
          [-19.96, 0],
        ],
        yaw = (((66.4 - 6.7) / 285) * Math.PI) / 2,
        c = Math.cos(yaw),
        s = Math.sin(yaw);
      let deep = 0;
      for (let k = 0; k < 96; k++) {
        const t = ((k + 0.13) * Math.PI * 2) / 96,
          o = [70 * Math.cos(t), 66.4, 70 * Math.sin(t)],
          v = [-Math.cos(t), 0, -Math.sin(t)],
          distance = nearest(d.windowTriangles, o, v);
        if (!Number.isFinite(distance)) continue;
        const world = [o[0] + v[0] * distance, o[2] + v[2] * distance],
          p = [world[0] * c + world[1] * s, -world[0] * s + world[1] * c];
        const inset = Math.min(
          ...ring.map((a, i) => {
            const b = ring[(i + 1) % 6],
              dx = b[0] - a[0],
              dz = b[1] - a[1];
            return Math.abs(dx * (p[1] - a[1]) - dz * (p[0] - a[0])) / Math.hypot(dx, dz);
          }),
        );
        if (inset > 1.1 && inset < 2.1) deep++;
      }
      expect(deep, 'near deeply recessed balcony glazing').toBeGreaterThan(2);
    }
    if (['street', 'closeup'].includes(l.name)) {
      const m = d.g.materials.find(
        (m) =>
          m.extras?.molenSurface?.ref ===
          'matgraph:molen.worldgen.material.metal_perforated_round_open',
      );
      expect(m.alphaMode).toBe('MASK');
      expect(m.alphaCutoff).toBe(0.3);
    }
  }
}, 60000);
it('rebuilds four pinned browser levels within transfer/triangle/draw caps with separate GPU streams', async () => {
  const after = await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
  expect(after.levels[0].bytes + after.levels[1].bytes).toBeLessThan(3000000);
  for (const [name, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const l = after.levels.find((l) => l.name === name),
      b = await readFile(runtime + '/' + l.file),
      { g } = decode(b);
    expect(l.triangles).toBeLessThanOrEqual(cap);
    expect(l.drawCalls).toBeLessThanOrEqual(4);
    expect(g.images ?? []).toHaveLength(0);
    for (const p of g.meshes.flatMap((m) => m.primitives)) {
      const pa = g.accessors[p.attributes.POSITION],
        na = g.accessors[p.attributes.NORMAL];
      expect(pa.bufferView).not.toBe(na.bufferView);
      expect(g.bufferViews[pa.bufferView].byteStride ?? 12).toBe(12);
      expect(g.bufferViews[na.bufferView].byteStride ?? 12).toBe(12);
    }
  }
}, 20000);
