import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.95 },
  paving: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.91 },
  timber: { slot: 'door', graph: 'wood_shou_sugi_ban', roughness: 0.95 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.8 },
  copper: { slot: 'trim', graph: 'metal_copper', roughness: 0.8 },
};

const limestone = rgb('c6b496');
const worked = rgb('d1c1a4');
const baseStone = rgb('b1a184');
const dark = rgb('514c41');
const door = rgb('4f4334');
const metal = rgb('687278');
const bronze = rgb('646559');
const shade = ['b8a68a', 'c0ac8e', 'c8b79b', 'baa98f'].map(rgb);
const a = (site.planAngleDegrees * Math.PI) / 180;
const sin = Math.sin(a),
  cos = Math.cos(a);
const world = (x, y, z) => [x * cos - z * sin, y, x * sin + z * cos];
const square = [
  [-1, -1],
  [-1, 1],
  [1, 1],
  [1, -1],
];
const floor = 0.055,
  footing = -2.1;

function oriented(p) {
  const area = p.reduce((sum, [x, z], i) => {
    const [u, v] = p[(i + 1) % p.length];
    return sum + x * v - z * u;
  }, 0);
  return area < 0 ? p : p.toReversed();
}

function face(out, slot, points, color, target) {
  if (target && normalFor(...points).reduce((s, v, i) => s + v * target[i], 0) < 0)
    points = points.toReversed();
  for (let i = 1; i + 1 < points.length; i++) {
    const p = [points[0], points[i], points[i + 1]].map((q) => q.map(Math.fround)),
      n = normalFor(...p);
    if (Math.hypot(...n) > 0.9) out.addTriangle(slot, '', p, n, [], color);
  }
}

function floorCap(out, slot, outline, level, color) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      'foundation',
      'palette:#ffffff',
      outline,
      [],
      () => level,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw Error('Invalid Nativity footprint ring');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const q = [0, 1, 2].map((j) => indices[i + j] * 3);
    out.addTriangle(
      slot,
      '',
      q.map((i) => world(positions[i], level, positions[i + 2])),
      [0, 1, 0],
      [],
      color,
    );
  }
}

function wall(out, [x, z], [u, v], lo, hi, color = limestone) {
  const points = [
    [x, lo, z],
    [u, lo, v],
    [u, hi, v],
    [x, hi, z],
  ].map((p) => world(...p));
  face(out, 'masonry', points, color);
}

function slab(out, p, lo, hi, slot = 'paving') {
  const r = oriented(p);
  for (let i = 0; i < r.length; i++) wall(out, r[i], r[(i + 1) % r.length], lo, hi);
  floorCap(out, slot, r, hi, worked);
}

function box(out, slot, x, y, z, w, h, d, color) {
  loft(
    out,
    slot,
    [y, y + h].map((t) => square.map(([a, b]) => world(x + a * w * 0.5, t, z + b * d * 0.5))),
    color,
  );
}

function field(out, at, y, width, height, detail) {
  const spring = y + height * 0.72,
    r = width / 2;
  const n = detail < 2 ? 3 : 7;
  const curve = Array.from({ length: n + 1 }, (_, i) => {
    const t = (i * Math.PI) / n;
    return [r * Math.cos(t), spring + (y + height - spring) * Math.sin(t)];
  });
  const ring = [[-r, y], [r, y], ...curve];
  face(
    out,
    'glazing',
    ring.map(([x, y]) => at(x, y, 0.035)),
    dark,
  );
  if (detail >= 2) {
    for (let i = 1; i < ring.length; i++) {
      const [u, v] = ring[i - 1],
        [x, y] = ring[i];
      beam(out, 'trim', at(u, v, 0.061), at(x, y, 0.061), 0.075, 0.071, worked);
    }
    beam(
      out,
      'trim',
      at(-r * 0.12, y + 0.04, 0.056),
      at(-r * 0.12, spring + 0.1, 0.056),
      0.041,
      0.044,
      baseStone,
    );
  }
}

