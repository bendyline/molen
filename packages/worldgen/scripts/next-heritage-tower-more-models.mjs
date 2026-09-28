/** Original current exterior reconstructions with per-site architectural evidence. */

import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  annulus,
  archBay,
  column,
  cornice,
  dark,
  deform,
  facade,
  face,
  frame,
  stone,
  tau,
  transform,
  triangle,
} from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

function extrude(out, slot, ring, bottom, top, color) {
  const p = ring.slice();
  if (Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 0.001) p.pop();
  const area = p.reduce(
    (a, v, i) => a + v[0] * p[(i + 1) % p.length][1] - v[1] * p[(i + 1) % p.length][0],
    0,
  );
  if (area > 0) p.reverse();
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      out,
      slot,
      [
        [a[0], bottom, a[1]],
        [b[0], bottom, b[1]],
        [b[0], top, b[1]],
        [a[0], top, a[1]],
      ],
      color,
    );
  }
  const ids = earcut(p.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const q = ids.slice(i, i + 3).map((k) => [p[k][0], top, p[k][1]]);
    const n = (q[1][2] - q[0][2]) * (q[2][0] - q[0][0]) - (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]);
    if (n < 0) q.reverse();
    triangle(out, slot, q, color);
    triangle(out, slot, q.map(([x, _y, z]) => [x, bottom, z]).reverse(), color);
  }
}
function bullCapital(out, x, z, y, scale, color) {
  const a = transform(out, 0, [x, y, z]);
  box(
    a,
    'limestone',
    [-0.44 * scale, 0, -0.44 * scale],
    [0.44 * scale, 0.25 * scale, 0.44 * scale],
    color,
  );
  // Opposed recumbent bulls: saddle, shoulders, muzzles, ears and recurved horns.
  sphere(
    a,
    'limestone',
    [0, 0.54 * scale, 0],
    [0.4 * scale, 0.4 * scale, 0.58 * scale],
    color,
    20,
    12,
  );
  for (const s of [-1, 1]) {
    sphere(
      a,
      'limestone',
      [0, 0.83 * scale, s * 0.53 * scale],
      [0.31 * scale, 0.38 * scale, 0.23 * scale],
      color,
      20,
      12,
    );
    sphere(
      a,
      'limestone',
      [0, 0.73 * scale, s * 0.79 * scale],
      [0.24 * scale, 0.17 * scale, 0.2 * scale],
      color,
      16,
      10,
    );
    for (const side of [-1, 1]) {
      beam(
        a,
        'limestone',
        [side * 0.24 * scale, 0.99 * scale, s * 0.55 * scale],
        [side * 0.4 * scale, 1.27 * scale, s * 0.56 * scale],
        0.09 * scale,
        0.09 * scale,
        color,
      );
      beam(
        a,
        'limestone',
        [side * 0.4 * scale, 1.27 * scale, s * 0.56 * scale],
        [side * 0.24 * scale, 1.38 * scale, s * 0.67 * scale],
        0.07 * scale,
        0.07 * scale,
        color,
      );
      sphere(
        a,
        'darkstone',
        [side * 0.25 * scale, 0.94 * scale, s * 0.66 * scale],
        [0.028 * scale, 0.031 * scale, 0.03 * scale],
        [0.24, 0.24, 0.21],
        8,
        4,
      );
    }
  }
  box(
    a,
    'limestone',
    [-0.5 * scale, 1.3 * scale, -0.77 * scale],
    [0.5 * scale, 1.49 * scale, 0.77 * scale],
    color,
  );
}
function flutedColumn(out, x, z, y0, y1, r, color) {
  const ring = (y, radius) =>
    Array.from({ length: 112 }, (_, i) => {
      const a = (-i / 112) * tau,
        rr = radius * (1 - 0.055 * (1 + Math.cos((i / 112) * tau * 28)));
      return [x + rr * Math.cos(a), y, z + rr * Math.sin(a)];
    });
  loft(out, 'limestone', [ring(y0, r), ring(y1, r * 0.86)], color);
  loft(
    out,
    'limestone',
    [
      [y0 - 0.28, r * 1.5],
      [y0 - 0.18, r * 1.45],
      [y0, r * 1.08],
    ].map(([y, rr]) => radialRing(y, rr, rr, 64, [x, z])),
    color,
  );
  loft(
    out,
    'limestone',
    [
      [y1, r * 0.89],
      [y1 + 0.17, r * 1.15],
      [y1 + 0.28, r * 1.2],
    ].map(([y, rr]) => radialRing(y, rr, rr, 64, [x, z])),
    color,
  );
}
function wingedRelief(out, y, z, color) {
  // Original low-relief reconstruction of the winged royal figure, not a photographic decal.
  for (const side of [-1, 1])
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 17 - row * 2; i++) {
        const x = side * (0.4 + i * 0.13),
          yy = y + 0.07 - row * 0.18 + i * 0.011;
        beam(
          out,
          'limestone',
          [x, yy, z],
          [x + side * 0.12, yy - 0.28 - row * 0.018, z + 0.035],
          0.095,
          0.055,
          color,
        );
      }
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * tau,
      b = ((i + 1) / 48) * tau;
    beam(
      out,
      'limestone',
      [Math.cos(a) * 0.45, y + Math.sin(a) * 0.45, z],
      [Math.cos(b) * 0.45, y + Math.sin(b) * 0.45, z],
      0.09,
      0.085,
      color,
    );
  }
  sphere(out, 'limestone', [0, y + 0.57, z + 0.06], [0.19, 0.31, 0.075], color, 20, 12);
  sphere(out, 'limestone', [0, y + 0.94, z + 0.065], [0.14, 0.15, 0.08], color, 16, 10);
  for (const s of [-1, 1])
    beam(
      out,
      'limestone',
      [s * 0.09, y + 0.66, z + 0.05],
      [s * 0.47, y + 0.86, z + 0.05],
      0.11,
      0.07,
      color,
    );
  for (let i = -3; i <= 3; i++)
    beam(out, 'limestone', [i * 0.065, y - 0.39, z], [i * 0.12, y - 0.82, z], 0.09, 0.07, color);
}
function buildFerdowsi(out) {
  const marble = [0.84, 0.82, 0.72],
    trim = [0.91, 0.9, 0.81];
  const data = JSON.parse(
    readFileSync(
      structureSourcePath('n0576_ferdowsi_mausoleum', 'reference-metadata.json'),
      'utf8',
    ),
  );
  const [lon, lat] = data.anchor,
    h = data.heading;
  const local = (p) => {
    const east = (p.lon - lon) * 111320 * Math.cos((lat * Math.PI) / 180),
      south = -(p.lat - lat) * 111320;
    return [east * Math.cos(h) - south * Math.sin(h), east * Math.sin(h) + south * Math.cos(h)];
  };
  for (const e of data.elements) {
    const y0 = Number(e.tags.min_height ?? 0),
      y1 = Number(e.tags.height);
    if (!Number.isFinite(y1) || y1 <= y0) continue;
    // Eight fluted engaged columns replace the map's plain round cylinders below.
    if (e.id >= 966200007 && e.id <= 966200014) continue;
    extrude(out, 'limestone', e.geometry.map(local), y0, y1, marble);
  }
  const core = transform(out, 0, [-0.33, 0, -0.18]);
  // Lower podium mouldings and the corniced 18 m crown follow the current mapped parts.
  for (const [y, w, d, rise] of [
    [3.25, 14.55, 15.1, 0.15],
    [5.0, 13.15, 13.55, 0.18],
    [14.8, 10.4, 10.4, 0.3],
    [16.8, 7.2, 7.25, 0.1],
    [17.9, 4.52, 4.2, 0.1],
  ])
    cornice(core, 'limestone', w, d, y, rise, trim);
  for (const x of [-4.83, 4.83])
    for (const z of [-4.83, 4.83]) {
      flutedColumn(core, x, z, 5.55, 13.05, 0.31, trim);
      bullCapital(core, x, z, 13.18, 0.97, trim);
    }
  for (let side = 0; side < 4; side++) {
    const wall = transform(core, (side * Math.PI) / 2);
    for (const x of [-2.17, 2.17]) {
      flutedColumn(wall, x, 5.13, 5.67, 11.92, 0.22, trim);
      bullCapital(wall, x, 5.13, 12.2, 0.57, trim);
      // Lintel support, paired volutes and capital collar.
      box(wall, 'limestone', [x - 0.4, 13.08, 4.99], [x + 0.4, 13.45, 5.5], trim);
    }
    frame(wall, 'limestone', 0, 5.6, 3.6, 6.7, 5.015, 0.12, trim);
    for (let i = 0; i < 4; i++)
      box(
        wall,
        'limestone',
        [-2.75 + i * 0.14, 12.45 + i * 0.23, 5.04],
        [2.75 - i * 0.14, 12.63 + i * 0.23, 5.34],
        trim,
      );
    // Recessed inscription field: stone strokes remain sculptural and do not invent readable Persian.
    box(wall, 'limestone', [-1.61, 5.77, 5.018], [1.61, 11.94, 5.045], [0.76, 0.76, 0.69]);
    for (let row = 0; row < 16; row++)
      for (let i = 0; i < 14; i++) {
        const x = -1.44 + i * 0.21,
          y = 6.03 + row * 0.345;
        const length = 0.07 + 0.035 * ((row * 7 + i * 3) % 4);
        beam(
          wall,
          'darkstone',
          [x, y, 5.06],
          [x + length, y + 0.026, 5.06],
          0.022,
          0.012,
          [0.48, 0.48, 0.43],
        );
        if ((row + i) % 3 === 0)
          beam(
            wall,
            'darkstone',
            [x + 0.06, y, 5.06],
            [x + 0.09, y + 0.095, 5.06],
            0.021,
            0.012,
            [0.48, 0.48, 0.43],
          );
      }
    for (const bandY of [3.62, 4.08, 4.54])
      for (let i = 0; i < 44; i++) {
        const x = -5.5 + i * 0.25;
        box(
          wall,
          'limestone',
          [x, bandY, 6.78],
          [x + 0.14, bandY + 0.045, 6.81],
          [0.69, 0.69, 0.63],
        );
      }
    for (let i = 0; i < 34; i++)
      box(wall, 'limestone', [-5.0 + i * 0.3, 14.48, 5.09], [-4.87 + i * 0.3, 14.79, 5.31], trim);
    if (side === 0) wingedRelief(wall, 13.8, 5.19, trim);
  }
}

