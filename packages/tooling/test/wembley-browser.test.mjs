import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import {
  outerPlan,
  wembleyBoundary,
} from '../../../content/worldgen/source/places/gc/gcp/wembley_stadium/models/wembley-browser.mjs';
import { landmarkLodRecipeHash } from '../scripts/source-runtime-lods.mjs';

const source = resolve('../../content/worldgen/source/places/gc/gcp/wembley_stadium');
const runtime = resolve('../../content/worldgen/assets/places/gc/gcp/wembley_stadium');
const digest = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
async function model(path) {
  const b = await readFile(path);
  const g = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    '',
  );
  g.scene.updateMatrixWorld(true);
  const points = [],
    upperSeats = [];
  g.scene.traverse((object) => {
    if (!object.isMesh) return;
    const positions = object.geometry.getAttribute('position');
    const colors = object.geometry.getAttribute('color');
    for (let i = 0; i < positions.count; i++) {
      const p = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      points.push(p);
      if (
        colors &&
        p.y > 25 &&
        colors.getX(i) > 4 * colors.getY(i) &&
        colors.getX(i) > 4 * colors.getZ(i)
      )
        upperSeats.push(p);
    }
  });
  return {
    points,
    upperSeats,
    hit: (x, z, y = 200, far = 250) =>
      new Raycaster(new Vector3(x, y, z), new Vector3(0, -1, 0), 0, far).intersectObject(
        g.scene,
        true,
      )[0]?.point.y ?? null,
  };
}
it('keeps the open playing field,three separate seating tiers and north-tilted315m arch in source,master and all four browser GLBs', async () => {
  for (const level of ['source', 'master', 'skyline', 'district', 'street', 'closeup']) {
    const { points, hit, upperSeats } = await model(
      level === 'source'
        ? `${source}/models/source.glb`
        : `${runtime}/${level === 'master' ? 'model.glb' : `model.${level}.glb`}`,
    );
    let maximumSeatRatio = 0;
    for (const p of upperSeats)
      maximumSeatRatio = Math.max(
        maximumSeatRatio,
        Math.hypot(p.x, p.z) / Math.hypot(...wembleyBoundary(outerPlan, Math.atan2(p.x, p.z))),
      );
    expect(
      maximumSeatRatio,
      `${level} every upper seat stays inside mapped facade`,
    ).toBeLessThanOrEqual(0.945);
    for (const [x, z] of [
      [0, 0],
      [20, 20],
      [-20, -20],
    ])
      expect(hit(x, z), `${level} open roof to field`).toBeGreaterThanOrEqual(-0.001);
    for (const [x, z] of [
      [0, 0],
      [20, 20],
      [-20, -20],
    ])
      expect(hit(x, z), `${level} open roof to field`).toBeLessThan(0.06);
    for (const [z, lo, hi, eye] of [
      [50, 1, 12, 14],
      [75, 15, 26, 25],
      [100, 26, 46, 46],
    ]) {
      const y = hit(0, z, eye);
      expect(y, `${level} tier at ${z}`).toBeGreaterThan(lo);
      expect(y, `${level} tier at ${z}`).toBeLessThan(hi);
    }
    const high = points.filter((p) => Math.abs(p.x) < 20 && p.y > 125);
    expect(high.length, `${level} arch crown`).toBeGreaterThan(0);
    expect(Math.max(...high.map((p) => p.y))).toBeGreaterThan(130);
    expect(Math.max(...high.map((p) => p.y))).toBeLessThan(134);
    expect(
      high.every((p) => p.z < -95 && p.z > -108),
      `${level}22degree northward tilt`,
    ).toBe(true);
    for (const sign of [-1, 1]) {
      const foot = points.filter(
        (p) => p.x * sign > 154 && p.x * sign < 162 && p.z > -54 && p.z < -46,
      );
      expect(Math.min(...foot.map((p) => p.y)), `${level} grounded arch foot`).toBeCloseTo(0, 4);
    }
  }
}, 120000);
it('covers the mapped base with a complete plaza and connects the roof with a perimeter fascia in every browser tier', async () => {
  for (const level of ['skyline', 'district', 'street', 'closeup']) {
    const { hit, points, upperSeats } = await model(`${runtime}/model.${level}.glb`);
    expect(upperSeats.length).toBeGreaterThan(0);
    let maximumSeatRatio = 0;
    for (const p of upperSeats)
      maximumSeatRatio = Math.max(
        maximumSeatRatio,
        Math.hypot(p.x, p.z) / Math.hypot(...wembleyBoundary(outerPlan, Math.atan2(p.x, p.z))),
      );
    expect(maximumSeatRatio).toBeLessThanOrEqual(0.936);
    for (let i = 1; i < outerPlan.length; i++) {
      const a = outerPlan[i - 1],
        b = outerPlan[i];
      expect(
        hit((a[0] + b[0]) * 0.495, (a[1] + b[1]) * 0.495, 0.3, 1),
        `${level} mapped plaza edge${i}`,
      ).toBeCloseTo(0.025, 3);
    }
    for (const side of [-1, 1])
      expect(
        points.some((p) => p.x * side > 140 && p.y > 48.5 && p.y < 50 && Math.abs(p.z) < 35),
        `${level} supported perimeter roof`,
      ).toBe(true);
  }
}, 120000);
it('pins the corrected detailed masters and budgeted image-free shared-material browser levels with separate GPU streams', async () => {
  const a = JSON.parse(await readFile(`${runtime}/asset.json`));
  expect(digest(await readFile(`${source}/models/source.glb`))).toBe(
    'sha256:4eb0209f0210255192da7fdaf2c0ed50105a0ce920096275a7e7b4aa1a7766c6',
  );
  expect(digest(await readFile(`${runtime}/model.glb`))).toBe(
    'sha256:67ac173fc0a5bbc8345242c28a718ed529b19891676ff1db5d5e09662130863b',
  );
  expect(a.stats.triangles).toBeGreaterThan(820000);
  expect(await landmarkLodRecipeHash(a.id)).toBe(a.runtimeLods.recipeHash);
  expect(a.runtimeLods.levels.slice(0, 2).reduce((n, l) => n + l.bytes, 0)).toBeLessThan(3000000);
  for (const [i, l] of a.runtimeLods.levels.entries()) {
    expect(l.triangles).toBeLessThanOrEqual([1000, 4000, 16000, 64000][i]);
    expect(l.drawCalls).toBeLessThanOrEqual(8);
    const b = await readFile(`${runtime}/${l.file}`);
    expect(digest(b)).toBe(l.hash);
    const g = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    expect(g.images ?? []).toHaveLength(0);
    for (const graph of ['metal_painted', 'metal_standing_seam', 'concrete_plain'])
      expect(
        g.materials.some(
          (m) => m.extras?.molenSurface?.ref === `matgraph:molen.worldgen.material.${graph}`,
        ),
      ).toBe(true);
    for (const mesh of g.meshes)
      for (const p of mesh.primitives) {
        const x = g.accessors[p.attributes.POSITION],
          n = g.accessors[p.attributes.NORMAL];
        expect(x.bufferView).not.toBe(n.bufferView);
        expect(g.bufferViews[x.bufferView].byteStride ?? 12).toBe(12);
        expect(g.bufferViews[n.bufferView].byteStride ?? 12).toBe(12);
      }
  }
}, 120000);
