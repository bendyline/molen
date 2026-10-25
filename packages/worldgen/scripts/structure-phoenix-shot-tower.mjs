/** Phoenix Shot Tower: measured diameter controls, sparse openings and rounded crenellations. */
import './install-deterministic-math.mjs';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  brick = rgb('b7795e'),
  repair = rgb('ad725a'),
  crown = rgb('ad7562'),
  dark = rgb('323937'),
  sill = rgb('a39482'),
  stone = rgb('aaa69a'),
  glass = rgb('667775');
// HABS MD-21, sheet2: 215ft9in above first floor; first floor8in above grade.
// The 234ft popular figure is not the surveyed exposed shell height.
const firstFloor = 0.2032,
  crownTop = firstFloor + 65.7606,
  roofFloor = crownTop - 1.4732,
  crenelSpring = crownTop - 0.9144,
  baseRadius = 6.1087,
  topRadius = 3.0988,
  crownThickness = 0.4318,
  heightFraction = (y) => Math.max(0, Math.min(1, (y - firstFloor) / (roofFloor - firstFloor))),
  radius = (y) => baseRadius - (baseRadius - topRadius) * heightFraction(y),
  thickness = (y) => 1.6764 - (1.6764 - 0.5334) * heightFraction(y),
  doorSpring = firstFloor + 2.032,
  doorApex = firstFloor + 2.4384;

