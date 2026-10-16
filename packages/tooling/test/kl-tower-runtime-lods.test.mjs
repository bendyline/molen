import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineNext } from '../../worldgen/scripts/signature-tower-next-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/w2/w28/n0161_kuala_lumpur_tower'),
  runtime = source.replace(/([\\/])source([\\/])/, '$1assets$2'),
  read = async (p) => JSON.parse(await readFile(p));
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
  const triangles = g.meshes.flatMap((m) =>
    m.primitives.flatMap((p) => {
      const ps = values(p.attributes.POSITION),
        ids = values(p.indices).flat();
      return Array.from({ length: ids.length / 3 }, (_, i) =>
        ids.slice(i * 3, i * 3 + 3).map((j) => ps[j]),
      );
    }),
  );
  return { g, values, triangles };
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
    return u < 0 || v < 0 || u + v > 1 || t <= 1e-5 ? best : Math.min(best, t);
  }, Infinity);
}

it('reproduces the original master and retains independent shaft, star and signed skybox controls', async () => {
  const m = (
      await read(resolve('../../content/earth/structures/georeferencing.json'))
    ).candidates.find((p) => p.candidateId === 'N0161'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
      pink: { graph: 'metal_painted', slot: 'wall', roughness: 0.5, metallic: 0.12 },
      stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.3, metallic: 1 },
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
    });
  skylineNext.find((p) => p.id === 'N0161').build(a.wrap(b), m);
  const spec = await read(`${source}/spec.json`),
    f = await read(`${source}/map-frame.json`);
  expect(f.wikidataId).toBe('Q745016');
  expect(f.elements).toHaveLength(12);
  expect(f.orientationControl.projectionResidualMeters).toBeLessThan(0.002);
  expect(f.orientationControl.coreWay).toBe(546282150);
  expect(f.orientationControl.arrivalSector.inTowerFootprint).toBe(false);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  expect(f.heading).toBeCloseTo(-0.234247621882, 10);
  // The native directions project back to the independently identified ENE/SSW landmark sectors.
  for (const bearing of f.orientationControl.skyBoxBearingsDegrees) {
    const a = ((bearing - 90) * Math.PI) / 180 + f.heading,
      x = Math.cos(a),
      z = Math.sin(a),
      east = x * Math.cos(f.heading) + z * Math.sin(f.heading),
      north = x * Math.sin(f.heading) - z * Math.cos(f.heading),
      actual = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
    expect(actual).toBeCloseTo(bearing, 7);
  }
});
it('keeps a continuous rose soffit, curved shaft and two suspended glass boxes at every level', async () => {
  const f = await read(`${source}/map-frame.json`),
    [cx, cz] = f.orientationControl.coreCenter,
    asset = await read(`${runtime}/asset.json`);
  for (const path of [
    `${source}/models/source.glb`,
    ...asset.runtimeLods.levels.map((l) => `${runtime}/${l.file}`),
  ]) {
    const { g, triangles: ts } = decode(await readFile(path)),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]),
      allowance = asset.runtimeLods.levels.find((l) => path.endsWith(l.file))?.errorMeters ?? 0.01;
    expect(Math.min(...ps.map((a) => a.min[1]))).toBe(0);
    expect(Math.max(...ps.map((a) => a.max[1]))).toBeCloseTo(421, 3);
    expect(nearest(ts, [cx, 430, cz], [0, -1, 0])).toBeCloseTo(9, 3);
    // Rays between decorative seams catch the original missing surface between isolated chips.
    for (let i = 0; i < 36; i++) {
      const a = ((i + 0.37) * 2 * Math.PI) / 36,
        d = [-Math.cos(a), 0, -Math.sin(a)],
        distance = nearest(ts, [cx + 30 * Math.cos(a), 266.1, cz + 30 * Math.sin(a)], d);
      expect(distance, `${path} continuous soffit azimuth${i}`).toBeGreaterThan(16.4);
      expect(distance, `${path} continuous soffit azimuth${i}`).toBeLessThan(21);
    }
    // Intersection tests accept backfaces. The actual exterior must also face outwards;
    // otherwise the browser culls the soffit even though rays report a closed surface.
    const panels = ts.filter((p) => {
      const ys = p.map((q) => q[1]),
        rs = p.map((q) => Math.hypot(q[0] - cx, q[2] - cz)),
        angles = p.map((q) => Math.atan2(q[2] - cz, q[0] - cx));
      return (
        Math.min(...ys) >= 261.59 &&
        Math.max(...ys) <= 270.61 &&
        Math.min(...rs) > 6.79 &&
        Math.max(...rs) > 8 &&
        angles.some((a) =>
          angles.some((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) > 0.02),
        )
      );
    });
    expect(panels.length, `${path} outward soffit panels`).toBeGreaterThan(10);
    for (const p of panels) {
      const n = cross(sub(p[1], p[0]), sub(p[2], p[0])),
        x = p.reduce((s, q) => s + (q[0] - cx) / 3, 0),
        z = p.reduce((s, q) => s + (q[2] - cz) / 3, 0);
      expect(n[0] * x + n[2] * z, `${path} exterior soffit winding`).toBeGreaterThan(0);
    }
    for (const y of [100, 200, 260]) {
      const a = 0.413,
        dist = nearest(
          ts,
          [cx + 20 * Math.cos(a), y, cz + 20 * Math.sin(a)],
          [-Math.cos(a), 0, -Math.sin(a)],
        ),
        radius = 6.8 + 5.45 * (1 - y / 261.6) ** 2;
      expect(Math.abs(20 - dist - radius), `${path} parabolic shaft at${y}`).toBeLessThan(
        allowance + 0.2,
      );
    }
    for (const bearing of f.orientationControl.skyBoxBearingsDegrees) {
      const a = ((bearing - 90) * Math.PI) / 180 + f.heading,
        x = cx + 26.4 * Math.cos(a),
        z = cz + 26.4 * Math.sin(a);
      expect(nearest(ts, [x, 310, z], [0, -1, 0]), `${path} box roof${bearing}`).toBeCloseTo(
        5.3,
        3,
      );
      expect(
        nearest(ts, [x, 300, z], [0, 1, 0]),
        `${path} suspended glass floor${bearing}`,
      ).toBeCloseTo(2.2, 3);
    }
  }
});
it('rebuilds deterministic budgeted levels with separate GPU vertex streams and shared surfaces', async () => {
  const after = await buildModelLandmarkLods(`${runtime}/asset.json`, { force: true });
  expect(after.levels[0].bytes + after.levels[1].bytes).toBeLessThan(3000000);
  for (const [name, cap] of Object.entries({
    skyline: 1000,
    district: 4000,
    street: 16000,
    closeup: 64000,
  })) {
    const l = after.levels.find((l) => l.name === name),
      b = await readFile(`${runtime}/${l.file}`),
      { g } = decode(b);
    expect(l.triangles).toBeLessThanOrEqual(cap);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
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
