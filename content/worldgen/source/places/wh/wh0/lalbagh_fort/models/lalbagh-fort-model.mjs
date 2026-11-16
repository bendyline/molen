/** Standing Lalbagh Fort precinct with the three axial monuments and southern ramparts. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
  transform,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireGeometry = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = requireGeometry('earcut');
const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const grid = read('terrain-grid.json');
const gardens = read('garden-controls.json').lawns;
const feature = (id) => frame.features.find((f) => f.id === id).points;
const tomb = feature('way/624024857');
const mosque = feature('way/624024874');
const museum = feature('way/624024864');
const outerWall = feature('way/624160147');
const innerWall = feature('way/624024884');
const tank = feature('way/624024882');
const [gatePoint] = feature('node/8075331633');
const dimensions = plan.dimensions;

const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  masonry: { slot: 'door', graph: 'brick', roughness: 0.95, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.92, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_copper', roughness: 0.77, metallic: 0.27 },
  shade: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
};
const tint = Object.fromEntries(
  Object.entries({
    tomb: 'bf8f70',
    light: 'd5aa83',
    west: 'd5bea1',
    wall: 'a97460',
    old: '8d6554',
    cream: 'd0c3a7',
    shadow: '674b3d',
    opening: '59493d',
    patina: '435c50',
    pond: '576c55',
    pool: '719193',
    grass: '7b9753',
    hedge: '708e3f',
    path: 'ac9178',
    mortar: 'ac8269',
    pink: 'b17860',
    roof: 'a36f5d',
  }).map(([k, v]) => [k, rgb(v)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const center = (ring) =>
  [0, 1].map((axis) => ring.reduce((sum, p) => sum + p[axis], 0) / ring.length);
const point = ([x, z], y) => [x, y, z];
const lerp = ([x, z], [u, v], t) => [mix(x, u, t), mix(z, v, t)];
const terrain = (x, z) => {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = grid.heightsMeters[j],
    b = grid.heightsMeters[j + 1];
  return (
    mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
    grid.modelDatumElevationMeters
  );
};
const graded = (x, z) => terrain(x, z) + 0.11;
const shade = (color, f) => color.map((v) => Math.min(1, v * f));

function cap(out, slot, ring, height, color, subdivisions = 0) {
  const ys = typeof height === 'number' ? () => height : height;
  const indices = earcut(ring.flat());
  const emit = (a, b, c, remaining) => {
    if (remaining) {
      const ab = lerp(a, b, 0.5);
      const bc = lerp(b, c, 0.5);
      const ca = lerp(c, a, 0.5);
      emit(a, ab, ca, remaining - 1);
      emit(ab, b, bc, remaining - 1);
      emit(ca, bc, c, remaining - 1);
      emit(ab, bc, ca, remaining - 1);
      return;
    }
    triangle(
      out,
      slot,
      [a, b, c].map((p) => point(p, ys(...p))),
      color,
    );
  };
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((j) => ring[j]);
    const up = (b[1] - a[1]) * (c[0] - a[0]) > (b[0] - a[0]) * (c[1] - a[1]);
    emit(a, up ? b : c, up ? c : b, subdivisions);
  }
}
function boundary(out, slot, ring, y0, y1, color) {
  const getY = typeof y0 === 'number' ? () => y0 : y0;
  const area = ring.reduce((s, a, i) => {
    const b = ring[(i + 1) % ring.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const p = [
      point(a, Math.min(getY(...a), y1 - 0.032)),
      point(a, y1),
      point(b, y1),
      point(b, Math.min(getY(...b), y1 - 0.032)),
    ];
    face(out, slot, area > 0 ? p : p.reverse(), color);
  }
}
function platform(out, ring, height, color) {
  boundary(out, 'stone', ring, (x, z) => terrain(x, z) - 0.22, height, color);
  cap(out, 'stone', ring, height, color);
}
function trim(out, slot, ring, y0, y1, color) {
  boundary(out, slot, ring, y0, y1, color);
  cap(out, slot, ring, y1, color);
}

function onion(out, slot, x, z, y, r, h, color, lod, ribbed = false) {
  const sides = lod === 0 ? 6 : lod === 1 ? 8 : lod === 2 ? 16 : 24;
  const profile =
    lod === 0
      ? [
          [0, 0.9],
          [0.42, 1],
          [0.98, 0.08],
        ]
      : [
          [0, 0.78],
          [0.18, 1.01],
          [0.38, 1.05],
          [0.57, 0.89],
          [0.79, 0.58],
          [0.92, 0.3],
          [1, 0.055],
        ];
  const rings = profile.map(([v, k]) => {
    const ring = radialRing(y + v * h, r * k, r * k, sides, [x, z], Math.PI / 8);
    if (!ribbed || lod < 2) return ring;
    return ring.map(([a, b, c], i) => [
      mix(x, a, i % 2 ? 0.93 : 1),
      b,
      mix(z, c, i % 2 ? 0.93 : 1),
    ]);
  });
  loft(out, slot, rings, color, { cap: false });
  if (lod > 0)
    loft(
      out,
      slot,
      [
        radialRing(y + h * 0.98, r * 0.055, r * 0.055, 6, [x, z]),
        radialRing(y + h * 1.15, r * 0.021, r * 0.021, 6, [x, z]),
      ],
      color,
    );
}

function turret(out, x, z, y, h, r, wallColor, capColor, lod) {
  const ring = (dy, k) => radialRing(y + dy, r * k, r * k, 8, [x, z], Math.PI / 8);
  const breaks =
    lod === 0
      ? [
          [0, 1],
          [h, 0.83],
        ]
      : lod === 1
        ? [
            [0, 1.06],
            [h - 0.67, 0.83],
            [h, 0.97],
          ]
        : [
            [0, 1.08],
            [0.35, 1.08],
            [0.57, 1],
            [h - 1.08, 0.83],
            [h - 0.98, 1.02],
            [h - 0.78, 1.02],
            [h - 0.63, 0.86],
            [h, 0.86],
          ];
  loft(
    out,
    'plaster',
    breaks.map(([hy, k]) => ring(hy, k)),
    wallColor,
    { cap: false },
  );
  if (lod < 2) {
    const top = [x, y + h + r * 1.22, z];
    const base = ring(h, 0.96);
    for (let i = 0; i < base.length; i++)
      triangle(out, 'stone', [base[i], base[(i + 1) % base.length], top], capColor);
  } else {
    onion(out, 'stone', x, z, y + h, r * 0.95, r * 1.22, capColor, lod, true);
  }
}

function archCurve(width, height, segments, cusped) {
  const half = width / 2;
  const spring = height - (cusped ? height * 0.4 : height * 0.34);
  const rise = height - spring;
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments,
      x = mix(-half, half, t);
    const dome = Math.pow(Math.sin(Math.PI * t), 0.7);
    const scallop = cusped ? 0.91 + 0.09 * Math.cos(Math.PI * 10 * t) : 1;
    return [x, spring + rise * dome * scallop];
  });
}
/** Profiles are authored facing local +Z. Gate arches have a clear passage. */
function portal(
  out,
  { x, y, z, w, h, color = tint.light, trimWidth = 0.23, cusped = false, passage = 0 },
  lod,
) {
  const n = lod < 2 ? 4 : lod === 2 ? 12 : 20;
  const ring = archCurve(w, h, n, cusped);
  const map = (p, depth = 0) => [x + p[0], y + p[1], z + depth];
  const left = map([-w / 2, 0]),
    right = map([w / 2, 0]);
  if (!passage) {
    face(out, 'shade', [left, right, map(ring.at(-1)), map(ring[0])], tint.opening);
    const middle = map([0, ring[0][1] - 0.007]);
    for (let i = 0; i < n; i++)
      triangle(out, 'shade', [middle, map(ring[i + 1]), map(ring[i])], tint.shadow);
  }
  for (const edge of lod > 1 ? [-1, 1] : []) {
    const u = x + (edge * w) / 2;
    box(
      out,
      'stone',
      [u + Math.min(0, edge * trimWidth), y, z - 0.08],
      [u + Math.max(0, edge * trimWidth), y + ring[0][1], z + 0.12],
      color,
    );
  }
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[i + 1];
    const rim = (p) => map([p[0] * (1 + (2 * trimWidth) / w), p[1] + trimWidth], 0.12);
    if (lod > 0) face(out, 'stone', [map(a, 0.12), map(b, 0.12), rim(b), rim(a)], color);
    if (passage) {
      face(out, 'plaster', [map(a, -passage), map(b, -passage), map(b), map(a)], tint.old);
    }
  }
}

