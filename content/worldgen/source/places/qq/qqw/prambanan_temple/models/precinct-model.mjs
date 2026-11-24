import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  base: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.97 },
  stone: { slot: 'wall', graph: 'stone_basalt', roughness: 0.94 },
  carvings: { slot: 'trim', graph: 'stone_basalt_raw', roughness: 0.94 },
};

const ashlar = rgb('8c8580');
const band = rgb('9e9791');
const relief = rgb('958c82');
const shadow = rgb('4b4845');
const accents = ['88817b', 'a39a8f', '908986', '847c71'].map(rgb);
const square = [
  [-1, -1],
  [-1, 1],
  [1, 1],
  [1, -1],
];
const stepped = [
  [-1, -0.64],
  [-1, 0.64],
  [-0.64, 0.64],
  [-0.64, 1],
  [0.64, 1],
  [0.64, 0.64],
  [1, 0.64],
  [1, -0.64],
  [0.64, -0.64],
  [0.64, -1],
  [-0.64, -1],
  [-0.64, -0.64],
];

function face(out, slot, points, color) {
  const normal = normalFor(...points);
  out.addQuad(slot, '', points, normal, [], color);
}

function cap(out, slot, ring, color) {
  const scratch = new MeshBufferBuilder();
  const plane = ring.map(([x, , z]) => [x, z]);
  const up = [0, 1, 0];
  if (
    !scratch.addCap(
      'foundation',
      'palette:#ffffff',
      plane,
      [],
      () => ring[0][1],
      up,
      (p) => p,
      color,
    )
  )
    throw Error('Invalid Prambanan terrace ring');
  const mesh = scratch.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = Array.from({ length: 3 }, (_, j) =>
      Array.from(mesh.positions.slice(mesh.indices[i + j] * 3, mesh.indices[i + j] * 3 + 3)),
    );
    out.addTriangle(slot, '', points, up, [], color);
  }
}

function terrace(out, tower, profile, detail, core) {
  const {
    center: [x, z],
    ground,
    outline,
    height,
  } = tower;
  const ring = outline.map(([a, b]) => [a - x, b - z]);
  const area = ring.reduce((sum, [a, b], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + a * v - u * b;
  }, 0);
  if (area > 0) ring.reverse();
  const {
    halfSize: [w, d],
    entrances,
    family,
  } = tower;
  const opening = (family === 'main' ? 0.28 : 0.31) * core * 0.94;
  const at = frame(tower);
  const plan = ring.flatMap((start, i) => {
    const end = ring[(i + 1) % ring.length];
    for (const side of entrances) {
      const [u, , v] = at(1, 0, 0, side),
        [a, , b] = at(0, 0, 1, side);
      const xx = u - x,
        xz = v - z,
        zx = a - x,
        zz = b - z;
      const across = (p) => p[0] * xx + p[1] * xz;
      const depth = (p) => p[0] * zx + p[1] * zz;
      const r = side % 2 ? w : d,
        half = (side % 2 ? d : w) * opening;
      const p = across(start),
        q = across(end);
      if (
        Math.min(depth(start), depth(end)) < r * 0.88 ||
        Math.min(p, q) >= -half ||
        Math.max(p, q) <= half
      )
        continue;
      const point = (cross, recess) => {
        const radial = recess
          ? r * 0.42
          : depth(start) + ((depth(end) - depth(start)) * (cross - p)) / (q - p);
        return [cross * xx + radial * zx, cross * xz + radial * zz];
      };
      const hand = Math.sign(q - p);
      return [
        start,
        point(-hand * half, false),
        point(-hand * half, true),
        point(hand * half, true),
        point(hand * half, false),
      ];
    }
    return [start];
  });
  const rings = profile.map(([y, factor]) =>
    plan.map(([a, b]) => [x + a * factor, ground + height * y, z + b * factor]),
  );
  loft(out, 'base', rings, ashlar, { cap: false });
  cap(out, 'base', rings.at(-1), band);
  if (detail < 2) return;
  // Raised relief panels occupy the long runs of the terrace, between the stair bays.
  const bandRing = rings.at(-2);
  for (let i = 0; i < bandRing.length; i++) {
    const a = bandRing[i],
      b = bandRing[(i + 1) % bandRing.length];
    const dx = b[0] - a[0],
      dz = b[2] - a[2],
      wide = Math.hypot(dx, dz);
    const sideCenter = Math.atan2((a[2] + b[2]) / 2 - z, (a[0] + b[0]) / 2 - x);
    const stairs = entrances.some(
      (turn) => Math.cos(sideCenter - ((turn + 1) * Math.PI) / 2) > 0.96,
    );
    const count = Math.floor(wide / 1.65);
    if (count < 2) continue;
    for (let j = 0; j < count; j++) {
      if (stairs && Math.abs((j + 0.5) / count - 0.5) < 0.18) continue;
      const u = (j + 0.15) / count,
        v = (j + 0.85) / count;
      const p = (t, lift) => [
        a[0] + dx * t - (dz / wide) * 0.04,
        a[1] + lift * height,
        a[2] + dz * t + (dx / wide) * 0.04,
      ];
      face(
        out,
        'carvings',
        [p(u, -0.032), p(v, -0.032), p(v, -0.005), p(u, -0.005)],
        accents[(j + i) % accents.length],
      );
    }
  }
}

