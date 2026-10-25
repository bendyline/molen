/** Chenonceau: river house, five-arch gallery, chapel and detached Marques Tower. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad as rawQuad } from './structure-mesh.mjs';

const root = new URL(
    '../../../content/worldgen/source/places/u0/u02/chateau_de_chenonceau/',
    import.meta.url,
  ),
  frame = JSON.parse(fs.readFileSync(new URL('map-frame.json', root))),
  terrain = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', root))),
  ref = 'palette:#ffffff',
  cream = rgb('dbd8cb'),
  trim = rgb('dedacb'),
  darkStone = rgb('aaa99f'),
  glass = rgb('48545b'),
  slate = rgb('565b64'),
  lead = rgb('777b7b'),
  iron = rgb('454641'),
  oak = rgb('655041'),
  gold = rgb('aa935e');

function quad(o, slot, ps, n, col) {
  if (normalFor(...ps).reduce((v, a, i) => v + a * n[i], 0) < 0) ps = [...ps].reverse();
  rawQuad(o, slot, ps, n, col);
}
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addCap: (s, r, p, h, y, n, u, c) => o.addCap(s, r, p, h, y, n, u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function shear(o, k, mid) {
  const q = (p) => [p[0] + k * (p[2] - mid), p[1], p[2]],
    v = (n) => {
      const r = [n[0], n[1], n[2] - k * n[0]],
        l = Math.hypot(...r);
      return r.map((v) => v / l);
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
function flat(o, slot, ps, col, holes = [], n = [0, 0, 1]) {
  const all = [...ps, ...holes.flat()],
    starts = holes.map((_, i) => ps.length + holes.slice(0, i).reduce((n, r) => n + r.length, 0)),
    idx = earcut(
      all.flatMap((p) => [p[0], p[1]]),
      starts,
    );
  for (let i = 0; i < idx.length; i += 3) {
    const p = idx.slice(i, i + 3).map((j) => all[j]);
    if (normalFor(...p).reduce((v, a, j) => v + a * n[j], 0) < 0) p.reverse();
    o.addTriangle(
      slot,
      ref,
      p,
      n,
      p.map((p) => [p[0], p[1]]),
      col,
    );
  }
}
const surface = (o, s, p, z, c) =>
  flat(
    o,
    s,
    p.map((v) => [...v, z]),
    c,
  );
function poly(o, s, r, y0, y1, col) {
  const ids = earcut(r.flat());
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      const p = ids.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]);
      if (normalFor(...p)[1] * n[1] < 0) p.reverse();
      o.addTriangle(
        s,
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        col,
      );
    }
  const area = r.reduce(
    (v, p, i) => v + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
    0,
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      p = [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      n = [(b[1] - a[1]) * Math.sign(area), 0, (a[0] - b[0]) * Math.sign(area)],
      l = Math.hypot(...n);
    if (l < 1e-7) continue;
    quad(
      o,
      s,
      p,
      n.map((v) => v / l),
      col,
    );
  }
}
function panel(o, s, ps, z0, z1, c) {
  surface(o, s, ps, z1, c);
  flat(
    o,
    s,
    ps.map((v) => [...v, z0]),
    c,
    [],
    [0, 0, -1],
  );
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      p = [
        [...a, z0],
        [...b, z0],
        [...b, z1],
        [...a, z1],
      ];
    quad(o, s, p, normalFor(...p), c);
  }
}
function wall(o, ps, holes, z, depth, col = cream, slot = 'stone') {
  flat(
    o,
    slot,
    ps.map((v) => [...v, z]),
    col,
    holes.map((r) => r.map((v) => [...v, z])),
  );
  for (const r of holes)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        p = [
          [...a, z],
          [...a, z - depth],
          [...b, z - depth],
          [...b, z],
        ];
      quad(o, slot, p, normalFor(...p), darkStone);
    }
}
function outline(o, slot, ps, z, width, col, closed = false) {
  for (let i = 1; i < ps.length + (closed ? 1 : 0); i++) {
    const a = ps[i - 1],
      b = ps[i % ps.length],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 1e-6) continue;
    const u = [(-(b[1] - a[1]) * width) / l / 2, ((b[0] - a[0]) * width) / l / 2],
      p = [
        [a[0] - u[0], a[1] - u[1], z],
        [b[0] - u[0], b[1] - u[1], z],
        [b[0] + u[0], b[1] + u[1], z],
        [a[0] + u[0], a[1] + u[1], z],
      ];
    quad(o, slot, p, [0, 0, 1], col);
  }
}
function arch(x, bottom, w, spring, rise, segments = 12) {
  return [
    [x - w / 2, bottom],
    [x + w / 2, bottom],
    ...Array.from({ length: segments + 1 }, (_, i) => {
      const a = (i / segments) * Math.PI;
      return [x + (w / 2) * Math.cos(a), spring + rise * Math.sin(a)];
    }),
  ];
}
function circle(x, y, rx, ry, n = 20) {
  return Array.from({ length: n }, (_, i) => [
    x + rx * Math.cos((i * 2 * Math.PI) / n),
    y + ry * Math.sin((i * 2 * Math.PI) / n),
  ]);
}
function window(
  o,
  d,
  x,
  y,
  w,
  h,
  { arched = false, pointed = false, z = 0, door = false, applied = false } = {},
) {
  const ps = pointed
    ? [
        [x - w / 2, y],
        [x + w / 2, y],
        [x + w / 2, y + h * 0.7],
        [x, y + h],
        [x - w / 2, y + h * 0.7],
      ]
    : arched
      ? arch(x, y, w, y + h - w / 2, w / 2, d === 3 ? 18 : 8)
      : rect(x, y, w, h);
  surface(
    o,
    door ? 'wood' : 'glass',
    ps,
    z + (d >= 2 && !applied ? -0.18 : 0.025),
    door ? oak : glass,
  );
  if (d === 0) return;
  outline(o, 'trim', ps, z + 0.05, d === 3 ? 0.14 : 0.12, trim, true);
  B(o, 'trim', x, y - 0.12, z + 0.09, w + 0.25, 0.14, 0.23, trim);
  if (!door) {
    B(
      o,
      'trim',
      x,
      y,
      z + 0.055,
      0.11,
      h - (arched ? w * 0.18 : pointed ? h * 0.3 : 0),
      0.12,
      trim,
    );
    B(o, 'trim', x, y + h * 0.62, z + 0.06, w, 0.11, 0.13, trim);
    if (d === 3) {
      const zz = z + (applied ? 0.075 : -0.07);
      for (const dx of [-w * 0.25, w * 0.25])
        B(
          o,
          'metal',
          x + dx,
          y,
          zz,
          0.025,
          h - (arched ? w * 0.25 : pointed ? h * 0.32 : 0),
          0.025,
          iron,
        );
      for (let yy = y + 0.4; yy < y + h - 0.2; yy += 0.45)
        B(o, 'metal', x, yy, zz, w, 0.025, 0.025, iron);
    }
  } else if (d >= 2) {
    for (const dx of [-w * 0.26, w * 0.26])
      outline(
        o,
        'wood',
        rect(x + dx, y + 0.25, w * 0.38, h * 0.7),
        z + (applied ? 0.07 : -0.13),
        0.06,
        rgb('8c7458'),
        true,
      );
  }
}
function roof(o, x0, x1, z0, z1, eave, ridge, col = slate) {
  const m = (x0 + x1) / 2,
    hip = Math.min((x1 - x0) / 2, (z1 - z0) * 0.28),
    a = [m, ridge, z0 + hip],
    b = [m, ridge, z1 - hip];
  for (const p of [
    [[x0, eave, z0], [x1, eave, z0], a],
    [[x1, eave, z1], [x0, eave, z1], b],
  ]) {
    if (normalFor(...p)[1] < 0) p.reverse();
    o.addTriangle(
      'roof',
      ref,
      p,
      normalFor(...p),
      p.map((v) => [v[0], v[2]]),
      col,
    );
  }
  for (const p of [
    [[x0, eave, z1], [x0, eave, z0], a, b],
    [[x1, eave, z0], [x1, eave, z1], b, a],
  ]) {
    const n = normalFor(...p);
    quad(o, 'roof', p, n[1] < 0 ? n.map((v) => -v) : n, col);
  }
}
function cylinder(o, slot, x, z, y0, y1, r0, r1, col, n = 24) {
  loft(o, slot, [radialRing(y0, r0, r0, n, [x, z]), radialRing(y1, r1, r1, n, [x, z])], col);
}
function finial(o, d, x, y, z, h = 1.2) {
  if (d === 0) return;
  beam(
    o,
    'metal',
    [x, y, z],
    [x, y + h, z],
    d === 1 ? 0.055 : 0.035,
    d === 1 ? 0.055 : 0.035,
    lead,
  );
  if (d === 3)
    for (const t of [0.18, 0.38, 0.64])
      sphere(
        o,
        'metal',
        [x, y + h * t, z],
        [0.09 * (1 - t / 2), 0.1, 0.09 * (1 - t / 2)],
        lead,
        6,
        4,
      );
}
function turret(o, d, x, z, r, base, top, tip, { body = true } = {}) {
  const n = [8, 12, 20, 28][d];
  if (body) {
    cylinder(o, 'stone', x, z, base, top - 0.5, r, r, cream, n);
    cylinder(o, 'trim', x, z, top - 0.5, top, r, r + 0.2, trim, n);
    if (d > 0) {
      cylinder(o, 'trim', x, z, base + 0.7, base + 0.9, r + 0.08, r + 0.08, trim, n);
      for (const y of [base + 1.3, base + 5.2])
        if (y + 1.0 < top) {
          for (const a of [0, Math.PI / 2, Math.PI]) {
            const q = facing(o, a, x + Math.sin(a) * (r + 0.01), z + Math.cos(a) * (r + 0.01));
            window(q, d, 0, y, 0.5, 1.0, { applied: true });
          }
        }
    }
  }
  cylinder(o, 'roof', x, z, top, tip, r + 0.35, 0.045, slate, n);
  finial(o, d, x, tip, z, 0.9);
}
function balustrade(o, d, points, y, { height = 1.0, spacing = 0.65 } = {}) {
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1],
      b = points[k],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.03) continue;
    beam(o, 'trim', [a[0], y, a[1]], [b[0], y, b[1]], 0.17, 0.2, trim);
    beam(o, 'trim', [a[0], y + height, a[1]], [b[0], y + height, b[1]], 0.2, 0.24, trim);
    const n = Math.ceil(len / (d === 0 ? 3.0 : d === 1 ? 1.7 : spacing));
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      if (d === 3)
        loft(
          o,
          'trim',
          [
            radialRing(y, 0.1, 0.1, 4, [x, z]),
            radialRing(y + height * 0.3, 0.15, 0.15, 4, [x, z]),
            radialRing(y + height * 0.6, 0.065, 0.065, 4, [x, z]),
            radialRing(y + height, 0.1, 0.1, 4, [x, z]),
          ],
          trim,
        );
      else B(o, 'trim', x, y, z, 0.13, height, 0.13, trim);
    }
  }
}

const galleryPiers = [-15.8, -22.7, -34.5, -47.5, -61.5, -77.3],
  galleryWindows = [-69.4, -61.5, -54.5, -47.5, -41, -34.5, -28.6, -22.7, -16.7],
  galleryCenter = (z) => 2.68 + (z + 78) * 0.057;
function bridge(
  o,
  d,
  {
    piers = galleryPiers,
    width = 7.6,
    xAt = galleryCenter,
    top = 0.8,
    crown = -2.15,
    spring = -5.6,
    pierWidth = 1.8,
  } = {},
) {
  const z0 = piers.at(-1) - 0.7,
    z1 = piers[0] + 0.7,
    center = (z0 + z1) / 2;
  const centerX = xAt(center),
    k = (xAt(z1) - xAt(z0)) / (z1 - z0);
  o = shear(o, k, center);
  xAt = () => centerX;
  const holes = piers.slice(1).map((p, i) => {
    const a = piers[i],
      w = a - p - pierWidth;
    return arch((a + p) / 2, -11, w, spring, crown - spring, [4, 10, 16, 22][d]);
  });
  // Cross-river panel is extruded through the full gallery width; no hidden solid core.
  for (const side of [-1, 1]) {
    const q = facing(o, (side * Math.PI) / 2, xAt(center) + (side * width) / 2, center),
      ps = rect(0, -12, z1 - z0, top + 12),
      hh = holes.map((r) => r.map((p) => [(p[0] - center) * -side, p[1]]));
    flat(
      q,
      'foundation',
      ps.map((p) => [...p, 0]),
      darkStone,
      hh.map((r) => r.map((p) => [...p, 0])),
    );
    if (d > 0) for (const r of hh) outline(q, 'trim', r.slice(2), 0.035, 0.28, trim);
  }
  // Actual underside vaults follow the centerline, with sloping extrados/open arch ends.
  for (const r of holes)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        p = [
          [xAt(a[0]) - width / 2, a[1], a[0]],
          [xAt(a[0]) + width / 2, a[1], a[0]],
          [xAt(b[0]) + width / 2, b[1], b[0]],
          [xAt(b[0]) - width / 2, b[1], b[0]],
        ];
      const n = normalFor(...p),
        centerZ = (r[0][0] + r[1][0]) / 2,
        dot = n[1] * (-6 - (a[1] + b[1]) / 2) + n[2] * (centerZ - (a[0] + b[0]) / 2);
      quad(o, 'foundation', p, dot < 0 ? n.map((v) => -v) : n, darkStone);
    }
  // Deck and end abutments, leaving the arch airspace empty.
  const p = [
    [xAt(z0) - width / 2, top, z0],
    [xAt(z1) - width / 2, top, z1],
    [xAt(z1) + width / 2, top, z1],
    [xAt(z0) + width / 2, top, z0],
  ];
  quad(o, 'foundation', p, [0, 1, 0], cream);
  for (const z of [z0, z1]) B(o, 'foundation', xAt(z), -12, z, width, top + 12, 0.25, darkStone);
}
function foundations(o, d) {
  bridge(o, d);
  // Old mill piers have a distinct wide boat passage between them.
  bridge(o, d, {
    piers: [6.5, -1.8],
    width: 27,
    xAt: () => 1.6,
    top: 0.8,
    crown: -2.0,
    spring: -5.7,
    pierWidth: 1.1,
  });
  for (const [name, ps] of [
    ['northFoundation', frame.authoredComponents.northFoundation],
    ['southFoundation', frame.authoredComponents.southFoundation],
  ]) {
    // Extrude the two actual native mill bases; the separating boat passage is never filled.
    poly(o, 'foundation', ps, -12, 0.8, darkStone);
    if (d > 0)
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i],
          b = ps[(i + 1) % ps.length];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 3)
          beam(o, 'trim', [a[0], 0.52, a[1]], [b[0], 0.52, b[1]], 0.19, 0.22, trim);
      }
    void name;
  }
  for (const z of galleryPiers.slice(1, -1))
    for (const side of [-1, 1]) {
      const x = galleryCenter(z) + side * 3.8,
        ps = [
          [x - side * 0.1, z - 1.0],
          [x + side * 2.0, z],
          [x - side * 0.1, z + 1.0],
        ];
      poly(o, 'foundation', ps, -12, -0.05, darkStone);
      if (d > 0) {
        poly(o, 'trim', ps, -0.05, 0.12, trim);
        const n = d === 3 ? 16 : 8,
          ring = Array.from({ length: n + 1 }, (_, i) => [
            x + side * 1.1 * Math.sin((i / n) * Math.PI),
            z + 1.1 * Math.cos((i / n) * Math.PI),
          ]);
        poly(o, 'trim', ring, 4.5, 4.75, trim);
        balustrade(o, d, ring, 4.75, { height: 0.85 });
      }
    }
}
function gallery(o, d) {
  const z0 = -78,
    z1 = -15.0,
    mid = (z0 + z1) / 2,
    w = 7.6,
    eave = 8.9;
  o = shear(o, 0.057, mid);
  for (const side of [-1, 1]) {
    const angle = (side * Math.PI) / 2,
      q = facing(o, angle, galleryCenter(mid) + (side * w) / 2, mid),
      holes = [];
    const windows = galleryWindows;
    for (const [i, z] of windows.entries())
      for (const [y, h] of [
        [1.25, 2.9],
        [5.05, 2.8],
      ]) {
        const x = (z - mid) * -side,
          arched = y < 2 && i % 2 === 1,
          ps = arched ? arch(x, y, 1.3, y + h - 0.65, 0.65, d === 3 ? 16 : 8) : rect(x, y, 1.3, h);
        if (d >= 2) holes.push(ps);
        window(q, d, x, y, 1.3, h, { arched });
        if (d > 0 && y > 2) {
          B(q, 'trim', x, y + h + 0.12, 0.09, 1.9, 0.16, 0.22, trim);
          outline(
            q,
            'trim',
            arch(x, y + h + 0.12, 1.9, y + h + 0.12, 0.35, 12).slice(2),
            0.12,
            0.15,
            trim,
          );
        }
      }
    wall(q, rect(0, 0.8, z1 - z0, eave - 0.8), holes, 0, 0.28);
    if (d > 0) {
      for (const y of [0.85, 4.5, 8.45, 8.8]) B(q, 'trim', 0, y, 0.08, z1 - z0, 0.15, 0.24, trim);
      for (let i = 0; i < windows.length - 1; i++) {
        const x = ((windows[i] + windows[i + 1]) / 2 - mid) * -side;
        B(q, 'trim', x, 4.85, 0.04, 2.3, 3.0, 0.08, cream);
        outline(q, 'trim', rect(x, 5.2, 1.8, 2.0), 0.1, 0.08, darkStone, true);
      }
    }
    for (const z of windows) {
      const x = (z - mid) * -side,
        hh = circle(x, 10.1, 0.43, 0.53, d === 3 ? 24 : 10);
      if (d === 0) {
        surface(q, 'glass', hh, 0.05, glass);
        continue;
      }
      const outer = rect(x, 8.85, 1.75, 2.05);
      wall(q, outer, d >= 2 ? [hh] : [], 0.18, 0.28);
      surface(q, 'glass', hh, d >= 2 ? -0.04 : 0.21, glass);
      outline(q, 'trim', hh, 0.24, 0.16, trim, true);
      B(q, 'trim', x, 10.9, 0.3, 2.0, 0.18, 0.45, trim);
      panel(
        q,
        'trim',
        [
          [x - 1.0, 11.05],
          [x + 1, 11.05],
          [x, 11.75],
        ],
        0.1,
        0.35,
        trim,
      );
      // Dormer cheeks meet the steep slate slope behind their stone faces.
      for (const dx of [-0.87, 0.87])
        quad(
          q,
          'roof',
          [
            [x + dx, 8.85, -1.6],
            [x + dx, 10.85, -1.6],
            [x + dx, 10.85, 0.17],
            [x + dx, 8.85, 0.17],
          ],
          [Math.sign(dx), 0, 0],
          slate,
        );
      quad(
        q,
        'roof',
        [
          [x - 0.9, 10.85, -1.6],
          [x + 0.9, 10.85, -1.6],
          [x + 0.9, 10.85, 0.18],
          [x - 0.9, 10.85, 0.18],
        ],
        [0, 1, 0],
        slate,
      );
    }
  }
  for (const [z, a] of [
    [z0, Math.PI],
    [z1, 0],
  ]) {
    const q = facing(o, a, galleryCenter(mid), z),
      door = arch(0, 0.8, 1.45, 3.2, 0.7, 10);
    wall(q, rect(0, 0.8, w, 8.1), d >= 2 ? [door] : [], 0, 0.3);
    window(q, d, 0, 0.8, 1.45, 3.1, { arched: true, door: true });
  }
  roof(
    o,
    galleryCenter(mid) - w / 2 - 0.15,
    galleryCenter(mid) + w / 2 + 0.15,
    z0 - 0.15,
    z1 + 0.15,
    eave,
    13.1,
  );
  for (const z of [z0 + 0.8, z1 - 1.0]) {
    B(o, 'stone', galleryCenter(mid), 8.9, z, 1.3, 5.1, 1.2, cream);
    B(o, 'trim', galleryCenter(mid), 13.9, z, 1.6, 0.25, 1.5, trim);
    if (d > 1) {
      B(o, 'roof', galleryCenter(mid), 14.16, z, 0.65, 0.03, 0.55, iron);
      for (const dx of [-0.4, 0.4])
        B(o, 'trim', galleryCenter(mid) + dx, 9.0, z, 0.12, 4.8, 1.32, trim);
    }
  }
}
const houseFaces = [
  { x: 2.4, z: 12.9, a: 0, w: 25.0, bays: [-8.4, 0, 8.3], north: true },
  { x: 15.0, z: 0.0, a: Math.PI / 2, w: 25.6, bays: [-8, 0, 8] },
  { x: -10.25, z: 0.3, a: -Math.PI / 2, w: 24.4, bays: [-8, 0, 8] },
  { x: 2.4, z: -12.0, a: Math.PI, w: 25.0, bays: [-8.4, 0, 8.3], south: true },
];
function mainHouse(o, d) {
  for (const f of houseFaces) {
    const q = facing(o, f.a, f.x, f.z),
      holes = [];
    for (const [i, x] of f.bays.entries())
      for (const [y, h] of [
        [1.25, 3.45],
        [6.05, 3.35],
      ]) {
        if (f.north && i === 1 && y < 2) {
          if (d >= 2) holes.push(arch(x, 0.8, 2.4, 3.7, 1.0, 16));
          window(q, d, x, 0.8, 2.4, 3.9, { arched: true, door: true });
          continue;
        }
        if (f.south && y < 2 && i === 1) continue;
        const w = 2.3;
        if (d >= 2) holes.push(rect(x, y, w, h));
        window(q, d, x, y, w, h);
      }
    wall(q, rect(0, 0.8, f.w, 9.7), holes, 0, 0.3);
    if (d > 0) {
      for (const y of [0.8, 5.2, 9.9, 10.35])
        B(q, 'trim', 0, y, 0.08, f.w + 0.15, 0.18, 0.32, trim);
      if (d > 1) {
        for (let i = 0; i < Math.floor(f.w / 0.55); i++)
          B(q, 'trim', -f.w / 2 + i * 0.55, 9.95, 0.2, 0.18, 0.32, 0.22, trim);
        for (const x of [-f.w / 2 + 0.3, f.w / 2 - 0.3])
          B(q, 'trim', x, 1.0, 0.08, 0.35, 8.7, 0.22, trim);
      }
    }
    if (d > 0 && !f.south)
      for (const x of f.bays) {
        const y = 10.5,
          ww = 2.55,
          hh = 3.2;
        wall(q, rect(x, y, 3.05, hh + 0.5), d >= 2 ? [rect(x, y + 0.05, ww, hh)] : [], 0.25, 0.25);
        window(q, d, x, y + 0.05, ww, hh, { z: 0.25 });
        B(q, 'trim', x, 14.0, 0.3, 3.7, 0.23, 0.5, trim);
        const p = [
          [x - 1.75, 14.2],
          [x + 1.75, 14.2],
          [x + 1.0, 14.6],
          [x + 0.7, 15.3],
          [x, 15.9],
          [x - 0.7, 15.3],
          [x - 1, 14.6],
        ];
        panel(q, 'trim', p, 0.15, 0.4, trim);
        if (d >= 2) {
          outline(q, 'trim', p, 0.46, 0.12, darkStone, true);
          for (const dx of [-1.6, 0, 1.6]) {
            B(q, 'trim', x + dx, 14.25, 0.3, 0.14, 1.7 - Math.abs(dx) * 0.4, 0.17, trim);
            finial(q, d, x + dx, 15.95 - Math.abs(dx) * 0.4, 0.3, 0.5);
          }
          outline(q, 'trim', circle(x, 14.9, 0.33, 0.38, 16), 0.46, 0.11, trim, true);
        }
        for (const dx of [-1.52, 1.52])
          quad(
            q,
            'roof',
            [
              [x + dx, y, -3.3],
              [x + dx, 13.8, -3.3],
              [x + dx, 13.8, 0.25],
              [x + dx, y, 0.25],
            ],
            [Math.sign(dx), 0, 0],
            slate,
          );
        quad(
          q,
          'roof',
          [
            [x - 1.52, 13.8, -3.3],
            [x + 1.52, 13.8, -3.3],
            [x + 1.52, 13.8, 0.25],
            [x - 1.52, 13.8, 0.25],
          ],
          [0, 1, 0],
          slate,
        );
      }
  }
  // Four steep outer roof pitches and inward slopes preserve the observed central roof valley.
  const outer = [
      [-10.6, 10.5, -12.5],
      [15.5, 10.5, -12.5],
      [15.5, 10.5, 13.2],
      [-10.6, 10.5, 13.2],
    ],
    ridge = [
      [-4.6, 18.2, -6.5],
      [9.5, 18.2, -6.5],
      [9.5, 18.2, 7.2],
      [-4.6, 18.2, 7.2],
    ],
    inner = [
      [-1, 15, -3],
      [6, 15, -3],
      [6, 15, 3.7],
      [-1, 15, 3.7],
    ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    for (const p of [
      [outer[i], outer[j], ridge[j], ridge[i]],
      [ridge[i], ridge[j], inner[j], inner[i]],
    ]) {
      let n = normalFor(...p);
      if (n[1] < 0) n = n.map((v) => -v);
      quad(o, 'roof', p, n, slate);
    }
    if (d > 0) beam(o, 'metal', ridge[i], ridge[j], 0.08, 0.09, lead);
  }
  quad(o, 'metal', inner, [0, 1, 0], lead);
  for (const [x, z, h] of [
    [-4.6, -6.5, 3.2],
    [9.5, -6.5, 3.5],
    [9.5, 7.2, 3.4],
    [-4.6, 7.2, 3.1],
    [2, -6.5, 2.7],
    [-4.6, 1, 2.8],
  ]) {
    B(o, 'stone', x, 16.9, z, 1.2, h + 1.3, 1.1, cream);
    B(o, 'trim', x, 18.2 + h, z, 1.5, 0.22, 1.4, trim);
    if (d > 1) {
      for (const dx of [-0.43, 0.43]) B(o, 'trim', x + dx, 17.0, z, 0.12, h + 1.05, 1.2, trim);
      for (const dx of [-0.3, 0.3]) B(o, 'roof', x + dx, 18.43 + h, z, 0.28, 0.025, 0.6, iron);
    }
  }
  for (const [x, z, r, top, tip] of [
    [-8.6, 13.1, 1.35, 11.8, 18.0],
    [14, 12.2, 1.35, 11.8, 18],
    [14.9, -12.6, 1.3, 11.6, 17.9],
    [-12.5, -10.7, 1.6, 12.1, 19],
  ])
    turret(o, d, x, z, r, 0.8, top, tip);
  // North entry balcony has corbelled projecting rounded ends and an open balustrade.
  if (d > 0) {
    for (const x of [-0.9, 5.7])
      loft(
        o,
        'trim',
        [
          radialRing(3.95, 0.25, 0.25, d === 3 ? 18 : 10, [x, 14.1]),
          radialRing(5.05, 1.15, 0.9, d === 3 ? 18 : 10, [x, 14.1]),
          radialRing(5.35, 1.2, 1.0, d === 3 ? 18 : 10, [x, 14.1]),
        ],
        trim,
      );
    B(o, 'trim', 2.4, 5.25, 13.8, 8.0, 0.22, 2.0, trim);
    balustrade(
      o,
      d,
      [
        [-1.5, 13.0],
        [-1.5, 14.8],
        [6.3, 14.8],
        [6.3, 13.0],
      ],
      5.47,
      { height: 0.8 },
    );
    for (const x of [0.6, 4.2]) {
      cylinder(o, 'trim', x, 13.3, 0.8, 4.7, 0.22, 0.22, trim, d === 3 ? 16 : 8);
      B(o, 'trim', x, 4.6, 13.3, 0.6, 0.2, 0.6, trim);
    }
  }
  // Polygonal projecting east study/library, distinct from the chapel.
  poly(o, 'stone', frame.authoredComponents.eastOriel, 0.8, 10.5, cream);
  roof(o, -19.3, -10.2, -8.4, -1.6, 10.5, 15.4);
  for (const z of [-6.3, -3.7]) {
    const q = facing(o, -Math.PI / 2, -19.31, z);
    for (const y of [1.4, 6.1]) window(q, d, 0, y, 1.25, 3.15, { applied: true });
  }
}
function chapel(o, d) {
  const r = frame.authoredComponents.chapel,
    area = r.reduce(
      (s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
      0,
    );
  // Five exposed apse faces, each with tall pointed glazing between buttresses.
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      w = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (w < 0.1) continue;
    const x = (a[0] + b[0]) / 2,
      z = (a[1] + b[1]) / 2,
      n = [(b[1] - a[1]) * Math.sign(area), (a[0] - b[0]) * Math.sign(area)],
      out = Math.atan2(n[0], n[1]),
      q = facing(o, out, x, z),
      ww = Math.min(1.3, w * 0.55),
      ps = [
        [-ww / 2, 2.0],
        [ww / 2, 2.0],
        [ww / 2, 7.6],
        [0, 8.6],
        [-ww / 2, 7.6],
      ];
    if (x < -11) {
      wall(q, rect(0, 0.8, w + 0.06, 9.0), d >= 2 ? [ps] : [], 0, 0.28);
      window(q, d, 0, 2.0, ww, 6.6, { pointed: true });
      if (d > 1) {
        outline(q, 'trim', circle(0, 7.6, ww * 0.25, 0.4, 12), 0.1, 0.06, trim, true);
        for (const dx of [-ww * 0.22, ww * 0.22])
          outline(
            q,
            'trim',
            [
              [dx, 2.0],
              [dx, 7.5],
              [0, 8.35],
            ],
            0.09,
            0.07,
            trim,
          );
      }
    } else wall(q, rect(0, 0.8, w + 0.06, 9), [], 0, 0.25);
    if (d > 0) {
      beam(o, 'trim', [a[0], 1.1, a[1]], [a[0], 9.55, a[1]], 0.4, 0.4, trim);
      beam(o, 'trim', [a[0], 9.6, a[1]], [b[0], 9.6, b[1]], 0.25, 0.3, trim);
    }
  }
  const rr = r.map((p) => [p[0], 9.9, p[1]]),
    peak = [-13.6, 14.1, 9.4];
  for (let i = 0; i < rr.length; i++) {
    const p = [rr[i], rr[(i + 1) % rr.length], peak];
    if (normalFor(...p)[1] < 0) p.reverse();
    o.addTriangle(
      'roof',
      ref,
      p,
      normalFor(...p),
      p.map((p) => [p[0], p[2]]),
      slate,
    );
  }
  clockLantern(o, d, -9.0, -1.0, 15.0, 7.5);
}
function clockLantern(o, d, x, z, y, h) {
  const n = d === 0 ? 4 : 8;
  cylinder(o, 'roof', x, z, y, y + h * 0.28, 1.05, 0.72, slate, n);
  for (const [lo, hi, r] of [
    [0.28, 0.52, 0.65],
    [0.62, 0.8, 0.43],
  ]) {
    cylinder(o, 'metal', x, z, y + h * lo - 0.08, y + h * lo + 0.05, r + 0.14, r + 0.14, lead, n);
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n;
      beam(
        o,
        'metal',
        [x + r * Math.cos(a), y + h * lo, z + r * Math.sin(a)],
        [x + r * Math.cos(a), y + h * hi, z + r * Math.sin(a)],
        0.095,
        0.095,
        lead,
      );
    }
    cylinder(o, 'roof', x, z, y + h * hi, y + h * (hi + 0.1), r + 0.15, r * 0.45, slate, n);
  }
  cylinder(o, 'roof', x, z, y + h * 0.9, y + h, 0.3, 0.03, slate, n);
  finial(o, d, x, y + h, z, 0.85);
  if (d > 0)
    for (const a of [0, Math.PI / 2, -Math.PI / 2]) {
      const q = facing(o, a, x + Math.sin(a) * 0.95, z + Math.cos(a) * 0.95);
      surface(q, 'metal', circle(0, y + 0.55, 0.3, 0.3, 16), 0.01, iron);
      outline(q, 'metal', circle(0, y + 0.55, 0.33, 0.33, 16), 0.04, 0.045, gold, true);
      outline(
        q,
        'metal',
        [
          [0, y + 0.76],
          [0, y + 0.55],
          [0.18, y + 0.48],
        ],
        0.05,
        0.035,
        gold,
      );
    }
}
function marques(o, d) {
  const ps = frame.authoredComponents.marquesTower,
    x = (Math.min(...ps.map((p) => p[0])) + Math.max(...ps.map((p) => p[0]))) / 2,
    z = (Math.min(...ps.map((p) => p[1])) + Math.max(...ps.map((p) => p[1]))) / 2,
    r = 5.05,
    n = [12, 18, 28, 40][d];
  cylinder(o, 'foundation', x, z, -10, 0.2, r, r, darkStone, n);
  cylinder(o, 'foundation', x, z, 0.2, 9.2, r, r, darkStone, n);
  loft(
    o,
    'stone',
    [
      radialRing(9.2, r, r, n, [x, z]),
      radialRing(9.8, r + 0.38, r + 0.38, n, [x, z]),
      radialRing(12.8, r + 0.38, r + 0.38, n, [x, z]),
    ],
    cream,
  );
  cylinder(o, 'roof', x, z, 12.8, 21.1, r + 0.55, 0.75, slate, n);
  if (d > 0) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI;
      B(
        o,
        'trim',
        x + (r + 0.2) * Math.cos(a),
        9.25,
        z + (r + 0.2) * Math.sin(a),
        0.25,
        0.5,
        0.25,
        trim,
      );
    }
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const q = facing(o, a, x + Math.sin(a) * (r + 0.03), z + Math.cos(a) * (r + 0.03));
      for (const y of [1.2, 5.5, 10.5])
        window(q, d, 0, y, y > 10 ? 0.65 : 0.8, y > 10 ? 0.8 : 1.1, { applied: true });
    }
  }
  const q = facing(o, Math.PI, x, z - r - 0.04);
  window(q, d, 0, 0.2, 1.4, 2.5, { door: true, applied: true });
  if (d > 0) {
    const p = rect(0, 12.8, 2.1, 2.5);
    wall(q, p, d >= 2 ? [rect(0, 12.9, 1.65, 2.05)] : [], 0.1, 0.2);
    window(q, d, 0, 12.9, 1.65, 2.05, { z: 0.1 });
    panel(
      q,
      'trim',
      [
        [-1.2, 15.3],
        [1.2, 15.3],
        [0.7, 15.8],
        [0, 16.3],
        [-0.7, 15.8],
      ],
      0,
      0.25,
      trim,
    );
  }
  // Attached stair turret is independently positioned from its native outline.
  const st = frame.authoredComponents.marquesStairTurret,
    sx = (Math.min(...st.map((p) => p[0])) + Math.max(...st.map((p) => p[0]))) / 2,
    sz = (Math.min(...st.map((p) => p[1])) + Math.max(...st.map((p) => p[1]))) / 2;
  turret(o, d, sx, sz, 2.12, 0.2, 16.3, 22.8);
  B(o, 'stone', x - 1.2, 13.3, z + 2.0, 1.0, 8.1, 0.9, cream);
  B(o, 'trim', x - 1.2, 21.4, z + 2, 1.3, 0.2, 1.2, trim);
  // Roof lantern stays genuinely open, including the skyline recipe.
  cylinder(o, 'roof', x, z, 20.8, 21.2, 0.8, 0.8, slate, n);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 2 * Math.PI;
    beam(
      o,
      'metal',
      [x + 0.65 * Math.cos(a), 21.2, z + 0.65 * Math.sin(a)],
      [x + 0.65 * Math.cos(a), 23, z + 0.65 * Math.sin(a)],
      0.1,
      0.1,
      lead,
    );
  }
  cylinder(o, 'roof', x, z, 23, 24, 0.9, 0.03, slate, n);
  finial(o, d, x, 24, z, 1.0);
}
function terrace(o, d) {
  const ps = frame.authoredComponents.terrace;
  poly(o, 'trim', ps, 0.1, 0.25, rgb('c5c0b0'));
  // Only boundary retaining masonry is authored. Unchanged ground remains visible inside.
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 2.0) continue;
    beam(o, 'foundation', [a[0], -5.9, a[1]], [b[0], -5.9, b[1]], 0.7, 12, darkStone);
    if (d > 0) balustrade(o, d, [a, b], 0.12, { height: 0.9, spacing: 0.65 });
  }
  bridge(o, d, {
    piers: [33.0, 16.0],
    width: 4.4,
    xAt: () => 2.4,
    top: 0.2,
    crown: -1.6,
    spring: -6.2,
    pierWidth: 1.4,
  });
  for (const side of [-1, 1]) {
    const x = 2.4 + side * 2.5;
    for (const [z0, z1] of [[17, 32]])
      balustrade(
        o,
        d,
        [
          [x, z0],
          [x, z1],
        ],
        0.2,
        { height: 0.85 },
      );
  }
  // Six entrance treads join the main door to the approach deck.
  for (let i = 0; i < 6; i++)
    B(o, 'trim', 2.4, 0.2, 15.13 - i * 0.33, 3.6, (i + 1) * 0.1, 0.35, trim);
  B(o, 'trim', 2.4, 0.2, 13.05, 3.6, 0.6, 0.85, trim);
  if (d >= 2) {
    // Immediate own well: simple original bowl and supports, without copied carving.
    cylinder(o, 'stone', 15.2, 33.2, 0.05, 0.9, 0.8, 0.8, cream, 20);
    cylinder(o, 'trim', 15.2, 33.2, 0.85, 1.0, 0.92, 0.92, trim, 20);
  }
}
function build(o, d) {
  foundations(o, d);
  gallery(o, d);
  mainHouse(o, d);
  chapel(o, d);
  marques(o, d);
  terrace(o, d);
}
function skyline(o) {
  bridge(o, 0);
  // Separate old mill supports retain their broad water passage at distant scale.
  B(o, 'foundation', 1.1, -12, 10.0, 28, 12.8, 7.2, darkStone);
  B(o, 'foundation', 1.1, -12, -7.4, 28, 12.8, 11.1, darkStone);
  B(o, 'stone', 2.3, 0.8, 0.0, 25.3, 9.7, 25.6, cream);
  roof(o, -10.5, 15.3, -12.8, 13, 10.5, 18.2);
  for (const [x, z] of [
    [-8.6, 13.1],
    [14, 12.2],
    [14.9, -12.6],
    [-12.5, -10.7],
  ]) {
    cylinder(o, 'stone', x, z, 0.8, 11.8, 1.4, 1.4, cream, 5);
    cylinder(o, 'roof', x, z, 11.8, 18.3, 1.65, 0.02, slate, 5);
  }
  const cx = galleryCenter(-46.5),
    q = shear(o, 0.057, -46.5);
  B(q, 'stone', cx, 0.8, -46.5, 7.6, 8.1, 63, cream);
  roof(q, cx - 3.9, cx + 3.9, -78.15, -14.85, 8.9, 13.1);
  for (const [x, z, h] of [
    [-4.6, -6.5, 3.2],
    [9.5, -6.5, 3.5],
    [9.5, 7.2, 3.4],
    [-4.6, 7.2, 3.1],
  ])
    B(o, 'stone', x, 17.1, z, 1.2, h + 1.1, 1.1, cream);
  poly(o, 'stone', frame.authoredComponents.chapel, 0.8, 9.9, cream);
  roof(o, -18.2, -10.1, 6.3, 12.8, 9.9, 14.1);
  clockLantern(o, 0, -9, -1, 15, 7.5);
  cylinder(o, 'foundation', 16.5, 42.6, -10, 9.7, 5.05, 5.05, darkStone, 8);
  cylinder(o, 'stone', 16.5, 42.6, 9.7, 12.8, 5.45, 5.45, cream, 8);
  cylinder(o, 'roof', 16.5, 42.6, 12.8, 21.1, 5.6, 0.7, slate, 8);
  cylinder(o, 'stone', 11.75, 46.6, 0.2, 16.3, 2.1, 2.1, cream, 5);
  cylinder(o, 'roof', 11.75, 46.6, 16.3, 22.8, 2.4, 0.02, slate, 5);
  for (const dx of [-0.65, 0.65])
    for (const dz of [-0.65, 0.65])
      B(o, 'metal', 16.5 + dx, 21.1, 42.6 + dz, 0.12, 1.9, 0.12, lead);
  cylinder(o, 'roof', 16.5, 42.6, 23, 24, 0.9, 0.02, slate, 6);
  for (const [a, b] of [
    [
      [-26.6, 35],
      [-27.3, 83.7],
    ],
    [
      [-27.3, 83.7],
      [17.2, 83.6],
    ],
    [
      [17.2, 83.6],
      [16.3, 47.6],
    ],
    [
      [15.2, 32.8],
      [-26.6, 35],
    ],
  ])
    beam(o, 'foundation', [a[0], -5.9, a[1]], [b[0], -5.9, b[1]], 0.7, 12, darkStone);
  poly(o, 'trim', frame.authoredComponents.terrace, 0.1, 0.25, rgb('c5c0b0'));
  bridge(o, 0, {
    piers: [33, 16],
    width: 4.4,
    xAt: () => 2.4,
    top: 0.2,
    crown: -1.6,
    spring: -6.2,
    pierWidth: 1.4,
  });
}
function district(o) {
  build(o, 0);
  for (const f of houseFaces.filter((f) => !f.south)) {
    const q = facing(o, f.a, f.x, f.z);
    for (const x of f.bays) {
      B(q, 'stone', x, 10.5, -0.55, 3.05, 3.6, 1.5, cream);
      surface(q, 'glass', rect(x, 10.7, 2.35, 2.9), 0.22, glass);
      panel(
        q,
        'trim',
        [
          [x - 1.7, 14.1],
          [x + 1.7, 14.1],
          [x, 15.7],
        ],
        0.06,
        0.28,
        trim,
      );
    }
  }
  const mid = -46.5,
    w = 7.6,
    q = shear(o, 0.057, mid);
  for (const side of [-1, 1]) {
    const face = facing(q, (side * Math.PI) / 2, galleryCenter(mid) + (side * w) / 2, mid);
    for (let i = 0; i < 9; i++) {
      const x = (galleryWindows[i] - mid) * -side;
      B(face, 'stone', x, 8.85, -0.5, 1.75, 2.05, 1.0, cream);
      panel(
        face,
        'trim',
        [
          [x - 1, 11],
          [x + 1, 11],
          [x, 11.75],
        ],
        0,
        0.2,
        trim,
      );
    }
  }
  B(o, 'trim', 2.4, 5.25, 13.8, 8, 0.22, 2, trim);
  balustrade(
    o,
    0,
    [
      [-1.5, 13],
      [-1.5, 14.8],
      [6.3, 14.8],
      [6.3, 13],
    ],
    5.47,
    { height: 0.8 },
  );
  for (const side of [-1, 1])
    balustrade(
      o,
      0,
      [
        [2.4 + side * 2.5, 17],
        [2.4 + side * 2.5, 32],
      ],
      0.2,
      { height: 0.85 },
    );
}
function street(o) {
  foundations(o, 0);
  gallery(o, 2);
  mainHouse(o, 1);
  chapel(o, 2);
  marques(o, 1);
  terrace(o, 1);
}
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  foundation: {
    slot: 'foundation',
    graph: 'stone_limestone_weathered',
    roughness: 0.98,
    metallic: 0,
  },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.4, metallic: 0.08 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.4 },
  wood: { slot: 'door', localRef: ref, roughness: 0.9, metallic: 0 },
};
export const chenonceauClose = (o) => build(o, 3),
  chenonceauStreet = street,
  chenonceauDistrict = district,
  chenonceauSkyline = skyline;
export const chenonceauModel = {
  id: 'chateau_de_chenonceau',
  key: 'chateau_de_chenonceau',
  recipe: 'structure-chateau-de-chenonceau.mjs',
  cell: 'u0/u02',
  title: 'Château de Chenonceau',
  brief:
    'River château with five actual gallery arch voids, independent old-mill boat passage, pointed chapel glazing and polygonal study. Nine gallery windows/oculus dormers per long face, pale limestone and steep slate roof, cutwaters and upper lookouts. Three-bay north entrance with supported open balcony, crossed mullions, elaborate original dormer relief, four conical corner turrets, tall chimneys and open clock lantern. Detached corbelled Marques Tower with conical roof, stair turret, divided dormer, chimney and open cupola; immediate retaining terrace and arched entry bridge. Separate gardens, service houses, interiors, people and photographic textures excluded.',
  camera: [118, 58, 105],
  lookAt: [0, 4, -2],
  qaCameras: [
    { name: 'front', position: [3, 15, 74], lookAt: [2, 8, 12] },
    { name: 'entrance-detail', position: [14, 12, 36], lookAt: [2.4, 5.5, 13] },
    { name: 'gallery-west', position: [70, 15, -43], lookAt: [5, 4, -43] },
    { name: 'five-arches', position: [64, -1.0, -47], lookAt: [4, -3, -47] },
    { name: 'chapel-east', position: [-47, 14, 19], lookAt: [-13, 7, 6] },
    { name: 'mill-arch', position: [-43, -1, 3], lookAt: [0, -3, 2.4] },
    { name: 'marques-tower', position: [48, 18, 72], lookAt: [16, 11, 43] },
    { name: 'roof-valley', position: [42, 51, 36], lookAt: [2, 14, 0] },
  ],
  mediumFiContext: { scale: 1.3, cameraYaw: 0, groundY: -7 },
  build: chenonceauClose,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Independent official IGN RGE ALTI responses before authoring: 25921 unchanged provider samples, 2m grid, terrace datum 60.84m, river surface around −6.52m; original baseline Terrarium retained and rejected because it does not resolve the raised terrace/channel. Native resolution and vertical accuracy are unspecified by API metadata. Source-epoch water surface is not bathymetry or live level. Own retaining walls/supports extend to −12m; host must provide compatible terrain. Footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-chateau-de-chenonceau.mjs',
    level: 'skyline',
    export: 'chenonceauSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'chenonceauDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'chenonceauStreet', errorMeters: 0.35, surfaces },
    },
  },
  limitations: frame.limitations,
};
export {
  bridge,
  build,
  chapel,
  foundations,
  frame,
  gallery,
  galleryCenter,
  galleryPiers,
  galleryWindows,
  houseFaces,
  mainHouse,
  marques,
  terrace,
  terrain,
};