function bibiPari(out, lod) {
  const at = center(tomb),
    base = Math.max(terrain(...at) + 0.72, ...tomb.map((p) => terrain(...p) + 0.19));
  const h = plan.buildingHeights.tombWall;
  const s = dimensions.tombSquare / 2;
  platform(out, tomb, base, tint.cream);
  const body = transform(out, 0, [at[0], base, at[1]]);
  box(body, 'plaster', [-s, 0, -s], [s, h, s], tint.tomb);
  if (lod > 0)
    box(body, 'stone', [-s - 0.19, 0, -s - 0.19], [s + 0.19, 0.62, s + 0.19], tint.mortar);
  if (lod > 0)
    box(
      body,
      'plaster',
      [-s - 0.13, h - 0.65, -s - 0.13],
      [s + 0.13, h + 0.04, s + 0.13],
      tint.wall,
    );
  const drum = (yr, r) => radialRing(yr, r, r, 8, [0, 0], Math.PI / 8);
  loft(body, 'stone', [drum(h - 0.13, 3.45), drum(h + 1.7, 2.86)], tint.wall, { cap: false });
  onion(body, 'metal', 0, 0, h + 1.6, 2.74, 2.66, tint.patina, lod, true);
  for (const u of [-1, 1])
    for (const v of [-1, 1])
      turret(
        body,
        u * (s - 0.45),
        v * (s - 0.45),
        0,
        plan.buildingHeights.tombTurrets - 1.04,
        0.81,
        tint.tomb,
        tint.old,
        lod,
      );
  for (const angle of [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
    const front = transform(body, angle);
    box(front, 'plaster', [-3.06, 0, s - 0.14], [3.06, h + 0.28, s + 0.34], tint.light);
    if (lod === 0) continue;
    portal(front, { x: 0, y: 0.28, z: s + 0.36, w: 3.46, h: 4.76, cusped: true }, lod);
    for (const x of [-5.92, 5.92]) {
      portal(front, { x, y: 0.34, z: s + 0.026, w: 1.56, h: 2.96, trimWidth: 0.16 }, lod);
      if (lod > 1)
        box(front, 'plaster', [x - 1.09, 3.65, s - 0.014], [x + 1.09, 5.22, s + 0.07], tint.light);
    }
    for (const x of lod > 1 ? [-2.84, 2.84] : [])
      box(front, 'stone', [x - 0.15, 0.21, s + 0.24], [x + 0.15, h - 0.28, s + 0.47], tint.mortar);
    if (lod > 1) {
      for (const x of [-7.75, -4.28, 4.28, 7.75]) {
        box(front, 'stone', [x - 0.14, 1.04, s + 0.01], [x + 0.14, h - 0.76, s + 0.16], tint.wall);
      }
      for (const x of [-7.7, -4.45, 4.45, 7.7])
        box(
          front,
          'masonry',
          [x - 0.18, h - 0.58, s + 0.06],
          [x + 0.18, h - 0.37, s + 0.18],
          tint.old,
        );
    }
  }
}

function fortMosque(out, lod) {
  const at = center(mosque),
    base = terrain(...at) + 0.55;
  const body = transform(out, Math.PI / 2, [at[0], base, at[1]]);
  const x = dimensions.mosqueLength / 2,
    z = dimensions.mosqueWidth / 2;
  const h = plan.buildingHeights.mosqueParapet;
  const pad = [
    [at[0] - z - 1, at[1] - x - 1],
    [at[0] + z + 1, at[1] - x - 1],
    [at[0] + z + 1, at[1] + x + 1],
    [at[0] - z - 1, at[1] + x + 1],
  ];
  platform(out, pad, base - 0.08, tint.mortar);
  box(body, 'plaster', [-x, 0, -z], [x, h, z], tint.west);
  box(body, 'stone', [-x - 0.18, h - 0.46, -z - 0.18], [x + 0.18, h + 0.07, z + 0.18], tint.cream);
  for (const u of [-1, 0, 1]) {
    const cx = u * 6.18,
      r = u === 0 ? 2.82 : 2.26;
    const ring = (yr, k) => radialRing(yr, r * k, r * k, 8, [cx, 0], Math.PI / 8);
    if (lod > 0)
      loft(body, 'plaster', [ring(h, 0.93), ring(h + 0.72, 0.89)], tint.west, { cap: false });
    onion(
      body,
      'plaster',
      cx,
      0,
      h + (lod > 0 ? 0.63 : 0),
      r,
      u === 0 ? 3.05 : 2.27,
      tint.cream,
      lod,
      true,
    );
    if (lod > 0) {
      portal(
        body,
        {
          x: cx,
          y: 0.3,
          z: z + 0.06,
          w: u === 0 ? 2.62 : 1.96,
          h: u === 0 ? 4.6 : 3.51,
          cusped: true,
          color: tint.cream,
          trimWidth: 0.18,
        },
        lod,
      );
      box(
        body,
        'stone',
        [cx - (u === 0 ? 1.75 : 1.42), 4.72, z - 0.02],
        [cx + (u === 0 ? 1.75 : 1.42), 4.95, z + 0.21],
        tint.light,
      );
    }
  }
  for (const u of [-1, 1])
    for (const v of [-1, 1])
      turret(body, u * (x - 0.25), v * (z - 0.22), 0, h + 0.51, 0.58, tint.west, tint.cream, lod);
  if (lod > 1) {
    for (const sign of [-1, 1]) {
      const end = transform(body, sign * Math.PI * 0.5);
      for (const bay of [-2.6, 0, 2.6]) {
        box(
          end,
          'plaster',
          [bay - 0.85, 1.55, x + 0.016],
          [bay + 0.85, 4.22, x + 0.075],
          tint.light,
        );
      }
    }
  }
}

function bengalRoof(out, axes, y, halfLength, halfDepth, lod) {
  const { x, z } = axes;
  const count = lod === 0 ? 4 : lod === 1 ? 8 : 14;
  const cross = (u) => {
    const eave = y + 0.96 * (1 - u * u);
    const ridge = eave + 0.79 * (1 - u * u) + 0.31;
    return [
      [x + u * halfLength, eave, z - halfDepth],
      [x + u * halfLength, ridge, z],
      [x + u * halfLength, eave, z + halfDepth],
    ];
  };
  for (let i = 0; i < count; i++) {
    const a = cross(mix(-1, 1, i / count)),
      b = cross(mix(-1, 1, (i + 1) / count));
    face(out, 'masonry', [a[0], a[1], b[1], b[0]], tint.roof);
    face(out, 'masonry', [a[1], a[2], b[2], b[1]], tint.roof);
    for (const side of [0, 2]) {
      const p = [
        a[side],
        b[side],
        b[side].map((v, j) => (j === 1 ? v - 0.39 : v)),
        a[side].map((v, j) => (j === 1 ? v - 0.39 : v)),
      ];
      face(out, 'stone', side === 2 ? p : p.reverse(), tint.wall);
      if (lod > 1) {
        const c = a[side];
        beam(
          out,
          'stone',
          [c[0], c[1] - 0.6, mix(z, c[2], 0.91)],
          [c[0], c[1] - 0.27, c[2]],
          0.15,
          0.18,
          tint.old,
        );
      }
    }
  }
}
function dewaniAam(out, lod) {
  const at = center(museum),
    base = terrain(...at) + 0.66;
  const hallX = 70.58,
    hallZ = 19.18;
  platform(out, museum, base, tint.cream);
  trim(out, 'plaster', museum, base - 0.02, base + 3.62, tint.pink);
  box(out, 'plaster', [64.81, base + 3.38, 5.05], [76.1, base + 8.81, 33.35], tint.pink);
  box(out, 'stone', [64.55, base + 3.55, 4.84], [76.26, base + 3.83, 33.55], tint.old);
  box(out, 'stone', [64.7, base + 8.28, 4.85], [76.29, base + 8.54, 33.61], tint.old);
  const roof = transform(out, Math.PI / 2, [hallX, 0, hallZ]);
  bengalRoof(roof, { x: 0, z: 0 }, base + plan.buildingHeights.hallUpperEaves, 14.75, 6.18, lod);
  const vents = [
    [56.2, 7.56, 1.47],
    [56.35, 18.8, 2.08],
    [57.12, 24.63, 1.45],
  ];
  for (const [x, z, r] of lod === 0 ? vents.slice(1, 2) : vents)
    onion(out, 'plaster', x, z, base + 3.55, r, 0.66, tint.pink, lod);
  if (lod === 0) return;
  for (const [side, px] of [
    [-1, 64.69],
    [1, 76.13],
  ]) {
    const view = transform(out, (side * Math.PI) / 2, [px, base, hallZ]);
    for (const x of lod === 1 ? [-7, 0, 7] : [-10.2, -7, -3.83, 0, 3.83, 7, 10.2])
      portal(
        view,
        { x, y: 0.22, z: 0.06, w: 1.24, h: 2.71, trimWidth: 0.1, color: tint.wall },
        lod,
      );
    for (const x of [-3.08, 0, 3.08])
      portal(
        view,
        { x, y: 3.94, z: 0.07, w: 2.1, h: 3.67, cusped: true, trimWidth: 0.19, color: tint.cream },
        lod,
      );
    for (const x of lod > 1 ? [-10.05, 10.05] : [])
      portal(
        view,
        { x, y: 4.17, z: 0.07, w: 1.45, h: 3.34, trimWidth: 0.14, color: tint.wall },
        lod,
      );
    for (const x of lod > 1 ? [-4.63, -1.54, 1.54, 4.63] : [])
      box(view, 'stone', [x - 0.19, 3.92, 0], [x + 0.19, 7.46, 0.24], tint.cream);
  }
}

function segment(out, a, b, width, y0, y1, slot, color) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = ((b[1] - a[1]) * width) / (2 * len),
    nz = ((a[0] - b[0]) * width) / (2 * len);
  const sides = [
    [a[0] + nx, a[1] + nz],
    [b[0] + nx, b[1] + nz],
    [b[0] - nx, b[1] - nz],
    [a[0] - nx, a[1] - nz],
  ];
  const height = (p, h) => (typeof h === 'number' ? h : h(...p));
  const p = sides.map((q) => point(q, height(q, y1)));
  const q = sides.map((y) => point(y, height(y, y0)));
  face(out, slot, p, color);
  face(out, slot, [q[0], q[1], p[1], p[0]], color);
  face(out, slot, [q[2], q[3], p[3], p[2]], color);
}
const earthenBase = (x, z) => terrain(x, z) - 0.58;
function ramparts(out, lod) {
  const long = outerWall.slice(15);
  const stations = [...long, outerWall[0]];
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i],
      b = stations[i + 1];
    if (Math.abs((a[0] + b[0]) / 2 - gatePoint[0]) < 8.7 && Math.min(a[1], b[1]) > 107) continue;
    const overlap = 0.29 / Math.hypot(b[0] - a[0], b[1] - a[1]);
    const start = lerp(a, b, -overlap);
    const end = lerp(a, b, 1 + overlap);
    const wallTop = (x, z) =>
      terrain(x, z) + Math.min(dimensions.outerRampartHeight, Math.max(2.2, (z + 92) * 0.044));
    segment(
      out,
      start,
      end,
      dimensions.outerRampartThickness,
      earthenBase,
      wallTop,
      'masonry',
      shade(tint.wall, 0.9 + (i % 5) * 0.032),
    );
    if (lod > 0) {
      const crown = (x, z) => wallTop(x, z) + 0.29;
      segment(out, start, end, 1.64, wallTop, crown, 'stone', tint.old);
      if (lod > 1) {
        const cuts = Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2.85);
        for (let j = 0; j < cuts; j++) {
          const p = lerp(a, b, (j + 0.2) / cuts),
            q = lerp(a, b, (j + 0.48) / cuts);
          segment(out, p, q, 1.2, crown, (x, z) => crown(x, z) + 0.55, 'masonry', tint.wall);
        }
      }
    }
  }
  const innerTop = 9.3;
  trim(out, 'masonry', innerWall, earthenBase, innerTop, tint.old);
  if (lod > 0) {
    for (let i = 0; i < innerWall.length; i++) {
      const a = innerWall[i],
        b = innerWall[(i + 1) % innerWall.length];
      segment(out, a, b, 0.68, innerTop, innerTop + 0.34, 'stone', tint.mortar);
    }
  }
}

