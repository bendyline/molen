/** The extant Customs House at Petrie Bight, after the copper roof restoration. */
import fs from 'node:fs';
import {
  beam,
  beamPath,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  profile,
  quad,
  tube,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) =>
  JSON.parse(fs.readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const outline = frame.geometry.outline;
const {
  riverFoundationY,
  mainFloorY,
  firstFloorY,
  eaveY,
  parapetY,
  domeCenter,
  domeRadius,
  drumBaseY,
  domeSpringY,
  domeCrownY,
  lanternY,
} = plan.dimensions;
const colors = Object.fromEntries(
  Object.entries({
    wall: 'c6b695',
    ashlar: 'b4a084',
    dressed: 'd2c4a6',
    light: 'ded0b2',
    sill: 'beaa8f',
    shade: '948269',
    tympanum: 'b1a083',
    copper: '81786a',
    copperSeam: '958374',
    copperDark: '625c53',
    terrace: '968d7a',
    glass: '424d4d',
    reflected: '566363',
    joinery: '665847',
    iron: '454343',
  }).map(([key, tint]) => [key, rgb(tint)]),
);
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.93 },
  base: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.96 },
  stone: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.9 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.86, metallic: 0.34 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.58, metallic: 0.05 },
  fine: { slot: 'trim', localRef: 'palette:#fffffe', roughness: 0.86 },
};
const palette = 'palette:#ffffff';
const tau = Math.PI * 2;

function pointOn(a, b, t) {
  return a.map((value, i) => value + (b[i] - value) * t);
}

const edges = outline.map(([x, z], index) => {
  const [x2, z2] = outline[(index + 1) % outline.length];
  const length = Math.hypot(x2 - x, z2 - z);
  const dx = (x2 - x) / length;
  const dz = (z2 - z) / length;
  // Native points advance clockwise when seen from outside the top.
  const normal = [-dz, 0, dx];
  return {
    length,
    normal,
    at: (u, y, p = 0) => [x + u * dx + p * normal[0], y, z + u * dz + p * normal[2]],
  };
});

