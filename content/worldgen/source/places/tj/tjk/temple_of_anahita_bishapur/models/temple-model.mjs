/** The excavated Temple of Anahita at Bishapur, in the March 2025 view. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  poly,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { outer, court, outerTops, opening, courtFloor, foundationBottom } = plan;
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  floor: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.97, metallic: 0 },
  recess: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.97, metallic: 0 },
};
const colors = {
  wall: rgb('b2a790'),
  trim: rgb('c6baa0'),
  floor: rgb('afa793'),
  recess: rgb('46443a'),
};
const stones = ['aa9f8b', 'b1a590', 'afa592', 'a89d88', 'b6ad97', 'a9a18e', 'b0a693'].map(rgb);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const atY = ([x, z], y) => [x, y, z];
function face(out, k, p, wanted, color = colors[k]) {
  let n = normalFor(...p);
  if (n.reduce((s, v, i) => s + v * wanted[i], 0) < 0) {
    p = [...p].reverse();
    n = normalFor(...p);
  }
  if (p.length === 4) quad(out, k, p, n, color);
  else out.addConvexPolygon(k, 'palette:#ffffff', p, n, ([x, y]) => [x, y], color);
}
function shell(out, k, ring, y0, y1, color = colors[k]) {
  const b = new MeshBufferBuilder();
  poly(b, k, ring, y0, y1, color);
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3) {
    const p = Array.from(m.indices.slice(i, i + 3), (j) =>
      Array.from(m.positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, k, p, normalFor(...p), color);
  }
}
function wall(a, m, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const normal = [-dz, 0, dx];
  return {
    length,
    normal,
    p: (u, y, d = 0) => {
      const t = u / length;
      const [x, z] = t < 0.5 ? mix(a, m, 2 * t) : mix(m, b, 2 * t - 1);
      return [x + normal[0] * d, y, z + normal[2] * d];
    },
  };
}
function panel(out, k, s, u0, y0, u1, y1, d = 0, color = colors[k]) {
  const { p, normal } = s;
  face(out, k, [p(u0, y0, d), p(u1, y0, d), p(u1, y1, d), p(u0, y1, d)], normal, color);
}
function wallCourses(out, s, side, level, threshold, doorLo, doorHi, head, lod) {
  const bottom = courtFloor + 0.11;
  if (!lod) {
    panel(out, 'wall', s, 0, bottom, doorLo, level);
    panel(out, 'wall', s, doorHi, bottom, s.length, level);
    panel(out, 'wall', s, doorLo, head, doorHi, level);
    return;
  }
  const n = [0, 6, 9, 12][lod],
    h = (level - bottom) / n;
  for (let j = 0; j < n; j++) {
    const y0 = bottom + h * j,
      y1 = bottom + h * (j + 1);
    const intervals =
      y0 < head
        ? [
            [0, doorLo],
            [doorHi, s.length],
          ]
        : [[0, s.length]];
    for (const [lo, hi] of intervals) {
      const count = Math.max(
        1,
        Math.round((hi - lo) / (lod === 3 ? 0.81 : lod === 2 ? 1.17 : 1.52)),
      );
      const span = (hi - lo) / count;
      const joints = [lo];
      for (let i = 1; i < count; i++) {
        const stagger = j % 2 ? 0.28 : -0.12;
        const variation = (((i * 7 + j * 3 + side) % 5) - 2) * 0.052;
        joints.push(lo + span * (i + stagger + variation));
      }
      joints.push(hi);
      for (let i = 0; i < count; i++) {
        const inset = lod > 1 ? 0.016 : 0.006;
        panel(
          out,
          'wall',
          s,
          joints[i] + inset,
          y0 + inset,
          joints[i + 1] - inset,
          y1 - inset,
          0.018 + 0.004 * ((i + j + side) % 3),
          stones[(i * 5 + j * 3 + side) % stones.length],
        );
      }
    }
    if (y0 < head && y1 > head) panel(out, 'wall', s, doorLo, head, doorHi, y1);
  }
  // A continuous backing seals the small joints between the separate visible stone blocks.
  panel(out, 'wall', s, 0, bottom, doorLo, level, -0.028, stones[3]);
  panel(out, 'wall', s, doorHi, bottom, s.length, level, -0.028, stones[3]);
  panel(out, 'wall', s, doorLo, head, doorHi, level, -0.028, stones[3]);
  if (threshold > bottom) panel(out, 'floor', s, doorLo, bottom, doorHi, threshold);
}
function doorway(out, s, side, lod, level) {
  const center = s.length * (side === 0 ? 0.54 : 0.5);
  const half = side === 3 ? 0.69 : 0.62,
    lo = center - half,
    hi = center + half;
  const sill = courtFloor + 0.2,
    head = sill + (side === 3 ? 2.04 : 2.17),
    depth = 1.17;
  const p = s.p;
  wallCourses(out, s, side, level, sill, lo, hi, head, lod);
  const normalAcross = p(hi, head).map((v, i) => v - p(lo, head)[i]);
  face(
    out,
    'trim',
    [p(lo, sill), p(lo, sill, -depth), p(lo, head, -depth), p(lo, head)],
    normalAcross,
  );
  face(
    out,
    'trim',
    [p(hi, sill), p(hi, sill, -depth), p(hi, head, -depth), p(hi, head)],
    normalAcross.map((x) => -x),
  );
  face(
    out,
    'wall',
    [p(lo, head), p(hi, head), p(hi, head, -depth), p(lo, head, -depth)],
    [0, -1, 0],
  );
  face(
    out,
    'floor',
    [p(lo, sill), p(hi, sill), p(hi, sill, -depth), p(lo, sill, -depth)],
    [0, 1, 0],
  );
  panel(out, 'recess', s, lo, sill, hi, head, -depth - 0.012);
  const d = lod > 1 ? 0.16 : 0.1;
  panel(out, 'trim', s, lo - 0.26, sill, lo + 0.015, head + 0.11, d);
  panel(out, 'trim', s, hi - 0.015, sill, hi + 0.26, head + 0.11, d);
  panel(out, 'trim', s, lo - 0.32, head, hi + 0.32, head + 0.24, d, stones[4]);
  if (lod > 1)
    panel(out, 'trim', s, lo - 0.41, head + 0.23, hi + 0.41, head + 0.39, d + 0.04, stones[1]);
}
function ringWalls(out, lod) {
  const indices = [4, 0, 1, 2],
    innerLevels = [0.06, 0.32, 0.42, 0.21];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const a = court[i * 2],
      m = court[i * 2 + 1],
      b = court[j * 2],
      s = wall(a, m, b),
      h = innerLevels[i];
    doorway(out, s, i, lod, h);
    const oa = outer[indices[i]],
      ob = outer[indices[j]],
      ya = outerTops[indices[i]],
      yb = outerTops[indices[j]];
    const x = atY(oa, ya),
      z = atY(ob, yb),
      p = atY(a, h),
      q = atY(b, h),
      middle = atY(m, h);
    face(
      out,
      'wall',
      [x, atY(oa, foundationBottom), atY(ob, foundationBottom), z],
      s.normal.map((v) => -v),
    );
    for (const triangle of [
      [p, x, middle],
      [middle, x, z],
      [middle, z, q],
    ])
      face(out, 'wall', triangle, [0, 1, 0], stones[(i + 3) % stones.length]);
    const next = innerLevels[j];
    if (next !== h) face(out, 'wall', [q, atY(b, next), z], s.normal);
    const e = courtFloor + 0.17,
      d = 0.26;
    for (const [lo, hi] of [
      [0, s.length / 2],
      [s.length / 2, s.length],
    ]) {
      face(out, 'floor', [s.p(lo, e), s.p(hi, e), s.p(hi, e, d), s.p(lo, e, d)], [0, 1, 0]);
      panel(out, 'trim', s, lo, courtFloor, hi, e, d, stones[(i + 2) % stones.length]);
    }
    if (i === 1) {
      const blocks = lod > 1 ? 7 : 5;
      for (let row = 0; row < 3; row++) {
        const low = s.length * (0.2 + row * 0.068),
          high = s.length * (0.82 - row * 0.069),
          y = h + 0.43 * row;
        for (let k = 0; k < blocks; k++) {
          const u0 = low + ((high - low) * k) / blocks,
            u1 = low + ((high - low) * (k + 1)) / blocks;
          const top = y + 0.37 + 0.055 * ((k + row * 2) % 3);
          panel(out, 'wall', s, u0, y, u1, top, -0.027, stones[(k + row * 2) % stones.length]);
          face(
            out,
            'wall',
            [s.p(u0, top, -0.026), s.p(u1, top, -0.026), s.p(u1, top, -0.48), s.p(u0, top, -0.48)],
            [0, 1, 0],
          );
          panel(out, 'wall', s, u0, y, u1, top, -0.479);
        }
      }
    }
  }
}
function courtyard(out, lod) {
  shell(out, 'floor', court, foundationBottom, courtFloor);
  if (lod > 1) {
    const h = courtFloor + 0.012;
    const x0 = -4.39,
      x1 = 4.21,
      z0 = -5.43,
      z1 = 5.7;
    const nx = lod === 3 ? 8 : 5,
      nz = lod === 3 ? 9 : 6;
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const a = x0 + ((x1 - x0) * i) / nx,
          b = x0 + ((x1 - x0) * (i + 1)) / nx - 0.022;
        const c = z0 + ((z1 - z0) * j) / nz,
          d = z0 + ((z1 - z0) * (j + 1)) / nz - 0.022;
        face(
          out,
          'floor',
          [
            [a, h, c],
            [a, h, d],
            [b, h, d],
            [b, h, c],
          ],
          [0, 1, 0],
          stones[(i * 2 + j * 3) % stones.length],
        );
      }
  }
}
export function buildTemple(out, _frame, lod = 3) {
  courtyard(out, lod);
  ringWalls(out, lod);
}
export const templeSkyline = (out, frame) => buildTemple(out, frame, 0);
export const templeDistrict = (out, frame) => buildTemple(out, frame, 1);
export const templeStreet = (out, frame) => buildTemple(out, frame, 2);
export const templeCloseup = (out, frame) => buildTemple(out, frame, 3);
const camera = [19, 16, 23],
  lookAt = [0, -2.1, 0];
export const templeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'temple-model.mjs',
  surfaces,
  build: buildTemple,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Surviving stone walls, excavated paved court and rectangular doorways of the Temple of Anahita at Bishapur.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: -6.13,
  groundCutout: {
    outline: opening,
    basis:
      'Mapped excavated courtyard way 591894141, expanded 1.7 percent into the ruin’s masonry to prevent terrain slivers along the inside edge.',
  },
  buildingCutout: {
    outline: outer,
    minimumCoverage: 0.95,
    basis:
      'The authored archaeological ruins replace the generic building form inside mapped temple relation 8338022 only.',
  },
  mediumFiContext: {
    scale: 0.63,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_limestone_raw', 'stone_limestone', 'stone_limestone_weathered'],
  qaCameras: [
    { name: 'excavated-court-and-surrounding-grade', position: [17, 14, 19], lookAt: [0, -2.9, 0] },
    {
      name: 'sunken-court-and-stone-doorways',
      position: [0, -4.36, 4.58],
      lookAt: [0, -2.7, -5.98],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-bishapur-temple-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/tj/tjk/temple_of_anahita_bishapur/models/temple-model.mjs',
    level: 'skyline',
    export: 'templeSkyline',
    errorMeters: 0.22,
    surfaces,
    authoredLevels: {
      district: { export: 'templeDistrict', errorMeters: 0.13, surfaces },
      street: { export: 'templeStreet', errorMeters: 0.056, surfaces },
      closeup: { export: 'templeCloseup', errorMeters: 0.022, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Behnam9395’s March 2025 exterior photograph is CC0. OpenStreetMap contributors supply mapped controls under ODbL.',
};