function southeastGate(out, lod) {
  const [x, z] = gatePoint,
    base = terrain(x, z) - 0.56;
  const body = transform(out, 0, [x, base, z - 2.05]);
  const w = 27.3,
    depth = 8.2,
    top = plan.buildingHeights.gateParapet;
  const throat = 4.3;
  box(body, 'plaster', [-w / 2, -0.3, -depth / 2], [-throat, top, depth / 2], tint.tomb);
  box(body, 'plaster', [throat, -0.3, -depth / 2], [w / 2, top, depth / 2], tint.tomb);
  box(body, 'plaster', [-throat, 8.03, -depth / 2], [throat, top, depth / 2], tint.tomb);
  const arch = archCurve(
    throat * 2,
    plan.buildingHeights.gateLowerArch,
    lod === 0 ? 6 : lod === 1 ? 10 : 20,
    false,
  );
  for (let i = 0; i < arch.length - 1; i++) {
    const a = arch[i],
      b = arch[i + 1],
      t = 8.05;
    face(
      body,
      'plaster',
      [
        [a[0], a[1], depth / 2],
        [b[0], b[1], depth / 2],
        [b[0], t, depth / 2],
        [a[0], t, depth / 2],
      ],
      tint.tomb,
    );
    face(
      body,
      'plaster',
      [
        [b[0], b[1], -depth / 2],
        [a[0], a[1], -depth / 2],
        [a[0], t, -depth / 2],
        [b[0], t, -depth / 2],
      ],
      tint.tomb,
    );
  }
  for (const side of [-1, 1]) {
    const f = transform(body, side === 1 ? 0 : Math.PI);
    portal(
      f,
      {
        x: 0,
        y: 0,
        z: depth / 2 + 0.02,
        w: throat * 2,
        h: plan.buildingHeights.gateLowerArch,
        passage: depth,
        trimWidth: 0.36,
      },
      lod,
    );
    for (const u of [-1, 1]) {
      const xx = u * 8.87;
      if (lod > 0) {
        portal(
          f,
          { x: xx, y: 0.54, z: depth / 2 + 0.03, w: 3.24, h: 5.45, color: tint.light },
          lod,
        );
        portal(
          f,
          {
            x: xx,
            y: 7.32,
            z: depth / 2 + 0.042,
            w: 2.17,
            h: 2.88,
            color: tint.light,
            cusped: true,
          },
          lod,
        );
        for (const y of [6.44, 10.69])
          box(
            f,
            'stone',
            [xx - 2.08, y, depth / 2 - 0.11],
            [xx + 2.08, y + 0.32, depth / 2 + 0.21],
            tint.old,
          );
      }
    }
  }
  box(
    body,
    'stone',
    [-w / 2 - 0.2, top - 0.13, -depth / 2 - 0.24],
    [w / 2 + 0.2, top + 0.48, depth / 2 + 0.22],
    tint.old,
  );
  for (const u of [-1, 1]) {
    turret(
      body,
      u * (w / 2 - 0.15),
      depth / 2 - 0.28,
      -0.2,
      top + 0.83,
      1.05,
      tint.tomb,
      tint.old,
      lod,
    );
    if (lod > 0)
      for (let i = 0; i < 7; i++) {
        const cx = u * (1.12 + i * 1.87);
        box(
          body,
          'masonry',
          [cx - 0.43, top + 0.43, depth / 2 - 0.3],
          [cx + 0.43, top + 1.23, depth / 2 + 0.13],
          tint.wall,
        );
      }
  }
}