function apses(out, part, detail) {
  const p = oriented(part.outline),
    h = part.height;
  slab(out, p, footing, h - (detail > 0 ? 0.23 : 0), 'paving');
  if (detail === 0) return;
  for (let i = 0; i < p.length; i++) {
    const [x, z] = p[i],
      [u, v] = p[(i + 1) % p.length],
      d = Math.hypot(u - x, v - z);
    if (d < 0.4) continue;
    const dx = (u - x) / d,
      dz = (v - z) / d,
      mid = [(x + u) / 2, (z + v) / 2];
    beam(out, 'trim', world(x, h - 0.19, z), world(u, h - 0.19, v), 0.23, 0.31, worked);
    if (d < 2.1 || d > 5.6 || i % 2 === 0) continue;
    const at = (a, y, n) => world(mid[0] + a * dx - n * dz, y, mid[1] + a * dz + n * dx);
    field(out, at, h - 3.8, 0.63, 1.6, detail);
  }
}

function apexCross(out, x, y, z, detail) {
  const w = detail === 1 ? 0.12 : 0.081,
    h = detail === 1 ? 1.04 : 1.14;
  box(out, 'copper', x, y, z, w, h, w, bronze);
  box(out, 'copper', x, y + h * 0.64, z, w, w, h * 0.57, bronze);
}

function pitched(out, x0, x1, z0, z1, eave, ridge, across = false) {
  const center = across ? (x0 + x1) / 2 : (z0 + z1) / 2;
  const p = across ? (x, y, z) => world(z, y, x) : world;
  const [a, b, c, d] = across ? [z0, z1, x0, x1] : [x0, x1, z0, z1];
  for (const edge of [c, d])
    face(
      out,
      'roof',
      [p(a, ridge, center), p(b, ridge, center), p(b, eave, edge), p(a, eave, edge)],
      metal,
      [0, 1, 0],
    );
  for (const [end, sign] of [
    [a, -1],
    [b, 1],
  ]) {
    const outward = across ? world(0, 0, sign) : world(sign, 0, 0);
    face(
      out,
      'masonry',
      [p(end, eave, c), p(end, ridge, center), p(end, eave, d)],
      limestone,
      outward,
    );
  }
}

function church(out, part, detail) {
  slab(out, part.outline, footing, 10.53);
  const top = site.parts.find((p) => p.kind === 'nave').outline;
  slab(out, top, 10.48, 14.0, 'paving');
  const x0 = -39.34,
    x1 = 11.59,
    z0 = -4.34,
    z1 = 6.43,
    tw = -8.07,
    te = 3.03;
  pitched(out, x0, x1, z0, z1, 14.03, 16.0);
  pitched(out, tw, te, -11.795, 13.871, 14.019, 16.0, true);
  for (const [z, hand] of [
    [-11.83, -1],
    [13.87, 1],
  ]) {
    const z2 = hand === 1 ? z1 : z0;
    face(
      out,
      'roof',
      [world(x0, 10.57, z), world(tw, 10.57, z), world(tw, 11.58, z2), world(x0, 11.58, z2)],
      metal,
      [0, 1, 0],
    );
    if (detail === 0) continue;
    const n = detail === 1 ? 7 : 9;
    for (let i = 0; i < n; i++) {
      const x = x0 + ((tw - x0) * (i + 0.56)) / n,
        at = (u, y, o) => world(x + u * hand, y, z2 + o * hand);
      field(out, at, 11.65, detail > 1 ? 0.88 : 0.81, 1.85, detail);
    }
    if (detail >= 3) {
      beam(out, 'trim', world(x0, 10.53, z), world(tw, 10.53, z), 0.21, 0.28, worked);
      for (const x of [-32.5, -24.3, -17.0, -9.7]) {
        const at = (u, y, o) => world(x + u * hand, y, z + o * hand);
        field(out, at, 6.53, 0.56, 1.37, 2);
      }
    }
  }
  if (detail > 0) {
    apexCross(out, x0 + 0.04, 16.0, 1.045, detail);
    apexCross(out, x1 - 0.04, 16.0, 1.045, detail);
    apexCross(out, -2.52, 16.0, 13.75, detail);
  }
}

