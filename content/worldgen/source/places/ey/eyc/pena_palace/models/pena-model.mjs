/** Pena Palace's hilltop wings, open convent courts, retaining walls and towers. */
import { readFileSync } from 'node:fs';
import earcut from '../../../../../../../../packages/worldgen/node_modules/earcut/src/earcut.js';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.89 },
  stone: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.95 },
  glazed: { slot: 'trim', graph: 'tile_glazed', roughness: 0.76 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.79, metallic: 0.16 },
  clay: { slot: 'roof', graph: 'tile_flat', roughness: 0.88 },
};
const colors = {
  ochre: [0.93, 0.56, 0.09],
  red: [0.66, 0.092, 0.056],
  blue: [0.23, 0.32, 0.44],
  granite: [0.48, 0.44, 0.36],
  trim: [0.84, 0.8, 0.69],
  darkLead: [0.2, 0.25, 0.28],
  gold: [0.86, 0.62, 0.12],
  clay: [0.48, 0.18, 0.12],
  glass: [0.18, 0.25, 0.27],
  shade: [0.32, 0.29, 0.23],
  pale: [0.95, 0.89, 0.77],
  hand: [0.11, 0.14, 0.13],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  ref = 'palette:#ffffff',
  up = [0, 1, 0],
  down = [0, -1, 0];
const mix = (a, b, t) => a + (b - a) * t;
const P = ([x, z], y) => [x, y, z];
const slot = (t) => (t === 'granite' ? 'stone' : t === 'blue' ? 'glazed' : 'plaster');
const rod = (out, component, t, a, b, w, d = w) => beam(out, component, a, b, w, d, colors[t]);
function face(out, component, t, points, n) {
  let normal = normalFor(...points);
  if (normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  if (Math.hypot(...normal) > 0.5)
    out.addTriangle(component, ref, points, normal, undefined, colors[t]);
}
function quad(out, component, t, a, b, c, d, n) {
  face(out, component, t, [a, b, c], n);
  face(out, component, t, [a, c, d], n);
}
function flat(out, component, t, outer, holes, y, n = up) {
  const rings = [outer, ...holes],
    points = rings.flat(),
    cuts = [];
  let offset = outer.length;
  for (const r of holes) {
    cuts.push(offset);
    offset += r.length;
  }
  const tri = earcut(points.flat(), cuts);
  for (let i = 0; i < tri.length; i += 3)
    face(
      out,
      component,
      t,
      tri.slice(i, i + 3).map((j) => P(points[j], y)),
      n,
    );
}
const sign = (ring) =>
  Math.sign(
    ring.reduce((s, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
function edges(ring, inside = false) {
  const orientation = sign(ring) * (inside ? -1 : 1);
  return ring
    .map(([x, z], i) => {
      const [a, b] = ring[(i + 1) % ring.length],
        dx = a - x,
        dz = b - z,
        len = Math.hypot(dx, dz);
      return {
        x,
        z,
        a,
        b,
        len,
        i,
        ux: dx / len,
        uz: dz / len,
        n: [(orientation * dz) / len, 0, (-orientation * dx) / len],
      };
    })
    .filter((e) => e.len > 0.03);
}
function archGlass(out, point, w, bottom, h, tier, tone = 'glass') {
  const n = point(0, 0, 1).map((x, i) => x - point(0, 0, 0)[i]),
    width = w * 0.5,
    count = tier < 3 ? 4 : 9;
  if (tier === 1) {
    quad(
      out,
      'roof',
      tone,
      point(-width, bottom, 0.017),
      point(width, bottom, 0.017),
      point(width, bottom + h * 0.86, 0.017),
      point(-width, bottom + h * 0.86, 0.017),
      n,
    );
    return;
  }
  const curve = Array.from({ length: count + 1 }, (_, i) => {
    const t = -1 + (2 * i) / count;
    return [t * width, bottom + h * (0.7 + 0.3 * Math.sqrt(Math.max(0, 1 - t * t)))];
  });
  const ring = [[-width, bottom], [width, bottom], ...curve.toReversed()],
    tri = earcut(ring.flat());
  for (let i = 0; i < tri.length; i += 3)
    face(
      out,
      'roof',
      tone,
      tri.slice(i, i + 3).map((j) => point(...ring[j], 0.017)),
      n,
    );
  if (tier < 2) return;
  const strip = ([a, y], [b, z]) => {
    const l = Math.hypot(b - a, z - y),
      dx = ((z - y) * 0.063) / l,
      dy = (-(b - a) * 0.063) / l;
    quad(
      out,
      'stone',
      'trim',
      point(a - dx, y - dy, 0.07),
      point(b - dx, z - dy, 0.07),
      point(b + dx, z + dy, 0.07),
      point(a + dx, y + dy, 0.07),
      n,
    );
  };
  const border = [[-width, bottom], ...curve, [width, bottom], [-width, bottom]];
  for (let i = 1; i < border.length; i++) strip(border[i - 1], border[i]);
  if (tier >= 3) {
    rod(
      out,
      'stone',
      'trim',
      point(0, bottom + 0.04, 0.072),
      point(0, bottom + h * 0.91, 0.072),
      0.053,
      0.049,
    );
    rod(
      out,
      'stone',
      'trim',
      point(-width * 0.93, bottom + h * 0.57, 0.075),
      point(width * 0.93, bottom + h * 0.57, 0.075),
      0.052,
      0.047,
    );
  }
}
function parapet(out, e, point, top, tier, tone) {
  const s = slot(tone),
    n = e.n;
  if (tier === 0 || (tier === 1 && tone !== 'granite')) {
    quad(
      out,
      tier === 0 ? s : 'stone',
      tier === 0 ? tone : 'trim',
      point(0, top, 0.018),
      point(e.len, top, 0.018),
      point(e.len, top + 0.53, 0.018),
      point(0, top + 0.53, 0.018),
      n,
    );
    return;
  }
  const step = tier === 1 ? 1.75 : tier === 2 ? 1.34 : 1.12,
    y = top + 0.48,
    front = 0.06,
    back = -0.28;
  quad(
    out,
    'stone',
    'trim',
    point(0, top - 0.19, front),
    point(e.len, top - 0.19, front),
    point(e.len, y, front),
    point(0, y, front),
    n,
  );
  quad(
    out,
    'stone',
    'trim',
    point(0, y, front),
    point(e.len, y, front),
    point(e.len, y, back),
    point(0, y, back),
    up,
  );
  quad(
    out,
    'stone',
    'trim',
    point(0, top, back),
    point(e.len, top, back),
    point(e.len, y, back),
    point(0, y, back),
    n.map((v) => -v),
  );
  for (let x = step * 0.5; x < e.len - 0.21; x += step) {
    const w = step * 0.29,
      h = tier >= 2 ? 0.62 : 0.47;
    if (tier < 3) {
      const facePoints = [
        point(x - w, y, front),
        point(x + w, y, front),
        point(x + w * 0.84, y + h, front),
        point(x - w * 0.84, y + h, front),
      ];
      quad(out, 'stone', 'trim', ...facePoints, n);
      quad(
        out,
        'stone',
        'trim',
        ...facePoints,
        n.map((v) => -v),
      );
      continue;
    }
    const right =
      tone === 'granite'
        ? [
            [w, 0],
            [w * 0.83, 0.32],
            [w * 1.12, 0.66],
            [w * 0.62, 0.86],
            [w * 0.28, 1],
            [0, 1],
          ]
        : [
            [w, 0],
            [w * 0.84, 1],
            [0, 1],
          ];
    const polygon = [
      ...right,
      ...right
        .slice(0, -1)
        .toReversed()
        .map(([a, b]) => [-a, b]),
    ];
    const at = ([a, b], d) => point(x + a, y + b * h, d),
      tri = earcut(polygon.flat());
    for (const d of [front, back]) {
      const normal = d === front ? n : n.map((v) => -v);
      for (let i = 0; i < tri.length; i += 3)
        face(
          out,
          'stone',
          'trim',
          tri.slice(i, i + 3).map((j) => at(polygon[j], d)),
          normal,
        );
    }
    for (let i = 1; i < polygon.length; i++) {
      const a = polygon[i - 1],
        b = polygon[i],
        normal = [e.ux * (b[1] - a[1]), a[0] - b[0], e.uz * (b[1] - a[1])];
      quad(out, 'stone', 'trim', at(a, front), at(a, back), at(b, back), at(b, front), normal);
    }
    rod(out, 'stone', 'shade', point(x, top - 0.38, -0.01), point(x, top - 0.08, 0.12), 0.27, 0.18);
  }
}
const edgePoint = (e) => (u, y, v) => [e.x + e.ux * u + e.n[0] * v, y, e.z + e.uz * u + e.n[2] * v];
function crossing(e, line) {
  const [[a, b], [c, d]] = line,
    dx = c - a,
    dz = d - b,
    den = e.ux * dz - e.uz * dx;
  if (Math.abs(den) < 0.01) return null;
  const u = ((a - e.x) * dz - (b - e.z) * dx) / den;
  return u > 0.7 && u < e.len - 0.7 ? u : null;
}
function openingWall(out, e, options, tier) {
  const { u, half, floor, neck, rise, top, bases, tone } = options,
    point = edgePoint(e),
    n = e.n;
  const count = tier < 2 ? 6 : 14,
    curve = Array.from({ length: count + 1 }, (_, i) => {
      const a = (i / count) * Math.PI;
      return [u - half * Math.cos(a), floor + neck + rise * Math.sin(a)];
    });
  const boundary = [[u - half, floor], ...curve, [u + half, floor]];
  const polygon = [
    [0, bases[0]],
    [u - half, mix(...bases, (u - half) / e.len)],
    ...boundary,
    [u + half, mix(...bases, (u + half) / e.len)],
    [e.len, bases[1]],
    [e.len, top],
    [0, top],
  ];
  const tri = earcut(polygon.flat()),
    wall = slot(tone);
  for (let i = 0; i < tri.length; i += 3)
    face(
      out,
      wall,
      tone,
      tri.slice(i, i + 3).map((j) => point(...polygon[j], 0)),
      n,
    );
  const profile = boundary.map((p) => point(...p, 0));
  if (tier === 0) return profile;
  for (let i = 1; i < boundary.length; i++) {
    const a = boundary[i - 1],
      b = boundary[i],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy);
    const outward = [e.ux * dy, -dx, e.uz * dy],
      size = tier >= 2 ? 0.26 : 0.15;
    const trimA = [a[0] - (dy / len) * size, a[1] + (dx / len) * size],
      trimB = [b[0] - (dy / len) * size, b[1] + (dx / len) * size];
    quad(
      out,
      'stone',
      i % 3 ? 'trim' : 'granite',
      point(...a, 0.044),
      point(...b, 0.044),
      point(...trimB, 0.044),
      point(...trimA, 0.044),
      n,
    );
    quad(
      out,
      'stone',
      'shade',
      point(...a, 0.044),
      point(...a, -0.29),
      point(...b, -0.29),
      point(...b, 0.044),
      outward,
    );
  }
  if (tier < 2 || tone !== 'blue') return profile;
  const base = floor + 0.14,
    capital = floor + neck + 0.13;
  for (const side of [-1, 1]) {
    const x = u + side * (half + 0.46),
      center = point(x, 0, 0.3),
      levels = [
        [base - 0.13, 0.32],
        [base, 0.34],
        [base + 0.18, 0.23],
        [capital - 0.24, 0.23],
        [capital - 0.14, 0.32],
        [capital, 0.33],
      ];
    loft(
      out,
      'stone',
      levels.map(([y, r]) => radialRing(y, r, r, 8, [center[0], center[2]])),
      colors.trim,
    );
    if (tier >= 3)
      for (const phase of [0, Math.PI]) {
        let prev;
        for (let i = 0; i <= 32; i++) {
          const a = (i / 32) * Math.PI * 6 + phase,
            pt = point(
              x + 0.237 * Math.cos(a),
              mix(base + 0.2, capital - 0.25, i / 32),
              0.3 + 0.237 * Math.sin(a),
            );
          if (prev) rod(out, 'stone', 'granite', prev, pt, 0.055);
          prev = pt;
        }
      }
  }
  const y = floor + neck + rise + 0.37;
  rod(
    out,
    'stone',
    'trim',
    point(u - half - 0.84, y, 0.25),
    point(u + half + 0.84, y, 0.25),
    0.27,
    0.47,
  );
  if (tier >= 3) {
    const x = u,
      stone = [
        [y + 0.1, 0.28],
        [y + 0.37, 0.31],
        [y + 0.75, 0.18],
        [y + 0.93, 0.14],
      ];
    const [a, , b] = point(x, y, 0.26);
    loft(
      out,
      'stone',
      stone.map(([y, r]) => radialRing(y, r, r * 0.66, 8, [a, b])),
      colors.granite,
    );
    for (const side of [-1, 1])
      rod(
        out,
        'stone',
        'trim',
        point(x, y + 0.43, 0.38),
        point(x + side * 0.62, y + 0.2, 0.32),
        0.16,
        0.18,
      );
  }
  return profile;
}
function vault(out, [first, second]) {
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const aligned =
    distance(first[0], second[0]) < distance(first[0], second.at(-1))
      ? second
      : second.toReversed();
  const cross = [aligned[0][0] - first[0][0], 0, aligned[0][2] - first[0][2]];
  for (let i = 1; i < first.length; i++) {
    const a = first[i - 1],
      b = first[i],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      dz = b[2] - a[2];
    const n = normalFor(a, b, aligned[i]);
    const toAxis = [
      (first.at(-1)[0] + first[0][0]) / 2 + cross[0] * 0.5 - a[0],
      first[0][1] - a[1],
      (first.at(-1)[2] + first[0][2]) / 2 + cross[2] * 0.5 - a[2],
    ];
    const normal = n.reduce((s, v, j) => s + v * toAxis[j], 0) < 0 ? n.map((x) => -x) : n;
    if (Math.hypot(dx, dy, dz) > 0.005)
      quad(out, 'stone', i % 4 ? 'granite' : 'shade', a, b, aligned[i], aligned[i - 1], normal);
  }
}
function body(out, b, tier) {
  const { tone, top, role } = b,
    s = slot(tone);
  const outer = tier === 0 && b.outer.length > 10 ? b.outer.filter((_, i) => i % 2 === 0) : b.outer;
  const holes = b.holes;
  const terrace = role.includes('terrace') || role.includes('lookout') || role === 'gate-wing';
  flat(
    out,
    terrace ? 'stone' : tone === 'red' ? 'clay' : s,
    terrace ? 'granite' : tone === 'red' ? 'clay' : tone,
    outer,
    holes,
    top,
  );
  const baseByPoint = new Map(b.outer.map((p, i) => [p, b.base[i]])),
    portals = [];
  for (const [i, ring] of [outer, ...holes].entries()) {
    if (i > 0)
      flat(
        out,
        'stone',
        'granite',
        ring,
        [],
        Math.min(top - 1.3, Math.max(b.ground + 0.16, top - 4.1)),
      );
    for (const e of edges(ring, i > 0)) {
      const { x, z, a, b: k, len, ux, uz, n } = e;
      const point = (u, h, v) => [x + ux * u + n[0] * v, h, z + uz * u + n[2] * v];
      const y1 =
        i > 0 ? top - 4.22 : Math.min(top - 0.28, baseByPoint.get(ring[e.i]) ?? b.ground - 0.52);
      const y2 =
        i > 0
          ? top - 4.22
          : Math.min(top - 0.28, baseByPoint.get(ring[(e.i + 1) % ring.length]) ?? b.ground - 0.52);
      const gate =
        role === 'azulejo-portal' && len > 7 ? crossing(e, layout.portal.centerline) : null;
      if (gate !== null)
        portals.push(
          openingWall(
            out,
            e,
            {
              u: gate,
              half: layout.portal.span / 2,
              floor: layout.portal.floor,
              neck: layout.portal.neck,
              rise: layout.portal.rise,
              top,
              bases: [y1, y2],
              tone,
            },
            tier,
          ),
        );
      else quad(out, s, tone, [x, y1, z], [a, y2, k], [a, top, k], [x, top, z], n);
      if (
        i === 0 &&
        ((terrace && role !== 'terrace-pavilion') ||
          role.includes('clock') ||
          role.includes('tower') ||
          role === 'convent-cloister' ||
          role === 'south-hall' ||
          role === 'middle-gallery')
      )
        parapet(out, e, point, top, tier, tone);
      if (tier === 0 || terrace || len < 1.85 || top - Math.max(y1, y2) < 3) continue;
      const count = Math.max(1, Math.round(len / (i ? 2.8 : 3.25)));
      for (let j = 0; j < count; j++) {
        const u = (len * (j + 0.5)) / count,
          center = (x, y, z) => point(u + x, y, z);
        const w = Math.min((len / count) * 0.56, 1.68),
          archH = role === 'azulejo-portal' ? 2.55 : 1.92;
        archGlass(out, center, w, top - 3.14, archH, tier);
        if (
          tier >= 2 &&
          top - Math.max(y1, y2) > 6.2 &&
          (gate === null || Math.abs(u - gate) > 2.4)
        )
          archGlass(out, center, w * 0.85, top - 5.7, 1.4, tier);
      }
    }
  }
  if (portals.length === 2) vault(out, portals);
}
function eastGate(out, b, tier) {
  const { gateCenterline, gateFloor } = layout.approach,
    top = b.top + 0.92,
    portals = [];
  flat(out, 'stone', 'trim', b.outer, [], top);
  for (const e of edges(b.outer)) {
    const next = (e.i + 1) % b.outer.length,
      bases = [b.base[e.i], b.base[next]],
      point = edgePoint(e);
    if (e.len > 7) {
      const u = crossing(e, gateCenterline.slice(0, 2));
      portals.push(
        openingWall(
          out,
          e,
          { u, half: 1.65, floor: gateFloor, neck: 1.97, rise: 1.22, top, bases, tone: 'granite' },
          tier,
        ),
      );
    } else
      quad(
        out,
        'stone',
        'granite',
        point(0, bases[0], 0),
        point(e.len, bases[1], 0),
        point(e.len, top, 0),
        point(0, top, 0),
        e.n,
      );
    parapet(out, e, point, top, tier, 'granite');
  }
  vault(out, portals);
}
function ribbon(out, route, width, tone) {
  const [a, b] = [route[0], route.at(-1)],
    dx = b[0] - a[0],
    dz = b[2] - a[2],
    d = Math.hypot(dx, dz);
  const point = ([x, y, z], s) => [
    x + (((s * dz) / d) * width) / 2,
    y,
    z - (((s * dx) / d) * width) / 2,
  ];
  for (let i = 1; i < route.length; i++)
    quad(
      out,
      'stone',
      tone,
      point(route[i - 1], -1),
      point(route[i - 1], 1),
      point(route[i], 1),
      point(route[i], -1),
      up,
    );
}
function platforms(out, tier) {
  const { terrace: t, approach: a, portal: p } = layout;
  flat(out, 'clay', 'clay', t.outer, [], t.top);
  for (const e of edges(t.outer)) {
    const point = edgePoint(e);
    quad(
      out,
      'stone',
      'granite',
      point(0, t.base[e.i], 0),
      point(e.len, t.base[(e.i + 1) % t.outer.length], 0),
      point(e.len, t.top, 0),
      point(0, t.top, 0),
      e.n,
    );
    if (t.outerParapetEdges.includes(e.i)) parapet(out, e, point, t.top, tier, 'granite');
  }
  const [a0, a1, a2] = a.gateCenterline;
  ribbon(
    out,
    [
      P(a0, a.grade[0]),
      P([-10.33, 22.74], a.gateFloor),
      P(a1, a.gateFloor),
      P([-13.49, 22.49], a.gateFloor),
      P(a2, a.grade[2]),
    ],
    2.72,
    'granite',
  );
  ribbon(
    out,
    [
      P([-0.2, 3.8], 5.24),
      P([0.56, -1.45], p.floor),
      P(p.centerline[0], p.floor),
      P(p.centerline[1], p.floor),
      P([2.9, -10.96], p.floor + 0.012),
    ],
    2.3,
    'granite',
  );
}
function terraceLantern(out, tier) {
  const roof = layout.roofs.at(-1),
    [x, z] = roof.center,
    ground = layout.bodies.find((b) => b.role === 'terrace-pavilion').top;
  const n = tier === 0 ? 4 : tier === 1 ? 6 : 8,
    sides = tier < 2 ? 6 : 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      c = x + 1.22 * Math.cos(a),
      s = z + 1.22 * Math.sin(a);
    if (tier < 2) {
      rod(out, 'stone', 'trim', [c, ground, s], [c, roof.base, s], 0.23, 0.23);
      continue;
    }
    const profile = [
      [ground, 0.16],
      [ground + 0.18, 0.21],
      [ground + 0.29, 0.15],
      [roof.base - 0.46, 0.15],
      [roof.base - 0.28, 0.21],
      [roof.base - 0.17, 0.25],
    ];
    loft(
      out,
      'stone',
      profile.map(([y, r]) => radialRing(y, r, r, sides, [c, s])),
      colors.trim,
    );
  }
  const cap = [
    [roof.base - 0.29, 1.37],
    [roof.base - 0.23, 1.56],
    [roof.base + 0.04, 1.62],
    [roof.base + 0.19, 1.51],
  ];
  loft(
    out,
    'stone',
    (tier < 2 ? [cap[0], cap.at(-1)] : cap).map(([y, r]) => radialRing(y, r, r, n * 2, [x, z])),
    colors.trim,
  );
  if (tier >= 2)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2,
        c = Math.cos(a),
        s = Math.sin(a),
        y = roof.base - 0.22;
      rod(
        out,
        'stone',
        'shade',
        [x + 1.34 * c, y - 0.13, z + 1.34 * s],
        [x + 1.53 * c, y + 0.09, z + 1.53 * s],
        0.105,
      );
    }
}
function dome(out, r, tier) {
  const {
      center: [x, z],
      base,
      radius,
      rise,
      tone,
    } = r,
    n = tier === 0 ? 8 : tier === 1 ? 12 : tier === 2 ? 18 : tier === 3 ? 28 : 40;
  const type = tone === 'gold' ? 'gold' : 'darkLead',
    profile =
      type === 'gold'
        ? [
            [0, 0.75],
            [0.22, 1],
            [0.48, 0.92],
            [0.69, 0.58],
            [0.91, 0.23],
            [1, 0.06],
          ]
        : [
            [0, 1],
            [0.16, 0.992],
            [0.35, 0.91],
            [0.59, 0.72],
            [0.8, 0.48],
            [0.95, 0.24],
            [1, 0.055],
          ];
  const top =
    tier === 0 ? profile.filter((_, i) => i === 0 || i === 2 || i === profile.length - 1) : profile;
  loft(
    out,
    'roof',
    top.map(([t, u]) => radialRing(base + t * rise, radius * u, radius * u, n, [x, z])),
    colors[tone],
    { cap: false },
  );
  const tipRadius = radius * top.at(-1)[1],
    tipOutline = radialRing(base + rise, tipRadius, tipRadius, n, [x, z]);
  flat(
    out,
    'roof',
    tone,
    tipOutline.map(([x, , z]) => [x, z]),
    [],
    base + rise,
  );
  if (tier < 2) return;
  const y = base + rise,
    tip = [
      [y, radius * 0.052],
      [y + 0.24, radius * 0.069],
      [y + 0.53, radius * 0.033],
      [y + 0.92, 0.024],
    ];
  loft(
    out,
    'roof',
    tip.map(([h, r]) => radialRing(h, r, r, 8, [x, z])),
    colors[tone],
  );
  if (tier >= 3)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2,
        c = Math.cos(a),
        s = Math.sin(a);
      const pts = profile.map(([t, u]) => [
        x + (radius * u + 0.025) * c,
        base + rise * t,
        z + (radius * u + 0.025) * s,
      ]);
      for (let j = 1; j < pts.length; j++) rod(out, 'roof', tone, pts[j - 1], pts[j], 0.05);
    }
}
function clocks(out, tier) {
  const { ring, face: y, top } = layout.clock;
  const corners = tier === 0 ? ring.filter((_, i) => i % 2 === 0) : ring;
  for (const [x, z] of corners) {
    const y = top - 0.89,
      n = tier < 2 ? 5 : 9,
      shaft = [
        [y, 0.22],
        [y + 0.37, 0.38],
        [y + 2.01, 0.38],
        [y + 2.12, 0.42],
      ];
    loft(
      out,
      'plaster',
      (tier === 0 ? [shaft[0], shaft.at(-1)] : shaft).map(([y, r]) =>
        radialRing(y, r, r, n, [x, z]),
      ),
      colors.red,
    );
    const cap = [
      [y + 2.12, 0.46],
      [y + 2.51, 0.32],
      [y + 3.36, 0.026],
    ];
    loft(
      out,
      'stone',
      (tier === 0 ? [cap[0], cap.at(-1)] : cap).map(([y, r]) => radialRing(y, r, r, n, [x, z])),
      colors.trim,
      { cap: false },
    );
  }
  if (tier === 0) return;
  for (const e of edges(ring).filter((e) => e.len > 3)) {
    const n = e.n,
      point = (a, b, c) => [
        e.x + e.ux * (e.len * 0.5 + a) + n[0] * c,
        y + b,
        e.z + e.uz * (e.len * 0.5 + a) + n[2] * c,
      ];
    const r = 1.19,
      nSides = tier === 1 ? 10 : 20,
      loop = Array.from({ length: nSides }, (_, i) => [
        Math.cos((i / nSides) * 2 * Math.PI) * r,
        Math.sin((i / nSides) * 2 * Math.PI) * r,
      ]);
    for (let i = 0; i < nSides; i++)
      face(
        out,
        'stone',
        'pale',
        [point(0, 0, 0.028), point(...loop[i], 0.028), point(...loop[(i + 1) % nSides], 0.028)],
        n,
      );
    if (tier < 2) continue;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 2 * Math.PI;
      rod(
        out,
        'roof',
        'hand',
        point(0.89 * Math.cos(a), 0.89 * Math.sin(a), 0.061),
        point(1.06 * Math.cos(a), 1.06 * Math.sin(a), 0.061),
        0.042,
        0.034,
      );
    }
    rod(out, 'roof', 'hand', point(0, 0, 0.077), point(-0.62, 0.48, 0.077), 0.055, 0.04);
    rod(out, 'roof', 'hand', point(0, 0, 0.076), point(0.39, 0.29, 0.076), 0.072, 0.045);
  }
}
export function buildPenaLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error('Unknown Pena Palace tier ' + level);
  const omit = new Set(tier === 0 ? ['lookout-base', 'gate-wing', 'lower-red-terrace'] : []);
  for (const b of layout.bodies) {
    if (omit.has(b.role)) continue;
    if (b.role === 'east-gate') eastGate(out, b, tier);
    else body(out, b, tier);
  }
  platforms(out, tier);
  terraceLantern(out, tier);
  for (const r of layout.roofs) dome(out, r, tier);
  clocks(out, tier);
}
export const buildPenaSkyline = (out) => buildPenaLevel(out, 'skyline');
export const buildPenaDistrict = (out) => buildPenaLevel(out, 'district');
export const buildPenaStreet = (out) => buildPenaLevel(out, 'street');
export const buildPenaCloseup = (out) => buildPenaLevel(out, 'closeup');
