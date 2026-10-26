/** Original 1906 concrete tower, reconstructed from the cleared 1907 section. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const A = p.parameters.architecturalSections;
const C = {
  wall: rgb('c8c6bb'),
  stone: rgb('aaa89b'),
  metal: rgb('525d60'),
  roof: rgb('6a7475'),
  glass: rgb('3d5258'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.18 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.76, metallic: 0.23 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43, metallic: 0.1 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const unit = (v) => v.map((q) => q / Math.hypot(...v));
const point = (r, y, a) => [r * Math.cos(a), y + p.parameters.floorY, r * Math.sin(a)];
function T(o, k, q, n) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...c) < 1e-8) return;
  if (n && dot(c, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    C[k],
  );
}
function Q(o, k, q, n) {
  T(o, k, q.slice(0, 3), n);
  T(o, k, [q[0], q[2], q[3]], n);
}
function disk(o, k, r, y, N, up = true, inner = 0) {
  for (let i = 0; i < N; i++) {
    const a = (i * 2 * Math.PI) / N,
      b = ((i + 1) * 2 * Math.PI) / N;
    if (inner)
      Q(
        o,
        k,
        [point(inner, y, a), point(r, y, a), point(r, y, b), point(inner, y, b)],
        [0, up ? 1 : -1, 0],
      );
    else
      T(
        o,
        k,
        [[0, y + p.parameters.floorY, 0], point(r, y, a), point(r, y, b)],
        [0, up ? 1 : -1, 0],
      );
  }
}
function lathe(o, k, profile, N, caps = true) {
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < N; i++) {
      const [r0, y0] = profile[j - 1],
        [r1, y1] = profile[j],
        a = (i * 2 * Math.PI) / N,
        b = ((i + 1) * 2 * Math.PI) / N,
        m = (a + b) / 2;
      Q(
        o,
        k,
        [point(r0, y0, a), point(r0, y0, b), point(r1, y1, b), point(r1, y1, a)],
        [(y1 - y0) * Math.cos(m), r0 - r1, (y1 - y0) * Math.sin(m)],
      );
    }
  if (caps) {
    disk(o, k, profile[0][0], profile[0][1], N, false);
    disk(o, k, profile.at(-1)[0], profile.at(-1)[1], N);
  }
}
function beam(o, k, a, b, width) {
  const v = unit(sub(b, a)),
    u = unit(cross(v, Math.abs(v[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])),
    w = unit(cross(v, u));
  const R = (q) =>
      [
        [1, 1],
        [-1, 1],
        [-1, -1],
        [1, -1],
      ].map(([s, t]) => q.map((x, i) => x + (width / 2) * (s * u[i] + t * w[i]))),
    aa = R(a),
    bb = R(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, k, [aa[i], aa[j], bb[j], bb[i]], sub(aa[i], a));
  }
  Q(
    o,
    k,
    aa,
    v.map((x) => -x),
  );
  Q(o, k, bb, v);
}
function radius(profile, y) {
  for (let i = 1; i < profile.length; i++)
    if (y <= profile[i][1] + 1e-8) {
      const [a, b] = [profile[i - 1], profile[i]],
        t = (y - a[1]) / (b[1] - a[1]);
      return a[0] + t * (b[0] - a[0]);
    }
  return profile.at(-1)[0];
}
function skin(o, profile, N, holes, detail) {
  const ys = [
    ...new Set([...profile.map((q) => q[1]), ...holes.flatMap((h) => [h.y0, h.y1])]),
  ].sort((a, b) => a - b);
  const angles = [
    ...Array.from({ length: N + 1 }, (_, i) => (i * 2 * Math.PI) / N),
    ...holes.flatMap((h) => [h.a0, h.a1]),
  ]
    .sort((a, b) => a - b)
    .filter((a, i, all) => !i || a - all[i - 1] > 1e-7);
  for (let j = 1; j < ys.length; j++)
    for (let i = 1; i < angles.length; i++) {
      const a = angles[i - 1],
        b = angles[i],
        y0 = ys[j - 1],
        y1 = ys[j],
        m = (a + b) / 2,
        ym = (y0 + y1) / 2;
      if (holes.some((h) => m > h.a0 && m < h.a1 && ym > h.y0 && ym < h.y1)) continue;
      const r0 = radius(profile, y0),
        r1 = radius(profile, y1);
      Q(
        o,
        'wall',
        [point(r0, y0, a), point(r0, y0, b), point(r1, y1, b), point(r1, y1, a)],
        [(y1 - y0) * Math.cos(m), r0 - r1, (y1 - y0) * Math.sin(m)],
      );
    }
  for (const h of holes) {
    const r0 = radius(profile, h.y0),
      r1 = radius(profile, h.y1),
      depth = h.door ? A.doorRecess : A.windowRecess,
      front = [
        point(r0, h.y0, h.a0),
        point(r0, h.y0, h.a1),
        point(r1, h.y1, h.a1),
        point(r1, h.y1, h.a0),
      ],
      back = [
        point(r0 - depth, h.y0, h.a0),
        point(r0 - depth, h.y0, h.a1),
        point(r1 - depth, h.y1, h.a1),
        point(r1 - depth, h.y1, h.a0),
      ],
      m = (h.a0 + h.a1) / 2;
    Q(o, h.door ? 'metal' : 'glass', back, [Math.cos(m), 0, Math.sin(m)]);
    Q(o, 'wall', [front[0], front[3], back[3], back[0]], [-Math.sin(h.a0), 0, Math.cos(h.a0)]);
    Q(o, 'wall', [front[1], back[1], back[2], front[2]], [Math.sin(h.a1), 0, -Math.cos(h.a1)]);
    Q(o, 'wall', [front[0], back[0], back[1], front[1]], [0, 1, 0]);
    Q(o, 'wall', [front[3], front[2], back[2], back[3]], [0, -1, 0]);
    if (detail > 1) {
      for (let i = 0; i < 4; i++) beam(o, 'metal', back[i], back[(i + 1) % 4], 0.045);
      if (!h.door)
        beam(
          o,
          'metal',
          point(radius(profile, (h.y0 + h.y1) / 2) - depth + 0.025, (h.y0 + h.y1) / 2, h.a0),
          point(radius(profile, (h.y0 + h.y1) / 2) - depth + 0.025, (h.y0 + h.y1) / 2, h.a1),
          0.035,
        );
    }
  }
  disk(o, 'wall', profile[0][0], profile[0][1], N, false);
  disk(o, 'wall', profile.at(-1)[0], profile.at(-1)[1], N);
}
function gallery(o, g, N, detail) {
  lathe(
    o,
    'wall',
    [
      [g.radius - 0.2, g.y0],
      [g.radius, g.y0 + 0.1],
      [g.radius, g.y1],
    ],
    N,
  );
  const base = g.y1,
    top = g.railTop;
  for (const y of [base + (top - base) * 0.48, top]) {
    if (detail)
      lathe(
        o,
        'metal',
        [
          [g.railRadius - 0.025, y - 0.025],
          [g.railRadius + 0.025, y - 0.025],
          [g.railRadius + 0.025, y + 0.025],
          [g.railRadius - 0.025, y + 0.025],
          [g.railRadius - 0.025, y - 0.025],
        ],
        N,
        false,
      );
    else
      lathe(
        o,
        'metal',
        [
          [g.railRadius, y - 0.025],
          [g.railRadius, y + 0.025],
        ],
        N,
        false,
      );
  }
  if (detail) {
    const count = [0, 8, 12, 20][detail];
    for (let i = 0; i < count; i++) {
      const a = (i * 2 * Math.PI) / count;
      beam(
        o,
        'metal',
        point(g.railRadius, base, a),
        point(g.railRadius, top, a),
        detail === 1 ? 0.045 : 0.055,
      );
    }
    const braces = [0, 8, 12, 16][detail];
    for (let i = 0; i < braces; i++) {
      const a = (i * 2 * Math.PI) / braces;
      beam(
        o,
        'wall',
        point(g.radius - 0.85, g.y0 - 0.75, a),
        point(g.radius - 0.1, g.y0 + 0.1, a),
        0.15,
      );
    }
  }
}
export function buildManiguin(o, _frame, detail = 3) {
  const N = [10, 20, 40, 80][detail];
  lathe(
    o,
    'stone',
    [
      [3.35, -0.2],
      [3.35, 0],
      [3.2, 0.06],
    ],
    N,
  );
  const holes = detail
    ? [
        { a0: Math.PI / 2 - 0.18, a1: Math.PI / 2 + 0.18, y0: 0.45, y1: 2.65, door: true },
        ...A.shaftWindowY.map(([y0, y1]) => ({
          a0: (3 * Math.PI) / 2 - 0.14,
          a1: (3 * Math.PI) / 2 + 0.14,
          y0,
          y1,
        })),
      ]
    : [];
  skin(o, A.shaftProfile, N, holes, detail);
  gallery(o, A.lowerGallery, N, detail);
  const watchHoles = detail
    ? Array.from({ length: 4 }, (_, i) => ({
        a0: Math.PI / 4 + (i * Math.PI) / 2 - 0.14,
        a1: Math.PI / 4 + (i * Math.PI) / 2 + 0.14,
        y0: 23.88,
        y1: 24.84,
      }))
    : [];
  skin(o, A.watchroomProfile, N, watchHoles, detail);
  gallery(o, A.upperGallery, N, detail);
  lathe(o, 'wall', A.lanternProfile, N);
  const panels = detail === 3 ? 12 : 8,
    y0 = A.lanternWindowY[0],
    y1 = A.lanternWindowY[1];
  for (let i = 0; i < panels; i++) {
    const a = (i * 2 * Math.PI) / panels,
      b = ((i + 1) * 2 * Math.PI) / panels,
      m = (a + b) / 2;
    Q(
      o,
      'glass',
      [
        point(A.lanternRadius, y0, a),
        point(A.lanternRadius, y0, b),
        point(A.lanternRadius, y1, b),
        point(A.lanternRadius, y1, a),
      ],
      [Math.cos(m), 0, Math.sin(m)],
    );
    if (detail)
      beam(
        o,
        'metal',
        point(A.lanternRadius + 0.035, y0, a),
        point(A.lanternRadius + 0.035, y1, a),
        0.055,
      );
  }
  if (detail)
    lathe(
      o,
      'metal',
      [
        [A.lanternRadius + 0.07, y0],
        [A.lanternRadius + 0.07, y0 + 0.07],
      ],
      N,
      false,
    );
  lathe(o, 'roof', A.roofProfile, N);
  lathe(
    o,
    'metal',
    [
      [0.085, 29.2],
      [0.085, 29.45],
      [0.018, A.height],
    ],
    Math.max(6, N / 2),
  );
  if (!detail) {
    // Closed distance panels preserve aperture rhythm without advertising an interior.
    for (const [y0, y1] of A.shaftWindowY) {
      const a = (3 * Math.PI) / 2 - 0.14,
        b = (3 * Math.PI) / 2 + 0.14;
      Q(
        o,
        'glass',
        [
          point(radius(A.shaftProfile, y0) + 0.018, y0, a),
          point(radius(A.shaftProfile, y0) + 0.018, y0, b),
          point(radius(A.shaftProfile, y1) + 0.018, y1, b),
          point(radius(A.shaftProfile, y1) + 0.018, y1, a),
        ],
        [0, 0, -1],
      );
    }
  }
}
export const maniguinSkyline = (o) => buildManiguin(o, null, 0);
export const maniguinDistrict = (o) => buildManiguin(o, null, 1);
export const maniguinStreet = (o) => buildManiguin(o, null, 2);
export const maniguinCloseup = (o) => buildManiguin(o, null, 3);
export const maniguinModel = {
  id: 'maniguin_island_lighthouse',
  key: 'maniguin_island_lighthouse',
  cell: 'wd/wdn',
  title: 'Maniguin Island Lighthouse',
  wikidataId: 'Q6749580',
  orientationPolicy: 'approximate-visualization',
  recipe: 'maniguin-island-lighthouse-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  category: 'lighthouse',
  brief:
    'Whole original1906 concrete lighthouse, exacthistoricnativepoint distinctfrommodernreplacement: splayedcylindricalshaft, twoopenrailedgalleries/corbels/watchroom, physicaldoor/windowrecesses, lantern/curvedmetalroof/finial. Historic1907 publicdomainsection informs profile; currentfinish/hiddenfaces/doorbearing unsurveyed. Detachedkeeperhouse/ruins/modernreplacement excluded.',
  surfaces,
  build: buildManiguin,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  camera: [38, 22, 42],
  lookAt: [0, 14, 0],
  portableGroundY: -0.25,
  mediumFiContext: { scale: '1', groundY: -0.25 },
  qaCameras: [
    {
      name: 'whole-original-tower-splayed-base-double-galleries-and-cupola',
      position: [35, 20, 42],
      lookAt: [0, 14, 0],
    },
    {
      name: 'opposite-shaft-window-recesses-and-original-profile',
      position: [-28, 18, -35],
      lookAt: [0, 14, 0],
    },
    {
      name: 'two-open-guardrails-corbels-watchroom-and-lantern',
      position: [12, 28, 13],
      lookAt: [0, 25, 0],
    },
    {
      name: 'closed-entrance-in-physical-recess-and-splayed-base',
      position: [9, 4, 11],
      lookAt: [0, 2, 0],
    },
    {
      name: 'whole-top-plan-of-concentric-galleries-and-native-anchor',
      position: [12, 48, 10],
      lookAt: [0, 16, 0],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/maniguin-runtime-overlay.mjs',
    level: 'skyline',
    export: 'maniguinSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'maniguinDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'maniguinStreet', errorMeters: 0.3, surfaces },
      closeup: { export: 'maniguinCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Only exactpublished419x7811907Americansection/elevation/plan original adopted; explicitPD-US/SpencerCosby/ASCE1907publication pinned. Historicdrawing isstructuralreference, notcurrentconditionphotography. Hero/unbuiltSpanishdesign/unrelatedCorregidorimagery unselected. No newprotectedphotos/generatedbitmaps/copiedtexturepixels/article/media/rightsmetadata repairs. Tower29.6m nativeheight retained; radii/windowcensus/lanternfaceting/corbels/hiddenwalls/finish originalboundedestimates. Interiorstair/lens/keeperhouse/ruins/modernreplacement/terrain/lettering excluded.',
    'Independent400m129x129field/16641values/oneoriginalrawtile frozen beforefloor0/profilesections. Fixed29.8472m provider datum remains independent; exactfooting/thresholdcontact unresolved. Nativepoint anchorsoriginaltower, notdrawnfootprint; doorazimuth reviewed180degreeapproximation. Geographicpreview/replaceFootprint=false; nofit/flatten/reacquire.',
  ],
};
