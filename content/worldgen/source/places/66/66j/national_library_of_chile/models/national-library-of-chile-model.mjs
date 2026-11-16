/** The standing Biblioteca Nacional on the Alameda, Santiago. All dimensions are meters. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  column,
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const frame = read('map-frame.json');
const plan = read('plan-controls.json');
const field = read('terrain-grid.json');
const sections = plan.section;
const { alamedaFront, entranceFront, corniceTop, plateau, plinthTop, wallTop, cupola, pavilion } =
  sections;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9 },
  trim: { slot: 'trim', graph: 'plaster_tadelakt', roughness: 0.85 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.76, metallic: 0.1 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.54 },
  iron: { slot: 'door', graph: 'metal_painted', roughness: 0.71, metallic: 0.06 },
};
const palette = Object.fromEntries(
  Object.entries({
    ashlar: 'd0c2ae',
    pale: 'e3d5bc',
    frieze: 'c2b196',
    shadowed: 'b8a88e',
    granite: '98948b',
    darkGranite: '746f64',
    zinc: '7b817e',
    zincDark: '555d59',
    zincPale: '8a8e87',
    paving: 'a39c8e',
    glass: '465352',
    glassDark: '353f3c',
    ironwork: '53574d',
  }).map(([name, value]) => [name, rgb(value)]),
);
const lerp = (a, b, t) => a + (b - a) * t;
const solid = (out, slot, x0, x1, y0, y1, z0, z1, tint) =>
  box(out, slot, [x0, y0, z0], [x1, y1, z1], palette[tint]);
const panel = (out, slot, x0, x1, y0, y1, z, tint) =>
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    palette[tint],
  );

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters;
  const v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = field.heightsMeters[j];
  const b = field.heightsMeters[j + 1];
  return (
    lerp(lerp(a[i], a[i + 1], u - i), lerp(b[i], b[i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function winding(points, clockwise) {
  const area = points.reduce((sum, [x, z], index) => {
    const [u, v] = points[(index + 1) % points.length];
    return sum + x * v - z * u;
  }, 0);
  return area < 0 === clockwise ? points : points.toReversed();
}

function cap(out, ring, holes, height) {
  const mesh = new MeshBufferBuilder();
  if (
    !mesh.addCap(
      'roof',
      'palette:#ffffff',
      ring,
      holes,
      () => height,
      [0, 1, 0],
      (p) => p,
      palette.paving,
    )
  ) {
    throw new Error('The mapped roof and its light wells must triangulate');
  }
  const { indices, positions } = mesh.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    triangle(
      out,
      'roof',
      Array.from(indices.slice(i, i + 3), (j) => Array.from(positions.slice(j * 3, j * 3 + 3))),
      palette.paving,
    );
  }
}

function arch(out, center, base, spring, half, rise, z, lod, tall = false) {
  const bottom = (t, extra = 0, depth = 0) => [
    center + (half + extra) * Math.cos(t),
    spring + (rise + extra) * Math.sin(t),
    z + depth,
  ];
  const count = [3, 5, 9, 14][lod];
  panel(out, 'glazing', center - half, center + half, base, spring, z, 'glassDark');
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI) / count;
    const b = ((i + 1) * Math.PI) / count;
    triangle(out, 'glazing', [[center, spring, z], bottom(a), bottom(b)], palette.glass);
    if (lod > 0) {
      face(
        out,
        'trim',
        [bottom(a, 0, 0.035), bottom(a, 0.18, 0.09), bottom(b, 0.18, 0.09), bottom(b, 0, 0.035)],
        palette.frieze,
      );
    }
  }
  if (lod === 0) return;
  for (const side of [-1, 1]) {
    const x = center + side * (half + 0.09);
    panel(out, 'trim', x - 0.09, x + 0.09, base, spring + 0.015, z + 0.075, 'frieze');
  }
  if (lod > 1) {
    const top = spring + rise * 0.97;
    panel(out, 'iron', center - 0.04, center + 0.04, base, top, z + 0.055, 'ironwork');
    panel(
      out,
      'iron',
      center - half,
      center + half,
      spring - 0.04,
      spring + 0.045,
      z + 0.055,
      'ironwork',
    );
    if (tall) {
      for (const offset of [-0.53, 0.53]) {
        panel(
          out,
          'iron',
          center + offset - 0.035,
          center + offset + 0.035,
          base,
          spring,
          z + 0.057,
          'ironwork',
        );
      }
    }
  }
}

function flatWindow(out, center, bottom, width, height, lod, z = 0.09) {
  panel(
    out,
    'glazing',
    center - width / 2,
    center + width / 2,
    bottom,
    bottom + height,
    z,
    'glassDark',
  );
  if (lod < 2) return;
  solid(
    out,
    'trim',
    center - width / 2 - 0.15,
    center + width / 2 + 0.15,
    bottom - 0.14,
    bottom + 0.02,
    z - 0.04,
    z + 0.23,
    'pale',
  );
  panel(
    out,
    'iron',
    center - 0.035,
    center + 0.035,
    bottom,
    bottom + height,
    z + 0.055,
    'ironwork',
  );
}

function course(out, span, y0, y1, front, tint = 'pale', lod = 1) {
  if (lod < 2) {
    panel(out, 'trim', 0, span, y0, y1, front, tint);
  } else {
    solid(out, 'trim', 0, span, y0, y1, -0.07, front, tint);
  }
}

function shellEdge(out, a, b, lod, courtyard = false) {
  const span = Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (span < 0.04) return;
  const wall = transform(out, Math.atan2(a[1] - b[1], b[0] - a[0]), [a[0], 0, a[1]]);
  const baseA = Math.min(ground(...a) - 0.72, plinthTop - 0.38);
  const baseB = Math.min(ground(...b) - 0.72, plinthTop - 0.38);
  if (lod === 0) {
    face(
      wall,
      'wall',
      [
        [0, baseA, 0],
        [span, baseB, 0],
        [span, plateau, 0],
        [0, plateau, 0],
      ],
      palette.ashlar,
    );
  } else {
    face(
      wall,
      'stone',
      [
        [0, baseA, 0],
        [span, baseB, 0],
        [span, plinthTop, 0],
        [0, plinthTop, 0],
      ],
      palette.granite,
    );
    panel(wall, 'wall', 0, span, plinthTop, plateau, 0, courtyard ? 'shadowed' : 'ashlar');
  }

  const front = Math.min(a[1], b[1]) > 41.35 && Math.abs(a[1] - b[1]) < 0.25;
  if (front || span < 1.3) return;
  course(wall, span, plinthTop - 0.14, plinthTop + 0.18, 0.2, 'pale', lod);
  course(wall, span, wallTop + 0.18, corniceTop, 0.25, 'pale', lod);
  if (lod > 0) course(wall, span, wallTop - 0.26, wallTop + 0.14, 0.13, 'frieze', lod);
  if (span < 2.65) return;

  const stackWall = span > 22 && !courtyard && Math.max(a[1], b[1]) < 20;
  if (lod === 0) {
    if (span > 6.2) {
      const count = Math.max(1, Math.round(span / 6));
      for (let i = 0; i < count; i++) {
        const center = ((i + 0.5) * span) / count;
        flatWindow(wall, center, 5.25, 1.02, 8.8, lod);
      }
    }
    return;
  }
  const count = Math.max(1, Math.round(span / (stackWall ? 3.8 : 4.25)));
  const pitch = span / count;
  for (let i = 0; i < count; i++) {
    const c = (i + 0.5) * pitch;
    if (stackWall) {
      const height = 1.47;
      for (let floor = 0; floor < 5; floor++)
        flatWindow(wall, c, 4.15 + floor * 2.16, 0.94, height, lod);
      if (lod >= 2) {
        for (const offset of [-0.34, 0, 0.34]) flatWindow(wall, c + offset, 15.03, 0.17, 0.63, 0);
      }
    } else {
      const width = Math.min(1.72, pitch * 0.51);
      flatWindow(wall, c, 4.49, width, 3.37, lod);
      if (courtyard || span < 10) flatWindow(wall, c, 10.01, width, 3.44, lod);
      else arch(wall, c, 10.0, 12.36, width / 2, 0.89, 0.091, lod);
    }
    if (lod > 1 && pitch > 3.5 && !courtyard) {
      const x0 = i * pitch + 0.14;
      solid(wall, 'trim', x0, x0 + 0.33, 3.6, 15.68, -0.04, 0.12, 'ashlar');
    }
  }
}

function libraryShell(out, lod) {
  const outer = winding(frame.geometry.outline, true);
  const courts = frame.geometry.holes.map((ring) => winding(ring, false));
  for (const [i, ring] of [outer, ...courts].entries()) {
    for (const [j, a] of ring.entries()) {
      shellEdge(out, a, ring[(j + 1) % ring.length], lod, i !== 0);
    }
  }
  cap(out, outer, courts, plateau);
}

function pilaster(out, x, width, lod) {
  if (lod === 0) {
    panel(out, 'trim', x - width / 2, x + width / 2, 3.45, 15.88, 0.3, 'pale');
    return;
  }
  solid(out, 'trim', x - width / 2, x + width / 2, 3.55, 15.62, -0.04, 0.41, 'pale');
  for (const [y0, y1, over] of [
    [3.3, 3.61, 0.19],
    [3.61, 3.91, 0.11],
    [14.85, 15.53, 0.14],
    [15.53, 15.88, 0.22],
  ]) {
    solid(
      out,
      'trim',
      x - width / 2 - over,
      x + width / 2 + over,
      y0,
      y1,
      0.04,
      0.42 + over,
      'pale',
    );
  }
}

function alamedaBay(out, c, lod) {
  arch(out, c, sections.upperSill, 12.51, 1.02, 1.22, 0.1, lod);
  flatWindow(out, c, sections.firstSill, 1.92, 3.5, lod);
  flatWindow(out, c, 0.9, 0.95, 1.15, lod);
  if (lod >= 2) {
    solid(out, 'trim', c - 1.24, c + 1.24, 9.97, 10.33, 0.0, 0.3, 'frieze');
    solid(out, 'trim', c - 1.24, c + 1.24, 8.18, 8.44, 0.01, 0.29, 'pale');
    if (lod === 3) {
      for (const offset of [-0.95, -0.54, 0, 0.54, 0.95]) {
        const x = c + offset;
        solid(out, 'trim', x - 0.06, x + 0.06, 9.7, 10.02, 0.16, 0.31, 'pale');
      }
    }
  }
}

function balustrade(out, x0, x1, y, z, lod) {
  const span = x1 - x0;
  if (lod === 0) {
    panel(out, 'trim', x0, x1, y, y + 0.71, z, 'pale');
    return;
  }
  solid(out, 'trim', x0, x1, y, y + 0.14, z - 0.2, z + 0.15, 'pale');
  solid(out, 'trim', x0, x1, y + 0.7, y + 0.84, z - 0.2, z + 0.15, 'pale');
  const count = Math.round(span / (lod === 3 ? 0.41 : lod === 2 ? 0.53 : 0.93));
  for (let i = 0; i < count; i++) {
    const center = x0 + ((i + 0.5) * span) / count;
    if (lod < 3) {
      panel(out, 'trim', center - 0.095, center + 0.095, y + 0.14, y + 0.71, z + 0.019, 'pale');
    } else {
      column(out, 'trim', center, z - 0.029, y + 0.14, y + 0.71, 0.078, palette.pale, 4);
    }
  }
}

function frontWing(out, start, end, lod) {
  const leftSide = end < 0;
  const wing = transform(out, 0, [start, 0, alamedaFront]);
  const span = end - start;
  const positions = leftSide ? [5.76, 11.24, 15.62, 20.04] : [3.23, 7.63, 12.05, 17.53];
  for (const c of positions) alamedaBay(wing, c, lod);
  for (const c of [
    positions[0] - 1.85,
    ...positions.slice(1).map((c, i) => (positions[i] + c) / 2),
    positions.at(-1) + 1.82,
  ]) {
    pilaster(wing, c, 0.7, lod);
  }
  course(wing, span, plinthTop - 0.16, plinthTop + 0.22, 0.32, 'pale', lod);
  course(wing, span, 15.76, 16.48, 0.39, 'frieze', lod);
  course(wing, span, 16.49, corniceTop, 0.66, 'pale', lod);
  if (lod >= 2) {
    for (const y of [0.52, 1.18, 1.84, 2.5]) {
      course(wing, span, y, y + 0.06, 0.06, 'darkGranite', 0);
    }
    for (let x = 0.35; x < span; x += lod === 3 ? 0.46 : 0.68) {
      solid(wing, 'trim', x - 0.1, x + 0.1, 16.38, 16.59, 0.12, 0.44, 'pale');
    }
  }
  const [a, b] = leftSide ? [start + 10.1, end - 0.6] : [start + 0.6, end - 10.1];
  balustrade(out, a, b, corniceTop + 0.11, alamedaFront - 0.08, lod);
}

function entrance(out, lod) {
  const center = sections.porticoCenter;
  const length = sections.porticoWidth;
  const z = entranceFront;
  const wing = transform(out, 0, [center - length / 2, 0, z]);
  for (const x of [4.8, 10.74, 16.69]) {
    arch(wing, x, 1.66, 11.1, 1.47, 1.61, 0.12, lod, true);
    if (lod > 0) {
      course(transform(wing, 0, [x - 1.58, 0, 0]), 3.16, 9.39, 9.64, 0.34, 'pale', lod);
      panel(wing, 'iron', x - 1.43, x + 1.43, 4.45, 4.53, 0.19, 'ironwork');
    }
    for (const side of [-1, 1]) {
      const colX = x + side * 2.0;
      if (lod === 0) {
        solid(wing, 'trim', colX - 0.31, colX + 0.31, 1.68, 15.83, 0.68, 1.24, 'pale');
      } else {
        const radius = 0.46;
        column(wing, 'trim', colX, 1.08, 3.03, 15.56, radius, palette.pale, [6, 5, 10, 14][lod]);
        solid(wing, 'trim', colX - 0.68, colX + 0.68, 1.63, 3.03, 0.25, 1.91, 'frieze');
        solid(wing, 'trim', colX - 0.67, colX + 0.67, 15.56, 15.91, 0.47, 1.72, 'pale');
      }
    }
  }
  for (const x of [1.56, length - 1.56]) pilaster(wing, x, 0.77, lod);
  course(wing, length, 15.73, 16.46, 0.46, 'frieze', lod);
  course(wing, length, 16.46, corniceTop, 0.73, 'pale', lod);
  const steps = [2, 5, 8, 10][lod];
  for (let i = 0; i < steps; i++) {
    const setback = (4.45 * i) / steps;
    const y = (1.66 * (i + 1)) / steps;
    solid(
      wing,
      'stone',
      2.27 + i * 0.045,
      length - 2.27 - i * 0.045,
      i === 0 ? -0.32 : (1.66 * i) / steps - 0.08,
      y,
      -0.04,
      4.56 - setback,
      'granite',
    );
  }
  if (lod > 0) {
    for (const x of [1.74, length - 1.74]) {
      solid(wing, 'stone', x - 0.46, x + 0.46, -0.38, 1.39, 0.02, 4.42, 'granite');
      solid(wing, 'trim', x - 0.56, x + 0.56, 1.38, 1.58, -0.03, 4.52, 'pale');
    }
  }
  solid(wing, 'wall', 0.38, length - 0.38, plateau - 0.03, 20.09, -6.3, -0.4, 'ashlar');
  course(transform(wing, 0, [0.3, 0, -0.37]), length - 0.6, 19.83, 20.22, 0.28, 'pale', lod);
  for (const c of [2.38, 6.55, 10.74, 14.92, 19.11]) {
    const attic = transform(wing, 0, [0, 0, -0.374]);
    if (lod > 0) {
      panel(attic, 'trim', c - 1.38, c + 1.38, 17.73, 19.42, 0.058, 'frieze');
      panel(attic, 'wall', c - 1.2, c + 1.2, 17.9, 19.23, 0.088, 'ashlar');
    }
  }
}

function roofProfile(out, center, rings, sides, offset = 0) {
  const points = rings.map(([y, rx, rz]) => radialRing(y, rx, rz, sides, center, offset));
  for (let i = 1; i < points.length; i++) {
    loft(out, 'roof', [points[i - 1], points[i]], palette.zinc, {
      cap: false,
    });
  }
  const top = points.at(-1);
  out.addConvexPolygon(
    'roof',
    'palette:#ffffff',
    top,
    [0, 1, 0],
    ([x, , z]) => [x, z],
    palette.zincPale,
  );
}

function oculus(out, x, y, z, radius, lod, flatten = 1) {
  const sides = [6, 8, 12, 16][lod];
  const point = (i, r, depth) => {
    const a = (i * Math.PI * 2) / sides;
    return [x + r * Math.cos(a), y + flatten * r * Math.sin(a), z + depth];
  };
  for (let i = 0; i < sides; i++) {
    triangle(
      out,
      'glazing',
      [[x, y, z + 0.021], point(i, radius, 0.021), point(i + 1, radius, 0.021)],
      palette.glassDark,
    );
    if (lod > 0) {
      face(
        out,
        'trim',
        [
          point(i, radius, 0.032),
          point(i, radius + 0.14, 0.077),
          point(i + 1, radius + 0.14, 0.077),
          point(i + 1, radius, 0.032),
        ],
        palette.zincPale,
      );
    }
  }
  if (lod > 1) {
    panel(
      out,
      'iron',
      x - radius * 0.9,
      x + radius * 0.9,
      y - 0.038,
      y + 0.038,
      z + 0.041,
      'ironwork',
    );
    panel(
      out,
      'iron',
      x - 0.035,
      x + 0.035,
      y - radius * flatten * 0.9,
      y + radius * flatten * 0.9,
      z + 0.042,
      'ironwork',
    );
  }
}

function dormer(out, x, z, y, width, rise, lod, tone = 'zinc') {
  const base = y - rise * 0.52;
  const spring = y + rise * 0.2;
  solid(out, 'roof', x - width * 0.55, x + width * 0.55, base, spring, z - 0.91, z + 0.06, tone);
  for (let i = 0; i < Math.max(3, lod * 3); i++) {
    const count = Math.max(3, lod * 3);
    const p = (j, depth) => {
      const a = (j * Math.PI) / count;
      return [x + width * 0.55 * Math.cos(a), spring + rise * Math.sin(a), z + depth];
    };
    triangle(out, 'roof', [[x, spring, z + 0.06], p(i, 0.06), p(i + 1, 0.06)], palette[tone]);
    face(out, 'roof', [p(i, 0.06), p(i, -0.95), p(i + 1, -0.95), p(i + 1, 0.06)], palette.zincDark);
  }
  oculus(out, x, y + rise * 0.19, z + 0.071, width * 0.36, lod, 0.78);
}

function dome(out, lod) {
  const [rx, rz] = cupola.radii;
  const [x, z] = cupola.center;
  const y0 = cupola.drumTop;
  const y1 = cupola.crown;
  const drumSegments = [8, 12, 24, 32][lod];
  loft(
    out,
    'wall',
    [plateau - 0.04, y0 - 0.91].map((y) =>
      radialRing(y, rx * 0.93, rz * 0.92, drumSegments, [x, z]),
    ),
    palette.ashlar,
    { cap: false },
  );
  const profiles = [
    [y0 - 1.05, 0.95],
    [y0, 1],
    [y0 + 2.47, 0.95],
    [y0 + 4.83, 0.83],
    [y0 + 6.5, 0.68],
    [y0 + 7.61, 0.51],
    [y0 + 7.98, 0.46],
    [y0 + 8.41, 0.47],
    [y1 - 0.37, 0.34],
    [y1, 0.09],
  ];
  const selected =
    lod === 0
      ? [0, 1, 3, 5, 7, 9]
      : lod === 1
        ? [0, 1, 2, 3, 5, 7, 8, 9]
        : profiles.map((_, i) => i);
  roofProfile(
    out,
    [x, z],
    selected.map((i) => {
      const [y, r] = profiles[i];
      return [y, rx * r, rz * r];
    }),
    [10, 22, 44, 60][lod],
  );
  if (lod > 0) {
    for (const offset of [-5.34, 0, 5.34]) {
      const frontZ = z + rz * Math.sqrt(1 - (offset / rx) ** 2) - 0.34;
      dormer(out, x + offset, frontZ, 23.04, 1.75, 1.03, lod, 'zincDark');
    }
    for (const direction of [-1, 1]) {
      const side = transform(out, (direction * Math.PI) / 2, [x, 0, z]);
      dormer(side, -1.22, rx - 0.75, 23.12, 1.72, 1.08, lod);
    }
  }
}

function gable(out, center, z, y, width, rise, lod) {
  const a = [center - width / 2, y, z];
  const b = [center + width / 2, y, z];
  const peak = [center, y + rise, z];
  triangle(out, 'wall', [a, b, peak], palette.frieze);
  const eave = (p, depth) => [p[0], p[1] + 0.08, p[2] - depth];
  const roof = (p) => [eave(p, 3.15), eave(p, -0.32), eave(peak, -0.32), eave(peak, 3.15)];
  face(out, 'roof', roof(a), palette.zinc);
  face(out, 'roof', roof(b).toReversed(), palette.zinc);
  if (lod > 0) {
    for (const [p, q] of [
      [a, peak],
      [peak, b],
    ]) {
      face(
        out,
        'trim',
        [
          [p[0], p[1] - 0.16, z + 0.13],
          [q[0], q[1] - 0.16, z + 0.13],
          [q[0], q[1] + 0.14, z + 0.13],
          [p[0], p[1] + 0.14, z + 0.13],
        ],
        palette.pale,
      );
    }
  }
}

function cornerPavilion(out, centerX, direction, lod) {
  const center = [centerX, pavilion.centerZ];
  const { radiusX: rx, radiusZ: rz, crown } = pavilion;
  const rings = [
    [plateau - 0.02, rx, rz],
    [19.39, rx, rz],
    [21.54, rx * 0.87, rz * 0.84],
    [22.86, rx * 0.72, rz * 0.74],
    [23.37, rx * 0.56, rz * 0.57],
    [crown, rx * 0.31, rz * 0.33],
  ];
  // Diagonal vertices give each pavilion two broad elevations for the dormers.
  const scale = Math.sqrt(2);
  roofProfile(
    out,
    center,
    rings.map(([h, r, s]) => [h, r * scale, s * scale]),
    4,
    Math.PI / 4,
  );
  gable(out, centerX - 0.25 * direction, alamedaFront + 0.035, 17.18, 9.78, 2.39, lod);
  const rotated = transform(out, (direction * Math.PI) / 2, [centerX, 0, pavilion.centerZ]);
  gable(rotated, 0.35, rx + 0.72, 17.18, 9.15, 2.23, lod);
  if (lod > 0) {
    dormer(out, centerX, pavilion.centerZ + rz * 0.89, 20.65, 2.63, 1.04, lod, 'zincDark');
    dormer(rotated, 0, rx * 0.9, 20.58, 2.36, 1.1, lod);
    for (const offset of [-1, 1]) {
      const x = centerX + offset * 4.15;
      solid(
        out,
        'trim',
        x - 0.48,
        x + 0.48,
        17.43,
        18.46,
        alamedaFront - 1.48,
        alamedaFront - 0.46,
        'pale',
      );
    }
  }
}

function build(out, lod) {
  libraryShell(out, lod);
  const [west, east] = sections.frontWingEnds;
  const middle = sections.porticoCenter;
  frontWing(out, west, middle - sections.porticoWidth / 2, lod);
  frontWing(out, middle + sections.porticoWidth / 2, east, lod);
  entrance(out, lod);
  dome(out, lod);
  for (const [i, x] of pavilion.centerX.entries()) cornerPavilion(out, x, i === 0 ? -1 : 1, lod);
}
export const librarySkyline = (out) => build(out, 0);
export const libraryDistrict = (out) => build(out, 1);
export const libraryStreet = (out) => build(out, 2);
export const libraryCloseup = (out) => build(out, 3);

const recipe = 'national-library-of-chile-model.mjs';
const camera = [-88, 40, 116];
const lookAt = [-8, 11.5, 10];
export const libraryModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: libraryCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.995,
    basis:
      'The named Biblioteca Nacional relation 6123552 and its outer ring. The adjoining Archivo Nacional is a separate building record.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The standing National Library of Chile at Santiago’s Alameda, with its columned entrance, broad central cupola, symmetrical corner mansards and long library wings.',
  camera,
  lookAt,
  sunDirection: [-42, 83, 48],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 2.1,
    cameraYaw: -0.5,
    groundY: 0,
    focus: { center: [-5, 13, 11] },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'alameda-entrance-and-cupola', position: [-5, 18.4, 111], lookAt: [-6, 13.78, 31] },
    {
      name: 'portico-arches-and-corner-mansard',
      position: [-46, 9.2, 72],
      lookAt: [-16, 13.6, 40],
    },
    { name: 'western-library-facade', position: [-94, 31, 17], lookAt: [-17, 14, -7] },
    { name: 'rear-wing-and-light-wells', position: [71, 70, -98], lookAt: [-3, 13, -2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `biblioteca-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'librarySkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'libraryDistrict', errorMeters: 0.56, surfaces },
      street: { export: 'libraryStreet', errorMeters: 0.23, surfaces },
      closeup: { export: 'libraryCloseup', errorMeters: 0.1, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry from public-domain archival and plan evidence, ODbL OpenStreetMap plans and the original openly attributed Terrarium elevation. No embedded reference images.',
};
