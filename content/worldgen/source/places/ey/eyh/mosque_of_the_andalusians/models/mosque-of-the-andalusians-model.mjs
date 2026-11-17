/** April 2016 exterior of the Mosque of the Andalusians, Fez. */
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  section = plan.section;
const geo = read('map-frame').geometry,
  [outer] = geo.polygons,
  [court] = geo.interiorRings;
const grid = read('terrain-grid');
const up = [0, 1, 0];
const materials = {
  lime: ['wall', 'plaster_lime'],
  stone: ['trim', 'stone_limestone'],
  roof: ['roof', 'tile_glazed'],
  cedar: ['trim', 'wood_plain'],
  mosaic: ['trim', 'tile_mosaic'],
  well: ['window', null],
  brass: ['trim', null],
};
const surfaces = Object.fromEntries(
  Object.entries(materials).map(([name, [slot, graph]]) => [
    name,
    {
      slot,
      ...(graph ? { graph } : { localRef: 'palette:#ffffff' }),
      roughness: name === 'roof' ? 0.85 : 0.95,
      metallic: 0,
    },
  ]),
);
const colors = Object.fromEntries(
  Object.entries({
    lime: 'd8c9ac',
    shade: 'bbab90',
    bright: 'e1d4bc',
    base: 'a99677',
    stone: 'cfbfa0',
    green: '437058',
    darkGreen: '315748',
    rich: '4e765b',
    cedar: '694b38',
    gate: '5d3930',
    woodTrim: '86624c',
    burgundy: '775254',
    blue: '4e6181',
    teal: '4c8378',
    white: 'e5d4b3',
    paved: 'b9a990',
    dark: '50463a',
    water: '658d84',
    bronze: '827456',
  }).map(([key, v]) => [key, rgb(v)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const point = (p, y) => [p[0], y, p[1]];
const between = (a, b, t) => a.map((v, j) => mix(v, b[j], t));
const delta = (a, b) => b.map((v, j) => v - a[j]);
const unit = (v) => {
  const d = Math.hypot(...v);
  return v.map((k) => k / d);
};
const at = (p, u, x) => p.map((v, k) => v + u[k] * x);
const norm3 = (xz) => [xz[0], 0, xz[1]];
const outward = (a, b) => {
  const [x, z] = unit(delta(a, b));
  return [z, -x];
};
const height = ([x, z]) => {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = grid.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    grid.modelDatumElevationMeters
  );
};
function surface(out, slot, points, normal, color) {
  const n = normalFor(...points);
  const p = n.reduce((sum, x, k) => sum + x * normal[k], 0) > 0 ? points : points.toReversed();
  (p.length === 3 ? triangle : face)(out, slot, p, color);
}
function fill(out, slot, polygon, toPoint, normal, color, holes = []) {
  const v = polygon.concat(...holes),
    starts = [];
  holes.reduce((n, h) => {
    starts.push(n);
    return n + h.length;
  }, polygon.length);
  const ix = earcut(v.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    surface(
      out,
      slot,
      ix.slice(i, i + 3).map((k) => toPoint(...v[k])),
      normal,
      color,
    );
}
const rectangle = (l, b, r, t) => [
  [l, b],
  [r, b],
  [r, t],
  [l, t],
];
function wallFrame(a, b) {
  const u = unit(delta(a, b)),
    n = outward(a, b);
  return {
    length: Math.hypot(...delta(a, b)),
    n: norm3(n),
    p: (x, y, d = 0) => point(at(at(a, u, x), n, d), y),
    u,
    n2: n,
  };
}
function panel(out, slot, f, l, b, r, t, d, color) {
  surface(
    out,
    slot,
    rectangle(l, b, r, t).map(([x, y]) => f.p(x, y, d)),
    f.n,
    color,
  );
}
function solid(out, slot, origin, u, n, l, r, front, back, base, top, color) {
  const p = (x, z, y) => point(at(at(origin, u, x), n, z), y);
  for (const [x, z, xx, zz, norm] of [
    [l, front, r, front, norm3(n)],
    [r, front, r, back, norm3(u)],
    [r, back, l, back, norm3(n.map((x) => -x))],
    [l, back, l, front, norm3(u.map((x) => -x))],
  ])
    surface(out, slot, [p(x, z, base), p(xx, zz, base), p(xx, zz, top), p(x, z, top)], norm, color);
  surface(
    out,
    slot,
    [p(l, front, top), p(r, front, top), p(r, back, top), p(l, back, top)],
    up,
    color,
  );
}
function arch(l, b, r, s, rise, n) {
  // Horseshoe arch expands beyond its springing before closing at the crown.
  const center = (l + r) / 2,
    radius = (r - l) / 2;
  return [
    [l, b],
    [r, b],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const t = mix(-0.31, Math.PI + 0.31, i / n);
      return [
        center + (radius / Math.cos(0.31)) * Math.cos(t),
        s + (Math.sin(t) + Math.sin(0.31)) * rise,
      ];
    }),
  ];
}
const [edgeA, edgeB] = section.portalEdge.map((i) => outer[i]);
const entrance = wallFrame(edgeA, edgeB);
const entranceCenter = between(edgeA, edgeB, section.portalCenterRatio);
const portal = wallFrame(
  at(entranceCenter, entrance.u, -section.portalWidth / 2),
  at(entranceCenter, entrance.u, section.portalWidth / 2),
);
const roofU = unit(delta(court[2], court[3])),
  roofV = [-roofU[1], roofU[0]];
const roofSection = (p) => p[0] * roofV[0] + p[1] * roofV[1];
const portalStart = entrance.length * section.portalCenterRatio - section.portalWidth / 2;

function exteriorWalls(out, lod) {
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length],
      f = wallFrame(a, b),
      roof = section.roofEave;
    const bays =
      i === section.portalEdge[0]
        ? [
            [0, portalStart],
            [portalStart + section.portalWidth, f.length],
          ]
        : [[0, f.length]];
    for (const [l, r] of bays) {
      const b0 = height(between(a, b, l / f.length)) - 0.35,
        b1 = height(between(a, b, r / f.length)) - 0.35;
      surface(
        out,
        'lime',
        [f.p(l, b0), f.p(r, b1), f.p(r, roof), f.p(l, roof)],
        f.n,
        i % 3 === 1 ? colors.bright : colors.lime,
      );
      if (lod > 0)
        surface(
          out,
          'stone',
          [
            f.p(l, b0, 0.035),
            f.p(r, b1, 0.035),
            f.p(r, b1 + 0.68, 0.035),
            f.p(l, b0 + 0.68, 0.035),
          ],
          f.n,
          colors.base,
        );
    }
  }
}
function clipBy(polygon, limit, larger) {
  const clipped = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length],
      u = roofSection(a) - limit,
      v = roofSection(b) - limit;
    if (larger ? u > 1e-6 : u < -1e-6) clipped.push(a);
    if (u * v < -1e-10) clipped.push(between(a, b, u / (u - v)));
    else if (Math.abs(u) <= 1e-6) clipped.push(a);
  }
  return clipped.filter(
    (p, i) => Math.hypot(...delta(p, clipped[(i + 1) % clipped.length])) > 1e-5,
  );
}
function roofscape(out, lod) {
  const verts = outer.concat(court),
    indices = earcut(verts.flat(), [outer.length]);
  const end = Math.max(...outer.map(roofSection)) + 0.1;
  const hallStart = Math.max(...court.map(roofSection)) - 0.45;
  const step = (end - hallStart) / 7,
    eave = section.roofEave;
  const cuts = [Math.min(...outer.map(roofSection)) - 0.1, hallStart];
  for (let k = 0; k < 7; k++) cuts.push(hallStart + step * (k + 0.5), hallStart + step * (k + 1));
  for (let k = 0; k < cuts.length - 1; k++) {
    const lo = cuts[k],
      hi = cuts[k + 1];
    const y = (p) => {
      const t = Math.min(1, Math.max(0, (roofSection(p) - lo) / (hi - lo)));
      return eave + (k === 0 ? 0 : 1.83 * (k % 2 ? t : 1 - t));
    };
    for (let i = 0; i < indices.length; i += 3) {
      const poly = clipBy(
        clipBy(
          indices.slice(i, i + 3).map((j) => verts[j]),
          lo,
          true,
        ),
        hi,
        false,
      );
      for (let j = 1; j < poly.length - 1; j++) {
        const pts = [poly[0], poly[j], poly[j + 1]].map((p) => point(p, y(p)));
        if (Math.hypot(...normalFor(...pts)) < 0.5) continue;
        surface(out, 'roof', pts, up, k % 3 === 0 ? colors.green : colors.rich);
      }
    }
  }
  const topAt = (xz) => {
    const k = roofSection(xz),
      p = (k - hallStart) / step;
    return eave + (p < 0 ? 0 : 1.83 * (1 - Math.abs((p % 1) - 0.5) * 2));
  };
  // Edge closures subdivide at the same ridges and valleys as the roof faces.
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length],
      p = roofSection(a),
      q = roofSection(b);
    const stops = [
      0,
      1,
      ...cuts.map((c) => (c - p) / (q - p)).filter((t) => t > 1e-5 && t < 1 - 1e-5),
    ].sort((l, r) => l - r);
    for (let j = 0; j < stops.length - 1; j++) {
      const u = between(a, b, stops[j]),
        v = between(a, b, stops[j + 1]),
        y = topAt(u),
        z = topAt(v);
      if (y < eave + 0.001 && z < eave + 0.001) continue;
      const face = [
        point(u, eave),
        point(v, eave),
        ...(z > eave + 0.001 ? [point(v, z)] : []),
        ...(y > eave + 0.001 ? [point(u, y)] : []),
      ];
      surface(out, 'lime', face, norm3(outward(a, b)), colors.lime);
    }
  }
  if (lod >= 2) {
    // Four low crossings express the partly articulated central roof axis noted in the field survey.
    for (let i = 1; i < 5; i++) {
      const z = hallStart + step * (i + 0.47);
      const pos = at(at([0, 0], roofU, 1.5), roofV, z);
      solid(
        out,
        'roof',
        pos,
        roofU,
        roofV,
        -1.55,
        1.55,
        2.1,
        -2.1,
        eave + 1.58,
        eave + 2.13,
        colors.darkGreen,
      );
    }
  }
}
function courtyard(out, lod) {
  const base = section.courtyardFloor;
  fill(out, 'stone', court, (x, z) => [x, base, z], up, colors.paved);
  for (let i = 0; i < court.length; i++) {
    const a = court[i],
      b = court[(i + 1) % court.length],
      f = wallFrame(a, b),
      N = lod === 0 ? (i % 2 === 0 ? 2 : 3) : i % 2 === 0 ? 5 : 8;
    const holes = Array.from({ length: N }, (_, k) => {
      const bay = f.length / N,
        c = (k + 0.5) * bay,
        w = bay * 0.34;
      return arch(c - w, base + 0.04, c + w, 3.05, 1.04, lod ? 8 : 4);
    });
    fill(out, 'lime', rectangle(0, base, f.length, section.roofEave), f.p, f.n, colors.lime, holes);
    for (const hole of holes) {
      fill(out, 'well', hole, (x, y) => f.p(x, y, -0.34), f.n, colors.dark);
      if (lod > 0)
        for (let j = 1; j < hole.length; j++) {
          const h = hole[j],
            k = hole[(j + 1) % hole.length],
            p = [f.p(...h), f.p(...k), f.p(...k, -0.34), f.p(...h, -0.34)];
          face(out, 'stone', p.toReversed(), colors.stone);
        }
    }
  }
  const center = court.reduce((a, p) => a.map((v, i) => v + p[i] / court.length), [0, 0]);
  const ring = (h, r) => radialRing(base + h, r, r, lod === 0 ? 8 : 16, center);
  loft(
    out,
    'stone',
    [
      ring(0, 0.89),
      ring(0.13, 0.89),
      ring(0.18, 0.64),
      ring(0.52, 0.53),
      ring(0.68, 1.05),
      ring(0.8, 1.05),
    ],
    colors.stone,
    { cap: false },
  );
  loft(out, 'stone', [ring(0.8, 1.05), ring(0.8, 0.86), ring(0.7, 0.83)], colors.stone, {
    cap: false,
  });
  fill(
    out,
    'well',
    ring(0.7, 0.83).map(([x, , z]) => [x, z]),
    (x, z) => [x, base + 0.7, z],
    up,
    colors.water,
  );
}
function portalEntry(out, lod) {
  const w = section.portalWidth,
    mid = w / 2,
    base = section.portalLanding,
    top = section.portalTop,
    n = [8, 16, 20, 24][lod],
    pf = portal;
  const to = (x, y) => pf.p(x, y, 0.14);
  const lip = arch(mid - 2.39, base + 0.01, mid + 2.39, base + 6.12, 2.31, n);
  const trim = arch(mid - 2.74, base + 0.01, mid + 2.74, base + 6.22, 2.51, n);
  fill(out, 'lime', rectangle(0, base, w, top), to, pf.n, colors.bright, [trim]);
  const tileBottom = base + 4.35;
  const upper = trim.slice(2);
  const tileField = [
    [0.65, tileBottom],
    [upper.at(-1)[0], tileBottom],
    ...upper.toReversed(),
    [upper[0][0], tileBottom],
    [w - 0.65, tileBottom],
    [w - 0.65, top - 0.52],
    [0.65, top - 0.52],
  ];
  fill(out, 'mosaic', tileField, (x, y) => pf.p(x, y, 0.164), pf.n, colors.burgundy);
  for (let i = 0; i < lip.length - 1; i++) {
    const a = lip[i],
      b = lip[i + 1],
      c = trim[i + 1],
      d = trim[i];
    if (i > 0) {
      surface(
        out,
        'stone',
        [pf.p(...a, 0.23), pf.p(...b, 0.23), pf.p(...c, 0.23), pf.p(...d, 0.23)],
        pf.n,
        colors.white,
      );
      face(
        out,
        'lime',
        [pf.p(...a, 0.223), pf.p(...b, 0.223), pf.p(...b, -0.54), pf.p(...a, -0.54)].toReversed(),
        colors.stone,
      );
    }
  }
  panel(out, 'well', pf, mid - 2.74, base - 0.03, mid + 2.74, base + 9.45, -0.92, colors.dark);
  panel(out, 'cedar', pf, mid - 2.38, base + 0.02, mid + 2.38, base + 4.2, -0.31, colors.gate);
  for (let i = 0; i < 3; i++) {
    const x = mid + (i - 1) * 1.55;
    panel(out, 'cedar', pf, x - 0.72, base + 0.35, x + 0.72, base + 3.94, -0.27, colors.woodTrim);
    panel(out, 'cedar', pf, x - 0.65, base + 0.41, x + 0.65, base + 3.84, -0.24, colors.gate);
    if (lod > 0)
      for (const y of [base + 0.63, base + 1.64, base + 3.06])
        panel(out, 'cedar', pf, x - 0.6, y, x + 0.6, y + 0.08, -0.2, colors.woodTrim);
  }
  for (let i = -2; i <= 2; i++) {
    const x = mid + i * 0.78;
    const ymax =
      base +
      6.12 +
      2.31 * (Math.sqrt(1 - Math.pow((x - mid) / (2.39 / Math.cos(0.31)), 2)) + Math.sin(0.31));
    panel(out, 'brass', pf, x - 0.023, base + 4.2, x + 0.023, ymax, -0.24, colors.bronze);
  }
  for (const x of [0.56, w - 0.56]) {
    solid(
      out,
      'stone',
      entranceCenter,
      pf.u,
      pf.n2,
      x - mid - 0.14,
      x - mid + 0.14,
      0.34,
      0.15,
      base,
      top - 0.3,
      colors.white,
    );
    if (lod >= 1)
      for (let i = 0; i < 11; i++) {
        const y = base + 4.57 + i * 0.61;
        const d = 0.27;
        surface(
          out,
          'mosaic',
          [
            [x - 0.18, y],
            [x, y + 0.23],
            [x + 0.18, y],
            [x, y - 0.23],
          ].map(([h, v]) => pf.p(h, v, d)),
          pf.n,
          i % 2 === 0 ? colors.teal : colors.blue,
        );
      }
  }
  if (lod >= 1)
    for (let i = 2; i < trim.length - 1; i++) {
      const [x, y] = trim[i],
        dx = x - mid,
        dy = y - (base + 6.22 + 2.51 * Math.sin(0.31)),
        size = 0.14 + (lod === 3 ? 0.075 : 0);
      const scale = Math.hypot(dx, dy),
        u = x + (0.17 * dx) / scale,
        v = y + (0.19 * dy) / scale;
      surface(
        out,
        'mosaic',
        [
          [u - size, v],
          [u, v + size],
          [u + size, v],
          [u, v - size],
        ].map(([h, j]) => pf.p(h, j, 0.247)),
        pf.n,
        i % 2 === 0 ? colors.teal : colors.blue,
      );
    }
  if (lod >= 1)
    for (const x of [mid - 2.2, mid + 2.2]) {
      const y = top - 1.56;
      const motif = (r, d, slot, color) => {
        const n = lod >= 2 ? 20 : 8;
        const rim = Array.from({ length: n }, (_, i) => {
          const a = (2 * Math.PI * i) / n,
            radius = r * (lod >= 2 ? 0.83 + 0.17 * Math.cos(5 * a) : 1);
          return [x + radius * Math.cos(a), y + radius * Math.sin(a)];
        });
        fill(out, slot, rim, (a, b) => pf.p(a, b, d), pf.n, color);
      };
      motif(0.65, 0.192, 'mosaic', colors.white);
      motif(0.54, 0.205, 'mosaic', colors.blue);
      if (lod >= 2) motif(0.28, 0.219, 'mosaic', colors.teal);
    }
  const p = (x, y, d) => point(at(at(entranceCenter, pf.u, x), pf.n2, d), y);
  solid(
    out,
    'cedar',
    entranceCenter,
    pf.u,
    pf.n2,
    -mid - 0.3,
    mid + 0.3,
    1.07,
    0.06,
    top - 0.26,
    top + 0.56,
    colors.cedar,
  );
  surface(
    out,
    'roof',
    [
      p(-mid - 0.48, top + 0.5, 1.4),
      p(mid + 0.48, top + 0.5, 1.4),
      p(mid + 0.37, top + 1.43, -0.51),
      p(-mid - 0.37, top + 1.43, -0.51),
    ],
    up,
    colors.green,
  );
  for (let j = 0; j < (lod === 0 ? 6 : 19); j++) {
    const v = mix(-mid - 0.16, mid + 0.16, j / (lod === 0 ? 5 : 18));
    solid(
      out,
      'cedar',
      entranceCenter,
      pf.u,
      pf.n2,
      v - 0.075,
      v + 0.075,
      1.22,
      0.18,
      top - 0.39,
      top + 0.26,
      j % 2 ? colors.woodTrim : colors.cedar,
    );
  }
  for (const [l, r] of [
    [-mid, -2.76],
    [2.76, mid],
  ])
    solid(
      out,
      'lime',
      entranceCenter,
      pf.u,
      pf.n2,
      l,
      r,
      -0.49,
      -3.5,
      base - 0.32,
      top - 0.12,
      colors.lime,
    );
  solid(
    out,
    'lime',
    entranceCenter,
    pf.u,
    pf.n2,
    -2.76,
    2.76,
    -0.49,
    -3.5,
    base + 9.55,
    top - 0.12,
    colors.lime,
  );
  const walk = height(at(entranceCenter, pf.n2, 3.7)) - 0.11;
  const steps = lod === 0 ? 3 : 8;
  for (let i = 0; i < steps; i++) {
    const depth = mix(3.55, 0.09, i / steps),
      prev = mix(3.55, 0.09, (i + 1) / steps);
    const y = mix(walk, base, (i + 1) / steps);
    solid(
      out,
      'stone',
      entranceCenter,
      pf.u,
      pf.n2,
      -mid + 0.3,
      mid - 0.3,
      depth,
      prev,
      mix(walk, base, i / steps) - 0.13,
      y,
      colors.paved,
    );
  }
}
function minaret(out, lod) {
  const p = section.minaretPosition,
    w = section.minaretWidth / 2,
    u = [0.8, 0.6],
    n = [0.6, -0.8],
    t = section.minaretTop;
  solid(out, 'lime', p, u, n, -w, w, w, -w, Math.min(height(p), 0) - 0.3, t - 2.45, colors.bright);
  solid(
    out,
    'roof',
    p,
    u,
    n,
    -w - 0.15,
    w + 0.15,
    w + 0.15,
    -w - 0.15,
    t - 2.78,
    t - 2.46,
    colors.darkGreen,
  );
  solid(
    out,
    'lime',
    p,
    u,
    n,
    -w - 0.08,
    w + 0.08,
    w + 0.08,
    -w - 0.08,
    t - 2.46,
    t - 2.14,
    colors.lime,
  );
  solid(out, 'lime', p, u, n, -0.74, 0.74, 0.74, -0.74, t - 2.14, t - 0.61, colors.bright);
  for (const a of [-1, 1]) {
    solid(
      out,
      'lime',
      p,
      u,
      n,
      -w - 0.1,
      w + 0.1,
      w * a + 0.085,
      w * a - 0.085,
      t - 2.14,
      t - 1.59,
      colors.lime,
    );
    solid(
      out,
      'lime',
      p,
      u,
      n,
      w * a - 0.085,
      w * a + 0.085,
      w,
      -w,
      t - 2.14,
      t - 1.59,
      colors.lime,
    );
  }
  const r = (h, rad) => radialRing(h, rad, rad, lod > 0 ? 12 : 8, p);
  loft(
    out,
    'roof',
    [r(t - 0.63, 0.8), r(t - 0.43, 0.76), r(t - 0.02, 0.34), r(t + 0.02, 0.08)],
    colors.green,
  );
  if (lod) loft(out, 'brass', [r(t - 0.02, 0.035), r(t + 0.46, 0.035)], colors.bronze);
}
function build(out, lod) {
  exteriorWalls(out, lod);
  roofscape(out, lod);
  courtyard(out, lod);
  portalEntry(out, lod);
  minaret(out, lod);
}
export const mosqueSkyline = (out) => build(out, 0);
export const mosqueDistrict = (out) => build(out, 1);
export const mosqueStreet = (out) => build(out, 2);
export const mosqueCloseup = (out) => build(out, 3);
const camera = [-81, 52, -88],
  lookAt = [-2, 4, 1],
  recipe = 'mosque-of-the-andalusians-model.mjs';
