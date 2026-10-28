/** Whole three-part ensemble; fixed native physical plans and bounded exterior sections. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  { floorY: F, axisU: U, axisV: V, architecturalSections: A } = p.parameters;
const C = {
  wall: rgb('d1c9b7'),
  foundation: rgb('bbb5a5'),
  bronze: rgb('526b5a'),
  metal: rgb('66776e'),
  dark: rgb('373c38'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_travertine', roughness: 0.9, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.7, metallic: 0.65 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.3 },
  dark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.8, metallic: 0 },
};
export const partEvidence = [],
  nativeEvidence = [],
  columnEvidence = [],
  stairEvidence = [],
  nicheEvidence = [];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  triangulate = (r, holes = []) =>
    ShapeUtils.triangulateShape(
      r.map((q) => new Vector2(...q)),
      holes.map((r) => r.map((q) => new Vector2(...q))),
    );
export const toWorld = (q) => [U[0] * q[0] + V[0] * q[2], F + q[1], U[1] * q[0] + V[1] * q[2]],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]],
  rings = new Map(
    frame.features.map((f) => [
      Number(f.id.split('/')[1]),
      f.outline.slice(0, -1).map((q) => [dot(q, U), dot(q, V)]),
    ]),
  );
function T(o, k, q, n, col = C[k]) {
  q = q.map((q) => toWorld(q).map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, direction(n)) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function B(o, k, a, b, w, d, col = C[k]) {
  if (Math.hypot(...sub(b, a)) > 1e-6) beam(o, k, toWorld(a), toWorld(b), w, d, col);
}
function cap(o, k, r, y, up = true) {
  for (const ix of triangulate(r))
    T(
      o,
      k,
      ix.map((i) => [r[i][0], y, r[i][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function solid(o, k, r, y, Y, { top = true, bottom = false, skip = [], col = C[k] } = {}) {
  const s = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    if (skip.includes(i)) continue;
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
      col,
    );
  }
  if (top) cap(o, k, r, Y);
  if (bottom) cap(o, k, r, y, false);
}
const rect = (x, X, z, Z) => [
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ],
  center = (r) => [0, 1].map((k) => r.reduce((s, q) => s + q[k], 0) / r.length),
  bbox = (r) => [
    Math.min(...r.map((q) => q[0])),
    Math.min(...r.map((q) => q[1])),
    Math.max(...r.map((q) => q[0])),
    Math.max(...r.map((q) => q[1])),
  ];
function nativeSolid(o, id, y, Y, _lod, opts = {}) {
  const r = rings.get(id);
  solid(o, 'wall', r, y, Y, opts);
  for (const q of r) nativeEvidence.push({ id, point: toWorld([q[0], Y, q[1]]) });
}
function facade(a, b, r) {
  const d = sub(b, a),
    L = Math.hypot(...d),
    u = d.map((v) => v / L),
    s = area(r) > 0 ? 1 : -1,
    n = [s * u[1], -s * u[0]];
  return {
    a,
    b,
    L,
    u,
    n,
    P: (t, y, v = 0) => [a[0] + u[0] * t + n[0] * v, y, a[1] + u[1] * t + n[1] * v],
  };
}
function niche(o, lod) {
  const r = rings.get(238911535),
    f = facade(r.at(-1), r[0], r),
    c = f.L / 2,
    R = A.nicheRadius,
    N = [4, 8, 16, 24][lod],
    hole = [
      [c - R, A.nicheBottom],
      [c + R, A.nicheBottom],
      [c + R, A.nicheSpring],
    ];
  for (let j = 1; j <= N; j++) {
    const t = (j * Math.PI) / N;
    hole.push([c + R * Math.cos(t), A.nicheSpring + R * Math.sin(t)]);
  }
  hole.push([c - R, A.nicheBottom]);
  const outer = [
      [0, A.baseTop],
      [f.L, A.baseTop],
      [f.L, A.proaTop],
      [0, A.proaTop],
    ],
    cut = hole.slice(0, -1),
    points = [...outer, ...cut];
  for (const ix of triangulate(outer, [cut]))
    T(
      o,
      'wall',
      ix.map((i) => f.P(points[i][0], points[i][1])),
      [f.n[0], 0, f.n[1]],
    );
  for (const ix of triangulate(cut))
    T(
      o,
      'wall',
      ix.map((i) => f.P(cut[i][0], cut[i][1], -A.nicheDepth)),
      [f.n[0], 0, f.n[1]],
    );
  for (let i = 0; i < cut.length; i++) {
    const a = cut[i],
      b = cut[(i + 1) % cut.length],
      n = [f.u[0] * (b[1] - a[1]), a[0] - b[0], f.u[1] * (b[1] - a[1])];
    Q(
      o,
      'wall',
      [
        f.P(a[0], a[1]),
        f.P(a[0], a[1], -A.nicheDepth),
        f.P(b[0], b[1], -A.nicheDepth),
        f.P(b[0], b[1]),
      ],
      n,
    );
  }
  nicheEvidence.push({
    ...f,
    center: c,
    bottom: A.nicheBottom,
    spring: A.nicheSpring,
    radius: R,
    depth: A.nicheDepth,
  });
  const q = f.P(c, A.baseTop, -A.nicheDepth + 0.25);
  statue(o, [q[0], A.baseTop + 0.5, q[2]], 5.8, lod, 'bronze', true);
}
function round(o, k, x, z, y, Y, r, R, N) {
  const ring = (yy, rr) =>
      Array.from({ length: N }, (_, i) => [
        x + rr * Math.cos((2 * Math.PI * i) / N),
        yy,
        z + rr * Math.sin((2 * Math.PI * i) / N),
      ]),
    a = ring(y, r),
    b = ring(Y, R);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N,
      t = (2 * Math.PI * (i + 0.5)) / N;
    Q(o, k, [a[i], a[j], b[j], b[i]], [Math.cos(t), 0, Math.sin(t)]);
    T(o, k, [[x, Y, z], b[i], b[j]], [0, 1, 0]);
  }
}
function statue(o, q, h, lod, k = 'wall', wings = false) {
  const [x, y, z] = q,
    n = lod === 0 ? 4 : lod === 1 ? 6 : 8;
  if (lod === 0) {
    T(
      o,
      k,
      [
        [x - 0.5, y, z],
        [x + 0.5, y, z],
        [x, y + h, z],
      ],
      [0, 0, 1],
    );
    return;
  }
  round(o, k, x, z, y, y + h * 0.72, h * 0.12, h * 0.09, n);
  round(o, k, x, z, y + h * 0.74, y + h * 0.93, h * 0.065, h * 0.065, n);
  for (const s of [-1, 1]) {
    B(o, k, [x + s * h * 0.065, y, z], [x + s * h * 0.06, y + h * 0.38, z], h * 0.1, h * 0.1);
    B(
      o,
      k,
      [x + s * h * 0.08, y + h * 0.68, z],
      [x + s * h * 0.18, y + h * 0.43, z + h * 0.06],
      h * 0.07,
      h * 0.08,
    );
  }
  if (wings)
    for (const s of [-1, 1])
      Q(
        o,
        k,
        [
          [x + s * h * 0.06, y + h * 0.65, z + 0.08],
          [x + s * h * 0.3, y + h * 0.79, z + 0.2],
          [x + s * h * 0.24, y + h * 0.44, z + 0.24],
          [x + s * h * 0.09, y + h * 0.4, z + 0.14],
        ],
        [0, 0, 1],
      );
}
export function courtHeight(u) {
  if (u <= A.courtUpperU) return A.courtHigh;
  if (u >= A.courtLowerU) return A.courtLow;
  const j = Math.floor(((u - A.courtUpperU) / (A.courtLowerU - A.courtUpperU)) * A.civicStepCount);
  return A.courtHigh - ((j + 1) * (A.courtHigh - A.courtLow)) / A.civicStepCount;
}
function court(o, lod) {
  const low = -11,
    high = 31,
    ss = [
      [-49, A.courtUpperU, A.courtHigh],
      [A.courtLowerU, 66, A.courtLow],
    ],
    N = A.civicStepCount,
    step = (A.courtLowerU - A.courtUpperU) / N,
    rise = (A.courtHigh - A.courtLow) / N;
  for (const [a, b, y] of ss)
    Q(
      o,
      'foundation',
      [
        [a, y, low],
        [b, y, low],
        [b, y, high],
        [a, y, high],
      ],
      [0, 1, 0],
    );
  for (let j = 0; j < N; j++) {
    const a = A.courtUpperU + j * step,
      b = a + step,
      y = A.courtHigh - (j + 1) * rise,
      Y = y + rise;
    Q(
      o,
      'foundation',
      [
        [a, y, low],
        [b, y, low],
        [b, y, high],
        [a, y, high],
      ],
      [0, 1, 0],
    );
    Q(
      o,
      'foundation',
      [
        [a, y, low],
        [a, y, high],
        [a, Y, high],
        [a, Y, low],
      ],
      [1, 0, 0],
    );
    stairEvidence.push({ a, b, y, rise, width: high - low });
  }
  for (const z of [low, high])
    for (const [a, b, y] of [...ss, ...stairEvidence.map((q) => [q.a, q.b, q.y])]) {
      if (lod === 0) continue;
      Q(
        o,
        'foundation',
        [
          [a, A.foundationBottom, z],
          [b, A.foundationBottom, z],
          [b, y, z],
          [a, y, z],
        ],
        [0, 0, z === low ? -1 : 1],
      );
    }
  for (const z of [low, high]) {
    for (const [a, b] of [
      [-49, A.courtUpperU],
      [A.courtUpperU, A.courtLowerU],
      [A.courtLowerU, 66],
    ]) {
      const y = courtHeight(a + 0.001),
        Y = courtHeight(b - 0.001);
      B(o, 'wall', [a, y + 0.55, z], [b, Y + 0.55, z], 0.8, 1.1);
    }
  }
  // Intrinsic ceremonial farolas, with no copied flag images or neighboring property.
  if (lod > 0)
    for (const z of [low, high])
      for (let j = 0; j < 11; j++) {
        const x = -22 + j * 7.4,
          y = courtHeight(x) + 1;
        B(o, 'bronze', [x, y, z], [x, y + A.flagpoleHeight, z], 0.12, 0.12);
        if (lod > 1) {
          B(
            o,
            'bronze',
            [x - 0.5, y + A.flagpoleHeight - 0.6, z],
            [x + 0.5, y + A.flagpoleHeight - 0.6, z],
            0.1,
            0.1,
          );
          for (const s of [-1, 1])
            round(
              o,
              'metal',
              x + s * 0.5,
              z,
              y + A.flagpoleHeight - 0.75,
              y + A.flagpoleHeight - 0.4,
              0.2,
              0.1,
              6,
            );
        }
      }
}
function colonnade(o, lod) {
  const roof = rings.get(320708977),
    box = bbox(roof);
  if (lod === 0) {
    const c = center(roof);
    // Keep every native roof control while simplifying millimetric edge noise at distance.
    for (let i = 0; i < roof.length; i++) {
      const a = roof[i],
        b = roof[(i + 1) % roof.length];
      T(
        o,
        'wall',
        [
          [c[0], A.propylaeumTop, c[1]],
          [a[0], A.propylaeumTop, a[1]],
          [b[0], A.propylaeumTop, b[1]],
        ],
        [0, 1, 0],
      );
      nativeEvidence.push({ id: 320708977, point: toWorld([a[0], A.propylaeumTop, a[1]]) });
    }
    solid(o, 'wall', [roof[0], roof[38], roof[39], roof[77]], A.propylaeumSoffit, A.propylaeumTop, {
      top: false,
    });
  } else nativeSolid(o, 320708977, A.propylaeumSoffit, A.propylaeumTop, lod, { bottom: true });
  for (const [id, Y] of [
    [459011972, A.endNorthTop],
    [459011973, A.endSouthTop],
  ])
    nativeSolid(o, id, A.propylaeumFloor, Y, lod);
  for (let row = 0; row < 2; row++)
    for (let j = 0; j < A.columnCountPerRow; j++) {
      const v = -7.65 + j * (35.05 / 11),
        u = row === 0 ? box[0] + 0.45 : box[2] - 0.45,
        r = rect(u - 0.45, u + 0.45, v - A.columnWidth / 2, v + A.columnWidth / 2);
      solid(o, 'wall', r, A.propylaeumFloor, A.propylaeumSoffit, { top: lod > 0 });
      columnEvidence.push({
        row,
        index: j,
        center: [u, v],
        width: 0.9,
        depth: A.columnWidth,
        bottom: A.propylaeumFloor,
        top: A.propylaeumSoffit,
      });
    }
  // The votive vessel: original bounded geometric reconstruction, no inscription pixels.
  const x = (box[0] + box[2]) / 2,
    z = 9.8,
    y = A.propylaeumFloor,
    N = [4, 8, 12, 16][lod];
  solid(o, 'wall', rect(x - 2.4, x + 2.4, z - 2.4, z + 2.4), y, y + 0.35);
  round(o, 'bronze', x, z, y + 0.35, y + 0.65, 1.9, 1.75, N);
  round(o, 'bronze', x, z, y + 0.65, y + 1.8, 1.5, 1.5, N);
  round(o, 'bronze', x, z, y + 1.8, y + 2.35, 1.5, 0.65, N);
  round(o, 'bronze', x, z, y + 2.35, y + 2.6, 0.85, 1.0, N);
  if (lod > 1)
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const X = x + Math.cos(a) * 1.55,
        Z = z + Math.sin(a) * 1.55;
      B(o, 'bronze', [X, y + 0.8, Z], [X, y + 1.3, Z], 0.15, 0.15);
    }
}
function tower(o, lod) {
  nativeSolid(o, 318264532, A.foundationBottom, A.baseTop, lod);
  nativeSolid(o, 238911535, A.baseTop, A.proaTop, lod, { skip: [5] });
  niche(o, lod);
  nativeSolid(o, 240021765, A.towerBodyBottom, A.towerBodyTop, lod);
  nativeSolid(o, 238911534, A.towerBodyTop, A.towerShoulderTop, lod);
  nativeSolid(o, 239013389, A.crownBase, A.crownTop, lod);
  const r = rings.get(239013389),
    c = center(r);
  for (let i = 0; i < r.length; i++)
    T(
      o,
      'wall',
      [
        [r[i][0], A.crownTop, r[i][1]],
        [r[(i + 1) % r.length][0], A.crownTop, r[(i + 1) % r.length][1]],
        [c[0], A.roofPeak, c[1]],
      ],
      [0, 1, 0],
    );
  const sp = rings.get(509102470);
  nativeSolid(o, 509102470, A.baseTop, 12, lod, { top: false });
  for (let i = 0; i < sp.length; i++) {
    const a = sp[i],
      b = sp[(i + 1) % sp.length];
    T(
      o,
      'wall',
      [
        [a[0], 12, a[1]],
        [b[0], 12, b[1]],
        [86.3, 9.21, 9.5],
      ],
      [0, 1, 0],
    );
  }
  // Bounded travertine pedestals and abstract sculptural masses preserve the main exterior rhythm.
  for (const q of [
    [67, 19, 24],
    [80, 19, 24],
    [67, -4, 24],
    [80, -4, 24],
  ]) {
    solid(o, 'wall', rect(q[0] - 0.9, q[0] + 0.9, q[1] - 0.9, q[1] + 0.9), 7, 9);
    statue(o, [q[0], 9, q[1]], 4.4, lod, 'bronze');
  }
  solid(o, 'wall', rect(88.1, 91, 8, 11), 12, 16);
  statue(o, [89.5, 16, 9.5], 6, lod, 'bronze', true);
  if (lod > 0) {
    for (const [u, v, nx, nz] of [
      [69.1, 9.2, -1, 0],
      [77.75, 9.25, 1, 0],
      [73.4, 5.17, 0, -1],
      [73.3, 13.19, 0, 1],
    ]) {
      const R = 0.85,
        N = lod === 1 ? 12 : 32;
      for (let j = 0; j < N; j++) {
        const a = (j * 2 * Math.PI) / N,
          b = ((j + 1) * 2 * Math.PI) / N,
          P = (t, rr) => [
            u + (nz ? Math.cos(t) * rr : nx * 0.025),
            47 + Math.sin(t) * rr,
            v + (nx ? Math.cos(t) * rr : nz * 0.025),
          ];
        T(o, 'bronze', [[u, 47, v], P(a, R), P(b, R)], [nx, 0, nz]);
        if (lod > 1) B(o, 'wall', P(a, R), P(a, R * 1.24), 0.08, 0.07);
      }
    }
  }
  if (lod > 1) {
    // Small horizontal stone-joint geometry supplements the shared metric travertine graph.
    const rr = rings.get(238911535);
    for (let i = 0; i < rr.length; i++) {
      if (i === 5) continue;
      const a = rr[i],
        b = rr[(i + 1) % rr.length],
        f = facade(a, b, rr);
      for (let y = 8; y < 24; y += 0.7)
        B(o, 'wall', f.P(0, y, 0.018), f.P(f.L, y, 0.018), 0.015, 0.02, rgb('a69f91'));
    }
  }
}
export function buildNationalFlagMemorial(target, _frame, lod = 3) {
  for (const a of [partEvidence, nativeEvidence, columnEvidence, stairEvidence, nicheEvidence])
    a.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
      addQuad(...a) {
        count += 2;
        target.addQuad(...a);
      },
      addConvexPolygon(...a) {
        count += a[2].length - 2;
        target.addConvexPolygon(...a);
      },
    },
    part = (name, fn) => {
      const n = count;
      fn();
      partEvidence.push({ name, triangles: count - n });
    };
  part('whole-rising-civic-staircourt-and-intrinsic-parapets-farolas', () => court(o, lod));
  part('full-seventy-metre-stepped-tower-proa-and-genuine-recessed-arch', () => tower(o, lod));
  part('whole-seventy-eight-control-raised-propylaeum-roof-open-colonnade-and-votive-vessel', () =>
    colonnade(o, lod),
  );
}
export const nationalFlagMemorialSkyline = (o) => buildNationalFlagMemorial(o, null, 0),
  nationalFlagMemorialDistrict = (o) => buildNationalFlagMemorial(o, null, 1),
  nationalFlagMemorialStreet = (o) => buildNationalFlagMemorial(o, null, 2),
  nationalFlagMemorialCloseup = (o) => buildNationalFlagMemorial(o, null, 3);
export const nationalFlagMemorialModel = {
  id: 'national_flag_memorial',
  key: 'national_flag_memorial',
  cell: '6d/6dh',
  title: 'National Flag Memorial',
  wikidataId: 'Q798629',
  category: 'memorial',
  recipe: 'national-flag-memorial-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildNationalFlagMemorial,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole NationalFlagMemorial ensemble in native9component plans: pale travertine70mtower/cross-shapedshaft/steppedcrown, layeredproa and genuinely recessed archedniche, rising30step civiccourt/parapets/22farolas, full78controlraisedpropylaeumroof above24freecolumns/twoendpiers and intrinsic votivevessel. Qualla41families first,8distinctexactBelgrano2009ownPD exteriororiginals. Hiddenprofiles/currentcondition/proablockheight/columncensus and sculpturalmasses are originalboundedestimates; notsurvey orphotogrammetry.',
  camera: toWorld([165, 125, 220]),
  lookAt: toWorld([20, 27, 10]),
  portableGroundY: F - 0.8,
  mediumFiContext: { cameraYaw: 1.8, groundY: F - 0.8, scale: 2.4 },
  embeddedCanonicalGraphs: [
    'stone_travertine',
    'concrete_plain',
    'metal_bronze_cast',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'whole-tower-proa-civic-stairs-and-open-propylaeum',
      position: toWorld([155, 120, 220]),
      lookAt: toWorld([20, 27, 10]),
    },
    {
      name: 'whole-nine-component-native-plan',
      position: toWorld([23, 280, 10.1]),
      lookAt: toWorld([23, 5, 10]),
    },
    {
      name: 'full-propylaeum-columns-raised-roof-and-votive-vessel',
      position: toWorld([-5, 35, 61]),
      lookAt: toWorld([-36, 24, 10]),
    },
    {
      name: 'western-tower-arched-niche-stepped-base-and-civiccourt',
      position: toWorld([24, 25, 15]),
      lookAt: toWorld([70, 17, 9.3]),
    },
    {
      name: 'river-facing-proa-cross-shaped-shaft-and-stepped-crown',
      position: toWorld([135, 52, -32]),
      lookAt: toWorld([74, 32, 9]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/national-flag-memorial-runtime-overlay.mjs',
    level: 'skyline',
    export: 'nationalFlagMemorialSkyline',
    errorMeters: 9,
    surfaces,
    authoredLevels: {
      district: { export: 'nationalFlagMemorialDistrict', errorMeters: 1.4, surfaces },
      street: { export: 'nationalFlagMemorialStreet', errorMeters: 0.3, surfaces },
      closeup: { export: 'nationalFlagMemorialCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.dimensionBasis,
    p.sectionBasis,
    'Eight exact2009Belgrano photographer-ownPD originals after publishedQualla41familysearch. No publication-unbound/PD-art/Flickr/questionableimages or protectedoperatorphoto/drawingpixels used. No imagepixels embedded.',
    'Actual9nativeparts/183XZcontrols retained, relationextentcontextonly. Civiccourt plan/levels/columncensus/hiddenproabodyheight and niches/doors/medallions/urn are originalboundedreconstruction. Ambiguousnative12mproablocktag notaltered; photo-estimated24m body explicitlydistinguished. No belowgroundcrypt/galleryinteriors orneighborcathedral/council/parks/roads.',
    'Figurative artwork, inscriptions and finehistoricreliefs are simplified originalabstract masses/geometricmedallions, not exactsculpture reproductions. No fountainwater/animatedfire/flagpixels. Distantthinfarolas omitted.',
    'Originalindependent512m129field/one rawtile/floor/sections fixedbeforegeometry; negativeproviderartifactsretained unchanged andgroundcontactunverified. Geographicpreview/replacementfalse; isolatedflatstage andsyntheticneighbors are reviewfixtures.',
  ],
};
