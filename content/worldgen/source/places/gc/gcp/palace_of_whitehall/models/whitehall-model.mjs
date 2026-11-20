import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { controls, planPoint, wings } from './whitehall-plan.mjs';
import { westControls, westRanges } from './whitehall-west-plan.mjs';

export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.91, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.88, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.91, metallic: 0 },
  tiles: { slot: 'roof', graph: 'tile_flat', roughness: 0.92, metallic: 0 },
  lead: { slot: 'roof', graph: 'slate', roughness: 0.87, metallic: 0.1 },
  glazing: { slot: 'trim', graph: 'metal_painted', roughness: 0.64, metallic: 0.14 },
  mullion: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
};

const brick = [0.53, 0.29, 0.2];
const ashlar = [0.71, 0.65, 0.52];
const pale = [0.79, 0.75, 0.65];
const roof = [0.45, 0.25, 0.18];
const slate = [0.26, 0.28, 0.29];
const glaze = [0.22, 0.27, 0.264];
const frame = [0.3, 0.24, 0.17];
const turf = [0.3, 0.4, 0.24];
const gravel = [0.62, 0.55, 0.42];
const ref = 'palette:#ffffff';
const shade = (color, k) => color.map((value) => value * k);
const quad = (out, key, points, color) =>
  out.addQuad(key, ref, points, normalFor(...points), [], color);
const tri = (out, key, points, color) =>
  out.addTriangle(key, ref, points, normalFor(...points), [], color);
const flat = (out, key, left, bottom, right, top, z, color) =>
  quad(
    out,
    key,
    [
      [left, bottom, z],
      [right, bottom, z],
      [right, top, z],
      [left, top, z],
    ],
    color,
  );

function walls(out, key, length, depth, bottom, top, color) {
  for (const angle of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
    const end = Math.abs(angle) === Math.PI / 2;
    const a = (end ? depth : length) / 2;
    const b = (end ? length : depth) / 2;
    flat(transform(out, angle), key, -a, bottom, a, top, b, color);
  }
}

function frontFrame(out, [a, b], width = 0) {
  return localFrontFrame(out, [planPoint(a), planPoint(b)], width * 0.31);
}

function localFrontFrame(out, [[x, z], [bx, bz]], depth) {
  const length = Math.hypot(bx - x, bz - z);
  const angle = Math.atan2(z - bz, bx - x);
  const center = [
    (x + bx) / 2 - (depth / 2) * Math.sin(angle),
    0,
    (z + bz) / 2 - (depth / 2) * Math.cos(angle),
  ];
  return { out: transform(out, angle, center), length, depth };
}

function tiledRoof(out, length, depth, y, rise, type, key, color, wallKey, wallColor) {
  const a = length / 2 + 0.2,
    b = depth / 2 + 0.19;
  const eaves = [
    [-a, y, b],
    [a, y, b],
    [a, y, -b],
    [-a, y, -b],
  ];
  const end = type === 'hip' ? Math.min(depth * 0.51, a * 0.61) : 0;
  const l = [-a + end, y + rise, 0],
    r = [a - end, y + rise, 0];
  quad(out, key, [eaves[0], eaves[1], r, l], color);
  quad(out, key, [eaves[2], eaves[3], l, r], shade(color, 0.93));
  tri(out, end ? key : wallKey, [eaves[1], eaves[2], r], end ? shade(color, 0.96) : wallColor);
  tri(out, end ? key : wallKey, [eaves[3], eaves[0], l], end ? shade(color, 0.92) : wallColor);
}

function window(out, x, y, width, height, z, detail, mullioned = false) {
  flat(out, 'glazing', x - width / 2, y, x + width / 2, y + height, z, glaze);
  if (!detail.joinery) return;
  flat(out, 'stone', x - width * 0.57, y - 0.08, x + width * 0.57, y, z + 0.014, ashlar);
  flat(out, 'mullion', x - 0.035, y, x + 0.035, y + height, z + 0.014, frame);
  if (mullioned)
    flat(
      out,
      'mullion',
      x - width / 2,
      y + height * 0.56 - 0.035,
      x + width / 2,
      y + height * 0.56 + 0.035,
      z + 0.015,
      frame,
    );
}

