/** Surviving Moon pyramid, native stepped foreplatform and three physical stair flights. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/9g/9g9/pyramid_of_the_moon/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = { rubble: rgb('918a7c'), band: rgb('aaa08b'), panel: rgb('7c7b71'), tread: rgb('8e8778') },
  surfaces = {
    rubble: { slot: 'wall', graph: 'stone_basalt_raw', roughness: 0.99, metallic: 0 },
    band: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.98, metallic: 0 },
    panel: { slot: 'wall', graph: 'stone_drywall', roughness: 0.99, metallic: 0 },
    tread: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.98, metallic: 0 },
  };
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.8 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.7 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
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
const rect = ([x0, z0, x1, z1]) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  mix = (a, b, t) => a + (b - a) * t;
function centre(r) {
  return [0, 1].map((k) => r.reduce((n, v) => n + v[k] / r.length, 0));
}
function inset(r, amount) {
  const c = centre(r);
  return r.map((q) => q.map((v, k) => v - Math.sign(v - c[k]) * amount));
}
function signed(r) {
  return Math.sign(
    r.reduce((n, q, i) => n + q[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * q[1], 0),
  );
}
function edgeNormal(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    s = signed(r);
  return [(s * (b[1] - a[1])) / L, 0, (s * (a[0] - b[0])) / L];
}
function rayPolygon(r, c, a) {
  const u = [Math.cos(a), Math.sin(a)];
  let first = Infinity;
  for (let i = 0; i < r.length; i++) {
    const A = r[i],
      B = r[(i + 1) % r.length],
      v = [B[0] - A[0], B[1] - A[1]],
      det = u[0] * v[1] - u[1] * v[0];
    if (Math.abs(det) < 1e-10) continue;
    const q = [A[0] - c[0], A[1] - c[1]],
      t = (q[0] * v[1] - q[1] * v[0]) / det,
      k = (q[0] * u[1] - q[1] * u[0]) / det;
    if (t >= 0 && k >= -1e-7 && k <= 1 + 1e-7) first = Math.min(first, t);
  }
  if (!Number.isFinite(first)) throw Error('Uncovered authored ring');
  return [c[0] + u[0] * first, c[1] + u[1] * first];
}
/** Radial correspondence keeps every native corner despite different ring counts. */
function loft(o, s, A, y0, B, y1, d, c, rough = false) {
  if (A.length === 4 && B.length === 4) {
    const columns = [1, 4, 16, 24][d],
      rows = y0 === y1 ? 1 : [1, 1, 3, 6][d];
    for (let edge = 0; edge < 4; edge++) {
      const next = (edge + 1) % 4,
        n = edgeNormal(A, edge);
      const point = (u, t) => {
        const a = A[edge].map((v, k) => mix(v, A[next][k], u)),
          b = B[edge].map((v, k) => mix(v, B[next][k], u));
        const w =
          rough && y0 !== y1 && d > 1
            ? 0.045 *
              Math.sin(t * Math.PI) *
              Math.sin(u * Math.PI) *
              Math.sin(u * 19 + t * 7 + edge)
            : 0;
        return [mix(a[0], b[0], t) + n[0] * w, mix(y0, y1, t), mix(a[1], b[1], t) + n[2] * w];
      };
      for (let i = 0; i < columns; i++)
        for (let j = 0; j < rows; j++)
          Q(
            o,
            s,
            [
              point(i / columns, j / rows),
              point((i + 1) / columns, j / rows),
              point((i + 1) / columns, (j + 1) / rows),
              point(i / columns, (j + 1) / rows),
            ],
            y0 === y1 ? [0, 1, 0] : n,
          );
    }
    return;
  }
  const nominal = [0, 16, 48, 80][d],
    angles = [...A, ...B].map((q) => Math.atan2(q[1] - c[1], q[0] - c[0]));
  for (let i = 0; i < nominal; i++) angles.push(-Math.PI + (i * 2 * Math.PI) / nominal);
  angles.sort((a, b) => a - b);
  const as = angles.filter((a, i) => i === 0 || a - angles[i - 1] > 1e-7),
    rows = rough ? [1, 1, 3, 6][d] : 1,
    point = (a, t) => {
      const lo = rayPolygon(A, c, a),
        hi = rayPolygon(B, c, a),
        w = rough && d > 1 ? 0.09 * Math.sin(t * Math.PI) * Math.sin(a * 7.3 + t * 12.1) : 0;
      return [
        mix(lo[0], hi[0], t) + Math.cos(a) * w,
        mix(y0, y1, t),
        mix(lo[1], hi[1], t) + Math.sin(a) * w,
      ];
    };
  for (let i = 0; i < as.length; i++) {
    const a = as[i],
      b = as[(i + 1) % as.length];
    for (let j = 0; j < rows; j++) {
      const t = j / rows,
        u = (j + 1) / rows;
      Q(
        o,
        s,
        [point(a, t), point(b, t), point(b, u), point(a, u)],
        y1 === y0 ? [0, 1, 0] : [Math.cos(a) + Math.cos(b), 0, Math.sin(a) + Math.sin(b)],
      );
    }
  }
}
function prism(o, s, r, y0, y1, d, col = C[s]) {
  if (d) cap(o, s, r, y0, false, col);
  cap(o, s, r, y1, true, col);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      edgeNormal(r, i),
      col,
    );
  }
}
function mainPyramid(o, d) {
  const levels = p.parameters.mainLevels,
    c = [0.5, -31],
    rings = levels.map((l) => (l.native ? p.bodyOutline : rect(l.rect)));
  for (let j = 1; j < levels.length; j++)
    loft(o, 'rubble', rings[j - 1], levels[j - 1].y, rings[j], levels[j].y, d, c, true);
  cap(o, 'rubble', rings.at(-1), levels.at(-1).y);
  if (d > 1) {
    for (const [at, x, z, r] of [
      [1, -6, -30, 1.2],
      [2, 9, -32, 0.8],
      [3, -12, -28, 0.75],
      [4, 14, -29, 0.65],
    ]) {
      const R = Array.from({ length: 6 }, (_, i) => [
        x + Math.cos((i * Math.PI) / 3) * r,
        z + Math.sin((i * Math.PI) / 3) * r * 0.7,
      ]);
      for (let i = 0; i < R.length; i++)
        T(
          o,
          'rubble',
          [
            [R[i][0], 45.2, R[i][1]],
            [R[(i + 1) % 6][0], 45.2, R[(i + 1) % 6][1]],
            [x, 45.2 + 0.16 + at * 0.035, z],
          ],
          [0, 1, 0],
        );
    }
  }
}
function platform(o, d) {
  const rings = p.platformRings,
    ys = p.parameters.platformLevels,
    c = [1.1, 54.5];
  for (let i = 0; i < 4; i++) {
    const A = rings[i],
      B = rings[i + 1],
      y0 = ys[i],
      y1 = ys[i + 1],
      talud = y0 + (y1 - y0) * 0.56,
      base = inset(B, -0.27),
      panel = inset(B, 0.12),
      band = inset(B, -0.2);
    loft(o, 'rubble', A, y0, base, talud, d, c, true);
    loft(o, 'band', base, talud, panel, talud + 0.13, d, c);
    loft(o, 'panel', panel, talud + 0.13, panel, y1 - 0.23, d, c);
    loft(o, 'band', panel, y1 - 0.23, band, y1 - 0.23, d, c);
    loft(o, 'band', band, y1 - 0.23, band, y1, d, c);
    loft(o, 'band', band, y1, B, y1, d, c);
    if (i === 3) cap(o, 'tread', B, y1);
    else loft(o, 'tread', B, y1, inset(B, 0.45), y1, d, c);
  }
}
function staircase(o, a, b, y0, y1, width, count, d) {
  const v = [b[0] - a[0], b[1] - a[1]],
    L = Math.hypot(...v),
    n = [-v[1] / L, v[0] / L],
    N = d === 0 ? Math.max(4, Math.ceil(count / 7)) : d === 1 ? Math.ceil(count / 2) : count,
    P = (t, y, z) => [mix(a[0], b[0], t) + n[0] * z, y, mix(a[1], b[1], t) + n[1] * z];
  for (let j = 0; j < N; j++) {
    const t = j / N,
      u = (j + 1) / N,
      low = mix(y0, y1, t) + 0.045,
      high = mix(y0, y1, u) + 0.045;
    Q(
      o,
      'tread',
      [
        P(t, high, -width / 2),
        P(u, high, -width / 2),
        P(u, high, width / 2),
        P(t, high, width / 2),
      ],
      [0, 1, 0],
    );
    Q(
      o,
      'tread',
      [P(t, low, -width / 2), P(t, low, width / 2), P(t, high, width / 2), P(t, high, -width / 2)],
      [-v[0], 0, -v[1]],
    );
    for (const s of [-1, 1])
      Q(
        o,
        'rubble',
        [
          P(t, low - 0.3, (s * width) / 2),
          P(u, high - 0.3, (s * width) / 2),
          P(u, high, (s * width) / 2),
          P(t, high, (s * width) / 2),
        ],
        [n[0] * s, 0, n[1] * s],
      );
  }
  for (const side of [-1, 1]) {
    const w = 0.55,
      z = side * (width / 2 + w / 2);
    Q(
      o,
      'band',
      [
        P(0, y0 + 0.15, z - w / 2),
        P(1, y1 + 0.15, z - w / 2),
        P(1, y1 + 0.15, z + w / 2),
        P(0, y0 + 0.15, z + w / 2),
      ],
      [0, 1, 0],
    );
    Q(
      o,
      'rubble',
      [
        P(0, y0 - 0.15, z + (side * w) / 2),
        P(1, y1 - 0.15, z + (side * w) / 2),
        P(1, y1 + 0.15, z + (side * w) / 2),
        P(0, y0 + 0.15, z + (side * w) / 2),
      ],
      [side * n[0], 0, side * n[1]],
    );
  }
}
function stairs(o, d) {
  const a = p.stairRoutes,
    P = p.parameters;
  staircase(o, ...a.front, P.plinth, 16, P.frontStairWidth, P.frontStairCount, d);
  staircase(o, ...a.firstUpper, 16, 28.2, P.upperStairWidth, P.firstUpperStairCount, d);
  staircase(o, ...a.secondUpper, 28.2, 37, P.upperStairWidth, P.secondUpperStairCount, d);
  for (const [r, y] of [
    [a.firstLanding, 28.2],
    [a.upperLanding, 37],
  ]) {
    const x = (r[0][0] + r[1][0]) / 2;
    Q(
      o,
      'tread',
      [
        [x - 6.6, y + 0.04, r[0][1]],
        [x + 6.6, y + 0.04, r[0][1]],
        [x + 6.6, y + 0.04, r[1][1]],
        [x - 6.6, y + 0.04, r[1][1]],
      ],
      [0, 1, 0],
    );
  }
}
function build(o, _f, d = 3) {
  prism(o, 'rubble', p.outline, 0, 0.35, d);
  mainPyramid(o, d);
  platform(o, d);
  stairs(o, d);
}
export const pyramidOfTheMoonSkyline = (o, f) => build(o, f, 0),
  pyramidOfTheMoonDistrict = (o, f) => build(o, f, 1),
  pyramidOfTheMoonStreet = (o, f) => build(o, f, 2),
  pyramidOfTheMoonCloseup = (o, f) => build(o, f, 3);
