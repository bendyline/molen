import { readFileSync } from 'node:fs';
import {
  abox,
  extrude as extrudeRing,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import triangulate from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const mapped = read('native-map/kazan-cathedral-colonnade-controls');
const limestone = rgb('b8ae94');
const pilaster = rgb('bcaf95');
const trim = rgb('c4b9a0');
const relief = rgb('a49a82');
const reglet = rgb('948b76');
const granite = rgb('82827a');
const copper = rgb('62716d');
const roof = rgb('6d7470');
const glass = rgb('434b47');
const bronze = rgb('4c4940');
const gold = rgb('b7a15b');

const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.88 },
  footing: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.9 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.74, metallic: 0.27 },
  fittings: { slot: 'trim', graph: 'metal_painted', roughness: 0.71, metallic: 0.28 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43 },
  door: { slot: 'door', graph: 'metal_painted', roughness: 0.76, metallic: 0.29 },
};

const foot = 0.92;
const cap = 13.72;
const cornice = 16.32;
const xz = (pt, y) => [pt[0], y, pt[1]];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Emit the caps through the same material path as the walls, including in authored runtime LODs.
function extrude(out, slot, ring, low, high, color, options) {
  const surface = {
    addQuad: out.addQuad.bind(out),
    addCap(material, ref, outline, _holes, height, normal, uv, tint) {
      const indices = triangulate(outline.flat());
      for (let i = 0; i < indices.length; i += 3) {
        const points = indices.slice(i, i + 3).map((index) => outline[index]);
        out.addTriangle(
          material,
          ref,
          points.map((point) => xz(point, height(point))),
          normal,
          points.map(uv),
          tint,
        );
      }
      return indices.length > 0;
    },
  };
  extrudeRing(surface, slot, ring, low, high, color, options);
}

function alongPath(points) {
  const distance = [0];
  for (let i = 1; i < points.length; i++)
    distance.push(
      distance.at(-1) +
        Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]),
    );
  const total = distance.at(-1);
  return (u) => {
    const d = u * total;
    const i = distance.findIndex((length, index) => index > 0 && length >= d);
    return i < 0
      ? points.at(-1)
      : mix(points[i - 1], points[i], (d - distance[i - 1]) / (distance[i] - distance[i - 1]));
  };
}

function column(out, pos, level, y = foot, top = cap, radius = 0.69) {
  if (level < 2) {
    lathe(
      out,
      'trim',
      pos,
      [
        [y, radius, radius],
        [top, radius * 0.82, radius * 0.82],
      ],
      4,
      pilaster,
      { capTop: false, rotation: Math.PI / 4 },
    );
    return;
  }
  const count = level === 2 ? 7 : 12;
  const y0 = y + 0.46;
  const y1 = top - 0.84;
  lathe(
    out,
    'trim',
    pos,
    [
      [y, radius * 1.23, radius * 1.23],
      [y0, radius, radius],
    ],
    count,
    trim,
    { capTop: false },
  );
  lathe(
    out,
    'trim',
    pos,
    [
      [y0, radius, radius],
      [y1, radius * 0.8, radius * 0.8],
    ],
    count,
    pilaster,
    { capTop: false },
  );
  lathe(
    out,
    'trim',
    pos,
    [
      [y1, radius * 0.8, radius * 0.8],
      [top, radius * 1.28, radius * 1.28],
    ],
    count,
    trim,
    { capTop: false },
  );
  if (level < 3) return;
  const distance = radius * 0.77;
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const [c, s] = [Math.cos(angle), Math.sin(angle)];
    const f = facade([pos[0] + c * distance, pos[1] + s * distance], [s, -c]);
    fbox(out, 'trim', f, -0.11, 0.11, y1 + 0.075, top - 0.13, 0.04, 0.31, relief);
  }
}

function band(out, f, width, lower, upper, thickness, color) {
  fbox(out, 'trim', f, -width / 2, width / 2, lower, upper, -0.05, thickness, color);
}