function windows(out, length, depth, eaves, floors, detail, bays) {
  if (!detail.windows) return;
  const count = bays ?? Math.max(1, Math.round(length / detail.pitch));
  const storeys = detail.joinery ? floors : Math.min(floors, 2);
  for (const angle of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
    const end = Math.abs(angle) === Math.PI / 2;
    if (end && !detail.endWindows) continue;
    const span = end ? depth : length,
      z = (end ? length : depth) / 2 + 0.016;
    const n = end ? Math.max(1, Math.round(depth / detail.pitch)) : count;
    const wall = transform(out, angle);
    const spacing = span / n;
    for (let col = 0; col < n; col++) {
      const x = (col + 0.5) * spacing - span / 2;
      for (let row = 0; row < storeys; row++) {
        const ceiling = (eaves - 0.52) / storeys;
        window(
          wall,
          x,
          0.91 + ceiling * row,
          Math.min(0.92, spacing * 0.42),
          Math.min(1.8, ceiling * 0.62),
          z,
          detail,
          floors >= 3,
        );
      }
    }
  }
}

function chimneys(out, length, depth, y, rise, bays, detail) {
  if (!detail.joinery) return;
  for (let i = 0; i < bays; i++) {
    const x = ((i + 0.5) * length) / bays - length / 2,
      z = depth * 0.21 * (i % 2 === 0 ? 1 : -1);
    for (const dx of [-0.28, 0.28]) {
      box(
        out,
        'brick',
        [x + dx - 0.225, y - 0.18, z - 0.245],
        [x + dx + 0.225, y + rise + 1.43, z + 0.245],
        shade(brick, 0.84),
      );
      box(
        out,
        'brick',
        [x + dx - 0.268, y + rise + 1.34, z - 0.285],
        [x + dx + 0.268, y + rise + 1.52, z + 0.285],
        shade(brick, 0.91),
      );
    }
  }
}

function lancet(out, x, y, width, height, z, detail) {
  const shoulder = y + height - width * 0.68;
  const lo = x - width / 2,
    hi = x + width / 2;
  flat(out, 'glazing', lo, y, hi, shoulder, z, glaze);
  tri(
    out,
    'glazing',
    [
      [lo, shoulder, z],
      [hi, shoulder, z],
      [x, y + height, z],
    ],
    glaze,
  );
  if (!detail.joinery) return;
  const stone = shade(ashlar, 0.95);
  for (const u of [-0.5, -0.17, 0.17, 0.5])
    flat(out, 'stone', x + u * width - 0.063, y, x + u * width + 0.063, shoulder, z + 0.015, stone);
  flat(out, 'stone', lo - 0.1, y - 0.12, hi + 0.1, y, z + 0.015, stone);
  flat(out, 'stone', lo, y + height * 0.47, hi, y + height * 0.47 + 0.083, z + 0.016, stone);
}

function institutionalHall(out, length, depth, eaves, kind, detail) {
  const chapel = kind === 'chapel';
  walls(out, chapel ? 'stone' : 'brick', length, depth, -0.33, eaves, chapel ? ashlar : brick);
  const rise = depth * (chapel ? 0.63 : 0.49);
  tiledRoof(
    out,
    length,
    depth,
    eaves,
    rise,
    'gable',
    'lead',
    slate,
    chapel ? 'stone' : 'brick',
    chapel ? ashlar : brick,
  );
  if (detail.windows) {
    const count = chapel ? 5 : 4;
    for (const angle of [0, Math.PI]) {
      const side = transform(out, angle),
        z = depth / 2;
      for (let i = 0; i < count; i++) {
        const x = -length / 2 + (length * (i + 0.5)) / count;
        lancet(side, x, 3.0, chapel ? 2.3 : 1.62, eaves - 5.0, z + 0.021, detail);
        if (detail.joinery) {
          const p = x - length / (2 * count) + 0.24;
          box(side, 'stone', [p - 0.26, 0, z - 0.04], [p + 0.26, eaves - 0.5, z + 0.41], ashlar);
          box(side, 'stone', [p - 0.31, 0, z + 0.34], [p + 0.31, 4.6, z + 0.7], ashlar);
        }
      }
    }
    const end = transform(out, -Math.PI / 2);
    lancet(
      end,
      0,
      2.65,
      Math.min(depth * 0.62, 5.4),
      eaves + rise * 0.65 - 2.65,
      length / 2 + 0.23,
      detail,
    );
  }
}

