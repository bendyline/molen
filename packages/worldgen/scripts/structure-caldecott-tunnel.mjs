/** Complete current four-bore Caldecott exterior: both portals, native west vent works and bridges. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/9q/9q9/caldecott_tunnel/',
    import.meta.url,
  ),
  plan = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  datums = JSON.parse(fs.readFileSync(new URL('portal-datum-controls.json', dir))),
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('b1b4a9'),
    trim: rgb('c3c5b9'),
    metal: rgb('919c95'),
    glass: rgb('617471'),
    dark: rgb('424e47'),
    road: rgb('747e75'),
    light: rgb('d8c38c'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.18 },
    glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.42, metallic: 0.04 },
    dark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
    road: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
    light: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
  };
function tri(o, s, ps, n) {
  if (n && normalFor(...ps).reduce((a, v, i) => a + v * n[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  const normal = normalFor(...ps);
  o.addTriangle(
    s,
    ref,
    ps,
    normal,
    ps.map((p) => [p[0], p[1] + p[2]]),
    C[s],
  );
}
function Q(o, s, p, n) {
  tri(o, s, [p[0], p[1], p[2]], n);
  tri(o, s, [p[0], p[2], p[3]], n);
}
const rect = (x, y, w, h) => [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ],
  area = (r) =>
    r.reduce((v, p, i) => v + p[0] * r[(i + 1) % r.length][1] - p[1] * r[(i + 1) % r.length][0], 0),
  cw = (r) => (area(r) < 0 ? r : [...r].reverse());
function frame(point, n, y = 0) {
  const u = [n[1], -n[0]];
  return {
    P: (x, h, z = 0) => [point[0] + u[0] * x + n[0] * z, y + h, point[1] + u[1] * x + n[1] * z],
    V: (x, h, z = 0) => [u[0] * x + n[0] * z, h, u[1] * x + n[1] * z],
    n: [n[0], 0, n[1]],
  };
}
function panel(o, s, outer, holes, f, z = 0, back = false) {
  const all = [outer, ...holes].flat(),
    starts = holes.map(
      (_, i) => outer.length + holes.slice(0, i).reduce((a, r) => a + r.length, 0),
    ),
    ix = earcut(all.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((k) => f.P(...all[k], z)),
      f.n.map((v) => (back ? -v : v)),
    );
}
function extrusion(o, s, outer, holes, f, front, back) {
  panel(o, s, outer, holes, f, front);
  panel(o, s, outer, holes, f, back, true);
  for (const [index, r] of [outer, ...holes].entries()) {
    const ccw = area(r) > 0;
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        k = (ccw ? 1 : -1) * (index ? -1 : 1),
        n = f.V((b[1] - a[1]) * k, (a[0] - b[0]) * k);
      Q(o, s, [f.P(...a, front), f.P(...a, back), f.P(...b, back), f.P(...b, front)], n);
    }
  }
}
const block = (o, s, f, x, y, w, h, front, back) =>
  extrusion(o, s, rect(x, y, w, h), [], f, front, back);
function prism(o, s, ring, lo, hi) {
  const r = cw(ring),
    ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    for (const [y, up] of [
      [lo, false],
      [hi, true],
    ])
      tri(
        o,
        s,
        ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
        [0, up ? 1 : -1, 0],
      );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      n = [a[1] - b[1], 0, b[0] - a[0]];
    Q(
      o,
      s,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      n,
    );
  }
}
function arc(width, height, n) {
  const r = width / 2,
    spring = height - Math.min(r * 0.65, height * 0.48);
  return [
    [-r, 0],
    [r, 0],
    ...Array.from({ length: n + 1 }, (_, i) => [
      r * Math.cos((i / n) * Math.PI),
      spring + (height - spring) * Math.sin((i / n) * Math.PI),
    ]),
  ];
}
function relief(o, f, x, y, w, h, d) {
  // Original geometric fan/chevron relief, not a copy of a photograph's pixels.
  block(o, 'trim', f, x, y, w, h, 0.12, -0.04);
  panel(o, 'wall', rect(x, y + 0.1, w - 0.2, h - 0.2), [], f, 0.125);
  if (!d) return;
  const ribs = d === 1 ? 2 : d === 2 ? 3 : 4;
  for (let j = 0; j < ribs; j++) {
    const yy = y + 0.45 + (j * (h - 0.75)) / ribs,
      rise = Math.min(h - (yy - y) - 0.13, w * 0.45),
      p = [
        f.P(x - w * 0.38, yy + rise, 0.16),
        f.P(x, yy, 0.16),
        f.P(x + w * 0.38, yy + rise, 0.16),
      ];
    if (d < 2) {
      for (const sg of [-1, 1])
        Q(
          o,
          'trim',
          [
            f.P(x, yy, 0.16),
            f.P(x + sg * w * 0.38, yy + rise, 0.16),
            f.P(x + sg * w * 0.38, yy + rise + 0.12, 0.16),
            f.P(x, yy + 0.12, 0.16),
          ],
          f.n,
        );
    } else {
      beam(o, 'trim', p[0], p[1], 0.12, 0.12, C.trim);
      beam(o, 'trim', p[1], p[2], 0.12, 0.12, C.trim);
    }
  }
}
function medallion(o, f, x, y, radius, d) {
  const n = d > 1 ? 12 : 6,
    ring = Array.from({ length: n }, (_, i) => [
      x + radius * Math.cos((i / n) * Math.PI * 2),
      y + radius * Math.sin((i / n) * Math.PI * 2),
    ]);
  extrusion(o, 'trim', ring, [], f, 0.15, 0.01);
  if (d > 1) {
    const small = ring.map(([a, b]) => [x + (a - x) * 0.67, y + (b - y) * 0.67]);
    panel(o, 'wall', small, [], f, 0.16);
    for (let j = 0; j < 4; j++)
      beam(
        o,
        'trim',
        f.P(x, y, 0.19),
        f.P(
          x + radius * 0.45 * Math.cos((j * Math.PI) / 2),
          y + radius * 0.45 * Math.sin((j * Math.PI) / 2),
          0.19,
        ),
        0.09,
        0.09,
        C.trim,
      );
  }
}
function decoFacade(o, f, width, bottom, top, d, panels = 3) {
  if (!d) return;
  const inner = width - 1.5,
    bay = inner / panels;
  for (let j = 0; j <= panels; j++) {
    const x = -inner / 2 + j * bay;
    block(o, 'trim', f, x, bottom + 0.2, 0.38, top - bottom - 0.5, 0.22, -0.04);
    if (d > 1)
      for (const sg of [-1, 1])
        block(o, 'wall', f, x + sg * 0.11, bottom + 0.4, 0.045, top - bottom - 0.95, 0.23, 0.21);
  }
  for (let j = 0; j < panels; j++) {
    const x = -inner / 2 + (j + 0.5) * bay,
      bh = Math.min(4.2, (top - bottom) * 0.48);
    relief(o, f, x, bottom + 2.1, bay - 0.62, bh, d);
    medallion(o, f, x, top - 1.5, Math.min(0.42, bay * 0.15), d);
    if (d > 1) block(o, 'glass', f, x, bottom + 0.3, Math.min(0.8, bay - 0.6), 1.6, 0.03, -0.03);
  }
  for (const [y, h, z] of [
    [bottom, 0.28, 0.25],
    [bottom + 0.42, 0.18, 0.12],
    [top - 0.3, 0.2, 0.17],
    [top - 0.1, 0.22, 0.3],
  ])
    block(o, 'trim', f, 0, y, width + 0.25, h, z, -0.12);
}
function serviceStair(o, f, x, d) {
  const n = d > 1 ? 26 : d ? 13 : 1,
    start = 1.6,
    end = -13.0,
    rise = 13.0;
  if (!d) {
    const p = [
      f.P(x - 0.75, 0, start),
      f.P(x + 0.75, 0, start),
      f.P(x + 0.75, rise, end),
      f.P(x - 0.75, rise, end),
    ];
    Q(o, 'metal', p, [0, 1, 0]);
    Q(o, 'metal', [...p].reverse(), [0, -1, 0]);
  } else
    for (let j = 0; j < n; j++)
      block(
        o,
        'metal',
        f,
        x,
        (j / n) * rise,
        1.5,
        0.1,
        start + ((end - start) * j) / n,
        start + ((end - start) * (j + 1)) / n,
      );
  for (const sg of [-1, 1]) {
    beam(
      o,
      'metal',
      f.P(x + sg * 0.72, 0, start),
      f.P(x + sg * 0.72, rise, end),
      d ? 0.14 : 0.3,
      0.24,
      C.metal,
    );
    if (d) {
      beam(
        o,
        'metal',
        f.P(x + sg * 0.75, 1.05, start),
        f.P(x + sg * 0.75, rise + 1.05, end),
        0.075,
        0.075,
        C.metal,
      );
      for (let j = 0; j <= 5; j++)
        beam(
          o,
          'metal',
          f.P(x + sg * 0.75, (j / 5) * rise, start + ((end - start) * j) / 5),
          f.P(x + sg * 0.75, (j / 5) * rise + 1.05, start + ((end - start) * j) / 5),
          0.065,
          0.065,
          C.metal,
        );
    }
  }
}
function mouth(o, p, d) {
  const y = p.end === 'east' ? datums.geometryEastFloorMeters : 0,
    f = frame(p.point, p.outward, y),
    eastDeco = p.end === 'east' && p.bore < 4,
    top = eastDeco ? (p.bore === 3 ? 15.8 : 12.5) : p.bore === 4 ? 11.8 : 8.0,
    w = p.width + (p.bore === 4 ? 4.2 : 2.1),
    opening =
      !d || p.bore === 3
        ? rect(0, 0, p.width, p.height)
        : arc(p.width, p.height, d === 1 ? 6 : d === 2 ? 12 : 20),
    outer = rect(0, -0.25, w, top + 0.25),
    depth = 28;
  extrusion(o, 'wall', outer, [opening], f, 0, -1.4);
  // The short mouth recess is real empty space. Only its distant back is closed.
  for (let j = 0; j < opening.length; j++) {
    const a = opening[j],
      b = opening[(j + 1) % opening.length],
      n = f.V(a[1] - b[1], b[0] - a[0]);
    Q(
      o,
      j === 0 ? 'road' : 'dark',
      [f.P(...a, -1.4), f.P(...b, -1.4), f.P(...b, -depth), f.P(...a, -depth)],
      n,
    );
  }
  panel(o, 'dark', opening, [], f, -depth);
  block(o, 'road', f, 0, -0.12, p.width, 0.13, 1.0, -depth);
  if (d) {
    for (const sg of [-1, 1]) {
      block(o, 'trim', f, sg * (p.width / 2 - 0.16), 0, 0.32, 0.22, 0.8, -depth);
      block(o, 'trim', f, sg * (w / 2 - 0.22), 0, 0.44, top, 0.25, -0.02);
    }
    for (const [yy, hh, zz] of [
      [top - 0.25, 0.25, 0.24],
      [top - 0.65, 0.16, 0.12],
    ])
      block(o, 'trim', f, 0, yy, w + 0.15, hh, zz, -0.2);
    const n = d === 1 ? 3 : d === 2 ? 6 : 10;
    for (let j = 0; j < n; j++) {
      const z = -2.1 - j * 2.5;
      for (const sg of [-1, 1]) {
        const x = sg * (p.width / 2 - 0.03),
          yy = p.height * 0.55;
        if (d === 1)
          Q(
            o,
            'light',
            [f.P(x, yy, z), f.P(x, yy, z - 0.42), f.P(x, yy + 0.2, z - 0.42), f.P(x, yy + 0.2, z)],
            f.V(-sg, 0, 0),
          );
        else block(o, 'light', f, x, yy, 0.14, 0.2, z, z - 0.42);
      }
      if (d > 1) {
        const roof = p.height - 0.03;
        beam(
          o,
          'metal',
          f.P(-p.width * 0.35, roof - 0.3, z),
          f.P(p.width * 0.35, roof - 0.3, z),
          0.09,
          0.09,
          C.metal,
        );
      }
    }
    if (eastDeco) decoFacade(o, f, w, p.height + 0.45, top, d, p.bore === 3 ? 3 : 2);
    if (p.bore === 4) {
      // Permanent side-wing profile is visible in the 2012 construction original;
      // its unseen finished trim is deliberately restrained and approximate.
      for (const sg of [-1, 1]) {
        const ring = [
          [(sg * w) / 2, 0],
          [sg * (w / 2 + 4.5), 0],
          [sg * (w / 2 + 4.5), 5.7],
          [(sg * w) / 2, 10.6],
        ];
        extrusion(o, 'wall', ring, [], f, -0.2, -2.0);
        for (let j = 0; j < (d > 2 ? 4 : 2); j++)
          block(
            o,
            'trim',
            f,
            sg * (p.width / 2 + 0.35 + j * 0.38),
            p.height + 0.35,
            0.15,
            2.5 - j * 0.3,
            0.13,
            -0.05,
          );
      }
    }
    if (d > 2)
      for (let yy = 0.65; yy < top - 0.3; yy += 1.2)
        for (const sg of [-1, 1])
          panel(o, 'trim', rect(sg * (p.width / 2 + 0.4), yy, 0.5, 0.023), [], f, 0.018);
  } else if (p.bore === 4)
    for (const sg of [-1, 1])
      extrusion(
        o,
        'wall',
        [
          [(sg * w) / 2, 0],
          [sg * (w / 2 + 4.5), 0],
          [sg * (w / 2 + 4.5), 5.7],
          [(sg * w) / 2, 10.6],
        ],
        [],
        f,
        -0.2,
        -2.0,
      );
  if (p.end === 'east' && p.bore === 3) serviceStair(o, f, w / 2 + 2.0, d);
}
function vent(o, building, d) {
  const r = cw(building.outline),
    old = building.id === 471964237,
    lo = 6.8,
    hi = old ? 23.0 : 21.0;
  prism(o, 'wall', r, lo, hi);
  // Own corner piers continue below the hillside-facing vent mass. Their hidden
  // lower termination is approximate and never used to flatten the host ground.
  for (const [x, z] of r.slice(0, 4)) {
    const rr = [
      [x - 0.38, z - 0.38],
      [x + 0.38, z - 0.38],
      [x + 0.38, z + 0.38],
      [x - 0.38, z + 0.38],
    ];
    prism(o, 'wall', rr, 0, lo);
  }
  if (!d) return;
  const edges = r
      .map((a, i) => {
        const b = r[(i + 1) % r.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return { a, b, len, mid: (a[1] + b[1]) / 2 };
      })
      .filter((e) => e.len > (old ? 20 : 15))
      .sort((a, b) => b.mid - a.mid),
    e = edges[0],
    point = e.a.map((v, k) => (v + e.b[k]) / 2),
    n = [(e.a[1] - e.b[1]) / e.len, (e.b[0] - e.a[0]) / e.len],
    f = frame(point, n);
  if (old) decoFacade(o, f, e.len, lo + 1.0, hi, d);
  else {
    for (let j = 0; j <= 5; j++)
      block(
        o,
        'trim',
        f,
        -e.len / 2 + 0.2 + (j * (e.len - 0.4)) / 5,
        lo,
        0.38,
        hi - lo,
        0.13,
        -0.01,
      );
    block(o, 'glass', f, 0, lo + 0.4, e.len - 1.4, 1.55, 0.025, -0.01);
    if (d > 1)
      for (let j = 0; j < 30; j++)
        block(
          o,
          'metal',
          f,
          -(e.len - 1.5) / 2 + (j * (e.len - 1.5)) / 29,
          lo + 0.4,
          0.06,
          1.55,
          0.075,
          0.02,
        );
  }
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    beam(o, 'trim', [a[0], hi, a[1]], [b[0], hi, b[1]], 0.25, 0.23, C.trim);
    if (d > 1)
      beam(o, 'trim', [a[0], hi - 0.38, a[1]], [b[0], hi - 0.38, b[1]], 0.12, 0.13, C.trim);
  }
}
function simplify(r, tolerance) {
  const out = [...r];
  let changed = true;
  while (changed && out.length > 4) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length],
        b = out[i],
        c = out[(i + 1) % out.length],
        length = Math.hypot(c[0] - a[0], c[1] - a[1]),
        dist = Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / length;
      if (dist < tolerance) {
        out.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return out;
}
function inside(point, ring) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function bridge(o, b, d) {
  const r = d ? b.outline : simplify(b.outline, 1.0),
    y = 6.8;
  prism(o, 'wall', r, y - 0.55, y);
  if (d)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        z = r[(i + 1) % r.length];
      if (d === 1) {
        const face = [
          [a[0], y + 0.88, a[1]],
          [z[0], y + 0.88, z[1]],
          [z[0], y + 0.98, z[1]],
          [a[0], y + 0.98, a[1]],
        ];
        Q(o, 'metal', face);
        Q(o, 'metal', [...face].reverse());
      } else beam(o, 'metal', [a[0], y + 0.95, a[1]], [z[0], y + 0.95, z[1]], 0.08, 0.09, C.metal);
      if (d > 1)
        beam(o, 'metal', [a[0], y + 0.45, a[1]], [z[0], y + 0.45, z[1]], 0.06, 0.07, C.metal);
      const len = Math.hypot(z[0] - a[0], z[1] - a[1]),
        count = Math.max(1, Math.round(len / (d > 1 ? 2.2 : 5)));
      for (let j = 0; j < count; j++) {
        if (d === 1 && (i % 2 || j % 2)) continue;
        const x = a[0] + ((z[0] - a[0]) * j) / count,
          zz = a[1] + ((z[1] - a[1]) * j) / count;
        beam(o, 'metal', [x, y, zz], [x, y + 0.95, zz], 0.07, 0.07, C.metal);
      }
    }
  const path = plan.bridgePaths
    .find((p) => p.id === (b.id === 1094966708 ? 9899497 : 692903204))
    ?.outline.filter((point) => inside(point, b.outline));
  if (path?.length)
    for (const j of [0, Math.floor(path.length / 2), path.length - 1]) {
      const p = path[j],
        q = [
          [p[0] - 0.5, p[1] - 0.5],
          [p[0] + 0.5, p[1] - 0.5],
          [p[0] + 0.5, p[1] + 0.5],
          [p[0] - 0.5, p[1] + 0.5],
        ];
      prism(o, 'wall', q, 0, y - 0.5);
    }
}
function build(o, _f, d = 3) {
  for (const p of plan.portals) mouth(o, p, d);
  for (const b of plan.buildings) vent(o, b, d);
  for (const b of plan.bridges) bridge(o, b, d);
}
export const caldecottSkyline = (o, f) => build(o, f, 0);
export const caldecottDistrict = (o, f) => build(o, f, 1);
export const caldecottStreet = (o, f) => build(o, f, 2);
const eastY = datums.geometryEastFloorMeters;
export const caldecottTunnelModel = {
  id: 'caldecott_tunnel',
  key: 'caldecott_tunnel',
  recipe: 'structure-caldecott-tunnel.mjs',
  cell: '9q/9q9',
  title: 'Caldecott Tunnel',
  category: 'tunnel',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'All four current Caldecott bores at both native endpoints: eight genuinely open short-lined mouths, older ArtDeco portal/vent architecture and plain third-bore west vent, restrained fourth-bore permanent concrete wings, whole native west vent footprints and two intrinsic curved service access bridges. Complete native1kmseparation/east-west rise retained, no mountain/site mesh/deep interior.',
  camera: [380, 560, 1150],
  lookAt: [0, 25, 0],
  portableGroundY: -0.35,
  mediumFiContext: { scale: 10, groundY: -0.35 },
  qaCameras: [
    {
      name: 'four-western-mouths-and-both-native-service-bridges',
      position: [-130, 43, 680],
      lookAt: [-12, 8, 510],
    },
    {
      name: 'original-art-deco-and-plain-third-bore-ventilation-houses',
      position: [10, 35, 565],
      lookAt: [34, 13, 480],
    },
    {
      name: 'complete-four-eastern-portals-and-decorated-third-bore-stair',
      position: [-130, eastY + 38, -675],
      lookAt: [12, eastY + 6, -526],
    },
    {
      name: 'fourth-bore-arched-mouth-and-permanent-raked-wings',
      position: [-83, 13, 590],
      lookAt: [-70, 5, 540],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent1400mfield frozen before geometry; west/east fixed approaches produce provider-relative46.4725mrise. Exact road thresholds/deep tunnel grade and host carving/contact remain unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-caldecott-tunnel.mjs',
    level: 'skyline',
    export: 'caldecottSkyline',
    errorMeters: 2.2,
    surfaces,
    authoredLevels: {
      district: { export: 'caldecottDistrict', errorMeters: 0.9, surfaces },
      street: { export: 'caldecottStreet', errorMeters: 0.35, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Complete current four-bore exterior and eight original native endpoints, two whole western vent footprints and both native access bridges. Original four complete subterranean alignments/bores3and4envelopes are plan controls; only28mvisible mouth recesses are built, not deep hidden interior or1kmburiedlining. No genericoneportal substitute or invented mountain/sitefloor.',
    'Four exact already-published local Qualla originals only: Pegship2007PD-selfwestern three-bore architecture and PedroXing2012CC0fourth permanent sideform/thirdplainvent,eastdecoratedportal,bore1lining. NativeSHA1/owncreatorgrants bound. Fourth completedface/unseen ornament and unphotographed east subsidiary faces remain restrained bounded estimates; no claim of exact current cosmetic finish. Caption2685bore3 retained without blindly assigning all east portal identities. CC-BYceremony/uncertainJPEGhero/other unrelated media unused; no copiedpixels/generatedbitmap.',
    'Actual native plan widths/positions/onekmendpointseparation retained. All heights/clear sections/facade ornaments/pier depths/bridge support census/rail/stair spacing/hidden roofs remain photographic medium-fi estimates; source primarytext confirms4bores/2laneseach and1937/1964/2013eras. Original representative chevronfanrelief/pilasters/medallions, not exact sculptural reproductions. Skylinecoarsens arches to rectangles/relief/rails/buriedstair details within2.2merror; districtcoarsens ribs/medallions/railspacing within0.9merror.',
    'Independent1400m141x141at10mTerrariumfield/rawtiles/grid/PNG frozen before geometry without flattening/fitting. Fixed west/east originalbore2frontapproaches give westdatum228.4939m/eastrelative46.4725m; commonfloorat eachend is provider-relative approximation, not surveyed roadway/tunnelgrade. Exact thresholds/cuttings/underbridge supports and host tunnelterraincarving/contact unverified; geographicpreview/replaceFootprintfalse. Flat review ground cannot certify east contact. No hillside mesh/trees/ordinaryroads/neighborhoodbuildings/vehicles/people/temporaryconstruction/lettering.',
  ],
};
