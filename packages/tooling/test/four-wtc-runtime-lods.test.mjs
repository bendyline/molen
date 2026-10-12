import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { fourWorldTradeCenterStudy } from '../../worldgen/scripts/four-world-trade-center-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/dr/dr5/n0218_4_world_trade_center'),
  runtime = source.replace(/([\\/])source([\\/])/, '$1assets$2');
const read = async (p) => JSON.parse(await readFile(p)),
  hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
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
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  marble: { graph: 'stone_marble', slot: 'wall', roughness: 0.78, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
  clear_glass: {
    slot: 'window',
    roughness: 0.12,
    metallic: 0.05,
    opacity: 0.52,
    localRef: 'palette:#feffff',
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.52],
    doubleSided: true,
  },
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
};
it('reproduces preserved original and binds independent signed ground envelope', async () => {
  const prior = await read(`${source}/georeferencing-baseline.json`),
    m = await read(`${source}/map-frame.json`),
    city = await read(`${source}/municipal-footprint.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces, { legacyAlphaFields: true });
  fourWorldTradeCenterStudy.build(a.wrap(b));
  const mesh = b.finalize(),
    mats = a.materials(mesh.groups).map((mat, i) => ({
      ...mat,
      name: mat.sharedSurface
        ? `${mat.sharedSurface.ref.split('.').at(-1)}-${mesh.groups[i].slot}`
        : `${mesh.groups[i].slot}-${mesh.groups[i].slot}`,
    }));
  expect(mesh.triangleCount).toBe(67854);
  expect(hash(Buffer.from(encodeGlb(mesh, mats, 'Molen original 4 World Trade Center')))).toBe(
    'sha256:ea8d66e6a03e5838e8f356a64bc4cda85c108bb40f4cb111228870e40b3fa19b',
  );
  const spec = await read(`${source}/spec.json`),
    asset = await read(`${runtime}/asset.json`);
  expect(hash(await readFile(`${source}/models/source.glb`))).toBe(spec.mesh.sha256);
  expect(asset.sourceHash).toBe(spec.mesh.sha256);
  expect(hash(await readFile(`${runtime}/model.glb`))).toBe(asset.hash);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.heading).toBe(prior.heading);
  expect(m.geometry).toEqual(prior.geometry);
  expect(m.elements[0].id).toBe(278033587);
  expect(m.elements[0].tags.wikidata).toBe('Q1351208');
  expect(city.records[0].bin).toBe('1088795');
  const project = (p) => {
    const r = 6378137,
      f = Math.cos((m.anchor[1] * Math.PI) / 180),
      dx = (((p.lon - m.anchor[0]) * Math.PI) / 180) * r * f,
      dz =
        (-r * Math.asinh(Math.tan((p.lat * Math.PI) / 180)) +
          r * Math.asinh(Math.tan((m.anchor[1] * Math.PI) / 180))) *
        f;
    return [
      Math.cos(m.heading) * dx - Math.sin(m.heading) * dz,
      Math.sin(m.heading) * dx + Math.cos(m.heading) * dz,
    ];
  };
  for (const p of m.elements[0].geometry.map(project))
    expect(
      Math.min(...prior.geometry.outline.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))),
    ).toBeLessThan(0.002);
  expect(m.heading).toBeCloseTo(-0.513459789133, 12);
  expect(spec.reconstruction.lowerPlan[0][0]).toBeLessThan(spec.reconstruction.upperPlan[0][0]);
  expect(spec.sourceFacts.lobbyFinishedCeilingMeters).toBe(14.0208);
  expect(spec.sourceFacts.physicalFloorsCouncil).toBe(65);
  expect(spec.sourceFacts.marketedFloorLabels).toBe(72);
}, 120000);
it('retains outward office plates, northwest terrace void and closed roof', async () => {
  const asset = await read(`${runtime}/asset.json`),
    master = decode(await readFile(`${source}/models/source.glb`));
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(`${runtime}/${l.file}`));
    for (const y of [65, 145, 205, 245, 275])
      for (let k = 0; k < 16; k++) {
        const a = (k * Math.PI) / 8,
          o = [2.6 + 80 * Math.cos(a), y, 2.7 + 80 * Math.sin(a)],
          v = [-Math.cos(a), 0, -Math.sin(a)],
          ref = nearestWithNormal(master.windowTriangles, o, v),
          hit = nearestWithNormal(l.name === 'skyline' ? d.triangles : d.windowTriangles, o, v);
        expect(
          Number.isFinite(ref.distance) && Number.isFinite(hit.distance),
          `${l.name} facade ${y}/${k}`,
        ).toBe(true);
        expect(Math.abs(ref.distance - hit.distance) * Math.abs(dot(v, ref.normal))).toBeLessThan(
          l.errorMeters + 0.02,
        );
        expect(dot(v, hit.normal)).toBeLessThan(0);
      }
    const terrace = nearestWithNormal(d.triangles, [-25, 232, -15], [0, -1, 0]);
    expect(Math.abs(terrace.distance - (232 - 218.559)), `${l.name} terrace`).toBeLessThan(0.02);
    expect(dot([0, -1, 0], terrace.normal)).toBeLessThan(-0.99);
    const removed = nearestWithNormal(
      l.name === 'skyline' ? d.triangles : d.windowTriangles,
      [-60, 240, -15],
      [1, 0, 0],
    );
    expect(removed.distance, `${l.name} genuine northwest upper void`).toBeGreaterThan(45);
    expect(removed.distance).toBeLessThan(65);
    expect(dot([1, 0, 0], removed.normal)).toBeLessThan(0);
    const roof = nearestWithNormal(d.triangles, [0, 315, 0], [0, -1, 0]);
    expect(roof.distance).toBeCloseTo(17.62, 2);
    expect(dot([0, -1, 0], roof.normal)).toBeLessThan(-0.99);
    expect(nearest(d.triangles, [0, 5, 20], [0, -1, 0])).toBeCloseTo(4.88, 2);
    const ys = d.g.meshes
      .flatMap((m) => m.primitives)
      .map((p) => d.g.accessors[p.attributes.POSITION].max[1]);
    expect(Math.max(...ys)).toBeCloseTo(297.7, 4);
    if (l.name !== 'skyline') expect(d.g.materials.some((m) => m.alphaMode === 'BLEND')).toBe(true);
  }
}, 120000);
it('rebuilds four levels byte-identically within download/triangle/draw budgets, with separate vertex streams', async () => {
  const p = resolve(runtime, 'asset.json'),
    asset = await read(p),
    before = await Promise.all(
      asset.runtimeLods.levels.map((l) => readFile(`${runtime}/${l.file}`)),
    );
  await buildModelLandmarkLods(p, { force: true });
  const next = await read(p);
  expect(next.runtimeLods.recipeHash).toBe(asset.runtimeLods.recipeHash);
  expect(next.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThanOrEqual(
    3000000,
  );
  for (const [i, l] of next.runtimeLods.levels.entries()) {
    const bytes = await readFile(`${runtime}/${l.file}`);
    expect(bytes.equals(before[i])).toBe(true);
    expect(hash(bytes)).toBe(l.hash);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(4);
    const { g } = decode(bytes);
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials.filter((m) => m.alphaMode === 'BLEND')).toHaveLength(
      l.name === 'skyline' ? 0 : 1,
    );
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
