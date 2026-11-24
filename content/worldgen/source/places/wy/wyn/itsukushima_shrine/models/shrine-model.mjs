import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };
import { buildGreatTorii, toriiSurfaces } from './great-torii.mjs';

export const surfaces = {
  ...toriiSurfaces,
  deck: { slot: 'foundation', graph: 'wood_plain', roughness: 0.88 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
};

const red = rgb('d6512d');
const darkRed = rgb('a54228');
const natural = rgb('92714e');
const wood = rgb('987a53');
const pale = rgb('e2d8b7');
const teal = rgb('69877c');
const bronze = rgb('665e45');
const roof = rgb('51463a');
const eave = rgb('40362e');
const gray = rgb('8d8b79');
const platformY = 1.92;
const bed = -1.55;
const axes = [
  [-1, -1],
  [-1, 1],
  [1, 1],
  [1, -1],
];
const yaw = (-47 * Math.PI) / 180;
const cos = Math.cos(yaw),
  sin = Math.sin(yaw);
const sitePoint = (x, y, z) => [x * cos - z * sin, y, x * sin + z * cos];
const mapPlane = ([x, z]) => [x * cos + z * sin, -x * sin + z * cos];

function block(out, slot, at, x, y, z, width, height, depth, color) {
  loft(
    out,
    slot,
    [y, y + height].map((v) =>
      axes.map(([a, b]) => at(x + (a * width) / 2, v, z + (b * depth) / 2)),
    ),
    color,
  );
}

function face(out, slot, points, color) {
  const [a, b, c, d] = points;
  for (const triangle of d
    ? [
        [a, b, c],
        [a, c, d],
      ]
    : [[a, b, c]]) {
    const n = normalFor(...triangle);
    if (Math.hypot(...n) > 0.9) out.addTriangle(slot, '', triangle, n, [], color);
  }
}

function transform(x, z, angle = 0) {
  const a = Math.cos(angle),
    b = Math.sin(angle);
  return (u, y, v) => sitePoint(x + u * a - v * b, y, z + u * b + v * a);
}

function projectHall(outline, angle) {
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const ring = outline.map(mapPlane).map(([x, z]) => [x * cos + z * sin, -x * sin + z * cos]);
  const range = (i) => [Math.min(...ring.map((p) => p[i])), Math.max(...ring.map((p) => p[i]))];
  const [a, b] = range(0),
    [c, d] = range(1);
  const x = (a + b) / 2,
    z = (c + d) / 2;
  return {
    at: transform(x * cos - z * sin, x * sin + z * cos, angle),
    length: b - a,
    depth: d - c,
  };
}

function frameAcross(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  return {
    at: transform((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(dz, dx)),
    length: Math.hypot(dx, dz),
  };
}

function barkRoof(out, at, length, width, bottom, rise, detail, options = {}) {
  const { hip = 0, offset = 0, accent = false } = options;
  const cross = detail < 2 ? [0, 0.46, 1] : [0, 0.17, 0.35, 0.57, 0.79, 1];
  const half = length / 2;
  const edge = (hand, end, t, underside = false) => {
    const w = width * (0.5 + offset * hand);
    const x = end * (half - hip * (1 - t));
    const lift = (detail < 2 ? 0.09 : 0.19) * Math.pow(Math.abs(x) / half, 4);
    const ridge = rise * Math.pow(1 - t, 1.29);
    return at(x, bottom + ridge + lift - (underside ? 0.19 : 0), hand * w * t);
  };
  for (const side of [-1, 1]) {
    for (let i = 1; i < cross.length; i++) {
      const t = cross[i - 1],
        u = cross[i];
      const ps = [edge(side, -1, t), edge(side, 1, t), edge(side, 1, u), edge(side, -1, u)];
      face(out, 'barkRoof', side === 1 ? ps.reverse() : ps, roof);
    }
    const e = [
      edge(side, -1, 1),
      edge(side, 1, 1),
      edge(side, 1, 1, true),
      edge(side, -1, 1, true),
    ];
    face(out, 'barkRoof', side === 1 ? e.reverse() : e, eave);
    for (const end of [-1, 1]) {
      for (let i = 1; i < cross.length; i++) {
        const t = cross[i - 1],
          u = cross[i];
        const top = edge(side, end, t),
          tip = edge(side, end, u);
        // Hip slopes terminate below the ridge. Gable ends instead receive timber bargeboards.
        const a = hip
          ? at(end * half, bottom + 0.19, side * width * (0.5 + offset * side) * t)
          : edge(side, end, t, true);
        const b = hip
          ? at(end * half, bottom + 0.19, side * width * (0.5 + offset * side) * u)
          : edge(side, end, u, true);
        const ps = [top, a, b, tip];
        if (Math.hypot(...tip.map((n, j) => n - b[j])) < 1e-6) ps.splice(2, 1);
        face(out, 'barkRoof', side * end === 1 ? ps.reverse() : ps, hip ? roof : eave);
        if (detail >= 2 && accent && !hip) beam(out, 'vermilion', top, tip, 0.085, 0.14, darkRed);
      }
    }
  }
  face(
    out,
    'barkRoof',
    [edge(-1, -1, 1, true), edge(-1, 1, 1, true), edge(1, 1, 1, true), edge(1, -1, 1, true)],
    eave,
  );
  const ends = [-1, 1].map((end) => edge(1, end, 0));
  beam(out, 'barkRoof', ...ends, detail < 2 ? 0.25 : 0.31, 0.22, eave);
  if (detail >= 2 && accent) {
    for (const end of [-1, 1]) {
      const a = edge(1, end, 0);
      const b = at(end * (half - hip + 0.27), bottom + rise + 0.26, 0);
      beam(out, 'barkRoof', a, b, 0.33, 0.26, eave);
    }
  }
}

function lantern(out, at, x, y, z) {
  block(out, 'gilt', at, x, y + 0.19, z, 0.061, 0.38, 0.061, bronze);
  block(out, 'gilt', at, x, y + 0.14, z, 0.48, 0.12, 0.4, bronze);
  block(out, 'deck', at, x, y - 0.16, z, 0.31, 0.31, 0.29, pale);
  block(out, 'gilt', at, x, y - 0.24, z, 0.39, 0.084, 0.36, bronze);
}

function support(out, at, x, z, width, y, stone) {
  if (stone) {
    block(out, 'stone', at, x, bed, z, width * 1.23, y - bed, width * 1.23, gray);
  } else {
    block(out, 'deck', at, x, bed, z, width, y - bed, width, wood);
  }
}

function lowPost(out, at, x, z, y, height, width, color, detail) {
  if (detail === 1) {
    block(out, 'vermilion', at, x, y, z, width, height, width, color);
    return;
  }
  const p = [
    at(x - width / 2, y, z - width / 2),
    at(x + width / 2, y, z + width / 2),
    at(x + width / 2, y + height, z + width / 2),
    at(x - width / 2, y + height, z - width / 2),
  ];
  face(out, 'vermilion', p, color);
  face(out, 'vermilion', p.reverse(), color);
}

function distantPavilion(out, at, length, width, height, rise, floor, detail, opts = {}) {
  const { closed = false, timber = false, roofed = true } = opts;
  const trim = timber ? natural : red;
  const top = floor + height,
    x = length / 2,
    z = width / 2;
  if (roofed) {
    for (const side of [-1, 1]) {
      const p = [
        at(-x, top + rise, 0),
        at(x, top + rise, 0),
        at(x, top, side * z),
        at(-x, top, side * z),
      ];
      face(out, 'barkRoof', side === 1 ? p.reverse() : p, roof);
      const triangle = (end) => [
        at(end * x, top, -z),
        at(end * x, top + rise, 0),
        at(end * x, top, z),
      ];
      face(out, 'barkRoof', side === 1 ? triangle(side) : triangle(side).reverse(), eave);
    }
  }
  const lx = x * (roofed ? 0.9 : 1),
    lz = z * (roofed ? 0.75 : 1);
  if (detail === 1) block(out, 'deck', at, 0, floor - 0.21, 0, lx * 2, 0.21, lz * 2, wood);
  else
    face(
      out,
      'deck',
      [at(-lx, floor, -lz), at(-lx, floor, lz), at(lx, floor, lz), at(lx, floor, -lz)],
      wood,
    );
  if (closed) {
    block(out, 'vermilion', at, 0, floor, 0, lx * 1.78, height, lz * 1.67, trim);
    return;
  }
  if (!roofed && length < 5) return;
  const count = detail === 0 ? 1 : Math.max(1, Math.ceil(length / 15));
  for (let i = 0; i <= count; i++) {
    const u = (i / count - 0.5) * lx * 1.8;
    const columns = detail === 0 ? [(i === 0 ? -1 : 1) * lz * 0.88] : [-lz * 0.88, lz * 0.88];
    for (const v of columns)
      lowPost(out, at, u, v, -0.75, top + 0.75, roofed ? 0.26 : 0.24, trim, detail);
  }
}

function rail(out, at, [a, b], [c, d], y, detail, color) {
  const length = Math.hypot(c - a, d - b);
  const ends = (v) => [at(a, v, b), at(c, v, d)];
  beam(out, 'vermilion', ...ends(y + 0.86), 0.1, 0.115, color);
  if (detail >= 2) beam(out, 'vermilion', ...ends(y + 0.37), 0.07, 0.072, color);
  const intervals = Math.max(1, Math.ceil(length / (detail >= 3 ? 1.52 : 3.2)));
  for (let j = 0; j <= intervals; j++) {
    const t = j / intervals,
      x = a + (c - a) * t,
      z = b + (d - b) * t;
    block(out, 'vermilion', at, x, y, z, 0.107, 0.92, 0.107, color);
  }
}

function bridgeDeck(out, at, length, width, detail, opts = {}) {
  const { stone = false, floor = platformY, open = false, railEnds = false, timber = false } = opts;
  const trim = timber ? natural : red;
  block(out, 'deck', at, 0, floor - 0.27, 0, length, 0.27, width, wood);
  const spans = detail === 0 ? 1 : Math.max(1, Math.ceil(length / (detail === 1 ? 8 : 3.82)));
  for (let i = 0; i <= spans; i++) {
    const x = (length - 0.4) * (i / spans - 0.5);
    for (const z of [-width * 0.37, width * 0.37])
      support(out, at, x, z, 0.28, floor - 0.14, stone);
    if (detail >= 2)
      beam(
        out,
        'deck',
        at(x, floor - 0.45, -width * 0.43),
        at(x, floor - 0.45, width * 0.43),
        0.16,
        0.21,
        natural,
      );
  }
  if (open && detail >= 1) {
    for (const z of [-width * 0.46, width * 0.46])
      rail(out, at, [-length * 0.48, z], [length * 0.48, z], floor, detail, trim);
    if (railEnds)
      for (const x of [-length * 0.48, length * 0.48])
        rail(out, at, [x, -width * 0.46], [x, width * 0.46], floor, detail, trim);
  }
}

function coveredWalk(out, a, b, width, detail, options = {}) {
  const { timber = false, height = 2.9, hip = 0.67 } = options;
  const { at, length } = frameAcross(a, b);
  const w = width * 0.66,
    color = timber ? natural : red;
  const top = platformY + height;
  bridgeDeck(out, at, length, w, detail, { timber });
  const n = detail === 0 ? 1 : Math.max(1, Math.ceil(length / (detail === 1 ? 6.8 : 3.25)));
  for (let i = 0; i <= n; i++) {
    const x = (length - 0.34) * (i / n - 0.5);
    for (const z of [-w * 0.45, w * 0.45]) {
      block(out, 'vermilion', at, x, platformY - 0.03, z, 0.24, height + 0.17, 0.25, color);
      if (detail >= 2) {
        block(out, 'vermilion', at, x, top - 0.31, z, 0.37, 0.16, 0.43, color);
        block(out, 'vermilion', at, x, top - 0.13, z, 0.55, 0.16, 0.48, color);
      }
    }
    if (detail >= 3 && i < n && i % 2 === 0 && !timber)
      lantern(out, at, x + (length - 0.34) / (n * 2), top - 0.94, -w * 0.44);
  }
  for (const z of [-w * 0.45, w * 0.45]) {
    if (detail === 0) continue;
    block(out, 'vermilion', at, 0, top - 0.36, z, length, 0.21, 0.22, color);
    if (detail >= 2) block(out, 'vermilion', at, 0, platformY + 0.61, z, length, 0.1, 0.095, color);
  }
  barkRoof(out, at, length + 0.28, width, top, width * 0.275, detail, { hip, accent: !timber });
}

function gabledHall(out, at, length, width, family, detail) {
  const timber = family.startsWith('natural');
  const main = family === 'main';
  const closed = main || family === 'small' || family === 'natural' || family === 'gate';
  const trim = timber ? natural : red;
  const height = main ? 4.1 : family === 'small' ? 2.65 : 3.32;
  const header = platformY + height;
  const body = (u, y, v) => at(u, y, v);
  const lx = length * 0.81,
    lz = width * 0.69;
  bridgeDeck(out, at, lx * 1.08, lz * 1.14, detail, { timber });
  if (closed) {
    // The wooden enclosure is set within the outer colonnade.
    block(
      out,
      'deck',
      body,
      0,
      platformY,
      0.052 * lz,
      lx * 0.926,
      height - 0.16,
      lz * 0.79,
      timber ? natural : pale,
    );
  }
  const count = detail < 1 ? 1 : Math.max(2, Math.ceil(lx / (main ? 3.7 : 3.19)));
  for (const side of [-1, 1]) {
    const z = side * lz * 0.47;
    for (let i = 0; i <= count; i++) {
      const x = (i / count - 0.5) * lx;
      block(
        out,
        'vermilion',
        at,
        x,
        platformY,
        z,
        main ? 0.42 : 0.26,
        height + 0.14,
        main ? 0.42 : 0.27,
        trim,
      );
      if (detail >= 2) {
        block(out, 'vermilion', at, x, header - 0.45, z, 0.58, 0.18, 0.52, trim);
        if (detail >= 3) block(out, 'vermilion', at, x, header - 0.18, z, 0.69, 0.21, 0.64, trim);
      }
      if (i === count || detail < 1 || !closed) continue;
      const cx = x + lx / count / 2,
        windowZ = (side * 0.398 + 0.052) * lz;
      const panel = main ? teal : timber ? wood : darkRed;
      const h = main ? height * 0.74 : height * 0.63,
        w = (lx / count) * 0.73;
      block(out, 'vermilion', at, cx, platformY + 0.12, windowZ, w, h, 0.07, panel);
      if (main && detail >= 2) {
        for (const offset of [-0.27, 0, 0.27])
          block(
            out,
            'vermilion',
            at,
            cx + w * offset,
            platformY + 0.17,
            windowZ + side * 0.045,
            0.062,
            h * 0.96,
            0.047,
            trim,
          );
        for (const y of [0.33, 0.69])
          block(
            out,
            'vermilion',
            at,
            cx,
            platformY + 0.13 + h * y,
            windowZ + side * 0.044,
            w,
            0.055,
            0.046,
            trim,
          );
      }
    }
    if (detail >= 1) block(out, 'vermilion', at, 0, header - 0.27, z, lx + 0.31, 0.24, 0.32, trim);
  }
  if (family === 'natural-stage') {
    block(out, 'deck', at, 0, platformY, 0.37 * lz, lx * 0.94, height - 0.41, 0.19, natural);
  }
  if (main && detail >= 1) {
    for (const x of [-lx / 2, lx / 2])
      block(out, 'vermilion', at, x, header - 0.27, 0, 0.33, 0.24, lz, trim);
  }
  barkRoof(out, at, length, width, header, width * (main ? 0.263 : 0.28), detail, {
    offset: main ? -0.07 : 0,
    hip: family === 'gate' ? 0.92 : 0,
    accent: main || timber,
  });
  // The main shrine gable ends have a finished tympanum rather than an open loft.
  if (main) {
    for (const side of [-1, 1]) {
      const x = side * length * 0.48;
      const triangle = [
        at(x, header - 0.04, -width * 0.42),
        at(x, header + width * 0.253, 0),
        at(x, header - 0.04, width * 0.42),
      ];
      face(out, 'deck', side === 1 ? triangle : triangle.reverse(), darkRed);
    }
  }
}

function onMap(out, building, detail) {
  const { id, outline, family } = building;
  const yawByPart = {
    1306168433: 0.107,
    419842998: 0.098,
    142668880: 0.025,
    1306168436: -0.041,
    142668935: -0.017,
    1306168435: 0.67,
    1306168432: 0.107,
  };
  const { at, length, depth } = projectHall(outline, yawByPart[id] ?? 0);
  if (family === 'platform') {
    bridgeDeck(out, at, length, depth, detail, { floor: platformY + 1, open: true });
    if (detail >= 2)
      for (const z of [-depth / 2, depth / 2]) {
        for (let i = 0; i < 4; i++)
          block(
            out,
            'vermilion',
            at,
            0,
            platformY,
            z + Math.sign(z) * (0.63 - i * 0.19),
            2.11,
            (i + 1) * 0.25,
            0.21,
            red,
          );
      }
    return;
  }
  if (id === 142668949 || id === 419842998) {
    // The worship halls retain their three parallel ridges and through-approach.
    for (const wing of [-1, 0, 1]) {
      const z = wing * depth * 0.317;
      const atWing = (u, y, v) => at(u, y, v + z);
      gabledHall(out, atWing, length * (wing === 0 ? 1 : 0.975), depth * 0.364, 'open', detail);
    }
    return;
  }
  if (family.endsWith('corridor')) {
    gabledHall(
      out,
      at,
      length,
      depth,
      family === 'natural-corridor' ? 'natural-stage' : 'open',
      detail,
    );
    return;
  }
  gabledHall(out, at, length, depth, family, detail);
}

function distantHall(out, { id, family, outline }, detail) {
  const yawByPart = { 1306168433: 0.107, 419842998: 0.098, 1306168435: 0.67, 1306168432: 0.107 };
  const { at, length, depth } = projectHall(outline, yawByPart[id] ?? 0);
  const timber = family.startsWith('natural');
  const closed = ['main', 'natural', 'small', 'gate'].includes(family);
  if (family === 'platform') {
    distantPavilion(out, at, length, depth, 0.7, 0, platformY + 1, detail, { roofed: false });
    return;
  }
  if ((id === 142668949 || id === 419842998) && detail === 1) {
    for (const wing of [-1, 0, 1])
      distantPavilion(
        out,
        (u, y, v) => at(u, y, v + wing * depth * 0.317),
        length,
        depth * 0.367,
        3.32,
        depth * 0.102,
        platformY,
        detail,
      );
    return;
  }
  const height = family === 'main' ? 4.1 : family === 'small' ? 2.65 : 3.32;
  distantPavilion(out, at, length, depth, height, depth * 0.267, platformY, detail, {
    closed,
    timber,
  });
}

// Ridge runs run through the mapped roof polygons. Widths are measured to the eaves.
const coveredRuns = [
  [[-10.6, -34.6], [-25.2, -34.7], 8.5],
  [[-25.2, -34.9], [-25.1, -7.9], 7.4],
  [[-24.5, -8.35], [-68.2, -8.3], 7.6],
  [[-68.4, -8.3], [-68.9, -33], 8.25],
  [[-68.9, -32.9], [-115.45, -31.85], 7.12],
  [[9.0, -34.7], [24.95, -34.6], 8.0],
  [[24.25, -34.6], [23.7, -8.9], 10.4],
  [[23.25, -8.9], [49.1, -8.5], 7.82],
  [[48.35, -8.6], [49.4, -31.3], 7.2],
];

function soribashi(out, detail) {
  const path = site.paths.find((p) => p.id === 142668842).points.map(mapPlane);
  const { at, length } = frameAcross(path[0], path[1]);
  const n = detail === 0 ? 5 : detail === 1 ? 9 : 20;
  const rings = [],
    width = 3.35;
  const rise = (x) => platformY - 0.42 + 2.47 * (1 - ((2 * x) / length) * ((2 * x) / length));
  for (let i = 0; i <= n; i++) {
    const x = length * (i / n - 0.5),
      y = rise(x);
    rings.push(
      [
        [y - 0.32, -width / 2],
        [y, -width / 2],
        [y, width / 2],
        [y - 0.32, width / 2],
      ].map(([u, v]) => at(x, u, v)),
    );
  }
  loft(out, 'deck', rings, wood);
  if (detail === 0) return;
  for (const side of [-1, 1]) {
    const z = side * (width / 2 - 0.1);
    for (let i = 0; i < n; i++) {
      const a = length * (i / n - 0.5),
        b = length * ((i + 1) / n - 0.5);
      beam(
        out,
        'vermilion',
        at(a, rise(a) + 0.83, z),
        at(b, rise(b) + 0.83, z),
        0.14,
        0.17,
        natural,
      );
      if (detail >= 2 && i % 2 === 0)
        block(out, 'vermilion', at, a, rise(a) - 0.05, z, 0.17, 0.95, 0.17, natural);
    }
    if (detail >= 1)
      for (const x of [-length * 0.47, -length * 0.29, length * 0.29, length * 0.47])
        support(out, at, x, z, 0.46, rise(x) - 0.29, false);
  }
}

function broadStage(out, detail, simplified) {
  for (const [a, b, w, rail] of [
    [[-22.1, -60.35], [22.8, -60.1], 5.45, false],
    [[-19.5, -57.65], [-19.25, -39.5], 3.65, true],
    [[16.3, -57.6], [15.9, -39.35], 3.61, true],
    [[0.09, -62.6], [0.09, -80], 3.55, true],
    [[-25.88, 7.45], [-27.15, 28.0], 2.56, true],
    [[-32.1, 6.33], [-42.2, 8.8], 2.15, true],
    [[57.09, -71.05], [53, -68.5], 2.76, true],
    [[53, -68.5], [52.1, -57.4], 3.4, true],
  ]) {
    const { at, length } = frameAcross(a, b);
    if (simplified) distantPavilion(out, at, length, w, 0, 0, platformY, detail, { roofed: false });
    else bridgeDeck(out, at, length, w, detail, { stone: true, open: rail });
  }
  // The central dance stage joins the broad deck without covering the water around it.
  const { at, length } = frameAcross([0.05, -48.1], [0.05, -58.85]);
  if (simplified) distantPavilion(out, at, length, 8.2, 0, 0, platformY, detail, { roofed: false });
  else bridgeDeck(out, at, length, 8.2, detail, { stone: true });
  if (detail >= 2) {
    for (const side of [-1, 1]) lantern(out, sitePoint, side * 2.12, platformY + 1.49, -78.82);
  }
}

function build(out, detail) {
  buildGreatTorii(out, site.torii, detail);
  for (const building of site.buildings) {
    if ([555763409, 142668851, 142668855].includes(building.id)) continue;
    if (detail < 2) distantHall(out, building, detail);
    else onMap(out, building, detail === 2 ? 1 : detail);
  }
  for (const [a, b, width] of coveredRuns) {
    if (detail < 2) {
      const { at, length } = frameAcross(a, b);
      distantPavilion(out, at, length + 0.28, width, 2.9, width * 0.275, platformY, detail);
    } else {
      coveredWalk(out, a, b, width, detail === 2 ? 1 : detail);
    }
  }
  broadStage(out, detail === 2 ? 1 : detail, detail < 2);
  soribashi(out, detail === 2 ? 1 : detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