function pediment(out, f, width, y, rise, level) {
  const r = width / 2;
  const face = 0.15;
  band(out, f, width + 1.2, y - 0.44, y + 0.19, 0.52, trim);
  tri(out, 'wall', f.P(-r, y, face), f.P(r, y, face), f.P(0, y + rise, face), relief);
  if (level === 0) return;
  quad4(
    out,
    'trim',
    f.P(-r - 0.24, y, face + 0.36),
    f.P(0, y + rise, face + 0.36),
    f.P(0, y + rise + 0.36, face + 0.36),
    f.P(-r - 0.35, y + 0.29, face + 0.36),
    trim,
  );
  quad4(
    out,
    'trim',
    f.P(0, y + rise, face + 0.36),
    f.P(r + 0.24, y, face + 0.36),
    f.P(r + 0.35, y + 0.29, face + 0.36),
    f.P(0, y + rise + 0.36, face + 0.36),
    trim,
  );
  if (level > 1) {
    for (const x of [-5.2, -3.8, -2.4, -1.2, 0, 1.2, 2.4, 3.8, 5.2])
      fbox(
        out,
        'trim',
        f,
        x - 0.29,
        x + 0.29,
        y + 0.45,
        y + 0.85 + 1.5 * (1 - Math.abs(x) / 6),
        face,
        face + 0.16,
        limestone,
      );
  }
}

function framedWindow(out, f, u, base, height, level, options = {}) {
  const { width = 2, head = 'round', d = 0.02 } = options;
  opening(out, f, u, base, width, height, {
    d,
    head,
    glassSlot: 'glazing',
    frameSlot: 'trim',
    glass,
    frame: trim,
    sill: level > 1,
    frameWidth: level > 1 ? 0.18 : 0,
    frameDepth: d + 0.23,
    mullions: level > 1 ? 1 : 0,
    transoms: level > 2 ? 1 : 0,
    mullionColor: bronze,
  });
}

function portal(out, f, u, width, level) {
  fbox(out, 'door', f, u - width / 2, u + width / 2, 0.98, 7.55, 0.012, 0.11, bronze);
  fbox(out, 'trim', f, u - width / 2 - 0.36, u + width / 2 + 0.36, 7.54, 7.88, 0.012, 0.42, trim);
  if (level < 2) return;
  for (const sign of [-1, 1]) {
    const end = u + (sign * width) / 2;
    fbox(out, 'trim', f, end - 0.22, end + 0.22, 0.98, 7.56, 0.003, 0.26, trim);
    fbox(
      out,
      'door',
      f,
      u + sign * 0.06 - 0.013,
      u + sign * 0.06 + 0.013,
      1.05,
      7.49,
      0.11,
      0.15,
      relief,
    );
  }
}

function portico(out, base, along, span, depth, level, count) {
  const front = facade(base, along);
  const position = (x, inward) => {
    const [a, , b] = front.P(x, 0, -inward);
    return [a, b];
  };
  const half = span / 2;
  const form = (pad, fwd, back) => [
    position(-half - pad, -fwd),
    position(half + pad, -fwd),
    position(half + pad, depth + back),
    position(-half - pad, depth + back),
  ];
  extrude(out, 'footing', form(0.65, 1.31, 0.5), -1.25, 0.36, granite);
  if (level > 0) extrude(out, 'footing', form(0.46, 0.79, 0.5), 0.29, 0.72, granite);
  extrude(out, 'footing', form(0.22, 0.36, 0.5), 0.58, foot, granite);
  extrude(out, 'wall', form(0.23, 0.25, 0.48), cap, cornice - 0.37, limestone, { bottom: true });
  extrude(out, 'trim', form(0.65, 0.75, 0.51), cornice - 0.55, cornice + 0.03, trim);
  const across = Array.from(
    { length: count },
    (_, i) => -half + 0.85 + ((span - 1.7) * i) / (count - 1),
  );
  const rows = level === 0 ? [0.28] : [0.28, depth - 0.8];
  for (const y of rows) for (const x of across) column(out, position(x, y), level);
  if (level > 0 && count === 8)
    for (const x of [-half + 0.85, half - 0.85])
      for (const d of [depth * 0.35, depth * 0.62]) column(out, position(x, d), level);
  pediment(out, front, span + 0.71, cornice, 4.42, level);
  const ridge = [front.P(0, cornice + 4.37, 0), front.P(0, cornice + 4.37, -depth)];
  const eaves = [
    [front.P(-half - 0.33, cornice, 0), front.P(-half - 0.33, cornice, -depth)],
    [front.P(half + 0.33, cornice, 0), front.P(half + 0.33, cornice, -depth)],
  ];
  quad4(out, 'roof', eaves[0][0], ridge[0], ridge[1], eaves[0][1], roof);
  quad4(out, 'roof', ridge[0], eaves[1][0], eaves[1][1], ridge[1], roof);
  const entry = facade(position(0, depth - 0.01), along);
  portal(out, entry, 0, 4.1, level);
  if (level > 0) {
    for (const u of [-7.5, -4.5, 4.5, 7.5])
      framedWindow(out, entry, u, 2.44, 5.2, level, { width: 1.46 });
  }
}

