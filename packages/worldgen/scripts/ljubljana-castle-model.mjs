/** Original current Ljubljana Castle exterior, from attributed map controls and operator photos. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/u2/u24/n0307_ljubljana_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, root)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  means = read('surface-means.json'),
  k = frame.controls;
export const ljubljanaPalette = {
  stone: '#dfd0b0',
  plaster: '#eee8d5',
  tile: '#9a7559',
  metal: '#828c8b',
  wood: '#ad875f',
  paving: '#d1cab9',
  glass: '#4d6178',
  accent: '#e8e1d2',
};
export const ljubljanaSurfaces = {
  stone: { slot: 'wall', graph: 'stone', roughness: 0.96, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.08 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  paving: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  glass: { slot: 'window', roughness: 0.28, metallic: 0.12 },
  accent: { slot: 'trim', roughness: 0.87, metallic: 0 },
};
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((v) => {
      const x = parseInt(v, 16) / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
const colors = Object.fromEntries(Object.entries(ljubljanaPalette).map(([s, h]) => [s, linear(h)]));
const clean = (p) =>
  Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 0.002 ? p.slice(0, -1) : p;
export const ljubljanaRing = (id) =>
  clean(frame.geometry.rawFeatures.find((w) => w.id === id).points);
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - a[1] * b[0];
  }, 0);
const ccw = (p) => (area(p) < 0 ? [...p].reverse() : p);
const center = (p) => p.reduce((s, q) => s.map((v, i) => v + q[i] / p.length), [0, 0]);
function inside(q, p) {
  let yes = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i],
      b = p[j];
    if (
      a[1] > q[1] !== b[1] > q[1] &&
      q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
const court = ljubljanaRing(k.courtWay),
  rings = Object.fromEntries(k.partWays.map((id) => [id, ljubljanaRing(id)]));
function safe(out) {
  return {
    addTriangle(slot, ref, p, _n, uv, color) {
      p = p.map((v) => v.map(Math.fround));
      const n = cross(
        p[1].map((v, i) => v - p[0][i]),
        p[2].map((v, i) => v - p[0][i]),
      );
      if (Math.hypot(...n) < 1e-9) return;
      out.addTriangle(slot, ref, p, normalFor(...p), uv, color);
    },
  };
}
function cutBuilder(out, holes) {
  const clipped = openingBuilder(out, holes);
  return {
    addTriangle(slot, ref, p, n, uv, color) {
      const overlaps = holes.some(
        (h) =>
          !h.planes.some((plane) =>
            p.every((v) => v.reduce((s, x, i) => s + x * plane[i], plane[3]) <= 1e-7),
          ),
      );
      (overlaps ? clipped : out).addTriangle(slot, ref, p, n, uv, color);
    },
  };
}
function lodRing(id, d) {
  const original = ljubljanaRing(id);
  if (d > 0) return ccw(original);
  const distance = (q, a, b) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = dx * dx + dz * dz,
      t = length ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / length)) : 0;
    return Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dz * t);
  };
  let p = [...original],
    changed = true;
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const q = p.filter((_, j) => j !== i),
        error = Math.max(
          ...original.map((v) =>
            Math.min(...q.map((a, j) => distance(v, a, q[(j + 1) % q.length]))),
          ),
        );
      if (error > 0.7) continue;
      p = q;
      changed = true;
      break;
    }
  }
  return ccw(p);
}
function face(o, p, slot, d, target, tint = colors[slot]) {
  p = p.map((v) => v.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    const n = normalFor(p[0], p[i], p[i + 1]);
    if (Math.hypot(...n) < 0.5) continue;
    if (target && n.reduce((s, v, j) => s + v * target[j], 0) < 0) p = [...p].reverse();
    break;
  }
  const c = d === 0 && means[slot] ? tint.map((v, i) => v * means[slot][i]) : tint;
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => [v[0], v[2]]),
      c,
    );
  }
}
function cap(o, p, y, slot, d) {
  const ix = earcut(p.flat(), null, 2);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((j) => [p[j][0], typeof y === 'function' ? y(p[j]) : y, p[j][1]]),
      slot,
      d,
      [0, 1, 0],
    );
}
function clip(p, fn) {
  if (p.length < 3) return [];
  const out = [];
  let a = p.at(-1),
    av = fn(a);
  for (const b of p) {
    const bv = fn(b);
    if (av >= -1e-7 !== bv >= -1e-7) {
      const t = av / (av - bv);
      out.push(a.map((v, i) => v + (b[i] - v) * t));
    }
    if (bv >= -1e-7) out.push(b);
    a = b;
    av = bv;
  }
  return out;
}
function prism(o, p, low, high, slot, d, top = false) {
  p = ccw(p);
  const lo = (q) => (typeof low === 'function' ? low(q) : low),
    hi = (q) => (typeof high === 'function' ? high(q) : high);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      [
        [a[0], lo(a), a[1]],
        [b[0], lo(b), b[1]],
        [b[0], hi(b), b[1]],
        [a[0], hi(a), a[1]],
      ],
      slot,
      d,
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  if (top) cap(o, p, high, slot, d);
}
function beam(o, a, b, y, top, width, slot, d) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.001) return;
  const n = [(-(b[1] - a[1]) * width) / len / 2, ((b[0] - a[0]) * width) / len / 2];
  prism(
    o,
    [
      a.map((v, i) => v + n[i]),
      b.map((v, i) => v + n[i]),
      b.map((v, i) => v - n[i]),
      a.map((v, i) => v - n[i]),
    ],
    y,
    top,
    slot,
    d,
    true,
  );
}
function roofProfile(p, c) {
  // A wall direction is independent of how densely corners were traced by the mapper.
  const edge = p
      .map((a, i) => ({
        a,
        b: p[(i + 1) % p.length],
        length: Math.hypot(...p[(i + 1) % p.length].map((v, j) => v - a[j])),
      }))
      .sort((a, b) => b.length - a.length)[0],
    a = edge.a,
    b = edge.b,
    length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    across = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length],
    proj = (q) => q[0] * across[0] + q[1] * across[1],
    min = Math.min(...p.map(proj)),
    max = Math.max(...p.map(proj)),
    mid = (min + max) / 2,
    base = c.height - c.roofRise,
    y = (q) => base + c.roofRise * Math.max(0, 1 - Math.abs(proj(q) - mid) / ((max - min) / 2));
  const ring = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      av = proj(a) - mid,
      bv = proj(b) - mid;
    ring.push(a);
    if (av * bv < -1e-8) {
      const t = av / (av - bv);
      ring.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return { ring, proj, mid, y, base };
}
export function ljubljanaPassage(d = 3) {
  const p = ljubljanaRing(k.entrance.way),
    a = p[0],
    b = p.at(-1),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    route = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  return prepareOpening(
    {
      ...k.entrance,
      center: a.map((v, i) => (v + b[i]) / 2),
      axis: [-route[1], route[0]],
      depth: len + 2,
      shape: 'round',
    },
    0,
    d,
  );
}
function pane(o, h, slot, d, recess = 0.22) {
  const point = (q) => h.point(q[0], q[1], recess);
  face(o, h.ring.map(point), slot, d, [-h.normal[0], 0, -h.normal[1]]);
  if (d >= 2) {
    for (let i = 0; i < h.ring.length; i++) {
      const a = h.ring[i],
        b = h.ring[(i + 1) % h.ring.length];
      face(o, [h.point(a[0], a[1], 0), h.point(b[0], b[1], 0), point(b), point(a)], 'plaster', d);
    }
  }
}
function neighbor(q, y, id) {
  return Object.entries(rings).some(
    ([other, p]) =>
      +other !== id &&
      inside(q, p) &&
      y < k.buildingParts[other].height - k.buildingParts[other].roofRise,
  );
}
function wall(o, a, b, top, id, d, gate) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [u[1], -u[0]],
    middle = a.map((v, i) => (v + b[i]) / 2 + n[i] * 0.25),
    courtyard = inside(middle, court),
    c = k.buildingParts[id],
    base = c.height - c.roofRise;
  const slot =
    id === k.viewingTower
      ? 'plaster'
      : courtyard && [k.arcadeWay, k.orielWay, k.chapel, 896755533].includes(id)
        ? 'plaster'
        : 'stone';
  const holes = [];
  if (d > 0 && len > 3.3 && id !== k.viewingTower && id !== k.glazedHall && id !== 310581224) {
    const arcade = id === k.arcadeWay && courtyard,
      spacing = arcade ? k.arcadeSpacing : d === 1 ? 9 : 5,
      count = Math.max(1, Math.floor(len / spacing));
    let floors =
      d === 1 ? [Math.max(k.courtyardY + 1, base - 3.4)] : [k.courtyardY + 2, base - 3.4];
    if (Math.abs(floors[0] - floors.at(-1)) < 3) floors = [floors[0]];
    for (let j = 0; j < count; j++)
      for (const y of floors) {
        const t = (j + 0.5) / count,
          test = a.map((v, i) => v + (b[i] - v) * t + n[i] * 0.25);
        if (y + 2 >= base || neighbor(test, y, id)) continue;
        const h = prepareOpening(
          {
            center: a.map((v, i) => v + (b[i] - v) * t),
            axis: u,
            depth: 0.7,
            bottom: arcade ? k.courtyardY + 0.06 : y,
            width: arcade ? Math.min(3, (len / count) * 0.7) : 1.25,
            height: arcade ? 3.7 : 1.95,
            spring: arcade ? 2.35 : 1.95,
            shape: arcade ? 'round' : id === k.chapel ? 'pointed' : 'rectangle',
          },
          0,
          d,
        );
        holes.push(h);
      }
  }
  const punched = d >= 2 || id === k.arcadeWay ? holes : [];
  const output = cutBuilder(o, [...gate, ...punched]);
  const point = (p, y) => [p[0], y, p[1]],
    split = id === k.viewingTower ? 18 : k.courtyardY;
  face(
    output,
    [
      point(a, 0),
      point(b, 0),
      point(b, Math.min(split, top(b))),
      point(a, Math.min(split, top(a))),
    ],
    'stone',
    d,
    [n[0], 0, n[1]],
  );
  if (top(a) > split || top(b) > split)
    face(output, [point(a, split), point(b, split), point(b, top(b)), point(a, top(a))], slot, d, [
      n[0],
      0,
      n[1],
    ]);
  for (const h of holes) {
    if (punched.includes(h)) pane(o, h, 'glass', d);
    else
      face(
        o,
        h.ring.map((q) => h.point(q[0], q[1], -0.018)),
        'glass',
        d,
        [n[0], 0, n[1]],
      );
  }
}
export function buildLjubljanaPart(o, id, d = 3) {
  o = safe(o);
  if (id === k.viewingTower) return viewingTower(o, d);
  if (id === k.glazedHall) return glazedHall(o, d);
  const c = k.buildingParts[id],
    p = lodRing(id, d),
    base = c.height - c.roofRise,
    hipped = c.roofShape === 'hipped',
    flat = c.roofShape === 'flat',
    profile = hipped || flat ? null : roofProfile(p, c),
    ring = profile?.ring ?? p,
    top = profile?.y ?? (() => base),
    gate = k.entrance.parts.includes(id) ? [ljubljanaPassage(d)] : [];
  for (let i = 0; i < ring.length; i++)
    wall(o, ring[i], ring[(i + 1) % ring.length], top, id, d, gate);
  if (gate.length && d > 0)
    openingReveals(
      { addTriangle: (_s, ref, q, n, uv, color) => o.addTriangle('stone', ref, q, n, uv, color) },
      ring,
      () => 0,
      top,
      gate,
      d === 0 ? colors.stone.map((v, i) => v * means.stone[i]) : colors.stone,
    );
  if (flat) cap(o, p, base, 'metal', d);
  else if (hipped) {
    const q = center(p);
    for (let i = 0; i < p.length; i++)
      face(
        o,
        [
          [p[i][0], base, p[i][1]],
          [p[(i + 1) % p.length][0], base, p[(i + 1) % p.length][1]],
          [q[0], c.height, q[1]],
        ],
        'tile',
        d,
        [0, 1, 0],
      );
  } else {
    const ix = earcut(p.flat(), null, 2);
    for (let i = 0; i < ix.length; i += 3) {
      const tri = ix.slice(i, i + 3).map((j) => p[j]);
      for (const sign of [-1, 1]) {
        const q = clip(tri, (v) => sign * (profile.proj(v) - profile.mid));
        if (q.length > 2)
          face(
            o,
            q.map((v) => [v[0], profile.y(v), v[1]]),
            'tile',
            d,
            [0, 1, 0],
          );
      }
    }
  }
  if (id === k.orielWay && d > 0) oriels(o, d);
}
function clockFace(o, a, b, d) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 6) return;
  const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [u[1], -u[0]],
    c = a.map((v, i) => (v + b[i]) / 2),
    point = (x, y, push = 0.035) => [
      c[0] + u[0] * x + n[0] * push,
      y,
      c[1] + u[1] * x + n[1] * push,
    ],
    count = d === 0 ? 8 : 24,
    cy = 27.2,
    r = 1.7;
  const circle = Array.from({ length: count }, (_, i) => {
    const t = (i * Math.PI * 2) / count;
    return point(Math.cos(t) * r, cy + Math.sin(t) * r);
  });
  face(o, circle, 'accent', d, [n[0], 0, n[1]], linear('#e8e1d2'));
  const q = (x, y, w, h, theta) => {
    const t = [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ].map(([dx, dy]) =>
      point(
        x + dx * Math.cos(theta) - dy * Math.sin(theta),
        y + dx * Math.sin(theta) + dy * Math.cos(theta),
        0.05,
      ),
    );
    face(o, t, 'accent', d, [n[0], 0, n[1]], linear('#3b3e42'));
  };
  for (let i = 0; d > 0 && i < 12; i++) {
    const t = (i * Math.PI * 2) / (d === 0 ? 4 : 12);
    q(Math.sin(t) * 1.33, cy + Math.cos(t) * 1.33, d === 0 ? 0.16 : 0.1, 0.34, -t);
  }
  q(0.22, cy + 0.25, 0.16, 1.05, -0.65);
  q(-0.35, cy + 0.55, 0.11, 1.6, 0.42);
}
function viewingTower(o, d) {
  const p = ccw(ljubljanaRing(k.viewingTower));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [u[1], -u[0]],
      c = a.map((v, j) => (v + b[j]) / 2),
      holes = [];
    if (len > 6) {
      for (const x of [-0.8, 0.8])
        holes.push(
          prepareOpening(
            {
              center: c.map((v, j) => v + u[j] * x),
              axis: u,
              depth: 0.8,
              bottom: 21.4,
              width: 1.4,
              height: 3.3,
              spring: 2.5,
              shape: 'round',
            },
            0,
            d,
          ),
        );
    }
    const cut = d > 0 ? cutBuilder(o, holes) : o,
      point = (p, y) => [p[0], y, p[1]];
    face(o, [point(a, 0), point(b, 0), point(b, 18), point(a, 18)], 'stone', d, [n[0], 0, n[1]]);
    face(
      cut,
      [point(a, 18), point(b, 18), point(b, k.terraceY), point(a, k.terraceY)],
      'plaster',
      d,
      [n[0], 0, n[1]],
    );
    for (const h of holes) {
      if (d > 0) pane(o, h, 'glass', d, 0.25);
      else
        face(
          o,
          h.ring.map((q) => h.point(q[0], q[1], -0.018)),
          'glass',
          d,
          [n[0], 0, n[1]],
        );
    }
    clockFace(o, a, b, d);
    beam(o, a, b, 30.8, 31.25, k.parapetWidth, 'plaster', d);
    const teeth = d === 0 ? 2 : 5;
    for (let j = 0; j < teeth; j++) {
      const lo = j / teeth,
        hi = Math.min(1, lo + 0.52 / teeth);
      beam(
        o,
        a.map((v, l) => v + (b[l] - v) * lo),
        a.map((v, l) => v + (b[l] - v) * hi),
        31.25,
        k.parapetTop,
        k.parapetWidth,
        'plaster',
        d,
      );
    }
  }
  cap(o, p, k.terraceY, 'paving', d);
}
function glazedHall(o, d) {
  const p = ccw(ljubljanaRing(k.glazedHall));
  prism(o, p, 0, k.courtyardY, 'stone', d);
  prism(o, p, k.courtyardY, 16.8, 'glass', d);
  cap(o, p, 17, 'metal', d);
  if (d > 0)
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      beam(o, a, b, 12.2, 12.55, 0.18, 'metal', d);
      beam(o, a, b, 16.7, 17, 0.2, 'metal', d);
      if (d >= 2) {
        const count = Math.max(1, Math.ceil(len / 3.8));
        for (let j = 0; j <= count; j++) {
          const q = a.map((v, l) => v + ((b[l] - v) * j) / count);
          beam(o, [q[0] - 0.04, q[1]], [q[0] + 0.04, q[1]], 6, 16.8, 0.12, 'metal', d);
        }
      }
    }
}
function oriels(o, d) {
  const p = ccw(rings[k.orielWay]),
    edges = p
      .map((a, i) => {
        const b = p[(i + 1) % p.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
          n = [u[1], -u[0]],
          mid = a.map((v, j) => (v + b[j]) / 2 + n[j] * 0.2);
        return { a, b, len, u, n, exterior: !inside(mid, court) };
      })
      .filter((v) => v.exterior)
      .sort((a, b) => b.len - a.len),
    e = edges[0];
  for (let j = 0; j < k.orielCount; j++) {
    const c = e.a.map((v, i) => v + ((e.b[i] - v) * (j + 1)) / (k.orielCount + 1)),
      point = (x, depth) => c.map((v, i) => v + e.u[i] * x + e.n[i] * depth),
      p = [point(-1.1, 0), point(1.1, 0), point(0.9, 0.8), point(-0.9, 0.8)],
      bottom = 9,
      top = 14.6;
    prism(o, p, bottom, top, 'plaster', d);
    const mid = point(0, 0.42);
    for (let i = 0; i < p.length; i++)
      face(
        o,
        [
          [p[i][0], top, p[i][1]],
          [p[(i + 1) % p.length][0], top, p[(i + 1) % p.length][1]],
          [mid[0], 15.65, mid[1]],
        ],
        'tile',
        d,
        [0, 1, 0],
      );
    const a = point(-0.62, 0.812),
      b = point(0.62, 0.812);
    face(
      o,
      [
        [a[0], 10.4, a[1]],
        [b[0], 10.4, b[1]],
        [b[0], 13.5, b[1]],
        [a[0], 13.5, a[1]],
      ],
      'glass',
      d,
      [e.n[0], 0, e.n[1]],
    );
    if (d >= 2) {
      const a = point(-0.7, 0.82),
        b = point(0.7, 0.82);
      beam(o, a, b, 10.2, 10.4, 0.12, 'wood', d);
      beam(o, a, b, 13.5, 13.7, 0.12, 'wood', d);
    }
  }
}
function flags(o, d) {
  for (const [which, c, palette] of [
    ['municipal', k.roofPole, ['#e8e1d2', '#438b51']],
    ['national', k.nationalPole, ['#e8e1d2', '#2d5d98', '#b93429']],
  ]) {
    const [x, z] = c.point,
      count = d === 0 ? 6 : 12,
      r = d === 0 ? 0.16 : 0.1,
      p = Array.from({ length: count }, (_, i) => [
        x + Math.cos((i * Math.PI * 2) / count) * r,
        z + Math.sin((i * Math.PI * 2) / count) * r,
      ]);
    prism(o, p, c.bottom, c.top, 'metal', d, true);
    const width = 4.4,
      height = 2.2,
      segments = d < 2 ? 1 : 4;
    for (let b = 0; b < palette.length; b++)
      for (let i = 0; i < segments; i++) {
        const q = (t, y) => [
            x + r + width * t,
            y - 0.16 * t,
            z + 0.22 * Math.sin(t * Math.PI * 2) * t,
          ],
          lo = 42.7 - ((b + 1) * height) / palette.length,
          hi = 42.7 - (b * height) / palette.length,
          poly = [
            q(i / segments, lo),
            q((i + 1) / segments, lo),
            q((i + 1) / segments, hi),
            q(i / segments, hi),
          ],
          tint = linear(palette[b]);
        face(o, poly, 'accent', d, [0, 0, 1], tint);
        face(o, [...poly].reverse(), 'accent', d, [0, 0, -1], tint);
      }
    // Coats of arms are deliberately unpainted at this scale; the two flags retain their bands.
    void which;
  }
}
function surroundings(o, d) {
  cap(o, d === 0 ? lodRing(k.courtWay, d) : court, k.courtyardY, 'paving', d);
  const p = d === 0 ? lodRing(k.bridgeWay, d) : ljubljanaRing(k.bridgeWay);
  prism(o, p, k.bridgeTopY - k.bridgeThickness, k.bridgeTopY, 'stone', d, true);
  const path = ljubljanaRing(5821194);
  for (let i = 0; i < path.length - 1; i++)
    beam(o, path[i], path[i + 1], 5.99, 6.015, 2.5, 'paving', d);
  if (d > 0) {
    const v = ccw(p);
    for (let i = 0; i < v.length; i++) {
      const a = v[i],
        b = v[(i + 1) % v.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 10) {
        beam(o, a, b, 6, 7.1, 0.24, 'stone', d);
      }
    }
  }
  // Detached ticket office and low funicular shell join the castle from district distance.
  if (d === 0) return;
  const station = ljubljanaRing(270479187);
  prism(o, station, 0, 3.3, 'glass', d);
  cap(o, station, 3.5, 'metal', d);
  const ticket = ljubljanaRing(1092518452);
  prism(o, ticket, 5.8, 6, 'paving', d);
  prism(o, ticket, 6, 8.8, 'glass', d);
  cap(o, ticket, 9, 'metal', d);
}
export const ljubljanaParts = {
  buildings: (o, d) => {
    for (const id of k.partWays) buildLjubljanaPart(o, id, d);
  },
  flags,
  surroundings,
};
export function buildLjubljanaRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  for (const fn of Object.values(ljubljanaParts)) fn(o, d);
}
export const buildLjubljanaSkyline = (o) => buildLjubljanaRuntime(o, 'skyline');
export const ljubljanaStudy = {
  id: 'N0307',
  key: 'ljubljana_castle',
  title: 'Ljubljana Castle',
  category: 'castle',
  wikidataId: 'Q2075156',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildLjubljanaRuntime(o),
  surfaceOverrides: ljubljanaSurfaces,
  brief:
    'Complete current castle exterior: fifteen actual mapped building parts, irregular open courtyard, white clock/viewing tower, round and pentagonal towers, brown pitched roofs, projecting bays, chapel, modern glazed halls and mapped eastern entrance/bridge.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: ljubljanaPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 8,
    identityFeatures: [
      'Complete irregular roofed castle ring and open courtyard',
      'White crenellated clock tower and two national/municipal flags',
      'Round/pentagonal towers, steep brown roofs and modern glazed courtyard additions',
    ],
  },
  sourceFacts: {
    exactCastleWay: 5821190,
    buildingRelation: 2326426,
    courtyardHole: 174281987,
    buildingPartCount: 15,
    publishedDimensions: refs.publishedDimensions,
  },
  reconstruction: frame.reconstruction,
  scaleBasis: k.basis,
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json', 'surface-means.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license; attributed OSM numeric controls © OpenStreetMap contributors, ODbL-1.0. Castle-operator facts attributed. Photos and diagram not redistributed.',
  sourceNotice:
    'Six existing shared 256-square stone/lime-plaster/roof-tile/painted-metal/timber/gravel graphs with metric repeats and linear palette tints. Flat blue-grey glass and colored flags. No new/embedded texture or downloaded mesh.',
  dataAttribution:
    '© OpenStreetMap contributors; Ljubljanski grad / Ljubljana Castle and its credited photographers.',
  geographic: () => ({
    status: 'draft',
    replaceFootprint: false,
    groundModelY: 6,
    reviewStatus:
      'Inactive section/ground-attachment proposal: actual rocky hill grades and common courtyard/tower vertical datum must be resolved before activation.',
  }),
  geographicNote:
    'Native East/South component traces use heading0. Provisional inner court attachment modelY6; primary 400m platform altitude is not a relative tower-height measurement. Geographic/section approval remains pending.',
  limitations: refs.limitations,
  importReason:
    'Preserve all mapped castle components, irregular courtyard, gateway aperture, clock terrace and current glazed additions through four authored browser levels.',
  previewGround: true,
  mediumFiContext: {
    scale: '1',
    neighborStyle: 'molen.worldgen.regional.continental.detached',
  },
  camera: { position: [-128, 109, 144], lookAt: [5, 15, -4], fov: 42 },
  qaCameras: [
    { name: 'southwest-clock-and-bays', position: [-101, 49, 97], lookAt: [-25, 19, 14] },
    { name: 'northwest-roofed-wings', position: [-83, 40, -109], lookAt: [-12, 16, -20] },
    { name: 'eastern-bridge-and-passage', position: [104, 22, -11], lookAt: [49, 9, -13] },
    { name: 'courtyard-arcade-and-glazing', position: [9, 12, 4], lookAt: [-4, 11, -27] },
    { name: 'open-clock-terrace', position: [-61, 51, 42], lookAt: [-42, 31, 29] },
    { name: 'mapped-courtyard-overhead', position: [4, 169, -4], lookAt: [4, 0, -4.01] },
  ],
};
