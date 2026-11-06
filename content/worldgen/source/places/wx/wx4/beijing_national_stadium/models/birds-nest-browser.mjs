/** Individual Bird's Nest browser geometry. The detailed source master is unchanged. */
import {
  cross,
  loft,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { face } from '../../../../../../../../packages/worldgen/scripts/stadium-models.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const T = Math.PI * 2;
const steel = [0.69, 0.71, 0.68],
  red = [0.51, 0.028, 0.022];
const concrete = [0.53, 0.55, 0.51],
  white = [0.86, 0.88, 0.85];
const E = (x, z, a, y = 0) => [x * Math.sin(a), y, z * Math.cos(a)];
export const birdsNestRoofY = (x, z) => 55 + 13 * (x / 149) ** 2 - 14 * (z / 166.5) ** 2;
const roofNormal = (p) => normalize([(-26 * p[0]) / 149 ** 2, 1, (28 * p[2]) / 166.5 ** 2]);
export function birdsNestFacade(a, t, depth = 0) {
  const s = 0.9 + 0.1 * Math.sin((t * Math.PI) / 2) + 0.035 * Math.sin(t * Math.PI);
  return [
    (149 * s - depth) * Math.sin(a),
    (41 + 27 * Math.sin(a) ** 2) * t,
    (166.5 * s - depth) * Math.cos(a),
  ];
}
const facadeNormal = (p) => normalize([p[0] / 149 ** 2, -0.1 / 166.5, p[2] / 166.5 ** 2]);
export const birdsNestBrowserSurfaces = {
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.66 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.92 },
  membrane: { slot: 'roof', graph: 'membrane', roughness: 0.86 },
  plastic: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.78 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.35 },
  turf: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1 },
};
function strip(o, points, width, normal, flat = false) {
  const rings = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)];
    const axis = normalize(b.map((v, k) => v - a[k]));
    const across = normalize(cross(axis, normal(p))),
      other = cross(axis, across);
    return [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([u, v]) => p.map((x, k) => x + (across[k] * u * width) / 2 + other[k] * v * 0.6));
  });
  if (!flat) return loft(o, 'metal', rings, steel);
  for (let i = 1; i < rings.length; i++) {
    const ps = [rings[i - 1][0], rings[i - 1][1], rings[i][1], rings[i][0]];
    face(o, 'metal', ps, steel, normal(points[i]));
    face(
      o,
      'metal',
      [...ps].reverse(),
      steel,
      normal(points[i]).map((x) => -x),
    );
  }
}
const path = (n, fn) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
function shell(o, S) {
  for (let i = 0; i < 24; i++) {
    const a = (T * i) / 24;
    for (const sign of [-1, 1])
      strip(
        o,
        path(S.leaf, (t) => birdsNestFacade(a + sign * 0.063 * Math.sin(Math.PI * t), t)),
        S.width,
        facadeNormal,
        S.flat,
      );
    if (S.back)
      strip(
        o,
        path(S.leaf, (t) => birdsNestFacade(a, t, 10)),
        1.2,
        facadeNormal,
      );
    if (S.web)
      for (let j = 0; j < S.web; j++) {
        const t = j / S.web,
          u = (j + 1) / S.web;
        strip(
          o,
          [
            birdsNestFacade(a + 0.063 * Math.sin(Math.PI * t), t),
            birdsNestFacade(a - 0.063 * Math.sin(Math.PI * u), u),
          ],
          1.2,
          facadeNormal,
        );
      }
  }
  for (let i = 0; i < S.secondary; i++)
    for (const sign of [-1, 1]) {
      const a = (T * i) / S.secondary;
      strip(
        o,
        path(S.leaf, (t) =>
          birdsNestFacade(a + sign * (0.16 * t + 0.38 * Math.sin((t * Math.PI) / 2)), t, -0.1),
        ),
        S.width,
        facadeNormal,
        S.flat,
      );
    }
  for (let row = 0; row < S.hoops; row++)
    strip(
      o,
      path(S.n, (a) =>
        birdsNestFacade(a * T, 0.16 + row * 0.2 + 0.075 * Math.sin(a * T * 3 + row * 1.4), -0.14),
      ),
      1.2,
      facadeNormal,
    );
}
function roof(o, S) {
  for (let i = 0; i < S.n; i++)
    for (let j = 0; j < S.radial; j++) {
      const point = (a, t, dy) => {
        const x = (62 + 87 * t) * Math.sin(a),
          z = (91 + 75.5 * t) * Math.cos(a);
        return [x, birdsNestRoofY(x, z) + dy, z];
      };
      const a = (T * i) / S.n,
        b = (T * (i + 1)) / S.n,
        t = j / S.radial,
        u = (j + 1) / S.radial;
      const ps = [point(a, t, -0.25), point(b, t, -0.25), point(b, u, -0.25), point(a, u, -0.25)];
      face(o, 'membrane', ps, white, [0, 1, 0]);
      if (S.under)
        face(
          o,
          'membrane',
          [point(a, t, -12.3), point(b, t, -12.3), point(b, u, -12.3), point(a, u, -12.3)],
          white,
          [0, -1, 0],
        );
    }
  for (let i = 0; i < S.trusses; i++) {
    const a = (T * i) / S.trusses,
      p = E(149, 166.5, a);
    const angle =
      Math.atan2(p[0] / 62, p[2] / 91) + Math.acos(1 / Math.hypot(p[0] / 62, p[2] / 91));
    const q = E(62, 91, angle),
      d = [q[0] - p[0], q[2] - p[2]];
    const length =
      (-2 * ((p[0] * d[0]) / 149 ** 2 + (p[2] * d[1]) / 166.5 ** 2)) /
      (d[0] ** 2 / 149 ** 2 + d[1] ** 2 / 166.5 ** 2);
    const top = path(S.roofSegments, (t) => {
      const x = p[0] + d[0] * length * t,
        z = p[2] + d[1] * length * t;
      return [x, birdsNestRoofY(x, z) + 0.38, z];
    });
    strip(o, top, S.width, roofNormal, S.flat);
    if (S.roofWeb) {
      const low = top.map((p) => [p[0], p[1] - 12, p[2]]);
      strip(o, low, 1.2, roofNormal);
      for (let j = 1; j < top.length; j++) strip(o, [top[j - 1], low[j]], 0.62, roofNormal);
    }
  }
  if (S.secondaryRoof)
    for (const angle of [0.31, 1.17, 2.34])
      for (let offset = -126; offset <= 126; offset += S.secondaryRoof) {
        const dx = Math.cos(angle),
          dz = Math.sin(angle),
          nx = -dz,
          nz = dx;
        let points = [];
        const flush = () => {
          if (points.length > 1) strip(o, points, 1.2, roofNormal);
          points = [];
        };
        for (let t = -235; t <= 235; t += S.roofSample) {
          const x = nx * offset + dx * t,
            z = nz * offset + dz * t;
          if ((x / 149) ** 2 + (z / 166.5) ** 2 < 0.985 && (x / 62) ** 2 + (z / 91) ** 2 > 1.02)
            points.push([x, birdsNestRoofY(x, z) + 0.26, z]);
          else flush();
        }
        flush();
      }
}
const tiers = [
  { x: 53, z: 100, y: -4.25, rows: 28, run: 0.8, rise: 0.35 },
  { x: 76, z: 120, y: 8.2, rows: 25, run: 0.81, rise: 0.49 },
  { x: 96, z: 136, y: 22.8, rows: 36, run: 0.75, rise: 0.59 },
];
function bowl(o, S) {
  for (let i = 0; i < S.n; i++) {
    const a = (T * i) / S.n,
      b = (T * (i + 1)) / S.n;
    face(
      o,
      'concrete',
      [
        E(113, 147, a, 0),
        E(113, 147, b, 0),
        E(125, 153, b, 31 + 15 * Math.sin(b) ** 2),
        E(125, 153, a, 31 + 15 * Math.sin(a) ** 2),
      ],
      red,
      [Math.sin(a), 0, Math.cos(a)],
    );
    // The same annulus covers the inherited 120-point ground-cutout boundary at every tier.
    face(
      o,
      'concrete',
      [
        E(129.63, 144.855, a, 0.01),
        E(129.63, 144.855, b, 0.01),
        E(137.974, 154.179, b, 0.01),
        E(137.974, 154.179, a, 0.01),
      ],
      concrete,
      [0, 1, 0],
    );
  }
  for (const [k, t] of tiers.entries()) {
    const groups = S.steps[k];
    for (let row = 0; row < groups; row++)
      for (let i = 0; i < S.n; i++) {
        const a = (T * i) / S.n,
          b = (T * (i + 1)) / S.n,
          mid = (a + b) / 2;
        const rows = (angle) => (k === 2 ? 13 + 23 * Math.sin(angle) ** 2 : t.rows);
        const point = (angle, r, yt = r) =>
          E(
            t.x + r * rows(angle) * t.run,
            t.z + r * rows(angle) * t.run * 0.68,
            angle,
            t.y + yt * rows(angle) * t.rise + 0.15,
          );
        const r = row / groups,
          next = (row + 1) / groups;
        const c = [
          0.72 + ((white[0] - 0.72) * k) / 2,
          0.032 + ((white[1] - 0.032) * k) / 2,
          0.024 + ((white[2] - 0.024) * k) / 2,
        ];
        face(
          o,
          'plastic',
          [
            point(a, r),
            point(b, r),
            point(b, next, S.sloped ? next : r),
            point(a, next, S.sloped ? next : r),
          ],
          c,
          [0, 1, 0],
        );
        if (!S.sloped)
          face(
            o,
            'concrete',
            [point(a, r, r - 1 / groups), point(b, r, r - 1 / groups), point(b, r), point(a, r)],
            concrete,
            [-Math.sin(mid), 0, -Math.cos(mid)],
          );
      }
  }
  if (S.floors)
    for (const y of [7.25, 14.5, 21.75, 29])
      for (let i = 0; i < S.n; i++) {
        const a = (T * i) / S.n,
          b = (T * (i + 1)) / S.n;
        face(
          o,
          'concrete',
          [
            E(113, 147, a, y),
            E(113, 147, b, y),
            E(136 + y * 0.1, 151 + y * 0.1, b, y),
            E(136 + y * 0.1, 151 + y * 0.1, a, y),
          ],
          concrete,
          [0, 1, 0],
        );
      }
  if (S.screens)
    for (const sign of [-1, 1]) {
      box(o, 'metal', [-12, 25, sign * 147 - 0.65], [12, 34.8, sign * 147 + 0.25], steel);
      box(
        o,
        'glass',
        [-11.6, 25.4, sign * 147 - sign * 0.7 - 0.04],
        [11.6, 34.4, sign * 147 - sign * 0.7 + 0.04],
        [0.025, 0.033, 0.038],
      );
    }
}
function field(o, S) {
  for (let i = 0; i < S.n; i++)
    o.addTriangle(
      'plastic',
      'palette:#ffffff',
      [[0, -5.04, 0], E(53, 100, (T * (i + 1)) / S.n, -5.04), E(53, 100, (T * i) / S.n, -5.04)],
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      [0.4, 0.16, 0.115],
    );
  face(
    o,
    'turf',
    [
      [-34, -4.99, -52.5],
      [34, -4.99, -52.5],
      [34, -4.99, 52.5],
      [-34, -4.99, 52.5],
    ],
    [0.19, 0.335, 0.086],
    [0, 1, 0],
  );
  const track = (a, r) => [r * Math.sin(a), Math.sign(Math.cos(a)) * 42.195 + r * Math.cos(a)];
  for (let i = 0; i < S.n; i++) {
    const a = (T * (i + 0.5)) / S.n,
      b = (T * (i + 1.5)) / S.n;
    const p = track(a, 36.8),
      q = track(b, 36.8),
      u = track(a, 46.56),
      v = track(b, 46.56);
    face(
      o,
      'plastic',
      [
        [...p.slice(0, 1), -4.965, p[1]],
        [q[0], -4.965, q[1]],
        [v[0], -4.965, v[1]],
        [u[0], -4.965, u[1]],
      ],
      [0.42, 0.13, 0.09],
      [0, 1, 0],
    );
  }
  if (!S.markings) return;
  const line = (ps, y = -4.93, w = 0.1) => {
    for (let i = 1; i < ps.length; i++) {
      const a = ps[i - 1],
        b = ps[i],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        nx = (-(b[1] - a[1]) * w) / L,
        nz = ((b[0] - a[0]) * w) / L;
      face(
        o,
        'plastic',
        [
          [a[0] + nx, y, a[1] + nz],
          [b[0] + nx, y, b[1] + nz],
          [b[0] - nx, y, b[1] - nz],
          [a[0] - nx, y, a[1] - nz],
        ],
        white,
        [0, 1, 0],
      );
    }
  };
  line([
    [-34, -52.5],
    [34, -52.5],
    [34, 52.5],
    [-34, 52.5],
    [-34, -52.5],
  ]);
  line([
    [-34, 0],
    [34, 0],
  ]);
  line(path(24, (t) => [9.15 * Math.sin(T * t), 9.15 * Math.cos(T * t)]));
  for (const sign of [-1, 1])
    line([
      [-20.16, 52.5 * sign],
      [-20.16, 36 * sign],
      [20.16, 36 * sign],
      [20.16, 52.5 * sign],
    ]);
  for (let lane = 0; lane <= 8; lane += S.laneStep)
    line(
      path(S.n, (t) => track(T * (t + 0.5 / S.n), 36.8 + lane * 1.22)),
      -4.93,
      0.04,
    );
}
function stairs(o, S) {
  if (!S.stairs) return;
  for (let i = 0; i < 24; i++)
    for (let flight = 0; flight < 4; flight++) {
      const a = (T * i) / 24 + 0.04,
        direction = flight % 2 ? -1 : 1;
      const point = (t) => {
        const angle = a + direction * (-0.073 + 0.146 * t),
          y = (flight + t) * 7.25;
        const p = birdsNestFacade(angle, y / (41 + 27 * Math.sin(angle) ** 2), 6.2);
        return [p[0], y, p[2]];
      };
      for (let j = 0; j < S.stairs; j++) {
        const p = point(j / S.stairs),
          q = point((j + 1) / S.stairs);
        const edge = (p, sign) => {
          const a = Math.atan2(p[0], p[2]);
          return [p[0] + Math.sin(a) * 1.7 * sign, p[1] + 0.08, p[2] + Math.cos(a) * 1.7 * sign];
        };
        const ps = [edge(p, -1), edge(p, 1), edge(q, 1), edge(q, -1)];
        if (S.stairs > 1) {
          ps[2][1] = ps[3][1] = p[1] + 0.08;
        }
        face(o, 'concrete', ps, concrete, [0, 1, 0]);
        if (S.stairs > 1)
          face(o, 'concrete', [ps[3], ps[2], edge(q, 1), edge(q, -1)], concrete, [
            Math.sin(a),
            0,
            Math.cos(a),
          ]);
      }
    }
}
export function buildBirdsNestBrowser(o, level = 'skyline') {
  const S = {
    skyline: {
      n: 24,
      leaf: 2,
      secondary: 6,
      width: 2.4,
      flat: true,
      hoops: 0,
      radial: 1,
      trusses: 12,
      roofSegments: 1,
      steps: [1, 1, 1],
      sloped: true,
    },
    district: {
      n: 36,
      leaf: 2,
      secondary: 24,
      width: 1.6,
      hoops: 1,
      radial: 2,
      trusses: 24,
      roofSegments: 2,
      steps: [1, 1, 1],
      sloped: true,
      markings: true,
      laneStep: 8,
    },
    street: {
      n: 60,
      leaf: 6,
      secondary: 24,
      width: 1.2,
      back: true,
      web: 2,
      hoops: 2,
      radial: 3,
      trusses: 24,
      roofSegments: 5,
      under: true,
      steps: [6, 5, 8],
      floors: true,
      screens: true,
      markings: true,
      laneStep: 2,
      stairs: 1,
    },
    closeup: {
      n: 80,
      leaf: 12,
      secondary: 40,
      width: 1.2,
      back: true,
      web: 6,
      hoops: 4,
      radial: 5,
      trusses: 24,
      roofSegments: 10,
      under: true,
      roofWeb: true,
      secondaryRoof: 36,
      roofSample: 18,
      steps: [28, 25, 36],
      floors: true,
      screens: true,
      markings: true,
      laneStep: 1,
      stairs: 6,
    },
  }[level];
  if (!S) throw Error(level);
  bowl(o, S);
  field(o, S);
  shell(o, S);
  roof(o, S);
  stairs(o, S);
}
export const buildBirdsNestSkyline = (o) => buildBirdsNestBrowser(o, 'skyline');
export const buildBirdsNestDistrict = (o) => buildBirdsNestBrowser(o, 'district');
export const buildBirdsNestStreet = (o) => buildBirdsNestBrowser(o, 'street');
export const buildBirdsNestCloseup = (o) => buildBirdsNestBrowser(o, 'closeup');
