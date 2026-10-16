/** 23 Marina: mapped offset shaft, 48 duplex terraces and open canopied crown. */
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
  beam as solidBeam,
  torus,
} from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  shift,
} from './signature-tower-expansion-models.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const scope = JSON.parse(readFileSync(structureSourcePath('n0182_23_marina', 'review-scope.json'))),
  map = JSON.parse(readFileSync(structureSourcePath('n0182_23_marina', 'map-frame.json')));
const settings = {
  skyline: { mult: 0, sides: 6, screen: 0 },
  district: { mult: 12, sides: 8, screen: 0 },
  street: { mult: 4, sides: 12, screen: 5 },
  closeup: { mult: 1, sides: 24, screen: 2.3 },
};
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.035);
}

function beam(out, cfg, slot, a, b, w, h, color) {
  if (cfg.mult && cfg.mult !== 12 && Math.max(w, h) > 0.3)
    return solidBeam(out, slot, a, b, w, h, color);
  const v = b.map((x, i) => x - a[i]),
    len = Math.hypot(...v),
    axis = Math.abs(v[1]) / len > 0.99 ? [1, 0, 0] : [0, 1, 0],
    n = [
      v[1] * axis[2] - v[2] * axis[1],
      v[2] * axis[0] - v[0] * axis[2],
      v[0] * axis[1] - v[1] * axis[0],
    ],
    s = Math.hypot(...n),
    u = n.map((x) => ((x / s) * w) / 2),
    q = [v[1] * u[2] - v[2] * u[1], v[2] * u[0] - v[0] * u[2], v[0] * u[1] - v[1] * u[0]],
    t = Math.hypot(...q),
    r = q.map((x) => ((x / t) * h) / 2);
  const directions = cfg.mult ? [r] : [u, r];
  for (const d of directions) {
    const points = [
      a.map((x, i) => x - d[i]),
      b.map((x, i) => x - d[i]),
      b.map((x, i) => x + d[i]),
      a.map((x, i) => x + d[i]),
    ];
    face(out, slot, points, color);
    if (cfg.mult) face(out, slot, [...points].reverse(), color);
  }
}
function bandPlan(out, cfg, plan, y, h, depth, color, slot) {
  for (const { a, b, n } of edges(plan)) {
    if (cfg.mult !== 1)
      face(
        out,
        slot,
        [
          [a[0], y, a[1]],
          [b[0], y, b[1]],
          [b[0], y + h, b[1]],
          [a[0], y + h, a[1]],
        ].map((p) => shift(p, n, depth / 2)),
        color,
      );
    else beam(out, cfg, slot, [a[0], y + h / 2, a[1]], [b[0], y + h / 2, b[1]], depth, h, color);
  }
}
function grid(out, cfg, p, color, dx, dy, frame, trim) {
  const height = Math.hypot(...p[3].map((v, k) => v - p[0][k])),
    width = Math.hypot(...p[1].map((v, k) => v - p[0][k])),
    coverage = frame / dx + frame / dy,
    mean = scope.sourceFacts.surfaceMeans.metal_painted;
  face(
    out,
    'glass',
    p,
    !cfg.mult ? color.map((v, i) => v * (1 - coverage) + trim[i] * mean[i] * coverage) : color,
  );
  if (!cfg.mult) return;
  const n = normalFor(...p),
    at = (u, v) => shift(lerp(lerp(p[0], p[1], u), lerp(p[3], p[2], u), v), n, 0.035),
    nx = Math.max(1, Math.round(width / (dx * cfg.mult))),
    ny = Math.max(1, Math.round(height / (dy * cfg.mult)));
  for (let i = 1; i < nx; i++) {
    const u = i / nx,
      w = frame / width / 2;
    face(out, 'metal', [at(u - w, 0), at(u + w, 0), at(u + w, 1), at(u - w, 1)], trim);
  }
  for (let j = 1; j < ny; j++) {
    const v = j / ny,
      w = frame / height / 2;
    face(out, 'metal', [at(0, v - w), at(1, v - w), at(1, v + w), at(0, v + w)], trim);
  }
}
function marinaGlazing(out, cfg, plan, y0, y1, step, white) {
  for (const { a, b, n } of edges(plan)) {
    grid(
      out,
      cfg,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [0.12, 0.28, 0.42],
      1.45,
      step,
      0.045,
      [0.68, 0.74, 0.75],
    );
    if (!cfg.mult) {
      if (y0 === 26.6)
        beam(out, cfg, 'metal', [a[0], y0, a[1]], [a[0], 317.3, a[1]], 0.72, 0.78, white);
      continue;
    }
    const floors = Math.max(1, Math.round((y1 - y0) / step / cfg.mult));
    for (let j = 1; j <= floors; j++) {
      const y = y0 + ((y1 - y0) * j) / floors;
      face(
        out,
        'metal',
        [
          [a[0], y, a[1]],
          [b[0], y, b[1]],
          [b[0], y + 0.26, b[1]],
          [a[0], y + 0.26, a[1]],
        ].map((p) => shift(p, n, 0.1)),
        white,
      );
    }
    if (y0 < 214)
      for (const u of [1 / 3, 2 / 3]) {
        const p = lerp(a, b, u);
        beam(
          out,
          cfg,
          'metal',
          shift([p[0], y0, p[1]], n, 0.075),
          shift([p[0], y1, p[1]], n, 0.075),
          0.35,
          0.3,
          white,
        );
      }
    beam(out, cfg, 'metal', [a[0], y0, a[1]], [a[0], y1, a[1]], 0.72, 0.78, white);
  }
}
function marinaScreen(out, cfg, at, width) {
  if (!cfg.screen) return;
  const stride = cfg.screen;
  for (let x = 0.42 * stride; x < width - 0.25; x += 0.67 * stride)
    for (let y = 4.15; y < 11.45; y += 0.7 * stride)
      for (let petal = 0; petal < 6; petal++) {
        const theta = (petal * Math.PI) / 3,
          cx = x + 0.14 * stride * Math.cos(theta),
          cy = y + 0.14 * stride * Math.sin(theta),
          sections = cfg.screen < 3 ? 6 : 4;
        for (let k = 0; k < sections; k++) {
          const a = (k * Math.PI * 2) / sections,
            b = ((k + 1) * Math.PI * 2) / sections,
            r = 0.22 * stride,
            w = 0.027 * stride;
          face(
            out,
            'metal',
            [
              at(cx + Math.cos(a) * (r + w), cy + Math.sin(a) * (r + w), 0.055),
              at(cx + Math.cos(b) * (r + w), cy + Math.sin(b) * (r + w), 0.055),
              at(cx + Math.cos(b) * (r - w), cy + Math.sin(b) * (r - w), 0.055),
              at(cx + Math.cos(a) * (r - w), cy + Math.sin(a) * (r - w), 0.055),
            ],
            [0.83, 0.82, 0.74],
          );
        }
      }
}
function build23Marina(out, m, cfg) {
  const parts = map.elements,
    plan = partPlan(
      m,
      parts.find((p) => p.id === 907717855),
    ),
    podium = localOutline(m),
    mast = partPlan(
      m,
      parts.find((p) => p.id === 186351102),
    );
  const center = mast.reduce(
      (a, p) => [a[0] + p[0] / mast.length, a[1] + p[1] / mast.length],
      [0, 0],
    ),
    white = [0.88, 0.88, 0.84],
    stone = [0.66, 0.66, 0.62];
  mappedSolid(out, 'foundation', podium, 0, 0.22, [0.56, 0.55, 0.51]);
  mappedSolid(
    out,
    'glass',
    podium,
    0.22,
    12.6,
    cfg.screen ? [0.2, 0.22, 0.215] : [0.41, 0.42, 0.39],
  );
  mappedCap(out, 'cladding', podium, 12.63, stone);
  // Meter-scale stone piers, carved-looking patterned screens and splayed fan ribs
  // follow the owner's architect's detailed street photograph of the low podium.
  if (cfg.mult)
    for (const { a, b, len, n } of edges(podium)) {
      const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
        at = (u, y, depth = 0.1) => [
          a[0] + d[0] * u + n[0] * depth,
          y,
          a[1] + d[1] * u + n[2] * depth,
        ];
      const count = Math.max(2, Math.round(len / 6)),
        bay = len / count;
      for (let i = 0; i < count; i++) {
        const left = i * bay,
          right = (i + 1) * bay,
          entry = n[2] < -0.8 && i === Math.floor(count / 2);
        beam(out, cfg, 'cladding', at(left, 0.25), at(left, 12.6), 0.75, 0.72, stone);
        if (entry) {
          grid(
            out,
            cfg,
            [
              at(left + 0.5, 0.25, 0.12),
              at(right - 0.5, 0.25, 0.12),
              at(right - 0.5, 11.5, 0.12),
              at(left + 0.5, 11.5, 0.12),
            ],
            [0.37, 0.46, 0.45],
            1.3,
            2.7,
            0.065,
            [0.56, 0.55, 0.49],
          );
          for (const u of [left + bay * 0.3, left + bay * 0.5, left + bay * 0.7])
            beam(
              out,
              cfg,
              'metal',
              at(u, 0.25, 0.18),
              at(u, 3.2, 0.18),
              0.095,
              0.13,
              [0.65, 0.66, 0.62],
            );
        } else {
          const local = (x, y, z) => at(left + 0.4 + x, y, z);
          marinaScreen(out, cfg, local, bay - 0.8);
          for (const t of cfg.mult === 12 ? [0.08, 0.92] : [0.08, 0.26, 0.43, 0.57, 0.74, 0.92]) {
            solidBeam(
              out,
              'metal',
              at(left + bay * 0.5, 3.8, 0.26),
              at(left + bay * t, 11.75, 0.26),
              0.18,
              0.18,
              white,
            );
          }
          for (let y = 0.65; y < 3.55; y += 0.13 * cfg.mult)
            beam(
              out,
              cfg,
              'metal',
              at(left + 0.48, y, 0.17),
              at(right - 0.48, y, 0.17),
              0.05,
              0.09,
              [0.66, 0.69, 0.65],
            );
        }
        beam(out, cfg, 'cladding', at(left, 12.05, 0.17), at(right, 12.05, 0.17), 0.85, 1.1, stone);
        beam(out, cfg, 'metal', at(left, 3.75, 0.17), at(right, 3.75, 0.17), 0.16, 0.22, white);
      }
    }
  // Six-storey entrance volume: slanted lower glazing and a screened structural
  // transfer storey. The outer white W braces stay above the landscaped podium.
  for (const { a, b, n } of edges(plan)) {
    const lowA = shift([a[0], 12.7, a[1]], n, 0.9),
      lowB = shift([b[0], 12.7, b[1]], n, 0.9),
      hiA = [a[0], 18.4, a[1]],
      hiB = [b[0], 18.4, b[1]];
    grid(out, cfg, [lowA, lowB, hiB, hiA], [0.18, 0.37, 0.49], 1.4, 1.9, 0.05, [0.72, 0.75, 0.73]);
    face(out, 'glass', [hiA, hiB, [b[0], 26, b[1]], [a[0], 26, a[1]]], [0.32, 0.33, 0.31]);
    if (cfg.mult)
      for (let y = 18.5; y < 25.6; y += 0.2 * Math.max(1, cfg.mult))
        beam(
          out,
          cfg,
          'metal',
          shift([a[0], y, a[1]], n, 0.08),
          shift([b[0], y, b[1]], n, 0.08),
          0.07,
          0.065,
          [0.59, 0.58, 0.52],
        );
    if (cfg.mult)
      for (const u of [0, 0.25, 0.5, 0.75, 1]) {
        const p = lerp(a, b, u),
          q = lerp(a, b, Math.min(1, u + 0.25));
        if (u < 1)
          beam(
            out,
            cfg,
            'metal',
            [p[0], u % 0.5 === 0 ? 25.5 : 18.3, p[1]],
            [q[0], u % 0.5 === 0 ? 18.3 : 25.5, q[1]],
            0.86,
            0.55,
            white,
          );
      }
    beam(out, cfg, 'cladding', [a[0], 12.65, a[1]], [a[0], 26, a[1]], 0.8, 0.9, stone);
    beam(out, cfg, 'cladding', [a[0], 26, a[1]], [b[0], 26, b[1]], 0.9, 1.05, stone);
  }
  marinaGlazing(out, cfg, plan, 26.6, 118, 3.6, white);
  marinaGlazing(out, cfg, plan, 118, 126, 2.66, white);
  marinaGlazing(out, cfg, plan, 126, 214, 3.67, white);
  marinaGlazing(out, cfg, plan, 214, 223, 3, white);
  marinaGlazing(out, cfg, plan, 223, 317.3, 3.93, white);
  for (const y of [118, 121.3, 125.5, 214, 217.5, 222.5, 316.5])
    bandPlan(out, cfg, plan, y, 0.74, 0.52, white, 'metal');
  // Four cardinal facets carry twelve real triangular duplex balconies each:
  //48 open terraces, with separate slab, glass guard and shallow plunge basin.
  for (const { a, b, n } of edges(plan).filter(
    (e) => Math.abs(e.n[0]) > 0.95 || Math.abs(e.n[2]) > 0.95,
  )) {
    const l = lerp(a, b, 0.22),
      r = lerp(a, b, 0.78),
      mid = lerp(a, b, 0.5),
      tip = [mid[0] + n[0] * 5.2, mid[1] + n[2] * 5.2],
      balcony = clockwise([l, r, tip]);
    for (let floor = 0; floor < 12; floor++) {
      const y = 225.9 + 7.6 * floor;
      mappedSolid(out, 'metal', balcony, y - 0.34, y, white);
      if (!cfg.mult) continue;
      for (const { a: p, b: q } of edges(balcony).filter(
        (e) => Math.abs(e.n[0] * n[0] + e.n[2] * n[2]) < 0.995,
      )) {
        face(
          out,
          'clear_glass',
          [
            [p[0], y + 0.13, p[1]],
            [q[0], y + 0.13, q[1]],
            [q[0], y + 1.1, q[1]],
            [p[0], y + 1.1, p[1]],
          ],
          [0.48, 0.68, 0.7],
        );
        if (cfg.mult !== 12)
          beam(
            out,
            cfg,
            'metal',
            [p[0], y + 1.13, p[1]],
            [q[0], y + 1.13, q[1]],
            0.075,
            0.08,
            [0.74, 0.77, 0.73],
          );
      }
      if (cfg.mult === 12) continue;
      const water = balcony.map((p) => [
        mid[0] + (p[0] - mid[0]) * 0.53 + n[0] * 0.45,
        mid[1] + (p[1] - mid[1]) * 0.53 + n[2] * 0.45,
      ]);
      mappedSolid(out, 'metal', water, y + 0.04, y + 0.15, [0.72, 0.77, 0.72]);
      mappedCap(out, 'glass', water, y + 0.165, [0.15, 0.53, 0.59]);
    }
    for (const u of [0.16, 0.84]) {
      const p = lerp(a, b, u);
      beam(out, cfg, 'metal', [p[0], 223, p[1]], [p[0], 317.3, p[1]], 0.72, 0.7, white);
    }
  }
  mappedCap(out, 'metal', plan, 317.3, [0.64, 0.68, 0.67]);
  const crownAt = (p, y) => {
    const s = 1 - ((y - 317.3) / (369 - 317.3)) * 0.9;
    return [center[0] + (p[0] - center[0]) * s, y, center[1] + (p[1] - center[1]) * s];
  };
  // The four broad triangular canopies alternate with open mast/bracing slots.
  // This is deliberately an open crown, not an unbroken octagonal pyramid.
  for (const { a, b, n } of edges(plan)) {
    const upper = !(Math.abs(n[0]) > 0.95 || Math.abs(n[2]) > 0.95);
    grid(
      out,
      cfg,
      [crownAt(a, 317.3), crownAt(b, 317.3), crownAt(b, 331.3), crownAt(a, 331.3)],
      [0.12, 0.29, 0.43],
      1.4,
      3.3,
      0.06,
      [0.75, 0.77, 0.73],
    );
    beam(out, cfg, 'metal', crownAt(a, 317.3), crownAt(a, 367.5), 0.78, 0.94, white);
    if (upper) {
      const lowA = crownAt(a, 331.3),
        lowB = crownAt(b, 331.3),
        topA = crownAt(a, 367.5),
        topB = crownAt(b, 367.5);
      face(out, 'metal', [lowA, lowB, topB, topA], [0.78, 0.8, 0.75]);
      // Narrow horizontal louvre relief follows the sloping canopy, with a real
      // base/side thickness so the pale triangular skin never reads as a card.
      const side = [lowA, lowB, topB, topA],
        normal = normalFor(...side);
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4;
        face(
          out,
          'metal',
          [side[k], side[j], shift(side[j], normal, -0.22), shift(side[k], normal, -0.22)],
          white,
        );
      }
      if (cfg.mult)
        for (let row = 0; row < 35; row += cfg.mult) {
          const t = (row + 0.5) / 35,
            p = shift(lerp(lowA, topA, t), normal, 0.025),
            q = shift(lerp(lowB, topB, t), normal, 0.025);
          beam(out, cfg, 'metal', p, q, 0.04, 0.07, [0.59, 0.64, 0.64]);
        }
    } else if (cfg.mult)
      for (let row = 0; row < 5; row++) {
        const y = 331.3 + row * 6.7;
        beam(out, cfg, 'metal', crownAt(a, y), crownAt(b, y + 6.7), 0.22, 0.25, [0.57, 0.63, 0.64]);
        beam(out, cfg, 'metal', crownAt(b, y), crownAt(a, y + 6.7), 0.22, 0.25, [0.57, 0.63, 0.64]);
      }
  }
  const rings = [
    [321, 1.45],
    [355, 1.27],
    [381.5, 0.89],
    [389.8, 0.62],
  ].map(([y, r]) => radialRing(y, r, r, cfg.sides, center));
  loft(out, 'metal', rings, white);
  if (cfg.mult === 1)
    for (let y = 333; y < 387; y += 3.2)
      torus(
        out,
        'metal',
        [center[0], y, center[1]],
        1.39 - (y - 333) * 0.012,
        0.045,
        [0.69, 0.72, 0.68],
        cfg.sides,
        4,
      );
  loft(
    out,
    'metal',
    [
      radialRing(389.8, 1.25, 1.25, 8, center),
      radialRing(390.4, 1.25, 1.25, 8, center),
      radialRing(392.4, 0.025, 0.025, 8, center),
    ],
    white,
  );
}

function build(out, level) {
  const cfg = settings[level],
    target =
      level === 'skyline'
        ? Object.fromEntries(
            ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
              name,
              (slot, _ref, p, n, uv, c) => {
                const mean = slot.includes('glass')
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
  build23Marina(target, map, cfg);
}
export const buildMarinaReviewedMaster = (out) => build(out, 'closeup');
export const buildMarinaSkyline = (out) => build(out, 'skyline');
export const buildMarinaDistrict = (out) => build(out, 'district');
export const buildMarinaStreet = (out) => build(out, 'street');
export const buildMarinaCloseup = (out) => build(out, 'closeup');
