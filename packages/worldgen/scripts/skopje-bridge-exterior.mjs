/** Individually reconstructed current exterior, using mapped piers and published field photographs. */
import { loft, normalFor } from './authored-structure-mesh.mjs';
import { skopjeResearch } from './stone-bridge-skopje-model.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const stone = [0.79, 0.765, 0.685],
  pale = [0.87, 0.85, 0.78],
  mortar = [0.57, 0.555, 0.5];
const half = 109.458947;
const mix = (a, b, t) => a + (b - a) * t;
const deck = (x) =>
  x < -59
    ? mix(7.7, 11.2, (x + half) / (half - 59))
    : x > 12
      ? mix(11.2, 7.7, (x - 12) / (half - 12))
      : 11.2;
// Main openings follow the five mapped river piers. Shore vaults are photo reconstructions;
// historical buried openings are deliberately not presented as a current measured inventory.
const arches = [
  { x: -96.7, span: 7.8, rise: 3.8, spring: 3.05 },
  { x: -83.5, span: 9.1, rise: 4.3, spring: 3.15 },
  { x: -70.2, span: 10.1, rise: 4.9, spring: 3.2 },
  { x: -51.65, span: 9.9, rise: 5.65, spring: 3.25 },
  { x: -35.4, span: 11.8, rise: 6.15, spring: 3.25 },
  { x: -17.35, span: 13.1, rise: 6.55, spring: 3.05 },
  { x: 1.34, span: 13.48, rise: 6.74, spring: 2.85 },
  { x: 21.6, span: 12.5, rise: 5.9, spring: 3.1, brick: true },
  { x: 38.9, span: 10.9, rise: 5.25, spring: 3.25, brick: true },
  { x: 54.4, span: 9.1, rise: 4.55, spring: 3.4, brick: true },
  { x: 68.1, span: 7.4, rise: 3.8, spring: 3.55, brick: true },
];
function solid(out, points, z0, z1, color, slot = 'stone') {
  let p = points.filter(
    (a, i) =>
      Math.hypot(
        a[0] - points[(i + points.length - 1) % points.length][0],
        a[1] - points[(i + points.length - 1) % points.length][1],
      ) > 1e-6,
  );
  if (p.length < 3) return;
  const area = p.reduce((sum, a, i) => {
    const b = p[(i + 1) % p.length];
    return sum + a[0] * b[1] - b[0] * a[1];
  }, 0);
  if (Math.abs(area) < 1e-7) return;
  if (area < 0) p = [...p].reverse();
  const a = p.map((v) => [...v, z0]),
    b = p.map((v) => [...v, z1]);
  out.addConvexPolygon(
    slot,
    'palette:#ffffff',
    [...a].reverse(),
    [0, 0, -1],
    (p) => [p[0], p[1]],
    color,
  );
  out.addConvexPolygon(slot, 'palette:#ffffff', b, [0, 0, 1], (p) => [p[0], p[1]], color);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length,
      ps = [a[i], a[j], b[j], b[i]];
    quad(out, slot, ps, normalFor(...ps), color);
  }
}
const wedge = (out, x0, x1, y0, y1, top0, top1, z0, z1, color, slot) =>
  solid(
    out,
    [
      [x0, y0],
      [x1, y1],
      [x1, top1],
      [x0, top0],
    ],
    z0,
    z1,
    color,
    slot,
  );
