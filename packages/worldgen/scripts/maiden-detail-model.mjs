/** maiden_tower complete static medium-fi exterior. The exact original heritage source remains unchanged. */
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const stone = [0.79, 0.73, 0.61],
  ref = 'palette:#ffffff',
  tau = 2 * Math.PI;
function detail(out, mode) {
  const far = mode === 'skyline' || mode === 'district';
  const sides = { master: 192, closeup: 96, street: 16, district: 24, skyline: 16 }[mode];
  const center = [-4.782, 0.011],
    radius = 8.25;
  const p = (a, y, r) => [center[0] + r * Math.cos(a), y, center[1] + r * Math.sin(a)];
  function face(slot, points, color = stone) {
    quad(out, slot, points, normalFor(...points), color);
  }
  function roundFace(points, color = stone) {
    const n = normalFor(...points),
      base = Math.atan2(points[0][2] - center[1], points[0][0] - center[0]);
    // Metric cylindrical UV survives source import and runtime authoring, with no facet restart.
    const uv = points.map((v) => {
      let a = Math.atan2(v[2] - center[1], v[0] - center[0]);
      while (a - base > Math.PI) a -= tau;
      while (a - base < -Math.PI) a += tau;
      return [a * radius, v[1]];
    });
    out.addQuad('limestone_round', 'metric:uv', points, n, uv, color);
  }
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
  const holes = mode === 'skyline' ? openings.slice(0, 1) : openings;
  const count = far ? (mode === 'skyline' ? 3 : 6) : 43;
  const pitch = far ? 18.12 / count : 0.418,
    bandHeight = far ? pitch * 0.48 : 0.22;
  const levels = [0, 12, 30.12, ...holes.flatMap((h) => [h.y, h.y + h.h])];
  for (let i = 0; i < count; i++) levels.push(12 + i * pitch, 12 + i * pitch + bandHeight);
  const ys = [...new Set(levels)].sort((a, b) => a - b);
  const raised = (y) => y >= 12 && (y - 12) % pitch < bandHeight;
  const radial = (y) => radius + (!far && raised(y) ? 0.095 : 0);
  const baseAngles = Array.from({ length: sides + 1 }, (_, i) => (i * tau) / sides);
  // All rows share aperture edges. Differently split circular chords created visible wedges.
  const angles = [
    ...new Set([
      ...baseAngles,
      ...holes.flatMap((h) => [h.angle - h.width / (2 * radius), h.angle + h.width / (2 * radius)]),
    ]),
  ].sort((a, b) => a - b);
  for (let j = 0; j < ys.length - 1; j++) {
    const y0 = ys[j],
      y1 = ys[j + 1],
      midY = (y0 + y1) / 2,
      r = radial(midY);
    const active = holes.filter((h) => midY > h.y && midY < h.y + h.h);
    for (let i = 0; i < angles.length - 1; i++) {
      const a = angles[i],
        b = angles[i + 1],
        m = (a + b) / 2;
      if (active.some((h) => Math.abs(m - h.angle) < h.width / (2 * radius))) continue;
      const tint = stone.map(
        (v) =>
          v *
          (far
            ? midY >= 12
              ? raised(midY)
                ? 0.99
                : 0.97
              : 1
            : 1 + 0.012 * Math.sin(i * 0.67 + j * 1.9)),
      );
      roundFace([p(b, y0, r), p(a, y0, r), p(a, y1, r), p(b, y1, r)], tint);
    }
    if (!far && y0 >= 12) {
      const before = radial(y0 - 0.001);
      if (before !== r)
        for (let i = 0; i < angles.length - 1; i++) {
          const a = angles[i],
            b = angles[i + 1],
            m = (a + b) / 2;
          if (
            holes.some(
              (h) => y0 > h.y && y0 < h.y + h.h && Math.abs(m - h.angle) < h.width / (2 * radius),
            )
          )
            continue;
          face(
            'limestone',
            [p(a, y0, before), p(b, y0, before), p(b, y0, r), p(a, y0, r)].reverse(),
          );
        }
    }
  }
  for (const h of holes) {
    const a = h.angle - h.width / (2 * radius),
      b = h.angle + h.width / (2 * radius),
      y0 = h.y,
      y1 = h.y + h.h,
      r = radial(y0 - 0.001),
      back = radius - 0.85;
    face(
      'shadow',
      [p(b, y0, back), p(a, y0, back), p(a, y1, back), p(b, y1, back)],
      [0.18, 0.17, 0.15],
    );
    const cuts = [...new Set([y0, y1, ...ys.filter((y) => y > y0 && y < y1)])].sort(
      (a, b) => a - b,
    );
    for (let j = 0; j < cuts.length - 1; j++) {
      const lo = cuts[j],
        hi = cuts[j + 1],
        front = radial((lo + hi) / 2);
      face('limestone', [p(a, lo, back), p(a, lo, front), p(a, hi, front), p(a, hi, back)]);
      face('limestone', [p(b, lo, front), p(b, lo, back), p(b, hi, back), p(b, hi, front)]);
    }
    face('limestone', [p(a, y0, r), p(a, y0, back), p(b, y0, back), p(b, y0, r)]);
    const topRadius = radial(y1 + 0.001);
    face('limestone', [p(b, y1, topRadius), p(b, y1, back), p(a, y1, back), p(a, y1, topRadius)]);
    if (h.arched) {
      const segments = mode === 'skyline' ? 4 : 16,
        spring = y1 - 0.45;
      for (let k = 0; k < segments; k++) {
        const u0 = k / segments,
          u1 = (k + 1) / segments,
          t0 = a + (b - a) * u0,
          t1 = a + (b - a) * u1,
          curve = (u) => spring + 0.45 * Math.sin(Math.PI * u);
        face('limestone', [
          p(t1, curve(u1), r),
          p(t0, curve(u0), r),
          p(t0, y1 + 0.002, r),
          p(t1, y1 + 0.002, r),
        ]);
      }
      if (!far)
        tube(
          out,
          'metal',
          p(h.angle, 0.22, r + 0.1),
          p(h.angle, 1.8, r + 0.1),
          0.022,
          [0.25, 0.27, 0.25],
          6,
        );
    }
  }
  if (mode === 'skyline')
    for (const h of openings.slice(1)) {
      const a = h.angle - h.width / (2 * radius),
        b = h.angle + h.width / (2 * radius);
      face(
        'shadow',
        [
          p(b, h.y, radius + 0.008),
          p(a, h.y, radius + 0.008),
          p(a, h.y + h.h, radius + 0.008),
          p(b, h.y + h.h, radius + 0.008),
        ],
        [0.18, 0.17, 0.15],
      );
    }
  out.addConvexPolygon(
    'limestone',
    ref,
    radialRing(30.12, radius, radius, sides, center),
    [0, 1, 0],
    (v) => [v[0], v[2]],
    stone,
  );
  const ringSides = sides;
  for (let i = 0; i < ringSides; i++) {
    const a = (-i * tau) / ringSides,
      b = (-(i + 1) * tau) / ringSides,
      inner = 7.69,
      outer = 8.34;
    roundFace([p(a, 30.12, outer), p(b, 30.12, outer), p(b, 31, outer), p(a, 31, outer)]);
    roundFace([p(b, 30.12, inner), p(a, 30.12, inner), p(a, 31, inner), p(b, 31, inner)]);
    face('limestone', [p(a, 31, inner), p(a, 31, outer), p(b, 31, outer), p(b, 31, inner)]);
    face('limestone', [
      p(b, 30.12, inner),
      p(b, 30.12, outer),
      p(a, 30.12, outer),
      p(a, 30.12, inner),
    ]);
  }
  const rootA = [2.41, 3.87],
    rootB = [3.36, -1.83],
    endA = [12.3, 8.31],
    endB = [13.13, 5.43],
    end = [(endA[0] + endB[0]) / 2, (endA[1] + endB[1]) / 2];
  const axis = Math.atan2(end[1] - 0.6, end[0] - center[0]),
    nose = mode === 'skyline' ? 5 : mode === 'district' || mode === 'street' ? 9 : 17;
  const outline = [rootA, endA];
  for (let i = 1; i < nose; i++) {
    const a = axis + Math.PI / 2 - (i * Math.PI) / nose;
    outline.push([end[0] + 1.5 * Math.cos(a), end[1] + 1.5 * Math.sin(a)]);
  }
  outline.push(endB, rootB);
  loft(
    out,
    'limestone',
    [outline.map(([x, z]) => [x, 0, z]), outline.map(([x, z]) => [x, 30.12, z])],
    stone,
  );
  // Offset each convex plan edge inwards by 38 cm; intersect successive support lines for a continuous parapet.
  const inner = outline.map((v, i) => {
    const a = outline[(i + outline.length - 1) % outline.length],
      b = outline[(i + 1) % outline.length];
    const da = [v[0] - a[0], v[1] - a[1]],
      db = [b[0] - v[0], b[1] - v[1]],
      la = Math.hypot(...da),
      lb = Math.hypot(...db);
    const qa = [v[0] + (da[1] / la) * 0.38, v[1] - (da[0] / la) * 0.38],
      qb = [v[0] + (db[1] / lb) * 0.38, v[1] - (db[0] / lb) * 0.38];
    const t = ((qb[0] - qa[0]) * db[1] - (qb[1] - qa[1]) * db[0]) / (da[0] * db[1] - da[1] * db[0]);
    return [qa[0] + da[0] * t, qa[1] + da[1] * t];
  });
  for (let i = 0; i < outline.length - 1; i++) {
    const a = outline[i],
      b = outline[i + 1],
      c = inner[i],
      d = inner[i + 1];
    face('limestone', [
      [a[0], 30.12, a[1]],
      [b[0], 30.12, b[1]],
      [b[0], 31, b[1]],
      [a[0], 31, a[1]],
    ]);
    face('limestone', [
      [d[0], 30.12, d[1]],
      [c[0], 30.12, c[1]],
      [c[0], 31, c[1]],
      [d[0], 31, d[1]],
    ]);
    face('limestone', [
      [a[0], 31, a[1]],
      [b[0], 31, b[1]],
      [d[0], 31, d[1]],
      [c[0], 31, c[1]],
    ]);
    face('limestone', [
      [b[0], 30.12, b[1]],
      [a[0], 30.12, a[1]],
      [c[0], 30.12, c[1]],
      [d[0], 30.12, d[1]],
    ]);
  }
  for (let j = 0; j < count; j++) {
    const y = 12 + j * pitch;
    for (let i = 0; i < outline.length - 1; i++) {
      const a = outline[i],
        b = outline[i + 1],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        depth = far ? 0.003 : 0.1,
        nx = (-dz / len) * depth,
        nz = (dx / len) * depth;
      face(
        'limestone',
        [
          [a[0] + nx, y, a[1] + nz],
          [b[0] + nx, y, b[1] + nz],
          [b[0] + nx, y + bandHeight, b[1] + nz],
          [a[0] + nx, y + bandHeight, a[1] + nz],
        ],
        far ? stone.map((v) => v * 0.985) : stone,
      );
      if (!far) {
        face('limestone', [
          [a[0], y + bandHeight, a[1]],
          [a[0] + nx, y + bandHeight, a[1] + nz],
          [b[0] + nx, y + bandHeight, b[1] + nz],
          [b[0], y + bandHeight, b[1]],
        ]);
        face('limestone', [
          [b[0], y, b[1]],
          [b[0] + nx, y, b[1] + nz],
          [a[0] + nx, y, a[1] + nz],
          [a[0], y, a[1]],
        ]);
      }
    }
  }
  // Proportional low stairhead, not a new tower silhouette or fabricated interior.
  box(out, 'limestone', [-3.4, 30.12, 4.9], [-1.5, 30.43, 6.25], stone);
  loft(
    out,
    'limestone',
    [
      [
        [-3.4, 30.43, 4.9],
        [-3.4, 30.43, 6.25],
        [-1.5, 30.43, 6.25],
        [-1.5, 30.43, 4.9],
      ],
      [
        [-3.4, 30.9, 4.9],
        [-3.4, 30.9, 6.25],
        [-1.5, 30.45, 6.25],
        [-1.5, 30.45, 4.9],
      ],
    ],
    stone,
  );
  const a = Math.PI,
    r = radius + 0.12;
  face(
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
export function buildMaidenReviewed(out) {
  detail(out, 'master');
}
export function buildMaidenCloseup(out) {
  detail(out, 'closeup');
}
export function buildMaidenStreet(out) {
  detail(out, 'street');
}
export function buildMaidenDistrict(out) {
  detail(out, 'district');
}
const means = {
  limestone: [0.7539, 0.710243, 0.616244],
  limestone_round: [0.7539, 0.710243, 0.616244],
  metal: [0.908889, 0.908889, 0.908889],
  shadow: [1, 1, 1],
};
export function buildMaidenSkyline(destination) {
  detail(
    {
      addQuad: (s, _r, p, n, u, c) =>
        destination.addQuad(
          'body',
          ref,
          p,
          n,
          u,
          c.map((v, i) => v * means[s][i]),
        ),
      addTriangle: (s, _r, p, n, u, c) =>
        destination.addTriangle(
          'body',
          ref,
          p,
          n,
          u,
          c.map((v, i) => v * means[s][i]),
        ),
      addConvexPolygon: (s, _r, p, n, u, c) =>
        destination.addConvexPolygon(
          'body',
          ref,
          p,
          n,
          u,
          c.map((v, i) => v * means[s][i]),
        ),
    },
    'skyline',
  );
}
