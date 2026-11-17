import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  mappedSolid,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/signature-tower-expansion-models.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const site = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const parts = new Map(site.parts.map((p) => [p.id, p]));
const main = 52776559950000;
const stage = 52776561560000;

const ivory = [0.89, 0.85, 0.77];
const stone = [0.83, 0.79, 0.69];
const rose = [0.62, 0.32, 0.23];
const granite = [0.46, 0.38, 0.33];
const paving = [0.55, 0.49, 0.43];
const slate = [0.27, 0.28, 0.27];
const brass = [0.82, 0.64, 0.29];
const bronze = [0.45, 0.36, 0.21];
const glass = [0.08, 0.12, 0.14];
const instrument = [0.081, 0.088, 0.081];

export const surfaces = {
  tile: { slot: 'wall', graph: 'tile_ceramic' },
  trim: { slot: 'trim', graph: 'stone_limestone' },
  base: { slot: 'foundation', graph: 'stone_granite' },
  roof: { slot: 'roof', graph: 'metal_painted' },
  metal: { slot: 'trim', graph: 'metal_bronze_cast' },
  glass: { slot: 'window', name: 'Blue gray inset glazing', localRef: 'palette:#ffffff' },
};

const edges = (p) => p.map((a, i) => [a, p[(i + 1) % p.length]]);
const center = (p) => [0, 1].map((i) => p.reduce((n, q) => n + q[i] / p.length, 0));
const boxPlan = (x0, x1, z0, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];
const mag = ([x, z]) => Math.hypot(x, z);
const shift = ([x, z], [a, b]) => [x + a, z + b];

function tidy(points, tolerance = 0.065) {
  const p = [...points];
  for (let i = p.length - 1; i >= 0 && p.length > 4; i--) {
    const a = p[(i + p.length - 1) % p.length],
      b = p[i],
      c = p[(i + 1) % p.length];
    const [x, z] = [c[0] - a[0], c[1] - a[1]];
    if (
      mag([b[0] - a[0], b[1] - a[1]]) < 0.075 ||
      Math.abs(x * (b[1] - a[1]) - z * (b[0] - a[0])) < tolerance * Math.hypot(x, z)
    )
      p.splice(i, 1);
  }
  return clockwise(p);
}
const plan = (id, tolerance) => tidy(parts.get(id).polygons[0][0], tolerance);
function scale(p, factor) {
  const c = center(p);
  return p.map((q) => q.map((v, i) => c[i] + (v - c[i]) * factor));
}

function side(a, b) {
  const len = mag([b[0] - a[0], b[1] - a[1]]),
    dx = (b[0] - a[0]) / len,
    dz = (b[1] - a[1]) / len;
  const p = (u, y, w = 0) => [a[0] + u * dx - w * dz, y, a[1] + u * dz + w * dx];
  const pane = (out, slot, x0, x1, y0, y1, d, c) =>
    face(out, slot, [p(x0, y0, d), p(x1, y0, d), p(x1, y1, d), p(x0, y1, d)], c);
  return { len, p, pane };
}

function band(out, p, y, rise = 0.8, width = 0.018) {
  mappedSolid(out, 'trim', scale(p, 1 + width), y, y + rise, ivory);
}

function fenestrate(
  out,
  p,
  y0,
  y1,
  floors,
  detail,
  { pitch = 3.8, pilasters = false, grand = false, facades = edges(p) } = {},
) {
  if (detail === 2) floors = Math.ceil(floors * 0.55);
  const sy = (y1 - y0) / floors;
  for (const [i, [a, b]] of facades.entries()) {
    const f = side(a, b);
    if (f.len < 2.25) continue;
    const cols = Math.max(1, Math.round(f.len / (detail === 2 ? pitch * 1.52 : pitch)));
    const sx = f.len / cols,
      width = Math.min(0.85, sx * 0.24);
    for (let j = 0; j < cols; j++) {
      const x = sx * (j + 0.5);
      if (detail === 1) {
        f.pane(out, 'tile', x - width, x + width, y0, y1, 0.061, [0.6, 0.57, 0.51]);
        continue;
      }
      if (pilasters)
        f.pane(out, 'trim', j * sx + 0.16, j * sx + 0.54, y0 - 0.28, y1 + 0.24, 0.18, ivory);
      for (let row = 0; row < floors; row++) {
        const y = y0 + sy * (row + 0.19),
          high = y + sy * 0.62;
        const tint = 0.012 * ((i * 3 + j + row * 5) % 5);
        f.pane(
          out,
          'glass',
          x - width,
          x + width,
          y,
          high,
          0.11,
          glass.map((v) => v + tint),
        );
        if (detail >= 3 && (grand || row % 3 === 1)) {
          f.pane(out, 'trim', x - width - 0.14, x + width + 0.14, y - 0.105, y, 0.16, ivory);
          if (grand || detail >= 4)
            f.pane(out, 'metal', x - 0.055, x + 0.055, y, high, 0.17, bronze);
        }
        if (detail >= 4 && grand && row % 6 === 0) {
          f.pane(
            out,
            'tile',
            x - width - 0.12,
            x + width + 0.12,
            high + 0.14,
            high + 0.39,
            0.16,
            rose,
          );
        }
      }
    }
  }
}

