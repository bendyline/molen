/** Original current Burg Liechtenstein exterior; attributed horizontal traces, estimated sections. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import {
  openingBuilder,
  openingReveals,
  openingShape,
  prepareOpening,
} from './authored-wall-openings.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/u2/u2e/n0302_liechtenstein_castle/',
  import.meta.url,
);
const read = (n) => JSON.parse(readFileSync(new URL(n, root)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  means = read('surface-means.json'),
  k = frame.controls;
const co = Math.cos(k.planAngleRadians),
  si = Math.sin(k.planAngleRadians);
export const liechtensteinPlanPoint = (x, z) => [x * co + z * si, -x * si + z * co];
const local = ([x, z]) => [x * co - z * si, x * si + z * co];
const native = ([x, y, z]) => {
  const p = liechtensteinPlanPoint(x, z);
  return [p[0], y, p[1]];
};
export const liechtensteinPalette = {
  wall: '#cfbea2',
  stone: '#d8cbb4',
  roof: '#ad7959',
  slate: '#8d9697',
  wood: '#79664f',
  glass: '#4d6178',
  paving: '#bbb3a2',
};
export const liechtensteinSurfaces = {
  masonry: { slot: 'wall', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.88, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
  paving: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
};
const colors = Object.fromEntries(
  Object.entries(liechtensteinPalette).map(([key, h]) => [
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
const get = (id) => clean(frame.geometry.rawFeatures.find((w) => w.id === id).points).map(local);
const rect = (x, z, w, h) => [
  [x - w / 2, z - h / 2],
  [x + w / 2, z - h / 2],
  [x + w / 2, z + h / 2],
  [x - w / 2, z + h / 2],
];
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
const center = (p) =>
  [0, 1].map((i) => (Math.min(...p.map((v) => v[i])) + Math.max(...p.map((v) => v[i]))) / 2);
const scale = (p, a) => {
  const c = center(p);
  return p.map((v) => v.map((x, i) => c[i] + (x - c[i]) * a));
};
function face(o, p, color = 'wall', slot = 'masonry', target, d = 3) {
  p = p.map((v) => v.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    const n = normalFor(p[0], p[i], p[i + 1]);
    if (Math.hypot(...n) < 0.5) continue;
    if (target && n.reduce((s, v, j) => s + v * target[j], 0) < 0) p = [...p].reverse();
    break;
  }
  const c =
    d === 0 && means[slot] ? colors[color].map((v, i) => v * means[slot][i]) : colors[color];
  for (let i = 1; i < p.length - 1; i++) {
    const q = [p[0], p[i], p[i + 1]],
      n = normalFor(...q);
    if (Math.hypot(...n) < 0.5) continue;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      q,
      n,
      q.map((v) => [v[0], v[2]]),
      c,
    );
  }
}
function triangulate(p) {
  p = clean(p);
  const ix = earcut(p.flat(), null, 2),
    out = [];
  for (let i = 0; i < ix.length; i += 3) out.push(ix.slice(i, i + 3).map((j) => p[j]));
  return out;
}
function cap(o, p, y, color = 'wall', slot = 'masonry', d = 3) {
  for (const t of triangulate(p))
    face(
      o,
      t.map((v) => [v[0], typeof y === 'function' ? y(v) : y, v[1]]),
      color,
      slot,
      [0, 1, 0],
      d,
    );
}
function prism(o, p, y0, y1, color = 'wall', slot = 'masonry', d = 3, top = false) {
  p = clean(p);
  const sign = Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      lo = (v) => (typeof y0 === 'function' ? y0(v) : y0),
      hi = (v) => (typeof y1 === 'function' ? y1(v) : y1);
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
      d,
    );
  }
  if (top) cap(o, p, y1, color, slot, d);
}
function clip(p, value) {
  const out = [];
  let a = p.at(-1),
    av = value(a);
  for (const b of p) {
    const bv = value(b);
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
function section(p, lo, hi) {
  if (lo !== undefined) p = clip(p, (v) => v[0] - lo);
  if (hi !== undefined) p = clip(p, (v) => hi - v[0]);
  return p;
}
/** Partition every footprint triangle into linear roof planes, including narrow/notched edges. */
function roof(
  o,
  p,
  y,
  rise,
  d,
  { hip = false, alongZ = false, color = 'roof', slot = 'tile' } = {},
) {
  // An overhang needs its underside at the eave plane; the pitched skin alone leaves a gap.
  for (const t of triangulate(p))
    face(
      o,
      t.map((v) => [v[0], y, v[1]]),
      color,
      slot,
      [0, -1, 0],
      d,
    );
  const c = center(p),
    rx = (Math.max(...p.map((v) => v[0])) - Math.min(...p.map((v) => v[0]))) / 2,
    rz = (Math.max(...p.map((v) => v[1])) - Math.min(...p.map((v) => v[1]))) / 2;
  const xp = [(v) => rise * (1 - (v[0] - c[0]) / rx), (v) => rise * (1 + (v[0] - c[0]) / rx)],
    zp = [(v) => rise * (1 - (v[1] - c[1]) / rz), (v) => rise * (1 + (v[1] - c[1]) / rz)],
    planes = hip ? [...xp, ...zp] : alongZ ? xp : zp,
    height = (v) => y + Math.max(0, Math.min(...planes.map((fn) => fn(v))));
  for (const t of triangulate(p))
    for (const fn of planes) {
      let q = t;
      for (const other of planes) {
        if (q.length < 3) break;
        q = clip(q, (v) => other(v) - fn(v));
      }
      if (q.length >= 3)
        face(
          o,
          q.map((v) => [v[0], y + Math.max(0, fn(v)), v[1]]),
          color,
          slot,
          [0, 1, 0],
          d,
        );
    }
  const sign = Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      ts = [0, 1];
    for (let j = 0; j < planes.length; j++)
      for (let l = j + 1; l < planes.length; l++) {
        const av = planes[j](a) - planes[l](a),
          bv = planes[j](b) - planes[l](b),
          t = av / (av - bv);
        if (t > 1e-8 && t < 1 - 1e-8) ts.push(t);
      }
    ts.sort((a, b) => a - b);
    for (let j = 0; j < ts.length - 1; j++) {
      const q = ts.slice(j, j + 2).map((t) => a.map((v, i) => v + (b[i] - v) * t));
      face(
        o,
        [
          [q[0][0], y, q[0][1]],
          [q[1][0], y, q[1][1]],
          [q[1][0], height(q[1]), q[1][1]],
          [q[0][0], height(q[0]), q[0][1]],
        ],
        'wall',
        'masonry',
        [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
        d,
      );
    }
  }
}
function loft(o, p, q, lo, hi, d) {
  const sign = Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      aa = q[i],
      bb = q[(i + 1) % p.length];
    face(
      o,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [bb[0], hi, bb[1]],
        [aa[0], hi, aa[1]],
      ],
      'stone',
      'stone',
      [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
      d,
    );
  }
}
function pane(o, c, u, w, h, d, n, { pair = false, color = 'glass' } = {}) {
  const one = (offset, width) => {
    const shape = openingShape({ width, height: h, spring: h - width / 2, shape: 'round' }, d);
    face(
      o,
      shape.map(([a, y]) => [c[0] + u[0] * (a + offset), c[1] + y, c[2] + u[1] * (a + offset)]),
      color,
      color === 'glass' ? 'glass' : 'wood',
      n,
      d,
    );
  };
  if (pair) {
    one(-w * 0.28, w * 0.43);
    one(w * 0.28, w * 0.43);
  } else one(0, w);
  if (d >= 2) {
    const p = rect(0, 0, w + 0.35, 0.2);
    face(
      o,
      p.map(([x, y]) => [
        c[0] + u[0] * x + n[0] * 0.03,
        c[1] + y - 0.12,
        c[2] + u[1] * x + n[2] * 0.03,
      ]),
      'stone',
      'stone',
      n,
      d,
    );
  }
}
function windows(o, p, rows, d, spacing = 5) {
  if (!d) return;
  const sign = Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 2.8) continue;
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [sign * u[1], 0, -sign * u[0]],
      count = Math.max(1, Math.floor(len / spacing));
    for (let j = 0; j < count; j++)
      for (const y of rows) {
        const t = (j + 0.5) / count;
        pane(
          o,
          [a[0] + (b[0] - a[0]) * t + n[0] * 0.05, y, a[1] + (b[1] - a[1]) * t + n[2] * 0.05],
          u,
          d === 1 ? 0.85 : 1.4,
          d === 1 ? 1.3 : 1.8,
          d,
          n,
          { pair: d >= 2 },
        );
      }
  }
}
function corbels(o, p, y, d) {
  if (!d) return;
  const sign = Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      count = Math.floor(len / (d === 1 ? 3 : 1.65)),
      u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [sign * u[1], -sign * u[0]];
    for (let j = 0; j < count; j++) {
      const t = (j + 0.5) / count,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t,
        q = [
          [-0.23, 0],
          [0.23, 0],
          [0.23, 0.75],
          [-0.23, 0.75],
        ].map(([v, w]) => [x + u[0] * v + n[0] * w, z + u[1] * v + n[1] * w]);
      prism(
        o,
        q,
        (v) => y - 1.25 + 0.75 * ((v[0] - x) * n[0] + (v[1] - z) * n[1]),
        y,
        'stone',
        'stone',
        d,
      );
    }
  }
}
function adapter(o) {
  return {
    addTriangle(slot, ref, p, n, _uv, c) {
      let q = p.map(native).map((v) => v.map(Math.fround));
      const target = native(n),
        norm = normalFor(...q);
      if (Math.hypot(...norm) < 0.5) return;
      if (norm.reduce((s, v, i) => s + v * target[i], 0) < 0) q = [q[0], q[2], q[1]];
      o.addTriangle(
        slot === 'rubble' ? 'stone' : slot,
        ref,
        q,
        normalFor(...q),
        q.map((v) => [v[0], v[2]]),
        c,
      );
    },
  };
}
const main = get(1020587803),
  west = section(main, undefined, k.keep.splitX),
  palas = section(main, k.keep.splitX, k.palas.eastSplitX),
  east = section(main, k.palas.eastSplitX);
