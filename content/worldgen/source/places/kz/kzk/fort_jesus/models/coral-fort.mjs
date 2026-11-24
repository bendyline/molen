import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.97 },
  footing: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.98 },
  sill: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.88 },
  timber: { slot: 'trim', graph: 'wood_weatherboard', roughness: 0.94 },
  recess: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.79 },
};
const coral = rgb('a89982'),
  chalk = rgb('b2a187'),
  salt = rgb('8d8270');
const ruin = rgb('a6977d'),
  lime = rgb('b9ab93'),
  shadow = rgb('736854');
const clay = rgb('a37862'),
  wood = rgb('746351');
const mix = (a, b, t) => a + (b - a) * t;
const gateIndex = 2;
const native = site.perimeter;
const ring = outwardRing(native.filter((_, i) => i !== gateIndex));

function inset(width) {
  return ring.map(([x, z], i) => {
    const previous = wallFace(ring[(i + ring.length - 1) % ring.length], ring[i]);
    const next = wallFace(ring[i], ring[(i + 1) % ring.length]);
    const a = previous.normal,
      b = next.normal;
    const dot = a[0] * b[0] + a[1] * b[1];
    const cornerWidth = Math.min(
      width,
      Math.max(0.92, Math.min(previous.length, next.length) * 0.43),
    );
    const shift = Math.min(cornerWidth / Math.max(0.38, 1 + dot), cornerWidth * 1.52);
    return [x - shift * (a[0] + b[0]), z - shift * (a[1] + b[1])];
  });
}

const outer = inset(0.8),
  inner = inset(4.16);
const walkHeight = ([x, z]) =>
  6.26 + (1.43 * Math.max(0, x - 53)) / 60 + (0.68 * Math.max(0, -z - 53)) / 26;
const baseHeight = (p) => site.baseGrades[native.indexOf(p)] - site.terrainDatum - 2.38;
const points = (r, i, y, t) => {
  const a = r[i],
    b = r[(i + 1) % r.length];
  return [mix(a[0], b[0], t), y, mix(a[1], b[1], t)];
};

function fortressWall(out, detail, i) {
  const j = (i + 1) % ring.length,
    a = ring[i],
    b = ring[j];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const top = (t) => mix(walkHeight(a), walkHeight(b), t),
    bottom = (t) => mix(baseHeight(a), baseHeight(b), t);
  const outside = (y, u) => points(outer, i, y, u);
  const inside = (y, u) => points(inner, i, y, u);
  const base = (y, u) => points(ring, i, y, u);
  const wall = (u, v, lowU, lowV, gate) => {
    const bottomPoints = gate
      ? [outside(lowU, u), outside(lowV, v)]
      : [base(lowU, u), base(lowV, v)];
    quad4(
      out,
      gate ? 'sill' : 'masonry',
      ...bottomPoints,
      outside(top(v), v),
      outside(top(u), u),
      coral,
    );
    quad4(
      out,
      'masonry',
      inside(lowV, v),
      inside(lowU, u),
      inside(top(u), u),
      inside(top(v), v),
      chalk,
    );
    quad4(
      out,
      'sill',
      outside(top(u), u),
      outside(top(v), v),
      inside(top(v), v),
      inside(top(u), u),
      ruin,
    );
  };
  const hasGate = site.gate.edges.every((p) => [a, b].some((q) => q[0] === p[0] && q[1] === p[1]));
  if (!hasGate) {
    wall(0, 1, bottom(0), bottom(1), false);
    if (detail > 0) {
      const p = (t, rise) => points(ring, i, bottom(t) + rise, t);
      const upper = (t) => {
        const A = p(t, 0),
          B = outside(top(t), t);
        return A.map((x, j) => mix(x, B[j], 0.27));
      };
      quad4(out, 'footing', p(0, 0.012), p(1, 0.012), upper(1), upper(0), salt);
    }
  } else {
    const g = site.gate;
    const f = wallFace(outer[i], outer[j]);
    const from = g.center.map((v, k) => v - f.origin[k]);
    const center = from.reduce((s, v, k) => s + v * f.along[k], 0),
      L = f.length;
    const left = (center - g.radius) / L,
      right = (center + g.radius) / L;
    wall(0, left, bottom(0), bottom(left), false);
    wall(right, 1, bottom(right), bottom(1), false);
    const arch = roundArch(g.radius, [5, 8, 11, 17][detail]).map(([x, y]) => [
      (x + center) / L,
      y + g.spring,
    ]);
    for (let k = 1; k < arch.length; k++) {
      const [u, y] = arch[k - 1],
        [v, h] = arch[k];
      wall(u, v, y, h, true);
      quad4(out, 'sill', outside(h, v), outside(y, u), inside(y, u), inside(h, v), salt);
      const border = (t, y) => {
        const p = outside(y, t);
        return [p[0] + f.normal[0] * 0.15, p[1], p[2] + f.normal[1] * 0.15];
      };
      const t = (x) => (x - center / L) * 1.12 + center / L;
      quad4(
        out,
        'sill',
        border(u, y),
        border(v, h),
        border(t(v), h + 0.21),
        border(t(u), y + 0.21),
        lime,
      );
    }
    const [lo, hi] = [left, right];
    quad4(
      out,
      'masonry',
      outside(g.bottom, lo),
      inside(g.bottom, lo),
      inside(g.spring, lo),
      outside(g.spring, lo),
      salt,
    );
    quad4(
      out,
      'masonry',
      inside(g.bottom, hi),
      outside(g.bottom, hi),
      outside(g.spring, hi),
      inside(g.spring, hi),
      salt,
    );
    quad4(
      out,
      'sill',
      outside(g.bottom, hi),
      inside(g.bottom + 0.13, hi),
      inside(g.bottom + 0.13, lo),
      outside(g.bottom, lo),
      chalk,
    );
  }

  const crest = wallFace(outer[i], outer[j]),
    l = crest.length;
  if (l < 1.02) return;
  const n = Math.max(1, Math.round(l / [7.2, 4.7, 3.0, 2.62][detail]));
  const space = l / n;
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) * space,
      y = top(u / l) - 0.04;
    const r = Math.min(0.71, space * 0.31),
      p = crest.P;
    if (detail === 0) {
      quad4(
        out,
        'masonry',
        p(u - r, y),
        p(u + r, y),
        p(u + r, y + 0.68),
        p(u - r, y + 0.68),
        chalk,
      );
      continue;
    }
    const topShape = [
      p(u - r, y + 0.48, -0.61),
      p(u - r, y + 0.48, 0.125),
      p(u + r, y + 0.48, 0.125),
      p(u + r, y + 0.48, -0.61),
    ];
    const ridge = [
      p(u - r * 0.41, y + 0.99, -0.5),
      p(u - r * 0.41, y + 0.99, 0.05),
      p(u + r * 0.41, y + 0.99, 0.05),
      p(u + r * 0.41, y + 0.99, -0.5),
    ];
    fbox(out, 'masonry', crest, u - r, u + r, y, y + 0.48, -0.61, 0.125, coral);
    loft(out, 'masonry', [topShape, ridge], (k + i) % 4 === 0 ? chalk : coral);
    if (detail === 3 && k % 3 === 1)
      fbox(out, 'recess', crest, u - 0.077, u + 0.077, y + 0.05, y + 0.57, 0.122, 0.142, shadow);
  }
}