function gate(out, part, detail) {
  const [x, z] = site.entrance.point;
  const r = site.entrance.width / 2,
    h = site.entrance.height,
    p = oriented(part.outline);
  floorCap(out, 'paving', p, part.height, worked);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    if (
      detail === 0 ||
      a[0] > -45 ||
      b[0] > -45 ||
      Math.max(a[1], b[1]) < z - r ||
      Math.min(a[1], b[1]) > z + r
    ) {
      wall(out, a, b, footing, part.height, shade[i % shade.length]);
      continue;
    }
    const clip = (k) => Math.max(0, Math.min(1, (k - a[1]) / (b[1] - a[1])));
    const [u, v] = [clip(z - r), clip(z + r)].sort((a, b) => a - b);
    const at = (t) => a.map((n, j) => n + t * (b[j] - n));
    if (u > 1e-5) wall(out, a, at(u), footing, part.height, limestone);
    if (v < 0.99999) wall(out, at(v), b, footing, part.height, limestone);
    if (v - u > 1e-5) {
      wall(out, at(u), at(v), footing, floor, baseStone);
      wall(out, at(u), at(v), h, part.height, limestone);
    }
  }
  if (detail === 0) return;
  const depth = 0.94,
    q = (u, y, v) => world(x + v, y, z + u);
  for (const hand of [-1, 1]) {
    const u = r * hand;
    face(
      out,
      'trim',
      [q(u, floor, 0), q(u, floor, depth), q(u, h, depth), q(u, h, 0)],
      baseStone,
      world(0, 0, -hand),
    );
  }
  face(out, 'trim', [q(-r, h, 0), q(r, h, 0), q(r, h, depth), q(-r, h, depth)], worked, [0, -1, 0]);
  face(
    out,
    'paving',
    [q(-r, floor, 0), q(r, floor, 0), q(r, floor, depth), q(-r, floor, depth)],
    baseStone,
    [0, 1, 0],
  );
  face(
    out,
    'timber',
    [q(-r, floor, depth), q(r, floor, depth), q(r, h, depth), q(-r, h, depth)],
    door,
    world(-1, 0, 0),
  );
  for (const side of [-1, 1])
    box(out, 'trim', x + 0.021, floor, z + side * (r + 0.132), 0.212, h - 0.02, 0.262, worked);
  box(out, 'trim', x - 0.024, h, z, 0.31, 0.235, site.entrance.width + 0.56, worked);
  if (detail >= 2) {
    // The larger earlier arch openings are retained as shallow infilled stonework.
    for (const [wide, shoulder, rise] of [
      [2.24, 2.1, 0.62],
      [3.26, 3.23, 1.22],
    ]) {
      const n = detail === 2 ? 6 : 10;
      const ring = Array.from({ length: n + 1 }, (_, i) => {
        const t = (i * Math.PI) / n;
        return q(Math.cos(t) * wide * 0.5, shoulder + Math.sin(t) * rise, -0.12);
      });
      for (let i = 1; i < ring.length; i++)
        beam(out, 'trim', ring[i - 1], ring[i], 0.117, 0.133, worked);
      for (const d of [-1, 1])
        beam(
          out,
          'trim',
          q(d * wide * 0.5, 0.112, -0.12),
          q(d * wide * 0.5, shoulder, -0.12),
          0.123,
          0.13,
          baseStone,
        );
    }
  }
}

function annex(out, part, detail) {
  const p = oriented(part.outline);
  slab(out, p, footing, part.height);
  if (detail === 0) return;
  for (const z of [6.06, 14.02]) {
    const rings = [
      [
        [-57.35, z - 0.77],
        [-58.22, z - 0.77],
        [-58.22, z + 0.77],
        [-57.35, z + 0.77],
      ],
      [
        [-57.14, z - 0.57],
        [-57.47, z - 0.57],
        [-57.47, z + 0.57],
        [-57.14, z + 0.57],
      ],
    ].map((p, i) => oriented(p).map(([x, z]) => world(x, i ? 6.32 : footing, z)));
    loft(out, 'masonry', rings, limestone);
    const at = (u, y, n) => world(-57.22 - n, y, z + u);
    field(out, at, 7.37, 0.62, 1.42, detail);
  }
  if (detail >= 3) {
    const wallX = -57.21;
    beam(out, 'trim', world(wallX, 10.77, 3.25), world(wallX, 10.77, 17.63), 0.28, 0.22, worked);
    for (let i = 0; i < 5; i++)
      box(
        out,
        'trim',
        wallX - 0.03,
        1.71 + i * 0.83,
        15.83 - 0.31 * (i % 2),
        0.16,
        0.38,
        0.92,
        shade[i % shade.length],
      );
  }
}

function build(out, detail) {
  floorCap(out, 'paving', site.plan, 0.035, baseStone);
  for (const p of site.parts) {
    if (p.kind === 'nave') continue;
    if (p.kind === 'aisles') church(out, p, detail);
    else if (p.kind === 'narthex') gate(out, p, detail);
    else if (p.kind === 'annex') annex(out, p, detail);
    else apses(out, p, detail);
  }
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
