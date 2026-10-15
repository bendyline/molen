/** Pannonhalma historic core: mapped ranges/courts, hipped library and columned clock tower. */
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
  '../../../content/worldgen/source/places/u2/u2k/n0338_pannonhalma_archabbey/',
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
  plaster: '#e0d3b5',
  stone: '#efe7d0',
  tile: '#b67959',
  slate: '#64716a',
  copper: '#8aab98',
  foundation: '#b9a17c',
  door: '#705139',
  glass: '#4d6178',
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
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const footing = (p) => Math.min(floor - 0.3, pannonhalmaGround(...p) - 0.35);
export function pannonhalmaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Pannonhalma footing outside retained terrain');
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
  return (slot, p, direction, colorOverride) => {
    p = p.map((v) => v.map(Math.fround));
    if (direction) {
      for (let i = 1; i < p.length - 1; i++) {
        const n = normalFor(p[0], p[i], p[i + 1]);
        if (Math.hypot(...n) < 0.5) continue;
        if (n.reduce((sum, v, k) => sum + v * direction[k], 0) < 0) p = p.toReversed();
        break;
      }
    }
    const tint = colorOverride ?? colors[slot];
    const color = d === 0 ? tint.map((v, k) => v * means[slot][k]) : tint;
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
function shell(out, d, r, b, t, holes = [], slot = 'stone', inner = null) {
  const hs = holes.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
    face = writer(openingBuilder(out, hs), d);
  const apertureBounds = (h) => {
    const p = h.ring.flatMap((q) => [h.point(...q, -h.depth / 2), h.point(...q, h.depth / 2)]);
    return [0, 1, 2].map((k) => [Math.min(...p.map((q) => q[k])), Math.max(...p.map((q) => q[k]))]);
  };
  const overlaps = (a, b) => a.every((r, k) => r[0] <= b[k][1] + 1e-6 && r[1] >= b[k][0] - 1e-6);
  const apertureBoxes = hs.map(apertureBounds);
  sides(face, r, b, t, slot);
  if (inner) sides(face, inner, b, t, slot, true);
  if (inner) cap(face, r, t, slot, [inner]);
  const cavity = inner
    ? {
        planes: inner.map((a, i) => {
          const q = inner[(i + 1) % inner.length],
            dx = q[0] - a[0],
            dz = q[1] - a[1],
            s = sign(inner);
          return [-dz * s, 0, dx * s, (dz * a[0] - dx * a[1]) * s];
        }),
      }
    : undefined;
  for (const h of hs) {
    const reveals = openingBuilder(out, [
      ...hs.filter((q, i) => q !== h && overlaps(apertureBoxes[hs.indexOf(h)], apertureBoxes[i])),
      ...(cavity ? [cavity] : []),
    ]);
    openingReveals(
      {
        addTriangle(_s, ref, p, n, uv, col) {
          reveals.addTriangle(slot, ref, p, n, uv, col);
        },
      },
      r,
      (p) => (typeof b === 'function' ? b(p) : floor + b),
      () => floor + t,
      [h],
      d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot],
    );
  }
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
const regular = (p, r, n = 8, offset = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos(offset + (i * 2 * Math.PI) / n),
    p[1] + r * Math.sin(offset + (i * 2 * Math.PI) / n),
  ]);
const band = (face, r, y, h = 0.25, slot = 'trim', factor = 1.02) =>
  sides(face, scaled(r, factor), y, y + h, slot);