function mass(
  out,
  p,
  bottom,
  top,
  detail,
  { windowLo = bottom + 2, floors = 0, pilasters = false, grand = false } = {},
) {
  mappedSolid(out, 'tile', p, bottom, top, stone);
  if (detail >= 1) {
    if (floors > 0) fenestrate(out, p, windowLo, top - 2.1, floors, detail, { pilasters, grand });
    if (detail >= 2) {
      if (detail === 2) {
        for (const [a, b] of edges(p)) {
          const f = side(a, b);
          f.pane(out, 'tile', 0, f.len, top - 1.97, top - 1.08, 0.055, rose);
          f.pane(out, 'trim', 0, f.len, top - 1.06, top - 0.28, 0.095, ivory);
        }
      } else {
        mappedSolid(out, 'tile', scale(p, 1.005), top - 1.97, top - 1.08, rose);
        band(out, p, top - 1.06, 0.75, 0.014);
      }
    }
  }
}

function pinnacles(out, p, y, h, detail) {
  const vertices = detail >= 3 ? 8 : 4;
  for (const [x, z] of p) {
    const rings =
      detail >= 3
        ? [
            [0, 1.05],
            [0.12, 1.05],
            [0.22, 0.78],
            [0.29, 0.58],
            [0.8, 0.35],
            [1, 0.14],
          ]
        : [
            [0, 1],
            [0.25, 0.65],
            [1, 0.12],
          ];
    loft(
      out,
      'trim',
      rings.map(([t, r]) =>
        radialRing(y + t * h, r * h * 0.18, r * h * 0.18, vertices, [x, z], Math.PI / 4),
      ),
      ivory,
    );
  }
}

function clockFace(out, [x, y, z], along, [nx, nz], isClock, detail) {
  const steps = detail >= 3 ? 36 : detail === 2 ? 12 : 10;
  const point = (angle, r, depth) => [
    x + along[0] * Math.cos(angle) * r + nx * depth,
    y + Math.sin(angle) * r,
    z + along[1] * Math.cos(angle) * r + nz * depth,
  ];
  const a = (i) => (Math.PI * 2 * i) / steps;
  for (let i = 0; i < steps; i++) {
    tri(
      out,
      'roof',
      [[x + nx * 0.28, y, z + nz * 0.28], point(a(i), 4.2, 0.28), point(a(i + 1), 4.2, 0.28)],
      instrument,
    );
    face(
      out,
      'metal',
      [
        point(a(i), 4.5, 0.52),
        point(a(i + 1), 4.5, 0.52),
        point(a(i + 1), 3.96, 0.4),
        point(a(i), 3.96, 0.4),
      ],
      brass,
    );
  }
  if (detail >= 1) {
    const markings = isClock ? 12 : 15;
    for (let t = 0; t < markings; t++) {
      const q = isClock
        ? (Math.PI * 2 * t) / 12
        : Math.PI * 0.23 + (Math.PI * 1.54 * t) / (markings - 1);
      const d = t % 3 === 0 ? 0.038 : 0.022;
      face(
        out,
        'metal',
        [
          point(q - d, 3.86, 0.5),
          point(q + d, 3.86, 0.5),
          point(q + d, 3.14, 0.46),
          point(q - d, 3.14, 0.46),
        ],
        brass,
      );
    }
    const hands = isClock
      ? [
          [2.27, 2.9],
          [0.52, 3.6],
        ]
      : [[1.03, 3.08]];
    for (const [angle, len] of hands) {
      const middle = [x + nx * 0.54, y, z + nz * 0.54],
        tip = point(angle, len, 0.56);
      if (detail >= 3) beam(out, 'metal', middle, tip, 0.22, 0.18, brass);
      else
        face(
          out,
          'metal',
          [point(angle - 0.1, 0.78, 0.52), point(angle + 0.1, 0.78, 0.52), tip, middle],
          brass,
        );
    }
  }
}

