import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineWorld } from '../../worldgen/scripts/signature-tower-world-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/xn/xn7/n0189_yokohama_landmark_tower'),
  runtime = source.replace(/([\\/])source([\\/])/, '$1assets$2'),
  read = async (p) => JSON.parse(await readFile(p)),
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
  const doorTriangles = [],
    windowTriangles = [];
  const triangles = g.meshes.flatMap((m) =>
    m.primitives.flatMap((p) => {
      const ps = values(p.attributes.POSITION),
        ids = values(p.indices).flat(),
        colors = values(p.attributes.COLOR_0),
        divisor = g.accessors[p.attributes.COLOR_0].componentType === 5126 ? 1 : 255;
      for (let i = 0; i < ids.length; i += 3) {
        const js = ids.slice(i, i + 3);
        if (
          js.every((j) =>
            [0.14, 0.23, 0.27].every((v, k) => Math.abs(colors[j][k] / divisor - v) < 0.005),
          )
        )
          doorTriangles.push(js.map((j) => ps[j]));
      }
      const decoded = Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((j) => ps[j]),
      );
      if (g.materials[p.material].name.startsWith('window')) windowTriangles.push(...decoded);
      return decoded;
    }),
  );
  return { g, values, triangles, doorTriangles, windowTriangles };
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