function core(out, level) {
  const nave = [
    [-24.35, -17.7],
    [-14.9, -17.75],
    [53.9, -17.75],
    [53.9, 12.72],
    [-24.35, 13.43],
  ];
  const transept = [
    [-15.25, -28.03],
    [18.05, -27.33],
    [15.6, 19.0],
    [14.8, 30.75],
    [-13.57, 30.8],
  ];
  for (const ring of [nave, transept]) {
    extrude(out, 'footing', ring, -1.95, 0.91, granite);
    extrude(out, 'wall', ring, 0.89, 22.23, limestone);
  }
  const apse = mapped.walls.eastApse;
  extrude(out, 'footing', apse, -1.24, 0.88, granite);
  extrude(out, 'wall', apse, 0.88, 22.1, limestone);
  extrude(out, 'trim', apse, 21.45, 22.18, trim);
  gableRoof(out, 'roof', [-24.3, -2.16], [53.94, -2.16], 30.6, 22.1, 25.85, roof, {
    overhang: 0.28,
    endSlot: 'wall',
    endColor: limestone,
  });
  gableRoof(out, 'roof', [0.4, -27.5], [0.4, 28.97], 28.1, 22.12, 26.46, roof, {
    overhang: 0.17,
    endSlot: 'wall',
    endColor: limestone,
  });
  for (const [sign, z] of [
    [1, 13.0],
    [-1, -18.01],
  ]) {
    const f = facade([16, z], [sign, 0]);
    fbox(out, 'trim', f, -37, 37, 21.98, 22.54, 0.01, 0.54, trim);
  }
  for (const sign of [-1, 1]) {
    const f = facade([0, sign > 0 ? 13.38 : -17.79], [sign, 0]);
    for (const x of [sign * 22, sign * 28, sign * 34, sign * 39, sign * 46]) {
      framedWindow(out, f, x, 7.05, 7.06, level);
      if (level > 1) fbox(out, 'trim', f, x - 1.35, x + 1.35, 14.33, 14.72, 0.012, 0.27, trim);
    }
  }
  const eastZ = -3.73;
  for (const angle of [Math.PI * 0.76, Math.PI, Math.PI * 1.24]) {
    const [c, s] = [Math.cos(angle), Math.sin(angle)];
    const f = facade([-23.56 + c * 6.74, eastZ + s * 6.43], [s, -c]);
    framedWindow(out, f, 0, 7.29, 7.19, level, { d: 0.08, width: 1.66 });
  }
  portico(out, [0.58, 37.9], [1, 0], 27.1, 7.7, level, 8);
  portico(out, [1.5, -36.84], [-1, 0], 24.62, 9.3, level, 8);
  portico(out, [53.78, -2.84], [0, -1], 29.78, 8.06, level, 6);
}

