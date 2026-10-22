/** Whole Roman Alcántara crossing: six real vaults, five cutwater piers and open honorific arch. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ez/ez5/alcantara_bridge/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = { stone: rgb('bfb7a6'), cut: rgb('c9c0ac'), deck: rgb('c1b8a5'), panel: rgb('aaa493') },
  surfaces = {
    stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.98, metallic: 0 },
    cut: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
    deck: { slot: 'foundation', graph: 'stone_granite', roughness: 1, metallic: 0 },
    panel: { slot: 'trim', localRef: ref, roughness: 1, metallic: 0 },
  };
const vary = (c, k) => c.map((v) => Math.min(1, v * k)),
  area = (r) =>
    r.reduce(
      (s, a, i) => s + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1],
      0,
    ) / 2,
  rect = (x, z, w, l) => [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ];
function T(o, s, q, h, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const n = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...n) < 1e-8) return;
  if (h && n.reduce((a, v, k) => a + v * h[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    s,
    ref,
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, s, q, h, col = C[s]) {
  T(o, s, [q[0], q[1], q[2]], h, col);
  T(o, s, [q[0], q[2], q[3]], h, col);
}
function cap(o, s, r, y, up = true, col = C[s]) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function loft(o, s, a, b, y0, y1, col = C[s]) {
  const sign = Math.sign(area(a));
  cap(o, s, a, y0, false, col);
  cap(o, s, b, y1, true, col);
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    Q(
      o,
      s,
      [
        [a[i][0], y0, a[i][1]],
        [a[j][0], y0, a[j][1]],
        [b[j][0], y1, b[j][1]],
        [b[i][0], y1, b[i][1]],
      ],
      [sign * (a[j][1] - a[i][1]), 0, sign * (a[i][0] - a[j][0])],
      col,
    );
  }
}
function prism(o, s, r, y0, y1, col = C[s]) {
  loft(o, s, r, r, y0, y1, col);
}
function B(o, s, x, y, z, w, h, l, col = C[s]) {
  prism(o, s, rect(x, z, w, l), y, y + h, col);
}
const P = (a, depth, axis) => (axis === 'x' ? [depth, a[1], a[0]] : [a[0], a[1], depth]),
  N = (h, axis) => (axis === 'x' ? [h[2], h[1], h[0]] : h);
/** A closed extrusion of a concave bottom profile, not a box masking the arches. */
function extrusion(o, s, r, a, b, axis = 'z', holes = [], col = C[s]) {
  const flat = [r, ...holes].flat(),
    hi = [];
  let count = r.length;
  for (const h of holes) {
    hi.push(count);
    count += h.length;
  }
  const ix = earcut(flat.flat(), hi);
  for (const [d, sg] of [
    [a, -1],
    [b, 1],
  ]) {
    for (let i = 0; i < ix.length; i += 3)
      T(
        o,
        s,
        ix.slice(i, i + 3).map((k) => P(flat[k], d, axis)),
        N([0, 0, sg], axis),
        col,
      );
    for (const h of holes) {
      const depth = d - sg * 0.13,
        normal = N([0, 0, sg], axis);
      for (let k = 0; k < h.length; k++) {
        const j = (k + 1) % h.length;
        Q(
          o,
          s,
          [P(h[k], d, axis), P(h[j], d, axis), P(h[j], depth, axis), P(h[k], depth, axis)],
          null,
          col,
        );
      }
      Q(
        o,
        'panel',
        h.map((q) => P(q, depth, axis)),
        normal,
        C.panel,
      );
    }
  }
  const sign = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    Q(
      o,
      s,
      [P(r[i], a, axis), P(r[j], a, axis), P(r[j], b, axis), P(r[i], b, axis)],
      N([sign * (r[j][1] - r[i][1]), sign * (r[i][0] - r[j][0]), 0], axis),
      col,
    );
  }
}
function curve(a, b, crown, n) {
  const r = (b - a) / 2,
    x = (a + b) / 2,
    spring = crown - r;
  return Array.from({ length: n + 1 }, (_, i) => {
    const angle = Math.PI - (Math.PI * i) / n;
    return [x + r * Math.cos(angle), spring + r * Math.sin(angle)];
  });
}
function spanProfile(d) {
  const a = [[p.bridgeStart, p.levels.footings[0]]],
    n = [6, 14, 30, 60][d];
  for (let i = 0; i < 6; i++) {
    const [l, r] = p.spanIntervals[i],
      c = curve(l, r, p.levels.archCrown, n);
    a.push([l, p.levels.footings[i]], ...c, [r, p.levels.footings[i + 1]]);
  }
  a.push(
    [p.bridgeEnd, p.levels.footings[6]],
    [p.bridgeEnd, p.levels.deck - 0.18],
    [p.bridgeStart, p.levels.deck - 0.18],
  );
  return a;
}
function wedge(o, s, cx, cy, r, t, a, b, z0, z1, _d, axis = 'z', col = C[s]) {
  const P2 = (rr, angle) => [cx + rr * Math.cos(angle), cy + rr * Math.sin(angle)],
    poly = [P2(r, a), P2(r + t, a), P2(r + t, b), P2(r, b)];
  extrusion(o, s, poly, z0, z1, axis, [], col);
}
function voussoirs(o, d) {
  if (!d) return;
  for (const [index, [a, b]] of p.spanIntervals.entries()) {
    const r = (b - a) / 2,
      cx = (a + b) / 2,
      cy = p.levels.archCrown - r,
      n = [0, 12, 26, 48][d],
      t = 1.16;
    for (const side of [-1, 1])
      for (let j = 0; j < n; j++) {
        const gap = d > 1 ? 0.005 : 0,
          A = (Math.PI * j) / n + gap,
          B = (Math.PI * (j + 1)) / n - gap,
          depth = side * (p.bodyWidth / 2 + 0.012),
          tip = side * (p.bodyWidth / 2 + (d > 1 ? 0.085 : 0.045));
        wedge(
          o,
          'cut',
          cx,
          cy,
          r,
          t,
          A,
          B,
          Math.min(depth, tip),
          Math.max(depth, tip),
          d,
          'z',
          vary(C.cut, 0.96 + ((j + index) % 5) * 0.014),
        );
      }
  }
}
const wing = (r, side) => [[r[0][0], side * 3.55], ...r, [r.at(-1)[0], side * 3.55]],
  scale = (r, s) => {
    const c = r.reduce((v, a) => [v[0] + a[0] / r.length, v[1] + a[1] / r.length], [0, 0]);
    return r.map((a) => [c[0] + (a[0] - c[0]) * s, c[1] + (a[1] - c[1]) * s]);
  };
