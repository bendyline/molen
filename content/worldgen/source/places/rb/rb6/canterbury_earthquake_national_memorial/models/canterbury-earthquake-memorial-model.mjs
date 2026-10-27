/** Complete memorial wall and intrinsic south-bank access assembly, not the broad memorial parcel. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  beamPath,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  n = JSON.parse(fs.readFileSync(new URL('../native-controls.json', import.meta.url))),
  { floorY: F, architecturalSections: A } = p.parameters,
  spine = n.fullProposedWall;
const C = {
  marble: rgb('dddcd6'),
  basalt: rgb('777b76'),
  rail: rgb('a4a8a3'),
  wood: rgb('78634a'),
  green: rgb('304c40'),
};
export const surfaces = {
  marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.64, metallic: 0 },
  basalt: { slot: 'wall', graph: 'stone_basalt', roughness: 0.95, metallic: 0 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.58, metallic: 0.28 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  green: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.26, metallic: 0.03 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  norm = (v) => {
    const l = Math.hypot(...v);
    return v.map((x) => x / l);
  },
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  rect = (x, X, z, Z) => [
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ];
export const partEvidence = [],
  panelEvidence = [],
  stairEvidence = [],
  benchEvidence = [];
function T(o, k, q, v, col = C[k]) {
  q = q.map((a) => [a[0], F + a[1], a[2]].map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-9) return;
  if (v && dot(cr, v) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    col,
  );
}
function Q(o, k, q, v, col) {
  T(o, k, q.slice(0, 3), v, col);
  T(o, k, [q[0], q[2], q[3]], v, col);
}
function cap(o, k, r, y, v = 1) {
  for (const t of ShapeUtils.triangulateShape(
    r.map((q) => new Vector2(...q)),
    [],
  ))
    T(
      o,
      k,
      t.map((i) => [r[i][0], y, r[i][1]]),
      [0, v, 0],
    );
}
function solid(o, k, r, y, Y) {
  const s = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], Y, b[1]],
        [a[0], Y, a[1]],
      ],
      [s * (b[1] - a[1]), 0, s * (a[0] - b[0])],
    );
  }
  cap(o, k, r, Y);
  cap(o, k, r, y, -1);
}
const shifted = (i, k) => spine[i].map((v, j) => v + n.wallNormals[i][j] * k),
  quadStrip = (i, a, b) => [shifted(i, a), shifted(i + 1, a), shifted(i + 1, b), shifted(i, b)],
  S = [0];
for (let i = 1; i < spine.length; i++)
  S.push(S.at(-1) + Math.hypot(...sub(spine[i], spine[i - 1])));
export const wallLength = S.at(-1);
export function at(s, offset = 0) {
  s = Math.max(0, Math.min(wallLength, s));
  let i = S.findIndex((q, j) => j && q >= s);
  if (i < 1) i = 1;
  const t = (s - S[i - 1]) / (S[i] - S[i - 1]),
    q = spine[i - 1].map((v, j) => v + (spine[i][j] - v) * t),
    N = norm(n.wallNormals[i - 1].map((v, j) => v + (n.wallNormals[i][j] - v) * t));
  return { q: q.map((v, j) => v + N[j] * offset), N, index: i - 1 };
}
function beamLocal(o, k, a, b, w, d = w) {
  const local = {
    addTriangle(k, _r, q, v) {
      T(o, k, q, v);
    },
    addQuad(k, _r, q, v) {
      Q(o, k, q, v);
    },
    addConvexPolygon(k, _r, q, v) {
      for (let i = 1; i < q.length - 1; i++) T(o, k, [q[0], q[i], q[i + 1]], v);
    },
  };
  beam(local, k, a, b, w, d, C[k]);
}
function rail(o, path, heights, lod, width = 0) {
  for (const sign of width ? [-1, 1] : [0]) {
    const points = path.map((q, i) => {
      const a = path[Math.max(0, i - 1)],
        b = path[Math.min(path.length - 1, i + 1)],
        N = norm([b[1] - a[1], -(b[0] - a[0])]);
      return [
        q[0] + ((N[0] * width) / 2) * sign,
        heights[i] + A.railHeight,
        q[1] + ((N[1] * width) / 2) * sign,
      ];
    });
    if (!lod) {
      const local = {
        addTriangle(k, _r, q, v) {
          T(o, k, q, v);
        },
      };
      beamPath(local, 'rail', points, 0.065, 0.065, C.rail);
      for (const q of [points[0], points.at(-1)])
        beamLocal(o, 'rail', [q[0], q[1] - A.railHeight, q[2]], q, 0.055);
      continue;
    }
    for (let i = 1; i < points.length; i++) {
      beamLocal(o, 'rail', points[i - 1], points[i], lod ? 0.045 : 0.065);
      const count = lod ? Math.ceil(Math.hypot(...sub(points[i], points[i - 1])) / 2) : 1;
      for (let j = 0; j < count; j++) {
        const t = j / count,
          a = points[i - 1].map((v, k) => v + (points[i][k] - v) * t);
        beamLocal(o, 'rail', [a[0], a[1] - A.railHeight, a[2]], a, lod ? 0.035 : 0.055);
      }
    }
    const q = points.at(-1);
    beamLocal(o, 'rail', [q[0], q[1] - A.railHeight, q[2]], q, lod ? 0.035 : 0.055);
  }
}
function slopeStrip(o, path, heights, width) {
  const dirs = path.map((_q, i) => {
    const a = path[Math.max(0, i - 1)],
      b = path[Math.min(path.length - 1, i + 1)];
    return norm([b[1] - a[1], -(b[0] - a[0])]);
  });
  const q = (i, side, y) => [
    path[i][0] + (dirs[i][0] * side * width) / 2,
    y,
    path[i][1] + (dirs[i][1] * side * width) / 2,
  ];
  for (let i = 0; i < path.length - 1; i++) {
    const y = heights[i],
      Y = heights[i + 1];
    Q(o, 'basalt', [q(i, -1, y), q(i + 1, -1, Y), q(i + 1, 1, Y), q(i, 1, y)], [0, 1, 0]);
    Q(
      o,
      'basalt',
      [q(i, 1, -0.65), q(i + 1, 1, -0.65), q(i + 1, -1, -0.65), q(i, -1, -0.65)],
      [0, -1, 0],
    );
    for (const s of [-1, 1])
      Q(
        o,
        'basalt',
        [q(i, s, -0.65), q(i + 1, s, -0.65), q(i + 1, s, Y), q(i, s, y)],
        [s * dirs[i][0], 0, s * dirs[i][1]],
      );
  }
  for (const [i, v] of [
    [0, -1],
    [path.length - 1, 1],
  ])
    Q(
      o,
      'basalt',
      [q(i, -1, -0.65), q(i, 1, -0.65), q(i, 1, heights[i]), q(i, -1, heights[i])],
      [v * (path.at(-1)[0] - path[0][0]), 0, v * (path.at(-1)[1] - path[0][1])],
    );
  return path.flatMap((q, i) =>
    [-1, 1].map((s) => [q[0] + (dirs[i][0] * s * width) / 2, q[1] + (dirs[i][1] * s * width) / 2]),
  );
}
export const eastEntryOpening = [S.at(-2) - 1.7, S.at(-2) + 1.7];
function wall(o, lod) {
  for (let i = 0; i < spine.length - 1; i++) {
    const cuts = [S[i], ...eastEntryOpening.filter((s) => s > S[i] && s < S[i + 1]), S[i + 1]];
    for (let j = 1; j < cuts.length; j++) {
      const a = cuts[j - 1],
        b = cuts[j],
        mid = (a + b) / 2;
      if (mid > eastEntryOpening[0] && mid < eastEntryOpening[1]) continue;
      const q = at(a, 0).q,
        r = at(b, 0).q,
        Q = at(b, -A.wallThickness).q,
        P = at(a, -A.wallThickness).q;
      solid(o, 'marble', [P, Q, r, q], -0.25, A.wallHeight);
    }
  }
  if (!lod) return;
  const rows = lod === 0 ? 2 : lod === 1 ? 3 : 6,
    counts = lod < 2 ? Array(rows).fill(lod === 0 ? 18 : 43) : A.panelCounts;
  for (let row = 0; row < rows; row++)
    for (let j = 0; j < counts[row]; j++) {
      const a = (j / counts[row]) * wallLength + 0.002,
        b = ((j + 1) / counts[row]) * wallLength - 0.002,
        y = (row / rows) * A.wallHeight + 0.002,
        Y = ((row + 1) / rows) * A.wallHeight - 0.002,
        cuts = [
          a,
          ...[...S, ...eastEntryOpening].filter((s) => s > a && s < b).sort((a, b) => a - b),
          b,
        ];
      for (let k = 1; k < cuts.length; k++) {
        const mid = (cuts[k - 1] + cuts[k]) / 2;
        if (mid > eastEntryOpening[0] && mid < eastEntryOpening[1]) continue;
        const q = at(cuts[k - 1], 0.012),
          r = at(cuts[k], 0.012);
        Q(
          o,
          'marble',
          [
            [...q.q.slice(0, 1), y, q.q[1]],
            [r.q[0], y, r.q[1]],
            [r.q[0], Y, r.q[1]],
            [q.q[0], Y, q.q[1]],
          ],
          [q.N[0], 0, q.N[1]],
        );
      }
      panelEvidence.push({ row, column: j, start: a, end: b });
    }
}
function terrace(o, lod) {
  if (!lod) {
    for (let i = 0; i < spine.length - 1; i++) {
      const r = quadStrip(i, 0, A.deckWidth + A.riverStepCount * A.riverStepRun),
        top = r.map((q, j) => [q[0], j < 2 ? 0 : -0.45, q[1]]),
        bottom = r.map((q) => [q[0], -0.65, q[1]]),
        sign = area(r) > 0 ? 1 : -1;
      Q(o, 'basalt', top, [0, 1, 0]);
      Q(o, 'basalt', bottom, [0, -1, 0]);
      for (let j = 0; j < 4; j++) {
        const k = (j + 1) % 4;
        Q(
          o,
          'basalt',
          [bottom[j], bottom[k], top[k], top[j]],
          [sign * (r[k][1] - r[j][1]), 0, sign * (r[j][0] - r[k][0])],
        );
      }
    }
    return;
  }
  for (let i = 0; i < spine.length - 1; i++)
    solid(o, 'basalt', quadStrip(i, 0, A.deckWidth), -A.deckDepth, 0);
  const count = lod ? A.riverStepCount : 1,
    run = (A.riverStepRun * A.riverStepCount) / count,
    rise = (A.riverStepRise * A.riverStepCount) / count;
  for (let j = 0; j < count; j++)
    for (let i = 0; i < spine.length - 1; i++)
      solid(
        o,
        'basalt',
        quadStrip(i, A.deckWidth + j * run, A.deckWidth + (j + 1) * run),
        -0.65,
        -(j + 1) * rise,
      );
}
function westernStair(o, lod) {
  const [a, b] = n.westernStairs,
    L = Math.hypot(...sub(b, a)),
    u = sub(b, a).map((v) => v / L),
    N = [u[1], -u[0]],
    steps = lod ? 18 : 6,
    up = 3;
  for (let j = 0; j < steps; j++) {
    const t = j / steps,
      T = (j + 1) / steps,
      r = [-0.5, 0.5].flatMap((side, i) => {
        const f = i ? [T, t] : [t, T];
        return f.map((s) => [
          a[0] + u[0] * L * s + N[0] * side * A.westernStairWidth,
          a[1] + u[1] * L * s + N[1] * side * A.westernStairWidth,
        ]);
      }),
      y = up * (1 - j / steps);
    solid(o, 'basalt', r, -0.25, y);
    stairEvidence.push({
      center: [a[0] + (u[0] * L * (t + T)) / 2, a[1] + (u[1] * L * (t + T)) / 2],
      top: y,
    });
  }
  rail(o, n.westernStairs, [3, 0], lod, A.westernStairWidth);
}
function ramps(o, lod) {
  for (const [path, rise, width] of [
    [n.easternRamp, A.eastRampRise, A.eastRampWidth],
    [n.intermediateRamp, A.intermediateRampRise, A.intermediateRampWidth],
  ]) {
    const distances = [0];
    for (let i = 1; i < path.length; i++)
      distances.push(distances.at(-1) + Math.hypot(...sub(path[i], path[i - 1])));
    const heights = distances.map((v) => (v / distances.at(-1)) * rise);
    slopeStrip(o, path, heights, width);
    rail(o, path, heights, lod, width);
  }
}
function bench(o, b, lod) {
  let best = { distance: Infinity, s: 0 };
  for (let s = 0; s <= wallLength; s += 0.25) {
    const a = at(s),
      dist = Math.hypot(...sub(a.q, b.point));
    if (dist < best.distance) best = { distance: dist, s };
  }
  const a = at(best.s),
    u = [-a.N[1], a.N[0]],
    r = (w, d) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, z]) => [
        b.point[0] + (u[0] * x * w) / 2 + (a.N[0] * z * d) / 2,
        b.point[1] + (u[1] * x * w) / 2 + (a.N[1] * z * d) / 2,
      ]);
  if (!lod) solid(o, 'wood', r(A.benchLength, A.benchWidth), 0, A.benchHeight);
  else {
    const slats = lod === 1 ? 1 : 5;
    for (let j = 0; j < slats; j++) {
      const z = (j + 0.5) / slats - 0.5,
        center = b.point.map((v, k) => v + a.N[k] * z * A.benchWidth),
        q = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([x, t]) => [
          center[0] +
            (u[0] * x * A.benchLength) / 2 +
            (a.N[0] * t * (A.benchWidth / slats - 0.012)) / 2,
          center[1] +
            (u[1] * x * A.benchLength) / 2 +
            (a.N[1] * t * (A.benchWidth / slats - 0.012)) / 2,
        ]);
      solid(o, 'wood', q, A.benchHeight - 0.08, A.benchHeight);
    }
    for (const t of [-0.9, 0.9]) {
      const c = b.point.map((v, k) => v + u[k] * t),
        q = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([x, z]) => [
          c[0] + u[0] * x * 0.07 + a.N[0] * z * 0.23,
          c[1] + u[1] * x * 0.07 + a.N[1] * z * 0.23,
        ]);
      solid(o, 'basalt', q, 0, A.benchHeight - 0.08);
    }
  }
  benchEvidence.push({ id: b.id, center: b.point, top: A.benchHeight, backless: true });
}
export const touchstoneCenter = n.easternRamp.at(-1).map((v, k) => v + [-0.6, -0.2][k]);
function touchstone(o, lod) {
  const [x, z] = touchstoneCenter,
    base = A.eastRampRise;
  solid(
    o,
    'marble',
    rect(x - 0.475, x + 0.475, z - 0.4, z + 0.4),
    base - 0.05,
    base + A.plinthHeight,
  );
  const seg = [6, 8, 12, 16][lod],
    rings = [
      [-0.2, 0.72],
      [0, 1],
      [0.22, 0.82],
      [0.31, 0.18],
    ].map(([h, r]) =>
      Array.from({ length: seg }, (_, i) => {
        const a = (i / seg) * Math.PI * 2,
          v = 1 + 0.08 * Math.sin(i * 2.3 + h * 3);
        return [
          x + Math.cos(a) * A.pounamuRadii[0] * r * v,
          base + A.plinthHeight + 0.2 + h,
          z + Math.sin(a) * A.pounamuRadii[2] * r * v,
        ];
      }),
    );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < seg; i++)
      Q(
        o,
        'green',
        [rings[j - 1][i], rings[j - 1][(i + 1) % seg], rings[j][(i + 1) % seg], rings[j][i]],
        [Math.cos((i / seg) * 2 * Math.PI), 0.2, Math.sin((i / seg) * 2 * Math.PI)],
      );
  for (let i = 1; i < seg - 1; i++)
    T(o, 'green', [rings.at(-1)[0], rings.at(-1)[i], rings.at(-1)[i + 1]], [0, 1, 0]);
  if (lod)
    beamLocal(
      o,
      'rail',
      [x - 0.36, base + A.plinthHeight + 0.05, z - 0.29],
      [x - 0.36, base + A.plinthHeight + 0.05, z - 0.38],
      0.025,
    );
}
export function buildCanterburyEarthquakeMemorial(target, _frame, lod = 3) {
  for (const a of [partEvidence, panelEvidence, stairEvidence, benchEvidence]) a.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
    },
    part = (name, fn) => {
      const k = count;
      fn();
      partEvidence.push({ name, triangles: count - k });
    };
  part('whole-curved-marble-wall-native-central-controls-and-explicit-full-end-continuations', () =>
    wall(o, lod),
  );
  part('whole-seven-metre-basalt-promenade-and-river-edge-stepped-terrace', () => terrace(o, lod));
  part('whole-native-western-eighteen-step-flight-and-two-handrails', () => westernStair(o, lod));
  part('whole-five-control-eastern-and-intermediate-ramp-access-with-rails', () => ramps(o, lod));
  part('seven-native-backless-wood-seats', () => {
    for (const b of n.woodBenches) bench(o, b, lod);
  });
  part('intrinsic-entrance-marble-plinth-original-greenstone-and-water-outlet', () =>
    touchstone(o, lod),
  );
}
export const canterburyEarthquakeMemorialSkyline = (o) =>
    buildCanterburyEarthquakeMemorial(o, null, 0),
  canterburyEarthquakeMemorialDistrict = (o) => buildCanterburyEarthquakeMemorial(o, null, 1),
  canterburyEarthquakeMemorialStreet = (o) => buildCanterburyEarthquakeMemorial(o, null, 2),
  canterburyEarthquakeMemorialCloseup = (o) => buildCanterburyEarthquakeMemorial(o, null, 3);
const maskAt = (k) => spine.map((q, i) => q.map((v, j) => v + n.wallNormals[i][j] * k)),
  mask = [...maskAt(-0.6), ...maskAt(A.deckWidth + 1.35).reverse()];
const ribbon = (path, width) => {
  const a = path.map((q, i) => {
    const x = path[Math.max(0, i - 1)],
      y = path[Math.min(path.length - 1, i + 1)],
      N = norm([y[1] - x[1], -(y[0] - x[0])]);
    return [q.map((v, k) => v + (N[k] * width) / 2), q.map((v, k) => v - (N[k] * width) / 2)];
  });
  return [...a.map((v) => v[0]), ...a.map((v) => v[1]).reverse()];
};
export const canterburyEarthquakeMemorialModel = {
  id: 'canterbury_earthquake_national_memorial',
  key: 'canterbury_earthquake_national_memorial',
  cell: 'rb/rb6',
  title: 'Canterbury Earthquake National Memorial',
  wikidataId: 'Q28735451',
  category: 'memorial',
  recipe: 'canterbury-earthquake-memorial-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildCanterburyEarthquakeMemorial,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Complete current south-bank assembly: whole110m-scale curved marble wall/nearby marble-panel divisions,7m basalt promenade/river-edge steps, native18-step west stair and rails, native eastern/intermediate ramps,seven native backless wood seats and intrinsic entrance pounamu/plinth. Exact seven mapped central marble controls retained with explicit original full-end continuation using corresponding native boundary controls; no central53m-only substitute or broad river/garden parcel extrusion. Two exact2021Embassy specificDOSpublic-domain originals, published Qualla first. Original hidden/fine section/threshold estimates explicit.',
  camera: [-75, 32, -85],
  lookAt: [0, F + 1, 0],
  portableGroundY: F - 0.5,
  mediumFiContext: {
    scale: 1.5,
    groundY: F - 0.5,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
    far: 2000,
  },
  embeddedCanonicalGraphs: ['stone_marble', 'stone_basalt', 'metal_painted', 'wood_plain'],
  groundCutout: {
    outline: mask,
    additionalOutlines: [
      ribbon(n.westernStairs, A.westernStairWidth),
      ribbon(n.easternRamp, A.eastRampWidth),
      ribbon(n.intermediateRamp, A.intermediateRampWidth),
    ],
    basis:
      'Only physical wall/7m promenade/river-edge steps and exact access-ribbon volumes; never broad42-control memorial parcel or north planted park/river. Original source elevations unchanged.',
  },
  qaCameras: [
    {
      name: 'whole-curved-wall-and-riverside-terrace',
      position: [-80, 130, -100],
      lookAt: [0, F + 1, 0],
    },
    { name: 'whole-physical-wall-and-access-plan', position: [0, 170, 0.1], lookAt: [0, F, 0] },
    {
      name: 'whole-western-stair-eighteen-treads-and-rails',
      position: [-58, 18, 12],
      lookAt: [-45, F + 1.3, 22],
    },
    {
      name: 'east-ramp-entrance-plinth-and-greenstone',
      position: [touchstoneCenter[0] - 6, F + 4, touchstoneCenter[1] - 8],
      lookAt: [touchstoneCenter[0], F + 2, touchstoneCenter[1]],
    },
    {
      name: 'native-backless-wood-seats-and-marble-course',
      position: [-20, 18, -2],
      lookAt: [-15, F + 0.7, 13],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-memorial-${reviewLod}`,
    position: [-80, 130, -100],
    lookAt: [0, F + 1, 0],
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/canterbury-earthquake-memorial-runtime-overlay.mjs',
    level: 'skyline',
    export: 'canterburyEarthquakeMemorialSkyline',
    errorMeters: 0.55,
    surfaces,
    authoredLevels: {
      district: { export: 'canterburyEarthquakeMemorialDistrict', errorMeters: 0.09, surfaces },
      street: { export: 'canterburyEarthquakeMemorialStreet', errorMeters: 0.025, surfaces },
      closeup: { export: 'canterburyEarthquakeMemorialCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.authoringDirection,
    p.sectionBasis,
    'Whole proposed wall110.2146m versus primary110/111/112m descriptions. Actual seven central mapped marble points are exact; original full-end continuations follow corresponding native south-boundary stations without stretching controls. Site boundary is contextual evidence, not a claimed measured complete wall. Native18steps/12walkway/fiveeast/fiveintermediateramp/sevenwoodseat locations retained. Rearwall/thickness/panel arrangement/clear eastern entry opening and short end return/riveredge step section/bench dimensions/current details are bounded estimates. The inferred full-end wall is physically opened at the actual native ramp crossing, never an access-blocking solid wall.',
    'Original517-panel source census guides a six-row division with an explicit estimated clear eastern entry opening; actual panel layout is not surveyed. Panel surfaces use original6-row division, not an exact surveyed cladding census or copied inscription. Names/fine typography/plinth motifs not replaced with invented text. Pounamu natural outline/plinth/wateroutlet and precise entry position are explicit original estimates from primary material/weight facts, not a photogrammetric sculpture. No source pixels/people/ceremony/trees/independent bridge/buildings embedded.',
    'Original current unclassified256mfield is fixed. Terrace sits below street according to original pregeometry stair/ramp sections; footprint-owned terrain triangle openings preserve every source height. Exact host ground/threshold/contact and current repairs unverified; geographic preview/replacement false. North-bank landscaped park is context, not another fabricated building.',
  ],
};
