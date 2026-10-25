/** Zifeng Tower: complete triangular shaft, interlocking seams, two crown forms and lower annex. */
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import {
  face,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  panel,
  partPlan,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'zifeng_tower',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json')));
const settings = {
  source: { dx: 4.3, dy: 8.1, corner: 3, crown: 24, blade: 8, mast: 16, tree: 8, detail: true },
  closeup: { dx: 4.3, dy: 8.1, corner: 3, crown: 24, blade: 8, mast: 16, tree: 8, detail: true },
  street: { dx: 8.6, dy: 16.2, corner: 2, crown: 16, blade: 6, mast: 12, tree: 6, detail: false },
  district: { dx: 17.2, dy: 32.4, corner: 1, crown: 10, blade: 4, mast: 8, tree: 6, detail: false },
  skyline: { dx: 0, dy: 0, corner: 1, crown: 4, blade: 1, mast: 4, tree: 4, detail: false },
};
function cleanPlan(plan, tolerance = 0.12) {
  const p = plan.map((q) => q.slice());
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        d = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        d > 0 &&
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / d < tolerance &&
        (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) >= 0
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.03);
}
function roundedOutline(plan, radius = 2.7, subdivisions = 6) {
  const result = [];
  for (let i = 0; i < plan.length; i++) {
    const p = plan[(i + plan.length - 1) % plan.length],
      q = plan[i],
      r = plan[(i + 1) % plan.length];
    const d0 = Math.hypot(p[0] - q[0], p[1] - q[1]),
      d1 = Math.hypot(r[0] - q[0], r[1] - q[1]);
    const a = lerp(q, p, Math.min(0.4, radius / d0)),
      b = lerp(q, r, Math.min(0.4, radius / d1));
    for (let j = 0; j <= subdivisions; j++) {
      const t = j / subdivisions;
      result.push(
        [0, 1].map((k) => (1 - t) * (1 - t) * a[k] + 2 * t * (1 - t) * q[k] + t * t * b[k]),
      );
    }
  }
  return result;
}