export const mosqueModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: mosqueCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Mosque of the Andalusians in Fez with an elaborate northern horseshoe portal, green-tiled roofscape, open fountain courtyard and white square minaret.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-23, 25, -25],
  portableGroundY: -5.8,
  mediumFiContext: {
    scale: 0.92,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: outer,
    minimumCoverage: 0.86,
    basis: 'Named mapped mosque envelope including the open inner courtyard.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone',
    'tile_glazed',
    'wood_plain',
    'tile_mosaic',
  ],
  qaCameras: [
    {
      name: 'north-cedar-and-horseshoe-portal',
      position: [-44, 4.8, -54],
      lookAt: [entranceCenter[0], 4.3, entranceCenter[1]],
    },
    { name: 'open-court-and-square-minaret', position: [-25, 40, -39], lookAt: [-5, 2, -10] },
    { name: 'green-prayer-hall-roofs', position: [54, 47, 66], lookAt: [0, 4, 15] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `mosque-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'mosqueSkyline',
    errorMeters: 0.65,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'mosqueDistrict', 0.32],
        ['street', 'mosqueStreet', 0.14],
        ['closeup', 'mosqueCloseup', 0.055],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The OpenStreetMap footprints are ODbL. The Qualla imagery is CC0 by Mx. Granger.',
};