function cutwaters(o, d) {
  for (const pier of p.piers) {
    for (const [side, native] of [
      [1, pier.front],
      [-1, pier.back],
    ]) {
      const r = wing(native, side),
        base = pier.base,
        top = pier.top,
        foot = scale(r, 1.055);
      prism(o, 'stone', foot, base, base + 0.75, vary(C.stone, 0.94));
      prism(o, 'stone', r, base + 0.75, top - 1.0);
      if (d === 0) continue;
      const lower = scale(r, 1.035),
        ledge = base + (top - base) * 0.2;
      prism(o, 'cut', lower, ledge, ledge + 0.38, vary(C.cut, 0.94));
      const upper = r.map(([x, z]) => [x, side * Math.max(3.55, Math.abs(z) - 0.7)]);
      loft(o, 'cut', r, upper, top - 1.0, top + 0.1, vary(C.cut, 0.97));
      if (d > 1) {
        const rows = d === 3 ? 7 : 3;
        for (let j = 1; j < rows; j++) {
          const y = base + 0.75 + ((top - base - 2.2) * j) / rows;
          prism(o, 'stone', scale(r, 1.006), y, y + 0.045, vary(C.stone, 0.98));
        }
      }
    }
    // Narrow attached pilaster/coping above the cutwater, as seen in the complete photograph.
    if (d) {
      const x = (pier.x0 + pier.x1) / 2;
      for (const side of [-1, 1]) {
        B(o, 'stone', x, pier.top, side * 4.03, 1.02, p.levels.deck - pier.top + 0.2, 0.26);
        B(o, 'cut', x, p.levels.deck + 0.2, side * 3.74, 1.3, 0.18, 0.7);
      }
    }
    if (d === 3) {
      const x = (pier.x0 + pier.x1) / 2;
      for (const side of [-1, 1])
        for (let j = 0; j < 5; j++)
          B(
            o,
            'cut',
            x - 0.35,
            p.levels.deck - 2 - j * 0.62,
            side * 4.015,
            0.24,
            0.22,
            0.025,
            vary(C.cut, 0.96),
          );
    }
  }
  for (const [x, y] of [
    [-86.3, p.levels.footings[0]],
    [84.7, p.levels.footings[6]],
    [94.3, p.levels.footings[6]],
  ])
    for (const side of [-1, 1]) {
      B(o, 'stone', x, y, side * 4.1, 1.25, p.levels.deck - y, 0.48);
      if (d) B(o, 'cut', x, p.levels.deck, side * 3.73, 1.4, 0.18, 0.72);
    }
}
function parapets(o, d) {
  const a = p.bridgeStart,
    b = p.bridgeEnd,
    len = b - a,
    deck = p.levels.deck;
  B(o, 'deck', (a + b) / 2, deck - 0.18, 0, len, 0.18, p.bodyWidth);
  for (const side of [-1, 1]) {
    const count = d === 0 ? 1 : d === 1 ? 3 : Math.ceil(len / (d === 3 ? 1.4 : 3)),
      gap = d > 1 ? 0.016 : 0;
    for (let i = 0; i < count; i++) {
      const x0 = a + (len * i) / count + gap,
        x1 = a + (len * (i + 1)) / count - gap;
      B(
        o,
        'stone',
        (x0 + x1) / 2,
        deck,
        side * 3.73,
        x1 - x0,
        1.0,
        0.54,
        vary(C.stone, 0.97 + (i % 5) * 0.011),
      );
      B(
        o,
        'cut',
        (x0 + x1) / 2,
        deck + 1,
        side * 3.73,
        x1 - x0,
        0.15,
        0.64,
        vary(C.cut, 0.97 + (i % 4) * 0.012),
      );
    }
  }
  if (d > 1) {
    const count = d === 3 ? 72 : 36;
    for (let i = 1; i < count; i++) {
      const x = a + (len * i) / count;
      for (const side of [-1, 1])
        Q(
          o,
          'deck',
          [
            [x - 0.012, deck + 0.001, side * 0.15],
            [x + 0.012, deck + 0.001, side * 0.15],
            [x + 0.012, deck + 0.001, side * 3.4],
            [x - 0.012, deck + 0.001, side * 3.4],
          ],
          [0, 1, 0],
          vary(C.deck, 0.88),
        );
    }
  }
}
function gateway(o, d) {
  const g = p.gateway,
    half = g.clearWidth / 2,
    n = [6, 12, 24, 48][d],
    arc = curve(-half, half, g.crown, n),
    profile = [
      [-g.width / 2, g.base],
      [-half, g.base],
      ...arc,
      [half, g.base],
      [g.width / 2, g.base],
      [g.width / 2, g.bodyTop],
      [-g.width / 2, g.bodyTop],
    ],
    hole = [
      [-2.72, g.base + 10.45],
      [2.72, g.base + 10.45],
      [2.72, g.base + 12.1],
      [-2.72, g.base + 12.1],
    ];
  extrusion(o, 'stone', profile, g.x - g.depth / 2, g.x + g.depth / 2, 'x', [hole]);
  for (const [y, h, width, depth] of [
    [g.base + 9.45, 0.27, 8.3, 2.95],
    [g.bodyTop - 0.16, 0.35, 8.55, 3.15],
    [g.bodyTop + 0.19, 0.66, 8.04, 2.65],
    [g.overallTop - 0.4, 0.4, 8.65, 3.2],
  ])
    B(o, 'cut', g.x, y, 0, depth, h, width);
  for (const side of [-1, 1]) B(o, 'cut', g.x, g.base, side * 3.15, 3, 0.26, 1.85);
  if (d) {
    const r = half,
      cy = g.spring;
    for (const side of [-1, 1])
      for (let i = 0; i < [0, 12, 24, 40][d]; i++) {
        const count = [0, 12, 24, 40][d],
          a = (Math.PI * i) / count + 0.004,
          b = (Math.PI * (i + 1)) / count - 0.004,
          z0 = g.x + side * (g.depth / 2 + 0.01),
          z1 = g.x + side * (g.depth / 2 + 0.085);
        wedge(
          o,
          'cut',
          0,
          cy,
          r,
          0.52,
          a,
          b,
          Math.min(z0, z1),
          Math.max(z0, z1),
          0,
          'x',
          vary(C.cut, 0.97 + (i % 4) * 0.011),
        );
      }
    for (const z of [-half - 0.26, half + 0.26])
      B(o, 'cut', g.x, g.base + 0.27, z, g.depth + 0.14, g.spring - g.base - 0.27, 0.46);
    for (const side of [-1, 1])
      for (const z of [-3.7, 3.7])
        B(
          o,
          'cut',
          g.x + side * (g.depth / 2 + 0.05),
          g.base + 0.26,
          z,
          0.18,
          g.bodyTop - g.base - 0.26,
          0.3,
        );
  }
  // Shallow framed, genuinely recessed tablets; the protected modern surface text/art is not copied.
  if (d > 1)
    for (const side of [-1, 1]) {
      const x = g.x + side * (g.depth / 2 + 0.04),
        w = 0.12;
      for (const z of [-2.82, 2.82]) B(o, 'cut', x, g.base + 10.35, z, 0.12, 1.85, w);
      for (const y of [g.base + 10.35, g.base + 12.1]) B(o, 'cut', x, y, 0, 0.12, 0.12, 5.76);
    }
}
function build(o, _f, d = 3) {
  extrusion(o, 'stone', spanProfile(d), -p.bodyWidth / 2, p.bodyWidth / 2);
  voussoirs(o, d);
  cutwaters(o, d);
  parapets(o, d);
  gateway(o, d);
}
export const alcantaraBridgeSkyline = (o, f) => build(o, f, 0),
  alcantaraBridgeDistrict = (o, f) => build(o, f, 1),
  alcantaraBridgeStreet = (o, f) => build(o, f, 2),
  alcantaraBridgeCloseup = (o, f) => build(o, f, 3);
