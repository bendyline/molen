/** Reichstag present exterior: historic sandstone walls and the Foster glass dome. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import { B, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL('../../../content/worldgen/source/places/u3/u33/reichstag/', import.meta.url);
const stone = rgb('c5b39a'),
  trim = rgb('dacbb0'),
  baseColor = rgb('a89780'),
  roof = rgb('587369'),
  metal = rgb('616d69'),
  glass = rgb('3f555b'),
  domeGlass = rgb('b2d0d5');
const ref = 'palette:#ffffff';
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
function prism(o, loops, low, high, color = stone, slot = 'wall') {
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
function column(o, x, y, z, r, h, d) {
  loft(
    o,
    'wall',
    [
      radialRing(y, r, r, d > 2 ? 12 : d > 1 ? 8 : 6, [x, z]),
      radialRing(y + h, r * 0.84, r * 0.84, d > 2 ? 12 : d > 1 ? 8 : 6, [x, z]),
    ],
    stone,
  );
  if (d > 2) {
    for (const [yy, rr, hh] of [
      [y, r * 1.3, 0.36],
      [y + 0.36, r * 1.13, 0.22],
      [y + h - 0.5, r * 1.12, 0.3],
    ])
      loft(
        o,
        'wall',
        [radialRing(yy, rr, rr, 12, [x, z]), radialRing(yy + hh, rr, rr, 12, [x, z])],
        trim,
      );
    B(o, 'wall', x, y + h - 0.16, z, r * 2.7, 0.45, r * 2.7, trim);
    if (d > 2)
      for (const a of [-0.8, 0.8])
        for (const zz of [-0.8, 0.8])
          B(o, 'wall', x + a * r, y + h - 0.9, z + zz * r, r * 0.7, 0.75, r * 0.7, stone);
  }
}
function pediment(o, x, y, z, w, h, d) {
  const pts = [
    [x - w / 2, y, z],
    [x + w / 2, y, z],
    [x, y + h, z],
  ];
  o.addTriangle(
    'wall',
    ref,
    pts,
    [0, 0, 1],
    pts.map((p) => [p[0], p[1]]),
    baseColor,
  );
  const back = pts.map((p) => [p[0], p[1], p[2] - 0.6]);
  o.addTriangle(
    'wall',
    ref,
    back,
    [0, 0, -1],
    back.map((p) => [p[0], p[1]]),
    stone,
  );
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    quad(o, 'wall', [pts[i], pts[j], back[j], back[i]], [0, i ? 1 : -1, 0], trim);
  }
  if (d) {
    B(o, 'wall', x, y - 0.25, z, w + 0.65, 0.4, 0.6, trim);
    for (const sign of [-1, 1])
      beam(o, 'wall', [x + (sign * w) / 2, y, z], [x, y + h, z], 0.35, 0.55, trim);
  }
}
function window(o, x, y, z, w, h, d, arch = false) {
  if (!arch || d < 2) face(o, 'glass', x, y, z, w, h, glass);
  else {
    const r = w / 2,
      shoulder = y + h - r,
      pts = [
        [x - r, y, z],
        [x + r, y, z],
        [x + r, shoulder, z],
      ];
    for (let i = 1; i <= 8; i++) {
      const a = (i * Math.PI) / 8;
      pts.push([x + Math.cos(a) * r, shoulder + Math.sin(a) * r, z]);
    }
    o.addConvexPolygon('glass', ref, pts, [0, 0, 1], (p) => [p[0], p[1]], glass);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 8,
        b = ((i + 1) * Math.PI) / 8;
      quad(
        o,
        'wall',
        [
          [x + Math.cos(a) * r, shoulder + Math.sin(a) * r, z + 0.025],
          [x + Math.cos(b) * r, shoulder + Math.sin(b) * r, z + 0.025],
          [x + Math.cos(b) * (r + 0.23), shoulder + Math.sin(b) * (r + 0.23), z + 0.025],
          [x + Math.cos(a) * (r + 0.23), shoulder + Math.sin(a) * (r + 0.23), z + 0.025],
        ],
        [0, 0, 1],
        trim,
      );
    }
  }
  if (d < 2) return;
  for (const sign of [-1, 1])
    face(
      o,
      'wall',
      x + sign * (w / 2 + 0.11),
      y - 0.12,
      z + 0.03,
      0.22,
      arch ? h - w / 2 : h + 0.2,
      trim,
    );
  face(o, 'wall', x, y - 0.16, z + 0.05, w + 0.55, 0.2, trim);
  if (!arch) face(o, 'wall', x, y + h, z + 0.05, w + 0.5, 0.2, trim);
  if (d > 2) {
    face(o, 'trim', x, y, z + 0.07, 0.08, h, metal);
    for (const f of [0.33, 0.66]) face(o, 'trim', x, y + h * f, z + 0.075, w, 0.075, metal);
  }
}
function cornice(o, ring, y, d) {
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1],
      b = ring[i],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz);
    if (len < 0.05) continue;
    const nx = dz / len,
      nz = -dx / len;
    for (const [yy, projection, h] of d > 2
      ? [
          [y, 0.55, 0.45],
          [y - 0.6, 0.25, 0.2],
        ]
      : [[y, 0.45, 0.4]]) {
      const aa = [a[0] + nx * projection, yy, a[1] + nz * projection],
        bb = [b[0] + nx * projection, yy, b[1] + nz * projection];
      quad(o, 'wall', [aa, bb, [bb[0], yy + h, bb[2]], [aa[0], yy + h, aa[2]]], [nx, 0, nz], trim);
      quad(
        o,
        'wall',
        [
          [a[0], yy + h, a[1]],
          [b[0], yy + h, b[1]],
          [bb[0], yy + h, bb[2]],
          [aa[0], yy + h, aa[2]],
        ],
        [0, 1, 0],
        trim,
      );
      quad(o, 'wall', [[a[0], yy, a[1]], [b[0], yy, b[1]], bb, aa], [0, -1, 0], baseColor);
    }
  }
}
function wing(o, x, z, w, d) {
  const pitch = w / 5;
  for (let i = 0; i < 5; i++) {
    const xx = x - w / 2 + (i + 0.5) * pitch;
    window(o, xx, 5.6, z, 2.6, 7.4, d, true);
    window(o, xx, 16, z, 2.6, 5.3, d);
    if (d > 1) pediment(o, xx, 21.5, z + 0.08, 3.3, 1.15, d);
    if (d > 2) {
      window(o, xx, 1.1, z, 2, 2.1, d, true);
      B(o, 'wall', xx + pitch / 2, 4.8, z - 0.08, 0.78, 18.3, 0.36, stone);
      B(o, 'wall', xx + pitch / 2, 22.2, z, 0.99, 0.8, 0.55, trim);
      B(o, 'wall', xx, 13.65, z + 0.05, 3.6, 0.35, 0.3, trim);
    }
  }
}
function flag(o, x, z, d, europe = false) {
  if (!d) return;
  B(o, 'trim', x, 41.7, z, 0.12, 9, 0.12, metal);
  for (let i = 0; i < 3; i++)
    face(
      o,
      'trim',
      x + 1.55,
      46.8 + i * 0.78,
      z + 0.04,
      3,
      0.78,
      europe ? rgb('244f88') : [rgb('cda333'), rgb('9e3733'), rgb('25292b')][i],
    );
  if (d > 2 && europe)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      face(
        o,
        'trim',
        x + 1.55 + Math.cos(a) * 0.62,
        47.9 + Math.sin(a) * 0.62,
        z + 0.06,
        0.13,
        0.13,
        rgb('d9bb54'),
      );
    }
}
function tower(o, x, z, d, eu = false) {
  B(o, 'wall', x, 25, z, 15, 15.5, 15, stone);
  B(o, 'wall', x, 29.1, z, 16, 0.65, 16, trim);
  B(o, 'wall', x, 40.1, z, 16.4, 0.75, 16.4, trim);
  B(o, 'roof', x, 40.9, z, 15.5, 0.9, 15.5, roof);
  if (d) {
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const q = facing(o, a, x, z);
      for (const xx of [-4, 0, 4]) window(q, xx, 32.1, 7.56, 2, 4.7, d, true);
      if (d > 1)
        for (const xx of [-6.7, -2, 2, 6.7]) {
          B(q, 'wall', xx, 30, 7.55, 0.6, 9.5, 0.35, trim);
          if (d > 2) B(q, 'wall', xx, 39.25, 7.6, 1, 0.45, 0.6, trim);
        }
      if (d > 2) {
        for (let xx = -7.3; xx <= 7.3; xx += 1.15)
          B(q, 'wall', xx, 39.65, 8, 0.42, 0.4, 0.45, trim);
        for (const xx of [-6, -3, 0, 3, 6]) B(q, 'roof', xx, 41.6, 7, 0.38, 0.55, 0.4, roof);
      }
    }
    flag(o, x, z, d, eu);
  }
}
function dome(o, d) {
  const cx = 2.26,
    cz = 0.85,
    count = d === 0 ? 16 : d === 1 ? 24 : 48,
    levels = d === 0 ? 6 : d === 1 ? 8 : 17;
  const p = (i, j) => {
    const t = j / levels,
      rr = 20 * Math.sqrt(1 - (0.96824583655 * t) ** 2),
      a = (i * Math.PI * 2) / count;
    return [cx + rr * Math.cos(a), 24 + 23.5 * t, cz + rr * Math.sin(a)];
  };
  for (let j = 0; j < levels; j++)
    for (let i = 0; i < count; i++) {
      if (d > 0 && j / levels < 4 / 17) continue;
      const ps = [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)],
        mid = ((i + 0.5) * Math.PI * 2) / count;
      quad(
        o,
        d === 0 ? 'glass' : 'dome',
        ps,
        [Math.cos(mid), (0.8 * (j + 0.5)) / levels, Math.sin(mid)],
        d === 0 ? rgb('718b8b') : domeGlass,
      );
    }
  if (!d) return;
  // Flat rib strips preserve the slender steel silhouette within LOD budgets.
  const ribs = d === 1 ? 18 : 24;
  for (let k = 0; k < ribs; k++) {
    const i = (k * count) / ribs;
    for (let j = 0; j < levels; j++) {
      const a = p(i, j),
        b = p(i, j + 1),
        theta = (k * Math.PI * 2) / ribs,
        dx = -Math.sin(theta) * 0.085,
        dz = Math.cos(theta) * 0.085;
      quad(
        o,
        'trim',
        [
          [a[0] - dx, a[1], a[2] - dz],
          [a[0] + dx, a[1], a[2] + dz],
          [b[0] + dx, b[1], b[2] + dz],
          [b[0] - dx, b[1], b[2] - dz],
        ],
        [Math.cos(theta), 0.4, Math.sin(theta)],
        metal,
      );
    }
  }
  for (let j = 0; j <= levels; j++)
    for (let i = 0; i < count; i++) {
      const a = p(i, j),
        b = p(i + 1, j),
        q = [a, b, [b[0], b[1] + 0.1, b[2]], [a[0], a[1] + 0.1, a[2]]];
      quad(o, 'trim', q, [a[0] - cx, 0.3, a[2] - cz], metal);
    }
  if (d > 1) {
    // Reflector cone and paired peripheral ramps are legible through the shell; no interior rooms.
    loft(
      o,
      'trim',
      [radialRing(24.2, 1.4, 1.4, 24, [cx, cz]), radialRing(41, 7.5, 7.5, 24, [cx, cz])],
      rgb('abb5ae'),
      { cap: false },
    );
    for (const phase of [0, Math.PI]) {
      const steps = d > 2 ? 120 : 60;
      for (let i = 0; i < steps; i++) {
        const v = i / steps,
          vv = (i + 1) / steps,
          point = (t, r) => {
            const a = phase + t * Math.PI * 4;
            return [cx + r * Math.cos(a), 24.25 + t * 16.45, cz + r * Math.sin(a)];
          };
        const radius = (t) => 18.7 - 6.6 * t,
          ps = [
            point(v, radius(v)),
            point(vv, radius(vv)),
            point(vv, radius(vv) - 1.8),
            point(v, radius(v) - 1.8),
          ];
        quad(o, 'trim', ps, [0, 1, 0], rgb('b3b8b2'));
        quad(
          o,
          'trim',
          ps.map((p) => [p[0], p[1] - 0.08, p[2]]),
          [0, -1, 0],
          metal,
        );
        if (d > 2) {
          const a = ps[0],
            b = ps[1];
          quad(
            o,
            'trim',
            [a, b, [b[0], b[1] + 0.8, b[2]], [a[0], a[1] + 0.8, a[2]]],
            [a[0] - cx, 0, a[2] - cz],
            rgb('7c8a87'),
          );
        }
      }
    }
  }
}
function hip(o, x, z, w, dep, y, rise, tw, td) {
  const ring = (yy, ww, dd) => [
    [x - ww / 2, yy, z - dd / 2],
    [x - ww / 2, yy, z + dd / 2],
    [x + ww / 2, yy, z + dd / 2],
    [x + ww / 2, yy, z - dd / 2],
  ];
  loft(o, 'roof', [ring(y, w, dep), ring(y + rise, tw, td)], roof);
}
function porticoCeiling(o, x, d) {
  // The CC0 underside photograph resolves beams running back from the six
  // columns and crossing ties. Solid members leave shallow open coffers below
  // a continuous soffit; section sizes and concealed joints remain estimates.
  B(o, 'wall', x, 23.05, 48.025, 29, 0.12, 9.65, trim);
  for (const dx of [-14, -8.4, -2.8, 2.8, 8.4, 14])
    B(o, 'wall', x + dx, 22.55, 48.025, 0.42, 0.52, 9.65, stone);
  for (const z of d === 1 ? [46.4, 49.6] : [44, 46.8, 49.5, 52.1])
    B(o, 'wall', x, 22.67, z, 28, 0.4, 0.32, stone);
}
export function reichstag(o, frame, d = 3) {
  frame ??= JSON.parse(fs.readFileSync(new URL('map-frame.json', base), 'utf8'));
  const rings = frame.geometry.rings.map((r) => r.map((p) => p.slice()));
  // Cut back the wall behind the visitor columns, retaining the mapped portico footprint at plinth level.
  const body = rings.map((r, i) =>
    i ? r : r.map(([x, z]) => [x, x > -19 && x < 22 && z > 43.2 ? 43.2 : z]),
  );
  if (d) {
    prism(o, rings, -1.6, 3.4, baseColor, 'foundation');
    prism(o, body, 3.4, 23.6);
    prism(o, body, 23.6, 24, roof, 'roof');
    if (d > 1) for (const y of [3.3, 23.2]) cornice(o, body[0], y, d);
  } else {
    for (const [x, z, w, dep] of [
      [-53, 0, 29, 88],
      [57, 0, 27, 88],
      [1.6, -28.5, 82, 31],
      [1.6, 29, 82, 30],
      [2.2, 0, 50, 30],
    ])
      B(o, 'wall', x, -0.8, z, w, 24.8, dep, stone);
  }
  const towers = frame.features.filter((f) => [11, 12, 14, 15].includes(f.index));
  for (const f of towers) {
    const ps = f.rings[0],
      xs = ps.map((p) => p[0]),
      zs = ps.map((p) => p[1]),
      x = (Math.min(...xs) + Math.max(...xs)) / 2,
      z = (Math.min(...zs) + Math.max(...zs)) / 2;
    tower(o, x, z, d, f.index === 14);
  }
  // Open west visitor portico with a triangular sculptural pediment.
  const xx = 1.6;
  for (const x of [-14, -8.4, -2.8, 2.8, 8.4, 14]) column(o, xx + x, 3.4, 51.5, 1.03, 19.5, d);
  for (const sign of [-1, 1]) {
    B(o, 'wall', xx + sign * 14.25, 3.4, 49.5, 4.5, 19.6, 6.2, stone);
    if (d > 2)
      for (let i = 0; i < 6; i++) {
        B(o, 'wall', xx + sign * 14.25, 6 + i * 2.5, 52.64, 3.1, 1.7, 0.35, baseColor);
        B(o, 'wall', xx + sign * 14.25, 7.4 + i * 2.5, 52.87, 0.8, 0.7, 0.25, stone);
      }
  }
  B(o, 'wall', xx, 23, 49.6, 33, 1.6, 6.5, trim);
  pediment(o, xx, 24.7, 53.05, 32.5, 6.5, d);
  B(o, 'roof', xx, 24.75, 48.1, 31, 0.2, 9, roof);
  const steps = d > 2 ? 20 : d > 1 ? 10 : d ? 5 : 3;
  if (!d) B(o, 'foundation', xx, 3.2, 48.1, 30, 0.2, 10, trim);
  B(o, 'foundation', xx, -0.2, 59.5, 30, 3.6, 13, trim);
  for (let i = 0; i < steps; i++)
    B(
      o,
      'foundation',
      xx,
      (3.4 * i) / steps,
      73 - (i / steps) * 7,
      30,
      3.4 / steps,
      14 * (1 - i / steps),
      trim,
    );
  if (d) {
    face(o, 'glass', xx, 3.45, 43.25, 27.4, 19.1, glass);
    for (const x of [-9, -4.5, 0, 4.5, 9])
      B(o, 'trim', xx + x, 3.45, 43.36, 0.14, 19.1, 0.22, metal);
    for (const y of [10, 15, 20]) B(o, 'trim', xx, y, 43.36, 27, 0.14, 0.22, metal);
    porticoCeiling(o, xx, d);
    for (const [x, z] of [
      [-32.4, 43.5],
      [35, 43.9],
    ])
      wing(o, x, z + 0.08, 28, d);
    // Central east pavilion and paired wings seen in the northeast photograph.
    const east = facing(o, Math.PI, 2.1, -51.34);
    for (const x of [-7, 0, 7]) window(east, x, 0.8, 0.05, 4.1, 9, d, true);
    for (const x of [-10, -5, 0, 5, 10]) window(east, x, 12, 0.05, 2.5, 8.8, d);
    if (d > 1)
      for (const x of [-12.8, -7.5, -2.5, 2.5, 7.5, 12.8])
        column(east, x, 10.6, 0.7, 0.65, 12.1, d);
    B(east, 'wall', 0, 23.1, 0, 30.5, 1.2, 2, trim);
    B(east, 'wall', 0, 24.3, -2.5, 29, 3.8, 6, stone);
    B(east, 'wall', 0, 28.1, -2.5, 30, 0.4, 6.7, trim);
    if (d > 1)
      for (const x of [-13, 13]) {
        B(east, 'wall', x, 24.3, -2, 2.8, 6.4, 4, stone);
        B(east, 'wall', x, 30.7, -2, 3.5, 0.5, 4.5, trim);
      }
    for (const [x, z] of [
      [-31.7, -42.73],
      [35.8, -42.29],
    ]) {
      const q = facing(o, Math.PI, x, z);
      for (let i = 0; i < 5; i++) {
        const xx = (i - 2) * 5.4;
        for (const [y, h] of [
          [5.4, 3.5],
          [10.4, 3.5],
          [16, 5.3],
        ])
          window(q, xx, y, 0.06, 2.6, h, d);
        if (d > 1) pediment(q, xx, 21.5, 0.14, 3.3, 1.15, d);
        if (d > 2) {
          window(q, xx, 0.7, 0.08, 1.8, 2.3, d, true);
          B(q, 'wall', xx + 2.7, 4.8, 0, 0.65, 18.3, 0.3, stone);
        }
      }
    }
    // Short facades use separate central, wing and corner wall planes from the mapped outline.
    for (const sign of [-1, 1]) {
      const side = facing(o, (sign * Math.PI) / 2, sign > 0 ? 67.93 : -64.5, 0.5);
      const wings = facing(o, (sign * Math.PI) / 2, sign > 0 ? 66.69 : -63.3, 0.5);
      for (const x of [-22, -17, -12, 12, 17, 22]) {
        for (const [y, h] of [
          [5.5, 3.5],
          [10.4, 3.5],
          [16, 5.2],
        ])
          window(wings, x, y, 0.05, 2.7, h, d);
        if (d > 1) pediment(wings, x, 21.5, 0.13, 3.3, 1.15, d);
      }
      window(side, 0, 4.5, 0.2, 5.7, 8.3, d, true);
      window(side, 0, 16, 0.2, 2.8, 5.3, d);
      for (const x of [-6.7, 6.7]) {
        for (const [y, h] of [
          [5.5, 3.5],
          [10.4, 3.5],
          [16, 5.2],
        ])
          window(side, x, y, 0.2, 2.7, h, d);
      }
      pediment(side, 0, 24, 0.6, 22, 5.1, d);
      if (d > 1) for (const x of [-8.8, -4.4, 4.4, 8.8]) column(side, x, 4.8, 0.75, 0.65, 18, d);
    }
    // Monumental arches and paired columns on both outward faces of every corner pavilion.
    const corners = [
      [0, -55.52, 47.08],
      [0, 58.4, 47.81],
      [Math.PI, -54.97, -46.65],
      [Math.PI, 59.13, -45.93],
      [-Math.PI / 2, -66.86, -34.95],
      [-Math.PI / 2, -67.22, 35.3],
      [Math.PI / 2, 70.66, -34.13],
      [Math.PI / 2, 70.3, 36.2],
    ];
    for (const [angle, x, z] of corners) {
      const q = facing(o, angle, x, z);
      window(q, 0, 5.8, 0.05, 6.4, 15.2, d, true);
      for (const off of [-7.5, -4.7, 4.7, 7.5])
        column(q, off, 4.8, Math.abs(off) > 6 ? -2.55 : 0.2, 0.65, 17.7, d);
      if (d > 1) {
        window(q, 0, 5.4, 0.15, 3.8, 5.4, d);
        pediment(q, 0, 11, 0.2, 5.5, 1.7, d);
      }
    }
    if (d > 1) {
      // Courtyard openings are generalized because the photographs do not resolve their exact rhythms.
      for (const r of body.slice(1))
        for (let j = 1; j < r.length; j++) {
          const a = r[j - 1],
            b = r[j],
            dx = b[0] - a[0],
            dz = b[1] - a[1],
            len = Math.hypot(dx, dz),
            n = Math.floor(len / 4.5),
            ang = Math.atan2(-dz, dx),
            q = facing(o, ang, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
          for (let k = 0; k < n; k++)
            for (const y of [6.5, 12, 18])
              window(q, -len / 2 + ((k + 0.5) * len) / n, y, 0.06, 1.5, 3, d > 2 ? 2 : 1);
        }
      // Heavy roofline balustrade and bronze cap behind the front entablature.
      for (const [x, w] of [
        [-32, 29],
        [35, 29],
      ]) {
        B(o, 'roof', x, 24.1, 42.8, w, 1.15, 0.7, roof);
        if (d > 2)
          for (let i = 0; i < 8; i++)
            B(o, 'roof', x - w / 2 + (i * w) / 7, 25.1, 42.8, 0.35, 0.6, 0.45, roof);
      }
      if (d > 2) {
        // Original low relief silhouettes: no copied sculpture mesh or photographic texture.
        for (let i = 0; i < 11; i++) {
          const x = xx + (i - 5) * 2.4,
            h = 1.1 + (1 - Math.abs(i - 5) / 6) * 2.8;
          B(o, 'wall', x, 25.1, 53.1, 1.6, h, 0.25, baseColor);
          B(o, 'wall', x, 25.1 + h, 53.1, 0.7, 0.65, 0.35, stone);
        }
        for (const x of [-16, 19.2]) {
          B(o, 'wall', x, 27.5, 45.2, 2.8, 3.8, 2.8, stone);
          column(o, x, 31.3, 45.2, 0.6, 2.2, 2);
        }
      }
    }
  }
  if (d) {
    for (const x of [-32.3, 35]) for (const z of [-29, 29]) hip(o, x, z, 27.5, 27, 24, 3.1, 24, 3);
    for (const x of [-54.8, 58.3]) hip(o, x, 0, 23, 48, 24, 3.1, 3, 44);
    for (const f of towers) {
      const ps = f.rings[0],
        xs = ps.map((p) => p[0]),
        zs = ps.map((p) => p[1]),
        x = (Math.min(...xs) + Math.max(...xs)) / 2,
        z = (Math.min(...zs) + Math.max(...zs)) / 2;
      hip(o, x, z, 22, 22, 24.5, 4.5, 15, 15);
    }
  }
  dome(o, d);
}
export function reichstagSkyline(o) {
  reichstag(o, undefined, 0);
}
export function reichstagDistrict(o) {
  reichstag(o, undefined, 1);
}
export function reichstagStreet(o) {
  reichstag(o, undefined, 2);
}
const surfaces = {
  wall: { ...landmarkSurfaces.stone, slot: 'wall' },
  foundation: { ...landmarkSurfaces.stone, slot: 'foundation', graph: 'stone_ashlar' },
  roof: { ...landmarkSurfaces.metal, slot: 'roof', graph: 'metal_copper', metallic: 0.45 },
  trim: { ...landmarkSurfaces.metal, slot: 'trim' },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
  dome: {
    slot: 'window',
    localRef: 'palette:#feffff',
    roughness: 0.2,
    metallic: 0.1,
    baseColorFactor: [1, 1, 1, 0.3],
    alphaMode: 'BLEND',
    doubleSided: true,
  },
};
export const reichstagModel = {
  id: 'reichstag',
  recipe: 'structure-reichstag.mjs',
  key: 'reichstag',
  cell: 'u3/u33',
  title: 'Reichstag building',
  brief:
    'Present Berlin parliament exterior: mapped historic sandstone wings, two open courtyards, four square towers, west visitor colonnade and the transparent 40 m Foster dome.',
  camera: [155, 105, 185],
  lookAt: [2, 20, 0],
  qaCameras: [
    { name: 'front', position: [1.6, 31, 205], lookAt: [1.6, 22, 0] },
    { name: 'back', position: [-145, 95, -150], lookAt: [0, 20, 0] },
    { name: 'portico-ceiling', position: [1.6, 8, 78], lookAt: [1.6, 21.7, 47] },
    { name: 'entrance-frame', position: [-17, 10, 72], lookAt: [1.6, 16, 45] },
  ],
  build: reichstag,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  mediumFiContext: { scale: 2.1 },
  groundContactBasis:
    'West forecourt at [1.6,84] with original public Berlin ground elevations; foundation extends below this datum. Historic levels are photographic approximations.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-reichstag.mjs',
    level: 'skyline',
    export: 'reichstagSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: {
        export: 'reichstagDistrict',
        errorMeters: 0.55,
        surfaces: { ...surfaces, dome: { ...surfaces.dome, baseColorFactor: [1, 1, 1, 0.6] } },
      },
      street: { export: 'reichstagStreet', errorMeters: 0.25, surfaces },
    },
  },
  limitations: [
    'Original medium-fi present exterior. Current construction controls are individually inspected native 2014 Daderot and 2019 Leonhard Lenz own-work CC0 west photographs, selected after checking cleared Qualla media. Earlier attribution-licensed views are excluded from current controls; hidden side/east architecture remains an inherited mapped approximation.',
    'West entrance mullions and coffer beams are solid geometry. The photographs control their visible arrangement; member sections, ceiling depth, hidden joints and exact bay proportions are estimates. The opaque entrance glazing is an exterior boundary, with no parliamentary rooms modeled.',
    'Mapped outline, courtyard voids and tower positions are generalized. Roof terrace, courtyard facades, side details and ornament are conservative interpretations.',
    'Dome diameter 40 m and rise 23.5 m follow Bundestag figures; base is approximately 24 m above forecourt. Rounded published total heights differ slightly. Top opening modeled approximately 10 m; another official page says 8 m.',
    'The dome has 24 ribs and 17 horizontal divisions at close range, with four bottom glazing rows omitted. Internal ramps and reflector cone are simplified exterior-visible cues; parliamentary rooms are excluded.',
    'Fine sculpture and inscriptions are simplified original relief forms. No reference image pixels, adjacent buildings, landscaping or temporary security installations are embedded.',
    'Independent terrain is preserved. Other host terrain datasets may differ from the reviewed Berlin DGM1 sample.',
  ],
};
