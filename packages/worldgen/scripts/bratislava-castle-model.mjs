/** Bratislava Castle: four-wing palace, unequal corner towers, gates and mapped Baroque garden. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u2/u2s/n0253_bratislava_castle/map-parts.json',
      import.meta.url,
    ),
  ),
);
const plaster = [0.91, 0.885, 0.83],
  trim = [0.95, 0.925, 0.87],
  stone = [0.54, 0.52, 0.45],
  wood = [0.22, 0.13, 0.08],
  tile = [0.64, 0.265, 0.13],
  glass = [0.095, 0.115, 0.105];
const master = (o) => !o.detail,
  near = (o) => !['skyline', 'district'].includes(o.detail),
  fine = (o) => !['skyline', 'district', 'street'].includes(o.detail);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  color = (a, t) => a.map((v) => v * t);
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const tri = (o, s, p, c) =>
  o.addTriangle(
    s,
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    c,
  );
function frame(o, x = 0, y = 0, z = 0, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  return {
    detail: o.detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (slot, ref, p, n, uv, col) =>
          o[k](
            slot,
            ref,
            p.map((v) => {
              const q = rot(v);
              return [q[0] + x, q[1] + y, q[2] + z];
            }),
            rot(n),
            uv,
            col,
          ),
      ]),
    ),
  };
}
const edgeFrame = (o, a, b) => frame(o, a[0], 0, a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function points(id) {
  return map.features.find((f) => f.id === `way/${id}`).points.map((p) => [...p]);
}
function ring(id, tolerance = 0.075) {
  const p = points(id);
  if (p[0].join() === p.at(-1).join()) p.pop();
  let changed = true;
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        l &&
        Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / l < tolerance
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return area(p) < 0 ? p.reverse() : p;
}
function cap(o, p, y, slot = 'stone', c = stone) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    if (
      Math.abs(
        (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]) - (q[2][0] - q[0][0]) * (q[1][2] - q[0][2]),
      ) < 0.0001
    )
      continue;
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, slot, q, c);
  }
}
function line(o, a, b, w = 0.12, slot = 'carved', c = trim) {
  if (Math.hypot(...b.map((v, i) => v - a[i])) < 0.001) return;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (master(o) || len < 0.001) {
    beam(o, slot, a, b, w, w, c);
    return;
  }
  const dx = ((b[1] - a[1]) * w) / (2 * len),
    dy = ((a[0] - b[0]) * w) / (2 * len),
    p = [
      [a[0] - dx, a[1] - dy, a[2]],
      [b[0] - dx, b[1] - dy, b[2]],
      [b[0] + dx, b[1] + dy, b[2]],
      [a[0] + dx, a[1] + dy, a[2]],
    ];
  if (normalFor(...p)[2] < 0) p.reverse();
  face(o, slot, p, c);
}
function opening(x, y, w, h, pointed = false, steps = 12) {
  const p = [
    [x - w / 2, y],
    [x + w / 2, y],
  ];
  if (!pointed) return [...p, [x + w / 2, y + h], [x - w / 2, y + h]];
  const spring = y + h - w / 2;
  for (let i = 0; i <= steps; i++) {
    const angle = (Math.PI * i) / steps;
    p.push([x + (Math.cos(angle) * w) / 2, spring + (Math.sin(angle) * w) / 2]);
  }
  return p;
}
function panel(o, w, lo, hi, windows = [], slot = 'plaster', c = plaster) {
  const valid = o.detail === 'skyline' ? [] : windows;
  const all = [
    [
      [0, lo],
      [w, lo],
      [w, hi],
      [0, hi],
    ],
    ...valid.map((v) => opening(v[0], v[1], v[2], v[3], v[4], o.detail === 'district' ? 6 : 12)),
  ];
  const p = all.flat(),
    holes = [];
  let n = 4;
  for (const r of all.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ix = earcut(p.flat(), holes, 2);
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], p[j][1], 0]);
    if (
      Math.abs(
        (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]),
      ) < 0.00001
    )
      continue;
    if (normalFor(...q)[2] < 0) q.reverse();
    tri(o, slot, q, c);
  }
  for (let i = 0; i < valid.length; i++) {
    const v = valid[i],
      r = all[i + 1];
    const ix = earcut(r.flat());
    for (let k = 0; k < ix.length; k += 3) {
      const p = ix.slice(k, k + 3).map((j) => [r[j][0], r[j][1], -0.34]);
      if (normalFor(...p)[2] < 0) p.reverse();
      if (!v[5]) tri(o, 'glass', p, glass);
    }
    if (fine(o)) {
      for (let j = 0; j < r.length; j++) {
        const a = r[j],
          b = r[(j + 1) % r.length];
        face(
          o,
          'carved',
          [
            [a[0], a[1], 0],
            [b[0], b[1], 0],
            [b[0], b[1], -0.34],
            [a[0], a[1], -0.34],
          ],
          trim,
        );
        if (!(v[5] && j === 0)) line(o, [a[0], a[1], 0.07], [b[0], b[1], 0.07], 0.16);
      }
      if (v[2] > 1.1 && !v[5]) {
        line(o, [v[0], v[1], -0.12], [v[0], v[1] + v[3] - 0.2, -0.12], 0.09, 'wood', wood);
        line(
          o,
          [v[0] - v[2] / 2, v[1] + v[3] * 0.48, -0.12],
          [v[0] + v[2] / 2, v[1] + v[3] * 0.48, -0.12],
          0.08,
          'wood',
          wood,
        );
      }
    }
    if (master(o) && !v[5])
      for (let y = v[1] + 0.28; y < v[1] + v[3] - (v[4] ? v[2] * 0.9 : 0.15); y += 0.42)
        line(
          o,
          [v[0] - v[2] * 0.42, y, -0.19],
          [v[0] + v[2] * 0.42, y, -0.19],
          0.025,
          'metal',
          [0.24, 0.23, 0.2],
        );
  }
}

function edges(o, p, fn, closed = true) {
  for (let i = 0; i < p.length - (closed ? 0 : 1); i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 0.02)
      fn(edgeFrame(o, closed ? b : a, closed ? a : b), len, i, closed ? b : a, closed ? a : b);
  }
}
function solid(o, p, lo, hi, slot = 'plaster', c = plaster) {
  edges(o, p, (f, len) => panel(f, len, lo, hi, [], slot, c));
  cap(o, p, hi, slot, c);
}
const center = (p) => p.reduce((s, v) => [s[0] + v[0] / p.length, s[1] + v[1] / p.length], [0, 0]);
function scaled(p, k) {
  const c = center(p);
  return p.map((v) => mix(c, v, k));
}
function horizontal(o, p, y, slot = 'stone', c = stone, holes = []) {
  const all = [p, ...holes],
    q = all.flat(),
    offsets = [];
  let size = p.length;
  for (const h of holes) {
    offsets.push(size);
    size += h.length;
  }
  const ix = earcut(q.flat(), offsets);
  for (let i = 0; i < ix.length; i += 3) {
    const t = ix.slice(i, i + 3).map((j) => [q[j][0], y, q[j][1]]);
    if (normalFor(...t)[1] < 0) t.reverse();
    tri(o, slot, t, c);
  }
}
function roofFacet(o, a, b, c, d, detailed = true) {
  const collapsed = Math.hypot(...c.map((v, i) => v - d[i])) < 0.001;
  const p = collapsed ? [a, b, c] : [a, b, c, d];
  if (normalFor(...p)[1] < 0) p.reverse();
  if (collapsed) tri(o, 'tile', p, tile);
  else face(o, 'tile', p, tile);
  if (!fine(o) || !detailed) return;
  // Tile courses are explicit in the master, with coarser strips in close-up.
  const n = normalFor(...p),
    rows = Math.max(
      1,
      Math.ceil(Math.hypot(...d.map((v, i) => v - a[i])) / (master(o) ? 0.33 : 2.2)),
    );
  for (let r = 0; r < rows; r++) {
    const aa = mix(a, d, (r + 0.04) / rows),
      bb = mix(b, c, (r + 0.04) / rows),
      cc = mix(b, c, (r + 0.96) / rows),
      dd = mix(a, d, (r + 0.96) / rows);
    const cols = Math.max(
      1,
      Math.floor(Math.hypot(...bb.map((v, i) => v - aa[i])) / (master(o) ? 0.28 : 2.8)),
    );
    for (let k = 0; k < cols; k++) {
      const u = (k + 0.04) / cols,
        v = (k + 0.96) / cols;
      const q = [mix(aa, bb, u), mix(aa, bb, v), mix(dd, cc, v), mix(dd, cc, u)].map((p) =>
        p.map((v, i) => v + n[i] * 0.024),
      );
      if (normalFor(...q)[1] < 0) q.reverse();
      face(o, 'tile', q, color(tile, 0.86 + ((r * 7 + k * 13) % 11) * 0.022));
    }
  }
}
function roofStrip(o, a, b, c, d, y, h, detail = true) {
  const u = mix(a, d, 0.5),
    v = mix(b, c, 0.5);
  roofFacet(
    o,
    [...a.slice(0, 1), y, a[1]],
    [b[0], y, b[1]],
    [v[0], y + h, v[1]],
    [u[0], y + h, u[1]],
    detail,
  );
  roofFacet(o, [c[0], y, c[1]], [d[0], y, d[1]], [u[0], y + h, u[1]], [v[0], y + h, v[1]], detail);
  tri(
    o,
    'tile',
    [
      [a[0], y, a[1]],
      [u[0], y + h, u[1]],
      [d[0], y, d[1]],
    ],
    tile,
  );
  tri(
    o,
    'tile',
    [
      [b[0], y, b[1]],
      [c[0], y, c[1]],
      [v[0], y + h, v[1]],
    ],
    tile,
  );
}
function corridorRoof(o, path, width, y, h) {
  // Mitered joined strip follows the curved northern barracks instead of roofing its enclosure.
  const sides = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)],
      b = path[Math.min(path.length - 1, i + 1)],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [
      [p[0] - ((b[1] - a[1]) * width) / (2 * l), p[1] + ((b[0] - a[0]) * width) / (2 * l)],
      [p[0] + ((b[1] - a[1]) * width) / (2 * l), p[1] - ((b[0] - a[0]) * width) / (2 * l)],
    ];
  });
  for (let i = 1; i < path.length; i++)
    roofStrip(o, sides[i - 1][0], sides[i][0], sides[i][1], sides[i - 1][1], y, h);
}
function cylinder(o, x, z, r, lo, hi, slot = 'carved', c = trim, sides = 12) {
  const p = Array.from({ length: sides }, (_, i) => [
    x + r * Math.cos((i * 2 * Math.PI) / sides),
    z + r * Math.sin((i * 2 * Math.PI) / sides),
  ]);
  solid(o, p, lo, hi, slot, c);
  return p;
}
function band(o, p, y, scale = 1.035, h = 0.22) {
  if (o.detail === 'skyline') return;
  solid(o, scaled(p, scale), y, y + h, 'carved', trim);
}
function ornament(o, x, y, z, h = 1.35) {
  if (!fine(o)) return;
  const f = frame(o, x, y, z);
  // Architectural urns; unique human statues are not represented as generic urns.
  loft(
    f,
    'carved',
    [
      radialRing(0, 0.27, 0.27, 8),
      radialRing(0.24 * h, 0.17, 0.17, 8),
      radialRing(0.45 * h, 0.36, 0.36, 8),
      radialRing(0.72 * h, 0.28, 0.28, 8),
      radialRing(0.8 * h, 0.4, 0.4, 8),
      radialRing(h, 0.07, 0.07, 8),
    ],
    trim,
  );
}
function dormer(o, x, z, a, eave) {
  if (!near(o)) return;
  const f = frame(o, x, 0, z, a);
  if (!master(o)) {
    face(
      f,
      'plaster',
      [
        [-0.75, eave, 0],
        [0.75, eave, 0],
        [0.75, eave + 1.65, 0],
        [-0.75, eave + 1.65, 0],
      ],
      plaster,
    );
    tri(
      f,
      'plaster',
      [
        [-0.75, eave + 1.65, 0],
        [0.75, eave + 1.65, 0],
        [0, eave + 2.4, 0],
      ],
      plaster,
    );
    face(
      f,
      'glass',
      [
        [-0.38, eave + 0.35, 0.02],
        [0.38, eave + 0.35, 0.02],
        [0.38, eave + 1.35, 0.02],
        [-0.38, eave + 1.35, 0.02],
      ],
      glass,
    );
    roofFacet(
      f,
      [-0.8, eave + 1.65, 0],
      [-0.8, eave + 1.65, -1.8],
      [0, eave + 2.4, -1.8],
      [0, eave + 2.4, 0],
      false,
    );
    roofFacet(
      f,
      [0.8, eave + 1.65, -1.8],
      [0.8, eave + 1.65, 0],
      [0, eave + 2.4, 0],
      [0, eave + 2.4, -1.8],
      false,
    );
    return;
  }
  box(f, 'plaster', [-0.75, eave, -1.25], [0.75, eave + 1.65, 0], plaster);
  panel(frame(f, -0.75, 0, 0.015), 1.5, eave, eave + 1.65, [[0.75, eave + 0.35, 0.78, 1.02, true]]);
  roofFacet(
    f,
    [-0.91, eave + 1.65, 0.16],
    [0.91, eave + 1.65, 0.16],
    [0, eave + 2.4, -0.35],
    [0, eave + 2.4, -0.35],
  );
  roofFacet(
    f,
    [0.91, eave + 1.65, 0.16],
    [0.91, eave + 1.65, -1.8],
    [0, eave + 2.4, -1.8],
    [0, eave + 2.4, -0.35],
  );
  roofFacet(
    f,
    [-0.91, eave + 1.65, -1.8],
    [-0.91, eave + 1.65, 0.16],
    [0, eave + 2.4, -0.35],
    [0, eave + 2.4, -1.8],
  );
}
function chimney(o, x, z, y) {
  if (!near(o)) return;
  box(o, 'plaster', [x - 0.48, y, z - 0.55], [x + 0.48, y + 2.6, z + 0.55], plaster);
  box(o, 'carved', [x - 0.6, y + 2.3, z - 0.65], [x + 0.6, y + 2.65, z + 0.65], trim);
  if (fine(o))
    box(
      o,
      'recess',
      [x - 0.3, y + 2.652, z - 0.3],
      [x + 0.3, y + 2.68, z + 0.3],
      [0.09, 0.075, 0.06],
    );
}
function facade(
  o,
  a,
  b,
  lo,
  hi,
  { count, rows = [3, 9, 15, 21, 26], arched = false, c = plaster, main = false } = {},
) {
  const f = edgeFrame(o, a, b),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (o.detail === 'skyline') {
    panel(f, len, lo, hi, [], 'plaster', c);
    return;
  }
  const windows = [];
  // Lower-detail levels use a representative window row; masters retain every bay.
  const levels =
    o.detail === 'district' ? rows.filter((_, i) => i === 1 || rows.length === 1) : rows;
  const bays = count ?? Math.max(1, Math.round(len / 4.8));
  for (let j = 0; j < bays; j++)
    for (const h of levels) {
      const small = h > 24,
        w = small ? 1.22 : 1.48,
        height = small ? 1.45 : 2.65;
      if (lo + h + height >= hi) continue;
      windows.push([(len * (j + 0.5)) / bays, lo + h, w, height, arched]);
    }
  if (o.detail === 'district') {
    panel(f, len, lo, hi, [], 'plaster', c);
    for (const [x, y, w, h] of windows)
      face(
        f,
        'glass',
        [
          [x - w / 2, y, 0.01],
          [x + w / 2, y, 0.01],
          [x + w / 2, y + h, 0.01],
          [x - w / 2, y + h, 0.01],
        ],
        glass,
      );
    return;
  }
  panel(f, len, lo, hi, windows, 'plaster', c);
  if (!near(o)) return;
  box(f, 'carved', [0, hi - 0.25, -0.12], [len, hi + 0.1, 0.33], trim);
  if (fine(o)) {
    box(f, 'carved', [0, lo + 7.65, -0.05], [len, lo + 7.93, 0.16], trim);
    box(f, 'stone', [0, lo, -0.06], [len, lo + 0.85, 0.12], color(stone, 1.15));
    for (const v of windows) {
      if (v[1] > lo + 24) continue;
      const top = v[1] + v[3];
      line(f, [v[0] - 0.92, top + 0.18, 0.16], [v[0] + 0.92, top + 0.18, 0.16], 0.16);
      if (main && Math.abs(v[0] - len / 2) < len * 0.18) {
        line(f, [v[0] - 0.95, top + 0.25, 0.2], [v[0], top + 0.76, 0.2], 0.19);
        line(f, [v[0], top + 0.76, 0.2], [v[0] + 0.95, top + 0.25, 0.2], 0.19);
      }
    }
  }
}
const palaceParts = [244267972, 244267974, 244267978, 244267981];
const shafts = [244267973, 244267969, 244267970, 244267971];
const crowns = [244267977, 244267976, 244267979, 244267980];
function clock(o, f, len, y, r) {
  if (!near(o)) return;
  const cx = len / 2,
    sides = master(o) ? 32 : 16;
  const p = Array.from({ length: sides }, (_, i) => [
    cx + r * Math.cos((i * 2 * Math.PI) / sides),
    y + r * Math.sin((i * 2 * Math.PI) / sides),
  ]);
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      f,
      'recess',
      ix.slice(i, i + 3).map((j) => [p[j][0], p[j][1], 0.03]),
      [0.18, 0.17, 0.15],
    );
  if (!fine(o)) return;
  for (let i = 0; i < sides; i++)
    line(f, [p[i][0], p[i][1], 0.07], [p[(i + 1) % sides][0], p[(i + 1) % sides][1], 0.07], 0.09);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    line(
      f,
      [cx + r * 0.72 * Math.sin(a), y + r * 0.72 * Math.cos(a), 0.075],
      [cx + r * 0.87 * Math.sin(a), y + r * 0.87 * Math.cos(a), 0.075],
      0.045,
      'metal',
      [0.8, 0.67, 0.35],
    );
  }
  line(f, [cx, y, 0.09], [cx + r * 0.47, y + r * 0.24, 0.09], 0.055, 'metal', [0.85, 0.73, 0.45]);
  line(f, [cx, y, 0.09], [cx - r * 0.2, y + r * 0.66, 0.09], 0.055, 'metal', [0.85, 0.73, 0.45]);
}
function cornerTower(o, index) {
  const base = ring(shafts[index]),
    top = ring(crowns[index]),
    c = center(top),
    crown = index === 0;
  const bodyTop = crown ? 45 : 44,
    drumTop = crown ? 49.5 : 48.3,
    peak = crown ? 57 : 55.3;
  // 47 m Crown Tower above the provisional 10 m palace terrace; other heights reconstructed.
  edges(o, base, (f, len) => {
    const holes =
      near(o) && len > 3
        ? (crown ? [7, 14, 21, 28] : [17, 24]).map((y) => [len * 0.5, 10 + y, 0.58, 1.55, false])
        : [];
    panel(f, len, 10, bodyTop, holes);
    if (fine(o) && len > 3)
      for (let y = 10.25; y < bodyTop - 0.5; y += 0.9) {
        if (master(o)) box(f, 'carved', [0, y, -0.06], [0.48, y + 0.8, 0.15], trim);
        else
          face(
            f,
            'carved',
            [
              [0, y, 0.15],
              [0.48, y, 0.15],
              [0.48, y + 0.8, 0.15],
              [0, y + 0.8, 0.15],
            ],
            trim,
          );
        if (master(o)) box(f, 'carved', [len - 0.48, y, -0.06], [len, y + 0.8, 0.15], trim);
        else
          face(
            f,
            'carved',
            [
              [len - 0.48, y, 0.15],
              [len, y, 0.15],
              [len, y + 0.8, 0.15],
              [len - 0.48, y + 0.8, 0.15],
            ],
            trim,
          );
      }
  });
  cap(o, base, bodyTop, 'plaster', plaster);
  band(o, base, bodyTop - 0.22, 1.045, 0.35);
  edges(o, top, (f, len, i) => {
    panel(f, len, bodyTop, drumTop);
    if (i % 2 === 0) clock(o, f, len, (bodyTop + drumTop) / 2, Math.min(0.9, len * 0.23));
  });
  band(o, top, drumTop - 0.15, 1.09, 0.4);
  const expanded = scaled(top, 1.12);
  for (let i = 0; i < expanded.length; i++) {
    const a = expanded[i],
      b = expanded[(i + 1) % expanded.length];
    // Swept low eave then steep eight-sided crown.
    const aa = mix(c, a, 0.86),
      bb = mix(c, b, 0.86);
    roofFacet(
      o,
      [a[0], drumTop + 0.25, a[1]],
      [b[0], drumTop + 0.25, b[1]],
      [bb[0], drumTop + 1, bb[1]],
      [aa[0], drumTop + 1, aa[1]],
    );
    roofFacet(
      o,
      [aa[0], drumTop + 1, aa[1]],
      [bb[0], drumTop + 1, bb[1]],
      [c[0], peak, c[1]],
      [c[0], peak, c[1]],
    );
  }
  if (near(o))
    beam(o, 'metal', [c[0], peak, c[1]], [c[0], peak + 0.65, c[1]], 0.05, 0.05, [0.22, 0.2, 0.16]);
}
function mainPortal(o) {
  if (!near(o)) return;
  const a = [-83.0837, -52.9905],
    b = [-52.552, 4.6323],
    f = edgeFrame(o, a, b);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    c = len / 2;
  for (const dx of [-4.4, 0, 4.4]) {
    const g = frame(f, c + dx, 0, 0.35);
    panel(frame(g, -1.65, 0, 0), 3.3, 10, 16.6, [[1.65, 10.08, 2.25, 4.7, true]], 'carved', trim);
    // Oak doors are recessed in individually framed portals.
    box(g, 'wood', [-1.09, 10.12, -0.3], [1.09, 14.65, -0.27], wood);
    if (fine(o))
      for (const u of [-0.69, 0.69])
        for (let y = 10.5; y < 14.2; y += 1.15)
          box(g, 'carved', [u - 0.24, y, -0.21], [u + 0.24, y + 0.7, -0.17], color(wood, 1.2));
  }
  box(f, 'carved', [c - 7.2, 16.2, 0.1], [c + 7.2, 16.6, 2.15], trim);
  if (fine(o)) {
    for (const dx of [-7.4, -3.2, 3.2, 7.4]) {
      box(f, 'carved', [c + dx - 0.24, 17, -0.02], [c + dx + 0.24, 36, 0.23], trim);
      box(f, 'carved', [c + dx - 0.39, 35.65, -0.06], [c + dx + 0.39, 36.05, 0.42], trim);
    }
    for (let x = c - 6.9; x <= c + 6.9; x += 0.62) {
      line(f, [x, 16.6, 2.02], [x, 17.85, 2.02], 0.14);
      if (master(o)) sphere(f, 'carved', [x, 17.12, 2.02], [0.15, 0.3, 0.15], trim, 8, 5);
    }
    line(f, [c - 7.2, 17.95, 2.02], [c + 7.2, 17.95, 2.02], 0.2);
  }
}
function palace(o) {
  const eave = 40;
  for (const id of palaceParts) {
    const p = ring(id);
    // Interior partition ends receive no repetitive windows; long external and court faces do.
    edges(o, p, (f, len, _i, a, b) => {
      if (len < 14) panel(f, len, 10, eave);
      else
        facade(o, a, b, 10, eave, {
          count: Math.max(2, Math.round(len / 5.6)),
          main: id === 244267978,
        });
    });
    cap(o, p, eave, 'plaster', plaster);
  }
  const roofs = [
    [
      [-80.2239, -64.9165],
      [-25.3786, -86.8513],
      [-26.6182, -66.9136],
      [-66.9298, -50.82],
    ],
    [
      [-83.0837, -52.9905],
      [-52.552, 4.6323],
      [-42.1603, -3.3969],
      [-66.9298, -50.82],
    ],
    [
      [-42.9853, 9.118],
      [1.2081, -4.4881],
      [-10.912, -15.2517],
      [-42.1603, -3.3969],
    ],
    [
      [5.828, -14.1043],
      [-15.7319, -82.5544],
      [-26.6182, -66.9136],
      [-10.912, -15.2517],
    ],
  ];
  for (const [a, b, c, d] of roofs) {
    roofStrip(o, a, b, c, d, eave, 6.2);
    if (near(o))
      for (const [u, v] of [
        [a, b],
        [c, d],
      ]) {
        const len = Math.hypot(v[0] - u[0], v[1] - u[1]),
          angle = Math.atan2(u[1] - v[1], v[0] - u[0]);
        const count = Math.max(3, Math.round(len / 6.8));
        for (let i = 1; i < count; i++) {
          // Facades use outward +Z; reversed court edges also face the void.
          const p = mix(u, v, i / count),
            nx = -(v[1] - u[1]) / len,
            nz = (v[0] - u[0]) / len;
          dormer(o, p[0] + nx * 1.7, p[1] + nz * 1.7, angle + Math.PI, eave + 1);
        }
        for (const t of [0.22, 0.72]) {
          const p = mix(u, v, t);
          chimney(o, p[0], p[1], eave + 1.8);
        }
      }
  }
  for (let i = 0; i < 4; i++) cornerTower(o, i);
  horizontal(o, ring(1473406795), 10.025, 'stone', [0.7, 0.68, 0.62]);
  mainPortal(o);
  const annex = ring(369605106);
  solid(o, annex, 10, 17.5);
  const ac = center(annex);
  for (let i = 0; i < annex.length; i++) {
    const a = annex[i],
      b = annex[(i + 1) % annex.length];
    roofFacet(
      o,
      [a[0], 17.5, a[1]],
      [b[0], 17.5, b[1]],
      [ac[0], 20, ac[1]],
      [ac[0], 20, ac[1]],
      false,
    );
  }
}
function lowBuilding(
  o,
  id,
  lo,
  height,
  roofPath,
  width,
  roofRise = 4.5,
  { yellow = false, windows = 2 } = {},
) {
  const p = ring(id, o.detail === 'skyline' ? 1.5 : 0.075),
    c = yellow ? [0.9, 0.865, 0.68] : plaster;
  edges(o, p, (f, len, _i, a, b) => {
    if (len > 5 && o.detail !== 'skyline')
      facade(o, a, b, lo, lo + height, {
        rows: windows === 1 ? [1.4] : [1.4, 5.2],
        count: Math.max(1, Math.round(len / 4.2)),
        c,
      });
    else panel(f, len, lo, lo + height, [], 'plaster', c);
  });
  if (o.detail !== 'skyline') solid(o, p, 0, lo, 'stone', stone);
  cap(o, p, lo + height, 'plaster', c);
  corridorRoof(o, roofPath, width, lo + height, roofRise);
  if (near(o))
    edges(
      o,
      roofPath,
      (_f, len, _i, a, b) => {
        for (const side of [-1, 1]) {
          const count = Math.max(1, Math.floor(len / (o.detail === 'street' ? 10.6 : 5.3))),
            dx = (b[0] - a[0]) / len,
            dz = (b[1] - a[1]) / len;
          for (let j = 1; j < count; j++) {
            const p = mix(a, b, j / count);
            dormer(
              o,
              p[0] - dz * side * (width * 0.36),
              p[1] + dx * side * (width * 0.36),
              Math.atan2(-dz, dx) + (side < 0 ? Math.PI : 0),
              lo + height + 1.2,
            );
          }
        }
      },
      false,
    );
}
function pavilions(o) {
  for (const id of [115596648, 115596652]) {
    const p = ring(id);
    edges(o, p, (f, len) => {
      const count = Math.max(1, Math.floor(len / 3));
      const holes =
        near(o) && len > 3
          ? Array.from({ length: count }, (_, j) => [
              ((j + 0.5) * len) / count,
              11.1,
              1.1,
              2.1,
              false,
            ])
          : [];
      panel(f, len, 10, 14.5, holes);
      if (near(o)) {
        box(f, 'carved', [0, 14.35, -0.25], [len, 14.8, 0.2], trim);
        if (fine(o))
          for (let x = 0.1; x < len - 0.2; x += 1.6)
            box(f, 'carved', [x, 10.4, -0.07], [x + 0.24, 14.3, 0.18], trim);
      }
    });
    cap(o, p, 14.5, 'metal', [0.3, 0.3, 0.27]);
    // Low solid parapet and a shallow inset roof retain the distinctive curved plan.
    if (near(o))
      edges(o, p, (f, len) => box(f, 'plaster', [0, 14.5, -0.4], [len, 15.25, 0.02], plaster));
    if (fine(o)) for (let i = 0; i < p.length; i += 4) ornament(o, p[i][0], 15.25, p[i][1], 1.5);
  }
}
function gate(o, { x, z, a, w = 9, d = 5, lo = 0, h = 8, rise = 3, kind = 'baroque' }) {
  const f = frame(o, x, 0, z, a),
    arch = kind === 'gothic',
    openingWidth = arch ? 3.4 : 3.2,
    openingHeight = arch ? 5.8 : 4.4;
  // Portals are cut through both walls; no opaque ground block fills the passage.
  for (const [side, ang] of [
    [d / 2, 0],
    [-d / 2, Math.PI],
  ]) {
    const g = frame(f, ang ? w / 2 : -w / 2, 0, side, ang);
    panel(
      g,
      w,
      lo,
      lo + h,
      [[w / 2, lo, openingWidth, openingHeight, true, true]],
      arch ? 'carved' : 'plaster',
      arch ? [0.73, 0.72, 0.66] : plaster,
    );
    if (near(o)) {
      line(g, [0.3, lo + h - 0.2, 0.14], [w - 0.3, lo + h - 0.2, 0.14], 0.3);
      for (const dx of [w / 2 - 2.3, w / 2 + 2.3])
        box(g, 'carved', [dx - 0.22, lo, 0.01], [dx + 0.22, lo + openingHeight + 0.5, 0.26], trim);
    }
  }
  for (const side of [-1, 1])
    panel(frame(f, (side * w) / 2, 0, (side * d) / 2, (side * Math.PI) / 2), d, lo, lo + h);
  const curve = opening(0, lo, openingWidth, openingHeight, true, near(o) ? 12 : 6);
  for (let i = 1; i < curve.length; i++) {
    const p = curve[i],
      q = curve[(i + 1) % curve.length];
    if (i === curve.length - 1) continue;
    face(
      f,
      'carved',
      [
        [p[0], p[1], d / 2],
        [q[0], q[1], d / 2],
        [q[0], q[1], -d / 2],
        [p[0], p[1], -d / 2],
      ],
      trim,
    );
  }
  if (kind === 'baroque') {
    box(f, 'carved', [-w / 2, lo + h, -d / 2], [w / 2, lo + h + 0.35, d / 2], trim);
    if (near(o)) for (const xx of [-w * 0.4, w * 0.4]) ornament(f, xx, lo + h + 0.35, 0, 1.8);
  } else {
    roofStrip(
      f,
      [-w * 0.54, -d * 0.6],
      [w * 0.54, -d * 0.6],
      [w * 0.54, d * 0.6],
      [-w * 0.54, d * 0.6],
      lo + h,
      rise,
      false,
    );
    if (near(o))
      for (const side of [-1, 1]) {
        const g = frame(f, side < 0 ? w / 2 : -w / 2, 0, (side * d) / 2, side < 0 ? Math.PI : 0);
        for (const xx of [w * 0.25, w * 0.75])
          panel(
            frame(g, xx - 0.4, 0, 0.03),
            0.8,
            lo + h - 3.2,
            lo + h - 1.2,
            [[0.4, lo + h - 3.1, 0.45, 1.35, false]],
            'carved',
            trim,
          );
      }
  }
}
const outline = map.enclosureOutline;
function inside(p, poly) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function terrainY(x, z) {
  // Provisional terrace field, not a surveyed terrain raster. Exterior fit remains draft.
  if (z < -48 && x < 0) return 8;
  if (z < 10 && x > -104) return 10;
  const t = Math.max(0, Math.min(1, (z - 10) / 132));
  return 10 * (1 - t);
}
const palacePlatform = [
  [-111, -28],
  [-104.7573, -45.5843],
  [-83.8, -55.8],
  [-91, -66],
  [-24, -90.2],
  [-15, -83],
  [6.8, -39],
  [15.5, -28],
  [15.5, -13],
  [8.8, -4],
  [-43.5, 11.5],
  [-52.8, 5],
  [-75.443, 18.2196],
];
function ground(o) {
  const boundary = o.detail === 'skyline' ? outline.filter((_, i) => i % 4 === 0) : outline;
  const p = [...boundary, ...palacePlatform],
    ix = earcut(p.flat(), [boundary.length]);
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix
      .slice(i, i + 3)
      .map((j) => [p[j][0], j >= boundary.length ? 2 : terrainY(...p[j]), p[j][1]]);
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, 'foliage', q, [0.27, 0.36, 0.17]);
  }
  // A single supported platform follows palace/forecourt margins; its cutout keeps turf off the terrace wall.
  solid(
    o,
    area(palacePlatform) < 0 ? [...palacePlatform].reverse() : palacePlatform,
    0,
    10,
    'stone',
    [0.63, 0.61, 0.55],
  );
  if (near(o)) {
    const a = [-111, -28],
      b = [-75.443, 18.2196],
      f = edgeFrame(o, a, b),
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let x = 1.7; x < len - 1; x += 4.1) {
      const p = [
        [x - 0.4, 2, 0],
        [x + 0.4, 2, 0],
        [x + 0.4, 2, 3.1],
        [x - 0.4, 2, 3.1],
      ];
      loft(
        f,
        'stone',
        [
          p.reverse(),
          [
            [x - 0.4, 9.8, 0],
            [x + 0.4, 9.8, 0],
            [x + 0.4, 9.8, 0.3],
            [x - 0.4, 9.8, 0.3],
          ].reverse(),
        ],
        stone,
      );
    }
  }
}
function pathLine(o, p, width, y, slot = 'aggregate', c = [0.77, 0.74, 0.66]) {
  edges(
    o,
    p,
    (f, len, _i, a, b) => {
      const ya = typeof y === 'function' ? y(...a) : y,
        yb = typeof y === 'function' ? y(...b) : y;
      face(
        f,
        slot,
        [
          [0, ya, -width / 2],
          [0, ya, width / 2],
          [len, yb, width / 2],
          [len, yb, -width / 2],
        ],
        c,
      );
    },
    false,
  );
}
function garden(o) {
  const p = ring(369605107);
  const foundation = o.detail === 'skyline' ? p.filter((_, i) => i % 4 === 0) : p;
  edges(o, foundation, (f, len) => panel(f, len, 0, 10.04, [], 'stone', [0.63, 0.61, 0.55]));
  horizontal(o, p, 10.06, 'aggregate', [0.78, 0.76, 0.69]);
  if (o.detail === 'skyline') return;
  const vegetation = map.features.filter(
    (f) =>
      f.points &&
      (f.tags.barrier === 'hedge' || f.tags.landuse === 'grass' || f.tags.landuse === 'flowerbed'),
  );
  for (const f of vegetation) {
    const c = center(f.points);
    if (!inside(c, p)) continue;
    if (f.tags.barrier === 'hedge') {
      if (o.detail === 'district') continue;
      const pts = f.points.filter(
        (_, i) => master(o) || fine(o) || i % 3 === 0 || i === f.points.length - 1,
      );
      edges(
        o,
        pts,
        (g, len) => {
          if (fine(o)) {
            face(
              g,
              'foliage',
              [
                [0, 10.68, -0.28],
                [0, 10.68, 0.28],
                [len, 10.68, 0.28],
                [len, 10.68, -0.28],
              ],
              [0.14, 0.255, 0.08],
            );
            for (const side of [-1, 1])
              face(
                g,
                'foliage',
                side < 0
                  ? [
                      [0, 10.09, -0.28],
                      [0, 10.68, -0.28],
                      [len, 10.68, -0.28],
                      [len, 10.09, -0.28],
                    ]
                  : [
                      [0, 10.09, 0.28],
                      [len, 10.09, 0.28],
                      [len, 10.68, 0.28],
                      [0, 10.68, 0.28],
                    ],
                [0.13, 0.23, 0.07],
              );
          } else
            face(
              g,
              'foliage',
              [
                [0, 10.5, -0.3],
                [0, 10.5, 0.3],
                [len, 10.5, 0.3],
                [len, 10.5, -0.3],
              ],
              [0.14, 0.255, 0.08],
            );
        },
        false,
      );
    } else
      horizontal(
        o,
        f.points,
        10.085,
        'foliage',
        f.tags.landuse === 'flowerbed' ? [0.38, 0.39, 0.2] : [0.28, 0.4, 0.16],
      );
  }
  // Higher eastern parterre terraces are documented; riser placement remains estimated.
  for (const id of [1549987659, 1549987660]) {
    const f = map.features.find((f) => f.id === `way/${id}`);
    if (!f) continue;
    pathLine(o, f.points, 0.7, 10.11, 'carved', trim);
  }
  edges(
    o,
    points(427836944),
    (f, len) => {
      panel(f, len, 8, 13.5, [], 'plaster', [0.83, 0.805, 0.74]);
      if (near(o)) box(f, 'carved', [0, 13.5, -0.35], [len, 13.75, 0.2], trim);
    },
    false,
  );
  if (near(o)) {
    const basin = ring(513653074),
      bc = center(basin);
    solid(o, scaled(basin, 1.08), 10.1, 10.5, 'carved', trim);
    horizontal(o, basin, 10.54, 'glass', [0.27, 0.43, 0.43]);
    cylinder(o, ...[bc[0], bc[1]], 0.7, 10.5, 11.7);
    cylinder(o, bc[0], bc[1], 1.55, 11.6, 11.8);
    if (fine(o))
      for (const f of vegetation
        .filter((f) => f.tags.barrier === 'hedge')
        .filter((_, i) => i % 8 === 0)) {
        const c = center(f.points);
        if (inside(c, p)) ornament(o, c[0], 10.1, c[1], 1.1);
      }
  }
}
function ruins(o) {
  if (!near(o)) return;
  for (const [id, holes] of [
    [555280092, [1066123125]],
    [555280090, [555280088]],
    [555280086, []],
    [766771647, []],
    [766771646, []],
  ]) {
    const p = ring(id),
      inner = holes.map(ring),
      y = terrainY(...center(p)) + 0.05;
    for (const q of [p, ...inner.map((p) => [...p].reverse())])
      edges(o, q, (f, len) => panel(f, len, y, y + 0.42, [], 'stone', [0.59, 0.57, 0.5]));
    horizontal(o, p, y + 0.42, 'stone', [0.7, 0.68, 0.62], inner);
  }
}
function groundsWalls(o) {
  if (o.detail === 'skyline') return;
  for (const id of [115596632, 115596635, 115596646, 115596647, 37409847, 628298560]) {
    const f = map.features.find((f) => f.id === `way/${id}`);
    if (!f) continue;
    edges(
      o,
      f.points,
      (g, len, _i, a, b) => {
        const ya = terrainY(...a),
          yb = terrainY(...b);
        face(
          g,
          'stone',
          [
            [0, 0, 0],
            [len, 0, 0],
            [len, yb + 1.1, 0],
            [0, ya + 1.1, 0],
          ],
          stone,
        );
        face(
          g,
          'stone',
          [
            [0, ya + 1.1, -0.5],
            [len, yb + 1.1, -0.5],
            [len, 0, -0.5],
            [0, 0, -0.5],
          ],
          stone,
        );
        face(
          g,
          'carved',
          [
            [0, ya + 1.15, -0.56],
            [0, ya + 1.15, 0.05],
            [len, yb + 1.15, 0.05],
            [len, yb + 1.15, -0.56],
          ],
          trim,
        );
      },
      false,
    );
  }
  for (const f of map.features.filter(
    (f) => f.points && ['footway', 'path', 'steps'].includes(f.tags.highway),
  )) {
    const c = center(f.points);
    if (c[1] < 10 || inside(c, palacePlatform)) continue;
    if (f.points.length < 2) continue;
    pathLine(o, f.points, f.tags.highway === 'steps' ? 2.5 : 1.8, (x, z) => terrainY(x, z) + 0.07);
  }
}
function equestrianMemorial(o) {
  if (!near(o)) return;
  const c = map.features.find((f) => f.id === 'node/2554636621').center;
  cylinder(o, c[0], c[1], 0.95, 10, 13, 'carved', [0.85, 0.83, 0.77], fine(o) ? 20 : 8);
  if (!fine(o)) return;
  // Original, interpretive horse and rider silhouette. Not a verified portrait sculpture.
  const f = frame(o, c[0], 13, c[1], 1.019493535917),
    bronze = [0.29, 0.22, 0.14];
  const s = master(o) ? 20 : 10,
    t = master(o) ? 12 : 6;
  sphere(f, 'bronze', [0, 2, 0], [0.48, 0.65, 1.16], bronze, s, t);
  sphere(frame(f, 0, 2.25, 0.85, -0.08), 'bronze', [0, 0.6, 0], [0.34, 0.85, 0.38], bronze, s, t);
  sphere(f, 'bronze', [0, 3.55, 1.18], [0.28, 0.38, 0.51], bronze, s, t);
  for (const side of [-1, 1]) {
    for (const z of [-0.75, 0.68]) {
      const xx = side * 0.31;
      const knee = z > 0 && side > 0 ? [xx, 0.98, 1.05] : [xx, 0.8, z + 0.07];
      beam(f, 'bronze', [xx, 1.9, z], knee, 0.2, 0.2, bronze);
      beam(f, 'bronze', knee, [xx, 0.17, z > 0 && side > 0 ? 1.48 : z], 0.15, 0.17, bronze);
      box(
        f,
        'bronze',
        [xx - 0.13, 0.02, (z > 0 && side > 0 ? 1.48 : z) - 0.14],
        [xx + 0.13, 0.22, (z > 0 && side > 0 ? 1.48 : z) + 0.14],
        bronze,
      );
    }
    beam(f, 'bronze', [side * 0.23, 2.65, 0], [side * 0.51, 1.65, 0.22], 0.24, 0.27, bronze);
    beam(f, 'bronze', [side * 0.51, 1.65, 0.22], [side * 0.54, 1.2, 0.4], 0.19, 0.23, bronze);
  }
  sphere(f, 'bronze', [0, 3.1, -0.13], [0.34, 0.68, 0.28], bronze, s, t);
  sphere(f, 'bronze', [0, 3.96, -0.09], [0.24, 0.3, 0.22], bronze, s, t);
  beam(f, 'bronze', [-0.22, 3.5, -0.03], [-0.73, 4.14, 0.16], 0.18, 0.18, bronze);
  beam(f, 'bronze', [-0.73, 4.14, 0.16], [-0.84, 4.65, 0.17], 0.15, 0.15, bronze);
  beam(f, 'bronze', [-0.84, 4.45, 0.17], [-0.82, 4.8, 0.17], 0.07, 0.025, bronze);
  beam(f, 'bronze', [0.24, 3.47, 0], [0.5, 2.96, 0.76], 0.18, 0.18, bronze);
  beam(f, 'bronze', [0, 2.3, -0.95], [0.12, 0.76, -1.42], 0.19, 0.19, bronze);
}
export function buildBratislavaRuntime(out, detail) {
  const o = { ...out, detail };
  ground(o);
  palace(o);
  lowBuilding(
    o,
    5131401,
    8,
    8.8,
    [
      [-106, -116],
      [-52, -138],
      [-26, -94],
      [-87, -69],
    ],
    12,
    4.4,
    { yellow: true },
  );
  lowBuilding(
    o,
    369605108,
    10,
    9.8,
    [
      [-6, -60],
      [37, -81.5],
    ],
    20,
    6,
  );
  lowBuilding(
    o,
    1128325902,
    8,
    9,
    [
      [-29, -137],
      [-14, -94],
      [6, -93],
    ],
    9,
    3.2,
  );
  const pavilion = [
    [-13.6323, -102.9424],
    [-5.8015, -115.7103],
    [15.5906, -104.4045],
    [18.9537, -100.5079],
    [19.4956, -84.8136],
    [-11.5441, -69.8781],
    [-18.002, -89.774],
  ];
  for (let i = 0; i < pavilion.length; i++) {
    const a = pavilion[i],
      b = pavilion[(i + 1) % pavilion.length];
    roofFacet(o, [a[0], 17, a[1]], [b[0], 17, b[1]], [1, 22, -94], [1, 22, -94]);
  }
  lowBuilding(
    o,
    5131386,
    6,
    8.8,
    [
      [113, -138.4],
      [139, -142],
      [158, -105],
      [162, -87],
      [157, -46],
      [157, -6],
      [150, 10],
      [162, 19],
    ],
    10.5,
    4.6,
  );
  lowBuilding(
    o,
    115596633,
    6,
    8.8,
    [
      [101.5, -27.8],
      [147, 18],
    ],
    12,
    4.6,
  );
  lowBuilding(
    o,
    5131387,
    5,
    4.8,
    [
      [72, 62.5],
      [124, 17.2],
    ],
    11.7,
    4,
    { windows: 1 },
  );
  lowBuilding(
    o,
    37409846,
    2,
    7,
    [
      [-129, 55],
      [-125, 35],
    ],
    8.6,
    4.3,
  );
  pavilions(o);
  gate(o, { x: -121.5, z: -123.5, a: -0.58, w: 10.5, d: 2.8, lo: 8, h: 5.6 });
  lowBuilding(
    o,
    115596636,
    8,
    4.5,
    [
      [-115, -119],
      [-111, -110],
    ],
    7,
    2.4,
    { windows: 1 },
  );
  gate(o, {
    x: -65.2,
    z: 146.8,
    a: -0.57,
    w: 11.6,
    d: 10.7,
    lo: 0,
    h: 11.5,
    rise: 7,
    kind: 'gothic',
  });
  gate(o, {
    x: 136.1,
    z: 19.8,
    a: -0.76,
    w: 6.1,
    d: 10.5,
    lo: 5.5,
    h: 7.2,
    rise: 3,
    kind: 'roofed',
  });
  // Leopold bastion is a low fortification, not a towering palace wing.
  gate(o, { x: -151, z: -11, a: -0.92, w: 20, d: 10, lo: 0, h: 7, kind: 'baroque' });
  lowBuilding(
    o,
    1128350262,
    6,
    5.8,
    [
      [-131, -30],
      [-122, -18],
    ],
    9,
    2.9,
    { windows: 1 },
  );
  garden(o);
  ruins(o);
  groundsWalls(o);
  equestrianMemorial(o);
}
export const buildBratislavaSkyline = (out) => buildBratislavaRuntime(out, 'skyline');
export const bratislavaStudy = {
  id: 'N0253',
  key: 'bratislava_castle',
  title: 'Bratislava Castle',
  category: 'castle',
  wikidataId: 'Q593311',
  mapFrame: 'map-frame.json',
  build: (out) => buildBratislavaRuntime(out),
  brief:
    'White four-wing palace around a real open courtyard, unequal square/octagonal corner towers and swept terracotta crowns; curved Court of Honour pavilions, separate gates, mapped barracks, riding hall and Baroque garden.',
  sourceFacts: {
    identity:
      'Q593311 identifies grounds way/1128350263; palace Q13425656 is way/8160490 and relation/14610630.',
    mappedEnvelopeMeters: [334.485, 310.572],
    mappedFeatures: 334,
    officialCrownTowerHeightMeters: 47,
    surveyedVerticalDatum: false,
  },
  reconstruction: {
    basis:
      'OSM independent parts fix the palace, courtyard, towers, gates and garden plan. Official tourist-board photographs and the NR SR 2018 reconstruction illustration guide exterior forms.',
    verticalDatum:
      'Provisional palace terrace Y=10, Crown roof tip Y=57 (47 m above terrace), finial Y=57.65. Museum height takes precedence over conflicting OSM 31 m tower tags; exact measured datum and other building heights require review.',
    state:
      'Restored Baroque palace and garden; Great Moravian church survives as low archaeological foundations.',
  },
  scaleBasis:
    'Meter map coordinates. Native +X 58.412 degrees north of east; +Z southeast. Terrace elevations, facade bay rhythms, roof pitches and portals are reconstructed, not a measured survey.',
  refs: [
    'https://www.snm.sk/en/museums/museum-of-history/museum-of-history/visit/expositions?clanok=crown-tower-1',
    'https://www.visitbratislava.com/places/bratislava-castle/',
    'https://www.visitbratislava.com/wp-content/uploads/2020/01/4DL_hrad_2023_EN_web.pdf',
    'https://www.nrsr.sk/web/Dynamic/Download.aspx?DocID=448675',
    'https://www.openstreetmap.org/way/1128350263',
    'https://www.openstreetmap.org/relation/14610630',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map data © OpenStreetMap contributors, ODbL-1.0. Official illustrations and photographs were inspected as architectural references; no third-party photograph or mesh is embedded.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X east-northeast, 58.412 degrees north of east',
    front: 'South entrance toward native -X/+Z; +Z southeast',
    origin: 'Mapped grounds anchor; provisional lower Sigismund Gate datum',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'Draft pending terrace heights, directional fit and terrain contact',
    notes:
      'Enclosure includes open grounds. Palace court, gardens and park must remain open; do not replace the enclosure with a solid building.',
  }),
  geographicNote: 'Draft horizontal map fit; vertical and terrain alignment remain unverified.',
  limitations: [
    'Maximum exterior fidelity pending: detailed surveyed elevations are unavailable. Palace facades, tower clocks, dormers, chimneys, gate profiles and roof junctions need photographic refinement.',
    'Museum gives Crown Tower height 47 m; OSM tower parts say 31 m. The recipe uses the museum value above a provisional terrace, without claiming that its height datum is verified.',
    'Landscape field, supporting platforms and terrace heights are interpreted. The four historical garden terraces are not yet modeled to measured levels. Retaining walls, stairs and terrain contact require in-world fitting.',
    'The original equestrian sculpture is an interpretive silhouette, not a likeness of the Svätopluk artwork. Garden figures, St Elizabeth statue, ornamental carving, mature trees, interiors and underground remains are unfinished or omitted.',
    'Shared plaster, tile, stone, wood, gravel and metal carry materials; no embedded images. Detailed masters retain modeled tile courses, window joinery and trim. No physical-device benchmark approval is claimed.',
  ],
  camera: { position: [-290, 235, 240], lookAt: [0, 18, 0], fov: 43 },
  qaCameras: [
    { name: 'mapped-palace-and-garden-plan', position: [0, 510, 0.2], lookAt: [0, 0, 0] },
    { name: 'south-court-of-honour', position: [-156, 42, 20], lookAt: [-65, 30, -27] },
    {
      name: 'crown-tower-and-western-barracks',
      position: [-166, 66, -114],
      lookAt: [-60, 25, -60],
    },
    { name: 'open-courtyard', position: [-37, 65, -12], lookAt: [-37, 18, -44] },
    { name: 'garden-and-riding-hall', position: [98, 80, -127], lookAt: [30, 17, -53] },
    { name: 'garden-parterre-and-fountain', position: [116, 28, -28], lookAt: [55, 10, -53] },
    { name: 'north-barracks-and-nicholas-gate', position: [227, 38, 52], lookAt: [133, 13, -20] },
    { name: 'sigismund-gate-and-lower-park', position: [-105, 26, 202], lookAt: [-65, 9, 130] },
    {
      name: 'leopold-gate-and-buttressed-terrace',
      position: [-225, 38, 5],
      lookAt: [-117, 12, -15],
    },
  ],
};
