import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { smoothMeshNormals } from '../../worldgen/scripts/authored-structure-mesh.mjs';
import { buildLuxor } from '../../worldgen/scripts/signature-tower-luxor-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/9q/9qq/luxor_resort_casino'),
  runtime = source.replace(/([\\/])source([\\/])/, '$1assets$2');
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
  concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
};
it('reproduces unchanged Luxor master and independently signs pyramid, wings, Sphinx and obelisk', async () => {
  const prior = await read(source + '/georeferencing-baseline.json'),
    m = await read(source + '/map-frame.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces);
  buildLuxor(a.wrap(b), prior);
  const mesh = b.finalize();
  smoothMeshNormals(mesh, ['wall'], 30);
  expect(mesh.triangleCount).toBe(271559);
  const spec = await read(source + '/spec.json');
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.heading).toBe(prior.heading);
  expect(m.elements).toHaveLength(28); // Pyramid identity plus all 27 unchanged source parts.
  for (const e of prior.elements)
    expect(m.elements.find((p) => p.id === e.id).geometry).toEqual(e.geometry);
  const project = (p) => {
    const e = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
      south = -(p.lat - m.anchor[1]) * 111319.490793;
    return [
      e * Math.cos(m.heading) - south * Math.sin(m.heading),
      e * Math.sin(m.heading) + south * Math.cos(m.heading),
    ];
  };
  const raw = m.elements.find((e) => e.id === 27858544);
  expect(raw.tags.wikidata).toBe('Q637389');
  expect(raw.tags.height).toBe('111');
  expect(spec.sourceFacts.pyramidHeightMeters).toBe(106.68);
  expect(spec.sourceFacts.modeledGlassBaseMeters).toBe(182.88);
  expect(spec.sourceFacts.contractorBaseFeet).toBe(660);
  expect(spec.sourceFacts.twinTowerFloors).toBe(22);
  for (const p of raw.geometry.map(project))
    expect(
      Math.min(...prior.geometry.outline.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))),
    ).toBeLessThan(0.001);
  const body = m.elements.find((e) => e.id === 118344867),
    head = m.elements.find((e) => e.id === 118344869),
    obel = m.elements.find((e) => e.id === 399368723);
  expect(Math.min(...body.geometry.map(project).map((p) => p[0]))).toBeGreaterThan(99);
  expect(Math.max(...body.geometry.map(project).map((p) => p[0]))).toBeLessThan(179);
  expect(Math.min(...head.geometry.map(project).map((p) => p[0]))).toBeGreaterThan(133);
  expect(Math.min(...obel.geometry.map(project).map((p) => p[0]))).toBeGreaterThan(218);
  expect(obel.tags.height).toBe('62');
  const towers = m.elements.filter((e) => e.tags['building:part']);
  expect(towers).toHaveLength(22);
  expect(towers.every((e) => Math.max(...e.geometry.map(project).map((p) => p[1])) < -80)).toBe(
    true,
  );
  expect(m.heading).toBeCloseTo(0.006126645406, 10);
  expect(decode(await readFile(source + '/models/source.glb')).g.images ?? []).toHaveLength(0);
}, 120000);
it('retains analytic sloping pyramid, all22 step roofs, east Sphinx passage and obelisk at every level', async () => {
  const m = await read(source + '/map-frame.json'),
    asset = await read(runtime + '/asset.json'),
    master = decode(await readFile(source + '/models/source.glb'));
  const project = (p) => {
    const e = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
      south = -(p.lat - m.anchor[1]) * 111319.490793;
    return [
      e * Math.cos(m.heading) - south * Math.sin(m.heading),
      e * Math.sin(m.heading) + south * Math.cos(m.heading),
    ];
  };
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(runtime + '/' + l.file));
    for (const y of [12, 42, 74, 100])
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2,
          dir = [-Math.cos(a), 0, -Math.sin(a)],
          o = [100 * Math.cos(a), y, 100 * Math.sin(a)],
          expected = 100 - (91.44 * (106.68 - y)) / (106.68 - 0.4);
        expect(Math.abs(nearest(d.triangles, o, dir) - expected), l.name + 'pyramid').toBeLessThan(
          0.1,
        );
      }
    for (const part of m.elements.filter((e) => e.tags['building:part'])) {
      const ring = part.geometry.slice(0, -1).map(project),
        x = ring.reduce((n, p) => n + p[0] / ring.length, 0),
        z = ring.reduce((n, p) => n + p[1] / ring.length, 0);
      expect(nearest(d.triangles, [x, 115, z], [0, -1, 0]), l.name + 'roof' + part.id).toBeCloseTo(
        115 - Number(part.tags.height) - 0.22,
        2,
      );
    }
    // The Sphinx body does not fill its transverse entrance passage.
    expect(nearest(d.triangles, [129, 5, 40], [0, 0, -1]), l.name).toBeGreaterThan(80);
    for (const x of [106, 115, 121, 129, 136, 145])
      for (const y of [11, 16]) {
        const o = [x, y, 40],
          v = [0, 0, -1],
          ref = nearestWithNormal(master.triangles, o, v),
          hit = nearestWithNormal(d.triangles, o, v);
        if (!Number.isFinite(ref.distance)) {
          expect(hit.distance).toBe(Infinity);
          continue;
        }
        expect(Number.isFinite(hit.distance)).toBe(true);
        expect(
          Math.abs(hit.distance - ref.distance) * Math.abs(dot(v, ref.normal)),
          l.name + 'body' + x + '/' + y,
        ).toBeLessThanOrEqual(l.errorMeters + 0.015);
      }
    for (const y of [19, 24.65, 27.1, 30.5, 32.5]) {
      const o = [180, y, -0.9],
        v = [-1, 0, 0],
        ref = nearestWithNormal(master.triangles, o, v),
        hit = nearestWithNormal(d.triangles, o, v);
      expect(Number.isFinite(hit.distance), l.name + 'head' + y).toBe(true);
      expect(
        Math.abs(hit.distance - ref.distance) * Math.abs(dot(v, ref.normal)),
        l.name + 'head' + y,
      ).toBeLessThanOrEqual(l.errorMeters + 0.015);
    }
    expect(nearest(d.triangles, [223.7, 60, -1.45], [0, -1, 0]), l.name).toBeCloseTo(17.33, 2);
    // Looking down into the apex reaches the lower lamp well rather than a fabricated solid tip.
    expect(nearest(d.triangles, [0, 115, 0], [0, -1, 0]), l.name).toBeGreaterThan(8.5);
  }
}, 120000);
it('rebuilds four levels within download/triangle/draw budgets and separate vertex streams', async () => {
  const p = resolve(runtime, 'asset.json');
  await buildModelLandmarkLods(p, { force: true });
  const next = await read(p);
  expect(next.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThanOrEqual(
    3000000,
  );
  for (const [i, l] of next.runtimeLods.levels.entries()) {
    const bytes = await readFile(runtime + '/' + l.file);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(4);
    const { g } = decode(bytes);
    expect(g.images ?? []).toHaveLength(0);
    for (const m of g.meshes)
      for (const p of m.primitives) {
        const a = g.accessors[p.attributes.POSITION],
          n = g.accessors[p.attributes.NORMAL];
        expect(a.bufferView).not.toBe(n.bufferView);
        expect(g.bufferViews[a.bufferView].byteStride ?? 12).toBe(12);
        expect(g.bufferViews[n.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
