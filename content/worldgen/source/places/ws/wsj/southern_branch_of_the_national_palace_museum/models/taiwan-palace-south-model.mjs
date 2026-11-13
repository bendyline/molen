/** The National Palace Museum’s dark galleries, glazed public wing and the Zhimei Bridge. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const require = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = require('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  map = read('map-frame'),
  terrain = read('terrain-grid');
const [mappedOutline] = map.geometry.polygons,
  [deckLine] = map.geometry.centerlines;
const b = plan.section.bridge;
const white = 'palette:#ffffff',
  up = [0, 1, 0];
const surfaces = {
  metal: { slot: 'wall', graph: 'metal_painted', roughness: 0.77, metallic: 0.23 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.9, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.9, metallic: 0 },
  concrete: { slot: 'trim', graph: 'concrete_plain', roughness: 0.91, metallic: 0 },
  glass: { slot: 'window', localRef: white, roughness: 0.43, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    charcoal: '555753',
    black: '454945',
    darkGray: '656865',
    disk: '666964',
    paleDisk: '797d78',
    glass: '657780',
    duskGlass: '515d65',
    glassBand: '8e9b9e',
    mullion: 'a1a5a0',
    rib: '6c716c',
    roof: '797c76',
    paving: 'aca99d',
    deck: '99968b',
    abutment: 'aaa89e',
    rail: '8e958d',
    pale: 'c1c0b7',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((value, i) => lerp(value, b[i], t));
const p3 = ([x, z], y) => [x, y, z];

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const [a, b] = [terrain.heightsMeters[j], terrain.heightsMeters[j + 1]];
  return (
    lerp(lerp(a[i], a[i + 1], dx), lerp(b[i], b[i + 1], dx), dz) - terrain.modelDatumElevationMeters
  );
}

function face(out, slot, points, wanted, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((total, value, i) => total + value * wanted[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      tint,
    );
}

function ringOrder(points, inner = false) {
  const signed = points.reduce((sum, [x, z], i) => {
    const [a, b] = points[(i + 1) % points.length];
    return sum + x * b - a * z;
  }, 0);
  return signed < 0 !== inner ? [...points].reverse() : points;
}
const exterior = ringOrder(mappedOutline);
const courts = map.features
  .filter((feature) => feature.role === 'museum-void')
  .map((feature) => ringOrder(feature.points, true));

function roofHeight(x, z) {
  const east = clamp((x - 37) / 107, 0, 1);
  const north = clamp((z + 44) / 116, 0, 1);
  return (
    lerp(13.6, plan.section.roofPeak - 6.4 + 6.4 * east, north) -
    2.9 * Math.exp(-Math.pow((x - 85) / 16, 2))
  );
}

function floorHeight(x, z) {
  return Math.min(plan.section.firstFloor - 0.18, ground(x, z) - 0.26);
}

function toe([x, z], inner) {
  if (inner) return [x, z];
  const inset = x > 79 ? 0.068 : 0.022;
  return [lerp(x, 73, inset), lerp(z, 78, inset)];
}

function roofSurface(out) {
  const points = [...exterior, ...courts.flat()];
  let next = exterior.length;
  const holes = courts.map((ring) => {
    const offset = next;
    next += ring.length;
    return offset;
  });
  const triangles = earcut(points.flat(), holes);
  for (let i = 0; i < triangles.length; i += 3) {
    const ring = triangles.slice(i, i + 3).map((index) => points[index]);
    face(
      out,
      'roof',
      ring.map((p) => p3(p, roofHeight(...p))),
      up,
      ring.reduce((sum, p) => sum + p[0], 0) / 3 > 80 ? color.roof : color.darkGray,
    );
  }
}

function sideFrame(a, b, inner) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const normal = [dz / length, 0, -dx / length];
  const lowA = toe(a, inner),
    lowB = toe(b, inner);
  const top = [roofHeight(...a), roofHeight(...b)],
    bottom = [floorHeight(...lowA), floorHeight(...lowB)];
  const at = (u, v, offset = 0) => {
    const p = mix(mix(lowA, lowB, u), mix(a, b, u), v);
    return [
      p[0] + offset * normal[0],
      lerp(lerp(...bottom, u), lerp(...top, u), v),
      p[1] + offset * normal[2],
    ];
  };
  return { length, normal, at };
}

function panel(out, wall, slot, u, v, lo, hi, tint, depth = 0) {
  const { at, normal } = wall;
  face(
    out,
    slot,
    [at(u, lo, depth), at(v, lo, depth), at(v, hi, depth), at(u, hi, depth)],
    normal,
    tint,
  );
}

function glassFront(out, wall, lod, inner) {
  const { at, length } = wall;
  if (lod === 0) {
    panel(out, wall, 'glass', 0, 1, 0, 1, inner ? color.duskGlass : color.glass);
    if (length >= 11) panel(out, wall, 'metal', 0, 1, 0.61, 0.641, color.rib, 0.05);
    return;
  }
  panel(out, wall, 'concrete', 0, 1, 0, 0.17, color.darkGray);
  panel(out, wall, 'glass', 0, 1, 0.17, 0.94, inner ? color.duskGlass : color.glass);
  panel(out, wall, 'metal', 0, 1, 0.94, 1, color.rib);
  const levels = [0.2, 0.35, 0.5, 0.65, 0.8, 0.925];
  if (length < 2) return;
  for (const y of levels) {
    panel(out, wall, 'metal', 0, 1, y, y + 0.018, color.mullion, 0.045);
  }
  const bays = Math.max(1, Math.round(length / [7.5, 5.1, 4.15][lod - 1]));
  for (let i = 0; i < bays; i++) {
    const u = (i + 0.27) / bays;
    const half = Math.min(0.045, 0.31 / length);
    panel(out, wall, 'metal', u - half, u + half, 0.15, 0.95, color.rib, 0.115);
    if (lod >= 2 && length > 5 && i % 2 === 0) {
      beam(
        out,
        'metal',
        at(u, 0.17, 0.27),
        at(u + 0.18 / bays, 0.95, 0.37),
        0.22,
        0.27,
        color.darkGray,
      );
    }
    if (lod >= 2) {
      const start = Math.min(u + 0.27 / bays, 0.93),
        end = Math.min(u + 0.57 / bays, 0.99);
      panel(out, wall, 'glass', start, end, 0.52, 0.64, color.glassBand, 0.07);
    }
  }
}

function galleryDisks(out, wall, lod, index) {
  if (lod > 0) panel(out, wall, 'metal', 0, 1, 0, 0.16, color.black);
  panel(
    out,
    wall,
    'metal',
    0,
    1,
    lod === 0 ? 0 : 0.16,
    1,
    index % 3 === 0 ? color.black : color.charcoal,
  );
  if (wall.length < 5 || lod < 2) return;
  const columns = Math.max(1, Math.round(wall.length / (lod === 2 ? 4.6 : 2.35)));
  const rows = lod === 2 ? 5 : 9,
    facets = lod === 2 ? 4 : 6;
  for (let v = 0; v < rows; v++) {
    for (let u = 0; u < columns; u++) {
      const x = (u + (v % 2 ? 0.65 : 0.4)) / columns,
        y = 0.24 + (0.66 * (v + 0.5)) / rows;
      if (x < 0.018 || x > 0.982) continue;
      const r = 0.56 / wall.length,
        ry = 0.027;
      const tint =
        Math.abs(Math.sin(u * 0.79 + index * 0.36) - (v - rows / 2) * 0.34) < 0.52
          ? color.paleDisk
          : color.disk;
      const ring = Array.from({ length: facets }, (_, i) => {
        const phase = (2 * Math.PI * i) / facets;
        return wall.at(x + r * Math.cos(phase), y + ry * Math.sin(phase), 0.057);
      });
      for (let i = 1; i < ring.length - 1; i++) {
        face(out, 'metal', [ring[0], ring[i], ring[i + 1]], wall.normal, tint);
      }
    }
  }
}

function museum(out, lod) {
  roofSurface(out);
  for (const [ring, inner] of [[exterior, false], ...courts.map((ring) => [ring, true])]) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        [x, z] = mix(a, b, 0.5);
      const wall = sideFrame(a, b, inner);
      if (inner || (x > 80 && z < 166) || (x > 51 && z < 29)) {
        glassFront(out, wall, lod, inner);
      } else {
        galleryDisks(out, wall, lod, i);
      }
    }
  }
  const entryLeft = [103.7, 8.0, 153.8],
    entryRight = [120.6, 8.0, 147.0];
  beam(out, 'metal', [102.0, 5.1, 157.9], [106.5, 24.8, 153.5], 2.0, 2.35, color.black);
  beam(out, 'metal', [121.8, 5.1, 149.2], [119.5, 24.8, 146.9], 2.0, 2.35, color.black);
  beam(out, 'metal', [106.5, 24.8, 153.5], [119.5, 24.8, 146.9], 2.0, 2.35, color.black);
  beam(out, 'glass', entryLeft, entryRight, 0.25, 5.6, color.duskGlass);
  if (lod > 0) {
    const line = [
      [104.8, 23.5, 158.0],
      [113.5, 23.9, 153.2],
      [121.2, 24.1, 149.3],
    ];
    beamPath(out, 'metal', line, 2.3, 0.6, color.rib);
  }
}

const stations = [0];
for (let i = 1; i < deckLine.length; i++) {
  const [a, b] = deckLine.slice(i - 1, i + 1);
  stations.push(stations.at(-1) + Math.hypot(b[0] - a[0], b[1] - a[1]));
}
const totalLength = stations.at(-1);
function deckPoint(distance) {
  const d = clamp(distance, 0, totalLength);
  const end = Math.max(
    1,
    stations.findIndex((s) => s >= d),
  );
  const t = (d - stations[end - 1]) / (stations[end] - stations[end - 1]);
  return mix(deckLine[end - 1], deckLine[end], t);
}
function deckFrame(distance) {
  const p = deckPoint(distance);
  const [a, b] = [deckPoint(distance - 1.8), deckPoint(distance + 1.8)];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { p, normal: [(b[1] - a[1]) / length, (a[0] - b[0]) / length] };
}
function deckY(d) {
  return d < 52
    ? lerp(b.southernDeck, b.centralDeck, d / 52)
    : lerp(b.centralDeck, b.museumDeck, (d - 52) / (totalLength - 52));
}
function deckHalfWidth(d) {
  return (
    lerp(3.35, 6.15, clamp((d - 155) / 62, 0, 1)) + 0.82 * Math.sin((Math.PI * d) / totalLength)
  );
}
function deckEdge(d, side, elevation = 0) {
  const { p, normal } = deckFrame(d),
    half = deckHalfWidth(d) * side;
  return [p[0] + normal[0] * half, deckY(d) + elevation, p[1] + normal[1] * half];
}
function bridgeDeck(out, lod) {
  const spans = [10, 28, 44, 64][lod];
  const distances = [
    ...new Set([
      ...stations,
      ...Array.from({ length: spans + 1 }, (_, i) => (i * totalLength) / spans),
    ]),
  ]
    .sort((a, b) => a - b)
    .filter((value, i, all) => i === 0 || value - all[i - 1] > 0.11);
  const east = distances.map((d) => deckEdge(d, -1)),
    west = distances.map((d) => deckEdge(d, 1));
  for (let i = 1; i < distances.length; i++) {
    face(out, 'paving', [east[i - 1], west[i - 1], west[i], east[i]], up, color.deck);
    for (const [edge, side] of [
      [west, 1],
      [east, -1],
    ]) {
      const [a, b] = edge.slice(i - 1, i + 1);
      const pts = [a, b, [b[0], b[1] - 0.72, b[2]], [a[0], a[1] - 0.72, a[2]]];
      const [x, z] = deckFrame(distances[i]).normal;
      face(out, 'concrete', pts, [side * x, 0, side * z], color.darkGray);
    }
  }
  if (lod === 0) return;
  for (const side of [-1, 1]) {
    const railPath = distances.map((d) => deckEdge(d, side * 0.97, 1.18));
    beamPath(out, 'metal', railPath, 0.14, 0.12, color.rail);
    const spacing = lod === 1 ? 8.8 : lod === 2 ? 3.5 : 2.38;
    for (let d = 0; d <= totalLength; d += spacing) {
      beam(
        out,
        'metal',
        deckEdge(d, side * 0.97, 0),
        deckEdge(d, side * 0.97, 1.19),
        0.091,
        0.088,
        color.rail,
      );
    }
    if (lod === 3) {
      const midrail = distances.map((d) => deckEdge(d, side * 0.97, 0.51));
      beamPath(out, 'metal', midrail, 0.077, 0.061, color.rail);
    }
  }
}

function archPoint(t) {
  const start = deckEdge(b.archStart, 0.81, 0.22),
    end = deckEdge(b.archEnd, 0.81, 0.22);
  const d = lerp(b.archStart, b.archEnd, t),
    p = deckEdge(d, 0.82, 0.22);
  const chord = mix(start, end, t),
    blend = 0.32;
  const rise = 4 * t * (1 - t);
  return [
    lerp(chord[0], p[0], blend),
    chord[1] + b.archRise * rise,
    lerp(chord[2], p[2], blend) + b.tiltMeters * rise,
  ];
}
function bridgeArch(out, lod) {
  const count = [13, 21, 30, 42][lod];
  const arch = Array.from({ length: count + 1 }, (_, i) => archPoint(i / count));
  beamPath(out, 'metal', arch, 1.31, 1.53, color.black);
  const ribs = lod === 0 ? 9 : lod === 1 ? 17 : b.ribs;
  for (let i = 1; i <= ribs; i++) {
    const t = i / (ribs + 1),
      d = lerp(b.archStart + 6.2, b.archEnd - 5.6, t);
    const crest = archPoint((d - b.archStart) / (b.archEnd - b.archStart));
    const base = deckEdge(d + lerp(3.4, -2.0, t), 0.88, 0.11);
    beam(out, 'metal', base, crest, lod < 2 ? 0.31 : 0.36, 0.44, color.charcoal);
  }
  for (const d of [b.archStart, b.archEnd]) {
    const p = deckEdge(d, 0.73),
      base = Math.min(ground(p[0], p[2]) - 0.25, p[1] - 1.4);
    box(out, 'concrete', p[0], base, p[2], 4.65, p[1] - base + 0.32, 5.1, color.abutment);
  }
}

function build(out, lod) {
  museum(out, lod);
  bridgeDeck(out, lod);
  bridgeArch(out, lod);
}
export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);
const recipe = 'taiwan-palace-south-model.mjs';
const camera = [556, 186, 236],
  lookAt = [77, 10, 148];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'museumDistrict', 0.58],
    ['street', 'museumStreet', 0.19],
    ['closeup', 'museumCloseup', 0.045],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: museumCloseup,
  category: 'museum',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The National Palace Museum’s curved dark galleries, sloping glazed public wing and the Zhimei Bridge’s dark steel arch and S-shaped deck.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline: exterior,
    minimumCoverage: 0.93,
    basis: 'Native main museum building outer ring, ODbL 1.0.',
  },
  mediumFiContext: {
    scale: 6.7,
    groundY: 0,
    far: 10000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_painted', 'membrane', 'stone_ashlar', 'concrete_plain'],
  qaCameras: [
    { name: 'lakeside-arch-and-museum', position: [393, 27, 353], lookAt: [95, 11, 201] },
    { name: 'east-curtain-wall-and-courtyards', position: [255, 63, 91], lookAt: [71, 14, 75] },
    { name: 'south-approach-and-arch-ribs', position: [27, 16.5, 345], lookAt: [110, 7, 231] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-taiwan-palace-and-bridge-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 1.24,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap footprint and bridge controls ODbL 1.0. Two exact published Qualla photographs dedicated to the public domain by their creator.',
};
