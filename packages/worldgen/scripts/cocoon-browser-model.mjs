/** Cocoon Tower's rounded threefold envelope and white web, with budgeted browser levels. */
import './install-deterministic-math.mjs';
import { beam, cross, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { face, panel, cap, solidPlan } from './signature-tower-expansion-models.mjs';
const MEANS = {
  foundation: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
  metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  glass: [1, 1, 1],
};
function writer(out, far) {
  const tri = (s, p, c) => {
    p = p.map((v) => v.map(Math.fround));
    const a = p[1].map((v, i) => v - p[0][i]),
      b = p[2].map((v, i) => v - p[0][i]);
    if (Math.hypot(...cross(a, b)) < 1e-10) return;
    out.addTriangle(
      s,
      'palette:#ffffff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      far ? c.map((v, i) => v * (MEANS[s]?.[i] ?? 1)) : c,
    );
  };
  return {
    addTriangle(s, r, p, n, u, c) {
      tri(s, p, c);
    },
    addQuad(s, r, p, n, u, c) {
      tri(s, p.slice(0, 3), c);
      tri(s, [p[0], p[2], p[3]], c);
    },
    addConvexPolygon(s, r, p, n, u, c) {
      for (let i = 1; i < p.length - 1; i++) tri(s, [p[0], p[i], p[i + 1]], c);
    },
  };
}
const height = 203.65,
  profile = [
    [0.35, 20.5],
    [12, 22.4],
    [45, 25.6],
    [85, 26.2],
    [125, 24.8],
    [157, 21],
    [181, 15.7],
    [196, 8],
    [200, 4.5],
    [203.65, 0.2],
  ];
function radius(y) {
  for (let i = 1; i < profile.length; i++)
    if (y <= profile[i][0]) {
      const [a, r] = profile[i - 1],
        [b, s] = profile[i],
        t = Math.max(0, (y - a) / (b - a));
      return r + (s - r) * t;
    }
  return profile.at(-1)[1];
}
function point(a, y, offset = 0) {
  const r = radius(y) * (1 - 0.043 * Math.cos(3 * a)) + offset;
  return [r * Math.cos(a), y, r * 0.94 * Math.sin(a)];
}
function build(target, tier) {
  const out = writer(target, tier === 0),
    n = [12, 24, 48, 72][tier],
    rows = [10, 18, 28, 48][tier],
    white = [0.9, 0.91, 0.89],
    metal = [0.66, 0.7, 0.72];
  solidPlan(
    out,
    'foundation',
    radialRing(0, 21.1, 20, n).map((p) => [p[0], p[2]]),
    0,
    0.35,
    [0.48, 0.49, 0.47],
  );
  const levels = [
    0.35,
    ...Array.from({ length: rows }, (_, i) => 0.35 + ((height - 0.35) * (i + 1)) / rows),
    ...profile.map((v) => v[0]),
  ]
    .sort((a, b) => a - b)
    .filter((v, i, a) => i === 0 || v > a[i - 1]);
  for (let j = 1; j < levels.length; j++)
    for (let i = 0; i < n; i++) {
      const a = (-i / n) * Math.PI * 2,
        b = (-(i + 1) / n) * Math.PI * 2,
        y0 = levels[j - 1],
        y1 = levels[j],
        seam = (i + Math.round(n / 24)) % (n / 3) < n / 12,
        p = [point(a, y0), point(b, y0), point(b, y1), point(a, y1)],
        color = seam ? [0.12, 0.2, 0.27] : [0.25, 0.38, 0.48];
      if (tier === 3) panel(out, p, color, 0.043, [0.53, 0.59, 0.61]);
      else face(out, 'glass', p, color);
    }
  cap(
    out,
    'metal',
    Array.from({ length: n }, (_, i) => point((-i / n) * Math.PI * 2, height)),
    [0.74, 0.77, 0.77],
  );
  // Project strips onto the actual faceted glass skin; straight beams can cut through it.
  const skin = (angle, y) => {
    const u = ((((-angle / (Math.PI * 2)) * n) % n) + n) % n,
      i = Math.floor(u),
      a = u - i,
      j = Math.max(
        1,
        levels.findIndex((v) => v >= y),
      ),
      b = (y - levels[j - 1]) / (levels[j] - levels[j - 1]),
      p = point((-i / n) * Math.PI * 2, levels[j - 1]),
      q = point((-(i + 1) / n) * Math.PI * 2, levels[j - 1]),
      r = point((-(i + 1) / n) * Math.PI * 2, levels[j]),
      t = point((-i / n) * Math.PI * 2, levels[j]);
    const result = p.map((v, k) =>
        b <= a ? v * (1 - a) + q[k] * (a - b) + r[k] * b : v * (1 - b) + r[k] * a + t[k] * (b - a),
      ),
      d = Math.hypot(result[0], result[2]);
    return [result[0] + (result[0] / d) * 0.08, y, result[2] + (result[2] / d) * 0.08];
  };
  const strand = (phase, width, limit) => {
    const pitch = [8, 4, 5, 3.8][tier],
      ys = [
        1,
        limit,
        ...levels.filter((y) => y > 1 && y < limit),
        ...Array.from({ length: Math.floor((limit - 1) / pitch) }, (_, i) => 1 + (i + 1) * pitch),
      ]
        .sort((a, b) => a - b)
        .filter((v, i, a) => i === 0 || v > a[i - 1]);
    for (let i = 1; i < ys.length; i++) {
      const a = ys[i - 1],
        b = ys[i],
        angle0 = phase(a),
        angle1 = phase(b),
        w0 = width / (2 * radius(a)),
        w1 = width / (2 * radius(b));
      face(
        out,
        'metal',
        [skin(angle0 + w0, a), skin(angle0 - w0, a), skin(angle1 - w1, b), skin(angle1 + w1, b)],
        white,
      );
    }
  };
  const strands = [0, 1, 4, 9][tier];
  for (let side = 0; side < 3; side++) {
    const center = (side * Math.PI * 2) / 3;
    for (const sign of [-1, 1])
      strand((y) => center + sign * 0.9 * Math.sin((Math.PI * (y + 9)) / 220), 0.53, 201);
    for (let index = 0; index < strands; index++)
      for (const sign of [-1, 1]) {
        const original = strands === 1 ? 6 : Math.round((index * 12) / (strands - 1));
        strand(
          (y) => center + sign * (0.22 + original * 0.112 + y * (0.024 + (original % 3) * 0.0035)),
          original % 4 === 0 ? 0.36 : 0.23,
          201.5,
        );
      }
    if (tier > 0) {
      const a = center,
        rr = 21.8,
        c = [Math.cos(a) * rr, 4, Math.sin(a) * rr * 0.94],
        across = [-Math.sin(a), 0, Math.cos(a)];
      for (let i = -2; i <= 2; i++) {
        const p = c.map((v, k) => v + across[k] * i * 1.25);
        beam(out, 'metal', [p[0], 0.4, p[2]], [p[0], 7, p[2]], 0.14, 0.2, metal);
      }
    }
  }
  if (tier > 1)
    for (let j = 3; j < levels.length - 2; j += 10) {
      const y = levels[j];
      for (let i = 0; i < n; i++)
        beam(
          out,
          'metal',
          point((-i / n) * Math.PI * 2, y, 0.09),
          point((-(i + 1) / n) * Math.PI * 2, y, 0.09),
          0.17,
          0.16,
          metal,
        );
    }
}
export const buildCocoonSkyline = (o) => build(o, 0),
  buildCocoonDistrict = (o) => build(o, 1),
  buildCocoonStreet = (o) => build(o, 2),
  buildCocoonCloseup = (o) => build(o, 3);