function gardenOriel(out, x, z, detail) {
  const body = shade(brick, 0.91);
  box(out, 'brick', [x - 1.35, 1.03, z - 0.2], [x + 1.35, 8.83, z + 0.69], body);
  for (const y of detail.joinery ? [1.6, 4.3, 7.2, 8.32] : [8.32])
    box(out, 'stone', [x - 1.42, y, z - 0.2], [x + 1.42, y + 0.13, z + 0.75], ashlar);
  const facade = z + 0.703;
  for (const y of [2.1, 4.81, 7.49]) {
    const height = y > 7 ? 0.78 : 1.68;
    flat(out, 'stone', x - 1.1, y - 0.13, x + 1.1, y + height + 0.1, facade, pale);
    for (const offset of [-0.67, 0, 0.67])
      window(out, x + offset, y, 0.49, height, facade + 0.019, detail, true);
  }
}

function palaceWing(out, wing, detail) {
  const f = wing.localFront
    ? localFrontFrame(out, wing.localFront, wing.depth)
    : frontFrame(out, wing.front, wing.width);
  const { out: piece, length, depth } = f;
  const { eaves, floors, bays } = wing;
  const gabledGarden = wing.name === 'Privy Garden gabled frontage';
  const facadeDetail =
    detail.simplifyJoinery && eaves < 9.3 && !gabledGarden ? { ...detail, joinery: false } : detail;
  const shape = wing.roof === 'cross' && !detail.windows && !gabledGarden ? 'gable' : wing.roof;
  if (shape === 'chapel' || shape === 'hall') {
    institutionalHall(piece, length, depth, eaves, shape, detail);
    return;
  }
  const key = wing.light ? 'stone' : 'brick',
    color = wing.light ? ashlar : shade(brick, 0.91 + 0.11 * Math.cos(length * 0.75));
  walls(piece, key, length, depth, -0.31, eaves, color);
  if (shape === 'flat') {
    box(
      piece,
      'lead',
      [-length / 2 - 0.17, eaves, -depth / 2 - 0.17],
      [length / 2 + 0.17, eaves + 0.2, depth / 2 + 0.17],
      slate,
    );
  } else if (shape === 'cross') {
    const n = bays ?? 3,
      bay = length / n;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * bay - length / 2;
      const part = transform(piece, Math.PI / 2, [x, 0, 0]);
      tiledRoof(part, depth, bay - 0.08, eaves, bay * 0.45, 'gable', 'tiles', roof, key, color);
      if (detail.joinery && eaves > 9) {
        window(piece, x, eaves + 0.38, 0.68, 0.72, depth / 2 + 0.213, detail);
      }
    }
  } else if (shape === 'cockpit') {
    tiledRoof(piece, length, depth, eaves, 3.65, 'hip', 'tiles', roof, key, color);
    const ring = (y, r) => radialRing(y, r, r, 8, [0.38, -0.46], Math.PI / 8);
    loft(
      piece,
      'lead',
      [ring(eaves + 3.1, 1.41), ring(eaves + 3.84, 1.4), ring(eaves + 4.44, 0.12)],
      slate,
    );
  } else {
    tiledRoof(
      piece,
      length,
      depth,
      eaves,
      Math.min(depth * 0.44, 5.35),
      shape === 'tennis' ? 'gable' : shape,
      'tiles',
      roof,
      key,
      color,
    );
  }
  if (
    detail.windows &&
    (!detail.sparseWindows || eaves >= 9.25 || gabledGarden || shape === 'tennis')
  ) {
    if (shape === 'tennis') {
      for (let i = 0; i < bays; i++) {
        const x = length * ((i + 0.5) / bays - 0.5);
        window(piece, x, eaves - 3.45, 0.98, 2.3, depth / 2 + 0.023, facadeDetail, true);
      }
    } else {
      windows(piece, length, depth, eaves, floors, facadeDetail, bays);
    }
    if (gabledGarden) {
      for (let i = 1; i < bays; i += 2)
        gardenOriel(piece, ((i + 0.5) * length) / bays - length / 2, depth / 2, detail);
    }
    if (facadeDetail.joinery) {
      const z = depth / 2 + 0.027;
      flat(
        piece,
        'stone',
        -length / 2,
        eaves - 0.2,
        length / 2,
        eaves - 0.06,
        z,
        shade(ashlar, 0.91),
      );
      flat(
        transform(piece, Math.PI),
        'stone',
        -length / 2,
        eaves - 0.2,
        length / 2,
        eaves - 0.06,
        z,
        shade(ashlar, 0.91),
      );
    }
  }
  chimneys(
    piece,
    length,
    depth,
    eaves,
    shape === 'flat' ? 0 : Math.min(depth * 0.44, 5.35),
    Math.max(1, Math.floor(length / 16)),
    facadeDetail,
  );
}