function sideInstruments(out, id, detail) {
  const p = plan(id, 0.25);
  const [x, z] = center(p);
  const signX = Math.sign(x),
    signZ = Math.sign(z);
  const outerX = signX * Math.max(...p.map((q) => q[0] * signX));
  const outerZ = signZ * Math.max(...p.map((q) => q[1] * signZ));
  const top = 83.9;
  mass(out, p, 67.9, top, detail, { windowLo: 69, floors: 3, pilasters: true, grand: true });
  const stage = scale(p, 0.57);
  mappedSolid(out, 'trim', stage, top - 0.12, top + 1.32, ivory);
  if (detail >= 2) {
    for (const [px, pz] of stage)
      tube(
        out,
        'trim',
        [px, top + 0.66, pz],
        [px, top + 6.05, pz],
        0.75,
        ivory,
        detail >= 3 ? 10 : 5,
      );
  } else {
    mappedSolid(out, 'trim', scale(stage, 0.88), top + 1.2, top + 6.1, ivory);
  }
  band(out, stage, top + 5.83, 0.76, 0.067);
  const cup = [
    [90.4, 0.99],
    [91.28, 1.22],
    [92.4, 2.35],
  ];
  loft(
    out,
    'metal',
    cup.map(([y, r]) => radialRing(y, r, r, detail >= 3 ? 8 : detail === 2 ? 6 : 4, [x, z])),
    bronze,
  );
  if (detail >= 1) pinnacles(out, scale(p, 0.92), top - 0.3, 3.55, detail);
  if (detail >= 1) {
    clockFace(out, [outerX, 77.9, z], [0, -signX], [signX, 0], false, detail);
    clockFace(out, [x, 77.9, outerZ], [signZ, 0], [0, signZ], true, detail);
  }
}

function splitAt(p, x, direction) {
  return tidy(
    edges(p).flatMap(([a, b]) => {
      const insideA = (a[0] - x) * direction >= 0,
        insideB = (b[0] - x) * direction >= 0;
      const cross =
        insideA === insideB ? [] : [[x, a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]];
      return insideA ? [a, ...cross] : cross;
    }),
  );
}

function depthAt(p, x) {
  const hits = edges(p)
    .filter(([a, b]) => a[0] < x !== b[0] < x)
    .map(([a, b]) => a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]));
  if (hits.length !== 2) throw Error('Passage is outside the narrow mapped connector');
  return hits.sort((a, b) => a - b);
}

function facadeOutsidePassage(a, b, center, half) {
  return [-1, 1].flatMap((sign) => {
    const limit = center + half * sign;
    const insideA = (a[0] - limit) * sign >= 0;
    const insideB = (b[0] - limit) * sign >= 0;
    if (insideA && insideB) return [[a, b]];
    if (!insideA && !insideB) return [];
    const c = [limit, a[1] + ((limit - a[0]) / (b[0] - a[0])) * (b[1] - a[1])];
    return [insideA ? [a, c] : [c, b]];
  });
}