function frame(tower) {
  const a = (site.planAngleDegrees * Math.PI) / 180;
  const cos = Math.cos(a),
    sin = Math.sin(a);
  const {
    center: [cx, cz],
    ground,
  } = tower;
  return (x, y, z, side = 0) => {
    const [u, v] = side === 0 ? [x, z] : side === 1 ? [-z, x] : side === 2 ? [-x, -z] : [z, -x];
    return [cx + u * cos - v * sin, ground + y, cz + u * sin + v * cos];
  };
}

function profile(out, slot, at, levels, color, ring = square) {
  const rings = levels.map(([y, x, z]) => ring.map(([u, v]) => at(u * x, y, v * z)));
  loft(out, slot, rings, color, { cap: ring === square });
  if (ring !== square) cap(out, slot, rings.at(-1), color);
}

function block(out, slot, at, x, y, z, w, h, d, color, side = 0) {
  profile(
    out,
    slot,
    (u, v, t) => at(x + u, y + v, z + t, side),
    [
      [0, w / 2, d / 2],
      [h, w / 2, d / 2],
    ],
    color,
  );
}

function ratna(out, at, x, y, z, width, height, detail, color = relief) {
  const pin = (u, v, t) => at(x + u, y + v, z + t);
  const levels =
    detail < 3
      ? [
          [0, width, width],
          [height * 0.53, width * 0.74, width * 0.74],
          [height, width * 0.16, width * 0.16],
        ]
      : [
          [0, width, width],
          [height * 0.22, width, width],
          [height * 0.33, width * 0.73, width * 0.73],
          [height * 0.56, width * 0.66, width * 0.66],
          [height * 0.71, width * 0.37, width * 0.37],
          [height, width * 0.14, width * 0.14],
        ];
  profile(out, 'carvings', pin, levels, color);
}

function stair(out, tower, at, side, rise, run, width, detail) {
  const start = run * 0.44,
    length = run - start;
  const count = detail === 1 ? 5 : tower.height > 30 ? 16 : 12;
  const step = length / count;
  for (let i = 0; i < count; i++) {
    const z = run - i * step,
      top = (rise * (i + 1)) / count;
    const p = (x, y, z) => at(x, y, z, side);
    face(
      out,
      'base',
      [p(-width, top, z), p(width, top, z), p(width, top, z - step), p(-width, top, z - step)],
      band,
    );
    face(
      out,
      'base',
      [
        p(-width, (rise * i) / count, z),
        p(width, (rise * i) / count, z),
        p(width, top, z),
        p(-width, top, z),
      ],
      ashlar,
    );
  }
  for (const hand of [-1, 1]) {
    const x = (width + 0.24) * hand;
    const p = (u, y, z) => at(x + u, y, z, side);
    loft(
      out,
      'carvings',
      [
        [
          [-0.2, -0.17, run],
          [-0.2, 0.56, run],
          [0.2, 0.56, run],
          [0.2, -0.17, run],
        ].map((v) => p(...v)),
        [
          [-0.2, rise - 0.32, start],
          [-0.2, rise + 0.58, start],
          [0.2, rise + 0.58, start],
          [0.2, rise - 0.32, start],
        ].map((v) => p(...v)),
      ],
      relief,
    );
    if (detail >= 2)
      ratna(out, (u, y, z) => at(x + u, y, z, side), 0, 0.04, run + 0.1, 0.33, 0.66, detail);
  }
}

