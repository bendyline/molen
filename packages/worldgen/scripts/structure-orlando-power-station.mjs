/** Complete representative2007plant and towers. Never eligible for today's intact-building view. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { beam, cross, normalFor, normalize } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ke/ke7/orlando_power_station/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  tau = Math.PI * 2,
  C = {
    concrete: rgb('b7b5a6'),
    brick: rgb('7f7165'),
    metal: rgb('747b76'),
    dark: rgb('2f3635'),
    roof: rgb('828a83'),
  },
  surfaces = {
    concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    brick: { slot: 'wall', graph: 'brick', roughness: 0.97, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.12 },
    dark: { slot: 'window', localRef: ref, roughness: 0.84, metallic: 0.02 },
    roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.93, metallic: 0.1 },
  },
  minX = Math.min(...p.outline.map((q) => q[0])),
  maxX = Math.max(...p.outline.map((q) => q[0])),
  minZ = Math.min(...p.outline.map((q) => q[1])),
  maxZ = Math.max(...p.outline.map((q) => q[1]));
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(
    q[1].map((v, i) => v - q[0][i]),
    q[2].map((v, i) => v - q[0][i]),
  );
  if (Math.hypot(...c) < 1e-8) return;
  if (n && c.reduce((a, v, i) => a + v * n[i], 0) < 0) q = [q[0], q[2], q[1]];
  o.addTriangle(
    s,
    ref,
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function B(o, s, x, y, z, w, h, l, col = C[s]) {
  box(o, s, [x - w / 2, y, z - l / 2], [x + w / 2, y + h, z + l / 2], col);
}
function L(o, s, a, b, w, d, col = C[s], facing) {
  if (d > 1) {
    beam(o, s, a, b, w, w, col);
    return;
  }
  const n = facing ?? normalize([a[0] + b[0], 0, a[2] + b[2]]),
    u = normalize(
      cross(
        b.map((v, i) => v - a[i]),
        n,
      ),
    ).map((v) => (v * w) / 2),
    q = [
      a.map((v, i) => v - u[i]),
      b.map((v, i) => v - u[i]),
      b.map((v, i) => v + u[i]),
      a.map((v, i) => v + u[i]),
    ];
  Q(o, s, q, n, col);
  Q(
    o,
    s,
    [...q].reverse(),
    n.map((v) => -v),
    col,
  );
}
/** Local wall axes are unit tangent and outward normal; all glass/dark planes are recessed. */
function facade(o, origin, u, n, length, count, bottom, top, rows, d) {
  const local = {
      addQuad(s, r, q, nn, uv, col) {
        const P = (v) => [
            origin[0] + u[0] * v[0] + n[0] * v[2],
            v[1],
            origin[1] + u[1] * v[0] + n[1] * v[2],
          ],
          N = [u[0] * nn[0] + n[0] * nn[2], nn[1], u[1] * nn[0] + n[1] * nn[2]],
          sign = u[0] * n[1] - u[1] * n[0];
        o.addQuad(
          s,
          r,
          (sign < 0 ? [...q].reverse() : q).map(P),
          N,
          sign < 0 ? [...uv].reverse() : uv,
          col,
        );
      },
    },
    step = length / count,
    opening = step * 0.72,
    P = (x, y, z = 0) => [origin[0] + u[0] * x + n[0] * z, y, origin[1] + u[1] * x + n[1] * z];
  if (d > 0) {
    let start = bottom;
    for (const [a, b] of rows) {
      B(local, 'brick', length / 2, start, 0, length, a - start, 0.8);
      start = b;
    }
    B(local, 'brick', length / 2, start, 0, length, top - start, 0.8);
    for (let i = 0; i <= count; i++)
      B(local, 'concrete', i * step, bottom, 0, step - opening, top - bottom, 1.05);
  }
  for (let i = 0; i < count; i++)
    for (const [y0, y1] of rows) {
      const x = (i + 0.5) * step,
        back = d === 0 ? 0.015 : -1.25;
      Q(
        o,
        'dark',
        [
          P(x - opening / 2, y0, back),
          P(x + opening / 2, y0, back),
          P(x + opening / 2, y1, back),
          P(x - opening / 2, y1, back),
        ],
        [n[0], 0, n[1]],
      );
      if (d >= 2) {
        for (const xx of [x - opening / 2, x + opening / 2])
          L(o, 'metal', P(xx, y0, 0.035), P(xx, y1, 0.035), 0.15, d - 1, C.metal, [n[0], 0, n[1]]);
        for (const yy of [y0, y1])
          L(
            o,
            'concrete',
            P(x - opening / 2, yy, 0.06),
            P(x + opening / 2, yy, 0.06),
            0.24,
            d - 1,
            C.concrete,
            [n[0], 0, n[1]],
          );
        for (const q of [-1 / 6, 1 / 6])
          L(
            o,
            'metal',
            P(x + q * opening, y0, -0.25),
            P(x + q * opening, y1, -0.25),
            0.11,
            d - 1,
            C.metal,
            [n[0], 0, n[1]],
          );
        if (d === 3) {
          const y = y0 + (y1 - y0) * 0.63;
          beam(
            o,
            'metal',
            P(x - opening / 2, y, -0.25),
            P(x + opening / 2, y, -0.25),
            0.085,
            0.085,
            C.metal,
          );
          // A few surviving dusty panes; missing glazing is left dark/recessed.
          if (i % 3 === 0)
            Q(
              o,
              'dark',
              [
                P(x - opening * 0.47, y0 + 0.15, -0.19),
                P(x - opening * 0.18, y0 + 0.15, -0.19),
                P(x - opening * 0.18, y - 0.12, -0.19),
                P(x - opening * 0.47, y - 0.12, -0.19),
              ],
              [n[0], 0, n[1]],
              rgb('5c6866'),
            );
        }
      }
    }
  if (d > 0)
    for (const y of bottom === 0 ? [1.2, 14.2, 28.1] : [bottom + 0.1, top - 0.45])
      B(local, 'concrete', length / 2, y, 0.48, length, 0.65, 0.28);
}
function plant(o, d) {
  const length = maxX - minX,
    width = maxZ - minZ,
    rows = [
      [4, 12],
      [17, 25],
    ];
  if (d === 0) B(o, 'concrete', (minX + maxX) / 2, 0, (minZ + maxZ) / 2, length, 31.8, width);
  const inset = d === 0 ? 0.035 : 0;
  facade(o, [minX, maxZ + inset], [1, 0], [0, 1], length, 26, 0, 31.8, rows, d);
  facade(o, [maxX, minZ - inset], [-1, 0], [0, -1], length, 26, 0, 31.8, rows, d);
  facade(o, [maxX + inset, maxZ], [0, -1], [1, 0], width, 5, 0, 31.8, rows, d);
  facade(o, [minX - inset, minZ], [0, 1], [-1, 0], width, 5, 0, 31.8, rows, d);
  for (const [y, sg] of [
    [0.02, -1],
    [0.32, 1],
  ])
    Q(
      o,
      'concrete',
      p.outline.map((q) => [q[0], y, q[1]]),
      [0, sg, 0],
    );
  for (let i = 0; i < 4; i++) {
    const a = p.outline[i],
      b = p.outline[(i + 1) % 4];
    Q(
      o,
      'concrete',
      [
        [a[0], 0.02, a[1]],
        [b[0], 0.02, b[1]],
        [b[0], 0.32, b[1]],
        [a[0], 0.32, a[1]],
      ],
      [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2],
    );
  }
  B(o, 'roof', (minX + maxX) / 2, 31.8, (minZ + maxZ) / 2, length, 0.45, width);
  // Long roof monitor visible in both cleared whole-plant photographs.
  const a = minX + 4,
    b = maxX - 4,
    z0 = minZ + 9,
    z1 = maxZ - 12;
  if (d === 0) B(o, 'metal', (a + b) / 2, 32.25, (z0 + z1) / 2, b - a, 7.3, z1 - z0);
  facade(o, [a, z1], [1, 0], [0, 1], b - a, 26, 32.25, 39.55, [[33.2, 38.75]], d);
  facade(o, [b, z0], [-1, 0], [0, -1], b - a, 26, 32.25, 39.55, [[33.2, 38.75]], d);
  for (const x of [a, b]) B(o, 'concrete', x, 32.25, (z0 + z1) / 2, 0.5, 7.3, z1 - z0);
  B(o, 'roof', (a + b) / 2, 39.55, (z0 + z1) / 2, b - a, 0.45, z1 - z0 + 0.7);
  if (d >= 2)
    for (let i = 0; i <= 26; i++) {
      const x = a + ((b - a) * i) / 26;
      beam(o, 'metal', [x, 39.25, z0], [x, 39.25, z1], 0.16, 0.16, C.metal);
    }
}
function stack(o, x, z, d) {
  const n = [4, 6, 10, 16][d],
    profiles =
      d === 0
        ? [
            [0, 1.6],
            [69, 1.15],
            [70, 1.4],
          ]
        : [
            [0, 1.9],
            [3, 1.9],
            [4, 1.55],
            [65, 1.12],
            [68.5, 1.12],
            [68.5, 1.55],
            [70, 1.55],
          ],
    R = (r, y, i) => [x + r * Math.cos((i * tau) / n), y, z + r * Math.sin((i * tau) / n)];
  for (let j = 1; j < profiles.length; j++)
    for (let i = 0; i < n; i++) {
      const [a, r] = profiles[j - 1],
        [b, s] = profiles[j];
      Q(
        o,
        'concrete',
        [R(r, a, i), R(r, a, i + 1), R(s, b, i + 1), R(s, b, i)],
        [Math.cos(((i + 0.5) * tau) / n), 0, Math.sin(((i + 0.5) * tau) / n)],
        rgb('929a91'),
      );
    }
  const r = profiles.at(-1)[1];
  for (let i = 0; i < n; i++) {
    Q(
      o,
      'concrete',
      [R(r, 70, i), R(r, 70, i + 1), R(r - 0.4, 70, i + 1), R(r - 0.4, 70, i)],
      [0, 1, 0],
    );
    Q(
      o,
      'dark',
      [R(r - 0.4, 70, i), R(r - 0.4, 70, i + 1), R(r - 0.4, 66, i + 1), R(r - 0.4, 66, i)],
      [-Math.cos(((i + 0.5) * tau) / n), 0, -Math.sin(((i + 0.5) * tau) / n)],
    );
  }
  if (d >= 2)
    for (const y of [20, 39, 57])
      for (let i = 0; i < n; i++)
        Q(
          o,
          'concrete',
          [
            R(1.65 - y * 0.007, y, i),
            R(1.65 - y * 0.007, y, i + 1),
            R(1.65 - y * 0.007, y + 0.25, i + 1),
            R(1.65 - y * 0.007, y + 0.25, i),
          ],
          [Math.cos(((i + 0.5) * tau) / n), 0, Math.sin(((i + 0.5) * tau) / n)],
          rgb('858e85'),
        );
}
function baseRing(tower, d) {
  const q = tower.outline;
  if (d >= 2) {
    if (d === 2) return q;
    return q.flatMap((p, i) => [
      p,
      [(p[0] + q[(i + 1) % q.length][0]) / 2, (p[1] + q[(i + 1) % q.length][1]) / 2],
    ]);
  }
  const n = d === 0 ? 10 : 18;
  return Array.from({ length: n }, (_, i) => {
    const k = (i * q.length) / n,
      a = q[Math.floor(k)],
      b = q[(Math.floor(k) + 1) % q.length],
      f = k - Math.floor(k);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  });
}
function coolingTower(o, tower, d, index) {
  const c = tower.center,
    ring = baseRing(tower, d),
    n = ring.length,
    profile =
      d === 0
        ? [
            [9, 0.94],
            [58, 0.63],
            [90, 0.82],
          ]
        : d === 1
          ? [
              [9, 0.94],
              [30, 0.76],
              [58, 0.63],
              [75, 0.68],
              [90, 0.82],
            ]
          : [
              [9, 0.94],
              [15, 0.885],
              [24, 0.8],
              [34, 0.727],
              [44, 0.673],
              [54, 0.638],
              [61, 0.631],
              [68, 0.647],
              [75, 0.68],
              [82, 0.735],
              [90, 0.82],
            ],
    P = (i, y, scale, inside = false) => {
      const q = ring[(i + n) % n],
        dx = q[0] - c[0],
        dz = q[1] - c[1],
        r = Math.hypot(dx, dz),
        s = scale - (inside ? 0.85 / r : 0);
      return [c[0] + dx * s, y, c[1] + dz * s];
    },
    color = (j, i) => {
      const y = (profile[j][0] + profile[j - 1][0]) / 2;
      if (index === 0) return y < 22 || y > 72 ? rgb('c5c6b7') : rgb('4e8e88');
      const hues = ['b59e62', '8a9b6b', 'ba7b61', '7e9d9e', 'c3b47f', '7a8b71'];
      return rgb(y < 18 ? '7c9c8d' : hues[(Math.floor((i / n) * 11) + j * 2) % hues.length]);
    };
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < n; i++) {
      const [y0, s0] = profile[j - 1],
        [y1, s1] = profile[j],
        q = ring[i],
        r = [q[0] - c[0], 0, q[1] - c[1]];
      Q(
        o,
        'concrete',
        [P(i, y0, s0), P(i + 1, y0, s0), P(i + 1, y1, s1), P(i, y1, s1)],
        r,
        color(j, i),
      );
      Q(
        o,
        'concrete',
        [P(i, y0, s0, true), P(i, y1, s1, true), P(i + 1, y1, s1, true), P(i + 1, y0, s0, true)],
        r.map((v) => -v),
        rgb('8f978c'),
      );
    }
  for (const [y, s, sg] of [
    [9, 0.94, -1],
    [90, 0.82, 1],
  ])
    for (let i = 0; i < n; i++)
      Q(
        o,
        'concrete',
        [P(i, y, s), P(i + 1, y, s), P(i + 1, y, s, true), P(i, y, s, true)],
        [0, sg, 0],
      );
  // Intrinsic annular footing and open supported intakes; no disk closing either tower.
  for (let i = 0; i < n; i++) {
    const q = ring[i],
      N = [q[0] - c[0], 0, q[1] - c[1]];
    Q(o, 'concrete', [P(i, 0, 1), P(i + 1, 0, 1), P(i + 1, 1, 1), P(i, 1, 1)], N);
    Q(o, 'concrete', [P(i, 1, 1), P(i + 1, 1, 1), P(i + 1, 1, 0.88), P(i, 1, 0.88)], [0, 1, 0]);
    Q(
      o,
      'concrete',
      [P(i, 0, 0.88), P(i, 1, 0.88), P(i + 1, 1, 0.88), P(i + 1, 0, 0.88)],
      N.map((v) => -v),
    );
  }
  const supports = [6, 10, 18, 28][d];
  for (let k = 0; k < supports; k++) {
    const i = Math.floor((k * n) / supports),
      j = (i + Math.max(1, Math.round(n / supports / 2))) % n;
    L(o, 'concrete', P(i, 1, 0.97), P(i, 9, 0.94), 1.0, d);
    if (d >= 2) L(o, 'concrete', P(i, 1, 0.97), P(j, 9, 0.94), 0.65, d);
  }
  if (d >= 2)
    for (const [y, s] of [
      [9, 0.945],
      [89.2, 0.828],
    ])
      for (let i = 0; i < n; i++)
        Q(
          o,
          'concrete',
          [P(i, y, s), P(i + 1, y, s), P(i + 1, y + 0.6, s), P(i, y + 0.6, s)],
          [ring[i][0] - c[0], 0, ring[i][1] - c[1]],
          rgb('adaf9f'),
        );
}
function build(o, _f, d = 3) {
  plant(o, d);
  for (const x of [-45, -15, 15, 45]) stack(o, x, maxZ - 5, d);
  for (let i = 0; i < p.towers.length; i++) coolingTower(o, p.towers[i], d, i);
}
export const orlandoSkyline = (o, f) => build(o, f, 0);
export const orlandoDistrict = (o, f) => build(o, f, 1);
export const orlandoStreet = (o, f) => build(o, f, 2);
export const orlandoCloseup = (o, f) => build(o, f, 3);
export const orlandoModel = {
  id: 'orlando_power_station',
  key: 'orlando_power_station',
  cell: 'ke/ke7',
  recipe: 'structure-orlando-power-station.mjs',
  title: 'Orlando Power Station',
  category: 'industrial',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  appearance: p.appearance,
  brief: p.authoringDirection,
  camera: [500, 235, 555],
  lookAt: [70, 29, -38],
  portableGroundY: -0.2,
  mediumFiContext: { scale: 2.7, groundY: -0.2 },
  qaCameras: [
    {
      name: 'whole-historical-mainplant-fourstacks-and-both-towers',
      position: [245, 125, 540],
      lookAt: [75, 31, -38],
      reviewLod: 'skyline',
    },
    {
      name: 'hollow-open-tower-tops-waists-and-leg-supported-intakes',
      position: [335, 158, -32],
      lookAt: [240, 49, -145],
    },
    {
      name: 'whole-mainhall-recessed-bays-and-roofmonitor',
      position: [30, 44, 125],
      lookAt: [0, 23, 5],
    },
    {
      name: 'rear-mainplant-and-four-open-chimney-collars',
      position: [-70, 106, -240],
      lookAt: [0, 32, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent1000mfield frozen before geometry; modern source lakeoutliers to-8231.2297m diagnostic only. Historical2007grade/threshold/tower groundcontact unverified; flat separate review stage.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-orlando-power-station.mjs',
    level: 'skyline',
    export: 'orlandoSkyline',
    errorMeters: 2.7,
    surfaces,
    authoredLevels: {
      district: { export: 'orlandoDistrict', errorMeters: 1.05, surfaces },
      street: { export: 'orlandoStreet', errorMeters: 0.35, surfaces },
      closeup: { export: 'orlandoCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Complete representative2007principal plant exterior, allfour narrow chimneys and both whole cooling towers. Original mapped mainplant footprint and all tower base controls retained in detailed geometry. Native towerheight90m, photographic mainhall40m/fourstack70m, facade/monitor sections and neck/rim/leg shapes bounded. Mainhall has real recessed bays at district/street/closeup; skyline uses flat window cues. Tower tops/interiors/intakes remain truly hollow/open at everyLOD, no capped solidcones.',
    'Two exact published Qualla originals individually inspected/nativeSHA1matched: Exasbartos2007ownPD-self3648x2432frontplant/towers and TimGiddings2004ownPD-user-en1280x960wholeplant/fourchimneys/towers. Original whole structure is historical-only because primaryNRCSregulator reports confirm collapse25June2014.2007is a representative viewing year, not an exact exposure day; valid2007-01-01until2008-01-01/currentWorldEligible=false. No2009bungeebridge/cage or later redevelopment borrowed from licensedphotographs.',
    'Original broad teal/white and varied earth/green/blue painted fields evoke the cleared historical exterior; exact mural/advertisement/logo/lettering designs are not copied or represented as accurate. Paint census/current artwork, exact facade bay/brick/glazing census, hidden rear roofs/services/foundation and fine chimney/leg sections are photographic estimates. No original artist texture/photo/generatedbitmap/downloadedmesh used.',
    'Current native mainplant footprint is taggedruins and supplies original plan registration only. This asset includes the complete old mainplant, rather than a two-tower-only substitute; it is not eligible for default current-world placement. Detached modern utility/entertainment buildings, museumclockartifact, lake/water/roads/railways/pylons/grounds/people/vehicles and interiors/machinery excluded; no whole-site floor.',
    'Independent1000m129x129field/16641samples/4rawTerrariumtiles frozen at original northwestfrontcorner, datum1629.6835m, unchanged. Implausible negative inland/lake samples to-8231.2297m are diagnostic evidence only and never control geometry or historical yard/water levels. Portable/shared/context use separate flat review ground. Exact historical grade/footings/thresholds and compatible live host attachment unverified; dated placement only/replaceFootprint=false.',
  ],
};
