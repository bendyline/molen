/** Original exterior reconstruction from architect references and attributed Dutch height data. */
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frameBytes = readFileSync(structureSourcePath('n0623_rembrandt_tower', 'map-frame.json'));
const frame = JSON.parse(frameBytes);
const heights = JSON.parse(
  readFileSync(structureSourcePath('n0623_rembrandt_tower', 'roof-envelope.json')),
);
const roofHeight = (surface) => {
  const range = heights.roofs.find((r) => r.surface === surface).heightsAboveGround;
  return (range[0] + range[1]) / 2;
};
const baseRoof = roofHeight(484),
  middleRoof = roofHeight(494),
  terrace = roofHeight(479),
  colonnade = roofHeight(493),
  cornerRoof = roofHeight(474),
  capRoof = roofHeight(492);
const shift = [0.36, 0.1]; // Center of the reconstructed upper cap in the retained ground frame.
const granite = [0.64, 0.62, 0.56],
  metal = [0.135, 0.155, 0.16],
  silver = [0.63, 0.67, 0.67],
  dark = [0.065, 0.08, 0.085],
  glass = [0.225, 0.345, 0.41];
const seed = (i) => {
  let h = Math.imul(i + 719, 374761393);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const tint = (color, i, amount = 0.025) => color.map((c) => c + (seed(i) - 0.5) * amount);
function face(o, slot, points, color) {
  quad(o, slot, points, normalFor(...points), color);
}
function oriented(out, angle = 0, offset = shift) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const rotate = ([x, y, z]) => [c * x + s * z, y, -s * x + c * z];
  const point = (p) => {
    const v = rotate(p);
    return [v[0] + offset[0], v[1], v[2] + offset[1]];
  };
  return {
    addQuad: (slot, ref, points, n, uv, color) =>
      out.addQuad(slot, ref, points.map(point), rotate(n), uv, color),
    addTriangle: (slot, ref, points, n, uv, color) =>
      out.addTriangle(slot, ref, points.map(point), rotate(n), uv, color),
    addConvexPolygon: (slot, ref, points, n, uv, color) =>
      out.addConvexPolygon(slot, ref, points.map(point), rotate(n), uv, color),
  };
}