function westPrecinct(out, detail) {
  for (const wing of westRanges) {
    if (!detail.windows && !wing.skyline) continue;
    palaceWing(out, wing, detail);
  }
  for (const boundary of [westControls.tiltyard, westControls.horseYard]) {
    const points = boundary.map(([x, z]) => [x, 0.017, z]);
    if (normalFor(...points)[1] < 0) points.reverse();
    quad(out, 'base', points, shade(gravel, 0.94));
  }
  if (!detail.windows) return;
  const gate = localFrontFrame(out, westControls.parkGate, 5);
  openGate(gate.out, gate.length, gate.depth, 7.9, detail, 'brick', brick, 3.9);
  tiledRoof(gate.out, gate.length, gate.depth, 7.9, 2.15, 'hip', 'tiles', roof, 'brick', brick);
}

function banquetingHouse(out, detail) {
  const {
    length,
    depth,
    centre: [x, z],
  } = controls.banquetingHouse;
  const part = transform(out, 0, [x, 0, z]),
    a = length / 2,
    b = depth / 2;
  box(part, 'stone', [-a, -0.29, -b], [a, 4.4, b], shade(ashlar, 0.92));
  box(part, 'stone', [-a, 4.4, -b], [a, 16.85, b], pale);
  tiledRoof(part, length, depth, 17.3, 3.25, 'hip', 'lead', slate, 'stone', pale);
  for (const y of [4.17, 10.1, 16.65]) {
    box(part, 'stone', [-a - 0.24, y, -b - 0.25], [a + 0.24, y + 0.38, b + 0.25], pale);
  }
  for (const angle of [0, Math.PI]) {
    const wall = transform(part, angle),
      front = b + 0.27;
    box(wall, 'stone', [-a - 0.26, 17.02, front - 0.27], [a + 0.26, 17.31, front], pale);
    for (let i = 0; i < (detail.windows ? 8 : 0); i++) {
      const px = (length * i) / 7 - a;
      box(wall, 'stone', [px - 0.16, 4.7, b - 0.04], [px + 0.16, 16.64, b + 0.22], ashlar);
    }
    if (!detail.windows) continue;
    flat(wall, 'stone', -a - 0.26, 18.21, a + 0.26, 18.36, front, pale);
    const posts = detail.joinery ? 39 : 8;
    for (let i = 0; i < posts; i++) {
      const p = ((i + 0.5) * length) / posts - a;
      flat(wall, 'stone', p - 0.09, 17.3, p + 0.09, 18.21, front + 0.009, pale);
    }
    if (detail.endWindows)
      for (let i = 0; i < 8; i++) {
        const px = (length * i) / 7 - a;
        for (const y of [4.7, 9.78, 10.65, 16.28])
          box(wall, 'stone', [px - 0.24, y, b - 0.035], [px + 0.24, y + 0.22, b + 0.29], ashlar);
      }
    for (let i = 0; i < 7; i++) {
      const px = (length * (i + 0.5)) / 7 - a;
      for (const [y, h] of [
        [1.68, 1.45],
        [5.72, 3.19],
        [11.41, 3.15],
      ]) {
        window(wall, px, y, 1.61, h, b + 0.019, detail, true);
        if (detail.joinery) {
          flat(wall, 'stone', px - 1.0, y + h, px + 1.0, y + h + 0.2, b + 0.031, ashlar);
          tri(
            wall,
            'stone',
            [
              [px - 1.0, y + h + 0.2, b + 0.038],
              [px + 1, y + h + 0.2, b + 0.038],
              [px, y + h + 0.51, b + 0.038],
            ],
            pale,
          );
        }
      }
    }
  }
}