function face(out, slot, points, expected, color) {
  let n = normalFor(...points);
  if (n.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, color);
  else
    out.addTriangle(
      slot,
      palette,
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}

function panel(out, slot, e, left, right, bottom, top, offset, color) {
  face(
    out,
    slot,
    [
      e.at(left, bottom, offset),
      e.at(right, bottom, offset),
      e.at(right, top, offset),
      e.at(left, top, offset),
    ],
    e.normal,
    color,
  );
}

function band(out, e, bottom, top, projection, color) {
  const a = -projection / 3;
  const b = e.length + projection / 3;
  panel(out, 'stone', e, a, b, bottom, top, projection, color);
  for (const edgeY of [bottom, top]) {
    face(
      out,
      'stone',
      [e.at(a, edgeY), e.at(b, edgeY), e.at(b, edgeY, projection), e.at(a, edgeY, projection)],
      [0, edgeY === top ? 1 : -1, 0],
      color,
    );
  }
}

function window(out, e, u, w, y, height, detail, door = false) {
  const left = u - w / 2;
  const right = u + w / 2;
  const top = y + height;
  panel(out, 'window', e, left, right, y, top, 0.047, door ? colors.joinery : colors.glass);
  if (detail === 0) return;
  if (detail === 1) {
    panel(out, 'stone', e, left - 0.15, right + 0.15, y - 0.13, top + 0.15, 0.032, colors.dressed);
    return;
  }
  panel(out, 'stone', e, left - 0.15, left + 0.018, y - 0.068, top + 0.14, 0.114, colors.dressed);
  panel(out, 'stone', e, right - 0.018, right + 0.15, y - 0.068, top + 0.14, 0.114, colors.dressed);
  panel(out, 'stone', e, left - 0.15, right + 0.15, top, top + 0.18, 0.152, colors.dressed);
  panel(out, 'stone', e, left - 0.22, right + 0.22, y - 0.17, y - 0.02, 0.195, colors.sill);
  if (detail >= 2) {
    panel(
      out,
      'window',
      e,
      left + 0.11,
      right - 0.11,
      y + height * 0.62,
      top - 0.08,
      0.06,
      colors.reflected,
    );
    panel(out, 'fine', e, u - 0.035, u + 0.035, y + 0.025, top - 0.015, 0.076, colors.joinery);
    panel(out, 'fine', e, left, right, y + height * 0.6, y + height * 0.623, 0.077, colors.joinery);
  }
}

function pilaster(out, e, u, width, detail) {
  const foot = mainFloorY;
  const head = eaveY - 0.83;
  const point = (p, y) => e.at(u + p, y, 0.045);
  beam(out, 'stone', point(0, foot + 0.21), point(0, head - 0.23), width, 0.41, colors.dressed);
  if (detail === 1) return;
  beam(out, 'stone', point(0, foot), point(0, foot + 0.41), 1.4 * width, 0.54, colors.sill);
  beam(out, 'stone', point(0, head - 0.46), point(0, head), 1.37 * width, 0.59, colors.light);
  if (detail === 3) {
    for (const shift of [-0.22, -0.11, 0, 0.11, 0.22]) {
      panel(
        out,
        'stone',
        e,
        u + shift - 0.012,
        u + shift + 0.012,
        foot + 0.55,
        head - 0.64,
        0.255,
        colors.sill,
      );
    }
  }
}

function pediment(out, e, left, right, projection, detail) {
  const foot = eaveY + 0.12;
  const peak = foot + 2.16;
  const mid = (left + right) / 2;
  const a = e.at(left, foot, projection);
  const b = e.at(right, foot, projection);
  const top = e.at(mid, peak, projection);
  face(out, 'stone', [a, b, top], e.normal, colors.tympanum);
  const rear = [e.at(left, foot, -0.54), e.at(right, foot, -0.54), e.at(mid, peak, -0.54)];
  face(out, 'roof', [a, top, rear[2], rear[0]], [0, 1, 0], colors.copperDark);
  face(out, 'roof', [top, b, rear[1], rear[2]], [0, 1, 0], colors.copperDark);
  beamPath(out, 'stone', [a, top, b], 0.31, 0.33, colors.light);
  beam(out, 'stone', a, b, 0.34, 0.35, colors.dressed);
  if (detail >= 2) {
    const relief = e.at(mid, foot + 0.74, projection + 0.09);
    sphere(out, 'stone', relief, [0.36, 0.39, 0.15], colors.dressed, 8, 5);
    for (const side of [-1, 1]) {
      beamPath(
        out,
        'stone',
        [
          e.at(mid + side * 0.3, foot + 0.75, projection + 0.11),
          e.at(mid + side * 0.85, foot + 0.53, projection + 0.09),
          e.at(mid + side * 1.48, foot + 0.43, projection + 0.045),
        ],
        0.105,
        0.13,
        colors.dressed,
      );
    }
  }
}

function balustrade(out, e, detail) {
  const bottom = eaveY + 0.3;
  panel(out, 'stone', e, 0, e.length, bottom, parapetY, 0.12, colors.shade);
  const count = Math.max(1, Math.round(e.length / (detail >= 2 ? 0.58 : 1.34)));
  for (let i = 0; i <= count; i++) {
    const u = (e.length * i) / count;
    const w = i === 0 || i === count ? 0.43 : 0.12;
    panel(
      out,
      'stone',
      e,
      u - w / 2,
      u + w / 2,
      bottom + 0.04,
      parapetY - 0.04,
      0.198,
      colors.light,
    );
  }
  for (const h of [bottom + 0.04, parapetY - 0.045]) {
    panel(out, 'stone', e, -0.07, e.length + 0.07, h - 0.063, h + 0.063, 0.257, colors.dressed);
  }
}

const outlineTriangles = earcut(outline.flat());
function masonryShell(out, slot, bottom, top, color) {
  for (const e of edges) panel(out, slot, e, 0, e.length, bottom, top, 0, color);
  for (const [y, normal] of [
    [bottom, [0, -1, 0]],
    [top, [0, 1, 0]],
  ]) {
    for (let i = 0; i < outlineTriangles.length; i += 3) {
      const points = outlineTriangles.slice(i, i + 3).map((index) => {
        const [x, z] = outline[index];
        return [x, y, z];
      });
      face(out, slot, points, normal, color);
    }
  }
}

function masonry(out, detail) {
  masonryShell(out, 'base', riverFoundationY - 2.3, mainFloorY - 0.012, colors.ashlar);
  masonryShell(out, 'wall', mainFloorY - 0.017, eaveY, colors.wall);
  masonryShell(out, 'roof', eaveY, eaveY + 0.33, colors.terrace);
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const apse = i >= 6 && i <= 12;
    const river = i <= 4 || i === 19;
    const portico = i === 16 || i === 2;
    const streetPediment = i === 14 || i === 18;
    if (detail === 0) {
      panel(out, 'stone', e, 0, e.length, eaveY - 0.31, eaveY + 0.09, 0.07, colors.light);
    } else {
      band(out, e, mainFloorY - 0.25, mainFloorY + 0.026, 0.2, colors.dressed);
      band(out, e, firstFloorY - 0.19, firstFloorY - 0.04, 0.095, colors.sill);
      band(out, e, eaveY - 0.59, eaveY - 0.3, 0.24, colors.dressed);
      band(out, e, eaveY - 0.22, eaveY + 0.09, 0.36, colors.light);
    }
    if (!streetPediment) {
      if (detail === 0)
        panel(out, 'stone', e, 0, e.length, eaveY + 0.22, parapetY, 0.075, colors.sill);
      else balustrade(out, e, detail);
    }
    const bays = apse ? 1 : Math.floor(e.length / 3.28);
    if (e.length < 2.7) continue;
    for (let j = 0; j < Math.max(1, bays); j++) {
      const center = (e.length * (j + 0.5)) / Math.max(1, bays);
      const door = (i === 9 || i === 16 || i === 2) && j === Math.floor(bays / 2);
      const width = Math.min(1.52, (e.length / Math.max(1, bays)) * 0.56);
      window(
        out,
        e,
        center,
        width,
        door ? mainFloorY + 0.03 : 1.6,
        door ? 3.25 : 2.31,
        detail,
        door,
      );
      window(out, e, center, width, firstFloorY + 0.49, 2.35, detail);
      if (river && detail >= 1)
        window(out, e, center, width * 0.86, -2.85, 1.9, detail, i === 2 && door);
      if (!portico && detail >= 1 && (apse || j > 0))
        pilaster(out, e, (e.length * j) / Math.max(1, bays), 0.54, detail);
    }
    if (streetPediment) pediment(out, e, 0.16, e.length - 0.16, 0.42, detail);
  }
}

