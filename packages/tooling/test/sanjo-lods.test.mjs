import { readFileSync } from 'node:fs';
import { bakeMatGraph, registerMaterialSchemas } from '@bendyline/molen-materials';
import { validateByKind } from '@bendyline/molen-schema';
import { expect, it } from 'vitest';
import {
  bridgePatternGraphs,
  bridgePatternRepeats,
} from '../../worldgen/scripts/bridge-pattern-materials.mjs';
import {
  buildSanjoRuntime,
  sanjoDeckY,
  sanjoRuntimeCandidateId,
} from '../../worldgen/scripts/sanjo-ohashi-runtime.mjs';
import {
  authoredDetail,
  authoredSkyline,
  authoredSurfaceRefs,
} from '../scripts/authored-landmark-lods.mjs';

const capture = (level) => {
  const faces = [];
  const add = (slot, _ref, points, normal) => faces.push({ slot, points, normal });
  buildSanjoRuntime({ addQuad: add, addTriangle: add, addConvexPolygon: add }, level);
  return faces;
};
const near = (a, b) => Math.abs(a - b) < 1e-6;
const levels = ['skyline', 'district', 'street', 'closeup'];

it('keeps the published deck endpoints, nine spans and fourteen bronze giboshi at every level', () => {
  expect(sanjoRuntimeCandidateId).toBe('N0021');
  expect(sanjoDeckY(-36.65)).toBeCloseTo(4.55, 8);
  expect(sanjoDeckY(36.65)).toBeCloseTo(4.55, 8);
  expect(sanjoDeckY(0)).toBeCloseTo(5.07, 8);
  for (const level of levels) {
    const faces = capture(level),
      deck = faces.filter((f) => f.slot === 'road');
    expect(deck).toHaveLength(9);
    for (let i = 1; i < deck.length; i++) expect(deck[i - 1].points[2]).toEqual(deck[i].points[1]);
    expect(deck[0].points[0][0]).toBeCloseTo(-36.65, 8);
    expect(deck.at(-1).points[2][0]).toBeCloseTo(36.65, 8);
    if (level !== 'skyline') {
      const tops = faces.filter((f) => f.slot === 'curb' && f.normal[1] > 0.9);
      expect(tops).toHaveLength(18);
      expect(
        tops.some(
          (f) => f.points.some((p) => near(p[2], 4.3)) && f.points.some((p) => near(p[2], 4.62)),
        ),
      ).toBe(true);
      expect(
        tops.some(
          (f) => f.points.some((p) => near(p[2], -4.3)) && f.points.some((p) => near(p[2], -4.62)),
        ),
      ).toBe(true);
    }
    for (const side of [-1, 1])
      for (let i = 0; i <= 36; i += 6) {
        const x = -36.65 + 0.3 + (72.7 * i) / 36,
          z = side * 8.14;
        const tip = faces
          .filter((f) => f.slot === 'bronze')
          .flatMap((f) => f.points)
          .filter((p) => Math.abs(p[0] - x) < 0.3 && Math.abs(p[2] - z) < 0.3);
        expect(tip.length).toBeGreaterThan(0);
        expect(Math.max(...tip.map((p) => p[1]))).toBeGreaterThan(sanjoDeckY(x) + 1.9);
      }
  }
});

it('retains all eight seven-column support frames through the three nearer levels', () => {
  for (const level of levels.slice(1)) {
    const ground = capture(level)
      .filter((f) => ['stone', 'concrete'].includes(f.slot))
      .flatMap((f) => f.points)
      .filter((p) => near(p[1], 0));
    for (let row = 1; row < 9; row++)
      for (let col = 0; col < 7; col++) {
        const x = -36.65 + (73.3 * row) / 9,
          z = -6.9 + 2.3 * col;
        expect(ground.some((p) => Math.abs(p[0] - x) < 0.7 && Math.abs(p[2] - z) < 0.7)).toBe(true);
      }
  }
});

it('emits finite noncollapsed faces and winding-consistent normals at runtime Float32 precision', () => {
  for (const level of levels)
    for (const { points, normal } of capture(level)) {
      for (const p of points) expect(p.every(Number.isFinite)).toBe(true);
      const [a, b, c] = points.map((p) => p.map(Math.fround)),
        u = b.map((v, i) => v - a[i]),
        v = c.map((n, i) => n - a[i]);
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
        length = Math.hypot(...n);
      expect(length).toBeGreaterThan(1e-8);
      expect(n.reduce((s, v, i) => s + (v / length) * normal[i], 0)).toBeGreaterThan(0.998);
    }
});

it('ships byte-deterministic four-level derivatives within download, triangle and material budgets', async () => {
  const id = 'molen.worldgen.structure.n0021_sanjo_ohashi_bridge',
    initial = [];
  for (const [i, cap] of [1000, 4000, 16000, 64000].entries()) {
    const build = () => (i ? authoredDetail(id, levels[i]) : authoredSkyline(id)),
      a = await build(),
      b = await build();
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(a.triangles).toBeLessThanOrEqual(cap);
    expect(a.drawCalls).toBeLessThanOrEqual(8);
    const gltf = JSON.parse(a.bytes.toString('utf8', 20, 20 + a.bytes.readUInt32LE(12)));
    expect(gltf.images ?? []).toHaveLength(0);
    const refs = gltf.materials.flatMap((m) =>
      m.extras?.molenSurface ? [m.extras.molenSurface.ref] : [],
    );
    if (i) {
      expect(refs).toContain('matgraph:molen.worldgen.material.metal_asanoha');
      expect(refs).toContain('matgraph:molen.worldgen.material.stone_checker_fine');
      expect(refs.every((ref) => authoredSurfaceRefs(id).includes(ref))).toBe(true);
    }
    if (i < 2) initial.push(a.bytes.length);
  }
  expect(initial.reduce((s, b) => s + b, 0)).toBeLessThan(3_000_000);
});

it('shares compact source-reproducible paving and open lattice patterns with physical repeats', () => {
  registerMaterialSchemas();
  expect(bridgePatternRepeats.stone_checker_fine).toEqual([0.2, 0.2]);
  expect(bridgePatternRepeats.metal_asanoha[0]).toBeCloseTo(0.48, 8);
  for (const [name, graph] of Object.entries(bridgePatternGraphs)) {
    expect(graph.nodes.length).toBeLessThanOrEqual(42);
    expect(
      JSON.parse(
        readFileSync(
          new URL(`../../../content/worldgen/materials/${name}.matgraph.json`, import.meta.url),
        ),
      ),
    ).toEqual(graph);
    const parsed = validateByKind('matgraph', graph);
    expect(parsed.ok).toBe(true);
    const b = bakeMatGraph(parsed.value);
    expect(b.slots.baseColor.width).toBe(256);
    if (name === 'metal_asanoha') {
      expect(b.meta.alphaCoverage).toBe(true);
      const alpha = Array.from(b.slots.baseColor.data).filter((_, i) => i % 4 === 3);
      expect(alpha.filter((a) => a === 0).length / alpha.length).toBeGreaterThan(0.6);
      expect(alpha.filter((a) => a === 255).length / alpha.length).toBeGreaterThan(0.1);
    }
  }
}, 10000);