function openGate(out, length, depth, height, detail, skin, cladding, width = 3.3) {
  const a = length / 2,
    b = depth / 2,
    spring = 3.36,
    peak = 5.6;
  box(out, skin, [-a, -0.26, -b], [-width / 2, height, b], cladding);
  box(out, skin, [width / 2, -0.26, -b], [a, height, b], cladding);
  box(out, skin, [-width / 2, peak, -b], [width / 2, height, b], cladding);
  for (const angle of [0, Math.PI]) {
    const front = transform(out, angle);
    const n = detail.joinery ? 14 : 7;
    for (let i = 0; i < n; i++) {
      const arch = (t) => [
        width * (t - 0.5),
        spring + (peak - spring) * Math.sin(Math.PI * t),
        b + 0.017,
      ];
      const p = arch(i / n),
        q = arch((i + 1) / n);
      const upperP = [p[0], peak + 0.08, p[2]],
        upperQ = [q[0], peak + 0.08, q[2]];
      quad(front, skin, [p, q, upperQ, upperP], cladding);
      const lining = [q, p, [p[0], p[1], -b], [q[0], q[1], -b]];
      if (angle === 0) quad(out, 'stone', lining, shade(ashlar, 0.94));
    }
    if (detail.windows) window(front, 0, peak + 0.49, 1.2, 1.51, b + 0.032, detail, true);
  }
}

function gates(out, detail) {
  const [x, z] = planPoint(controls.holbeinGate);
  const gate = transform(out, Math.PI / 2, [x, 0, z]);
  openGate(gate, 10.4, 6.3, 10.4, detail, 'stone', shade(ashlar, 0.73), 3.82);
  for (const side of [-1, 1]) {
    const px = side * 4.49;
    loft(
      gate,
      'stone',
      [radialRing(0, 1.34, 1.43, 8, [px, 0]), radialRing(13.1, 1.34, 1.43, 8, [px, 0])],
      shade(ashlar, 0.76),
    );
    const ring = detail.joinery ? 8 : detail.windows ? 4 : 0;
    for (let i = 0; i < ring; i++) {
      const a = (2 * Math.PI * i) / ring,
        dx = px + 1.11 * Math.cos(a),
        dz = 1.18 * Math.sin(a);
      box(gate, 'stone', [dx - 0.27, 13.0, dz - 0.245], [dx + 0.27, 13.79, dz + 0.245], ashlar);
    }
  }
  box(gate, 'stone', [-5.44, 9.96, -3.27], [5.44, 10.27, 3.27], ashlar);
  const f = frontFrame(out, controls.courtGate, 18);
  openGate(f.out, f.length, f.depth, 8.57, detail, 'brick', brick, 4.7);
  tiledRoof(f.out, f.length, f.depth, 8.57, 2.7, 'hip', 'tiles', roof, 'brick', brick);
}

function riversideBays(out, detail) {
  const sides = detail.joinery ? 10 : 6;
  for (const [u, v] of [
    [102, 646],
    [209, 652],
    [479, 654],
  ]) {
    const [x, z] = planPoint([u, v]);
    const build = transform(out, 0, [x, 0, z]);
    const rings = (entries) => entries.map(([y, r]) => radialRing(y, r, r, sides));
    loft(
      build,
      'brick',
      rings([
        [0.08, 2.05],
        [2.31, 2.05],
        [2.68, 2.42],
        [9.79, 2.42],
      ]),
      shade(brick, 0.96),
    );
    loft(
      build,
      'stone',
      rings([
        [2.34, 2.08],
        [2.65, 2.43],
        [2.78, 2.46],
      ]),
      ashlar,
    );
    loft(
      build,
      'lead',
      rings([
        [9.83, 2.48],
        [10.19, 2.32],
        [11.09, 0.1],
      ]),
      slate,
    );
    if (detail.joinery)
      for (const yaw of [Math.PI * 0.73, Math.PI, Math.PI * 1.27]) {
        const front = transform(build, yaw);
        for (const y of [3.4, 6.94]) window(front, 0, y, 0.72, 1.63, 2.36, detail, true);
      }
  }
}

