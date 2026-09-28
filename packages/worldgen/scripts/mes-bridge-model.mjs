/** Original exterior study from the heritage authority elevation and dated photographs. */

import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { quad } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(readFileSync(structureSourcePath('n0011_mes_bridge', 'map-frame.json')));
const grey = [0.57, 0.568, 0.517],
  mortar = [0.49, 0.487, 0.441],
  pale = [0.69, 0.679, 0.605];
const mix = (a, b, t) => a + (b - a) * t;
function profile(points, x) {
  for (let i = 1; i < points.length; i++)
    if (x <= points[i][0])
      return mix(
        points[i - 1][1],
        points[i][1],
        Math.max(0, (x - points[i - 1][0]) / (points[i][0] - points[i - 1][0])),
      );
  return points.at(-1)[1];
}
const center = (x) => profile(frame.centerline, x);
const deckProfile = [
  [-62.361, 7.75],
  [-54, 8.05],
  [-44, 8.55],
  [-34, 9.25],
  [-25, 10.15],
  [-18.5, 10.6],
  [-6.4, 12.25],
  [6, 10.3],
  [14, 9.15],
  [24, 8.75],
  [35, 8.25],
  [46, 7.8],
  [54, 7.55],
  [62.361, 7.45],
];
const deck = (x) => profile(deckProfile, x);
const baseProfile = [
  [-62.361, 7.5],
  [-54, 5.35],
  [-43, 5.1],
  [-34, 4.4],
  [-27, 4.2],
  [-20, 2.2],
  [-17.15, 0],
  [-6.4, 0],
  [4.35, 0],
  [7, 2.8],
  [14, 3.5],
  [25, 3.4],
  [35, 4.4],
  [44, 5.1],
  [54, 6.1],
  [62.361, 7.2],
];
const base = (x) => profile(baseProfile, x);
// x/span/spring/rise/opening-bottom/pointed. Stations photo-scaled from the sign;
// these are not claimed to be survey ordinates. The main clear span is published.
const arches = [
  [-49.7, 4.05, 5.5, 1.65, 5.25, false],
  [-43.85, 7.0, 5.0, 2.45, 4.65, false],
  [-34.23, 7.35, 5.0, 3.55, 4.35, false],
  [-25.38, 3.15, 7.9, 1.62, 5.65, true],
  [-18.8, 2.4, 8.1, 1.5, 5.7, true],
  [-6.4, 21.5, 0.4, 10.55, 0, false],
  [6.25, 2.4, 7.9, 1.45, 5.0, true],
  [11.9, 7.5, 4.2, 4.1, 3.65, false],
  [21.1, 7.9, 4.0, 4.02, 3.5, false],
  [30.1, 6.55, 4.6, 2.82, 4.45, false],
  [36.4, 3.1, 5.55, 1.85, 5.15, false],
  [42.5, 5.2, 5.8, 1.53, 5.55, false],
  [49.1, 3.5, 6.3, 0.85, 6.0, false],
].map(([x, span, spring, rise, bottom, pointed], i) => ({
  x,
  span,
  spring,
  rise,
  bottom,
  pointed,
  ring: i === 5 ? 1.08 : pointed ? 0.28 : 0.43,
}));
function point(a, t, r = 0) {
  const th = Math.PI * t;
  const h = a.span / 2 + r,
    rise = a.rise + r,
    x = -h * Math.cos(th);
  const radius = (h * h + rise * rise) / (2 * h);
  return [
    a.x + x,
    a.spring +
      (a.pointed
        ? Math.sqrt(Math.max(0, radius * radius - (Math.abs(x) + radius - h) ** 2))
        : rise * Math.sin(th)),
  ];
}
function archAt(x) {
  return arches.find((a) => Math.abs(x - a.x) < a.span / 2 + a.ring);
}
function extrados(a, x) {
  return point(
    a,
    Math.acos(Math.max(-1, Math.min(1, (a.x - x) / (a.span / 2 + a.ring)))) / Math.PI,
    a.ring,
  )[1];
}
function polygon(out, poly, z0, z1, color = grey, slot = 'roughstone') {
  let p = poly.filter(
    (a, i) =>
      Math.hypot(
        a[0] - poly[(i + poly.length - 1) % poly.length][0],
        a[1] - poly[(i + poly.length - 1) % poly.length][1],
      ) > 1e-7,
  );
  if (p.length < 3) return;
  const area = p.reduce(
    (s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1],
    0,
  );
  if (Math.abs(area) < 1e-8) return;
  if (area < 0) p = p.toReversed();
  const a = p.map(([x, y]) => [x, y, z0 + center(x)]),
    b = p.map(([x, y]) => [x, y, z1 + center(x)]);
  out.addConvexPolygon(
    slot,
    'palette:#ffffff',
    a.toReversed(),
    normalFor(a[2], a[1], a[0]),
    (p) => [p[0], p[1]],
    color,
  );
  out.addConvexPolygon(slot, 'palette:#ffffff', b, normalFor(...b), (p) => [p[0], p[1]], color);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length,
      ps = [a[i], a[j], b[j], b[i]];
    quad(out, slot, ps, normalFor(...ps), color);
  }
}
const wedge = (out, a, b, y0, y1, t0, t1, z0, z1, c = grey, slot) =>
  polygon(
    out,
    [
      [a, y0],
      [b, y1],
      [b, t1],
      [a, t0],
    ],
    z0,
    z1,
    c,
    slot,
  );
