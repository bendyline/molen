/** Atlanta's Bank of America Plaza: granite piers, stepped tube cage and gold obelisk. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beam, loft, sphere } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  mappedCap,
  mappedSolid,
  rotatedBuilder,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const granite = [0.47, 0.3, 0.275],
  glass = [0.065, 0.1, 0.115],
  metal = [0.22, 0.135, 0.105],
  gold = [0.72, 0.49, 0.12];
const rect = (x0, z0, x1, z1) =>
  clockwise([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]);
function stepped(a, b = a * 0.75, c = a * 0.5) {
  return clockwise([
    [-c, a],
    [c, a],
    [c, b],
    [b, b],
    [b, c],
    [a, c],
    [a, -c],
    [b, -c],
    [b, -b],
    [c, -b],
    [c, -a],
    [-c, -a],
    [-c, -b],
    [-b, -b],
    [-b, -c],
    [-a, -c],
    [-a, c],
    [-b, c],
    [-b, b],
    [-c, b],
  ]);
}
function edges(plan) {
  return plan.map((a, i) => {
    const b = plan[(i + 1) % plan.length],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    return {
      index: i,
      l,
      a,
      b,
      at: (x, y, d = 0) => [a[0] + u[0] * x - u[1] * d, y, a[1] + u[1] * x + u[0] * d],
    };
  });
}
function panel(out, slot, at, x0, x1, y0, y1, color, d = 0) {
  face(out, slot, [at(x0, y0, d), at(x1, y0, d), at(x1, y1, d), at(x0, y1, d)], color);
}
function solidPanel(out, at, x0, x1, y0, y1, d0, d1, color = granite) {
  if (out.detail === 'district') return panel(out, 'cladding', at, x0, x1, y0, y1, color, d1);
  const points = rect(x0, d0, x1, d1);
  // Use individually transformed faces, since side faces are rotated relative to world X/Z.
  const rings = [y0, y1].map((y) => points.map(([x, d]) => at(x, y, d)));
  loft(out, 'cladding', rings, color);
}
function stoneCourses(out, at, x0, x1, y0, y1, d = 0.12) {
  solidPanel(out, at, x0, x1, y0, y1, d - 0.12, d, granite);
  if (out.detail !== 'closeup') return;
  for (let y = y0 + 1.02; y < y1 - 0.01; y += 1.02)
    panel(out, 'recess', at, x0, x1, y, y + 0.012, [0.28, 0.19, 0.17], d + 0.004);
}
function towerFace(out, edge, y0, y1, rows) {
  const { l, at } = edge,
    dy = (y1 - y0) / rows;
  panel(out, 'recess', at, 0, l, y0, y1, [0.035, 0.037, 0.039], -0.22);
  if (l > 15 || edge.index % 5 === 2 || edge.index % 5 === 3) {
    const n =
        out.detail === 'district'
          ? l > 15
            ? 4
            : 1
          : out.detail === 'street'
            ? l > 15
              ? 7
              : 2
            : l > 15
              ? 14
              : 4,
      margin = l > 15 ? 1.22 : 0.25,
      pitch = (l - 2 * margin) / n;
    solidPanel(out, at, 0, margin, y0, y1, -0.12, 0.21);
    solidPanel(out, at, l - margin, l, y0, y1, -0.12, 0.21);
    for (let j = 0; j < n; j++) {
      const x = margin + j * pitch;
      solidPanel(out, at, x - 0.1, x + 0.1, y0, y1, -0.14, 0.25);
      panel(out, 'glass', at, x + 0.105, x + pitch - 0.105, y0, y1, glass, -0.045);
      for (let k = 0; k < rows; k++) {
        const lo = y0 + k * dy;
        panel(out, 'metal', at, x + 0.09, x + pitch - 0.09, lo, lo + 0.175, metal, -0.025);
        if (out.detail === 'closeup') {
          panel(out, 'recess', at, x - 0.1, x + 0.1, lo, lo + 0.012, [0.28, 0.19, 0.17], 0.254);
        }
      }
    }
    solidPanel(out, at, l - margin - 0.1, l - margin + 0.1, y0, y1, -0.14, 0.25);
  } else {
    const middle = l * 0.5,
      w = Math.min(1.6, l * 0.29),
      left = middle - w / 2,
      right = middle + w / 2;
    solidPanel(out, at, 0, left, y0, y1, -0.1, 0.14);
    solidPanel(out, at, right, l, y0, y1, -0.1, 0.14);
    panel(out, 'glass', at, left, right, y0, y1, glass, -0.1);
    for (let k = 0; k < rows; k++) {
      const lo = y0 + k * dy,
        hi = lo + dy;
      panel(out, 'cladding', at, left, right, lo, Math.min(lo + 1.02, hi), granite, 0.14);
      panel(out, 'cladding', at, left, right, Math.max(hi - 0.45, lo), hi, granite, 0.14);
      if (out.detail === 'closeup')
        panel(out, 'metal', at, left, right, lo + 1.02, lo + 1.095, metal, 0.15);
    }
    if (out.detail === 'closeup')
      for (const x of [left, right])
        solidPanel(out, at, x - 0.0325, x + 0.0325, y0, y1, 0.075, 0.15, metal);
  }
}
function shaft(out) {
  const stages = [
    { a: 24.5, y0: 18.4, y1: 154, rows: 33 },
    { a: 23.25, y0: 154, y1: 198, rows: 11 },
    { a: 21.85, y0: 198, y1: 229.4, rows: 8 },
  ];
  for (const s of stages) {
    const plan = stepped(s.a);
    const rows =
      out.detail === 'district'
        ? Math.max(1, Math.round((s.y1 - s.y0) / 24))
        : out.detail === 'street'
          ? Math.max(1, Math.round(s.rows / 2))
          : s.rows;
    for (const e of edges(plan)) towerFace(out, e, s.y0, s.y1, rows);
    mappedCap(out, 'recess', plan, s.y1, [0.17, 0.15, 0.14]);
    for (const { a, b, l, at } of edges(plan)) {
      if (out.detail === 'closeup')
        beam(
          out,
          'cladding',
          [a[0], s.y1 + 0.12, a[1]],
          [b[0], s.y1 + 0.12, b[1]],
          0.3,
          0.32,
          granite,
        );
      else panel(out, 'cladding', at, 0, l, s.y1, s.y1 + 0.24, granite, 0.15);
    }
  }
  // The final office band terminates in open bays below the cage; the plant is set inward.
  const roof = stepped(21.85),
    es = edges(roof);
  mappedSolid(out, 'recess', stepped(16.1), 229.4, 241, [0.12, 0.12, 0.115]);
  for (const { l, at } of es) {
    if (l < 15) {
      stoneCourses(out, at, 0, l, 229.4, 234.8, 0.14);
      continue;
    }
    for (let j = 0; j <= 6; j++) {
      const x = 0.65 + ((l - 1.3) * j) / 6;
      solidPanel(out, at, x - 0.28, x + 0.28, 229.4, 234.8, -0.35, 0.25, granite);
    }
    solidPanel(out, at, 0, l, 234.4, 235.3, -0.45, 0.27, granite);
    for (let j = 0; j < 6; j++) {
      const x = 0.65 + ((l - 1.3) * j) / 6,
        xx = 0.65 + ((l - 1.3) * (j + 1)) / 6;
      beam(out, 'metal', at(x, 234.1, -0.22), at(xx, 230, -0.22), 0.22, 0.28, metal);
    }
  }
}
function cagePlan(y) {
  // Three stepped skins, retained as open horizontal tubes, inside the published spire datums.
  if (y <= 247.8) return stepped(22.8 - (y - 236.7) * 0.26);
  if (y <= 261.2) return stepped(18.9 - (y - 247.8) * 0.44);
  return stepped(12.8 - ((y - 261.2) * (12.8 - 2.8)) / (284.368 - 261.2));
}
function crown(out) {
  if (out.detail === 'district' || out.detail === 'street') return coarseCrown(out, false);
  const rouge = [0.37, 0.22, 0.17];
  const levels = [236.7, 247.8, 261.2, 284.368];
  for (let y = 236.7; y < 284.368; y += out.detail === 'street' ? 6.72 : 1.12) {
    const p = cagePlan(y);
    for (const { a, b } of edges(p))
      tube(out, 'metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.082, rouge, 4);
  }
  for (const y of levels) {
    const p = cagePlan(y);
    for (const { a, b } of edges(p))
      for (const dy of out.detail === 'street' ? [0] : [-0.18, 0.18])
        beam(out, 'metal', [a[0], y + dy, a[1]], [b[0], y + dy, b[1]], 0.24, 0.28, rouge);
  }
  // Internal inclined steel legs and braces stay visible through the skins.
  const intervals = [236.7, 242.3, 247.8, 254.5, 261.2, 269, 276.7, 284.368];
  for (let k = 1; k < intervals.length; k++) {
    const y0 = intervals[k - 1],
      y1 = intervals[k],
      p = cagePlan(y0 + 0.001),
      q = cagePlan(y1 - 0.001);
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length;
      beam(out, 'metal', [p[i][0], y0, p[i][1]], [q[i][0], y1, q[i][1]], 0.27, 0.33, rouge);
      if (out.detail === 'closeup' && (i % 5 === 0 || i % 5 === 2)) {
        beam(out, 'metal', [p[i][0], y0, p[i][1]], [q[j][0], y1, q[j][1]], 0.12, 0.16, rouge);
        beam(out, 'metal', [p[j][0], y0, p[j][1]], [q[i][0], y1, q[i][1]], 0.12, 0.16, rouge);
      }
    }
  }
  for (const y of [237.4, 247.4, 260.8]) {
    const r = cagePlan(y)[0][1] * 0.72;
    mappedSolid(out, 'metal', rect(-r, -r, r, r), y, y + 0.16, [0.23, 0.17, 0.13]);
    for (let x = -r; x <= r; x += 3)
      beam(out, 'metal', [x, y - 0.3, -r], [x, y - 0.3, r], 0.22, 0.36, metal);
  }
  for (const y of [247.8, 261.2]) {
    const outer = cagePlan(y - 0.001),
      inner = cagePlan(y + 0.001);
    for (let i = 0; i < outer.length; i++)
      beam(
        out,
        'metal',
        [outer[i][0], y, outer[i][1]],
        [inner[i][0], y, inner[i][1]],
        0.26,
        0.3,
        rouge,
      );
  }
  // Four stepped, faceted stages of the solid ninety-foot gold-leaf obelisk.
  const profiles = [
    [284.368, 2.3],
    [290.3, 2.25],
    [294.8, 1.17],
    [307.4, 0.94],
    [311.3, 0.18],
    [311.8, 0.055],
  ];
  for (let i = 1; i < profiles.length; i++) {
    const [y0, r0] = profiles[i - 1],
      [y1, r1] = profiles[i];
    loft(
      out,
      'gold',
      [
        rect(-r0, -r0, r0, r0).map(([x, z]) => [x, y0, z]),
        rect(-r1, -r1, r1, r1).map(([x, z]) => [x, y1, z]),
      ],
      gold,
    );
  }
  // Lighting housings and service ladder are geometry, not a permanently lit yellow cage.
  for (let side = 0; out.detail === 'closeup' && side < 4; side++) {
    const target = Object.assign(rotatedBuilder(out, (side * Math.PI) / 2), { detail: out.detail });
    for (let j = 0; j < 11; j += out.detail === 'closeup' ? 1 : 3)
      for (const z of [18.6, 20.2]) {
        const x = -9.5 + j * 1.9;
        box(
          target,
          'metal',
          [x - 0.28, 235.4, z - 0.22],
          [x + 0.28, 235.7, z + 0.22],
          [0.09, 0.1, 0.1],
        );
        face(
          target,
          'glass',
          [
            [x - 0.24, 235.72, z - 0.18],
            [x - 0.24, 235.72, z + 0.18],
            [x + 0.24, 235.72, z + 0.18],
            [x + 0.24, 235.72, z - 0.18],
          ],
          [0.57, 0.58, 0.43],
        );
      }
  }
  for (const x of [-0.31, 0.31])
    beam(out, 'metal', [x, 238, -2.1], [x, 284, -2.1], 0.065, 0.065, metal);
  for (let y = 238; out.detail === 'closeup' && y < 284; y += 0.72)
    tube(out, 'metal', [-0.31, y, -2.1], [0.31, y, -2.1], 0.025, metal, 4);
}
function portal(out, angle, ground = 0.32) {
  if (out.detail === 'district') return coarsePortal(out, angle, ground, false);
  const target = Object.assign(rotatedBuilder(out, angle, [0, ground, 0]), { detail: out.detail }),
    distance = 18.4 * Math.SQRT2;
  const z = distance,
    spring = 5.35,
    inner = 2.95,
    rise = 2.35,
    archSegments = out.detail === 'closeup' ? 16 : 4;
  const arch = (r, ry, t, d) => [r * Math.cos(t), spring + ry * Math.sin(t), z + d];
  // The diagonal portal projects across the stepped shaft plan and needs its own threshold floor.
  box(target, 'stone', [-8.5, -ground, z - 4], [8.5, 0, z + 0.35], granite);
  // Five deeply stepped archivolts with real intrados and vertical jambs.
  for (let j = 0; j < 5; j++) {
    const r0 = inner + j * 0.48,
      r1 = r0 + 0.48,
      ry0 = rise + j * 0.42,
      ry1 = ry0 + 0.42,
      d0 = -0.85 + j * 0.23,
      d1 = d0 + 0.22;
    for (const sign of [-1, 1])
      box(
        target,
        'cladding',
        [sign < 0 ? -r1 : r0, 0, z + d0],
        [sign < 0 ? -r0 : r1, spring, z + d1],
        granite,
      );
    for (let i = 0; i < archSegments; i++) {
      const a = (i * Math.PI) / archSegments,
        b = ((i + 1) * Math.PI) / archSegments;
      const p = [
        arch(r0, ry0, a, d1),
        arch(r1, ry1, a, d1),
        arch(r1, ry1, b, d1),
        arch(r0, ry0, b, d1),
      ];
      face(target, 'cladding', p, granite);
      face(
        target,
        'cladding',
        [arch(r0, ry0, a, d0), arch(r0, ry0, a, d1), arch(r0, ry0, b, d1), arch(r0, ry0, b, d0)],
        granite.map((v) => v * 0.9),
      );
      face(
        target,
        'cladding',
        [arch(r1, ry1, b, d0), arch(r1, ry1, b, d1), arch(r1, ry1, a, d1), arch(r1, ry1, a, d0)],
        granite,
      );
      face(
        target,
        'cladding',
        [arch(r0, ry0, b, d0), arch(r1, ry1, b, d0), arch(r1, ry1, a, d0), arch(r0, ry0, a, d0)],
        granite,
      );
    }
  }
  // Flat surrounding wall has the opening cut out; no stone plane is hidden immediately behind glass.
  for (const s of [-1, 1])
    box(
      target,
      'cladding',
      [s < 0 ? -8.5 : 5.33, 0, z - 0.9],
      [s < 0 ? -5.33 : 8.5, 12.4, z + 0.2],
      granite,
    );
  // Match the actual polygonal outer archivolt, so no curved-wall slivers expose the sky.
  const wallRadius = inner + 5 * 0.48,
    wallRise = rise + 5 * 0.42;
  for (let i = 0; i < archSegments; i++) {
    const a = arch(wallRadius, wallRise, (i * Math.PI) / archSegments, 0.2),
      b = arch(wallRadius, wallRise, ((i + 1) * Math.PI) / archSegments, 0.2);
    face(target, 'cladding', [b, a, [a[0], 12.4, z + 0.2], [b[0], 12.4, z + 0.2]], granite);
  }
  // Recessed full-height arch glazing and the actual paired brass doors.
  face(
    target,
    'clear_glass',
    [
      [-inner, 0, z - 0.9],
      [inner, 0, z - 0.9],
      [inner, spring, z - 0.9],
      [-inner, spring, z - 0.9],
    ],
    glass,
  );
  for (let i = 0; i < archSegments; i++)
    tri(
      target,
      'clear_glass',
      [
        [0, spring, z - 0.9],
        arch(inner, rise, (i * Math.PI) / archSegments, -0.9),
        arch(inner, rise, ((i + 1) * Math.PI) / archSegments, -0.9),
      ],
      glass,
    );
  for (let y = 0; y <= 7.5; y += 1.45) {
    const w = y > spring ? inner * Math.sqrt(Math.max(0, 1 - ((y - spring) / rise) ** 2)) : inner;
    beam(target, 'gold', [-w, y, z - 0.84], [w, y, z - 0.84], 0.065, 0.07, gold);
  }
  for (const x of [-inner, -1.46, 0, 1.46, inner])
    beam(
      target,
      'gold',
      [x, 0, z - 0.83],
      [x, x === -inner || x === inner ? spring : 7.5, z - 0.83],
      0.075,
      0.09,
      gold,
    );
  for (const x of [-2.14, -0.71, 0.71, 2.14]) {
    box(target, 'gold', [x - 0.67, 0, z - 0.78], [x + 0.67, 0.2, z - 0.7], gold);
    if (out.detail === 'closeup')
      tube(target, 'gold', [x + 0.5, 0.8, z - 0.6], [x + 0.5, 1.5, z - 0.6], 0.027, gold, 4);
  }
  box(target, 'cladding', [-8.6, 12.4, z - 1], [8.6, 12.62, z + 0.45], granite);
  // Recessed small squares form the crest above each portal; they are not a solid parapet band.
  for (let x = -5.2; x < 5.3; x += 1.3)
    box(target, 'cladding', [x, 12.62, z - 0.7], [x + 0.7, 13.05, z + 0.08], granite);
  box(target, 'cladding', [-5.3, 13.05, z - 0.83], [5.4, 13.28, z + 0.22], granite);
  const mortar = [0.28, 0.19, 0.17];
  for (let y = 0.85; out.detail === 'closeup' && y < 12.4; y += 0.85) {
    const opening =
      y < spring
        ? 5.35
        : y < 9.8
          ? 5.35 * Math.sqrt(Math.max(0, 1 - ((y - spring) / 4.45) ** 2))
          : 0;
    for (const [a, b] of [
      [-8.5, -opening],
      [opening, 8.5],
    ]) {
      if (b - a < 0.03) continue;
      face(
        target,
        'recess',
        [
          [a, y, z + 0.207],
          [b, y, z + 0.207],
          [b, y + 0.012, z + 0.207],
          [a, y + 0.012, z + 0.207],
        ],
        mortar,
      );
    }
    for (let x = -7.8; x < 8.4; x += 1.3) {
      const low = y - 0.83,
        high = y - 0.012;
      if (
        Math.abs(x) < 5.36 &&
        low < spring + 4.45 * Math.sqrt(Math.max(0, 1 - (x * x) / 5.35 ** 2))
      )
        continue;
      face(
        target,
        'recess',
        [
          [x, low, z + 0.207],
          [x + 0.01, low, z + 0.207],
          [x + 0.01, high, z + 0.207],
          [x, high, z + 0.207],
        ],
        mortar,
      );
    }
  }
  for (const s of [-1, 1]) {
    box(
      target,
      'cladding',
      [s < 0 ? -8.55 : 5.5, 0, z - 1.0],
      [s < 0 ? -5.5 : 8.55, 18.4, z + 0.05],
      granite,
    );
    loft(
      target,
      'cladding',
      [
        rect(s < 0 ? -8.55 : 5.5, z - 1, s < 0 ? -5.5 : 8.55, z + 0.05).map(([x, zz]) => [
          x,
          18.4,
          zz,
        ]),
        rect(s < 0 ? -9.15 : 4.9, z - 1.6, s < 0 ? -4.9 : 9.15, z + 0.65).map(([x, zz]) => [
          x,
          19.6,
          zz,
        ]),
      ],
      granite,
    );
  }
}
function base(out, m) {
  if (out.detail === 'district') return farBase(out, m, false);
  const ground = 0.32,
    plan = stepped(24.5);
  mappedSolid(out, 'stone', plan, 0, ground, granite);
  for (const { l, at } of edges(plan)) {
    if (l > 15) {
      grid(
        out,
        [
          at(1.22, ground, -0.1),
          at(l - 1.22, ground, -0.1),
          at(l - 1.22, 3.6576, -0.1),
          at(1.22, 3.6576, -0.1),
        ],
        glass,
        1.45,
        1.7,
        0.055,
        metal,
      );
      towerFace(
        out,
        { l, at },
        3.6576,
        18.4,
        out.detail === 'district' ? 1 : out.detail === 'street' ? 2 : 4,
      );
    }
  }
  for (const e of edges(plan))
    if (e.l < 15) towerFace(out, e, 12.7, 18.4, out.detail === 'closeup' ? 2 : 1);
  mappedCap(out, 'recess', plan, 12.7, [0.12, 0.115, 0.105], [], true);
  mappedSolid(out, 'recess', rect(-8, -8, 8, 8), 0.32, 12.7, [0.11, 0.105, 0.1]);
  // Four corner triumphal portals face the street grid, independently checked against three mapped entrances.
  for (const angle of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4])
    portal(out, angle, ground);
  const wing = clockwise(m.geometry.wingOutline.slice(0, -1));
  mappedSolid(out, 'foundation', wing, 0, 0.3, [0.33, 0.3, 0.28]);
  const es = edges(wing);
  for (const e of es) {
    if (e.l < 1) continue;
    const { l, at } = e;
    // The mirrored north gallery is preserved as glass rather than projected proposed restaurants.
    panel(out, 'recess', at, 0, l, 0.3, 11.6, [0.065, 0.066, 0.065], -0.12);
    grid(
      out,
      [at(0, 0.3), at(l, 0.3), at(l, 11.6), at(0, 11.6)],
      [0.095, 0.13, 0.135],
      out.detail === 'district' ? 12 : out.detail === 'street' ? 4.5 : 1.5,
      out.detail === 'district' ? 11.3 : 3.8,
      0.075,
      metal,
    );
    solidPanel(out, at, 0, l, 11.6, 12.0, -0.1, 0.17, granite);
    for (let y = 4.1; y < 11; y += 3.8)
      solidPanel(out, at, 0, l, y - 0.1, y + 0.1, -0.1, 0.12, granite);
  }
  mappedCap(out, 'recess', wing, 12, [0.18, 0.185, 0.18]);
  for (const e of es)
    for (
      let x = 0.5;
      out.detail !== 'district' && x < e.l;
      x += out.detail === 'closeup' ? 6 : 12
    ) {
      const { at } = e;
      tube(out, 'metal', at(x, 12, 0.02), at(x, 13.05, 0.02), 0.027, metal, 4);
    }
  for (const { l, at } of es)
    tube(out, 'metal', at(0, 13.05, 0.02), at(l, 13.05, 0.02), 0.035, metal, 4);
  // Bounded entrance walks, stair treads and planters; the larger public street parks remain map terrain.
  for (let k = 0; k < 4; k++) {
    const target = Object.assign(rotatedBuilder(out, Math.PI / 4 + (k * Math.PI) / 2), {
      detail: out.detail,
    });
    box(target, 'stone', [-5.5, 0, 25.8], [5.5, 0.32, 39], [0.4, 0.34, 0.31]);
    for (let j = 0; j < 4; j += out.detail === 'closeup' ? 1 : 2)
      box(
        target,
        'stone',
        [-5.5, 0, 39 + j * 0.4],
        [5.5, 0.32 - j * 0.07, 39 + (j + 1) * 0.4],
        [0.4, 0.34, 0.31],
      );
    for (const x of [-6.5, 6.5]) {
      box(target, 'cladding', [x - 1.05, 0, 30], [x + 1.05, 0.8, 38], granite);
      box(target, 'recess', [x - 0.9, 0.8, 30.2], [x + 0.9, 0.83, 37.8], [0.11, 0.1, 0.08]);
      for (let j = 0; out.detail === 'closeup' && j < 5; j += out.detail === 'closeup' ? 1 : 2)
        sphere(
          target,
          'foliage',
          [x, 1.15, 30.7 + j * 1.5],
          [0.78, 0.52, 0.8],
          [0.16, 0.24, 0.105],
          8,
          4,
        );
    }
    for (const x of [-5.7, 5.7]) {
      beam(target, 'metal', [x, 0, 35], [x, 3.65, 35], 0.075, 0.075, [0.12, 0.13, 0.115]);
      loft(
        target,
        'metal',
        [
          rect(x - 0.09, 34.91, x + 0.09, 35.09).map(([a, b]) => [a, 3.65, b]),
          rect(x - 0.4, 34.6, x + 0.4, 35.4).map(([a, b]) => [a, 3.95, b]),
        ],
        [0.18, 0.18, 0.16],
      );
    }
  }
}
function buildAtlanta(out, m) {
  if (out.detail === 'skyline') return skyline(out, m);
  base(out, m);
  shaft(out);
  crown(out);
}

function grid(out, points, color, bay, course, width, tint) {
  face(out, 'glass', points, color);
  const [a, b, , d] = points,
    len = Math.hypot(...b.map((v, i) => v - a[i])),
    height = d[1] - a[1],
    u = b.map((v, i) => (v - a[i]) / len),
    n = [-u[2], 0, u[0]];
  const at = (x, y) => a.map((v, i) => v + u[i] * x + (i === 1 ? y : 0) + n[i] * 0.008);
  for (let x = bay; x < len - 0.01; x += bay)
    face(out, 'metal', [at(x, 0), at(x + width, 0), at(x + width, height), at(x, height)], tint);
  for (let y = course; y < height - 0.01; y += course)
    face(out, 'metal', [at(0, y), at(len, y), at(len, y + width), at(0, y + width)], tint);
}
function coarsePortal(out, angle, ground, far) {
  const t = Object.assign(rotatedBuilder(out, angle, [0, ground, 0]), { detail: out.detail }),
    z = 18.4 * Math.SQRT2,
    r = far ? 4.9 : 2.95,
    ry = far ? 4.45 : 2.35;
  const point = (radius, rise, i, d) => [
    radius * Math.cos((i * Math.PI) / 4),
    5.35 + rise * Math.sin((i * Math.PI) / 4),
    z + d,
  ];
  for (const sign of [-1, 1])
    box(
      t,
      'cladding',
      [sign < 0 ? -8.55 : r, 0, z - 0.9],
      [sign < 0 ? -r : 8.55, 18.4, z + 0.05],
      granite,
    );
  for (let i = 0; i < 4; i++) {
    face(
      t,
      'cladding',
      [
        point(r, ry, i, 0.05),
        point(r + 0.48, ry + 0.42, i, 0.05),
        point(r + 0.48, ry + 0.42, i + 1, 0.05),
        point(r, ry, i + 1, 0.05),
      ],
      granite,
    );
    face(
      t,
      'cladding',
      [
        point(r, ry, i, -0.85),
        point(r, ry, i, 0.05),
        point(r, ry, i + 1, 0.05),
        point(r, ry, i + 1, -0.85),
      ],
      granite,
    );
    face(
      t,
      'cladding',
      [
        point(r + 0.48, ry + 0.42, i, 0.05),
        [point(r + 0.48, ry + 0.42, i, 0.05)[0], 18.4, z + 0.05],
        [point(r + 0.48, ry + 0.42, i + 1, 0.05)[0], 18.4, z + 0.05],
        point(r + 0.48, ry + 0.42, i + 1, 0.05),
      ],
      granite,
    );
    tri(t, 'glass', [[0, 5.35, z - 0.9], point(r, ry, i, -0.9), point(r, ry, i + 1, -0.9)], glass);
  }
  face(
    t,
    'glass',
    [
      [-r, 0, z - 0.9],
      [r, 0, z - 0.9],
      [r, 5.35, z - 0.9],
      [-r, 5.35, z - 0.9],
    ],
    glass,
  );
  if (!far)
    for (const x of [-1.46, 0, 1.46])
      beam(t, 'gold', [x, 0, z - 0.83], [x, 7.5, z - 0.83], 0.075, 0.09, gold);
}
function coarseCrown(out, far) {
  const rouge = [0.37, 0.22, 0.17],
    ys = far
      ? [236.7, 247.8, 261.2, 284.368]
      : [236.7, 240, 244, 247.8, 252, 256, 261.2, 266, 271, 276, 280, 284.368];
  for (const y of ys)
    for (const { a, b } of edges(cagePlan(y))) {
      const h = far ? 0.12 : 0.09;
      face(
        out,
        'metal',
        [
          [a[0], y - h, a[1]],
          [b[0], y - h, b[1]],
          [b[0], y + h, b[1]],
          [a[0], y + h, a[1]],
        ],
        rouge,
      );
    }
  const levels = [236.7, 247.8, 261.2, 284.368],
    ids = far
      ? [3, 8, 13, 18]
      : out.detail === 'street'
        ? Array.from({ length: 20 }, (_, i) => i)
        : [0, 3, 5, 8, 10, 13, 15, 18];
  for (let k = 1; k < levels.length; k++) {
    const p = cagePlan(levels[k - 1] + 0.001),
      q = cagePlan(levels[k] - 0.001);
    for (const i of ids)
      beam(
        out,
        'metal',
        [p[i][0], levels[k - 1], p[i][1]],
        [q[i][0], levels[k], q[i][1]],
        0.27,
        0.33,
        rouge,
      );
  }
  const profiles = [
    [284.368, 2.3],
    [290.3, 2.25],
    [294.8, 1.17],
    [307.4, 0.94],
    [311.3, 0.18],
    [311.8, 0.055],
  ];
  for (let i = 1; i < profiles.length; i++)
    loft(
      out,
      'gold',
      profiles.slice(i - 1, i + 1).map(([y, r]) => rect(-r, -r, r, r).map(([x, z]) => [x, y, z])),
      gold,
    );
  if (!far) {
    mappedSolid(out, 'metal', rect(-7, -7, 7, 7), 247.4, 247.56, metal);
    for (const x of [-0.31, 0.31])
      beam(out, 'metal', [x, 238, -2.1], [x, 284, -2.1], 0.065, 0.065, metal);
  }
}
function farBase(out, m, far) {
  const p = stepped(24.5);
  mappedCap(out, 'stone', p, 0.32, granite);
  mappedCap(out, 'metal', p, 18.4, metal);
  for (const { l, at } of edges(p))
    if (l > 15) panel(out, 'glass', at, 0, l, 0.32, 18.4, glass, -0.1);
  for (const angle of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4])
    coarsePortal(out, angle, 0.32, far);
  const w = clockwise(m.geometry.wingOutline.slice(0, -1));
  mappedSolid(out, 'glass', w, 0, 12, glass);
  if (!far)
    for (const { l, at } of edges(w))
      for (const y of [4.1, 7.9, 11.8])
        panel(out, 'stone', at, 0, l, y - 0.1, y + 0.1, granite, 0.015);
}
function skyline(out, m) {
  farBase(out, m, true);
  for (const [a, lo, hi] of [
    [24.5, 18.4, 154],
    [23.25, 154, 198],
    [21.85, 198, 234.8],
  ])
    mappedSolid(out, 'stone', stepped(a), lo, hi, granite);
  mappedSolid(out, 'metal', stepped(16.1), 234.8, 241, metal);
  coarseCrown(out, true);
}
const mean = {
  stone: [0.701109, 0.701109, 0.701109],
  metal: [0.908889, 0.908889, 0.908889],
  gold: [0.908889, 0.908889, 0.908889],
};
function build(out, detail, m) {
  m ??= JSON.parse(
    readFileSync(
      resolve(structureSourcePath('n0207_bank_of_america_plaza'), 'map-frame.json'),
      'utf8',
    ),
  );
  const target = { detail };
  for (const method of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    target[method] = (slot, ref, points, normal, uv, color) => {
      slot = ['stone', 'cladding', 'foundation', 'foliage'].includes(slot)
        ? 'stone'
        : slot === 'recess'
          ? 'metal'
          : slot === 'clear_glass'
            ? 'glass'
            : slot;
      return out[method](
        slot,
        ref,
        points,
        normal,
        uv,
        detail === 'skyline' ? color.map((v, i) => v * (mean[slot]?.[i] ?? 1)) : color,
      );
    };
  buildAtlanta(target, m);
}
export const buildAtlantaReviewedMaster = (out, m) => build(out, 'closeup', m);
export const buildAtlantaSkyline = (out) => build(out, 'skyline');
export const buildAtlantaDistrict = (out) => build(out, 'district');
export const buildAtlantaStreet = (out) => build(out, 'street');
export const buildAtlantaCloseup = (out) => build(out, 'closeup');