function crown(out, at, w, d, heights, detail, major) {
  const [bottom, top] = heights;
  const height = top - bottom;
  const steps = major ? 5 : 4;
  const ring = detail >= 2 && major ? stepped : square;
  for (let i = 0; i < steps; i++) {
    const a = i / steps,
      b = (i + 1) / steps;
    const y = bottom + a * height * 0.88,
      next = bottom + b * height * 0.88;
    const radius = Math.pow(1 - a, 1.38),
      neck = Math.pow(1 - b, 1.38) * 0.88 + 0.12;
    const row = (v, r) => [v, w * r, d * r];
    const levels = [
      row(y, radius * 0.96),
      row(y + (next - y) * 0.12, radius),
      ...(detail >= 3
        ? [row(y + (next - y) * 0.21, radius * 0.999), row(y + (next - y) * 0.26, radius * 0.92)]
        : []),
      row(next - (next - y) * 0.24, radius * 0.81),
      row(next, Math.min(radius * 0.83, neck)),
    ];
    profile(out, 'stone', at, levels, i % 2 ? ashlar : band, ring);
    if (detail < 1 || i === steps - 1) continue;
    for (let side = 0; side < 4; side++) {
      const pts =
        detail >= 3 && major && i < 3
          ? [-0.62, -0.32, 0, 0.32, 0.62]
          : detail >= 2 && major && i < 3
            ? [-0.62, 0, 0.62]
            : [-0.62];
      for (const x of pts) {
        const local = (u, v, z) => at(u, v, z, side);
        ratna(
          out,
          local,
          x * w * radius,
          y + (next - y) * 0.19,
          (x === 0 ? 0.86 : 0.74) * (side % 2 === 1 ? w : d) * radius,
          w * radius * 0.148,
          (next - y) * 0.9,
          detail,
          accents[(i + side) % accents.length],
        );
      }
    }
  }
  ratna(out, at, 0, bottom + height * 0.85, 0, w * 0.17, height * 0.15, detail, band);
}

