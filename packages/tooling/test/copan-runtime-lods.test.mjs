import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import { encodeAuthoredAssembly } from '../../worldgen/scripts/authored-glb-assembly.mjs';
import { compactAuthoredMesh } from '../../worldgen/scripts/compact-authored-mesh.mjs';
import { copan } from '../../worldgen/scripts/copan-model.mjs';
import { MATERIAL_REPEAT_METERS } from '../../worldgen/scripts/standard-materials.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/6g/6gy/n0223_edificio_copan'),
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
  mosaic: { graph: 'tile_mosaic', slot: 'wall', roughness: 0.38, metallic: 0 },
  concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.91, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.84, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.65, metallic: 0 },
  stainless: { graph: 'metal_stainless', slot: 'trim', roughness: 0.31, metallic: 1 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.22, metallic: 0 },
  shadow: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
};
function preservedAuthoring(builder) {
  const used = new Map();
  function prepare(s, _p, n, fallback) {
    const surface = surfaces[s],
      ref = surface.graph ? `matgraph:molen.worldgen.material.${surface.graph}` : 'palette:#ffffff';
    used.set(`${surface.slot}:${ref}`, surface);
    const len = Math.hypot(...n),
      normal = n.map((v) => v / len),
      axis = Math.abs(normal[1]) < 0.98 ? [normal[2], 0, -normal[0]] : [1, 0, 0],
      ulen = Math.hypot(...axis),
      u = axis.map((v) => v / ulen),
      raw = cross(normal, u),
      vlen = Math.hypot(...raw),
      v = raw.map((x) => x / vlen),
      repeat = surface.graph ? MATERIAL_REPEAT_METERS[surface.graph] : [1, 1];
    const uv = surface.graph
      ? (q) => [dot(q, u) / repeat[0], (Math.abs(normal[1]) < 0.98 ? q[1] : dot(q, v)) / repeat[1]]
      : fallback;
    return { surface, ref, uv };
  }
  return {
    wrap: {
      addQuad(s, _r, p, n, uv, c) {
        const a = prepare(s, p, n, (q) => uv[p.indexOf(q)]);
        builder.addQuad(a.surface.slot, a.ref, p, n, p.map(a.uv), c);
      },
      addTriangle(s, _r, p, n, uv, c) {
        const a = prepare(s, p, n, (q) => uv[p.indexOf(q)]);
        builder.addTriangle(a.surface.slot, a.ref, p, n, p.map(a.uv), c);
      },
      addConvexPolygon(s, _r, p, n, uv, c) {
        const a = prepare(s, p, n, uv);
        builder.addConvexPolygon(a.surface.slot, a.ref, p, n, a.uv, c);
      },
    },
    materials: (groups) =>
      groups.map((g) => {
        const s = used.get(`${g.slot}:${g.materialRef}`);
        return {
          name: `${s.graph ?? 'recess'}-${s.slot}`,
          roughness: s.roughness,
          metallic: s.metallic,
          ...(s.graph
            ? { sharedSurface: { ref: g.materialRef, slot: g.slot, uv: 'repeats' } }
            : {}),
        };
      }),
  };
}
it('reproduces the original instanced assembly and binds independently signed placement', async () => {
  copan.encodeAssembly((build, name) => {
    const b = new MeshBufferBuilder(),
      a = preservedAuthoring(b);
    build(a.wrap);
    const mesh = b.finalize();
    compactAuthoredMesh(mesh);
    const mats = a.materials(mesh.groups);
    return encodeGlb(mesh, mats, name);
  }, encodeAuthoredAssembly);
  const m = await read(`${source}/map-frame.json`),
    prior = await read(`${source}/georeferencing-baseline.json`),
    spec = await read(`${source}/spec.json`);
  expect(m.anchor).toEqual(prior.anchor);
  expect(m.heading).toBe(prior.heading);
  expect(m.geometry).toEqual(prior.geometry);
  expect(m.elements[0].id).toBe(8100248);
  expect(m.elements[0].tags.wikidata).toBe('Q632566');
  const project = (q) => {
    const r = 6378137,
      f = Math.cos((m.anchor[1] * Math.PI) / 180),
      e = (((q.lon - m.anchor[0]) * Math.PI) / 180) * r * f,
      s =
        (-r * Math.asinh(Math.tan((q.lat * Math.PI) / 180)) +
          r * Math.asinh(Math.tan((m.anchor[1] * Math.PI) / 180))) *
        f;
    return [
      Math.cos(m.heading) * e - Math.sin(m.heading) * s,
      Math.sin(m.heading) * e + Math.cos(m.heading) * s,
    ];
  };
  for (const q of m.elements[0].geometry.map(project))
    expect(
      Math.min(...prior.geometry.outline.map((p) => Math.hypot(p[0] - q[0], p[1] - q[1]))),
    ).toBeLessThan(0.002);
  expect(spec.sourceFacts.residentialFloors).toBe(32);
  expect(spec.sourceFacts.heightMetersIBGE).toBe(115);
  expect(spec.mesh.triangles).toBe(225758);
  expect(spec.fidelityTarget).toBe('medium-fi');
}, 120000);
it('preserves the outward S facade and closed roof with the lift and three stair locations', async () => {
  const m = await read(`${source}/map-frame.json`),
    asset = await read(`${runtime}/asset.json`),
    b = new MeshBufferBuilder();
  copan.build(b);
  const mesh = b.finalize(),
    ts = [];
  for (let i = 0; i < mesh.indices.length; i += 3)
    ts.push(
      Array.from(mesh.indices.slice(i, i + 3), (j) =>
        Array.from(mesh.positions.slice(j * 3, j * 3 + 3)),
      ),
    );
  for (const l of asset.runtimeLods.levels) {
    const d = decode(await readFile(`${runtime}/${l.file}`));
    for (const y of [30.51, 65.91, 101.31])
      for (const k of [2, 12, 25, 40, 53, 61]) {
        const a = m.geometry.outline[k],
          b = m.geometry.outline[k + 1],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          nx = (b[1] - a[1]) / len,
          nz = -(b[0] - a[0]) / len,
          o = [(a[0] + b[0]) / 2 + 5 * nx, y, (a[1] + b[1]) / 2 + 5 * nz],
          v = [-nx, 0, -nz],
          ref = nearestWithNormal(ts, o, v),
          hit = nearestWithNormal(d.triangles, o, v);
        expect(
          Number.isFinite(ref.distance) && Number.isFinite(hit.distance),
          `${l.name} facade ${y}/${k}`,
        ).toBe(true);
        expect(
          Math.abs(ref.distance - hit.distance) * Math.abs(dot(v, ref.normal)),
          `${l.name} normal displacement ${y}/${k}`,
        ).toBeLessThan(l.errorMeters + 0.02);
        expect(dot(v, hit.normal)).toBeLessThan(0);
      }
    expect(nearest(d.triangles, [20, 125, 0], [0, -1, 0]), `${l.name} closed roof`).toBeCloseTo(
      13.92,
      2,
    );
    expect(nearest(d.triangles, [20, 2, 0], [0, -1, 0]), `${l.name} apron`).toBeCloseTo(
      l.name === 'skyline' || l.name === 'district' ? 1.98 : 1.74,
      2,
    );
    expect(
      Math.max(
        ...d.g.meshes
          .flatMap((m) => m.primitives)
          .map((p) => d.g.accessors[p.attributes.POSITION].max[1]),
      ),
    ).toBeCloseTo(115, 4);
    for (const [x, z] of [
      [61.858, 4.86],
      [-29.78, 1.97],
      [-46.35, 19.75],
    ])
      expect(
        nearest(d.triangles, [x, 75, z], [1, 0, 0]),
        `${l.name} independent stair core`,
      ).toBeLessThan(1.15);
    expect(d.g.materials.length).toBeLessThanOrEqual(4);
    if (l.name === 'closeup') {
      const center = [-29.78, 1.97],
        a = m.geometry.outline[162],
        b = m.geometry.outline[179],
        rotation = Math.atan2((a[0] + b[0]) / 2 - center[0], (a[1] + b[1]) / 2 - center[1]);
      for (const step of [2, 5, 9, 13, 17]) {
        const angle = ((step + 0.4) * Math.PI * 2) / 20,
          x = 1.1 * Math.sin(angle),
          z = 1.1 * Math.cos(angle),
          origin = [
            x * Math.cos(rotation) + z * Math.sin(rotation) + center[0],
            16.5 + 7 * 2.95 + ((step + 1) * 2.95) / 20 + 0.2,
            -x * Math.sin(rotation) + z * Math.cos(rotation) + center[1],
          ],
          reference = nearestWithNormal(ts, origin, [0, -1, 0]),
          hit = nearestWithNormal(d.triangles, origin, [0, -1, 0]);
        expect(
          Math.abs(hit.distance - reference.distance),
          `discrete stair tread ${step}`,
        ).toBeLessThan(0.01);
        expect(Math.abs(hit.normal[1])).toBeGreaterThan(0.999);
      }
    }
  }
}, 120000);
it('rebuilds four levels within download/triangle/draw budgets, with separate vertex streams', async () => {
  const p = resolve(runtime, 'asset.json');
  await buildModelLandmarkLods(p, { force: true });
  const next = await read(p);
  expect(next.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThanOrEqual(
    3000000,
  );
  for (const [i, l] of next.runtimeLods.levels.entries()) {
    const bytes = await readFile(`${runtime}/${l.file}`);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(4);
    const { g } = decode(bytes);
    expect(g.images ?? []).toHaveLength(0);
    expect(g.materials.filter((m) => m.alphaMode === 'BLEND')).toHaveLength(0);
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
