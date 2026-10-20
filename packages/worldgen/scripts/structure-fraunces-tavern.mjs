/** Fraunces Tavern: restored corner tavern; stair rails from a verified public-domain exterior. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, sphere } from './authored-structure-mesh.mjs';
import { B, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL(
  '../../../content/worldgen/source/places/dr/dr5/fraunces_tavern/',
  import.meta.url,
);
const ref = 'palette:#ffffff',
  red = rgb('9d6551'),
  buff = rgb('b6aa75'),
  cream = rgb('d2c49a'),
  stone = rgb('c9c5b5'),
  iron = rgb('343c3b'),
  glass = rgb('617275'),
  tile = rgb('805d50'),
  blue = rgb('344955'),
  concrete = red;
function facing(o, a, x = 0, z = 0) {
  const co = Math.cos(a),
    si = Math.sin(a),
    v = (p) => [co * p[0] + si * p[2], p[1], -si * p[0] + co * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, uv, c) => o.addTriangle(s, r, p.map(q), v(n), uv, c),
    addQuad: (s, r, p, n, uv, c) => o.addQuad(s, r, p.map(q), v(n), uv, c),
    addConvexPolygon: (s, r, p, n, uv, c) => {
      const pp = p.map(q),
        u = p.map(uv);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => u[pp.indexOf(p)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function prism(o, loops, low, high, color = concrete, slot = 'wall') {
  const rings = loops.map((r, i) => {
    r = cleanRing(r);
    if (r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop();
    const a = r.reduce(
      (s, p, j) => s + p[0] * r[(j + 1) % r.length][1] - r[(j + 1) % r.length][0] * p[1],
      0,
    );
    if (a > 0 !== (i === 0)) r.reverse();
    return r;
  });
  const pts = rings.flat(),
    holes = [];
  let count = 0;
  for (let i = 0; i < rings.length; i++) {
    if (i) holes.push(count);
    count += rings[i].length;
  }
  const indices = earcut(pts.flat(), holes);
  for (const [y, n] of [
    [low, [0, -1, 0]],
    [high, [0, 1, 0]],
  ])
    for (let i = 0; i < indices.length; i += 3) {
      const p = indices.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]);
      o.addTriangle(
        slot,
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        color,
      );
    }
  for (const r of rings)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      quad(
        o,
        slot,
        [
          [a[0], low, a[1]],
          [b[0], low, b[1]],
          [b[0], high, b[1]],
          [a[0], high, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
        color,
      );
    }
}
function line(o, slot, a, b, w, color) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    ox = ((-dy / len) * w) / 2,
    oy = ((dx / len) * w) / 2;
  quad(
    o,
    slot,
    [
      [a[0] + ox, a[1] + oy, a[2]],
      [b[0] + ox, b[1] + oy, b[2]],
      [b[0] - ox, b[1] - oy, b[2]],
      [a[0] - ox, a[1] - oy, a[2]],
    ],
    [0, 0, 1],
    color,
  );
}
function upNormal(p) {
  const n = normalFor(...p);
  return n[1] < 0 ? n.map((v) => -v) : n;
}
function cyl(o, slot, x, z, profile, n, color) {
  const rings = profile.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => [
      x + Math.sin((i * 2 * Math.PI) / n) * r,
      y,
      z + Math.cos((i * 2 * Math.PI) / n) * r,
    ]),
  );
  loft(o, slot, rings, color);
}
function facade(o, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  return {
    o: facing(o, Math.atan2(dz, -dx), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2),
    w: Math.hypot(dx, dz),
  };
}
function sash(o, x, y, z, w, h, d, { lintel = true } = {}) {
  face(o, 'glass', x, y, z, w, h, glass);
  if (d < 1) return;
  if (d > 1) {
    for (const xx of [-w / 2 - 0.04, w / 2 + 0.04])
      B(o, 'wood', x + xx, y - 0.06, z, 0.12, h + 0.13, 0.15, cream);
    for (const yy of [y - 0.06, y + h]) B(o, 'wood', x, yy, z, w + 0.18, 0.12, 0.15, cream);
  } else {
    for (const xx of [-w / 2, w / 2]) face(o, 'wood', x + xx, y, z + 0.03, 0.08, h, cream);
    for (const yy of [y, y + h]) face(o, 'wood', x, yy, z + 0.03, w, 0.08, cream);
  }
  const cols = d > 1 ? 4 : 2,
    rows = d > 1 ? 6 : 2;
  for (let i = 1; i < cols; i++)
    face(o, 'wood', x - w / 2 + (i * w) / cols, y, z + 0.09, 0.035, h, cream);
  for (let i = 1; i < rows; i++)
    face(o, 'wood', x, y + (i * h) / rows, z + 0.095, w, i === 3 ? 0.065 : 0.035, cream);
  if (d > 1) B(o, 'stone', x, y - 0.15, z + 0.08, w + 0.28, 0.13, 0.28, stone);
  if (lintel) {
    const yy = y + h + 0.1;
    quad(
      o,
      'brick',
      [
        [x - w / 2 - 0.12, yy, z + 0.025],
        [x + w / 2 + 0.12, yy, z + 0.025],
        [x + w / 2 + 0.33, yy + 0.3, z + 0.025],
        [x - w / 2 - 0.33, yy + 0.3, z + 0.025],
      ],
      [0, 0, 1],
      red,
    );
    if (d > 2)
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        line(
          o,
          'stone',
          [x - w / 2 - 0.12 + t * (w + 0.24), yy, z + 0.03],
          [x - w / 2 - 0.33 + t * (w + 0.66), yy + 0.3, z + 0.03],
          0.012,
          stone,
        );
      }
  }
}
function cornice(o, w, d) {
  B(o, 'wood', 0, 10.15, 0.12, w + 0.3, 0.58, 0.4, cream);
  B(o, 'wood', 0, 10.72, 0.15, w + 0.5, 0.15, 0.65, cream);
  B(o, 'wood', 0, 10.9, 0.2, w + 0.65, 0.15, 0.85, cream);
  if (d < 2) return;
  const n = Math.round(w / 1.25);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / n;
    B(o, 'wood', x, 10.24, 0.36, 0.52, 0.36, 0.08, cream);
    if (d > 2) {
      face(o, 'wood', x, 10.31, 0.408, 0.34, 0.23, rgb('b5a883'));
      for (const xx of [-0.14, 0, 0.14]) face(o, 'wood', x + xx, 10.31, 0.418, 0.028, 0.23, cream);
    }
  }
  if (d > 2)
    for (let x = -w / 2 + 0.1; x < w / 2; x += 0.16)
      B(o, 'wood', x, 10.65, 0.4, 0.075, 0.09, 0.13, cream);
}
function rail(o, w, y, d) {
  B(o, 'wood', 0, y, 0.0, w, 0.12, 0.19, cream);
  B(o, 'wood', 0, y + 0.83, 0, w + 0.06, 0.14, 0.23, cream);
  const spacing = d > 1 ? 0.34 : 0.65,
    n = Math.max(1, Math.round(w / spacing));
  if (d === 0) {
    for (const x of [-w / 2, w / 2]) B(o, 'wood', x, y, 0, 0.18, 0.9, 0.18, cream);
    return;
  }
  for (let i = 1; i < n; i++) {
    const x = -w / 2 + (i * w) / n;
    if (d === 1) {
      face(o, 'wood', x, y + 0.12, 0, 0.085, 0.7, cream);
      continue;
    }
    const profile =
      d === 2
        ? [
            [y + 0.13, 0.04],
            [y + 0.36, 0.09],
            [y + 0.62, 0.045],
            [y + 0.83, 0.04],
          ]
        : [
            [y + 0.13, 0.045],
            [y + 0.25, 0.05],
            [y + 0.37, 0.09],
            [y + 0.46, 0.08],
            [y + 0.57, 0.045],
            [y + 0.69, 0.035],
            [y + 0.83, 0.05],
          ];
    cyl(o, 'wood', x, 0, profile, d === 2 ? 4 : 6, cream);
  }
}
function dormer(o, x, d) {
  const p = [
    [x - 0.7, 11.85, -0.68],
    [x + 0.7, 11.85, -0.68],
    [x + 0.95, 13.35, -0.68],
    [x - 0.95, 13.35, -0.68],
  ];
  quad(o, 'wood', p, [0, 0, 1], cream);
  for (const sg of [-1, 1]) {
    const pts = [
      [x + sg * 0.7, 11.85, -0.68],
      [x + sg * 0.95, 13.7, -2.15],
      [x + sg * 0.95, 13.35, -0.68],
    ];
    let n = normalFor(...pts);
    if (n[0] * sg < 0) n = n.map((v) => -v);
    o.addTriangle(
      'wood',
      ref,
      pts,
      n,
      pts.map((p) => [p[2], p[1]]),
      cream,
    );
  }
  const rp = [
    [x - 1.02, 13.4, -0.57],
    [x + 1.02, 13.4, -0.57],
    [x + 0.95, 13.78, -2.25],
    [x - 0.95, 13.78, -2.25],
  ];
  quad(o, 'roof', rp, upNormal(rp), tile);
  if (d > 0) sash(o, x, 12.08, -0.64, 0.92, 0.99, d, { lintel: false });
}
function stairHandrails(o, d) {
  if (d === 0) return;
  const railY = (z) => 0.95 + ((2.2 - z) * 0.87) / 0.97,
    posts = [
      [2.11, 0.2],
      [1.83, 0.4],
      [1.55, 0.6],
      [1.39, 0.8],
      [1.23, 0.97],
      [0.7, 0.97],
    ];
  for (const x of [-1.43, 1.43]) {
    // Photograph resolves a slim descending rail and a level return beside the landing.
    // Heights, bar sections and concealed joints remain fixed photographic estimates.
    beam(o, 'metal', [x, 0.95, 2.2], [x, 1.82, 1.23], 0.045, 0.045, iron);
    beam(o, 'metal', [x, 1.82, 1.23], [x, 1.82, 0.65], 0.045, 0.045, iron);
    for (const [i, [z, baseY]] of posts.entries()) {
      if (d === 1 && ![0, 4, 5].includes(i)) continue;
      const top = z > 1.23 ? railY(z) : 1.82;
      B(o, 'metal', x, baseY - 0.01, z, 0.035, top - baseY + 0.01, 0.035, iron);
    }
  }
}
function porch(o, d) {
  for (let i = 0; i < 4; i++)
    B(o, 'stone', 0, i * 0.2, 1.25 - i * 0.14, 3.1, 0.2, 2.0 - i * 0.28, stone);
  B(o, 'stone', 0, 0.8, 0.5, 3.05, 0.17, 1.75, stone);
  stairHandrails(o, d);
  B(o, 'wood', 0, 3.42, 0.62, 3.65, 0.18, 1.95, cream);
  B(o, 'wood', 0, 3.6, 0.67, 3.85, 0.24, 2.05, cream);
  B(o, 'stone', 0, 3.84, 0.67, 3.92, 0.13, 2.12, stone);
  for (const x of [-1.25, -0.87, 0.87, 1.25]) {
    if (d === 0) {
      B(o, 'wood', x, 0.97, 1.22, 0.2, 2.45, 0.2, cream);
      continue;
    }
    cyl(
      o,
      'wood',
      x,
      1.22,
      [
        [0.97, 0.14],
        [1.12, 0.14],
        [1.18, 0.105],
        [3.18, 0.095],
        [3.26, 0.15],
        [3.42, 0.15],
      ],
      d > 1 ? 10 : 5,
      cream,
    );
  }
  if (d > 0) {
    // Open iron balcony above the columned portico.
    for (const yy of [4.05, 4.79]) B(o, 'metal', 0, yy, 1.7, 3.7, 0.055, 0.06, iron);
    for (let x = -1.75; x <= 1.76; x += 0.21) B(o, 'metal', x, 4.05, 1.7, 0.035, 0.74, 0.035, iron);
    for (const x of [-1.78, 1.78]) {
      B(o, 'metal', x, 4.05, 0.7, 0.07, 0.055, 2, iron);
      B(o, 'metal', x, 4.79, 0.7, 0.07, 0.06, 2, iron);
      for (let z = -0.25; z <= 1.7; z += 0.21) B(o, 'metal', x, 4.05, z, 0.035, 0.74, 0.035, iron);
    }
    // Recessed double entrance with fanlight and original geometric leaded panes.
    face(o, 'wood', 0, 0.98, 0.04, 1.65, 2.37, iron);
    for (const x of [-0.43, 0.43]) sash(o, x, 1.23, 0.075, 0.68, 1.8, d, { lintel: false });
    const pts = [
      [-0.85, 2.75, 0.08],
      [0.85, 2.75, 0.08],
    ];
    for (let i = 1; i < 12; i++) {
      const a = (i * Math.PI) / 12;
      pts.push([Math.cos(a) * 0.85, 2.75 + Math.sin(a) * 0.53, 0.08]);
    }
    o.addConvexPolygon('glass', ref, pts, [0, 0, 1], (p) => [p[0], p[1]], glass);
    if (d > 1)
      for (let i = 1; i < 6; i++) {
        const a = (i * Math.PI) / 6;
        line(
          o,
          'wood',
          [0, 2.75, 0.1],
          [Math.cos(a) * 0.85, 2.75 + Math.sin(a) * 0.53, 0.1],
          0.035,
          cream,
        );
      }
  }
}
function sign(o, d) {
  B(o, 'metal', 0, 4.55, 0.45, 1.12, 1.65, 0.09, blue);
  if (d < 2) return;
  for (const x of [-0.54, 0.54]) B(o, 'metal', x, 4.55, 0.51, 0.045, 1.65, 0.04, cream);
  for (const y of [4.57, 6.15]) B(o, 'metal', 0, y, 0.51, 1.08, 0.045, 0.04, cream);
  // Sign silhouette and scroll supports only; portrait painting and lettering are not reproduced.
  for (const sg of [-1, 1]) {
    beam(
      o,
      'metal',
      [-0.65, 5.35 + sg * 1.55, 0.4],
      [0.5, 5.35 + sg * 0.92, 0.4],
      0.04,
      0.05,
      iron,
    );
    for (let i = 0; i < 18; i++) {
      const a = (i * Math.PI * 3) / 18,
        b = ((i + 1) * Math.PI * 3) / 18,
        r = 0.15 * (1 - i / 24),
        rr = 0.15 * (1 - (i + 1) / 24);
      line(
        o,
        'metal',
        [-0.62 + Math.cos(a) * r, 5.35 + sg * 1.55 + Math.sin(a) * r, 0.45],
        [-0.62 + Math.cos(b) * rr, 5.35 + sg * 1.55 + Math.sin(b) * rr, 0.45],
        0.03,
        iron,
      );
    }
  }
}
export function tavern(o, frame, d = 3) {
  frame ??= JSON.parse(fs.readFileSync(new URL('map-frame.json', base)));
  const r = cleanRing(frame.geometry.outline),
    upper = r.map((p) => p.map((v) => v * 0.64));
  prism(o, [r], 0.92, 10.15, red, 'brick');
  prism(o, [r], -0.6, 0.92, buff, 'brick');
  // The west/Broad Street facade is buff Dutch brick; the Pearl Street face remains red.
  const west = facade(o, r[1], r[2]);
  face(west.o, 'brick', 0, -0.6, 0.012, west.w, 10.75, buff);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      f = facade(o, a, b);
    cornice(f.o, f.w, d);
    const rp = [
      [a[0] * 1.04, 11.05, a[1] * 1.04],
      [b[0] * 1.04, 11.05, b[1] * 1.04],
      [upper[(i + 1) % r.length][0], 13.6, upper[(i + 1) % r.length][1]],
      [upper[i][0], 13.6, upper[i][1]],
    ];
    quad(o, 'roof', rp, upNormal(rp), tile);
    const top = facade(o, upper[i], upper[(i + 1) % r.length]);
    rail(top.o, top.w, 13.67, d);
    if (d > 0) {
      // Two dormers per roof side are explicitly described by the city designation report.
      for (const x of [-f.w * 0.23, f.w * 0.23]) dormer(f.o, x, d);
      if (i === 1 || i === 2) {
        const step = f.w / 6;
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < 5; col++) {
            const x = -f.w / 2 + step * (col + 1),
              y = 1.2 + row * 3.0;
            if (i === 2 && row === 0 && col === 2) continue;
            sash(f.o, x, y, 0.04, i === 1 ? 1.25 : 1.38, 2.12, d);
          }
        B(f.o, 'stone', 0, 3.92, 0.12, f.w + 0.15, 0.18, 0.24, stone);
        if (d > 1)
          for (let col = 0; col < 4; col++) {
            const x = -f.w / 2 + (f.w * (col + 0.6)) / 4;
            face(f.o, 'glass', x, 0.1, 0.04, 1.15, 0.58, iron);
          }
      }
      // Two plain contact walls adjoin separate museum properties. No invented shop fronts.
      if (i === 0 || i === 3)
        for (const x of [-f.w * 0.25, f.w * 0.25]) sash(f.o, x, 7.3, 0.04, 1.1, 1.95, d);
    }
  }
  prism(o, [upper], 13.58, 13.67, tile, 'roof');
  for (const [x, z] of upper) {
    B(o, 'wood', x, 13.64, z, 0.2, 1.03, 0.2, cream);
    if (d > 1) sphere(o, 'wood', [x, 14.82, z], [0.14, 0.14, 0.14], cream, 8, 5);
  }
  // A front-left shaft and paired rear-right shafts preserve the photographed chimney grouping.
  for (const [x, z, w, h] of [
    [4.4, 3.9, 1.1, 17.4],
    [-4.6, -3, 1.0, 16.7],
    [-6.1, -3, 0.9, 16.5],
  ]) {
    B(o, 'brick', x, 11, z, w, h - 11, 1.1, red);
    B(o, 'stone', x, h, z, w + 0.18, 0.13, 1.3, stone);
    if (d > 1) B(o, 'brick', x, h + 0.13, z, 0.25, 0.35, 0.25, red);
  }
  const front = facade(o, r[2], r[3]);
  porch(front.o, d);
  if (d > 0) {
    // Corner sign projects beyond both facades; no photo artwork is embedded.
    sign(facing(o, Math.PI / 4, 7.95, 6.1), d);
    for (const [f, x] of [
      [front, -4.5],
      [front, 4.5],
      [west, -2.7],
      [west, 2.7],
    ])
      beam(f.o, 'metal', [x, 10.65, 0.25], [x, 13.4, 2.6], 0.055, 0.055, stone);
  }
  if (d > 2) {
    for (const f of [front, west])
      for (const x of [-f.w / 2 + 0.08, f.w / 2 - 0.08])
        B(f.o, 'metal', x, 0, 0.1, 0.08, 10.7, 0.08, iron);
    const t = front.o;
    B(t, 'metal', -2.1, 1.8, 0.04, 0.6, 0.75, 0.06, iron);
    B(t, 'metal', 2.2, 1.2, 0.04, 0.32, 0.22, 0.06, iron);
  }
}
export function frauncesSkyline(o) {
  tavern(o, undefined, 0);
}
export function frauncesDistrict(o) {
  tavern(o, undefined, 1);
}
export function frauncesStreet(o) {
  tavern(o, undefined, 2);
}
const surfaces = {
  brick: { ...landmarkSurfaces.brick, graph: 'brick' },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  stone: { ...landmarkSurfaces.stone },
  roof: { ...landmarkSurfaces.roof, graph: 'tile_flat' },
  metal: { ...landmarkSurfaces.metal },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const frauncesModel = {
  id: 'fraunces_tavern',
  recipe: 'structure-fraunces-tavern.mjs',
  key: 'fraunces_tavern',
  cell: 'dr/dr5',
  title: 'Fraunces Tavern',
  brief:
    'Restored three-story corner tavern with red Pearl Street and buff Broad Street brick, twelve-over-twelve sash, columned entry, paneled cornice, attic dormers, truncated roof platform and balustrade.',
  camera: [31, 23, 35],
  lookAt: [0, 7.2, 0],
  qaCameras: [
    { name: 'front', position: [14, 10, 40], lookAt: [0, 7, 0] },
    { name: 'back', position: [-28, 23, -31], lookAt: [0, 7, 0] },
    { name: 'entrance-rails', position: [-17.36, 4.5, 3.31], lookAt: [-9.84, 1.25, -0.35] },
    { name: 'stair-profile', position: [-12.92, 2.5, -3.99], lookAt: [-10.14, 1.1, -0.41] },
  ],
  build: tavern,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Pearl Street sidewalk [-1.1145,7.5] outside central columned entrance; independent terrain unchanged.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-fraunces-tavern.mjs',
    level: 'skyline',
    export: 'frauncesSkyline',
    errorMeters: 0.45,
    surfaces,
    authoredLevels: {
      district: { export: 'frauncesDistrict', errorMeters: 0.2, surfaces },
      street: { export: 'frauncesStreet', errorMeters: 0.08, surfaces },
    },
  },
  limitations: [
    'Current exterior/entrance construction uses an individually inspected native Jim Henderson 2008 own-work public-domain exterior, after checking cleared Qualla images first. Earlier attribution-licensed photos are excluded as current controls; official factual city architectural descriptions retained. Not a survey or exact 1783 reconstruction.',
    '101 Broad Street, 58 Pearl Street, other museum buildings, interiors and the narrow mapped rear connector are excluded. Scope clipping is an explicit authoring boundary.',
    'Mapped 14.6 m height is only an approximate roof/balustrade control; chimneys rise above it. Vertical dimensions, hidden roof surfaces and service-side windows remain interpretations.',
    'Twelve-over-twelve sash, jack arches, paneled cornice and roof balusters are simplified geometry. The standard shared brick surface approximates the photographed Flemish bond without the pronounced repeat seam of the current Flemish graph. Sign portrait and lettering, flags, interior details and photograph pixels are not reproduced.',
    'Independent terrain remains unchanged with foundation below the sidewalk datum. Exact contact can differ with another host DEM.',
    'Added actual slim stair handrails, vertical posts and level landing returns. Original steps retained. Rail heights, sections, post spacing, concealed connections and current condition remain fixed photographic estimates; the 2008 image does not measure later alterations.',
  ],
};