/** Granite slabs have real joints, edge returns and a 12 mm bevel. No facade atlas. */
function slab(o, x0, x1, y0, y1, z, color = granite, thickness = 0.16) {
  if (x1 - x0 < 0.028 || y1 - y0 < 0.028) return;
  const b = 0.012;
  const ring = (inset, depth) => [
    [x0 + inset, y0 + inset, depth],
    [x1 - inset, y0 + inset, depth],
    [x1 - inset, y1 - inset, depth],
    [x0 + inset, y1 - inset, depth],
  ];
  const back = ring(0, z - thickness),
    edge = ring(0, z - b),
    front = ring(b, z);
  face(o, 'cladding', front, color);
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    face(o, 'cladding', [edge[i], edge[k], front[k], front[i]], color);
    face(o, 'cladding', [back[i], back[k], edge[k], edge[i]], color);
  }
}
function glazed(o, x0, x1, y0, y1, z, serial, { clear = false, split = false } = {}) {
  const slot = clear ? 'clear_glass' : 'glass';
  const color = clear ? [0.75, 0.83, 0.84] : tint(glass, serial, 0.055);
  quad(
    o,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    [0, 0, 1],
    color,
  );
  for (const x of [x0, x1])
    box(o, 'metal', [x - 0.026, y0, z - 0.04], [x + 0.026, y1, z + 0.055], metal);
  for (const y of [y0, y1])
    box(o, 'metal', [x0, y - 0.032, z - 0.04], [x1, y + 0.032, z + 0.055], metal);
  if (split) {
    const m = (x0 + x1) / 2;
    box(o, 'metal', [m - 0.022, y0, z - 0.04], [m + 0.022, y1, z + 0.055], metal);
  }
}
function graniteFacade(o, width, depth, levels, serial = 0, { lobby = false } = {}) {
  const bays = Math.round(width / 1.8),
    pitch = width / bays;
  for (let row = 0; row < levels.length - 1; row++) {
    const y0 = levels[row],
      y1 = levels[row + 1];
    for (let bay = 0; bay < bays; bay++) {
      const x0 = -width / 2 + bay * pitch,
        x1 = x0 + pitch,
        a = x0 + 0.3,
        b = x1 - 0.3,
        sill = y0 + 0.29,
        lintel = y1 - 0.33,
        id = serial + row * 71 + bay;
      const openLobby = lobby && Math.abs((x0 + x1) / 2) < 7.3 && row < 3;
      if (openLobby) {
        glazed(o, x0 + 0.04, x1 - 0.04, y0 + 0.09, y1 - 0.09, depth - 0.24, id);
        if (bay % 2 === 0)
          box(o, 'metal', [x0 - 0.14, y0, depth - 0.5], [x0 + 0.14, y1, depth - 0.18], silver);
        continue;
      }
      slab(o, x0 + 0.013, a - 0.035, y0 + 0.01, (y0 + y1) / 2 - 0.007, depth, tint(granite, id));
      slab(
        o,
        x0 + 0.013,
        a - 0.035,
        (y0 + y1) / 2 + 0.007,
        y1 - 0.01,
        depth,
        tint(granite, id + 500),
      );
      slab(
        o,
        b + 0.035,
        x1 - 0.013,
        y0 + 0.01,
        (y0 + y1) / 2 - 0.007,
        depth,
        tint(granite, id + 11),
      );
      slab(
        o,
        b + 0.035,
        x1 - 0.013,
        (y0 + y1) / 2 + 0.007,
        y1 - 0.01,
        depth,
        tint(granite, id + 511),
      );
      slab(o, a - 0.035, b + 0.035, y0 + 0.01, sill - 0.035, depth, tint(granite, id + 30));
      slab(o, a - 0.035, b + 0.035, lintel + 0.035, y1 - 0.01, depth, tint(granite, id + 60));
      box(
        o,
        'recess',
        [a - 0.038, sill - 0.04, depth - 0.24],
        [b + 0.038, lintel + 0.04, depth - 0.17],
        dark,
      );
      const spandrel = sill + Math.min(0.68, (y1 - y0) * 0.2);
      glazed(o, a, b, sill, spandrel, depth - 0.112, id);
      quad(
        o,
        'glass',
        [
          [a, sill, depth - 0.106],
          [b, sill, depth - 0.106],
          [b, spandrel, depth - 0.106],
          [a, spandrel, depth - 0.106],
        ],
        [0, 0, 1],
        tint([0.11, 0.15, 0.17], id, 0.025),
      );
      glazed(o, a, b, spandrel + 0.03, lintel, depth - 0.11, id + 150);
      box(
        o,
        'metal',
        [a - 0.015, sill - 0.04, depth - 0.16],
        [b + 0.015, sill, depth + 0.02],
        metal,
      );
    }
  }
}
function roofCross(o, radius, halfArm, y, thickness = 0.26) {
  box(o, 'concrete', [-radius, y - thickness, -halfArm], [radius, y, halfArm], [0.27, 0.29, 0.28]);
  box(
    o,
    'concrete',
    [-halfArm, y - thickness, -radius],
    [halfArm, y, -halfArm],
    [0.27, 0.29, 0.28],
  );
  box(o, 'concrete', [-halfArm, y - thickness, halfArm], [halfArm, y, radius], [0.27, 0.29, 0.28]);
}
function body(out) {
  const low = [0, 5.1, 10.2, 15.3, 18.7, baseRoof],
    mid = Array.from({ length: 5 }, (_, i) => baseRoof + ((middleRoof - baseRoof) * i) / 4),
    shaft = Array.from({ length: 21 }, (_, i) => middleRoof + ((terrace - middleRoof) * i) / 20);
  for (let side = 0; side < 4; side++) {
    const o = oriented(out, (side * Math.PI) / 2);
    graniteFacade(o, 25.8, 24, low, side * 9000, { lobby: side === 0 });
    graniteFacade(o, 25.2, 19.35, mid, side * 9000 + 1000);
    graniteFacade(o, 25.2, 16.2, shaft, side * 9000 + 2000);
    // Exposed side walls of the two stepped podium arms.
    for (const sign of [-1, 1]) {
      const a = oriented(o, (sign * Math.PI) / 2, [sign * 12.9, 18.45]);
      graniteFacade(a, 11.1, 0, low, side * 800 + sign + 4000);
      const b = oriented(o, (sign * Math.PI) / 2, [sign * 12.6, 15.975]);
      graniteFacade(b, 6.75, 0, mid, side * 800 + sign + 5000);
    }
    // Two narrow recessed glass planes meet in each shaft corner.
    const glassCorner = oriented(o, 0, [14.4, 14.4]);
    for (let a = 0; a < 2; a++) {
      const r = oriented(glassCorner, (a * Math.PI) / 2, [0, 0]);
      const fullLevels = [...low, ...mid.slice(1), ...shaft.slice(1)];
      for (let row = 0; row < fullLevels.length - 1; row++)
        for (let col = 0; col < 2; col++) {
          const x0 = (a === 0 ? -1.8 : 0) + col * 0.9;
          glazed(
            r,
            x0,
            x0 + 0.9,
            fullLevels[row] + 0.045,
            fullLevels[row + 1] - 0.045,
            0,
            side * 100 + row + col,
          );
        }
    }
    // Short stone returns make the inset glazing read as a deep corner reveal.
    for (const sign of [-1, 1]) {
      const ro = oriented(o, (sign * Math.PI) / 2, [sign * 12.6, 15.3]);
      for (let i = 0; i < shaft.length - 1; i++)
        slab(
          ro,
          -0.9,
          0.9,
          shaft[i] + 0.012,
          shaft[i + 1] - 0.012,
          0,
          tint(granite, i + side * 82),
        );
    }
  }
  const centered = oriented(out);
  roofCross(centered, 24, 12.9, baseRoof);
  roofCross(centered, 19.35, 12.6, middleRoof);
  roofCross(centered, 16.2, 12.6, terrace);
  // Two low north-side roofs are independently visible in the retained 3DBAG envelope.
  for (const sign of [-1, 1]) {
    const x0 = sign > 0 ? 12.9 : -24,
      x1 = sign > 0 ? 24 : -12.9;
    box(centered, 'concrete', [x0, 3.1, -24], [x1, 3.43, -12.9], [0.31, 0.32, 0.3]);
    for (const x of [x0 + 0.3, x1 - 0.3])
      box(centered, 'cladding', [x - 0.22, 0, -23.5], [x + 0.22, 3.1, -23.05], granite);
  }
}
function rail(o, x0, x1, y, z) {
  for (const dy of [0.18, 0.65, 1.02])
    tube(o, 'metal', [x0, y + dy, z], [x1, y + dy, z], 0.018, metal, 8);
  const count = Math.ceil((x1 - x0) / 1.2);
  for (let i = 0; i <= count; i++) {
    const x = x0 + ((x1 - x0) * i) / count;
    tube(o, 'metal', [x, y, z], [x, y + 1.03, z], 0.021, metal, 8);
  }
}
function crown(out) {
  const level = [
    colonnade,
    (2 * colonnade + cornerRoof) / 3,
    (colonnade + 2 * cornerRoof) / 3,
    cornerRoof,
  ];
  for (let side = 0; side < 4; side++) {
    const o = oriented(out, (side * Math.PI) / 2);
    for (let i = 0; i <= 7; i++) {
      const x = -12.6 + i * 3.6;
      box(o, 'cladding', [x - 0.24, terrace, 15.69], [x + 0.24, colonnade, 16.24], granite);
      beam(o, 'metal', [x, terrace + 0.15, 15.45], [x, colonnade - 0.2, 11.9], 0.15, 0.24, metal);
    }
    for (const y of [terrace + 0.1, colonnade - 0.2])
      slab(o, -12.85, 12.85, y - 0.18, y + 0.18, 16.26, granite);
    rail(o, -12.55, 12.55, terrace + 0.15, 15.58);
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const center = [shift[0] + sx * 10.8, shift[1] + sz * 10.8];
      box(
        oriented(out, 0, center),
        'concrete',
        [-5.4, colonnade - 0.24, -5.4],
        [5.4, colonnade, 5.4],
        [0.31, 0.32, 0.3],
      );
      for (let side = 0; side < 4; side++) {
        const o = oriented(out, (side * Math.PI) / 2, center);
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < 12; col++) {
            const x0 = -5.4 + col * 0.9;
            const y0 = level[row],
              y1 = level[row + 1];
            glazed(
              o,
              x0 + 0.022,
              x0 + 0.878,
              y0 + 0.16,
              y1 - 0.16,
              5.36,
              row * 121 + col + side * 90,
            );
            box(o, 'metal', [x0, y0 - 0.13, 5.28], [x0 + 0.9, y0 + 0.16, 5.46], silver);
          }
        box(o, 'metal', [-5.48, cornerRoof - 0.17, 5.28], [5.48, cornerRoof + 0.18, 5.49], silver);
      }
      box(
        oriented(out, 0, center),
        'metal',
        [-5.4, cornerRoof - 0.14, -5.4],
        [5.4, cornerRoof, 5.4],
        [0.26, 0.28, 0.27],
      );
    }
  // Six 1.8 m windows across each cross-shaped cap arm; the inset returns continue the grid.
  const upper = [
    terrace,
    colonnade,
    ...level.slice(1),
    cornerRoof + 3.4,
    cornerRoof + 6.8,
    capRoof,
  ];
  for (let side = 0; side < 4; side++) {
    const o = oriented(out, (side * Math.PI) / 2);
    graniteFacade(o, 10.8, 10.8, upper, side * 811 + 90000);
    for (const sign of [-1, 1]) {
      const r = oriented(o, (sign * Math.PI) / 2, [sign * 5.4, 8.1]);
      graniteFacade(r, 5.4, 0, upper, 92000 + side * 900 + sign);
    }
    // Three large recessed louver panels in the raised mechanical parapet.
    for (const sign of [-1, 1]) {
      const returnFace = oriented(o, (sign * Math.PI) / 2, [sign * 5.4, 9.63]);
      slab(returnFace, -1.23, 1.23, capRoof, 135, 0, granite);
    }
    box(o, 'cladding', [-5.4, 134.78, 8.4], [5.4, 135, 10.86], granite);
    box(o, 'cladding', [-5.4, capRoof, 8.32], [5.4, 134.78, 8.5], granite);
    for (let bay = 0; bay < 3; bay++) {
      const x0 = -5.4 + bay * 3.6,
        x1 = x0 + 3.6;
      slab(o, x0 + 0.01, x0 + 0.3, capRoof, 135, 10.86);
      slab(o, x1 - 0.3, x1 - 0.01, capRoof, 135, 10.86);
      slab(o, x0 + 0.3, x1 - 0.3, 134.72, 135, 10.86);
      box(o, 'recess', [x0 + 0.3, capRoof + 0.1, 10.6], [x1 - 0.3, 134.73, 10.65], dark);
      for (let y = capRoof + 0.23; y < 134.68; y += 0.105)
        box(o, 'metal', [x0 + 0.31, y, 10.66], [x1 - 0.31, y + 0.04, 10.78], metal);
    }
  }
  roofCross(oriented(out), 10.8, 5.4, capRoof, 0.25);
  beacon(oriented(out));
}
function beacon(o) {
  const shape = [
    [capRoof, 1.2],
    [135.2, 1.2],
    [137.4, 1.22],
    [138.3, 0.8],
    [148.3, 0.56],
    [149.1, 0.16],
    [150, 0.035],
  ];
  loft(
    o,
    'metal',
    shape.map(([y, r]) => radialRing(y, r, r, 80)),
    silver,
  );
  for (const y of [136.05, 136.95, 137.85])
    loft(
      o,
      'metal',
      [
        [y - 0.075, 1.72],
        [y + 0.075, 1.72],
      ].map(([h, r]) => radialRing(h, r, r, 80)),
      [0.78, 0.8, 0.77],
    );
  for (let i = 0; i < 40; i++) {
    const a = (i * Math.PI) / 20;
    tube(
      o,
      'metal',
      [0.83 * Math.cos(a), 139, 0.83 * Math.sin(a)],
      [0.62 * Math.cos(a), 148.25, 0.62 * Math.sin(a)],
      0.022,
      metal,
      6,
    );
  }
  for (let i = 0; i < 25; i++) {
    const t = i / 24;
    torus(o, 'metal', [0, 139 + t * 9.2, 0], 0.83 - t * 0.21, 0.026, silver, 64, 6);
  }
  // Parked maintenance cradle and horizontal jib: proportions follow the published crown image.
  box(o, 'metal', [3.7, capRoof, -2.8], [5, 136, -1.5], silver);
  box(o, 'metal', [4.1, 135.6, -2.65], [14.3, 136.35, -1.65], [0.76, 0.78, 0.74]);
  for (let x = 4.3; x < 14.3; x += 1.2)
    beam(
      o,
      'metal',
      [x, 135.65, -2.67],
      [Math.min(x + 1.1, 14.3), 136.32, -2.67],
      0.08,
      0.075,
      metal,
    );
  box(o, 'metal', [13.2, 136.1, -3.05], [16, 136.35, -1.2], silver);
  for (const z of [-3.05, -1.2]) rail(o, 13.2, 16, 136.35, z);
}
function entrance(out) {
  const o = oriented(out);
  // Individual revolving doors remain visibly cylindrical and retain transparent local PBR.
  for (const x of [-3.6, 0, 3.6]) {
    const z = 24.05,
      r = 1.4;
    for (let i = 0; i < 64; i++) {
      const a = (i * Math.PI) / 32,
        b = ((i + 1) * Math.PI) / 32;
      if (i >= 10 && i <= 21) continue;
      const p = [
        [x + r * Math.cos(a), 0.07, z + r * Math.sin(a)],
        [x + r * Math.cos(b), 0.07, z + r * Math.sin(b)],
        [x + r * Math.cos(b), 3.05, z + r * Math.sin(b)],
        [x + r * Math.cos(a), 3.05, z + r * Math.sin(a)],
      ];
      face(o, 'clear_glass', p.toReversed(), [0.75, 0.83, 0.84]);
    }
    for (const y of [0.08, 3.04]) torus(o, 'stainless', [x, y, z], r, 0.045, silver, 64, 8);
    tube(o, 'metal', [x, 0, z], [x, 3.16, z], 0.06, metal, 12);
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3;
      const end = [x + r * Math.cos(a), 0, z + r * Math.sin(a)];
      face(
        o,
        'clear_glass',
        [
          [x, 0.08, z],
          [end[0], 0.08, end[2]],
          [end[0], 3, end[2]],
          [x, 3, z],
        ],
        [0.75, 0.83, 0.84],
      );
      tube(o, 'stainless', [end[0], 0.08, end[2]], [end[0], 3, end[2]], 0.025, silver, 8);
    }
    loft(
      o,
      'metal',
      [radialRing(3.05, r, r, 64, [x, z]), radialRing(3.4, r, r, 64, [x, z])],
      silver,
    );
  }
  box(o, 'metal', [-7.3, 5.08, 23.5], [7.3, 5.36, 29.4], silver);
  for (const x of [-7.1, -3.6, 0, 3.6, 7.1]) {
    beam(o, 'metal', [x, 4.96, 23.8], [x, 4.96, 29.25], 0.09, 0.16, metal);
    if (Math.abs(x) > 7) tube(o, 'stainless', [x, 0, 28.9], [x, 5.08, 28.9], 0.095, silver, 24);
  }
  for (const x of [-9.4, 9.4])
    box(o, 'cladding', [x - 0.25, 0, 24.05], [x + 0.25, 5.1, 24.65], granite);
  for (const sx of [-1, 1])
    for (let k = 0; k < 4; k++) {
      const x = sx * (14.6 + k * 1.05);
      box(
        o,
        'stone',
        [Math.min(x, x + sx * 0.98), 0, 13.1],
        [Math.max(x, x + sx * 0.98), 0.12 + k * 0.045, 18.7 - k * 1.15],
        [0.4, 0.42, 0.4],
      );
    }
}