function garden(out, lod) {
  for (const { ring, way } of gardens) {
    cap(
      out,
      'shade',
      ring,
      (x, z) => graded(x, z) + [0.48, 0.24, 0.155, 0.14][lod],
      shade(tint.grass, 0.89 + (way % 5) * 0.035),
      [0, 1, 2, 3][lod],
    );
    if (lod < 2) continue;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 9));
      for (let j = 0; j < count; j++) {
        segment(
          out,
          lerp(a, b, j / count),
          lerp(a, b, (j + 1) / count),
          0.43,
          graded,
          (x, z) => graded(x, z) + 0.59,
          'shade',
          tint.hedge,
        );
      }
    }
  }
  cap(out, 'shade', tank, graded, tint.pond);
  if (!lod) return;
  for (let i = 0; i < tank.length; i++) {
    const a = tank[i],
      b = tank[(i + 1) % tank.length];
    segment(out, a, b, 1.28, graded, (x, z) => graded(x, z) + 0.49, 'masonry', tint.wall);
  }
  for (const [x, z, w, d] of [
    [6.2, 22.4, 101.4, 4.25],
    [-46.8, 60.1, 4.3, 49.2],
    [-46.8, -18.9, 4.3, 57.1],
  ]) {
    const ring = [
      [x - w / 2, z - d / 2],
      [x + w / 2, z - d / 2],
      [x + w / 2, z + d / 2],
      [x - w / 2, z + d / 2],
    ];
    cap(out, 'stone', ring, (u, v) => graded(u, v) + 0.22, tint.path, Math.min(lod, 3));
  }
  for (const x of [-12.5, 12.6, 35.8]) {
    const z = 22.4,
      y = terrain(x, z) + 0.33;
    box(out, 'stone', [x - 1.42, y - 0.28, z - 1.53], [x + 1.42, y + 0.065, z + 1.53], tint.cream);
    box(out, 'shade', [x - 1.21, y + 0.045, z - 1.31], [x + 1.21, y + 0.084, z + 1.31], tint.pool);
  }
}