function curveBand(out, shape, low, high, slot, color, level) {
  const count = level === 0 ? 4 : level === 1 ? 6 : 16;
  const points = Array.from({ length: count + 1 }, (_, i) => shape(i / count));
  extrude(
    out,
    slot,
    [...points.map(([a]) => a), ...points.map(([, b]) => b).reverse()],
    low,
    high,
    color,
    { bottom: low > 10 },
  );
}

function pavilion(out, ring, level) {
  // The outer mapped vertices fix the direction, length and width of the rectangular portals.
  const xs = ring.map(([x]) => x);
  const zs = ring.map(([, z]) => z);
  const low = [Math.min(...xs), Math.min(...zs)];
  const high = [Math.max(...xs), Math.max(...zs)];
  const cx = (low[0] + high[0]) / 2;
  const cz = (low[1] + high[1]) / 2;
  extrude(out, 'footing', ring, -1.9, foot, granite);
  extrude(out, 'wall', ring, cap, 18.94, limestone, { bottom: true });
  extrude(out, 'trim', ring, cornice - 0.33, cornice + 0.18, trim);
  extrude(out, 'trim', ring, 18.9, 19.32, trim);
  for (const [x, z] of [
    [low[0] + 2.5, low[1] + 2.7],
    [high[0] - 2.6, low[1] + 2.7],
    [high[0] - 2.6, high[1] - 2.5],
    [low[0] + 2.5, high[1] - 2.5],
  ]) {
    abox(out, 'wall', [x - 1.15, foot, z - 1.18], [x + 1.15, cap, z + 1.18], limestone);
    if (level > 0) column(out, [x, z + (z < cz ? 1.5 : -1.5)], level);
  }
  if (level === 0) return;
  const face = facade([cx, high[1] - 0.03], [1, 0]);
  band(out, face, Math.min(11.6, high[0] - low[0] - 4), 16.65, 18.32, 0.19, relief);
  if (level > 1) {
    for (let i = -4; i <= 4; i++) {
      const u = i * 0.92;
      fbox(out, 'trim', face, u - 0.25, u + 0.28, 16.94, 17.68 + (i % 3) * 0.14, 0.19, 0.29, trim);
    }
  }
}

function colonnade(out, wing, level) {
  const away = alongPath(wing.awayFromPlaza);
  const near = alongPath(wing.alongPlaza);
  const shape = (u) => [away(u), near(u)];
  curveBand(out, shape, -2.0, foot, 'footing', granite, level);
  curveBand(out, shape, cap, cornice - 0.37, 'wall', limestone, level);
  curveBand(out, shape, cornice - 0.38, cornice + 0.15, 'trim', trim, level);
  const parapet = (u) => {
    const [a, b] = shape(u);
    return [mix(a, b, 0.955), b];
  };
  curveBand(out, parapet, cornice + 0.14, cornice + 0.39, 'trim', trim, level);
  curveBand(out, parapet, cornice + 1.25, cornice + 1.52, 'trim', trim, level);
  const rows = level === 0 ? [0.8] : [0.08, 0.34, 0.64, 0.91];
  const count = level === 0 ? 10 : 12;
  for (let i = 0; i < count; i++) {
    const u = 0.025 + (0.935 * i) / (count - 1);
    const [a, b] = shape(u);
    for (const t of rows) column(out, mix(a, b, t), level);
  }
  if (level > 1) {
    const n = level === 3 ? 54 : 34;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const [a, b] = shape(u);
      const [x, z] = mix(a, b, 0.98);
      abox(
        out,
        'trim',
        [x - 0.118, cornice + 0.38, z - 0.118],
        [x + 0.118, cornice + 1.26, z + 0.118],
        trim,
      );
    }
  }
  pavilion(out, wing.terminalOutline, level);
}