function linkedRange(out, control, detail) {
  const { part, x, baseY } = control;
  const p = plan(part, detail === 0 ? 3.05 : detail === 2 ? 0.65 : 0.08),
    half = 4.02;
  const top = baseY + 8.13;
  for (const sign of [-1, 1])
    mappedSolid(out, 'tile', splitAt(p, x + half * sign, sign), -6, top, stone);
  mass(out, p, top, 35, detail, { windowLo: top + 0.15, floors: detail >= 2 ? 3 : 0 });
  if (detail >= 3) {
    // Keep the lower window geometry on the solid sides of the drive-through arch.
    const facades = edges(p)
      .filter(([a, b]) => mag([a[0] - b[0], a[1] - b[1]]) >= 22)
      .flatMap(([a, b]) => facadeOutsidePassage(a, b, x, half));
    fenestrate(out, p, 10, top - 0.27, 5, detail, { pitch: 4.15, facades });
  }
  const steps = detail >= 3 ? 10 : detail >= 1 ? 6 : 2;
  let last;
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI * (1 - i / steps),
      px = x + half * Math.cos(a),
      [z0, z1] = depthAt(p, px);
    const y = baseY + 4.28 + Math.sin(a) * 3.26;
    const row = [
      [px, y, z0],
      [px, y, z1],
      [px, top, z0],
      [px, top, z1],
    ];
    if (last) {
      face(out, 'trim', [last[0], last[2], row[2], row[0]], ivory);
      face(out, 'trim', [last[1], row[1], row[3], last[3]], ivory);
      face(out, 'trim', [last[0], row[0], row[1], last[1]], ivory);
    }
    last = row;
  }
}

function terminal(out, id, detail) {
  const p = plan(id, detail === 0 ? 1.04 : 0.08),
    head = scale(p, 0.76);
  mass(out, p, -7, 44.85, detail, { windowLo: 12, floors: 9, pilasters: true });
  if (detail === 0) {
    mappedSolid(out, 'tile', head, 44.72, 50, stone);
  } else {
    const roof = scale(head, 1.08);
    band(out, p, 44.75, 0.68, 0.02);
    mappedSolid(out, 'tile', head, 44.7, 49.25, stone);
    fenestrate(out, head, 45.1, 49.1, 1, detail, { pitch: 3.9, pilasters: true, grand: true });
    mappedSolid(out, 'roof', roof, 49, 50.1, slate);
    if (detail >= 2) pinnacles(out, scale(p, 0.71), 50.06, 1.87, detail);
  }
}

function terrace(out, definition, detail) {
  const { x, rows } = definition;
  const points = rows.map(({ z, heights }) => x.map((a, i) => [a, heights[i] + 0.14, z]));
  const stride = detail === 0 ? 6 : 1;
  for (let j = stride; j < points.length + stride; j += stride) {
    const near = points[j - stride];
    const far = points[Math.min(j, points.length - 1)];
    if (near === far) continue;
    for (let i = stride; i < x.length + stride; i += stride) {
      const a = i - stride,
        b = Math.min(i, x.length - 1);
      if (a === b) continue;
      const z = near[0][2];
      const front = [near[a], near[b], far[b], far[a]];
      if (detail >= 2 && z > 126) {
        const heights = [a, b].map((i) => Math.max(near[i][1], far[i][1]));
        const tops = [a, b].map((i, k) => [near[i][0], heights[k], z]);
        face(
          out,
          'base',
          [
            tops[0],
            tops[1],
            [far[b][0], heights[1], far[b][2]],
            [far[a][0], heights[0], far[a][2]],
          ],
          paving,
        );
        const rises = tops.map((p, k) => p[1] - near[k === 0 ? a : b][1]);
        if (rises[0] > 0.015) tri(out, 'base', [near[a], tops[1], tops[0]], granite);
        if (rises[1] > 0.015) tri(out, 'base', [near[a], near[b], tops[1]], granite);
      } else {
        face(out, 'base', z > far[0][2] ? front : front.toReversed(), paving);
      }
    }
  }
}

