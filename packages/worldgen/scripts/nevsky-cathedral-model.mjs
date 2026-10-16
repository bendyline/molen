/** Sofia Nevsky: mapped gold domes/open western belfry and green stepped roof ranges. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import {
  openingBuilder,
  openingReveals,
  openingShape,
  prepareOpening,
} from './authored-wall-openings.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/sx/sx8/n0329_alexander_nevsky_cathedral/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const rec = frame.reconstruction,
  floor = rec.floorY;
const palette = {
  stone: '#dbcbb0',
  trim: '#e7dcc4',
  green: '#73a289',
  foundation: '#c9ba9e',
  glass: '#4d6178',
  door: '#76694e',
  gold: '#dab560',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((n) => {
        const v = parseInt(n, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const unit = (v) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : floor + y, p[1]];
const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const center = (r) => [0, 1].map((k) => r.reduce((n, p) => n + p[k], 0) / r.length);
const sign = (r) =>
  Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
const rect = (p, w, h) => [
  [p[0] - w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] + h / 2],
  [p[0] - w / 2, p[1] + h / 2],
];
const regular = (p, r, n = 8, offset = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos(offset + (i * Math.PI * 2) / n),
    p[1] + r * Math.sin(offset + (i * Math.PI * 2) / n),
  ]);
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const _component = (id) => rec.components.find((b) => b.id === id);
const footing = (p) => Math.min(floor - 0.3, nevskyGround(...p) - 0.35);
export function nevskyGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Nevsky footing outside retained terrain');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    H = g.heights;
  return (
    (H[k] * (1 - a) + H[k + 1] * a) * (1 - b) +
    (H[k + g.width] * (1 - a) + H[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
function writer(out, d) {
  return (slot, p, direction) => {
    p = p.map((v) => v.map(Math.fround));
    if (direction && normalFor(...p.slice(0, 3)).reduce((n, v, k) => n + v * direction[k], 0) < 0)
      p = p.toReversed();
    const color = d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot];
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, k) => v - t[0][k]),
            t[2].map((v, k) => v - t[0][k]),
          ),
        ) < 1e-7
      )
        continue;
      out.addTriangle(
        slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  };
}
function cap(face, r, y, slot, holes = []) {
  const points = [...r, ...holes.flat()],
    starts = [];
  let offset = r.length;
  for (const h of holes) {
    starts.push(offset);
    offset += h.length;
  }
  const ids = earcut(points.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(points[k], y)),
      [0, 1, 0],
    );
}
function sides(face, r, b, t, slot, inward = false) {
  const s = sign(r) * (inward ? -1 : 1);
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    face(slot, [at(p, b), at(q, b), at(q, t), at(p, t)], [(q[1] - p[1]) * s, 0, (p[0] - q[0]) * s]);
  }
}
function solid(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function profile(face, r, levels, slot) {
  for (let i = 1; i < levels.length; i++) {
    const [b, a] = levels[i - 1],
      [t, c] = levels[i],
      lo = scaled(r, a),
      hi = scaled(r, c),
      s = sign(r);
    for (let j = 0; j < r.length; j++) {
      const k = (j + 1) % r.length;
      face(
        slot,
        [at(lo[j], b), at(lo[k], b), at(hi[k], t), at(hi[j], t)],
        [(r[k][1] - r[j][1]) * s, 0.1, (r[j][0] - r[k][0]) * s],
      );
    }
  }
  const [t, f] = levels.at(-1);
  if (f > 0) cap(face, scaled(r, f), t, slot);
}
const box = (face, p, w, d, b, t, slot) => solid(face, rect(p, w, d), b, t, slot);
function faceFrame(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    axis = unit(b.map((v, k) => v - a[k])),
    normal = [axis[1] * sign(r), -axis[0] * sign(r)];
  return { a, b, axis, normal, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
}
function panel(face, f, t, w, b, h, slot, offset = 0.055) {
  const p = lerp(f.a, f.b, t),
    q = (u, y) => [
      p[0] + f.axis[0] * u + f.normal[0] * offset,
      floor + y,
      p[1] + f.axis[1] * u + f.normal[1] * offset,
    ];
  face(
    slot,
    [q(-w / 2, b), q(w / 2, b), q(w / 2, b + h), q(-w / 2, b + h)],
    [f.normal[0], 0, f.normal[1]],
  );
}
function pane(face, h, d, offset = -0.18, slot = 'glass') {
  const p = prepareOpening(h, 0, d),
    normal = [-p.axis[1], p.axis[0]];
  offset *= Math.sign(normal[0] * h.normal[0] + normal[1] * h.normal[1]);
  face(
    slot,
    openingShape(h, d).map((q) => p.point(...q, offset)),
    [h.normal[0], 0, h.normal[1]],
  );
}
function archBand(face, h, d, w = 0.45, slot = 'trim', offset = 0.08) {
  const outer = openingShape(
      {
        ...h,
        width: h.width + w * 2,
        height: h.height + w,
        bottom: h.bottom - w,
        spring: h.spring + w,
      },
      d,
    ),
    inner = openingShape(h, d),
    p = prepareOpening(h, 0, d);
  offset *= Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  if (outer.length !== inner.length) return;
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    face(
      slot,
      [
        p.point(...outer[i], offset),
        p.point(...outer[j], offset),
        p.point(...inner[j], offset),
        p.point(...inner[i], offset),
      ],
      [h.normal[0], 0, h.normal[1]],
    );
  }
}
export const nevskyOpenings = [];
const remember = (h, d) => {
  if (d >= 3 && !nevskyOpenings.some((q) => q.name === h.name)) nevskyOpenings.push(h);
  return h;
};
function shell(out, d, r, b, t, holes = [], slot = 'stone', inner = null) {
  const hs = holes.map((h) => prepareOpening(h, 0, d)),
    face = writer(openingBuilder(out, hs), d);
  sides(face, r, b, t, slot);
  if (inner) sides(face, inner, b, t, slot, true);
  if (inner) cap(face, r, t, slot, [inner]);
  for (const h of hs)
    openingReveals(
      {
        addTriangle(_s, ref, p, n, uv, col) {
          out.addTriangle(slot, ref, p, n, uv, col);
        },
      },
      r,
      (p) => (typeof b === 'function' ? b(p) : floor + b),
      () => floor + t,
      [h],
      d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot],
    );
}
function simplify(r, tolerance) {
  let changed = true,
    p = [...r];
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        u = c.map((v, k) => v - a[k]),
        len = Math.hypot(...u),
        t = Math.max(
          0,
          Math.min(1, ((b[0] - a[0]) * u[0] + (b[1] - a[1]) * u[1]) / (len * len || 1)),
        ),
        q = lerp(a, c, t);
      if (Math.hypot(b[0] - q[0], b[1] - q[1]) < tolerance) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
const component = (id) => rec.components.find((b) => b.id === id);
const ringFor = (r, d) => {
  if (d >= 2) return r;
  const p = center(r),
    radius = [0, 1].map(
      (k) => (Math.max(...r.map((q) => q[k])) - Math.min(...r.map((q) => q[k]))) / 2,
    );
  return Array.from({ length: d === 0 ? 8 : 12 }, (_, i) => [
    p[0] + radius[0] * Math.cos((i * 2 * Math.PI) / (d === 0 ? 8 : 12)),
    p[1] + radius[1] * Math.sin((i * 2 * Math.PI) / (d === 0 ? 8 : 12)),
  ]);
};
const capRing = (r, d) => {
  const p = center(r),
    radius = [0, 1].map(
      (k) => (Math.max(...r.map((q) => q[k])) - Math.min(...r.map((q) => q[k]))) / 2,
    ),
    n = d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 16 : 24;
  return Array.from({ length: n }, (_, i) => [
    p[0] + radius[0] * Math.cos((i * 2 * Math.PI) / n),
    p[1] + radius[1] * Math.sin((i * 2 * Math.PI) / n),
  ]);
};
function band(face, r, y, height = 0.4, slot = 'trim', factor = 1.03) {
  sides(face, scaled(r, factor), y, y + height, slot);
}
function cornice(face, r, y, d) {
  band(face, r, y, 0.35, 'trim', 1.035);
  if (d >= 3) {
    band(face, r, y - 0.42, 0.22, 'trim', 1.02);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        count = Math.floor(f.length / 1.25);
      for (let k = 0; k < count; k++) {
        const p = lerp(f.a, f.b, (k + 0.5) / count);
        box(face, p, 0.25, 0.25, y - 0.5, y - 0.25, 'trim');
      }
    }
  }
}
function roofProfile(face, r, base, top, slot, d) {
  const levels =
    d === 0
      ? [
          [base, 1],
          [base + (top - base) * 0.65, 0.76],
          [top, 0.03],
        ]
      : d === 1
        ? [
            [base, 1],
            [base + (top - base) * 0.4, 0.96],
            [base + (top - base) * 0.78, 0.63],
            [top, 0.025],
          ]
        : [
            [base, 1],
            [base + (top - base) * 0.2, 1.015],
            [base + (top - base) * 0.46, 0.92],
            [base + (top - base) * 0.7, 0.73],
            [base + (top - base) * 0.87, 0.5],
            [top, 0.02],
          ];
  profile(face, r, levels, slot);
}
function surfaceWindows(face, r, bottom, height, d, name = 'range', spacing = 5) {
  if (!d) return;
  const _s = sign(r);
  for (let i = 0; i < r.length; i++) {
    if (d === 1 && i % 2) continue;
    const f = faceFrame(r, i),
      count =
        d === 1
          ? Math.max(1, Math.floor(f.length / (spacing * 1.5)))
          : Math.max(1, Math.floor(f.length / spacing));
    if (f.length < 2) continue;
    for (let k = 0; k < count; k++) {
      const q = lerp(f.a, f.b, (k + 0.5) / count),
        h = {
          name: `${name}-${i}-${k}`,
          center: q,
          axis: f.axis,
          normal: f.normal,
          width: Math.min(1.7, (f.length / count) * 0.6),
          bottom: floor + bottom,
          height,
          spring: height * 0.64,
          shape: 'round',
          depth: 1,
        };
      if (name === 'lower-arcade' && q[0] < -33 && Math.abs(q[1] - rec.facade.centerZ) < 8)
        continue;
      pane(face, h, d, 0.14);
      if (d >= 2) archBand(face, h, d, 0.25, 'trim', 0.18);
    }
  }
}
function bodyAndDome(out, d, b) {
  const face = writer(out, d),
    raw = b.polygons[0].outline,
    r = ringFor(raw, d),
    roof = capRing(raw, d),
    kind = b.properties.kind_detail,
    lo = b.properties.min_height,
    hi = b.properties.height;
  const isMain = b.id === rec.mainDomeId,
    isSide = kind === 'side_dome',
    base = isMain ? lo : isSide ? lo : kind === 'rear_dome' ? lo : Math.max(lo, hi - 8),
    color = isMain || isSide ? 'gold' : 'green';
  // Every tagged dome is seated on a complete supporting volume above the parent9m mass.
  sides(face, r, isSide ? 0 : 9, base, 'stone');
  roofProfile(face, roof, base, hi, color, d);
  if (d) {
    cornice(face, r, base - 0.45, d);
    const bottom = isMain ? 26 : Math.max(10, base - 4.3),
      height = isMain ? 4.1 : Math.min(3.2, base - bottom - 0.35);
    if (height > 1.0) surfaceWindows(face, r, bottom, height, d, kind, isMain ? 4.7 : 4.2);
  }
  if (isMain || isSide) {
    const p = center(raw),
      top = isMain ? 42.2 : 12.1;
    box(face, p, 0.19, 0.19, hi - 0.1, top, 'gold');
    if (d || isMain) box(face, p, isMain ? 1.5 : 0.8, 0.19, top - 0.65, top - 0.44, 'gold');
  }
}
function innerRing(r, scale = 0.77) {
  return scaled(r, scale);
}
export const nevskyBelfryOpenings = [];
function belfry(out, d) {
  const face = writer(out, d),
    foundation = component(rec.bellFoundationId).polygons[0].outline,
    raw = component(rec.bellDomeId).polygons[0].outline,
    p = center(raw),
    radius = raw.reduce((n, q) => n + Math.hypot(q[0] - p[0], q[1] - p[1]), 0) / raw.length,
    r = regular(p, radius, 8, Math.PI / 8),
    inner = innerRing(r),
    holes = [];
  sides(face, foundation, 9, 34, 'stone');
  if (d >= 1)
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        h = {
          name: `belfry-arch-${i}`,
          center: lerp(f.a, f.b, 0.5),
          axis: f.axis,
          normal: f.normal,
          width: 2.35,
          bottom: floor + 35.1,
          height: 5.4,
          spring: 3.55,
          depth: 3.4,
          shape: 'round',
        };
      if (d !== 1 || i % 2 === 0) holes.push(h);
      else pane(face, h, d, 0.07);
      if (d >= 3 && !nevskyBelfryOpenings.some((q) => q.name === h.name))
        nevskyBelfryOpenings.push(h);
    }
  if (d === 0) {
    sides(face, r, 34, 41.5, 'stone');
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        h = {
          center: lerp(f.a, f.b, 0.5),
          axis: f.axis,
          normal: f.normal,
          width: 2.0,
          bottom: floor + 35.2,
          height: 4.8,
          spring: 3,
          depth: 2,
          shape: 'round',
        };
      pane(face, h, d, 0.07);
    }
  } else {
    shell(out, d, r, 34, 41.5, holes, 'stone', inner);
    for (const h of holes) archBand(face, h, d, 0.45, 'trim', 0.08);
  }
  cornice(face, r, 41.0, d);
  roofProfile(face, capRing(raw, d), 41.5, 50.5, 'gold', d);
  box(face, p, 0.23, 0.23, 50.3, 53, 'gold');
  box(face, p, 1.8, 0.23, 52.0, 52.25, 'gold');
  if (d >= 1) {
    cornice(face, foundation, 31.0, d);
    cornice(face, foundation, 33.5, d);
    const west = Math.min(...foundation.map((q) => q[0])) - 0.08,
      z = p[1];
    const f = { a: [west, z - 3], b: [west, z + 3], axis: [0, 1], normal: [-1, 0] };
    for (const t of [0.22, 0.5, 0.78]) {
      const h = {
        center: lerp(f.a, f.b, t),
        axis: f.axis,
        normal: f.normal,
        width: 1.25,
        bottom: floor + 24.0,
        height: 5.8,
        spring: 4.1,
        shape: 'round',
        depth: 1,
      };
      pane(face, h, d, 0.07);
      archBand(face, h, d, 0.3, 'trim', 0.1);
    }
    panel(face, f, 0.5, 1.8, 30.2, 2.2, 'gold', 0.12);
    panel(face, f, 0.5, 0.65, 30.3, 1.3, 'glass', 0.14);
  }
}
const front = rec.facade;
function portalHoles(d) {
  return front.portalCenters.map((z, i) =>
    remember(
      {
        name: `west-portal-${i}`,
        center: [front.x, z],
        axis: [0, 1],
        normal: [-1, 0],
        width: front.width,
        bottom: floor + 0.04,
        height: 5.8,
        spring: 3.85,
        depth: 6.0,
        shape: 'round',
      },
      d,
    ),
  );
}
function facade(face, d, holes) {
  const f = { a: [front.x, -8.1], b: [front.x, 6.3], axis: [0, 1], normal: [-1, 0] };
  for (const h of holes) {
    if (!d) pane(face, h, d, 0.08);
    else {
      const door = { ...h, width: 2.15, bottom: floor + 0.05, height: 4.8, spring: 3.5 };
      pane(face, door, d, -2.15, 'door');
      archBand(face, h, d, 0.48, 'trim', 0.15);
      if (d >= 2)
        archBand(
          face,
          {
            ...h,
            width: h.width + 0.96,
            height: h.height + 0.48,
            spring: h.spring + 0.48,
            bottom: h.bottom - 0.48,
          },
          d,
          0.24,
          'stone',
          0.16,
        );
    }
  }
  if (d) {
    panel(face, f, 0.5, 12.7, 6.5, 0.75, 'trim', 0.18);
    for (const z of [-6.1, -2.7, 0.75, 4.3]) {
      const r = regular([front.x - 0.22, z], d >= 2 ? 0.34 : 0.46, d >= 2 ? 8 : 6);
      sides(face, r, 0.04, 4, 'trim');
      cap(face, r, 4, 'trim');
    }
    for (const [z, width] of [[front.centerZ, 9.5]]) {
      const h = {
        center: [front.x - 0.1, z],
        axis: [0, 1],
        normal: [-1, 0],
        width,
        bottom: floor + 6.7,
        height: 2.1,
        spring: 0.15,
        depth: 1,
        shape: 'round',
      };
      archBand(face, h, d, 0.35, 'trim', 0.23);
    }
  }
  const x = -34.48;
  if (d >= 1)
    for (const z of [-3.35, -0.9, 1.55]) {
      const h = {
        center: [x, z],
        axis: [0, 1],
        normal: [-1, 0],
        width: 1.75,
        bottom: floor + 13.1,
        height: 5.45,
        spring: 3.8,
        depth: 1,
        shape: 'round',
      };
      pane(face, h, d, 0.14);
      archBand(face, h, d, 0.35, 'trim', 0.16);
    }
  if (d >= 2) {
    const f = { a: [x, -5.5], b: [x, 3.8], axis: [0, 1], normal: [-1, 0] };
    panel(face, f, 0.5, 8.6, 11.5, 0.5, 'trim', 0.12);
    panel(face, f, 0.5, 8.6, 19.1, 0.6, 'trim', 0.12);
  }
}
function baseAndLayers(out, d, holes) {
  const face = writer(out, d),
    main = simplify(rec.main.polygons[0].outline, d === 0 ? 0.65 : d === 1 ? 0.25 : 0.035);
  if (!d) sides(face, main, footing, 9, 'stone');
  else {
    shell(out, d, main, 0, 9, holes);
    sides(face, main, footing, 0, 'foundation');
    cap(face, main, 0, 'foundation');
  }
  if (d === 0) cap(face, main, 9, 'green');
  else for (const p of rec.main.roofPolygons) cap(face, p.outline, 9, 'green', p.holes);
  for (const b of rec.layers) {
    const raw = b.polygons[0].outline,
      r = simplify(raw, d === 0 ? 0.5 : 0.02),
      hi = b.properties.height,
      base = b.properties.min_height ?? 9,
      eave = hi === 31 ? 24 : hi - 2.2;
    sides(face, r, Math.min(9, base), eave, 'stone');
    for (const p of d === 0 ? [{ outline: r, holes: [] }] : b.roofPolygons)
      slopingRoof(face, b, p, d, eave, hi);
    if (d) cornice(face, r, eave - 0.3, d);
  }
  if (d) surfaceWindows(face, main, 3.1, 4.8, d, 'lower-arcade', d === 1 ? 12 : 4.0);
  facade(face, d, holes);
  steps(face, d);
}
function slopingRoof(face, b, p, d, eave, top) {
  const r = b.polygons[0].outline,
    bounds = [0, 1].map((k) => [Math.min(...r.map((q) => q[k])), Math.max(...r.map((q) => q[k]))]),
    short = bounds[0][1] - bounds[0][0] > bounds[1][1] - bounds[1][0] ? 1 : 0,
    c = (bounds[short][0] + bounds[short][1]) / 2,
    half = (bounds[short][1] - bounds[short][0]) / 2;
  const barrel = b.properties.kind_detail === 'top_layer' && d > 0,
    y = (q) => {
      const u = Math.min(1, Math.abs(q[short] - c) / half);
      return floor + eave + (top - eave) * (barrel ? Math.sqrt(Math.max(0, 1 - u * u)) : 1 - u);
    },
    points = [...p.outline, ...p.holes.flat()],
    starts = [];
  let offset = p.outline.length;
  for (const h of p.holes) {
    starts.push(offset);
    offset += h.length;
  }
  const ids = earcut(points.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3) {
    const tri = ids.slice(i, i + 3).map((k) => points[k]);
    const count = barrel ? (d === 1 ? 4 : d === 2 ? 8 : 12) : 2;
    for (let slice = 0; slice < count; slice++) {
      const left = c - half + (2 * half * slice) / count,
        right = c - half + (2 * half * (slice + 1)) / count;
      const poly = [];
      let clipped = tri;
      for (const [boundary, sign] of [
        [left, 1],
        [right, -1],
      ]) {
        const out = [];
        let a = clipped.at(-1),
          av = (a[short] - boundary) * sign;
        for (const q of clipped) {
          const v = (q[short] - boundary) * sign;
          if (av >= 0 !== v >= 0) out.push(lerp(a, q, av / (av - v)));
          if (v >= 0) out.push(q);
          a = q;
          av = v;
        }
        clipped = out;
        if (clipped.length < 3) break;
      }
      poly.push(...clipped);
      if (poly.length >= 3)
        face(
          'green',
          poly.map((q) => at(q, y)),
          [0, 1, 0],
        );
    }
  }
  // Close the roof's vertical boundary against the underlying wall volume.
  const count = barrel ? (d === 1 ? 4 : d === 2 ? 8 : 12) : 2;
  const refine = (r) =>
    r.flatMap((a, i) => {
      const b = r[(i + 1) % r.length],
        ts = [0];
      if (Math.abs(b[short] - a[short]) > 1e-8)
        for (let k = 1; k < count; k++) {
          const boundary = c - half + (2 * half * k) / count,
            t = (boundary - a[short]) / (b[short] - a[short]);
          if (t > 1e-6 && t < 1 - 1e-6) ts.push(t);
        }
      return ts.sort((a, b) => a - b).map((t) => lerp(a, b, t));
    });
  sides(face, refine(p.outline), eave, y, 'stone');
  for (const h of p.holes) sides(face, refine(h), eave, y, 'stone', true);
}
function steps(face, d) {
  const [a, b, c, _e] = front.stepOutline,
    lo = Math.min(...front.stepOutline.map((q) => nevskyGround(...q))) - 0.15,
    _top = 0,
    count = d === 0 ? 1 : d === 1 ? 4 : 7;
  for (let i = 0; i < count; i++) {
    const x0 = a[0] + ((b[0] - a[0]) * i) / count,
      x1 = a[0] + ((b[0] - a[0]) * (i + 1)) / count,
      y = lo + ((floor - lo) * (i + 1)) / count;
    solid(
      face,
      [
        [x0, a[1]],
        [x1, a[1]],
        [x1, c[1]],
        [x0, c[1]],
      ],
      (p) => Math.min(y - 0.22, nevskyGround(...p) - 0.15),
      (_p) => y,
      'foundation',
    );
  }
}
function build(out, d) {
  const holes = portalHoles(d);
  baseAndLayers(out, d, holes);
  for (const b of rec.domes) bodyAndDome(out, d, b);
  belfry(out, d);
}
export const buildNevskySkyline = (out) => build(out, 0);
export const buildNevskyDistrict = (out) => build(out, 1);
export const buildNevskyStreet = (out) => build(out, 2);
export const buildNevskyCloseup = (out) => build(out, 3);
export const nevskyStudy = {
  id: 'N0329',
  key: 'alexander_nevsky_cathedral',
  title: 'Alexander Nevsky Cathedral',
  category: 'cathedral',
  wikidataId: 'Q43282',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual Sofia cathedral exterior with broad eastern gold dome, taller western open belfry/gold cap/cross, green subsidiary domes/roof layers, stacked apses, arched window bands, triple west closed portals/porch columns/steps and selected stone cornices/icon motifs.',
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID parent outline and14 current tagged dome/roof/tower components preserve west entry/tower and east dome/apse arrangement.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Mapped parent/component polygons and nominal intervals; two inspected aerial/front pictures guide intermediate roofs, openings and selected detail.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared256-square graphs supply limestone walls, marble trim, patinated copper, foundation limestone and wooden doors. Linear colors/metricUVs; gold and glazing use simple vertex colors. No unique facade bitmap or embedded image.',
  importReason:
    'Preserve gold main dome/taller western belfry, green stepped roofs/apses and triple entrance in four independently authored browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Mapped parent/part footprints and nominal height intervals are retained; subdivisions of wall/drum/roof, semicircular profiles, window rhythm, portico detail and cornices are picture-led estimates. Full circular component controls overlap to form joined subsidiary half-domes; masked caps retain supporting volumes.',
    'NativeY0 follows standardDEM559.522m. Estimated0.65m common floor, foundations, entrance steps and exact plaza/doorstep joins are approximate. No surveyed elevation, flood behavior or certified walking/interior collision.',
    'Skyline preserves two prominent gold crowns, stepped green subsidiary roofs/apses and western entry with simpler masses/surface belfry panes. District restores actual belfry cuts and principal facade/windows; street/closeup add secondary window bands, porch columns, cornice detail and steps. Surface glazing and closed entrance doors do not reconstruct interiors.',
    'Small icon panels use original simple color motifs. Exact icons, inscriptions, sculpture, reliefs, crypt/interiors and structural plans are excluded; surrounding plaza/city/vegetation remain host content. Physical laptop/phone measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'west-triple-portals-and-steps',
      position: [-82, 22, 3],
      lookAt: [-34, 11, 0],
      fov: 43,
    },
    {
      name: 'main-gold-dome-and-green-apses',
      position: [69, 62, 62],
      lookAt: [12, 26, 0],
      fov: 43,
    },
    {
      name: 'western-open-belfry-and-cross',
      position: [-65, 48, 27],
      lookAt: [-23, 39, -1],
      fov: 43,
    },
    {
      name: 'south-subsidiary-domes-and-arcades',
      position: [9, 39, 75],
      lookAt: [5, 18, 13],
      fov: 43,
    },
    { name: 'east-stepped-apses', position: [91, 34, -8], lookAt: [22, 15, 1], fov: 43 },
    { name: 'north-green-roofs-and-nave', position: [-2, 47, -89], lookAt: [1, 23, -10], fov: 43 },
  ],
};
