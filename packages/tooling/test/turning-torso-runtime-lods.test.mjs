import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from '../../worldgen/scripts/architectural-surface-authoring.mjs';
import { partPlan } from '../../worldgen/scripts/signature-tower-expansion-models.mjs';
import { skylineNext } from '../../worldgen/scripts/signature-tower-next-models.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/u3/u3c/n0158_turning_torso'),
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

it('reproduces the original master and confirms the independent ninety-degree mapped sweep and named entrance', async () => {
  const m = (
      await read(resolve('../../content/earth/structures/georeferencing.json'))
    ).candidates.find((p) => p.candidateId === 'N0158'),
    b = new MeshBufferBuilder(),
    a = createArchitecturalSurfaceAuthoring({
      stone: { graph: 'stone_granite', slot: 'foundation', roughness: 0.85, metallic: 0 },
      metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.48, metallic: 0.24 },
      concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.9, metallic: 0 },
      glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.28 },
    });
  skylineNext.find((p) => p.id === 'N0158').build(a.wrap(b), m);
  const mesh = b.finalize(),
    materials = a.materials(mesh.groups).map((mat, i) => ({
      ...mat,
      name: mat.sharedSurface
        ? `${mat.sharedSurface.ref.split('.').at(-1)}-${mesh.groups[i].slot}`
        : `${mesh.groups[i].slot}-${mesh.groups[i].slot}`,
    }));
  expect(hash(Buffer.from(encodeGlb(mesh, materials, 'Molen original Turning Torso')))).toBe(
    'sha256:be84b21e562aaca4bc4f0f36f0358ed26a4e91315f5d277267c21aff8976f630',
  );
  const spec = await read(`${source}/spec.json`),
    asset = await read(`${runtime}/asset.json`),
    f = await read(`${source}/map-frame.json`);
  expect(hash(await readFile(`${source}/models/source.glb`))).toBe(spec.mesh.sha256);
  expect(asset.sourceHash).toBe(spec.mesh.sha256);
  expect(f.wikidataId).toBe('Q206435');
  expect(f.elements).toHaveLength(11);
  expect(f.orientationControl.projectionResidualMeters).toBeLessThan(0.002);
  expect(f.orientationControl.entrance.id).toBe(1620585234);
  expect(f.orientationControl.entranceLocal[0]).toBeCloseTo(-18.576474, 5);
  expect(spec.geographicProposal.replaceFootprint).toBe(false);
  const core = partPlan(
      f,
      f.elements.find((p) => p.id === 940786326),
    ),
    c = core.reduce((s, p) => s.map((v, i) => v + p[i] / core.length), [0, 0]),
    tip = (p) =>
      p.reduce((a, b) =>
        Math.hypot(a[0] - c[0], a[1] - c[1]) > Math.hypot(b[0] - c[0], b[1] - c[1]) ? a : b,
      ),
    a0 = tip(
      partPlan(
        f,
        f.elements.find((p) => p.id === 30926877),
      ),
    ),
    a1 = tip(
      partPlan(
        f,
        f.elements.find((p) => p.id === 940786325),
      ),
    ),
    angle =
      ((Math.atan2(a1[1] - c[1], a1[0] - c[0]) - Math.atan2(a0[1] - c[1], a0[0] - c[0])) * 180) /
      Math.PI;
  expect(angle).toBeGreaterThan(89);
  expect(angle).toBeLessThan(91);
});
it('retains the complete twisted envelope, visible circular crown and glazed triangular wing at every level', async () => {
  const f = await read(`${source}/map-frame.json`),
    core = partPlan(
      f,
      f.elements.find((p) => p.id === 940786326),
    ),
    c = core.reduce((s, p) => s.map((v, i) => v + p[i] / core.length), [0, 0]),
    base = partPlan(
      f,
      f.elements.find((p) => p.id === 30926877),
    ),
    a = base[0],
    b = base[1],
    v = [b[0] - a[0], b[1] - a[1]],
    len = Math.hypot(...v),
    angle = (((8.2 - 4) / 186) * Math.PI) / 2,
    rot = (p) => [
      p[0] * Math.cos(angle) - p[1] * Math.sin(angle),
      p[0] * Math.sin(angle) + p[1] * Math.cos(angle),
    ],
    r = rot([a[0] + v[0] * 0.3 - c[0], a[1] + v[1] * 0.3 - c[1]]),
    n = rot([-v[1] / len, v[0] / len]),
    o = [c[0] + r[0] + 10 * n[0], 8.2, c[1] + r[1] + 10 * n[1]],
    d = [-n[0], 0, -n[1]];
  for (const path of [
    `${source}/models/source.glb`,
    ...['skyline', 'district', 'street', 'closeup'].map((l) => `${runtime}/model.${l}.glb`),
  ]) {
    const { g, triangles: ts, values } = decode(await readFile(path)),
      ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.min(...ps.map((a) => a.min[1]))).toBe(0);
    expect(Math.max(...ps.map((a) => a.max[1]))).toBeCloseTo(190, 3);
    expect(nearest(ts, [c[0], 205, c[1]], [0, -1, 0]), `${path} circular core crown`).toBeCloseTo(
      15,
      3,
    );
    expect(
      nearest(ts, [c[0] - 8, 205, c[1]], [0, -1, 0]),
      `${path} main ninth-unit roof`,
    ).toBeCloseTo(17, 3);
    const glass = g.meshes
      .flatMap((m) => m.primitives)
      .filter(
        (p) =>
          g.materials[p.material].pbrMetallicRoughness.roughnessFactor === 0.2 ||
          g.materials.length === 1,
      )
      .flatMap((p) => {
        const ps = values(p.attributes.POSITION),
          ids = values(p.indices).flat(),
          colors = values(p.attributes.COLOR_0),
          darkLimit = g.accessors[p.attributes.COLOR_0].componentType === 5121 ? 0.35 * 255 : 0.35;
        return Array.from({ length: ids.length / 3 }, (_, i) => ids.slice(i * 3, i * 3 + 3))
          .filter(
            (js) =>
              g.materials.length > 1 ||
              js.every((j) => Math.max(...colors[j].slice(0, 3)) < darkLimit),
          )
          .map((js) => js.map((j) => ps[j]));
      });
    // Distant levels facet a whole twisted unit instead of each pane. Use the
    // declared approximation allowance when probing that nonplanar glass face.
    const tolerance = path.endsWith('skyline.glb')
      ? 2.3
      : path.endsWith('district.glb')
        ? 1.4
        : 0.2;
    expect(nearest(glass, o, d), `${path} curtain glass near the floor edge`).toBeGreaterThan(
      10 - tolerance,
    );
    expect(nearest(glass, o, d), `${path} curtain-glass floor edge`).toBeLessThan(10 + tolerance);
  }
});
it('rebuilds deterministic budgeted levels with separate GPU vertex streams and shared surfaces', async () => {
  const before = (await read(`${runtime}/asset.json`)).runtimeLods,
    after = await buildModelLandmarkLods(`${runtime}/asset.json`, { force: true });
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
      b = await readFile(`${runtime}/${l.file}`),
      { g } = decode(b);
    expect(hash(b)).toBe(l.hash);
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
