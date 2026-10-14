import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { buildModelLandmarkLods } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/gc/gc7/n0975_spire_of_dublin');
const runtime = source.replace('/source/', '/assets/').replace('\\source\\', '\\assets\\');
const read = async (p) => JSON.parse(await readFile(p));
const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
function glb(b) {
  const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
  const bin = 28 + b.readUInt32LE(12);
  const array = (i) => {
    const a = g.accessors[i],
      v = g.bufferViews[a.bufferView];
    const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const size = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType];
    const start = bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return Array.from({ length: a.count }, (_, j) =>
      Array.from({ length: width }, (_, k) => {
        const at = start + j * (v.byteStride ?? size * width) + k * size;
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
  return { g, array };
}

it('preserves the instanced physical-hole master and the exact mapped monument center', async () => {
  const b = await readFile(source + '/models/source.glb'),
    { g } = glb(b);
  const scope = await read(source + '/review-scope.json');
  expect(hash(b)).toBe(scope.sourceFacts.originalMasterHash);
  const rows = g.nodes.filter((n) => n.extensions?.EXT_mesh_gpu_instancing);
  expect(rows).toHaveLength(212);
  expect(
    rows.reduce(
      (n, row) =>
        n + g.accessors[row.extensions.EXT_mesh_gpu_instancing.attributes.TRANSLATION].count,
      0,
    ),
  ).toBe(11884);
  const s = await read(source + '/spec.json'),
    f = await read(source + '/map-frame.json');
  const p = (await read('../../content/earth/structures/placements.json')).entries.find(
    (p) => p.asset === s.assetId,
  );
  expect(f.mappedIdentity.wikidataId).toBe('Q1134365');
  expect(f.geometry.outline.length).toBeGreaterThan(16);
  expect(p.anchor).toEqual([-6.260254122, 53.349801149]);
  expect(p.heading).toBe(0);
  expect(p.datum).toBe('terrain');
  expect(p.replaceFootprint).toBe(false);
  expect(s.sourceFacts.heightMeters).toBe(120);
  expect(s.sourceFacts.baseDiameterMeters).toBe(3);
});

it('keeps all 11884 close-up daylight marks visibly outside the taper, including the narrow tip', async () => {
  const { g, array } = glb(await readFile(runtime + '/model.closeup.glb'));
  const marks = g.meshes
    .flatMap((m) => m.primitives)
    .filter((p) => g.materials[p.material].name === 'local-architectural-surface');
  expect(marks).toHaveLength(1);
  const p = marks[0],
    points = array(p.attributes.POSITION),
    ids = array(p.indices).flat();
  expect(ids.length / 6).toBe(11884);
  for (let i = 0; i < ids.length; i += 3) {
    const t = ids.slice(i, i + 3).map((id) => points[id]);
    const center = [0, 1, 2].map((k) => t.reduce((n, p) => n + p[k] / 3, 0));
    expect(center[1]).toBeGreaterThan(108);
    expect(center[1]).toBeLessThan(120);
    expect(Math.hypot(center[0], center[2]) - (1.5 - (1.425 * center[1]) / 120)).toBeGreaterThan(
      0.0004,
    );
  }
});

it('rebuilds deterministic whole-height browser levels within strict budgets using four shared graphs', async () => {
  const a = await read(runtime + '/asset.json');
  const before = await Promise.all(
    a.runtimeLods.levels.map((l) => readFile(runtime + '/' + l.file)),
  );
  await buildModelLandmarkLods(runtime + '/asset.json', { force: true });
  expect((await read(runtime + '/asset.json')).runtimeLods).toEqual(a.runtimeLods);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  const refs = new Set();
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    const b = await readFile(runtime + '/' + l.file),
      { g } = glb(b);
    expect(b.equals(before[i])).toBe(true);
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    expect(g.images ?? []).toHaveLength(0);
    const ps = g.meshes.flatMap((m) => m.primitives).map((p) => g.accessors[p.attributes.POSITION]);
    expect(Math.max(...ps.map((p) => p.max[1]))).toBe(120);
    expect(Math.min(...ps.map((p) => p.min[1]))).toBe(0);
    for (const m of g.materials)
      if (m.extras?.molenSurface?.ref) refs.add(m.extras.molenSurface.ref);
    for (const mesh of g.meshes)
      for (const p of mesh.primitives) {
        const pos = g.accessors[p.attributes.POSITION],
          normal = g.accessors[p.attributes.NORMAL];
        expect(pos.bufferView).not.toBe(normal.bufferView);
        expect(g.bufferViews[pos.bufferView].byteStride ?? 12).toBe(12);
      }
  }
  expect([...refs].sort()).toEqual(
    ['metal_stainless', 'metal_stainless_beadblasted', 'metal_stainless_polished', 'stone_marble']
      .map((g) => 'matgraph:molen.worldgen.material.' + g)
      .sort(),
  );
}, 60_000);