function column(out, x, z, floor, height, detail) {
  const radius = 0.43;
  const sides = [6, 8, 12, 16][detail];
  const y = floor + height;
  if (detail === 0) {
    tube(out, 'stone', [x, floor, z], [x, y, z], radius, colors.dressed, sides);
    return;
  }
  box(out, 'stone', x, floor, z, 1.17, 0.23, 1.17, colors.sill);
  profile(
    out,
    [
      [floor + 0.23, 0.6, 0.6],
      [floor + 0.37, 0.56, 0.56, 'stone', colors.light],
      [floor + 0.54, radius, radius, 'stone', colors.sill],
      [y - 0.59, radius * 0.83, radius * 0.83, 'stone', colors.dressed],
      [y - 0.26, 0.56, 0.56, 'stone', colors.dressed],
    ],
    sides,
    [x, z],
  );
  box(out, 'stone', x, y - 0.29, z, 1.19, 0.29, 1.19, colors.light);
  if (detail >= 2) {
    const flutes = detail === 2 ? 8 : 12;
    for (let i = 0; i < flutes; i++) {
      const a = (tau * i) / flutes;
      const p = [Math.cos(a), Math.sin(a)];
      beam(
        out,
        'stone',
        [x + p[0] * radius, floor + 0.63, z + p[1] * radius],
        [x + p[0] * radius * 0.84, y - 0.66, z + p[1] * radius * 0.84],
        0.036,
        0.036,
        colors.sill,
      );
      if (detail === 3) {
        const v = [x + p[0] * 0.5, y - 0.46, z + p[1] * 0.5];
        sphere(out, 'stone', v, [0.14, 0.145, 0.14], colors.light, 6, 4);
      }
    }
  }
}

