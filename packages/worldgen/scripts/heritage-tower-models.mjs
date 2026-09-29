/** Three individually researched towers. Meter units, +Y up; no category substitution. */

import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const stone = [0.79, 0.73, 0.61];
const pale = [0.83, 0.8, 0.72];
const darkStone = [0.34, 0.36, 0.35];
const brick = [0.76, 0.58, 0.37];
const ref = 'palette:#ffffff';
const tau = Math.PI * 2;

function tri(out, slot, points, color) {
  out.addTriangle(
    slot,
    ref,
    points,
    normalFor(...points),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    color,
  );
}
function face(out, slot, points, color) {
  quad(out, slot, points, normalFor(...points), color);
}
function disc(out, slot, center, radius, color, sides = 128) {
  const ring = radialRing(center[1], radius, radius, sides, [center[0], center[2]]);
  out.addConvexPolygon(slot, ref, ring, [0, 1, 0], (p) => [p[0], p[2]], color);
}
function ring(out, slot, center, inner, outer, y0, y1, color, sides = 128) {
  const p = (r, y, a) => [center[0] + Math.cos(a) * r, y, center[1] + Math.sin(a) * r];
  for (let i = 0; i < sides; i++) {
    const a = (-i * tau) / sides,
      b = (-(i + 1) * tau) / sides;
    face(out, slot, [p(outer, y0, a), p(outer, y0, b), p(outer, y1, b), p(outer, y1, a)], color);
    face(out, slot, [p(inner, y0, b), p(inner, y0, a), p(inner, y1, a), p(inner, y1, b)], color);
    face(out, slot, [p(inner, y1, a), p(outer, y1, a), p(outer, y1, b), p(inner, y1, b)], color);
    face(out, slot, [p(inner, y0, b), p(outer, y0, b), p(outer, y0, a), p(inner, y0, a)], color);
  }
}

/** Flat facade with actual recessed panels and reveals. x/y cuts keep the front watertight. */
function recessedFacade(out, slot, width, y0, y1, depth, holes, color, rotate = 0) {
  const c = Math.cos(rotate),
    s = Math.sin(rotate);
  const p = (x, y, z) => [x * c + z * s, y, -x * s + z * c];
  const panel = (points, tint = color, component = slot) =>
    face(
      out,
      component,
      points.map(([x, y, z]) => p(x, y, z)),
      tint,
    );
  const xs = [...new Set([-width / 2, width / 2, ...holes.flatMap((h) => [h.x0, h.x1])])].sort(
    (a, b) => a - b,
  );
  const ys = [...new Set([y0, y1, ...holes.flatMap((h) => [h.y0, h.y1])])].sort((a, b) => a - b);
  for (let j = 0; j < ys.length - 1; j++)
    for (let i = 0; i < xs.length - 1; i++) {
      const x = (xs[i] + xs[i + 1]) / 2,
        y = (ys[j] + ys[j + 1]) / 2;
      if (x < -width / 2 || x > width / 2 || y < y0 || y > y1) continue;
      if (holes.some((h) => x > h.x0 && x < h.x1 && y > h.y0 && y < h.y1)) continue;
      panel([
        [xs[i], ys[j], depth],
        [xs[i + 1], ys[j], depth],
        [xs[i + 1], ys[j + 1], depth],
        [xs[i], ys[j + 1], depth],
      ]);
    }
  for (const h of holes) {
    const { x0, x1, y0: b, y1: t, inset = 0.04 } = h;
    const z = depth - inset;
    panel(
      [
        [x0, b, z],
        [x1, b, z],
        [x1, t, z],
        [x0, t, z],
      ],
      h.tint ?? color.map((v) => v * 0.84),
      h.component ?? slot,
    );
    panel([
      [x0, b, depth],
      [x0, b, z],
      [x0, t, z],
      [x0, t, depth],
    ]);
    panel([
      [x1, b, z],
      [x1, b, depth],
      [x1, t, depth],
      [x1, t, z],
    ]);
    panel([
      [x0, b, depth],
      [x1, b, depth],
      [x1, b, z],
      [x0, b, z],
    ]);
    panel([
      [x0, t, z],
      [x1, t, z],
      [x1, t, depth],
      [x0, t, depth],
    ]);
  }
}

function rotatedBox(out, slot, lo, hi, color, rotation) {
  const c = Math.cos(rotation),
    s = Math.sin(rotation);
  const transform = (points) => points.map(([x, y, z]) => [x * c + z * s, y, -x * s + z * c]);
  box(
    {
      addQuad(_slot, _ref, points, _normal, _uv, tint) {
        face(out, slot, transform(points), tint);
      },
    },
    slot,
    lo,
    hi,
    color,
  );
}