function buildEinstein(out) {
  const ochre = [0.86, 0.82, 0.7],
    edge = [0.89, 0.86, 0.76],
    glass = [0.12, 0.16, 0.17],
    join = [0.65, 0.62, 0.53];
  // Original level zero is the underground laboratory. Current entrance-stair foot is +1.7 m.
  const towerZ = 1.6;
  const ring = (y) =>
    Array.from({ length: 96 }, (_, i) => {
      const a = (-i / 96) * tau,
        taper = 1 - Math.max(0, y - 11) * 0.012;
      return [
        2.8 * taper * Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.32,
        y,
        towerZ + 3.0 * taper * Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.32,
      ];
    });
  // Three-dimensional window breasts, a continuous curved plaster shell and inset wraparound glazing.
  const rows = [4.05, 6.65, 9.25, 11.85];
  const pAt = (i, y, inset = 0) => {
    const p = ring(y)[i % 96];
    return [p[0] * (1 - inset), y, towerZ + (p[2] - towerZ) * (1 - inset)];
  };
  for (let i = 0; i < 96; i++) {
    const mid = ring(8)[i],
      window = Math.abs(mid[0]) > 1.16 && mid[2] > 2.65;
    let previous = 1.4,
      previousB = 1.4;
    for (const y of rows) {
      const crown = (p) => y + 1.12 - 0.18 * Math.max(0, (Math.abs(p[0]) - 2.35) / 0.45);
      const ya = crown(pAt(i, y)),
        yb = crown(pAt(i + 1, y));
      if (window) {
        face(
          out,
          'plaster',
          [pAt(i, previous), pAt(i + 1, previousB), pAt(i + 1, y), pAt(i, y)],
          ochre,
        );
        face(
          out,
          'plaster',
          [pAt(i, y), pAt(i + 1, y), pAt(i + 1, y, 0.105), pAt(i, y, 0.105)],
          edge,
        );
        face(
          out,
          'plaster',
          [pAt(i, ya, 0.105), pAt(i + 1, yb, 0.105), pAt(i + 1, yb), pAt(i, ya)],
          edge,
        );
        face(
          out,
          'shadow',
          [
            pAt(i, y + 0.08, 0.105),
            pAt(i + 1, y + 0.08, 0.105),
            pAt(i + 1, yb - 0.07, 0.105),
            pAt(i, ya - 0.07, 0.105),
          ],
          glass,
        );
        beam(out, 'wood', pAt(i, y + 0.56, 0.1), pAt(i + 1, y + 0.56, 0.1), 0.055, 0.055, edge);
        beam(out, 'wood', pAt(i, y + 0.055, 0.1), pAt(i + 1, y + 0.055, 0.1), 0.055, 0.055, edge);
        beam(out, 'wood', pAt(i, ya - 0.04, 0.1), pAt(i + 1, yb - 0.04, 0.1), 0.055, 0.055, edge);
        if (i % 4 === 0)
          beam(out, 'wood', pAt(i, y + 0.04, 0.1), pAt(i, ya - 0.04, 0.1), 0.055, 0.055, edge);
        previous = ya;
        previousB = yb;
      }
    }
    face(
      out,
      'plaster',
      [pAt(i, previous), pAt(i + 1, previousB), pAt(i + 1, 14.05), pAt(i, 14.05)],
      ochre,
    );
  }
  // Narrow circular observing room rises from the rounded-square shaft.
  const crownOut = transform(out, 0, [0, 0, towerZ]);
  const chamber = [radialRing(14.0, 2.3, 2.5, 96), radialRing(14.85, 2.45, 2.45, 96)];
  for (let i = 0; i < 96; i++) {
    const k = (i + 1) % 96,
      mid = (chamber[0][i][0] + chamber[0][k][0]) / 2;
    if (Math.abs(mid) < 1.0 && chamber[0][i][2] > 2.2) continue;
    face(crownOut, 'plaster', [chamber[0][i], chamber[0][k], chamber[1][k], chamber[1][i]], ochre);
  }
  facade(
    crownOut,
    'plaster',
    2.02,
    14.0,
    14.85,
    2.5,
    [{ x: 0, w: 1.5, y: 14.1, spring: 14.42, rise: 0.31, top: 14.8, depth: 0.15, trim: 0.085 }],
    ochre,
  );
  box(crownOut, 'wood', [-0.028, 14.11, 2.37], [0.028, 14.7, 2.43], edge);
  box(crownOut, 'wood', [-0.7, 14.37, 2.37], [0.7, 14.42, 2.43], edge);
  annulus(crownOut, 'metal', 2.34, 2.52, 14.84, 14.96, edge, 96);
  // In the 2023 restoration the zinc-covered dome, roofs and plaster share the same ochre finish.
  const dome = [];
  for (let j = 0; j < 32; j++) {
    const phi = ((j / 32) * Math.PI) / 2,
      r = 2.45 * Math.cos(phi);
    dome.push(radialRing(14.96 + 2.55 * Math.sin(phi), r, r, 96, [0, towerZ]));
  }
  loft(out, 'metal', dome, edge);
  sphere(out, 'metal', [0, 17.5, towerZ], [0.12, 0.035, 0.12], edge, 20, 8);
  for (let i = 0; i < 32; i++)
    for (let j = 0; j < 25; j++) {
      const a = (i / 32) * tau,
        p = (t) => [
          2.46 * Math.cos(t) * Math.cos(a),
          14.97 + 2.55 * Math.sin(t),
          towerZ + 2.46 * Math.cos(t) * Math.sin(a),
        ];
      beam(
        out,
        'metal',
        p(((j / 26) * Math.PI) / 2),
        p((((j + 1) / 26) * Math.PI) / 2),
        0.018,
        0.018,
        join,
      );
    }
  // The photographed sliding shutter and raised arched guide tracks are kept in a closed weather state.
  for (const x of [-0.61, 0.61]) {
    for (let i = 0; i < 48; i++) {
      const p = (a) => [x, 14.98 + 2.69 * Math.sin(a), towerZ + 2.57 * Math.cos(a)];
      beam(out, 'metal', p((i / 48) * Math.PI), p(((i + 1) / 48) * Math.PI), 0.11, 0.11, edge);
    }
  }
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI,
      b = ((i + 1) / 48) * Math.PI,
      p = (x, t) => [x, 14.98 + 2.67 * Math.sin(t), towerZ + 2.58 * Math.cos(t)];
    face(out, 'metal', [p(-0.56, a), p(0.56, a), p(0.56, b), p(-0.56, b)], ochre);
  }
  // Rounded southern workroom: the 1930 levels and plan distinguish it from the low northern entrance.
  const rearRing = (y, rx, rz) => {
    const p = [
      [-rx, y, -1.4],
      [-rx, y, -6.55],
    ];
    for (let i = 1; i <= 48; i++) {
      const a = Math.PI + (i / 48) * Math.PI;
      p.push([Math.cos(a) * rx, y, -6.55 + Math.sin(a) * rz]);
    }
    p.push([rx, y, -1.4]);
    return p.reverse();
  };
  const rearSections = [
    rearRing(0, 3.38, 3.61),
    rearRing(1.65, 3.15, 3.26),
    rearRing(7.6, 3.15, 3.26),
  ];
  loft(out, 'plaster', rearSections.slice(0, 2), ochre);
  const low = rearSections[1],
    high = rearSections[2];
  for (let i = 0; i < low.length; i++) {
    const k = (i + 1) % low.length;
    if (Math.abs(low[i][0] - low[k][0]) < 0.001 && Math.abs(low[i][2] - low[k][2]) > 4) continue;
    face(out, 'plaster', [low[i], low[k], high[k], high[i]], ochre);
  }
  loft(
    out,
    'metal',
    [rearRing(7.6, 3.25, 3.36), rearRing(7.85, 2.8, 3.05), rearRing(8.05, 0.02, 0.04)],
    edge,
  );
  for (const side of [-1, 1]) {
    const wall = transform(out, (side * Math.PI) / 2, [side * 3.15, 0, -3.975]);
    const windows = [];
    for (const x of [-1.3, 1.3]) {
      windows.push({
        x,
        w: 1.32,
        y: 2.55,
        spring: 3.7,
        rise: 0.48,
        top: 4.38,
        depth: 0.2,
        trim: 0.14,
      });
      windows.push({
        x,
        w: 0.82,
        y: 6.28,
        spring: 6.6,
        rise: 0.32,
        top: 7.15,
        depth: 0.2,
        trim: 0.12,
      });
      for (const y of [2.62, 3.2, 3.75])
        box(wall, 'wood', [x - 0.57, y, -0.15], [x + 0.57, y + 0.065, -0.095], edge);
      box(wall, 'wood', [x - 0.035, 2.55, -0.16], [x + 0.035, 4.02, -0.095], edge);
      box(wall, 'wood', [x - 0.028, 6.3, -0.16], [x + 0.028, 6.9, -0.095], edge);
    }
    facade(wall, 'plaster', 5.15, 1.65, 7.6, 0, windows, ochre);
  }
  // North vestibule, curved roof, two-sided entrance doors and lateral curved glazing.
  const entryRing = (y, r, back) => {
    const p = [[-r, y, back]];
    for (let i = 0; i <= 64; i++) {
      const a = Math.PI - (i / 64) * Math.PI;
      p.push([Math.cos(a) * r, y, 6.6 + Math.sin(a) * r * 0.72]);
    }
    p.push([r, y, back]);
    return p;
  };
  const er = [entryRing(1.68, 3.3, 4.0), entryRing(4.25, 2.9, 4), entryRing(4.65, 3.4, 4)];
  for (let j = 0; j < er.length - 1; j++)
    for (let i = 0; i < er[j].length; i++) {
      const k = (i + 1) % er[j].length,
        a = er[j][i],
        b = er[j][k];
      if (j === 0 && Math.abs((a[0] + b[0]) / 2) < 1.1 && (a[2] + b[2]) / 2 > 7.9) continue;
      face(out, 'plaster', [a, b, er[j + 1][k], er[j + 1][i]], ochre);
    }
  const roofEdge = entryRing(4.68, 3.48, 3.96),
    apex = [0, 5.12, 5.0];
  for (let i = 0; i < roofEdge.length; i++) {
    triangle(out, 'metal', [roofEdge[i], roofEdge[(i + 1) % roofEdge.length], apex], edge);
    if (i % 3 === 0)
      beam(
        out,
        'metal',
        roofEdge[i].map((v, k) => (k === 1 ? v + 0.025 : v)),
        [0, 5.145, 5.0],
        0.018,
        0.018,
        join,
      );
  }
  facade(
    out,
    'plaster',
    2.2,
    1.68,
    4.3,
    8.79,
    [{ x: 0, w: 1.58, y: 1.7, spring: 3.58, rise: 0.56, top: 4.25, depth: 0.06, trim: 0.22 }],
    ochre,
  );
  for (const x of [-0.78, 0, 0.78])
    box(out, 'wood', [x - 0.033, 1.72, 8.765], [x + 0.033, 3.68, 8.84], edge);
  for (const y of [1.82, 2.15, 2.61, 3.1, 3.63])
    box(out, 'wood', [-0.76, y, 8.765], [0.76, y + 0.06, 8.84], edge);
  for (const side of [-1, 1]) {
    const wall = transform(out, (side * Math.PI) / 2, [side * 3.08, 0, 6.15]);
    archBay(wall, 'plaster', 0, 1.65, 2.1, 2.72, 0.6, 3.54, 0.08, 0.05, ochre, { trim: 0.19 });
    box(wall, 'wood', [-0.03, 2.12, 0.065], [0.03, 3.2, 0.13], edge);
    box(wall, 'wood', [-0.76, 2.57, 0.065], [0.76, 2.635, 0.13], edge);
  }
  // Entry terrace and flared parapets wrap around the stair cutout.
  const terrace = [];
  for (let i = 0; i <= 80; i++) {
    const a = Math.PI - (i / 80) * Math.PI,
      x = Math.cos(a) * 3.8,
      z = 7.3 + Math.sin(a) * 4.0;
    if (Math.abs(x) < 1.12) terrace.push([x, 10.4]);
    else terrace.push([x, z]);
  }
  terrace.push([3.8, 6.8], [-3.8, 6.8]);
  extrude(out, 'concrete', terrace, 0, 1.68, [0.61, 0.61, 0.57]);
  for (let i = 0; i < 100; i++) {
    const a = (i / 100) * Math.PI,
      b = ((i + 1) / 100) * Math.PI;
    if (Math.min(Math.abs(Math.cos(a) * 3.8), Math.abs(Math.cos(b) * 3.8)) < 1.12) continue;
    const p = (t, y, r) => [Math.cos(t) * r, y, 7.3 + Math.sin(t) * (r + 0.2)];
    const top = (t) => 2.45 + 2.1 * (1 - Math.sin(t)) ** 2;
    face(out, 'plaster', [p(b, 0, 4.5), p(a, 0, 4.5), p(a, top(a), 3.8), p(b, top(b), 3.8)], ochre);
    face(
      out,
      'plaster',
      [p(a, 1.65, 3.45), p(b, 1.65, 3.45), p(b, top(b), 3.46), p(a, top(a), 3.46)],
      ochre,
    );
    face(
      out,
      'plaster',
      [p(b, top(b), 3.8), p(a, top(a), 3.8), p(a, top(a), 3.46), p(b, top(b), 3.46)],
      edge,
    );
  }
  for (let i = 0; i < 9; i++)
    box(
      out,
      'concrete',
      [-1.11, 0, 10.35 + (8 - i) * 0.31],
      [1.11, ((i + 1) * 1.68) / 9, 10.35 + (9 - i) * 0.31],
      [0.58, 0.59, 0.55],
    );
  // The architectural earth bank covers the laboratory and carries its sloping daylight windows.
  loft(
    out,
    'turf',
    [
      capsule(0, -0.3, 10.6, 23.6).map(([x, z]) => [x, 0, z]),
      capsule(0, -0.3, 6.9, 21).map(([x, z]) => [x, 1.6, z]),
    ],
    [0.24, 0.31, 0.105],
  );
  for (const side of [-1, 1])
    for (const z of [-0.7, 2.7, 6.1]) {
      const wall = deform(transform(out, (side * Math.PI) / 2, [side * 4.3, 0, z]), ([x, y, z]) => [
        x,
        y,
        z + 0.92 - 0.98 * y,
      ]);
      box(wall, 'shadow', [-0.87, 0.14, 0], [0.87, 0.95, 0.065], glass);
      frame(wall, 'metal', 0, 0.14, 1.74, 0.81, 0.07, 0.06, edge);
      box(wall, 'metal', [-0.03, 0.16, 0.08], [0.03, 0.92, 0.13], edge);
      face(
        wall,
        'plaster',
        [
          [-1.06, 0.97, 0.48],
          [1.06, 0.97, 0.48],
          [0.96, 1.63, -0.08],
          [-0.96, 1.63, -0.08],
        ],
        ochre,
      );
      for (const s of [-1, 1])
        triangle(
          wall,
          'plaster',
          [
            [s * 1.06, 0.97, 0.48],
            [s * 0.96, 1.63, -0.08],
            [s * 0.96, 0.19, -0.08],
          ],
          ochre,
        );
    }
  // A narrow plinth closes the walls beneath the modeled earth bank.
  box(out, 'plaster', [-3.05, 0, -7.0], [3.05, 1.69, 6.7], ochre);
}