function portico(out, detail) {
  const left = -15.08;
  const right = -2.83;
  const x = (left + right) / 2;
  const width = right - left;
  const roofY = eaveY - 0.69;
  box(out, 'base', x, mainFloorY - 0.35, -11.45, width, 0.35, 3.63, colors.ashlar);
  box(out, 'stone', x, roofY, -11.14, width + 0.3, 0.74, 3.78, colors.dressed);
  box(out, 'stone', x, roofY + 0.74, -11.14, width + 0.64, 0.18, 3.96, colors.light);
  for (let i = 0; i < 5; i++)
    column(
      out,
      left + 0.72 + ((width - 1.44) * i) / 4,
      -12.47,
      mainFloorY,
      roofY - mainFloorY,
      detail,
    );
  const steps = detail === 0 ? 1 : 5;
  for (let i = 0; i < steps; i++) {
    const depth = 0.3 * (i + 1);
    box(
      out,
      'base',
      x,
      mainFloorY - 0.23 * (i + 1),
      -13.13 - depth / 2,
      7.3,
      0.23,
      depth,
      colors.ashlar,
    );
  }
}

function domePoint(a, t, extra = 0) {
  const r = domeRadius * Math.cos(t) + extra;
  return [
    domeCenter[0] + r * Math.cos(a),
    domeSpringY + (domeCrownY - domeSpringY) * Math.sin(t) + extra * Math.sin(t),
    domeCenter[1] + r * Math.sin(a),
  ];
}

function dome(out, detail) {
  const sides = [12, 24, 36, 54][detail];
  const r = domeRadius;
  profile(
    out,
    [
      [drumBaseY, r + 0.25, r + 0.25],
      [drumBaseY + 0.2, r + 0.25, r + 0.25, 'stone', colors.light],
      [drumBaseY + 0.34, r - 0.17, r - 0.17, 'stone', colors.dressed],
      [domeSpringY - 0.19, r - 0.17, r - 0.17, 'stone', colors.dressed],
      [domeSpringY, r + 0.13, r + 0.13, 'stone', colors.light],
      [domeSpringY + 0.04, r + 0.11, r + 0.11, 'roof', colors.copperDark],
    ],
    sides,
    domeCenter,
  );
  const span = Math.acos(0.102);
  const rows = [3, 7, 12, 18][detail];
  for (let i = 0; i < sides; i++) {
    const a = (tau * i) / sides;
    const b = (tau * (i + 1)) / sides;
    for (let row = 0; row < rows; row++) {
      const t = (span * row) / rows;
      const u = (span * (row + 1)) / rows;
      face(
        out,
        'roof',
        [domePoint(a, t), domePoint(b, t), domePoint(b, u), domePoint(a, u)],
        [Math.cos((a + b) / 2), 0.35, Math.sin((a + b) / 2)],
        colors.copper,
      );
    }
  }
  profile(
    out,
    [
      [domeCrownY - 0.05, 0.72, 0.72],
      [domeCrownY + 0.14, 0.72, 0.72, 'roof', colors.copperDark],
      [domeCrownY + 0.22, 0.46, 0.46, 'stone', colors.light],
      [lanternY - 0.39, 0.46, 0.46, 'stone', colors.dressed],
      [lanternY - 0.21, 0.68, 0.68, 'roof', colors.copperSeam],
      [lanternY, 0.22, 0.22, 'roof', colors.copperDark],
    ],
    [8, 10, 12, 16][detail],
    domeCenter,
  );
  if (detail === 0) return;
  for (let i = 0; i < 12; i++) {
    const a = (tau * i) / 12;
    const sections = [0, 6, 9, 13][detail];
    const points = Array.from({ length: sections + 1 }, (_, j) =>
      domePoint(a, (span * j) / sections, 0.035),
    );
    beamPath(out, 'roof', points, 0.087, 0.069, colors.copperSeam);
    const angle = a + tau / 24;
    const d = domePoint(angle, 0);
    const x = domeCenter[0] + (d[0] - domeCenter[0]) * ((r - 0.23) / r);
    const z = domeCenter[1] + (d[2] - domeCenter[1]) * ((r - 0.23) / r);
    const direction = [Math.cos(angle), 0, Math.sin(angle)];
    const tangent = [-direction[2], 0, direction[0]];
    const inset = (u, y, p = 0) => [
      x + tangent[0] * u + direction[0] * p,
      y,
      z + tangent[2] * u + direction[2] * p,
    ];
    const e = { at: inset, normal: direction };
    const y = domeSpringY - 1.37;
    panel(out, 'stone', e, -0.53, 0.53, y - 0.03, y + 1.0, 0.09, colors.light);
    panel(out, 'fine', e, -0.35, 0.35, y + 0.12, y + 0.73, 0.105, colors.shade);
    if (detail >= 2 && i % 2 === 0) {
      const medallion = domePoint(angle, 0.4, -0.095);
      const front = medallion.map((v, j) => v + direction[j] * 0.185);
      tube(out, 'roof', medallion, front, 0.29, colors.copperSeam, detail === 3 ? 12 : 8);
      tube(
        out,
        'roof',
        front,
        front.map((v, j) => v + direction[j] * 0.025),
        0.205,
        colors.copperDark,
        8,
      );
    }
  }
  const [x, z] = domeCenter;
  tube(out, 'fine', [x, lanternY - 0.05, z], [x, lanternY + 2.06, z], 0.046, colors.iron, 6);
}

