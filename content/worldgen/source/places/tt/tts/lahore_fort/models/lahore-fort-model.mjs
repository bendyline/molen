/** Lahore Fort with the outer ramparts and the principal courts on the original site terrain. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { features, geometry } = read('map-frame.json');
const field = read('terrain-grid.json');
const points = new Map(features.map(({ id, points }) => [Number(id.slice(4)), points]));
const palette = 'palette:#ffffff';
const up = [0, 1, 0];
const tau = 2 * Math.PI;
const colors = Object.fromEntries(
  Object.entries({
    kiln: '986653',
    rough: '84594c',
    masonry: 'a58269',
    brickShadow: '6f5144',
    peach: 'c49d7f',
    pale: 'd4b895',
    trim: 'ad896d',
    light: 'dfc7a2',
    albite: 'ddd0b4',
    ivory: 'e7d8b7',
    bronze: '917552',
    bronzeDark: '584632',
    wood: '584336',
    shadow: '533f35',
    teal: '5b7970',
    blue: '5a6b7a',
    mustard: 'b39358',
    red: '9c6155',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.94, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.93, metallic: 0 },
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.89, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
  glaze: { slot: 'trim', graph: 'brick_glazed', roughness: 0.81, metallic: 0.03 },
  shade: { slot: 'window', localRef: palette, roughness: 0.9, metallic: 0 },
};
const mix = (a, b, t) => a + (b - a) * t;
const dxz = ([x, z], [u, v]) => Math.hypot(u - x, v - z);
const shape = (id) => points.get(id).slice(0, -1);
const mean = (ring) =>
  [0, 1].map((axis) => ring.reduce((sum, p) => sum + p[axis], 0) / ring.length);
const average = (ring) => ring.reduce((sum, p) => sum + ground(...p), 0) / ring.length;

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters;
  const v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = field.heightsMeters[j];
  const b = field.heightsMeters[j + 1];
  return (
    mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function face(out, slot, p, n, c) {
  if (p.length === 4) quad(out, slot, p, n, c);
  else out.addConvexPolygon(slot, palette, p, n, ([x, y, z]) => [x + z, y], c);
}

function roofFace(out, slot, p, c) {
  const n = normalFor(...p);
  face(out, slot, p, n[1] < 0 ? n.map((v) => -v) : n, c);
}

function cap(out, slot, ring, holes, y, c) {
  const base = new MeshBufferBuilder();
  if (
    !base.addCap(
      slot,
      palette,
      ring,
      holes,
      () => y,
      up,
      (p) => p,
      c,
    )
  )
    throw Error('Invalid Lahore Fort roof ring');
  const mesh = base.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const p = Array.from(mesh.indices.slice(i, i + 3), (j) =>
      Array.from(mesh.positions.slice(j * 3, j * 3 + 3)),
    );
    out.addTriangle(
      slot,
      palette,
      p,
      up,
      p.map(([x, , z]) => [x, z]),
      c,
    );
  }
}

function axes([x, z], [nx, nz]) {
  return {
    point: (u, y, v) => [x + nz * u + nx * v, y, z - nx * u + nz * v],
    vector: ([u, y, v]) => [nz * u + nx * v, y, -nx * u + nz * v],
  };
}

function oriented(out, frame) {
  return {
    addQuad(slot, ref, p, n, uv, c) {
      out.addQuad(
        slot,
        ref,
        p.map((v) => frame.point(...v)),
        frame.vector(n),
        uv,
        c,
      );
    },
    addTriangle(slot, ref, p, n, uv, c) {
      out.addTriangle(
        slot,
        ref,
        p.map((v) => frame.point(...v)),
        frame.vector(n),
        uv,
        c,
      );
    },
    addConvexPolygon(slot, ref, p, n, uvOf, c) {
      out.addConvexPolygon(
        slot,
        ref,
        p.map((v) => frame.point(...v)),
        frame.vector(n),
        uvOf,
        c,
      );
    },
  };
}

function insetArch(out, slot, x, z, bottom, width, height, c, lod) {
  const segments = [3, 5, 8, 12][lod];
  const half = width / 2;
  const spring = bottom + height * 0.61;
  const n = [0, 0, 1];
  face(
    out,
    slot,
    [
      [x - half, bottom, z],
      [x + half, bottom, z],
      [x + half, spring, z],
      [x - half, spring, z],
    ],
    n,
    c,
  );
  const start = [x - half, spring, z],
    center = [x, spring, z];
  let last = start;
  for (let i = 1; i <= segments; i++) {
    const v = -1 + (2 * i) / segments;
    const next = [x + half * v, spring + height * 0.39 * Math.pow(1 - Math.abs(v), 0.74), z];
    face(out, slot, [center, last, next], n, c);
    last = next;
  }
}

function framedArch(
  out,
  x,
  z,
  bottom,
  width,
  height,
  lod,
  border = colors.trim,
  dark = colors.shadow,
) {
  insetArch(out, 'trim', x, z, bottom - 0.09, width + 0.3, height + 0.24, border, lod);
  insetArch(out, 'shade', x, z + 0.026, bottom, width, height, dark, lod);
}

function upright(out, slot, x, z, width, depth, lo, hi, c) {
  box(out, slot, [x - width / 2, lo, z - depth / 2], [x + width / 2, hi, z + depth / 2], c);
}

function segmentDistance(p, a, b) {
  const [x, z] = a;
  const u = b[0] - x,
    v = b[1] - z;
  const t = Math.max(0, Math.min(1, ((p[0] - x) * u + (p[1] - z) * v) / (u * u + v * v)));
  return dxz(p, [x + u * t, z + v * t]);
}

function simplify(line, tolerance) {
  if (line.length <= 2 || tolerance === 0) return line;
  const a = line[0],
    b = line.at(-1);
  let far = tolerance,
    split = -1;
  for (let i = 1; i < line.length - 1; i++) {
    const distance = segmentDistance(line[i], a, b);
    if (distance > far) {
      far = distance;
      split = i;
    }
  }
  return split < 0
    ? [a, b]
    : [
        ...simplify(line.slice(0, split + 1), tolerance).slice(0, -1),
        ...simplify(line.slice(split), tolerance),
      ];
}

function wallPanel(out, slot, p, normal, tint) {
  for (const triangle of [
    [p[0], p[1], p[2]],
    [p[0], p[2], p[3]],
  ])
    face(out, slot, triangle, normal, tint);
}

function wallLine(out, raw, { height, width, picture = false, outer = false }, lod) {
  const line = simplify(raw, [12.9, 4.6, 1.28, 0.33][lod]);
  const midpoint = mean(geometry.outline);
  const [first, last] = line.reduce(
    (longest, next, i) => {
      if (i === 0) return longest;
      const prev = line[i - 1];
      return dxz(prev, next) > dxz(...longest) ? [prev, next] : longest;
    },
    [line[0], line[1]],
  );
  const sideSign =
    Math.sign(
      (last[1] - first[1]) * (first[0] + last[0] - 2 * midpoint[0]) -
        (last[0] - first[0]) * (first[1] + last[1] - 2 * midpoint[1]),
    ) || 1;
  const sections = line.map(([x, z], i) => {
    const prev = line[Math.max(0, i - 1)],
      next = line[Math.min(line.length - 1, i + 1)];
    const len = dxz(prev, next);
    const nx = (next[1] - prev[1]) / len;
    const nz = (prev[0] - next[0]) / len;
    const y = ground(x, z);
    const base = y - 1.6,
      top = y + height;
    const nxOut = nx * sideSign,
      nzOut = nz * sideSign;
    return {
      nx: nxOut,
      nz: nzOut,
      base,
      top,
      point: (ref, sign, level, offset = 0) => {
        const thickness = (level ? width * 0.76 : width) * 0.5 + offset;
        return [x + sign * nxOut * thickness, ref, z + sign * nzOut * thickness];
      },
    };
  });
  for (let i = 1; i < line.length; i++) {
    const a = sections[i - 1],
      b = sections[i];
    const len = dxz(line[i - 1], line[i]);
    if (len < 0.04) continue;
    for (const side of [-1, 1]) {
      const p = [
        a.point(a.base, side, 0),
        b.point(b.base, side, 0),
        b.point(b.top, side, 1),
        a.point(a.top, side, 1),
      ];
      const sum = [(a.nx + b.nx) * side, 0, (a.nz + b.nz) * side];
      const n = normalFor(...p);
      const cmp = n[0] * sum[0] + n[2] * sum[2];
      wallPanel(
        out,
        picture ? 'trim' : 'brick',
        p,
        cmp < 0 ? n.map((v) => -v) : n,
        picture ? colors.masonry : outer ? colors.kiln : colors.rough,
      );
    }
    wallPanel(
      out,
      'base',
      [a.point(a.top, -1, 1), b.point(b.top, -1, 1), b.point(b.top, 1, 1), a.point(a.top, 1, 1)],
      up,
      colors.masonry,
    );
    if (lod === 0 || len < 2.2) continue;
    const ax = a.point(a.top, 1, 1),
      bx = b.point(b.top, 1, 1);
    const [x, , z] = ax,
      dx = bx[0] - x,
      dz = bx[2] - z;
    const span = Math.hypot(dx, dz);
    const n0 = [dz / span, -dx / span];
    const sign = n0[0] * (a.nx + b.nx) + n0[1] * (a.nz + b.nz) > 0 ? 1 : -1;
    const nx = n0[0] * sign,
      nz = n0[1] * sign;
    const f = oriented(out, axes([x, z], [nx, nz]));
    const meter = (u) => -sign * u;
    const bays = Math.max(1, Math.floor(span / (lod === 1 ? 14.0 : lod === 2 ? 7.5 : 3.25)));
    for (let k = 0; k < bays; k++) {
      const u = ((k + 0.5) * span) / bays;
      const top = mix(a.top, b.top, u / span);
      const high = picture ? 1.17 : 1.05;
      const w = Math.min(1.53, (span / bays) * 0.56);
      if (lod === 1) {
        face(
          f,
          'brick',
          [
            [meter(u) - w / 2, top - 0.13, 0.03],
            [meter(u) + w / 2, top - 0.13, 0.03],
            [meter(u) + w / 2, top + high, 0.03],
            [meter(u) - w / 2, top + high, 0.03],
          ],
          [0, 0, 1],
          picture ? colors.trim : colors.kiln,
        );
      } else {
        upright(
          f,
          'brick',
          meter(u),
          -0.31,
          w,
          0.89,
          top - 0.15,
          top + high,
          picture ? colors.trim : colors.kiln,
        );
      }
      if (lod > 2 && picture)
        insetArch(f, 'trim', meter(u), 0.145, top - 0.01, w * 0.81, high + 0.15, colors.masonry, 0);
      if (lod > 1 && picture) {
        const width = Math.min(3.2, (span / bays) * 0.79);
        const rowColors = [colors.teal, colors.blue, colors.mustard, colors.red];
        for (const row of lod === 3 ? [0, 1, 2] : [0, 2]) {
          const bottom = top - height + 3.1 + row * 3.75;
          const zBand = 0.28 + width * 0.075 + (top - bottom) * (1 - 0.76) * width * 0.05;
          insetArch(f, 'trim', meter(u), zBand, bottom, width, 2.75, colors.trim, lod - 1);
          insetArch(
            f,
            'glaze',
            meter(u),
            zBand + 0.026,
            bottom + 0.18,
            width - 0.29,
            2.44,
            rowColors[(i + k + row) % 4],
            lod - 1,
          );
          if (lod === 3)
            insetArch(
              f,
              'trim',
              meter(u),
              zBand + 0.042,
              bottom + 0.51,
              width * 0.41,
              1.21,
              colors.light,
              1,
            );
        }
      }
    }
  }
  for (const i of [0, sections.length - 1]) {
    const s = sections[i];
    const p = [
      s.point(s.base, -1, 0),
      s.point(s.base, 1, 0),
      s.point(s.top, 1, 1),
      s.point(s.top, -1, 1),
    ];
    const j = i === 0 ? 1 : i - 1;
    const n = [line[i][0] - line[j][0], 0, line[i][1] - line[j][1]];
    const length = Math.hypot(n[0], n[2]);
    face(
      out,
      'brick',
      p,
      n.map((v) => v / length),
      colors.masonry,
    );
  }
}

const wallCourses = [
  [geometry.outline.slice(22, 292), { height: 8.4, width: 5.2, outer: true }],
  [points.get(605810352), { height: 8.4, width: 5.2, outer: true }],
  [points.get(604910475), { height: 13.1, width: 6.4 }],
  [points.get(605420134), { height: 12.8, width: 6.6 }],
  [points.get(605420135), { height: 13.6, width: 6.8 }],
  [points.get(605420136), { height: 12.4, width: 6.3 }],
  [points.get(605420151), { height: 17, width: 6.5, picture: true }],
  [points.get(605805879), { height: 17, width: 6.5, picture: true }],
  [points.get(605420192), { height: 17, width: 6.4, picture: true }],
];

function drum(out, slot, x, z, profile, sides, tint) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, sides, [x, z])),
    tint,
    { cap: false },
  );
}

function dome(out, slot, x, z, y, r, h, lod, tint) {
  const levels =
    lod === 0
      ? [
          [0, 1],
          [0.65, 0.75],
          [1, 0.038],
        ]
      : [
          [0, 1],
          [0.12, 1.01],
          [0.38, 0.97],
          [0.64, 0.8],
          [0.84, 0.58],
          [0.95, 0.36],
          [1, 0.05],
        ];
  drum(
    out,
    slot,
    x,
    z,
    levels.map(([t, w]) => [y + t * h, r * w]),
    [6, 10, 16, 24][lod],
    tint,
  );
}

function westBastion(out, x, z, floor, base, lod) {
  const sides = [8, 10, 16, 24][lod];
  const height = 22.0;
  const body = [
    [base, 7.66],
    [floor + 0.2, 7.71],
    [floor + 2.67, 7.2],
    [floor + 4.44, 6.91],
    [floor + height, 6.57],
  ];
  const profile = lod === 0 ? [body[0], body[4]] : body;
  drum(out, 'plaster', x, z, profile, sides, colors.pale);
  if (lod > 0) {
    drum(
      out,
      'trim',
      x,
      z,
      [
        [floor + 2.53, 7.32],
        [floor + 2.91, 7.36],
        [floor + 3.12, 7.2],
      ],
      sides,
      colors.light,
    );
    drum(
      out,
      'trim',
      x,
      z,
      [
        [floor + height - 0.31, 6.57],
        [floor + height - 0.08, 6.8],
        [floor + height + 0.28, 6.71],
      ],
      sides,
      colors.trim,
    );
  }
  const count = [0, 8, 12, 12][lod];
  for (let i = 0; i < count; i++) {
    const a = (tau * i) / count,
      sx = Math.sin(a),
      sz = Math.cos(a);
    const slice = oriented(out, axes([x + sx * 6.57, z + sz * 6.57], [sx, sz]));
    insetArch(
      slice,
      'plaster',
      0,
      0.11,
      floor + height - 0.13,
      2.47,
      2.63,
      colors.pale,
      Math.min(lod, 2),
    );
    if (lod > 1) {
      insetArch(slice, 'shade', 0, 0.14, floor + height + 0.62, 0.31, 0.95, colors.shadow, 1);
      insetArch(slice, 'trim', 0, 0.65, floor + 3.2, 2.89, 3.83, colors.light, 1);
      upright(
        slice,
        'trim',
        -1.63,
        -0.08,
        0.25,
        0.35,
        floor + 6.61,
        floor + height - 0.6,
        colors.trim,
      );
      if (i % 3 === 1)
        insetArch(slice, 'shade', 0, 0.09, floor + 10.86, 0.32, 0.91, colors.wood, 1);
    }
  }
  const podium = floor + height + 0.68;
  const canopy = podium + 4.62;
  const countPosts = lod === 0 ? 4 : 8;
  for (let i = 0; i < countPosts; i++) {
    const a = (tau * i) / countPosts;
    upright(
      out,
      'trim',
      x + 3.38 * Math.cos(a),
      z + 3.38 * Math.sin(a),
      0.74,
      0.74,
      podium,
      canopy + 0.06,
      colors.peach,
    );
  }
  drum(
    out,
    'trim',
    x,
    z,
    [
      [canopy - 0.25, 3.56],
      [canopy, 4.67],
      [canopy + 0.59, 4.12],
    ],
    lod === 0 ? 6 : 8,
    colors.bronzeDark,
  );
  dome(out, 'trim', x, z, canopy + 0.58, 3.51, 2.42, lod, colors.masonry);
  if (lod > 1)
    drum(
      out,
      'trim',
      x,
      z,
      [
        [canopy + 2.9, 0.3],
        [canopy + 3.38, 0.23],
        [canopy + 3.9, 0.04],
      ],
      8,
      colors.bronze,
    );
}

function alamgiri(out, lod) {
  const o = oriented(out, axes([-207.46, -33.65], [-0.98058, 0.19612]));
  const floor = -2.55;
  const cornice = floor + 24.4;
  const top = floor + 26.45;
  const front = 2.1;
  upright(o, 'plaster', 0, -7.0, 29.4, 18.25, floor - 2.65, cornice, colors.peach);
  upright(o, 'base', 0, 0.45, 28.3, 3.87, floor - 1.15, floor + 0.38, colors.red);
  upright(o, 'trim', 0, 1.2, 15.7, 2.18, floor + 0.35, top, colors.peach);
  insetArch(o, 'trim', 0, 2.315, floor + 0.34, 10.8, 14.6, colors.trim, lod);
  insetArch(o, 'plaster', 0, 2.36, floor + 0.48, 10.21, 14.12, colors.pale, lod);
  insetArch(o, 'wood', 0, 2.43, floor + 0.49, 7.59, 9.97, colors.wood, lod);
  if (lod > 0) {
    for (const x of [-6.7, 6.7]) {
      upright(o, 'trim', x, 2.52, 0.8, 0.83, floor + 0.96, floor + 24.5, colors.light);
      upright(o, 'trim', x, 2.56, 1.56, 1.63, floor + 23.9, floor + 24.54, colors.trim);
    }
    for (const y of [floor + 15.4, floor + 21.18, floor + 22.68])
      upright(o, 'trim', 0, 2.59, 13.3, 0.54, y, y + 0.41, colors.trim);
    for (const x of [-3.9, 0, 3.9]) {
      upright(o, 'trim', x, 2.64, 2.85, 0.36, floor + 16.9, floor + 20.39, colors.light);
      upright(o, 'shade', x, 2.89, 1.56, 0.19, floor + 17.62, floor + 19.56, colors.shadow);
      upright(o, 'shade', x * 0.55, 2.435, 0.81, 0.08, floor + 11.47, floor + 12.79, colors.shadow);
    }
    for (const x of [-11, 11]) {
      for (const y of [floor + 0.94, floor + 8.77, floor + 15.65])
        framedArch(o, x, front + 0.034, y, 5.01, 5.44, lod - 1, colors.trim, colors.peach);
      insetArch(o, 'shade', x, front + 0.097, floor + 9.29, 1.66, 2.45, colors.wood, lod - 1);
    }
    for (let i = -6; i <= 6; i++) {
      const x = 1.19 * i;
      insetArch(o, 'shade', x, 2.304, floor + 24.46, 0.26, 1.55, colors.trim, 1);
    }
  }
  if (lod > 1) {
    upright(o, 'trim', 0, 2.49, 0.095, 0.07, floor + 0.58, floor + 8.69, colors.bronzeDark);
    for (let j = 0; j < 5; j++) {
      const y = floor + 1.04 + j * 1.15;
      for (let k = -4; k <= 4; k++)
        upright(o, 'trim', k * 0.7, 2.49, 0.127, 0.14, y, y + 0.13, colors.bronze);
    }
  }
  for (const x of [-15.18, 15.18]) westBastion(o, x, 8.68, floor, -7.5, lod);
}

function eastGate(out, lod) {
  const o = oriented(out, axes([194.9, 80.5], [0.971, 0.239]));
  const f = -1.5;
  upright(o, 'brick', 0, -4.85, 31.2, 10.2, f - 1.85, f + 15.7, colors.kiln);
  for (const x of [-13.61, 13.61]) {
    drum(
      o,
      'brick',
      x,
      1.42,
      [
        [f - 1.3, 4.81],
        [f + 2.11, 4.89],
        [f + 14.6, 4.49],
      ],
      lod === 0 ? 6 : 12,
      colors.kiln,
    );
    if (lod > 1)
      drum(
        o,
        'trim',
        x,
        1.42,
        [
          [f + 13.95, 4.36],
          [f + 14.02, 4.66],
          [f + 14.72, 4.53],
        ],
        12,
        colors.trim,
      );
  }
  framedArch(o, 0, 0.48, f + 0.04, 9.48, 11.5, lod, colors.trim, colors.wood);
  if (lod > 0) {
    for (const x of [-9.22, 9.22]) {
      framedArch(o, x, 0.52, f + 2.28, 3.32, 4.75, lod - 1, colors.trim, colors.kiln);
      framedArch(o, x, 0.52, f + 9.13, 3.32, 3.9, lod - 1, colors.trim, colors.kiln);
    }
    for (let i = -9; i <= 9; i++)
      upright(o, 'brick', i * 1.55, 0.11, 0.96, 1.07, f + 15.4, f + 16.8, colors.kiln);
  }
}

function facingDirection(ring) {
  let edge = 0,
    longest = 0;
  const area = ring.reduce((s, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);
  for (let i = 0; i < ring.length; i++) {
    const l = dxz(ring[i], ring[(i + 1) % ring.length]);
    if (l > longest) {
      edge = i;
      longest = l;
    }
  }
  const a = ring[edge],
    b = ring[(edge + 1) % ring.length];
  return [((b[1] - a[1]) / longest) * Math.sign(area), ((a[0] - b[0]) / longest) * Math.sign(area)];
}

function shell(
  out,
  ring,
  y,
  h,
  slot,
  tint,
  { holes = [], roof = true, detail = 0, parapet = true, arches = false } = {},
) {
  const base = y - 1.7,
    hi = y + h;
  for (const [rp, inner] of [[ring, false], ...holes.map((r) => [r, true])]) {
    const area = rp.reduce((s, p, i) => {
      const q = rp[(i + 1) % rp.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0);
    const sign = Math.sign(area) * (inner ? -1 : 1);
    for (let i = 0; i < rp.length; i++) {
      const [x, z] = rp[i],
        [u, v] = rp[(i + 1) % rp.length];
      const len = Math.hypot(u - x, v - z);
      if (len < 0.11) continue;
      const n = [((v - z) / len) * sign, 0, ((x - u) / len) * sign];
      const lo = Math.min(base, ground(x, z) - 0.54),
        end = Math.min(base, ground(u, v) - 0.54);
      face(
        out,
        slot,
        [
          [x, lo, z],
          [u, end, v],
          [u, hi, v],
          [x, hi, z],
        ],
        n,
        tint,
      );
      if (detail > 0 && parapet)
        face(
          out,
          'trim',
          [
            [x + n[0] * 0.11, hi - 0.38, z + n[2] * 0.11],
            [u + n[0] * 0.11, hi - 0.38, v + n[2] * 0.11],
            [u + n[0] * 0.11, hi + 0.18, v + n[2] * 0.11],
            [x + n[0] * 0.11, hi + 0.18, z + n[2] * 0.11],
          ],
          n,
          colors.trim,
        );
      if (detail > 1 && arches && len > 5.0) {
        const o = oriented(out, axes([x, z], [n[0], n[2]]));
        const count = Math.max(1, Math.round(len / 4.42));
        for (let j = 0; j < count; j++) {
          const w = Math.min(2.1, (len / count) * 0.61);
          framedArch(
            o,
            (-sign * ((j + 0.5) * len)) / count,
            0.041,
            y + 1.04,
            w,
            Math.min(4.05, h * 0.57),
            detail - 1,
            colors.light,
            tint,
          );
        }
      }
    }
  }
  if (roof) cap(out, 'base', ring, holes, hi, colors.masonry);
}

function hall(out, id, lod) {
  const ring = shape(id);
  const n = facingDirection(ring);
  const [cx, cz] = mean(ring);
  const o = oriented(out, axes([cx, cz], n));
  const horizontal = ring.map(([x, z]) => n[1] * (x - cx) - n[0] * (z - cz));
  const depths = ring.map(([x, z]) => n[0] * (x - cx) + n[1] * (z - cz));
  const a = Math.min(...horizontal),
    b = Math.max(...horizontal);
  const c = Math.min(...depths),
    d = Math.max(...depths);
  const y = average(ring) + 1.6;
  const roof = y + 6.9;
  upright(o, 'base', (a + b) / 2, (c + d) / 2, b - a, d - c, y - 2.1, y, colors.trim);
  upright(
    o,
    'trim',
    (a + b) / 2,
    (c + d) / 2,
    b - a,
    d - c,
    roof - 0.76,
    roof + 0.18,
    colors.peach,
  );
  if (lod > 0)
    upright(
      o,
      'trim',
      (a + b) / 2,
      (c + d) / 2,
      b - a + 0.66,
      d - c + 0.56,
      roof - 0.29,
      roof + 0.42,
      colors.trim,
    );
  const nx = [3, 5, 10, 10][lod],
    nz = [2, 3, 4, 4][lod];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = mix(a + 0.92, b - 0.92, i / (nx - 1)),
        z = mix(c + 0.8, d - 0.8, j / (nz - 1));
      const w = lod === 0 ? 0.93 : 0.65;
      upright(o, 'trim', x, z, w, w, y, roof - 0.63, colors.pale);
      if (lod > 1) {
        upright(o, 'trim', x, z, 1.02, 1.02, y + 0.02, y + 0.44, colors.trim);
        upright(o, 'trim', x, z, 1.06, 1.06, roof - 1.24, roof - 0.71, colors.light);
      }
    }
  }
}

function naulakha(out, lod) {
  const ring = shape(604416172);
  const [x, z] = mean(ring);
  const y = Math.max(1, average(ring) + 2.4);
  const o = oriented(out, axes([x, z], [0.966, 0.258]));
  upright(o, 'base', 0, 0, 9.06, 4.49, y - 2.7, y + 0.16, colors.pale);
  upright(o, 'marble', 0, 0, 8.94, 4.31, y, y + 4.67, colors.ivory);

  const cuts = [2, 5, 8, 13][lod];
  for (let i = 0; i < cuts; i++) {
    const a = -5.17 + (10.34 * i) / cuts,
      b = -5.17 + (10.34 * (i + 1)) / cuts;
    const rise = (u) => y + 6.32 - 2.56 * Math.pow(Math.abs(u / 5.17), 2.45);
    roofFace(
      o,
      'marble',
      [
        [a, rise(a), -2.86],
        [b, rise(b), -2.86],
        [b, rise(b), 3.03],
        [a, rise(a), 3.03],
      ],
      colors.albite,
    );
    face(
      o,
      'marble',
      [
        [a, rise(a) - 0.29, 3.03],
        [b, rise(b) - 0.29, 3.03],
        [b, rise(b), 3.03],
        [a, rise(a), 3.03],
      ],
      [0, 0, 1],
      colors.ivory,
    );
  }
  framedArch(o, 0, 2.205, y + 0.06, 3.66, 4.13, lod - 1, colors.albite);
  for (const px of [-3.18, 3.18])
    framedArch(o, px, 2.23, y + 0.31, 1.02, 2.81, lod - 1, colors.albite);
}

function pearlMosque(out, lod) {
  const outer = shape(904345332);
  const inner = shape(904345333);
  const floor = 0.62;
  const wallTop = floor + 5.78;
  shell(out, outer, floor, 5.78, 'plaster', colors.ivory, { holes: [inner], detail: lod });
  const lineup = [
    [-110.21, -29.09],
    [-109.18, -23.27],
    [-107.59, -17.61],
  ];
  for (const [i, [x, z]] of lineup.entries()) {
    const r = i === 1 ? 2.63 : 2.15;
    dome(out, 'marble', x, z, wallTop - 0.05, r, i === 1 ? 3.53 : 2.85, lod, colors.albite);
    if (lod > 1)
      upright(
        out,
        'trim',
        x,
        z,
        0.18,
        0.18,
        wallTop + (i === 1 ? 3.17 : 2.49),
        wallTop + (i === 1 ? 3.92 : 3.2),
        colors.trim,
      );
  }
  if (lod > 0)
    for (const [x, z] of lineup) {
      const o = oriented(out, axes([x + 3.67, z + 0.17], [0.966, 0.258]));
      framedArch(o, 0, 0, floor + 0.1, 2.95, 4.65, lod - 1, colors.albite);
    }
}

const principalBuildings = [
  [605420150, 7.7, 'plaster', colors.pale, true],
  [604910486, 9.6, 'brick', colors.peach, true],
  [605805885, 9.1, 'plaster', colors.masonry, true],
  [605809382, 5.5, 'brick', colors.trim, true],
  [605805877, 10.4, 'brick', colors.masonry, true],
  [316466004, 7.3, 'plaster', colors.albite, true],
  [288125843, 8.0, 'brick', colors.masonry, true],
  [604910479, 7.0, 'plaster', colors.pale, true],
  [604910480, 6.1, 'plaster', colors.peach, true],
  [604910487, 6.1, 'plaster', colors.peach, true],
  [605805876, 6.2, 'plaster', colors.masonry, true],
  [605805878, 6.8, 'plaster', colors.pale, true],
  [605805882, 6.7, 'brick', colors.masonry, true],
  [605805884, 5.7, 'brick', colors.peach, true],
  [607510499, 5.7, 'brick', colors.peach, true],
  [607511909, 5.8, 'plaster', colors.pale, true],
  [604479624, 3.7, 'brick', colors.kiln, false],
];

function buildings(out, lod) {
  for (const [id, height, slot, tint, roof] of lod === 0
    ? principalBuildings.slice(0, 6)
    : principalBuildings) {
    const ring = shape(id);
    const floor = average(ring) + 0.92 + (id === 605420150 ? 1.73 : 0);
    if (lod === 0 && ring.length > 8) {
      const sub = simplify([...ring, ring[0].map((v) => v + 0.0001)], 1.3).slice(0, -1);
      shell(out, sub, floor, height, slot, tint, { roof });
    } else
      shell(out, ring, floor, height, slot, tint, {
        roof,
        detail: lod,
        parapet: lod > 1 || [605420150, 604910486, 605805885].includes(id),
        arches:
          id !== 604479624 &&
          (lod === 3 || id === 605420150 || id === 604910486 || id === 605805885),
      });
  }
  naulakha(out, lod);
  hall(out, 903587787, lod);
  pearlMosque(out, lod);
  if (lod > 0) {
    const levels = [2, 6, 12, 20][lod];
    const stair = points.get(1028243847);
    for (let i = 0; i < levels; i++) {
      const t = (i + 0.5) / levels,
        x = mix(stair[0][0], stair.at(-1)[0], t),
        z = mix(stair[0][1], stair.at(-1)[1], t);
      const g = ground(x, z);
      upright(out, 'base', x, z, 1.71, 8.05, g - 0.54, g + 0.42, colors.masonry);
    }
  }
}

function draw(out, lod) {
  for (const [line, c] of wallCourses) wallLine(out, line, c, lod);
  alamgiri(out, lod);
  eastGate(out, lod);
  buildings(out, lod);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-498, 374, 407];
const lookAt = [-8, 9, -21];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: slug + '-model.mjs',
  recipeDependencies: ['generate-motat-building.mjs'],
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Lahore Fort enclosure with Alamgiri and Akbari gates, the north and west Picture Wall, and the principal courtyard buildings.',
  camera,
  lookAt,
  sunDirection: [-195, 255, 128],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.32,
    focus: { center: lookAt },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'alamgiri-gate-bastions-and-chhatris',
      position: [-301, 17, -33],
      lookAt: [-212, 12, -33],
    },
    {
      name: 'picture-wall-and-northwestern-palaces',
      position: [-305, 64, -276],
      lookAt: [-139, 8, -168],
    },
    { name: 'courts-and-pearl-mosque', position: [22, 89, 115], lookAt: [-39, 4, -46] },
    { name: 'akbari-gate-and-east-rampart', position: [260, 33, 122], lookAt: [190, 5, 75] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'lahore-fort-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 4.8,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.8, surfaces },
      street: { export: 'street', errorMeters: 0.61, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.17, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Independent geographic reconstruction with public-domain photographs, ODbL footprint and fortification data, and unchanged Terrarium elevation samples.',
};