function buildKaba(out) {
  // Schmidt 1970 pp. 18-28, 35-37. Surviving monument, not restored thirty-step reconstruction.
  box(out, 'limestone', [-7.31, 0, -7.31], [7.31, 0.25, 7.31], pale);
  box(out, 'limestone', [-5.72, 0.25, -5.72], [5.72, 0.53, 5.72], pale);
  box(out, 'limestone', [-4.4, 0.53, -4.4], [4.4, 1.03, 4.4], pale);
  box(out, 'limestone', [-3.54, 1.03, -3.54], [3.54, 1.35, 3.54], pale);
  const base = 1.35,
    top = 13.87,
    w = 7.3,
    d = w / 2;
  for (let side = 0; side < 4; side++) {
    const rotation = (side * Math.PI) / 2;
    const north = side === 0;
    const holes = [];
    const windows = north
      ? [
          { x: 0, y: 10.14, width: 0.56, height: 0.78 },
          { x: 0, y: 12.58, width: 0.56, height: 0.78 },
        ]
      : [-1.61, 1.61].flatMap((x) => [
          { x, y: 7.28, width: 1.02, height: 1.62 },
          { x, y: 10.32, width: 1.42, height: 1.3 },
          { x, y: 12.58, width: 0.56, height: 0.78 },
        ]);
    const excluded = windows.map((v) => ({
      x0: v.x - v.width / 2 - 0.08,
      x1: v.x + v.width / 2 + 0.08,
      y0: v.y - 0.08,
      y1: v.y + v.height + 0.08,
    }));
    if (north) excluded.push({ x0: -1.18, x1: 1.18, y0: 2.9, y1: 10.1 });
    for (let row = 0; row < (north ? 16 : 15); row++) {
      const y = base + (north ? 2.97 : 2.83) + row * 0.58;
      for (let col = 0; col < 7; col++) {
        const x = -2.37 + col * 0.75 + (row % 2 ? 0.34 : 0);
        if (x + 0.075 > 2.58) continue;
        const h = { x0: x - 0.075, x1: x + 0.075, y0: y, y1: y + 0.39, inset: 0.04 };
        if (!excluded.some((r) => h.x1 > r.x0 && h.x0 < r.x1 && h.y1 > r.y0 && h.y0 < r.y1))
          holes.push(h);
      }
    }
    for (const v of windows) {
      holes.push({
        x0: v.x - v.width / 2,
        x1: v.x + v.width / 2,
        y0: v.y,
        y1: v.y + v.height,
        inset: 0.18,
        tint: darkStone,
        component: 'darkstone',
      });
      // Two-step dark limestone frames, photographed/measured in Fig. 11.
      const b = Math.min(0.18, v.width * 0.18);
      for (const [lo, hi] of [
        [
          [v.x - v.width / 2, v.y, d - 0.09],
          [v.x - v.width / 2 + b, v.y + v.height, d + 0.008],
        ],
        [
          [v.x + v.width / 2 - b, v.y, d - 0.09],
          [v.x + v.width / 2, v.y + v.height, d + 0.008],
        ],
        [
          [v.x - v.width / 2 + b, v.y + v.height - b, d - 0.09],
          [v.x + v.width / 2 - b, v.y + v.height, d + 0.008],
        ],
        [
          [v.x - v.width / 2 + b, v.y, d - 0.09],
          [v.x + v.width / 2 - b, v.y + b, d + 0.008],
        ],
      ])
        rotatedBox(out, 'darkstone', lo, hi, darkStone, rotation);
    }
    if (north) {
      holes.push({
        x0: -0.855,
        x1: 0.855,
        y0: base + 6.35,
        y1: base + 8.26,
        inset: 1.85,
        tint: [0.19, 0.18, 0.16],
      });
      // Surviving broken scar below elevated doorway: recessed masonry, no fabricated complete staircase.
      holes.push({ x0: -0.72, x1: 0.82, y0: 3.6, y1: 7.69, inset: 0.13, tint: [0.7, 0.65, 0.54] });
    }
    recessedFacade(out, 'limestone', w, base, top - 0.5, d, holes, pale, rotation);
    for (const sign of [-1, 1])
      rotatedBox(
        out,
        'limestone',
        [sign < 0 ? -d : d - 1.06, base, d],
        [sign < 0 ? -d + 1.06 : d, top - 0.5, d + 0.19],
        pale,
        rotation,
      );
    rotatedBox(out, 'limestone', [-d, top - 0.5, d - 0.16], [d, top, d + 0.2], pale, rotation);
    for (let i = 0; i < 17; i++) {
      const x = -2.49 + i * 0.3;
      rotatedBox(
        out,
        'limestone',
        [x, top - 0.5, d + 0.2],
        [x + 0.15, top - 0.23, d + 0.325],
        pale,
        rotation,
      );
    }
  }
  // Low, four-slab pyramidal roof. Original roof apex is 25 cm above eaves.
  const corners = [
    [-3.86, top, -3.86],
    [-3.86, top, 3.86],
    [3.86, top, 3.86],
    [3.86, top, -3.86],
  ];
  for (let i = 0; i < 4; i++)
    tri(out, 'limestone', [corners[i], corners[(i + 1) % 4], [0, 14.12, 0]], pale);
  // Preserved lower flight: eight 27 cm risers, upper access remains absent.
  for (let i = 0; i < 8; i++) {
    const z = 8.52 - i * 0.27;
    box(out, 'limestone', [-1.055, 0.05, z - 0.27], [1.055, 0.27 * (i + 1), z], pale);
  }
  // Door lintel: architrave, fillet, ovolo and upturned outer ends.
  box(out, 'limestone', [-1.12, 9.61, 3.63], [1.12, 9.79, 3.72], pale);
  box(out, 'limestone', [-1.19, 9.79, 3.61], [1.19, 9.87, 3.77], pale);
  box(out, 'limestone', [-1.22, 9.87, 3.61], [1.22, 10.02, 3.78], pale);
  for (const s of [-1, 1])
    box(
      out,
      'limestone',
      [s < 0 ? -1.22 : 1.08, 10.02, 3.61],
      [s < 0 ? -1.08 : 1.22, 10.14, 3.78],
      pale,
    );
}