function sanctuary(out, tower, detail) {
  const {
    halfSize: [w, d],
    height: h,
    entrances,
    family,
  } = tower;
  const major = family === 'main';
  const at = frame(tower);
  const platform = h * (major ? 0.21 : 0.18);
  const bodyTop = h * (major ? 0.47 : 0.46);
  const core = major ? 0.51 : 0.69;
  if (detail <= 1) {
    if (detail === 0)
      loft(
        out,
        'base',
        [
          square.map(([u, v]) => at(u * w, tower.foundation, v * d)),
          square.map(([u, v]) => at(u * w * 0.91, platform, v * d * 0.91)),
        ],
        ashlar,
      );
    else
      terrace(
        out,
        tower,
        [
          [tower.foundation / h, 1],
          [0.06, 1],
          [platform / h, 0.94],
        ],
        detail,
        core,
      );
    profile(
      out,
      'stone',
      at,
      [
        [platform, w * core, d * core],
        [bodyTop, w * core, d * core],
      ],
      ashlar,
    );
    if (detail === 1) {
      for (const side of entrances) {
        const s = side % 2 === 1;
        const width = (s ? d : w) * core,
          depth = (s ? w : d) * core;
        block(
          out,
          'carvings',
          at,
          0,
          platform,
          depth * 1.02,
          width * 0.59,
          (bodyTop - platform) * 0.86,
          depth * 0.085,
          band,
          side,
        );
        block(
          out,
          'stone',
          at,
          0,
          platform,
          depth * 1.07,
          width * 0.42,
          (bodyTop - platform) * 0.71,
          0.012,
          shadow,
          side,
        );
        stair(out, tower, at, side, platform, (s ? w : d) * 0.98, width * 0.25, detail);
      }
    }
    const rr = w * core,
      dd = d * core;
    profile(
      out,
      'carvings',
      at,
      [
        [bodyTop, rr * 1.14, dd * 1.14],
        [h * 0.58, rr, dd],
        [h * 0.59, rr * 0.79, dd * 0.79],
        [h * 0.73, rr * 0.66, dd * 0.66],
        [h * 0.74, rr * 0.48, dd * 0.48],
        [h * 0.91, rr * 0.27, dd * 0.27],
        [h, rr * 0.055, dd * 0.055],
      ],
      band,
    );
    return;
  }
  terrace(
    out,
    tower,
    [
      [tower.foundation / h, 1],
      [0.018, 1],
      [0.057, 0.97],
      [platform / h - 0.045, 0.91],
      [platform / h - 0.027, 0.96],
      [platform / h, 0.95],
    ],
    detail,
    core,
  );
  const pg = platform / h;
  const make = (x, z) => [x * w * core, z * d * core];
  const row = (v, r) => [v, ...make(r, r)];
  profile(
    out,
    'stone',
    at,
    [row(platform - 0.05, 1.04), row(h * (pg + 0.05), 1.04), row(h * (pg + 0.063), 0.9)],
    ashlar,
  );
  profile(out, 'stone', at, [row(platform, 0.71), row(bodyTop, 0.71)], shadow);
  for (let side = 0; side < 4; side++) {
    const open = entrances.includes(side),
      s = side % 2 === 1;
    const width = (s ? d : w) * core,
      depth = (s ? w : d) * core;
    const bottom = h * (pg + 0.045),
      wallHeight = bodyTop - bottom;
    const door = width * (major ? 0.28 : 0.31);
    const split = open ? door : width * 0.12;
    for (const hand of [-1, 1]) {
      block(
        out,
        'stone',
        at,
        (hand * (width + split)) / 2,
        bottom,
        depth * 0.91,
        width - split + 0.028,
        wallHeight,
        depth * 0.18,
        ashlar,
        side,
      );
      if (detail >= 2) {
        for (const f of [0.22, 0.74]) {
          const x = hand * (split + (width - split) * f);
          block(
            out,
            'carvings',
            at,
            x,
            bottom,
            depth * 1.008,
            width * 0.12,
            wallHeight * 0.89,
            0.16,
            relief,
            side,
          );
          block(
            out,
            'carvings',
            at,
            x,
            bottom + wallHeight * 0.83,
            depth * 1.037,
            width * 0.19,
            wallHeight * 0.08,
            0.25,
            band,
            side,
          );
        }
      }
    }
    if (open) {
      const run = (s ? w : d) * 0.98;
      // Each flight ends at the veranda on the exact mapped pedestal.
      stair(out, tower, at, side, platform, run, door * 0.92, detail);
      const archY = bottom + wallHeight * 0.7;
      block(
        out,
        'carvings',
        at,
        0,
        archY,
        depth * 1.015,
        door * 2.7,
        wallHeight * 0.135,
        depth * 0.25,
        band,
        side,
      );
      if (detail >= 3) {
        for (const hand of [-1, 1]) {
          const x = hand * door * 1.09;
          block(
            out,
            'carvings',
            at,
            x,
            bottom,
            depth * 1.019,
            door * 0.24,
            archY - bottom,
            depth * 0.19,
            relief,
            side,
          );
          block(
            out,
            'carvings',
            at,
            x,
            archY - wallHeight * 0.076,
            depth * 1.055,
            door * 0.42,
            wallHeight * 0.073,
            depth * 0.19,
            band,
            side,
          );
          if (detail === 4) {
            for (const y of [0.2, 0.37, 0.54, 0.71])
              block(
                out,
                'carvings',
                at,
                x,
                bottom + (archY - bottom) * y,
                depth * 1.122,
                door * 0.15,
                wallHeight * 0.047,
                0.055,
                accents[2],
                side,
              );
          }
        }
      }
      ratna(
        out,
        (x, y, z) => at(x, y, z, side),
        0,
        archY + wallHeight * 0.115,
        depth * 1.035,
        door * 0.81,
        wallHeight * 0.19,
        detail,
      );
    } else {
      block(
        out,
        'carvings',
        at,
        0,
        bottom,
        depth * 0.82,
        split * 2.02,
        wallHeight * 0.72,
        0.18,
        relief,
        side,
      );
    }
  }
  profile(
    out,
    'carvings',
    at,
    [
      row(bodyTop - 0.043 * h, 1),
      row(bodyTop - 0.018 * h, 1.15),
      row(bodyTop, 1.13),
      row(bodyTop + 0.009 * h, 1.09),
    ],
    band,
  );
  crown(out, at, w * core * 1.11, d * core * 1.11, [bodyTop + 0.009 * h, h], detail, major);
}