it('reproduces unchanged Yokohama master and independently signs the tower-only mapped envelope', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
      cladding: { graph: 'stone_granite', slot: 'wall', roughness: 0.8, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
      concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
    });
  skylineWorld.find((p) => p.id === 'N0189').build(a.wrap(b), m);
  const mesh = b.finalize(),
    materials = a.materials(mesh.groups).map((mat, i) => ({
      ...mat,
      name: mat.sharedSurface
        ? `${mat.sharedSurface.ref.split('.').at(-1)}-${mesh.groups[i].slot}`
        : `${mesh.groups[i].slot}-${mesh.groups[i].slot}`,
    }));
  expect(
    hash(Buffer.from(encodeGlb(mesh, materials, 'Molen original Yokohama Landmark Tower'))),
  ).toBe('sha256:317f1d8b3dcec33203c05628f2bc4b5e5560b2c87dc271f34936a07d68a8e333');
  const baseline = await read(`${source}/georeferencing-baseline.json`),
    spec = await read(`${source}/spec.json`),
    asset = await read(`${runtime}/asset.json`);
  expect(hash(await readFile(`${source}/models/source.glb`))).toBe(spec.mesh.sha256);
  expect(asset.sourceHash).toBe(spec.mesh.sha256);
  expect(spec.fidelityTarget).toBe('medium-fi');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(m.heading).toBeCloseTo(-0.9963155525273629, 12);
  expect(m.geometry.outline).toEqual(baseline.geometry.outline);
  expect(m.elements).toHaveLength(1);
  expect(m.elements[0].id).toBe(64891750);
  expect(m.elements[0].tags.wikidata).toBe('Q587108');
  expect(m.elements[0].geometry).toEqual(baseline.elements[0].geometry);
  for (const p of m.elements[0].geometry) {
    const E = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
      S = -(p.lat - m.anchor[1]) * 111319.490793,
      q = [
        E * Math.cos(m.heading) - S * Math.sin(m.heading),
        E * Math.sin(m.heading) + S * Math.cos(m.heading),
      ];
    expect(
      Math.min(...baseline.geometry.outline.map((v) => Math.hypot(...sub(v, q)))),
    ).toBeLessThan(0.002);
  }
  expect(Math.cos(m.heading)).toBeGreaterThan(0.5);
  expect(-Math.sin(m.heading)).toBeGreaterThan(0.8);
  expect(spec.sourceFacts.twentiethFloorPlanWidthMeters).toBeCloseTo(19.66 + 27 + 19.66, 8);
  expect(decode(await readFile(`${source}/models/source.glb`)).g.materials).toHaveLength(3);
}, 60000);
it('retains tapered ribbon faces, folded datums, four recessed crown piers and two-sided canopies', async () => {
  const detailed = decode(await readFile(`${source}/models/source.glb`)),
    master = detailed.triangles,
    asset = await read(`${runtime}/asset.json`);
  const canopy = master.filter(
    (t) =>
      t.every((p) => p[1] >= 4.0499 && p[1] <= 4.5001) &&
      t.some((p) => Math.abs(p[1] - 4.05) < 0.0001) &&
      t.some((p) => Math.abs(p[1] - 4.5) < 0.0001),
  );
  expect(canopy).toHaveLength(16);
  expect(canopy.filter((t) => cross(sub(t[1], t[0]), sub(t[2], t[0]))[1] > 0)).toHaveLength(8);
  const y20 = 83.5,
    radius = 45 - nearest(master, [45, y20, 32.5], [-1, 0, 0]);
  expect(Math.abs(radius * 2 - 66.32)).toBeLessThan(0.1);
  for (const level of asset.runtimeLods.levels) {
    const { triangles, g } = decode(await readFile(`${runtime}/${level.file}`)),
      allowance = { skyline: 1.5, district: 0.75, street: 0.3, closeup: 0.1 }[level.name];
    // Near-cardinal rays measure broad/chamfered ribbon faces; the intentionally
    // proud coarse corner slit patches and omitted fine hardware are excluded.
    for (const y of [18.1, 39.7, 67.2, 89.4, 116.2, 147.1, 176.4, 194.2, 220.3, 252.1, 275.4])
      for (let q = 0; q < 4; q++)
        for (const offset of [-0.3, -0.08, 0.08, 0.3]) {
          const a = (q * Math.PI) / 2 + offset,
            o = [60 * Math.cos(a), y, 60 * Math.sin(a)],
            d = [-Math.cos(a), 0, -Math.sin(a)],
            target = nearest(master, o, d),
            hit = nearest(triangles, o, d);
          expect(Number.isFinite(target)).toBe(true);
          expect(Math.abs(hit - target), `${level.name} ${y}/${q}/${offset}`).toBeLessThan(
            allowance,
          );
        }
    for (const [x, z] of [
      [0, 0],
      [3, 3],
      [-3, -3],
    ])
      expect(
        Math.abs(nearest(triangles, [x, 300, z], [0, -1, 0]) - 13.5),
        `${level.name} central roof`,
      ).toBeLessThan(0.04);
    for (const [x, z] of [
      [24, 24],
      [24, -24],
      [-24, 24],
      [-24, -24],
    ])
      expect(
        Math.abs(nearest(triangles, [x, 300, z], [0, -1, 0]) - 3.7),
        `${level.name} crown pier`,
      ).toBeLessThan(0.01);
    for (const y of [293, 295])
      expect(nearest(triangles, [0, y, 60], [0, 0, -1]), `${level.name} crown recess`).toBe(
        Infinity,
      );
    for (const y of [27.8, 125.2, 205.3])
      for (const x of [-9.2, 5.1])
        expect(
          Math.abs(
            nearest(triangles, [x, y, 60], [0, 0, -1]) - nearest(master, [x, y, 60], [0, 0, -1]),
          ),
          `${level.name} folded feature`,
        ).toBeLessThan(allowance);
    const tops = triangles.filter(
      (t) =>
        t.every((p) => p[1] >= 4.0499 && p[1] <= 4.5001) &&
        t.some((p) => Math.abs(p[1] - 4.05) < 0.0001) &&
        t.some((p) => Math.abs(p[1] - 4.5) < 0.0001),
    );
    expect(tops).toHaveLength(16);
    const upward = (t) => cross(sub(t[1], t[0]), sub(t[2], t[0]))[1] > 0;
    expect(tops.filter(upward)).toEqual(canopy.filter(upward));
    for (const d of [
      [0, -1, 0],
      [0, 1, 0],
    ]) {
      const o = [4, d[1] < 0 ? 6 : 3, 34];
      expect(Math.abs(nearest(triangles, o, d) - nearest(master, o, d))).toBeLessThan(0.01);
    }
    expect(g.materials.every((p) => p.alphaMode !== 'BLEND')).toBe(true);
    const hi = triangles.flat().reduce((n, p) => Math.max(n, p[1]), -Infinity);
    expect(Math.abs(hi - 296.3)).toBeLessThan(0.01);
  }
}, 60000);
it('rebuilds four levels within browser ceilings and avoids duplicated interleaved GPU uploads', async () => {
  const assetPath = `${runtime}/asset.json`,
    before = (await read(assetPath)).runtimeLods,
    after = await buildModelLandmarkLods(assetPath, { force: true });
  expect(after.recipeHash).toBe(before.recipeHash);
  expect(after.levels.map((l) => l.hash)).toEqual(before.levels.map((l) => l.hash));
  expect(after.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [name, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const l = after.levels.find((l) => l.name === name),
      b = await readFile(`${runtime}/${l.file}`),
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
}, 60000);