function draw(out, detail) {
  masonry(out, detail);
  portico(out, detail);
  dome(out, detail);
  if (detail >= 2) {
    const left = [11.2, -0.08, -6.7],
      right = [14.8, -3.45, -10.1];
    const bottom = pointOn(left, right, 1);
    const top = pointOn(left, right, 0);
    const count = detail === 3 ? 12 : 6;
    for (let i = 0; i < count; i++) {
      const [x, y, z] = pointOn(top, bottom, (i + 0.5) / count);
      box(out, 'base', x, y - 0.28, z, 2.95, 0.29, 0.37, colors.ashlar);
    }
    for (const side of [-1, 1]) {
      const a = top.map((v, i) => v + (i === 0 ? side * 1.62 : i === 1 ? 0.42 : 0));
      const b = bottom.map((v, i) => v + (i === 0 ? side * 1.62 : i === 1 ? 0.42 : 0));
      beam(out, 'stone', a, b, 0.25, 0.23, colors.dressed);
    }
  }
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [47, 28, -57];
const lookAt = [-4, 7, 0];
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  wikidataId: 'Q1146279',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Mapped walls and the original Queensland Government elevation raster at the Queen Street approach and exposed river basement. Architectural landing heights are estimates.',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Customs House in Brisbane has a ribbed copper dome over the round Long Room, a stone Queen Street colonnade, and a lower storey on the Brisbane River side.',
  camera,
  lookAt,
  sunDirection: [-38, 69, -35],
  recipeDependencies: [
    'generate-motat-building.mjs',
    'polygon-triangulation.mjs',
    'joined-path.mjs',
  ],
  embeddedCanonicalGraphs: ['stone_sandstone', 'metal_standing_seam'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.65,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'queen-street-portico', position: [17, 7, -33], lookAt: [-13, 5.7, -4] },
    { name: 'long-room-dome', position: [31, 23, -20], lookAt: [8.5, 13.6, 0] },
    { name: 'river-basement', position: [31, 9, 37], lookAt: [-4, 3.7, 5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/' + plan.cell + '/' + id + '/models/' + slug + '-model.mjs',
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.69,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.33, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.061, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original architectural reconstruction using the verified public-domain State Library of Queensland postcard from the Qualla story, geographic mapping and written heritage records.',
};
