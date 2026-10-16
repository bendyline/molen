/** SWFC compact derivatives retain the curved square and genuinely open crown portal. */
import './install-deterministic-math.mjs';
import { beam, cross, loft, normalFor } from './authored-structure-mesh.mjs';
import { quad } from './structure-mesh.mjs';

const aluminum = [0.69, 0.73, 0.75],
  concrete = [0.76, 0.75, 0.71],
  ref = 'palette:#ffffff',
  MEANS = {
    foundation: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    glass: [1, 1, 1],
  };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  move = (p, n, d) => p.map((v, i) => v + n[i] * d);
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
    addTriangle(s, _r, p, _n, _u, c) {
      tri(s, p, c);
    },
    addQuad(s, _r, p, _n, _u, c) {
      tri(s, p.slice(0, 3), c);
      tri(s, [p[0], p[2], p[3]], c);
    },
    addConvexPolygon(s, _r, p, _n, _u, c) {
      for (let i = 1; i < p.length - 1; i++) tri(s, [p[0], p[i], p[i + 1]], c);
    },
  };
}

function polygon(out, slot, p, color) {
  out.addConvexPolygon(slot, ref, p, normalFor(...p.slice(0, 3)), null, color);
}
function panels(tier, out, a, b, c, d, color) {
  const n = normalFor(a, b, c),
    count = Math.max(
      1,
      Math.ceil(
        Math.max(
          Math.hypot(...b.map((v, i) => v - a[i])),
          Math.hypot(...c.map((v, i) => v - d[i])),
        ) / [100, 16, 4.8, 2.4][tier],
      ),
    );
  quad(out, 'glass', [a, b, c, d], n, color);
  if (tier === 0) return;
  const strip = (p) =>
    quad(
      out,
      'metal',
      p.map((v) => move(v, n, 0.055)),
      n,
      aluminum,
    );
  for (let i = 1; i < count; i++) {
    const u = i / count,
      e = Math.min(0.2, 0.1 / Math.max(1, Math.hypot(...b.map((v, j) => v - a[j]))));
    strip([mix(a, b, u - e), mix(a, b, u + e), mix(d, c, u + e), mix(d, c, u - e)]);
  }
  const t = Math.min(0.15, 0.1 / Math.max(0.1, Math.hypot(...d.map((v, i) => v - a[i]))));
  strip([a, b, mix(b, c, t), mix(a, d, t)]);
  strip([mix(a, d, 1 - t), mix(b, c, 1 - t), c, d]);
}
const swfcDiagonal = 58 / Math.sqrt(2);
function swfcRing(y) {
  const z = Math.max(0.32, swfcDiagonal * (1 - Math.pow(y / 492, 1.66)));
  const x = swfcDiagonal - z;
  return [
    [-x, y, -z],
    [-swfcDiagonal, y, 0],
    [-x, y, z],
    [x, y, z],
    [swfcDiagonal, y, 0],
    [x, y, -z],
  ];
}
const aperture = (y) => 20 + ((y - 439) * 5) / 35;