export const rembrandtStudy = {
  id: 'N0623',
  key: 'rembrandt_tower',
  title: 'Rembrandt Tower',
  wikidataId: 'Q2361620',
  mapFrame: 'map-frame.json',
  build(out) {
    body(out);
    crown(out);
    entrance(out);
  },
  brief:
    'Amsterdam’s granite-clad Rembrandt Tower: stepped cross-shaped podium, fourteen-bay facades with deeply recessed glazed corners, seven-bay open crown galleries, four glazed corner towers, a cross-shaped mechanical cap, ringed beacon and parked maintenance crane. The southern entrance has three revolving doors and a projecting canopy.',
  sourceFacts: {
    publishedRoofHeightMeters: 135,
    publishedTipHeightMeters: 150,
    publishedTypicalStoreyHeightMeters: 3.4,
    publishedStructuralShaftWidthMeters: 32.4,
    publishedCoreWidthMeters: 14.4,
    storeyDescriptions:
      'Architect/Arcam describe nine lower levels and twenty shaft levels; Arcam gives36 overall, the operator brochure35. Counts use differing conventions and are not silently reconciled.',
    surveyEnvelopeYear: 2023,
  },
  reconstruction: {
    shaftFieldBays: 14,
    shaftFieldWidthMeters: 25.2,
    cornerRecessMeters: 3.6,
    capCross: { outerWidthMeters: 21.6, armWidthMeters: 10.8 },
    heightDatumsMeters: { baseRoof, middleRoof, terrace, colonnade, cornerRoof, capRoof },
    upperCenterOffsetXZ: shift,
    facade:
      'Window modules and open gallery count are inferred from inspected full-resolution architecture-centre photographs. Cladding joints, transoms, stone thickness, louver pitch, canopy and door dimensions are original proportional reconstruction.',
    envelope:
      'Roof datums use retained 3DBAG horizontal surfaces. Irregular LiDAR-derived polygons are not imported as a finished model. Twenty shaft intervals interpolate measured envelope datums; their3.49mmean differs from the published3.4mtypical floor pitch and awaits floor-elevation drawings.',
  },
  refs: [
    'https://www.zzdp.nl/nl/project/de-omval',
    'https://arcam.nl/architectuur-gids/rembrandttoren/',
    'https://www.rembrandttower.nl/nl/',
    'https://repository.tudelft.nl/file/File_22b7fccf-7ca6-4d29-aa2d-6d47cf923d6c',
    'https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012113758',
    'https://docs.3dbag.nl/en/copyright/',
    'https://www.openstreetmap.org/way/44451577',
  ],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X east-northeast along the BAG rear wall',
    front: '+Z south-southeast toward the entrance square',
    origin:
      'Center of the BAG ground-envelope rectangle; Y0 uses terrain contact. The upper shaft is offset0.36m east and0.10m south in this frame.',
  },
  geographic: () => ({
    anchor: frame.anchor,
    heading: frame.heading,
    mapGeometryHash: hashEvidenceText(frameBytes),
    mapGeometryLicense: 'CC-BY-4.0 / ODbL-1.0',
    attribution: frame.geometryAttribution,
    notes:
      'BAG identifier matches the exact-QID OSM object. RD coordinates are transformed to WGS84 using the retained PROJ operation; native +Z faces the southern entrance. This center lies about6.7m south of the older simplified OSM rectangle center. Actual sidewalk datum and facade fit remain pending.',
  }),
  geometrySource:
    'Original procedural exterior reconstructed from photographs, published dimensions and separately retained 3DBAG ground/roof evidence. The downloaded CityJSON is reference data, not the rendered mesh.',
  sourceLicense:
    'Original Molen recipe under repository MIT license. Referenced footprint and roof measurements: © 3DBAG by tudelft3d and 3DGI, CC BY4.0. Exact identity match: © OpenStreetMap contributors, ODbL1.0. Publication photos are linked, not redistributed.',
  dataAttribution:
    '© 3DBAG by tudelft3d and 3DGI, [CC BY4.0](https://docs.3dbag.nl/en/copyright/). The source bundle retains the2023 CityJSON response, converted footprint, roof measurements and coordinate operation. Molen regularizes architectural modules and roof levels and authors new facade geometry; it does not claim a surveyed reconstruction. Identity evidence: © OpenStreetMap contributors, ODbL1.0.',
  sourceDocuments: ['bag-source.json', 'roof-envelope.json', 'reference-metadata.json'],
  limitations: [
    'Facade dimensions, storey elevations, podium returns, roof parapets, canopy and maintenance equipment require measured drawings and current site comparison before maximum-fidelity approval. The35/36storey source discrepancy is retained.',
    '3DBAG roof mesh reports1.10mRMSE and validation flags104/203. Its reconstructed maximum differs from its roof attribute; the published150mtip is modeled independently of the noisy survey extrema.',
    'Glazing uses reflective opaque PBR except the transparent entrance cylinders. Interior fit-out, basement, neighboring towers and mobile street furniture are outside this exterior asset.',
    'The southern orientation is supported by Arcam and the retained footprint. Precise sidewalk contact, canopy projection and scene-level attribution display remain to be verified in the actual geographic viewer.',
  ],
  camera: { position: [112, 90, 154], lookAt: [0, 75, 0], fov: 39 },
  qaCameras: [
    { name: 'south-entrance', position: [38, 13, 70], lookAt: [0, 9, 22] },
    { name: 'podium-setbacks', position: [64, 47, 68], lookAt: [0, 23, 0] },
    { name: 'facade-grid', position: [4, 76, 42], lookAt: [0, 74, 16.2] },
    { name: 'corner-glazing', position: [39, 81, 39], lookAt: [14, 78, 14] },
    { name: 'open-crown-gallery', position: [42, 111, 55], lookAt: [0, 108, 7] },
    { name: 'glazed-corner-towers', position: [48, 130, 52], lookAt: [0, 117, 0] },
    { name: 'cross-cap', position: [48, 157, 49], lookAt: [0, 130, 0] },
    { name: 'beacon-and-crane', position: [26, 147, 24], lookAt: [3, 140, 0] },
    { name: 'north-low-roofs', position: [-53, 28, -63], lookAt: [0, 12, -15] },
    { name: 'roof-plan', position: [1, 190, 3], lookAt: [0, 0, 0] },
    { name: 'far-silhouette', position: [-420, 220, 560], lookAt: [0, 74, 0] },
  ],
};