function marker(out, tower, detail) {
  const at = frame(tower);
  const {
    halfSize: [r],
    height: h,
  } = tower;
  const p = (y, scale) => [y, r * scale, r * scale];
  profile(
    out,
    'base',
    at,
    detail <= 1
      ? [p(tower.foundation, 1), p(0.93, 0.92)]
      : [p(tower.foundation, 1), p(0.32, 1), p(0.59, 0.88), p(0.93, 0.95)],
    ashlar,
  );
  profile(out, 'stone', at, [p(0.91, 0.71), p(h * 0.51, 0.71)], relief);
  profile(
    out,
    'carvings',
    at,
    detail <= 1
      ? [p(h * 0.49, 0.84), p(h, 0.12)]
      : [p(h * 0.49, 0.82), p(h * 0.61, 0.84), p(h * 0.75, 0.4), p(h * 0.94, 0.26), p(h, 0.12)],
    band,
  );
  if (detail >= 2 && tower.family === 'screen') {
    const side = tower.entrances[0];
    block(out, 'carvings', at, 0, 1.05, r * 0.706, r * 0.55, 0.77, 0.037, shadow, side);
    block(out, 'carvings', at, 0, 1.79, r * 0.74, r * 0.65, 0.14, 0.15, band, side);
  }
}

function enclosure(out, detail) {
  const corners = site.court;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i],
      b = corners[(i + 1) % corners.length];
    const span = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const edge = (t, depth, h) => [
      a[0] + (b[0] - a[0]) * t + ((b[2] - a[2]) / span) * depth,
      a[1] + (b[1] - a[1]) * t + h,
      a[2] + (b[2] - a[2]) * t - ((b[0] - a[0]) / span) * depth,
    ];
    const gap = site.gateFractions[i];
    for (const [lo, hi] of [
      [0, gap - 0.028],
      [gap + 0.028, 1],
    ]) {
      const count = detail < 2 ? 1 : Math.ceil(((hi - lo) * span) / 7);
      for (let j = 0; j < count; j++) {
        const u = lo + ((hi - lo) * j) / count,
          v = lo + ((hi - lo) * (j + 1)) / count;
        const height = detail < 2 ? 1.22 : 1.12 + ((i * 5 + j) % 4) * 0.07;
        const ring = (depth, h) => [
          edge(u, depth, h),
          edge(u, -depth, h),
          edge(v, -depth, h),
          edge(v, depth, h),
        ];
        loft(
          out,
          'base',
          [ring(0.88, -1.55), ring(0.59, height - 0.22), ring(0.66, height)],
          ashlar,
        );
      }
    }
  }
}

function build(out, detail) {
  for (const temple of site.towers) sanctuary(out, temple, detail);
  for (const small of site.markers) marker(out, small, detail);
  if (detail > 0) enclosure(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
