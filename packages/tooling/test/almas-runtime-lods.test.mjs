import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { skylineGlobal } from '../../worldgen/scripts/signature-tower-global-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/th/thr/n0175_almas_tower'),
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

it('reproduces the Almas master and independently checks signed eight-tip placement', async () => {
  const m = await read(`${source}/map-frame.json`),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      foundation: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
      concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
    });
  skylineGlobal.find((p) => p.id === 'N0175').build(a.wrap(b), m);
  const spec = await read(`${source}/spec.json`);
  expect(m.elements).toHaveLength(2);
  expect(m.elements.find((p) => p.id === 1137607706).tags['name:en']).toBe('Almas Tower');
  const geo = m.elements.find((p) => p.id === 1137607706).geometry,
    local = (p) => {
      const E = (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
        S = -(p.lat - m.anchor[1]) * 111319.490793;
      return [
        E * Math.cos(m.heading) - S * Math.sin(m.heading),
        E * Math.sin(m.heading) + S * Math.cos(m.heading),
      ];
    };
  for (let i = 0; i < geo.length; i++) {
    const p = local(geo[i]);
    expect(
      Math.hypot(p[0] - m.geometry.outline[i][0], p[1] - m.geometry.outline[i][1]),
    ).toBeLessThan(0.002);
  }
  // Independent positive-determinant similarity fit, using actual engineer-plan pixel controls.
  const controls = [
    [1, 488, 185],
    [3, 706, 376],
    [7, 800, 596],
    [11, 706, 817],
    [15, 488, 862],
    [20, 272, 817],
    [24, 170, 596],
    [29, 272, 376],
  ].map(([i, x, y]) => [
    x - 488,
    596 - y,
    (geo[i].lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
    (geo[i].lat - m.anchor[1]) * 111319.490793,
  ]);
  const mean = controls.reduce((s, p) => s.map((v, i) => v + p[i] / controls.length), [0, 0, 0, 0]),
    centered = controls.map((p) => p.map((v, i) => v - mean[i])),
    den = centered.reduce((s, [x, y]) => s + x * x + y * y, 0),
    aa = centered.reduce((s, [x, y, E, N]) => s + x * E + y * N, 0) / den,
    bb = centered.reduce((s, [x, y, E, N]) => s + x * N - y * E, 0) / den;
  expect(Math.atan2(bb, aa)).toBeCloseTo(m.heading, 7);
  expect(Math.hypot(aa, bb)).toBeCloseTo(0.24673408188, 7);
  const rms = Math.sqrt(
    centered.reduce(
      (s, [x, y, E, N]) => s + (aa * x - bb * y - E) ** 2 + (bb * x + aa * y - N) ** 2,
      0,
    ) / 16,
  );
  expect(rms).toBeCloseTo(2.092013565, 5);
  expect(aa * aa + bb * bb).toBeGreaterThan(0);
  expect(m.orientationControl.exchangePetalFace).toBe('-Z northeast');
  expect(m.orientationControl.mastEnd).toBe('+X southeast');
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
});
it('keeps both shafts, sloping crowns, elliptical mast and all eight closed podium wings', async () => {
  const asset = await read(`${runtime}/asset.json`),
    m = await read(`${source}/map-frame.json`),
    master = decode(await readFile(`${source}/models/source.glb`)).triangles;
  for (const level of asset.runtimeLods.levels) {
    const { triangles, g } = decode(await readFile(`${runtime}/${level.file}`)),
      allowance = { skyline: 1.5, district: 0.75, street: 0.3, closeup: 0.1 }[level.name];
    for (const y of [25, 40, 80, 150, 220, 245, 275, 290])
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6,
          o = [Math.cos(a) * 120, y, Math.sin(a) * 120],
          d = [-Math.cos(a), 0, -Math.sin(a)],
          t = nearest(master, o, d),
          hit = nearest(triangles, o, d);
        if (!Number.isFinite(t)) expect(hit, level.name).toBe(Infinity);
        else expect(Math.abs(hit - t), `${level.name} shaft ${y}/${i}`).toBeLessThan(allowance);
      }
    for (const [x, z] of [
      [-28, -8],
      [-14, -12],
      [0, -14],
      [3, 11],
      [20, 10],
      [30, 8],
    ]) {
      const o = [x, 400, z],
        d = [0, -1, 0];
      expect(
        Math.abs(nearest(triangles, o, d) - nearest(master, o, d)),
        `${level.name} crown`,
      ).toBeLessThan(allowance);
    }
    for (const y of [302, 318, 336, 338, 350, 359])
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6,
          o = [31.9 + Math.cos(a) * 20, y, 8.5 + Math.sin(a) * 20],
          d = [-Math.cos(a), 0, -Math.sin(a)];
        expect(
          Math.abs(nearest(triangles, o, d) - nearest(master, o, d)),
          `${level.name} mast ${y}/${i}`,
        ).toBeLessThan(allowance);
      }
    for (const [index, [li, ti, ri]] of [
      [0, 1, 2],
      [2, 3, 5],
      [6, 7, 8],
      [9, 11, 12],
      [14, 15, 16],
      [19, 20, 21],
      [23, 24, 25],
      [27, 29, 0],
    ].entries()) {
      const raw = m.elements
          .find((p) => p.id === 1137607706)
          .geometry.map((p) => {
            const E =
                (p.lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
              S = -(p.lat - m.anchor[1]) * 111319.490793;
            return [
              E * Math.cos(m.heading) - S * Math.sin(m.heading),
              E * Math.sin(m.heading) + S * Math.cos(m.heading),
            ];
          }),
        tip = raw[ti],
        q = tip.map((v, i) => v * 0.93 + (raw[li][i] + raw[ri][i]) * 0.035),
        // The triangle interpolates vertex datums; evaluating a curved radial function
        // at the probe instead would invent a curved soffit that is not in the model.
        radialAt = (p) =>
          Math.min(1, Math.max(0, (Math.hypot(...p) - 35) / (Math.hypot(...tip) - 35))),
        radial = 0.93 * radialAt(tip) + 0.035 * radialAt(raw[li]) + 0.035 * radialAt(raw[ri]),
        roof = index === 0 ? 20.85 : 16.65 - radial * 3.5,
        hit = nearest(triangles, [q[0], 30, q[1]], [0, -1, 0]);
      expect(Math.abs(30 - hit - roof), `${level.name} wing ${index}`).toBeLessThan(0.3);
      // Below-roof upward rays must meet each closed cantilever soffit.
      const soffit = 4.1 + radial * (index === 0 ? 6 : 3.1),
        up = nearest(triangles, [q[0], 1, q[1]], [0, 1, 0]);
      expect(Math.abs(1 + up - soffit), `${level.name} soffit ${index}`).toBeLessThan(0.01);
    }
    for (const [x, z] of [
      [-26, 11],
      [26, -11],
    ])
      expect(20 - nearest(triangles, [x, 20, z], [0, -1, 0])).toBeCloseTo(15.4, 3);
    const vertices = triangles.flat();
    expect(vertices.reduce((s, p) => Math.max(s, p[1]), -Infinity)).toBe(360);
    expect(vertices.reduce((s, p) => Math.min(s, p[1]), Infinity)).toBe(0);
    expect(
      vertices.some((p) => Math.abs(p[1] - 279) < 0.01 && Math.hypot(p[0] - 31.9, p[2] - 8.5) < 4),
    ).toBe(true);
    expect(g.materials.every((m) => (m.alphaMode ?? 'OPAQUE') === 'OPAQUE')).toBe(true);
    expect(g.materials.length).toBeLessThanOrEqual(4);
  }
}, 60000);
it('rebuilds all levels deterministically within phone and geometry budgets without duplicated GPU layout', async () => {
  const assetPath = `${runtime}/asset.json`,
    after = await buildModelLandmarkLods(assetPath, { force: true });
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
