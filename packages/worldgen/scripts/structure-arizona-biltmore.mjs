/** Arizona Biltmore main block: local Qualla images, original plans and current resort map. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL(
  '../../../content/worldgen/source/places/9t/9tb/arizona_biltmore/',
  import.meta.url,
);
const ref = 'palette:#ffffff',
  concrete = rgb('b6a994'),
  light = rgb('c5b8a2'),
  shade = rgb('8d806d'),
  joint = rgb('9d907d'),
  copper = rgb('7e8580'),
  dark = rgb('3c4944'),
  glass = rgb('485d61'),
  roof = rgb('979083');
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
function reliefStrip(o, a, b, w, backZ, color) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    ox = (-dy * w) / (2 * len),
    oy = (dx * w) / (2 * len),
    top = [
      [a[0] + ox, a[1] + oy, a[2]],
      [b[0] + ox, b[1] + oy, b[2]],
      [b[0] - ox, b[1] - oy, b[2]],
      [a[0] - ox, a[1] - oy, a[2]],
    ],
    back = top.map((p) => [p[0], p[1], backZ]);
  quad(o, 'wall', top, [0, 0, 1], color);
  // Four physical side faces join the relief to the underlying masonry. The
  // rear penetrates that wall slightly; the painted strips no longer float.
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      ex = top[j][0] - top[i][0],
      ey = top[j][1] - top[i][1];
    quad(o, 'wall', [top[i], top[j], back[j], back[i]], [-ey, ex, 0], color);
  }
}
function window(o, x, y, z, w, h, d) {
  face(o, 'glass', x, y, z, w, h, glass);
  if (d < 2) return;
  for (const xx of [-w / 2, w / 2]) face(o, 'metal', x + xx, y, z + 0.025, 0.06, h, copper);
  for (const yy of [y, y + h]) face(o, 'metal', x, yy, z + 0.03, w, 0.07, copper);
  const n = Math.max(1, Math.round(w / 0.8));
  for (let i = 1; i < n; i++)
    face(o, 'metal', x - w / 2 + (i * w) / n, y, z + 0.04, 0.045, h, copper);
  if (d > 2)
    for (const yy of [y + h * 0.33, y + h * 0.67])
      face(o, 'metal', x, yy, z + 0.045, w, 0.025, copper);
}
function panel(o, x, y, z, w, h, d, ornament = false, solidLeafBand = false) {
  if (d < 2) return;
  // The published full block is 18 by 13.5 inches. A shallow original stepped-leaf relief
  // captures the pattern's rhythm; it does not reproduce an exact mold or image texture.
  const nx = Math.max(1, Math.round(w / 0.4572)),
    ny = Math.max(1, Math.round(h / 0.3429)),
    sx = w / nx,
    sy = h / ny;
  for (let j = 0; j <= ny; j++) face(o, 'wall', x, y + j * sy, z + 0.01, w, 0.012, joint);
  if (d < 3) return;
  for (let i = 0; i <= nx; i++) face(o, 'wall', x - w / 2 + i * sx, y, z + 0.013, 0.01, h, joint);
  if (!ornament) return;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const xx = x - w / 2 + (i + 0.5) * sx,
        yy = y + (j + 0.5) * sy,
        sg = (i + j) % 2 ? 1 : -1;
      const solid = solidLeafBand && i >= 3 && i < 9 && j < 12;
      // Native cleared wall photographs resolve three stepped angular ribs.
      // One prominent lower tower band receives full sides/depth; the rest
      // retains the existing simpler treatment within the close-range budget.
      for (let k = 0; k < (solid ? 3 : 2); k++) {
        const r = 0.15 - k * 0.042,
          top = yy + 0.12 - k * 0.033;
        const pts = solid
          ? [
              [xx - r, yy + sg * (0.12 - k * 0.015), z + 0.035],
              [xx, yy - sg * (0.12 - k * 0.06), z + 0.055],
              [xx + r, yy + sg * (0.12 - k * 0.015), z + 0.035],
            ]
          : [
              [xx - sg * r, yy - 0.09, z + 0.035],
              [xx, top, z + 0.055],
              [xx + sg * r, yy + 0.04, z + 0.035],
            ];
        for (let q = 0; q < 2; q++) {
          if (solid) reliefStrip(o, pts[q], pts[q + 1], 0.024, z - 0.05, light);
          else line(o, 'wall', pts[q], pts[q + 1], 0.024, k % 2 ? shade : light);
        }
      }
    }
}
function upNormal(pts) {
  const n = normalFor(...pts);
  return n[1] < 0 ? n.map((v) => -v) : n;
}
function hip(o, x, z, w, depth, y, rise, d) {
  const ridge = Math.max(0, w - depth),
    p = [
      [x - w / 2, y, z - depth / 2],
      [x + w / 2, y, z - depth / 2],
      [x + w / 2, y, z + depth / 2],
      [x - w / 2, y, z + depth / 2],
    ];
  const a = [x - ridge / 2, y + rise, z],
    b = [x + ridge / 2, y + rise, z];
  for (const pts of [
    [p[0], p[1], b, a],
    [p[2], p[3], a, b],
  ])
    if (ridge > 0) quad(o, 'copper', pts, upNormal(pts), copper);
    else
      o.addTriangle(
        'copper',
        ref,
        pts.slice(0, 3),
        upNormal(pts.slice(0, 3)),
        [
          [0, 0],
          [1, 0],
          [0.5, 1],
        ],
        copper,
      );
  for (const pts of [
    [p[0], a, p[3]],
    [p[1], p[2], b],
  ])
    o.addTriangle(
      'copper',
      ref,
      pts,
      upNormal(pts),
      [
        [0, 0],
        [1, 1],
        [1, 0],
      ],
      copper,
    );
  if (d > 1) {
    for (let xx = x - ridge / 2; xx <= x + ridge / 2; xx += 1.3)
      for (const sg of [-1, 1])
        beam(o, 'copper', [xx, y, z + (sg * depth) / 2], [xx, y + rise, z], 0.035, 0.035, dark);
  }
}
function balcony(o, x, y, z, w, d) {
  B(o, 'wall', x, y, z, w, 0.28, 0.75, light);
  B(o, 'wall', x, y + 1.1, z, w, 0.14, 0.55, concrete);
  if (d < 2) {
    B(o, 'wall', x, y + 0.28, z, w, 0.82, 0.24, concrete);
    return;
  }
  const n = Math.round(w / 0.85);
  for (let i = 0; i < n; i++) {
    const xx = x - w / 2 + ((i + 0.5) * w) / n;
    B(o, 'wall', xx, y + 0.25, z, 0.11, 0.9, 0.32, concrete);
    if (d > 2) {
      beam(
        o,
        'wall',
        [xx - (w / n) * 0.4, y + 0.3, z],
        [xx + (w / n) * 0.4, y + 1.08, z],
        0.065,
        0.12,
        concrete,
      );
      beam(
        o,
        'wall',
        [xx + (w / n) * 0.4, y + 0.3, z],
        [xx - (w / n) * 0.4, y + 1.08, z],
        0.065,
        0.12,
        concrete,
      );
    }
  }
}
function roomBlock(o, x, z, w, depth, h, d, { levels = 2, windows = true, pattern = false } = {}) {
  B(o, 'wall', x, -1, z, w, h + 1, depth, concrete);
  if (d > 0) B(o, 'membrane', x, h + 0.015, z, w - 0.18, 0.07, depth - 0.18, roof);
  else
    quad(
      o,
      'membrane',
      [
        [x - w / 2, h + 0.015, z - depth / 2],
        [x + w / 2, h + 0.015, z - depth / 2],
        [x + w / 2, h + 0.015, z + depth / 2],
        [x - w / 2, h + 0.015, z + depth / 2],
      ],
      [0, 1, 0],
      roof,
    );
  for (const [a, ww, dep] of [
    [0, w, depth],
    [Math.PI, w, depth],
    [Math.PI / 2, depth, w],
    [-Math.PI / 2, depth, w],
  ]) {
    const t = facing(o, a, x, z);
    if (d > 0) B(t, 'wall', 0, h - 0.25, dep / 2 + 0.035, ww, 0.25, 0.12, light);
    if (d > 1) panel(t, 0, h - 1.25, dep / 2 + 0.07, ww, 1, d, pattern && a === 0);
    if (windows && d > 0) {
      const n = Math.max(1, Math.round(ww / 4.1));
      for (let j = 0; j < levels; j++)
        for (let i = 0; i < n; i++) {
          const yy = 0.8 + (j * (h - 0.9)) / levels;
          window(
            t,
            -ww / 2 + ((i + 0.5) * ww) / n,
            yy,
            dep / 2 + 0.025,
            Math.min(2.4, (ww / n) * 0.62),
            Math.min(2.15, (h / levels) * 0.6),
            d,
          );
        }
    }
  }
}
export function hotel(o, frame, d = 3) {
  frame ??= JSON.parse(fs.readFileSync(new URL('map-frame.json', base)));
  const outline = frame.geometry.outline;
  prism(o, [outline], -1, 0.45, shade); // A buried foundation follows only the scoped main-hotel outline.
  // Low west Gold/Grand wing; western conference center remains a separate structure.
  const west = [
    [-77.7, 35],
    [-77.7, -43.6],
    [-64.5, -43.8],
    [-64.5, -39.6],
    [-62.4, -39.7],
    [-62.5, -38.2],
    [-48.1, -38.2],
    [-45.9, -34.4],
    [-24.4, -47.3],
    [-19.5, -49.3],
    [-1.3, -17.1],
    [-20, -17.1],
    [-20, 24.6],
    [-40.5, 24.6],
    [-73.1, 24.5],
    [-73.1, 27.9],
    [-77.5, 27.9],
  ];
  prism(o, [west], -0.8, 6.8, concrete);
  prism(o, [west], 6.81, 6.89, roof, 'membrane');
  roomBlock(o, -38, 12.3, 35, 25, 7.6, d, { levels: 2, pattern: true });
  // Main guest-room core: low broad base, taller rear room strip and recessed front veranda.
  roomBlock(o, 12, 7, 64, 24, 7.2, d, { levels: 2 });
  roomBlock(o, 12, -0.1, 64, 9.8, 13.55, d, { levels: 4 });
  roomBlock(o, 12, 8, 64, 7.4, 10.65, d, { levels: 3 });
  roomBlock(o, -13.4, 12.6, 13.2, 13.2, 12, d, { levels: 3, pattern: true });
  roomBlock(o, 39, 13, 10, 12, 12.1, d, { levels: 3, pattern: true });
  // Open top veranda spans the south front, with metal canopy and projecting rafters.
  const vx = 11.6,
    vw = 42.2;
  B(o, 'wall', vx, 7.2, 15.1, vw, 0.22, 6.5, concrete);
  balcony(o, vx, 7.4, 18.3, vw, d);
  for (let i = 0; i <= (d === 0 ? 4 : 10); i++) {
    const n = d === 0 ? 4 : 10,
      xx = vx - vw / 2 + (i * vw) / n;
    B(o, 'metal', xx, 7.45, 18, 0.19, 3.25, 0.19, copper);
    if (d > 1) {
      beam(o, 'metal', [xx, 9.6, 18], [xx + 0.55, 10.55, 18], 0.07, 0.07, copper);
      beam(o, 'metal', [xx, 9.6, 18], [xx - 0.55, 10.55, 18], 0.07, 0.07, copper);
    }
  }
  B(o, 'copper', vx, 10.7, 15.3, vw + 1.5, 0.13, 8.5, copper);
  if (d > 1)
    for (let xx = vx - vw / 2; xx <= vx + vw / 2; xx += 0.85) {
      // Rafter ends meet the existing solid tower walls rather than emerging
      // as isolated copper cubes through the textile-block facade.
      let front = 20.7;
      for (const [left, right, wallZ] of [
        [-10.5, -5.1, 20],
        [-5.6, -0.8, 19],
        [23.4, 27.8, 20.15],
      ])
        if (xx >= left && xx <= right) front = Math.min(front, wallZ - 0.01);
      B(o, 'copper', xx, 10.61, (11.1 + front) / 2, 0.11, 0.18, front - 11.1, copper);
    }
  // Tower and south projecting risalits. Twin slim slots and vertical fins dominate the silhouette.
  roomBlock(o, -7.8, 17, 5.4, 6, 18.3, d, { levels: 4, windows: false, pattern: true });
  roomBlock(o, -3.2, 15.5, 4.8, 7, 12.3, d, { levels: 3, pattern: true });
  roomBlock(o, 25.6, 17.3, 4.4, 5.7, 13.3, d, { levels: 3, pattern: true });
  for (const [tx, h, w] of [
    [-7.8, 18.65, 5.4],
    [25.6, 13.6, 4.4],
  ]) {
    const n = d === 0 ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const xx = tx - w / 2 + 0.2 + (i * (w - 0.4)) / (n - 1);
      B(o, 'wall', xx, 4, 20.2, 0.2, h - 4, 0.65, light);
    }
    if (d > 0) window(o, tx, h - 5.85, 20.075, 0.55, 4.8, d);
    if (d > 1) panel(o, tx, 8.1, 20.045, w, Math.max(1, h - 8.3), d, true, tx === -7.8);
  }
  // Shallow sloping side roofs are distinct from the largely flat block roofs.
  hip(o, -14, 11.5, 14.5, 14.8, 12.05, 1.4, d);
  hip(o, 39, 11.5, 11.8, 14.8, 12.15, 1.3, d);
  // South McArthur restaurant and its projecting terrace/canopy.
  roomBlock(o, 33, 30, 44, 25.5, 4.4, d, { levels: 1 });
  for (const sg of [-1, 1]) {
    const t = facing(o, (sg * Math.PI) / 2, 33, 30);
    if (d > 0) for (let i = 0; i < 7; i++) window(t, -10.5 + i * 3.5, 0.65, 22.03, 2.9, 2.9, d);
  }
  B(o, 'copper', 33, 4.5, 30, 45.8, 0.13, 27.2, copper);
  // Polygonal Aztec Room: preserved octagonal plan and low copper pyramidal cap.
  const az = Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    return [-32.5 + Math.sin(a) * 11, 34 + Math.cos(a) * 9.8];
  });
  prism(o, [az], -0.8, 5.9, concrete);
  for (let i = 0; i < 8; i++) {
    const a = az[i],
      b = az[(i + 1) % 8],
      p = [
        [a[0], 5.95, a[1]],
        [b[0], 5.95, b[1]],
        [-32.5, 8.9, 34],
      ];
    o.addTriangle(
      'copper',
      ref,
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      copper,
    );
    if (d > 0) {
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        t = facing(o, Math.atan2(-dz, dx), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      panel(t, 0, 1.3, 0.025, len, 3.7, d, true);
    }
  }
  B(o, 'copper', -32.5, 8.8, 34, 0.4, 1.3, 0.4, copper);
  // South entrance porte-cochere stays open beneath the roof, including on the rising DEM.
  B(o, 'copper', -19.5, 4.75, 42, 8, 0.22, 34, copper);
  for (const xx of [-23, -16])
    for (const z of [29, 42, 56]) B(o, 'wall', xx, 0.1, z, 0.6, 4.65, 0.6, concrete);
  if (d > 0) for (const z of [29, 42, 56]) B(o, 'wall', -19.5, 4.4, z, 8, 0.35, 0.65, concrete);
  // Current north court low glazed projection with broad metal hipped roof.
  roomBlock(o, 15.5, -10.5, 33, 13, 4.8, d, { levels: 1 });
  hip(o, 15.5, -10.5, 35.2, 15, 4.9, 3.3, d);
  if (d > 0) {
    const t = facing(o, Math.PI, 15.5, -17);
    for (let i = 0; i < 8; i++) window(t, -14 + i * 4, 0.8, 0.04, 3.3, 3.3, d);
  }
  // Slim historic garden arcade extending from the west wing; later guest wings excluded.
  const ap = [-22, -48],
    bp = [-10.3, -70.6],
    dx = bp[0] - ap[0],
    dz = bp[1] - ap[1],
    len = Math.hypot(dx, dz),
    ar = facing(o, Math.atan2(-dz, dx), (ap[0] + bp[0]) / 2, (ap[1] + bp[1]) / 2);
  B(ar, 'copper', 0, 4.8, 0, len, 0.18, 3.8, copper);
  for (let i = 0; i <= 6; i++)
    B(ar, 'wall', -len / 2 + (i * len) / 6, 0.5, 0, 0.7, 4.3, 0.7, concrete);
  if (d > 0) {
    // Low roof service blocks are observed in the north exterior photograph, without branding.
    roomBlock(o, -39, -22, 17, 17, 8.5, d, { windows: false });
    roomBlock(o, -63, -13, 13, 17, 8.2, d, { windows: false });
    B(o, 'wall', -11, 13.55, -1, 4, 2.4, 3, concrete);
    B(o, 'metal', -11, 14, -2.55, 2.5, 1.5, 0.08, dark);
    B(o, 'wall', 23, 13.55, -1, 3, 2, 3, concrete);
    for (const x of [-2, 13, 29]) B(o, 'wall', x, 5.2, -12, 1.1, 2.2, 1.1, concrete);
  }
  if (d > 0) {
    // South dining-room glazing is on the visible wall, beyond the low wing envelope.
    for (let i = 0; i < 8; i++) window(o, -53 + i * 4.2, 0.7, 24.84, 3.2, 4.45, d);
    for (let i = 0; i < 4; i++) window(o, -70 + i * 4, 0.9, 24.58, 1.6, 3.9, d);
    const a = [-19.5, -49.3],
      b = [-1.3, -17.1],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      t = facing(o, Math.atan2(-dz, dx) + Math.PI, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    for (let i = 0; i < 7; i++) window(t, -len / 2 + 3 + i * 4.7, 2.8, 0.08, 1.65, 2.7, d);
  }
  if (d > 1) {
    // Patterned bands on the accessible south facade and west Gold Room.
    for (const [x, z, w] of [
      [12, 19.04, 64],
      [-38, 24.84, 35],
      [33, 42.79, 44],
    ]) {
      const hi = z > 40 ? 4.2 : 7.1;
      panel(o, x, hi - 0.7, z, w, 0.65, d, true);
      panel(o, x, 0.55, z, w, 0.7, d, true);
    }
    for (const [x, w] of [
      [-14, 12],
      [14, 18],
      [35.5, 10],
    ])
      panel(o, x, 6.15, 19.07, w, 0.68, d, true);
    const westFace = facing(o, -Math.PI / 2, -77.7, -4);
    panel(westFace, 0, 5.3, 0.06, 78, 0.65, d, true);
    const north = facing(o, Math.PI, 12, -5.03);
    panel(north, 0, 12.6, 0.04, 64, 0.65, d, true);
  }
}
export function biltmoreSkyline(o) {
  hotel(o, undefined, 0);
}
export function biltmoreDistrict(o) {
  hotel(o, undefined, 1);
}
export function biltmoreStreet(o) {
  hotel(o, undefined, 2);
}
const surfaces = {
  wall: { ...landmarkSurfaces.concrete, graph: 'concrete_plain' },
  metal: { ...landmarkSurfaces.metal },
  copper: { ...landmarkSurfaces.roof, graph: 'metal_copper', roughness: 0.6, metallic: 0.45 },
  membrane: { ...landmarkSurfaces.roof, graph: 'membrane' },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const biltmoreModel = {
  id: 'arizona_biltmore',
  recipe: 'structure-arizona-biltmore.mjs',
  key: 'arizona_biltmore',
  cell: '9t/9tb',
  title: 'Arizona Biltmore Hotel',
  brief:
    'Historic main block with stepped textile-block tower, recessed upper veranda, long room bar, low Gold/Grand wings, octagonal copper-roofed Aztec Room and open entrance canopy.',
  camera: [170, 100, 200],
  lookAt: [-9, 6, -2],
  qaCameras: [
    { name: 'front', position: [-4, 22, 165], lookAt: [-8, 7, 4] },
    { name: 'back', position: [110, 65, -155], lookAt: [-8, 7, -5] },
    { name: 'textile-relief', position: [-7.8, 10, 24], lookAt: [-7.8, 10, 20.1] },
    { name: 'textile-profile', position: [-6.2, 10.8, 24], lookAt: [-7.8, 10.2, 20.1] },
  ],
  build: hotel,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'South entrance approach [-19.5,60] immediately outside the mapped porte-cochere; independent terrain preserved unchanged.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-arizona-biltmore.mjs',
    level: 'skyline',
    export: 'biltmoreSkyline',
    errorMeters: 1,
    surfaces,
    authoredLevels: {
      district: { export: 'biltmoreDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'biltmoreStreet', errorMeters: 0.15, surfaces },
    },
  },
  limitations: [
    'Original medium-fi main-block exterior. Current relief construction uses exact native Daderot public-domain originals already cleared in Qualla, with explicit creator releases and original hashes bound. Earlier attribution-licensed views are excluded as current controls; inherited main-block massing, factual plan/map controls and hidden facade approximations retained. Not a surveyed reconstruction.',
    'Current restored main building only. Later East/Garden/Paradise/Valley/Ocatilla wings, separate conference halls, cottages, villas, pools and broader grounds are excluded. Connected boundary clipping is an explicit scope decision.',
    'Upper-room setbacks, heights, service-side roofs and exact window positions are photo-derived approximations. Original plans guide massing but do not claim that every 1929 interior survives.',
    'Geometric textile-block relief uses the published18by13.5inch module.72modules in one lower south-tower band now have three stepped angular ribs with real tops/sides joined to the underlying wall. The rest retains simplified original relief. Profiles, depth and exact mold/current condition remain estimates; no exact mold replica, photographic pixels, readable signage or interiors are embedded.',
    'Veranda rafters are trimmed where they meet existing solid tower walls, removing isolated copper ends through the facade. These intersections remain an approximate exterior construction detail, not structural engineering.',
    'Independent terrain rises across the footprint and is not flattened; the foundation extends below the south approach datum. Another host DEM can change exact ground contact.',
  ],
};
