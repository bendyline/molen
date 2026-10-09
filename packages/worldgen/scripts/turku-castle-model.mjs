/** Original current Turku Castle architecture from attributed parts and museum references. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/u6/u6x/n0305_turku_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, root)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  means = read('surface-means.json'),
  k = frame.controls;
export const turkuPalette = {
  masonry: '#d4c8ac',
  plaster: '#eee5cd',
  copper: '#8cbdac',
  metal: '#62686f',
  wood: '#ab8056',
  brick: '#ba8065',
  paving: '#c4bfb2',
  glass: '#4d6178',
};
export const turkuSurfaces = {
  masonry: { slot: 'wall', graph: 'stone', roughness: 0.96, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.7, metallic: 0.12 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.78, metallic: 0.1 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.87, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.92, metallic: 0 },
  paving: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  glass: { slot: 'window', roughness: 0.25, metallic: 0.15 },
};
const colors = Object.fromEntries(
  Object.entries(turkuPalette).map(([name, hex]) => [
    name,
    hex
      .slice(1)
      .match(/../g)
      .map((v) => {
        const x = parseInt(v, 16) / 255;
        return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const clean = (p) =>
  Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 0.002 ? p.slice(0, -1) : p;
const get = (id) => clean(frame.geometry.rawFeatures.find((w) => w.id === id).points);
const area = (p) =>
  p.reduce((sum, a, i) => {
    const b = p[(i + 1) % p.length];
    return sum + a[0] * b[1] - a[1] * b[0];
  }, 0);
const center = (p) => p.reduce((sum, q) => sum.map((v, i) => v + q[i] / p.length), [0, 0]);
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
function face(o, p, slot, d, target) {
  p = p.map((v) => v.map(Math.fround));
  const c = d === 0 && means[slot] ? colors[slot].map((v, i) => v * means[slot][i]) : colors[slot];
  for (let i = 1; i < p.length - 1; i++) {
    const n = normalFor(p[0], p[i], p[i + 1]);
    if (Math.hypot(...n) < 0.5) continue;
    if (target && n.reduce((sum, v, j) => sum + v * target[j], 0) < 0) p = [...p].reverse();
    break;
  }
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
function simplify(p, tolerance, minimum = 4) {
  const original = p;
  p = [...p];
  let changed = true;
  while (changed && p.length > minimum) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 1e-6) continue;
      const t = ((b[0] - a[0]) * (c[0] - a[0]) + (b[1] - a[1]) * (c[1] - a[1])) / (len * len),
        distance = Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / len;
      if (t > 0 && t < 1 && distance < tolerance) {
        const candidate = p.filter((_, index) => index !== i);
        const maximum = Math.max(
          ...original.map((q) =>
            Math.min(
              ...candidate.map((a, index) => {
                const b = candidate[(index + 1) % candidate.length],
                  length = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
                const t = length
                  ? Math.max(
                      0,
                      Math.min(
                        1,
                        ((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) / length,
                      ),
                    )
                  : 0;
                return Math.hypot(q[0] - a[0] - (b[0] - a[0]) * t, q[1] - a[1] - (b[1] - a[1]) * t);
              }),
            ),
          ),
        );
        if (maximum > tolerance) continue;
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
function prism(o, p, low, high, slot, d, top = false) {
  const sign = Math.sign(area(p)),
    lo = (p) => (typeof low === 'function' ? low(p) : low),
    hi = (p) => (typeof high === 'function' ? high(p) : high);
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
      [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
    );
  }
  if (top) cap(o, p, high, slot, d);
}
function strip(o, a, b, y, h, width, slot, d) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 0.001) return;
  const n = [((-(b[1] - a[1]) / length) * width) / 2, (((b[0] - a[0]) / length) * width) / 2];
  prism(
    o,
    [
      a.map((v, i) => v + n[i]),
      b.map((v, i) => v + n[i]),
      b.map((v, i) => v - n[i]),
      a.map((v, i) => v - n[i]),
    ],
    y,
    y + h,
    slot,
    d,
    true,
  );
}
/** Only aperture-intersecting triangles are clipped, keeping the remaining GPU geometry compact. */
function cutBuilder(o, holes) {
  const cut = openingBuilder(o, holes);
  return {
    addTriangle(slot, ref, p, n, uv, color) {
      const overlaps = holes.some(
        (h) =>
          !h.planes.some((plane) =>
            p.every((v) => v.reduce((sum, x, i) => sum + x * plane[i], plane[3]) < -1e-7),
          ),
      );
      (overlaps ? cut : o).addTriangle(slot, ref, p, n, uv, color);
    },
  };
}
const partIds = [...k.mainWays, ...k.baileyWays, ...k.annexWays];
const allRings = Object.fromEntries(partIds.map((id) => [id, get(id)]));
function partRing(id, d) {
  if (id === k.roundTower && d === 0) {
    const p = get(id),
      min = [0, 1].map((i) => Math.min(...p.map((q) => q[i]))),
      max = [0, 1].map((i) => Math.max(...p.map((q) => q[i]))),
      c = min.map((v, i) => (v + max[i]) / 2),
      r = (max[0] - min[0] + max[1] - min[1]) / 4;
    return Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
    });
  }
  const p = get(id),
    shortSpan = Math.min(
      ...[0, 1].map((i) => Math.max(...p.map((q) => q[i])) - Math.min(...p.map((q) => q[i]))),
    );
  return d < 2
    ? simplify(p, Math.min(d === 0 ? 0.9 : 0.3, shortSpan * 0.1), id === k.roundTower ? 12 : 4)
    : p;
}
/** A straight original ridge aligned to the ends of the mapped wing; no surveyed pitch is claimed. */
function roofProfile(p, c, tags) {
  const major = c.axis === 'x' ? 0 : 1,
    low = Math.min(...p.map((q) => q[major])),
    high = Math.max(...p.map((q) => q[major])),
    span = high - low,
    a = center(p.filter((q) => q[major] < low + span * 0.18)),
    b = center(p.filter((q) => q[major] > high - span * 0.18)),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    along = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  let across = [-along[1], along[0]];
  if (c.roofShape === 'skillion' && tags['roof:direction']) {
    const angle = (Number(tags['roof:direction']) * Math.PI) / 180;
    across = [Math.sin(angle), -Math.cos(angle)];
  }
  const projection = (q) => q[0] * across[0] + q[1] * across[1],
    min = Math.min(...p.map(projection)),
    max = Math.max(...p.map(projection)),
    mid = (min + max) / 2,
    base = c.height - c.roofRise,
    y =
      c.roofShape === 'skillion'
        ? (q) => base + (c.roofRise * (max - projection(q))) / (max - min)
        : (q) =>
            base + c.roofRise * Math.max(0, 1 - Math.abs(projection(q) - mid) / ((max - min) / 2));
  const ring = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      av = projection(a) - mid,
      bv = projection(b) - mid;
    ring.push(a);
    if (c.roofShape !== 'skillion' && av * bv < -1e-8) {
      const t = av / (av - bv);
      ring.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return { ring, projection, mid, y, base };
}
function routeHoles(id, d) {
  return k.passages
    .filter((v) => v.parts.includes(id))
    .map((v) => {
      const p = get(v.way),
        a = p[0],
        b = p.at(-1),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        route = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      return prepareOpening(
        {
          ...v,
          center: a.map((x, i) => (x + b[i]) / 2),
          axis: [-route[1], route[0]],
          depth: len + 10,
          bottom: -0.02,
          shape: 'round',
        },
        0,
        d,
      );
    });
}
function reveals(o, p, top, holes, slot, d) {
  if (!holes.length) return;
  const c = d === 0 && means[slot] ? colors[slot].map((v, i) => v * means[slot][i]) : colors[slot];
  openingReveals(
    {
      addTriangle(_s, ref, q, n, uv, color) {
        o.addTriangle(slot, ref, q, n, uv, color);
      },
    },
    p,
    () => 0,
    top,
    holes,
    c,
  );
}
function patches(o, p, wall, id, d) {
  if (d === 0 || wall < 7) return;
  const sign = Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 4) continue;
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [sign * u[1], -sign * u[0]],
      count = Math.max(1, Math.round(len / 11));
    for (let j = 0; j < count; j++) {
      const offset = (len * (j + 0.12)) / count,
        width = (len * 0.66) / count,
        y = 1.8 + ((id + i + j) % 3) * 1.1,
        high = Math.min(wall - 0.2, y + 7.5 + ((id + j) % 2) * 2.4),
        profile = [
          [0, y],
          [width, y + 1.1],
          [width, high - 1.3],
          [width * 0.64, high],
          [width * 0.29, high - 0.6],
          [0, high - 2.1],
        ];
      face(
        o,
        profile.map(([x, y]) => [
          a[0] + u[0] * (offset + x) + n[0] * 0.012,
          y,
          a[1] + u[1] * (offset + x) + n[1] * 0.012,
        ]),
        'plaster',
        d,
        [n[0], 0, n[1]],
      );
    }
  }
}
function windowFace(o, a, b, t, bottom, width, height, d, material = 'brick') {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [u[1], -u[0]],
    c = a.map((v, i) => v + (b[i] - v) * t + n[i] * 0.04),
    w = width / 2,
    point = (x, y, push = 0) => [c[0] + u[0] * x + n[0] * push, y, c[1] + u[1] * x + n[1] * push],
    spring = bottom + height * 0.78,
    arch = Array.from({ length: 5 }, (_, i) => {
      const angle = (i * Math.PI) / 4;
      return [Math.cos(angle) * w, spring + Math.sin(angle) * height * 0.22];
    });
  face(
    o,
    [[-w, bottom], [w, bottom], ...arch].map(([x, y]) => point(x, y)),
    'glass',
    d,
    [n[0], 0, n[1]],
  );
  if (d >= 2) {
    const rim = 0.26;
    for (let i = 0; i < arch.length - 1; i++) {
      const a = arch[i],
        b = arch[i + 1],
        outer = (q) => [(q[0] * (w + rim)) / w, q[1] + rim];
      face(
        o,
        [a, b, outer(b), outer(a)].map(([x, y]) => point(x, y, 0.02)),
        material,
        d,
        [n[0], 0, n[1]],
      );
    }
  }
}
function facade(o, p, id, wall, d) {
  if (!d) return;
  if (area(p) < 0) p = [...p].reverse();
  const main = k.buildingParts[id].material === 'main',
    tower = id === k.westTower || id === k.eastTower,
    floors = tower ? [7, 14, 21, wall - 3.8] : main ? [3.8, 10.1, 16.2] : [3.5, 7.0];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 3.3) continue;
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [u[1], -u[0]],
      count = Math.max(1, Math.round(len / (d === 1 ? 8.5 : main ? 4.8 : 4.6)));
    for (let j = 0; j < count; j++) {
      const t = (j + 0.5) / count,
        test = a.map((v, i) => v + (b[i] - v) * t + n[i] * 0.25);
      for (const y of d === 1 ? [floors.at(-1)] : floors) {
        if (
          y + 2.0 >= wall ||
          Object.entries(allRings).some(
            ([other, q]) =>
              +other !== id &&
              inside(test, q) &&
              y < k.buildingParts[other].height - k.buildingParts[other].roofRise,
          )
        )
          continue;
        windowFace(
          o,
          a,
          b,
          t,
          y,
          Math.min(main ? 1.35 : 1.25, (len / count) * 0.55),
          main ? 2.1 : 1.7,
          d,
          main ? 'brick' : 'plaster',
        );
      }
    }
  }
}
export function buildTurkuPart(o, id, d = 3) {
  const output = o;
  o = {
    addTriangle(slot, ref, p, _normal, uv, color) {
      p = p.map((v) => v.map(Math.fround));
      const vector = cross(
        p[1].map((v, i) => v - p[0][i]),
        p[2].map((v, i) => v - p[0][i]),
      );
      if (Math.hypot(...vector) < 1e-10) return;
      output.addTriangle(slot, ref, p, normalFor(...p), uv, color);
    },
  };
  const c = k.buildingParts[id],
    p = partRing(id, d),
    base = c.height - c.roofRise,
    slots =
      c.material === 'main' ? ['masonry', 'plaster', 'copper'] : ['plaster', 'plaster', 'metal'],
    holes = routeHoles(id, d),
    cut = holes.length ? cutBuilder(o, holes) : o,
    pyramid = id === k.westTower || id === k.eastTower || id === k.roundTower,
    profile = pyramid ? null : roofProfile(p, c, frame.elements.find((e) => e.id === id).tags),
    ring = profile?.ring ?? p,
    top = profile?.y ?? (() => base),
    split = c.material === 'main' ? Math.min(base - 1.5, base * 0.64) : base;
  prism(cut, ring, 0, split, slots[0], d);
  prism(cut, ring, split, top, slots[1], d);
  reveals(o, ring, top, holes, slots[0], d);
  if (pyramid) {
    const mid = center(p);
    for (let i = 0; i < p.length; i++)
      face(
        o,
        [
          [p[i][0], base, p[i][1]],
          [p[(i + 1) % p.length][0], base, p[(i + 1) % p.length][1]],
          [mid[0], c.height, mid[1]],
        ],
        slots[2],
        d,
        [0, 1, 0],
      );
  } else {
    const ix = earcut(p.flat(), null, 2);
    for (let i = 0; i < ix.length; i += 3) {
      const t = ix.slice(i, i + 3).map((j) => p[j]);
      for (const side of c.roofShape === 'skillion' ? [0] : [-1, 1]) {
        const q = side ? clip(t, (v) => (profile.projection(v) - profile.mid) * side) : t;
        if (q.length > 2) cap(o, q, profile.y, slots[2], d);
      }
    }
  }
  if (c.material === 'main') patches(cut, p, split, id, d);
  facade(cut, p, id, base, d);
}
function gallery(o, d) {
  const p = partRingBridge(d),
    bottom = k.bridge.bottomY,
    top = k.bridge.topY;
  prism(o, p, bottom, top, 'wood', d);
  // An explicit underside keeps the mapped fifteen-metre courtyard clearance visible.
  const out = {
    addTriangle(s, r, p, n, uv, c) {
      o.addTriangle(
        s,
        r,
        [...p].reverse(),
        n.map((v) => -v),
        [...uv].reverse(),
        c,
      );
    },
  };
  cap(out, p, bottom, 'wood', d);
  const c = {
      axis: 'z',
      height: top + k.bridge.roofRise,
      roofRise: k.bridge.roofRise,
      roofShape: 'gabled',
    },
    profile = roofProfile(p, c, {});
  const ix = earcut(p.flat(), null, 2);
  for (let i = 0; i < ix.length; i += 3)
    for (const side of [-1, 1]) {
      const q = clip(
        ix.slice(i, i + 3).map((j) => p[j]),
        (v) => (profile.projection(v) - profile.mid) * side,
      );
      if (q.length > 2) cap(o, q, profile.y, 'copper', d);
    }
  prism(o, profile.ring, top, profile.y, 'wood', d);
  if (d > 0) {
    const sign = Math.sign(area(p));
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1.3) continue;
      const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
        n = [sign * u[1], -sign * u[0]],
        push = (q, y) => [q[0] + n[0] * 0.025, y, q[1] + n[1] * 0.025];
      face(
        o,
        [
          push(a, bottom + 1.15),
          push(b, bottom + 1.15),
          push(b, bottom + 2.6),
          push(a, bottom + 2.6),
        ],
        'glass',
        d,
        [n[0], 0, n[1]],
      );
      if (d >= 2) {
        const count = Math.round(len / 1.8);
        for (let j = 1; j < count; j++) {
          const c = a.map((v, i) => v + ((b[i] - v) * j) / count + n[i] * 0.065);
          strip(
            o,
            c.map((v, i) => v - u[i] * 0.12),
            c.map((v, i) => v + u[i] * 0.12),
            bottom + 1.15,
            1.45,
            0.1,
            'wood',
            d,
          );
        }
      }
    }
  }
}
const partRingBridge = (d) => (d === 0 ? simplify(get(k.bridgeWay), 0.12) : get(k.bridgeWay));
function courtyards(o, d) {
  for (const id of k.courtWays) cap(o, get(id), 0.015, 'paving', d);
}
export const turkuParts = {
  main: (o, d) => {
    for (const id of k.mainWays) buildTurkuPart(o, id, d);
  },
  bailey: (o, d) => {
    for (const id of k.baileyWays) buildTurkuPart(o, id, d);
  },
  annexes: (o, d) => {
    for (const id of k.annexWays) buildTurkuPart(o, id, d);
  },
  gallery,
  courtyards,
};
export function buildTurkuRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  for (const fn of Object.values(turkuParts)) fn(o, d);
}
export const buildTurkuSkyline = (o) => buildTurkuRuntime(o, 'skyline');
export const turkuStudy = {
  id: 'N0305',
  key: 'turku_castle',
  title: 'Turku Castle',
  category: 'castle',
  wikidataId: 'Q136893',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildTurkuRuntime(o),
  surfaceOverrides: turkuSurfaces,
  brief:
    'Current Turku Castle: west38m/east32m rectangular towers, pitched green copper main wings around two open courts and an elevated timber/glass gallery; white bailey/grey metal roofs, southeast round tower, lower annexes and three actual arched entrance passages.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: turkuPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 8,
    identityFeatures: [
      'West38m and east32m rectangular towers with copper pyramids',
      'Green copper main wings and elevated timber gallery above two open courts',
      'White bailey with charcoal metal roofs and southeast round tower',
    ],
  },
  sourceFacts: { exactCastleWay: 466736288, publishedDimensions: refs.publishedDimensions },
  reconstruction: frame.reconstruction,
  scaleBasis: k.basis,
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json', 'surface-means.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license; original attributed map controls © OpenStreetMap contributors,ODbL-1.0. City museum facts attributed; photographs and city PDF not redistributed.',
  sourceNotice:
    'Seven existing shared256-square stone/lime plaster/copper/painted metal/timber/brick/gravel graphs with metric repeats and linear tints; flat glass. No embedded/new image, copied mesh or photo texture.',
  dataAttribution:
    '© OpenStreetMap contributors; City of Turku/Turku Castle Museum/Ania Padzik/Henri Taponen; VisitTurku; City of Turku/Terratec Oy.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus:
      'Inactive draft: original roof/facade sections and common ground datum need actual-site review.',
  }),
  geographicNote:
    'Exact-QID current castle outline and separate components retain native East/South heading0. Common courtyard Y0 is provisional; rocky west approach/grade attachment and exterior fidelity need site review.',
  limitations: refs.limitations,
  importReason:
    'Preserve17 mapped parts, three open courtyards, elevated timber gallery and three actual passage apertures across four authored browser levels.',
  previewGround: true,
  mediumFiContext: { scale: '2', neighborStyle: 'molen.worldgen.regional.northern.detached' },
  camera: { position: [157, 103, 139], lookAt: [0, 13, -1], fov: 43 },
  qaCameras: [
    { name: 'east-main-and-bailey', position: [103, 39, 58], lookAt: [-2, 13, 1] },
    { name: 'west-tower-gate', position: [-118, 15, 31], lookAt: [-59, 13, 10] },
    { name: 'inner-courtyard-gallery', position: [-46, 9, 6], lookAt: [-31, 17, 1] },
    { name: 'bailey-east-gateway', position: [87, 7, -21], lookAt: [44, 6, -6] },
    { name: 'round-tower-and-white-bailey', position: [102, 30, 59], lookAt: [45, 10, 5] },
    { name: 'roofs-and-three-courtyards', position: [0, 193, 0], lookAt: [0, 0, -0.01] },
  ],
};
