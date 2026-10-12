/** Compact Yi Sun-sin suspension crossing. Source master remains independently reproducible. */
import './install-deterministic-math.mjs';
import {
  beam,
  chamferedRectangle,
  cross,
  loft,
  normalFor,
  radialRing,
} from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
const MEANS = {
  concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
  steel: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
  iron: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  road: [1, 1, 1],
  marking: [1, 1, 1],
};
const concrete = [0.76, 0.754, 0.706],
  steel = [0.69, 0.74, 0.727],
  dark = [0.25, 0.29, 0.28],
  SPAN = 772.5,
  DECK = 1130,
  CABLE = 1272.5,
  Z = 14.55;
const deckY = (x) => 88.05 - 25 * (x / DECK) ** 2,
  cableY = (x) =>
    Math.abs(x) <= SPAN
      ? 270.1 - (1545 / 9) * (1 - (x / SPAN) ** 2)
      : 270.1 * (1 - (Math.abs(x) - SPAN) / 500) +
        ((x < 0 ? 37 : 31) * (Math.abs(x) - SPAN)) / 500 -
        88 * ((Math.abs(x) - SPAN) / 500) * (1 - (Math.abs(x) - SPAN) / 500);
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
function ribbon(out, s, a, b, r, c) {
  const across = Math.abs(b[0] - a[0]) > 1e-6 ? [0, r, 0] : [r, 0, 0],
    p = [
      a.map((v, i) => v - across[i]),
      b.map((v, i) => v - across[i]),
      b.map((v, i) => v + across[i]),
      a.map((v, i) => v + across[i]),
    ];
  quad(out, s, p, normalFor(...p), c);
  quad(out, s, p.toReversed(), normalFor(...p.toReversed()), c);
}
function build(out, tier) {
  const w = writer(out, tier === 0),
    cfg = [
      { deck: 12, main: 18, back: 6, pitch: 126 },
      { deck: 36, main: 56, back: 18, pitch: 54 },
      { deck: 72, main: 112, back: 32, pitch: 36, sides: 4, rail: 72 },
      { deck: 192, main: 256, back: 64, pitch: 18, sides: 6, rail: 24 },
    ][tier];
  for (const x of [-SPAN, SPAN]) {
    if (tier === 0) box(w, 'concrete', [x - 15.5, 0, -37.5], [x + 15.5, 2.7, 37.5], concrete);
    else
      loft(
        w,
        'concrete',
        [radialRing(0, 15.5, 37.5, 8, [x, 0]), radialRing(2.7, 15.5, 37.5, 8, [x, 0])],
        concrete,
      );
    for (const sign of [-1, 1]) {
      const levels = [
          [2.7, 22.6, 17, 13.2],
          [7, 21.5, 14.5, 11.5],
          [16, 20.5, 12.6, 10],
          [78, 18.6, 11.3, 9.5],
          [164, 16.35, 9.4, 8.7],
          [255, 14.65, 7.9, 8],
          [268.8, 14.55, 7.4, 7.8],
        ],
        rings = levels.map(([y, z, wx, wz]) =>
          tier === 0
            ? [
                [x - wx / 2, y, sign * z - wz / 2],
                [x - wx / 2, y, sign * z + wz / 2],
                [x + wx / 2, y, sign * z + wz / 2],
                [x + wx / 2, y, sign * z - wz / 2],
              ]
            : chamferedRectangle(x, y, sign * z, wx, wz, 0.55),
        );
      loft(w, 'concrete', rings, concrete);
      if (tier > 0) {
        box(
          w,
          'concrete',
          [x - 3.7, 268.8, sign * Z - 3.9],
          [x + 3.7, 272.7, sign * Z + 3.9],
          concrete,
        );
        box(w, 'iron', [x - 3, 268.8, sign * Z - 1.1], [x + 3, 269.5, sign * Z + 1.1], dark);
      }
    }
    for (const [y, width, d] of [
      [164, 32.7, 8.8],
      [255, 29.3, 7.4],
    ])
      box(
        w,
        'concrete',
        [x - d / 2, y - 4.3, -width / 2],
        [x + d / 2, y + 4.3, width / 2],
        concrete,
      );
    if (tier > 0) {
      const n = tier === 1 ? 4 : 12;
      for (let i = 0; i < n; i++) {
        const z0 = -15.5 + (31 * i) / n,
          z1 = -15.5 + (31 * (i + 1)) / n,
          h = (z) => 8 + 6 * (1 - Math.sqrt(Math.max(0, 1 - (z / 15.5) ** 2)));
        loft(
          w,
          'concrete',
          [z0, z1].map((z) => [
            [x - 6.4, 2.7, z],
            [x - 6.4, h(z), z],
            [x + 6.4, h(z), z],
            [x + 6.4, 2.7, z],
          ]),
          concrete,
        );
      }
    }
  }
  if (tier === 0) {
    const rings = Array.from({ length: cfg.deck + 1 }, (_, i) => {
      const x = -DECK + (2 * DECK * i) / cfg.deck,
        y = deckY(x);
      return [
        [x, y, -14.55],
        [x, y, 14.55],
        [x, y - 3, 14.55],
        [x, y - 3, -14.55],
      ];
    });
    loft(w, 'steel', rings, steel);
  } else
    for (const sign of [-1, 1]) {
      const section = [
          [3, 0],
          [12.85, 0],
          [14.55, -1.1],
          [12.55, -3],
          [4.5, -3],
          [3, -1.5],
        ],
        rings = Array.from({ length: cfg.deck + 1 }, (_, i) => {
          const x = -DECK + (2 * DECK * i) / cfg.deck,
            p = section.map(([z, h]) => [x, deckY(x) + h, sign * z]);
          return sign < 0 ? p.toReversed() : p;
        });
      loft(w, 'steel', rings, steel);
      for (let i = 0; i < cfg.deck; i++) {
        const x = -DECK + (2 * DECK * i) / cfg.deck,
          e = -DECK + (2 * DECK * (i + 1)) / cfg.deck,
          z0 = sign < 0 ? -12.85 : 3,
          z1 = sign < 0 ? -3 : 12.85;
        quad(
          w,
          'road',
          [
            [x, deckY(x) + 0.025, z0],
            [x, deckY(x) + 0.025, z1],
            [e, deckY(e) + 0.025, z1],
            [e, deckY(e) + 0.025, z0],
          ],
          [0, 1, 0],
          [0.12, 0.13, 0.135],
        );
      }
    }
  for (const z of [-Z, Z]) {
    for (const [a, b, n] of [
      [-CABLE, -SPAN, cfg.back],
      [-SPAN, SPAN, cfg.main],
      [SPAN, CABLE, cfg.back],
    ])
      for (let i = 0; i < n; i++) {
        const x = a + ((b - a) * i) / n,
          e = a + ((b - a) * (i + 1)) / n,
          p = [x, cableY(x), z],
          q = [e, cableY(e), z];
        if (tier < 2) ribbon(w, 'steel', p, q, tier === 0 ? 0.7 : 0.34, steel);
        else tube(w, 'steel', p, q, 0.34, steel, cfg.sides);
      }
    for (let x = -DECK + cfg.pitch / 2; x < DECK; x += cfg.pitch) {
      for (const dx of tier === 3 ? [-0.13, 0.13] : [0]) {
        const p = [x + dx, deckY(x) - 1.3, z],
          q = [x + dx, cableY(x) - 0.35, z];
        if (tier < 2) ribbon(w, 'steel', p, q, tier === 0 ? 0.24 : 0.08, steel);
        else tube(w, 'steel', p, q, 0.08, steel, cfg.sides);
      }
      if (tier === 3) {
        box(
          w,
          'iron',
          [x - 0.5, deckY(x) - 1.7, z - 0.45],
          [x + 0.5, deckY(x) - 1.3, z + 0.45],
          dark,
        );
        tube(w, 'iron', [x - 0.18, cableY(x), z], [x + 0.18, cableY(x), z], 0.44, dark, 6);
      }
    }
  }
  const ax = CABLE + 11;
  if (tier > 0)
    loft(
      w,
      'concrete',
      [radialRing(0, 34, 34, 12, [ax, 0]), radialRing(3, 34, 34, 12, [ax, 0])],
      concrete,
    );
  loft(
    w,
    'concrete',
    [
      chamferedRectangle(ax, 3, 0, 55, 56, 8),
      chamferedRectangle(ax + 3, 18, 0, 49, 51, 8),
      chamferedRectangle(ax + 9, 39, 0, 28, 43, 5),
    ],
    concrete,
  );
  for (const sign of [-1, 1])
    loft(
      w,
      'concrete',
      [
        chamferedRectangle(-CABLE - 8, 0, sign * Z, 29, 17, 2),
        chamferedRectangle(-CABLE - 8, 30, sign * Z, 27, 15, 2),
        chamferedRectangle(-CABLE - 10, 41, sign * Z, 18, 12, 1),
      ],
      concrete,
    );
  for (const x of [-DECK, DECK]) {
    const h = deckY(x) - 3;
    if (tier === 0) {
      box(w, 'concrete', [x - 4.1, 0, -14.2], [x + 4.1, h, 14.2], concrete);
      continue;
    }
    for (const sign of [-1, 1])
      loft(
        w,
        'concrete',
        [
          chamferedRectangle(x, 0, sign * 7.8, 6.8, 6.8, 0.7),
          chamferedRectangle(x, h - 6.5, sign * 7.8, 5.3, 5.3, 0.6),
          chamferedRectangle(x, h - 1.2, sign * 7.8, 7.2, 12.1, 0.6),
        ],
        concrete,
      );
    box(w, 'concrete', [x - 4.1, h - 2.2, -14.2], [x + 4.1, h - 0.7, 14.2], concrete);
  }
  if (tier > 1) {
    for (const z of [-12.85, -3, 3, 12.85])
      for (let x = -DECK; x < DECK; x += cfg.rail) {
        const e = Math.min(DECK, x + cfg.rail);
        beam(w, 'iron', [x, deckY(x) + 0.8, z], [e, deckY(e) + 0.8, z], 0.1, 0.1, dark);
        beam(w, 'iron', [x, deckY(x), z], [x, deckY(x) + 0.85, z], 0.1, 0.1, dark);
      }
    for (let x = -1116; x <= 1116; x += tier === 2 ? 144 : 72)
      for (const sign of [-1, 1]) {
        const y = deckY(x),
          z = sign * 12.6;
        beam(w, 'steel', [x, y + 0.15, z], [x, y + 10.5, z], 0.15, 0.15, steel);
        beam(w, 'steel', [x, y + 10.1, z], [x, y + 10.72, z - sign * 2.06], 0.09, 0.09, steel);
        box(
          w,
          'marking',
          [x - 0.18, y + 10.62, z - sign * 2.06 - 0.3],
          [x + 0.18, y + 10.75, z - sign * 2.06 + 0.3],
          [0.81, 0.85, 0.79],
        );
      }
    for (let x = -DECK; x < DECK; x += 24)
      for (const z of [-7.925, 7.925])
        quad(
          w,
          'marking',
          [
            [x, deckY(x) + 0.04, z - 0.075],
            [x, deckY(x) + 0.04, z + 0.075],
            [Math.min(DECK, x + 6), deckY(Math.min(DECK, x + 6)) + 0.04, z + 0.075],
            [Math.min(DECK, x + 6), deckY(Math.min(DECK, x + 6)) + 0.04, z - 0.075],
          ],
          [0, 1, 0],
          [0.84, 0.84, 0.78],
        );
  }
}
export const buildYiSunSinSkyline = (o) => build(o, 0),
  buildYiSunSinDistrict = (o) => build(o, 1),
  buildYiSunSinStreet = (o) => build(o, 2),
  buildYiSunSinCloseup = (o) => build(o, 3);
