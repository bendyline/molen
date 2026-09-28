/** Baku Flame Towers: three independently mapped curved wings and shared retail podium. */
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  grid,
  mappedCap,
  mappedSolid,
  panel,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const glass = [0.27, 0.405, 0.465],
  silver = [0.51, 0.57, 0.59],
  gasket = [0.085, 0.115, 0.13],
  stone = [0.67, 0.66, 0.61];
const pavilions = [
  [29, -51, 18, 14, 25.2],
  [38, -24, 15, 16, 21.8],
  [42, 2, 18, 15, 18.6],
];

/** Subtract the tapered pavilions before skinning the common podium. Its roof
 * and diagonal curtain wall must not protrude through their picture windows. */
function podiumBuilder(out) {
  const volumes = pavilions.map(([cx, cz, w, d, top]) => [
    (p) => p[0] - cx - w * 0.5 + (w * 0.06 * p[1]) / top,
    (p) => cx - p[0] - w * 0.5 + (w * 0.06 * p[1]) / top,
    (p) => p[2] - cz - d * 0.5,
    (p) => cz - p[2] - d * 0.5,
    (p) => p[1] - top,
    (p) => -p[1],
  ]);
  const half = (poly, plane, positive) => {
    const result = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length],
        da = plane(a),
        db = plane(b),
        ina = positive ? da > 1e-7 : da <= 1e-7,
        inb = positive ? db > 1e-7 : db <= 1e-7;
      if (ina) result.push(a);
      if (ina !== inb) {
        const t = da / (da - db);
        result.push(a.map((v, k) => v + (b[k] - v) * t));
      }
    }
    return result;
  };
  const subtract = (poly, planes) => {
    const result = [];
    let remaining = poly;
    for (const plane of planes) {
      if (remaining.length < 3) break;
      const outside = half(remaining, plane, true);
      if (outside.length >= 3) result.push(outside);
      remaining = half(remaining, plane, false);
    }
    return result;
  };
  const emit = (slot, ref, points, normal, _uv, color) => {
    let pieces = [points];
    for (const planes of volumes) pieces = pieces.flatMap((p) => subtract(p, planes));
    for (const p of pieces)
      for (let i = 1; i < p.length - 1; i++) {
        const q = [p[0], p[i], p[i + 1]],
          a = q[1].map((v, k) => v - q[0][k]),
          b = q[2].map((v, k) => v - q[0][k]),
          area = Math.hypot(
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
          );
        if (area > 1e-5)
          out.addTriangle(
            slot,
            ref,
            q,
            normal,
            [
              [0, 0],
              [1, 0],
              [0, 1],
            ],
            color,
          );
      }
  };
  return {
    ...out,
    addTriangle: emit,
    addQuad(slot, ref, p, n, uv, c) {
      emit(slot, ref, [p[0], p[1], p[2]], n, uv, c);
      emit(slot, ref, [p[0], p[2], p[3]], n, uv, c);
    },
  };
}

function open(plan) {
  return Math.hypot(plan[0][0] - plan.at(-1)[0], plan[0][1] - plan.at(-1)[1]) < 0.01
    ? plan.slice(0, -1)
    : plan;
}

/** Smooth only the surveyed plan segments; metre-spaced mullions retain its three unequal sides. */
function sampled(plan) {
  const ring = clockwise(open(plan)),
    result = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[(i + ring.length - 1) % ring.length],
      b = ring[i],
      c = ring[(i + 1) % ring.length],
      d = ring[(i + 2) % ring.length],
      length = Math.hypot(c[0] - b[0], c[1] - b[1]),
      count = Math.max(1, Math.ceil(length / 1.36));
    for (let j = 0; j < count; j++) {
      const t = j / count;
      // Modest Hermite tangents avoid overshooting the mapped pointed terminals.
      const p = b.map((n, k) => {
        const m0 = (c[k] - a[k]) * 0.33,
          m1 = (d[k] - b[k]) * 0.33;
        return (
          (2 * t ** 3 - 3 * t ** 2 + 1) * n +
          (t ** 3 - 2 * t ** 2 + t) * m0 +
          (-2 * t ** 3 + 3 * t ** 2) * c[k] +
          (t ** 3 - t ** 2) * m1
        );
      });
      result.push(p);
    }
  }
  return result;
}

