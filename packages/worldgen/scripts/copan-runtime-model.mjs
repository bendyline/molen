/** Copan: mapped curved slab, distinct rear systems and reusable open stair/screen meshes. */
import { readFileSync } from 'node:fs';
import { loft, normalFor } from './authored-structure-mesh.mjs';
import { transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frameBytes = readFileSync(structureSourcePath('n0223_edificio_copan', 'map-frame.json'));
const frame = JSON.parse(frameBytes),
  p = frame.geometry.outline;
const white = [0.85, 0.84, 0.8],
  gray = [0.62, 0.63, 0.6];
const iron = [0.34, 0.38, 0.37],
  silver = [0.62, 0.66, 0.66];
const dark = [0.12, 0.15, 0.16],
  glass = [0.38, 0.47, 0.5];
const interval = 2.95,
  base = 16.5,
  floors = 32,
  roofY = base + floors * interval;
const tau = 2 * Math.PI;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const area = (poly) =>
  poly.reduce((s, a, i) => {
    const b = poly[(i + 1) % poly.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
const clockwise = (poly) => (area(poly) < 0 ? poly : poly.toReversed());

function cap(out, plan, y, slot, color, down = false) {
  const poly = clockwise(plan),
    ids = poly.map((_, i) => i),
    tris = [];
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  while (ids.length > 3) {
    let found = false;
    for (let i = 0; i < ids.length; i++) {
      const a = ids[(i + ids.length - 1) % ids.length],
        b = ids[i],
        c = ids[(i + 1) % ids.length];
      if (cross(poly[a], poly[b], poly[c]) >= -1e-8) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cross(poly[a], poly[b], poly[k]) < 1e-8 &&
            cross(poly[b], poly[c], poly[k]) < 1e-8 &&
            cross(poly[c], poly[a], poly[k]) < 1e-8,
        )
      )
        continue;
      tris.push([a, b, c]);
      ids.splice(i, 1);
      found = true;
      break;
    }
    if (!found) throw new Error('Copan: invalid floor polygon');
  }
  tris.push(ids);
  for (const t of tris) {
    const q = t.map((i) => [poly[i][0], y, poly[i][1]]);
    triangle(out, slot, down ? q.toReversed() : q, color);
  }
}
function slab(out, plan, bottom, top, slot = 'concrete', color = white) {
  const poly = clockwise(plan);
  loft(
    out,
    slot,
    [poly.map(([x, z]) => [x, bottom, z]), poly.map(([x, z]) => [x, top, z])],
    color,
    { cap: false },
  );
  cap(out, poly, bottom, slot, color, true);
  cap(out, poly, top, slot, color);
}
function samples(line, step) {
  const lengths = [0];
  for (let i = 1; i < line.length; i++) lengths.push(lengths.at(-1) + dist(line[i - 1], line[i]));
  const count = Math.ceil(lengths.at(-1) / step),
    result = [];
  let k = 1;
  for (let i = 0; i <= count; i++) {
    const s = (lengths.at(-1) * i) / count;
    while (k < line.length - 1 && lengths[k] < s) k++;
    result.push(mix(line[k - 1], line[k], (s - lengths[k - 1]) / (lengths[k] - lengths[k - 1])));
  }
  return result;
}
function inward(line, amount) {
  return line.map((v, i) => {
    const a = line[Math.max(0, i - 1)],
      b = line[Math.min(line.length - 1, i + 1)],
      l = dist(a, b);
    return [v[0] - ((b[1] - a[1]) * amount) / l, v[1] + ((b[0] - a[0]) * amount) / l];
  });
}

const face = (out, slot, points, color) => quad(out, slot, points, normalFor(...points), color);
const rear = [
  ...p.slice(65, 67),
  ...p.slice(82, 109),
  ...p.slice(136, 163),
  ...p.slice(179, 181),
  ...p.slice(196, 198),
];
function simplify(line, tolerance) {
  if (line.length < 3) return line;
  const a = line[0],
    b = line.at(-1),
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = dx * dx + dz * dz;
  let max = 0,
    k = 0;
  for (let i = 1; i < line.length - 1; i++) {
    const q = line[i],
      t = length ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / length)) : 0,
      d = Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dz);
    if (d > max) {
      max = d;
      k = i;
    }
  }
  return max > tolerance
    ? [
        ...simplify(line.slice(0, k + 1), tolerance).slice(0, -1),
        ...simplify(line.slice(k), tolerance),
      ]
    : [a, b];
}
function edge(out, a, b, y = 0) {
  const mid = mix(a, b, 0.5);
  return transform(out, -Math.atan2(a[1] - b[1], a[0] - b[0]), [mid[0], y, mid[1]]);
}
function rect(out, slot, x0, x1, y0, y1, z, color) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    color,
  );
}
function wall(out, line, y0, y1, slot, color) {
  for (let i = 0; i < line.length - 1; i++) {
    const o = edge(out, line[i], line[i + 1]),
      w = dist(line[i], line[i + 1]);
    rect(o, slot, -w / 2, w / 2, y0, y1, 0, color);
  }
}
function blade(out, line, depth, y, thickness, slot = 'mosaic', color = white) {
  const inner = inward(line, depth);
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i],
      b = line[i + 1],
      c = inner[i + 1],
      d = inner[i];
    face(
      out,
      slot,
      [
        [b[0], y, b[1]],
        [a[0], y, a[1]],
        [a[0], y + thickness, a[1]],
        [b[0], y + thickness, b[1]],
      ],
      color,
    );
    // A double-sided midplane retains both visible sides of these 11.5 cm blades.
    face(
      out,
      slot,
      [
        [a[0], y + thickness / 2, a[1]],
        [d[0], y + thickness / 2, d[1]],
        [c[0], y + thickness / 2, c[1]],
        [b[0], y + thickness / 2, b[1]],
      ],
      color,
    );
  }
}
function screen(out, width, cols, rows) {
  const h = 1.82,
    web = 0.06;
  for (let r = 0; r <= rows; r++) {
    const y = 0.19 + (r * (h - web)) / rows;
    rect(out, 'mosaic', -width / 2, width / 2, y, y + web, 0.045, white);
  }
  for (let c = 0; c <= cols; c++) {
    const x = -width / 2 + (c * (width - web)) / cols;
    rect(out, 'mosaic', x, x + web, 0.19, 0.19 + h, 0.04, white);
  }
}
function stairs(out, detail) {
  for (const s of [
    { center: [61.858, 4.86], join: mix(p[66], p[82], 0.5) },
    { center: [-29.78, 1.97], join: mix(p[162], p[179], 0.5) },
    { center: [-46.35, 19.75], join: mix(p[180], p[196], 0.5) },
  ]) {
    const o = transform(out, Math.atan2(s.join[0] - s.center[0], s.join[1] - s.center[1]), [
      s.center[0],
      0,
      s.center[1],
    ]);
    tube(o, 'concrete', [0, base, 0], [0, roofY, 0], 0.44, white, detail.stairSides);
    const n = detail.stairSegments,
      at = (r, a, y) => [r * Math.sin(a), y, r * Math.cos(a)];
    for (let f = 0; f < floors; f++) {
      const fy = base + f * interval;
      for (let i = 0; i < n; i++) {
        const a = (i * tau) / n,
          b = ((i + 1) * tau) / n,
          yb = fy + ((i + 1) * interval) / n,
          ya = detail.level === 'closeup' ? yb : fy + (i * interval) / n;
        face(
          o,
          'concrete',
          [at(0.44, a, ya), at(1.79, a, ya), at(1.79, b, yb), at(0.44, b, yb)],
          white,
        );
        if (detail.level === 'closeup')
          face(
            o,
            'concrete',
            [
              at(0.44, b, yb - 0.12),
              at(1.79, b, yb - 0.12),
              at(1.79, a, ya - 0.12),
              at(0.44, a, ya - 0.12),
            ],
            white,
          );
        if (detail.level === 'closeup')
          face(
            o,
            'concrete',
            [at(0.44, b, yb - 0.12), at(1.79, b, yb - 0.12), at(1.79, b, yb), at(0.44, b, yb)],
            white,
          );
        if (detail.rails) {
          // Open handrail strips and alternate pickets keep the stair visible through its rail.
          const railY = fy + (i * interval) / n;
          face(
            o,
            'metal',
            [
              at(1.79, a, railY + 0.945),
              at(1.79, b, yb + 0.945),
              at(1.79, b, yb + 1),
              at(1.79, a, railY + 1),
            ],
            silver,
          );
          if (i % 2 === 0) {
            const tangent = [-Math.cos(a) * 0.025, 0, Math.sin(a) * 0.025],
              q = at(1.79, a, ya),
              left = q.map((v, k) => v - tangent[k]),
              right = q.map((v, k) => v + tangent[k]);
            face(
              o,
              'metal',
              [left, right, [right[0], ya + 1, right[2]], [left[0], ya + 1, left[2]]],
              silver,
            );
          }
        }
      }
      if (detail.level === 'closeup')
        box(o, 'concrete', [-0.62, fy - 0.1, 0.35], [0.62, fy, 3.25], white);
      else
        face(
          o,
          'concrete',
          [
            [-0.62, fy, 0.35],
            [-0.62, fy, 3.25],
            [0.62, fy, 3.25],
            [0.62, fy, 0.35],
          ],
          white,
        );
    }
  }
}
function rearFacade(out, detail) {
  const line = samples(rear, detail.rearBay);
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i],
      b = line[i + 1],
      o = edge(out, a, b),
      w = dist(a, b),
      pierced = (a[0] + b[0]) / 2 < 5;
    if (detail.level === 'skyline') {
      rect(o, pierced ? 'mosaic' : 'glass', -w / 2, w / 2, base, roofY, 0, pierced ? white : glass);
      continue;
    }
    rect(
      o,
      pierced ? 'concrete' : 'glass',
      -w / 2,
      w / 2,
      base,
      roofY,
      pierced ? -0.62 : -0.04,
      pierced ? dark : glass,
    );
    if (pierced)
      for (const sign of [-1, 1]) {
        const x = (sign * w) / 2;
        rect(o, 'mosaic', x - 0.1, x + 0.1, base, roofY, 0.26, white);
        for (const t of [-1, 1])
          face(
            o,
            'mosaic',
            [
              [x + t * 0.1, base, -0.55],
              [x + t * 0.1, roofY, -0.55],
              [x + t * 0.1, roofY, 0.26],
              [x + t * 0.1, base, 0.26],
            ],
            white,
          );
      }
    for (let f = 0; f < floors; f += detail.rowStride) {
      const y = base + f * interval;
      if (pierced) {
        const q = transform(o, 0, [0, y, 0]);
        if (detail.screenCols)
          screen(q, Math.min(2.3, w - 0.22), detail.screenCols, detail.screenRows);
        rect(
          q,
          'glass',
          -Math.min(1.13, w / 2 - 0.1),
          Math.min(1.13, w / 2 - 0.1),
          2.08,
          2.73,
          -0.2,
          glass,
        );
      }
      rect(o, 'mosaic', -w / 2, w / 2, y + interval - 0.13, y + interval, 0.16, white);
      if (!pierced && detail.level === 'closeup')
        rect(o, 'metal', -w / 2, w / 2, y + 1.47, y + 1.518, 0.03, silver);
    }
    if (!pierced && detail.level !== 'district')
      rect(o, 'metal', -w / 2, -w / 2 + 0.048, base, roofY, 0.03, silver);
  }
}
function lift(out, detail) {
  const line = simplify(p.slice(109, 136), detail.tolerance),
    closed = [...line, line[0]];
  slab(out, line, 0, roofY + 2.1, 'mosaic', white);
  for (let f = 0; f <= floors; f += detail.rowStride)
    wall(out, closed, base + f * interval, base + f * interval + 0.075, 'metal', iron);
  if (detail.level !== 'skyline')
    for (let f = 0; f < floors; f += detail.rowStride) {
      const o = edge(out, p[109], p[135], base + f * interval);
      rect(o, 'glass', -1.05, 1.05, 0.85, 1.8, 0.035, dark);
    }
}
function podium(out, plate, front, detail) {
  const far = detail.level === 'skyline' || detail.level === 'district';
  if (far) slab(out, plate, 0.02, 14.12, 'concrete', gray);
  else for (const y of [0.02, 4.65, 9.05, 13.45]) slab(out, plate, y, y + 0.24, 'concrete', gray);
  // Reconstructed rear gallery glazing within the residential envelope; the wider site is separate.
  if (!far) wall(out, simplify(rear, detail.rearTolerance), 0.26, 13.45, 'glass', glass);
  const bays = samples(front, detail.podiumBay);
  for (let i = 0; i < bays.length - 1; i++) {
    const o = edge(out, bays[i], bays[i + 1]),
      w = dist(bays[i], bays[i + 1]);
    for (const y of [0.25, 4.9, 9.3]) {
      rect(o, 'glass', -w / 2 + 0.125, w / 2 - 0.125, y + 0.1, y + 3.35, -0.04, glass);
      rect(o, 'metal', -w / 2, w / 2, y + 3.5, y + 4.13, 0.04, [0.3, 0.23, 0.17]);
      if (detail.level === 'closeup' && y < 1)
        for (const x of [-0.75, 0.75])
          box(o, 'metal', [x - 0.035, y + 0.06, 0.07], [x + 0.035, y + 2.9, 0.15], iron);
    }
    if (detail.level !== 'skyline')
      tube(
        o,
        'concrete',
        [-w / 2, 0.25, -0.7],
        [-w / 2, base, -0.7],
        0.27,
        white,
        detail.stairSides,
      );
  }
  if (!far) slab(out, plate, 13.69, 14.12, 'concrete', white);
  blade(out, front, 1.28, base - 0.65, 0.65, 'concrete', white);
}
function build(out, level) {
  const detail = {
    skyline: {
      tolerance: 0.15,
      rearTolerance: 0.3,
      rearBay: 15,
      rowStride: 32,
      stairSides: 4,
      stairSegments: 1,
      podiumBay: 18,
      rails: false,
    },
    district: {
      tolerance: 0.1,
      rearTolerance: 0.15,
      rearBay: 8,
      rowStride: 8,
      stairSides: 6,
      stairSegments: 4,
      podiumBay: 12,
      rails: false,
      screenCols: 1,
      screenRows: 1,
    },
    street: {
      tolerance: 0.15,
      rearTolerance: 0.1,
      rearBay: 5.3,
      rowStride: 2,
      stairSides: 8,
      stairSegments: 8,
      podiumBay: 8,
      rails: false,
      screenCols: 2,
      screenRows: 1,
    },
    closeup: {
      tolerance: 0.055,
      rearTolerance: 0.02,
      rearBay: 2.65,
      rowStride: 1,
      stairSides: 8,
      stairSegments: 20,
      podiumBay: 5.8,
      rails: true,
      screenCols: 6,
      screenRows: 4,
    },
  }[level];
  detail.level = level;
  const front = simplify(p.slice(0, 65), detail.tolerance),
    far = level === 'skyline' || level === 'district',
    glazing = inward(front, far ? 0.64 : 1.28),
    plate = [...inward(front, 1.28), ...simplify(rear, detail.rearTolerance)];
  wall(
    out,
    glazing,
    base,
    roofY,
    level === 'skyline' ? 'mosaic' : 'glass',
    level === 'skyline' ? white : glass,
  );
  const stride = level === 'skyline' ? 0 : level === 'district' ? 8 : 1;
  if (stride)
    for (let f = 0; f < floors; f += stride)
      for (const y of f === 15 || f === 23 ? [0.03] : far ? [0.03] : [0.03, 1.01, 1.99])
        blade(out, front, 0.98, base + f * interval + y, 0.115);
  rearFacade(out, detail);
  // Closed end plates with two columns of short recessed slit windows.
  for (const [a, b] of [
    [p[64], p[65]],
    [p[197], p[0]],
  ]) {
    const o = edge(out, a, b),
      w = dist(a, b);
    rect(o, 'mosaic', -w / 2, w / 2, base, roofY, 0, white);
    if (!far)
      for (let f = 0; f < floors; f += detail.rowStride)
        for (const x of [-2.1, 2.1])
          rect(
            o,
            'glass',
            x - 1.47,
            x + 1.47,
            base + f * interval + 1.82,
            base + f * interval + 2.14,
            0.004,
            dark,
          );
  }
  lift(out, detail);
  if (level !== 'skyline') stairs(out, detail);
  else
    for (const [x, z] of [
      [61.858, 4.86],
      [-29.78, 1.97],
      [-46.35, 19.75],
    ])
      tube(out, 'concrete', [x, base, z], [x, roofY, z], 1.1, white, 4);
  podium(out, plate, inward(front, 1.28), detail);
  slab(out, plate, roofY, roofY + 0.18, 'concrete', gray);
  blade(out, front, 0.28, roofY + 0.18, 0.95);
  blade(out, rear, 0.22, roofY + 0.18, 0.95);
  box(out, 'mosaic', [35, roofY + 0.18, -3.2], [49, 114.7, 6.8], white);
  box(out, 'concrete', [34.7, 114.7, -3.5], [49.3, 114.85, 7.1], gray);
  face(
    out,
    'metal',
    [
      [34.85, 115, -3.35],
      [34.85, 115, 6.95],
      [49.15, 115, 6.95],
      [49.15, 115, -3.35],
    ],
    [0.18, 0.39, 0.5],
  );
  for (const [x, z] of [
    [-42, 0],
    [-23, -11],
    [5, 1],
  ])
    box(out, 'mosaic', [x - 2, roofY + 0.18, z - 3], [x + 2, roofY + 3, z + 3], gray);
}
// Skyline is a single vertex palette with measured shared-surface means.
const bake = (out) => {
  const factor = {
    mosaic: [0.7330662304631436, 0.7639927022681822, 0.7148465816066711],
    concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  };
  const color = (s, c) => c.map((v, i) => v * (factor[s]?.[i] ?? 1));
  return {
    addQuad: (s, _r, p, n, u, c) => out.addQuad('wall', 'palette:#ffffff', p, n, u, color(s, c)),
    addTriangle: (s, _r, p, n, u, c) =>
      out.addTriangle('wall', 'palette:#ffffff', p, n, u, color(s, c)),
    addConvexPolygon: (s, _r, p, n, u, c) =>
      out.addConvexPolygon('wall', 'palette:#ffffff', p, n, u, color(s, c)),
  };
};
export const buildCopanSkyline = (out) => build(bake(out), 'skyline');
export const buildCopanDistrict = (out) => build(out, 'district');
export const buildCopanStreet = (out) => build(out, 'street');
export const buildCopanCloseup = (out) => build(out, 'closeup');
