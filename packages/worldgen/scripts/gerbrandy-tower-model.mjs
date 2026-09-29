/** Original Gerbrandy Tower exterior, with measured shaft and surveyed guy anchors. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing, torus } from './authored-structure-mesh.mjs';
import { annulus, face, transform } from './heritage-tower-detail-mesh.mjs';
import { box, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const mapBytes = readFileSync(structureSourcePath('n0615_gerbrandy_tower', 'map-frame.json'));
const map = JSON.parse(mapBytes);
const pi = Math.PI;
const concrete = [0.72, 0.73, 0.69],
  steel = [0.78, 0.81, 0.8];
const gray = [0.36, 0.4, 0.41],
  dark = [0.12, 0.16, 0.19];
const red = [0.58, 0.18, 0.11],
  glazing = [0.14, 0.24, 0.28];
const sides = 96;
function cylinder(out, slot, y0, y1, r, color, count = sides, center = [0, 0]) {
  loft(
    out,
    slot,
    [radialRing(y0, r, r, count, center), radialRing(y1, r, r, count, center)],
    color,
  );
}
function rail(out, radius, y, color = red, count = 64) {
  torus(out, 'metal', [0, y + 1.02, 0], radius, 0.035, color, count, 6);
  torus(out, 'metal', [0, y + 0.52, 0], radius, 0.022, color, count, 6);
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * pi) / count;
    tube(
      out,
      'metal',
      [radius * Math.cos(a), y, radius * Math.sin(a)],
      [radius * Math.cos(a), y + 1.05, radius * Math.sin(a)],
      0.026,
      color,
      6,
    );
  }
}
function radial(out, angle) {
  return transform(out, pi / 2 - angle);
}
function window(out, angle, y, width, height, r = 5.35) {
  const g = radial(out, angle),
    half = width / 2;
  box(g, 'glass', [-half, y, r - 0.13], [half, y + height, r - 0.1], glazing);
  for (const x of [-half, half])
    box(g, 'metal', [x - 0.04, y, r - 0.13], [x + 0.04, y + height, r + 0.04], gray);
  for (const yy of [y, y + height])
    box(g, 'metal', [-half - 0.04, yy - 0.04, r - 0.13], [half + 0.04, yy + 0.04, r + 0.04], gray);
  box(
    g,
    'concrete',
    [-half - 0.08, y - 0.11, r - 0.08],
    [half + 0.08, y - 0.03, r + 0.16],
    concrete,
  );
}
function shaft(out) {
  // Build the actual window openings into the shaft rather than painting rectangles over it.
  const yCuts = [0, 1.95, 4.65, 58];
  for (let k = 0; k < 18; k++) yCuts.push(3.5 + k * 3, 4.22 + k * 3);
  const ys = [...new Set(yCuts)].sort((a, b) => a - b);
  const r = 5.35,
    openingHalfAngle = 0.065;
  const openingCenters = [0.28, 0.28 + pi / 2, 0.28 + pi, 0.28 + (3 * pi) / 2];
  const angles = Array.from({ length: sides }, (_, i) => (i * 2 * pi) / sides);
  for (const a of openingCenters) angles.push(a - openingHalfAngle, a + openingHalfAngle);
  const phase = -0.88 + 2 * pi;
  angles.push(phase - 0.14, phase + 0.14);
  angles.sort((a, b) => a - b);
  const angularDistance = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  for (let j = 1; j < ys.length; j++) {
    const y0 = ys[j - 1],
      y1 = ys[j],
      midY = (y0 + y1) / 2;
    const onWindow = Array.from({ length: 18 }, (_, k) => 3.5 + k * 3).some(
      (y) => midY > y && midY < y + 0.72,
    );
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i],
        b = i + 1 < angles.length ? angles[i + 1] : angles[0] + 2 * pi;
      const mid = (a + b) / 2;
      if (
        onWindow &&
        openingCenters.some((c) => Math.abs(angularDistance(mid, c)) < openingHalfAngle)
      )
        continue;
      if (midY > 1.95 && midY < 4.65 && Math.abs(angularDistance(mid, phase)) < 0.14) continue;
      face(
        out,
        'concrete',
        [
          [r * Math.cos(b), y0, r * Math.sin(b)],
          [r * Math.cos(a), y0, r * Math.sin(a)],
          [r * Math.cos(a), y1, r * Math.sin(a)],
          [r * Math.cos(b), y1, r * Math.sin(b)],
        ],
        concrete,
      );
    }
  }
  for (const a of openingCenters)
    for (let k = 0; k < 18; k++) window(out, a, 3.5 + k * 3, 0.64, 0.72);
  const door = radial(out, phase);
  box(door, 'metal', [-0.77, 1.95, 5.17], [0.77, 4.65, 5.21], gray);
  for (const x of [-0.79, 0.79])
    box(door, 'concrete', [x - 0.1, 1.92, 5.2], [x + 0.1, 4.8, 5.56], concrete);
  box(door, 'concrete', [-0.88, 4.66, 5.2], [0.88, 4.85, 5.56], concrete);
  for (let k = 0; k < 10; k++)
    box(door, 'concrete', [-1.2, k * 0.195, 5.3], [1.2, (k + 1) * 0.195, 8.0 - k * 0.27], concrete);
  const upperYs = [57.85, 100];
  for (const y of [64, 70, 76, 82, 92]) upperYs.push(y, y + (y === 92 ? 0.7 : 1.25));
  upperYs.sort((a, b) => a - b);
  for (let j = 1; j < upperYs.length; j++) {
    const y0 = upperYs[j - 1],
      y1 = upperYs[j],
      m = (y0 + y1) / 2;
    const opening = [64, 70, 76, 82, 92].some((y) => m > y && m < y + (y === 92 ? 0.7 : 1.25));
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i],
        b = i + 1 < angles.length ? angles[i + 1] : angles[0] + 2 * pi;
      if (
        opening &&
        openingCenters.some((c) => Math.abs(angularDistance((a + b) / 2, c)) < openingHalfAngle)
      )
        continue;
      face(
        out,
        'concrete',
        [
          [5.05 * Math.cos(b), y0, 5.05 * Math.sin(b)],
          [5.05 * Math.cos(a), y0, 5.05 * Math.sin(a)],
          [5.05 * Math.cos(a), y1, 5.05 * Math.sin(a)],
          [5.05 * Math.cos(b), y1, 5.05 * Math.sin(b)],
        ],
        concrete,
      );
    }
  }
}
function glazedRing(out, y0, y1, r, count = 48) {
  cylinder(out, 'glass', y0, y1, r - 0.08, glazing, count);
  annulus(out, 'concrete', 4.96, r + 0.22, y0 - 0.23, y0, concrete, sides);
  annulus(out, 'concrete', 4.96, r + 0.22, y1, y1 + 0.25, concrete, sides);
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * pi) / count,
      g = radial(out, a);
    box(g, 'metal', [-0.055, y0, r - 0.11], [0.055, y1, r + 0.06], steel);
  }
  torus(out, 'metal', [0, y0 + 0.85, 0], r, 0.045, steel, sides, 6);
}
function dish(out, angle, y, radius, r = 6.9) {
  const g = radial(out, angle),
    center = [0, y, r];
  beam(g, 'metal', [0, y - 0.65, 5.1], [0, y - 0.65, r], 0.12, 0.12, gray);
  // Closed shallow radome, with a recessed mounting neck behind it.
  tube(g, 'metal', [0, y, r - 0.38], [0, y, r - 0.13], radius * 0.2, gray, 12);
  const rings = [0, 0.5, 1].map((t) =>
    Array.from({ length: 36 }, (_, i) => {
      const a = (i * 2 * pi) / 36;
      const rr = radius * (0.9 + 0.1 * Math.sin(t * pi));
      return [
        center[0] + rr * Math.cos(a),
        center[1] + rr * Math.sin(a),
        center[2] - 0.11 + t * 0.22,
      ];
    }),
  );
  loft(g, 'metal', rings, steel);
}
function decks(out) {
  glazedRing(out, 58.1, 61.0, 8.2);
  glazedRing(out, 86.7, 89.5, 8.1);
  for (const y of [62, 68, 74, 80, 86, 90]) {
    const r = y === 90 ? 7.45 : 7.65;
    annulus(out, 'concrete', 4.97, r, y - 0.28, y, concrete, sides);
    rail(out, r - 0.15, y);
    for (let i = 0; i < 16; i++) {
      const a = (i * pi) / 8;
      beam(
        out,
        'concrete',
        [5 * Math.cos(a), y - 0.8, 5 * Math.sin(a)],
        [(r - 0.4) * Math.cos(a), y - 0.26, (r - 0.4) * Math.sin(a)],
        0.2,
        0.24,
        concrete,
      );
    }
  }
  for (const y of [64, 70, 76, 82, 92])
    for (const a of [0.28, 0.28 + pi / 2, 0.28 + pi, 0.28 + (3 * pi) / 2])
      window(out, a, y, 0.64, y === 92 ? 0.7 : 1.25, 5.06);
  for (const [a, y, r] of [
    [0.1, 65, 0.85],
    [1.0, 66, 0.65],
    [2.3, 71, 0.7],
    [3.5, 73, 0.55],
    [4.3, 77, 0.9],
    [5.0, 79, 0.55],
    [0.7, 83, 1.0],
    [2.8, 84, 0.85],
    [4.7, 84, 0.65],
  ])
    dish(out, a, y, r);
  for (const y of [65, 71, 77, 83])
    for (const a of [0.9, 2.8, 4.6]) {
      const g = radial(out, a);
      box(g, 'metal', [-0.18, y - 1, 6.35], [0.18, y + 1.1, 6.66], steel);
      beam(g, 'metal', [0, y - 0.8, 5.0], [0, y - 0.8, 6.4], 0.08, 0.08, gray);
    }
  glazedRing(out, 97.0, 99.4, 5.15, 32);
  cylinder(out, 'concrete', 99.65, 100, 5.4, concrete);
  rail(out, 5.22, 100, gray, 48);
}
function anchorFitting(anchor, index) {
  let best = [0, 0],
    longest = 0;
  for (let i = 0; i < anchor.outline.length; i++) {
    const a = anchor.outline[i],
      b = anchor.outline[(i + 1) % anchor.outline.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d > longest) {
      longest = d;
      best = [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
    }
  }
  return [
    anchor.center[0] + best[0] * (index - 1.5),
    1.2,
    anchor.center[1] + best[1] * (index - 1.5),
  ];
}
function guy(out, anchor, y, index) {
  const [x, z] = anchor.center,
    length = Math.hypot(x, z),
    ux = x / length,
    uz = z / length;
  const start = [ux * 1.55, y, uz * 1.55],
    end = anchorFitting(anchor, index);
  const point = (t) =>
    start.map((v, k) => v + (end[k] - v) * t - (k === 1 ? 1.3 * 4 * t * (1 - t) : 0));
  for (let i = 0; i < 48; i++)
    tube(out, 'metal', point(i / 48), point((i + 1) / 48), 0.0375, gray, 8);
  const t = 0.985;
  tube(out, 'metal', point(t), end, 0.085, steel, 10);
  for (const tt of [0.03, 0.034, 0.038])
    tube(out, 'metal', point(tt), point(tt + 0.0015), 0.08, gray, 8);
}
function mast(out) {
  cylinder(out, 'metal', 100, 360, 1, steel, 64);
  for (let y = 104; y < 357; y += 5) {
    annulus(out, 'metal', 0.99, 1.055, y, y + 0.08, gray, 64);
    for (let i = 0; i < 12; i++) {
      const a = (i * pi) / 6;
      cylinder(out, 'metal', y + 0.08, y + 0.14, 0.042, gray, 6, [
        1.01 * Math.cos(a),
        1.01 * Math.sin(a),
      ]);
    }
  }
  // Four guy height bands share the same three ground anchors; four height bands.
  for (const [index, y] of [122, 226, 302, 350].entries()) {
    annulus(out, 'metal', 0.97, 1.35, y - 0.45, y + 0.45, gray, 48);
    for (const anchor of map.anchors) {
      const [x, z] = anchor.center,
        d = Math.hypot(x, z);
      beam(
        out,
        'metal',
        [x / d, y + 2.5, z / d],
        [(x / d) * 1.7, y, (z / d) * 1.7],
        0.15,
        0.2,
        gray,
      );
      guy(out, anchor, y, index);
    }
    annulus(out, 'metal', 0.99, 2.6, y - 2.1, y - 1.85, gray, 48);
    rail(out, 2.48, y - 1.85, steel, 32);
  }
  for (const y of [128, 212, 270, 309]) {
    annulus(out, 'metal', 0.99, 2.2, y, y + 0.18, gray, 48);
    rail(out, 2.08, y + 0.18, steel, 28);
  }
  // The octagonal reportage cabin documented at approximately 220 m.
  cylinder(out, 'metal', 217.6, 218.0, 4.15, steel, 8);
  cylinder(out, 'glass', 218, 221, 3.92, glazing, 8);
  cylinder(out, 'metal', 221, 221.45, 4.15, steel, 8);
  for (let i = 0; i < 8; i++) {
    const a = pi / 8 + (i * pi) / 4,
      g = radial(out, a);
    for (const x of [-1.48, 1.48])
      box(g, 'metal', [x - 0.065, 218, 3.59], [x + 0.065, 221, 3.72], steel);
    box(g, 'metal', [-1.54, 218, 3.59], [1.54, 218.52, 3.73], steel);
    box(g, 'metal', [-1.54, 220.55, 3.59], [1.54, 221, 3.73], steel);
    beam(
      out,
      'metal',
      [Math.cos(a), 214.5, Math.sin(a)],
      [3.8 * Math.cos(a), 217.65, 3.8 * Math.sin(a)],
      0.12,
      0.16,
      gray,
    );
  }
  // The current four-sided FM/DAB antenna bank: individual dipoles and support frames.
  for (let j = 0; j < 14; j++) {
    const y = 311.5 + j * 2.6;
    for (let i = 0; i < 4; i++) {
      const a = pi / 8 + (i * pi) / 2,
        g = radial(out, a);
      beam(g, 'metal', [0, y, 1], [0, y, 2.6], 0.1, 0.11, gray);
      beam(g, 'metal', [-1.08, y, 2.5], [1.08, y, 2.5], 0.075, 0.075, steel);
      for (const x of [-0.94, -0.36, 0.36, 0.94])
        tube(g, 'metal', [x, y - 0.6, 2.5], [x, y + 0.6, 2.5], 0.043, gray, 8);
      tube(g, 'metal', [-1.16, y - 1.1, 1.7], [-1.16, y + 1.1, 1.7], 0.055, steel, 8);
      tube(g, 'metal', [1.16, y - 1.1, 1.7], [1.16, y + 1.1, 1.7], 0.055, steel, 8);
    }
  }
  for (const y of [352.5, 356.5])
    for (let i = 0; i < 8; i++) {
      const g = radial(out, (i * pi) / 4);
      beam(g, 'metal', [0, y, 1], [0, y, 2.1], 0.07, 0.07, gray);
      tube(g, 'metal', [0, y - 0.52, 2.1], [0, y + 0.52, 2.1], 0.044, gray, 8);
    }
  cylinder(out, 'metal', 360, 361, 0.72, dark, 32);
  cylinder(out, 'metal', 361, 372, 0.47, steel, 32);
  for (let y = 362; y < 372; y += 1.5) annulus(out, 'metal', 0.46, 0.5, y, y + 0.055, gray, 32);
  for (const y of [150, 225, 300, 350])
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * pi) / 3;
      cylinder(out, 'metal', y, y + 0.35, 0.13, red, 12, [1.18 * Math.cos(a), 1.18 * Math.sin(a)]);
    }
}
function buildGerbrandy(out) {
  shaft(out);
  decks(out);
  mast(out);
  for (const anchor of map.anchors) {
    const ring = [...anchor.outline].reverse();
    loft(
      out,
      'concrete',
      [ring.map(([x, z]) => [x, 0, z]), ring.map(([x, z]) => [x, 1.25, z])],
      concrete,
    );
    const [x, z] = anchor.center,
      d = Math.hypot(x, z);
    for (let i = 0; i < 4; i++) {
      const end = anchorFitting(anchor, i);
      beam(
        out,
        'metal',
        [end[0] + (x / d) * 0.28, 0.55, end[2] + (z / d) * 0.28],
        [end[0] - (x / d) * 0.35, 1.45, end[2] - (z / d) * 0.35],
        0.18,
        0.1,
        gray,
      );
    }
  }
}

export const gerbrandyTower = {
  id: 'n0615_gerbrandy_tower',
  planId: 'N0615',
  title: 'Gerbrandy Tower',
  wikidata: 'Q778390',
  build: buildGerbrandy,
  authoringFile: 'gerbrandy-tower-model.mjs',
  size: [365, 372, 390],
  brief:
    'Current hybrid broadcast tower: 100 m concrete shaft, two glazed balcony rings, six open equipment galleries, 2 m steel pipe mast, reportage cabin, individual antenna arrays and twelve guys to the three mapped anchor blocks.',
  front:
    '+X east, +Z south; the three unequal mapped guy-anchor vectors determine site orientation',
  origin: 'Center of the exact-QID concrete shaft footprint, Y=0 at local terrain contact',
  refs: [
    'https://www.cellnex.com/nl-nl/sections/locaties/',
    'https://www.saval.nl/cases/gerbrandytoren/',
    'https://www.volkerwessels.com/nl/projecten/gerbrandytoren',
    'https://zoek.officielebekendmakingen.nl/blg-216282.pdf',
    'https://monumentenregister.cultureelerfgoed.nl/monumenten/532229',
    'https://radiowereld.nl/medianieuws/2002/12/tuidraden-televisietoren-ijsselstein-vervangen/',
    'https://www.openstreetmap.org/way/54688034',
  ],
  facts: {
    architect: 'Anton Auer',
    completed: 1961,
    currentOperatorHeightMeters: 372,
    concreteTowerHeightMeters: 100,
    steelPipeDiameterMeters: 2,
    publishedSteelLengthMeters: 260,
    guyCount: 12,
    anchorCount: 3,
    documentedGuyAttachmentHeightMeters: 226,
    reportageCabinHeightMeters: 220,
    reconstructedGuyAttachmentHeightsMeters: [122, 226, 302, 350],
    concreteShaftDiameterMeters: 10.7,
    contractorHeightConflictMeters: 374,
  },
  scaleBasis:
    'Current owner Cellnex and fire-system installer Saval give 372 m total, approximately 100 m concrete and a 2 m diameter steel tube. RCE confirms the concrete shaft and two glazed balconies. Contemporary contractor photographs determine balcony rhythm, cabin, arrays and intermediate guy bands. Exact-QID OSM shaft and surveyed connected anchor-block footprints supply independent horizontal geometry.',
  geographicProposal: {
    anchor: map.anchor,
    heading: 0,
    elevationMode: 'terrain-contact',
    status: 'preview-proposal',
    source: map.source,
    evidence: map.axis,
    limitations: map.notes.join(' '),
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: `sha256:${createHash('sha256').update(mapBytes).digest('hex')}`,
  },
  limits: [
    'Uses the current operator/installer height of 372 m. The maintenance contractor says 374 m and older map tags say 367 m; these conflicting figures are recorded rather than silently combined.',
    'Balcony elevations, small antenna count and phase, shaft-window compass phase and guy bands at 122/302/350 m are photographic reconstructions. The 226 m guy band, approximately 220 m cabin, 2 m mast diameter and twelve-guy topology are separately published.',
    'The 2002 operator statement describes one 309 m cable, 225 m anchor distance and 226 m attachment height. These rounded figures do not form an exact right triangle; model follows the actual mapped anchor positions and photographic attachment bands, with modest illustrative cable sag.',
    'Three guy foundations share the tower local ground datum across the nearly flat polder. Below-ground concrete, independent generator buildings and seasonal Christmas light strings are excluded from the permanent tower asset.',
  ],
  cameras: [
    { name: 'complete-guyed-tower', position: [510, 250, 600], lookAt: [0, 178, 0] },
    { name: 'concrete-shaft-and-galleries', position: [105, 72, 122], lookAt: [0, 51, 0] },
    { name: 'glazed-balconies-equipment', position: [30, 82, 38], lookAt: [0, 79, 0] },
    { name: 'shaft-windows-and-entrance', position: [21, 8, -26], lookAt: [0, 6, 0] },
    { name: 'reportage-cabin', position: [17, 224, 20], lookAt: [0, 220, 0] },
    { name: 'upper-dipole-array', position: [26, 339, 30], lookAt: [0, 338, 0] },
    { name: 'digital-tip', position: [22, 367, 28], lookAt: [0, 362, 0] },
    { name: 'southwest-anchor', position: [-148, 8, 189], lookAt: [-136.5, 1.5, 175.5] },
    { name: 'mapped-three-anchor-plan', position: [390, 700, 400], lookAt: [15, 100, 0] },
    { name: 'far-silhouette', position: [-650, 250, 750], lookAt: [0, 175, 0] },
  ],
};
