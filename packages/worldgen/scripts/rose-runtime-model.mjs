/** Rose Rayhaan: four convex lobes, curved petals and signed offset mast. */
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing, sphere, torus } from './authored-structure-mesh.mjs';
import { face, localOutline, mappedSolid } from './signature-tower-expansion-models.mjs';
import { box as boundsBox } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const scope = JSON.parse(readFileSync(structureSourcePath('rose_tower', 'review-scope.json'))),
  map = JSON.parse(readFileSync(structureSourcePath('rose_tower', 'map-frame.json')));
const settings = {
  skyline: { n: 12, mult: 0, crown: 8, eye: 0, arcs: 0, ribbon: 8, sphere: [8, 6], mast: 6 },
  district: { n: 32, mult: 10, crown: 4, eye: 8, arcs: 6, ribbon: 20, sphere: [12, 8], mast: 8 },
  street: { n: 64, mult: 5, crown: 2, eye: 4, arcs: 10, ribbon: 20, sphere: [24, 12], mast: 12 },
  closeup: { n: 128, mult: 1, crown: 1, eye: 1, arcs: 12, ribbon: 32, sphere: [32, 16], mast: 24 },
};
function box(out, slot, center, size, color) {
  boundsBox(
    out,
    slot,
    center.map((v, i) => v - size[i] / 2),
    center.map((v, i) => v + size[i] / 2),
    color,
  );
}
function radius(a) {
  const dx = Math.cos(a),
    dz = Math.sin(a),
    hits = [];
  for (const x of [-5.78, 5.78])
    for (const z of [-4.49, 4.49]) {
      const dot = x * dx + z * dz,
        disc = 7.5 ** 2 - x * x - z * z + dot * dot;
      if (disc >= 0) hits.push(dot + Math.sqrt(disc));
    }
  return Math.max(...hits);
}
function point(a, y, offset = 0) {
  const r = radius(a) + offset;
  return [r * Math.cos(a), y, r * Math.sin(a)];
}
function crown(a, y, off = 0) {
  const t = (y - 246) / 64,
    scale = Math.sqrt(Math.max(0.006, 1 - 0.994 * t * t)),
    r = (radius(a) * (1 - t) + 12.1 * t) * scale + off;
  return [r * Math.cos(a), y, r * Math.sin(a)];
}
function buildRose(out, m, cfg) {
  const blue = [0.12, 0.27, 0.3],
    silver = [0.65, 0.72, 0.73],
    gold = [0.67, 0.5, 0.24],
    white = [0.82, 0.85, 0.83],
    rows = Array.from({ length: 70 }, (_, i) => 0.2 + (i * 244.8) / 69),
    angles = Array.from({ length: cfg.n }, (_, i) => (-i / cfg.n) * Math.PI * 2);
  mappedSolid(out, 'foundation', localOutline(m), 0, 0.2, [0.55, 0.52, 0.48]);
  for (let i = 0; i < cfg.n; i++) {
    const a = angles[i],
      b = (-(i + 1) / cfg.n) * Math.PI * 2,
      mid = (a + b) / 2,
      seam = Math.abs(Math.sin(mid * 2)) < 0.17,
      tint = seam ? [0.28, 0.37, 0.36] : blue.map((v) => v + 0.016 / 5),
      coverage = 0.025 / 1.5 + 0.06 / 3.55,
      mean = scope.sourceFacts.surfaceMeans.metal_painted;
    face(
      out,
      'glass',
      [point(a, 0.2), point(b, 0.2), point(b, 246), point(a, 246)],
      cfg.mult
        ? tint
        : tint.map((v, k) => v * (1 - coverage) + [0.43, 0.49, 0.49][k] * mean[k] * coverage),
    );
    if (cfg.mult) {
      for (let j = cfg.mult; j < rows.length; j += cfg.mult) {
        const y = rows[j],
          h = y < 23 ? 0.2 : 0.06;
        face(
          out,
          'metal',
          [
            point(a, y - h / 2, 0.02),
            point(b, y - h / 2, 0.02),
            point(b, y + h / 2, 0.02),
            point(a, y + h / 2, 0.02),
          ],
          y < 23 ? silver : [0.43, 0.49, 0.49],
        );
      }
      const da = 0.0125 / radius(a);
      face(
        out,
        'metal',
        [
          point(a + da, 0.2, 0.018),
          point(a - da, 0.2, 0.018),
          point(a - da, 246, 0.018),
          point(a + da, 246, 0.018),
        ],
        [0.41, 0.48, 0.48],
      );
    }
  }
  // Closed shoulder extends the old 245 m shaft to the 246 m crown start.
  const eye = (p, y, rx, ry, w, sections) => {
    for (let k = 0; k < sections; k++) {
      const a = (k / sections) * Math.PI * 2,
        b = ((k + 1) / sections) * Math.PI * 2;
      face(
        out,
        'metal',
        [
          p(Math.cos(a) * (rx + w), y + Math.sin(a) * (ry + w), 0.12),
          p(Math.cos(a) * (rx - w), y + Math.sin(a) * (ry - w), 0.12),
          p(Math.cos(b) * (rx - w), y + Math.sin(b) * (ry - w), 0.12),
          p(Math.cos(b) * (rx + w), y + Math.sin(b) * (ry + w), 0.12),
        ],
        gold,
      );
    }
  };
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2,
      r = radius(a),
      p = (u, y, off = 0) => point(a + Math.atan2(u, r), y, off);
    if (cfg.eye) for (let j = 7; j < 69; j += cfg.eye) eye(p, rows[j], 1.25, 0.33, 0.055, cfg.arcs);
    if (cfg.mult)
      for (const u of [-1.62, 1.62])
        beam(out, 'metal', p(u, 25, 0.025), p(u, 242, 0.025), 0.16, 0.16, silver);
    eye(p, 243, 1.12, 1.3, 0.13, cfg.mult ? 12 : 6);
  }
  for (const y of [240.6, 242.1, 243.6, 245.1])
    for (let i = 0; i < cfg.n; i++) {
      const a = angles[i],
        b = (-(i + 1) / cfg.n) * Math.PI * 2;
      face(
        out,
        'metal',
        [
          point(a, y - 0.1, 0.08),
          point(b, y - 0.1, 0.08),
          point(b, y + 0.1, 0.08),
          point(a, y + 0.1, 0.08),
        ],
        gold,
      );
    }
  const ys = [
    ...new Set([
      246,
      310,
      ...Array.from({ length: Math.ceil(64 / cfg.crown) }, (_, i) => 246 + i * cfg.crown),
      ...(cfg.mult ? [308, 309] : []),
    ]),
  ].sort((a, b) => a - b);
  for (let j = 1; j < ys.length; j++)
    for (let i = 0; i < cfg.n; i++) {
      const a = angles[i],
        b = (-(i + 1) / cfg.n) * Math.PI * 2,
        mid = (a + b) / 2,
        y0 = ys[j - 1],
        y1 = ys[j],
        t = ((y0 + y1) / 2 - 246) / 64,
        phase = Math.abs(Math.atan2(Math.sin(mid * 4), Math.cos(mid * 4))) / 4,
        leaf = phase < 0.018 + 0.68 * Math.sin(t * Math.PI * 0.93),
        band = Math.floor((y0 + y1) / 2 - 246) % 4 < 2,
        color = leaf
          ? silver
          : cfg.crown >= 4
            ? [0.41, 0.465, 0.47]
            : band
              ? [0.69, 0.74, 0.73]
              : [0.13, 0.19, 0.21];
      face(
        out,
        leaf ? 'metal' : 'glass',
        [crown(a, y0), crown(b, y0), crown(b, y1), crown(a, y1)],
        color,
      );
      if (cfg.mult) {
        if (cfg.mult < 10 && Math.floor(y1 - 246) % 4 === 0)
          face(
            out,
            'metal',
            [
              crown(a, y1 - 0.012, 0.018),
              crown(b, y1 - 0.012, 0.018),
              crown(b, y1 + 0.012, 0.018),
              crown(a, y1 + 0.012, 0.018),
            ],
            [0.49, 0.56, 0.57],
          );
        if (cfg.mult < 10 && i % (cfg.mult === 1 ? 3 : 4) === 0) {
          const da = 0.009 / Math.hypot(crown(a, (y0 + y1) / 2)[0], crown(a, (y0 + y1) / 2)[2]);
          face(
            out,
            'metal',
            [
              crown(a + da, y0, 0.018),
              crown(a - da, y0, 0.018),
              crown(a - da, y1, 0.018),
              crown(a + da, y1, 0.018),
            ],
            [0.48, 0.53, 0.53],
          );
        }
      }
    }
  for (let side = 0; side < 4; side++)
    for (const sign of [-1, 1])
      for (let j = 1; j < ys.length; j++) {
        const a = (t) =>
            (side * Math.PI) / 2 + sign * (0.018 + 0.68 * Math.sin(t * Math.PI * 0.93)),
          y0 = ys[j - 1],
          y1 = ys[j],
          a0 = a((y0 - 246) / 64),
          a1 = a((y1 - 246) / 64);
        if (cfg.mult > 0 && cfg.mult < 10)
          beam(out, 'metal', crown(a0, y0, 0.14), crown(a1, y1, 0.14), 0.37, 0.4, white);
        else {
          const d0 = 0.185 / Math.hypot(...crown(a0, y0).filter((_, i) => i !== 1)),
            d1 = 0.185 / Math.hypot(...crown(a1, y1).filter((_, i) => i !== 1));
          face(
            out,
            'metal',
            [
              crown(a0 + d0, y0, 0.32),
              crown(a0 - d0, y0, 0.32),
              crown(a1 - d1, y1, 0.32),
              crown(a1 + d1, y1, 0.32),
            ],
            white,
          );
        }
      }
  sphere(out, 'metal', [0, 313.65, 0], [3.45, 3.65, 3.45], [0.72, 0.76, 0.74], ...cfg.sphere);
  for (const rot of [0, Math.PI / 2])
    for (let k = 0; k < cfg.ribbon; k++) {
      const p = (t) => {
        const a = t * Math.PI * 2,
          xx = 5.2 * Math.cos(a),
          zz = 3.4 * Math.sin(a),
          y = 310.7 + 3.1 * Math.sin(a);
        return [
          xx * Math.cos(rot) - zz * Math.sin(rot),
          y,
          xx * Math.sin(rot) + zz * Math.cos(rot),
        ];
      };
      beam(out, 'metal', p(k / cfg.ribbon), p((k + 1) / cfg.ribbon), 0.3, 0.26, white);
    }
  const mast = [5.7, 0];
  loft(
    out,
    'metal',
    [
      [299, 1],
      [311, 0.8],
      [319, 0.32],
      [332.8, 0.075],
      [333, 0.028],
    ].map(([y, r]) => radialRing(y, r, r, cfg.mast, mast)),
    [0.73, 0.74, 0.65],
  );
  if (cfg.mult === 1)
    for (let y = 303; y < 315; y += 1.35) {
      torus(out, 'metal', [mast[0], y, mast[1]], 1.04, 0.09, [0.6, 0.57, 0.46], cfg.mast, 4);
      box(out, 'metal', [mast[0] + 0.85, y, mast[1]], [1.4, 0.16, 0.9], [0.63, 0.6, 0.52]);
    }
  const x = -12.55;
  for (let k = 0; k < 8; k++) {
    const z = -10.5 + k * 3;
    face(
      out,
      'glass',
      [
        [x, 0.2, z],
        [x, 0.2, z + 3],
        [x, 5.2, z + 3],
        [x, 5.2, z],
      ],
      [0.2, 0.29, 0.29],
    );
    if (cfg.mult)
      for (const u of [0, 1.5])
        beam(out, 'metal', [x - 0.03, 0.2, z + u], [x - 0.03, 5.2, z + u], 0.05, 0.05, silver);
  }
  for (const z of [-6.2, 6.2])
    box(out, 'stone', [-13.2, 2.7, z], [0.64, 5.4, 0.8], [0.64, 0.59, 0.49]);
  box(out, 'metal', [-14.7, 5.25, 0], [4.3, 0.26, 10.7], [0.54, 0.56, 0.51]);
  for (const z of [-4.9, 4.9])
    beam(out, 'metal', [-16.7, 0.15, z], [-16.7, 5.2, z], 0.14, 0.18, silver);
}
function build(out, level) {
  const cfg = settings[level],
    target =
      level === 'skyline'
        ? Object.fromEntries(
            ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
              name,
              (slot, _ref, p, n, uv, c) => {
                const mean =
                  slot === 'glass'
                    ? null
                    : scope.sourceFacts.surfaceMeans[
                        slot === 'metal' ? 'metal_painted' : 'stone_granite'
                      ];
                out[name](
                  'silhouette',
                  'palette:#ffffff',
                  p,
                  n,
                  uv,
                  mean ? c.map((v, i) => v * mean[i]) : c,
                );
              },
            ]),
          )
        : out;
  buildRose(target, map, cfg);
}
export const buildRoseReviewedMaster = (out) => build(out, 'closeup');
export const buildRoseSkyline = (out) => build(out, 'skyline');
export const buildRoseDistrict = (out) => build(out, 'district');
export const buildRoseStreet = (out) => build(out, 'street');
export const buildRoseCloseup = (out) => build(out, 'closeup');
