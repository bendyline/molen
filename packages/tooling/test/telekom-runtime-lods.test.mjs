import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { buildTelekom } from '../../worldgen/scripts/signature-tower-telekom-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/w2/w28/n0201_telekom_tower'),
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

const surfaces = {
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
  concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
  foliage: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
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
it('reproduces unchanged detailed Telekom master and signs antenna versus mapped helipad', async () => {
  const prior = await read(source + '/georeferencing-baseline.json'),
    m = await read(source + '/map-frame.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces);
  buildTelekom(a.wrap(b));
  const mesh = b.finalize(),
    materials = a.materials(mesh.groups).map((mat, i) => ({
      ...mat,
      name: mat.sharedSurface
        ? mat.sharedSurface.ref.split('.').at(-1) + '-' + mesh.groups[i].slot
        : mesh.groups[i].slot + '-' + mesh.groups[i].slot,
    }));
  expect(mesh.triangleCount).toBe(1458078);
  expect(hash(Buffer.from(encodeGlb(mesh, materials, 'Molen original Telekom Tower')))).toBe(
    'sha256:6b3df13bce385db0cf3045a71ac04bd55965e396e4a2151107d8c19c93f304d1',
  );
  const spec = await read(source + '/spec.json'),
    asset = await read(runtime + '/asset.json');
  expect(hash(await readFile(source + '/models/source.glb'))).toBe(spec.mesh.sha256);
  expect(asset.sourceHash).toBe(spec.mesh.sha256);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.heading).toBeCloseTo(-0.826793628665, 12);
  expect(m.geometry.outline).toEqual(prior.geometry.outline);
  expect(m.elements).toHaveLength(6);
  for (const e of m.elements)
    expect(e.geometry).toEqual(prior.elements.find((p) => p.id === e.id).geometry);
  expect(m.elements.find((e) => e.id === 154443873).tags.wikidata).toBe('Q118214');
  expect(m.orientationControl.projectionResidualMeters).toBeLessThan(0.001);
  const heli = m.orientationControl.helipadCircle;
  expect(Math.hypot(heli.center[0] + 1.5, heli.center[1] - 18)).toBeLessThan(0.11);
  expect(Math.abs(heli.radius - 21.2)).toBeLessThan(0.05);
  expect(heli.maxRadialResidual).toBeLessThan(0.27);
  const northRoof = m.elements.find((e) => e.id === 594896248),
    helipad = m.elements.find((e) => e.id === 594858890),
    mean = (e, k) =>
      e.geometry.slice(0, -1).reduce((s, p) => s + p[k] / (e.geometry.length - 1), 0);
  expect(mean(northRoof, 'lat')).toBeGreaterThan(mean(helipad, 'lat'));
  expect(Math.min(...northRoof.geometry.map((p) => p.lon))).toBeLessThan(mean(helipad, 'lon'));
  expect(spec.sourceFacts.heightMeters).toBe(310);
  expect(spec.sourceFacts.helipadMeters).toBe(236);
  expect(spec.sourceFacts.skyGardens).toBe(22);
}, 120000);
it('retains two closed curved wings, open gardens and helipad bowl with unfilled safety grating', async () => {
  const decodedMaster = decode(await readFile(source + '/models/source.glb')),
    master = decodedMaster.triangles,
    main = decodedMaster.mainTriangles,
    asset = await read(runtime + '/asset.json');
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(runtime + '/' + l.file)),
      ts = d.triangles,
      allowance = { skyline: 3, district: 2, street: 1, closeup: 0.15 }[l.name];
    for (const y of [8.2, 54.3, 111.8, 173.4, 211.3])
      for (let k = 0; k < 24; k++) {
        const t = ((k + 0.17) * Math.PI * 2) / 24,
          o = [-8 + 100 * Math.cos(t), y, 100 * Math.sin(t)],
          v = [-Math.cos(t), 0, -Math.sin(t)],
          target = nearest(main, o, v);
        expect(Number.isFinite(target), l.name + ' source ' + y + '/' + k).toBe(true);
        expect(
          Math.abs(nearest(l.name === 'skyline' ? ts : d.mainTriangles, o, v) - target),
          l.name + ' envelope ' + y + '/' + k,
        ).toBeLessThan(allowance);
      }
    for (let k = 0; k < 12; k++) {
      const t = ((k + 0.25) * Math.PI * 2) / 12,
        o = [-1.5 + 60 * Math.cos(t), 230.5, 18 + 60 * Math.sin(t)],
        v = [-Math.cos(t), 0, -Math.sin(t)];
      expect(
        Math.abs(nearest(ts, o, v) - nearest(master, o, v)),
        l.name + ' bowl ' + k,
      ).toBeLessThan(allowance);
    }
    expect(nearest(ts, [-1.5, 250, 18], [0, -1, 0]), l.name + '236m landing disk').toBeCloseTo(
      14,
      1,
    );
    const t = 0.123,
      o = [-1.5 + 20.95 * Math.cos(t), 247, 18 + 20.95 * Math.sin(t)];
    expect(nearest(ts, o, [0, -1, 0]), l.name + ' open grating hole').toBeGreaterThan(12);
    expect(ts.flat().reduce((m, p) => Math.max(m, p[1]), 0)).toBeGreaterThanOrEqual(310);
    // Two opposed triangular gardens stay separate from each other and from the core.
    const levels = [
      13, 22.85, 32.7, 42.55, 52.4, 62.25, 72.1, 81.95, 91.8, 101.65, 111.5, 121.35, 131.2, 141.05,
      150.9, 160.75, 170.6, 180.45, 190.3, 200.15, 210, 219.85,
    ];
    for (const y of levels)
      expect(
        ts.some((p) => p.every((v) => Math.abs(v[1] - y) < 0.001)),
        l.name + ' garden deck ' + y,
      ).toBe(true);
    if (l.name !== 'skyline') expect(d.g.materials.some((m) => m.alphaMode === 'BLEND')).toBe(true);
  }
}, 60000);
it('rebuilds four pinned browser levels within transfer/triangle/draw caps with separate GPU streams', async () => {
  const before = (await read(runtime + '/asset.json')).runtimeLods,
    after = await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
  expect(after.recipeHash).toBe(before.recipeHash);
  expect(after.levels.map((l) => l.hash)).toEqual(before.levels.map((l) => l.hash));
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
    expect(hash(b)).toBe(l.hash);
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
