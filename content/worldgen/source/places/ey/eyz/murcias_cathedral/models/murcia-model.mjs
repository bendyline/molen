import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const murciaSurfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.83 },
  carved: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.78 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.78 },
  glaze: { slot: 'roof', graph: 'tile_glazed', roughness: 0.57 },
  pane: { slot: 'trim', graph: 'metal_painted', roughness: 0.53 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.68 },
  cast: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.58, metallic: 0.64 },
};
const palette = {
  wall: 'cbb495',
  pale: 'e1c9a8',
  sand: 'd5ba95',
  stone: 'b79d80',
  shadow: 'a78f76',
  bright: 'e7d0ad',
  ochre: 'b89a73',
  tile: '976854',
  clay: 'a8735c',
  blue: '4a6377',
  blueEdge: '6d8190',
  dark: '45423c',
  glass: '465357',
  wood: '54463c',
  grain: '726055',
  bronze: '78664f',
  iron: '494746',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([k, hex]) => [
    k,
    hex.match(/../g).map((pair) => {
      const v = Number.parseInt(pair, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const detailByLevel = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  west = [-1, 0, 0],
  tau = 2 * Math.PI;
const at = ([x, z], y) => [x, y, z];
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
function face(out, slot, tint, ps, towards) {
  let n = normalFor(...ps);
  if (dot(n, towards) < 0) {
    ps = ps.toReversed();
    n = normalFor(...ps);
  }
  if (ps.length === 3) out.addTriangle(slot, ref, ps, n, undefined, colors[tint]);
  else if (ps.length === 4) out.addQuad(slot, ref, ps, n, undefined, colors[tint]);
  else out.addConvexPolygon(slot, ref, ps, n, (p) => [p[0], p[1]], colors[tint]);
}
function rect(out, slot, tint, x, z, rows, angle = 0, cap = true) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const points = rows.map(([y, w, d]) =>
    [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ].map(([u, v]) => [
      x + c * u * w * 0.5 - s * v * d * 0.5,
      y,
      z + s * u * w * 0.5 + c * v * d * 0.5,
    ]),
  );
  loft(out, slot, points, colors[tint], { cap });
}
function lathe(out, slot, tint, x, z, rows, sides, cap = true) {
  loft(
    out,
    slot,
    rows.map(([y, r]) => radialRing(y, r, r, sides, [x, z])),
    colors[tint],
    { cap },
  );
}
function panelPlane(x, z, n) {
  return (u, y, d = 0) => [x - n[2] * u + n[0] * d, y, z + n[0] * u + n[2] * d];
}
function panel(out, p, n, slot, tint, u0, u1, y0, y1, d) {
  face(out, slot, tint, [p(u0, y0, d), p(u1, y0, d), p(u1, y1, d), p(u0, y1, d)], n);
}
function strip(out, p, n, u0, u1, y, h, d, tint = 'pale') {
  panel(out, p, n, 'carved', tint, u0, u1, y, y + h, d);
  face(
    out,
    'carved',
    tint,
    [p(u0, y + h, -0.16), p(u1, y + h, -0.16), p(u1, y + h, d), p(u0, y + h, d)],
    up,
  );
}
function path(out, slot, tint, p, points, w, depth, d = 0) {
  beamPath(
    out,
    slot,
    points.map(([u, y]) => p(u, y, d)),
    w,
    depth,
    colors[tint],
  );
}
function arch(w, low, top, rise, n, pointed) {
  const r = w / 2;
  return [
    [-r, low],
    [r, low],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const theta = (i * Math.PI) / n,
        x = Math.cos(theta) * r;
      return [
        x,
        top - rise + rise * (pointed ? Math.pow(1 - Math.abs(x) / r, 0.79) : Math.sin(theta)),
      ];
    }),
  ];
}
function archPanel(
  out,
  p,
  n,
  { w, low, top, rise, detail, door = false, pointed = false, blind = false },
) {
  const tint = door ? 'wood' : blind ? 'shadow' : 'glass',
    slot = door ? 'timber' : blind ? 'carved' : 'pane';
  if (detail === 0) {
    panel(out, p, n, slot, tint, -w / 2, w / 2, low, top, 0.042);
    return;
  }
  const pts = arch(w, low, top, rise, detail >= 3 ? 10 : 6, pointed);
  face(
    out,
    slot,
    tint,
    pts.map(([u, y]) => p(u, y, 0.05)),
    n,
  );
  if (detail === 1) return;
  const frame = pts.slice(1).concat([pts[0]]);
  if (detail >= 3) path(out, 'carved', 'pale', p, frame, 0.14, 0.11, 0.095);
  else {
    const outer = frame.map(([u, y]) => [u * 1.11, y + 0.11]);
    for (let i = 0; i < frame.length - 1; i++)
      face(
        out,
        'carved',
        'sand',
        [frame[i], frame[i + 1], outer[i + 1], outer[i]].map(([u, y]) => p(u, y, 0.091)),
        n,
      );
  }
  strip(out, p, n, -w * 0.56, w * 0.56, low - 0.12, 0.13, 0.14, 'pale');
  if (blind) return;
  panel(
    out,
    p,
    n,
    door ? 'timber' : 'carved',
    door ? 'grain' : 'sand',
    -0.043,
    0.043,
    low + 0.08,
    top - 0.11,
    0.084,
  );
  if (detail >= 3)
    for (const v of [low + (top - low) * 0.43, low + (top - low) * 0.69]) {
      panel(
        out,
        p,
        n,
        door ? 'timber' : 'carved',
        door ? 'grain' : 'sand',
        -w * 0.447,
        w * 0.447,
        v,
        v + 0.055,
        0.085,
      );
    }
}
function shell(out, detail) {
  for (const { regions, base, top, roof, name } of layout.forms) {
    for (const { rings, vertices, triangles, bottom } of regions) {
      for (const [j, ring] of rings.entries())
        for (const [i, a] of ring.entries()) {
          const k = (i + 1) % ring.length,
            b = ring[k],
            length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (length < 0.018) continue;
          face(
            out,
            'wall',
            name === 'tower' ? 'sand' : 'wall',
            [at(a, base ?? bottom[j][i]), at(b, base ?? bottom[j][k]), at(b, top), at(a, top)],
            [b[1] - a[1], 0, a[0] - b[0]],
          );
        }
      if (roof)
        for (const tri of triangles) {
          const points = tri.map((i) => at(vertices[i], top));
          if (Math.hypot(...normalFor(...points)) > 0)
            face(
              out,
              name === 'chapel' ? 'carved' : 'roof',
              name === 'chapel' ? 'stone' : 'tile',
              points,
              up,
            );
        }
    }
  }
  const edges = new Map();
  for (const { vertices, triangles, base } of layout.roofs)
    for (const tri of triangles) {
      const [a, b, c] = tri.map((i) => vertices[i]);
      if (!Math.hypot(...normalFor(a, b, c))) continue;
      face(out, 'roof', 'clay', [a, b, c], up);
      if (detail >= 1)
        for (const [u, v] of [
          [a, b],
          [b, c],
          [c, a],
        ]) {
          const key = [u.join(','), v.join(',')].sort().join(':');
          if (edges.has(key)) edges.delete(key);
          else edges.set(key, { u, v, base });
        }
    }
  for (const { u, v, base } of edges.values()) {
    if (Math.max(u[1], v[1]) - base < 0.02) continue;
    face(
      out,
      'wall',
      'sand',
      [[u[0], base - 0.02, u[2]], [v[0], base - 0.02, v[2]], v, u],
      [v[2] - u[2], 0, u[0] - v[0]],
    );
  }
}
function courseWindows(out, detail) {
  for (const w of layout.walls) {
    if (detail === 0 && w.name !== 'clerestory') continue;
    const { a, b, n, p, length, top, count, name } = w,
      center = panelPlane(...p, n);
    if (detail >= 1)
      strip(out, center, n, -length * 0.5, length * 0.5, top - 0.43, 0.19, 0.132, 'sand');
    for (let i = 0; i < count; i++) {
      if (detail === 0 && i % 2) continue;
      const t = (i + 0.5) / count,
        [x, z] = a.map((u, j) => u + (b[j] - u) * t);
      const low = name === 'clerestory' ? 22.65 : name === 'middle' ? 17.92 : 6.5;
      const high = name === 'clerestory' ? 26.17 : name === 'middle' ? 20.16 : 12.65;
      archPanel(out, panelPlane(x, z, n), n, {
        w: Math.min(2.42, (length / count) * 0.4),
        low,
        top: high,
        rise: Math.min(1.2, (high - low) * 0.31),
        detail: detail === 1 && name === 'body' ? 0 : detail === 2 ? 1 : detail,
        pointed: name === 'body',
      });
      if (detail >= 2 && name === 'body' && i > 0 && length > 9) {
        const f = (u, y, d) => center(u + (i / count - 0.5) * length, y, d);
        panel(out, f, n, 'carved', 'sand', -0.4, 0.4, 1.22, top - 0.38, 0.19);
      }
    }
  }
}
function columns(out, p, u, y0, y1, r, detail) {
  const [x, , z] = p(u, 0, 0);
  const rows =
    detail === 0
      ? [
          [y0, r * 1.32],
          [y1, r * 0.94],
        ]
      : detail === 1
        ? [
            [y0, r * 1.42],
            [y0 + 0.64, r * 1.34],
            [y0 + 1.15, r],
            [y1 - 1.1, r * 0.84],
            [y1, r * 1.48],
          ]
        : [
            [y0, r * 1.49],
            [y0 + 0.26, r * 1.49],
            [y0 + 0.51, r * 1.27],
            [y0 + 0.89, r * 1.08],
            [y0 + 1.27, r],
            [y1 - 1.15, r * 0.84],
            [y1 - 0.78, r * 1.06],
            [y1 - 0.48, r * 1.17],
            [y1 - 0.27, r * 1.45],
            [y1, r * 1.48],
          ];
  const sides = [6, 9, 12, 18, 22][detail];
  lathe(out, 'carved', 'pale', x, z, rows, sides, false);
  if (detail >= 3) {
    for (let i = 0; i < (detail === 3 ? 6 : 8); i++) {
      const a = (tau * i) / (detail === 3 ? 6 : 8),
        dx = Math.cos(a),
        dz = Math.sin(a);
      beamPath(
        out,
        'carved',
        [
          [x + dx * r * 0.91, y1 - 1.25, z + dz * r * 0.91],
          [x + dx * r * 1.15, y1 - 0.72, z + dz * r * 1.15],
          [x + dx * r * 1.33, y1 - 0.43, z + dz * r * 1.33],
        ],
        r * 0.16,
        r * 0.145,
        colors.bright,
      );
    }
  }
}
function statue(out, p, u, base, h, detail, pose = 0) {
  const [x, , z] = p(u, 0, 0),
    n = detail >= 3 ? 10 : 6;
  const robe = [
    [base + h * 0.08, h * 0.172],
    [base + h * 0.26, h * 0.188],
    [base + h * 0.47, h * 0.149],
    [base + h * 0.61, h * 0.115],
    [base + h * 0.73, h * 0.146],
    [base + h * 0.8, h * 0.09],
  ];
  lathe(
    out,
    'carved',
    'sand',
    x,
    z,
    detail >= 3 ? robe : robe.filter((_, i) => i % 2 === 0 || i === 5),
    n,
    true,
  );
  sphere(
    out,
    'carved',
    p(u, base + h * 0.887, 0.013),
    [h * 0.098, h * 0.108, h * 0.095],
    colors.pale,
    detail >= 3 ? 9 : 6,
    detail >= 3 ? 6 : 4,
  );
  if (detail >= 3) {
    for (const side of [-1, 1]) {
      const outer = side * h * (pose === side ? 0.267 : 0.182);
      beamPath(
        out,
        'carved',
        [
          p(u + side * h * 0.1, base + h * 0.716, 0.03),
          p(u + outer, base + h * 0.565, 0.06),
          p(u + side * h * 0.115, base + h * 0.46, 0.11),
        ],
        h * 0.099,
        h * 0.08,
        colors.pale,
      );
    }
    for (const s of [-1, 1]) {
      beamPath(
        out,
        'carved',
        [
          p(u + s * h * 0.06, base + h * 0.55, h * 0.119),
          p(u + s * h * 0.1, base + h * 0.23, h * 0.174),
          p(u + s * h * 0.105, base + h * 0.11, h * 0.169),
        ],
        h * 0.027,
        h * 0.026,
        colors.pale,
      );
    }
  }
}
function emblem(out, p, n, u, y, r, detail, d = 0.26) {
  const steps = detail >= 3 ? 15 : 9;
  const points = Array.from({ length: steps }, (_, i) => {
    const a = (tau * i) / steps;
    return [u + r * Math.cos(a), y + r * 0.86 * Math.sin(a)];
  });
  face(
    out,
    'carved',
    'stone',
    points.map(([u, y]) => p(u, y, d)),
    n,
  );
  path(out, 'carved', 'pale', p, points.concat([points[0]]), r * 0.125, r * 0.1, d + 0.047);
  if (detail >= 3) {
    const shield = [
      [u - r * 0.49, y + r * 0.35],
      [u + r * 0.49, y + r * 0.35],
      [u + r * 0.36, y - r * 0.25],
      [u, y - r * 0.53],
      [u - r * 0.36, y - r * 0.25],
    ];
    face(
      out,
      'carved',
      'pale',
      shield.map(([u, y]) => p(u, y, d + 0.115)),
      n,
    );
    for (const s of [-1, 1])
      path(
        out,
        'carved',
        'sand',
        p,
        [
          [u + s * r * 0.57, y - r * 0.21],
          [u + s * r * 0.77, y + r * 0.19],
          [u + s * r * 0.56, y + r * 0.43],
        ],
        r * 0.098,
        r * 0.092,
        d + 0.14,
      );
  }
}
const f = layout.front;
function westX(z) {
  const i = Math.max(0, Math.min(f.samples.length - 2, Math.floor(z - f.samples[0][0])));
  const [u, a] = f.samples[i],
    [v, b] = f.samples[i + 1];
  return a + ((b - a) * (z - u)) / (v - u);
}
const front = (u, y, d = 0) => [westX(f.center + u) - d, y, f.center + u];
const shifted =
  (p, u, o = 0) =>
  (x, y, d = 0) =>
    p(u + x, y, o + d);
function frontWall(out, pieces, y0, y1, d = 0, back = -2.38, tint = 'sand') {
  for (let i = 0; i < pieces.length - 1; i++) {
    const a = pieces[i],
      b = pieces[i + 1];
    panel(out, front, west, 'carved', tint, a, b, y0, y1, d);
    panel(out, front, [1, 0, 0], 'wall', 'stone', a, b, y0, y1, back);
    face(
      out,
      'carved',
      'pale',
      [front(a, y1, d), front(b, y1, d), front(b, y1, back), front(a, y1, back)],
      up,
    );
  }
  for (const [u, n] of [
    [pieces[0], [0, 0, -1]],
    [pieces.at(-1), [0, 0, 1]],
  ]) {
    face(
      out,
      'carved',
      'stone',
      [front(u, y0, d), front(u, y1, d), front(u, y1, back), front(u, y0, back)],
      n,
    );
  }
}
function facadeNiche(out, detail) {
  const n = [4, 10, 14, 22, 28][detail],
    r = f.archW * 0.5,
    h = f.archH,
    lip = 0.51;
  const angle = Array.from({ length: n + 1 }, (_, i) => (Math.PI * i) / n);
  const edge = angle.map((a) => [r * Math.cos(a), f.yOpening + h * Math.sin(a)]);
  const crest = (u) => f.yTop - 0.019 * u * u;
  // Shell strips close the upper screen behind the half-dome without flattening its recess.
  for (let i = 0; i < n; i++) {
    const [u, y] = edge[i],
      [v, z] = edge[i + 1],
      a = crest(u),
      b = crest(v);
    face(
      out,
      'carved',
      'pale',
      [front(u, y, lip), front(v, z, lip), front(v, b, 0.37), front(u, a, 0.37)],
      west,
    );
    face(
      out,
      'wall',
      'stone',
      [
        front(u, f.yOpening - 0.3, -3.39),
        front(v, f.yOpening - 0.3, -3.39),
        front(v, b, -3.39),
        front(u, a, -3.39),
      ],
      [1, 0, 0],
    );
    face(
      out,
      'carved',
      'pale',
      [front(u, a, 0.37), front(v, b, 0.37), front(v, b, -3.39), front(u, a, -3.39)],
      up,
    );
  }
  for (const side of [-1, 1]) {
    const u = side * r,
      a = crest(u);
    face(
      out,
      'carved',
      'stone',
      [
        front(u, f.yOpening - 0.26, lip),
        front(u, a, 0.37),
        front(u, a, -3.39),
        front(u, f.yOpening - 0.26, -3.39),
      ],
      [0, 0, side],
    );
  }
  const radius =
    detail === 0 ? [1, 0.45] : detail === 1 ? [1, 0.61, 0.23] : [1, 0.84, 0.67, 0.5, 0.32, 0.15];
  const depth = (t) => -2.85 + 3.36 * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
  const interior = (a, t) => front(r * Math.cos(a) * t, f.yOpening + h * Math.sin(a) * t, depth(t));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < radius.length - 1; j++) {
      const a = angle[i],
        b = angle[i + 1],
        c = radius[j],
        e = radius[j + 1];
      face(
        out,
        'carved',
        j === 0 ? 'stone' : 'sand',
        [interior(a, c), interior(b, c), interior(b, e), interior(a, e)],
        west,
      );
    }
    face(
      out,
      'carved',
      'sand',
      [
        interior(angle[i], radius.at(-1)),
        interior(angle[i + 1], radius.at(-1)),
        front(0, f.yOpening, -2.85),
      ],
      west,
    );
  }
  face(
    out,
    'carved',
    'pale',
    [
      front(-r, f.yOpening, lip),
      front(r, f.yOpening, lip),
      front(r, f.yOpening, -2.88),
      front(-r, f.yOpening, -2.88),
    ],
    up,
  );
  if (detail >= 1) {
    path(out, 'carved', 'bright', front, edge, 0.48, 0.34, 0.62);
    if (detail >= 2)
      path(
        out,
        'carved',
        'sand',
        front,
        edge.map(([u, y]) => [u * 1.047, f.yOpening + (y - f.yOpening) * 1.048]),
        0.28,
        0.27,
        0.69,
      );
    path(
      out,
      'carved',
      'pale',
      front,
      edge.map(([u]) => [u, crest(u)]),
      0.43,
      0.31,
      0.49,
    );
  }
  if (detail >= 2) {
    const niche = (u, y, d = 0) => front(u, y, depth(Math.hypot(u / r, (y - f.yOpening) / h)) + d);
    emblem(out, niche, west, 0, f.yOpening + 3.7, 1.82, detail, 0.19);
    if (detail >= 3)
      for (const side of [-1, 1]) {
        path(
          out,
          'carved',
          'sand',
          niche,
          [
            [side * 1.56, f.yOpening + 1.44],
            [side * 2.54, f.yOpening + 3.29],
            [side * 2.67, f.yOpening + 5.31],
            [side * 1.61, f.yOpening + 6.17],
          ],
          0.29,
          0.27,
          0.12,
        );
      }
    emblem(out, front, west, 0, f.yTop - 2.13, 1.57, detail, 0.67);
    if (detail >= 3)
      for (const i of [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]) {
        const a = (i * Math.PI) / 22,
          u = r * Math.cos(a),
          y = f.yOpening + h * Math.sin(a);
        const t = (u / r) * 0.34;
        path(
          out,
          'carved',
          'bright',
          front,
          [
            [u - t - 0.13, y + 0.32],
            [u - t + 0.08, y + 0.49],
            [u + t + 0.18, y + 0.36],
          ],
          0.165,
          0.16,
          0.66,
        );
      }
  }
}
function rails(out, p, n, spans, y, detail) {
  for (const [a, b] of spans) {
    strip(out, p, n, a, b, y, 0.18, 0.52, 'stone');
    strip(out, p, n, a, b, y + 1.01, 0.19, 0.6, 'pale');
    if (detail === 0) continue;
    const count = Math.ceil((b - a) / (detail === 1 ? 0.77 : 0.58));
    for (let i = 0; i <= count; i++) {
      const u = a + ((b - a) * i) / count;
      if (detail <= 2)
        panel(out, p, n, 'carved', 'pale', u - 0.115, u + 0.115, y + 0.17, y + 1.03, 0.48);
      else {
        const [x, , z] = p(u, 0, 0.36);
        lathe(
          out,
          'carved',
          'pale',
          x,
          z,
          [
            [y + 0.14, 0.112],
            [y + 0.38, 0.083],
            [y + 0.66, 0.143],
            [y + 0.99, 0.114],
          ],
          6,
          false,
        );
      }
    }
  }
}
function facade(out, detail) {
  frontWall(out, [-22, -14, -7.5, 0, 7.5, 14, 19.5], 0.44, 20.12, 0.13, -2.46);
  frontWall(out, [-12.18, -6.22, 0, 6.22, 12.18], 19.99, f.yOpening + 0.01, 0.29, -2.84, 'pale');
  for (const side of [-1, 1]) {
    const a = side * 11.55,
      b = side * 18.95;
    face(
      out,
      'carved',
      'pale',
      [
        front(a, 20.08, 0.32),
        front(b, 20.08, 0.34),
        front(side * 16.5, 22.73, 0.39),
        front(a, 27.72, 0.32),
      ],
      west,
    );
    if (detail >= 1)
      path(
        out,
        'carved',
        'sand',
        front,
        [
          [b, 20.34],
          [side * 16.47, 22.98],
          [side * 13.42, 24.55],
          [a, 27.83],
        ],
        0.46,
        0.31,
        0.42,
      );
    if (detail >= 2) emblem(out, front, west, side * 15.15, 22.38, 0.83, detail, 0.53);
    if (detail >= 3) {
      const u = side * 12.25;
      path(
        out,
        'carved',
        'pale',
        front,
        [
          [u, 22.12],
          [u + side * 0.38, 23.19],
          [u + side * 1.4, 23.69],
          [u + side * 1.79, 23.32],
          [u + side * 1.21, 22.91],
          [u + side * 0.88, 23.2],
        ],
        0.19,
        0.17,
        0.49,
      );
    }
  }
  facadeNiche(out, detail);
  for (const [i, u] of [-13.16, 0, 12.67].entries()) {
    const p = shifted(front, u, 0.43),
      main = i === 1;
    const w = main ? 6.12 : 4.17,
      top = main ? 10.65 : 8.28;
    archPanel(out, p, west, { w, low: f.yBase, top, rise: main ? 1.92 : 0.86, detail, door: true });
    if (detail >= 1) {
      const outer = arch(
        w * 1.25,
        f.yBase - 0.18,
        top + 0.83,
        main ? 2.12 : 1.06,
        detail >= 3 ? 12 : 6,
        false,
      ).slice(1);
      outer.push([-w * 0.625, f.yBase - 0.18]);
      path(out, 'carved', 'pale', p, outer, main ? 0.55 : 0.33, 0.34, 0.19);
      strip(out, p, west, -w * 0.72, w * 0.72, top + 1.06, 0.26, 0.38, 'sand');
    }
    if (detail >= 2) {
      archPanel(out, p, west, {
        w: main ? 2.72 : 2.42,
        low: top + 1.92,
        top: main ? 16.68 : 15.62,
        rise: 0.81,
        detail,
        blind: true,
      });
      if (detail >= 3) statue(out, shifted(p, 0, 0.13), 0, top + 2.28, 2.02, detail);
      if (main) emblem(out, p, west, 0, 17.99, 1.05, detail, 0.31);
    }
  }
  const upper = shifted(front, 0, 0.38);
  archPanel(out, upper, west, { w: 4.53, low: 21.25, top: 28.36, rise: 0.76, detail });
  if (detail >= 2) {
    strip(out, upper, west, -2.66, 2.66, 21.1, 0.42, 0.53);
    path(
      out,
      'carved',
      'pale',
      upper,
      [
        [-2.89, 27.7],
        [-2.4, 28.7],
        [0, 29.59],
        [2.4, 28.7],
        [2.89, 27.7],
      ],
      0.36,
      0.27,
      0.22,
    );
  }
  for (const u of [-19.3, -9.78, 9.65, 18.96]) {
    if (!detail && Math.abs(u) > 15) continue;
    columns(out, shifted(front, 0, 1.2), u, 0.95, 19.48, Math.abs(u) > 15 ? 0.96 : 1.14, detail);
  }
  for (const u of [-10.69, 10.67])
    columns(out, shifted(front, 0, 0.94), u, 20.25, 31.04, 1.05, detail);
  strip(out, front, west, -22, 19.5, 19.48, 0.56, 0.96, 'sand');
  if (detail >= 1) {
    strip(out, front, west, -22, 19.5, 18.97, 0.18, 0.68, 'pale');
    strip(out, front, west, -22, 19.5, 20.02, 0.29, 0.83, 'bright');
    rails(
      out,
      front,
      west,
      [
        [-21.25, -12.06],
        [12.06, 19.15],
      ],
      20.24,
      detail,
    );
    if (detail >= 3)
      for (let u = -21.5; u < 19.2; u += 0.73) {
        const [x, , z] = front(u, 0, 0.82);
        rect(
          out,
          'carved',
          'pale',
          x,
          z,
          [
            [19.24, 0.26, 0.33],
            [19.55, 0.33, 0.39],
          ],
          0,
          false,
        );
      }
  }
  if (detail >= 2) {
    for (const [u, y, h] of [
      [-19.5, 21.55, 2.69],
      [17.81, 21.55, 2.61],
      [-10.62, 31.35, 2.61],
      [10.57, 31.35, 2.66],
      [-7.45, 36.97, 2.1],
      [7.49, 36.97, 2.11],
    ]) {
      const [x, , z] = front(u, 0, 0.57);
      rect(out, 'carved', 'pale', x, z, [
        [y - 0.25, h * 0.47, h * 0.52],
        [y + 0.09, h * 0.46, h * 0.51],
      ]);
      statue(out, shifted(front, 0, 0.57), u, y, h, detail, u < 0 ? -1 : 1);
    }
    if (detail >= 3)
      for (const u of [-9.05, 8.97]) {
        const p = shifted(front, u, 0.33);
        archPanel(out, p, west, {
          w: 1.62,
          low: 22.9,
          top: 28.93,
          rise: 0.79,
          detail,
          blind: true,
        });
        statue(out, shifted(p, 0, 0.24), 0, 23.49, 2.55, detail);
      }
  }
  for (const [x, z, y, r] of [
    [-34.58, -16.85, 17.18, 4.82],
    [-38.32, 23.62, 15.2, 4.38],
  ]) {
    const s = [7, 10, 18, 24, 28][detail];
    lathe(
      out,
      'carved',
      'pale',
      x,
      z,
      detail === 0
        ? [
            [y - 2.23, r],
            [y + 0.14, r],
          ]
        : [
            [y - 2.23, r],
            [y - 0.12, r],
            [y + 0.14, r * 1.03],
          ],
      s,
      false,
    );
    lathe(
      out,
      'glaze',
      'blue',
      x,
      z,
      detail === 0
        ? [
            [y + 0.12, r],
            [y + r * 0.55, r * 0.77],
            [y + r * 0.81, r * 0.115],
          ]
        : [
            [y + 0.12, r],
            [y + r * 0.32, r * 0.95],
            [y + r * 0.59, r * 0.75],
            [y + r * 0.76, r * 0.41],
            [y + r * 0.81, r * 0.115],
          ],
      s,
      false,
    );
    lathe(
      out,
      'carved',
      'pale',
      x,
      z,
      [
        [y + r * 0.79, r * 0.15],
        [y + r * 1.04, r * 0.067],
      ],
      detail === 0 ? 5 : 10,
      true,
    );
  }
}
function openArch(out, p, n, y, top, half, w, detail, depth = 1) {
  const low = y,
    steps = detail >= 3 ? 10 : detail >= 2 ? 8 : detail === 1 ? 6 : 4;
  const spring = y + (top - y) * 0.57,
    rise = (top - y) * 0.31,
    h = w / 2;
  const curve = arch(w, low, spring + rise, rise, steps, false).slice(2);
  for (const d of detail === 0 ? [0] : [0, -depth]) {
    const toward = d === 0 ? n : n.map((v) => -v);
    for (const [a, b] of [
      [-half, -h],
      [h, half],
    ])
      panel(out, p, toward, 'wall', 'sand', a, b, low, top, d);
    for (let i = 0; i < steps; i++) {
      const [a, l] = curve[i],
        [b, r] = curve[i + 1];
      face(out, 'wall', 'sand', [p(a, l, d), p(b, r, d), p(b, top, d), p(a, top, d)], toward);
    }
  }
  if (detail === 0) return;
  for (const s of [-1, 1]) {
    const u = s * h;
    face(
      out,
      'carved',
      'shadow',
      [p(u, low, 0), p(u, low, -depth), p(u, spring, -depth), p(u, spring, 0)],
      [n[2] * s, 0, -n[0] * s],
    );
  }
  for (let i = 0; i < steps; i++) {
    const [a, l] = curve[i],
      [b, r] = curve[i + 1];
    face(
      out,
      'carved',
      'stone',
      [p(a, l, 0), p(b, r, 0), p(b, r, -depth), p(a, l, -depth)],
      [0, -1, 0],
    );
  }
  if (detail >= 2) path(out, 'carved', 'pale', p, curve, 0.2, 0.15, 0.085);
}
function tower(out, detail) {
  const { x, z, width: w, depth: d, angle, ground: g, height } = layout.tower,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const y = (h) => g + h,
    ring = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ].map(([a, b]) => [c * a - s * b, 0, s * a + c * b]);
  const lower =
    detail === 0
      ? [
          [31.72, w, d],
          [y(50), 15.87, 15.87],
        ]
      : [
          [31.74, w, d],
          [y(31.32), w + 0.12, d + 0.18],
          [y(32.02), w + 0.58, d + 0.49],
          [y(33.1), w - 0.43, d - 0.18],
          [y(46.21), w - 0.92, d - 0.74],
          [y(47.36), w + 0.27, d + 0.5],
          [y(48.1), w + 0.34, d + 0.59],
          [y(50), 15.9, 15.9],
        ];
  rect(out, 'carved', 'sand', x, z, lower, angle, false);
  for (const [i, n] of ring.entries()) {
    const h = i < 2 ? w * 0.5 : d * 0.5,
      span = i < 2 ? d : w,
      p = panelPlane(x + n[0] * h, z + n[2] * h, n);
    if (detail >= 1) {
      for (const k of [12, 28.35]) strip(out, p, n, -span * 0.5, span * 0.5, y(k), 0.36, 0.26);
      archPanel(out, p, n, {
        w: 2.03,
        low: y(17.3),
        top: y(24.4),
        rise: 1.05,
        detail: detail === 2 ? 1 : detail,
      });
      archPanel(out, p, n, {
        w: 2.24,
        low: y(34.4),
        top: y(41.3),
        rise: 1.14,
        detail: detail === 2 ? 1 : detail,
      });
      if (detail >= 3)
        for (const u of [-span * 0.4, span * 0.4])
          panel(out, p, n, 'carved', 'pale', u - 0.22, u + 0.22, y(5.43), y(28.35), 0.09);
      if (detail >= 2 && i === 0) emblem(out, p, n, 0, y(43.9), 1.19, detail, 0.3);
    }
    const outer = panelPlane(x + n[0] * 6.56, z + n[2] * 6.56, n);
    openArch(out, outer, n, y(53.0), y(72.75), 6.56, 5.13, detail, 1.12);
    if (detail >= 1) {
      for (const u of [-4.63, 4.63])
        archPanel(out, shifted(outer, u), n, {
          w: 1.55,
          low: y(56.11),
          top: y(65.19),
          rise: 0.89,
          detail: detail === 2 ? 1 : detail,
          blind: true,
        });
      strip(out, outer, n, -6.56, 6.56, y(53.05), 0.44, 0.2);
    }
  }
  rect(
    out,
    'carved',
    'pale',
    x,
    z,
    [
      [y(49.84), 15.8, 15.8],
      [y(52.98), 13.31, 13.31],
      [y(53.11), 13.33, 13.33],
    ],
    angle,
    true,
  );
  rect(
    out,
    'carved',
    'bright',
    x,
    z,
    [
      [y(72.71), 13.11, 13.11],
      [y(73.05), 13.99, 13.99],
      [y(73.43), 13.14, 13.14],
    ],
    angle,
    true,
  );
  const n = [7, 10, 16, 24, 30][detail];
  lathe(
    out,
    'carved',
    'pale',
    x,
    z,
    detail === 0
      ? [
          [y(73.37), 6.03],
          [y(80.31), 5.39],
        ]
      : [
          [y(73.37), 6.08],
          [y(74.13), 6.05],
          [y(74.6), 5.54],
          [y(79.72), 5.48],
          [y(80.15), 5.73],
          [y(80.58), 5.55],
        ],
    n,
    false,
  );
  const crown =
    detail === 0
      ? [
          [y(80.28), 5.42],
          [y(84.38), 4.79],
          [y(88.8), 2.16],
          [y(89.64), 1.16],
        ]
      : [
          [y(80.35), 5.49],
          [y(82.4), 5.29],
          [y(84.64), 4.76],
          [y(86.45), 3.93],
          [y(88.12), 2.74],
          [y(89.62), 1.17],
        ];
  lathe(out, 'carved', 'sand', x, z, crown, n, false);
  lathe(
    out,
    'carved',
    'bright',
    x,
    z,
    [
      [y(89.58), 1.22],
      [y(92.7), 0.87],
      [y(93.38), 0.55],
    ],
    detail === 0 ? 5 : 10,
    true,
  );
  beam(out, 'cast', [x, y(93.25), z], [x, y(height), z], 0.115, 0.115, colors.bronze);
  beam(
    out,
    'cast',
    [x - 0.48, y(height - 0.63), z],
    [x + 0.48, y(height - 0.63), z],
    0.105,
    0.105,
    colors.bronze,
  );
  if (detail >= 1) {
    for (const [a, b] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]) {
      const tx = x + 5.89 * (a * c - b * s),
        tz = z + 5.89 * (a * s + b * c);
      lathe(
        out,
        'carved',
        'sand',
        tx,
        tz,
        [
          [y(48.2), 1.74],
          [y(52.3), 1.42],
          [y(55.3), 1.31],
        ],
        detail === 1 ? 7 : 12,
        false,
      );
      lathe(
        out,
        'carved',
        'pale',
        tx,
        tz,
        [
          [y(55.24), 1.53],
          [y(56.32), 1.42],
          [y(59.1), 0.87],
          [y(62.05), 0.12],
        ],
        detail === 1 ? 7 : 12,
        true,
      );
      if (detail >= 2) {
        const n = [(tx - x) / 8.33, 0, (tz - z) / 8.33],
          p = panelPlane(tx + n[0] * 1.41, tz + n[2] * 1.41, n);
        archPanel(out, p, n, { w: 1.17, low: y(50.65), top: y(54.8), rise: 0.71, detail: 1 });
      }
    }
  }
  if (detail >= 2) {
    for (const n of ring) {
      const p = panelPlane(x + n[0] * 4.99, z + n[2] * 4.99, n),
        r = 0.73;
      const circle = Array.from({ length: detail >= 3 ? 14 : 10 }, (_, i) => i);
      face(
        out,
        'pane',
        'dark',
        circle.map((i) => {
          const a = (tau * i) / circle.length;
          return p(r * Math.cos(a), y(83.22) + r * Math.sin(a), 0.23);
        }),
        n,
      );
      archPanel(out, panelPlane(x + n[0] * 5.48, z + n[2] * 5.48, n), n, {
        w: 1.25,
        low: y(75.1),
        top: y(78.88),
        rise: 0.67,
        detail: 1,
      });
    }
    beam(out, 'timber', [x - 4.61, y(65.87), z], [x + 4.61, y(65.87), z], 0.4, 0.4, colors.grain);
    lathe(
      out,
      'cast',
      'bronze',
      x,
      z,
      [
        [y(60.84), 1.44],
        [y(61.2), 1.42],
        [y(61.99), 1.02],
        [y(64.99), 0.63],
        [y(65.44), 0.44],
      ],
      detail >= 3 ? 20 : 12,
      false,
    );
  }
}
function chapel(out, detail) {
  for (const [
    i,
    {
      p: [x, z],
      n,
      length,
    },
  ] of layout.chapelWalls.entries()) {
    const p = panelPlane(x, z, n);
    if (detail === 0) {
      panel(out, p, n, 'carved', 'stone', -length * 0.43, length * 0.43, 13.45, 13.78, 0.075);
      continue;
    }
    for (const [y, w] of [
      [1.35, 0.31],
      [5.18, 0.19],
      [13.42, 0.25],
      [23.96, 0.29],
    ])
      strip(out, p, n, -length * 0.49, length * 0.49, y, w, 0.17, 'sand');
    archPanel(out, p, n, {
      w: length * 0.66,
      low: 5.4,
      top: 12.58,
      rise: 1.91,
      detail,
      blind: true,
    });
    for (const u of [-0.19, 0.19])
      archPanel(out, shifted(p, u * length), n, {
        w: Math.min(0.86, length * 0.24),
        low: 20.22,
        top: 22.75,
        rise: 0.48,
        detail: detail >= 2 ? 1 : detail,
      });
    if (detail >= 2) {
      const links = Math.max(4, Math.round(length / 0.44)),
        r = Math.min(0.245, (length / links) * 0.61);
      for (let j = 0; j < links; j++) {
        const u = ((j + 0.5) * length) / links - length / 2,
          y = 13.76 + 0.09 * Math.cos(Math.PI * j);
        const n = detail >= 3 ? 9 : 5;
        const pts = Array.from({ length: n + 1 }, (_, k) => {
          const a = (tau * k) / n;
          return [u + r * Math.cos(a), y + r * (j % 2 ? 0.5 : 0.82) * Math.sin(a)];
        });
        path(out, 'carved', 'stone', p, pts, 0.065, 0.08, 0.24 + (j % 2) * 0.045);
      }
      emblem(out, p, n, 0, 17.35, Math.min(1.12, length * 0.259), detail, 0.28);
      if (detail >= 3 && i % 2 === 0) {
        for (const u of [-0.24, 0.24])
          statue(out, shifted(p, 0, 0.28), u * length, 6.53, 1.62, detail);
      }
    } else panel(out, p, n, 'carved', 'pale', -length * 0.49, length * 0.49, 13.72, 14.06, 0.16);
  }
  for (const [x, z] of [
    [44.68, 22.11],
    [44.27, 27.42],
    [40.21, 31.65],
    [34.35, 33.46],
  ]) {
    rect(
      out,
      'carved',
      'sand',
      x,
      z,
      detail === 0
        ? [
            [0.3, 0.83, 0.86],
            [24.86, 0.57, 0.59],
          ]
        : [
            [0.29, 1.13, 1.2],
            [2.25, 1.12, 1.2],
            [4.64, 0.79, 0.86],
            [22.96, 0.62, 0.67],
            [23.66, 0.94, 1.01],
            [25.56, 0.57, 0.59],
          ],
      0,
      false,
    );
  }
}
function stairs(out, detail) {
  for (const row of layout.stairs) {
    const { z0, z1, base, y, offset0, offset1 } = row,
      n = detail === 0 ? 2 : detail === 1 ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const a = z0 + ((z1 - z0) * i) / n,
        b = z0 + ((z1 - z0) * (i + 1)) / n;
      const A = westX(a),
        B = westX(b);
      face(
        out,
        'carved',
        'sand',
        [
          [A - offset0, y, a],
          [B - offset0, y, b],
          [B - offset1, y, b],
          [A - offset1, y, a],
        ],
        up,
      );
      face(
        out,
        'carved',
        'stone',
        [
          [A - offset0, base, a],
          [B - offset0, base, b],
          [B - offset0, y, b],
          [A - offset0, y, a],
        ],
        west,
      );
      if (detail >= 2 && (i === 0 || i === n - 1)) {
        const [x, z] = i === 0 ? [A, a] : [B, b];
        face(
          out,
          'carved',
          'stone',
          [
            [x - offset0, base, z],
            [x - offset1, base, z],
            [x - offset1, y, z],
            [x - offset0, y, z],
          ],
          [0, 0, i === 0 ? -1 : 1],
        );
      }
    }
  }
}
export function buildMurciaLevel(out, level) {
  const detail = detailByLevel[level];
  shell(out, detail);
  courseWindows(out, detail);
  facade(out, detail);
  tower(out, detail);
  chapel(out, detail);
  stairs(out, detail);
}
export const buildMurciaSkyline = (out) => buildMurciaLevel(out, 'skyline');
export const buildMurciaDistrict = (out) => buildMurciaLevel(out, 'district');
export const buildMurciaStreet = (out) => buildMurciaLevel(out, 'street');
export const buildMurciaCloseup = (out) => buildMurciaLevel(out, 'closeup');
