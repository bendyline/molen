import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { buildCiticorp } from '../../worldgen/scripts/signature-tower-citicorp-model.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/dr/dr5/citigroup_center'),
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
  const windowTriangles = [];
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
      return decoded;
    }),
  );
  return { g, values, triangles, windowTriangles };
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
  stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
  stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
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
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
  foliage: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
};
it('reproduces the unchanged detailed master and verifies independent church, tower, supports and signed street frame', async () => {
  const prior = await read(source + '/georeferencing-baseline.json'),
    m = await read(source + '/map-frame.json'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring(surfaces);
  buildCiticorp(a.wrap(b), prior);
  const mesh = b.finalize();
  expect(mesh.triangleCount).toBe(369848);
  const spec = await read(source + '/spec.json');
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(spec.geographicProposal.groundCutout.outline).toEqual([
    [-69.8, -2.05],
    [-69.8, 30.5],
    [-34, 30.5],
    [-34, -2.05],
  ]);
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.heading).toBeCloseTo(-0.515233220358, 12);
  expect(m.geometry.outline).toEqual(prior.geometry.outline);
  expect(m.elements).toHaveLength(24);
  for (const p of m.elements)
    expect(p.geometry).toEqual(prior.elements.find((e) => e.id === p.id).geometry);
  expect(m.elements.find((e) => e.id === 164105516).tags.wikidata).toBe('Q391243');
  expect(m.elements.find((e) => e.id === 258744589).tags.wikidata).toBe('Q107641696');
  expect(m.orientationControl.projectionResidualMeters).toBeLessThan(0.001);
  expect(Math.cos(m.heading)).toBeGreaterThan(0.86);
  expect(-Math.sin(m.heading)).toBeGreaterThan(0.49);
  expect(spec.sourceFacts.heightFeet).toBe(915);
  expect(spec.sourceFacts.plazaLevelsFeet.lower).toBe(-12.5);
  expect(spec.sourceFacts.lpcCompleted).toBe(1978);
  expect(decode(await readFile(source + '/models/source.glb')).g.materials).toHaveLength(4);
}, 60000);
it('keeps continuous ribbon walls, four independent support faces, open underside, sloped closed roof and complete market/church/plaza', async () => {
  const master = decode(await readFile(source + '/models/source.glb')).triangles,
    asset = await read(runtime + '/asset.json');
  const frame = await read(source + '/map-frame.json'),
    project = (p) => {
      const E =
          (p.lon - frame.anchor[0]) * 111319.490793 * Math.cos((frame.anchor[1] * Math.PI) / 180),
        S = -(p.lat - frame.anchor[1]) * 111319.490793;
      return [
        E * Math.cos(frame.heading) - S * Math.sin(frame.heading),
        E * Math.sin(frame.heading) + S * Math.cos(frame.heading),
      ];
    };
  const centers = [258744594, 258744595, 258744596, 258744600].map((id) => {
    const p = frame.elements
      .find((e) => e.id === id)
      .geometry.slice(0, -1)
      .map(project);
    return [0, 1].map(
      (k) => (Math.min(...p.map((v) => v[k])) + Math.max(...p.map((v) => v[k]))) / 2,
    );
  });
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(runtime + '/' + l.file)),
      ts = d.triangles,
      allowance = { skyline: 2, district: 1.2, street: 0.6, closeup: 0.1 }[l.name];
    for (const y of [40.1, 60.3, 127.7, 211.3, 241.2, 253.7])
      for (let k = 0; k < 24; k++) {
        const t = ((k + 0.17) * Math.PI * 2) / 24,
          o = [-30 + 100 * Math.cos(t), y, 6 + 100 * Math.sin(t)],
          v = [-Math.cos(t), 0, -Math.sin(t)],
          target = nearest(master, o, v);
        expect(Number.isFinite(target), l.name + ' source ' + y + '/' + k).toBe(true);
        expect(Math.abs(nearest(ts, o, v) - target), l.name + ' tower ' + y + '/' + k).toBeLessThan(
          allowance,
        );
      }
    for (const [x, z] of centers)
      for (const [o, v] of [
        Math.abs(x + 30) > Math.abs(z - 6)
          ? [
              [x + Math.sign(x + 30) * 10, 33, z],
              [-Math.sign(x + 30), 0, 0],
            ]
          : [
              [x, 33, z + Math.sign(z - 6) * 10],
              [0, 0, -Math.sign(z - 6)],
            ],
      ]) {
        expect(
          Math.abs(nearest(ts, o, v) - (10 - 7.3152 / 2)),
          l.name + ' 24ft support including18mm flat seam',
        ).toBeLessThan(0.025);
      }
    for (const p of [
      [-51, 20, 27],
      [-51, 20, -15],
      [-8, 32, 27],
      [-8, 32, -15],
    ])
      expect(nearest(ts, p, [0, 1, 0]), l.name + ' open underside').toBeCloseTo(35 - p[1], 2);
    for (const [z, y] of [
      [-17, 278.892],
      [0, 263.542],
      [26, 242],
    ])
      expect(nearest(ts, [-30, 310, z], [0, -1, 0]), l.name + ' roof ' + z).toBeCloseTo(310 - y, 2);
    expect(ts.flat().reduce((hi, p) => Math.max(hi, p[1]), 0)).toBeCloseTo(280.592, 3);
    for (const p of [
      [40, 18, -12],
      [18, 20, 15],
      [-12, 3, -25],
      [-64, 4, -20],
      [-60, -3.7, 14],
    ]) {
      const o = [p[0], 350, p[2]],
        v = [0, -1, 0],
        target = nearest(master, o, v);
      expect(Number.isFinite(target), l.name + ' source site ' + p).toBe(true);
      expect(Math.abs(nearest(ts, o, v) - target), l.name + ' site ' + p).toBeLessThan(allowance);
    }
    if (l.name !== 'skyline') expect(d.g.materials.some((m) => m.alphaMode === 'BLEND')).toBe(true);
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
