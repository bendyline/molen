/** Curved Gherkin skin with six dark spiral bands and tiered exterior diagrid. */
import './install-deterministic-math.mjs';
import { beam, cross, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { cap, face, shift } from './signature-tower-expansion-models.mjs';
import { tube } from './structure-mesh.mjs';

const MEANS = {
    stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    glass: [1, 1, 1],
  },
  metal = [0.5, 0.57, 0.6];
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

function gherkinRadius(y) {
  const samples = [
    [0, 22.5],
    [8, 24.2],
    [35, 27.3],
    [67, 28.3],
    [90, 27.7],
    [115, 24.7],
    [138, 19.3],
    [157, 12.6],
    [169, 7.1],
    [176, 3.65],
    [179, 1.5],
    [180, 0.18],
  ];
  let j = 1;
  while (j < samples.length - 1 && y > samples[j][0]) j++;
  const [a, b] = [samples[j - 1], samples[j]];
  const t = (y - a[0]) / (b[0] - a[0]);
  return a[1] + (b[1] - a[1]) * t;
}

function build(target, tier) {
  const out = writer(target, tier === 0),
    n = [24, 30, 36, 72][tier];
  const full = [
      0.25,
      8,
      ...Array.from({ length: 38 }, (_, i) => 12 + i * 4.2),
      172,
      176,
      178.2,
      179.3,
      180,
    ],
    levels =
      tier === 0
        ? [0.25, 8, 20, 35, 50, 67, 90, 115, 138, 157, 169, 176, 179, 180]
        : tier === 1
          ? [0.25, 8, ...Array.from({ length: 20 }, (_, i) => 12 + i * 8.4), 176, 180].filter(
              (v, i, a) => !i || v > a[i - 1],
            )
          : full;
  const p = (y, i) => {
    const a = (-i * Math.PI * 2) / n + ((y / 4.2) * Math.PI * 2) / 72;
    return [gherkinRadius(y) * Math.cos(a), y, gherkinRadius(y) * Math.sin(a)];
  };
  const strip = (a, b, width) => {
    const d = b.map((v, i) => v - a[i]),
      r = [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2],
      v = cross(r, d),
      l = Math.hypot(...v),
      t = v.map((x) => x / Math.max(0.01, l));
    face(
      out,
      'metal',
      [
        shift(a, t, -width / 2),
        shift(b, t, -width / 2),
        shift(b, t, width / 2),
        shift(a, t, width / 2),
      ],
      metal,
    );
  };
  for (let j = 1; j < levels.length; j++)
    for (let i = 0; i < n; i++) {
      const y0 = levels[j - 1],
        y1 = levels[j],
        a = p(y0, i),
        b = p(y0, i + 1),
        c = p(y1, i + 1),
        d = p(y1, i),
        phase = ((i * 72) / n + 720) % 12,
        tint = phase < 2 ? [0.075, 0.14, 0.18] : [0.27, 0.38, 0.43];
      face(out, 'glass', [a, b, c, d], tint);
      if (tier > 0) {
        const normal = normalFor(a, b, c),
          aa = shift(a, normal, 0.035),
          bb = shift(b, normal, 0.035),
          cc = shift(c, normal, 0.035),
          _dd = shift(d, normal, 0.035);
        strip(aa, cc, [0, 0.12, 0.09, 0.07][tier]);
        if (tier > 1) {
          strip(aa, bb, 0.08);
          if (tier === 3) strip(bb, cc, 0.07);
        }
      }
    }
  if (tier > 1)
    for (let start = 0; start < 24; start++)
      for (const sign of [-1, 1])
        for (let y = 8; y < 172; y += 4.2) {
          const y1 = Math.min(y + 4.2, 172),
            a0 = (start * n) / 24 + (((sign * (y - 8)) / 8.4) * n) / 72,
            a1 = (start * n) / 24 + (((sign * (y1 - 8)) / 8.4) * n) / 72,
            a = p(y, a0),
            b = p(y1, a1);
          if (tier === 3)
            beam(
              out,
              'metal',
              shift(a, [a[0] / gherkinRadius(y), 0, a[2] / gherkinRadius(y)], 0.14),
              shift(b, [b[0] / gherkinRadius(y1), 0, b[2] / gherkinRadius(y1)], 0.14),
              0.17,
              0.18,
              metal,
            );
          else strip(a, b, 0.14);
        }
  if (tier > 0)
    for (let i = 0; i < 24; i++)
      for (const sign of [-1, 1])
        tube(
          out,
          'metal',
          p(0.2, (i * n) / 24),
          p(8, (i * n) / 24 + (sign * n) / 48),
          0.48,
          [0.8, 0.82, 0.81],
          tier === 1 ? 4 : tier === 2 ? 6 : 10,
        );
  loft(
    out,
    'stone',
    [radialRing(0, 23, 23, tier === 0 ? 12 : 24), radialRing(0.25, 23, 23, tier === 0 ? 12 : 24)],
    [0.54, 0.54, 0.5],
  );
  cap(out, 'glass', radialRing(180, 0.18, 0.18, n), [0.23, 0.35, 0.41]);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3,
      c = [22.7 * Math.cos(a), 0, 22.7 * Math.sin(a)];
    tube(
      out,
      'glass',
      [c[0], 0.25, c[2]],
      [c[0], 3.6, c[2]],
      1.65,
      [0.3, 0.4, 0.43],
      tier === 0 ? 4 : tier === 1 ? 6 : tier === 2 ? 12 : 20,
    );
  }
}
export const buildGherkinSkyline = (o) => build(o, 0),
  buildGherkinDistrict = (o) => build(o, 1),
  buildGherkinStreet = (o) => build(o, 2),
  buildGherkinCloseup = (o) => build(o, 3);