function forecourts(out, detail) {
  const [a, b, c, d] = controls.garden.map(planPoint);
  const blend = (u, v, y) => [
    a[0] * (1 - u) * (1 - v) + b[0] * u * (1 - v) + c[0] * u * v + d[0] * (1 - u) * v,
    y,
    a[1] * (1 - u) * (1 - v) + b[1] * u * (1 - v) + c[1] * u * v + d[1] * (1 - u) * v,
  ];
  const bed = (u, v, w, h, y, color) =>
    quad(
      out,
      'base',
      [blend(u, v, y), blend(u, v + h, y), blend(u + w, v + h, y), blend(u + w, v, y)],
      color,
    );
  const panel = (u, v, w, h, left, front, right, rear, color) => {
    const lawnWidth = w - left - right;
    bed(u, v, left, h, 0.005, gravel);
    bed(u + w - right, v, right, h, 0.005, gravel);
    bed(u + left, v, lawnWidth, front, 0.005, gravel);
    bed(u + left, v + h - rear, lawnWidth, rear, 0.005, gravel);
    bed(u + left, v + front, lawnWidth, h - front - rear, 0.019, color);
  };
  if (detail.windows) {
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        panel(
          i * 0.25,
          j * 0.25,
          0.25,
          0.25,
          0.032,
          0.025,
          0.033,
          0.025,
          shade(turf, 0.93 + 0.09 * Math.cos(i + j * 3.1)),
        );
  } else {
    panel(0, 0, 1, 1, 0.052, 0.06, 0.052, 0.06, turf);
  }
  for (let i = 1; i < controls.waterfront.length; i++) {
    const f = frontFrame(out, controls.waterfront.slice(i - 1, i + 1), 10);
    box(
      f.out,
      'base',
      [-f.length / 2, -3.2, -f.depth / 2],
      [f.length / 2, 0.29, f.depth / 2],
      shade(ashlar, 0.81),
    );
  }
  if (!detail.windows) return;
  const landing = frontFrame(out, controls.privyStairs);
  const half = landing.length / 2;
  const flight = detail.joinery ? 8 : 4;
  for (let i = 0; i < flight; i++) {
    box(
      landing.out,
      'base',
      [-half, -2.42, (3.35 * i) / flight],
      [half, 0.25 - (1.76 * i) / flight, (3.35 * (i + 1)) / flight],
      shade(ashlar, 0.91),
    );
  }
}

const tiers = {
  skyline: { windows: false, joinery: false },
  district: { windows: true, joinery: false, pitch: 6.2, sparseWindows: true },
  street: { windows: true, joinery: true, pitch: 5.4, simplifyJoinery: true },
  closeup: { windows: true, joinery: true, endWindows: true, pitch: 3.45 },
  master: { windows: true, joinery: true, endWindows: true, pitch: 3.2 },
};

export function buildWhitehall(out, name) {
  const detail = tiers[name];
  forecourts(out, detail);
  for (const wing of wings) {
    if (name === 'skyline' && wing.eaves < 9.6 && wing.width < 36 && wing.roof !== 'cross')
      continue;
    palaceWing(out, wing, detail);
  }
  banquetingHouse(out, detail);
  gates(out, detail);
  westPrecinct(out, detail);
  if (detail.windows) riversideBays(out, detail);
}

export const buildSkyline = (out) => buildWhitehall(out, 'skyline');
export const buildDistrict = (out) => buildWhitehall(out, 'district');
export const buildStreet = (out) => buildWhitehall(out, 'street');
export const buildCloseup = (out) => buildWhitehall(out, 'closeup');
