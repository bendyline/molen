/** Hohenzollern: mapped horseshoe palace, individual towers, two chapels and open spiral ramps. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u0/u0w/n0252_hohenzollern_castle/map-parts.json',
      import.meta.url,
    ),
  ),
);
const plaster = [0.77, 0.65, 0.44],
  trim = [0.83, 0.75, 0.59],
  stone = [0.54, 0.52, 0.45],
  wood = [0.22, 0.13, 0.08],
  tile = [0.25, 0.29, 0.32],
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
function ring(id) {
  const p = points(id);
  if (p[0].join() === p.at(-1).join()) p.pop();
  let changed = true;
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length];
      const length = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        length &&
        Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / length < 0.09
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
const rectangle = (x, z, w, d) => [
  [x, z],
  [x + w, z],
  [x + w, z + d],
  [x, z + d],
];
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
  const spring = y + h - w * 0.85;
  for (let i = 0; i <= steps; i++) {
    const angle = (Math.PI * i) / steps;
    p.push([x + (Math.cos(angle) * w) / 2, spring + Math.sin(angle) * w * 0.85]);
  }
  return p;
}
function panel(o, w, lo, hi, windows = [], slot = 'sandstone', c = plaster) {
  const valid = o.detail === 'skyline' ? windows.filter((v) => v[5]) : windows;
  const all = [
    [
      [0, lo],
      [w, lo],
      [w, hi],
      [0, hi],
    ],
    ...valid.map((v) =>
      opening(v[0], v[1], v[2], v[3], v[4], o.detail === 'skyline' ? 2 : fine(o) ? 8 : 3),
    ),
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
        line(o, [a[0], a[1], 0.07], [b[0], b[1], 0.07], 0.16);
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
function edges(o, p, fn) {
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 0.12) fn(edgeFrame(o, b, a), len, i);
  }
}
function solid(o, p, lo, hi, slot = 'sandstone', c = plaster) {
  edges(o, p, (f, len) => panel(f, len, lo, hi, [], slot, c));
  cap(o, p, hi, slot, c);
}
function band(o, p, y, w = 0.2) {
  if (!near(o)) return;
  edges(o, p, (f, len) => {
    if (fine(o)) box(f, 'carved', [0, y, 0], [len, y + w, 0.17], trim);
    else
      face(
        f,
        'carved',
        [
          [0, y, 0.03],
          [len, y, 0.03],
          [len, y + w, 0.03],
          [0, y + w, 0.03],
        ],
        trim,
      );
  });
}
function masonry(o, w, lo, hi, holes, seed = 0) {
  if (!master(o)) return;
  // Shallow ashlar joints, omitted inside the actual window openings.
  const contains = (x, y) =>
    holes.some(
      (v) => Math.abs(x - v[0]) < v[2] / 2 + 0.14 && y > v[1] - 0.15 && y < v[1] + v[3] + 0.15,
    );
  for (let row = 0, y = lo + 0.38; y < hi - 0.2; row++, y += 0.42) {
    const bw = 0.85;
    for (let x = 0.1 + ((row % 2) * bw) / 2; x < w - 0.12; x += bw) {
      const right = Math.min(w - 0.1, x + bw - 0.025);
      if (contains(x, y) || contains(right, y)) continue;
      face(
        o,
        'sandstone',
        [
          [x, y, 0.015],
          [right, y, 0.015],
          [right, y + 0.014, 0.015],
          [x, y + 0.014, 0.015],
        ],
        color(plaster, 0.74),
      );
      if (y + 0.39 < hi && !contains(x, y + 0.39))
        face(
          o,
          'sandstone',
          [
            [x, y, 0.016],
            [x + 0.012, y, 0.016],
            [x + 0.012, y + 0.39, 0.016],
            [x, y + 0.39, 0.016],
          ],
          color(plaster, 0.78 + (seed % 3) * 0.015),
        );
    }
  }
}
function parapet(o, p, y, { merlons = true } = {}) {
  if (o.detail === 'skyline') return;
  edges(o, p, (f, len) => {
    box(f, 'sandstone', [0, y, -0.55], [len, y + 0.58, 0.02], plaster);
    if (merlons && near(o))
      for (let x = 0.05; x < len - 0.3; x += 1.48)
        if (fine(o))
          box(f, 'carved', [x, y + 0.58, -0.57], [Math.min(x + 0.71, len), y + 1.08, 0.06], trim);
        else {
          const p = [
            [x, y + 0.58, 0.03],
            [Math.min(x + 0.71, len), y + 0.58, 0.03],
            [Math.min(x + 0.71, len), y + 1.08, 0.03],
            [x, y + 1.08, 0.03],
          ];
          face(f, 'carved', p, trim);
          face(f, 'carved', [...p].reverse(), trim);
        }
  });
}
// Difference of a convex roof facet and convex tower footprint. Split at each
// half-plane so roof surfaces do not pass through the open Watch Tower arcade.
function roofPieces(poly, hole) {
  const minX = Math.min(...poly.map((p) => p[0])),
    maxX = Math.max(...poly.map((p) => p[0]));
  const minZ = Math.min(...poly.map((p) => p[2])),
    maxZ = Math.max(...poly.map((p) => p[2]));
  if (
    maxX < hole.x - hole.r ||
    minX > hole.x + hole.r ||
    maxZ < hole.z - hole.r ||
    minZ > hole.z + hole.r
  )
    return [poly];
  const ring = Array.from({ length: 16 }, (_, i) => [
    hole.x + hole.r * Math.cos((i * Math.PI) / 8),
    hole.z + hole.r * Math.sin((i * Math.PI) / 8),
  ]);
  const clip = (p, a, b, inside) => {
    const result = [];
    const distance = (p) => (b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    for (let i = 0; i < p.length; i++) {
      const u = p[i],
        v = p[(i + 1) % p.length],
        du = distance(u),
        dv = distance(v);
      const iu = inside ? du >= 0 : du <= 0,
        iv = inside ? dv >= 0 : dv <= 0;
      if (iu) result.push(u);
      if (iu !== iv) result.push(mix(u, v, du / (du - dv)));
    }
    return result;
  };
  let remainder = poly;
  const result = [];
  for (let i = 0; i < ring.length && remainder.length >= 3; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const outside = clip(remainder, a, b, false);
    if (outside.length >= 3) result.push(outside);
    remainder = clip(remainder, a, b, true);
  }
  return result;
}
function roofPolygon(o, p, c, holes) {
  let polygons = [p];
  for (const hole of holes) polygons = polygons.flatMap((p) => roofPieces(p, hole));
  for (const polygon of polygons)
    for (let i = 1; i < polygon.length - 1; i++) {
      const q = [polygon[0], polygon[i], polygon[i + 1]];
      const a = q[1].map((v, j) => v - q[0][j]),
        b = q[2].map((v, j) => v - q[0][j]);
      if (Math.abs(a[0] * b[2] - a[2] * b[0]) < 0.00002) continue;
      if (normalFor(...q)[1] < 0) q.reverse();
      tri(o, 'slate', q, c);
    }
}
function roofFacet(o, a, b, c, d, holes = []) {
  const collapsed = Math.hypot(...c.map((v, i) => v - d[i])) < 0.001;
  const p = collapsed ? [a, b, c] : [a, b, c, d];
  if (normalFor(...p)[1] < 0) p.reverse();
  if (holes.length) roofPolygon(o, p, tile, holes);
  else if (collapsed) tri(o, 'slate', p, tile);
  else face(o, 'slate', p, tile);
  if (!fine(o)) return;
  const n = normalFor(...p),
    length = Math.hypot(...d.map((v, i) => v - a[i]));
  const rows = Math.ceil(length / (master(o) ? 0.28 : 0.7));
  for (let j = 0; j < rows; j++) {
    const t0 = (j + 0.05) / rows,
      t1 = (j + 0.95) / rows;
    const aa = mix(a, d, t0),
      bb = mix(b, c, t0),
      cc = mix(b, c, t1),
      dd = mix(a, d, t1);
    const cols = Math.max(
      1,
      Math.floor(Math.hypot(...bb.map((v, i) => v - aa[i])) / (master(o) ? 0.34 : 1.15)),
    );
    for (let k = 0; k < cols; k++) {
      const u0 = (k + 0.025) / cols,
        u1 = (k + 0.97) / cols;
      const q = [mix(aa, bb, u0), mix(aa, bb, u1), mix(dd, cc, u1), mix(dd, cc, u0)].map((p) =>
        p.map((v, i) => v + n[i] * 0.015),
      );
      if (normalFor(...q)[1] < 0) q.reverse();
      const tint = color(tile, 0.86 + ((j * 13 + k * 7) % 11) * 0.025);
      if (holes.length) roofPolygon(o, q, tint, holes);
      else face(o, 'slate', q, tint);
    }
  }
}
function gableRoof(
  o,
  a,
  b,
  width,
  eave,
  rise,
  { hips = 0, stoneGables = false, cutouts = [] } = {},
) {
  const f = edgeFrame(o, a, b),
    l = Math.hypot(b[0] - a[0], b[1] - a[1]),
    h = width / 2;
  const ux = (b[0] - a[0]) / l,
    uz = (b[1] - a[1]) / l;
  const holes = near(o)
    ? cutouts.map(([x, z, r]) => ({
        x: (x - a[0]) * ux + (z - a[1]) * uz,
        z: -(x - a[0]) * uz + (z - a[1]) * ux,
        r,
      }))
    : [];
  roofFacet(
    f,
    [0, eave, -h],
    [l, eave, -h],
    [l - hips, eave + rise, 0],
    [hips, eave + rise, 0],
    holes,
  );
  roofFacet(
    f,
    [l, eave, h],
    [0, eave, h],
    [hips, eave + rise, 0],
    [l - hips, eave + rise, 0],
    holes,
  );
  if (hips) {
    roofFacet(f, [0, eave, h], [0, eave, -h], [hips, eave + rise, 0], [hips, eave + rise, 0]);
    roofFacet(
      f,
      [l, eave, -h],
      [l, eave, h],
      [l - hips, eave + rise, 0],
      [l - hips, eave + rise, 0],
    );
  } else {
    for (const x of [0, l]) {
      const p = [
        [x, eave, -h],
        [x, eave + rise, 0],
        [x, eave, h],
      ];
      if (x === l) p.reverse();
      tri(f, stoneGables ? 'sandstone' : 'slate', p, stoneGables ? plaster : tile);
    }
  }
  if (near(o))
    beam(
      f,
      'metal',
      [hips, eave + rise + 0.055, 0],
      [l - hips, eave + rise + 0.055, 0],
      0.13,
      0.13,
      [0.35, 0.38, 0.38],
    );
}
function cone(o, x, z, r, y, h, sides = 16, slot = 'slate', c = tile) {
  for (let i = 0; i < sides; i++) {
    const a = (2 * Math.PI * i) / sides + (sides === 4 ? Math.PI / 4 : 0),
      b = (2 * Math.PI * (i + 1)) / sides + (sides === 4 ? Math.PI / 4 : 0);
    const aa = [x + r * Math.cos(a), y, z + r * Math.sin(a)],
      bb = [x + r * Math.cos(b), y, z + r * Math.sin(b)],
      top = [x, y + h, z];
    if (slot === 'slate') roofFacet(o, aa, bb, top, top);
    else tri(o, slot, [aa, top, bb], c);
  }
}
function cylinder(o, x, z, r, lo, hi, slot = 'sandstone', c = plaster, sides = 16) {
  const p = Array.from({ length: sides }, (_, i) => [
    x + r * Math.cos((i * 2 * Math.PI) / sides),
    z + r * Math.sin((i * 2 * Math.PI) / sides),
  ]);
  solid(o, p, lo, hi, slot, c);
  return p;
}
function finial(o, x, y, z, h = 1.2) {
  if (o.detail === 'skyline') return;
  beam(o, 'metal', [x, y, z], [x, y + h, z], 0.085, 0.085, [0.3, 0.31, 0.28]);
  if (fine(o)) {
    beam(
      o,
      'metal',
      [x - 0.23, y + h * 0.65, z],
      [x + 0.23, y + h * 0.65, z],
      0.065,
      0.065,
      [0.3, 0.31, 0.28],
    );
  }
}
function turret(o, x, z, y, { r = 0.55, h = 5, roof = 2.8, flat = false } = {}) {
  const sides = master(o) ? 16 : near(o) ? 8 : 6;
  cylinder(o, x, z, r * 0.65, y - 0.7, y, 'carved', trim, sides);
  const p = cylinder(o, x, z, r, y, y + h, 'sandstone', plaster, sides);
  if (flat) {
    parapet(o, p, y + h);
    return;
  }
  cone(o, x, z, r * 1.26, y + h, roof, sides);
  finial(o, x, y + h + roof, z, 0.6);
}
function roundTower(o, x, z, r, top, roof, { flat = false } = {}) {
  const sides =
    flat && near(o)
      ? 16
      : master(o)
        ? 40
        : fine(o)
          ? 24
          : near(o)
            ? 16
            : o.detail === 'district'
              ? 12
              : 8;
  const p = Array.from({ length: sides }, (_, i) => [
    x + r * Math.cos((i * 2 * Math.PI) / sides),
    z + r * Math.sin((i * 2 * Math.PI) / sides),
  ]);
  edges(o, p, (f, len, i) => {
    const windows = [];
    if (near(o) && i % Math.max(1, Math.round(sides / 8)) === 0) {
      for (let y = 33.5; y < top - 5; y += 6.6)
        windows.push([len / 2, y, Math.min(0.62, len * 0.64), 1.65, true]);
      if (flat) windows.push([len / 2, top - 4.8, Math.min(1.2, len * 0.8), 3.4, true]);
    }
    panel(f, len, 30, top, windows);
    masonry(f, len, 30.4, top - 0.4, windows, i);
  });
  cap(o, p, top, 'sandstone', plaster);
  if (near(o)) for (const y of [31, top - 5.1, top - 1.4, top - 0.3]) band(o, p, y, 0.2);
  if (flat) {
    parapet(o, p, top);
    if (o.detail !== 'skyline') {
      beam(o, 'metal', [x, top, z], [x, top + 6, z], 0.085, 0.085, [0.28, 0.29, 0.27]);
      if (near(o))
        face(
          o,
          'wood',
          [
            [x, top + 4.4, z],
            [x + 2.3, top + 4.4, z + 0.12],
            [x + 2.3, top + 5.8, z + 0.12],
            [x, top + 5.8, z],
          ],
          [0.89, 0.85, 0.71],
        );
    }
  } else {
    cone(o, x, z, r * 1.08, top, roof, sides);
    finial(o, x, top + roof, z);
    if (fine(o))
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        turret(o, x + (r + 0.12) * Math.cos(a), z + (r + 0.12) * Math.sin(a), top - 3.2, {
          r: 0.24,
          h: 3.5,
          roof: 1.05,
        });
      }
  }
}
function palaceWing(o, id, hi) {
  const p = ring(id);
  edges(o, p, (f, len, i) => {
    const holes = [];
    if (near(o) && len > 2.1) {
      const count = Math.max(1, Math.round(len / 3.35));
      for (let j = 0; j < count; j++)
        for (const y of [32, 37.1, 42.5])
          if (y + 3.1 < hi)
            holes.push([
              ((j + 0.5) * len) / count,
              y,
              Math.min(1.55, (len / count) * 0.58),
              y === 32 ? 1.7 : 3.15,
              false,
            ]);
    }
    panel(f, len, 30, hi, holes);
    masonry(f, len, 30.3, hi - 0.4, holes, i);
  });
  cap(o, p, hi, 'sandstone', plaster);
  band(o, p, 36.1, 0.22);
  band(o, p, 41.8, 0.18);
  band(o, p, hi - 0.25, 0.28);
  parapet(o, p, hi);
}
function dormer(o, x, y, z, a = 0) {
  if (!near(o)) return;
  const f = frame(o, x, y, z, a);
  box(f, 'sandstone', [-0.6, 0, -0.85], [0.6, 1.45, 0.05], plaster);
  panel(frame(f, -0.6, 0, 0.065), 1.2, 0, 1.45, [[0.6, 0.3, 0.5, 0.92, true]]);
  gableRoof(f, [0, 0], [0, -1.4], 1.5, 1.4, 1.25, { stoneGables: true });
}
function palace(o) {
  palaceWing(o, 296628900, 49);
  palaceWing(o, 296628895, 44);
  palaceWing(o, 296628898, 47.5);
  gableRoof(o, [-46, -16], [-0.5, -16], 15.4, 49.3, 6.9, { hips: 1.2 });
  gableRoof(o, [-53.6, -18.3], [-61.7, 11.3], 11.8, 44.3, 5.6, {
    hips: 1.5,
    cutouts: [[-58.7, 1.6, 3.125]],
  });
  gableRoof(o, [-57.8, 12.2], [-35.6, 15.1], 10.6, 47.8, 6.6, { stoneGables: true });
  if (near(o)) {
    for (const x of [-39, -31, -23, -15, -7]) {
      dormer(o, x, 51.3, -10.55);
      dormer(o, x, 51.3, -21.45, Math.PI);
    }
    for (const z of [-10, -2, 6]) dormer(o, -58.5 + (z + 2) * -0.22, 46.1, z, Math.PI / 2);
    for (const x of [-52, -44]) dormer(o, x, 49.7, 16.9, 0.13);
    // Stepped south-wing court gable and its clock, distinct from the chapel.
    const g = frame(o, -37, 0, 13.5, 0.13);
    for (let i = 0; i < 4; i++)
      box(
        g,
        'sandstone',
        [-4 + i * 0.9, 48 + i * 1.7, -0.45],
        [4 - i * 0.9, 49.7 + i * 1.7, 0.45],
        plaster,
      );
    if (fine(o)) {
      const clock = frame(g, 0, 53.2, 0.48);
      const pts = Array.from({ length: 32 }, (_, i) => [
        Math.cos((i * Math.PI) / 16) * 1.1,
        Math.sin((i * Math.PI) / 16) * 1.1,
        0.035,
      ]);
      clock.addConvexPolygon(
        'metal',
        'palette:#ffffff',
        pts,
        [0, 0, 1],
        (p) => [p[0], p[1]],
        [0.13, 0.17, 0.18],
      );
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        line(
          clock,
          [Math.cos(a) * 0.84, Math.sin(a) * 0.84, 0.07],
          [Math.cos(a), Math.sin(a), 0.07],
          0.06,
          'carved',
          trim,
        );
      }
      line(clock, [0, 0, 0.09], [0, 0.65, 0.09], 0.075);
      line(clock, [0, 0, 0.1], [0.51, -0.2, 0.1], 0.075);
    }
    turret(o, -34.3, 9.7, 47.4, { r: 0.6, h: 7, roof: 3.5 });
    turret(o, -35.6, 18.5, 47.4, { r: 0.6, h: 7, roof: 3.5 });
    // Courtyard entry staircase and pointed canopy; no court-spanning roof.
    const f = frame(o, -20.8, 30, -5.6);
    for (let i = 0; i < 17; i++)
      box(f, 'carved', [-1.1, i * 0.22, -i * 0.28], [1.1, (i + 1) * 0.22, -i * 0.28 + 0.28], trim);
    for (const x of [-1.3, 1.3])
      box(f, 'sandstone', [x - 0.16, 3.7, -4.5], [x + 0.16, 8.6, -4.18], plaster);
    gableRoof(f, [0, -4.2], [0, -6.7], 3.3, 8.6, 2.2, { stoneGables: true });
  }
  roundTower(o, -48.4, -24.3, 4.45, 59, 13.8);
  roundTower(o, -64.65, 14.27, 4.63, 58.3, 13.3);
  roundTower(o, -39.8, 18.55, 4.05, 50, 8.5);
  roundTower(o, -58.7, 1.6, 3.12, 51.3, 0, { flat: true });
  // Bischofsturm: rounded lower projecting apse, rectangular upper shaft, pyramidal crown.
  solid(o, ring(296628901), 30, 47.8);
  const b = frame(o, -66.7, 0, -8.8, -0.65),
    bp = rectangle(-3.25, -3.25, 6.5, 6.5);
  edges(b, bp, (f, len) => {
    const holes = near(o)
      ? [
          [len / 2, 50, 1.05, 2.8, true],
          [len / 2, 56, 1.05, 2.8, true],
          ...[1.1, 3.25, 5.4].map((x) => [x, 60.2, 0.7, 2.3, true]),
        ]
      : [];
    panel(f, len, 45, 64, holes);
    masonry(f, len, 45.2, 63.8, holes, 1);
  });
  cap(b, bp, 64, 'sandstone', plaster);
  band(b, bp, 63.4, 0.6);
  cone(b, 0, 0, 5.1, 64, 14, 4);
  finial(b, 0, 78, 0, 1.2);
  if (near(o)) for (const [x, z] of bp) turret(b, x, z, 61, { r: 0.33, h: 3.5, roof: 2.2 });
}
function chapel(o, id, { c, eave, ridge, a, b, width, apseX, apseZ, apseR }) {
  const p = ring(id);
  edges(o, p, (f, len, i) => {
    const holes = near(o) && len > 2 ? [[len / 2, 33, Math.min(1.55, len * 0.48), 4.3, true]] : [];
    panel(f, len, 30, eave, holes, 'limestone', c);
    if (fine(o) && len > 2.5) {
      for (const x of [0.25, len - 0.25]) {
        box(f, 'limestone', [x - 0.17, 30, 0.01], [x + 0.17, eave - 1.1, 0.6], c);
        box(f, 'carved', [x - 0.23, 32, 0.01], [x + 0.23, 32.2, 0.7], trim);
      }
      for (const v of holes) {
        line(f, [v[0], v[1], -0.13], [v[0], v[1] + 3.3, -0.13], 0.085);
        line(f, [v[0] - 0.55, v[1] + 2.8, -0.12], [v[0] + 0.55, v[1] + 2.8, -0.12], 0.08);
      }
    }
    if (master(o)) masonry(f, len, 30.2, eave - 0.2, holes, i);
  });
  cap(o, p, eave, 'limestone', c);
  gableRoof(o, a, b, width, eave + 0.2, ridge - eave, { stoneGables: true });
  if (apseR) cone(o, apseX, apseZ, apseR, eave + 0.15, 3.8, 8);
}
function chapels(o) {
  chapel(o, 282887645, {
    c: [0.73, 0.72, 0.63],
    eave: 39,
    ridge: 45.8,
    a: [-34.6, 16.7],
    b: [-20, 16.7],
    width: 10.2,
    apseX: -20,
    apseZ: 16.7,
    apseR: 5.1,
  });
  chapel(o, 282888752, {
    c: plaster,
    eave: 43.3,
    ridge: 50.3,
    a: [0.6, -13.1],
    b: [9.7, -13.1],
    width: 10.6,
    apseX: 9.5,
    apseZ: -13.1,
    apseR: 5.1,
  });
  if (near(o)) {
    // Open hexagonal belfry on the old Catholic chapel's west gable.
    const x = -33.5,
      z = 16.7;
    cylinder(o, x, z, 0.7, 43.8, 46.3, 'carved', trim, 6);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      box(
        o,
        'carved',
        [x + Math.cos(a) * 0.68 - 0.09, 46.3, z + Math.sin(a) * 0.68 - 0.09],
        [x + Math.cos(a) * 0.68 + 0.09, 48.4, z + Math.sin(a) * 0.68 + 0.09],
        trim,
      );
    }
    cylinder(o, x, z, 0.82, 48.4, 48.6, 'carved', trim, 6);
    cone(o, x, z, 1, 48.6, 2.5, 6);
    finial(o, x, 51.1, z, 0.8);
    for (const z of [-18.3, -7.8]) turret(o, 1, z, 41, { r: 0.42, h: 7, roof: 3.2 });
  }
}
function gate(o, { x, z, a, width, depth, lo, hi, roof }) {
  const f = frame(o, x, 0, z, a),
    hole = [width / 2, lo + 0.005, 2.8, 4.7, true, true];
  for (const side of [1, -1]) {
    const ff = frame(
      f,
      side === 1 ? -width / 2 : width / 2,
      0,
      (side * depth) / 2,
      side === 1 ? 0 : Math.PI,
    );
    const ws = [hole];
    if (near(o))
      for (const yy of [lo + 6.2, lo + 10.2])
        if (yy + 2.1 < hi) ws.push([width / 2, yy, 1.3, 2.1, true]);
    panel(ff, width, lo, hi, ws);
    masonry(ff, width, lo + 0.1, hi - 0.3, ws, 1);
  }
  for (const side of [-1, 1]) {
    const ff = frame(
      f,
      (side * width) / 2,
      0,
      side === 1 ? depth / 2 : -depth / 2,
      (side * Math.PI) / 2,
    );
    panel(ff, depth, lo, hi, near(o) ? [[depth / 2, lo + 6.5, 1.2, 2.2, true]] : []);
  }
  // Actual arch tunnel, preserving an uninterrupted opening through both elevations.
  const r = opening(0, lo + 0.005, 2.8, 4.7, true, near(o) ? 12 : 4);
  for (let i = 0; i < r.length; i++) {
    const aa = r[(i + r.length - 1) % r.length],
      bb = r[i];
    face(
      f,
      'carved',
      [
        [aa[0], aa[1], depth / 2],
        [bb[0], bb[1], depth / 2],
        [bb[0], bb[1], -depth / 2],
        [aa[0], aa[1], -depth / 2],
      ],
      trim,
    );
  }
  cap(f, rectangle(-width / 2, -depth / 2, width, depth), hi, 'sandstone', plaster);
  gableRoof(f, [0, -depth / 2 - 0.2], [0, depth / 2 + 0.2], width + 0.5, hi, roof, { hips: 1.3 });
  if (near(o))
    for (const xx of [-width / 2, width / 2])
      for (const zz of [-depth / 2, depth / 2])
        turret(f, xx, zz, hi - 2, { r: 0.35, h: 3.3, roof: 2.2 });
}
// Local Y=0 at lower Eagle Gate. Upper court +30 is provisional, not a surveyed grade.
const rampParts = [
  [42139345, 0, 0.3, false],
  [275154217, 0.3, 1.3, true],
  [275154210, 1.3, 6, false],
  [275154214, 6, 7, true],
  [275154211, 7, 13, false],
  [275154213, 13, 14, false],
  [422816408, 14, 20, true],
  [275154212, 20, 28, false],
  [275154218, 28, 30, false],
  [275154216, 30, 30, true],
];
function ramp(o, id, lo, hi, covered) {
  const p = points(id),
    lengths = p.slice(1).map((b, i) => Math.hypot(b[0] - p[i][0], b[1] - p[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  let walked = 0;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      len = lengths[i - 1],
      y0 = lo + ((hi - lo) * walked) / total,
      y1 = lo + ((hi - lo) * (walked + len)) / total;
    walked += len;
    const f = edgeFrame(o, a, b),
      w = id === 275154218 ? 1.5 : 1.7;
    face(
      f,
      id === 275154218 ? 'wood' : 'stone',
      [
        [0, y0, w],
        [len, y1, w],
        [len, y1, -w],
        [0, y0, -w],
      ],
      id === 275154218 ? wood : stone,
    );
    for (const side of [-1, 1]) {
      const z = side * w,
        outer = z + side * 0.35;
      const wallHi = covered ? 4.5 : 1.1;
      const q = [
        [0, y0, z],
        [len, y1, z],
        [len, y1 + wallHi, z],
        [0, y0 + wallHi, z],
      ];
      if (side < 0) q.reverse();
      if (o.detail !== 'skyline') face(f, 'sandstone', q, plaster);
      const exterior = [
        [len, [275154213, 275154218].includes(id) ? Math.max(0, y1 - 0.45) : 0, outer],
        [0, [275154213, 275154218].includes(id) ? Math.max(0, y0 - 0.45) : 0, outer],
        [0, y0 + wallHi, outer],
        [len, y1 + wallHi, outer],
      ];
      if (side < 0) exterior.reverse();
      face(f, 'sandstone', exterior, color(plaster, 0.9));
      if (o.detail !== 'skyline')
        face(
          f,
          'carved',
          [
            [0, y0 + wallHi, z],
            [len, y1 + wallHi, z],
            [len, y1 + wallHi, outer],
            [0, y0 + wallHi, outer],
          ],
          trim,
        );
      if (fine(o) && !covered)
        for (let x = 0.4; x < len - 0.3; x += 1.5) {
          const y = y0 + ((y1 - y0) * x) / len;
          box(
            f,
            'carved',
            [x, y + 1.1, Math.min(z, outer)],
            [Math.min(x + 0.65, len), y + 1.7, Math.max(z, outer)],
            trim,
          );
        }
    }
    if (covered)
      face(
        f,
        'stone',
        [
          [0, y0 + 4.5, w + 0.35],
          [len, y1 + 4.5, w + 0.35],
          [len, y1 + 4.5, -w - 0.35],
          [0, y0 + 4.5, -w - 0.35],
        ],
        stone,
      );
    if (fine(o) && id === 275154218)
      for (let x = 0.1; x < len - 0.1; x += 0.22) {
        const y = y0 + ((y1 - y0) * x) / len;
        face(
          f,
          'wood',
          [
            [x, y + 0.015, -w],
            [x + 0.014, y + 0.018, -w],
            [x + 0.014, y + 0.018, w],
            [x, y + 0.015, w],
          ],
          color(wood, 0.72),
        );
      }
  }
}
function bastions(o) {
  const outline = ring(93612350);
  // Clip upper platform at the carriage court: never cap across the stacked entrance ramps.
  const clipped = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      inside = a[0] <= 29;
    if (inside) clipped.push(a);
    if (inside !== b[0] <= 29) {
      const t = (29 - a[0]) / (b[0] - a[0]);
      clipped.push([29, a[1] + t * (b[1] - a[1])]);
    }
  }
  // Continuous structural contact skirt below the mapped upper platform.
  edges(o, clipped, (f, len, i) => {
    const a = clipped[i],
      b = clipped[(i + 1) % clipped.length];
    // Outer decorated wall continues above 17 m; only the new eastern closure reaches 30.
    panel(
      f,
      len,
      0,
      Math.abs(a[0] - 29) < 0.001 && Math.abs(b[0] - 29) < 0.001 ? 30 : 17,
      [],
      'sandstone',
      color(plaster, 0.8),
    );
  });
  cap(o, clipped, 30, 'stone', [0.69, 0.66, 0.57]);
  // Carriage court and gate footing connect to the upper platform without roofing the loops.
  const court = rectangle(28.99, -22, 14.7, 21.4);
  solid(o, court, 0, 30, 'sandstone', color(plaster, 0.85));

  edges(o, outline, (f, len, i) => {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const x = (a[0] + b[0]) / 2;
    if (x > 65) return; // Eagle entry and loop walls supply this end's open enclosure.
    const lo = x > 29 ? 0 : 17,
      hi = x > 29 ? 22 : 30;
    panel(f, len, lo, hi, [], 'sandstone', color(plaster, 0.85));
    if (near(o)) masonry(f, len, lo + 0.2, hi - 0.3, [], i);
    if (o.detail !== 'skyline') box(f, 'carved', [0, hi, -0.6], [len, hi + 0.4, 0.03], trim);
    if (fine(o))
      for (let xx = 0.25; xx < len - 0.6; xx += 2.1)
        box(f, 'sandstone', [xx, hi + 0.4, -0.5], [xx + 0.85, hi + 0.95, 0.03], plaster);
  });
  if (near(o))
    for (const [x, z] of [
      [-52.2, -43.5],
      [-85.2, -9.7],
      [-77, 23],
      [-25.5, 34.6],
      [24, -36.9],
      [40, -41.8],
      [68, -3],
    ])
      turret(o, x, z, x > 29 ? 22 : 30, { r: 0.9, h: 3.3, flat: true });
  if (fine(o)) {
    // Court paving and garden beds are explicit surfaces, not a single solid enclosure.
    for (let x = -53; x < 26; x += 2.2)
      for (let z = -3; z < 9; z += 2.2)
        cap(
          o,
          rectangle(x, z, 2.13, 2.13),
          30.025,
          'stone',
          color([0.72, 0.7, 0.64], 0.95 + ((Math.round(x) + Math.round(z) + 1000) % 5) * 0.012),
        );
    for (const [x, z, w, d] of [
      [1, 17, 15, 8],
      [-12, 23, 8, 3],
    ]) {
      solid(o, rectangle(x, z, w, d), 30, 30.35, 'carved', trim);
      cap(o, rectangle(x + 0.25, z + 0.25, w - 0.5, d - 0.5), 30.36, 'foliage', [0.18, 0.29, 0.11]);
    }
  }
}
export function buildHohenzollernRuntime(out, detail) {
  const o = { ...out, detail };
  bastions(o);
  palace(o);
  chapels(o);
  gate(o, {
    x: 39.6,
    z: -5.7,
    a: Math.PI / 2 - 0.09,
    width: 10.1,
    depth: 6.3,
    lo: 30,
    hi: 44,
    roof: 7.3,
  });
  gate(o, { x: 77.2, z: 9.5, a: -0.85, width: 8.6, depth: 9.5, lo: 0.3, hi: 9.2, roof: 4.2 });
  if (detail !== 'skyline') for (const p of rampParts) ramp(o, ...p);
  else {
    // Low silhouette preserves separated loop terraces and the open entry end.
    for (const id of [275154210, 275154211, 275154212]) {
      const p = rampParts.find((p) => p[0] === id);
      ramp(o, ...p);
    }
    ramp(o, ...rampParts[0]);
  }
  if (near(o)) {
    solid(o, ring(290215702), 30, 35.4);
    gableRoof(o, [39, -18], [39, -11], 5.3, 35.4, 2.4, { hips: 1 });
    solid(o, ring(283738161), 30, 33.3, 'wood', wood);
    gableRoof(o, [-3.8, 14], [-3.8, 23.3], 6.7, 33.3, 2, { hips: 1 });
  }
}
export const buildHohenzollernSkyline = (out) => buildHohenzollernRuntime(out, 'skyline');
export const hohenzollernStudy = {
  id: 'N0252',
  key: 'hohenzollern_castle',
  title: 'Hohenzollern Castle',
  category: 'castle',
  wikidataId: 'Q156457',
  mapFrame: 'map-frame.json',
  build: (out) => buildHohenzollernRuntime(out),
  brief:
    'Mapped horseshoe palace and distinct Kaiser, Markgraf, Bishop, Michael and Watch towers, two separately shaped chapels, bastion ring and multilevel open entrance ramps with gate tunnels.',
  sourceFacts: {
    identity: 'Exact Q156457 on OSM way/93612350; enclosure is not a building footprint',
    mappedEnvelopeMeters: [175.611, 88.98],
    mappedFeatures: 43,
    chapels: 2,
    surveyedVerticalDatum: false,
    referenceState:
      'Normal exterior architecture from the official illustrated plan, Stüler 1854 design elevations and a 2005 courtyard photograph; temporary 2026 restoration scaffolding is excluded.',
  },
  reconstruction: {
    basis:
      'Individual OSM parts constrain the horizontal plan. Official visitor illustration distinguishes bastions and ramp levels. Historical architect elevations and courtyard photography guide unique towers, roofs and facade detail.',
    verticalDatum:
      'Lower Eagle Gate is local Y=0, court is provisionally +30 m from nearby mapped elevation tags (825/855). These are not surveyed connected floor levels. Tower heights and window proportions are reconstructed estimates.',
    state:
      '19th-century neo-Gothic palace, with surviving older St Michael chapel and open fortified entrance.',
  },
  scaleBasis:
    'Map coordinates in meters; native +X east-southeast, 14.565 degrees south of east. Roofs, facade modules, gate widths and vertical levels are interpreted.',
  refs: [
    'https://burg-hohenzollern.com/en/',
    'https://burg-hohenzollern.com/en/about-the-castle/ubersichtsplan-der-burg-kopie',
    'https://burg-hohenzollern.com/en/about-the-castle/castle-history',
    'https://commons.wikimedia.org/wiki/File:Colorierter_Entwurf_-_Schloss_Hohenzollern_-_St%C3%BCler.jpg',
    'https://commons.wikimedia.org/wiki/File:BurgHohenzollernInnenhof02.jpg',
    'https://www.openstreetmap.org/way/93612350',
  ],
  sourceDocuments: ['map-frame.json', 'map-parts.json', 'reference-metadata.json'],
  dataAttribution:
    'Map geometry © OpenStreetMap contributors, ODbL-1.0. Official illustration, public-domain architect drawing and CC-BY-SA courtyard photograph are research references only; no third-party images or meshes bundled.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X east-southeast, 14.565 degrees south of east',
    front: '+X entrance; +Z south-southwest',
    origin: 'Mapped enclosure anchor, provisional lower Eagle Gate height',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'Draft pending vertical datum, compass facing and terrain contact verification',
    notes:
      'The map envelope is a bastion ring. Do not replace the entire enclosure with a solid building or cover the courtyard and ramp openings.',
  }),
  geographicNote:
    'Draft placement; the 30 m relative entrance/court datum and ramp connections need topographic verification.',
  limitations: [
    'Maximum fidelity pending: no as-built measured elevations were available. Palace heights, roof ridges, tower crowns, dormers, window modules and chapel details are architectural reconstructions from references.',
    'The original 1854 elevations are design drawings rather than a current measured survey. The courtyard photograph is from 2005; the model excludes temporary modern scaffolding and does not claim a surveyed 2026 state.',
    'Spiral road centerlines and covered layers are mapped, but ramp gradients, retaining wall thickness, vault shapes and gate clearances are estimated. Supporting skirts are provisional; actual rock contour, grade and terrain contact remain unfinished.',
    'The forested mountain, distant water tower, parking buildings, vegetation/ivy, statuary, museum interiors and inaccessible casemates are outside this exterior asset.',
    'Shared sandstone, raw limestone, limestone, granite, slate, wood and painted metal surfaces carry exterior materials; no embedded photographs. Procedural masonry joints and slate courses are approximations.',
  ],
  camera: { position: [190, 137, 190], lookAt: [-4, 35, 0], fov: 43 },
  qaCameras: [
    { name: 'mapped-court-and-ramp-plan', position: [0, 250, 0.2], lookAt: [0, 25, 0] },
    { name: 'west-towers-and-bastions', position: [-161, 76, -66], lookAt: [-55, 44, -3] },
    { name: 'north-palace-and-kaiserturm', position: [-32, 76, -137], lookAt: [-27, 45, -19] },
    { name: 'south-palace-and-markgraf', position: [-65, 70, 116], lookAt: [-45, 44, 15] },
    { name: 'courtyard-and-two-chapels', position: [27, 46, 2], lookAt: [-38, 42, 0] },
    { name: 'watch-tower-and-court-stair', position: [-24, 42, 8], lookAt: [-56, 43, -1] },
    { name: 'christ-chapel-and-carriage-court', position: [30, 48, -37], lookAt: [5, 40, -13] },
    { name: 'upper-gate-and-drawbridge', position: [77, 47, -20], lookAt: [41, 35, -5] },
    { name: 'spiral-entry-and-eagle-gate', position: [129, 54, 66], lookAt: [63, 15, 16] },
  ],
};