const arcadeHoles = (d) =>
  d
    ? Array.from({ length: k.arcade.count }, (_, i) =>
        prepareOpening(
          {
            center: [k.arcade.center[0] + (i - 2) * k.arcade.spacing, k.arcade.center[1]],
            axis: [1, 0],
            width: k.arcade.width,
            height: k.arcade.height,
            spring: k.arcade.height - k.arcade.width / 2,
            depth: k.arcade.depth,
            shape: 'round',
          },
          k.arcade.bottomY,
          d,
        ),
      )
    : [];
function keep(o, d) {
  prism(o, west, 0, k.keep.corbelBottomY, 'wall', 'masonry', d);
  const expanded = scale(west, 1.12);
  loft(o, west, expanded, k.keep.corbelBottomY, k.keep.galleryFloorY, d);
  prism(o, expanded, k.keep.galleryFloorY, k.keep.eaveY, 'wall', 'masonry', d);
  roof(o, scale(expanded, 1.025), k.keep.eaveY, k.keep.roofRise, d, { hip: true });
  corbels(o, west, k.keep.galleryFloorY - 0.25, d);
  windows(o, west, d === 1 ? [18] : [7.3, 15.2, 22], d, 5);
  windows(o, expanded, [28.5], d, 3.7);
  // The prominent lower western latrine shaft is part of the current silhouette.
  const cp = center(west),
    latrine = rect(Math.min(...west.map((v) => v[0])) - 0.38, cp[1] + 0.2, 2.4, 4.2);
  prism(o, latrine, 0, 20.7, 'wall', 'masonry', d);
  prism(o, scale(latrine, 1.15), 20.7, 21.5, 'stone', 'stone', d);
  cap(o, scale(latrine, 1.15), 21.5, 'paving', 'paving', d);
  windows(o, latrine, [17.5], d, 3.4);
  // Round corbelled corner oriel: sparse facets preserve its signature shape far away.
  const c = k.keep.orielCenter,
    r = k.keep.orielRadius,
    n = [6, 8, 12, 16][d],
    p = Array.from({ length: n }, (_, i) => [
      c[0] + r * Math.cos((i * Math.PI * 2) / n),
      c[1] + r * Math.sin((i * Math.PI * 2) / n),
    ]);
  loft(o, scale(p, 0.55), p, 24.4, 26, d);
  prism(o, p, 26, 32.2, 'stone', 'stone', d);
  roof(o, scale(p, 1.12), 32.2, 2.7, d, { hip: true });
  windows(o, p, [29], d, 2.6);
}
function residence(o, d) {
  const holes = arcadeHoles(d),
    cut = openingBuilder(o, holes);
  prism(cut, palas, 0, k.palas.eaveY, 'wall', 'masonry', d);
  openingReveals(
    o,
    palas,
    () => 0,
    () => k.palas.eaveY,
    holes,
    colors.wall,
  );
  const cross = clip(section(palas, 7.65, 16.1), (p) => p[1]);
  // The main ridge continues behind the south cross-gable; it is never split into three roofs.
  roof(o, palas, k.palas.eaveY, k.palas.roofRise, d);
  roof(o, cross, k.arcade.crossGableBaseY, k.arcade.crossGableRise, d, { alongZ: true });
  windows(o, palas, d === 1 ? [12.4] : [4.5, 10.2, 15.8], d, 5.1);
  // The south projecting square stair/chapel turret is distinct from the high west keep.
  const t = k.southTurret,
    p = rect(...t.center, t.width, t.depth);
  prism(o, p, 0, t.eaveY, 'wall', 'masonry', d);
  roof(o, scale(p, 1.09), t.eaveY, t.roofRise, d, { hip: true });
  windows(o, p, d === 1 ? [16] : [8, 15.8, 20.4], d, 4);
  prism(o, east, 0, k.palas.eaveY, 'wall', 'masonry', d);
  roof(o, east, k.palas.eaveY, k.palas.roofRise, d);
  windows(o, east, d === 1 ? [18] : [9, 18], d, 3.8);
  // The separately mapped east observation tower carries the grey pyramidal roof.
  const ep = get(1424741253);
  prism(o, ep, 0, k.eastTower.eaveY, 'wall', 'masonry', d);
  roof(o, scale(ep, 1.065), k.eastTower.eaveY, k.eastTower.roofRise, d, {
    hip: true,
    color: 'slate',
    slot: 'slate',
  });
  windows(o, ep, d === 1 ? [18] : [9, 18, 23], d, 3.8);
  if (d >= 2) {
    for (const x of [-1, 6]) {
      prism(o, rect(x, -3, 0.7, 0.8), 26, 29.6, 'stone', 'stone', d);
      cap(o, rect(x, -3, 0.9, 1), 29.6, 'stone', 'stone', d);
    }
  }
}
function gateOpening(d) {
  if (!d) return [];
  const p = k.gate.route.map(local),
    a = p[0],
    b = p.at(-1),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    normal = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    center = centerOfGate();
  return [
    prepareOpening(
      {
        center,
        axis: [normal[1], -normal[0]],
        width: k.gate.width,
        height: k.gate.height,
        spring: k.gate.height - k.gate.width / 2,
        depth: 15,
        shape: 'round',
      },
      k.gate.baseY,
      d,
    ),
  ];
}
function centerOfGate() {
  const c = center(get(k.gate.way)),
    p = k.gate.route.map(local),
    a = p[0],
    b = p[1],
    u = b.map((v, i) => v - a[i]),
    t = u.reduce((s, v, i) => s + (c[i] - a[i]) * v, 0) / u.reduce((s, v) => s + v * v, 0);
  return a.map((v, i) => v + u[i] * t);
}
function gate(o, d) {
  const p = get(k.gate.way),
    holes = gateOpening(d),
    cut = openingBuilder(o, holes),
    top = k.gate.baseY + k.gate.eaveHeight;
  prism(cut, p, k.gate.baseY, top, 'wall', 'masonry', d);
  openingReveals(
    o,
    p,
    () => k.gate.baseY,
    () => top,
    holes,
    colors.wall,
  );
  roof(o, scale(p, 1.08), top, k.gate.roofRise, d, { hip: true });
  windows(o, p, [k.gate.baseY + 6], d, 4);
}
const courtY = ([_x, z]) => {
  if (z < 9) return k.eastCourtY;
  return k.eastCourtY + (k.lowCourtY - k.eastCourtY) * Math.min(1, Math.max(0, (z - 9) / 13));
};
function lowerOpening(d) {
  if (!d) return [];
  const p = get(1020587802),
    a = p[0],
    b = p.at(-1),
    wall = get(k.wallWay);
  for (let i = 0; i < wall.length - 1; i++) {
    const q = wall[i],
      r = wall[i + 1],
      u = b.map((v, i) => v - a[i]),
      v = r.map((x, i) => x - q[i]),
      det = u[0] * v[1] - u[1] * v[0];
    if (Math.abs(det) < 1e-8) continue;
    const w = q.map((v, i) => v - a[i]),
      t = (w[0] * v[1] - w[1] * v[0]) / det,
      s = (w[0] * u[1] - w[1] * u[0]) / det;
    if (t < 0 || t > 1 || s < 0 || s > 1) continue;
    const c = a.map((v, i) => v + u[i] * t),
      len = Math.hypot(...u);
    return [
      prepareOpening(
        {
          center: c,
          axis: [u[1] / len, -u[0] / len],
          width: 3.5,
          height: 3.8,
          spring: 2.05,
          depth: 4,
          shape: 'round',
        },
        courtY(c),
        d,
      ),
    ];
  }
  return [];
}
function walls(o, d) {
  const p = get(k.wallWay),
    holes = [...gateOpening(d), ...lowerOpening(d)],
    cut = openingBuilder(o, holes);
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i],
      b = p[i + 1],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [(-u[1] * k.wallThickness) / 2, (u[0] * k.wallThickness) / 2],
      q = [
        [a[0] + n[0], a[1] + n[1]],
        [b[0] + n[0], b[1] + n[1]],
        [b[0] - n[0], b[1] - n[1]],
        [a[0] - n[0], a[1] - n[1]],
      ],
      top = (v) => courtY(v) + k.wallHeight;
    prism(cut, q, (v) => courtY(v) - 0.5, top, 'wall', 'masonry', d, true);
    openingReveals(o, q, (v) => courtY(v) - 0.5, top, holes, colors.wall);
    if (d >= 2) {
      const count = Math.floor(len / 2.8);
      for (let j = 0; j < count; j++) {
        const t = (j + 0.5) / count,
          c = a.map((v, i) => v + (b[i] - v) * t),
          r = [
            [-0.55, -0.4],
            [0.55, -0.4],
            [0.55, 0.4],
            [-0.55, 0.4],
          ].map(([x, z]) => [c[0] + u[0] * x - u[1] * z, c[1] + u[1] * x + u[0] * z]);
        prism(cut, r, top(c), top(c) + 0.65, 'stone', 'stone', d, true);
      }
    }
  }
}
function court(o, d) {
  for (const a of k.auxiliary) {
    if (d === 0) continue;
    const p = get(a.way);
    prism(o, p, a.baseY, a.baseY + a.height, 'wall', 'masonry', d);
    roof(o, p, a.baseY + a.height, a.roofRise, d, { hip: true });
    windows(o, p, [a.baseY + 1], d, 4);
  }
  if (!d) return;
  // Only narrow mapped routes; the natural rocky ridge is never a GLB surface.
  for (const id of [1020587800, 1020587802, 1021399735, 1424741247, 1424741255, 1424741257]) {
    const p = get(id);
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i],
        b = p[i + 1],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = [(-(b[1] - a[1]) / len) * 0.95, ((b[0] - a[0]) / len) * 0.95];
      face(
        o,
        [
          [a[0] + n[0], courtY(a) + 0.03, a[1] + n[1]],
          [a[0] - n[0], courtY(a) + 0.03, a[1] - n[1]],
          [b[0] - n[0], courtY(b) + 0.03, b[1] - n[1]],
          [b[0] + n[0], courtY(b) + 0.03, b[1] + n[1]],
        ],
        'paving',
        'paving',
        [0, 1, 0],
        d,
      );
    }
  }
  // Coarse physical stair flights preserve mapped horizontal endpoints; risers are estimates.
  for (const id of [1021399736, 1424741242, 1424741243, 1424741249]) {
    const p = get(id),
      a = p[0],
      b = p.at(-1),
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [-u[1], u[0]],
      count = d === 1 ? 3 : Math.max(4, Math.round(len / 0.7));
    for (let j = 0; j < count; j++) {
      const t0 = j / count,
        t1 = (j + 1) / count,
        y = k.gate.baseY + ((j + 1) / count) * 1.5,
        q = [
          [-1, t0],
          [1, t0],
          [1, t1],
          [-1, t1],
        ].map(([v, t]) => [
          a[0] + (b[0] - a[0]) * t + n[0] * v,
          a[1] + (b[1] - a[1]) * t + n[1] * v,
        ]);
      prism(o, q, k.gate.baseY - 0.2, y, 'paving', 'paving', d, true);
    }
  }
}
const builders = { keep, residence, gate, walls, court };
export const liechtensteinParts = Object.fromEntries(
  Object.entries(builders).map(([name, fn]) => [name, (o, d) => fn(adapter(o), d)]),
);
export function buildLiechtensteinRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  for (const fn of Object.values(liechtensteinParts)) fn(o, d);
}
export const buildLiechtensteinSkyline = (o) => buildLiechtensteinRuntime(o, 'skyline');
const camera = (name, p, look) => ({ name, position: native(p), lookAt: native(look) });
export const liechtensteinStudy = {
  id: 'N0302',
  key: 'liechtenstein_castle',
  title: 'Liechtenstein Castle',
  category: 'castle',
  wikidataId: 'Q699474',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildLiechtensteinRuntime(o),
  surfaceOverrides: liechtensteinSurfaces,
  brief:
    'Current Austrian Burg Liechtenstein exterior draft: tall west keep with corbel gallery,round corner oriel and red pyramidal roof;long palas,five open upper arches,grey-roofed east tower,south turret,lower arched gatehouse and mapped curtain wall/current service buildings.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: liechtensteinPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 7,
    identityFeatures: [
      'Corbelled west keep with projecting round oriel and steep red roof',
      'Narrow elongated palas with cross-gabled upper arcade and small grey east tower',
      'Separate arched lower gatehouse and crenellated forecourt',
    ],
  },
  sourceFacts: {
    exactCastleWay: 1020587803,
    excludedPalaceWikidataId: 'Q1726817',
    primarySurveyedArchitecturalDimensionsVerified: false,
  },
  reconstruction: frame.reconstruction,
  scaleBasis: k.basis,
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json', 'surface-means.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license;own map traces ©OpenStreetMap contributors,ODbL-1.0. Operator photographs are not redistributed.',
  sourceNotice:
    'Five existing shared256-square material graphs,flat glass,linear tints and metric repeats. No embedded/new image,downloaded mesh or photo texture. Natural rocky ridge is separate terrain.',
  dataAttribution: '©OpenStreetMap contributors;Burgverwaltung L.Fasching/Oliver Bolch.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus:
      'Inactive draft:estimated vertical sections,rock-ridge and lower terrace contacts require actual-site review.',
  }),
  geographicNote:
    'Exact-QID current castle and separate mapped forecourt components preserve native East/South geography with heading0. Reconstructed vertical sections and facade identity require current-site visual review;no surveyed terrain datum approval.',
  limitations: refs.limitations,
  importReason:
    'Preserve distinct current keep/palas/east tower/open upper arcade/lower gatehouse identities through four source-authored browser levels.',
  previewGround: false,
  mediumFiContext: {
    scale: '1.6',
    groundY: '-8.3',
    neighborStyle: 'molen.worldgen.regional.atlantic.detached',
  },
  camera: { position: native([-72, 49, 93]), lookAt: native([7, 12, 6]), fov: 43 },
  qaCameras: [
    camera('west-keep-and-oriel', [-57, 33, -35], [-16, 24, -1]),
    camera('south-palas-and-arcade', [8, 26, 53], [3, 17, 4]),
    camera('east-tower-and-gate', [69, 24, 27], [22, 10, 4]),
    camera('gatehouse-arch', [52, -1, 9], [30, -1, 10]),
    camera('roof-plan', [9, 103, 12], [9, 10, 12]),
    camera('north-palas', [-3, 29, -54], [0, 17, -5]),
  ],
};