function resampleRing(ring, step = 1.4) {
  const p = ring.slice();
  if (Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 0.01) p.pop();
  if (
    p.reduce(
      (s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - a[1] * p[(i + 1) % p.length][0],
      0,
    ) > 0
  )
    p.reverse();
  return p.flatMap((a, i) => {
    const b = p[(i + 1) % p.length],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step);
    return Array.from({ length: n }, (_, j) => [
      a[0] + ((b[0] - a[0]) * j) / n,
      a[1] + ((b[1] - a[1]) * j) / n,
    ]);
  });
}
function glazedBlade(out, ring, height, floors, seed = 0) {
  const p = resampleRing(ring),
    silver = [0.83, 0.85, 0.83];
  extrude(out, 'concrete', ring, 0, 0.5, [0.6, 0.63, 0.62]);
  for (let floor = 0; floor < floors; floor++) {
    const y0 = 0.5 + (floor * (height - 1.6)) / floors,
      y1 = 0.5 + ((floor + 1) * (height - 1.6)) / floors;
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        pattern = (i * 19 + floor * 37 + seed * 11) % 31;
      const glass =
        pattern < 9 ? [0.7, 0.74, 0.74] : pattern < 13 ? [0.58, 0.66, 0.68] : [0.29, 0.43, 0.49];
      face(
        out,
        'glass',
        [
          [a[0], y0, a[1]],
          [b[0], y0, b[1]],
          [b[0], y1 - 0.86, b[1]],
          [a[0], y1 - 0.86, a[1]],
        ],
        glass,
      );
      face(
        out,
        'metal',
        [
          [a[0], y1 - 0.86, a[1]],
          [b[0], y1 - 0.86, b[1]],
          [b[0], y1, b[1]],
          [a[0], y1, a[1]],
        ],
        silver,
      );
      beam(out, 'metal', [a[0], y0, a[1]], [a[0], y1, a[1]], 0.065, 0.065, silver);
    }
  }
  const roof = height - 1.1;
  extrude(out, 'metal', ring, roof, roof + 0.2, silver);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      out,
      'metal',
      [
        [a[0], roof + 0.2, a[1]],
        [b[0], roof + 0.2, b[1]],
        [b[0], height, b[1]],
        [a[0], height, a[1]],
      ],
      [0.71, 0.74, 0.72],
    );
    beam(out, 'metal', [a[0], height, a[1]], [b[0], height, b[1]], 0.13, 0.13, silver);
  }
}
function capsule(cx, cz, width, length) {
  const r = width / 2,
    straight = length / 2 - r,
    p = [];
  for (let i = 0; i <= 48; i++) {
    const a = (-i / 48) * Math.PI;
    p.push([cx + Math.cos(a) * r, cz - straight + Math.sin(a) * r]);
  }
  for (let i = 0; i <= 48; i++) {
    const a = Math.PI - (i / 48) * Math.PI;
    p.push([cx + Math.cos(a) * r, cz + straight + Math.sin(a) * r]);
  }
  return p;
}
function buildCoeur(out) {
  const data = JSON.parse(
    readFileSync(structureSourcePath('n0573_c_ur_defense', 'reference-metadata.json'), 'utf8'),
  );
  const [lon, lat] = data.anchor,
    h = data.heading;
  const local = (p) => {
    const e = (p.lon - lon) * 111320 * Math.cos((lat * Math.PI) / 180),
      s = -(p.lat - lat) * 111320;
    return [e * Math.cos(h) - s * Math.sin(h), e * Math.sin(h) + s * Math.cos(h)];
  };
  extrude(out, 'concrete', data.platformOutline, 0, 0.42, [0.71, 0.73, 0.71]);
  // Three 40 m low buildings are individually rounded on the public-esplanade end.
  for (const [i, x] of [-27.55, 9.28, 46.24].entries())
    glazedBlade(out, capsule(x, 0, 18.7, 106), 40, 9, i);
  // Glass atrium fills the spaces between the low fingers, up to the published 44 m height.
  for (const x of [-14.1, 22.7]) {
    box(out, 'glass', [x, 0, -30], [x + 9.8, 42, 27.5], [0.3, 0.47, 0.48]);
    for (let y = 0; y <= 42; y += 3.5)
      box(out, 'metal', [x - 0.05, y, 27.51], [x + 9.85, y + 0.085, 27.62], [0.76, 0.81, 0.79]);
    for (let xx = x; xx <= x + 9.81; xx += 1.63)
      box(out, 'metal', [xx, 0, 27.55], [xx + 0.07, 42, 27.67], [0.76, 0.81, 0.79]);
    for (let z = -30; z < 27; z += 2.7) {
      beam(out, 'metal', [x, 43.3, z], [x + 9.8, 43.3, z], 0.18, 0.18, [0.77, 0.81, 0.79]);
      for (const sign of [-1, 1])
        beam(
          out,
          'metal',
          [sign < 0 ? x : x + 9.8, 42.1, z],
          [x + 4.9, 44, z],
          0.11,
          0.11,
          [0.77, 0.81, 0.79],
        );
    }
  }
  for (const [i, e] of data.elements.entries()) {
    const ring = e.geometry.map(local);
    glazedBlade(out, ring, 161, 41, 10 + i);
    const xs = ring.map((p) => p[0]),
      zs = ring.map((p) => p[1]),
      cx = (Math.min(...xs) + Math.max(...xs)) / 2,
      cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    for (const z of [-17, 1, 19]) {
      box(
        out,
        'metal',
        [cx - 3.4, 159.9, cz + z - 3.0],
        [cx + 3.4, 160.65, cz + z + 3.0],
        [0.47, 0.52, 0.52],
      );
      for (let x = -2.7; x <= 2.8; x += 0.45)
        box(
          out,
          'metal',
          [cx + x, 160.65, cz + z - 2.6],
          [cx + x + 0.07, 160.78, cz + z + 2.6],
          [0.63, 0.67, 0.66],
        );
    }
  }
  // The slim shared lift/circulation link occupies the gap between the staggered blades.
  box(out, 'glass', [-55.12, 0, -29], [-42.45, 151, -14], [0.32, 0.46, 0.49]);
  for (let y = 0; y < 151; y += 3.8)
    for (const z of [-29.03, -13.97])
      box(out, 'metal', [-55.15, y, z - 0.035], [-42.42, y + 0.19, z + 0.035], [0.72, 0.78, 0.77]);
  for (let x = -54.4; x < -42.4; x += 1.5)
    for (const z of [-29.05, -13.95])
      box(out, 'metal', [x, 0, z - 0.035], [x + 0.065, 151, z + 0.035], [0.78, 0.81, 0.8]);
  // Public entrance canopy and the explicit three-bar Coeur glyph are modeled, not text textures.
  box(out, 'glass', [-15, 4.7, 28], [-3, 4.9, 32], [0.56, 0.7, 0.7]);
  for (const x of [-13.5, -5])
    box(out, 'metal', [x - 0.055, 0, 31.7], [x + 0.055, 4.9, 31.8], [0.72, 0.77, 0.77]);
  for (const [x, y0, y1] of [
    [-11.8, 25, 30],
    [-10.2, 23.7, 30],
    [-8.6, 22.4, 30],
  ])
    box(out, 'metal', [x, y0, 27.76], [x + 0.55, y1, 27.89], [0.91, 0.93, 0.89]);
}