function room(out, detail, part) {
  const r = outwardRing(part.outline);
  const edges = r.map((a, i) => wallFace(a, r[(i + 1) % r.length]));
  for (const f of edges) {
    const l = f.length,
      p = f.P;
    if (l < 0.023) continue;
    quad4(
      out,
      'masonry',
      p(0, part.floor - 2.3),
      p(l, part.floor - 2.3),
      p(l, part.eave),
      p(0, part.eave),
      lime,
    );
    if (detail === 0 || l < 3.1) continue;
    const count = Math.max(1, Math.round(l / 4.42));
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * l) / count,
        y = part.floor + 1.04,
        w = j % 3 === 0 ? 1.08 : 0.74,
        h = j % 3 === 0 ? 2.09 : 1.48;
      if (detail === 1)
        quad4(
          out,
          'recess',
          p(u - w / 2, y, 0.031),
          p(u + w / 2, y, 0.031),
          p(u + w / 2, y + h, 0.031),
          p(u - w / 2, y + h, 0.031),
          shadow,
        );
      else
        opening(out, f, u, y, w, h, {
          head: 'round',
          glassSlot: 'recess',
          frameSlot: 'sill',
          frame: chalk,
          glass: shadow,
          frameWidth: 0.11,
          frameDepth: 0.13,
          d: 0.046,
          mullions: 0,
          transoms: 0,
        });
    }
    if (part.id === 99904283 && l > 25 && f.normal[1] < -0.6) {
      const u = l * 0.52;
      fbox(
        out,
        'timber',
        f,
        u - 0.94,
        u + 0.94,
        part.floor + 0.09,
        part.floor + 2.47,
        0.039,
        0.084,
        wood,
      );
    }
  }
  cap(out, 'roof', r, part.eave, clay);
  const long = edges.reduce((a, b) => (b.length > a.length ? b : a));
  const depth = Math.max(
    ...r.map(
      ([x, z]) => -((x - long.origin[0]) * long.normal[0] + (z - long.origin[1]) * long.normal[1]),
    ),
  );
  const map = (u) => long.P(u, 0, -depth / 2).filter((_, i) => i !== 1);
  gableRoof(
    out,
    'roof',
    map(0.21),
    map(long.length - 0.21),
    depth * 0.94,
    part.eave,
    part.ridge,
    clay,
    { overhang: 0.25, endSlot: 'masonry', endColor: lime },
  );
}

function sentry(out, detail, foot, radius, h) {
  const n = detail > 1 ? 12 : 8,
    y = walkHeight(foot);
  const r = (height, r) => radialRing(height, r, r, n, foot);
  loft(
    out,
    'masonry',
    [r(y - 2.13, radius * 0.94), r(y - 0.8, radius), r(y + 1.81, radius)],
    chalk,
  );
  loft(
    out,
    'sill',
    [
      r(y + 1.81, radius * 1.07),
      r(y + 2.12, radius),
      r(y + 2.38, radius * 0.71),
      r(y + h, radius * 0.161),
    ],
    salt,
  );
  if (detail > 1)
    beam(
      out,
      'masonry',
      [foot[0], y + h - 0.08, foot[1]],
      [foot[0], y + h + 0.25, foot[1]],
      0.2,
      0.19,
      coral,
    );
}

function build(out, detail) {
  for (let i = 0; i < ring.length; i++) fortressWall(out, detail, i);
  for (const p of site.buildings) room(out, detail, p);
  if (detail > 0)
    for (const [i, r] of [
      [6, 0.86],
      [13, 1.03],
      [15, 0.81],
      [22, 0.92],
    ]) {
      const t = ring.indexOf(native[i]);
      sentry(out, detail, outer[t], r, 2.83);
    }
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