function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function point(a, y, inside = false) {
  const r = radius(y) - (inside ? thickness(y) : 0);
  return [r * Math.sin(a), y, r * Math.cos(a)];
}
// West elevation has four aligned windows. Centres are read from the drawing's
// measured height scale; hidden-side openings remain conservative approximations.
const openings = [
  { angle: 0, y0: firstFloor, y1: doorApex, width: 1.22, kind: 'door' },
  { angle: Math.PI / 2, y0: firstFloor, y1: 1.85, width: 0.88, kind: 'closed-low-aperture' },
  ...[10.2, 18.45, 43.85, 61.35].map((y) => ({
    angle: 0,
    y0: firstFloor + y - 0.8382,
    y1: firstFloor + y + 0.8382,
    width: 0.8636,
    kind: 'window',
  })),
  { angle: 1.38, y0: 24.6, y1: 26.45, width: 0.9, kind: 'estimated-side-window' },
  { angle: 1.38, y0: 51.8, y1: 53.3, width: 0.82, kind: 'estimated-side-window' },
  { angle: Math.PI, y0: 16, y1: 17.6, width: 0.86, kind: 'estimated-rear-window' },
  { angle: -Math.PI / 2, y0: 34.3, y1: 35.9, width: 0.86, kind: 'estimated-rear-window' },
];
function shell(o, d) {
  const holes = (d === 0 ? openings.slice(0, 1) : openings).map((h) => ({
      ...h,
      half: h.width / 2 / radius((h.y0 + h.y1) / 2),
    })),
    segments = d === 0 ? 10 : d === 1 ? 24 : d === 2 ? 48 : 96;
  const angles = [
    ...new Set([
      0,
      Math.PI * 2,
      ...Array.from({ length: segments }, (_, i) => (i / segments) * Math.PI * 2),
      ...holes.flatMap((h) =>
        [-1, 1].map(
          (s) => (((h.angle + s * h.half) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
        ),
      ),
    ]),
  ].sort((a, b) => a - b);
  const covers = (h, a) =>
    Math.abs(Math.atan2(Math.sin(a - h.angle), Math.cos(a - h.angle))) < h.half - 1e-7;
  const strip = (a, b, y0, y1) => {
    if (y1 - y0 < 1e-6) return;
    // Keep the buried cylindrical base separate from the measured exposed taper.
    if (y0 < firstFloor && y1 > firstFloor) {
      strip(a, b, y0, firstFloor);
      strip(a, b, firstFloor, y1);
      return;
    }
    for (const inside of [false, ...(d === 0 ? [] : [true])]) {
      const p = [
          point(a, y0, inside),
          point(b, y0, inside),
          point(b, y1, inside),
          point(a, y1, inside),
        ],
        normal = [
          Math.sin((a + b) / 2),
          y1 <= firstFloor ? 0 : (baseRadius - topRadius) / (roofFloor - firstFloor),
          Math.cos((a + b) / 2),
        ];
      quad(
        o,
        'brick',
        inside ? [...p].reverse() : p,
        inside ? normal.map((v) => -v) : normal,
        y0 >= 40 && y0 < 42 ? repair : brick,
      );
    }
  };
  for (let i = 0; i < angles.length - 1; i++) {
    const a = angles[i],
      b = angles[i + 1],
      mid = (a + b) / 2,
      omitted = holes.filter((h) => covers(h, mid)).sort((a, b) => a.y0 - b.y0);
    let y = -0.9;
    for (const h of omitted) {
      strip(a, b, y, h.y0);
      y = h.y1;
    }
    strip(a, b, y, roofFloor);
  }
  if (d > 0)
    for (const h of holes) {
      const a = h.angle - h.half,
        b = h.angle + h.half;
      for (const [angle, reverse] of [
        [a, false],
        [b, true],
      ]) {
        const p = [
          point(angle, h.y0, false),
          point(angle, h.y1, false),
          point(angle, h.y1, true),
          point(angle, h.y0, true),
        ];
        const n = [Math.cos(angle), 0, -Math.sin(angle)];
        quad(o, 'brick', reverse ? [...p].reverse() : p, reverse ? n.map((v) => -v) : n, brick);
      }
      for (const [y, sign] of [
        [h.y0, 1],
        [h.y1, -1],
      ])
        quad(
          o,
          'brick',
          [point(a, y, false), point(b, y, false), point(b, y, true), point(a, y, true)],
          [0, sign, 0],
          brick,
        );
    }
  // The exterior photograph has a thin repair band, not a decorative belt around every storey.
  if (d > 1)
    for (const y of [40.8, 62.2])
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2,
          b = ((i + 1) / segments) * Math.PI * 2,
          p = [point(a, y - 0.025), point(b, y - 0.025), point(b, y + 0.025), point(a, y + 0.025)];
        for (const v of p) {
          const r = Math.hypot(v[0], v[2]);
          v[0] *= (r + 0.008) / r;
          v[2] *= (r + 0.008) / r;
        }
        quad(o, 'brick', p, [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)], repair);
      }
}
function archedDoor(o, d) {
  const z = radius(1),
    q = facing(o, 0, 0, z),
    half = 0.61,
    spring = doorSpring,
    apex = doorApex;
  if (d === 0) {
    face(q, 'metal', 0, firstFloor, -0.13, 1.16, doorApex - firstFloor, dark);
    return;
  }
  // Segmental brick arch over a deeply revealed heavy iron door.
  const rise = apex - spring,
    r = (half * half + rise * rise) / (2 * rise),
    cy = apex - r,
    theta = Math.asin(half / r),
    p = [];
  for (let j = 0; j <= 12; j++) {
    const a = -theta + (j / 12) * theta * 2;
    p.push([r * Math.sin(a), cy + r * Math.cos(a)]);
  }
  for (let j = 0; j < p.length - 1; j++) {
    const a = p[j],
      b = p[j + 1];
    quad(
      q,
      'brick',
      [
        [a[0], a[1], 0.027],
        [b[0], b[1], 0.027],
        [b[0], doorApex + 0.01, 0.027],
        [a[0], doorApex + 0.01, 0.027],
      ],
      [0, 0, 1],
      brick,
    );
    if (d > 1)
      beam(q, 'brick', [a[0], a[1] + 0.11, 0.045], [b[0], b[1] + 0.11, 0.045], 0.16, 0.14, repair);
  }
  const panel = [
    [-half, firstFloor, -0.16],
    [half, firstFloor, -0.16],
    ...[...p].reverse().map(([x, y]) => [x, y, -0.16]),
  ];
  q.addConvexPolygon('metal', ref, panel, [0, 0, 1], (v) => [v[0], v[1]], dark);
  for (const x of [-0.56, 0.56])
    B(q, 'metal', x, firstFloor, -0.14, 0.04, doorSpring - firstFloor, 0.06, dark);
  B(q, 'metal', 0, firstFloor, -0.12, 0.025, doorSpring - firstFloor, 0.04, dark);
  if (d > 1) {
    for (const y of [0.7, 1.6]) B(q, 'metal', -0.55, y, -0.08, 0.22, 0.055, 0.055, dark);
    B(q, 'metal', 0.24, 1.0, -0.07, 0.12, 0.025, 0.08, sill);
    B(q, 'stone', 0, firstFloor - 0.1, 0.29, 1.42, 0.1, 0.75, stone);
  }
}
function windows(o, d) {
  if (d === 0) return;
  for (const h of openings.slice(1)) {
    const y = (h.y0 + h.y1) / 2,
      r = radius(y),
      t = thickness(y),
      q = facing(o, h.angle, r * Math.sin(h.angle), r * Math.cos(h.angle)),
      w = h.width * 0.92;
    face(
      q,
      h.kind === 'closed-low-aperture' ? 'metal' : 'glass',
      0,
      h.y0,
      -t * 0.65,
      w,
      h.y1 - h.y0,
      h.kind === 'closed-low-aperture' ? dark : glass,
    );
    B(q, 'stone', 0, h.y0 - 0.11, -0.035, w + 0.16, 0.11, 0.28, sill);
    if (d > 1) {
      for (const x of [-w / 2, w / 2])
        B(q, 'metal', x, h.y0, -0.08, 0.055, h.y1 - h.y0, 0.08, dark);
      for (const y of [h.y0, h.y1]) B(q, 'metal', 0, y, -0.08, w, 0.055, 0.08, dark);
      for (const y of [h.y0 + (h.y1 - h.y0) / 3, h.y0 + ((h.y1 - h.y0) * 2) / 3])
        B(q, 'metal', 0, y, -0.1, w, 0.035, 0.06, dark);
      B(q, 'metal', 0, h.y0, -0.1, 0.035, h.y1 - h.y0, 0.06, dark);
    }
  }
}
function merlon(o, d, a) {
  const centre = topRadius - crownThickness / 2,
    q = facing(o, a, centre * Math.sin(a), centre * Math.cos(a)),
    w = 0.85,
    spring = crenelSpring,
    n = d === 0 ? 3 : d === 1 ? 5 : d === 2 ? 8 : 12,
    points = [
      [-w / 2, crenelSpring - 0.025],
      [w / 2, crenelSpring - 0.025],
      [w / 2, spring],
    ];
  for (let j = 1; j <= n; j++) {
    const a = (j / n) * Math.PI;
    points.push([(w / 2) * Math.cos(a), spring + (crownTop - crenelSpring) * Math.sin(a)]);
  }
  const front = points.map(([x, y]) => [x, y, crownThickness / 2]),
    back = points.map(([x, y]) => [x, y, -crownThickness / 2]);
  q.addConvexPolygon('crown', ref, front, [0, 0, 1], (p) => [p[0], p[1]], crown);
  q.addConvexPolygon('crown', ref, [...back].reverse(), [0, 0, -1], (p) => [p[0], p[1]], crown);
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length,
      p = [front[i], back[i], back[j], front[j]];
    quad(q, 'crown', p, normalFor(...p), crown);
  }
}
function top(o, d) {
  const n = d === 0 ? 12 : d === 1 ? 24 : d === 2 ? 48 : 80,
    profile = [
      [roofFloor - 0.1, topRadius],
      [crenelSpring, topRadius],
    ];
  loft(
    o,
    'crown',
    profile.map(([y, r]) => radialRing(y, r, r, n)),
    crown,
    { cap: false },
  );
  loft(
    o,
    'crown',
    [
      radialRing(roofFloor, topRadius - crownThickness, topRadius - crownThickness, n).reverse(),
      radialRing(crenelSpring, topRadius - crownThickness, topRadius - crownThickness, n).reverse(),
    ],
    crown,
    { cap: false },
  );
  const r0 = topRadius - crownThickness,
    r1 = profile.at(-1)[1];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2;
    quad(
      o,
      'crown',
      [
        [r0 * Math.sin(a), crenelSpring, r0 * Math.cos(a)],
        [r1 * Math.sin(a), crenelSpring, r1 * Math.cos(a)],
        [r1 * Math.sin(b), crenelSpring, r1 * Math.cos(b)],
        [r0 * Math.sin(b), crenelSpring, r0 * Math.cos(b)],
      ],
      [0, 1, 0],
      crown,
    );
  }
  const deck = radialRing(
    roofFloor,
    topRadius - crownThickness + 0.01,
    topRadius - crownThickness + 0.01,
    n,
  );
  o.addConvexPolygon('roof', ref, deck, [0, 1, 0], (p) => [p[0], p[2]], repair);
  for (let i = 0; i < 10; i++) merlon(o, d, (i / 10) * Math.PI * 2);
  if (d > 1) {
    for (const a of [-0.45, 2.3]) {
      for (const [y, yy] of [
        [0.2, 22],
        [22, 45],
        [45, roofFloor],
      ]) {
        const p = point(a, y),
          q = point(a, yy);
        for (const v of [p, q]) {
          const r = Math.hypot(v[0], v[2]);
          v[0] *= (r + 0.04) / r;
          v[2] *= (r + 0.04) / r;
        }
        beam(o, 'metal', p, q, 0.025, 0.025, sill);
      }
      const x = Math.sin(a) * (topRadius - crownThickness / 2),
        z = Math.cos(a) * (topRadius - crownThickness / 2);
      beam(o, 'metal', [x, crenelSpring, z], [x, crownTop + 0.225, z], 0.025, 0.025, sill);
    }
  }
}
export function phoenixShotTower(o, _frame, d = 3) {
  const n = d === 0 ? 12 : d === 1 ? 24 : d === 2 ? 48 : 80;
  loft(
    o,
    'stone',
    [radialRing(-0.85, 6.22, 6.22, n), radialRing(firstFloor, 6.22, 6.22, n)],
    stone,
  );
  // Only the narrow own footing/entry tread; no park, plaza or terrain replacement.
  B(o, 'stone', 0, -0.18, 6.48, 1.55, firstFloor + 0.18, 1.05, stone);
  shell(o, d);
  archedDoor(o, d);
  windows(o, d);
  top(o, d);
}
export function phoenixShotTowerSkyline(o) {
  phoenixShotTower(o, undefined, 0);
}
export function phoenixShotTowerDistrict(o) {
  phoenixShotTower(o, undefined, 1);
}
export function phoenixShotTowerStreet(o) {
  phoenixShotTower(o, undefined, 2);
}
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.93, metallic: 0 },
  crown: { slot: 'wall', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.15 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.35, metallic: 0.1 },
};
export const phoenixShotTowerModel = {
  id: 'phoenix_shot_tower',
  key: 'phoenix_shot_tower',
  recipe: 'structure-phoenix-shot-tower.mjs',
  cell: 'dq/dqc',
  title: 'Phoenix Shot Tower',
  brief:
    'Tall tapering red brick shot tower, four aligned west windows and sparse secondary openings, deep segmental arched iron entrance, subtle repair bands, surveyed ten-battlement concrete crown with a muted red painted appearance and flat roof deck, lightning conductors and narrow own footing/entry tread. Neighboring buildings, park monuments and flag fixtures excluded.',
  camera: [-45, 47, 68],
  lookAt: [0, 34, 0],
  qaCameras: [
    { name: 'front', position: [0, 35, 150], lookAt: [0, 35, 0] },
    { name: 'front-detail', position: [-10, 69, 17], lookAt: [0, 64.8, 0] },
    { name: 'back', position: [82, 48, -125], lookAt: [0, 33, 0] },
    { name: 'base-detail', position: [-12, 8, 19], lookAt: [0, 3, 0] },
  ],
  mediumFiContext: { scale: 1.25 },
  build: phoenixShotTower,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Dry main entrance approach[0,7.2] gives datum4.1156m in preserved unmodified Terrarium. Mapped ground varies about-.130..+.128m across the tower, with foundations reaching-.85m and a shallow own entry tread/threshold meeting the street-side grade. Current source contact and signed orientation reviewed as a bounded preview; coarse urban terrain and other host datasets remain limitations. Footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-phoenix-shot-tower.mjs',
    level: 'skyline',
    export: 'phoenixShotTowerSkyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'phoenixShotTowerDistrict', errorMeters: 0.2, surfaces },
      street: { export: 'phoenixShotTowerStreet', errorMeters: 0.08, surfaces },
    },
  },
  limitations: [
    'HABS MD-21 government1936floor plans/section/west elevation now control the whole exterior:40ft1inbase,20ft4intop,215ft9inabovefirstfloor,8infirstfloor/grade difference,ten battlements and four aligned west windows. Crown peak65.9638maboveapproach; lightning conductors extend0.225mfurther. Earlier71m/16merlon interpretation and attribution/aerial imagery are excluded. Dimensions on the original sheets take precedence over coarse72m/13.4m map attributes and popular234ftfigures. Sheet measurements are a historical survey of the standing shell, not certification of every current repair.',
    'Flat roof deck, ten elongated rounded battlements and closed bent-plate segmental iron entrance retained. Fine crown profiles, red painted finish, lightning conductors, patching, door hardware and unseen secondary openings remain original medium-fi approximations; the drawings do not establish exact present paint/repairs. The south low aperture remains a conservative closed opening, not a second certified entrance. Interiors, neighboring pavilion/buildings, park sculptures/fences/signs, tour banners and flag fixtures excluded; no photographic pixels redistributed.',
    'Independent native terrain retained unchanged. Foundation/entrance and signed orientation reviewed as a bounded preview. Coarse urban ground and other host terrain compatibility remain limitations; footprint replacement disabled.',
  ],
};
