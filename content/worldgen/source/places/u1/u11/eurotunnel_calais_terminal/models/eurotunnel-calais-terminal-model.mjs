/** The Charles Dickens passenger terminal at Coquelles, July 2024. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const controls = plan.section;
const [first, last] = controls.canopyEdgeVertices;
const origin = outline[first];
const end = outline[last];
const length = Math.hypot(end[0] - origin[0], end[1] - origin[1]);
const axis = end.map((x, i) => (x - origin[i]) / length);
const front = [-axis[1], 0, axis[0]];
const up = [0, 1, 0];
const down = [0, -1, 0];
const at = (s, y, d) => [
  origin[0] + axis[0] * s + front[0] * d,
  y,
  origin[1] + axis[1] * s + front[2] * d,
];
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((x, i) => lerp(x, b[i], t));
const surfaces = {
  silver: { slot: 'wall', graph: 'metal_painted', roughness: 0.7, metallic: 0.21 },
  frames: { slot: 'trim', graph: 'metal_painted', roughness: 0.59, metallic: 0.25 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.74, metallic: 0.25 },
  canopy: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.35, metallic: 0.17 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.28, metallic: 0.27 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
};
const shade = Object.fromEntries(
  Object.entries({
    cladding: 'a9afb0',
    light: 'b7bcba',
    shell: '929da2',
    trim: 'c4c8c5',
    white: 'd0d1cc',
    charcoal: '4c5b67',
    back: '556879',
    glass: '627c87',
    glassLight: '79909a',
    glassDark: '465765',
    roof: '88989c',
    path: 'c1b7a6',
    edge: 'a49b8a',
    joint: 'a49d91',
    bright: 'd7d5c6',
    vermilion: 'ae4139',
    orange: 'd67836',
    redShade: '9e3b36',
    orangeShade: 'bc5f2b',
    gray: '899290',
  }).map(([name, hex]) => [name, rgb(hex)]),
);

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const h = terrain.heightsMeters;
  return (
    lerp(lerp(h[j][i], h[j][i + 1], u - i), lerp(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}
const gradeAt = (s, d) => {
  const [x, , z] = at(s, 0, d);
  return ground([x, z]);
};

function panel(out, slot, points, normal, color) {
  const facing = normalFor(...points).reduce((sum, x, i) => sum + x * normal[i], 0);
  const ordered = facing > 0 ? points : points.toReversed();
  if (ordered.length === 4) face(out, slot, ordered, color);
  else triangle(out, slot, ordered, color);
}
function surface(out, slot, points, color) {
  const indices = earcut(points.flatMap(([x, , z]) => [x, z]));
  for (let i = 0; i < indices.length; i += 3) {
    panel(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => points[j]),
      up,
      color,
    );
  }
}
function fascia(out, slot, s0, s1, y0, y1, d, color) {
  panel(out, slot, [at(s0, y0, d), at(s1, y0, d), at(s1, y1, d), at(s0, y1, d)], front, color);
}
function strip(out, slot, s0, s1, y0, y1, d, color) {
  panel(
    out,
    slot,
    [at(s0, y0, d), at(s1, y1, d), at(s1, y1, d + 0.055), at(s0, y0, d + 0.055)],
    up,
    color,
  );
}
function shellFootprint() {
  const recess = controls.canopyDepth;
  const shifted = (p) => [p[0] - front[0] * recess, p[1] - front[2] * recess];
  const frontLine = [at(0, 0, -recess), at(length, 0, -recess)].map(([x, , z]) => [x, z]);
  return [
    ...outline.slice(0, first),
    ...frontLine,
    shifted(outline[last + 1]),
    ...outline.slice(last + 2),
  ];
}
const wall = shellFootprint();
const roofHeight = controls.roofHeight;
const depth = -controls.canopyDepth;
const faceBase = 0.48;

function shell(out, lod) {
  const winding = Math.sign(
    wall.reduce((sum, p, i) => {
      const q = wall[(i + 1) % wall.length];
      return sum + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  surface(
    out,
    'roof',
    wall.map(([x, z]) => [x, roofHeight + 0.03, z]),
    shade.roof,
  );
  for (let i = 0; i < wall.length; i++) {
    if (i === first) continue;
    const a = wall[i],
      b = wall[(i + 1) % wall.length];
    const normal = [winding * (b[1] - a[1]), 0, winding * (a[0] - b[0])];
    const plane = (p, y, inset = 0) => {
      const n = Math.hypot(normal[0], normal[2]);
      return [p[0] + (normal[0] * inset) / n, y, p[1] + (normal[2] * inset) / n];
    };
    const base = (p) => Math.min(-0.3, ground(p) - 0.28);
    const side = (slot, l, r, floor, top, tint, inset = 0) =>
      panel(
        out,
        slot,
        [
          plane(l, floor(l), inset),
          plane(r, floor(r), inset),
          plane(r, top, inset),
          plane(l, top, inset),
        ],
        normal,
        tint,
      );
    side('silver', a, b, base, 7.45, i % 3 === 0 ? shade.shell : shade.cladding);
    side('silver', a, b, () => 7.45, roofHeight, shade.light);
    if (lod === 0) continue;
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4.45);
    for (let j = 1; j < n; j++) {
      const station = j / n;
      side(
        'frames',
        mix(a, b, station - 0.0027),
        mix(a, b, station + 0.0027),
        base,
        roofHeight - 0.1,
        shade.gray,
        0.016,
      );
    }
    if (i === last - 2 || i === wall.length - 2) {
      side('glazing', mix(a, b, 0.15), mix(a, b, 0.85), () => 1.0, 3.95, shade.back, 0.028);
    }
  }
}

function entry(out, station, lod) {
  const near = depth + 0.7;
  const left = station - 2.7;
  const right = station + 2.7;
  fascia(out, 'glazing', left, right, faceBase, 3.92, near, shade.glassDark);
  strip(out, 'frames', left - 0.08, right + 0.08, 3.97, 3.97, near - 0.055, shade.trim);
  const glassFrame = (a, b, low, high) =>
    fascia(out, 'frames', a, b, low, high, near + 0.022, shade.white);
  for (const s of [left, station - 0.89, station, station + 0.89, right]) {
    glassFrame(s - 0.078, s + 0.078, faceBase, 3.91);
  }
  for (const y of [0.61, 2.9, 3.9]) glassFrame(left, right, y - 0.072, y + 0.072);
  if (lod >= 2) glassFrame(station - 0.35, station + 0.34, 1.56, 1.66);
  for (const [s, sign] of [
    [left, -1],
    [right, 1],
  ]) {
    panel(
      out,
      'silver',
      [
        at(s, faceBase, depth - 0.08),
        at(s, faceBase, near),
        at(s, 3.98, near),
        at(s, 3.98, depth - 0.08),
      ],
      [axis[0] * sign, 0, axis[1] * sign],
      shade.cladding,
    );
  }
}

function glazedFront(out, lod) {
  const start = controls.frontGlazingStartsAt;
  const glassY = controls.frontGlazingBottom;
  fascia(out, 'silver', 0, start, faceBase, roofHeight, depth, shade.cladding);
  fascia(out, 'paving', 0, length, -0.75, faceBase, depth, shade.edge);
  fascia(out, 'silver', start, length, faceBase, glassY, depth, shade.light);
  fascia(out, 'glazing', start, length, glassY, glassY + 1.38, depth, shade.charcoal);
  fascia(out, 'glazing', start, length, glassY + 1.38, roofHeight, depth, shade.glass);
  for (const [y, width] of [
    [glassY, 0.095],
    [glassY + 1.38, 0.08],
    [glassY + 3.8, 0.075],
    [roofHeight - 0.14, 0.09],
  ]) {
    fascia(out, 'frames', start, length, y - width, y + width, depth + 0.024, shade.trim);
  }
  const spacing = [7.1, 4.45, 2.25, 2.25][lod];
  for (let s = start + 0.085; s < length; s += spacing) {
    fascia(
      out,
      'frames',
      s - 0.045,
      Math.min(s + 0.045, length),
      glassY,
      roofHeight - 0.03,
      depth + 0.03,
      shade.trim,
    );
  }
  if (lod >= 1) {
    for (let s = 2.9; s < start; s += 3.05) {
      fascia(out, 'frames', s - 0.03, s + 0.03, faceBase, roofHeight, depth + 0.018, shade.gray);
    }
    for (let s = start + 1.9; s < length; s += 3.15) {
      if (controls.entranceStations.some((center) => Math.abs(s - center) < 2.9)) continue;
      fascia(out, 'frames', s - 0.025, s + 0.025, faceBase, glassY, depth + 0.018, shade.gray);
    }
  }
  controls.entranceStations.forEach((station) => entry(out, station, lod));
}

function canopy(out, lod) {
  const n = [5, 10, 22, 34][lod];
  const lip = controls.frontCanopyHeight;
  const byLength = (s, muted = false) =>
    mix(
      muted ? shade.redShade : shade.vermilion,
      muted ? shade.orangeShade : shade.orange,
      Math.min(1, (s / length) * 1.4),
    );
  for (let i = 0; i < n; i++) {
    const a = (i * length) / n,
      b = ((i + 1) * length) / n;
    const color = byLength((a + b) * 0.5, i % 7 === 0);
    panel(
      out,
      'canopy',
      [at(a, 8.92, depth), at(b, 8.92, depth), at(b, lip - 0.48, 0), at(a, lip - 0.48, 0)],
      down,
      color,
    );
    fascia(out, 'canopy', a, b, lip - 0.48, lip, 0, color);
    strip(out, 'canopy', a, b, lip, lip - 0.12, -0.055, byLength((a + b) * 0.5));
    panel(
      out,
      'roof',
      [
        at(a, roofHeight + 0.025, depth),
        at(b, roofHeight + 0.025, depth),
        at(b, lip, 0),
        at(a, lip, 0),
      ],
      up,
      shade.roof,
    );
    if (lod >= 2) {
      const width = 0.034;
      panel(
        out,
        'canopy',
        [
          at(a, 8.909, depth),
          at(a + width, 8.909, depth),
          at(a + width, lip - 0.492, 0.003),
          at(a, lip - 0.492, 0.003),
        ],
        down,
        byLength(a, true),
      );
    }
  }
  for (const [s, sign] of [
    [0, -1],
    [length, 1],
  ]) {
    panel(
      out,
      'canopy',
      [at(s, 8.92, depth), at(s, lip - 0.48, 0), at(s, lip, 0), at(s, roofHeight, depth)],
      [axis[0] * sign, 0, axis[1] * sign],
      byLength(s),
    );
  }
  const columnLine = depth + 1.5;
  for (let s = 5.0; s < length; s += 7.7) {
    const base = gradeAt(s, columnLine) - 0.24;
    tube(
      out,
      'frames',
      at(s, base, columnLine),
      at(s, 9.65, columnLine),
      0.205,
      shade.white,
      [5, 8, 10, 12][lod],
    );
    if (lod >= 2)
      tube(out, 'frames', at(s, 8.87, columnLine), at(s, 9.12, columnLine), 0.224, shade.gray, 10);
  }
  if (lod < 2) return;
  tube(
    out,
    'frames',
    at(0, lip + 0.67, -0.38),
    at(length, lip + 0.67, -0.38),
    0.028,
    shade.trim,
    6,
  );
  const spacing = lod === 2 ? 4.8 : 2.4;
  for (let s = 0; s < length; s += spacing) {
    tube(out, 'frames', at(s, lip - 0.03, -0.38), at(s, lip + 0.67, -0.38), 0.028, shade.trim, 5);
  }
}

function sidewalk(out, lod) {
  const n = [4, 7, 12, 20][lod];
  const outer = 1.6;
  const sidewalkY = (s, d) => gradeAt(s, d) + 0.14;
  for (let i = 0; i < n; i++) {
    const a = (i * length) / n,
      b = ((i + 1) * length) / n;
    const p = (s, d) => at(s, sidewalkY(s, d), d);
    panel(
      out,
      'paving',
      [p(a, depth), p(b, depth), p(b, outer), p(a, outer)],
      up,
      i % 5 ? shade.path : shade.edge,
    );
    panel(
      out,
      'paving',
      [
        at(a, sidewalkY(a, outer) - 0.25, outer),
        at(b, sidewalkY(b, outer) - 0.25, outer),
        p(b, outer),
        p(a, outer),
      ],
      front,
      shade.edge,
    );
    if (lod >= 2 && i > 0) {
      panel(
        out,
        'paving',
        [
          at(a - 0.035, sidewalkY(a, depth) + 0.017, depth),
          at(a + 0.035, sidewalkY(a, depth) + 0.017, depth),
          at(a + 0.035, sidewalkY(a, outer) + 0.017, outer),
          at(a - 0.035, sidewalkY(a, outer) + 0.017, outer),
        ],
        up,
        shade.joint,
      );
    }
  }
}

function build(out, lod) {
  shell(out, lod);
  glazedFront(out, lod);
  canopy(out, lod);
  sidewalk(out, lod);
}
export const terminalSkyline = (out) => build(out, 0);
export const terminalDistrict = (out) => build(out, 1);
export const terminalStreet = (out) => build(out, 2);
export const terminalCloseup = (out) => build(out, 3);
const camera = at(87, 31, 82);
const lookAt = [-11.1, 4.5, 5.9];
const recipe = 'eurotunnel-calais-terminal-model.mjs';
export const terminalModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: terminalCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Eurotunnel passenger terminal at Coquelles, with its triangular plan, silver-panel walls, banded glazing, white columns and projecting red-orange roof canopy.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: -1.2,
  sunDirection: [37, 38, 32],
  mediumFiContext: {
    scale: 1.68,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis: 'Named mapped Eurotunnel passenger terminal footprint.',
  },
  embeddedCanonicalGraphs: ['metal_painted', 'metal_standing_seam', 'concrete_plain'],
  qaCameras: [
    {
      name: 'passenger-frontage-and-orange-canopy',
      position: at(72, 5.3, 23),
      lookAt: at(28, 5.7, -2),
    },
    {
      name: 'glazed-vestibules-and-column-line',
      position: at(48, 3.5, 15),
      lookAt: at(37, 5.45, depth),
    },
    { name: 'triangular-terminal-and-rear-wings', position: [-86, 37, -81], lookAt },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `terminal-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'terminalSkyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'terminalDistrict', 0.48],
        ['street', 'terminalStreet', 0.18],
        ['closeup', 'terminalCloseup', 0.064],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model geometry under the repository license. The map outline is ODbL. The selected reference photo is CC0 by DimiTalen.',
};