function tower(out, part, height, tip, inner, floorPitch, partialSide) {
  const plan = sampled(part.local),
    length = Math.hypot(tip[0] - inner[0], tip[1] - inner[1]),
    along = [(tip[0] - inner[0]) / length, (tip[1] - inner[1]) / length],
    across = [-along[1], along[0]],
    coordinates = plan.map((p) => {
      const delta = [p[0] - inner[0], p[1] - inner[1]];
      return [
        delta[0] * along[0] + delta[1] * along[1],
        delta[0] * across[0] + delta[1] * across[1],
      ];
    }),
    point = (i, y) => {
      const t = y / height,
        [long, cross] = coordinates[i],
        low = length * (0.22 * t + 0.78 * t ** 3),
        high = length * (1 - 0.18 * Math.sin(Math.PI * t)),
        u = low + ((high - low) * long) / length,
        v = cross * (1 - 0.24 * t - 0.76 * t ** 5);
      return [inner[0] + along[0] * u + across[0] * v, y, inner[1] + along[1] * u + across[1] * v];
    };
  const seams = [height * 0.724, height * 0.75],
    partialSeams =
      part.role === 'hotel' ? [height * 0.112, height * 0.145] : [height * 0.414, height * 0.441],
    levels = [0, 0.45, 5.1, height - 0.22];
  for (let y = 5.1 + floorPitch; y < height - 0.6; y += floorPitch) levels.push(y);
  for (const y of [...seams, ...partialSeams]) levels.push(y, y + 0.65);
  levels.sort((a, b) => a - b);
  for (let j = 1; j < levels.length; j++) {
    const y0 = levels[j - 1],
      y1 = levels[j],
      mid = (y0 + y1) / 2;
    for (let i = 0; i < plan.length; i++) {
      const k = (i + 1) % plan.length,
        p = [point(i, y0), point(k, y0), point(k, y1), point(i, y1)],
        inPartial = (coordinates[i][1] + coordinates[k][1]) * partialSide > -6,
        band =
          seams.some((y) => mid > y && mid < y + 0.65) ||
          (inPartial && partialSeams.some((y) => mid > y && mid < y + 0.65));
      if (band || y1 <= 0.45) {
        face(out, 'recess', p, gasket);
        continue;
      }
      const tint = glass.map((n) => n * (0.97 + (0.03 * ((i + j * 3) % 4)) / 3));
      const width = Math.hypot(...p[1].map((v, n) => v - p[0][n]));
      // The engineer specifies four-corner story-height unitized glass, not a visible diagrid.
      panel(out, p, tint, Math.min(0.032, width * 0.08), silver);
      if (width > 0.17 && y1 - y0 > 0.4) {
        const n = normalFor(...p);
        beam(out, 'metal', shift(p[0], n, 0.022), shift(p[3], n, 0.022), 0.025, 0.032, silver);
      }
    }
  }
  for (let i = 0; i < plan.length; i++) {
    const k = (i + 1) % plan.length;
    tri(
      out,
      'glass',
      [point(i, height - 0.22), point(k, height - 0.22), [tip[0], height, tip[1]]],
      glass,
    );
  }
  mappedCap(out, 'foundation', plan, 0, [0.43, 0.44, 0.43], [], true);
}

function barrelAtrium(out) {
  const y0 = 12.05,
    cx = -20,
    z0 = -49,
    z1 = -1,
    radius = 11;
  const point = (a, z) => [cx + Math.sin(a) * radius, y0 + Math.cos(a) * 6, z];
  for (let iz = 0; iz < 24; iz++)
    for (let ia = 0; ia < 24; ia++) {
      const a0 = -Math.PI / 2 + (Math.PI * ia) / 24,
        a1 = -Math.PI / 2 + (Math.PI * (ia + 1)) / 24,
        low = z0 + ((z1 - z0) * iz) / 24,
        high = z0 + ((z1 - z0) * (iz + 1)) / 24;
      panel(
        out,
        [point(a0, low), point(a0, high), point(a1, high), point(a1, low)],
        [0.19, 0.42, 0.55],
        0.06,
        silver,
      );
    }
  for (const [z, reverse] of [
    [z0, false],
    [z1, true],
  ]) {
    const contour = Array.from({ length: 25 }, (_, i) =>
      point(-Math.PI / 2 + (Math.PI * i) / 24, z),
    );
    for (let i = 1; i < contour.length; i++) {
      const p = [[cx, y0, z], contour[i - 1], contour[i]];
      tri(out, 'glass', reverse ? p.toReversed() : p, [0.19, 0.42, 0.55]);
    }
    for (let i = 1; i < contour.length; i++)
      tube(out, 'metal', contour[i - 1], contour[i], 0.055, silver, 6);
  }
  for (const x of [cx - radius - 0.4, cx + radius + 0.4])
    box(out, 'limestone', [x - 0.4, 11.8, z0 - 0.4], [x + 0.4, 12.4, z1 + 0.4], stone);
}