function dome(out, level) {
  const center = [0.42, -0.45];
  const s = [8, 12, 26, 48][level];
  const ring = (y, r) => [y, r, r];
  abox(out, 'wall', [-14.19, 24.26, -14.76], [14.9, 28.68, 13.48], limestone);
  abox(out, 'trim', [-14.85, 28.34, -15.42], [15.55, 29.08, 14.14], trim);
  lathe(
    out,
    'wall',
    center,
    [
      [28.9, 11.9, 11.9],
      [32.78, 11.9, 11.9],
      [34.18, 9.51, 9.51],
    ],
    s,
    limestone,
    { capTop: false },
  );
  lathe(out, 'trim', center, [ring(33.93, 9.72), ring(34.48, 9.72), ring(34.76, 9.35)], s, trim, {
    capTop: false,
  });
  lathe(out, 'wall', center, [ring(34.72, 9.12), ring(47.47, 9.12)], s, limestone, {
    capTop: false,
  });
  lathe(
    out,
    'trim',
    center,
    [ring(46.42, 9.26), ring(47.73, 9.57), ring(48.47, 9.67), ring(48.86, 9.02)],
    s,
    trim,
    { capTop: false },
  );
  const shell = [
    ring(48.82, 8.55),
    ring(52.2, 8.53),
    ring(56.05, 7.03),
    ring(59.05, 5.08),
    ring(61.48, 3.15),
    ring(62.72, 1.78),
    ring(63.27, 1.42),
  ];
  lathe(
    out,
    'roof',
    center,
    level === 0 ? [shell[0], shell[2], shell[4], shell[6]] : shell,
    s,
    copper,
  );
  lathe(out, 'trim', center, [ring(62.9, 1.51), ring(64.05, 1.48), ring(65.96, 1.02)], s, trim, {
    capTop: false,
  });
  lathe(out, 'roof', center, [ring(65.91, 1.23), ring(66.41, 0.98), ring(67.13, 0.28)], s, copper);
  lathe(
    out,
    'fittings',
    center,
    [ring(67.02, 0.29), ring(67.29, 0.51), ring(67.78, 0.54), ring(68.13, 0.13)],
    s,
    gold,
  );
  abox(
    out,
    'fittings',
    [center[0] - 0.135, 68.0, center[1] - 0.13],
    [center[0] + 0.135, 71.5, center[1] + 0.13],
    gold,
  );
  abox(
    out,
    'fittings',
    [center[0] - 1.02, 69.82, center[1] - 0.14],
    [center[0] + 1.02, 70.05, center[1] + 0.14],
    gold,
  );
  const n = level === 0 ? 8 : 16;
  for (let i = 0; i < n; i++) {
    const radians = (2 * Math.PI * i) / n;
    const [c, d] = [Math.cos(radians), Math.sin(radians)];
    const f = facade([center[0] + c * 9.18, center[1] + d * 9.18], [d, -c]);
    framedWindow(out, f, 0, 37.06, 7.95, level, { width: 1.67, d: 0.08 });
    if (level > 0) {
      for (const u of [-1.18, 1.18]) {
        fbox(out, 'trim', f, u - 0.13, u + 0.13, 35.86, 46.05, -0.05, 0.33, trim);
        if (level > 1) fbox(out, 'trim', f, u - 0.23, u + 0.23, 45.74, 46.09, 0.01, 0.42, trim);
      }
      fbox(out, 'trim', f, -1.01, 1.01, 45.43, 45.76, 0.012, 0.33, trim);
    }
  }
}

function coarseDome(out) {
  const center = [0.42, -0.45];
  lathe(
    out,
    'wall',
    center,
    [
      [25.7, 12.2, 12.2],
      [32.9, 11.9, 11.9],
      [34.35, 9.24, 9.24],
      [48.7, 9.28, 9.28],
    ],
    10,
    limestone,
    { capTop: false },
  );
  lathe(
    out,
    'roof',
    center,
    [
      [48.73, 8.55, 8.55],
      [53.2, 8.1, 8.1],
      [58.9, 5.16, 5.16],
      [63.27, 1.44, 1.44],
      [67.52, 0.62, 0.62],
    ],
    10,
    copper,
  );
  abox(out, 'fittings', [0.29, 67.48, -0.58], [0.55, 71.5, -0.32], gold);
  abox(out, 'fittings', [-0.6, 69.82, -0.59], [1.44, 70.05, -0.31], gold);
}