export const alcantaraBridgeModel = {
  id: 'alcantara_bridge',
  key: 'alcantara_bridge',
  cell: 'ez/ez5',
  recipe: 'structure-alcantara-bridge.mjs',
  title: 'Alcántara Bridge',
  category: 'bridge',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [225, 125, 245],
  lookAt: [0, 37, 0],
  portableGroundY: -0.18,
  mediumFiContext: { scale: 1.5, groundY: -0.18 },
  qaCameras: [
    {
      name: 'whole-six-arch-crossing-five-piers-and-central-gateway',
      position: [-220, 110, 245],
      lookAt: [0, 37, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'all-six-open-round-vaults-and-tall-pier-undercrofts',
      position: [0, 32, 180],
      lookAt: [0, 34, 0],
    },
    {
      name: 'central-triumphal-arch-open-road-passage-and-tablets',
      position: [24, 75, 22],
      lookAt: [3.256, 64, 0],
    },
    {
      name: 'native-pointed-cutwaters-stepped-bases-and-pier-shafts',
      position: [-40, 35, -75],
      lookAt: [3, 28, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis: `${p.geometryBasis} ${p.verticalInterpretation}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-alcantara-bridge.mjs',
    level: 'skyline',
    export: 'alcantaraBridgeSkyline',
    errorMeters: 1.8,
    surfaces,
    authoredLevels: {
      district: { export: 'alcantaraBridgeDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'alcantaraBridgeStreet', errorMeters: 0.18, surfaces },
      closeup: { export: 'alcantaraBridgeCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.verticalInterpretation,
    'Whole bridge with all6unequal through-vaults/five main piers/front and back native lower projections/both end abutments,8mbody and continuous stone deck/solid parapets, central honorific gateway/open roadway/upper attic/cornices/tablet recesses. Original63point contour retained as coarse lower physical plan reference; not extruded into an overwide solid deck. Native shoulder-derived arch intervals and body/cutwater heights/hidden low foundations are approximate, not a precise Roman survey. Separate temple80366887outside bridge footprint, Torre delOro/townwalls and modern viaduct/dam are not built or silently counted.',
    'Municipal194mlength/8mwidth/71mheight INCLUDING approx14mabove-deck gateway. Native axis191.965m retained rather than rescaled. Bed-relative geometry has deck57m/top71m/deepest footing0m; five footing/wing levels and cutwater head/profile from broad source-photo proportions, not verified geology or modern water/foundation survey.6semicircular arcs remain real openings at all detail levels, skyline curve faceting bounded1.8m; smaller stone joints/pilasters/coarse courses simplify at distance.',
    'Exact Qualla-published1830x1261JeanLaurent photo/circa1870nativePD-old record/BNEitem/named1816–1886creator lifespan/nativeSHA1 bound, plus official municipal current structural text. No local media/category edits; omitted rights category recovered by strict new native library proof with64focused provenance regression tests. Primary BNEcatalog bibliography corroborates original photo identity; no protected catalog image pixels. Old1811templecrop competingCCBY4.0unused/no pixels viewed; unrelatedLaurent1864Toledobridge rejected. No questionable source pixels/photo textures or generated bitmaps.',
    'Neutral gray-buff granite palette is not copied from sepia toning. Shared granite/course appearance with raw low-frequency trim texture for modeled ring stones; no unique photographic material. Current repair patches/inscription text/royal relief/stone census are not reproduced, bounded shallow tablets and simple cornices retain permanent structure.',
    'Independent512m129²16641values/four rawTerrariumtiles frozen before geometry unchanged.134.0421mprovider sample at fixed SEaxispoint is a coarse gorge-level proxy, not an architectural road threshold; source field123.64..226.64m/3.67moutput pixel spacing may oversample a much coarser native DEM. Actual bank/road/riverbed contact and live host elevation agreement are unverified. Flat portable/shared/context fixtures show bridge geometry only; no valley/water/hill mesh or fitted/flattened/reacquired field. Geographic preview/replaceFootprint=false.',
  ],
};
