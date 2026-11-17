/** The restored two-storey Palacio de la Exposición and its central court. */
import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json'),
  frame = read('map-frame.json'),
  field = read('terrain-grid.json');
const { west, east, north, south, pavilionNorth, pavilionSouth, courtSpan, wallTop } =
  plan.dimensions;
const h = courtSpan / 2,
  base = -5.4,
  center = -0.24;
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91 },
  trim: { slot: 'trim', graph: 'plaster_tadelakt', roughness: 0.83 },
  stone: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.92 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.87, metallic: 0.08 },
  inset: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.8 },
  iron: { slot: 'door', graph: 'metal_painted', roughness: 0.78, metallic: 0.15 },
};
const palette = Object.fromEntries(
  Object.entries({
    oyster: 'e1ddd4',
    white: 'efede6',
    shade: 'c2bbb1',
    base: '5e605f',
    roof: '908b82',
    roofLight: 'beb9ac',
    court: 'cfc5b6',
    glass: '415058',
    deep: '343631',
    wood: '766a57',
    iron: '565b56',
  }).map(([name, color]) => [name, rgb(color)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const solid = (out, mat, x0, x1, y0, y1, z0, z1, c) =>
  box(out, mat, [x0, y0, z0], [x1, y1, z1], palette[c]);
const rect = (out, mat, x0, x1, y0, y1, z, c) =>
  face(
    out,
    mat,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    palette[c],
  );
const side = (out, a, b) => transform(out, Math.atan2(a[1] - b[1], b[0] - a[0]), [a[0], 0, a[1]]);

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters,
    v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const low = field.heightsMeters[j],
    high = field.heightsMeters[j + 1];
  return (
    mix(mix(low[i], low[i + 1], u - i), mix(high[i], high[i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function archProfile(x, spring, half, rise, z, t) {
  const a = Math.PI * t;
  return [x + half * Math.cos(a), spring + rise * Math.sin(a), z];
}

function opening(
  out,
  { x, bottom, spring, half, rise, lod, trim = 0.21, twin = false, fill = 'glass' },
) {
  const n = lod === 3 ? 12 : lod > 0 ? 6 : 2;
  const point = (step, margin = 0, z = 0.042) =>
    archProfile(x, spring, half + margin, rise + margin, z, step / n);
  if (fill) {
    rect(out, 'inset', x - half, x + half, bottom, spring, 0.042, fill);
    for (let i = 0; i < n; i++)
      triangle(out, 'inset', [[x, spring, 0.042], point(i), point(i + 1)], palette[fill]);
  }
  if (lod === 0 || (lod === 1 && twin)) return;
  const rings = lod > 1 && trim > 0.17 ? 2 : 1;
  for (let k = 0; k < rings; k++) {
    const inner = trim * k,
      outer = trim * (k + 1),
      z = 0.09 + k * 0.045;
    const tone = k === 0 ? 'shade' : 'white';
    for (let i = 0; i < n; i++)
      face(
        out,
        'trim',
        [
          point(i, inner, z),
          point(i, outer, z + 0.085),
          point(i + 1, outer, z + 0.085),
          point(i + 1, inner, z),
        ],
        palette[tone],
      );
    rect(out, 'trim', x - half - outer, x - half - inner, bottom, spring, z + 0.085, tone);
    rect(out, 'trim', x + half + inner, x + half + outer, bottom, spring, z + 0.085, tone);
  }
  if (!twin) return;
  solid(
    out,
    'trim',
    x - half - 0.16,
    x + half + 0.16,
    bottom - 0.13,
    bottom + 0.015,
    0.04,
    0.24,
    'white',
  );
  if (lod < 2) return;
  rect(out, 'trim', x - 0.057, x + 0.057, bottom, spring + rise * 0.54, 0.128, 'white');
  rect(out, 'trim', x - half, x + half, spring - 0.062, spring + 0.04, 0.126, 'white');
  for (const d of [-1, 1]) {
    const xx = x + d * half * 0.49;
    if (lod === 3) {
      opening(transform(out, 0, [0, 0, 0.062]), {
        x: xx,
        bottom: spring + 0.02,
        spring: spring + 0.12,
        half: half * 0.43,
        rise: rise * 0.55,
        lod: 1,
        trim: 0.06,
        fill: null,
      });
      rect(out, 'trim', xx - 0.04, xx + 0.04, bottom, spring, 0.132, 'shade');
    }
    if (lod === 3)
      rect(
        out,
        'trim',
        xx - half * 0.42,
        xx + half * 0.42,
        bottom + (spring - bottom) * 0.38,
        bottom + (spring - bottom) * 0.38 + 0.065,
        0.136,
        'shade',
      );
  }
  if (lod === 3) {
    const yy = spring + rise * 0.79,
      radius = half * 0.137;
    for (let j = 0; j < 8; j++) {
      const p = (i) => [
        x + radius * Math.cos((i * Math.PI) / 4),
        yy + radius * Math.sin((i * Math.PI) / 4),
        0.16,
      ];
      beam(out, 'trim', p(j), p(j + 1), 0.052, 0.06, palette.white);
    }
  }
}

function baluster(out, x, y, z, lod) {
  if (lod === 2) {
    rect(out, 'trim', x - 0.075, x + 0.075, y, y + 0.86, z, 'white');
    return;
  }
  const samples = [
    [0, 0.12],
    [0.1, 0.12],
    [0.2, 0.073],
    [0.36, 0.12],
    [0.58, 0.09],
    [0.76, 0.056],
    [0.86, 0.12],
  ];
  for (let i = 0; i < samples.length - 1; i++) {
    const [a, r] = samples[i],
      [b, s] = samples[i + 1];
    face(
      out,
      'trim',
      [
        [x - r, y + a, z],
        [x + r, y + a, z],
        [x + s, y + b, z],
        [x - s, y + b, z],
      ],
      palette.white,
    );
  }
}

function rail(out, span, level, lod, top = 0.94) {
  if (lod === 0) {
    rect(out, 'trim', 0, span, level - 0.065, level + top, 0.16, 'oyster');
    return;
  }
  solid(out, 'trim', 0, span, level - 0.065, level + 0.16, -0.21, 0.24, 'white');
  if (lod < 2) {
    solid(
      out,
      'plaster',
      0.07,
      span - 0.07,
      level + 0.13,
      level + top,
      -0.13,
      0.14,
      lod === 1 ? 'shade' : 'oyster',
    );
    return;
  }
  solid(out, 'trim', 0, span, level + top, level + top + 0.14, -0.19, 0.22, 'white');
  const n = Math.max(2, Math.round(span / (lod === 3 ? 0.36 : 0.9)));
  for (let i = 1; i < n; i++) baluster(out, (span * i) / n, level + 0.137, 0.13, lod);
}

function cornices(out, span, lod) {
  if (lod < 2) {
    rect(out, 'trim', 0, span, 7.42, 7.95, 0.11, 'white');
    rect(out, 'trim', 0, span, 14.86, 15.57, 0.13, 'white');
    return;
  }
  for (const [y, up, proj] of [
    [7.4, 0.27, 0.27],
    [7.68, 0.27, 0.49],
    [14.55, 0.26, 0.24],
    [15.02, 0.22, 0.34],
    [15.24, 0.38, 0.5],
  ]) {
    solid(out, 'trim', 0, span, y, y + up, -0.23, proj, 'white');
  }
  if (lod < 2) return;
  const n = Math.round(span / (lod === 3 ? 0.66 : 1.5));
  for (let i = 0; i < n; i++) {
    const x = (span * (i + 0.5)) / n,
      w = lod === 3 ? 0.13 : 0.17;
    solid(out, 'trim', x - w, x + w, 14.81, 15.03, 0.03, 0.346, 'shade');
  }
}

function pilaster(out, x, lod) {
  const w = 0.25;
  for (const [low, high] of [
    [2.0, 7.36],
    [8.04, 14.62],
  ]) {
    rect(out, 'trim', x - w, x + w, low, high, 0.26, 'white');
    if (lod < 3) {
      if (lod === 2) {
        rect(out, 'trim', x - 0.33, x + 0.33, low, low + 0.29, 0.385, 'white');
        rect(out, 'trim', x - 0.37, x + 0.37, high - 0.35, high, 0.397, 'white');
      }
    } else {
      solid(out, 'trim', x - 0.33, x + 0.33, low, low + 0.29, 0.04, 0.385, 'white');
      solid(out, 'trim', x - 0.37, x + 0.37, high - 0.35, high, 0.04, 0.397, 'white');
    }
    if (lod === 3) {
      rect(out, 'trim', x - 0.32, x + 0.32, high - 0.76, high - 0.53, 0.251, 'shade');
    }
  }
}

function ornateBay(out, x, terrainY, lod) {
  const bottom = Math.max(2.24, terrainY + 1.15);
  opening(out, { x, bottom, spring: 5.58, half: 1.48, rise: 1.24, lod, twin: true });
  opening(out, { x, bottom: 8.65, spring: 12.17, half: 1.53, rise: 1.31, lod, twin: true });
  if (lod < 2) return;
  for (const y of [bottom - 0.19, 8.43]) {
    rect(out, 'trim', x - 1.3, x + 1.3, y - 0.38, y - 0.07, 0.09, 'shade');
    if (lod === 3)
      for (let j = -4; j <= 4; j++)
        rect(
          out,
          'trim',
          x + j * 0.24 - 0.039,
          x + j * 0.24 + 0.039,
          y - 0.39,
          y - 0.067,
          0.12,
          'white',
        );
  }
}

function frontSkin(out, a, b, lod, count, { pavilion = false } = {}) {
  const local = side(out, a, b);
  const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const loc = (x) => [mix(a[0], b[0], x / span), mix(a[1], b[1], x / span)];
  cornices(local, span, lod);
  rail(local, span, wallTop + 0.21, lod);
  if (!pavilion) {
    const subdivisions = Math.ceil(span / 4);
    const ledge = (x, z = 0.078) => {
      const y = ground(...loc(x));
      return [
        [x, y - 0.11, z],
        [x, y + 0.82, z],
      ];
    };
    for (let i = 0; i < subdivisions; i++) {
      const [p, q] = ledge((span * i) / subdivisions),
        [r, s] = ledge((span * (i + 1)) / subdivisions);
      face(local, 'stone', [p, r, s, q], palette.base);
    }
  }
  const pitch = span / count;
  if (!pavilion) {
    for (let i = 0; i < count; i++) {
      const x = (i + 0.5) * pitch;
      ornateBay(local, x, ground(...loc(x)), lod);
    }
  }
  if (lod > 0)
    for (let i = 0; i <= count; i++) pilaster(local, 0.42 + ((span - 0.84) * i) / count, lod);
  return { local, span };
}

function lowerVoids(out, level, z, low, high, entry, lod) {
  const direction = Math.sign(z),
    inner = direction > 0 ? north : south;
  const start = Math.min(z, inner),
    finish = Math.max(z, inner);
  const openingWidths = [-6.3, 0, 6.3].map((x) => [x + center, 1.8]);
  const segments = lod > 1 ? 12 : 6;
  let from = low;
  for (const [x, width] of openingWidths) {
    solid(out, 'plaster', from, x - width, base, 7.44, start, finish, 'oyster');
    const local = direction > 0 ? transform(out, 0, [x, 0, z]) : transform(out, Math.PI, [x, 0, z]);
    const spring = level + (direction > 0 ? 3.66 : 2.75),
      rise = direction > 0 ? 1.61 : 1.5;
    const arc = (i) => archProfile(0, spring, width, rise, 0.013, i / segments);
    for (let i = 0; i < segments; i++) {
      const p = arc(i),
        q = arc(i + 1);
      face(local, 'plaster', [q, p, [p[0], 7.44, 0.013], [q[0], 7.44, 0.013]], palette.oyster);
      face(local, 'trim', [p, q, [q[0], q[1], -0.73], [p[0], p[1], -0.73]], palette.shade);
    }
    opening(local, {
      x: 0,
      bottom: level,
      spring,
      half: width,
      rise,
      lod,
      trim: 0.225,
      fill: null,
    });
    const back = transform(local, 0, [0, 0, -1.82]);
    const doorTop = spring - 0.38;
    rect(back, 'inset', -1.76, 1.76, level, doorTop, 0.028, entry ? 'glass' : 'deep');
    if (lod > 1) {
      for (const u of [-1.18, 0, 1.18])
        rect(back, 'trim', u - 0.052, u + 0.052, level, doorTop, 0.075, 'shade');
      rect(back, 'trim', -1.76, 1.76, doorTop - 0.54, doorTop - 0.44, 0.088, 'shade');
    }
    from = x + width;
  }
  solid(out, 'plaster', from, high, base, 7.44, start, finish, 'oyster');
}

function reliefCrest(local, mid, lod) {
  const front = 0.44;
  const outline = [
    [-5.4, 16.52],
    [-4.76, 17.25],
    [-4.36, 17.52],
    [-3.97, 18.02],
    [-3, 18.32],
    [-2.32, 19.01],
    [-1.43, 19.1],
    [-0.8, 19.47],
    [0, 20.11],
    [0.8, 19.47],
    [1.43, 19.1],
    [2.32, 19.01],
    [3, 18.32],
    [3.97, 18.02],
    [4.36, 17.52],
    [4.76, 17.25],
    [5.4, 16.52],
  ];
  for (let i = 0; i + 1 < outline.length; i++) {
    const [a, ay] = outline[i],
      [b, by] = outline[i + 1];
    face(
      local,
      'plaster',
      [
        [mid + a, 16.51, front],
        [mid + b, 16.51, front],
        [mid + b, by, front],
        [mid + a, ay, front],
      ],
      palette.oyster,
    );
    face(
      local,
      'plaster',
      [
        [mid + b, 16.5, -0.62],
        [mid + a, 16.5, -0.62],
        [mid + a, ay, -0.62],
        [mid + b, by, -0.62],
      ],
      palette.oyster,
    );
    face(
      local,
      'trim',
      [
        [mid + b, by, front],
        [mid + a, ay, front],
        [mid + a, ay, -0.62],
        [mid + b, by, -0.62],
      ],
      palette.white,
    );
    if (lod > 1)
      beam(
        local,
        'trim',
        [mid + a, ay + 0.04, front + 0.08],
        [mid + b, by + 0.04, front + 0.08],
        0.16,
        0.2,
        palette.white,
      );
  }
  if (lod > 1) {
    const z = front + 0.136,
      y = 17.87;
    const relief = [
      [-0.82, 0.64],
      [0.82, 0.64],
      [0.71, -0.19],
      [0, -0.75],
      [-0.71, -0.19],
    ];
    for (let i = 0; i < relief.length; i++) {
      const [ax, ay] = relief[i],
        [bx, by] = relief[(i + 1) % relief.length];
      triangle(
        local,
        'trim',
        [
          [mid, y, z],
          [mid + bx, y + by, z],
          [mid + ax, y + ay, z],
        ],
        palette.shade,
      );
    }
    for (const d of [-1, 1]) {
      const x = mid + d * 2.93;
      solid(local, 'trim', x - 0.24, x + 0.24, 16.56, 18.02, 0.34, 0.71, 'white');
      solid(local, 'trim', x - 0.36, x + 0.36, 17.92, 18.12, 0.34, 0.75, 'white');
    }
  }
}

function pavilion(out, direction, lod) {
  const northward = direction > 0,
    z = northward ? pavilionNorth : pavilionSouth;
  const line = northward ? north : south;
  const min = northward ? -12.758 : -13.843,
    max = northward ? 12.264 : 10.94;
  const z0 = Math.min(line, z),
    z1 = Math.max(line, z);
  const a = northward ? [min, z] : [max, z],
    b = northward ? [max, z] : [min, z];
  const entryY = northward ? 1.08 : 2.76;
  const { local, span } = frontSkin(out, a, b, lod, 3, { pavilion: true });
  solid(out, 'plaster', min, max, 7.4, wallTop, z0, z1, 'oyster');
  lowerVoids(out, entryY, z, min, max, !northward, lod);
  for (const x of [center - 6.3, center, center + 6.3]) {
    const u = northward ? x - min : max - x;
    opening(local, { x: u, bottom: 8.63, spring: 12.18, half: 1.71, rise: 1.35, lod, twin: true });
  }
  for (const x of [min, max]) {
    const sideLength = Math.abs(line - z),
      fac = side(
        out,
        direction * (x - center) > 0 ? [x, z] : [x, line],
        direction * (x - center) > 0 ? [x, line] : [x, z],
      );
    cornices(fac, sideLength, lod);
    rail(fac, sideLength, wallTop + 0.21, lod);
  }
  if (northward) reliefCrest(local, center - min, lod);
  else if (lod > 0)
    solid(local, 'trim', span * 0.39, span * 0.61, 16.71, 17.18, -0.17, 0.19, 'white');
  const steps = lod === 0 ? 1 : lod === 1 ? 3 : 5;
  for (let i = 0; i < steps; i++) {
    const width = 10.75 + i * 0.13,
      zOutside = z + direction * (0.46 + i * 0.47);
    const zNear = Math.min(z, zOutside),
      zFar = Math.max(z, zOutside);
    const stepY = entryY - (i + 0.1) * (northward ? 0.19 : 0.22);
    solid(out, 'stone', center - width, center + width, base, stepY, zNear, zFar, 'shade');
  }
}

function roof(out, x0, x1, z0, z1, rise, lod) {
  const y = 15.19;
  const inset = 3.2;
  const top = 15.57 + rise;
  const a = [x0, y, z0],
    b = [x0, y, z1],
    c = [x1, y, z1],
    d = [x1, y, z0];
  const aa = [x0 + inset, top, z0 + inset],
    bb = [x0 + inset, top, z1 - inset],
    cc = [x1 - inset, top, z1 - inset],
    dd = [x1 - inset, top, z0 + inset];
  for (const polygon of [
    [a, b, bb, aa],
    [b, c, cc, bb],
    [c, d, dd, cc],
    [d, a, aa, dd],
    [aa, bb, cc, dd],
  ])
    face(out, 'roof', polygon, palette.roof);
  if (lod >= 2) {
    for (const [p, q] of [
      [aa, bb],
      [bb, cc],
      [cc, dd],
      [dd, aa],
    ])
      beam(out, 'roof', p, q, 0.13, 0.102, palette.roofLight);
  }
}

function courtGallery(out, a, b, lod) {
  const local = side(out, a, b);
  const span = courtSpan,
    levels = [0.85, 7.65],
    bays = 5;
  for (const y of levels) {
    solid(local, 'trim', 0, span, y, y + 0.22, -0.72, 1.77, 'white');
    solid(local, 'plaster', 0, span, y + 5.61, y + 6.06, -0.5, 1.56, 'oyster');
    if (lod > 0) {
      for (let i = 0; i <= bays; i++) {
        const x = (span * i) / bays;
        if (i === 0 || i === bays) continue;
        solid(local, 'iron', x - 0.14, x + 0.14, y + 0.18, y + 5.64, 1.27, 1.52, 'iron');
        if (lod > 1)
          for (const yy of [y + 0.19, y + 5.25])
            solid(local, 'iron', x - 0.245, x + 0.245, yy, yy + 0.29, 1.215, 1.58, 'iron');
      }
    }
    if (lod >= 2)
      for (let i = 0; i < bays; i++) {
        const x = (span * (i + 0.5)) / bays;
        opening(local, {
          x,
          bottom: y + 0.52,
          spring: y + 4.22,
          half: 1.38,
          rise: 1.14,
          lod,
          twin: true,
          trim: 0.12,
        });
      }
  }
  if (lod > 0) rail(transform(local, 0, [0, 0, 1.4]), span, 8.06, lod, 0.84);
}

function courtyard(out, lod) {
  solid(out, 'stone', -h, h, base, 0.76, -h, h, 'court');
  if (lod > 0) {
    const corners = [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ];
    for (let i = 0; i < 4; i++) courtGallery(out, corners[i], corners[(i + 1) % 4], lod);
  }
  if (lod > 1)
    for (const x of [-9, -3, 3, 9]) {
      for (const z of [-24, 24]) {
        solid(out, 'roof', x - 0.83, x + 0.83, 16.18, 16.69, z - 0.44, z + 0.55, 'roofLight');
        solid(out, 'inset', x - 0.69, x + 0.69, 16.37, 16.63, z + 0.537, z + 0.561, 'glass');
      }
    }
}

function build(out, lod) {
  for (const [x0, x1, z0, z1] of [
    [west, -h, south, north],
    [h, east, south, north],
    [-h, h, south, -h],
    [-h, h, h, north],
  ]) {
    solid(out, 'plaster', x0, x1, base, wallTop, z0, z1, 'oyster');
    roof(out, x0 + 0.25, x1 - 0.25, z0 + 0.24, z1 - 0.24, 0.75, lod);
  }
  for (const [a, b, n] of [
    [[east, north], [east, south], 11],
    [[west, south], [west, north], 11],
    [[west, north], [-12.758, north], 3],
    [[12.264, north], [east, north], 3],
    [[east, south], [10.94, south], 3],
    [[-13.843, south], [west, south], 3],
  ])
    frontSkin(out, a, b, lod, n);
  pavilion(out, 1, lod);
  pavilion(out, -1, lod);
  courtyard(out, lod);
}

export const limaArtMuseumSkyline = (out) => build(out, 0);
export const limaArtMuseumDistrict = (out) => build(out, 1);
export const limaArtMuseumStreet = (out) => build(out, 2);
export const limaArtMuseumCloseup = (out) => build(out, 3);
const recipe = 'lima-art-museum-model.mjs';
const camera = [110, 63, 140],
  lookAt = [0, 7, 5];
export const limaArtMuseumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'museum',
  build: limaArtMuseumCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline: frame.geometry.polygons[0],
    minimumCoverage: 0.85,
    basis: 'Mapped standing Palacio de la Exposición perimeter.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The oyster-white neorenaissance Exhibition Palace in Lima, with round-headed twin windows, strong cornices, two projecting porticos and an iron-columned central court.',
  camera,
  lookAt,
  sunDirection: [-98, 120, 130],
  portableGroundY: 0,
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.81,
    cameraYaw: 0.17,
    focus: { center: [0, 7, 0] },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'paseo-colon-and-northeast-corner', position: camera, lookAt },
    { name: 'paseo-colon-three-portal-front', position: [-12, 11, 88], lookAt: [0, 10, 44] },
    { name: 'park-entrance-and-southern-pavilion', position: [-54, 23, -94], lookAt: [-6, 8, -26] },
    { name: 'central-courtyard-and-roof-bands', position: [-28, 48, 12], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'palace-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'limaArtMuseumSkyline',
    errorMeters: 1.25,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'limaArtMuseumDistrict', 0.6],
        ['street', 'limaArtMuseumStreet', 0.24],
        ['closeup', 'limaArtMuseumCloseup', 0.071],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original geometry informed by the public-domain U.S. Bureau of Public Roads archive photograph and the museum’s published restoration descriptions. OpenStreetMap geometry ODbL 1.0.',
  limitations: plan.limitations,
};