function coarseModel(out) {
  abox(out, 'wall', [-24.35, -1.0, -17.7], [53.9, 22.25, 12.72], limestone);
  abox(out, 'wall', [-14.2, -1.05, -28.0], [16.1, 22.21, 30.7], limestone);
  extrude(
    out,
    'wall',
    mapped.walls.eastApse.filter((_, i) => i % 3 === 0),
    -0.6,
    22.1,
    limestone,
  );
  gableRoof(out, 'roof', [-24.3, -2.16], [53.94, -2.16], 30.6, 22.1, 25.85, roof, {
    overhang: 0.26,
    endSlot: 'wall',
    endColor: limestone,
  });
  for (const [base, along, half, depth] of [
    [[0.58, 37.9], [1, 0], 13.55, 7.7],
    [[1.5, -36.84], [-1, 0], 12.31, 9.3],
    [[53.78, -2.84], [0, -1], 14.89, 7.3],
  ]) {
    const f = facade(base, along);
    const points = [
      f.P(-half, 0, 0),
      f.P(half, 0, 0),
      f.P(half, 0, -depth),
      f.P(-half, 0, -depth),
    ].map(([x, , z]) => [x, z]);
    extrude(out, 'wall', points, cap, cornice, limestone);
    for (let i = 0; i < 6; i++) {
      const [x, , z] = f.P(-half + 1.1 + ((2 * half - 2.2) * i) / 5, 0, -0.25);
      column(out, [x, z], 0);
    }
    pediment(out, f, 2 * half, cornice, 4.42, 0);
  }
  for (const wing of mapped.colonnades) {
    const a = alongPath(wing.awayFromPlaza);
    const b = alongPath(wing.alongPlaza);
    const shape = (u) => [a(u), b(u)];
    curveBand(out, shape, cap, cornice + 0.35, 'trim', trim, 0);
    for (let i = 0; i < 10; i++) {
      const [left, right] = shape(0.026 + i * 0.102);
      column(out, mix(left, right, 0.89), 0);
    }
    const ring = wing.terminalOutline;
    extrude(out, 'wall', ring, cap, 18.94, limestone);
    for (const [x, z] of [ring[2], ring[4]])
      abox(out, 'wall', [x - 0.9, foot, z - 0.9], [x + 0.9, cap, z + 0.9], limestone);
  }
  coarseDome(out);
}

function build(out, level) {
  core(out, level);
  for (const wing of mapped.colonnades) colonnade(out, wing, level);
  dome(out, level);
}

export const skyline = coarseModel;
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'kazan-cathedral-saint-petersburg-model.mjs';
const camera = [104, 70, 163];
const lookAt = [0, 25, 22];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'cathedral',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The monumental limestone cathedral, with the two open sweeping colonnades, three classical porticoes and the tall cupola.',
  camera,
  lookAt,
  sunDirection: [55, 45, 52],
  mediumFiContext: {
    scale: 0.82,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.94,
    basis: 'The exact mapped outline of the cathedral envelope and both colonnades.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'polygon-triangulation.mjs',
    'authored-structure-mesh.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'west-pavilion-and-curving-wings', position: camera, lookAt },
    { name: 'nevsky-prospekt-and-north-portico', position: [-42, 22, 145], lookAt: [0, 22, 36] },
    { name: 'east-apse-south-and-dome', position: [-103, 62, -83], lookAt: [0, 27, 11] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kazan-cathedral-saint-petersburg-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 3.7,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.4, surfaces },
      street: { export: 'street', errorMeters: 0.6, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.16, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model using Rijksmuseum public-domain photographs, an original Library of Congress color print, published measurements, native place mapping and open bare-earth elevation data.',
};