function build(out, level) {
  const m = map,
    c = settings[level],
    plan = roundedOutline(localOutline(m), 2.7, c.corner),
    trim = [0.7, 0.73, 0.73],
    tint = [0.39, 0.51, 0.58];
  const curtain = (out, plan, lo, hi, { tint, trim, slot = 'metal' }) => {
    for (const { a, b, len, n } of edges(plan)) {
      const at = (u, y) => [a[0] + (b[0] - a[0]) * u, y, a[1] + (b[1] - a[1]) * u];
      face(out, 'glass', [at(0, lo), at(1, lo), at(1, hi), at(0, hi)], tint);
      if (c.dy)
        for (let y = lo + c.dy; y < hi - 0.1; y += c.dy)
          face(
            out,
            slot,
            [
              shift(at(0, y - 0.18), n, 0.035),
              shift(at(1, y - 0.18), n, 0.035),
              shift(at(1, y + 0.18), n, 0.035),
              shift(at(0, y + 0.18), n, 0.035),
            ],
            trim,
          );
      if (c.dx) {
        const columns = Math.max(1, Math.ceil(len / c.dx));
        for (let j = 0; j <= columns; j++) {
          const u = Math.max(0, j / columns - 0.05 / len),
            v = Math.min(1, j / columns + 0.05 / len);
          face(
            out,
            slot,
            [
              shift(at(u, lo), n, 0.04),
              shift(at(v, lo), n, 0.04),
              shift(at(v, hi), n, 0.04),
              shift(at(u, hi), n, 0.04),
            ],
            trim,
          );
        }
      }
    }
  };
  const crownGrid = (out, p, tint, _dx, _dy, _frame, trim) => {
    face(out, 'glass', p, tint);
    if (c.dy) {
      const hi = Math.min(p[2][1], p[3][1]);
      for (let y = p[0][1] + c.dy; y < hi; y += c.dy) {
        const a = lerp(p[0], p[3], (y - p[0][1]) / (p[3][1] - p[0][1])),
          b = lerp(p[1], p[2], (y - p[1][1]) / (p[2][1] - p[1][1]));
        beam(out, 'metal', a, b, 0.08, 0.1, trim);
      }
    }
  };
  mappedSolid(out, 'foundation', localOutline(m), 0, 0.22, [0.32, 0.35, 0.36]);
  const perimeter = edges(plan),
    total = perimeter.reduce((s, e) => s + e.len, 0),
    roofCells = [],
    seamCells = [];
  let base = 0;
  for (const { a, b, len, n } of perimeter) {
    const divisions = [0, 1],
      nx = c.dx ? Math.max(1, Math.ceil(len / c.dx)) : 1;
    for (let i = 1; i < nx; i++) divisions.push(i / nx);
    // Explicit phase controls prevent a distant bay grid from losing the exposed vertical seam.
    for (const phase of [0.39, 0.425]) {
      const u = (phase * total - base) / len;
      if (u > 0 && u < 1) divisions.push(u);
    }
    divisions.sort((a, b) => a - b);
    for (let i = 0; i < divisions.length - 1; i++) {
      const A = lerp(a, b, divisions[i]),
        B = lerp(a, b, divisions[i + 1]),
        phase = (base + (len * (divisions[i] + divisions[i + 1])) / 2) / total,
        vertical = phase > 0.39 && phase < 0.425,
        top = phase < 0.425 ? 339.25 : 327;
      roofCells.push({ A, B, top, n, phase, vertical });
      if (vertical) seamCells.push({ A, B });
      const ys = [0.22, 41, 49, 156, 172, 268, 284, top];
      if (c.dy) for (let y = 0.22 + c.dy; y < top - 0.01; y += c.dy) ys.push(y);
      ys.sort((a, b) => a - b);
      for (let j = 0; j < ys.length - 1; j++) {
        const y0 = ys[j],
          y1 = ys[j + 1],
          yc = (y0 + y1) / 2,
          atrium =
            (phase < 0.425 && yc > 156 && yc < 172) ||
            (phase >= 0.425 && yc > 268 && yc < 284) ||
            (yc > 41 && yc < 49),
          inset = vertical || atrium ? 2.1 : 0;
        const p = [
          [A[0] - n[0] * inset, y0, A[1] - n[2] * inset],
          [B[0] - n[0] * inset, y0, B[1] - n[2] * inset],
          [B[0] - n[0] * inset, y1, B[1] - n[2] * inset],
          [A[0] - n[0] * inset, y1, A[1] - n[2] * inset],
        ];
        if (inset) {
          face(out, 'glass', p, [0.15, 0.21, 0.23]);
          // Only the actual recess boundaries have shelves; no floating shelf every artificial row.
          if ([41, 49, 156, 172, 268, 284].includes(y0))
            face(out, 'metal', [p[0], p[1], [B[0], y0, B[1]], [A[0], y0, A[1]]], trim);
          if ([41, 49, 156, 172, 268, 284].includes(y1))
            face(out, 'metal', [p[3], [A[0], y1, A[1]], [B[0], y1, B[1]], p[2]], trim);
          if (atrium && !vertical && c.dx && i === 0)
            beam(out, 'metal', shift(p[0], n, 1.8), shift(p[3], n, 1.8), 0.38, 0.45, trim);
        } else if (level === 'district') {
          face(out, 'glass', p, tint);
          const u = 0.035 / Math.max(0.1, Math.hypot(B[0] - A[0], B[1] - A[1]));
          face(
            out,
            'metal',
            [
              shift(p[0], n, 0.04),
              shift(lerp(p[0], p[1], u), n, 0.04),
              shift(lerp(p[3], p[2], u), n, 0.04),
              shift(p[3], n, 0.04),
            ],
            trim,
          );
        } else if (c.dx) {
          const raised = (i + j) % 2 ? [0, 3] : [1, 2],
            q = p.map((v, k) => shift(v, n, raised.includes(k) ? 0.23 : 0));
          panel(out, q, tint, 0.055, trim);
          for (let k = 0; k < 4; k++) {
            const l = (k + 1) % 4;
            if (raised.includes(k) !== raised.includes(l))
              tri(out, 'metal', raised.includes(k) ? [p[k], p[l], q[k]] : [p[k], p[l], q[l]], trim);
          }
        } else face(out, 'glass', p, tint);
      }
      mappedCap(out, 'metal', [A, B, [0, 0]], top, [0.36, 0.4, 0.42]);
    }
    base += len;
  }
  for (let i = 0; i < roofCells.length; i++) {
    const a = roofCells[(i + roofCells.length - 1) % roofCells.length],
      b = roofCells[i];
    // Close the cut sides of each deep seam, including the joins around rounded corners.
    const heights = [0.22, 41, 49, 156, 172, 268, 284, Math.min(a.top, b.top)],
      inset = (q, y) =>
        q.vertical ||
        (q.phase < 0.425 && y > 156 && y < 172) ||
        (q.phase >= 0.425 && y > 268 && y < 284) ||
        (y > 41 && y < 49)
          ? 2.1
          : 0;
    for (let j = 0; j < heights.length - 1; j++) {
      const lo = heights[j],
        hi = heights[j + 1],
        y = (lo + hi) / 2,
        da = inset(a, y),
        db = inset(b, y),
        pa = [b.A[0] - a.n[0] * da, b.A[1] - a.n[2] * da],
        pb = [b.A[0] - b.n[0] * db, b.A[1] - b.n[2] * db];
      if (Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) > 0.00001)
        face(
          out,
          'metal',
          [
            [pa[0], lo, pa[1]],
            [pb[0], lo, pb[1]],
            [pb[0], hi, pb[1]],
            [pa[0], hi, pa[1]],
          ],
          trim,
        );
    }
    if (a.top === b.top) continue;
    let p = [
      [0, a.top, 0],
      [b.A[0], a.top, b.A[1]],
      [b.A[0], b.top, b.A[1]],
      [0, b.top, 0],
    ];
    if (a.top < b.top) p = p.toReversed();
    face(out, 'metal', p, trim);
  }
  const seamA = seamCells[0].A,
    seamB = seamCells.at(-1).B;
  for (let y = 52; c.dx && y < 323; y += 32)
    beam(
      out,
      'metal',
      [seamA[0] * 0.975, y, seamA[1] * 0.975],
      [seamB[0] * 0.975, Math.min(y + 26, 326), seamB[1] * 0.975],
      0.3,
      0.34,
      trim,
    );
  // Offset crown: two rounded, open-ended metal fins around a separate spire service mast.
  for (const [cx, cz, r, baseY, topY, phase] of [[-11, -9, 9.3, 327, 381.25, 0.6]]) {
    const count = c.crown,
      ring = [];
    for (let i = 0; i <= count; i++) {
      const t = phase - (i / count) * Math.PI * 1.65;
      ring.push([cx + r * Math.cos(t), cz + r * Math.sin(t)]);
    }
    for (let i = 0; i < count; i++) {
      const a = ring[i],
        b = ring[i + 1],
        ta = topY - 7 * (1 - Math.sin((i / count) * Math.PI)),
        tb = topY - 7 * (1 - Math.sin(((i + 1) / count) * Math.PI));
      const h = Math.min(ta, tb);
      crownGrid(
        out,
        [
          [a[0], baseY, a[1]],
          [b[0], baseY, b[1]],
          [b[0], h, b[1]],
          [a[0], h, a[1]],
        ],
        [0.38, 0.44, 0.47],
        1.4,
        2,
        0.065,
        trim,
      );
      if (Math.abs(ta - tb) > 0.001)
        tri(
          out,
          'metal',
          ta > tb
            ? [
                [a[0], h, a[1]],
                [b[0], h, b[1]],
                [a[0], ta, a[1]],
              ]
            : [
                [a[0], h, a[1]],
                [b[0], h, b[1]],
                [b[0], tb, b[1]],
              ],
          trim,
        );
      if (c.dx) beam(out, 'metal', [a[0], ta, a[1]], [b[0], tb, b[1]], 0.28, 0.32, trim);
      const ia = [cx + (a[0] - cx) * 0.96, cz + (a[1] - cz) * 0.96],
        ib = [cx + (b[0] - cx) * 0.96, cz + (b[1] - cz) * 0.96];
      face(
        out,
        'metal',
        [
          [ia[0], baseY, ia[1]],
          [ia[0], ta, ia[1]],
          [ib[0], tb, ib[1]],
          [ib[0], baseY, ib[1]],
        ],
        [0.35, 0.41, 0.43],
      );
      face(
        out,
        'metal',
        [
          [a[0], ta, a[1]],
          [b[0], tb, b[1]],
          [ib[0], tb, ib[1]],
          [ia[0], ta, ia[1]],
        ],
        trim,
      );
      if (i === 0)
        face(
          out,
          'metal',
          [
            [a[0], baseY, a[1]],
            [a[0], ta, a[1]],
            [ia[0], ta, ia[1]],
            [ia[0], baseY, ia[1]],
          ],
          trim,
        );
      if (i === count - 1)
        face(
          out,
          'metal',
          [
            [b[0], baseY, b[1]],
            [ib[0], baseY, ib[1]],
            [ib[0], tb, ib[1]],
            [b[0], tb, b[1]],
          ],
          trim,
        );
    }
    for (let y = baseY + 1; c.detail && y < topY - 7; y += 5)
      for (let i = 0; i < count; i++)
        beam(
          out,
          'metal',
          [ring[i][0], y, ring[i][1]],
          [ring[i + 1][0], y, ring[i + 1][1]],
          0.045,
          0.06,
          trim,
        );
  }
  const bladeA = [-7, -18],
    bladeB = [21, 0],
    theta = Math.atan2(bladeB[1] - bladeA[1], bladeB[0] - bladeA[0]),
    blade = [];
  for (const [center, start] of [
    [bladeB, theta + Math.PI / 2],
    [bladeA, theta - Math.PI / 2],
  ])
    for (let i = 0; i <= c.blade; i++) {
      const t = start - (Math.PI * i) / c.blade;
      blade.push([center[0] + 2.45 * Math.cos(t), center[1] + 2.45 * Math.sin(t)]);
    }
  curtain(out, blade, 327, 370.5, {
    dx: 1.45,
    dy: 4.04,
    tint: [0.47, 0.57, 0.62],
    trim,
    frame: 0.055,
  });
  mappedCap(out, 'metal', blade, 370.5, trim);
  const mastCenter = [-5, -7];
  loft(
    out,
    'metal',
    [
      [327, 1.35],
      [384, 1.35],
      [405, 0.95],
      [424, 0.58],
      [449.9, 0.13],
      [450, 0.09],
    ].map(([y, r]) => radialRing(y, r, r, c.mast, mastCenter)),
    [0.76, 0.77, 0.73],
  );
  for (const y of [344, 358, 373]) {
    loft(
      out,
      'metal',
      [
        radialRing(y, 2.4, 2.4, c.mast, mastCenter),
        radialRing(y + 0.45, 2.4, 2.4, c.mast, mastCenter),
      ],
      trim,
    );
    if (c.dx) beam(out, 'metal', [-11, y, -9], [mastCenter[0], y, mastCenter[1]], 0.4, 0.45, trim);
  }
  for (let y = 406; c.detail && y < 426; y += 4.2)
    loft(
      out,
      'metal',
      [
        radialRing(y, 1.27, 1.27, c.mast, mastCenter),
        radialRing(y + 0.28, 1.27, 1.27, c.mast, mastCenter),
      ],
      trim,
    );

  const podium = cleanPlan(
    partPlan(
      m,
      map.elements.find((p) => p.id === 951598027),
    ),
    0.015,
  );
  mappedSolid(out, 'foundation', podium, 0, 0.22, [0.32, 0.35, 0.36]);
  curtain(out, podium, 0.22, 44, {
    tint: [0.28, 0.34, 0.35],
    trim: [0.38, 0.4, 0.39],
    slot: 'stone',
  });
  mappedCap(out, 'stone', podium, 44, [0.38, 0.41, 0.39]);
  const annex = roundedOutline(
    partPlan(
      m,
      map.elements.find((p) => p.id === 951598028),
    ),
    2.4,
    c.corner,
  );
  curtain(out, annex, 44, 99.5, { tint: [0.37, 0.51, 0.59], trim: [0.65, 0.7, 0.71] });
  mappedCap(out, 'metal', annex, 99.5, [0.5, 0.56, 0.57]);
  // Reconstructed static pool/garden layout on the supported mapped44m roof.
  box(out, 'stone', [-33, 44, 39], [-11, 44.3, 53], [0.55, 0.59, 0.55]);
  mappedCap(
    out,
    'glass',
    [
      [-32.5, 39.5],
      [-32.5, 52.5],
      [-11.5, 52.5],
      [-11.5, 39.5],
    ],
    44.34,
    [0.08, 0.37, 0.55],
  );
  for (const [x, z] of [
    [-37, 37],
    [5, 38],
  ]) {
    box(out, 'stone', [x - 1, 44, z - 1], [x + 1, 44.5, z + 1], [0.59, 0.59, 0.53]);
    if (level === 'skyline') {
      loft(
        out,
        'recess',
        [
          [44.5, 1.45],
          [48.3, 0.1],
        ].map(([y, r]) => radialRing(y, r, r, 4, [x, z])),
        [0.22, 0.36, 0.16],
      );
      continue;
    }
    tube(out, 'metal', [x, 44.5, z], [x, 47.3, z], 0.12, [0.22, 0.21, 0.16], c.mast);
    loft(
      out,
      'recess',
      [
        [45.3, 1.3],
        [47.2, 1.45],
        [48.3, 0.1],
      ].map(([y, r]) => radialRing(y, r, r, c.tree, [x, z])),
      [0.22, 0.36, 0.16],
    );
  }
}
export function buildZifengReviewedMaster(out) {
  build(out, 'source');
}
export function buildZifengCloseup(out) {
  build(out, 'closeup');
}
export function buildZifengStreet(out) {
  build(out, 'street');
}
export function buildZifengDistrict(out) {
  build(out, 'district');
}
export function buildZifengSkyline(out) {
  const wrapped = {};
  for (const method of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    wrapped[method] = (component, _ref, p, n, uv, color) => {
      const graph = {
          foundation: 'concrete_plain',
          stone: 'stone_granite',

          metal: 'metal_painted',
        }[component],
        mean = scope.sourceFacts.surfaceMeans[graph];
      out[method](
        'glass',
        'palette:#ffffff',
        p,
        n,
        uv,
        mean ? color.map((v, i) => v * mean[i]) : color,
      );
    };
  build(wrapped, 'skyline');
}