function pool(out) {
  const ring = clockwise(
    Array.from({ length: 80 }, (_, i) => {
      const a = (i / 80) * Math.PI * 2,
        r = 1 + 0.19 * Math.cos(3 * a);
      return [6 + Math.cos(a) * 8.7 * r, -25 + Math.sin(a) * 20 * r];
    }),
  );
  mappedSolid(out, 'limestone', ring, 12.01, 12.38, [0.77, 0.74, 0.66]);
  const inset = ring.map(([x, z]) => [6 + (x - 6) * 0.93, -25 + (z + 25) * 0.96]);
  mappedCap(out, 'glass', inset, 12.39, [0.12, 0.53, 0.62]);
  for (const z of [-36, -24, -12]) {
    box(out, 'metal', [18, 12.02, z - 1.8], [19.7, 12.4, z + 1.8], [0.83, 0.82, 0.76]);
    box(out, 'metal', [18.4, 12.4, z - 1.8], [19.7, 12.8, z - 0.7], [0.83, 0.82, 0.76]);
  }
}

function pavilion(out, cx, cz, width, depth, top) {
  const plan = clockwise([
      [cx - width / 2, cz - depth / 2],
      [cx + width / 2, cz - depth / 2],
      [cx + width / 2, cz + depth / 2],
      [cx - width / 2, cz + depth / 2],
    ]),
    upper = plan.map(([x, z]) => [cx + (x - cx) * 0.88, top, z]);
  loft(out, 'limestone', [plan.map(([x, z]) => [x, 0, z]), upper], stone);
  for (const side of [-1, 1]) {
    const z = cz + side * (depth / 2 + 0.02),
      a = [cx - width * 0.27, 5.6, z],
      b = [cx + width * 0.27, 5.6, z],
      c = [cx + width * 0.2, top - 3.2, z],
      d = [cx - width * 0.2, top - 3.2, z],
      p = [a, b, c, d];
    grid(out, side === 1 ? p : p.toReversed(), [0.14, 0.23, 0.26], 1.2, 2.7, 0.05, silver);
    for (let y = 6.2; y < top - 3.5; y += 0.47) {
      const t = (y - 5.6) / (top - 8.8),
        hw = width * (0.27 - 0.07 * t);
      tube(
        out,
        'metal',
        [cx - hw, y, z + side * 0.1],
        [cx + hw, y, z + side * 0.1],
        0.035,
        gasket,
        6,
      );
    }
  }
  // Large recessed eastern picture window follows the inclined precast face.
  // Keeping it on the same sloping plane prevents a triangular floating panel.
  const front = (y, z) => [cx + width / 2 - (width * 0.06 * y) / top + 0.055, y, z],
    low = 4.8,
    high = top - 3.5;
  grid(
    out,
    [
      front(low, cz - depth * 0.28),
      front(low, cz + depth * 0.28),
      front(high, cz + depth * 0.28),
      front(high, cz - depth * 0.28),
    ].toReversed(),
    [0.14, 0.23, 0.26],
    1.2,
    2.7,
    0.065,
    silver,
  );
  for (let y = low + 0.4; y < high - 0.2; y += 0.47)
    tube(out, 'metal', front(y, cz - depth * 0.28), front(y, cz + depth * 0.28), 0.035, gasket, 6);
  // Open roof parapets and recessed skylight, visible in the engineer's aerial view.
  box(
    out,
    'glass',
    [cx - width * 0.23, top + 0.02, cz - depth * 0.25],
    [cx + width * 0.23, top + 0.1, cz + depth * 0.25],
    [0.16, 0.29, 0.31],
  );
  for (const side of [-1, 1])
    box(
      out,
      'limestone',
      [cx - width * 0.43, top, cz + side * (depth / 2 - 0.4) - 0.3],
      [cx + width * 0.43, top + 0.65, cz + side * (depth / 2 - 0.4) + 0.3],
      stone,
    );
}