export const moreHeritageTowers = [
  {
    id: 'n0576_ferdowsi_mausoleum',
    planId: 'N0576',
    componentMap: { limestone: 'marble' },
    title: 'Ferdowsi Mausoleum',
    wikidata: 'Q5959602',
    build: buildFerdowsi,
    authoringFile: 'next-heritage-tower-more-models.mjs',
    brief:
      'Tus marble memorial with individually mapped entrance steps and layered podium, fluted Achaemenid columns, opposed bull capitals, pseudo-doorways, relief inscription fields, a winged royal figure and the three-step flat crown.',
    size: [36.2, 18, 35.7],
    front: '+Z is the southern entrance-axis face with winged relief',
    origin: 'Exact-QID mapped platform center at the lowest surrounding stair foot',
    refs: [
      'https://visitiran.ir/attraction/mausoleum-ferdowsi',
      'https://en.irancultura.it/tourism/attractions/attractions-mashhad/mashhad-the-tomb-of-Ferdowsi/',
      'https://www.iranicaonline.org/articles/ferdowsi-iii/',
      'https://www.openstreetmap.org/way/966196557',
      'https://www.openstreetmap.org/way/966196607',
    ],
    facts: {
      heightMeters: 18,
      platformElevationMeters: 1.4,
      mappedChamberElevationMeters: [5.1, 15.1],
      mappedUpperCrownMeters: [16.9, 17.9],
      mainCornerColumns: 4,
      engagedColumns: 8,
      stairFlights: 4,
      mainRelief: 'winged royal figure on southern wall',
    },
    scaleBasis:
      'Official Iranian cultural institute gives 18 m present exterior height. Exact OSM building parts supply present platform, stair, shaft and column locations; the measured part geometry is preserved as reference-metadata.json. The Iranica author describes the 1934 chamber as 16 m square; the current mapped upper chamber is about 10 m, consistent with current exterior photography, so the historical chamber dimension is not used to stretch the present crown.',
    geographicProposal: {
      anchor: [59.517545747, 36.486104897],
      heading: 0.806954117337,
      source: 'https://www.openstreetmap.org/way/966196557',
      evidence:
        'The complete mapped platform and four asymmetric stair flights are authored in the exact footprint frame. The southern (+Z) face receives the winged figure described by the national cultural source; native dimensions are preserved.',
      orientationConfidence: 'mapped-stair-asymmetry-and-published-relief-side',
      limitations:
        'The wider western stair and the three narrower flights retain their mapped widths and offsets. Garden pools, separate statues and museum buildings are separate map scenery.',
    },
    limits: [
      'Bull capitals, wing feathers and fluting are original geometric reconstructions fitted to reference photographs. Narrative scenes and calligraphic inscription fields are shallow sculptural marks, not readable transcriptions or casts of individual artworks.',
      'The current upper chamber proportions use OSM part geometry and current official photography; the published 16 m chamber dimension remains recorded as conflicting evidence rather than an established measurement of the current upper chamber.',
    ],
    cameras: [
      { name: 'southern-relief', position: [9, 13, 23], lookAt: [0, 12, 0] },
      { name: 'bull-capitals', position: [10, 15, 11], lookAt: [2.5, 13, 2.5] },
      { name: 'podium-stairs', position: [-25, 8, 23], lookAt: [-3, 2, 0] },
      { name: 'crown', position: [15, 24, 18], lookAt: [0, 15, 0] },
      { name: 'far-silhouette', position: [46, 25, 55], lookAt: [0, 8, 0] },
    ],
  },
  {
    id: 'n0567_einstein_tower',
    planId: 'N0567',
    title: 'Einstein Tower',
    wikidata: 'Q321789',
    build: buildEinstein,
    authoringFile: 'next-heritage-tower-more-models.mjs',
    brief:
      'Mendelsohn’s current ochre observatory after the 2023 restoration: sculpted window breasts, wraparound white-framed windows, asymmetric rounded workroom and entrance, flared terrace parapets, stairs, basement hoods and zinc dome with shutter rails.',
    size: [10, 18, 24],
    front: '+Z is the northern entrance terrace; −Z is the rounded southern workroom',
    origin:
      'Mapped main-body center in plan, entrance-stair foot at Y=0; architect’s underground laboratory datum is about 1.7 m below this point',
    refs: [
      'https://www.einsteinturm.com/en/construction-start',
      'https://www.einsteinturm.com/en/renewed-restoration',
      'https://wuestenrot-stiftung.de/wp-content/uploads/2023/10/02_Pressemappe_Einsteinturm_Potsdam.pdf',
      'https://www.aip.de/en/institute/locations/einstein-tower/',
      'https://www.openstreetmap.org/way/27139591',
    ],
    facts: {
      publishedOverallApproximateHeightMeters: 20,
      architectPlanLevelsMeters: [0, 3.39, 6.8, 10.44, 14.45, 16.55],
      drawingPublicationYear: 1930,
      currentRestorationYear: 2023,
      currentRoofFinish: 'ochre-painted zinc, matching the restored ochre plaster',
      domeState: 'shutter closed',
    },
    scaleBasis:
      'Wüstenrot Foundation’s reproductions of Mendelsohn’s 1930 completed-building plans and sections determine stage proportions and asymmetry. The current 2023 exterior photographs determine restored color, windows, terrace and roof details. The modeled exterior begins at the front stair foot and is approximately 18 m tall. The roughly 20 m published height is consistent with including the lower laboratory datum in the drawing; this datum reconciliation is an inference, not an explicit statement in the source.',
    geographicProposal: {
      anchor: [13.06386459, 52.378845217],
      heading: 1.543271002081 + Math.PI / 2,
      source: 'https://www.openstreetmap.org/way/27139591',
      evidence:
        'The exact-QID mapped long axis is nearly north/south; its rounded end is south. The authored rounded workroom lies at −Z while the main entrance and projecting terrace lie at +Z north, resolving the half-turn ambiguity.',
      orientationConfidence: 'asymmetric-outline-and-architect-plan',
      limitations:
        'The main map polygon excludes part of the entrance terrace and basement window hoods. The photographed basement earth bank is included; surrounding garden remains map scenery. The modeled lowest stair provides the terrain-contact reference.',
    },
    limits: [
      'The source follows the 2023 ochre roof/dome appearance, replacing the outdated white-wall/green-dome color combination. Small handmade plaster variations are reconstructed geometrically from photographs.',
      'The observing shutter is represented in its closed weather state. The photographed earth bank and its sloping daylight windows are included because they define the exterior silhouette; underground telescope/laboratory apparatus is outside this asset.',
    ],
    cameras: [
      { name: 'entrance-terrace', position: [12, 8, 24], lookAt: [0, 4, 6] },
      { name: 'window-breasts', position: [12, 11, 16], lookAt: [0, 9, 2] },
      { name: 'southern-workroom', position: [11, 8, -19], lookAt: [0, 5, -4] },
      { name: 'dome-shutter', position: [8, 21, 10], lookAt: [0, 16, 1.6] },
      { name: 'far-silhouette', position: [33, 19, 42], lookAt: [0, 8, 0] },
    ],
  },
  {
    id: 'n0573_c_ur_defense',
    planId: 'N0573',
    title: 'Cœur Défense',
    wikidata: 'Q2349903',
    build: buildCoeur,
    authoringFile: 'next-heritage-tower-more-models.mjs',
    brief:
      'The staggered pair of rounded 161 m office blades, shared lift link, three lower round-ended blocks, glazed public atrium, white floor bands, varied sun blinds, roof screens and entrance canopy.',
    size: [136, 161, 127],
    front:
      '+Z is the three rounded low-building ends on the esplanade; twin towers occupy the northwest side',
    origin:
      'Exact-QID ground-platform center; the two individually mapped tower outlines keep their measured offsets',
    refs: [
      'https://www.terrellgroup.net/en/immeuble-coeur-defense/',
      'https://www.parisladefense.com/fr/territoire/tours-batiments/coeur-defense',
      'https://resp.editionsparentheses.com/IMG/pdf/P263_DEFENSE_VOL1_EXTRAITS.pdf',
      'https://www.openstreetmap.org/relation/3071676',
      'https://www.openstreetmap.org/way/1158726203',
      'https://www.openstreetmap.org/way/1158726204',
    ],
    facts: {
      towerCount: 2,
      towerHeightMeters: 161,
      towerFloors: 41,
      lowBuildings: 3,
      lowBuildingHeightMeters: 40,
      lowBuildingFloors: 9,
      publishedTowerPlanMeters: [23, 80],
      atriumHeightMeters: 44,
    },
    scaleBasis:
      'Structural engineer Terrell gives two 41-storey 161 m towers and three nine-storey blocks. The district planning authority supplies current exterior photos and the 40 m low-block height. The architectural study describes 23×80 m parallel staggered blades and a 44 m atrium. Exact tower-part polygons provide the two actual rounded plans and positions.',
    geographicProposal: {
      anchor: [2.244187773, 48.890901121],
      heading: -0.448931709142,
      source: 'https://www.openstreetmap.org/relation/3071676',
      evidence:
        'The native frame retains the platform relation and both exact tower-part QIDs Q117352210/Q117352218. All three esplanade fingers and the northwest tower offset are explicit; the tower centers are not replaced by the whole-platform center.',
      orientationConfidence: 'exact-tower-parts-and-asymmetric-platform',
      limitations:
        'The relation is tagged height=1 m and describes the low ground platform, not the union of all upper tower projections. The tall blades extend outside it on the northwest side, as the independent tower-part polygons show.',
    },
    limits: [
      'Facade blinds use a deterministic distribution informed by current photographs; their moment-to-moment open/closed positions are not fixed architectural facts. Small roof equipment and the atrium roof trusses are reconstructed at exterior viewing scale.',
      'Glazing is original tinted PBR geometry; reusable painted-metal and concrete surfaces supply structural texture without per-model images. Interior offices are not part of this exterior asset.',
    ],
    cameras: [
      { name: 'esplanade-entrances', position: [85, 35, 125], lookAt: [0, 22, 20] },
      { name: 'twin-blades', position: [-145, 107, 120], lookAt: [-42, 99, -19] },
      { name: 'atrium', position: [-8, 25, 64], lookAt: [-8, 21, 21] },
      { name: 'rounded-roof', position: [-108, 189, 40], lookAt: [-45, 147, -17] },
      { name: 'far-silhouette', position: [245, 124, 312], lookAt: [-12, 77, -8] },
    ],
  },
];