/** Tower with photograph-supported circular ribs and an asymmetric mapped buttress. */
function buildMaiden(out) {
  const center = [-4.782, 0.011],
    radius = 8.25,
    height = 31,
    sides = 192;
  const openings = [
    { angle: Math.PI, width: 1.1, y: 0.22, h: 2, arched: true },
    ...[9.5, 14.5, 20, 25.7, 28.3].map((y, i) => ({
      angle: 1.27 - i * 0.022,
      width: 0.32,
      y,
      h: 1.05,
    })),
    ...[12.9, 18.6, 24.1].map((y) => ({ angle: 0.93, width: 0.24, y, h: 0.8 })),
  ];
  let angles = Array.from({ length: sides }, (_, i) => (i * tau) / sides);
  const levels = [0, 12, 30.12, ...openings.flatMap((h) => [h.y, h.y + h.h])];
  // 43 shallow raised stone bands inferred from the library photograph, not a stone survey.
  for (let i = 0; i < 43; i++) levels.push(12 + i * 0.418, 12 + i * 0.418 + 0.22);
  for (const h of openings)
    angles.push(h.angle - h.width / (2 * radius), h.angle + h.width / (2 * radius));
  angles.push(tau);
  angles = [...new Set(angles)].sort((a, b) => a - b);
  const ys = [...new Set(levels)].sort((a, b) => a - b);
  const radial = (y) => radius + (y >= 12 && (y - 12) % 0.418 < 0.22 ? 0.095 : 0);
  const p = (a, y, r) => [center[0] + r * Math.cos(a), y, center[1] + r * Math.sin(a)];
  for (let j = 0; j < ys.length - 1; j++) {
    const y0 = ys[j],
      y1 = ys[j + 1],
      midY = (y0 + y1) / 2,
      r = radial(midY);
    for (let i = 0; i < angles.length - 1; i++) {
      const a = angles[i],
        b = angles[i + 1],
        m = (a + b) / 2;
      if (
        openings.some(
          (h) => Math.abs(m - h.angle) < h.width / (2 * radius) && midY > h.y && midY < h.y + h.h,
        )
      )
        continue;
      const tint = stone.map((v) => v * (1 + 0.025 * Math.sin(i * 0.67 + j * 1.9)));
      face(out, 'limestone_round', [p(b, y0, r), p(a, y0, r), p(a, y1, r), p(b, y1, r)], tint);
    }
    if (y0 >= 12) {
      const before = radial(y0 - 0.001);
      if (before !== r) {
        // One annular ledge closes each radial step; vertical band walls already exist.
        for (let i = 0; i < angles.length - 1; i++) {
          const a = angles[i],
            b = angles[i + 1];
          const points = [p(a, y0, before), p(b, y0, before), p(b, y0, r), p(a, y0, r)];
          face(out, 'limestone', points.reverse(), stone);
        }
      }
    }
  }
  for (const h of openings) {
    const a = h.angle - h.width / (2 * radius),
      b = h.angle + h.width / (2 * radius),
      y0 = h.y,
      y1 = h.y + h.h,
      r = radius + 0.1,
      back = radius - 0.85;
    face(
      out,
      'shadow',
      [p(b, y0, back), p(a, y0, back), p(a, y1, back), p(b, y1, back)],
      [0.18, 0.17, 0.15],
    );
    face(out, 'limestone', [p(a, y0, back), p(a, y0, r), p(a, y1, r), p(a, y1, back)], stone);
    face(out, 'limestone', [p(b, y0, r), p(b, y0, back), p(b, y1, back), p(b, y1, r)], stone);
    face(out, 'limestone', [p(a, y0, r), p(a, y0, back), p(b, y0, back), p(b, y0, r)], stone);
    face(out, 'limestone', [p(b, y1, r), p(b, y1, back), p(a, y1, back), p(a, y1, r)], stone);
    if (h.arched) {
      const mid = (a + b) / 2,
        spring = y1 - 0.45;
      for (let k = 0; k < 16; k++) {
        const u0 = k / 16,
          u1 = (k + 1) / 16;
        const t0 = a + (b - a) * u0,
          t1 = a + (b - a) * u1;
        const curve = (u) => spring + 0.45 * Math.sin(Math.PI * u);
        face(
          out,
          'limestone',
          [p(t1, curve(u1), r), p(t0, curve(u0), r), p(t0, y1 + 0.002, r), p(t1, y1 + 0.002, r)],
          stone,
        );
      }
      tube(out, 'metal', p(mid, 0.22, r + 0.1), p(mid, 1.8, r + 0.1), 0.022, [0.25, 0.27, 0.25], 6);
    }
  }
  disc(out, 'limestone', [center[0], 30.12, center[1]], radius, stone);
  ring(out, 'limestone_round', center, radius - 0.56, radius + 0.09, 30.12, height, stone);
  // Rounded nose located by the asymmetric OSM footprint. Body intersects the cylinder internally.
  const rootA = [2.41, 3.87],
    rootB = [3.36, -1.83],
    endA = [12.3, 8.31],
    endB = [13.13, 5.43];
  const end = [(endA[0] + endB[0]) / 2, (endA[1] + endB[1]) / 2];
  const axis = Math.atan2(end[1] - 0.6, end[0] - center[0]);
  const outline = [rootA, endA];
  for (let i = 1; i < 17; i++) {
    const a = axis + Math.PI / 2 - (i * Math.PI) / 17;
    outline.push([end[0] + 1.5 * Math.cos(a), end[1] + 1.5 * Math.sin(a)]);
  }
  outline.push(endB, rootB);
  for (const [y0, y1] of [
    [0, 12],
    [12, 30.2],
    [30.2, 31],
  ]) {
    loft(
      out,
      'limestone',
      [outline.map(([x, z]) => [x, y0, z]), outline.map(([x, z]) => [x, y1, z])],
      stone,
    );
  }
  // The same course bands continue over the buttress; full ribs, not duplicated textures.
  for (let j = 0; j < 43; j++) {
    const y = 12 + j * 0.418;
    for (let i = 0; i < outline.length - 1; i++) {
      const a = outline[i],
        b = outline[i + 1];
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        nx = (-dz / len) * 0.1,
        nz = (dx / len) * 0.1;
      face(
        out,
        'limestone',
        [
          [a[0] + nx, y, a[1] + nz],
          [b[0] + nx, y, b[1] + nz],
          [b[0] + nx, y + 0.22, b[1] + nz],
          [a[0] + nx, y + 0.22, a[1] + nz],
        ],
        stone,
      );
      face(
        out,
        'limestone',
        [
          [a[0], y + 0.22, a[1]],
          [a[0] + nx, y + 0.22, a[1] + nz],
          [b[0] + nx, y + 0.22, b[1] + nz],
          [b[0], y + 0.22, b[1]],
        ],
        stone,
      );
    }
  }
  // Inscription's published panel dimensions; characters are intentionally not invented.
  const a = Math.PI,
    r = radius + 0.06;
  face(
    out,
    'limestone',
    [
      p(a + 0.6 / (2 * r), 14, r),
      p(a - 0.6 / (2 * r), 14, r),
      p(a - 0.6 / (2 * r), 14.4, r),
      p(a + 0.6 / (2 * r), 14.4, r),
    ],
    [0.67, 0.6, 0.49],
  );
}

