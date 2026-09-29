/** St. Agatha’s Tower: original exterior from the national inventory and custodian photographs. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { facade, face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const mapBytes = readFileSync(structureSourcePath('n0609_st_agatha_s_tower', 'map-frame.json'));
const map = JSON.parse(mapBytes),
  red = [0.61, 0.22, 0.2],
  pale = [0.75, 0.58, 0.47],
  limestone = [0.72, 0.65, 0.47],
  dark = [0.065, 0.068, 0.062];
const outline = map.geometry.outline.filter((_, i) => i !== 8),
  upper = outline.map(([x, z]) => [x * 0.965, z * 0.965]);
function weathered(out) {
  const emit = (slot, p, color) => {
    if (slot !== 'plaster') {
      triangle(out, slot, p, color);
      return;
    }
    const lengths = p.map((a, i) => Math.hypot(...a.map((v, k) => v - p[(i + 1) % 3][k]))),
      m = Math.max(...lengths),
      i = lengths.indexOf(m);
    if (m > 0.43) {
      const a = p[i],
        b = p[(i + 1) % 3],
        c = p[(i + 2) % 3],
        h = a.map((v, k) => (v + b[k]) / 2);
      emit(slot, [a, h, c], color);
      emit(slot, [h, b, c], color);
      return;
    }
    triangle(out, slot, p, color);
  };
  return {
    addQuad(slot, _r, p, _n, _uv, c) {
      emit(slot, [p[0], p[1], p[2]], c);
      emit(slot, [p[0], p[2], p[3]], c);
    },
    addTriangle(slot, _r, p, _n, _uv, c) {
      emit(slot, p, c);
    },
    addConvexPolygon(slot, _r, p, _n, _uv, c) {
      for (let i = 1; i < p.length - 1; i++) emit(slot, [p[0], p[i], p[i + 1]], c);
    },
  };
}
function decorateMesh(mesh) {
  const seen = new Set();
  for (const g of mesh.groups) {
    if (g.materialRef !== 'matgraph:molen.worldgen.material.plaster_lime') continue;
    for (let k = g.start; k < g.start + g.count; k++) seen.add(mesh.indices[k]);
  }
  for (const i of seen) {
    const off = i * 3,
      x = mesh.positions[off],
      y = mesh.positions[off + 1],
      z = mesh.positions[off + 2];
    const n =
      Math.sin(x * 2.7 + Math.sin(z * 2.3)) * Math.sin(y * 3.3 - z * 1.7) +
      0.38 * Math.sin(x * 7.1 - y * 4.8 + z * 5.1);
    const faded = Math.max(0, Math.min(0.34, (n - 0.22) * 0.31));
    for (let k = 0; k < 3; k++) {
      const original = mesh.colors[off + k] / 255;
      mesh.colors[off + k] = Math.round(
        255 * Math.max(0, Math.min(1, original * (1 - faded) + pale[k] * faded)),
      );
    }
  }
}
function edgeFrame(out, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  return {
    out: transform(out, Math.atan2(-dz, dx), [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]),
    width: Math.hypot(dx, dz),
  };
}
function wall(out, width, y0, y1, openings = [], slot = 'plaster', color = red) {
  const xs = [
      ...new Set([
        -width / 2,
        width / 2,
        ...openings.flatMap((o) => [o.x - o.w / 2, o.x + o.w / 2]),
      ]),
    ].sort((a, b) => a - b),
    ys = [...new Set([y0, y1, ...openings.flatMap((o) => [o.y, o.y + o.h])])].sort((a, b) => a - b);
  for (let j = 1; j < ys.length; j++)
    for (let i = 1; i < xs.length; i++) {
      const x = (xs[i - 1] + xs[i]) / 2,
        y = (ys[j - 1] + ys[j]) / 2;
      if (openings.some((o) => Math.abs(x - o.x) < o.w / 2 && y > o.y && y < o.y + o.h)) continue;
      face(
        out,
        slot,
        [
          [xs[i - 1], ys[j - 1], 0],
          [xs[i], ys[j - 1], 0],
          [xs[i], ys[j], 0],
          [xs[i - 1], ys[j], 0],
        ],
        color,
      );
    }
  for (const o of openings) {
    const x0 = o.x - o.w / 2,
      x1 = o.x + o.w / 2,
      y = o.y,
      t = y + o.h,
      d = o.depth ?? 0.42;
    for (const p of [
      [
        [x0, y, 0],
        [x0, y, -d],
        [x0, t, -d],
        [x0, t, 0],
      ],
      [
        [x1, y, -d],
        [x1, y, 0],
        [x1, t, 0],
        [x1, t, -d],
      ],
      [
        [x0, t, 0],
        [x0, t, -d],
        [x1, t, -d],
        [x1, t, 0],
      ],
      [
        [x0, y, -d],
        [x0, y, 0],
        [x1, y, 0],
        [x1, y, -d],
      ],
    ])
      face(out, slot, p, color);
    box(
      out,
      o.door ? 'wood' : 'shadow',
      [x0, y, -d - 0.035],
      [x1, t, -d],
      o.door ? [0.18, 0.13, 0.078] : dark,
    );
  }
}
function cordon(out, ring, y) {
  for (let i = 0; i < ring.length; i++) {
    const { out: o, width: w } = edgeFrame(out, ring[i], ring[(i + 1) % ring.length]);
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 8,
        b = a + Math.PI / 8;
      face(
        o,
        'plaster',
        [
          [-w / 2, y + Math.sin(a) * 0.15, Math.cos(a) * 0.18],
          [w / 2, y + Math.sin(a) * 0.15, Math.cos(a) * 0.18],
          [w / 2, y + Math.sin(b) * 0.15, Math.cos(b) * 0.18],
          [-w / 2, y + Math.sin(b) * 0.15, Math.cos(b) * 0.18],
        ],
        red,
      );
    }
  }
}
function mainBody(out) {
  loft(
    out,
    'plaster',
    [outline.map(([x, z]) => [x, 0, z]), upper.map(([x, z]) => [x, 3.16, z])],
    red,
    { cap: false },
  );
  cordon(out, upper, 3.16);
  for (let i = 0; i < upper.length; i++) {
    const a = upper[i],
      b = upper[(i + 1) % upper.length],
      { out: o, width: w } = edgeFrame(out, a, b);
    let holes = [];
    if (i === 7) {
      const door = 2.2608 * 0.965 - (a[0] + b[0]) / 2;
      facade(
        o,
        'plaster',
        w,
        3.3,
        9.4,
        0,
        [
          {
            x: door,
            w: 1.34,
            y: 3.3,
            spring: 5.18,
            rise: 0.36,
            top: 5.62,
            depth: 0.75,
            back: true,
            trim: 0.045,
          },
        ],
        red,
      );
      box(o, 'limestone_raw', [door - 0.68, 6.48, 0.015], [door + 0.68, 7.1, 0.052], limestone);
      for (let row = 0; row < 6; row++)
        for (let col = 0; col < 12; col++)
          box(
            o,
            'shadow',
            [door - 0.52 + col * 0.086, 6.55 + row * 0.079, 0.053],
            [door - 0.48 + col * 0.086, 6.57 + row * 0.079, 0.056],
            [0.28, 0.27, 0.21],
          );
      box(o, 'limestone_raw', [door - 0.3, 5.89, 0.01], [door + 0.3, 6.08, 0.054], limestone);
      continue;
    }
    if (i === 17)
      holes = [
        { x: -2.4, w: 0.88, y: 4.5, h: 1.55 },
        { x: 2.4, w: 0.88, y: 4.5, h: 1.55 },
        { x: -2.4, w: 0.53, y: 7.43, h: 0.64 },
        { x: 2.4, w: 0.53, y: 7.43, h: 0.64 },
      ];
    if (i === 9)
      holes = [
        { x: 0, w: 0.19, y: 4.15, h: 0.68 },
        { x: 0, w: 0.15, y: 7.38, h: 0.42 },
      ];
    wall(o, w, 3.3, 9.4, holes);
  }
  // The roof is a single gun platform, bounded by the documented two-foot parapet.
  box(out, 'plaster', [-7.42, 9.28, -7.98], [7.3, 9.4, 8.05], [0.7, 0.58, 0.48]);
  for (const [a, b] of [
    [
      [-4.64, 8.04],
      [5.67, 8.04],
    ],
    [
      [7.2, 5.25],
      [7.2, -5.01],
    ],
    [
      [4.9, -7.77],
      [-4.77, -7.77],
    ],
    [
      [-7.38, -4.67],
      [-7.38, 5.18],
    ],
  ]) {
    const { out: o, width: w } = edgeFrame(out, a, b);
    box(o, 'plaster', [-w / 2, 9.4, -0.38], [w / 2, 10.01, 0.04], red);
    box(o, 'plaster', [-w / 2, 9.97, -0.41], [w / 2, 10.05, 0.08], red);
  }
}
function triangularPrism(out, points, depth, color) {
  for (const z of [-depth / 2, depth / 2])
    triangle(
      out,
      'plaster',
      (z > 0 ? [...points].reverse() : points).map(([x, y]) => [x, y, z]),
      color,
    );
  for (let i = 0; i < 3; i++) {
    const a = points[i],
      b = points[(i + 1) % 3];
    face(
      out,
      'plaster',
      [
        [a[0], a[1], -depth / 2],
        [b[0], b[1], -depth / 2],
        [b[0], b[1], depth / 2],
        [a[0], a[1], depth / 2],
      ].reverse(),
      color,
    );
  }
}
function merlon(out, x, y, width) {
  const o = transform(out, 0, [x, y, 0]),
    w = width / 2;
  box(o, 'plaster', [-w, 0, -0.16], [w, 0.29, 0.16], red);
  triangularPrism(
    o,
    [
      [-w, 0.29],
      [-w, 0.62],
      [0, 0.29],
    ],
    0.32,
    red,
  );
  triangularPrism(
    o,
    [
      [0, 0.29],
      [w, 0.62],
      [w, 0.29],
    ],
    0.32,
    red,
  );
}
const turrets = [
  { x: -6.66, z: -6.92, w: 3.57, d: 4.4, sx: -1, sz: -1 },
  { x: -6.48, z: 7.05, w: 3.87, d: 3.64, sx: -1, sz: 1 },
  { x: 7.02, z: 7.05, w: 2.73, d: 3.49, sx: 1, sz: 1 },
  { x: 6.93, z: -6.86, w: 4.03, d: 3.71, sx: 1, sz: -1 },
];
function turret(out, t) {
  const o = transform(out, 0, [t.x, 0, t.z]);
  const rect = [
    [-t.w / 2, -t.d / 2],
    [-t.w / 2, t.d / 2],
    [t.w / 2, t.d / 2],
    [t.w / 2, -t.d / 2],
  ];
  cordon(o, rect, 9.37);
  for (let i = 0; i < 4; i++) {
    const a = rect[i],
      b = rect[(i + 1) % 4],
      { out: q, width: w } = edgeFrame(o, a, b);
    const exterior = i === 0 ? t.sx < 0 : i === 1 ? t.sz > 0 : i === 2 ? t.sx > 0 : t.sz < 0;
    const door = !exterior && ((t.sx < 0 && i === 2) || (t.sx > 0 && i === 0));
    wall(
      q,
      w,
      9.43,
      12.1,
      exterior
        ? [{ x: 0, w: 0.46, y: 10.58, h: 0.51 }]
        : door
          ? [{ x: 0, w: 0.78, y: 9.43, h: 1.93, door: true }]
          : [{ x: 0, w: 0.15, y: 9.67, h: 0.65 }],
    );
    box(q, 'plaster', [-w / 2, 12.1, -0.25], [w / 2, 12.18, 0.035], red);
    const n = Math.max(3, Math.round(w / 0.88));
    for (let k = 0; k < n; k++) merlon(q, -w / 2 + 0.22 + (k * (w - 0.44)) / (n - 1), 12.18, 0.43);
  }
  box(
    o,
    'plaster',
    [-t.w / 2 + 0.2, 12.02, -t.d / 2 + 0.2],
    [t.w / 2 - 0.2, 12.12, t.d / 2 - 0.2],
    [0.6, 0.44, 0.34],
  );
}
function entrance(out) {
  const x = 2.2608 * 0.965,
    z = 8.3059 * 0.965,
    top = 3.3,
    gap = 2.3,
    run = 6.16,
    n = 18;
  const o = transform(out, 0, [x, 0, z]);
  for (let i = 0; i < n; i++) {
    const near = gap + run - ((i + 1) * run) / n,
      far = gap + run - (i * run) / n;
    box(o, 'limestone_raw', [-0.82, 0, near], [0.82, (top * (i + 1)) / n, far], limestone);
  }
  for (const s of [-1, 1]) {
    const sx = s * 1.0;
    loft(
      o,
      'limestone_raw',
      [
        [
          [sx - 0.16, 0, gap],
          [sx + 0.16, 0, gap],
          [sx + 0.16, 0, gap + run],
          [sx - 0.16, 0, gap + run],
        ],
        [
          [sx - 0.16, top + 0.75, gap],
          [sx + 0.16, top + 0.75, gap],
          [sx + 0.16, 0.75, gap + run],
          [sx - 0.16, 0.75, gap + run],
        ],
      ],
      limestone,
    );
    beam(
      o,
      'metal',
      [s * 0.82, 0.65, gap + run],
      [s * 0.82, top + 0.65, gap],
      0.043,
      0.043,
      [0.14, 0.15, 0.13],
    );
  }
  const wood = [0.31, 0.25, 0.16];
  for (let k = 0; k < 15; k++)
    box(
      o,
      'wood',
      [-0.81, top - 0.17, (k * gap) / 15],
      [0.81, top - 0.08, ((k + 1) * gap) / 15 - 0.011],
      wood,
    );
  for (const s of [-1, 1]) {
    box(o, 'wood', [s * 0.66 - 0.065, top - 0.31, 0], [s * 0.66 + 0.065, top - 0.17, gap], wood);
    for (let k = 0; k < 4; k++)
      box(
        o,
        'wood',
        [s * 0.79 - 0.045, top - 0.15, (k * gap) / 3 - 0.04],
        [s * 0.79 + 0.045, top + 0.9, (k * gap) / 3 + 0.04],
        wood,
      );
    for (const y of [top + 0.2, top + 0.52, top + 0.87])
      beam(o, 'metal', [s * 0.79, y, 0], [s * 0.79, y, gap], 0.032, 0.032, [0.27, 0.28, 0.24]);
  }
}
function cannon(out, x, z, a) {
  const o = transform(out, a, [x, 9.4, z]),
    wood = [0.23, 0.135, 0.065],
    iron = [0.12, 0.14, 0.13];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++)
      box(
        o,
        'wood',
        [s * 0.43 - 0.16, k * 0.2, -0.75 + k * 0.1],
        [s * 0.43 + 0.16, (k + 1) * 0.2, 0.65 - k * 0.12],
        wood,
      );
    for (const zz of [-0.45, 0.45]) {
      const wheel = transform(o, 0, [s * 0.68, 0.19, zz]);
      for (let k = 0; k < 24; k++) {
        const aa = (k * Math.PI) / 12,
          bb = ((k + 1) * Math.PI) / 12;
        face(
          wheel,
          'wood',
          [
            [-0.09, Math.cos(aa) * 0.2, Math.sin(aa) * 0.2],
            [0.09, Math.cos(aa) * 0.2, Math.sin(aa) * 0.2],
            [0.09, Math.cos(bb) * 0.2, Math.sin(bb) * 0.2],
            [-0.09, Math.cos(bb) * 0.2, Math.sin(bb) * 0.2],
          ],
          wood,
        );
      }
      sphere(wheel, 'metal', [0, 0, 0], [0.1, 0.05, 0.05], iron, 12, 6);
    }
  }
  const barrel = transform(o, 0, [0, 0.74, 0]);
  const rings = [
    [-0.85, 0.23],
    [-0.66, 0.245],
    [0.45, 0.16],
    [1.12, 0.145],
    [1.19, 0.19],
    [1.32, 0.19],
  ].map(([zz, r]) => radialRing(zz, r, r, 32).map(([xx, yy, z2]) => [xx, -z2, yy]));
  loft(barrel, 'metal', rings, iron, { cap: false });
  const end = 1.32;
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16,
      b = ((i + 1) * Math.PI) / 16;
    const p = (r, t, z) => [r * Math.cos(t), r * Math.sin(t), z];
    face(
      barrel,
      'metal',
      [p(0.19, a, end), p(0.19, b, end), p(0.115, b, end), p(0.115, a, end)],
      iron,
    );
    face(
      barrel,
      'metal',
      [p(0.115, b, end), p(0.115, a, end), p(0.115, a, end - 0.13), p(0.115, b, end - 0.13)],
      iron,
    );
    triangle(barrel, 'metal', [[0, 0, -0.85], p(0.23, b, -0.85), p(0.23, a, -0.85)], iron);
  }
  face(
    barrel,
    'shadow',
    [
      [-0.12, -0.12, end - 0.07],
      [0.12, -0.12, end - 0.07],
      [0.12, 0.12, end - 0.07],
      [-0.12, 0.12, end - 0.07],
    ],
    dark,
  );
  sphere(o, 'metal', [0, 0.74, -0.96], [0.12, 0.12, 0.12], iron, 16, 8);
}
function fittings(out) {
  cannon(out, -3.0, -6.4, Math.PI);
  cannon(out, 3.3, -6.4, Math.PI);
  for (const x of [-3.6, 3.7]) {
    beam(out, 'metal', [x, 9.4, 7.8], [x, 14.1, 7.8], 0.045, 0.045, [0.67, 0.67, 0.58]);
    sphere(out, 'metal', [x, 14.13, 7.8], [0.085, 0.09, 0.085], [0.65, 0.6, 0.41], 12, 6);
  }
  for (const x of [-4.4, 4.7])
    beam(out, 'metal', [x, 9.4, -7.7], [x, 0.4, -7.95], 0.065, 0.065, [0.44, 0.27, 0.22]);
  for (const z of [-6.4, 6.5]) {
    box(out, 'wood', [-1.4, 9.73, z - 0.5], [1.4, 9.86, z + 0.5], [0.57, 0.51, 0.36]);
    for (const x of [-1.13, 1.13])
      box(out, 'wood', [x - 0.09, 9.4, z - 0.35], [x + 0.09, 9.73, z + 0.35], [0.53, 0.47, 0.33]);
  }
}
function build(raw) {
  const out = weathered(raw);
  mainBody(out);
  for (const t of turrets) turret(out, t);
  entrance(out);
  fittings(raw);
}
export const agathaTower = {
  id: 'n0609_st_agatha_s_tower',
  planId: 'N0609',
  title: 'St. Agatha’s Tower',
  wikidata: 'Q1738896',
  authoringFile: 'agatha-tower-model.mjs',
  build,
  decorateMesh,
  front:
    'Native +Z faces the mapped southeast entrance, +X is east-northeast along the entrance facade',
  origin: 'Center of the mapped tower footprint, Y=0 at the foot of its scarped base',
  brief:
    'Malta’s red watchtower, reconstructed with its four unequal projecting corner turrets, splayed base, rounded cordons, flat gun terrace, fishtail merlons, recessed loopholes, rear windows and elevated arched entrance reached by a limestone stair and timber bridge. Two restored roof cannons, drains and mast fittings complete the exterior.',
  refs: [
    'https://www.static.dinlarthelwa.org/heritage-sites/managed-heritage-sites/st-agathas-tower-the-red-tower-mellieha/',
    'https://schmalta.mt/wp-content/uploads/2023/08/DC-00033.pdf',
    'https://redtowermalta.wordpress.com/a-brief-tour/',
    'https://redtowermalta.wordpress.com/wp-content/uploads/2015/05/2-red.jpg',
    'https://redtowermalta.wordpress.com/wp-content/uploads/2015/05/cimg0178.jpg',
    'https://redtowermalta.wordpress.com/wp-content/uploads/2015/05/pano_20140821_125427.jpg',
    'https://www.fortmed.eu/2026downloadables/6465_Russo-Acierno_Vol_FORTMED_24.pdf',
    'https://www.openstreetmap.org/way/91447984',
  ],
  facts: {
    completed: 1648,
    armed: 1649,
    nationalInventory: '00033',
    cornerTurrets: 4,
    roofParapetMeters: 0.6096,
    turretRiseMeters: 'approximately3 m per custodian',
    modeledArchitecturalHeightMeters: 12.8,
    restoredRoofCannons: 2,
    roofCannonsInstalled: 2013,
  },
  scaleBasis:
    'The national inventory and custodian describe the square bastioned plan, scarped walls, fishtail battlements and four corner turrets. The custodian records a two-foot roof parapet and roughly3 m turret rise. The source footprint preserves the roughly18 by18.6 m mapped exterior; custodian front/back and rooftop photos establish the 9.4 m reconstructed gun-platform level and 12.8 m battlement tip. Those overall heights are proportional estimates, not published survey dimensions. Current fixed wooden bridge, shallow-arched portal, stone stair, loop/slit pattern and restored cannon carriages follow the custodian’s detailed exterior images.',
  geographicProposal: {
    anchor: map.anchor,
    heading: map.heading,
    source: map.source,
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: `sha256:${createHash('sha256').update(mapBytes).digest('hex')}`,
    evidence: map.basis,
    limitations:
      'Terrain contact is at the tower foundation. Stair flight follows the photographed entrance axis and reconstructed rise; hillside retaining walls, the separate star-shaped entrenchment and terrain steps remain map/terrain features.',
  },
  limits: [
    'Main elevation levels, stone step count and small fittings are proportional reconstructions from custodian photographs. The two-foot parapet, approximately3 m turret rise and mapped outline constrain scale; no unpublished surveyed heights are claimed.',
    'The red lime-plaster weathering is an original continuous tint pattern. Inscription plaques preserve location and line structure; historic lettering and heraldic detail are not invented. Cannon forms represent the two restored roof pieces; casting inscriptions and daily flags are omitted.',
    'The surrounding eighteenth-century dry-stone entrenchment, modern adjacent mast, interiors and movable visitor displays are outside this tower exterior asset. Sloping site terrain and the base of the entrance stair depend on the host’s terrain resolution.',
  ],
  cameras: [
    { name: 'entrance-whole', position: [24, 17, 37], lookAt: [0, 6, 0] },
    { name: 'rear-windows', position: [-25, 15, -32], lookAt: [0, 6, 0] },
    { name: 'wood-bridge-entry', position: [11, 7, 21], lookAt: [2.2, 4.5, 9] },
    { name: 'fishtail-turrets', position: [18, 15, 22], lookAt: [4, 10.7, 5] },
    { name: 'roof-cannons', position: [-18, 21, -22], lookAt: [0, 10, 0] },
    { name: 'roof-plan', position: [3, 47, 5], lookAt: [0, 4, 0] },
    { name: 'far-silhouette', position: [34, 21, 48], lookAt: [0, 6, 0] },
  ],
};