function ceremonialHall(out, detail) {
  const rear = plan(main + 5905, detail === 0 ? 1.6 : 0.1);
  const front = plan(stage + 5572, 0.1);
  mass(out, rear, -5, 22.5, detail, { windowLo: 9.8, floors: 3, pilasters: true, grand: true });
  mass(out, front, -5, 24.25, detail, { windowLo: 11, floors: 3, pilasters: true, grand: true });
  const roof = plan(stage + 5581, detail === 0 ? 0.45 : 0.1);
  mappedSolid(out, 'tile', roof, 22.9, 25.4, ivory);
  if (detail >= 1) {
    mappedSolid(out, 'tile', scale(roof, 1.012), 23.45, 24.05, rose);
    band(out, roof, 24.94, 0.68, 0.01);
  }
  for (const [p] of parts.get(stage + 5571).polygons) {
    const [x, z] = center(p);
    const y = 5.2 + 0.1 * x;
    tube(
      out,
      'trim',
      [x, y, z],
      [x, 23.46, z],
      0.85,
      ivory,
      detail >= 3 ? 16 : detail >= 2 ? 8 : 4,
    );
    if (detail >= 2) {
      box(out, 'base', [x - 1.13, y, z - 1.13], [x + 1.13, y + 0.4, z + 1.13], granite);
      box(out, 'trim', [x - 1.18, 22.67, z - 1.18], [x + 1.18, 23.42, z + 1.18], ivory);
    }
  }
  const rearLanding = boxPlan(-22, 22, -91.5, -85.5);
  mappedSolid(out, 'base', rearLanding, 1, 8.2, paving);
  if (detail >= 2) {
    const f = side([-16.2, 85.7], [16.3, 85.7]);
    for (let j = 0; j < 5; j++) {
      const x = 4.04 + j * 6.21,
        y = 7.35 + (j - 2) * 0.71;
      f.pane(out, 'metal', x - 2.09, x + 2.09, y, 14.35, 0.14, bronze);
      f.pane(out, 'glass', x - 1.81, x + 1.81, y + 0.55, 13.82, 0.165, glass);
      f.pane(out, 'metal', x - 0.06, x + 0.06, y + 0.38, 13.81, 0.19, bronze);
    }
  }
  for (const d of [site.forecourt.front, site.forecourt.rear]) terrace(out, d, detail);
}

function centerTower(out, detail) {
  const shaft = plan(stage + 2794, detail === 0 ? 1.15 : 0.1);
  const upper = plan(main + 5918, detail === 0 ? 0.52 : 0.1);
  mass(out, shaft, -9, 109.95, detail, { windowLo: 24, floors: 24, pilasters: true, grand: true });
  const shoulder = scale(shaft, 0.96);
  if (detail >= 1) {
    mappedSolid(out, 'tile', scale(shaft, 1.009), 105.9, 108.2, rose);
    band(out, shaft, 109.1, 1.05, 0.027);
    for (const [p] of parts.get(stage + 6783).polygons) {
      const plinth = tidy(p);
      mappedSolid(out, 'trim', plinth, 109.8, 113.6, ivory);
      mappedSolid(out, 'trim', scale(plinth, 0.72), 113.5, 117.1, stone);
      const [x, z] = center(plinth);
      const h = detail >= 3 ? 5.7 : 4.6;
      pinnacles(out, [[x, z]], 116.9, h, detail);
      if (detail >= 4) {
        const y = 121.8;
        sphere(out, 'trim', [x, y - 0.11, z], [0.42, 0.69, 0.4], ivory, 8, 5);
        beam(out, 'trim', [x, 118.2, z], [x + 0.63, 120.3, z + 0.16], 0.61, 0.49, ivory);
      }
    }
    if (detail >= 3) {
      for (const [a, b] of edges(shoulder)) {
        const f = side(a, b);
        if (f.len > 10)
          for (let x = 1.2; x < f.len - 1.15; x += 1.77)
            f.pane(out, 'trim', x - 0.17, x + 0.17, 106.1, 108.05, 0.46, ivory);
      }
    }
  }
  mass(out, upper, 109.85, 139.6, detail, {
    windowLo: 111.2,
    floors: 8,
    pilasters: true,
    grand: true,
  });
  const lantern = plan(stage + 6780, detail === 0 ? 0.65 : 0.1);
  const crown = plan(stage + 6781, detail === 0 ? 0.65 : 0.1);
  mass(out, lantern, 139.55, 153.25, detail, { windowLo: 141.1, floors: 3, grand: true });
  mass(out, crown, 152.85, 175.8, detail, {
    windowLo: 154.6,
    floors: 5,
    pilasters: true,
    grand: true,
  });
  const top = plan(main + 5917, detail === 0 ? 0.52 : 0.1);
  mappedSolid(out, 'trim', top, 175.15, 182.05, ivory);
  if (detail >= 1) {
    band(out, upper, 137.4, 1.03, 0.055);
    const offsets = [
      [-14, -13],
      [14, -13],
      [-14, 13],
      [14, 13],
    ];
    pinnacles(out, offsets, 139.7, 9.12, detail);
    band(out, top, 180.9, 1.22, 0.089);
    if (detail >= 2) {
      const h = 135.1;
      for (const z of [-18.04, 18.14]) {
        const coeff = Math.sign(z);
        tube(out, 'metal', [0, h, z - 0.18 * coeff], [0, h, z + 0.49 * coeff], 2.7, bronze, 12);
        const c = [0, h, z + 0.6 * coeff];
        const ringSides = detail === 2 ? 10 : 24;
        const rim = Array.from({ length: ringSides }, (_, i) =>
          shift(
            [
              2.68 * Math.cos((i * 2 * Math.PI) / ringSides),
              2.68 * Math.sin((i * 2 * Math.PI) / ringSides),
            ],
            [0, h],
          ),
        );
        beamPath(
          out,
          'metal',
          rim.map(([x, y]) => [x, y, c[2]]),
          0.28,
          0.18,
          brass,
          true,
        );
      }
    }
  }
}

