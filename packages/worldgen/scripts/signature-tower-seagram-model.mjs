/** Seagram: measured bronze I-section curtain wall and the complete Park Avenue plaza composition. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  clockwise,
  commonLimit,
  face,
  mappedCap,
  mappedSolid,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';

const bay = 8.4582,
  module = 1.4097,
  column = 0.9144;
const halfX = (5 * bay + column) / 2,
  halfZ = (3 * bay + column) / 2;
const podium = 1.8,
  officeBase = 9.1,
  officeTop = 143.15,
  roof = 157;
const bronze = [0.15, 0.118, 0.074],
  glass = [0.27, 0.23, 0.205],
  dark = [0.052, 0.044, 0.035],
  granite = [0.68, 0.58, 0.53],
  verde = [0.105, 0.15, 0.12];
const rect = (x0, z0, x1, z1) =>
  clockwise([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]);
const ring = (x, z, y, r, n = 48) => radialRing(y, r, r, n, [x, z]);
function edge(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
    n = [-u[1], u[0]];
  return {
    length,
    at: (t, y, d = 0) => [a[0] + u[0] * t + n[0] * d, y, a[1] + u[1] * t + n[1] * d],
  };
}
const edges = (p) => p.map((a, i) => edge(a, p[(i + 1) % p.length]));
function patch(out, slot, at, x0, x1, y0, y1, color, d = 0) {
  face(out, slot, [at(x0, y0, d), at(x1, y0, d), at(x1, y1, d), at(x0, y1, d)], color);
}
function solidPatch(out, slot, at, x0, x1, y0, y1, d0, d1, color) {
  const a = [at(x0, y0, d1), at(x1, y0, d1), at(x1, y1, d1), at(x0, y1, d1)],
    b = [at(x0, y0, d0), at(x1, y0, d0), at(x1, y1, d0), at(x0, y1, d0)];
  face(out, slot, a, color);
  face(out, slot, b.toReversed(), color);
  for (let i = 0; i < 4; i++) face(out, slot, [a[i], b[i], b[(i + 1) % 4], a[(i + 1) % 4]], color);
}
function iMullion(out, at, x, y0, y1) {
  // LPC: extruded bronze I-section 4.5in face by6in projection; fine webs follow the MoMA detail.
  solidPatch(out, 'bronze', at, x - 0.05715, x + 0.05715, y0, y1, 0.012, 0.026, bronze);
  solidPatch(out, 'bronze', at, x - 0.00635, x + 0.00635, y0, y1, 0.026, 0.15, bronze);
  solidPatch(out, 'bronze', at, x - 0.05715, x + 0.05715, y0, y1, 0.15, 0.1644, bronze);
}
function window(out, at, x0, x1, y0, y1, index) {
  patch(out, 'recess', at, x0, x1, y0, y1, dark, -0.2);
  const state = (index * 17 + Math.floor(index / 7) * 3) % 7;
  const drop = state < 3 ? 0 : state < 6 ? (y1 - y0) * 0.5 : y1 - y0;
  // Slats are actual45-degree geometry behind a translucent pane; three allowed blind stops.
  for (let y = y1 - 0.05; y > y1 - drop; y -= 0.085)
    face(
      out,
      'metal',
      [
        at(x0 + 0.025, y - 0.023, -0.135),
        at(x1 - 0.025, y - 0.023, -0.135),
        at(x1 - 0.025, y + 0.023, -0.089),
        at(x0 + 0.025, y + 0.023, -0.089),
      ],
      [0.47, 0.43, 0.35],
    );
  patch(out, 'clear_glass', at, x0, x1, y0, y1, glass, 0);
}
function curtain(out, plan, y0, y1, rows, { crown = false, marbleSides = false, skip = [] } = {}) {
  for (const [side, e] of edges(plan).entries()) {
    if (skip.includes(side)) continue;
    const { length, at } = e,
      n = Math.max(1, Math.round((length - column) / module)),
      pitch = (length - column) / n;
    // Continuous opaque interior lining closes the reveals behind the applied mullions.
    // Per-pane back planes alone expose through-building cracks at oblique close views.
    solidPatch(out, 'recess', at, 0, length, y0, y1, -0.26, -0.21, dark);
    // Broad corner cladding is distinct from the fine applied I extrusions.
    patch(out, 'bronze', at, 0, column / 2, y0, y1, bronze);
    patch(out, 'bronze', at, length - column / 2, length, y0, y1, bronze);
    const dy = (y1 - y0) / rows;
    for (let row = 0; row < rows; row++) {
      const y = y0 + row * dy,
        spandrel = crown ? dy : 0.81;
      patch(
        out,
        marbleSides && side % 2 === 1 ? 'marble' : 'bronze',
        at,
        column / 2,
        length - column / 2,
        y,
        y + spandrel,
        marbleSides && side % 2 === 1 ? verde : bronze,
      );
      if (!crown)
        for (let i = 0; i < n; i++) {
          const a = column / 2 + i * pitch + 0.031,
            b = column / 2 + (i + 1) * pitch - 0.031;
          if (marbleSides && side % 2 === 1)
            patch(out, 'marble', at, a, b, y + spandrel + 0.03, y + dy - 0.03, verde);
          else
            window(out, at, a, b, y + spandrel + 0.035, y + dy - 0.04, side * 503 + row * 37 + i);
        }
      beam(
        out,
        'bronze',
        at(0, y + 0.01, 0.017),
        at(length, y + 0.01, 0.017),
        0.035,
        0.035,
        bronze,
      );
    }
    for (let i = 0; i <= n; i++) iMullion(out, at, column / 2 + i * pitch, y0, y1);
    if (crown)
      for (let y = y0 + 0.15; y < y1; y += 0.22)
        solidPatch(
          out,
          'bronze',
          at,
          column / 2,
          length - column / 2,
          y,
          y + 0.075,
          -0.015,
          0.014,
          [0.095, 0.082, 0.055],
        );
  }
}
function roofEdges(out, plan, y) {
  mappedCap(out, 'recess', plan, y - 0.24, [0.18, 0.18, 0.16]);
  for (const { length, at } of edges(plan))
    solidPatch(out, 'bronze', at, 0, length, y - 0.24, y, -0.13, 0, bronze);
}
function tree(out, x, y, z, seed) {
  loft(
    out,
    'wood',
    [ring(x, z, y, 0.15, 14), ring(x + 0.17, z, y + 4.7, 0.07, 14)],
    [0.25, 0.2, 0.14],
  );
  for (let i = 0; i < 9; i++) {
    const a = i * 2.399 + seed,
      by = y + 2.2 + (i % 4) * 0.58,
      end = [
        x + Math.cos(a) * (1.5 + (i % 3) * 0.35),
        by + 1.1,
        z + Math.sin(a) * (1.5 + (i % 3) * 0.35),
      ];
    beam(out, 'wood', [x, by, z], end, 0.07, 0.07, [0.28, 0.22, 0.15]);
    for (let j = 0; j < 9; j++) {
      const t = j * 0.73,
        p = [
          end[0] + 0.9 * Math.cos(t),
          end[1] + 0.55 * Math.sin(t * 1.7),
          end[2] + 0.85 * Math.sin(t),
        ];
      sphere(
        out,
        'foliage',
        p,
        [0.48, 0.35, 0.43],
        [0.18 + (j % 3) * 0.025, 0.29 + (i % 3) * 0.035, 0.075],
        12,
        7,
      );
    }
  }
}
function plaza(out) {
  // West entry has three risers; the longer side flights account for the street's fall toward Lexington.
  box(out, 'stone', [-30.48, 0, -13.4], [30.48, 1.12, 43.64], granite);
  const pools = [
    [-28.9, 24.0, -15.1, 42.1],
    [15.1, 24.0, 28.9, 42.1],
  ];
  const xs = [-30.48, -28.9, -15.1, 15.1, 28.9, 30.48],
    zs = [-13.4, 24, 42.1, 43.64];
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      if (j === 1 && (i === 1 || i === 3)) continue;
      box(out, 'stone', [xs[i], 1.12, zs[j]], [xs[i + 1], podium, zs[j + 1]], granite);
    }
  for (const [x0, z0, x1, z1] of pools) {
    box(out, 'stone', [x0, 1.12, z0], [x1, 1.2, z1], [0.46, 0.41, 0.37]);
    mappedCap(
      out,
      'glass',
      rect(x0 + 0.05, z0 + 0.05, x1 - 0.05, z1 - 0.05),
      1.43,
      [0.18, 0.32, 0.34],
    );
    for (let r = 0; r < 3; r++) {
      const d = r * 0.45;
      for (const { length, at } of edges(rect(x0 + d, z0 + d, x1 - d, z1 - d)))
        beam(
          out,
          'stone',
          at(0, 1.65 - r * 0.105),
          at(length, 1.65 - r * 0.105),
          0.12,
          0.12,
          [0.54, 0.49, 0.44],
        );
    }
    // The cluster is permanent fountain hardware; moving water jets belong to the renderer.
    const x = (x0 + x1) / 2,
      z = (z0 + z1) / 2;
    for (let k = 0; k < 9; k++) {
      const a = (k * Math.PI * 2) / 9,
        dx = x + Math.cos(a) * 0.7,
        dz = z + Math.sin(a) * 0.7;
      loft(out, 'bronze', [ring(dx, dz, 1.3, 0.065, 12), ring(dx, dz, 1.5, 0.045, 12)], bronze);
    }
  }
  // Thin slab joints subdivide the pale pink granite without tiling a second stone bond.
  for (let x = -28; x < 30; x += 2.82)
    for (let z = -12; z < 43; z += 2.82) {
      if (
        pools.some(([a, b, c, d]) => x > a - 0.02 && x < c + 0.02 && z > b - 0.02 && z < d + 0.02)
      )
        continue;
      const zx = Math.min(z + 2.8, 43.6),
        xx = Math.min(x + 2.8, 30.4);
      if (!pools.some(([a, b, c, d]) => x >= a && x <= c && zx >= b && z <= d))
        beam(
          out,
          'recess',
          [x, podium + 0.004, z],
          [x, podium + 0.004, zx],
          0.013,
          0.008,
          [0.29, 0.28, 0.25],
        );
      if (!pools.some(([a, b, c, d]) => z >= b && z <= d && xx >= a && x <= c))
        beam(
          out,
          'recess',
          [x, podium + 0.004, z],
          [xx, podium + 0.004, z],
          0.013,
          0.008,
          [0.29, 0.28, 0.25],
        );
    }
  for (let i = 0; i < 3; i++)
    box(
      out,
      'stone',
      [-14.8, podium - (i + 1) * 0.18, 43.64 + i * 0.32],
      [14.8, podium - i * 0.18, 43.96 + i * 0.32],
      granite,
    );
  // Park Avenue's immediate raised sidewalk tapers to the side curb datum.
  box(out, 'stone', [-30.48, 0, 44.6], [30.48, 1.26, 46.8], granite);
  for (const side of [-1, 1]) {
    box(
      out,
      'marble',
      [side < 0 ? -30.48 : 29.93, podium, 24],
      [side < 0 ? -29.93 : 30.48, podium + 0.5, 43.64],
      verde,
    );
    const x0 = side < 0 ? -30.1 : 22.25,
      x1 = side < 0 ? -22.25 : 30.1;
    box(out, 'stone', [x0, 0, -12.8], [x1, podium + 0.38, 18.5], granite);
    mappedCap(
      out,
      'foliage',
      rect(x0 + 0.25, -12.55, x1 - 0.25, 18.25),
      podium + 0.39,
      [0.12, 0.21, 0.065],
    );
    for (let z = -8.5; z < 17; z += 7.2) tree(out, (x0 + x1) / 2, podium + 0.4, z, z * 0.2 + side);
    // Eight side-flight treads under the open canopy, with two continuous bronze handrails.
    for (let i = 0; i < 9; i++) {
      const z = -13.2 - i * 0.28,
        y = podium - (i + 1) * 0.18;
      box(out, 'stone', [x0, Math.max(0, y - 0.18), z - 0.28], [x1, y, z], granite);
    }
    for (const x of [x0 + 0.9, x1 - 0.9]) {
      beam(out, 'bronze', [x, podium + 1, -13.15], [x, 1, -16.02], 0.045, 0.045, bronze);
      for (let i = 0; i <= 5; i++) {
        const z = -13.15 - i * 0.574,
          y = podium - i * 0.36;
        beam(
          out,
          'bronze',
          [x, Math.max(0, y), z],
          [x, Math.max(0, y) + 1, z],
          0.045,
          0.045,
          bronze,
        );
      }
    }
  }
  loft(out, 'bronze', [ring(13.2, 27.1, podium, 0.14), ring(13.2, 27.1, 15.9, 0.055)], bronze);
  sphere(out, 'bronze', [13.2, 16, 27.1], [0.095, 0.095, 0.095], bronze, 24, 12);
}
function revolvingDoor(out, x, z, y) {
  const r = 1.05,
    h = 2.65;
  for (const a of [0, Math.PI])
    for (let k = 0; k < 24; k++) {
      const a0 = a - 0.55 + (1.1 * k) / 24,
        a1 = a - 0.55 + (1.1 * (k + 1)) / 24;
      face(
        out,
        'clear_glass',
        [
          [x + r * Math.cos(a0), y, z + r * Math.sin(a0)],
          [x + r * Math.cos(a1), y, z + r * Math.sin(a1)],
          [x + r * Math.cos(a1), y + h, z + r * Math.sin(a1)],
          [x + r * Math.cos(a0), y + h, z + r * Math.sin(a0)],
        ],
        [0.65, 0.65, 0.6],
      );
    }
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.2,
      dx = Math.cos(a) * r,
      dz = Math.sin(a) * r;
    beam(out, 'bronze', [x, y, z], [x, y + h, z], 0.045, 0.045, bronze);
    face(
      out,
      'clear_glass',
      [
        [x, y, z],
        [x + dx, y, z + dz],
        [x + dx, y + h, z + dz],
        [x, y + h, z],
      ],
      [0.6, 0.61, 0.57],
    );
    for (const py of [y + 0.05, y + h - 0.05])
      beam(out, 'bronze', [x, py, z], [x + dx, py, z + dz], 0.035, 0.035, bronze);
  }
  loft(out, 'bronze', [ring(x, z, y + h, r + 0.06), ring(x, z, y + h + 0.13, r + 0.06)], bronze);
}
function lobby(out) {
  const lobbyHalf = bay * 1.5,
    lobbyFront = halfZ - 2.8;
  // The outer row of columns remains genuinely open around the recessed glazed lobby.
  for (let i = 0; i <= 5; i++)
    for (const z of [-halfZ + 0.46, halfZ - 0.46]) {
      const x = -2.5 * bay + i * bay;
      box(
        out,
        'bronze',
        [x - column / 2, podium, z - column / 2],
        [x + column / 2, officeBase, z + column / 2],
        bronze,
      );
    }
  for (const side of [-1, 1])
    for (let i = 1; i < 3; i++) {
      const z = -1.5 * bay + i * bay,
        x = side * (halfX - 0.46);
      box(
        out,
        'bronze',
        [x - column / 2, podium, z - column / 2],
        [x + column / 2, officeBase, z + column / 2],
        bronze,
      );
    }
  box(out, 'bronze', [-halfX, officeBase - 0.34, -halfZ], [halfX, officeBase, halfZ], bronze);
  const lp = rect(-lobbyHalf, -halfZ - 0.5, lobbyHalf, lobbyFront);
  for (const { length, at } of edges(lp)) {
    const n = Math.round(length / 2.8);
    for (let i = 0; i < n; i++) {
      const a = (i * length) / n,
        b = ((i + 1) * length) / n;
      patch(
        out,
        'clear_glass',
        at,
        a + 0.045,
        b - 0.045,
        podium + 0.04,
        officeBase - 0.4,
        [0.52, 0.52, 0.48],
      );
      beam(out, 'bronze', at(a, podium), at(a, officeBase - 0.35), 0.055, 0.07, bronze);
    }
    beam(out, 'bronze', at(0, podium + 2.7), at(length, podium + 2.7), 0.05, 0.06, bronze);
  }
  // Travertine service enclosures are visible through the glass, as in the public exterior photograph.
  for (const x of [-bay, 0, bay])
    box(
      out,
      'travertine',
      [x - 2.1, podium, -7],
      [x + 2.1, officeBase - 0.4, -2],
      [0.75, 0.71, 0.6],
    );
  for (const x of [-bay, 0, bay]) revolvingDoor(out, x, lobbyFront - 0.4, podium);
  // Flat Muntz-metal marquee, two rows of recessed lamps and a tiled soffit.
  box(out, 'bronze', [-13.2, 6.45, lobbyFront - 0.4], [13.2, 6.72, halfZ + 3.0], bronze);
  for (const z of [halfZ + 1.8, lobbyFront + 0.7])
    for (let x = -12.6; x < 13; x += 1.35)
      face(
        out,
        'recess',
        [
          [x - 0.08, 6.442, z - 0.08],
          [x + 0.08, 6.442, z - 0.08],
          [x + 0.08, 6.442, z + 0.08],
          [x - 0.08, 6.442, z + 0.08],
        ],
        [0.085, 0.08, 0.06],
      );
  for (let x = -20.9; x < 21; x += 1.41)
    for (let z = 10.5; z < 13; z += 1.2)
      face(
        out,
        'concrete',
        [
          [x, officeBase - 0.345, z],
          [x + 1.39, officeBase - 0.345, z],
          [x + 1.39, officeBase - 0.345, z + 1.18],
          [x, officeBase - 0.345, z + 1.18],
        ],
        [0.64, 0.61, 0.53],
      );
}
function terraces(out, plan, y) {
  roofEdges(out, plan, y);
  for (const { length, at } of edges(plan)) {
    beam(out, 'bronze', at(0, y + 0.95, 0.01), at(length, y + 0.95, 0.01), 0.045, 0.045, bronze);
    for (let x = 0.1; x < length; x += 1.41)
      beam(out, 'bronze', at(x, y), at(x, y + 0.95), 0.035, 0.035, bronze);
    for (let x = 1.4; x < length - 1.2; x += 2.7) {
      const p = at(x, y + 0.24, -0.6);
      sphere(out, 'foliage', p, [0.8, 0.35, 0.6], [0.19, 0.29, 0.1], 14, 8);
    }
  }
}
function buildSeagram(out) {
  plaza(out);
  lobby(out);
  const main = clockwise([
    [-halfX, halfZ],
    [halfX, halfZ],
    [halfX, -halfZ],
    [1.5 * bay + column / 2, -halfZ],
    [1.5 * bay + column / 2, -halfZ - bay],
    [-1.5 * bay - column / 2, -halfZ - bay],
    [-1.5 * bay - column / 2, -halfZ],
    [-halfX, -halfZ],
  ]);
  curtain(out, main, officeBase, officeTop, 37);
  curtain(out, main, officeTop, roof, 1, { crown: true });
  roofEdges(out, main, roof);
  // Five-story flanking wings, ten-story bustle and full-height extra rear bay are distinct masses.
  const north = rect(-29.85, -48.2, -13.15, -21.55),
    south = rect(13.15, -47.8, 29.85, -21.55),
    bustle = rect(-13.15, -48.2, 13.15, -21.55);
  for (const p of [north, south]) {
    mappedSolid(out, 'travertine', p, 0, podium, [0.61, 0.55, 0.46]);
    curtain(out, p, podium, 20.1, 5);
    terraces(out, p, 20.1);
  }
  mappedSolid(out, 'recess', bustle, 0, podium, dark);
  curtain(out, bustle, podium, 39.6, 10, { marbleSides: true });
  terraces(out, bustle, 39.6);
  for (const side of [-1, 1]) {
    const x = side * 29.85,
      at = (u, y, d = 0) => [x + side * d, y, -22.1 - side * u];
    solidPatch(out, 'bronze', at, -3, 3, podium + 3.5, podium + 3.8, -1.5, 1.5, bronze);
    for (const u of [-2.6, -1.3, 0, 1.3, 2.6])
      beam(out, 'bronze', at(u, podium), at(u, podium + 3.5), 0.07, 0.07, bronze);
  }
}
export const seagramStudy = {
  id: 'N0205',
  key: 'seagram_building',
  title: 'Seagram Building',
  wikidataId: 'Q737484',
  height: roof,
  mapFrame: 'map-frame.json',
  build: buildSeagram,
  brief:
    "Mies and Johnson's bronze-and-glass five-by-three-bay tower, true I-section mullions, controlled Venetian blinds, dark mechanical crown, recessed open colonnade and Muntz marquee, plus the rear spine, unequal-height wings and pink-granite Park Avenue plaza with paired reflecting pools.",
  sourceFacts: {
    architects: ['Ludwig Mies van der Rohe', 'Philip Johnson', 'Kahn & Jacobs'],
    completed: 1958,
    heightMeters: 157,
    floors: 38,
    structuralBayMeters: bay,
    curtainWallModuleMeters: module,
    bronzeMullionSectionMeters: [0.1143, 0.1524],
    mainStructuralGrid: [5, 3],
    rearExtraBay: 1,
    plazaSetbackMeters: 30.48,
    plazaRisers: 3,
    rearWingStories: 5,
    rearBustleStories: 10,
  },
  reconstruction: {
    geometry:
      'LPC measured structural and curtain-wall modules control the43.2054×26.2890m exterior slab and full-height rear extra bay. Exact mapped tower and separate low/bustle parts corroborate the footprint. Original MoMA plans distinguish the narrow recessed lobby, open columns, rear volumes and two pools. Current owner stack plans confirm fifth- and eleventh-floor planted terraces.',
    facade:
      'Actual0.1143×0.1524m bronze I-section geometry, dark Muntz spandrels, translucent pink-gray panes and explicit45-degree blind slats at three stops. Owner exterior photographs govern bronze patina and low canopy details; intermediate floor and mechanical crown datums are reconstructed inside157m.',
  },
  refs: [
    'https://s-media.nyc.gov/agencies/lpc/lp/1664.pdf',
    'https://www.moma.org/documents/moma_catalogue_3349_300190165.pdf',
    'https://www.skyscrapercenter.com/building/seagrambuilding/3529',
    'https://www.rfr.com/new-york/seagram-building',
    'https://seagram375park.com/the-building/specifications/',
    'https://seagram375park.com/the-building/building-stack-plan/',
    'https://www.openstreetmap.org/way/145341258',
    'https://www.openstreetmap.org/way/145341297',
  ],
  nativeAxes: {
    up: '+Y',
    longAxis: '+X toward52nd Street SSW',
    front: '+Z toward Park Avenue WNW',
  },
  geographic: (m) => ({
    heading: m.heading,
    notes:
      'Main slab center and signed facade frame are registered independently of the attached rear projection. Park Avenue plaza faces+Z/WNW,52nd Street lies+X/SSW and the low wings/bustle extend east to−Z. The exact parent footprint and named shaft parts agree with LPC/MoMA plans. Lowest local curbY0; raised granite plaza and reconstructed street fall are included.',
  }),
  limitations: [
    commonLimit,
    'Curtain-wall modules and I sections follow measured published dimensions; internal floor heights, the mechanical crown split, individual blind settings, bronze patina, terrace planting and curb-grade reconstruction follow public images. Permanent pool hardware is modeled without frozen water jets. Temporary public sculpture, flags, tenant lettering, interiors and subterranean parking are excluded.',
  ],
  camera: { position: [112, 105, 184], lookAt: [0, 70, -5], fov: 42 },
  qaCameras: [
    { name: 'park-avenue', position: [-73, 76, 142], lookAt: [0, 67, 0] },
    { name: 'rear-spine-and-bustle', position: [92, 91, -147], lookAt: [0, 64, -17] },
    { name: 'bronze-curtain-wall', position: [9, 47, 29], lookAt: [3, 44, halfZ] },
    { name: 'i-section-close', position: [3.5, 32.8, 15.4], lookAt: [2.55, 32.9, halfZ] },
    { name: 'mechanical-crown', position: [53, 169, 63], lookAt: [0, 148, 0] },
    { name: 'open-colonnade', position: [32, 5, 24], lookAt: [5, 5, 10] },
    { name: 'marquee-and-doors', position: [4, 4, 23], lookAt: [0, 4, 9] },
    { name: 'reflecting-pools', position: [-38, 16, 61], lookAt: [0, 3, 27] },
    { name: 'side-stairs', position: [41, 6, -5], lookAt: [26, 2, -14] },
    { name: 'fifth-floor-terrace', position: [49, 29, -58], lookAt: [22, 21, -35] },
    { name: 'eleventh-floor-terrace', position: [-35, 54, -74], lookAt: [0, 40, -34] },
    { name: 'far-tower', position: [225, 160, 293], lookAt: [0, 70, -4] },
  ],
};
