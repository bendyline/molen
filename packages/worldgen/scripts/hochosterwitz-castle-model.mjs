/** Original Hochosterwitz architecture; attributed map controls and provisional terrain levels. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import {
  openingBuilder,
  prepareOpening,
  openingReveals as revealSingleOpening,
} from './authored-wall-openings.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/u2/u26/n0301_hochosterwitz_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, root)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  means = read('surface-means.json'),
  terrain = read('terrain-samples.json'),
  k = frame.controls;
const get = (id) => frame.geometry.rawFeatures.find((w) => w.id === id).points;
const ca = Math.cos(k.planAngleRadians),
  sa = Math.sin(k.planAngleRadians);
export const hochosterwitzPlanPoint = (x, z) => [ca * x + sa * z, -sa * x + ca * z];
const local = (p) => [ca * p[0] - sa * p[1], sa * p[0] + ca * p[1]];
const native = (p) => {
  const q = hochosterwitzPlanPoint(p[0], p[2]);
  return [q[0], p[1], q[1]];
};
export const hochosterwitzPalette = {
  wall: '#e8ddbd',
  stone: '#c4b9a0',
  pale: '#f0e7ce',
  roof: '#657077',
  wood: '#927559',
  glass: '#4d6178',
  paving: '#bdb7a7',
};
export const hochosterwitzSurfaces = {
  plaster: { graph: 'plaster_lime', slot: 'wall', roughness: 0.9, metallic: 0 },
  stone: { graph: 'stone_limestone_raw', slot: 'wall', roughness: 0.9, metallic: 0 },
  slate: { graph: 'slate', slot: 'roof', roughness: 0.86, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.85, metallic: 0 },
  paving: { graph: 'gravel', slot: 'foundation', roughness: 0.97, metallic: 0 },
  glass: { slot: 'window', roughness: 0.2, metallic: 0.2 },
};
const colors = Object.fromEntries(
  Object.entries(hochosterwitzPalette).map(([key, h]) => [
    key,
    h
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
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
const rect = (x, z, w, depth) => [
  [x - w / 2, z - depth / 2],
  [x + w / 2, z - depth / 2],
  [x + w / 2, z + depth / 2],
  [x - w / 2, z + depth / 2],
];
const center = (p) => [0, 1].map((i) => p.reduce((s, q) => s + q[i], 0) / p.length);
function simplify(ring, error) {
  let p = clean(ring);
  if (!error) return p;
  for (let pass = 0; pass < 128; pass++) {
    let changed = false;
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        len = Math.hypot(c[0] - a[0], c[1] - a[1]),
        dist = len
          ? Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / len
          : 0;
      if (dist < error && out.length + p.length - i > 4 && !changed) {
        changed = true;
        continue;
      }
      out.push(b);
    }
    p = out;
    if (!changed) break;
  }
  return p;
}
function face(o, p, color = 'wall', slot = 'plaster', target) {
  p = p.map((v) => v.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    let t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    const a = t[1].map((v, j) => v - t[0][j]),
      b = t[2].map((v, j) => v - t[0][j]);
    if (
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
      1e-8
    )
      continue;
    if (target && n.reduce((s, v, j) => s + v * target[j], 0) < 0) {
      t = [t[0], t[2], t[1]];
      n = normalFor(...t);
    }
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((p) => [p[0], p[2]]),
      colors[color],
    );
  }
}
function cap(o, ring, y, color = 'stone', slot = 'stone') {
  const p = clean(ring),
    ix = earcut(p.flat(), null, 2);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((j) => [p[j][0], typeof y === 'function' ? y(p[j]) : y, p[j][1]]),
      color,
      slot,
      [0, 1, 0],
    );
}
function prism(o, ring, y0, y1, color = 'wall', slot = 'plaster', top = true) {
  const p = clean(ring),
    sign = Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      lo = (p) => (typeof y0 === 'function' ? y0(p) : y0),
      hi = (p) => (typeof y1 === 'function' ? y1(p) : y1);
    face(
      o,
      [
        [a[0], lo(a), a[1]],
        [b[0], lo(b), b[1]],
        [b[0], hi(b), b[1]],
        [a[0], hi(a), a[1]],
      ],
      color,
      slot,
      [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
    );
  }
  if (top) cap(o, p, y1, color, slot);
}
export function hochosterwitzTerrainHeight(nativePoint) {
  const g = terrain.grid,
    x = (nativePoint[0] - g.origin[0]) / 5,
    z = (nativePoint[1] - g.origin[1]) / 5,
    ix = Math.max(0, Math.min(47, Math.floor(x))),
    iz = Math.max(0, Math.min(47, Math.floor(z))),
    u = Math.max(0, Math.min(1, x - ix)),
    v = Math.max(0, Math.min(1, z - iz)),
    h = (i, j) => g.heights[j * 49 + i];
  return (
    h(ix, iz) * (1 - u) * (1 - v) +
    h(ix + 1, iz) * u * (1 - v) +
    h(ix, iz + 1) * (1 - u) * v +
    h(ix + 1, iz + 1) * u * v -
    k.terrainDatumElevation
  );
}
const ground = (p) => hochosterwitzTerrainHeight(hochosterwitzPlanPoint(...p));
const distance = (p, a, b) => {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
};
function clip(p, axis, value, less) {
  const out = [];
  let a = p.at(-1),
    av = (a[axis] - value) * (less ? -1 : 1);
  for (const b of p) {
    const bv = (b[axis] - value) * (less ? -1 : 1);
    if (av >= -1e-8 !== bv >= -1e-8) {
      const t = av / (av - bv);
      out.push(a.map((v, i) => v + (b[i] - v) * t));
    }
    if (bv >= -1e-8) out.push(b);
    a = b;
    av = bv;
  }
  return out;
}
function roof(o, ring, y, rise, d) {
  const p = clean(ring),
    ix = earcut(p.flat(), null, 2),
    step = [22, 12, 5, 3][d],
    xmin = Math.min(...p.map((v) => v[0])),
    zmin = Math.min(...p.map((v) => v[1]));
  const height = (q) =>
    y + Math.min(rise, ...p.map((a, i) => distance(q, a, p[(i + 1) % p.length]) * 0.9));
  for (let i = 0; i < ix.length; i += 3) {
    const tri = ix.slice(i, i + 3).map((j) => p[j]),
      a = Math.floor((Math.min(...tri.map((v) => v[0])) - xmin) / step),
      b = Math.floor((Math.max(...tri.map((v) => v[0])) - xmin) / step),
      c = Math.floor((Math.min(...tri.map((v) => v[1])) - zmin) / step),
      e = Math.floor((Math.max(...tri.map((v) => v[1])) - zmin) / step);
    for (let x = a; x <= b; x++)
      for (let z = c; z <= e; z++) {
        let q = tri;
        for (const [axis, val, less] of [
          [0, xmin + x * step, false],
          [0, xmin + (x + 1) * step, true],
          [1, zmin + z * step, false],
          [1, zmin + (z + 1) * step, true],
        ]) {
          if (q.length < 3) break;
          q = clip(q, axis, val, less);
        }
        if (q.length >= 3)
          face(
            o,
            q.map((v) => [v[0], height(v), v[1]]),
            'roof',
            'slate',
            [0, 1, 0],
          );
      }
  }
}
function cone(o, x, z, r, y, rise, d, color = 'roof', slot = 'slate') {
  const n = [6, 8, 12, 16][d];
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    face(
      o,
      [
        [x + r * Math.cos(a), y, z + r * Math.sin(a)],
        [x + r * Math.cos(b), y, z + r * Math.sin(b)],
        [x, y + rise, z],
      ],
      color,
      slot,
      [Math.cos((a + b) / 2), 0.4, Math.sin((a + b) / 2)],
    );
  }
}
function pane(o, c, u, w, h, d, normal, color = 'glass') {
  face(
    o,
    [
      [c[0] - (u[0] * w) / 2, c[1], c[2] - (u[1] * w) / 2],
      [c[0] + (u[0] * w) / 2, c[1], c[2] + (u[1] * w) / 2],
      [c[0] + (u[0] * w) / 2, c[1] + h, c[2] + (u[1] * w) / 2],
      [c[0] - (u[0] * w) / 2, c[1] + h, c[2] - (u[1] * w) / 2],
    ],
    color,
    color === 'glass' ? 'glass' : 'wood',
    normal,
  );
  if (d >= 2) {
    for (const y of [c[1] - 0.12, c[1] + h]) {
      const a = [c[0] - (u[0] * (w + 0.32)) / 2, c[2] - (u[1] * (w + 0.32)) / 2],
        b = [c[0] + (u[0] * (w + 0.32)) / 2, c[2] + (u[1] * (w + 0.32)) / 2];
      face(
        o,
        [
          [a[0] + normal[0] * 0.025, y, a[1] + normal[2] * 0.025],
          [b[0] + normal[0] * 0.025, y, b[1] + normal[2] * 0.025],
          [b[0] + normal[0] * 0.025, y + 0.18, b[1] + normal[2] * 0.025],
          [a[0] + normal[0] * 0.025, y + 0.18, a[1] + normal[2] * 0.025],
        ],
        'pale',
        'stone',
        normal,
      );
    }
  }
}
function windows(o, ring, base, height, d, step = 4.4, skip = () => false) {
  if (!d) return;
  const p = clean(ring),
    sign = Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (skip(a, b)) continue;
    if (len < 3) continue;
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [sign * u[1], 0, -sign * u[0]],
      count = Math.floor(len / step),
      rows = d === 1 ? 1 : Math.max(1, Math.floor(height / 4.5));
    for (let j = 0; j < count; j++)
      for (let r = 0; r < rows; r++) {
        const t = (j + 0.5) / count,
          y = base + 2.2 + r * 4.1;
        if (y + 1.8 > base + height - 0.4) continue;
        pane(
          o,
          [a[0] + (b[0] - a[0]) * t + n[0] * 0.04, y, a[1] + (b[1] - a[1]) * t + n[2] * 0.04],
          u,
          d === 1 ? 1.3 : 1.35,
          1.85,
          d,
          n,
        );
      }
  }
}
function holesFor(g, d) {
  if (!d) return [];
  const path = g.passage.map(local),
    ring = get(g.way).map(local),
    out = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i],
      b = path[i + 1],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      normal = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      axis = [normal[1], -normal[0]],
      c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      depth =
        Math.max(...ring.map((p) => (p[0] - c[0]) * normal[0] + (p[1] - c[1]) * normal[1])) -
        Math.min(...ring.map((p) => (p[0] - c[0]) * normal[0] + (p[1] - c[1]) * normal[1])) +
        4;
    out.push(
      prepareOpening(
        {
          center: c,
          axis,
          width: g.width,
          height: g.openingHeight,
          spring: g.openingHeight - g.width / 2,
          depth,
          shape: 'round',
        },
        g.baseY,
        d,
      ),
    );
  }
  return out;
}
function adapter(out) {
  return {
    addTriangle: (s, r, p, n, _uv, c) => {
      let q = p.map(native).map((v) => v.map(Math.fround));
      const a = q[1].map((v, i) => v - q[0][i]),
        b = q[2].map((v, i) => v - q[0][i]);
      if (
        Math.hypot(
          a[1] * b[2] - a[2] * b[1],
          a[2] * b[0] - a[0] * b[2],
          a[0] * b[1] - a[1] * b[0],
        ) < 1e-9
      )
        return;
      const target = native(n);
      if (normalFor(...q).reduce((s, v, i) => s + v * target[i], 0) < 0) q = [q[0], q[2], q[1]];
      out.addTriangle(
        s === 'rubble' ? 'stone' : s,
        r,
        q,
        normalFor(...q),
        q.map((v) => [v[0], v[2]]),
        c,
      );
    },
  };
}
/** Reject triangles outside an aperture's bounded local box before clipping. */
function boundedOpenings(out, holes) {
  return {
    addTriangle(slot, ref, points, normal, uv, color) {
      const nearby = holes.filter((hole) => {
        const p = points.map(hole.local);
        return ![
          [0, -hole.width / 2, hole.width / 2],
          [1, 0, hole.height],
          [2, -hole.depth / 2, hole.depth / 2],
        ].some(
          ([i, lo, hi]) =>
            Math.max(...p.map((v) => v[i])) < lo - 1e-5 ||
            Math.min(...p.map((v) => v[i])) > hi + 1e-5,
        );
      });
      openingBuilder(out, nearby).addTriangle(slot, ref, points, normal, uv, color);
    },
  };
}
/** Bent routes form a union; a reveal must not close the adjacent passage. */
function openingReveals(out, ring, base, top, holes, color) {
  for (const hole of holes)
    revealSingleOpening(
      boundedOpenings(
        out,
        holes.filter((h) => h !== hole),
      ),
      ring,
      base,
      top,
      [hole],
      color,
    );
}
function summit(o, d) {
  const ring = simplify(get(122050909).map(local), d === 0 ? 1.1 : 0),
    y = k.summitFloorY,
    h = k.mainEaveHeight;
  const g = {
      way: 122050909,
      passage: get(k.castlePassageWay),
      baseY: y,
      width: 3.1,
      openingHeight: 4.2,
    },
    holes = holesFor(g, d),
    cut = boundedOpenings(o, holes);
  prism(cut, ring, y, y + h);
  openingReveals(
    o,
    ring,
    () => y,
    () => y + h,
    holes,
    colors.wall,
  );
  roof(o, ring, y + h, k.mainRoofRise, d);
  // Open large summit court: the U-shaped footprint is never filled by a roof.
  cap(
    o,
    [
      [-13.8, -4.9],
      [22.7, -6.8],
      [27.5, 16],
      [1.3, 18],
      [-13.5, 7.5],
    ],
    y + 0.035,
    'paving',
    'paving',
  );
  windows(
    cut,
    ring,
    y,
    h,
    d,
    4.1,
    (a, b) =>
      d >= 2 &&
      Math.max(Math.abs(a[1] + 17.7), Math.abs(b[1] + 17.7)) < 0.9 &&
      Math.min(a[0], b[0]) > -8 &&
      Math.max(a[0], b[0]) < 22,
  );
  for (const [x, z, r] of [
    [-26.5, -16.5, 3.1],
    [31.3, -16.4, 3.2],
    [38.1, 8.5, 3.2],
  ])
    cone(o, x, z, r, y + h, 7, d);
  // The south end's slender square entry tower and gallery are different from the round turrets.
  const p = rect(-36, -8.6, 7.5, 8.2);
  prism(o, p, y + 9, y + 21, 'wall');
  roof(o, p, y + 21, 6, d);
  if (d >= 1) {
    pane(o, [-39.8, y + 16, -8.6], [0, 1], 1.1, 2.2, d, [-1, 0, 0]);
    pane(o, [-36, y + 15, -12.76], [1, 0], 2.8, 3.4, d, [0, 0, -1], 'wood');
  }
  if (d >= 2) {
    // Seven principal window bays are documented by the operator on the western central front.
    for (let i = 0; i < 7; i++) {
      const x = -6.4 + i * 4.5;
      const front = ring
        .map((a, j) => {
          const b = ring[(j + 1) % ring.length],
            t = (x - a[0]) / (b[0] - a[0]);
          if (!Number.isFinite(t) || t < 0 || t > 1) return null;
          const z = a[1] + (b[1] - a[1]) * t,
            slope = (b[1] - a[1]) / (b[0] - a[0]),
            len = Math.hypot(1, slope);
          return Math.abs(z + 17.7) < 2 ? { z, u: [1 / len, slope / len] } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.z - b.z)[0];
      if (!front) throw new Error(`Missing western facade for principal window bay ${i + 1}`);
      const n = [front.u[1], 0, -front.u[0]];
      for (const yy of [4.1, 8.3])
        pane(o, [x + n[0] * 0.04, y + yy, front.z + n[2] * 0.04], front.u, 1.45, 2.1, d, n);
    }
    for (const x of [-13, -4, 5, 14, 23]) {
      prism(o, rect(x, -11.6, 1.1, 1.1), y + h + 2.8, y + h + 6.8, 'stone', 'stone');
      prism(o, rect(x, -11.6, 1.3, 1.3), y + h + 6.7, y + h + 6.95, 'roof', 'slate');
    }
    // Open gallery at the courtyard end; no dark plane closes its lower arches.
    const gp = rect(-27, -1.2, 3.2, 25),
      galleryHoles = [];
    for (let i = 0; i < 4; i++)
      galleryHoles.push(
        prepareOpening(
          {
            center: [-27, -10 + i * 6],
            axis: [0, 1],
            width: 3.8,
            height: 3.9,
            spring: 2,
            depth: 4.8,
            shape: 'round',
          },
          y + 3,
          d,
        ),
      );
    const cc = boundedOpenings(o, galleryHoles);
    prism(cc, gp, y + 3, y + 8.6);
    openingReveals(
      o,
      gp,
      () => y + 3,
      () => y + 8.6,
      galleryHoles,
      colors.wall,
    );
    roof(o, gp, y + 8.6, 2.8, d);
    for (let i = 0; i < 7; i++)
      pane(o, [-25.37, y + 9.2, -10 + i * 3.5], [0, 1], 1.25, 1.65, d, [1, 0, 0]);
  }
  // Two small wells stay geometric objects, without invented inscriptions or fixtures.
  if (d >= 2)
    for (const [x, z] of [
      [9, 4],
      [23, 9],
    ]) {
      const n = d === 3 ? 12 : 8,
        r = 1.1,
        p = Array.from({ length: n }, (_, i) => [
          x + r * Math.cos((i * Math.PI * 2) / n),
          z + r * Math.sin((i * Math.PI * 2) / n),
        ]);
      prism(o, p, y, y + 0.85, 'stone', 'stone', false);
    }
}
function gates(o, d) {
  for (const g of k.gates) {
    const p = simplify(get(g.way).map(local), d === 0 ? 1.4 : d === 1 ? 0.35 : 0);
    const holes = holesFor(g, d),
      cut = boundedOpenings(o, holes);
    prism(cut, p, g.baseY, g.baseY + g.eaveHeight, 'wall');
    openingReveals(
      o,
      p,
      () => g.baseY,
      () => g.baseY + g.eaveHeight,
      holes,
      colors.wall,
    );
    if (g.roofRise) roof(o, p, g.baseY + g.eaveHeight, g.roofRise, d);
    else cap(o, p, g.baseY + g.eaveHeight, 'stone', 'stone');
    if (d) {
      // Upper arrow slots/window groups stay clear of every passage volume.
      const c = center(p),
        path = g.passage.map(local),
        a = path[0],
        b = path.at(-1),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        u = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
        normal = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
      const front = Math.max(
        ...p.map((v) => (v[0] - c[0]) * normal[0] + (v[1] - c[1]) * normal[2]),
      );
      for (const x of [-1.6, 1.6])
        pane(
          o,
          [
            c[0] + normal[0] * (front + 0.04) + u[0] * x,
            g.baseY + Math.max(g.openingHeight + 1, g.eaveHeight - 3.1),
            c[1] + normal[2] * (front + 0.04) + u[1] * x,
          ],
          u,
          0.55,
          1.15,
          d,
          normal,
        );
      if (d >= 2 && [1, 7, 13, 14].includes(g.order)) {
        // Coarse pale portal border; no copied heraldic image or fresco.
        const hole = holes[0];
        for (const side of [-1, 1]) {
          const v = hole.point(side * (g.width / 2 + 0.22), 0, hole.depth / 2 - 2.01),
            u = hole.axis;
          pane(o, [v[0], g.baseY + 0.05, v[2]], u, 0.42, g.openingHeight * 0.64, d, normal, 'wood');
        }
      }
    }
  }
}
function churches(o, d) {
  for (const [id, h, r] of [
    [122049156, 7.7, 4.5],
    [122050942, 7.2, 3.6],
  ]) {
    const p = simplify(get(id).map(local), d === 0 ? 0.7 : 0),
      base =
        terrain.buildingSamples.find((v) => v.id === id).elevationMeters - k.terrainDatumElevation;
    prism(o, p, base, base + h, 'pale');
    roof(o, p, base + h, r, d);
    windows(o, p, base, h, d, 4.3);
    if (id === 122049156) {
      const p = rect(-42, -67.2, 5.5, 5.7);
      prism(o, p, base + 4, base + 17.8, 'pale');
      roof(o, p, base + 17.8, 9.4, d);
      if (d) {
        for (const z of [-70.09, -64.3])
          pane(o, [-42, base + 13.6, z], [1, 0], 1.6, 2.2, d, [0, 0, z < -67 ? -1 : 1]);
      }
    }
  }
}
function defenses(o, d) {
  const gateHoles = k.gates.flatMap((g) => holesFor(g, d));
  for (const id of k.wallWays) {
    const p = simplify(get(id).map(local), d === 0 ? 1.6 : d === 1 ? 0.8 : 0),
      cut = boundedOpenings(o, gateHoles),
      base = (q) => ground(q) - 0.35,
      top = (q) => ground(q) + 3.9;
    prism(cut, p, base, top, 'stone', 'stone');
    if (d >= 2) {
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          b = p[(i + 1) % p.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 4) continue;
        const count = Math.floor(len / 3.6),
          u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
        for (let j = 0; j < count; j++) {
          const t = (j + 0.5) / count,
            c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
            y = ground(c) + 3.9;
          const q = [
            [-0.7, -0.27],
            [0.7, -0.27],
            [0.7, 0.27],
            [-0.7, 0.27],
          ].map(([x, z]) => [c[0] + u[0] * x - u[1] * z, c[1] + u[1] * x + u[0] * z]);
          prism(cut, q, y, y + 0.8, 'stone', 'stone');
        }
      }
    }
  }
  for (const id of k.watchtowerWays) {
    const nativeRing = get(id);
    const extent = Math.max(
      ...[0, 1].map(
        (i) => Math.max(...nativeRing.map((p) => p[i])) - Math.min(...nativeRing.map((p) => p[i])),
      ),
    );
    // Tiny secondary sentry boxes drop out beyond skyline distance; every named gate remains.
    if (d === 0 && extent < 10) continue;
    const p = simplify(get(id).map(local), d === 0 ? 1.1 : d === 1 ? 0.45 : 0),
      b =
        terrain.buildingSamples.find((v) => v.id === id).elevationMeters - k.terrainDatumElevation,
      len = Math.max(...p.map((v) => v[0])) - Math.min(...p.map((v) => v[0])),
      h = len < 4 ? 5.6 : 9.5;
    prism(o, p, b, b + h);
    roof(o, p, b + h, len < 4 ? 2.6 : 4.1, d);
    windows(o, p, b, h, d, 4.3);
  }
}
function paths(o, d) {
  if (d === 0) return;
  for (const id of k.routeWays) {
    const p = get(id).map(local),
      w = 2.4;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i],
        b = p[i + 1],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
        points = [
          [a[0] + n[0] * w, a[1] + n[1] * w],
          [a[0] - n[0] * w, a[1] - n[1] * w],
          [b[0] - n[0] * w, b[1] - n[1] * w],
          [b[0] + n[0] * w, b[1] + n[1] * w],
        ];
      face(
        o,
        points.map((q) => [q[0], ground(q) + 0.05, q[1]]),
        'paving',
        'paving',
        [0, 1, 0],
      );
    }
  }
}
const builders = { summit, gates, churches, defenses, paths };
export const hochosterwitzParts = Object.fromEntries(
  Object.entries(builders).map(([name, fn]) => [name, (o, d) => fn(adapter(o), d)]),
);
export function buildHochosterwitzRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  for (const fn of Object.values(hochosterwitzParts)) fn(o, d);
}
export const buildHochosterwitzSkyline = (o) => buildHochosterwitzRuntime(o, 'skyline');
const camera = (name, p, look) => ({ name, position: native(p), lookAt: native(look) });
export const hochosterwitzStudy = {
  id: 'N0301',
  key: 'hochosterwitz_castle',
  title: 'Hochosterwitz Castle',
  category: 'castle',
  wikidataId: 'Q679248',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildHochosterwitzRuntime(o),
  surfaceOverrides: hochosterwitzSurfaces,
  brief:
    'Complete architectural fortification draft: summit U-shaped castle and open court, slate roofs/round turrets and square entry tower, church/chapel,14 individually mapped gates with open passages,watchtowers and stepped defensive walls on provisional terrain levels.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: hochosterwitzPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 7,
    identityFeatures: [
      'U-shaped pale summit castle with slate roofs and round turrets',
      'Fourteen distinct access gates along the winding fortified approach',
      'Open summit court,raised gallery and separate spired church',
    ],
  },
  sourceFacts: {
    exactCastleWay: 122050909,
    mappedAccessGateCount: 14,
    operatorDocumentedAccessGateCount: 14,
    documentedCentralFrontWindowBays: 7,
    primarySurveyedArchitecturalDimensionsVerified: false,
  },
  reconstruction: frame.reconstruction,
  scaleBasis: k.basis,
  refs: refs.references.map((r) => r.url),
  sourceDocuments: [
    'map-frame.json',
    'reference-metadata.json',
    'surface-means.json',
    'terrain-samples.json',
    'qa-terrain.json',
    'qa-heightmap.png',
  ],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license; own map traces © OpenStreetMap contributors,ODbL-1.0. Numerical terrain samples from Molen open elevation provider. Operator photographs are not redistributed.',
  sourceNotice:
    'Five shared256-square graphs and linear tints,flat glass,metric repeats. No embedded/new photo texture or downloaded mesh. Numerical hill heightmap is an isolated preview fixture; runtime architecture has no embedded terrain.',
  dataAttribution:
    '© OpenStreetMap contributors; Burg Hochosterwitz/Alex Devora/August Zoebl; Mapzen/AWS open elevation provider.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: k.groundAttachmentY,
    reviewStatus:
      'Inactive draft: coarse relative terrain levels,all gate/court grades and facade orientation require actual-site review.',
  }),
  geographicNote:
    'Native East/South geometry preserves all original map controls with heading0. One coarse terrain datum yields provisional multi-level architecture;source retains gate and passage attribution. No geographic or certified vertical-datum approval.',
  limitations: refs.limitations,
  importReason:
    'Preserve current summit U-shaped castle/open court,roof/turret identity,14 separately mapped open gates,church and stepped walls through source-authored detail levels.',
  previewGround: false,
  previewTerrain: { descriptor: 'qa-terrain.json', heightmap: 'qa-heightmap.png' },
  mediumFiContext: { scale: '1.8', neighborStyle: 'molen.worldgen.regional.atlantic.detached' },
  camera: { position: [220, 190, 230], lookAt: [-15, 75, -40], fov: 43 },
  qaCameras: [
    camera('summit-west-front', [0, 115, -125], [0, 103, -10]),
    camera('open-summit-court', [8, 100, 14], [9, 103, -5]),
    camera('south-gallery', [-92, 123, 0], [-28, 104, 1]),
    { name: 'gate-approach', position: [220, 160, -200], lookAt: [0, 47, -68] },
    { name: 'church-and-upper-gates', position: [-180, 138, 50], lookAt: [-70, 86, -8] },
    { name: 'mapped-plan', position: [-20, 320, -30], lookAt: [-20, 40, -30] },
  ],
};
