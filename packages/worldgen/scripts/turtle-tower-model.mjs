/** Original Hanoi Turtle Tower exterior from municipal dimensions and site photography. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { facade, face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const mapBytes = readFileSync(structureSourcePath('n0608_turtle_tower', 'map-frame.json'));
const map = JSON.parse(mapBytes),
  tau = Math.PI * 2;
const stone = [0.73, 0.71, 0.65],
  edge = [0.64, 0.63, 0.55];
function stain([x, y, z]) {
  const n =
    Math.sin(x * 5.1 + Math.sin(z * 3.2)) * Math.sin(y * 4.2 - z * 2.1) +
    0.43 * Math.sin(x * 10.4 - y * 8.6 + z * 5.4) +
    0.2 * Math.cos(y * 12.3 + z * 9.1 + x * 11.8);
  const streak = 0.1 * Math.max(0, Math.sin(x * 12 + z * 11)) * Math.max(0, Math.cos(y * 1.9));
  return Math.max(0.52, Math.min(1.12, 0.88 + n * 0.17 - streak));
}
function decorateMesh(mesh) {
  const vertices = new Set();
  for (const group of mesh.groups) {
    if (group.materialRef !== 'matgraph:molen.worldgen.material.plaster_lime') continue;
    for (let i = group.start; i < group.start + group.count; i++) vertices.add(mesh.indices[i]);
  }
  // Equal positions receive equal continuous tints across triangle boundaries.
  for (const index of vertices) {
    const offset = index * 3;
    const value = stain(mesh.positions.subarray(offset, offset + 3));
    for (let k = 0; k < 3; k++)
      mesh.colors[offset + k] = Math.min(255, Math.round(mesh.colors[offset + k] * value));
  }
}
function weathered(out) {
  const emit = (slot, p, color) => {
    if (slot !== 'plaster') {
      triangle(out, slot, p, color);
      return;
    }
    const lengths = p.map((a, i) => Math.hypot(...a.map((v, k) => v - p[(i + 1) % 3][k])));
    const max = Math.max(...lengths),
      i = lengths.indexOf(max);
    if (max > 0.21) {
      const a = p[i],
        b = p[(i + 1) % 3],
        c = p[(i + 2) % 3],
        m = a.map((v, k) => (v + b[k]) / 2);
      emit(slot, [a, m, c], color);
      emit(slot, [m, b, c], color);
      return;
    }
    triangle(out, slot, p, color);
  };
  return {
    addQuad(slot, _ref, p, _normal, _uv, color) {
      emit(slot, [p[0], p[1], p[2]], color);
      emit(slot, [p[0], p[2], p[3]], color);
    },
    addTriangle(slot, _ref, p, _normal, _uv, color) {
      emit(slot, p, color);
    },
    addConvexPolygon(slot, _ref, p, _normal, _uv, color) {
      for (let i = 1; i < p.length - 1; i++) emit(slot, [p[0], p[i], p[i + 1]], color);
    },
  };
}
function band(out, w, d, y, h, over = 0, color = edge) {
  box(
    out,
    'plaster',
    [-w / 2 - over, y, -d / 2 - over],
    [w / 2 + over, y + h, d / 2 + over],
    color,
  );
}
function curve(out, points, width = 0.06, color = edge, slot = 'plaster') {
  for (let i = 1; i < points.length; i++)
    beam(out, slot, points[i - 1], points[i], width, width, color);
}
function stairs(out) {
  for (let i = 0; i < 4; i++)
    box(out, 'plaster', [-0.82, i * 0.2, 2.36], [0.82, (i + 1) * 0.2, 3.85 - i * 0.32], stone);
  for (const x of [-0.97, 0.97]) {
    loft(
      out,
      'plaster',
      [
        [
          [x - 0.12, 0, 2.43],
          [x - 0.12, 0, 3.94],
          [x + 0.12, 0, 3.94],
          [x + 0.12, 0, 2.43],
        ],
        [
          [x - 0.12, 1.02, 2.43],
          [x - 0.12, 0.54, 3.94],
          [x + 0.12, 0.54, 3.94],
          [x + 0.12, 1.02, 2.43],
        ],
      ],
      edge,
    );
    box(out, 'plaster', [x - 0.18, 0, 3.69], [x + 0.18, 0.61, 4.05], edge);
    box(out, 'plaster', [x - 0.23, 0.61, 3.64], [x + 0.23, 0.7, 4.1], stone);
    sphere(out, 'plaster', [x, 0.745, 3.87], [0.18, 0.075, 0.18], edge, 12, 6);
  }
}
function arcade(out, w, d, y0, y1, upper = false) {
  for (let side = 0; side < 4; side++) {
    const o = transform(out, (side * Math.PI) / 2),
      width = side % 2 ? d : w,
      depth = side % 2 ? w : d;
    const xs = side % 2 ? [-width * 0.255, width * 0.255] : [-width * 0.325, 0, width * 0.325];
    const windows = xs.map((x, i) => {
      const center = side % 2 === 0 && i === 1;
      const ww = upper ? (center ? 1.05 : 0.57) : center ? 1.4 : 0.73,
        spring = y0 + (upper ? (center ? 1.02 : 0.89) : center ? 1.12 : 0.96);
      return {
        x,
        w: ww,
        y: y0,
        spring,
        rise: upper ? (center ? 0.65 : 0.54) : center ? 0.87 : 0.67,
        top: y1 - 0.19,
        depth: upper ? 0.33 : 0.42,
        back: false,
        pointed: true,
        trim: 0.065,
      };
    });
    facade(o, 'plaster', width, y0, y1, depth / 2, windows, stone);
    // Inner faces keep the open galleries convincing when viewed through several arches.
    const inner = transform(o, Math.PI, [0, 0, depth - 0.4 * 2]);
    facade(
      inner,
      'plaster',
      width - 0.8,
      y0,
      y1,
      depth / 2 - 0.4,
      windows.map((v) => ({ ...v, x: -v.x, trim: 0, depth: 0.015 })),
      [0.47, 0.47, 0.42],
    );
    for (const x of [-width / 2 + 0.1, width / 2 - 0.1])
      box(o, 'plaster', [x - 0.1, y0, depth / 2], [x + 0.1, y1, depth / 2 + 0.105], edge);
    // Rectangular recessed surrounds and vertical pilasters above each pointed arch.
    for (const win of windows) {
      const span = upper ? win.w + 0.28 : win.w + 0.38;
      for (const x of [win.x - span / 2, win.x + span / 2])
        box(
          o,
          'plaster',
          [x - 0.042, y0 + 0.01, depth / 2 + 0.006],
          [x + 0.042, y1 - 0.17, depth / 2 + 0.083],
          edge,
        );
      box(
        o,
        'plaster',
        [win.x - span / 2 - 0.04, y1 - 0.26, depth / 2 + 0.006],
        [win.x + span / 2 + 0.04, y1 - 0.17, depth / 2 + 0.084],
        edge,
      );
    }
  }
  band(out, w, d, y1, 0.1, 0.14, edge);
  band(out, w, d, y1 + 0.1, 0.09, 0.23, stone);
  band(out, w, d, y1 + 0.19, 0.075, 0.17, edge);
}
function lowerParapet(out) {
  // Solid brick infill, divided by short stone posts, above the first arcade.
  for (let side = 0; side < 4; side++) {
    const o = transform(out, (side * Math.PI) / 2),
      w = side % 2 ? 4.54 : 6.28,
      z = side % 2 ? 3.14 : 2.27;
    box(
      o,
      'brick',
      [-w / 2 + 0.16, 3.54, z - 0.16],
      [w / 2 - 0.16, 3.88, z + 0.02],
      [0.56, 0.39, 0.29],
    );
    for (const x of [-w / 2 + 0.02, 0, w / 2 - 0.02]) {
      box(o, 'plaster', [x - 0.1, 3.5, z - 0.23], [x + 0.1, 4.03, z + 0.075], edge);
      box(o, 'plaster', [x - 0.17, 4.03, z - 0.29], [x + 0.17, 4.12, z + 0.14], stone);
    }
    box(o, 'plaster', [-w / 2, 3.89, z - 0.22], [w / 2, 3.98, z + 0.055], edge);
  }
}
function upperRail(out, w, d, y) {
  for (let side = 0; side < 4; side++) {
    const o = transform(out, (side * Math.PI) / 2),
      width = side % 2 ? d : w,
      z = (side % 2 ? w : d) / 2;
    const n = Math.floor(width / 0.15);
    box(o, 'plaster', [-width / 2, y, z - 0.15], [width / 2, y + 0.105, z + 0.07], edge);
    for (let j = 0; j <= n; j++) {
      const x = -width / 2 + (width * j) / n;
      box(o, 'plaster', [x - 0.035, y + 0.1, z - 0.085], [x + 0.035, y + 0.44, z + 0.025], stone);
    }
    box(
      o,
      'plaster',
      [-width / 2 - 0.025, y + 0.44, z - 0.16],
      [width / 2 + 0.025, y + 0.535, z + 0.1],
      edge,
    );
    for (const x of [-width / 2 + 0.04, width / 2 - 0.04]) {
      box(o, 'plaster', [x - 0.1, y - 0.02, z - 0.19], [x + 0.1, y + 0.68, z + 0.13], edge);
      box(o, 'plaster', [x - 0.14, y + 0.68, z - 0.23], [x + 0.14, y + 0.76, z + 0.17], stone);
    }
  }
}
function circleWall(out, width, y0, y1, z, cy, r) {
  const center = [0, cy, z];
  for (let i = 0; i < 64; i++) {
    const a = (i * tau) / 64,
      b = ((i + 1) * tau) / 64;
    const p = (angle, rr) => [Math.cos(angle) * rr, cy + Math.sin(angle) * rr, z];
    const edgeAt = (angle) =>
      Math.min(
        width / 2 / (Math.abs(Math.cos(angle)) || 1e-9),
        (Math.sin(angle) > 0 ? y1 - cy : cy - y0) / (Math.abs(Math.sin(angle)) || 1e-9),
      );
    const ia = p(a, r),
      ib = p(b, r),
      oa = p(a, edgeAt(a)),
      ob = p(b, edgeAt(b));
    face(out, 'plaster', [ia, oa, ob, ib], stone);
    face(
      out,
      'plaster',
      [
        ia,
        ib,
        ib.map((v, k) => (k === 2 ? v - 0.24 : v)),
        ia.map((v, k) => (k === 2 ? v - 0.24 : v)),
      ],
      edge,
    );
    beam(out, 'plaster', p(a, r + 0.035), p(b, r + 0.035), 0.055, 0.055, edge);
  }
  return center;
}
function medallion(out, x, y, z, r) {
  for (let i = 0; i < 40; i++) {
    const a = (i * tau) / 40,
      b = ((i + 1) * tau) / 40;
    beam(
      out,
      'plaster',
      [x + Math.cos(a) * r, y + Math.sin(a) * r, z],
      [x + Math.cos(b) * r, y + Math.sin(b) * r, z],
      0.045,
      0.045,
      edge,
    );
  }
  for (let i = 0; i < 12; i++) {
    const a = (i * tau) / 12;
    beam(
      out,
      'plaster',
      [x + Math.cos(a) * r * 0.28, y + Math.sin(a) * r * 0.28, z + 0.012],
      [x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86, z + 0.012],
      0.035,
      0.035,
      edge,
    );
  }
  sphere(out, 'plaster', [x, y, z + 0.008], [r * 0.25, r * 0.25, 0.035], edge, 16, 8);
}
function third(out) {
  const w = 2.97,
    d = 1.9,
    y0 = 6.23,
    y1 = 7.53;
  circleWall(out, w, y0, y1, d / 2, 6.85, 0.34);
  box(out, 'plaster', [-w / 2, y0, -d / 2], [w / 2, y1, -d / 2 + 0.24], stone);
  for (const s of [-1, 1]) {
    const o = transform(out, (s * Math.PI) / 2);
    facade(
      o,
      'plaster',
      d,
      y0,
      y1,
      w / 2,
      [
        {
          x: 0,
          w: 0.56,
          y: y0 + 0.12,
          spring: 7.08,
          rise: 0.28,
          top: y1,
          depth: 0.2,
          back: true,
          trim: 0.06,
        },
      ],
      stone,
    );
    const p = [];
    for (let i = 0; i <= 32; i++) {
      const x = -d / 2 + (i * d) / 32;
      p.push([x, 7.4 + 0.52 * Math.sin((Math.PI * i) / 32), w / 2 + 0.055]);
    }
    curve(o, p, 0.105, edge);
  }
  // Original restrained inscription plaque: border/three relief fields, no invented characters.
  box(out, 'plaster', [-0.54, 7.27, d / 2], [0.54, 7.47, d / 2 + 0.065], edge);
  for (const x of [-0.35, 0, 0.35])
    box(out, 'plaster', [x - 0.11, 7.3, d / 2 + 0.065], [x + 0.11, 7.44, d / 2 + 0.085], stone);
  band(out, w, d, 7.53, 0.1, 0.13);
  band(out, 2, 2, 7.64, 0.47, 0, stone);
  for (let side = 0; side < 4; side++) {
    const o = transform(out, (side * Math.PI) / 2);
    medallion(o, 0, 7.88, 1.008, 0.19);
    for (const x of [-0.88, -0.68, 0.68, 0.88])
      box(o, 'plaster', [x - 0.035, 7.7, 1.0], [x + 0.035, 8.05, 1.075], edge);
  }
}
function roof(out) {
  const y = 8.11;
  const ring = (yy, r) => radialRing(yy, r, r, 4, [0, 0], Math.PI / 4);
  loft(out, 'plaster', [ring(y, 1.75), ring(8.31, 1.42), ring(8.47, 0.38)], edge);
  for (let side = 0; side < 4; side++) {
    const o = transform(out, (side * Math.PI) / 2);
    // Four upward-curled ridge tips and paired scrolls match the Vietnamese roof silhouette.
    const pts = [
      [-1.19, 8.14, 1.19],
      [-1.29, 8.2, 1.29],
      [-1.37, 8.33, 1.37],
      [-1.43, 8.55, 1.43],
      [-1.42, 8.74, 1.42],
      [-1.31, 8.75, 1.31],
    ];
    curve(o, pts, 0.095, edge);
    for (const sign of [-1, 1]) {
      const p = [[sign * 0.85, 8.2, 1.1]];
      for (let i = 0; i <= 36; i++) {
        const t = i / 36,
          a = t * Math.PI * 1.66,
          r = 0.27 * (1 - t * 0.56);
        p.push([sign * (0.58 + Math.cos(a) * r), 8.31 + Math.sin(a) * r, 1.1]);
      }
      curve(o, p, 0.07, edge);
    }
    for (let i = 0; i < 15; i++) {
      const x = -1.1 + (i * 2.2) / 14;
      curve(
        o,
        [
          [x, 8.13, 1.14],
          [x * 0.7, 8.31, 0.83],
          [x * 0.22, 8.47, 0.26],
        ],
        0.034,
        [0.47, 0.47, 0.4],
      );
    }
  }
  sphere(out, 'plaster', [0, 8.53, 0], [0.16, 0.18, 0.16], edge, 24, 12);
}
function lights(out) {
  for (let side = 0; side < 4; side++) {
    const o = transform(out, (side * Math.PI) / 2),
      w = side % 2 ? 4.54 : 6.28,
      z = (side % 2 ? 6.28 : 4.54) / 2;
    for (const y of [0.65, 3.25])
      for (const x of [-w * 0.32, 0, w * 0.32]) {
        const fixture = transform(o, -0.25, [x, y, z + 0.16]);
        box(fixture, 'metal', [-0.09, 0, 0], [0.09, 0.17, 0.16], [0.28, 0.3, 0.28]);
        box(fixture, 'glass', [-0.07, 0.02, 0.161], [0.07, 0.13, 0.17], [0.64, 0.66, 0.53]);
      }
  }
}
function build(raw) {
  const out = weathered(raw);
  band(out, 6.48, 4.74, 0, 0.64, 0, stone);
  band(out, 6.28, 4.54, 0.64, 0.09, 0.19, edge);
  band(out, 6.28, 4.54, 0.73, 0.07, 0.13, stone);
  stairs(out);
  arcade(out, 6.28, 4.54, 0.8, 3.21);
  lowerParapet(out);
  arcade(out, 4.8, 3.64, 3.47, 5.7, true);
  upperRail(out, 4.8, 3.64, 5.965);
  third(out);
  roof(out);
  lights(raw);
}
export const turtleTower = {
  id: 'n0608_turtle_tower',
  planId: 'N0608',
  title: 'Turtle Tower',
  wikidata: 'Q1134533',
  authoringFile: 'turtle-tower-model.mjs',
  build,
  decorateMesh,
  front:
    'Native +Z faces east toward the third-floor circular opening and inscription; +X points north',
  origin: 'Center of the exact mapped monument footprint, Y=0 at the grass island ground',
  brief:
    'Hanoi’s small lake monument with a raised base and entrance steps, two diminishing open Gothic arcades, recessed pilasters, brick terrace infill, narrow stone balustrades, east-facing circular aperture, relief medallions and a curled Vietnamese roof. Continuous deterministic vertex tints reproduce weathered plaster without copied image textures.',
  refs: [
    'https://myhanoi.vn/vi/thaprua',
    'https://vietnam.travel/sites/default/files/2018-06/Brochure%201000.pdf',
    'https://dltm-cdn.vnptit3.vn/resources/portal//Images/HNI/Import/636500764509830931_thap_rua_1.png',
    'https://dltm-cdn.vnptit3.vn/resources/portal//Images/HNI/Import/636500764512019063_thap_rua_2.png',
    'https://dltm-cdn.vnptit3.vn/resources/portal//Images/HNI/Import/636500764514674769_thap_rua_3.png',
    'https://dltm-cdn.vnptit3.vn/resources/portal//Images/HNI/Import/636500764517487222_thap_rua_4.png',
    'https://www.openstreetmap.org/way/178995269',
  ],
  facts: {
    heightMeters: 8.8,
    foundationHeightMeters: 0.8,
    lowerPlanMeters: [6.28, 4.54],
    middlePlanMeters: [4.8, 3.64],
    upperPlanMeters: [2.97, 1.9],
    topPlanMeters: [2, 2],
    eastRoundApertureDiameterMeters: 0.68,
    firstTwoLevelsExteriorArchesEach: 10,
    construction: '1884–1886',
  },
  scaleBasis:
    'Municipal tourism documentation gives the height, base rise, three shrinking floor plans, square top and east round aperture. The exact map outline agrees within centimetres. Its four close on-island photographs establish unequal pointed openings, recessed surrounds, stairs, weathering, brick infill and balustrades. The national tourism brochure page 7 establishes the complete roof and scroll silhouette. Intermediate elevations and fine plaster relief are proportionally reconstructed.',
  geographicProposal: {
    anchor: map.anchor,
    heading: map.heading,
    source: map.source,
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: `sha256:${createHash('sha256').update(mapBytes).digest('hex')}`,
    evidence: map.basis,
    limitations:
      'The small island and lake are host terrain/water, not part of this monument mesh. Island ground contact requires terrain data to retain the island instead of generalizing it into water.',
  },
  limits: [
    'Intermediate floor heights and small roof scrolls are reconstructed from photographs. Weathering is an original deterministic pattern, not the exact current stain distribution. Inscription plaque relief fields preserve the location; individual historic calligraphy is not copied.',
    'Gallery openings are genuinely open with wall reveals and inner faces. Interior rooms, altar contents, transient vegetation and maintenance equipment are outside the exterior model scope.',
    'The island perimeter and lake level belong to map/terrain providers. A coarse map that omits the island will need host terrain refinement before real-water clearance can be approved.',
  ],
  cameras: [
    { name: 'east-round-window', position: [10, 7, 17], lookAt: [0, 4, 0] },
    { name: 'west-gallery', position: [-11, 6, -16], lookAt: [0, 4, 0] },
    { name: 'pointed-arcades', position: [5, 3.2, 9], lookAt: [0, 2.5, 0] },
    { name: 'upper-terrace-roof', position: [5, 8.9, 8], lookAt: [0, 6.9, 0] },
    { name: 'roof-plan', position: [2, 18, 3], lookAt: [0, 4, 0] },
    { name: 'far-silhouette', position: [16, 10, 22], lookAt: [0, 4, 0] },
  ],
};
