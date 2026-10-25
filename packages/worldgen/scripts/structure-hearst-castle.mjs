/** Hearst Castle: source-controlled site geometry from Qualla exteriors and mapped hilltop footprints. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const framePath = new URL(
  '../../../content/worldgen/source/places/9q/9q3/hearst_castle/map-frame.json',
  import.meta.url,
);
const white = rgb('ddd8c7'),
  stucco = rgb('d5c7a8'),
  tile = rgb('aa7050'),
  blue = rgb('608c9a'),
  gold = rgb('c7a65c'),
  wood = rgb('66452f'),
  dark = rgb('343b39'),
  water = rgb('6aabae');
const ref = 'palette:#ffffff',
  tau = Math.PI * 2;
function facing(o, angle, x = 0, z = 0, y = 0) {
  const co = Math.cos(angle),
    si = Math.sin(angle),
    rot = (p) => [co * p[0] + si * p[2], p[1], -si * p[0] + co * p[2]],
    point = (p) => {
      const q = rot(p);
      return [q[0] + x, q[1] + y, q[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, uv, col) => o.addTriangle(s, r, p.map(point), rot(n), uv, col),
    addQuad: (s, r, p, n, uv, col) => o.addQuad(s, r, p.map(point), rot(n), uv, col),
    addConvexPolygon: (s, r, p, n, uv, col) => {
      const u = p.map(uv),
        pts = p.map(point);
      return o.addConvexPolygon(s, r, pts, rot(n), (q) => u[pts.indexOf(q)] ?? [q[0], q[1]], col);
    },
  };
}
function ring(points) {
  const r = cleanRing(points);
  if (
    r.reduce(
      (s, a, i) => s + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1],
      0,
    ) < 0
  )
    r.reverse();
  return r;
}
function prism(o, points, y0, y1, col = stucco, top = col, slot = 'concrete') {
  const r = ring(points);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    quad(
      o,
      slot,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [dz, 0, -dx],
      col,
    );
  }
  const ii = earcut(r.flat());
  for (const [y, n, color] of [
    [y0, [0, -1, 0], col],
    [y1, [0, 1, 0], top],
  ])
    for (let i = 0; i < ii.length; i += 3) {
      const p = ii.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]);
      o.addTriangle(
        slot,
        ref,
        p,
        n,
        p.map((q) => [q[0], q[2]]),
        color,
      );
    }
}
function face(o, slot, x, y, z, w, h, col) {
  quad(
    o,
    slot,
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
function win(o, x, y, z, w, h, detail) {
  face(o, 'glass', x, y, z, w, h, dark);
  if (detail < 2) return;
  for (const xx of [-w / 2 - 0.06, w / 2 + 0.06])
    face(o, 'concrete', x + xx, y - 0.06, z + 0.025, 0.12, h + 0.12, white);
  for (const yy of [-0.06, h]) face(o, 'concrete', x, y + yy, z + 0.03, w + 0.24, 0.12, white);
  if (detail > 2) {
    face(o, 'metal', x, y, z + 0.04, 0.045, h, wood);
    face(o, 'metal', x, y + h * 0.55, z + 0.04, w, 0.04, wood);
  }
}
function arch(o, x, y, z, w, h, detail, { open = false, col = white, fill = dark } = {}) {
  const rad = w / 2,
    shoulder = y + h - rad,
    n = detail > 1 ? 8 : 4,
    point = (a, r = rad, zz = z) => [x + Math.cos(a) * r, shoulder + Math.sin(a) * r, zz];
  if (!open) {
    const pts = [
      [x - rad, y, z],
      [x + rad, y, z],
      [x + rad, shoulder, z],
    ];
    for (let i = 1; i <= n; i++) pts.push(point((i * Math.PI) / n));
    o.addConvexPolygon('glass', ref, pts, [0, 0, 1], (p) => [p[0], p[1]], fill);
  }
  for (const sign of [-1, 1])
    B(o, 'concrete', x + sign * (rad + 0.1), y, z, 0.2, shoulder - y, 0.22, col);
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    quad(
      o,
      'concrete',
      [
        point(a, rad, z + 0.03),
        point(b, rad, z + 0.03),
        point(b, rad + 0.2, z + 0.03),
        point(a, rad + 0.2, z + 0.03),
      ],
      [0, 0, 1],
      col,
    );
    if (open)
      quad(
        o,
        'concrete',
        [
          point(a, rad + 0.2, z + 0.025),
          point(b, rad + 0.2, z + 0.025),
          [x + Math.cos(b) * (rad + 0.2), y + h + 0.35, z + 0.025],
          [x + Math.cos(a) * (rad + 0.2), y + h + 0.35, z + 0.025],
        ],
        [0, 0, 1],
        col,
      );
  }
  if (detail > 1 && !open) {
    face(o, 'metal', x, y, z + 0.06, 0.05, h, wood);
    face(o, 'metal', x, y + h * 0.55, z + 0.06, w, 0.04, wood);
  }
}
function cylinder(o, x, z, r, y, h, col, n = 12, top = r, slot = 'concrete') {
  loft(o, slot, [radialRing(y, r, r, n, [x, z]), radialRing(y + h, top, top, n, [x, z])], col);
}
function hip(o, x, z, w, d, y, rise, detail) {
  const h = Math.min(w, d) * 0.35;
  const corners = [
      [x - w / 2, y, z - d / 2],
      [x + w / 2, y, z - d / 2],
      [x + w / 2, y, z + d / 2],
      [x - w / 2, y, z + d / 2],
    ],
    ridge =
      w > d
        ? [
            [x - w / 2 + h, y + rise, z],
            [x + w / 2 - h, y + rise, z],
          ]
        : [
            [x, y + rise, z - d / 2 + h],
            [x, y + rise, z + d / 2 - h],
          ];
  const faces =
    w > d
      ? [
          [corners[0], corners[1], ridge[1], ridge[0]],
          [corners[1], corners[2], ridge[1]],
          [corners[2], corners[3], ridge[0], ridge[1]],
          [corners[3], corners[0], ridge[0]],
        ]
      : [
          [corners[0], corners[1], ridge[0]],
          [corners[1], corners[2], ridge[1], ridge[0]],
          [corners[2], corners[3], ridge[1]],
          [corners[3], corners[0], ridge[0], ridge[1]],
        ];
  for (let p of faces) {
    let n = normalFor(...p);
    if (n[1] < 0) {
      p = [...p].reverse();
      n = normalFor(...p);
    }
    if (p.length === 4) quad(o, 'roof', p, n, tile);
    else
      o.addTriangle(
        'roof',
        ref,
        p,
        n,
        p.map((q) => [q[0], q[2]]),
        tile,
      );
  }
  if (detail > 1) beam(o, 'roof', ridge[0], ridge[1], 0.18, 0.13, tile);
}
function railing(o, a, b, y, detail, col = white) {
  if (!detail) return;
  beam(o, 'concrete', [...a.slice(0, 1), y + 0.9, a[1]], [b[0], y + 0.9, b[1]], 0.16, 0.18, col);
  if (detail > 1) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.65);
    for (let i = 0; i <= n; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / n,
        z = a[1] + ((b[1] - a[1]) * i) / n;
      B(o, 'concrete', x, y, z, 0.13, 0.9, 0.13, col);
    }
  }
}
function balcony(o, x, y, z, w, detail) {
  B(o, 'concrete', x, y, z, w, 0.2, 0.9, white);
  railing(o, [x - w / 2, z + 0.44], [x + w / 2, z + 0.44], y + 0.2, detail);
  if (detail > 1)
    for (const dx of [-w * 0.3, w * 0.3])
      beam(o, 'concrete', [x + dx, y - 0.7, z - 0.2], [x + dx, y, z + 0.3], 0.18, 0.25, white);
}
function tiledBand(o, x, y, z, w, h, detail) {
  face(o, 'concrete', x, y, z, w, h, blue);
  if (detail < 2) return;
  for (let xx = x - w / 2 + 0.25; xx < x + w / 2; xx += 0.6) {
    face(o, 'concrete', xx, y + h * 0.4, z + 0.02, 0.18, h * 0.35, gold);
  }
}
function bellTower(o, x, z, detail) {
  B(o, 'concrete', x, 0, z, 6.8, 23, 9.8, white);
  for (const [y, h, w, d] of [
    [12, 0.35, 7.0, 10],
    [20.1, 0.4, 7.5, 10.4],
    [22.7, 0.4, 7.4, 10.3],
  ])
    B(o, 'concrete', x, y, z, w, h, d, white);
  if (detail) {
    for (const side of [0, 1, -1]) {
      const f = facing(o, (side * Math.PI) / 2, x + side * 3.4, z + (side === 0 ? 4.9 : 0));
      win(f, 0, 13.2, 0.05, 1.2, 2.3, detail);
      win(f, 0, 17.0, 0.05, 1.2, 2.0, detail);
      balcony(f, 0, 13.1, 0.3, 2, detail);
      balcony(f, 0, 16.9, 0.3, 2, detail);
    }
  }
  cylinder(o, x, z, 3.5, 23, 4.8, white, 8);
  cylinder(o, x, z, 3.8, 27.5, 0.45, white, 8);
  if (detail > 2)
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) * tau) / 8,
        fo = facing(o, Math.PI / 2 - a, x + Math.cos(a) * 3.25, z + Math.sin(a) * 3.25);
      arch(fo, 0, 23.7, 0.05, 1.3, 3.2, 2, { fill: stucco, col: white });
      for (const yy of [24.4, 25, 25.6, 26.2]) face(fo, 'concrete', 0, yy, 0.1, 0.75, 0.1, white);
    }
  // Paired bell arches on all eight facets surround an open inner volume.
  const rr = 3.45,
    faceRadius = rr * Math.cos(Math.PI / 8),
    fw = 2 * rr * Math.sin(Math.PI / 8);
  if (!detail) cylinder(o, x, z, rr, 27.95, 3.7, dark, 8);
  else
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) * tau) / 8,
        fx = x + Math.cos(a) * faceRadius,
        fz = z + Math.sin(a) * faceRadius,
        fo = facing(o, Math.PI / 2 - a, fx, fz);
      for (const dx of [-fw / 4, fw / 4])
        arch(fo, dx, 28.1, 0, fw / 2 - 0.3, 2.9, detail, { open: true, col: blue });
      for (const dx of [-fw / 2, 0, fw / 2]) B(fo, 'concrete', dx, 28.0, 0, 0.18, 3.5, 0.27, white);
      B(fo, 'concrete', 0, 31.25, 0, fw, 0.3, 0.24, white);
      if (detail > 2) {
        for (const dx of [-fw / 4, fw / 4]) {
          cylinder(fo, dx, -0.25, 0.25, 29.0, 0.4, wood, 8, 0.15, 'metal');
          beam(fo, 'metal', [dx, 29.4, -0.25], [dx, 30.6, -0.25], 0.045, 0.045, wood);
        }
        tiledBand(fo, 0, 27.95, 0.18, fw, 0.22, detail);
      }
    }
  cylinder(o, x, z, 3.8, 31.6, 0.4, white, 8);
  cylinder(o, x, z, 2.0, 32, 1.7, white, 8);
  if (detail)
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) * tau) / 8,
        fo = facing(o, Math.PI / 2 - a, x + Math.cos(a) * 1.87, z + Math.sin(a) * 1.87);
      arch(fo, 0, 32.2, 0.04, 0.8, 1.2, detail, { fill: dark });
    }
  loft(
    o,
    'concrete',
    [
      radialRing(33.7, 2.05, 2.05, detail ? 16 : 8, [x, z]),
      radialRing(34.2, 1.8, 1.8, detail ? 16 : 8, [x, z]),
      radialRing(34.8, 0.8, 0.8, detail ? 16 : 8, [x, z]),
      radialRing(35.0, 0.12, 0.12, detail ? 16 : 8, [x, z]),
    ],
    gold,
  );
  beam(o, 'metal', [x, 35, z], [x, 37, z], 0.08, 0.08, gold);
  beam(o, 'metal', [x - 0.65, 36.3, z], [x + 0.65, 36.3, z], 0.075, 0.075, gold);
  if (detail > 1)
    for (let i = 0; i < 8; i++) {
      const a = (i * tau) / 8,
        xx = x + Math.cos(a) * 3.5,
        zz = z + Math.sin(a) * 3.5;
      cylinder(o, xx, zz, 0.16, 32, 0.7, white, 6, 0.03);
    }
}
function outlineWindows(o, points, ys, detail, frontLimit = Infinity, include = () => true) {
  if (!detail) return;
  const r = ring(points);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    if (len < 3 || (a[1] + b[1]) / 2 > frontLimit || !include(a, b)) continue;
    const nx = dz / len,
      nz = -dx / len,
      n = Math.max(1, Math.floor(len / 3.7));
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n,
        f = facing(o, Math.atan2(nx, nz), a[0] + dx * t + nx * 0.04, a[1] + dz * t + nz * 0.04);
      for (const y of ys) win(f, 0, y, 0, 1.15, 1.8, detail);
    }
  }
}
function entrancePortal(o, detail) {
  // The stone aperture is rectangular; the semicircular arch belongs to the inset metal grille.
  for (const x of [-2.85, 2.85]) B(o, 'concrete', x, 0.2, 1.1, 1.5, 8.3, 0.7, stucco);
  B(o, 'concrete', 0, 6.5, 1.1, 4.2, 2, 0.7, stucco);
  B(o, 'concrete', 0, 0.2, 1.35, 4.2, 0.15, 0.9, white);
  for (const [z, y] of [
    [2.15, 0.175],
    [1.8, 0.35],
  ])
    B(o, 'concrete', 0, 0, z, 4.8, y, 0.4, white);
  // The inner sides and underside of these blocks are the actual reveals.
  face(o, 'metal', 0, 0.35, 0.9, 4.2, 6.15, dark);
  if (!detail) return;
  const z = 1.08,
    n = detail > 2 ? 12 : 6;
  for (let i = 0; i <= n; i++) {
    const x = -1.85 + (3.7 * i) / n;
    beam(o, 'metal', [x, 0.5, z], [x, 4.35, z], 0.035, 0.035, gold);
  }
  for (const y of [1.2, 4.35]) beam(o, 'metal', [-1.9, y, z], [1.9, y, z], 0.05, 0.05, gold);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 8,
      b = ((i + 1) * Math.PI) / 8;
    beam(
      o,
      'metal',
      [Math.cos(a) * 1.85, 4.4 + Math.sin(a) * 1.85, z],
      [Math.cos(b) * 1.85, 4.4 + Math.sin(b) * 1.85, z],
      0.055,
      0.055,
      gold,
    );
  }
  for (let i = 0; i <= (detail > 2 ? 12 : 4); i++) {
    const a = (i * Math.PI) / (detail > 2 ? 12 : 4);
    beam(
      o,
      'metal',
      [0, 4.4, z],
      [Math.cos(a) * 1.85, 4.4 + Math.sin(a) * 1.85, z],
      0.025,
      0.025,
      gold,
    );
  }
}
function mainHouse(o, frame, detail) {
  const f = frame.features[0];
  prism(o, f.rings[0], -9.0, 0, stucco, stucco);
  // Keep the generalized map front projection below grade; the researched white
  // facade is authored separately and must not be occluded by a beige envelope.
  const clipped = [];
  for (let i = 0; i < f.rings[0].length; i++) {
    const a = f.rings[0][i],
      b = f.rings[0][(i + 1) % f.rings[0].length],
      cut = -10.4;
    if (a[1] <= cut) clipped.push(a);
    if (a[1] <= cut !== b[1] <= cut) {
      const t = (cut - a[1]) / (b[1] - a[1]);
      clipped.push([a[0] + t * (b[0] - a[0]), cut]);
    }
  }
  prism(o, clipped, -9, 12.5, stucco, stucco);
  outlineWindows(o, f.rings[0], [2.3, 6.3, 10.0], detail > 2 ? detail : 1, -12);
  B(o, 'concrete', 0, 0, -5.2, 26.9, 19, 10.5, white);
  B(o, 'concrete', -1.3, 0, -22, 13.2, 17.5, 23, stucco);
  hip(o, -1.3, -22, 14.2, 23.5, 17.5, 2.4, detail);
  hip(o, -3, -39.5, 73.8, 11.8, 12.5, 2.5, detail);
  hip(o, -34.1, -52, 13.2, 35, 12.5, 2.6, detail);
  hip(o, 27.8, -53, 11.5, 36.8, 12.5, 2.3, detail);
  for (const [x, z] of [
    [-35, -62],
    [28, -64],
    [-34, -34],
    [28, -37],
  ]) {
    B(o, 'concrete', x, 0, z, 5.5, 20, 5.7, stucco);
    B(o, 'concrete', x, 19.8, z, 5.8, 0.5, 6.0, white);
    if (detail)
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const fo = facing(o, a, x + Math.sin(a) * 2.77, z + Math.cos(a) * 2.87);
        for (const yy of [3.0, 7.0, 11.0, 15.5])
          win(fo, 0, yy, 0.04, 1, 1.8, detail > 2 ? detail : 1);
      }
  }
  for (const x of [-10.1, 10.1]) bellTower(o, x, -4.9, detail);
  // Ornate central portal and the raised wooden balcony beneath its broad tile eave.
  for (const [y, h] of [
    [0.3, 0.35],
    [11.9, 0.6],
    [12.65, 0.26],
    [18.8, 0.45],
  ]) {
    if (y === 0.3) {
      // The low stone band stops at the doorway instead of projecting through its floor.
      for (const x of [-7.85, 7.85]) B(o, 'concrete', x, y, 0.65, 11.5, h, 0.6, white);
    } else B(o, 'concrete', 0, y, 0.65, 27.2, h, 0.6, white);
  }
  entrancePortal(o, detail);
  if (detail) {
    for (const x of [-5.7, -3.5, 3.5, 5.7]) {
      B(o, 'concrete', x, 0.3, 1.0, 0.35, 11.1, 0.65, white);
      for (const yy of [1.1, 3.5, 6, 8.8, 10.8])
        B(o, 'concrete', x, yy, 1.2, 0.65, 0.18, 0.85, white);
    }
    for (const x of [-4.8, 4.8]) win(o, x, 0.7, 0.72, 0.85, 2.0, detail);
    for (const yy of [6.5, 8.4]) B(o, 'concrete', 0, yy, 1.55, 8.4, 0.32, 0.55, white);
    arch(o, 0, 9.0, 0.82, 1.3, 2.4, detail, { fill: stucco });
  }
  for (const x of [-5.3, 0, 5.3]) win(o, x, 15.95, 0.08, 2.1, 2.7, detail);
  balcony(o, 0, 15.6, 1.1, 11.8, detail);
  if (detail > 2) {
    for (const x of [-5.7, -3.5, 3.5, 5.7]) {
      for (const yy of [1.6, 2.6, 4.4, 5.4, 7.2, 8.2, 9.7]) {
        B(o, 'concrete', x, yy, 1.3, 0.55, 0.23, 0.3, white);
        cylinder(o, x, 1.25, 0.26, yy + 0.2, 0.33, white, 6, 0.13);
      }
    }
    for (const x of [-2.65, 2.65]) {
      B(o, 'concrete', x, 0.3, 1.65, 0.5, 7.3, 0.4, white);
      for (const y of [1.0, 3.0, 5.0, 6.5])
        sphere(o, 'concrete', [x, y, 1.85], [0.28, 0.4, 0.16], white, 6, 4);
    }
    for (const y of [8.5, 10.9, 12.5])
      for (let x = -6; x <= 6; x += 1.0) {
        B(o, 'concrete', x, y, 1.25, 0.25, 0.25, 0.2, white);
      }
  }
  o.addTriangle(
    'metal',
    ref,
    [
      [-9.1, 19, 0.2],
      [9.1, 19, 0.2],
      [0, 21.3, 0.2],
    ],
    [0, 0, 1],
    [
      [0, 0],
      [18.2, 0],
      [9.1, 2.3],
    ],
    wood,
  );
  B(o, 'concrete', 0, 19, -4.6, 11, 2.4, 7.5, white);
  hip(o, 0, -4.6, 11.6, 8, 21.4, 1.4, detail);
  // Front balcony has a shallow gable and deep timber overhang, rather than a generic hip.
  for (const sign of [-1, 1]) {
    const p = [
      [sign * 9.1, 19.0, 2.9],
      [sign * 9.1, 19.0, -0.7],
      [0, 21.3, -0.7],
      [0, 21.3, 2.9],
    ];
    let n = normalFor(...p);
    if (n[1] < 0) {
      p.reverse();
      n = normalFor(...p);
    }
    quad(o, 'roof', p, n, tile);
    const under = p.map((q) => [q[0], q[1] - 0.18, q[2]]);
    quad(
      o,
      'metal',
      under,
      [...n].map((v) => -v),
      wood,
    );
    quad(o, 'roof', [p[0], p[3], under[3], under[0]], [0, 0, 1], tile);
  }
  if (detail)
    for (const x of [-8, -6, -4, -2, 0, 2, 4, 6, 8]) {
      const yy = 21.3 - (Math.abs(x) / 9.1) * 2.3;
      beam(o, 'metal', [x, yy - 0.13, -0.5], [x, yy - 0.13, 2.9], 0.2, 0.25, wood);
      if (detail > 1) beam(o, 'metal', [x, 17.8, 0.1], [x, yy - 0.1, 1.6], 0.2, 0.22, wood);
    }
  for (const x of [-7, 7]) {
    B(o, 'concrete', x, 20, -8, 1.1, 2.7, 1.1, white);
    B(o, 'concrete', x, 22.6, -8, 1.4, 0.3, 1.4, white);
  }
  // Entrance landing and broad red stair cascade connect to the lower front terrace.
  B(o, 'concrete', 0, -2.9, 3.8, 31, 2.9, 6.7, white);
  for (let i = 0; i < 15; i++)
    B(o, 'roof', 0, -2.8 + i * 0.19, 12.0 - i * 0.42, 19.5, 0.2, 0.44, tile);
  for (const x of [-12.4, 12.4]) {
    B(o, 'concrete', x, -3.0, 8.8, 3.6, 1.8, 5.8, white);
    if (detail) railing(o, [x - 1.6, 5.9], [x - 1.6, 11.7], -1.2, detail);
  }
}
function guest(o, feature, role, detail) {
  const r = feature.rings[0],
    levels = { monte: [-12, -1.0], mar: [-11, 4.2], sol: [-14.7, -2.0] },
    [bottom, top] = levels[role];
  prism(o, r, bottom, top, stucco, stucco);
  outlineWindows(
    o,
    r,
    role === 'monte' ? [-4.8] : role === 'mar' ? [-5.8, -1.1] : [-8.5, -6.7],
    detail > 2 ? detail : 1,
    Infinity,
    (a, b) =>
      role !== 'sol' ||
      ((a[0] + b[0]) / 2 + 14.3) * Math.sin(-0.26) + ((a[1] + b[1]) / 2 - 79.2) * Math.cos(-0.26) <
        7,
  );
  const settings = {
      monte: { x: -35.4, z: 39.0, w: 19.0, d: 23.5, angle: 0.07 },
      mar: { x: 24, z: 59.0, w: 19.4, d: 24, angle: -0.85 },
      sol: { x: -14.3, z: 79.2, w: 19.5, d: 19, angle: -0.26 },
    },
    s = settings[role],
    fo = facing(o, s.angle, s.x, s.z);
  const roofParts =
    role === 'monte'
      ? [
          [-2.3, 0, 12, 21],
          [6.5, -6.8, 4.8, 7.8],
          [6.5, 6.5, 4.8, 8.2],
        ]
      : role === 'mar'
        ? [
            [2, 0, 10.5, 25.8],
            [-6, -5.8, 6.5, 7.5],
            [-6, 6.1, 6.5, 7.8],
            [8.7, 0, 3.9, 9.2],
          ]
        : [
            [1, 3.9, 18.7, 12.4],
            [-6.5, -5.4, 7.8, 7.7],
            [10, -3.5, 7.8, 5.1],
          ];
  for (const [x, z, w, d] of roofParts) hip(fo, x, z, w, d, top, 1.25, detail);
  for (const xx of [-s.w * 0.33, s.w * 0.33]) {
    B(fo, 'concrete', xx, top - 0.5, -2, 1.2, 3.4, 1.3, white);
    B(fo, 'concrete', xx, top + 2.6, -2, 1.65, 0.35, 1.7, white);
  }
  if (detail) {
    const wallY = role === 'monte' ? -5.2 : role === 'mar' ? -1.3 : -6.8;
    tiledBand(fo, 0, top - 0.7, s.d / 2 + 0.2, s.w, 0.42, detail);
    if (role !== 'monte') {
      B(fo, 'concrete', 0, wallY, s.d / 2 + 0.55, 9.1, 0.25, 2.0, white);
      for (const xx of [-3, 0, 3])
        arch(fo, xx, wallY + 0.25, s.d / 2 + 1.3, 2.5, 4.0, detail, { fill: dark, col: white });
      hip(fo, 0, s.d / 2 + 0.5, 10, 3.2, wallY + 4.6, 0.8, detail);
    }
  }
  if (role === 'sol') {
    B(fo, 'concrete', 1, -17, 17, 24, 6.4, 9, white);
    B(fo, 'roof', 1, -10.6, 17, 24, 0.1, 9, tile);
    if (detail > 1) {
      for (const x of [-6.8, 6.8]) win(fo, x, -6.4, 9.85, 3.7, 1.8, detail);
      for (const x of [-6.7, 0, 6.7]) win(fo, x, -8.5, 9.87, 1, 1.5, detail);
      railing(fo, [-11, 21.3], [13, 21.3], -10.5, detail);
    }
    if (detail > 2) {
      cylinder(fo, 1, 19, 2.0, -10.5, 0.3, white, 16);
      cylinder(fo, 1, 19, 0.35, -10.2, 2.0, white, 8);
      cylinder(fo, 1, 19, 1.1, -8.5, 0.25, white, 12, 0.6);
      cylinder(fo, 1, 19, 0.2, -8.2, 1.2, white, 8);
    }
  }
  if (detail > 1 && role === 'sol') {
    for (const x of [-8.5, 9.5])
      for (let i = 0; i < 21; i++)
        B(fo, 'roof', x, -17, 11 + i * 0.38, 3.2, 10.2 - i * 0.18, 0.4, tile);
    for (let i = 0; i < 16; i++)
      B(fo, 'roof', 1, -18, 21.6 + i * 0.36, 6, 7.4 - i * 0.18, 0.38, tile);
  }
}
function arcade(o, x, z, r, a0, a1, y, detail) {
  const n = detail > 1 ? 10 : 6,
    pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([x + Math.cos(a) * r, z + Math.sin(a) * r]);
  }
  for (let i = 0; i < n; i++) {
    const a = pts[i],
      b = pts[i + 1];
    beam(o, 'concrete', [a[0], y + 4.8, a[1]], [b[0], y + 4.8, b[1]], 2.0, 0.65, white);
  }
  for (const p of pts) {
    cylinder(o, p[0], p[1], 0.29, y, 4.5, white, detail > 1 ? 12 : 6);
    cylinder(o, p[0], p[1], 0.46, y, 0.22, white, 8);
    cylinder(o, p[0], p[1], 0.48, y + 4.3, 0.25, white, 8);
  }
}
function neptune(o, frame, detail) {
  const center = frame.pointControls.find((p) => p.name === 'Neptune Pool').point,
    [x, z] = center,
    y = -13.2;
  const fo = facing(o, -0.65, x, z);
  // State Parks dimensions; modeled raised basin and curved colonnades on the lower terrace.
  prism(
    fo,
    [
      [-8, -18],
      [8, -18],
      [8, -10],
      [22, -8],
      [25, 0],
      [22, 10],
      [16, 13],
      [-16, 13],
      [-22, 10],
      [-25, 0],
      [-22, -8],
      [-8, -10],
    ],
    -22,
    y,
    white,
    white,
  );
  B(fo, 'glass', 0, y + 0.015, 0, 31.7, 0.06, 17.68, water);
  B(fo, 'glass', 0, y + 0.02, -9.5, 15.5, 0.06, 10.5, water);
  for (const xx of [-16.1, 16.1]) B(fo, 'concrete', xx, y + 0.05, 0, 0.6, 0.28, 18.7, white);
  B(fo, 'concrete', 0, y + 0.05, 9.1, 32.5, 0.28, 0.6, white);
  for (const xx of [-12, 12]) B(fo, 'concrete', xx, y + 0.05, -9.1, 7.5, 0.28, 0.6, white);
  // Six-column temple facade on the far edge, plus the two curved flanking colonnades.
  B(fo, 'concrete', 0, y, -15.1, 13.6, 0.55, 5.0, white);
  B(fo, 'concrete', 0, y + 0.55, -16.4, 13, 7.0, 1.2, white);
  for (const xx of [-5, -3, -1, 1, 3, 5]) {
    cylinder(fo, xx, -13.3, 0.35, y + 0.5, 6.0, white, detail > 1 ? 16 : 8);
    cylinder(fo, xx, -13.3, 0.55, y + 0.5, 0.3, white, 8);
    cylinder(fo, xx, -13.3, 0.56, y + 6.15, 0.45, white, 8);
  }
  B(fo, 'concrete', 0, y + 6.6, -14.8, 14.1, 1.1, 4.9, white);
  const ped = [
    [-7.05, y + 7.7, -12.3],
    [7.05, y + 7.7, -12.3],
    [0, y + 10, -12.3],
  ];
  o.addTriangle(
    'concrete',
    ref,
    ped.map((p) => {
      const co = Math.cos(-0.65),
        si = Math.sin(-0.65);
      return [x + co * p[0] + si * p[2], p[1], z - si * p[0] + co * p[2]];
    }),
    [Math.sin(-0.65), 0, Math.cos(-0.65)],
    [
      [0, 0],
      [14, 0],
      [7, 2.3],
    ],
    white,
  );
  arcade(fo, -12, 0, 12, Math.PI * 0.48, Math.PI * 1.1, y, detail);
  arcade(fo, 12, 0, 12, -Math.PI * 0.1, Math.PI * 0.52, y, detail);
  if (detail > 1) {
    for (const xx of [-13.5, 13.5]) {
      B(fo, 'concrete', xx, y + 0.5, -11.4, 1.7, 0.8, 1.7, white);
      sphere(fo, 'concrete', [xx, y + 2, -11.4], [0.48, 0.75, 0.45], white, 8, 5);
    }
    for (let zz = -7; zz < 9; zz += 3) B(fo, 'metal', 0, y + 0.09, zz, 31.5, 0.012, 0.06, blue);
    for (let xx = -14; xx < 15; xx += 3) B(fo, 'metal', xx, y + 0.09, 0, 0.06, 0.012, 17.5, blue);
  }
}
function roman(o, feature, detail) {
  const r = feature.rings[0];
  prism(o, r, -19.3, -6.8, stucco, rgb('81917b'));
  outlineWindows(o, r, [-16.5, -12.7], detail > 2 ? detail : 1);
  const fo = facing(o, -0.68, -57.4, -102.5);
  if (detail) {
    for (const zz of [-7, 7]) {
      for (const xx of [-9, 9]) B(fo, 'concrete', xx, -6.72, zz, 0.08, 0.025, 12, white);
      for (const dz of [-6, 0, 6]) B(fo, 'concrete', 0, -6.72, zz + dz, 18, 0.025, 0.08, white);
    }
  }
}
function build(o, detail) {
  const frame = JSON.parse(fs.readFileSync(framePath));
  mainHouse(facing(o, 0, 0, 0, 3.8), frame, detail);
  for (const [i, role] of [
    [1, 'monte'],
    [2, 'mar'],
    [3, 'sol'],
  ])
    guest(role === 'sol' ? facing(o, 0, 0, 0, -4) : o, frame.features[i], role, detail);
  roman(o, frame.features[4], detail);
  neptune(o, frame, detail);
  // Immediate forecourt. Hill, trees and landscaping remain the viewer's terrain/context.
  B(o, 'concrete', -1.5, -7, 20, 34, 7.8, 21, white);
  B(o, 'roof', -1.5, 0.8, 20, 34, 0.1, 21, tile);
  cylinder(o, -3.5, 18.9, 4.5, 0.9, 0.35, white, detail > 1 ? 40 : 16);
  cylinder(o, -3.5, 18.9, 4.1, 1.24, 0.05, water, detail > 1 ? 40 : 16, 4.1, 'glass');
  if (detail) {
    cylinder(o, -3.5, 18.9, 0.75, 1.3, 1.2, white, 8);
    sphere(o, 'concrete', [-3.5, 3.0, 18.9], [0.6, 0.9, 0.45], white, detail > 1 ? 12 : 8, 6);
  }
}
export function hearst(o) {
  build(o, 3);
}
export function hearstDistrict(o) {
  hearstSkyline(o);
  const f = facing(o, 0, 0, 0, 3.8);
  for (const xx of [-10.1, 10.1]) {
    for (const side of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const fo = facing(f, side, xx + Math.sin(side) * 3.4, -4.9 + Math.cos(side) * 4.9);
      for (const y of [13.2, 17]) win(fo, 0, y, 0.05, 1.2, 2.2, 0);
    }
  }
  for (const x of [-5.7, -3.5, 3.5, 5.7]) B(f, 'concrete', x, 0.3, 1, 0.35, 11.1, 0.65, white);
  for (const x of [-5.3, 0, 5.3]) win(f, x, 15.95, 0.08, 2.1, 2.7, 0);
  B(f, 'concrete', 0, 15.6, 1.1, 11.8, 0.2, 0.9, white);
  const frame = JSON.parse(fs.readFileSync(framePath));
  outlineWindows(f, frame.features[0].rings[0], [2.3, 6.3, 10], 1, -12);
  for (let i = 1; i <= 3; i++)
    outlineWindows(o, frame.features[i].rings[0], [i === 3 ? -10 : -5], 1);
  for (const [x, z] of [
    [-35, -62],
    [28, -64],
    [-34, -34],
    [28, -37],
  ])
    B(f, 'concrete', x, 12.5, z, 5.5, 7.5, 5.7, stucco);
  const pool = facing(o, -0.65, -64.5337, 89.107);
  for (const x of [-5, -3, -1, 1, 3, 5]) cylinder(pool, x, -12.3, 0.35, -12.7, 6, white, 6);
  arcade(pool, -12, 0, 12, Math.PI * 0.48, Math.PI * 1.1, -13.2, 0);
  arcade(pool, 12, 0, 12, -Math.PI * 0.1, Math.PI * 0.52, -13.2, 0);
}
export function hearstStreet(o) {
  build(o, 2);
}
export function hearstSkyline(o) {
  const main = facing(o, 0, 0, 0, 3.8);
  entrancePortal(main, 0);
  // Purpose-built skyline preserves the detached hilltop masses within 1000 triangles.
  B(main, 'concrete', 0, -9, -5, 27, 28, 11, white);
  B(main, 'concrete', -1.3, -9, -22, 13, 26.5, 23, stucco);
  B(main, 'concrete', -3, -9, -39.5, 73.8, 21.5, 11.8, stucco);
  B(main, 'concrete', -34.1, -9, -52, 13.2, 21.5, 35, stucco);
  B(main, 'concrete', 27.8, -9, -53, 11.5, 21.5, 36.8, stucco);
  for (const [x, z, w, d, y] of [
    [-1.3, -22, 14.2, 23.5, 17.5],
    [-3, -39.5, 73.8, 11.8, 12.5],
    [-34.1, -52, 13.2, 35, 12.5],
    [27.8, -53, 11.5, 36.8, 12.5],
  ])
    hip(main, x, z, w, d, y, 2, 0);
  main.addTriangle(
    'metal',
    ref,
    [
      [-9.1, 19, 0.2],
      [9.1, 19, 0.2],
      [0, 21.3, 0.2],
    ],
    [0, 0, 1],
    [
      [0, 0],
      [18.2, 0],
      [9.1, 2.3],
    ],
    wood,
  );
  B(main, 'concrete', 0, 19, -4.6, 11, 2.4, 7.5, white);
  hip(main, 0, -4.6, 11.6, 8, 21.4, 1.4, 0);
  for (const sign of [-1, 1]) {
    const p = [
      [sign * 9.1, 19, 2.9],
      [sign * 9.1, 19, -0.7],
      [0, 21.3, -0.7],
      [0, 21.3, 2.9],
    ];
    let n = normalFor(...p);
    if (n[1] < 0) n = n.map((v) => -v);
    quad(main, 'roof', p, n, tile);
    quad(
      main,
      'metal',
      p.map((q) => [q[0], q[1] - 0.18, q[2]]),
      n.map((v) => -v),
      wood,
    );
  }
  for (const x of [-10.1, 10.1]) {
    B(main, 'concrete', x, 19, -4.9, 6.8, 4, 9.8, white);
    cylinder(main, x, -4.9, 3.5, 23, 4.8, white, 8);
    for (let i = 0; i < 8; i++) {
      const a = (i * tau) / 8;
      B(
        main,
        'concrete',
        x + Math.cos(a) * 3.45,
        27.8,
        -4.9 + Math.sin(a) * 3.45,
        0.32,
        4.2,
        0.32,
        white,
      );
    }
    cylinder(main, x, -4.9, 3.8, 31.6, 0.4, white, 8);
    cylinder(main, x, -4.9, 2, 32, 3, gold, 8, 0.2);
  }
  for (const [x, z, w, d, b, t, a] of [
    [-35.4, 39, 19, 23.5, -12, -1, 0.07],
    [24, 59, 19.4, 24, -11, 4.2, -0.85],
    [-14.3, 79.2, 19.5, 19, -18.7, -6, -0.26],
  ]) {
    const fo = facing(o, a, x, z);
    B(fo, 'concrete', 0, b, 0, w, t - b, d, stucco);
    hip(fo, 0, 0, w + 0.5, d + 0.5, t, 1.7, 0);
  }
  const fo = facing(o, -0.68, -57.4, -102.5);
  B(fo, 'concrete', 0, -19.3, 0, 41, 12.5, 42, stucco);
  B(o, 'concrete', -1.5, -7, 20, 34, 7.8, 21, white);
  const pool = facing(o, -0.65, -64.5337, 89.107);
  B(pool, 'concrete', 0, -22, 0, 48, 8.8, 31, white);
  B(pool, 'glass', 0, -13.15, 0, 31.7, 0.05, 17.68, water);
  B(pool, 'concrete', 0, -13.2, -15.1, 14, 7.7, 5, white);
}
const surfaces = { ...landmarkSurfaces, glass: { ...landmarkSurfaces.glass, localRef: ref } };
export const hearstModel = {
  id: 'hearst_castle',
  recipe: 'structure-hearst-castle.mjs',
  key: 'hearst_castle',
  cell: '9q/9q3',
  title: 'Hearst Castle',
  brief:
    'Casa Grande with twin tiled bell towers and timber balcony, its stepped rear wings, three distinct guest houses, Neptune pool temple and curved colonnades, Roman Pool exterior with rooftop tennis courts, and immediate entrance terraces.',
  camera: [155, 90, 210],
  lookAt: [-15, 0, 5],
  qaCameras: [
    { name: 'front', position: [0, 17, 65], lookAt: [0, 21, -3] },
    { name: 'back', position: [115, 75, -180], lookAt: [-15, 1, -25] },
    { name: 'entrance-portal', position: [7, 8, 13], lookAt: [0, 7, 1.1] },
    { name: 'entrance-reveals', position: [-2.8, 6, 5.5], lookAt: [0, 6, 1.1] },
  ],
  build: hearst,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  mediumFiContext: { scale: 3 },
  groundContactBasis:
    'Ground reference [0,3] near the Casa Grande entrance defines datum 492.9056 m. The physical forecourt deck is 0.8 m and the stair-top landing 3.8 m above this coarse terrain sample; retaining geometry is stepped without altering the DEM. Independent terrain controls range -18.30..0.95 m across five main building footprints. The raised Neptune pool deck is -13.2 m with retaining walls reaching -22 m, keeping temple columns above the coarse hillside. Casa del Sol has a roof eave at -6 m and lower terrace at -14.6 m; these inferred levels meet the independently sampled slope. Guest houses and pool are stepped below the main house; foundations and terrace retaining walls enter the hill. Exact ground and historic retaining levels are not surveyed.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hearst-castle.mjs',
    level: 'skyline',
    export: 'hearstSkyline',
    errorMeters: 5,
    authoredLevels: {
      district: { export: 'hearstDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'hearstStreet', errorMeters: 0.3, surfaces },
    },
  },
  limitations: [
    'Qualla public-domain corpus searched first. New portal construction follows the inspected original Daderot CC0 Casa Grande facade photograph; prior attribution-licensed imagery is excluded as a current control. Map/site layout and source ground retained; not an architectural or land survey.',
    'The rectangular stone entrance has actual jamb/head reveals, threshold steps, recessed metal grille with arched fan and opaque inner boundary. Width, 0.55 m depth, levels and ornament are photographic estimates; interiors are not modeled.',
    'Main facade and twin towers, rear wing layout, three guest-house footprints, pool temple/colonnades and terraced setting are retained. Fine carved figures, tile motifs, unseen window rhythms, interiors and complete garden ornament are generalized or omitted.',
    'The 1941 aerial is supplementary layout evidence only. Modern exterior photographs control visible fabric; exact current roof services and restoration details remain uncertain.',
    'Neptune pool center is mapped; basin dimensions come from California State Parks. Detailed curved perimeter, retaining joins and vertical terrace levels are interpretations, with unmodified host terrain retained for review.',
    'Guest roofs and hidden sides are conservative approximations. Outlying service buildings, the broader estate, vegetation and zoo are outside this model. Reference photos are not embedded or redistributed.',
  ],
};