export const pyramidOfTheMoonModel = {
  id: 'pyramid_of_the_moon',
  key: 'pyramid_of_the_moon',
  cell: '9g/9g9',
  recipe: 'structure-pyramid-of-the-moon.mjs',
  title: 'Pyramid of the Moon',
  category: 'archaeological',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [145, 105, 205],
  lookAt: [0, 18, 0],
  portableGroundY: -0.06,
  mediumFiContext: { scale: 1.15, groundY: -0.06 },
  qaCameras: [
    {
      name: 'whole-native-pyramid-front-platform-and-open-worn-summit',
      position: [140, 95, 195],
      lookAt: [0, 18, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'four-talud-tablero-platform-bodies-and-real-central-stair',
      position: [74, 35, 122],
      lookAt: [1, 10, 52],
    },
    {
      name: 'upper-stair-flights-landings-and-receding-main-terraces',
      position: [48, 62, 70],
      lookAt: [1, 28, 5],
    },
    {
      name: 'rear-native-notch-battered-tiers-and-open-crown',
      position: [-132, 80, -130],
      lookAt: [-3, 22, -31],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis: `${p.geometryBasis} Independent256m field frozen before geometry; provider plaza datum2314.9264m is not a surveyed threshold. Composite elevation may include the monument itself; actual host/bare-earth contact unverified.`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-pyramid-of-the-moon.mjs',
    level: 'skyline',
    export: 'pyramidOfTheMoonSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'pyramidOfTheMoonDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'pyramidOfTheMoonStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'pyramidOfTheMoonCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Whole surviving native21vertex pyramid outline and complete projecting front platform, four talud-tablero bodies, three axial stair flights, upper ledges and worn flat summit. Main tiers/inset rings/platform16m/crown45.2m/56+44+32 detailed treads and hidden rear wear are architectural estimates from five clear originals and native access/ledge controls, not an archaeological measured reconstruction. Distant levels aggregate stair treads.',
    'Five already-published exact own CC0 originals individually inspected/native-SHA1-bound: Syced2007 images5/6/10/11 and Goose friend2015. Goose image is strongly posterized and supplies topology only. Gorgo template-only PD candidate and Syced14/15 of Pyramid of the Sun unused. No source metadata/categories/article body/imagery-policy changes, protected official photos/plans, supplemental imagery, photo textures, generated bitmap or downloaded mesh.',
    'Primary INAH text supplies broad height/base scale and distinguishes separate Structure A12m south; no official image pixels or protected plan adopted. Whole native144.37x156.68m envelope retained rather than rescaling to rounded140x150m public dimensions. No summit temple/ancient colored stucco/interiors/tunnels/excavated earlier phases/other plaza pyramids/altars/avenue/mountains/temporary barriers/visitors.',
    'Independent256m129square2m field/all16641heights/PNG/two original Terrarium tiles frozen before geometry unchanged. Providerplazadatum2314.9264m/absolute2309.0654..2339.2687m/sourcepixel4.497714218753129m do not imply survey accuracy or bare-earth resolution. The composite likely includes monumental relief; default host terrain/actual plaza contacts unverified. No fitting, flattening, source height deletion or reacquisition. Ordinary preview/replacementdisabled; flat review fixtures separate from actual geographic ground.',
  ],
};
