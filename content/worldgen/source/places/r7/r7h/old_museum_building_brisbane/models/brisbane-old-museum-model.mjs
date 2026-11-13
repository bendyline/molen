/** The 2019 exterior of Brisbane's former Exhibition Building and Concert Hall. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  s = plan.section;
const [outline] = read('map-frame').geometry.polygons;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.92, metallic: 0 },
  band: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.92, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'brick_glazed', roughness: 0.83, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.83, metallic: 0.2 },
  cap: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.73, metallic: 0.24 },
  sash: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.42, metallic: 0.06 },
};
const c = Object.fromEntries(
  Object.entries({
    wall: 'a66848',
    darkBrick: '824b39',
    lightBrick: 'bb8056',
    cream: 'd7bf8d',
    shadowCream: 'af986e',
    plinth: '695252',
    stone: 'a18e74',
    roof: '858e92',
    cap: '64737a',
    sash: 'd6d4c2',
    glass: '4c5a60',
    door: '403731',
    bandDark: '6d6050',
    cavity: '3e3b34',
  }).map(([k, v]) => [k, rgb(v)]),
);
const up = [0, 1, 0],
  down = [0, -1, 0],
  white = 'palette:#ffffff';
const tint = (color, seed) => color.map((v) => v * (0.94 + ((seed * 13) % 17) / 145));

function face(out, slot, points, expected, color) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      white,
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}

const facade = (axis, line, sign) =>
  axis === 'z'
    ? { at: (x, y, d = 0) => [x, y, line + d * sign], n: [0, 0, sign], tangent: [1, 0, 0] }
    : { at: (z, y, d = 0) => [line + d * sign, y, z], n: [sign, 0, 0], tangent: [0, 0, 1] };

function panel(out, slot, f, a, b, base, top, color, depth = 0) {
  if (b - a < 1e-6 || top - base < 1e-6) return;
  face(
    out,
    slot,
    [f.at(a, base, depth), f.at(b, base, depth), f.at(b, top, depth), f.at(a, top, depth)],
    f.n,
    color,
  );
}

function ledge(out, slot, f, a, b, y, height, depth, color) {
  beam(out, slot, f.at(a, y, depth * 0.34), f.at(b, y, depth * 0.34), depth, height, color);
}

function arch(out, f, window, lod, topOfWall, simple = false) {
  const { x, width, low, spring, rise, door } = window;
  const radius = width / 2,
    a = x - radius,
    b = x + radius,
    depth = lod && !simple ? -0.22 : 0.009;
  const glass = door ? c.door : c.glass;
  const count = [3, 5, 8, 12][lod];
  const at = (index, extra = 0, d = 0) => {
    const t = (Math.PI * index) / count;
    return f.at(x - (radius + extra) * Math.cos(t), spring + (rise + extra) * Math.sin(t), d);
  };
  panel(out, 'sash', f, a, b, low, spring, glass, depth);
  for (let i = 0; i < count; i++) {
    face(
      out,
      'sash',
      [f.at(x, spring - 0.012, depth), at(i, 0, depth), at(i + 1, 0, depth)],
      f.n,
      glass,
    );
    if (!lod) continue;
    const p = (Math.PI * i) / count,
      q = (Math.PI * (i + 1)) / count;
    const u = x - radius * Math.cos(p),
      v = x - radius * Math.cos(q);
    if (!simple) {
      face(out, 'brick', [at(i), at(i + 1), f.at(v, topOfWall), f.at(u, topOfWall)], f.n, c.wall);
      face(
        out,
        'brick',
        [at(i), at(i, 0, depth), at(i + 1, 0, depth), at(i + 1)],
        down,
        c.darkBrick,
      );
    }
    const bead = door ? 0.37 : width > 1.9 ? 0.33 : 0.105;
    const inner = simple ? 0.03 : 0.0;
    const border = i % 2 === 0 ? c.cream : c.lightBrick;
    face(
      out,
      'band',
      [at(i, inner, 0.026), at(i + 1, inner, 0.026), at(i + 1, bead, 0.026), at(i, bead, 0.026)],
      f.n,
      border,
    );
  }
  if (!lod) return;
  for (const [u, sign] of [
    [a, 1],
    [b, -1],
  ]) {
    if (!simple) {
      face(
        out,
        'brick',
        [f.at(u, low), f.at(u, spring), f.at(u, spring, depth), f.at(u, low, depth)],
        f.tangent.map((v) => v * sign),
        c.darkBrick,
      );
    }
    panel(
      out,
      'band',
      f,
      Math.min(u, u + sign * 0.08),
      Math.max(u, u + sign * 0.08),
      low,
      spring,
      c.cream,
      0.031,
    );
  }
  if (!door) {
    ledge(out, 'band', f, a - 0.16, b + 0.16, low - 0.07, 0.14, 0.24, c.shadowCream);
    if (lod >= 2) {
      const inside = simple ? 0.016 : depth + 0.03;
      beam(
        out,
        'band',
        f.at(x, low + 0.05, inside),
        f.at(x, spring + rise - 0.05, inside),
        width > 1.9 ? 0.21 : 0.051,
        width > 1.9 ? 0.18 : 0.058,
        width > 1.9 ? c.shadowCream : c.sash,
      );
      for (const y of [low + (spring - low) * 0.32, low + (spring - low) * 0.65, spring]) {
        beam(
          out,
          'band',
          f.at(a + 0.04, y, inside),
          f.at(b - 0.04, y, inside),
          0.049,
          0.062,
          c.sash,
        );
      }
    }
  }
}

function archRow(out, f, left, right, floor, top, windows, lod) {
  if (!lod) panel(out, 'brick', f, left, right, floor, top, c.wall);
  let previous = left;
  for (const window of windows) {
    const a = window.x - window.width / 2,
      b = window.x + window.width / 2;
    if (lod) {
      panel(out, 'brick', f, previous, a, floor, top, c.wall);
      panel(out, 'brick', f, a, b, floor, window.low, c.wall);
    }
    arch(out, f, window, lod, top);
    previous = b;
  }
  if (lod) panel(out, 'brick', f, previous, right, floor, top, c.wall);
}

function pier(out, f, x, base, top, width, lod) {
  const p = f.at(x, base, 0.34),
    w = f.n[0] ? 0.89 : width,
    d = f.n[2] ? 0.89 : width;
  box(out, 'brick', p[0], base, p[2], w, top - base, d, c.darkBrick);
  if (!lod) return;
  const stride = lod === 1 ? 1.19 : 0.86;
  for (let y = base + 0.28; y < top - 0.13; y += stride) {
    if (lod === 1) panel(out, 'band', f, x - width / 2, x + width / 2, y, y + 0.22, c.cream, 0.793);
    else box(out, 'band', p[0], y, p[2], w + 0.025, 0.22, d + 0.025, c.cream);
  }
  box(out, 'band', p[0], top - 0.14, p[2], w + 0.27, 0.17, d + 0.24, c.bandDark);
}

function reduceLine(points, tolerance) {
  const first = points[0],
    last = points.at(-1);
  const dx = last[0] - first[0],
    dz = last[1] - first[1],
    span = dx * dx + dz * dz;
  let far = -1,
    distance = tolerance;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, z] = points[i],
      t = span ? Math.max(0, Math.min(1, ((x - first[0]) * dx + (z - first[1]) * dz) / span)) : 0;
    const d = Math.hypot(x - first[0] - t * dx, z - first[1] - t * dz);
    if (d > distance) {
      far = i;
      distance = d;
    }
  }
  return far < 0
    ? [first, last]
    : [
        ...reduceLine(points.slice(0, far + 1), tolerance).slice(0, -1),
        ...reduceLine(points.slice(far), tolerance),
      ];
}

function plinth(out, lod) {
  const ring =
    lod === 3
      ? outline
      : reduceLine([...outline, outline[0]], [1.96, 1.02, 0.33][lod]).slice(0, -1);
  const cross = ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.035) continue;
    const outward = [(b[1] - a[1]) * Math.sign(cross), 0, (a[0] - b[0]) * Math.sign(cross)];
    face(
      out,
      'foundation',
      [
        [a[0], s.foundation, a[1]],
        [b[0], s.foundation, b[1]],
        [b[0], s.basementTop, b[1]],
        [a[0], s.basementTop, a[1]],
      ],
      outward,
      tint(c.plinth, i),
    );
  }
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const p = indices.slice(i, i + 3).map((j) => [ring[j][0], s.basementTop, ring[j][1]]);
    face(out, 'band', p, up, c.stone);
  }
}

function gableRoof(out, bounds, eave, ridge, along, lod) {
  const [left, right, rear, front] = bounds;
  const [a, b, lo, hi] = along === 'x' ? [left, right, rear, front] : [rear, front, left, right];
  const mid = (lo + hi) / 2,
    at = (u, y, v) => (along === 'x' ? [u, y, v] : [v, y, u]);
  for (const z of [lo - 0.16, hi + 0.16]) {
    face(
      out,
      'roof',
      [
        at(a - 0.13, eave, z),
        at(b + 0.13, eave, z),
        at(b + 0.13, ridge, mid),
        at(a - 0.13, ridge, mid),
      ],
      up,
      c.roof,
    );
  }
  for (const [u, sign] of [
    [a, -1],
    [b, 1],
  ]) {
    const n = along === 'x' ? [sign, 0, 0] : [0, 0, sign];
    face(
      out,
      'brick',
      [at(u, eave - 0.012, lo), at(u, eave - 0.012, hi), at(u, ridge - 0.015, mid)],
      n,
      c.darkBrick,
    );
  }
  if (lod)
    beam(
      out,
      'cap',
      at(a - 0.09, ridge + 0.026, mid),
      at(b + 0.09, ridge + 0.026, mid),
      0.21,
      0.12,
      c.cap,
    );
}

function hall(out, bounds, eave, ridge, along, lod) {
  const [l, r, rear, front] = bounds;
  for (const [f, a, b, major] of [
    [facade('z', rear, -1), l, r, along === 'x'],
    [facade('z', front, 1), l, r, along === 'x'],
    [facade('x', l, -1), rear, front, along === 'z'],
    [facade('x', r, 1), rear, front, along === 'z'],
  ]) {
    const count = lod ? Math.round((b - a) / (major ? 6.9 : 8.4)) : Math.ceil((b - a) / 14);
    const bay = (b - a) / count,
      windows = [];
    for (let i = 0; i < count; i++) {
      windows.push({
        x: a + (i + 0.5) * bay,
        width: major ? 2.5 : 2.24,
        low: 2.3,
        spring: eave - 3.22,
        rise: 1.13,
      });
      if (lod && major && i > 0)
        pier(out, f, a + i * bay, s.basementTop, eave - 0.31, 0.6, lod >= 2 ? lod : 0);
    }
    archRow(out, f, a, b, s.basementTop + 0.012, eave - 0.044, windows, lod >= 2 ? 1 : 0);
    if (lod) {
      ledge(out, 'band', f, a, b, eave - 0.15, 0.27, 0.22, c.bandDark);
      for (const y of [1.12, 1.68, eave - 0.65]) {
        panel(out, 'band', f, a, b, y, y + 0.18, c.cream, 0.013);
      }
    }
  }
  gableRoof(out, bounds, eave, ridge, along, lod);
}

function frontPanel(out, f, left, right, low, high, lod, depth) {
  const center = (left + right) / 2,
    w = right - left;
  const span = w / 5;
  const openings = Array.from({ length: 5 }, (_, i) => ({
    x: left + (i + 0.5) * span,
    width: span * 0.62,
    low: low + 0.79,
    spring: high - 1.96,
    rise: span * 0.27,
  }));
  if (lod === 1) {
    panel(out, 'brick', f, left, right, low, high, c.wall);
    for (const opening of openings) arch(out, f, opening, lod, high, true);
  } else {
    archRow(out, f, left, right, low, high, openings, lod);
  }
  for (let i = 0; i <= 5; i++) {
    if (lod || i % 5 === 0)
      pier(out, f, left + span * i, low, high + 0.16, i % 5 ? 0.72 : 1.05, lod);
  }
  for (const y of [low + 0.46, low + 1.36, high - 0.24]) {
    if (lod) ledge(out, 'band', f, left, right, y, y < high - 1 ? 0.13 : 0.24, 0.18, c.shadowCream);
  }
  for (const [u, sign] of [
    [left, -1],
    [right, 1],
  ]) {
    face(
      out,
      'brick',
      [f.at(u, low), f.at(u, low, -depth), f.at(u, high, -depth), f.at(u, high)],
      f.tangent.map((v) => v * sign),
      c.wall,
    );
  }
  face(
    out,
    'cap',
    [f.at(left, high), f.at(right, high), f.at(right, high, -depth), f.at(left, high, -depth)],
    up,
    c.cap,
  );
  const roofPeak = high + 5.15;
  const count = lod ? 7 : 4,
    profileDepth = Math.min(depth, 0.89);
  for (let i = 0; i < count; i++) {
    const d = w * 0.38 * (1 - i / count),
      a = center - d,
      b = center + d;
    const y0 = high + ((roofPeak - high) * i) / count,
      y1 = high + ((roofPeak - high) * (i + 1)) / count;
    panel(out, 'brick', f, a, b, y0, y1, c.wall);
    if (!lod) continue;
    const next = w * 0.38 * (1 - (i + 1) / count);
    for (const [u, end, sign] of [
      [a, center - next, -1],
      [b, center + next, 1],
    ]) {
      face(
        out,
        'brick',
        [f.at(u, y0), f.at(u, y0, -profileDepth), f.at(u, y1, -profileDepth), f.at(u, y1)],
        f.tangent.map((v) => v * sign),
        c.wall,
      );
      face(
        out,
        'band',
        [f.at(u, y1), f.at(end, y1), f.at(end, y1, -profileDepth), f.at(u, y1, -profileDepth)],
        up,
        c.cream,
      );
    }
  }
  if (lod) {
    ledge(out, 'band', f, center - 0.95, center + 0.95, roofPeak - 0.08, 0.19, 0.3, c.bandDark);
    for (const off of [-0.48, 0.47]) {
      panel(
        out,
        'sash',
        f,
        center + off - 0.13,
        center + off + 0.13,
        high + 3.06,
        high + 4.11,
        c.cavity,
        0.031,
      );
    }
  }
  arch(
    out,
    f,
    { x: center, width: 2.1, low: high + 0.3, spring: high + 0.66, rise: 0.89 },
    lod,
    0,
    true,
  );
}

function entryPorch(out, axis, line, center, width, lod) {
  const f = facade(axis, line, 1),
    half = width / 2,
    low = s.basementTop + 0.03,
    top = s.porchEave;
  const left = center - half,
    right = center + half;
  archRow(
    out,
    f,
    left,
    right,
    low,
    top,
    [{ x: center, width: width * 0.47, low, spring: 4.72, rise: 2.06, door: true }],
    lod,
  );
  for (const x of [left + 0.24, right - 0.24]) pier(out, f, x, low, top + 0.2, 1.18, lod);
  ledge(out, 'band', f, left - 0.27, right + 0.27, top - 0.17, 0.32, 0.34, c.bandDark);
  ledge(out, 'brick', f, left - 0.17, right + 0.17, top + 0.23, 0.54, 0.39, c.darkBrick);
  ledge(out, 'band', f, left - 0.22, right + 0.22, top + 0.52, 0.11, 0.44, c.cream);
  face(
    out,
    'cap',
    [
      f.at(left, top + 0.02),
      f.at(right, top + 0.02),
      f.at(right, top + 0.02, -s.porchDepth),
      f.at(left, top + 0.02, -s.porchDepth),
    ],
    up,
    c.cap,
  );
  if (lod) {
    for (const x of [left, right]) {
      face(
        out,
        'brick',
        [f.at(x, low), f.at(x, low, -s.porchDepth), f.at(x, top, -s.porchDepth), f.at(x, top)],
        f.tangent.map((v) => v * (x < center ? -1 : 1)),
        c.wall,
      );
    }
    const count = lod > 1 ? 21 : 11;
    for (let i = 1; i < count; i++) {
      const u = left + (width * i) / count;
      panel(out, 'sash', f, u - 0.069, u + 0.069, top + 0.075, top + 0.38, c.cavity, 0.22);
    }
  }
}

function tower(out, [x, z], bottom, height, lod, smaller = false) {
  const count = lod ? 8 : 6,
    step = (Math.PI * 2) / count,
    radius = smaller ? 1.66 : 1.89;
  const spring = s.towerLanternSpring - (smaller ? 0.72 : 0.0);
  const cap = height;
  const profile = [
    [bottom, radius * 1.07, 'brick'],
    [spring - 1.19, radius, 'brick'],
    ...(lod
      ? [
          [spring - 0.82, radius * 1.14, 'band'],
          [spring - 0.59, radius * 1.14, 'band'],
          [spring - 0.33, radius * 0.95, 'band'],
          [spring + 0.92, radius * 0.95, 'brick'],
        ]
      : []),
    [cap - 2.3, radius * 0.83, 'brick'],
    [cap - 2.1, radius * 0.93, 'band'],
    ...(lod
      ? [
          [cap - 1.9, radius * 0.91, 'cap'],
          [cap - 1.23, radius * 0.71, 'cap'],
        ]
      : []),
    [cap - 0.57, radius * 0.42, 'cap'],
    [cap - 0.16, radius * 0.14, 'cap'],
  ];
  const at = (a, y, r) => [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
  for (let i = 0; i < count; i++) {
    const a = step * (i + 0.5),
      b = a + step;
    const normal = [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)];
    for (let j = 1; j < profile.length; j++) {
      const [y1, r1] = profile[j - 1],
        [y2, r2, slot] = profile[j];
      const color =
        slot === 'cap' ? c.cap : slot === 'brick' ? c.wall : j === 3 ? c.cream : c.bandDark;
      face(
        out,
        slot,
        [at(a, y1, r1), at(b, y1, r1), at(b, y2, r2), at(a, y2, r2)],
        normal,
        tint(color, i + 3),
      );
    }
    face(
      out,
      'cap',
      [at(a, cap - 0.16, radius * 0.14), at(b, cap - 0.16, radius * 0.14), [x, cap, z]],
      up,
      c.cap,
    );
    if (lod >= 2 || (lod === 1 && i % 2 === 0)) {
      const toFace = (u, y, d = 0) => {
        const rr =
          y < spring - 1.22
            ? radius * (1.07 - (0.07 * (y - bottom)) / (spring - 1.19 - bottom))
            : radius * (0.95 - (0.12 * (y - spring)) / (cap - 2.3 - spring));
        const mid = (a + b) / 2;
        return [
          x + (rr * Math.cos(step / 2) + d) * Math.cos(mid) - u * Math.sin(mid),
          y,
          z + (rr * Math.cos(step / 2) + d) * Math.sin(mid) + u * Math.cos(mid),
        ];
      };
      const f = { at: (u, y, d) => toFace(u, y, (d ?? 0) + 0.038), n: normal };
      const lowerHeight = Math.min(1.45, spring - bottom - 1.7);
      for (const [y, h] of [
        [bottom + 0.21, lowerHeight],
        [spring + 0.42, 2.13],
      ]) {
        arch(out, f, { x: 0, width: 0.48, low: y, spring: y + h, rise: 0.33 }, 0, 0, true);
        if (lod >= 2) {
          panel(out, 'band', f, -0.35, -0.24, y - 0.02, y + h, c.cream, 0.015);
          panel(out, 'band', f, 0.24, 0.35, y - 0.02, y + h, c.cream, 0.015);
        }
      }
    }
  }
  if (lod) {
    box(out, 'cap', x, cap - 0.13, z, 0.32, 0.36, 0.32, c.cap);
    beam(
      out,
      'cap',
      [x, cap + 0.15, z],
      [x, cap + (smaller ? 1.82 : 3.41), z],
      0.074,
      0.074,
      c.cap,
    );
  }
}

function veranda(out, lod) {
  const [l, r, rear] = s.exhibitionBounds;
  const near = rear - 1.98,
    y = 5.14;
  box(out, 'roof', (l + r) / 2, y, near + 1.0, r - l - 1.3, 0.19, 2.13, c.roof);
  const count = lod >= 2 ? 13 : 10;
  for (let i = 1; i < count; i++) {
    const x = l + (i * (r - l)) / count;
    box(out, 'brick', x, s.basementTop, near, 0.35, y - s.basementTop, 0.36, c.wall);
    if (lod) {
      box(out, 'band', x, y - 0.2, near, 0.51, 0.23, 0.54, c.cream);
      box(out, 'band', x, 0.63, near, 0.53, 0.31, 0.54, c.shadowCream);
    }
  }
}

function build(out, lod) {
  plinth(out, lod);
  const [cl, cr, cb] = s.concertBounds;
  hall(out, s.exhibitionBounds, s.exhibitionEave, s.exhibitionRidge, 'x', lod);
  hall(out, [cl, cr, cb, 36.04], s.concertEave, s.concertRidge, 'z', lod);
  const concert = facade('z', 38.76, 1),
    exhibition = facade('x', 35.66, 1);
  for (const [f, a, b, top, depth] of [
    [concert, -14.65, 4.72, s.concertScreenTop, 2.75],
    [exhibition, -25.06, 3.39, 14.79, 1.01],
  ]) {
    frontPanel(out, f, a, b, s.porchEave - 0.13, top, lod, depth);
  }
  box(
    out,
    'brick',
    -4.97,
    s.basementTop,
    37.41,
    19.15,
    s.porchEave - s.basementTop - 0.06,
    2.62,
    c.wall,
  );
  box(
    out,
    'brick',
    34.32,
    s.basementTop,
    -10.84,
    2.61,
    s.porchEave - s.basementTop - 0.06,
    27.96,
    c.wall,
  );
  entryPorch(out, 'z', 41.04, -4.95, 10.2, lod);
  entryPorch(out, 'x', 37.22, -10.82, 8.42, lod);
  for (const pos of s.concertTowerCenters)
    tower(out, pos, s.concertScreenTop - 0.37, s.towerCapHeight, lod);
  for (const pos of s.exhibitionTowerCenters)
    tower(out, pos, 14.38, s.towerCapHeight - 1.19, lod, true);
  if (lod) veranda(out, lod);
}

export const brisbaneMuseumSkyline = (out) => build(out, 0);
export const brisbaneMuseumDistrict = (out) => build(out, 1);
export const brisbaneMuseumStreet = (out) => build(out, 2);
export const brisbaneMuseumCloseup = (out) => build(out, 3);

const recipe = 'brisbane-old-museum-model.mjs',
  camera = [65, 44, 104],
  lookAt = [-3, 8.1, 7.0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'brisbaneMuseumDistrict', 0.39],
    ['street', 'brisbaneMuseumStreet', 0.18],
    ['closeup', 'brisbaneMuseumCloseup', 0.07],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const brisbaneMuseumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: brisbaneMuseumCloseup,
  category: 'museum',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The T-shaped Old Museum with two hall roofs, ornate red and cream brick façades, paired domed tower entrances and the exposed glazed-brick basement.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.89,
    basis: 'Named City Council-sourced footprint from OpenStreetMap way 27150587.',
  },
  mediumFiContext: {
    scale: 0.84,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'brick_flemish',
    'stone_sandstone',
    'brick_glazed',
    'metal_corrugated',
    'metal_standing_seam',
  ],
  qaCameras: [
    {
      name: 'gregory-terrace-concert-hall-and-towers',
      position: [-4.6, 10.3, 90],
      lookAt: [-4.8, 12.4, 37.6],
    },
    {
      name: 'exhibition-entrance-banded-brickwork',
      position: [83, 14.4, -21.0],
      lookAt: [32.6, 10.0, -9.5],
    },
    { name: 'whole-halls-and-north-verandah', position: [-60, 54, -79], lookAt: [-4, 8.8, 1.0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-brisbane-old-museum-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'brisbaneMuseumSkyline',
    errorMeters: 0.92,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and two verified first-party CC0 exterior photographs.',
};
