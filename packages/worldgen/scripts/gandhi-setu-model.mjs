/** Current twin steel superstructures on retained Mahatma Gandhi Setu piers. */

import { readFileSync } from 'node:fs';
import { beam, cross, loft, normalFor, normalize } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(
  readFileSync(structureSourcePath('n0020_mahatma_gandhi_setu', 'map-frame.json')),
);
const length = 45 * 121.065 + 2 * 65.53;
const half = length / 2;
const spanLengths = [65.53, ...Array(45).fill(121.065), 65.53];
const stations = [-half];
for (const span of spanLengths) stations.push(stations.at(-1) + span);
const paint = [0.62, 0.66, 0.67],
  dark = [0.25, 0.29, 0.3],
  concrete = [0.52, 0.49, 0.43];
const deck = (x) => 23.5 + 0.22 * Math.cos((x / half) * Math.PI);
const rand = (s) => {
  const n = Math.sin(s * 19.673 + 45.9) * 53624.973;
  return n - Math.floor(n);
};
const tint = (s, c = concrete) => c.map((v) => v + (rand(s) - 0.5) * 0.045);

function sectionBeam(out, a, b, width, depth, color = paint) {
  const axis = normalize(b.map((v, i) => v - a[i]));
  const across = normalize(cross(axis, Math.abs(axis[1]) < 0.96 ? [0, 1, 0] : [1, 0, 0]));
  const other = normalize(cross(axis, across));
  const profile = [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, -depth / 2 + 0.055],
    [0.035, -depth / 2 + 0.055],
    [0.035, depth / 2 - 0.055],
    [width / 2, depth / 2 - 0.055],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
    [-width / 2, depth / 2 - 0.055],
    [-0.035, depth / 2 - 0.055],
    [-0.035, -depth / 2 + 0.055],
    [-width / 2, -depth / 2 + 0.055],
  ];
  const ring = (c) => profile.map(([u, v]) => c.map((p, i) => p + across[i] * u + other[i] * v));
  const aa = ring(a),
    bb = ring(b);
  for (let i = 0; i < profile.length; i++) {
    const j = (i + 1) % profile.length,
      q = [aa[i], aa[j], bb[j], bb[i]];
    quad(out, 'iron', q, normalFor(...q), color);
  }
  // Three convex end rectangles close the open I section without a concave triangle fan.
  for (const [center, sign] of [
    [a, -1],
    [b, 1],
  ]) {
    for (const [u0, u1, v0, v1] of [
      [-width / 2, width / 2, -depth / 2, -depth / 2 + 0.055],
      [-0.035, 0.035, -depth / 2 + 0.055, depth / 2 - 0.055],
      [-width / 2, width / 2, depth / 2 - 0.055, depth / 2],
    ]) {
      let p = [
        [u0, v0],
        [u1, v0],
        [u1, v1],
        [u0, v1],
      ].map(([u, v]) => center.map((x, i) => x + across[i] * u + other[i] * v));
      if (normalFor(...p).reduce((n, x, i) => n + x * axis[i] * sign, 0) < 0) p = p.toReversed();
      quad(out, 'iron', p, normalFor(...p), color);
    }
  }
}
function slab(out, slot, x0, x1, z0, z1, low, high, color) {
  loft(
    out,
    slot,
    [low, high].map((h) => [
      [x0, h(x0), z0],
      [x0, h(x0), z1],
      [x1, h(x1), z1],
      [x1, h(x1), z0],
    ]),
    color,
  );
}
function bolt(out, x, y, z, side) {
  tube(out, 'iron', [x, y, z], [x, y, z + side * 0.025], 0.035, dark, 6);
}
function gusset(out, x, y, z, side, upper = false) {
  const points = [
    [x - 0.63, y - 0.08],
    [x - 0.32, y + 0.5],
    [x + 0.32, y + 0.5],
    [x + 0.63, y - 0.08],
  ];
  const poly = points.map(([a, b]) => [a, upper ? 2 * y - b : b]);
  const face = poly.map(([a, b]) => [a, b, z + side * 0.31]);
  let p = face;
  if (normalFor(...p)[2] * side < 0) p = p.toReversed();
  out.addConvexPolygon('iron', 'palette:#ffffff', p, normalFor(...p), (v) => [v[0], v[1]], paint);
  const back = p.map((v) => [v[0], v[1], v[2] - side * 0.035]).toReversed();
  out.addConvexPolygon(
    'iron',
    'palette:#ffffff',
    back,
    normalFor(...back),
    (v) => [v[0], v[1]],
    paint,
  );
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length,
      q = [
        p[i],
        p[j],
        [p[j][0], p[j][1], p[j][2] - side * 0.035],
        [p[i][0], p[i][1], p[i][2] - side * 0.035],
      ];
    quad(out, 'iron', q, normalFor(...q), paint);
  }
  for (const dx of [-0.32, 0, 0.32])
    for (const dy of [0.06, 0.25])
      bolt(out, x + dx, y + (upper ? -dy : dy), z + side * 0.335, side);
}
function pier(out, x, z, index) {
  const grade = index < 11 ? 0 : index < 21 ? 4 : 10;
  const top = deck(x) - 0.95;
  const ring = (y, wx, wz) => [
    [x - wx, y, z - wz],
    [x - wx, y, z + wz],
    [x + wx, y, z + wz],
    [x + wx, y, z - wz],
  ];
  loft(out, 'concrete', [ring(grade, 2.8, 3.85), ring(top - 1.2, 2.25, 3.3)], tint(index));
  loft(
    out,
    'concrete',
    [ring(grade, 3.1, 4.1), ring(grade + 0.5, 3.05, 4.05)],
    tint(index, [0.34, 0.33, 0.29]),
  );
  // The completed crossing retains short modified heads, not the demolished concrete
  // cantilever arms visible on the opposite flank in the 2020 construction photographs.
  loft(
    out,
    'concrete',
    [ring(top - 1.2, 2.25, 3.3), ring(top - 0.7, 2.65, 4.75), ring(top, 2.65, 4.75)],
    tint(index),
  );
  for (const dx of [-1.25, 1.25])
    for (const dz of [-4.2, 4.2]) {
      box(
        out,
        'concrete',
        [x + dx - 0.65, top, z + dz - 0.5],
        [x + dx + 0.65, top + 0.35, z + dz + 0.5],
        concrete,
      );
      box(
        out,
        'iron',
        [x + dx - 0.47, top + 0.35, z + dz - 0.38],
        [x + dx + 0.47, top + 0.69, z + dz + 0.38],
        dark,
      );
    }
  for (let y = grade + 1.4; y < top - 1.3; y += 1.6)
    for (const side of [-1, 1]) {
      const t = (y - grade) / (top - 1.2 - grade),
        zz = z + side * (3.85 - 0.55 * t + 0.012);
      beam(
        out,
        'concrete',
        [x - 2.8 + 0.55 * t, y, zz],
        [x + 2.8 - 0.55 * t, y, zz],
        0.018,
        0.012,
        tint(index + y, [0.4, 0.38, 0.33]),
      );
    }
}
function span(out, x0, x1, z, index) {
  const full = index > 0 && index < 46,
    bays = full ? 16 : 8,
    step = (x1 - x0) / bays,
    rise = full ? 9.3 : 4.6;
  const y = (x) => deck(x) + 0.1;
  slab(
    out,
    'road',
    x0 + 0.14,
    x1 - 0.14,
    z - 4.0,
    z + 4.0,
    (x) => deck(x) - 0.38,
    deck,
    [0.12, 0.125, 0.125],
  );
  for (const side of [-1, 1]) {
    slab(
      out,
      'concrete',
      x0 + 0.14,
      x1 - 0.14,
      z + side * 4.1 - 0.18,
      z + side * 4.1 + 0.18,
      deck,
      (x) => deck(x) + 0.55,
      tint(index),
    );
    slab(
      out,
      'marking',
      x0 + 0.2,
      x1 - 0.2,
      z + side * 3.7 - 0.065,
      z + side * 3.7 + 0.065,
      (x) => deck(x) + 0.008,
      (x) => deck(x) + 0.014,
      [0.83, 0.84, 0.79],
    );
    const zz = z + side * 4.6;
    sectionBeam(out, [x0 + 0.3, y(x0), zz], [x1 - 0.3, y(x1), zz], 0.58, 0.72);
    sectionBeam(
      out,
      [x0 + step, y(x0 + step) + rise, zz],
      [x1 - step, y(x1 - step) + rise, zz],
      0.58,
      0.72,
    );
    for (let k = 0; k <= bays; k++) {
      const x = Math.max(x0 + 0.3, Math.min(x1 - 0.3, x0 + k * step));
      if (k % 2) gusset(out, x, y(x) + rise, zz, side, true);
      else gusset(out, x, y(x), zz, side);
      if (k < bays) {
        const nx = Math.min(x1 - 0.3, x0 + (k + 1) * step);
        sectionBeam(
          out,
          [x, y(x) + (k % 2 ? rise : 0), zz],
          [nx, y(nx) + (k % 2 ? 0 : rise), zz],
          0.46,
          0.53,
        );
      }
    }
  }
  for (let k = 0; k <= bays; k++) {
    const x = Math.max(x0 + 0.35, Math.min(x1 - 0.35, x0 + k * step));
    sectionBeam(out, [x, deck(x) - 0.9, z - 4.7], [x, deck(x) - 0.9, z + 4.7], 0.42, 1.05, dark);
    if (full && k % 2 === 1) {
      sectionBeam(out, [x, y(x) + rise, z - 4.6], [x, y(x) + rise, z + 4.6], 0.32, 0.4);
      if (k + 2 < bays)
        for (const side of [-1, 1]) {
          const nx = Math.min(x1 - 0.35, x + step * 2);
          sectionBeam(
            out,
            [x, y(x) + rise, z + side * 4.6],
            [nx, y(nx) + rise, z - side * 4.6],
            0.23,
            0.28,
          );
        }
    }
  }
  for (const dz of [-2.7, -1.35, 0, 1.35, 2.7])
    sectionBeam(
      out,
      [x0 + 0.25, deck(x0) - 0.6, z + dz],
      [x1 - 0.25, deck(x1) - 0.6, z + dz],
      0.25,
      0.55,
      dark,
    );
  for (let x = x0 + 1.2; x < x1 - 0.5; x += 9)
    slab(
      out,
      'marking',
      x,
      Math.min(x + 3, x1 - 0.2),
      z - 0.065,
      z + 0.065,
      (x) => deck(x) + 0.009,
      (x) => deck(x) + 0.015,
      [0.85, 0.85, 0.78],
    );
  for (const end of [x0, x1])
    slab(
      out,
      'iron',
      end - 0.08,
      end + 0.08,
      z - 4,
      z + 4,
      (x) => deck(x) - 0.01,
      (x) => deck(x) + 0.015,
      dark,
    );
}
function outerWalk(out, z, side) {
  const za = z + side * 5.65;
  for (let x = -half; x < half; x += 6)
    slab(
      out,
      'concrete',
      x,
      Math.min(half, x + 6),
      za - 0.8,
      za + 0.8,
      (s) => deck(s) - 0.15,
      (s) => deck(s) + 0.12,
      concrete,
    );
  for (let x = -half; x < half; x += 2.4) {
    const b = Math.min(half, x + 2.4),
      zz = za + side * 0.73;
    beam(out, 'iron', [x, deck(x) + 0.13, zz], [x, deck(x) + 1.34, zz], 0.065, 0.07, paint);
    for (const h of [0.48, 0.89, 1.3])
      beam(out, 'iron', [x, deck(x) + h, zz], [b, deck(b) + h, zz], 0.044, 0.052, paint);
  }
  for (let x = -half + 28; x < half; x += 60.5325) {
    const yy = deck(x),
      zz = za + side * 0.42;
    tube(out, 'iron', [x, yy + 0.1, zz], [x, yy + 10.8, zz], 0.07, paint, 12);
    tube(out, 'iron', [x, yy + 10.8, zz], [x + 0.7, yy + 11.5, zz - side * 1.3], 0.056, paint, 12);
    box(
      out,
      'iron',
      [x + 0.4, yy + 11.37, zz - side * 1.3 - 0.22],
      [x + 1.12, yy + 11.55, zz - side * 1.3 + 0.22],
      dark,
    );
    box(
      out,
      'marking',
      [x + 0.44, yy + 11.34, zz - side * 1.3 - 0.19],
      [x + 1.08, yy + 11.37, zz - side * 1.3 + 0.19],
      [0.75, 0.8, 0.8],
    );
  }
}
export function buildGandhiSetu(out) {
  for (const z of [-5.8, 5.8]) {
    for (let i = 1; i < stations.length - 1; i++) pier(out, stations[i], z, i);
    for (let i = 0; i < spanLengths.length; i++) span(out, stations[i], stations[i + 1], z, i);
    for (const end of [-half, half])
      box(
        out,
        'concrete',
        [end - 1.9, 10, z - 4.6],
        [end + 1.9, deck(end) - 0.4, z + 4.6],
        concrete,
      );
    outerWalk(out, z, Math.sign(z));
  }
}
export const gandhiSetuStudy = {
  id: 'N0020',
  key: 'mahatma_gandhi_setu',
  title: 'Mahatma Gandhi Setu',
  wikidataId: 'Q2724307',
  build: buildGandhiSetu,
  mapFrameDocument: 'map-frame.json',
  brief:
    'Current twin steel through-truss decks, individually modeled I-section Warren diagonals with staggered chord nodes and inclined end posts, roof cross-bracing, gusset plates and bolt heads, retained concrete shafts and short modified heads, bearings, floor beams, outer walkways, railings, lights and shorter half-through end spans.',
  refs: [
    'https://afcons.com/surface-transport/',
    'https://www.urbanmobilityindia.in/Upload/Conference/e8222e42-1693-4523-aef3-1e4347f64fd4.pdf#page=28',
    'https://www.cecr.in/construction-chemicals-materials-2/case-study-rehabilitation-of-mahatma-gandhi-setu',
    'https://afcons.com/wp-content/uploads/2026/01/Full-Afcons-Annual-Report-2023_0.pdf',
    'https://commons.wikimedia.org/wiki/File:GandhiSetuPatnaRevamped.png',
    'https://www.openstreetmap.org/way/28736579',
    'https://www.openstreetmap.org/way/44695500',
  ],
  sourceFacts: {
    replacedConcreteSuperstructure: true,
    completeSteelReplacementYear: 2022,
    contractorPublishedReplacementLengthMeters: 5575,
    originalRetainedSpanScheduleMeters: [65.53, ...Array(45).fill(121.065), 65.53],
    retainedPierCount: 46,
    carriageways: 2,
    roadwayWidthEachMeters: 7.5,
    steelTonnes: 66360,
    supplierRecord:
      'Dextra India engineering case study credited to its application engineer; original span schedule and retained piers.',
  },
  reconstruction: {
    trussHeightMeters: 9.3,
    fullSpanPanelCount: 16,
    carriagewayCentersMeters: [-5.8, 5.8],
    modeledDeckAboveRiverFoundationMeters: 23.5,
    notes:
      'Completed contractor photograph in the UMI2022 presentation page28 corrects the first draft: staggered Warren diagonals, inclined end posts, and short modified pier heads rather than the demolished concrete cantilevers. Member sizes, panel interpretation, cap dimensions, member spacing and pier ground profile remain photographic reconstruction. Original65.53/121.065m spans govern the source; published total5575m differs by3.985m from their sum.',
  },
  nativeAxes: {
    x: 'north-northeast to Hajipur',
    y: 'up from reconstructed river-pier foundation',
    z: 'east-southeast downstream',
  },
  geographic: () => ({
    anchor: frame.anchor,
    heading: frame.heading,
    elevationMode: 'terrain-contact',
    featureIds: ['way/28736579', 'way/44695500'],
    source: frame.sourceUrl,
    notes:
      'Steel superstructure extent is separated from the longer mapped southern concrete approach. Northern junction and published retained span schedule define directed axis. Real riverbed, floodplain contact and approach fit remain pending; no surveyed vertical datum is implied.',
  }),
  limitations: [
    'This source models the2022 replacement steel crossing; the separate southern curved concrete approach and later parallel extradosed bridge are outside this asset.',
    'Riverbed and floodplain foundation levels, detailed panel count and member sizes require further review.',
    'Moving traffic, temporary construction rigs and maintenance scaffolds are excluded.',
  ],
  camera: { position: [3200, 2600, 4200], lookAt: [0, 15, 0], fov: 50 },
  qaCameras: [
    { name: 'full-crossing', position: [0, 1900, 6700], lookAt: [0, 20, 0], fov: 51 },
    { name: 'river-spans', position: [-2350, 58, 240], lookAt: [-2320, 21, 0], fov: 61 },
    {
      name: 'pier-and-bearings',
      position: [stations[4] + 34, 15, 46],
      lookAt: [stations[4], 15, 0],
      fov: 58,
    },
    {
      name: 'steel-web',
      position: [stations[4] + 57, 28, 26],
      lookAt: [stations[4] + 57, 28, 10.4],
      fov: 62,
    },
    {
      name: 'roof-bracing',
      position: [stations[4] + 40, 39, 25],
      lookAt: [stations[4] + 54, 32.9, 5.8],
      fov: 65,
    },
    {
      name: 'roadway',
      position: [stations[4] + 14, 25.8, 5.8],
      lookAt: [stations[4] + 100, 25.6, 5.8],
      fov: 65,
    },
    {
      name: 'soffit-floorbeams',
      position: [stations[4] + 45, 16, 4],
      lookAt: [stations[4] + 54, 22.7, 6],
      fov: 66,
    },
    { name: 'end-pony-span', position: [half - 42, 33, 85], lookAt: [half - 35, 23, 0], fov: 58 },
    { name: 'floodplain-piers', position: [1000, 28, 180], lookAt: [1000, 19, 0], fov: 62 },
  ],
};