function shaftSpire(out, detail) {
  const stages = [
    [181.66, 5.25],
    [183.2, 5.15],
    [185.8, 3.45],
    [187.4, 3.03],
    [189.35, 3.12],
    [191.55, 4.03],
    [194.2, 4.29],
    [195.35, 3.71],
    [196.5, 2.31],
    [199.5, 1.92],
    [207.8, 1.68],
    [221.5, 0.97],
    [231.8, 0.61],
    [234.9, 0.43],
    [236.4, 0.26],
  ];
  const used = detail >= 1 ? stages : stages.filter((_, i) => i % 2 === 0);
  loft(
    out,
    'metal',
    used.map(([h, r]) =>
      radialRing(
        h,
        r,
        r,
        detail >= 3 ? 12 : detail === 2 ? 10 : detail === 1 ? 6 : 4,
        [0, 0],
        Math.PI / 6,
      ),
    ),
    brass,
  );
  if (detail >= 2) {
    for (let i = 0; i < 10; i++) {
      const q = (i * Math.PI) / 5;
      const at = (r, y) => [r * Math.cos(q), y, r * Math.sin(q)];
      beam(out, 'metal', at(3.08, 187.45), at(4.2, 193.58), 0.23, 0.21, bronze);
      beam(out, 'metal', at(1.73, 202), at(0.61, 231.75), 0.13, 0.095, bronze);
    }
  }
  const y = 236.04,
    r = 3.96;
  const star = Array.from({ length: 10 }, (_, i) => {
    const a = Math.PI / 2 + (i * Math.PI) / 5,
      k = i % 2 ? r * 0.44 : r;
    return [k * Math.cos(a), y + k * Math.sin(a)];
  });
  for (let i = 0; i < star.length; i++) {
    const [a, b] = [star[i], star[(i + 1) % star.length]];
    tri(
      out,
      'metal',
      [
        [0, y, 0.39],
        [...a, 0.18],
        [...b, 0.18],
      ],
      brass,
    );
    tri(
      out,
      'metal',
      [
        [0, y, -0.39],
        [...b, -0.18],
        [...a, -0.18],
      ],
      brass,
    );
    if (detail >= 1)
      face(
        out,
        'metal',
        [
          [...a, -0.18],
          [...b, -0.18],
          [...b, 0.18],
          [...a, 0.18],
        ],
        bronze,
      );
  }
  if (detail >= 2) {
    for (const sign of [-1, 1]) {
      const stalk = [
        [0, y - 4.55, 0.04],
        [sign * 3.31, y - 3.49, 0.04],
        [sign * 4.21, y - 1.05, 0.04],
        [sign * 4.36, y + 1.64, 0.04],
        [sign * 3.74, y + 2.66, 0.04],
      ];
      beamPath(out, 'metal', stalk, 0.25, 0.21, brass);
      if (detail >= 3)
        for (const [x, h, z] of stalk.slice(1)) {
          beam(out, 'metal', [x, h, z], [x * 1.06, h + 0.8, z + 0.24], 0.23, 0.14, brass);
          beam(out, 'metal', [x, h, z], [x * 0.84, h + 0.71, z - 0.16], 0.2, 0.14, brass);
        }
    }
  }
}