function beam(face, a, b, w, slot = 'trim') {
  const axis = unit(b.map((v, k) => v - a[k])),
    u = unit(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = unit(cross(axis, u)),
    corners = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([s, t]) => p.map((n, k) => n + ((u[k] * s + v[k] * t) * w) / 2)),
    lo = corners(a),
    hi = corners(b);
  face(
    slot,
    lo,
    axis.map((v) => -v),
  );
  face(slot, hi, axis);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(slot, [lo[i], lo[j], hi[j], hi[i]]);
  }
}
const tower = rec.tower;
const ring = (r, d) => simplify(r, d ? 0.035 : 0.28);
const projection = (p, a) => p[0] * a[0] + p[1] * a[1];
function roof(face, t, d) {
  const [lo, hi] = t.shortRange,
    mid = (lo + hi) / 2,
    half = (hi - lo) / 2;
  const y = (p) =>
    floor +
    t.base +
    (t.top - t.base) * (1 - Math.min(1, Math.abs(projection(p, t.cross) - mid) / half));
  for (const p of t.roofSections) cap(face, p.outline, y, t.slot, p.holes);
  const split = t.outline.flatMap((a, i) => {
    const b = t.outline[(i + 1) % t.outline.length],
      av = projection(a, t.cross),
      bv = projection(b, t.cross),
      ts = [0];
    if (Math.abs(bv - av) > 1e-8) {
      const q = (mid - av) / (bv - av);
      if (q > 1e-7 && q < 1 - 1e-7) ts.push(q);
    }
    return ts.map((q) => lerp(a, b, q));
  });
  sides(face, split, t.base, y, t.wall);
  if (d >= 2 && t.name === 'south-monastic-front') {
    for (let x = -48; x <= 0; x += 12) {
      const z = 8.6,
        a = [x - 0.7, z - 0.6],
        b = [x + 0.7, z - 0.6],
        c = [x + 0.7, z + 0.6],
        e = [x - 0.7, z + 0.6];
      face(
        'glass',
        [a, b, c, e].map((p) => [p[0], y(p) + 0.055, p[1]]),
        [0, 1, 0],
      );
    }
  }
}
function surfaceFrame(h, d) {
  const p = prepareOpening(h, 0, d),
    s = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  return { ...p, point: (x, y, z) => p.point(x, y, z * s) };
}
function window(face, h, d, slot = 'glass', arched = false) {
  pane(face, h, d, 0.095, slot);
  if (d >= 3) {
    archBand(face, h, d, 0.22, 'stone', 0.15);
    const p = surfaceFrame(h, d);
    if (slot === 'glass') {
      beam(face, p.point(0, h.bottom, 0.2), p.point(0, h.bottom + h.spring, 0.2), 0.1, 'stone');
      if (!arched)
        beam(
          face,
          p.point(-h.width / 2, h.bottom + h.height * 0.56, 0.2),
          p.point(h.width / 2, h.bottom + h.height * 0.56, 0.2),
          0.1,
          'stone',
        );
    }
  }
}
function facade(face, r, base, d, library = false) {
  if (!d) return;
  const levels = library
    ? [2.6, 8.2, 13.8]
    : base > 20
      ? [2.2, 7.4, 12.6, 17.8]
      : base > 13
        ? [2.1, 7.1, 11.8]
        : [2.0, 5.2];
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.length < 6) continue;
    const count = Math.max(1, Math.round(f.length / (d === 1 ? 6.8 : 4.8)));
    for (let j = 0; j < count; j++) {
      const p = lerp(f.a, f.b, (j + 0.5) / count);
      for (const y of levels) {
        if (y + 2.6 >= base - 0.3) continue;
        const h = {
          center: p,
          axis: f.axis,
          normal: f.normal,
          width: library ? 1.65 : 1.25,
          bottom: floor + y,
          height: library ? 3.0 : 2.25,
          spring: library ? 2.3 : 2.25,
          shape: library ? 'round' : 'rect',
          depth: 1,
        };
        window(face, h, d, 'glass', library);
      }
    }
  }
  if (d >= 2) {
    band(face, r, base - 0.45, 0.35, 'stone', 1.012);
    band(face, r, 1.0, 0.2, 'stone', 1.005);
  }
}
function classicalFront(face, d) {
  const z = 12.02,
    cx = -28.5,
    w = 14;
  if (d) {
    for (const x of [-34, -30.4, -26.6, -23]) {
      box(face, [x, z + 0.18], 0.65, 0.5, 2.0, 20.8, 'stone');
      box(face, [x, z + 0.2], 1.1, 0.8, 20.6, 21.2, 'stone');
    }
    box(face, [cx, z + 0.25], w, 0.9, 21.2, 22.1, 'stone');
  }
  face(
    'plaster',
    [
      [cx - w / 2, floor + 22.1, z + 0.7],
      [cx + w / 2, floor + 22.1, z + 0.7],
      [cx, floor + 27.3, z + 0.7],
    ],
    [0, 0, 1],
  );
  if (d >= 2) {
    beam(face, [cx - w / 2, floor + 22.15, z + 0.78], [cx, floor + 27.3, z + 0.78], 0.38, 'stone');
    beam(face, [cx, floor + 27.3, z + 0.78], [cx + w / 2, floor + 22.15, z + 0.78], 0.38, 'stone');
    window(
      face,
      {
        center: [cx, z + 0.07],
        axis: [1, 0],
        normal: [0, 1],
        width: 3,
        bottom: floor + 0.2,
        height: 4.2,
        spring: 2.7,
        shape: 'round',
        depth: 1,
      },
      d,
      'door',
      true,
    );
  }
}
function belfryOpenings(r, d) {
  const result = [];
  if (!d) return result;
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.length < 6) continue;
    for (const u of [-2.8, 0, 2.8]) {
      const p = lerp(f.a, f.b, 0.5).map((v, k) => v + f.axis[k] * u);
      result.push({
        name: `belfry-${i}-${u}`,
        center: p,
        axis: f.axis,
        normal: f.normal,
        width: 1.75,
        bottom: floor + 25.7,
        height: 6.9,
        spring: 5.4,
        shape: 'round',
        depth: 3.2,
      });
    }
  }
  return result;
}
const gold = [0.57, 0.37, 0.1];
function clock(face, f, d) {
  const p = lerp(f.a, f.b, 0.5),
    n = f.normal,
    ax = f.axis,
    cy = floor + 34.9,
    r = 1.02,
    count = d >= 3 ? 16 : 12;
  const point = (x, y, off = 0.15) => [
    p[0] + ax[0] * x + n[0] * off,
    cy + y,
    p[1] + ax[1] * x + n[1] * off,
  ];
  face(
    'stone',
    Array.from({ length: count }, (_, i) =>
      point(r * Math.cos((2 * Math.PI * i) / count), r * Math.sin((2 * Math.PI * i) / count)),
    ),
    [n[0], 0, n[1]],
  );
  beam(face, point(0, 0, 0.23), point(0.12, 0.73, 0.23), 0.11, 'door');
  beam(face, point(0, 0, 0.24), point(-0.56, 0.18, 0.24), 0.13, 'door');
  if (d >= 3)
    for (let j = 0; j < 12; j++) {
      const a = (j * Math.PI) / 6;
      beam(
        face,
        point(0.82 * Math.sin(a), 0.82 * Math.cos(a), 0.21),
        point(0.94 * Math.sin(a), 0.94 * Math.cos(a), 0.21),
        0.07,
        'door',
      );
    }
}
function clockTower(out, face, d) {
  const r = ring(tower.outline, d),
    p = tower.center,
    n = d >= 3 ? 20 : d ? 12 : 8;
  sides(face, r, 0, tower.baseStone, 'stone');
  sides(face, r, tower.baseStone, tower.upperBase, 'plaster');
  const hs = belfryOpenings(r, d);
  shell(out, d, r, tower.upperBase, tower.body, hs, 'plaster');
  cap(face, r, tower.body, 'stone');
  if (d) {
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      window(
        face,
        {
          center: lerp(f.a, f.b, 0.5),
          axis: f.axis,
          normal: f.normal,
          width: 1.6,
          bottom: floor + 12.0,
          height: 3.7,
          spring: 2.8,
          shape: 'round',
          depth: 1,
        },
        d,
        'glass',
        true,
      );
    }
    for (const h of hs) {
      pane(face, h, d, -0.65, 'door');
      archBand(face, h, d, 0.28, 'stone', 0.16);
      if (d >= 3) {
        const f = surfaceFrame(h, d);
        for (let y = 27.0; y < 31.2; y += 0.65)
          beam(
            face,
            f.point(-h.width / 2, floor + y, -0.6),
            f.point(h.width / 2, floor + y, -0.6),
            0.12,
            'stone',
          );
      }
    }
    for (let i = 0; i < r.length; i++)
      if (faceFrame(r, i).length > 6) clock(face, faceFrame(r, i), d);
    for (const y of [16.7, 22.6, 36.1]) band(face, r, y, 0.4, 'stone', 1.04);
  }
  const base = regular(p, 6.35, n);
  solid(face, base, tower.body, tower.lanternBase, 'stone');
  const core = regular(p, tower.coreRadius, n);
  sides(face, core, tower.lanternBase, tower.lanternTop, 'plaster');
  const columns = d >= 2 ? 12 : 8;
  for (let i = 0; i < columns; i++) {
    const a = (i * 2 * Math.PI) / columns,
      q = [p[0] + tower.columnRadius * Math.cos(a), p[1] + tower.columnRadius * Math.sin(a)],
      r = regular(q, d ? 0.32 : 0.46, d >= 3 ? 8 : 4);
    sides(face, r, tower.lanternBase, tower.lanternTop, 'stone');
    if (d >= 2) {
      solid(face, regular(q, 0.48, 4), tower.lanternBase, tower.lanternBase + 0.35, 'stone');
      solid(face, regular(q, 0.5, 4), tower.lanternTop - 0.4, tower.lanternTop, 'stone');
    }
  }
  if (d >= 2)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        normal = [Math.cos(a), Math.sin(a)],
        axis = [-normal[1], normal[0]],
        q = p.map((v, k) => v + normal[k] * tower.coreRadius);
      window(
        face,
        {
          center: q,
          normal,
          axis,
          width: 1.35,
          bottom: floor + 39.0,
          height: 4.7,
          spring: 3.8,
          shape: 'round',
          depth: 1,
        },
        d,
        'glass',
        true,
      );
    }
  solid(face, regular(p, 6.45, n), tower.lanternTop, tower.crownBase, 'stone');
  sides(face, regular(p, 5.8, n), tower.crownBase, tower.domeBase, 'plaster');
  const levels =
    d >= 2
      ? [
          [tower.domeBase, 1],
          [tower.domeBase + 1, 0.94],
          [tower.domeBase + 2.6, 0.72],
          [tower.domeTop - 0.5, 0.35],
          [tower.domeTop, 0.06],
        ]
      : [
          [tower.domeBase, 1],
          [tower.domeBase + 2.6, 0.72],
          [tower.domeTop, 0.06],
        ];
  profile(face, regular(p, 6.05, n), levels, 'copper');
  const crossFace = (_s, p, n) => face('copper', p, n, gold);
  box(crossFace, p, 0.16, 0.16, tower.domeTop, tower.top, 'copper');
  box(crossFace, p, 0.96, 0.15, tower.top - 0.55, tower.top - 0.4, 'copper');
}
function towerEntry(face, d) {
  const x = -52.0,
    z = -26.8,
    top = 3.3;
  solid(face, rect([-55.6, z], 7.2, 6.6), -0.15, top, 'stone');
  const count = d >= 3 ? 12 : d ? 6 : 1;
  for (const sign of [-1, 1])
    for (let i = 0; i < count; i++) {
      const length = 8.4 / count,
        zz = z + sign * (3.3 + 8.4 - (i + 0.5) * length),
        y = ((i + 1) * top) / count;
      solid(face, rect([-55.6, zz], 4.6, length + 0.01), -0.15, y, 'stone');
    }
  if (d) {
    window(
      face,
      {
        center: [x, z],
        normal: [-1, 0],
        axis: [0, -1],
        width: 3.1,
        bottom: floor + top + 0.04,
        height: 5.5,
        spring: 3.95,
        shape: 'round',
        depth: 1,
      },
      d,
      'door',
      true,
    );
    window(
      face,
      {
        center: [-59.21, z],
        normal: [-1, 0],
        axis: [0, -1],
        width: 1.6,
        bottom: floor,
        height: 2.7,
        spring: 1.9,
        shape: 'round',
        depth: 1,
      },
      d,
      'door',
      true,
    );
  }
}
function build(out, d) {
  const face = writer(out, d);
  // The mapped tower is a basilica part. Remove its prism from adjoining ranges
  // as well as roof caps, so the basilica's west gable cannot cross the belfry.
  const tr = scaled(ring(tower.outline, d), 1.06),
    ts = sign(tr);
  const rangeFace = writer(
    openingBuilder(out, [
      {
        planes: tr.map((a, i) => {
          const b = tr[(i + 1) % tr.length],
            dx = b[0] - a[0],
            dz = b[1] - a[1];
          return [-dz * ts, 0, dx * ts, (dz * a[0] - dx * a[1]) * ts];
        }),
      },
    ]),
    d,
  );
  for (const p of rec.union) {
    sides(face, ring(p.outline, d), footing, 0, 'foundation');
    for (const h of p.holes) {
      sides(face, ring(h, d), footing, 0, 'foundation', true);
      cap(face, h, -0.12, 'foundation');
    }
  }
  sides(face, rec.terrace, footing, -0.15, 'foundation');
  cap(face, rec.terrace, -0.15, 'foundation');
  for (const t of rec.roofs) {
    const r = ring(t.outline, d);
    const f = t.name === 'basilica' ? rangeFace : face;
    sides(f, r, 0, t.base, t.wall);
    for (const h of t.holes) sides(f, ring(h, d), 0, t.base, t.wall, true);
    roof(f, t, d);
    facade(f, r, t.base, d);
  }
  const lib = rec.library,
    r = ring(lib.outline, d),
    [x0, x1, z0, z1] = lib.bounds,
    half = (z1 - z0) / 2;
  sides(face, r, 0, lib.base, 'plaster');
  const ly = (p) =>
    floor +
    lib.base +
    (lib.top - lib.base) *
      Math.max(
        0,
        Math.min(1, (p[0] - x0) / half, (x1 - p[0]) / half, (p[1] - z0) / half, (z1 - p[1]) / half),
      );
  for (const s of lib.roofSections) cap(face, s.outline, ly, 'slate', s.holes);
  facade(face, r, lib.base, d, true);
  classicalFront(face, d);
  clockTower(out, face, d);
  towerEntry(face, d);
}
export const buildPannonhalmaSkyline = (o) => build(o, 0);
export const buildPannonhalmaDistrict = (o) => build(o, 1);
export const buildPannonhalmaStreet = (o) => build(o, 2);
export const buildPannonhalmaCloseup = (o) => build(o, 3);
export const pannonhalmaStudy = {
  id: 'N0338',
  key: 'pannonhalma_archabbey',
  title: 'Pannonhalma Archabbey',
  category: 'monastery',
  wikidataId: 'Q936285',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Pannonhalma mapped historic core: cream monastic ranges, two open courtyards, red basilica/tile roofs, dark hipped library, square clock tower with round columned gallery/copper dome, adjoining gatehouse and approximate retaining terrace/split entry stairs.',
  sourceFacts: {
    horizontalBasis:
      'Six current PMTiles core controls, retained exact-QID relation11351025, rigid signed facade alignment without rescaling.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Current mapped historic-core envelope controls horizontal scale. No reliable architectural heights; all vertical stages, retaining edge, court paving and thresholds are picture-led estimates.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Seven existing shared256-square plaster,raw limestone,ceramic tile,slate,standing-seam copper,weathered limestone and wood graphs; metric UVs,linear vertex tints and flat blue-gray glass. No embedded images.',
  importReason:
    'Four authored levels retain mapped individual core, two open courts, western library and clock-gallery-dome silhouette at signed Pannonhalma location.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Modern school,sports/visitor buildings,vegetation and neighboring campus are excluded. Selected window/clock/belfry/entry rhythms approximate pictures; no exact reliefs,clock numerals,sculpture,complete interiors,surveyed floor/roof plans,parcel boundary or certified walking surfaces. Courtyard paving and split stair joins approximate the hilltop terrace. Physical laptop/phone timings pending.',
    'Skyline uses mean tints/coarser octagonal dome and columns,solid belfry; district adds shared textures,window rhythm,clock hands and actual belfry recesses; street adds pilasters,framing/gallery windows and finer roofs; closeup refines dome/columns,clock ticks,louvers and steps. Detail/profile changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'western-clock-belfry-and-raised-entry',
      position: [-115, 38, -25],
      lookAt: [-46, 22, -27],
      fov: 43,
    },
    {
      name: 'round-columned-gallery-and-copper-dome',
      position: [-89, 65, 12],
      lookAt: [-45, 44, -27],
      fov: 39,
    },
    {
      name: 'library-hip-and-basilica-roofs',
      position: [-111, 71, -124],
      lookAt: [-38, 20, -47],
      fov: 43,
    },
    {
      name: 'two-open-monastic-courtyards',
      position: [-16, 126, 6],
      lookAt: [-13, 0, -17],
      fov: 43,
    },
    {
      name: 'long-front-and-classical-pediment',
      position: [-28, 34, 91],
      lookAt: [-28, 15, 9],
      fov: 43,
    },
    {
      name: 'eastern-ranges-and-adjoining-gatehouse',
      position: [111, 61, 102],
      lookAt: [21, 16, 31],
      fov: 43,
    },
  ],
};