function build(out, lod) {
  bibiPari(out, lod);
  fortMosque(out, lod);
  dewaniAam(out, lod);
  ramparts(out, lod);
  southeastGate(out, lod);
  garden(out, lod);
}
export const lalbaghFortSkyline = (out) => build(out, 0);
export const lalbaghFortDistrict = (out) => build(out, 1);
export const lalbaghFortStreet = (out) => build(out, 2);
export const lalbaghFortCloseup = (out) => build(out, 3);

const recipe = 'lalbagh-fort-model.mjs';
const camera = [213, 116, 256],
  lookAt = [24, 6, 45];
export const lalbaghFortModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'fortification',
  build: lalbaghFortCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline: tomb,
    outlines: [tomb, mosque, museum, innerWall],
    minimumCoverage: 0.83,
    basis:
      'Separate mapped footprints of the three principal buildings and the inner masonry band.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Lalbagh Fort’s standing Mughal garden axis and southern fortified precinct, with Bibi Pari’s domed tomb, the three-domed mosque, the Bengal-roofed audience hall and hammam, and the southeast gateway.',
  camera,
  lookAt,
  sunDirection: [170, 158, 102],
  portableGroundY: -3.1,
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.95,
    cameraYaw: 0.35,
    focus: { center: [4, 4, 38] },
    groundY: -3.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'fort-precinct-and-southern-ramparts', position: camera, lookAt },
    { name: 'pari-bibi-tomb-and-turrets', position: [-19, 9, 60], lookAt: [-46, 5, 22.7] },
    { name: 'east-audience-hall-and-hammam', position: [97, 11, -15], lookAt: [65, 3.9, 18] },
    { name: 'three-domed-mosque-from-garden', position: [-83, 11, 12], lookAt: [-113, 7, 26] },
    { name: 'southeast-gate-arch-and-bastions', position: [154, 13, 164], lookAt: [135, 13, 119] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'lalbaghFortSkyline',
    errorMeters: 1.6,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'lalbaghFortDistrict', 0.76],
        ['street', 'lalbaghFortStreet', 0.26],
        ['closeup', 'lalbaghFortCloseup', 0.075],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original mesh informed by a CC0 Qualla photo and an official U.S. Navy public-domain reference. OpenStreetMap geometry is ODbL 1.0.',
  limitations: plan.limitations,
};
