/** Main mausoleum and terrace; photographic exterior, geography held on incompatible surface DEMs. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import nativeFrame from '../../../content/worldgen/source/places/tt/ttn/humayuns_tomb/map-frame.json' with {
  type: 'json',
};
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  red = rgb('a85d43'),
  pale = rgb('e4dcc8'),
  shade = rgb('733f30'),
  ochre = rgb('b59868'),
  dark = rgb('38392d'),
  grey = rgb('797a6b'),
  blue = rgb('718d96'),
  gold = rgb('bda066');
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    p = (q) => {
      const r = v(q);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, q, n, u, col) => o.addTriangle(s, r, q.map(p), v(n), u, col),
    addQuad: (s, r, q, n, u, col) => o.addQuad(s, r, q.map(p), v(n), u, col),
    addConvexPolygon: (s, r, q, n, u, col) => {
      const pp = q.map(p),
        uv = q.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], col);
    },
  };
}
function face(o, s, x, y, z, w, h, col) {
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
    col,
  );
}
function polygon(o, s, r, y, col, up = true, holes = []) {
  const q = r.slice();
  if (Math.hypot(q[0][0] - q.at(-1)[0], q[0][1] - q.at(-1)[1]) < 0.001) q.pop();
  const starts = [];
  for (const hole of holes) {
    starts.push(q.length);
    q.push(...hole);
  }
  const ids = earcut(q.flat(), starts);
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((k) => [q[k][0], y, q[k][1]]);
    if (up) p.reverse();
    o.addTriangle(
      s,
      ref,
      p,
      [0, up ? 1 : -1, 0],
      p.map((v) => [v[0], v[2]]),
      col,
    );
  }
}
function filled(o, s, pts, z, col) {
  const ids = earcut(pts.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((k) => [pts[k][0], pts[k][1], z]);
    o.addTriangle(
      s,
      ref,
      p,
      [0, 0, 1],
      p.map((v) => [v[0], v[1]]),
      col,
    );
  }
}
function stripe(o, s, a, b, w, col) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(dx, dy),
    v = [((-dy / l) * w) / 2, ((dx / l) * w) / 2, 0];
  quad(
    o,
    s,
    [
      a.map((x, i) => x - v[i]),
      b.map((x, i) => x - v[i]),
      b.map((x, i) => x + v[i]),
      a.map((x, i) => x + v[i]),
    ],
    [0, 0, 1],
    col,
  );
}
function frame(o, x, y, z, w, h, d, col = pale) {
  const t = d < 2 ? 0.12 : 0.16;
  face(o, 'marble', x - w / 2, y, z, t, h, col);
  face(o, 'marble', x + w / 2, y, z, t, h, col);
  face(o, 'marble', x, y, z, w, t, col);
  face(o, 'marble', x, y + h - t, z, w, t, col);
}
function curve(x, y, w, h, n) {
  const a = w / 2,
    spring = y + h * 0.62,
    rise = h * 0.38,
    left = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      return [
        x - a + a * t,
        spring + (rise * Math.sqrt(Math.max(0, 4 - (t - 2) * (t - 2)))) / Math.sqrt(3),
      ];
    });
  return [
    ...left,
    ...left
      .slice(0, -1)
      .reverse()
      .map((p) => [2 * x - p[0], p[1]]),
  ];
}
/** Rectangular wall with an actually recessed pointed vault; no hidden solid wall across its mouth. */
function arch(
  o,
  x,
  y,
  z,
  w,
  h,
  panelW,
  panelH,
  depth,
  d,
  { back = true, col = red, trim = true } = {},
) {
  const n = [1, 1, 2, 6][d],
    c = curve(x, y, w, h, n),
    spring = y + h * 0.62,
    top = y + panelH;
  if (d === 0) {
    face(o, 'stone', x, y, z, panelW, panelH, col);
    filled(o, 'dark', [[x - w / 2, y], ...c, [x + w / 2, y]], z + 0.012, dark);
    return;
  }
  const pier = (panelW - w) / 2;
  if (pier > 0.001) {
    face(o, 'stone', x - (w + pier) / 2, y, z, pier, panelH, col);
    face(o, 'stone', x + (w + pier) / 2, y, z, pier, panelH, col);
  }
  for (let i = 0; i < c.length - 1; i++) {
    const a = c[i],
      b = c[i + 1];
    quad(
      o,
      'stone',
      [
        [a[0], a[1], z],
        [b[0], b[1], z],
        [b[0], top, z],
        [a[0], top, z],
      ],
      [0, 0, 1],
      col,
    );
  }
  const chain = [[x - w / 2, y], ...c, [x + w / 2, y]];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i],
      b = chain[i + 1],
      p = [
        [a[0], a[1], z],
        [a[0], a[1], z - depth],
        [b[0], b[1], z - depth],
        [b[0], b[1], z],
      ];
    quad(o, 'stone', p, normalFor(...p), shade);
  }
  if (back) filled(o, 'stone', chain, z - depth, shade);
  if (trim && (d > 1 || w > 6)) {
    for (let i = 0; i < chain.length - 1; i++) {
      const a = chain[i],
        b = chain[i + 1];
      stripe(o, 'marble', [...a, z + 0.018], [...b, z + 0.018], d === 1 ? 0.12 : 0.2, pale);
    }
    if (d >= 2) frame(o, x, y, z + 0.024, panelW - 0.35, panelH - 0.2, d);
  }
  if (d >= 3) {
    for (let yy = y + 1; yy < spring; yy += 0.65) {
      face(o, 'stone', x - w / 2 + 0.03, yy, z - depth / 2, 0.015, 0.025, ochre);
      face(o, 'stone', x + w / 2 - 0.03, yy, z - depth / 2, 0.015, 0.025, ochre);
    }
  }
}
function backDoors(o, x, y, z, w, h, d, jaali = false) {
  const c = curve(x, y, w, h, [1, 1, 3, 6][d]);
  filled(o, 'dark', [[x - w / 2, y], ...c, [x + w / 2, y]], z, dark);
  if (d >= 2 && (w > 1.2 || d === 3)) {
    frame(o, x, y - 0.05, z + 0.018, w + 0.45, h + 0.35, d);
    if (jaali)
      for (let i = 1; i < (d === 3 ? 7 : 4); i++) {
        const xx = x - w / 2 + (w * i) / (d === 3 ? 7 : 4);
        face(o, 'stone', xx, y, z + 0.027, 0.035, h * 0.65, ochre);
      }
    for (const yy of [y + h * 0.3, y + h * 0.6])
      face(o, 'stone', x, yy, z + 0.029, w, 0.035, ochre);
  }
}
function star(o, x, y, z, r, d, col = ochre) {
  if (d < 2) return;
  for (const a of [0, Math.PI]) {
    const q = Array.from({ length: 4 }, (_, i) => {
      const t = a + (i * Math.PI * 2) / 3;
      return [x + Math.sin(t) * r, y + Math.cos(t) * r, z];
    });
    for (let i = 0; i < 3; i++) stripe(o, 'marble', q[i], q[i + 1], 0.055, col);
  }
}
function parapet(o, w, y, z, d) {
  face(o, 'stone', 0, y, z, w, 0.75, red);
  if (!d) return;
  face(o, 'marble', 0, y + 0.72, z + 0.02, w, 0.09, pale);
  if (d >= 2) face(o, 'marble', 0, y, z + 0.02, w, 0.09, pale);
  if (d >= 2)
    for (let i = 0; i < Math.floor(w / (d === 2 ? 1.2 : 0.7)); i++) {
      const x = -w / 2 + ((i + 0.5) * w) / Math.floor(w / (d === 2 ? 1.2 : 0.7));
      filled(
        o,
        'marble',
        [
          [x, y + 0.12],
          [x + 0.19, y + 0.38],
          [x, y + 0.64],
          [x - 0.19, y + 0.38],
        ],
        z + 0.025,
        pale,
      );
    }
}
function lathe(o, s, x, z, profile, n, col) {
  loft(
    o,
    s,
    profile.map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    col,
  );
}
function finial(o, x, y, z, k, d, col = pale) {
  const n = [4, 4, 4, 12][d];
  lathe(
    o,
    'marble',
    x,
    z,
    [
      [y, 0.22 * k],
      [y + 0.2 * k, 0.34 * k],
      [y + 0.45 * k, 0.16 * k],
      [y + 0.8 * k, 0.12 * k],
      [y + 1.05 * k, 0.28 * k],
      [y + 1.35 * k, 0.15 * k],
      [y + 1.8 * k, 0.035 * k],
    ],
    n,
    col,
  );
}
function kiosk(o, x, z, y, r, d, small = false) {
  const n = [4, 4, 8, 20][d],
    h = small ? 1.55 : 3.7,
    post = small ? 0.18 : 0.28;
  if (d === 0) {
    const f = facing(o, 0, x, z);
    for (const a of [-1, 1])
      for (const b of [-1, 1]) face(f, 'stone', a * r * 0.65, y, b * r * 0.65, post, h, red);
    polygon(
      o,
      'stone',
      [
        [-r, -r],
        [r, -r],
        [r, r],
        [-r, r],
      ].map((p) => [p[0] + x, p[1] + z]),
      y + h,
      red,
    );
    lathe(
      o,
      'roof',
      x,
      z,
      [
        [y + h, r],
        [y + h + r * 0.6, r * 0.55],
        [y + h + r * 0.85, 0.08],
      ],
      4,
      small ? blue : grey,
    );
    return;
  }
  const baseHeight = d === 1 && small ? 0 : 0.15;
  if (baseHeight)
    lathe(
      o,
      'stone',
      x,
      z,
      [
        [y, r * 0.92],
        [y + baseHeight, r * 0.92],
      ],
      small ? 4 : 8,
      red,
    );
  const count = small ? 4 : 8;
  for (let i = 0; i < count; i++) {
    const a = ((i + 0.5) * Math.PI * 2) / count,
      px = x + Math.cos(a) * r * 0.74,
      pz = z + Math.sin(a) * r * 0.74;
    B(o, 'stone', px, y + baseHeight, pz, post, h - baseHeight, post, red);
    if (d >= 2) {
      B(o, 'stone', px, y + h - 0.25, pz, post * 2, 0.22, post * 2, red);
    }
  }
  lathe(
    o,
    'stone',
    x,
    z,
    [
      [y + h, r * 1.12],
      [y + h + 0.18, r * 1.16],
    ],
    small ? 4 : 8,
    red,
  );
  const profile = Array.from({ length: [0, 2, 5, 8][d] + 1 }, (_, i) => {
    const t = ((i / [0, 2, 5, 8][d]) * Math.PI) / 2;
    return [y + h + 0.2 + r * 0.65 * Math.sin(t), Math.max(0.055, r * 0.92 * Math.cos(t))];
  });
  lathe(o, 'roof', x, z, profile, n, small ? blue : grey);
  if (d >= 2) {
    finial(o, x, y + h + 0.2 + r * 0.65, z, small ? 0.24 : 0.4, d);
    if (d === 3 && !small)
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI * 2) / 16;
        B(
          o,
          'stone',
          x + r * Math.cos(a),
          y + h + 0.2,
          z + r * Math.sin(a),
          0.16,
          0.25,
          0.16,
          ochre,
        );
      }
  }
}
function mausoleumFace(o, len, d, kind) {
  const main = kind === 'portal',
    height = main ? 16 : 13,
    w = main ? 10.4 : Math.max(1.4, len - 4.3),
    depth = main ? 3 : 1.65;
  arch(o, 0, 7, 0, w, height - 2, len, height, depth, d);
  if (d) {
    backDoors(o, 0, 7.1, -depth + 0.015, Math.min(2.7, w * 0.5), 4, d, true);
    backDoors(o, 0, 14, -depth + 0.02, Math.min(2.6, w * 0.5), 3.8, d, true);
    if (d >= 2) {
      face(o, 'marble', 0, 12, -depth + 0.025, Math.min(3, w * 0.62), 1.1, pale);
      frame(o, 0, 12, -depth + 0.034, Math.min(3, w * 0.62), 1.1, d, ochre);
    }
  }
  if (d) {
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 + Math.max(0.6, (len - w) / 4));
      face(o, 'marble', x, 7.12, 0.024, Math.max(0.25, (len - w) / 2 - 0.24), 1.1, pale);
      if (!main && len > 9) {
        const pw = (len - w) / 2 - 0.25;
        for (const y of [8.35, 14.6]) {
          const c = curve(x, y, Math.min(1.05, pw - 0.25), 3, [1, 1, 3, 6][d]);
          filled(
            o,
            'stone',
            [[x - Math.min(1.05, pw - 0.25) / 2, y], ...c, [x + Math.min(1.05, pw - 0.25) / 2, y]],
            0.026,
            shade,
          );
          if (d >= 2) frame(o, x, y - 0.1, 0.04, pw - 0.15, 3.65, d);
        }
        if (d >= 2) frame(o, x, 12.7, 0.04, pw - 0.15, 1, d);
      }
      star(o, sx * w * 0.39, 7 + height - 2.3, 0.04, 0.42, d);
    }
  }
  if (!d) {
    parapet(o, len, 7 + height, 0, d);
    return;
  }
  face(o, 'marble', 0, 7 + height - 1.7, 0.024, len - 0.25, 0.14, pale);
  face(o, 'marble', 0, 7 + height - 0.5, 0.024, len - 0.25, 0.16, pale);
  parapet(o, len, 7 + height, 0, d);
}
function cornerFace(o, len, d) {
  const w = Math.max(1.1, len - 0.9);
  for (const y of [7, 13.5]) {
    arch(o, 0, y, 0, w, 4.8, len, 6.5, 1.15, d);
    if (d) backDoors(o, 0, y + 0.1, -1.13, Math.min(1.9, w * 0.55), 3.1, d, true);
  }
  if (!d) {
    parapet(o, len, 20, 0, d);
    return;
  }
  face(o, 'marble', 0, 12, 0.025, len, 0.75, pale);
  face(o, 'marble', 0, 18.5, 0.025, len, 0.55, pale);
  parapet(o, len, 20, 0, d);
}
/** Preserve the mapped long edges; the photographed lower corners are clipped, not square. */
export function humayunLowerOutline(r) {
  const corners = r.slice(0, -1);
  return corners.flatMap((a, i) =>
    [corners[(i + corners.length - 1) % corners.length], corners[(i + 1) % corners.length]].map(
      (b) => {
        const t = 3.2 / Math.hypot(b[0] - a[0], b[1] - a[1]);
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      },
    ),
  );
}
/** Real treads and risers. Inward flights have exposed shaft walls instead of hidden box faces. */
function stair(o, width, start, run, low, high, count, shaft = false) {
  const x = width / 2;
  for (let i = 0; i < count; i++) {
    const a = start - (run * i) / count,
      b = start - (run * (i + 1)) / count,
      y0 = low + ((high - low) * i) / count,
      y1 = low + ((high - low) * (i + 1)) / count;
    quad(
      o,
      'stone',
      [
        [-x, y1, a],
        [x, y1, a],
        [x, y1, b],
        [-x, y1, b],
      ],
      [0, 1, 0],
      red,
    );
    face(o, 'stone', 0, y0, a, width, y1 - y0, red);
    for (const side of [-1, 1]) {
      const p = shaft
        ? [
            [side * x, y1, a],
            [side * x, y1, b],
            [side * x, high, b],
            [side * x, high, a],
          ]
        : [
            [side * x, -0.6, a],
            [side * x, -0.6, b],
            [side * x, y1, b],
            [side * x, y1, a],
          ];
      if (shaft && i === count - 1) continue;
      if ((shaft ? -side : side) < 0) p.reverse();
      quad(o, 'stone', p, [shaft ? -side : side, 0, 0], red);
    }
  }
}
function terrace(o, r, d) {
  const outline = humayunLowerOutline(r);
  polygon(o, 'stone', outline, -0.6, red, false);
  polygon(o, 'stone', outline, 1.3, red);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      q = facing(
        o,
        Math.PI + Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
      );
    face(q, 'stone', 0, -0.6, 0, len, 1.9, grey);
    if (d === 3) frame(q, 0, 0.15, 0.015, len - 0.25, 0.8, d, grey);
    else if (d) face(q, 'marble', 0, 1.12, 0.015, len, 0.12, pale);
    if (len < 10) stair(q, 3.2, 2.2, 2.2, 0, 1.3, [1, 2, 2, 6][d]);
  }
}
function upperTerrace(o, r, d) {
  const outline = r.slice(0, -1),
    holes = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len <= 30) continue;
    const dx = (b[0] - a[0]) / len,
      dz = (b[1] - a[1]) / len;
    holes.push(
      [
        [-1.125, -1.12],
        [1.125, -1.12],
        [1.125, -8.4],
        [-1.125, -8.4],
      ].map(([x, z]) => [(a[0] + b[0]) / 2 - dx * x + dz * z, (a[1] + b[1]) / 2 - dz * x - dx * z]),
    );
  }
  polygon(o, 'stone', outline, 7, red, true, holes);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      q = facing(
        o,
        Math.PI + Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
      );
    const count = len > 30 ? 17 : 1,
      cell = len / count;
    if (count === 17) stair(q, 2.25, 0, 8.4, 1.3, 7, [2, 3, 16, 26][d], true);
    if (!d) {
      if (count === 17) {
        for (const s of [-1, 1])
          face(q, 'stone', (s * (len + cell)) / 4, 1.3, 0, (len - cell) / 2, 5.7, red);
        arch(q, 0, 1.3, 0, 2.25, 4.8, cell, 5.7, 1.1, 1, { back: false, trim: false });
      } else face(q, 'stone', 0, 1.3, 0, len, 5.7, red);
      continue;
    }
    for (let j = 0; j < count; j++) {
      const x = -len / 2 + (j + 0.5) * cell,
        access = count === 17 && j === 8;
      arch(
        q,
        x,
        1.3,
        0,
        access ? 2.25 : cell * 0.73,
        4.8,
        cell,
        5.7,
        1.1,
        d === 1 && !access ? 0 : d,
        { back: !access, trim: d >= 2 },
      );
      if (d >= 2 && !access) {
        backDoors(q, x - 0.6, 1.35, -1.08, 0.55, 1.8, d);
        backDoors(q, x + 0.6, 1.35, -1.08, 0.55, 1.8, d);
        if (d === 3)
          for (const xx of [-0.58, 0.58]) backDoors(q, x + xx, 3.75, -1.07, 0.5, 1.1, d, true);
      }
    }
    face(q, 'marble', 0, 6.6, 0.03, len, 0.11, pale);
    face(q, 'marble', 0, 6.85, 0.1, len, 0.14, pale);
    face(q, 'stone', 0, 7, 0.02, len, 0.5, red);
    if (d >= 2) {
      const n = Math.floor(len / 3);
      for (let j = 0; j <= n; j++)
        face(q, 'marble', -len / 2 + (j * len) / n, 7, 0.04, 0.12, 0.5, pale);
      face(q, 'marble', 0, 7.47, 0.04, len, 0.08, pale);
    }
  }
}
export function humayunsTomb(out, frame = nativeFrame, d = 3) {
  const body = frame.geometry.bodyOutline.slice(0, -1);
  terrace(out, frame.geometry.outline, d);
  upperTerrace(out, frame.geometry.terraceOutline, d);
  polygon(out, 'stone', body, 20, red);
  for (let i = 0; i < body.length; i++) {
    const a = body[i],
      b = body[(i + 1) % body.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      q = facing(
        out,
        Math.PI + Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
      );
    if ([2, 8, 14, 20].includes(i)) {
      mausoleumFace(q, len, d, 'portal');
      B(q, 'stone', 0, 22.9, -1.5, len, 0.1, 3, red);
      if (d) B(q, 'stone', 0, 20, -3.1, len, 3, 0.2, red);
      if (d) for (const x of [-len / 2, len / 2]) B(q, 'stone', x, 20, -1.5, 0.12, 3, 3, red);
      for (const x of [-len * 0.32, len * 0.32]) kiosk(q, x, 0, 23.75, 1.02, d, true);
      if (d >= 2)
        for (const x of [-len / 2 + 0.25, len / 2 - 0.25]) finial(q, x, 23.75, 0, 0.85, d);
    } else if ([0, 4, 6, 10, 12, 16, 18, 22].includes(i)) {
      mausoleumFace(q, len, d, 'wing');
    } else {
      cornerFace(q, len, d);
    }
  }
  // Actual4octagonal kiosk bases follow their native roof parts; columns are open air.
  for (const id of ['35184885087884', '35184885087885', '35184885087886', '35184885087887']) {
    const p = frame.geometry.parts.find((p) => p.id.endsWith(`/${id}`)).outline.slice(0, -1),
      x = p.reduce((s, p) => s + p[0], 0) / p.length,
      z = p.reduce((s, p) => s + p[1], 0) / p.length;
    kiosk(out, x, z, 20.75, 3.2, d);
  }
  const drum = frame.geometry.domeOutline.slice(0, -1),
    cx = drum.reduce((s, p) => s + p[0], 0) / drum.length,
    cz = drum.reduce((s, p) => s + p[1], 0) / drum.length,
    n = [8, 16, 40, 64][d];
  lathe(
    out,
    'stone',
    cx,
    cz,
    d === 0
      ? [
          [20, 10.85],
          [23.5, 11.9],
        ]
      : [
          [20, 10.85],
          [23.3, 10.85],
          [23.5, 11.9],
        ],
    n,
    red,
  );
  const slices = [3, 10, 10, 24][d],
    lower = Math.asin((23.5 - 24.8) / 13.2),
    upper = Math.acos(0.2 / 12.2);
  const profile = Array.from({ length: slices + 1 }, (_, i) => {
    const t = lower + ((upper - lower) * i) / slices;
    return [24.8 + 13.2 * Math.sin(t), 12.2 * Math.cos(t)];
  });
  lathe(out, 'marble', cx, cz, profile, n, pale);
  lathe(
    out,
    'gold',
    cx,
    cz,
    d <= 1
      ? [
          [38.0, 0.35],
          [39.3, 0.65],
          [40.2, 0.18],
          [42.5, 0.018],
        ]
      : [
          [38.0, 0.35],
          [38.3, 0.58],
          [38.7, 0.24],
          [39.3, 0.65],
          [39.9, 0.5],
          [40.2, 0.18],
          [40.6, 0.34],
          [41.0, 0.12],
          [41.6, 0.18],
          [41.8, 0.07],
          [42.5, 0.018],
        ],
    [3, 6, 10, 16][d],
    gold,
  );
  if (d >= 2) {
    for (const p of body.filter((_, i) => [0, 4, 6, 10, 12, 16, 18, 22].includes(i)))
      finial(out, p[0], 20.75, p[1], 0.8, d);
  }
}
export const humayunsTombSkyline = (o) => humayunsTomb(o, nativeFrame, 0);
export const humayunsTombDistrict = (o) => humayunsTomb(o, nativeFrame, 1);
export const humayunsTombStreet = (o) => humayunsTomb(o, nativeFrame, 2);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.95, metallic: 0 },
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.85, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_glazed', roughness: 0.8, metallic: 0 },
  dark: { slot: 'window', localRef: ref, roughness: 0.97, metallic: 0 },
  gold: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.5, metallic: 0.55 },
};
export const humayunsTombModel = {
  id: 'humayuns_tomb',
  key: 'humayuns_tomb',
  recipe: 'structure-humayuns-tomb.mjs',
  cell: 'tt/ttn',
  title: 'Humayun’s Tomb',
  build: humayunsTomb,
  surfaces,
  brief:
    'Main native clipped mausoleum on raised terrace, four real central stair niches and open upper-deck exits, clipped lower stone plinth and corner steps, deeply recessed pointed iwans and smaller arched bays, red sandstone with white marble inlay, four open corner chhatris and eight smaller tiled kiosks, marble double dome and metal finial. Separate gates, other tombs, gardens, water, trees and navigable interiors excluded.',
  camera: [120, 70, 135],
  lookAt: [0, 19, 0],
  portableGroundY: -0.6,
  quality: 'medium-fi-exterior',
  reviewStatus: 'owner-accepted-medium-fi-preview',
  geographicStatus: 'preview-proposal',
  qaCameras: [
    { name: 'south-whole', position: [0, 22, 120], lookAt: [0, 20, 0] },
    { name: 'mausoleum-oblique', position: [57, 20, 64], lookAt: [0, 18, 0] },
    { name: 'main-iwan', position: [0, 17, 44], lookAt: [0, 16, 21] },
    { name: 'clipped-corner', position: [42, 16, 43], lookAt: [23, 15, 22] },
    { name: 'terrace-arcade', position: [15, 5, 68], lookAt: [15, 4, 47] },
    { name: 'terrace-stair-mouth', position: [0, 4.7, 54], lookAt: [0, 4.5, 40] },
    { name: 'terrace-stair-exit', position: [0, 17, 60], lookAt: [0, 5, 42] },
    { name: 'lower-corner-steps', position: [59, 5, 59], lookAt: [47, 1, 47] },
    { name: 'roof-kiosks', position: [44, 42, 45], lookAt: [0, 25, 0] },
    { name: 'dome-finial', position: [35, 42, 40], lookAt: [0, 34, 0] },
    { name: 'north-west', position: [-110, 60, -110], lookAt: [0, 20, 0] },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-humayuns-tomb.mjs',
    level: 'skyline',
    export: 'humayunsTombSkyline',
    errorMeters: 2.8,
    surfaces,
    authoredLevels: {
      district: { export: 'humayunsTombDistrict', errorMeters: 1.5, surfaces },
      street: { export: 'humayunsTombStreet', errorMeters: 0.5, surfaces },
    },
  },
  limitations: [
    'Owner accepted the medium-fi model and geographic preview on 2026-10-19 with known host-terrain limitations. Original source ground remains unmodified; contact can intrude or float with coarse urban surface DEMs.',
    'Native quantized terrace/body/roof parts, UNESCO42.5m double-dome height reference, estimated42.5m overall finial height and photo proportions. Exact crown datum, levels, inlay motifs, fine stonework, unseen elevations and chhatri capitals are estimates.',
    'Raised platform lower step1.3m, main deck7m, wing parapet20.75m and central parapet23.75m follow map/photo interpretation; conflicting native3/7/20/28height tags retained as facts, not surveyed dimensions.',
    'Four central upper-terrace stairways follow the primary survey text;2.25m width,8.4m run,26close-view risers,shaft proportions and unseen corners are estimates. Coarse levels use2/3/16risers. The lower plinth preserves mapped long edges with estimated3.2m corner cuts and six-step corner access. No geometry or source elevation is fitted to the incompatible DEM.',
    'Separate garden tombs, gates, garden design, water, trees, furnishings and interior tomb chambers excluded. Four sides use symmetric photo-directed rhythms with small native asymmetries.',
    'Original photo pixels are inspection controls only, not redistributed textures; standard sandstone, marble, glazed tile and bronze graphs with opaque dark jaali backing.',
  ],
};