function clip(poly, y, above) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      ia = above ? a[1] >= y : a[1] <= y,
      ib = above ? b[1] >= y : b[1] <= y;
    if (ia) result.push(a);
    if (ia !== ib) result.push([mix(a[0], b[0], (y - a[1]) / (b[1] - a[1])), y]);
  }
  return result;
}
function archPoint(a, t, outer = 0) {
  const angle = Math.PI * t;
  return [
    a.x - (a.span / 2 + outer) * Math.cos(angle),
    a.spring + (a.rise + outer) * Math.sin(angle),
  ];
}
function lower(x) {
  for (const a of arches) {
    const r = a.span / 2 + 0.62,
      dx = x - a.x;
    if (Math.abs(dx) <= r)
      return a.spring + (a.rise + 0.62) * Math.sqrt(Math.max(0, 1 - (dx / r) ** 2));
  }
  return 0;
}
function pier(out, plan, height, cap = 'flat') {
  const area = plan.reduce((sum, p, i) => {
    const q = plan[(i + 1) % plan.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  if (area > 0) plan = [...plan].reverse();
  const cx = plan.reduce((s, p) => s + p[0], 0) / plan.length,
    cz = plan.reduce((s, p) => s + p[1], 0) / plan.length;
  const ring = (y, scale = 1) =>
    plan.map(([x, z]) => [cx + (x - cx) * scale, y, cz + (z - cz) * scale]);
  // Foundation steps and low-walled restored tops follow each individual asymmetric footprint.
  loft(out, 'roughstone', [ring(0, 1.1), ring(0.85, 1.1), ring(1.12, 1.025)], mortar);
  loft(out, 'stone', [ring(1.12), ring(height)], stone);
  for (let y = 1.12; y < height - 0.1; y += 0.43)
    for (let i = 0; i < plan.length; i++) {
      const a = plan[i],
        b = plan[(i + 1) % plan.length],
        count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.8);
      for (let j = 0; j < count; j++) {
        const t0 = (j + 0.012) / count,
          t1 = (j + 0.988) / count;
        const p = [
          [mix(a[0], b[0], t0), y + 0.005, mix(a[1], b[1], t0)],
          [mix(a[0], b[0], t1), y + 0.005, mix(a[1], b[1], t1)],
          [mix(a[0], b[0], t1), Math.min(height, y + 0.42), mix(a[1], b[1], t1)],
          [mix(a[0], b[0], t0), Math.min(height, y + 0.42), mix(a[1], b[1], t0)],
        ];
        // Offset individual ashlar faces outside the continuous core.
        const n = normalFor(...p);
        for (const v of p) {
          v[0] += n[0] * 0.012;
          v[2] += n[2] * 0.012;
        }
        quad(
          out,
          'stone',
          p,
          n,
          stone.map((v) => v + (((j * 5 + i * 7 + Math.round(y * 10)) % 9) - 4) * 0.009),
        );
      }
    }
  if (cap === 'pyramid') loft(out, 'stone', [ring(height, 1.025), ring(height + 2.3, 0.14)], pale);
  else if (cap === 'well') {
    loft(out, 'stone', [ring(height - 0.02, 0.81), ring(height + 0.65, 0.81)], mortar);
    for (let i = 0; i < plan.length; i++) {
      const j = (i + 1) % plan.length;
      const a = ring(height)[i],
        b = ring(height)[j],
        c = ring(height + 0.75)[j],
        d = ring(height + 0.75)[i];
      quad(out, 'stone', [a, b, c, d], normalFor(a, b, c), pale);
      const A = ring(height + 0.75, 0.8)[i],
        B = ring(height + 0.75, 0.8)[j];
      quad(out, 'stone', [d, c, B, A], [0, 1, 0], pale);
    }
  }
}
function niche(out) {
  const x = 8.2,
    y = deck(x),
    z0 = 3.13;
  box(out, 'stone', [4.98, 0.8, z0], [11.42, y + 0.06, 4.99], stone);
  for (let yy = 1.2; yy < y; yy += 0.43)
    for (let xx = 4.99; xx < 11.41; xx += 0.82)
      box(
        out,
        'stone',
        [xx + 0.008, yy, 4.985],
        [Math.min(11.41, xx + 0.81), yy + 0.415, 5.04],
        stone.map((v) => v + ((Math.round(xx * 10 + yy * 3) % 7) - 3) * 0.008),
      );
  // Walk-facing recessed mihrab, enclosed back, paired pilasters and tiered muqarnas hood.
  box(out, 'stone', [x - 1.35, y, 4.27], [x + 1.35, y + 4.3, 4.86], stone);
  for (const side of [-1, 1])
    box(out, 'stone', [x + side * 1.06 - 0.3, y, z0], [x + side * 1.06 + 0.3, y + 3.55, 4.3], pale);
  for (let i = 0; i < 7; i++) {
    const a = (Math.PI * i) / 7,
      b = (Math.PI * (i + 1)) / 7;
    const p = [
      [x + 0.78 * Math.cos(a), y, 3.38 + 0.87 * Math.sin(a)],
      [x + 0.78 * Math.cos(b), y, 3.38 + 0.87 * Math.sin(b)],
      [x + 0.78 * Math.cos(b), y + 2.1, 3.38 + 0.87 * Math.sin(b)],
      [x + 0.78 * Math.cos(a), y + 2.1, 3.38 + 0.87 * Math.sin(a)],
    ];
    quad(out, 'stone', p, normalFor(...p), pale);
  }
  for (let tier = 0; tier < 5; tier++) {
    const r = 0.8 * (1 - tier / 6);
    for (let j = 0; j < 7 - tier; j++) {
      const t = (Math.PI * (j + 0.5)) / (7 - tier);
      const cx = x + r * Math.cos(t),
        cz = 3.4 + r * Math.sin(t);
      const ring = (h, radius) =>
        Array.from({ length: 6 }, (_, k) => {
          const angle = (-2 * Math.PI * k) / 6;
          return [cx + radius * Math.cos(angle), h, cz + radius * Math.sin(angle)];
        });
      loft(
        out,
        'stone',
        [ring(y + 2.04 + tier * 0.25, 0.025), ring(y + 2.31 + tier * 0.25, 0.19)],
        pale,
      );
    }
    // Continuous faceted backing joins the carved stalactites into the niche hood.
    const lowerR = 0.82 * (1 - tier / 6),
      upperR = 0.82 * (1 - (tier + 1) / 6);
    for (let j = 0; j < 14; j++) {
      const a = (Math.PI * j) / 14,
        b = (Math.PI * (j + 1)) / 14;
      const points = [
        [x + lowerR * Math.cos(a), y + 2.1 + tier * 0.25, 3.4 + lowerR * Math.sin(a)],
        [x + lowerR * Math.cos(b), y + 2.1 + tier * 0.25, 3.4 + lowerR * Math.sin(b)],
        [x + upperR * Math.cos(b), y + 2.35 + tier * 0.25, 3.4 + upperR * Math.sin(b)],
        [x + upperR * Math.cos(a), y + 2.35 + tier * 0.25, 3.4 + upperR * Math.sin(a)],
      ];
      quad(out, 'stone', points, normalFor(...points), pale);
    }
  }
  box(out, 'stone', [x - 0.77, y + 2.98, z0], [x + 0.77, y + 3.55, 4.3], pale);
  box(out, 'stone', [x - 1.45, y + 3.55, z0 - 0.12], [x + 1.45, y + 3.83, 4.98], pale);
  box(out, 'stone', [x - 1.27, y + 3.83, z0], [x + 1.27, y + 4.4, 4.86], stone);
  loft(
    out,
    'stone',
    [
      [
        [x - 1.48, y + 4.4, z0 - 0.12],
        [x - 1.48, y + 4.4, 4.99],
        [x + 1.48, y + 4.4, 4.99],
        [x + 1.48, y + 4.4, z0 - 0.12],
      ],
      [
        [x - 0.02, y + 5.35, 4.02],
        [x - 0.02, y + 5.35, 4.06],
        [x + 0.02, y + 5.35, 4.06],
        [x + 0.02, y + 5.35, 4.02],
      ],
    ],
    pale,
  );
  box(
    out,
    'iron',
    [x - 0.62, y + 3.01, z0 - 0.015],
    [x + 0.62, y + 3.39, z0 + 0.014],
    [0.22, 0.24, 0.22],
  );
  // Opposite balcony is carried by five corbels, without a mirrored downstream cutwater.
  box(out, 'stone', [8.995, y - 0.32, -5.44], [14.043, y, -3.03], pale);
  for (let i = 0; i < 5; i++)
    solid(
      out,
      [
        [9.1 + i * 0.98, y - 0.33],
        [9.75 + i * 0.98, y - 0.33],
        [9.63 + i * 0.98, y - 1.45],
        [9.27 + i * 0.98, y - 1.45],
      ],
      -4.63,
      -3.05,
      stone,
    );
  for (const [a, b, c, d] of [
    [8.995, 9.3, -5.44, -3.12],
    [13.74, 14.043, -5.44, -3.12],
    [9.3, 13.74, -5.44, -5.1],
  ])
    box(out, 'stone', [a, y, c], [b, y + 0.91, d], pale);
}
export function buildSkopjeBridge(out) {
  for (const a of arches) {
    const courses = a.brick ? 136 : Math.ceil(a.span * 5.3),
      tint = a.brick ? [0.66, 0.4, 0.27] : stone;
    // Separate radial blocks and continuous recessed core keep the vault watertight.
    for (let i = 0; i < courses; i++)
      for (let k = 0; k < 3; k++) {
        const t0 = (i + k / 3) / courses,
          t1 = (i + (k + 1) / 3) / courses;
        solid(
          out,
          [
            archPoint(a, t0, 0.014),
            archPoint(a, t1, 0.014),
            archPoint(a, t1, 0.61),
            archPoint(a, t0, 0.61),
          ],
          -3.14,
          3.14,
          mortar,
          a.brick ? 'brick' : 'stone',
        );
        for (let lane = 0; lane < 8; lane++) {
          const s0 = (i + 0.015 + (k * 0.97) / 3) / courses,
            s1 = (i + 0.015 + ((k + 1) * 0.97) / 3) / courses;
          solid(
            out,
            [archPoint(a, s0), archPoint(a, s1), archPoint(a, s1, 0.62), archPoint(a, s0, 0.62)],
            -3.2 + lane * 0.8 + 0.006,
            -3.2 + (lane + 1) * 0.8 - 0.006,
            tint.map((v) => v + (((i * 7 + lane * 3) % 11) - 5) * 0.006),
            a.brick ? 'brick' : 'stone',
          );
        }
      }
    // Jambs keep their full stone base below the spring line.
    for (const side of [-1, 1])
      box(
        out,
        'stone',
        [a.x + (side * a.span) / 2 - (side < 0 ? 0.62 : 0), 0, -3.165],
        [a.x + (side * a.span) / 2 + (side > 0 ? 0.62 : 0), a.spring, 3.165],
        stone,
      );
  }
  // Segment at every opening edge so the solid fill cannot bridge an open vault.
  const stations = [
    ...new Set([
      -half,
      half,
      ...arches.flatMap((a) => [a.x - a.span / 2 - 0.62, a.x + a.span / 2 + 0.62]),
      ...Array.from({ length: Math.ceil((half * 2) / 0.25) }, (_, i) => -half + i * 0.25),
    ]),
  ]
    .filter((x) => x >= -half && x <= half)
    .sort((a, b) => a - b);
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i],
      b = stations[i + 1],
      mid = (a + b) / 2,
      active = arches.find((r) => Math.abs(mid - r.x) < r.span / 2 + 0.62);
    const lo = (x) =>
      active
        ? active.spring +
          (active.rise + 0.62) *
            Math.sqrt(Math.max(0, 1 - ((x - active.x) / (active.span / 2 + 0.62)) ** 2))
        : 0;
    wedge(out, a, b, lo(a), lo(b), deck(a) - 0.11, deck(b) - 0.11, -3.09, 3.09, mortar);
  }
  for (const side of [-1, 1])
    for (let row = 0; row < 27; row++)
      for (let x = -half - 0.9 + (row % 2) * 0.4; x < half; x += 0.81) {
        const a = Math.max(-half, x + 0.006),
          b = Math.min(half, x + 0.801);
        if (b <= a) continue;
        let poly = [
          [a, lower(a)],
          [b, lower(b)],
          [b, deck(b) - 0.12],
          [a, deck(a) - 0.12],
        ];
        poly = clip(clip(poly, row * 0.43 + 0.006, true), row * 0.43 + 0.421, false);
        solid(
          out,
          poly,
          side < 0 ? -3.19 : 3.07,
          side < 0 ? -3.07 : 3.19,
          stone.map((v) => v + (((row * 7 + Math.round(x * 9) + 3000) % 13) - 6) * 0.004),
        );
      }
  // Continuous cornices, two-course dressed parapets, individual coping slabs and paving.
  for (let x = -half; x < half; x += 0.8) {
    const end = Math.min(half, x + 0.8);
    for (const side of [-1, 1]) {
      wedge(
        out,
        x,
        end,
        deck(x) - 0.38,
        deck(end) - 0.38,
        deck(x) - 0.19,
        deck(end) - 0.19,
        side < 0 ? -3.39 : 3.07,
        side < 0 ? -3.07 : 3.39,
        pale,
      );
      if ((side > 0 && x > 4.8 && x < 11.6) || (side < 0 && x > 8.7 && x < 14.2)) continue;
      for (let row = 0; row < 2; row++)
        wedge(
          out,
          x + 0.006,
          Math.min(end, x + 0.794),
          deck(x) + row * 0.43,
          deck(end) + row * 0.43,
          deck(x) + (row + 1) * 0.43 - 0.012,
          deck(end) + (row + 1) * 0.43 - 0.012,
          side < 0 ? -3.15 : 2.78,
          side < 0 ? -2.78 : 3.15,
          pale,
        );
      wedge(
        out,
        x + 0.004,
        end - 0.004,
        deck(x) + 0.86,
        deck(end) + 0.86,
        deck(x) + 1.02,
        deck(end) + 1.02,
        side < 0 ? -3.22 : 2.72,
        side < 0 ? -2.72 : 3.22,
        pale,
      );
    }
    for (let lane = 0; lane < 7; lane++)
      wedge(
        out,
        x + 0.005,
        end - 0.005,
        deck(x) - 0.1,
        deck(end) - 0.1,
        deck(x),
        deck(end),
        -2.77 + lane * 0.79 + 0.004,
        -2.77 + (lane + 1) * 0.79 - 0.004,
        pale.map((v) => v - 0.04 + ((lane * 3 + Math.round(x * 7) + 2000) % 7) * 0.005),
        'paving',
      );
  }
  // Distinct plans from the OSM outline; the documented restored tops are not mirrored.
  for (const p of [
    [
      [-48.84, -3.06],
      [-48.8, -7.45],
      [-44.29, -11.88],
      [-39.82, -7.34],
      [-39.72, -2.95],
    ],
    [
      [-30.66, -3.14],
      [-30.76, -7.83],
      [-26.87, -11.88],
      [-22.84, -8.01],
      [-22.77, -3.08],
    ],
    [
      [-11.97, -3.21],
      [-12.03, -7.32],
      [-8.34, -11.14],
      [-4.44, -7.38],
      [-4.43, -3.07],
    ],
  ])
    pier(out, p, 4.8, 'pyramid');
  pier(
    out,
    [
      [-47.69, 2.73],
      [-47.74, 7.44],
      [-43.12, 11.88],
      [-38.68, 7.27],
      [-38.65, 2.88],
    ],
    2.55,
    'well',
  );
  pier(
    out,
    [
      [-30.15, 2.93],
      [-30.18, 7.06],
      [-21.45, 7.02],
      [-21.41, 3.15],
    ],
    2.6,
    'flat',
  );
  pier(
    out,
    [
      [-11.93, 3.24],
      [-11.97, 6.98],
      [-7.69, 10.88],
      [-4.12, 6.97],
      [-4.14, 3.26],
    ],
    2.55,
    'well',
  );
  pier(
    out,
    [
      [-61.12, 2.47],
      [-61.14, 4.81],
      [-56.69, 4.85],
      [-56.67, 2.66],
    ],
    6.3,
    'pyramid',
  );
  pier(
    out,
    [
      [-61.9, -3.36],
      [-61.89, -5.1],
      [-55.78, -5.04],
      [-55.79, -3.11],
    ],
    6.1,
    'flat',
  );
  niche(out);
  for (const x of [-51.65, -35.4, -17.35, 1.34])
    for (const side of [-1, 1]) {
      const y = 10.62,
        z = side * 3.22;
      tube(out, 'stone', [x, y, z], [x, y, z + side * 0.065], 0.18, pale, 24);
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        tube(
          out,
          'stone',
          [x + Math.cos(a) * 0.095, y + Math.sin(a) * 0.095, z + side * 0.07],
          [x + Math.cos(a) * 0.095, y + Math.sin(a) * 0.095, z + side * 0.1],
          0.044,
          stone,
          8,
        );
      }
    }
}
export const skopjeStudy = {
  id: 'N0004',
  key: 'stone_bridge_in_skopje',
  title: 'Stone Bridge in Skopje',
  wikidataId: 'Q1780883',
  build: buildSkopjeBridge,
  surfaceOverrides: { stone: 'travertine', paving: 'travertine', roughstone: 'travertine' },
  brief:
    'Detailed travertine crossing with four unequal river vaults, separately jointed brick approach vaults, mapped asymmetric cutwaters, stepped foundations, dressed parapets, rosettes, prayer niche with muqarnas and opposite corbelled balcony.',
  refs: [
    ...skopjeResearch.sources.map((s) => s.url),
    'https://openjicareport.jica.go.jp/pdf/11945227_01.pdf',
    'https://www.openstreetmap.org/way/734159692',
  ],
  sourceFacts: {
    historicalLengthMeters: 213.85,
    historicalDeckWidthMeters: 6.33,
    largestPublishedOpeningMeters: 13.48,
    centralRiverArches: 4,
    northeastBrickArches: 4,
    historicalArchCounts: [13, 14, 15],
    riverBottomReferenceMetersASL: 241.5,
    riverBottomSource:
      'JICA June2009 Appendix1 PartI Table2.1 N5; bottom level, not water surface or bridge deck.',
  },
  reconstruction: {
    arches,
    mappedLengthMeters: 218.917894,
    riverDeckAboveBottomMeters: 11.2,
    shoreDeckAboveBottomMeters: 7.7,
    riverPierStationsMeters: [-59, -44, -26.7, -8.1, 10.9],
    note: 'Four mapped river bays and eleven exposed vaults represented; shore spans and all vertical bridge dimensions are photo-scaled reconstruction. Conflicting historical counts include buried/altered ends and are not asserted as a current measured inventory.',
  },
  nativeAxes: {
    x: 'northeast along mapped crossing',
    y: 'up; zero is JICA2009 channel-bottom reference241.5m ASL',
    z: 'southeast, downstream',
  },
  geographic: () => ({
    anchor: [21.433244271, 41.9971125],
    heading: 0.7410149177885357,
    elevationMode: 'sea-level',
    elevationMeters: 241.5,
    featureIds: ['way/734159692'],
    source: 'https://www.openstreetmap.org/way/734159692',
    notes:
      'Exact-QID current outline anchors pier projections and directed northeast axis; reported channel-bottom datum241.5m is not a current bridge survey. Vertical bridge proportions reconstructed from field photographs.',
  }),
  limitations: [
    'Exterior reconstruction with metric masonry detail; heights, shore vault stations, mihrab decoration and individual block layout are reconstructed from published field photographs, not survey ordinates.',
    'Historical sources disagree on total arch counts and describe buried end spans. Eleven exposed/reconstructed vaults are modeled; the buried ends use closed approach masonry.',
    'Absolute datum follows a2009 river study. Host terrain, present channel bed and river stage can differ; shoreline and nearby statues are separate features.',
  ],
  camera: { position: [-106, 69, 150], lookAt: [-13, 6, 0], fov: 42 },
  qaCameras: [
    { name: 'downstream', position: [-23, 21, 115], lookAt: [-23, 6, 0], fov: 47 },
    { name: 'upstream', position: [-23, 25, -115], lookAt: [-23, 6, 0], fov: 47 },
    { name: 'mihrab', position: [3.4, 15.4, -6.2], lookAt: [8.2, 13.2, 3.8], fov: 45 },
    { name: 'brick-approach', position: [47, 18, 35], lookAt: [43, 6, 0], fov: 51 },
    { name: 'river-vault', position: [-17, 3.3, 17], lookAt: [-17, 7, 0], fov: 58 },
    { name: 'walkway', position: [-23, 13.1, 0.1], lookAt: [12, 12.6, 0], fov: 58 },
  ],
};