function build(out, detail) {
  const tolerance = detail === 2 ? 0.71 : 0.08;
  for (const id of [main + 5907, main + 5908]) {
    const p = plan(id, tolerance);
    mass(out, p, -9, 69.95, detail, { windowLo: 19.5, floors: 15, pilasters: true });
  }
  for (const id of [main + 5960, main + 5961, main + 5962, main + 5964])
    sideInstruments(out, id, detail);
  for (const passage of site.forecourt.passages) linkedRange(out, passage, detail);
  for (const id of [main + 5913, main + 5914, main + 5915, main + 5916]) terminal(out, id, detail);
  ceremonialHall(out, detail);
  centerTower(out, detail);
  shaftSpire(out, detail);
}

function distantCampus(out, detail) {
  const ranges = [
    [
      [-113, -55],
      [-86, -55],
      [-86, -8],
      [-33, -8],
      [-33, 9],
      [-86, 9],
      [-86, 60],
      [-114, 60],
    ],
    [
      [33, -8],
      [80, -8],
      [80, -56],
      [108, -56],
      [108, 60],
      [81, 60],
      [81, 10],
      [33, 10],
    ],
  ];
  for (const p of ranges)
    mass(out, clockwise(p), -8, 69.95, detail, { windowLo: 19.5, floors: 15 });
  for (const passage of site.forecourt.passages) {
    linkedRange(out, passage, 0);
    if (detail === 1) {
      const p = plan(passage.part, 3.05);
      fenestrate(out, p, passage.baseY + 8.3, 33.4, 3, detail, { pitch: 6.1 });
    }
  }
  for (const id of [main + 5913, main + 5914, main + 5915, main + 5916]) {
    const actual = plan(id);
    const xs = actual.map((q) => q[0]),
      zs = actual.map((q) => q[1]);
    const p = boxPlan(Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs));
    mass(out, p, -7, 44.85, detail, { windowLo: 12, floors: 9 });
    mappedSolid(out, 'tile', scale(p, 0.74), 44.82, 50.1, ivory);
  }
  for (const id of [main + 5960, main + 5961, main + 5962, main + 5964]) {
    if (detail === 1) {
      sideInstruments(out, id, detail);
    } else {
      const p = plan(id, 0.45);
      mappedSolid(out, 'tile', p, 69.88, 83.9, stone);
      mappedSolid(out, 'trim', scale(p, 0.57), 83.89, 92.4, ivory);
    }
  }
  const shaft = clockwise([
    [-28, -27],
    [29, -27],
    [29, -8],
    [33, -8],
    [33, 9],
    [29, 9],
    [29, 27],
    [-28, 27],
    [-28, 10],
    [-33, 10],
    [-33, -8],
    [-28, -8],
  ]);
  mass(out, shaft, -8, 110, detail, { windowLo: 24, floors: 21 });
  for (const [x, z, y0, y1] of [
    [17.2, 18, 109.9, 139.6],
    [12.25, 12.2, 139.55, 153.25],
    [9.65, 9.7, 153.2, 175.8],
    [7.65, 7.4, 175.4, 182.05],
  ])
    mass(out, boxPlan(-x, x, -z, z), y0, y1, detail, { windowLo: y0 + 0.2, floors: 2 });
  if (detail === 1)
    pinnacles(
      out,
      [
        [-14, -13],
        [14, -13],
        [-14, 13],
        [14, 13],
      ],
      139.6,
      9.12,
      1,
    );
  for (const [a, b, c, d, h] of [
    [-31, 32, -88, -24, 22.5],
    [-17, 17, 23, 85.6, 24.25],
  ])
    mass(out, boxPlan(a, b, c, d), -5, h, detail, { windowLo: 11, floors: 3 });
  mappedSolid(out, 'trim', boxPlan(-22, 23, 69, 91), 22.9, 25.4, ivory);
  if (detail === 1) {
    for (const [p] of parts.get(stage + 5571).polygons) {
      const [x, z] = center(p);
      tube(out, 'trim', [x, 5.2 + 0.1 * x, z], [x, 23.46, z], 0.85, ivory, 4);
    }
  }
  for (const d of [site.forecourt.front, site.forecourt.rear]) terrace(out, d, 0);
  shaftSpire(out, detail);
}

export const buildSkyline = (out) => distantCampus(out, 0);
export const buildDistrict = (out) => distantCampus(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