function buildGonbad(out) {
  const shaftTop = 36.971,
    top = 52.844,
    sides = 160;
  const outer = (y) => 8.648 - (8.648 - 7.729) * Math.min(y / 36, 1);
  const cylinder = (y) => outer(y) * 0.869;
  // Ten right-angle flanges separated by short curved bays; entrance centered on +Z.
  const plan = (y, expanded = 0) => {
    const R = outer(y) + expanded,
      r = cylinder(y) + expanded,
      a = (R - Math.sqrt(2 * r * r - R * R)) / 2;
    const delta = Math.atan2(a, R - a),
      points = [];
    for (let n = 0; n < 10; n++) {
      const angle = Math.PI / 2 + Math.PI / 10 - (n * tau) / 10;
      points.push([Math.cos(angle + delta) * r, y, Math.sin(angle + delta) * r]);
      points.push([Math.cos(angle) * R, y, Math.sin(angle) * R]);
      points.push([Math.cos(angle - delta) * r, y, Math.sin(angle - delta) * r]);
      for (let j = 1; j < 5; j++) {
        const t = angle - delta - ((tau / 10 - 2 * delta) * j) / 5;
        points.push([Math.cos(t) * r, y, Math.sin(t) * r]);
      }
    }
    return points;
  };
  // Solid foundation and a narrow stepped circular foot, as shown in the nomination photos.
  loft(out, 'brick', [radialRing(0, 8.82, 8.82, sides), radialRing(0.4, 8.82, 8.82, sides)], brick);
  const levels = [0.4, 1.2, 5.965, 8.1, 9, 34.4, 35.3, shaftTop];
  for (let j = 0; j < levels.length - 1; j++) {
    const lo = plan(levels[j]),
      hi = plan(levels[j + 1]);
    for (let i = 0; i < lo.length; i++) {
      const k = (i + 1) % lo.length;
      const midX = (lo[i][0] + lo[k][0]) / 2,
        midZ = (lo[i][2] + lo[k][2]) / 2;
      // Door cuts only the center bay, with custom curved top below.
      if (midZ > 0 && Math.abs(midX) < 1 && levels[j] < 5.965) continue;
      face(
        out,
        'brick',
        [lo[i], lo[k], hi[k], hi[i]],
        brick.map((v) => v * (1 + 0.025 * Math.sin(i * 1.71))),
      );
    }
  }
  // Entrance arch spans the removed central bay. Its measured exterior opening is 1.57 × 5.565 m.
  const doorBottom = 0.4,
    doorTop = doorBottom + 5.565,
    half = 0.785;
  const wallZ = (x, y) => Math.sqrt(cylinder(y) ** 2 - x * x);
  const xCuts = [
    -1.18,
    -half,
    ...Array.from({ length: 17 }, (_, i) => -half + (2 * half * i) / 16),
    half,
    1.18,
  ];
  for (let i = 0; i < xCuts.length - 1; i++) {
    const x0 = xCuts[i],
      x1 = xCuts[i + 1];
    if (x1 - x0 < 0.00001) continue;
    const arc = (x) =>
      Math.abs(x) >= half
        ? doorBottom
        : doorTop - 1.11 + 1.11 * Math.pow(1 - Math.abs(x) / half, 0.65);
    const y0 = arc(x0),
      y1 = arc(x1),
      roof = 5.97;
    face(
      out,
      'brick',
      [
        [x0, y0, wallZ(x0, y0)],
        [x1, y1, wallZ(x1, y1)],
        [x1, roof, wallZ(x1, roof)],
        [x0, roof, wallZ(x0, roof)],
      ],
      brick,
    );
    if (Math.abs((x0 + x1) / 2) < half) {
      face(
        out,
        'brick',
        [
          [x1, y1, wallZ(x1, y1)],
          [x0, y0, wallZ(x0, y0)],
          [x0, y0, 4.2],
          [x1, y1, 4.2],
        ],
        brick,
      );
    }
  }
  for (const s of [-1, 1]) {
    const jamb = [
      [s * half, doorBottom, 4.2],
      [s * half, doorBottom, wallZ(half, doorBottom)],
      [s * half, doorTop - 1.11, wallZ(half, doorTop - 1.11)],
      [s * half, doorTop - 1.11, 4.2],
    ];
    face(out, 'brick', s < 0 ? jamb.reverse() : jamb, brick);
  }
  // Exterior-only model: an opaque dark interior closes the rear of the entrance.
  // The modern timber infill fits the measured 1.221 × 4.328 m inner opening.
  face(
    out,
    'shadow',
    [
      [-half, doorBottom, 4.12],
      [half, doorBottom, 4.12],
      [half, doorTop, 4.12],
      [-half, doorTop, 4.12],
    ],
    [0.14, 0.12, 0.09],
  );
  box(out, 'wood', [-0.6105, 0.4, 4.15], [0.6105, 4.728, 4.23], [0.38, 0.23, 0.13]);
  for (let i = 0; i < 8; i++)
    box(
      out,
      'wood',
      [-0.57 + i * 0.145, 0.5, 4.24],
      [-0.555 + i * 0.145, 4.62, 4.27],
      [0.3, 0.19, 0.11],
    );
  box(out, 'brick', [-1.25, 0.02, 7.4], [1.25, 0.2, 8.9], brick);
  box(out, 'brick', [-1.1, 0.2, 7.4], [1.1, 0.4, 8.55], brick);
  // Inscription panel recesses and border brick courses; no fabricated Kufic lettering.
  for (let i = 0; i < 10; i++) {
    const angle = (-i * tau) / 10;
    for (const y of [8.1, 34.4]) {
      const z = cylinder(y) + 0.04;
      rotatedBox(
        out,
        'brick',
        [-0.98, y, z],
        [0.98, y + 0.78, z + 0.035],
        [0.62, 0.45, 0.28],
        angle,
      );
      for (const dy of [0, 0.72])
        rotatedBox(
          out,
          'brick',
          [-1.02, y + dy, z + 0.035],
          [1.02, y + dy + 0.06, z + 0.1],
          brick,
          angle,
        );
    }
  }
  // Corbelled neck transitions from star body to smooth cone.
  for (let i = 0; i < 6; i++) {
    const y = 36.4 + i * 0.095,
      r = 7.35 + i * 0.105;
    ring(out, 'brick', [0, 0], r - 0.12, r, y, y + 0.095, brick, sides);
  }
  const coneBase = 7.9;
  const yCuts = [shaftTop, 40.5, 42.35, top - 0.18, top];
  for (let j = 0; j < yCuts.length - 1; j++) {
    const y0 = yCuts[j],
      y1 = yCuts[j + 1],
      r0 = (coneBase * (top - y0)) / (top - shaftTop),
      r1 = (coneBase * (top - y1)) / (top - shaftTop);
    for (let i = 0; i < sides; i++) {
      const a = (-i * tau) / sides,
        b = (-(i + 1) * tau) / sides,
        mid = (a + b) / 2;
      const wrap = Math.atan2(Math.sin(mid - Math.PI / 2), Math.cos(mid - Math.PI / 2));
      if (j === 1 && Math.abs(wrap) < 0.08) continue;
      const p = (t, y, r) => [r * Math.cos(t), y, r * Math.sin(t)];
      const points = [p(a, y0, r0), p(b, y0, r0), p(b, y1, r1), p(a, y1, r1)];
      if (r1 === 0) tri(out, 'brickroof', [points[0], points[1], [0, top, 0]], [0.56, 0.43, 0.3]);
      else face(out, 'brickroof', points, [0.56, 0.43, 0.3]);
    }
  }
  // Close every edge of the roof aperture. The rear plane follows the cone slope,
  // so oblique views cannot see sky through a gap beside an axis-aligned backing.
  const aperture = [];
  for (const [y, angle] of [
    [40.5, Math.PI / 2 + Math.PI / 40],
    [40.5, Math.PI / 2 - Math.PI / 40],
    [42.35, Math.PI / 2 - Math.PI / 40],
    [42.35, Math.PI / 2 + Math.PI / 40],
  ]) {
    const r = (coneBase * (top - y)) / (top - shaftTop);
    aperture.push([Math.cos(angle) * r, y, Math.sin(angle) * r]);
  }
  const backing = aperture.map(([x, y, z]) => [x, y, z - 0.8]);
  face(out, 'shadow', backing, [0.14, 0.12, 0.09]);
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    face(out, 'brickroof', [aperture[k], backing[k], backing[i], aperture[i]], [0.56, 0.43, 0.3]);
  }
  const soffit = radialRing(shaftTop, coneBase, coneBase, sides).reverse();
  out.addConvexPolygon(
    'brickroof',
    ref,
    soffit,
    [0, -1, 0],
    (p) => [p[0], p[2]],
    [0.56, 0.43, 0.3],
  );
}