function cinema(out) {
  const plan = clockwise(
    Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      return [-42 + Math.cos(a) * 19, -67 + Math.sin(a) * 11.8];
    }),
  );
  mappedSolid(out, 'concrete', plan, 0, 13.6, [0.38, 0.4, 0.39]);
  const ring = (y, s = 1) => plan.map(([x, z]) => [-42 + (x + 42) * s, y, -67 + (z + 67) * s]);
  const low = ring(13.6),
    high = ring(27.5, 1.015);
  for (let i = 0; i < plan.length; i++) {
    const k = (i + 1) % plan.length,
      p = [low[i], low[k], high[k], high[i]];
    if (Math.cos(((i + 0.5) / 64) * Math.PI * 2) > 0.91)
      grid(out, p, [0.14, 0.34, 0.4], 1.5, 2.8, 0.075, silver);
    else face(out, 'metal', p, [0.51, 0.055, 0.08]);
  }
  mappedCap(
    out,
    'concrete',
    high.map(([x, _y, z]) => [x, z]),
    27.5,
    [0.35, 0.37, 0.36],
  );
  for (let i = 0; i < plan.length; i += 2) {
    const a = ring(13.7)[i],
      b = ring(27.4, 1.015)[i];
    tube(out, 'metal', a, b, 0.035, [0.35, 0.025, 0.035], 6);
  }
}

export function buildFlame(out, mapped) {
  const parts = mapped.parts,
    podium = clockwise(open(parts.find((p) => p.role === 'podium').local)),
    podiumOut = podiumBuilder(out);
  mappedCap(podiumOut, 'concrete', podium, 12, [0.49, 0.5, 0.47]);
  mappedCap(podiumOut, 'concrete', podium, 0, [0.49, 0.5, 0.47], [], true);
  for (let i = 0; i < podium.length; i++) {
    const a = podium[i],
      b = podium[(i + 1) % podium.length];
    for (const [low, high] of [
      [0, 1.2],
      [10.8, 12],
    ])
      face(
        podiumOut,
        'limestone',
        [
          [a[0], low, a[1]],
          [b[0], low, b[1]],
          [b[0], high, b[1]],
          [a[0], high, a[1]],
        ],
        stone,
      );
    grid(
      podiumOut,
      [
        [a[0], 1.2, a[1]],
        [b[0], 1.2, b[1]],
        [b[0], 10.8, b[1]],
        [a[0], 10.8, a[1]],
      ],
      [0.19, 0.27, 0.28],
      2.1,
      3.2,
      0.12,
      stone,
      'limestone',
    );
  }
  tower(
    out,
    parts.find((p) => p.role === 'residential'),
    182,
    [36.1352, 88.5644],
    [13.5549, 27.066],
    3.85,
    1,
  );
  tower(
    out,
    parts.find((p) => p.role === 'hotel'),
    165,
    [3.1978, -145.4959],
    [-1.9977, -81.1143],
    3.6,
    -1,
  );
  tower(
    out,
    parts.find((p) => p.role === 'office'),
    161,
    [-103.1299, -29.9574],
    [-36.0972, -32.8017],
    3.85,
    -1,
  );
  barrelAtrium(out);
  pool(out);
  cinema(out);
  for (const p of pavilions) pavilion(out, ...p);
  // Hotel's shallow white curved arrival canopy, independently supported at street level.
  const canopy = clockwise(
    Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      return [29 + Math.cos(a) * 14, -101 + Math.sin(a) * 6];
    }),
  );
  mappedSolid(out, 'metal', canopy, 5.8, 6.12, [0.85, 0.86, 0.83]);
  for (const z of [-104, -98]) tube(out, 'metal', [35, 0, z], [35, 5.8, z], 0.15, silver, 12);
  for (const z of [-103.2, -98.8]) {
    const rings = [radialRing(0, 1.9, 1.9, 40, [23, z]), radialRing(4.3, 1.9, 1.9, 40, [23, z])];
    loft(out, 'glass', rings, [0.19, 0.31, 0.34]);
    for (let i = 0; i < 40; i += 10) tube(out, 'metal', rings[0][i], rings[1][i], 0.055, silver, 6);
    for (const y of [0.08, 4.3])
      for (let i = 0; i < 40; i++) {
        const ring = radialRing(y, 1.93, 1.93, 40, [23, z]);
        tube(out, 'metal', ring[i], ring[(i + 1) % 40], 0.065, silver, 6);
      }
  }
}
