/** Original Torre dei Lamberti exterior, from operator photographs and its mapped tower outline. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { column, facade, face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const mapBytes = readFileSync(structureSourcePath('n0605_torre_dei_lamberti', 'map-frame.json'));
const map = JSON.parse(mapBytes);
const brick = [0.64, 0.37, 0.255],
  tuff = [0.82, 0.75, 0.6],
  white = [0.88, 0.85, 0.76];
const gray = [0.31, 0.33, 0.31],
  dark = [0.1, 0.105, 0.095],
  bronze = [0.31, 0.34, 0.25];
const width = 9.04,
  depth = 9.27,
  tau = Math.PI * 2;

function stroke(out, a, b, z, weight, color, slot = 'metal', thick = 0.035) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = ((-(b[1] - a[1]) / length) * weight) / 2,
    dy = (((b[0] - a[0]) / length) * weight) / 2;
  const ring = [
    [a[0] - dx, a[1] - dy],
    [b[0] - dx, b[1] - dy],
    [b[0] + dx, b[1] + dy],
    [a[0] + dx, a[1] + dy],
  ];
  face(
    out,
    slot,
    ring.map(([x, y]) => [x, y, z + thick]),
    color,
  );
  face(
    out,
    slot,
    [...ring].reverse().map(([x, y]) => [x, y, z]),
    color,
  );
  for (let i = 0; i < 4; i++) {
    const p = ring[i],
      q = ring[(i + 1) % 4];
    face(
      out,
      slot,
      [
        [p[0], p[1], z],
        [q[0], q[1], z],
        [q[0], q[1], z + thick],
        [p[0], p[1], z + thick],
      ],
      color,
    );
  }
}
function disc(out, slot, x, y, z, r, color, inside = 0, segments = 96) {
  for (let i = 0; i < segments; i++) {
    const a = (i * tau) / segments,
      b = ((i + 1) * tau) / segments;
    const p = (radius, angle) => [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, z];
    if (inside) face(out, slot, [p(inside, a), p(r, a), p(r, b), p(inside, b)], color);
    else triangle(out, slot, [[x, y, z], p(r, a), p(r, b)], color);
  }
}
function blocksArch(out, x, spring, rise, r, z, trim = 0.22, segments = 20) {
  for (let i = 0; i < segments; i++) {
    const a = (i * Math.PI) / segments + 0.008,
      b = ((i + 1) * Math.PI) / segments - 0.008;
    const p = (rr, hh, t) => [x + Math.cos(t) * rr, spring + Math.sin(t) * hh, z];
    const points = [
      p(r, rise, a),
      p(r + trim, rise + trim, a),
      p(r + trim, rise + trim, b),
      p(r, rise, b),
    ];
    face(out, i % 2 ? 'brick' : 'marble', points, i % 2 ? brick : white);
    face(
      out,
      i % 2 ? 'brick' : 'marble',
      [
        points[0].map((v, k) => (k === 2 ? v - 0.13 : v)),
        points[0],
        points[3],
        points[3].map((v, k) => (k === 2 ? v - 0.13 : v)),
      ],
      i % 2 ? brick : white,
    );
  }
}
function rail(out, x0, x1, y, z) {
  const n = Math.ceil((x1 - x0) / 0.21);
  for (let i = 0; i <= n; i++)
    beam(
      out,
      'metal',
      [x0 + ((x1 - x0) * i) / n, y, z],
      [x0 + ((x1 - x0) * i) / n, y + 0.85, z],
      0.035,
      0.035,
      dark,
    );
  for (const h of [0.12, 0.84])
    beam(out, 'metal', [x0, y + h, z], [x1, y + h, z], 0.045, 0.045, dark);
}
function bracket(out, x, y, z, size = 1) {
  // Stepped stone consoles widen outward under the original projecting balconies.
  for (let j = 0; j < 4; j++)
    box(
      out,
      'marble',
      [x - 0.13 * size, y + j * 0.23 * size, z],
      [x + 0.13 * size, y + (j + 1) * 0.23 * size, z + (0.22 + j * 0.18) * size],
      white,
    );
  sphere(
    out,
    'marble',
    [x, y + 0.1 * size, z + 0.1 * size],
    [0.14 * size, 0.16 * size, 0.13 * size],
    white,
    10,
    5,
  );
}
function squareBand(out, y, rise, overhang, slot = 'marble', color = white) {
  box(
    out,
    slot,
    [-width / 2 - overhang, y, -depth / 2 - overhang],
    [width / 2 + overhang, y + rise, depth / 2 + overhang],
    color,
  );
}
function shield(out, x, y, z, scale = 1) {
  const p = [
    [-0.36, 0.45],
    [0.36, 0.45],
    [0.36, -0.03],
    [0.2, -0.32],
    [0, -0.48],
    [-0.2, -0.32],
    [-0.36, -0.03],
  ].map(([a, b]) => [x + a * scale, y + b * scale, z]);
  for (let i = 1; i < p.length - 1; i++) triangle(out, 'marble', [p[0], p[i], p[i + 1]], white);
  for (let i = 0; i < p.length; i++)
    beam(out, 'marble', p[i], p[(i + 1) % p.length], 0.045, 0.045, tuff);
}
function clock(out) {
  const cy = 47.7,
    z = depth / 2 + 0.14,
    r = 3.22;
  disc(out, 'marble', 0, cy, z, r + 0.16, tuff);
  disc(out, 'marble', 0, cy, z + 0.045, r, white);
  disc(out, 'metal', 0, cy, z + 0.062, r - 0.1, gray, r - 0.14);
  disc(out, 'metal', 0, cy, z + 0.07, 2.34, gray, 2.29);
  disc(out, 'concrete', 0, cy, z + 0.07, 2.21, [0.56, 0.57, 0.54]);
  for (let i = 0; i < 60; i++) {
    const a = (i * tau) / 60;
    const p = (rr) => [Math.sin(a) * rr, cy + Math.cos(a) * rr];
    stroke(out, p(2.22), p(i % 5 === 0 ? 2.37 : 2.29), z + 0.08, 0.033, gray);
  }
  const nums = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  const glyph = {
    I: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [-0.18, 0],
        [0.18, 0],
      ],
      [
        [-0.18, 1],
        [0.18, 1],
      ],
    ],
    V: [
      [
        [-0.24, 1],
        [0, 0],
      ],
      [
        [0, 0],
        [0.24, 1],
      ],
    ],
    X: [
      [
        [-0.24, 0],
        [0.24, 1],
      ],
      [
        [-0.24, 1],
        [0.24, 0],
      ],
    ],
  };
  for (let h = 0; h < 12; h++) {
    const a = (h * tau) / 12,
      chars = nums[h];
    for (let j = 0; j < chars.length; j++)
      for (const [p, q] of glyph[chars[j]]) {
        const mapPoint = ([u, v]) => {
          const xx = (j - (chars.length - 1) / 2) * 0.26 + u * 0.48,
            yy = 2.55 + (v - 0.5) * 0.64;
          return [xx * Math.cos(a) + yy * Math.sin(a), cy - xx * Math.sin(a) + yy * Math.cos(a)];
        };
        stroke(out, mapPoint(p), mapPoint(q), z + 0.09, 0.06, gray);
      }
  }
  for (const [a, len, w] of [
    [-Math.PI / 3, 1.61, 0.13],
    [Math.PI / 3, 2.06, 0.09],
  ]) {
    stroke(
      out,
      [-Math.sin(a) * 0.35, cy - Math.cos(a) * 0.35],
      [Math.sin(a) * len, cy + Math.cos(a) * len],
      z + 0.15,
      w,
      dark,
    );
    disc(
      out,
      'metal',
      Math.sin(a) * len * 0.8,
      cy + Math.cos(a) * len * 0.8,
      z + 0.18,
      w * 1.25,
      dark,
      0,
      16,
    );
  }
  disc(out, 'metal', 0, cy, z + 0.2, 0.17, dark, 0, 24);
  box(out, 'shadow', [-0.16, cy - 0.56, z + 0.1], [0.16, cy - 0.12, z + 0.15], dark);
  box(out, 'marble', [-3.5, 51.55, z - 0.1], [3.5, 51.78, z + 0.27], white);
  for (let i = 0; i < 9; i++) bracket(out, -3.25 + i * 0.8125, 50.55, z - 0.08, 0.95);
}
function shaft(out) {
  // The first 37 m preserve the original alternating tuff-and-cotto construction.
  for (let side = 0; side < 4; side++) {
    const o = transform(out, (side * Math.PI) / 2),
      w = side % 2 ? depth : width,
      z = (side % 2 ? width : depth) / 2;
    for (let row = 0, y = 0; y < 37; row++) {
      const top = Math.min(37, y + (row % 2 === 0 ? 0.19 : 0.26)),
        stoneRow = row % 2 === 0;
      facade(o, stoneRow ? 'limestone_raw' : 'brick', w, y, top, z, [], stoneRow ? tuff : brick);
      if (stoneRow)
        for (let i = 0; i < 6; i++) {
          const x = -w / 2 + ((i + 0.35 + (row % 4) * 0.15) * w) / 6;
          box(
            o,
            'shadow',
            [x - 0.008, y + 0.02, z + 0.001],
            [x + 0.008, top - 0.02, z + 0.004],
            [0.43, 0.37, 0.28],
          );
        }
      y = top;
    }
    const holes = [];
    for (let row = 0; row < 12; row++)
      for (let col = 0; col < 6; col++) {
        const x = -3.72 + col * 1.49 + (row % 2) * 0.14,
          y = 37.7 + row * 1.42;
        if (side === 0 && Math.hypot(x, y - 47.7) < 3.7) continue;
        if (side !== 0 && Math.abs(x) < 0.75 && y > 46.0 && y < 49.5) continue;
        holes.push({
          x,
          w: 0.17,
          y,
          spring: y + 0.18,
          rise: 0,
          top: y + 0.18,
          trim: 0,
          depth: 0.16,
        });
      }
    holes.push({
      x: 0,
      w: side === 0 ? 0.55 : 1.05,
      y: side === 0 ? 40 : 46.1,
      spring: side === 0 ? 40.85 : 47.7,
      rise: side === 0 ? 0.275 : 0.525,
      top: side === 0 ? 41.125 : 48.225,
      trim: 0.08,
      depth: 0.7,
    });
    facade(o, 'brick', w, 37, 55.8, z, holes, brick);
    if (side !== 0) blocksArch(o, 0, 47.7, 0.525, 0.525, z + 0.08, 0.18, 12);
    const bays = [-1.75, 0, 1.75].map((x) => ({
      x,
      w: 1.75,
      y: 57.6,
      spring: 61.7,
      rise: 0.875,
      top: 64.4,
      trim: 0,
      depth: 0.85,
      back: false,
    }));
    facade(o, 'brick', w, 55.8, 67, z, bays, brick);
    for (const x of [-0.875, 0.875]) column(o, 'marble', x, z - 0.12, 57.6, 61.7, 0.145, white, 20);
    for (const x of [-2.68, 2.68])
      box(o, 'marble', [x - 0.12, 57.6, z - 0.04], [x + 0.12, 61.75, z + 0.2], white);
    for (const x of [-1.75, 0, 1.75]) blocksArch(o, x, 61.7, 0.875, 0.875, z + 0.08, 0.16, 12);
    blocksArch(o, 0, 61.7, 2.625, 2.625, z + 0.08, 0.28, 24);
    box(o, 'marble', [-2.82, 57.4, z - 0.4], [2.82, 57.63, z + 0.55], white);
    rail(o, -2.65, 2.65, 57.65, z + 0.48);
    for (let i = 0; i < 4; i++) bracket(o, -2.55 + i * 1.7, 56.3, z, 0.95);
    for (const y of [57.0, 61.6])
      box(o, 'marble', [-w / 2, y, z], [w / 2, y + 0.14, z + 0.13], white);
    for (let i = 0; i < 9; i++) bracket(o, -w / 2 + 0.18 + (i * (w - 0.36)) / 8, 65.9, z, 1.05);
    for (const x of [-1.4, 0, 1.4]) shield(o, x, 65.5, z + 0.05, 0.82);
    for (let row = 0; row < 5; row++)
      for (const x of [-3.6, 3.6])
        box(
          o,
          'shadow',
          [x - 0.08, 57 + row * 1.8, z + 0.006],
          [x + 0.08, 57.18 + row * 1.8, z + 0.026],
          dark,
        );
    box(o, 'shadow', [-w / 2 + 0.55, 55.7, z - 0.9], [w / 2 - 0.55, 55.85, z - 0.1], dark);
  }
  squareBand(out, 66.98, 0.16, 0.22);
  squareBand(out, 67.14, 0.23, 0.48);
  squareBand(out, 67.37, 0.2, 0.7);
  // Open iron barrier on the square service terrace around the octagonal upper stage.
  for (let side = 0; side < 4; side++) {
    const o = transform(out, (side * Math.PI) / 2),
      w = (side % 2 ? depth : width) + 1.14,
      z = (side % 2 ? width : depth) / 2 + 0.57;
    rail(o, -w / 2, w / 2, 67.57, z);
  }
  clock(out);
}
function octagonBand(out, y, thickness, apothem, color = white, slot = 'marble') {
  const radius = apothem / Math.cos(Math.PI / 8);
  loft(
    out,
    slot,
    [
      radialRing(y, radius, radius, 8, [0, 0], Math.PI / 8),
      radialRing(y + thickness, radius, radius, 8, [0, 0], Math.PI / 8),
    ],
    color,
  );
}
function bell(out, x, z, y, r) {
  loft(
    out,
    'copper',
    [
      [y, r],
      [y + 0.12, r * 0.98],
      [y + r * 0.35, r * 0.76],
      [y + r * 1.05, r * 0.49],
      [y + r * 1.32, r * 0.47],
      [y + r * 1.4, r * 0.35],
    ].map(([h, rr]) => radialRing(h, rr, rr, 48, [x, z])),
    bronze,
    { cap: false },
  );
  beam(
    out,
    'metal',
    [x - r * 1.3, y + r * 1.57, z],
    [x + r * 1.3, y + r * 1.57, z],
    0.21,
    0.19,
    dark,
  );
  beam(out, 'metal', [x, y + r * 0.55, z], [x, y - 0.15, z], 0.075, 0.075, dark);
  sphere(out, 'metal', [x, y - 0.1, z], [0.13, 0.18, 0.13], dark, 12, 6);
}
function belfry(out) {
  const apothem = 3.75,
    span = 2 * apothem * Math.tan(Math.PI / 8);
  octagonBand(out, 67.58, 0.17, 3.94);
  for (let side = 0; side < 8; side++) {
    const o = transform(out, (side * tau) / 8);
    facade(
      o,
      'brick',
      span,
      67.75,
      71.0,
      apothem,
      [{ x: 0, w: 1.0, y: 68.2, spring: 69.7, rise: 0.5, top: 70.2, depth: 0.38, trim: 0 }],
      brick,
    );
    blocksArch(o, 0, 69.7, 0.5, 0.5, apothem + 0.06, 0.17, 10);
    for (const x of [-0.56, 0.56])
      box(o, 'marble', [x - 0.07, 68.2, apothem], [x + 0.07, 69.7, apothem + 0.12], white);
    box(
      o,
      'wood',
      [-0.39, 68.25, apothem - 0.27],
      [0.39, 69.8, apothem - 0.23],
      [0.28, 0.225, 0.17],
    );
    const windows = [-0.64, 0.64].map((x) => ({
      x,
      w: 1.12,
      y: 71.4,
      spring: 77.3,
      rise: 0.56,
      top: 79.5,
      depth: 0.45,
      trim: 0,
      back: false,
    }));
    facade(o, 'marble', span, 71.4, 79.5, apothem, windows, white);
    column(o, 'marble', 0, apothem - 0.07, 71.4, 77.3, 0.125, white, 20);
    for (const x of [-0.64, 0.64]) blocksArch(o, x, 77.3, 0.56, 0.56, apothem + 0.09, 0.22, 12);
    rail(o, -1.15, 1.15, 71.5, apothem + 0.04);
    box(o, 'marble', [-span / 2, 76.95, apothem], [span / 2, 77.15, apothem + 0.13], white);
    for (const x of [-1.12, 0, 1.12]) bracket(o, x, 78.85, apothem, 0.64);
    shield(o, 0, 78.72, apothem + 0.06, 0.72);
    for (const x of [-span / 2 + 0.11, span / 2 - 0.11])
      for (let y = 71.7; y < 79.1; y += 0.75)
        box(
          o,
          'shadow',
          [x - 0.13, y, apothem + 0.002],
          [x + 0.13, y + 0.018, apothem + 0.007],
          [0.6, 0.59, 0.53],
        );
  }
  octagonBand(out, 71, 0.18, 3.9);
  octagonBand(out, 71.18, 0.23, 3.98);
  octagonBand(out, 79.5, 0.24, 4.08);
  octagonBand(out, 79.74, 0.23, 4.22);
  const rr = 4.22 / Math.cos(Math.PI / 8);
  loft(
    out,
    'copper',
    [
      radialRing(79.98, rr, rr, 8, [0, 0], Math.PI / 8),
      radialRing(81.22, 0.21, 0.21, 8, [0, 0], Math.PI / 8),
    ],
    [0.3, 0.34, 0.31],
  );
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * tau) / 8;
    beam(
      out,
      'metal',
      [Math.cos(a) * rr, 79.99, Math.sin(a) * rr],
      [Math.cos(a) * 0.21, 81.23, Math.sin(a) * 0.21],
      0.045,
      0.045,
      [0.23, 0.28, 0.27],
    );
  }
  sphere(out, 'copper', [0, 81.63, 0], [0.32, 0.43, 0.32], [0.47, 0.43, 0.25], 24, 12);
  beam(out, 'metal', [0, 81.92, 0], [0, 84, 0], 0.065, 0.065, dark);
  // Small metal wind vane is modeled without inventing a heraldic motif.
  face(
    out,
    'metal',
    [
      [0, 83.05, 0],
      [0.65, 83.18, 0],
      [0.65, 83.48, 0],
      [0, 83.4, 0],
    ],
    dark,
  );
  for (const x of [-2.3, 2.3]) beam(out, 'metal', [x, 73, -2.6], [x, 76.9, 2.6], 0.16, 0.16, dark);
  beam(out, 'metal', [-2.7, 76.4, 0], [2.7, 76.4, 0], 0.22, 0.22, dark);
  bell(out, -1.15, 0, 74.1, 0.9155);
  bell(out, 1.25, 0, 74.8, 0.65);
  bell(out, 0, -1.6, 75.6, 0.54);
  bell(out, 0, 1.6, 75.8, 0.41);
}
function build(out) {
  shaft(out);
  belfry(out);
}
export const lambertiTower = {
  id: 'n0605_torre_dei_lamberti',
  planId: 'N0605',
  title: 'Torre dei Lamberti',
  wikidata: 'Q1819804',
  authoringFile: 'lamberti-tower-model.mjs',
  build,
  front: 'Native +Z faces the southwest clock elevation toward Piazza delle Erbe; +X is southeast',
  origin: 'Center of the exact mapped tower footprint, Y=0 at exterior ground',
  brief:
    'The 84 m Veronese tower with alternating tuff and cotto lower shaft, recessed putlog holes, southwest Roman-numeral clock, four true triple-arched galleries, corbelled terraces, octagonal brick drum, open white-marble belfry, four bells and a pitched copper roof with wind vane.',
  refs: [
    'https://www.torredeilamberti.it/storia/',
    'https://www.torredeilamberti.it/',
    'https://www.torredeilamberti.it/wp-content/uploads/DSCF8933.jpg',
    'https://www.torredeilamberti.it/wp-content/uploads/R_UD0028.jpg',
    'https://www.torredeilamberti.it/wp-content/uploads/R_UD0090.jpg',
    'https://www.editorialepolis.it/img/notiziario_pdf/palazzoragione.pdf',
    'https://campanologia.org/campanologia/misurazioni',
    'https://www.openstreetmap.org/way/138829597',
  ],
  facts: {
    heightMeters: 84,
    originalTowerHeightMeters: 37,
    constructionStarted: 1172,
    octagonalBelfry: '1448–1464',
    clockAdded: 1795,
    bells: 4,
    rengoMeasuredMouthDiameterMeters: 1.831,
    planMeters: [width, depth],
    planBasis: 'Exact tower outline way138829597; excludes connected palace wings',
  },
  scaleBasis:
    'The operator gives 84 m overall height and 37 m original lower tower, identifies tuff/cotto and the later marble/brick octagonal belfry. Exact mapped tower width/depth sets plan scale. Current operator photographs DSCF8933, R_UD0028 and R_UD0090 establish the clock face, triple arcades, two-light octagonal bays, stone corbels, iron rails, bell supports and shallow pitched roof. Intermediate floor ordinates, opening widths and small relief are proportional reconstructions; they are not represented as surveyed dimensions.',
  geographicProposal: {
    anchor: map.anchor,
    heading: map.heading,
    source: map.source,
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: `sha256:${createHash('sha256').update(mapBytes).digest('hex')}`,
    evidence: map.basis,
    limitations:
      'Ordinary ground contact. Attached Palazzo della Ragione and Arco della Costa are separate structures, so their volumes are not duplicated in this tower asset.',
  },
  limits: [
    'Intermediate gallery elevations, individual repaired masonry and minor stone moulding profiles are proportionally reconstructed from current operator photographs. The small coats of arms retain shield relief rather than copied heraldic artwork.',
    'Clock hands represent a fixed decorative display, not live time. Bell mounting positions are reconstructed from the visible open belfry; the four-bell identity and largest bell mouth diameter are sourced.',
    'The tower is modeled independently of its attached palace wings; interiors, neighboring palace roofs and Arco della Costa are excluded.',
  ],
  cameras: [
    { name: 'southwest-clock', position: [48, 51, 130], lookAt: [0, 43, 0] },
    { name: 'northeast-rear', position: [-75, 53, -112], lookAt: [0, 42, 0] },
    { name: 'clock-and-trifora', position: [10, 58, 42], lookAt: [0, 54, 0] },
    { name: 'open-marble-belfry', position: [19, 78, 31], lookAt: [0, 74, 0] },
    { name: 'roof-plan', position: [7, 135, 12], lookAt: [0, 46, 0] },
    { name: 'far-silhouette', position: [95, 59, 130], lookAt: [0, 40, 0] },
  ],
};
