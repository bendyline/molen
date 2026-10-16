/** Nuremberg's three castle precincts: original map-based exterior and browser LODs. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/u0/u0z/n0297_nuremberg_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, root)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  means = read('surface-means.json');
const control = frame.controls;
export const nurembergPalette = {
  wall: '#d1b18f',
  rock: '#c4ad8e',
  plaster: '#f0e3c8',
  timber: '#986449',
  roof: '#d9916e',
  trim: '#eadbc0',
  glass: '#4d6178',
  paving: '#b7b0a1',
  grass: '#8aa469',
  copper: '#98bfaf',
  dark: '#70634f',
  flower: '#ca9265',
};
export const nurembergSurfaces = {
  sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
  rawstone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.9, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  aggregate: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
  foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries(nurembergPalette).map(([k, h]) => [
    k,
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
  Math.hypot(...p[0].map((v, k) => v - p.at(-1)[k])) < 0.002 ? p.slice(0, -1) : p;
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const circle = (center, r, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n;
    return [center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)];
  });
function face(o, p, color = 'wall', slot = 'sandstone', target) {
  p = p.map((p) => p.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    const n = normalFor(p[0], p[i], p[i + 1]);
    if (Math.hypot(...n) < 0.5) continue;
    if (target && n.reduce((s, v, k) => s + v * target[k], 0) < 0) p = [...p].reverse();
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
      t.map((p) => [p[0], p[2]]),
      colors[color],
    );
  }
}
function triangles(rings) {
  const q = rings.map(clean),
    p = q.flat(),
    holes = [];
  let j = q[0].length;
  for (const r of q.slice(1)) {
    holes.push(j);
    j += r.length;
  }
  const ix = earcut(p.flat(), holes, 2),
    out = [];
  for (let i = 0; i < ix.length; i += 3) out.push(ix.slice(i, i + 3).map((k) => p[k]));
  return out;
}
function cap(o, rings, y, color = 'wall', slot = 'sandstone') {
  for (const t of triangles(rings))
    face(
      o,
      t.map((p) => [p[0], y, p[1]]),
      color,
      slot,
      [0, 1, 0],
    );
}
function prism(o, rings, y0, y1, color = 'wall', slot = 'sandstone', topCap = true) {
  rings = rings.map(clean);
  for (const [j, p] of rings.entries()) {
    const sign = Math.sign(area(p)) * (j ? -1 : 1);
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      face(
        o,
        [
          [a[0], y0, a[1]],
          [b[0], y0, b[1]],
          [b[0], y1, b[1]],
          [a[0], y1, a[1]],
        ],
        color,
        slot,
        [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
      );
    }
  }
  if (topCap) cap(o, rings, y1, color, slot);
}
function wall(o, a, b, y0, y1, width, color = 'wall', slot = 'sandstone') {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.01) return [];
  const n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
    p = [
      [a[0] + (n[0] * width) / 2, a[1] + (n[1] * width) / 2],
      [b[0] + (n[0] * width) / 2, b[1] + (n[1] * width) / 2],
      [b[0] - (n[0] * width) / 2, b[1] - (n[1] * width) / 2],
      [a[0] - (n[0] * width) / 2, a[1] - (n[1] * width) / 2],
    ];
  prism(o, [p], y0, y1, color, slot);
  return p;
}
function clip(p, fn) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      av = fn(a),
      bv = fn(b);
    if (av >= -1e-8) out.push(a);
    if (av >= 0 !== bv >= 0) {
      const u = av / (av - bv);
      out.push(a.map((v, k) => v + (b[k] - v) * u));
    }
  }
  return out;
}
function simplified(p, tolerance = 1.5) {
  p = clean(p);
  if (p.length <= 5) return p;
  const result = [...p];
  let removed = true;
  while (removed && result.length > 4) {
    removed = false;
    for (let i = 0; i < result.length; i++) {
      const a = result[(i + result.length - 1) % result.length],
        b = result[i],
        c = result[(i + 1) % result.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        length = Math.hypot(dx, dz);
      if (length && Math.abs(dx * (b[1] - a[1]) - dz * (b[0] - a[0])) / length < tolerance) {
        result.splice(i, 1);
        removed = true;
        break;
      }
    }
  }
  return result;
}
function cutOpenings(out, holes) {
  return {
    addTriangle(slot, ref, p, n, uv, color) {
      const touching = holes.filter(
        (h) =>
          !h.planes.some((v) =>
            p.every((q) => q[0] * v[0] + q[1] * v[1] + q[2] * v[2] + v[3] < -1e-7),
          ),
      );
      openingBuilder(out, touching).addTriangle(slot, ref, p, n, uv, color);
    },
  };
}
function reveals(o, rings, y0, y1, holes, color = 'wall', slot = 'sandstone') {
  for (const h of holes) {
    const cut = cutOpenings(
      o,
      holes.filter((other) => other !== h),
    );
    const target = { addTriangle: (_s, r, p, n, uv, c) => cut.addTriangle(slot, r, p, n, uv, c) };
    for (const t of triangles(rings))
      openingReveals(
        target,
        t,
        () => y0,
        () => y1,
        [h],
        colors[color],
      );
  }
}
function holes(d) {
  return control.portals.map((p) => prepareOpening(p, p.baseY, d));
}
function surfaceFrame(outline, rf) {
  const axis = rf.axis.map((v) => v / Math.hypot(...rf.axis)),
    across = [-axis[1], axis[0]],
    q = clean(outline);
  const dot = (p, a) => p[0] * a[0] + p[1] * a[1],
    us = q.map((p) => dot(p, axis)),
    vs = q.map((p) => dot(p, across));
  return {
    axis,
    across,
    minU: Math.min(...us),
    maxU: Math.max(...us),
    minV: Math.min(...vs),
    maxV: Math.max(...vs),
  };
}
function insideFootprint(point, outline) {
  const ring = clean(outline);
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < a[0] + ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1])
    )
      inside = !inside;
  }
  return inside;
}
function roofCoordinates(rf, u, v) {
  return [rf.axis[0] * u + rf.across[0] * v, rf.axis[1] * u + rf.across[1] * v];
}
function roofHeight(rf, p, hip) {
  const u = p[0] * rf.axis[0] + p[1] * rf.axis[1],
    v = p[0] * rf.across[0] + p[1] * rf.across[1],
    half = (rf.maxV - rf.minV) / 2;
  return Math.max(
    0,
    Math.min(
      (v - rf.minV) / half,
      (rf.maxV - v) / half,
      ...(hip ? [(u - rf.minU) / half, (rf.maxU - u) / half] : []),
    ),
  );
}
function roof(
  o,
  outline,
  rf,
  base,
  rise,
  hip = false,
  wallColor = 'wall',
  wallSlot = 'sandstone',
  color = 'roof',
  slot = 'tile',
) {
  const p = clean(outline),
    half = (rf.maxV - rf.minV) / 2;
  const planes = [
    (q) => (q[0] * rf.across[0] + q[1] * rf.across[1] - rf.minV) / half,
    (q) => (rf.maxV - q[0] * rf.across[0] - q[1] * rf.across[1]) / half,
  ];
  if (hip)
    planes.push(
      (q) => (q[0] * rf.axis[0] + q[1] * rf.axis[1] - rf.minU) / half,
      (q) => (rf.maxU - q[0] * rf.axis[0] - q[1] * rf.axis[1]) / half,
    );
  for (const t of triangles([p]))
    for (const plane of planes) {
      let q = t;
      for (const other of planes) if (other !== plane) q = clip(q, (p) => other(p) - plane(p));
      if (q.length >= 3)
        face(
          o,
          q.map((p) => [p[0], base + rise * Math.max(0, plane(p)), p[1]]),
          color,
          slot,
          [0, 1, 0],
        );
    }
  const sign = Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      cuts = [0, 1];
    // A hip edge may cross any pair of slope planes, even when both endpoints
    // are at the eave. Close every intervening rise rather than skipping it.
    for (let j = 0; j < planes.length; j++)
      for (let k = j + 1; k < planes.length; k++) {
        const va = planes[j](a) - planes[k](a),
          vb = planes[j](b) - planes[k](b);
        if (va * vb < 0) {
          const u = va / (va - vb),
            q = a.map((v, k) => v + (b[k] - v) * u);
          if (planes[j](q) <= Math.min(...planes.map((plane) => plane(q))) + 1e-7) cuts.push(u);
        }
      }
    const t = [...new Set(cuts)]
      .sort((a, b) => a - b)
      .map((u) => a.map((v, k) => v + (b[k] - v) * u));
    for (let j = 0; j < t.length - 1; j++) {
      const a = t[j],
        b = t[j + 1],
        ha = roofHeight(rf, a, hip) * rise,
        hb = roofHeight(rf, b, hip) * rise;
      if (ha + hb < 0.01) continue;
      face(
        o,
        [
          [a[0], base, a[1]],
          [b[0], base, b[1]],
          [b[0], base + hb, b[1]],
          [a[0], base + ha, a[1]],
        ],
        wallColor,
        wallSlot,
        [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
      );
    }
  }
}
function ribbon(o, a, b, width, color = 'timber', slot = 'wood', normal = [0, 0, 1]) {
  const d = b.map((v, k) => v - a[k]),
    len = Math.hypot(...d);
  if (len < 0.01) return;
  const across = [
    normal[1] * d[2] - normal[2] * d[1],
    normal[2] * d[0] - normal[0] * d[2],
    normal[0] * d[1] - normal[1] * d[0],
  ];
  const n = Math.hypot(...across);
  if (n < 0.01) return;
  const at = (p, s) => p.map((v, k) => v + (((across[k] / n) * width) / 2) * s);
  face(o, [at(a, -1), at(b, -1), at(b, 1), at(a, 1)], color, slot, normal);
}
function pane(
  o,
  center,
  axis,
  normal,
  y,
  width,
  height,
  d,
  arch = false,
  color = 'glass',
  slot = 'glass',
) {
  const p = [
      [-width / 2, 0],
      [width / 2, 0],
    ],
    n = d === 1 ? 3 : 6;
  if (arch)
    for (let i = 0; i <= n; i++) {
      const a = (Math.PI * i) / n;
      p.push([(Math.cos(a) * width) / 2, height - width / 2 + (Math.sin(a) * width) / 2]);
    }
  else p.push([width / 2, height], [-width / 2, height]);
  const at = (u, h, off = 0.04) => [
    center[0] + axis[0] * u + normal[0] * off,
    y + h,
    center[1] + axis[1] * u + normal[1] * off,
  ];
  const norm = [normal[0], 0, normal[1]];
  face(
    o,
    p.map((p) => at(...p)),
    color,
    slot,
    norm,
  );
  if (d === 3 && color === 'glass') {
    ribbon(o, at(0, 0, 0.06), at(0, height, 0.06), 0.18, 'trim', 'rawstone', norm);
    ribbon(
      o,
      at(-width / 2, height * 0.48, 0.06),
      at(width / 2, height * 0.48, 0.06),
      0.18,
      'trim',
      'rawstone',
      norm,
    );
  }
}
function facade(o, b, d, ring = b.outline) {
  if (!d) return;
  const p = clean(ring),
    sign = Math.sign(area(p)),
    eave = b.baseY + b.eaveHeight;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      c = p[(i + 1) % p.length],
      len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (len < 4) continue;
    const axis = [(c[0] - a[0]) / len, (c[1] - a[1]) / len],
      normal = [sign * axis[1], -sign * axis[0]],
      norm = [normal[0], 0, normal[1]],
      at = (u, h, off = 0.055) => [
        a[0] + axis[0] * u + normal[0] * off,
        h,
        a[1] + axis[1] * u + normal[1] * off,
      ];
    const count = Math.max(1, Math.floor(len / (d === 1 ? 9 : 4.7))),
      floorGap = b.eaveHeight > 12 ? 4.3 : 3.3;
    const floors =
      d === 1
        ? [eave - 2.6]
        : Array.from(
            { length: Math.max(1, Math.floor((b.eaveHeight - 1) / floorGap)) },
            (_, j) => b.baseY + 2.2 + j * floorGap,
          );
    for (const y of floors)
      if (y + 1.6 < eave - 0.2)
        for (let j = 0; j < count; j++) {
          const u = (len * (j + 0.5)) / count;
          pane(
            o,
            [a[0] + axis[0] * u, a[1] + axis[1] * u],
            axis,
            normal,
            y,
            b.key === 'imperial-stables' ? 1.05 : 1.3,
            1.6,
            d,
            b.key === 'double-chapel',
          );
        }
    if (d >= 2 && b.timber) {
      const y0 = b.baseY + 3.4;
      for (const y of [y0, eave - 0.2])
        ribbon(o, at(0.1, y), at(len - 0.1, y), 0.32, 'timber', 'wood', norm);
      const n = Math.max(1, Math.floor(len / 3.6));
      for (let j = 0; j <= n; j++) {
        const u = 0.2 + ((len - 0.4) * j) / n;
        ribbon(o, at(u, y0), at(u, eave), 0.3, 'timber', 'wood', norm);
      }
      if (d === 3)
        for (let j = 0; j < n; j += 2) {
          const u = 0.3 + ((len - 0.6) * j) / n;
          ribbon(
            o,
            at(u, y0 + 0.4),
            at(Math.min(len - 0.3, u + len / n), eave - 1),
            0.28,
            'timber',
            'wood',
            norm,
          );
        }
    }
  }
}
function dormers(o, b, d) {
  if (d < 1) return;
  const rf = surfaceFrame(b.outline, b.roofFrame),
    rows = d === 1 ? 1 : d === 2 ? 3 : control.stablesDormerRows;
  const perRow = d === 1 ? 3 : d === 2 ? 5 : 8,
    half = (rf.maxV - rf.minV) / 2,
    vc = (rf.minV + rf.maxV) / 2,
    eave = b.baseY + b.eaveHeight;
  for (const sign of [-1, 1])
    for (let row = 0; row < rows; row++) {
      const vv = vc + sign * half * (0.76 - row * 0.12);
      for (let j = 0; j < perRow; j++) {
        const u = rf.minU + 3 + ((rf.maxU - rf.minU - 6) * (j + 0.5)) / perRow,
          center = roofCoordinates(rf, u, vv),
          normal = rf.across.map((v) => v * sign);
        const q = (du, dv) => [
          center[0] + rf.axis[0] * du + normal[0] * dv,
          center[1] + rf.axis[1] * du + normal[1] * dv,
        ];
        const onRoof = [q(-0.9, -0.6), q(0.9, -0.6), q(0.9, 0.9), q(-0.9, 0.9)],
          base = eave + b.roofRise * roofHeight(rf, q(0, -0.6), false) - 0.15,
          top = base + 1.3;
        // A roof-frame rectangle can extend outside this irregular mapped building.
        // Omit any dormer whose feet or connecting edges would straddle a clipped edge.
        if (
          onRoof.some((p, i) => {
            const next = onRoof[(i + 1) % onRoof.length];
            return (
              roofHeight(rf, p, false) < 0.12 ||
              !insideFootprint(p, b.outline) ||
              !insideFootprint(
                p.map((v, k) => (v + next[k]) / 2),
                b.outline,
              )
            );
          })
        )
          continue;
        // Each dormer side starts on the sloping roof, including its lower front.
        const signArea = Math.sign(area(onRoof));
        for (let k = 0; k < onRoof.length; k++) {
          const a = onRoof[k],
            b0 = onRoof[(k + 1) % onRoof.length];
          const bottom = (p) => eave + b.roofRise * roofHeight(rf, p, false) - 0.08;
          face(
            o,
            [
              [a[0], bottom(a), a[1]],
              [b0[0], bottom(b0), b0[1]],
              [b0[0], top, b0[1]],
              [a[0], top, a[1]],
            ],
            'plaster',
            'plaster',
            [signArea * (b0[1] - a[1]), 0, -signArea * (b0[0] - a[0])],
          );
        }
        const front = [q(-0.9, 0.9), q(0.9, 0.9)],
          ridge = q(0, -0.7),
          tip = q(0, 0.9);
        face(
          o,
          [
            [front[0][0], top, front[0][1]],
            [front[1][0], top, front[1][1]],
            [tip[0], top + 0.65, tip[1]],
          ],
          'plaster',
          'plaster',
          [normal[0], 0, normal[1]],
        );
        for (const side of [-1, 1])
          face(
            o,
            [
              [q(side * 0.96, -0.7)[0], top, q(side * 0.96, -0.7)[1]],
              [q(side * 0.96, 1)[0], top, q(side * 0.96, 1)[1]],
              [tip[0], top + 0.65, tip[1]],
              [ridge[0], top + 0.65, ridge[1]],
            ],
            'roof',
            'tile',
            [0, 1, 0],
          );
        pane(o, q(0, 0.92), rf.axis, normal, base + 0.3, 0.85, 0.82, d);
      }
    }
}
function buildings(o, d) {
  const h = d ? holes(d) : [],
    cut = cutOpenings(o, h);
  for (const b of control.buildings) {
    const outline = d ? b.outline : simplified(b.outline, 2.2),
      eave = b.baseY + b.eaveHeight,
      slot = b.material;
    if (d && b.foundationBaseY !== undefined)
      prism(cut, [outline], b.foundationBaseY, b.baseY, 'rock', 'rawstone', false);
    prism(
      cut,
      [outline],
      !d && b.foundationBaseY !== undefined ? b.foundationBaseY : b.baseY,
      eave,
      b.timber ? 'plaster' : 'wall',
      slot,
      false,
    );
    if (d) reveals(o, [outline], b.baseY, eave, h, b.timber ? 'plaster' : 'wall', slot);
    const rf = surfaceFrame(outline, b.roofFrame);
    roof(cut, outline, rf, eave, b.roofRise, b.roof === 'hip', b.timber ? 'plaster' : 'wall', slot);
    facade(cut, b, d, outline);
    if (b.key === 'imperial-stables') dormers(o, b, d);
    if (d >= 2 && b.timber) {
      // One coherent timber truss on each gable, following the actual roof field.
      const p = clean(outline),
        sign = Math.sign(area(p));
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          c = p[(i + 1) % p.length],
          len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (len < 4 || len > 19) continue;
        const axis = [(c[0] - a[0]) / len, (c[1] - a[1]) / len],
          normal = [sign * axis[1], -sign * axis[0]],
          norm = [normal[0], 0, normal[1]];
        const mid = a.map((v, k) => (v + c[k]) / 2),
          rise = b.roofRise * roofHeight(rf, mid, b.roof === 'hip');
        if (rise < 2) continue;
        const at = (p, h) => [p[0] + normal[0] * 0.06, h, p[1] + normal[1] * 0.06];
        ribbon(o, at(a, eave + 0.1), at(mid, eave + rise - 0.3), 0.34, 'timber', 'wood', norm);
        ribbon(o, at(c, eave + 0.1), at(mid, eave + rise - 0.3), 0.34, 'timber', 'wood', norm);
        ribbon(o, at(mid, eave), at(mid, eave + rise - 0.3), 0.32, 'timber', 'wood', norm);
      }
    }
  }
}
function roundLoft(
  o,
  center,
  radius,
  base,
  profile,
  n,
  color = 'roof',
  slot = 'tile',
  topCap = true,
) {
  const rings = profile.map(([h, r]) => ({ y: base + h, p: circle(center, radius * r, n) }));
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const a = rings[j],
        b = rings[j + 1],
        k = (i + 1) % n,
        p = a.p[i],
        q = a.p[k];
      face(
        o,
        [
          [p[0], a.y, p[1]],
          [q[0], a.y, q[1]],
          [b.p[k][0], b.y, b.p[k][1]],
          [b.p[i][0], b.y, b.p[i][1]],
        ],
        color,
        slot,
        [(p[0] + q[0]) / 2 - center[0], 0, (p[1] + q[1]) / 2 - center[1]],
      );
    }
  if (topCap) cap(o, [rings.at(-1).p], rings.at(-1).y, color, slot);
}
function sinwell(o, t, d) {
  const n = d === 0 ? 6 : d === 1 ? 12 : d === 2 ? 16 : 24,
    b = t.baseY,
    r = t.radius;
  prism(o, [circle(t.center, r, n)], b, b + 28.7, 'wall', 'sandstone', false);
  roundLoft(
    o,
    t.center,
    r,
    b + 28.7,
    [
      [0, 1],
      [0.8, 1.16],
      [1.3, 1.16],
    ],
    n,
    'wall',
    'sandstone',
    d !== 0,
  );
  prism(o, [circle(t.center, r * 1.14, n)], b + 30, b + 32, 'plaster', 'plaster', false);
  roundLoft(
    o,
    t.center,
    r,
    b + 32,
    [
      [0, 1.23],
      [3.8, 0.5],
    ],
    n,
    'roof',
    'tile',
    d !== 0,
  );
  prism(
    o,
    [circle(t.center, r * 0.48, d === 0 ? 6 : 8)],
    b + 35.8,
    b + 37.5,
    'copper',
    'plaster',
    false,
  );
  roundLoft(
    o,
    t.center,
    r,
    b + 37.5,
    [
      [0, 0.59],
      [3, 0.035],
    ],
    d === 0 ? 6 : 8,
    'roof',
    'tile',
    d !== 0,
  );
  roundLoft(
    o,
    t.center,
    r,
    b + 40.5,
    [
      [0, 0.035],
      [0.5, 0.018],
    ],
    d === 0 ? 4 : 8,
    'dark',
    'wood',
    d !== 0,
  );
  if (d) {
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        normal = [Math.cos(a), Math.sin(a)],
        axis = [-normal[1], normal[0]];
      for (const y of [b + 30.35, b + 36.1])
        pane(
          o,
          [
            t.center[0] + normal[0] * (y < b + 34 ? r * 1.14 : r * 0.48),
            t.center[1] + normal[1] * (y < b + 34 ? r * 1.14 : r * 0.48),
          ],
          axis,
          normal,
          y,
          y < b + 34 ? 0.75 : 0.62,
          1,
          d,
        );
    }
    if (d >= 2)
      for (const a of [Math.PI / 2, Math.PI * 1.4])
        pane(
          o,
          [t.center[0] + r * Math.cos(a), t.center[1] + r * Math.sin(a)],
          [-Math.sin(a), Math.cos(a)],
          [Math.cos(a), Math.sin(a)],
          b + 9,
          1,
          1.7,
          d,
          true,
        );
  }
}
function towerWindows(o, t, d, outline, top) {
  if (!d) return;
  const p = clean(outline),
    sign = Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 4) continue;
    const axis = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      normal = [sign * axis[1], -sign * axis[0]];
    const rows = d === 1 ? [top - 2.5] : [top - 2.5, top - 11.5, top - 21];
    for (const [j, y] of rows.entries()) {
      if (y < t.baseY + 4) continue;
      const count = j === 0 && t.kind === 'pentagonal' ? 3 : t.kind === 'square' && j === 0 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const u = (len * (k + 1)) / (count + 1);
        pane(
          o,
          [a[0] + axis[0] * u, a[1] + axis[1] * u],
          axis,
          normal,
          y,
          j === 0 ? 0.85 : 0.55,
          j === 0 ? 1.4 : 1.5,
          d,
          t.kind === 'square' && j === 0,
        );
      }
    }
  }
}
function towers(o, d) {
  for (const t of control.towers) {
    if (t.kind === 'round') {
      sinwell(o, t, d);
      continue;
    }
    const outline = d ? t.outline : simplified(t.outline, 0.7),
      eave = t.baseY + t.height - t.roofRise,
      base = !d && t.foundationBaseY !== undefined ? t.foundationBaseY : t.baseY;
    if (d && t.foundationBaseY !== undefined)
      prism(o, [outline], t.foundationBaseY, t.baseY, 'rock', 'rawstone', false);
    if (t.kind === 'pentagonal') {
      prism(o, [outline], base, eave - 4.2, 'wall', 'sandstone', false);
      prism(o, [outline], eave - 4.2, eave, 'timber', 'wood', false);
    } else prism(o, [outline], base, eave, 'wall', 'sandstone', false);
    roof(o, outline, surfaceFrame(outline, t.roofFrame), eave, t.roofRise, true);
    towerWindows(o, t, d, outline, eave);
    if (t.kind === 'corner-oriels') {
      const rf = surfaceFrame(outline, t.roofFrame);
      for (const [u, v] of [
        [rf.minU, rf.minV],
        [rf.maxU, rf.minV],
        [rf.maxU, rf.maxV],
        [rf.minU, rf.maxV],
      ]) {
        const center = roofCoordinates(rf, u, v),
          r = d === 0 ? 1.1 : 1.2;
        prism(o, [circle(center, r, 4)], eave - 2, eave + 2, 'wall', 'sandstone', d !== 0);
        roundLoft(
          o,
          center,
          r,
          eave + 2,
          [
            [0, 1.3],
            [3.7, 0.04],
          ],
          4,
          'roof',
          'tile',
          d !== 0,
        );
      }
    }
    if (d >= 2 && t.kind === 'pentagonal') {
      // Restored timber observation storey and the projecting former high doorway.
      const rf = surfaceFrame(outline, t.roofFrame);
      const center = roofCoordinates(rf, (rf.minU + rf.maxU) / 2, rf.minV - 0.55);
      prism(
        o,
        [rect(center[0] - 1, center[1] - 0.7, center[0] + 1, center[1] + 0.7)],
        eave - 8.3,
        eave - 6,
        'timber',
        'wood',
      );
    }
  }
}
function ground(o, d) {
  cap(
    o,
    [d ? control.innerCourt.outline : simplified(control.innerCourt.outline, 1.2)],
    control.innerCourt.y,
    'paving',
    'aggregate',
  );
  cap(
    o,
    [d ? control.bailey.outline : simplified(control.bailey.outline, 1.2)],
    control.bailey.y,
    'paving',
    'aggregate',
  );
  const freiung = d ? control.freiung.outline : simplified(control.freiung.outline, 1.8);
  prism(o, [freiung], 3.8, control.freiung.y, 'rock', 'rawstone', false);
  cap(o, [freiung], control.freiung.y + 0.02, 'paving', 'aggregate');
  for (const b of control.fortifications)
    prism(o, [d ? b.outline : simplified(b.outline, 3.5)], b.baseY, b.topY, 'wall', 'sandstone');
  for (const g of control.gardens) {
    prism(o, [g.outline], 0.3, g.y, 'rock', 'rawstone', false);
    cap(o, [g.outline], g.y + 0.01, 'grass', 'foliage');
    if (d >= 2) {
      const q = clean(g.outline),
        center = [0, 1].map((k) => q.reduce((n, p) => n + p[k], 0) / q.length);
      cap(o, [circle(center, 2.6, 8)], g.y + 0.04, 'paving', 'aggregate');
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI * i) / 2,
          c = [center[0] + Math.cos(a) * 7, center[1] + Math.sin(a) * 7];
        cap(
          o,
          [rect(c[0] - 2.2, c[1] - 1.6, c[0] + 2.2, c[1] + 1.6)],
          g.y + 0.035,
          'flower',
          'foliage',
        );
      }
    }
  }
  const h = d ? holes(d) : [],
    cut = cutOpenings(o, h);
  // Narrow partition walls are subpixel at skyline distance; the broad bastions remain.
  for (const w of d ? control.walls : []) {
    const p = d
      ? w.points
      : w.points.filter((_, i) => i === 0 || i === w.points.length - 1 || i % 3 === 0);
    for (let i = 0; i < p.length - 1; i++) {
      const ring = wall(cut, p[i], p[i + 1], w.baseY, w.topY, w.width);
      if (d && ring.length) reveals(o, [ring], w.baseY, w.topY, h);
    }
  }
  // Original rock terrace supports the court and bailey instead of floating floors.
  const plateau = control.corePlateau;
  prism(cut, [plateau.outline], plateau.baseY, plateau.topY, 'rock', 'rawstone');
  if (d) reveals(o, [plateau.outline], plateau.baseY, plateau.topY, h, 'rock', 'rawstone');
}
function approaches(o, d) {
  const a = control.approach,
    p = a.points;
  for (let i = 0; i < p.length - 1; i++) {
    const t0 = i / (p.length - 1),
      t1 = (i + 1) / (p.length - 1),
      y0 = a.startY + (a.endY - a.startY) * t0,
      y1 = a.startY + (a.endY - a.startY) * t1;
    const aa = p[i],
      bb = p[i + 1],
      len = Math.hypot(bb[0] - aa[0], bb[1] - aa[1]),
      normal = [-(bb[1] - aa[1]) / len, (bb[0] - aa[0]) / len];
    face(
      o,
      [
        [aa[0] + (normal[0] * a.width) / 2, y0, aa[1] + (normal[1] * a.width) / 2],
        [bb[0] + (normal[0] * a.width) / 2, y1, bb[1] + (normal[1] * a.width) / 2],
        [bb[0] - (normal[0] * a.width) / 2, y1, bb[1] - (normal[1] * a.width) / 2],
        [aa[0] - (normal[0] * a.width) / 2, y0, aa[1] - (normal[1] * a.width) / 2],
      ],
      'paving',
      'aggregate',
      [0, 1, 0],
    );
  }
  if (!d) return;
  for (const h of control.portals) {
    const axis = [-h.axis[1], h.axis[0]],
      half = h.depth / 2;
    wall(
      o,
      [h.center[0] - axis[0] * half, h.center[1] - axis[1] * half],
      [h.center[0] + axis[0] * half, h.center[1] + axis[1] * half],
      h.baseY - 0.06,
      h.baseY + 0.015,
      h.width - 0.1,
      'paving',
      'aggregate',
    );
  }
}
function details(o, d) {
  if (d < 2) return;
  const b = control.buildings.find((b) => b.key === 'kastellanhaus'),
    rf = surfaceFrame(b.outline, b.roofFrame),
    p = roofCoordinates(rf, rf.maxU - 4, (rf.minV + rf.maxV) / 2),
    base = b.baseY + b.eaveHeight + b.roofRise - 1;
  prism(o, [circle(p, 0.8, 8)], base, base + 1.7, 'plaster', 'plaster');
  roundLoft(
    o,
    p,
    1,
    base + 1.7,
    [
      [0, 1.2],
      [1.1, 0.55],
      [2.2, 0.05],
    ],
    8,
    'copper',
    'plaster',
  );
  for (const b of control.buildings.filter((b) => b.key !== 'imperial-stables')) {
    const rf = surfaceFrame(b.outline, b.roofFrame),
      p = roofCoordinates(rf, (rf.minU + rf.maxU) / 2, (rf.minV + rf.maxV) / 2);
    prism(
      o,
      [rect(p[0] - 0.45, p[1] - 0.38, p[0] + 0.45, p[1] + 0.38)],
      b.baseY + b.eaveHeight + b.roofRise - 0.2,
      b.baseY + b.eaveHeight + b.roofRise + 1.8,
      'wall',
      'sandstone',
    );
  }
}
const parts = { buildings, towers, ground, approaches, details };
function floatBuilder(out) {
  return {
    addTriangle(slot, ref, p, _n, uv, color) {
      const points = p.map((p) => p.map(Math.fround));
      const a = points[1].map((v, k) => v - points[0][k]),
        b = points[2].map((v, k) => v - points[0][k]);
      const cross = [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
      // Aperture intersections may collapse after Float32 conversion.
      if (Math.hypot(...cross) < 1e-10) return;
      out.addTriangle(slot, ref, points, normalFor(...points), uv, color);
    },
  };
}
export const nurembergParts = Object.fromEntries(
  Object.entries(parts).map(([key, fn]) => [key, (out, d) => fn(floatBuilder(out), d)]),
);
export function buildNurembergRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  for (const fn of Object.values(nurembergParts)) fn(o, d);
}
export const buildNurembergSkyline = (o) => buildNurembergRuntime(o, 'skyline');
export const nurembergStudy = {
  id: 'N0297',
  key: 'nuremberg_castle',
  title: 'Nuremberg Castle',
  category: 'castle',
  wikidataId: 'Q707396',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  previewImage: 'shots/shared/angle-0.png',
  build: (o) => buildNurembergRuntime(o),
  surfaceOverrides: nurembergSurfaces,
  brief:
    'Three adjoining castle precincts: cylindrical Sinwell with flared observation floor and pointed Renaissance helm,Palas/Kemenate/double chapel/Heidenturm around open court,half-timbered forecourt ranges and well,Hasenburg and three physical passages,Walburgis/Pentagonal Tower,eastern Kaiserstallung with tiered dormers and Luginsland corner oriels,mapped bastions and original schematic gardens.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: nurembergPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 8,
    identityFeatures: [
      'Round Sinwell with flared observation floor,red roof and small green lantern',
      'Three precincts with red-roofed Palas and half-timbered ranges around open courts',
      'Steep multi-row dormer roof of Kaiserstallung between Pentagonal Tower and corner-oriel Luginsland',
    ],
  },
  sourceFacts: {
    exactIdentityNode: 31013768,
    publishedSinwellHeightMeters: 41,
    mappedBuildingParts: 13,
    mappedSignatureTowers: 4,
    historicPrecincts: 3,
    physicalPassages: 3,
    surveyedVerticalDatum: false,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Own attributed map footprints/entrance traces. Primary city guide Sinwell41m from plinth to weather vane. Other heights,roof partitions and terraces estimated; raw map height tags retain their provenance.',
  refs: refs.references.map((r) => r.url),
  sourceDocuments: [
    'map-frame.json',
    'surface-means.json',
    'reference-metadata.json',
    'relief-grid.json',
  ],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license; own mapped traces © OpenStreetMap contributors,ODbL-1.0. Primary photographs/drawings are not redistributed.',
  sourceNotice:
    'Six existing256-square shared graphs with linear tints and central metric UV repeats; flat glass/grass. No embedded/new image,photo texture,downloaded model or traced printed drawing. Roofs clip to actual footprints and courts remain physically open.',
  dataAttribution:
    '© OpenStreetMap contributors; Bayerische Schlösserverwaltung; Stadt Nürnberg; Mapzen/SRTM, NASA/USGS.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: control.platformY,
    reviewStatus: 'Inactive draft: coarse terrain/terrace and current site fit remain unverified.',
  }),
  geographicNote:
    'Geometry is native +X east/+Z south with heading0. Exact-QID map point anchors separately attributed physical components. Native Y0 is provisional terrain-grid minimum320.29m,attachment planeY17.2; real rock/terraced ground and vertical datum need review.',
  limitations: refs.limitations,
  importReason:
    'Preserve three open precincts,physical gates,round/square/pentagonal tower forms,tiered stables roof and half-timbered ranges through four source-authored levels.',
  mediumFiContext: { scale: '3.0', neighborStyle: 'molen.worldgen.regional.atlantic.detached' },
  camera: { position: [320, 205, 280], lookAt: [30, 24, -4], fov: 43 },
  qaCameras: [
    { name: 'sinwell-renaissance-helm', position: [139, 47, 101], lookAt: [85, 43, 33] },
    { name: 'imperial-inner-court', position: [1, 63, 17], lookAt: [1, 21, 8] },
    { name: 'timber-well-and-bailey', position: [64, 34, 45], lookAt: [53, 25, 25] },
    { name: 'hasenburg-passage', position: [99, 19.1, 56], lookAt: [74, 19.1, 52] },
    { name: 'palas-chapel-city-front', position: [-7, 29, 99], lookAt: [4, 31, 27] },
    { name: 'stables-and-eastern-towers', position: [190, 47, 75], lookAt: [172, 35, -17] },
    { name: 'mapped-bastions', position: [-115, 119, -114], lookAt: [-27, 16, -34] },
  ],
};