function build(target, tier) {
  const out = writer(target, tier === 0);
  const facade = (...args) => panels(tier, ...args);
  const base = swfcRing(0.35);
  loft(out, 'foundation', [base.map(([x, _y, z]) => [x, 0, z]), base], concrete);
  const yLevels = [
    ...new Set([
      0.35,
      8,
      ...Array.from(
        { length: Math.ceil(102 / [8, 4, 2, 1][tier]) },
        (_, i) => 8 + i * 4.17 * [8, 4, 2, 1][tier],
      ).filter((y) => y < 423),
      423,
      427,
      431,
      435,
      439,
      443,
      447,
      451,
      455,
      459,
      463,
      467,
      471,
      474,
      478,
      482,
      486,
      490,
      492,
    ]),
  ].sort((a, b) => a - b);
  // The physical 58 m square has a diagonal aligned with native X; tiny clipping at ground
  // prevents coincident hexagon corners at the mathematical square-to-hexagon transition.
  for (let j = 1; j < yLevels.length; j++) {
    const y0 = yLevels[j - 1],
      y1 = yLevels[j];
    const lower = swfcRing(y0),
      upper = swfcRing(y1);
    for (let f = 0; f < 6; f++) {
      const k = (f + 1) % 6;
      if ((f === 2 || f === 5) && y0 >= 439 && y1 <= 474) {
        // Both broad faces are actually open; side reveals connect them through the tower.
        const direction = f === 2 ? 1 : -1;
        const inner0 = [direction * -aperture(y0), y0, lower[f][2]];
        const inner1 = [direction * -aperture(y1), y1, upper[f][2]];
        const other0 = [-inner0[0], y0, lower[f][2]];
        const other1 = [-inner1[0], y1, upper[f][2]];
        facade(out, lower[f], inner0, inner1, upper[f], [0.21, 0.34, 0.43]);
        facade(out, other0, lower[k], upper[k], other1, [0.21, 0.34, 0.43]);
      } else if (Math.hypot(...lower[f].map((n, i) => n - lower[k][i])) > 0.07) {
        facade(out, lower[f], lower[k], upper[k], upper[f], [0.22, 0.355, 0.455]);
      }
    }
    for (const f of [1, 4])
      if (tier > 0) beam(out, 'metal', lower[f], upper[f], 0.22, 0.24, [0.56, 0.62, 0.65]);
  }
  polygon(out, 'metal', swfcRing(492), aluminum);
  polygon(out, 'foundation', swfcRing(0.35).toReversed(), concrete);
  // The two vertical reveals lean apart toward the upper bridge.
  for (const sign of [-1, 1]) {
    for (let y = 439; y < 474; y += 5) {
      const y1 = Math.min(y + 5, 474),
        z0 = swfcRing(y)[2][2],
        z1 = swfcRing(y1)[2][2];
      let p = [
        [sign * aperture(y), y, -z0],
        [sign * aperture(y), y, z0],
        [sign * aperture(y1), y1, z1],
        [sign * aperture(y1), y1, -z1],
      ];
      if (sign < 0) p = p.toReversed();
      facade(out, ...p, [0.25, 0.31, 0.34], { module: 1.6 });
    }
  }
  for (const y of [439, 474]) {
    const z = swfcRing(y)[2][2],
      x = aperture(y);
    const p = [
      [-x, y, -z],
      [-x, y, z],
      [x, y, z],
      [x, y, -z],
    ];
    polygon(
      out,
      y === 439 ? 'glass' : 'metal',
      y === 439 ? p : p.toReversed(),
      y === 439 ? [0.31, 0.43, 0.46] : aluminum,
    );
    // Roof/floor support members and the narrow glass walkway panels remain inside the opening.
    for (let u = -x; u <= x; u += [30, 12, 4, 1.8][tier])
      beam(
        out,
        'metal',
        [u, y + (y === 439 ? 0.055 : -0.055), -z],
        [u, y + (y === 439 ? 0.055 : -0.055), z],
        0.09,
        0.13,
        aluminum,
      );
  }
  // Transparent lobby bays and canopy are within the tower plan, not a guessed whole block.
  for (const s of [-1, 1]) {
    const a = [s * 6, 0.4, s * 34.8],
      b = [s * 15, 0.4, s * 25.8];
    beam(out, 'metal', [a[0], 5.8, a[2]], [b[0], 5.8, b[2]], 3.0, 0.18, aluminum);
    for (let i = 0; i <= [1, 2, 4, 6][tier]; i++) {
      const p = mix(a, b, i / [1, 2, 4, 6][tier]);
      beam(out, 'metal', p, [p[0], 5.7, p[2]], 0.13, 0.13, aluminum);
    }
  }
}

export const buildSwfcSkyline = (o) => build(o, 0),
  buildSwfcDistrict = (o) => build(o, 1),
  buildSwfcStreet = (o) => build(o, 2),
  buildSwfcCloseup = (o) => build(o, 3);
