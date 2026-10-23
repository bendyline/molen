/** Original San Jose Electric Light Tower, dated1881: four open pipe legs, tapered lattice and arc-light crown. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/9q/9q9/san_jose_electric_light_tower/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  A = p.parameters,
  ref = 'palette:#ffffff',
  C = { iron: rgb('665f50'), brick: rgb('91745c'), lamp: rgb('d6d1b7') },
  surfaces = {
    iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.6 },
    brick: { slot: 'foundation', graph: 'brick', roughness: 0.95, metallic: 0 },
    lamp: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.5, metallic: 0.05 },
  };
export function sanJoseTowerGround(x, z) {
  const u = Math.max(0, Math.min(127.9999, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(127.9999, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  return (
    (g.heightsMeters[j][i] * (1 - a) + g.heightsMeters[j][i + 1] * a) * (1 - b) +
    (g.heightsMeters[j + 1][i] * (1 - a) + g.heightsMeters[j + 1][i + 1] * a) * b -
    g.modelDatumElevationMeters
  );
}
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
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function axial(o, s, a, b, r, n = 6, r1 = r, col = C[s]) {
  const v = b.map((v, k) => v - a[k]),
    l = Math.hypot(...v),
    axis = v.map((v) => v / l),
    u0 = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((v) => v / Math.hypot(...u0)),
    vv = cross(axis, u),
    R = (c, r) =>
      Array.from({ length: n }, (_, i) => {
        const t = (i * 2 * Math.PI) / n;
        return c.map((v, k) => v + r * (Math.cos(t) * u[k] + Math.sin(t) * vv[k]));
      }),
    B = R(a, r),
    D = R(b, r1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(
      o,
      s,
      [B[i], B[j], D[j], D[i]],
      B[i].map((v, k) => v - a[k]),
      col,
    );
    T(
      o,
      s,
      [a, B[j], B[i]],
      axis.map((v) => -v),
      col,
    );
    T(o, s, [b, D[i], D[j]], axis, col);
  }
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  const A = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [x + (i * w) / 2, y, z + (j * l) / 2]),
    B = A.map((v) => [v[0], y + h, v[2]]);
  Q(o, s, [...A].reverse(), [0, -1, 0], col);
  Q(o, s, B, [0, 1, 0], col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [A[i], A[j], B[j], B[i]], [A[j][2] - A[i][2], 0, A[i][0] - A[j][0]], col);
  }
}
const Y = (y) => A.floorY + y,
  half = (y) => 12 - ((12 - A.topHalfWidth) * y) / 61.8,
  corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ],
  V = (k, y) => [corners[k][0] * half(y), Y(y), corners[k][1] * half(y)];
function member(o, a, b, r, d, r1 = r) {
  axial(o, 'iron', a, b, r, [3, 4, 6, 10][d], r1);
}
function leg(o, k, d) {
  const r = 0.21;
  member(o, V(k, 0), V(k, 61.8), r, d, 0.075);
  const [x, , z] = V(k, 0),
    n = d < 2 ? 0 : d === 2 ? 4 : 8;
  box(
    o,
    'brick',
    x,
    sanJoseTowerGround(x, z) - 0.12,
    z,
    1.8,
    Y(0) - sanJoseTowerGround(x, z) + 0.12,
    1.8,
  );
  box(o, 'iron', x, Y(-0.03), z, 1.3, 0.12, 1.3);
  if (d > 0)
    for (const t of [-1, 1])
      for (const s of [-1, 1]) {
        const a = [x + t * 0.46, Y(0.09), z + s * 0.46];
        axial(o, 'iron', a, [a[0], Y(0.32), a[2]], 0.045, d === 1 ? 3 : 6);
      }
  if (n)
    for (let j = 1; j <= n; j++) {
      const y = (j * 61.8) / (n + 1),
        a = V(k, y),
        b = [a[0], a[1] + 0.1, a[2]];
      axial(o, 'iron', a, b, 0.24 * (1 - y / 85), d === 2 ? 6 : 10);
    }
}
function arches(o, d) {
  const N = [3, 6, 12, 20][d];
  for (let f = 0; f < 4; f++) {
    let prev;
    for (let j = 0; j <= N; j++) {
      const t = j / N,
        u = 2 * t - 1,
        y = A.archSpring + (A.archCrown - A.archSpring) * (1 - u * u),
        h = half(y),
        a = corners[f],
        b = corners[(f + 1) % 4],
        q = [(a[0] * (1 - t) + b[0] * t) * h, Y(y), (a[1] * (1 - t) + b[1] * t) * h];
      if (prev) member(o, prev, q, 0.16, d);
      prev = q;
    }
  }
}
function lattice(o, d) {
  const levels = d === 0 ? [12, 26, 40, 54, 61.8] : A.bayHeights;
  for (const y of levels)
    for (let f = 0; f < 4; f++) member(o, V(f, y), V((f + 1) % 4, y), 0.095, d);
  for (let j = 1; j < levels.length; j++)
    for (let f = 0; f < 4; f++) {
      const a = V(f, levels[j - 1]),
        b = V((f + 1) % 4, levels[j]),
        c = V((f + 1) % 4, levels[j - 1]),
        e = V(f, levels[j]);
      if (d === 0) {
        if ((j + f) % 2) member(o, a, b, 0.065, d);
        else member(o, c, e, 0.065, d);
      } else {
        member(o, a, b, 0.065, d);
        member(o, c, e, 0.065, d);
        if (d > 1) {
          const q = a.map((v, k) => (v + b[k]) / 2),
            n = f % 2 === 0 ? [0, 0, 1] : [1, 0, 0];
          axial(
            o,
            'iron',
            q,
            q.map((v, k) => v + n[k] * 0.12),
            0.14,
            d === 2 ? 4 : 8,
          );
        }
      }
    }
}
function lampCrown(o, d) {
  const y = 61.75;
  box(o, 'iron', 0, Y(y), 0, 2.5, 0.18, 2.5);
  if (d > 0) {
    for (let f = 0; f < 4; f++) {
      const a = corners[f],
        b = corners[(f + 1) % 4];
      member(o, [a[0] * 1.2, Y(y + 1), a[1] * 1.2], [b[0] * 1.2, Y(y + 1), b[1] * 1.2], 0.035, d);
      member(o, [a[0] * 1.2, Y(y), a[1] * 1.2], [a[0] * 1.2, Y(y + 1), a[1] * 1.2], 0.035, d);
    }
  }
  for (let j = 0; j < 6; j++) {
    const t = (j * Math.PI) / 3,
      x = 0.9 * Math.cos(t),
      z = 0.9 * Math.sin(t);
    if (d === 0) box(o, 'lamp', x, Y(62), z, 0.22, 0.6, 0.22);
    else {
      member(o, [0, Y(62.75), 0], [x, Y(62.75), z], 0.045, d);
      axial(o, 'iron', [x, Y(62.7), z], [x, Y(62), z], 0.085, d === 1 ? 4 : d === 2 ? 6 : 10);
      axial(
        o,
        'lamp',
        [x, Y(62.03), z],
        [x, Y(62.28), z],
        0.13,
        d === 1 ? 4 : d === 2 ? 6 : 10,
        0.1,
      );
    }
  }
  // Six carbon arc lamps sit below a shallow shared protective/diffusing shield.
  const n = [6, 8, 16, 24][d];
  axial(o, 'iron', [0, Y(62.83), 0], [0, Y(63.0936), 0], 1.4, n, 0.85);
  member(o, [0, Y(63.0936), 0], [0, Y(72.2376), 0], 0.055, d, 0.025);
}
function ladder(o, d) {
  if (d < 2) return;
  const lower = V(0, 4),
    upper = V(0, 61),
    inset = 0.25,
    point = (t) => [
      lower[0] + (upper[0] - lower[0]) * t + inset,
      lower[1] + (upper[1] - lower[1]) * t,
      lower[2] + (upper[2] - lower[2]) * t + inset,
    ];
  for (const x of [-0.2, 0.2]) {
    const a = point(0),
      b = point(1);
    member(o, [a[0] + x, a[1], a[2]], [b[0] + x, b[1], b[2]], 0.025, d);
  }
  const n = d === 2 ? 72 : 144;
  for (let j = 0; j <= n; j++) {
    const q = point(j / n);
    member(o, [q[0] - 0.22, q[1], q[2]], [q[0] + 0.22, q[1], q[2]], 0.022, d);
  }
}
function build(o, _f, d = 3) {
  for (let k = 0; k < 4; k++) leg(o, k, d);
  arches(o, d);
  lattice(o, d);
  lampCrown(o, d);
  ladder(o, d);
}
export const sanJoseTowerSkyline = (o, f) => build(o, f, 0),
  sanJoseTowerDistrict = (o, f) => build(o, f, 1),
  sanJoseTowerStreet = (o, f) => build(o, f, 2),
  sanJoseTowerCloseup = (o, f) => build(o, f, 3);
export const sanJoseElectricLightTowerModel = {
  id: 'san_jose_electric_light_tower',
  key: 'san_jose_electric_light_tower',
  cell: '9q/9q9',
  recipe: 'structure-san-jose-electric-light-tower.mjs',
  title: 'San Jose Electric Light Tower',
  category: 'tower',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [98, 67, 115],
  lookAt: [0, 34, 0],
  mediumFiContext: { scale: 1.6 },
  qaCameras: [
    {
      name: 'whole-original-four-leg-open-lattice-tower-and-flagpole',
      position: [98, 67, 115],
      lookAt: [0, 34, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'open-street-arches-four-independent-brick-footings-and-pipe-legs',
      position: [32, 9, 38],
      lookAt: [0, 9, 0],
    },
    {
      name: 'tapered-square-xbraces-horizontal-girts-and-maintenance-access',
      position: [24, 37, 28],
      lookAt: [0, 35, 0],
    },
    {
      name: 'six-carbon-arc-lamps-service-platform-shield-and-thirty-foot-flagpole',
      position: [8, 66, 9],
      lookAt: [0, 63, 0],
    },
  ],
  appearance: p.appearance,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-san-jose-electric-light-tower.mjs',
    level: 'skyline',
    export: 'sanJoseTowerSkyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: {
      district: { export: 'sanJoseTowerDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'sanJoseTowerStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'sanJoseTowerCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'Dated original1881 reconstruction, current-world excluded;1977HistoryPark115ftreplica notmodeled. Fourfoot24msquare span, lowerarchcurve/bracebaycensus, pipegauges, brickpiersections, accessladder routing, colors, lamp/reflector/serviceplatformhardware approximate from one contemporaneous print. Sixarclamps/207ftframe/30ftpole from primarytext; later incandescentstrings/repairs/collapse notrepresented.',
    'One individually inspected exact published H.G.Peelor10Dec1881 HarperWeeklyp821 public-domain illustration with original bytes/native revision and dated citation. Qualla heroCCreplicaphoto and othercity/CCmediaunused. No supplementalimages/photographictextures/generatedbitmaps/borrowedmesh.',
    'Independent256m129square16641-sample modernsourcefield/four originalTerrariumtiles frozenbeforegeometry. Provider27.1207mintersectiondatum and fourpier tops1.2m fixed, foundationtoes sample unchangedmodernfield; original1881pavement elevations/hostcontactunverified. No groundflattening/fitting/reacquisition or whole-intersectionplatform; dated geographicpreview only.',
    'Four LODs retain four splayed legs, openarchedstreetspan, tapering lattice and lamptop/shield/flagpole. Skyline alternates single diagonals/reducedbaycount; district restoresXbraces; nearpipeflanges/crossbolts/ladderrungs/crown hardware added.',
  ],
};