export const heritageTowers = [
  {
    id: 'n0562_maiden_tower',
    planId: 'N0562',
    title: 'Maiden Tower',
    wikidata: 'Q842822',
    build: buildMaiden,
    brief:
      'Baku limestone tower with its asymmetric seaside buttress, rounded nose, relief masonry bands, recessed slit openings and open roof parapet.',
    size: [28.2, 31, 16.7],
    front: 'OSM-local +X points approximately east; western doorway toward -X',
    origin: 'Minimum-area OSM footprint center in X/Z; nominal lowest exterior base at Y=0',
    refs: [
      'https://icherisheher.gov.az/en/monuments/show/qiz-qalasi',
      'https://bakucity.preslib.az/en/page/7eSskpB6tX',
      'https://www.openstreetmap.org/way/299418016',
    ],
    facts: {
      cylinderDiameterMeters: 16.5,
      terrainDependentHeightMeters: [28, 31],
      upperRibsStartMeters: 12,
      entranceMeters: [1.1, 2],
      inscriptionMeters: [0.6, 0.4],
      inscriptionBottomMeters: 14,
    },
    scaleBasis:
      'Reserve administration cylinder diameter and height envelope; Presidential Library entrance and panel dimensions; OSM asymmetric buttress footprint. Nominal 31 m base-to-parapet includes the reported 3 m site-level difference.',
    geographicProposal: {
      anchor: [49.837270733, 40.366150763],
      heading: 0.081716996579,
      source: 'https://www.openstreetmap.org/way/299418016',
      evidence:
        'Exact Q842822 asymmetric outline establishes the directed east/southeast buttress, overcoming the rectangle axis ambiguity; model preserves the mapped cylinder offset.',
      altitudeMode: 'terrain',
      orientationConfidence: 'footprint-directed',
      limitations:
        'Ground varies by 3 m. Terrain contact is provisional; slope, foundation rock and adjoining low structures need site review.',
    },
    limits: [
      'Rib count, slit positions and buttress nose curvature are estimates from the library exterior photograph and OSM, not measured conservation geometry.',
      'Interior museum floors, the well, adjoining lower defensive buildings, inscriptions and individual damaged blocks are not reconstructed.',
      'A uniform Y=0 base requires terrain fitting to the sloping rock. Exterior dimensions do not establish a surveyed vertical datum.',
    ],
    cameras: [
      { name: 'near-bands', position: [17, 22, 27], lookAt: [1, 20, 4] },
      { name: 'near-west-door', position: [-24, 7, 10], lookAt: [-9, 4, 0] },
      { name: 'roof-parapet', position: [27, 46, 36], lookAt: [-1, 25, 1] },
      { name: 'far-silhouette', position: [58, 30, 76], lookAt: [0, 16, 0] },
    ],
  },
  {
    id: 'n0564_gonbad_e_qabus',
    planId: 'N0564',
    title: 'Gonbad-e Qabus',
    wikidata: 'Q606763',
    build: buildGonbad,
    brief:
      'Ten-flanged fired-brick tomb tower with a tapered star section, deep pointed entrance, two bordered inscription bands, corbelled neck and steep cone with a roof light.',
    size: [17.64, 52.844, 17.72],
    front: '+Z is the entrance and roof-light side',
    origin:
      'Tower center on the mound summit; Y=0 is the exterior tower base, excluding the 10 m mound',
    refs: [
      'https://whc.unesco.org/en/list/1398',
      'https://whc.unesco.org/uploads/nominations/1398.pdf',
      'https://www.openstreetmap.org/way/328041889',
    ],
    facts: {
      exteriorShaftHeightMeters: 36.971,
      exteriorConeHeightMeters: 15.873,
      totalHeightMeters: 52.844,
      baseTipDiameterMeters: 17.296,
      tipDiameterAt36Meters: 15.458,
      flangeCount: 10,
      entranceWidthMeters: 1.57,
      entranceHeightMeters: 5.565,
      sourcePages: [59, 63, 67, 68, 70, 71, 72, 75, 79, 80],
    },
    scaleBasis:
      '2010 laser scan tables in UNESCO nomination, printed pp. 67-72, take precedence over the rounded 53 m overview and erroneous 72 m OSM height.',
    geographicProposal: {
      anchor: [55.169013207, 37.258093443],
      heading: Math.PI / 2,
      source: 'https://www.openstreetmap.org/way/328041889',
      orientationSource: 'https://whc.unesco.org/uploads/nominations/1398.pdf',
      evidence:
        'Exact Q606763 OSM footprint supplies center; nomination pp. 66-67 explicitly identifies east entrance, mapped to local +Z. Circular OSM polygon cannot resolve finer door azimuth.',
      altitudeMode: 'terrain',
      orientationConfidence: 'published-cardinal-direction',
      limitations:
        'East-facing is a cardinal approximation; actual azimuth needs a georeferenced entrance survey. Sample terrain must include the mound summit, or the tower will be too low.',
    },
    limits: [
      'Ten right-angle flanges and taper are reconstructed from published plans, with curved bay radii interpolated between measured sections.',
      'Inscription borders are modeled but actual Kufic glyphs are omitted; detailed muqarnas, irregular brick repairs and the internal shell are incomplete.',
      'Cone light and entrance reveal use measured envelopes with simplified vault profiles. Modern site furniture and the surrounding mound are excluded.',
    ],
    cameras: [
      { name: 'near-entrance', position: [3, 6, 20], lookAt: [0, 4, 6] },
      { name: 'near-cornice', position: [14, 40, 22], lookAt: [0, 36, 0] },
      { name: 'roof-light', position: [7, 46, 22], lookAt: [0, 41, 4] },
      { name: 'far-silhouette', position: [65, 37, 96], lookAt: [0, 27, 0] },
    ],
  },
  {
    id: 'n0575_ka_ba_ye_zartosht',
    planId: 'N0575',
    title: "Ka'ba-ye Zartosht",
    wikidata: 'Q2363092',
    build: buildKaba,
    brief:
      'Surviving limestone tower at Naqsh-e Rustam with engaged corners, shallow staggered recesses, dark false windows, 17-dentil cornices, broken access flight and low pyramidal stone roof.',
    size: [14.62, 14.12, 15.83],
    front: '+Z points toward the entrance / geographic north-northwest',
    origin: 'Tower center at original ground level; base pavement included',
    refs: [
      'https://isac.uchicago.edu/publications/persepolis-iii-royal-tombs-and-other-monuments',
      'https://isac-assets.s3.amazonaws.com/isac-publications/oip70.pdf',
      'https://www.iranicaonline.org/articles/kaba-ye-zardost/',
      'https://www.openstreetmap.org/way/235636110',
    ],
    facts: {
      totalHeightMeters: 14.12,
      towerSideMeters: 7.3,
      cornerPierMeters: [1.06, 0.19],
      dentilsPerFace: 17,
      roofRiseMeters: 0.25,
      recessMeters: [0.15, 0.39, 0.04],
      survivingSteps: 8,
      exteriorDoorMeters: [1.71, 1.91],
      sourcePages: [18, 20, 21, 24, 25, 26, 27, 28, 35, 36, 37],
    },
    scaleBasis:
      'Schmidt / Oriental Institute field measurements and elevations, Persepolis III (1970), figures 5-15 and pp. 35-37. Surviving eight-step remnant is retained; the hypothetical complete thirty-step stair is excluded.',
    geographicProposal: {
      anchor: [52.8740303, 29.9884865],
      heading: -1.276101119528 - Math.PI / 2,
      source: 'https://www.openstreetmap.org/way/235636110',
      orientationSource: 'https://isac-assets.s3.amazonaws.com/isac-publications/oip70.pdf',
      evidence:
        'Exact Q2363092 footprint gives wall axes; north-facing doorway in excavation plan resolves which of four sides is the authored +Z facade.',
      altitudeMode: 'terrain',
      orientationConfidence: 'footprint-plus-published-facing',
      limitations:
        'Excavated ground lies below surrounding modern grade; a flat terrain sample may cover lower pavement. OSM outline includes platform and is not used to stretch the measured tower.',
    },
    limits: [
      'Individual cracks, scattered original blocks, engraved inscriptions, cramp holes and displaced northern roof slab are not reproduced.',
      'Shallow recess layout follows measured spacings but omits local masonry damage; false-window elevations are fitted from measured facade drawings.',
      'The excavated perimeter, modern railings and terrain cut are excluded. Lower-flight chips and irregular settled pavement remain simplified.',
    ],
    cameras: [
      { name: 'near-north-door', position: [6, 9, 17], lookAt: [0, 8, 3] },
      { name: 'near-false-windows', position: [-10, 10, -13], lookAt: [-2, 9, -2] },
      { name: 'cornice-and-roof', position: [12, 20, -12], lookAt: [0, 12, 0] },
      { name: 'far-silhouette', position: [30, 20, 40], lookAt: [0, 7, 0] },
    ],
  },
];