function clip(poly, y, above) {
  const p = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      ia = above ? a[1] >= y : a[1] <= y,
      ib = above ? b[1] >= y : b[1] <= y;
    if (ia) p.push(a);
    if (ia !== ib) p.push([mix(a[0], b[0], (y - a[1]) / (b[1] - a[1])), y]);
  }
  return p;
}
function cobble(out, x, z, dx, dz, seed, raised = false) {
  const variation = ((seed * 37) % 19) / 19;
  const plan = [
    [-0.5, -0.25],
    [-0.28, -0.5],
    [0.35, -0.46],
    [0.5, -0.15],
    [0.44, 0.36],
    [0.1, 0.5],
    [-0.39, 0.41],
    [-0.5, 0.09],
  ].map(([u, v], i) => {
    const angle = (((seed * 11) % 17) - 8) * 0.014;
    const f = 0.87 + ((seed * 17 + i * 7) % 13) * 0.01;
    return [
      x + (u * dx * Math.cos(angle) - v * dz * Math.sin(angle)) * f,
      z + (u * dx * Math.sin(angle) + v * dz * Math.cos(angle)) * f,
    ];
  });
  const rim = plan.map(([xx, zz]) => [
    xx,
    deck(xx) + 0.016 + (raised ? 0.085 : 0),
    center(xx) + zz,
  ]);
  const middle = [x, deck(x) + 0.04 + variation * 0.022 + (raised ? 0.085 : 0), center(x) + z];
  const col = pale.map((v) => v - 0.13 + variation * 0.13);
  for (let i = 0; i < rim.length; i++) {
    const j = (i + 1) % rim.length,
      tri = [rim[i], rim[j], middle];
    if (normalFor(...tri)[1] < 0) tri.reverse();
    out.addTriangle('paving', 'palette:#ffffff', tri, normalFor(...tri), [], col);
    const ps = [
      rim[i],
      rim[i].map((v, k) => (k === 1 ? v - 0.1 : v)),
      rim[j].map((v, k) => (k === 1 ? v - 0.1 : v)),
      rim[j],
    ];
    quad(out, 'paving', ps, normalFor(...ps), col);
  }
}
export function buildMesBridge(out) {
  const left = -62.361,
    right = 62.361;
  const stops = [
    ...new Set([
      left,
      right,
      ...arches.flatMap((a) => [a.x - a.span / 2 - a.ring, a.x + a.span / 2 + a.ring]),
      ...Array.from({ length: 624 }, (_, i) => left + i * 0.2),
    ]),
  ]
    .filter((x) => x >= left && x <= right)
    .sort((a, b) => a - b);
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i],
      b = stops[i + 1],
      arch = archAt((a + b) / 2),
      low = (x) => (arch ? extrados(arch, x) : base(x));
    wedge(out, a, b, low(a), low(b), deck(a) - 0.04, deck(b) - 0.04, -1.68, 1.68, mortar);
    if (arch && arch.bottom > Math.max(base(a), base(b)) + 0.05)
      wedge(out, a, b, base(a), base(b), arch.bottom, arch.bottom, -1.68, 1.68, mortar);
  }
  for (const [index, a] of arches.entries()) {
    const n = Math.ceil(a.span * 5.5),
      lanes = index === 5 ? 9 : 7;
    for (let i = 0; i < n; i++)
      for (let lane = 0; lane < lanes; lane++) {
        const t0 = (i + 0.025) / n,
          t1 = (i + 0.975) / n,
          z0 = -1.71 + (3.42 * lane) / lanes + 0.004,
          z1 = -1.71 + (3.42 * (lane + 1)) / lanes - 0.004;
        polygon(
          out,
          [point(a, t0), point(a, t1), point(a, t1, a.ring), point(a, t0, a.ring)],
          z0,
          z1,
          pale.map((v) => v + (((i * 11 + lane * 7) % 13) - 6) * 0.007),
          'stone',
        );
        if (index === 5 && (lane === 0 || lane === lanes - 1))
          polygon(
            out,
            [
              point(a, t0, a.ring * 0.71),
              point(a, t1, a.ring * 0.71),
              point(a, t1, a.ring * 0.8),
              point(a, t0, a.ring * 0.8),
            ],
            lane === 0 ? -1.745 : 1.69,
            lane === 0 ? -1.69 : 1.745,
            grey,
            'stone',
          );
      }
    for (const side of [-1, 1]) {
      const edge = a.x + (side * a.span) / 2;
      for (let y = a.bottom; y < a.spring; y += 0.27)
        polygon(
          out,
          [
            [edge + (side < 0 ? -a.ring : 0), y],
            [edge + (side > 0 ? a.ring : 0), y],
            [edge + (side > 0 ? a.ring : 0), Math.min(a.spring, y + 0.263)],
            [edge + (side < 0 ? -a.ring : 0), Math.min(a.spring, y + 0.263)],
          ],
          -1.71,
          1.71,
          pale,
          'stone',
        );
    }
  }
  // Recessed joints and independently shaped stones remain visible at walking distance.
  for (const side of [-1, 1])
    for (let row = 0; row < 56; row++)
      for (let k = 0; k < 310; k++) {
        const x = left + k * 0.408 + (row % 2) * 0.204,
          a = Math.max(left, x + 0.008),
          b = Math.min(right, x + 0.399);
        if (b <= a) continue;
        const arch = archAt((a + b) / 2),
          low = (x) => (arch ? extrados(arch, x) : base(x));
        const raw = [
            [a, low(a)],
            [b, low(b)],
            [b, deck(b) - 0.04],
            [a, deck(a) - 0.04],
          ],
          poly = clip(clip(raw, row * 0.235 + 0.007, true), (row + 1) * 0.235 - 0.009, false);
        polygon(
          out,
          poly,
          side < 0 ? -1.728 : 1.67,
          side < 0 ? -1.67 : 1.728,
          grey.map((v) => v + (((row * 13 + k * 7) % 23) - 11) * 0.006),
        );
        if (arch && arch.bottom > Math.max(base(a), base(b)) + 0.05) {
          const lower = clip(
            clip(
              [
                [a, base(a)],
                [b, base(b)],
                [b, arch.bottom],
                [a, arch.bottom],
              ],
              row * 0.235 + 0.007,
              true,
            ),
            (row + 1) * 0.235 - 0.009,
            false,
          );
          polygon(out, lower, side < 0 ? -1.728 : 1.67, side < 0 ? -1.67 : 1.728, grey);
        }
      }
  for (let x = left; x < right; x += 0.34) {
    const b = Math.min(right, x + 0.34);
    wedge(out, x, b, deck(x) - 0.13, deck(b) - 0.13, deck(x), deck(b), -1.7, 1.7, mortar);
    for (const side of [-1, 1]) {
      const za = side < 0 ? -1.71 : 1.27,
        zb = side < 0 ? -1.27 : 1.71;
      for (let row = 0; row < 3; row++)
        wedge(
          out,
          x + 0.006,
          b - 0.006,
          deck(x) + row * 0.19,
          deck(b) + row * 0.19,
          deck(x) + (row + 1) * 0.19 - 0.01,
          deck(b) + (row + 1) * 0.19 - 0.01,
          za,
          zb,
          grey.map((v) => v + (((Math.floor((x + 70) * 11) + row * 3) % 13) - 6) * 0.01),
        );
      wedge(
        out,
        x + 0.004,
        b - 0.004,
        deck(x) + 0.57,
        deck(b) + 0.57,
        deck(x) + 0.64,
        deck(b) + 0.64,
        za - 0.022,
        zb + 0.022,
        pale.map((v) => v - 0.08),
        'stone',
      );
    }
  }
  let seed = 1;
  for (let x = left + 0.09; x < right - 0.09; x += 0.235)
    for (let lane = 0; lane < 12; lane++)
      cobble(out, x + (lane % 2) * 0.045, -1.18 + lane * 0.213, 0.214, 0.194, seed++);
  // Original edge-set riser courses break up the steep hump's cobbled paving.
  for (let x = -25; x < 13; x += 1.08)
    for (let lane = 0; lane < 12; lane++)
      cobble(out, x, -1.18 + lane * 0.213, 0.105, 0.204, seed++, true);
}
export const mesStudy = {
  id: 'N0011',
  key: 'mes_bridge',
  title: 'Mes Bridge',
  wikidataId: 'Q856285',
  build: buildMesBridge,
  mapFrameDocument: 'map-frame.json',
  brief:
    'Thirteen unequal stone arches with a21.5m main vault, raised pointed flood openings, the distinctive bent western approach, humped cobbled walkway, paired radial arch bands, low rough-stone parapets and edge-set step courses.',
  refs: [
    'https://akt.gov.al/atraksionet/ura-e-mesit/',
    'https://drtkshkoder.com/fileadmin/user_upload/Ura_e_mesit_prokurim/Pasaporta_e_pasurise_kulturore_Ura_e_Mesit.pdf',
    'https://ahnp.ub.uni-heidelberg.de/journals/heritage/article/viewFile/21004/14776',
    'https://commons.wikimedia.org/wiki/File:Mesi_Bridge_2025.jpg',
    'https://commons.wikimedia.org/wiki/File:Mes_Bridge_Shkodra_02.jpg',
    'https://commons.wikimedia.org/wiki/File:Mes_Bridge_Shkodra_06.jpg',
    'https://commons.wikimedia.org/wiki/File:Mesi_bridge_detail.jpg',
    'https://www.openstreetmap.org/way/86888378',
  ],
  sourceFacts: {
    arches: 13,
    mainClearSpanMeters: 21.5,
    publishedBodyLengthMeters: 108,
    publishedWidthMeters: 3.4,
    publishedMainRibMeters: 1.08,
    publishedBendDegrees: 14,
    construction: '1768; extended in a later phase',
    referenceElevation:
      'IKTK heritage sign photographed2025; dated2025north/south aerial photographs establish signed sides',
  },
  reconstruction: {
    arches,
    deckProfile,
    baseProfile,
    bodyExtentMeters: [-54, 54],
    mappedApproachExtentMeters: [-62.361, 62.361],
    basis:
      'Arch stations photo-scaled from IKTK sign elevation, with unequal opening sills following the exposed rock bed. Centerline from exact mapped identity; footprint reconstructed at published width. Main clear span and arch count are published, minor dimensions and stone courses are original exterior interpretation.',
  },
  nativeAxes: {
    x: 'east-northeast toward seven-opening approach',
    y: 'up from lowest exposed main-vault support',
    z: 'south-southeast toward separate modern road bridge',
  },
  geographic: () => ({
    elevationMode: 'terrain-contact',
    anchor: frame.anchor,
    heading: frame.heading,
    featureIds: ['way/86888378'],
    source: 'https://www.openstreetmap.org/way/86888378',
    notes:
      'Bent exact centerline establishes position/axis. GroundY0 is the main-vault riverbed support reference; rising support bases require local rocky banks, so a flat test plane cannot certify terrain contact throughout the bridge.',
  }),
  limitations: [
    'Original detailed exterior reconstruction; no survey-quality minor arch ordinates or hidden foundations are claimed.',
    'OSM maps124.721m walkway including bank approaches; the heritage authority108m historic body is kept separately. Published3.4m width provides a reconstructed transverse outline.',
    'Exposed support bases follow photo-scaled river rocks; terrain fit remains dependent on the host rocky-bank surface. River water and rock scenery, the adjacent concrete road bridge, vegetation and houses are not embedded.',
    'Photographs and printed plan were inspected for shape; no external meshes, image textures or copyrighted sign artwork are embedded.',
  ],
  camera: { position: [-44, 45, 148], lookAt: [0, 6, 0], fov: 43 },
  qaCameras: [
    { name: 'main-vault', position: [-6.4, 6, 33], lookAt: [-6.4, 7, -2.7], fov: 51 },
    { name: 'pointed-relief', position: [-24, 11, 13], lookAt: [-24, 8.5, -4.5], fov: 44 },
    { name: 'soffit', position: [-7, 2, 6], lookAt: [-7, 8, -2.7], fov: 64 },
    { name: 'humped-walkway', position: [26, 10.6, 1.5], lookAt: [-6.4, 12.3, -3.5], fov: 54 },
    { name: 'west-bend', position: [-36, 24, 31], lookAt: [-27, 7, -3.8], fov: 49 },
    { name: 'east-arches', position: [35, 12, 32], lookAt: [31, 6, 0.4], fov: 52 },
    { name: 'stone-joints', position: [-19, 11, 1.6], lookAt: [-18.8, 9.5, -2.4], fov: 46 },
  ],
};
