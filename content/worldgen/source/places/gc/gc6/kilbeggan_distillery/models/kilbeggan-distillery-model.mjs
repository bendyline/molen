import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const color = palette({
  lime: 'dedbd0',
  pale: 'e9e6dc',
  stone: '868275',
  mortar: 'a7a297',
  slate: '4b4f53',
  slateLight: '555b60',
  fascia: '63625f',
  brick: '774c41',
  darkbrick: '634033',
  glass: '495453',
  wood: '665144',
  gate: '474e41',
  iron: '464945',
});
const surfaces = {
  lime: surface('wall', 'stucco', 0.92),
  stone: surface('foundation', 'stone_ashlar', 0.91),
  slate: surface('roof', 'slate', 0.87),
  brick: surface('wall', 'brick_flemish', 0.91),
  glass: surface('window', 'storefront', 0.53, 0.04),
  wood: surface('door', 'wood_plain', 0.88),
  iron: surface('trim', 'metal_painted', 0.72, 0.15),
};
const up = [0, 1, 0],
  down = [0, -1, 0];

function clip(points, axis, limit, direction) {
  const ring = [];
  for (const [a, b] of pairs(closed(points))) {
    const inside = (a[axis] - limit) * direction >= -0.000001;
    const nextInside = (b[axis] - limit) * direction >= -0.000001;
    if (inside) ring.push(a);
    if (inside !== nextInside) {
      const t = (limit - a[axis]) / (b[axis] - a[axis]);
      ring.push(a.map((v, k) => mix(v, b[k], t)));
    }
  }
  return ring.filter(
    (p, i) =>
      Math.hypot(...p.map((v, k) => v - ring[(i + ring.length - 1) % ring.length][k])) > 0.00001,
  );
}

function cropped(ring, limits) {
  return limits.reduce(
    (points, [axis, limit, direction]) =>
      points.length ? clip(points, axis, limit, direction) : [],
    ring,
  );
}

function roof(out, points, axis, eave, rise, lod) {
  const ridgeAxis = 1 - axis;
  const bounds = [0, 1].map((a) => {
    const values = points.map((point) => point[a]);
    return [Math.min(...values), Math.max(...values)];
  });
  const [low, high] = bounds[axis],
    mid = (low + high) / 2;
  const [start, end] = bounds[ridgeAxis];
  const pitch = rise / (mid - low);
  const roofY = (point) =>
    eave +
    Math.max(
      0,
      Math.min(
        rise - Math.abs(point[axis] - mid) * pitch,
        rise * (0.68 + Math.min(point[ridgeAxis] - start, end - point[ridgeAxis]) * 0.095),
      ),
    );
  for (const direction of [-1, 1]) {
    const side = clip(points, axis, mid, direction);
    const tris = earcut(side.flat());
    for (let i = 0; i < tris.length; i += 3) {
      const corners = tris.slice(i, i + 3).map((v) => side[v]);
      face(
        out,
        'slate',
        corners.map((p) => at(p, roofY(p))),
        up,
        direction === 1 ? color.slateLight : color.slate,
      );
    }
  }
  for (const [a, b] of pairs(closed(points))) {
    const cuts =
      (a[axis] - mid) * (b[axis] - mid) < -0.0000001
        ? [a, a.map((v, j) => mix(v, b[j], (mid - a[axis]) / (b[axis] - a[axis]))), b]
        : [a, b];
    for (const [p, q] of pairs(cuts)) {
      const wall = edge(p, q, areaSign(points));
      const dp = roofY(p),
        dq = roofY(q);
      if (Math.max(dp, dq) - eave > 0.016) {
        const vertices = [at(p, eave), at(q, eave)];
        if (dq - eave > 0.008) vertices.push(at(q, dq));
        if (dp - eave > 0.008) vertices.push(at(p, dp));
        face(out, 'lime', vertices, wall.normal, color.lime);
      }
      if (lod > 1) beam(out, 'iron', at(p, dp + 0.02), at(q, dq + 0.02), 0.14, 0.12, color.fascia);
    }
  }
}

function windowRow(out, wall, levels, datum, lod, openingCenter, passageWidth, density) {
  if (!lod || wall.length < 4.6) return;
  const count = Math.max(1, Math.round(wall.length / density));
  const pitch = wall.length / count;
  for (let i = 0; i < count; i++) {
    const u = (i + 0.5) * pitch;
    if (openingCenter !== undefined && Math.abs(u - openingCenter) < passageWidth / 2 + 0.64)
      continue;
    const w = Math.min(0.73, pitch * 0.36);
    for (let row = 0; row < levels; row++) {
      const y = datum + 0.92 + row * 2.35;
      opening(
        out,
        wall,
        u - w / 2,
        u + w / 2,
        y,
        y + 1.38,
        'wood',
        color.glass,
        'glass',
        row ? color.wood : color.pale,
        lod - 1,
        0.021,
      );
      if (lod === 3)
        panel(out, 'wood', wall, u - w / 2, u + w / 2, y + 0.67, y + 0.73, 0.073, color.wood);
    }
  }
}

function carriage(out, wall, a, b, base, top, gate, lod, datum) {
  const [ax, az] = a,
    [bx, bz] = b;
  const center = ((gate.center - ax) / (bx - ax)) * wall.length;
  const dx = Math.abs(bx - ax) / wall.length;
  const half = gate.width / (2 * dx);
  if (!Number.isFinite(center) || center - half < 0.17 || center + half > wall.length - 0.17)
    return;
  const spring = datum + gate.spring;
  const count = [5, 8, 12, 16][lod];
  const curve = Array.from({ length: count + 1 }, (_, i) => {
    const angle = Math.PI * (1 - i / count);
    return [center + half * Math.cos(angle), spring + gate.rise * Math.sin(angle)];
  });
  panel(out, 'lime', wall, 0, center - half, base, top, 0, color.pale);
  panel(out, 'lime', wall, center + half, wall.length, base, top, 0, color.pale);
  for (const [[u, y], [v, h]] of pairs(curve)) {
    face(
      out,
      'lime',
      [wall.p(u, y), wall.p(v, h), wall.p(v, top), wall.p(u, top)],
      wall.normal,
      color.pale,
    );
    face(
      out,
      'stone',
      [
        wall.p(u, y, 0.035),
        wall.p(v, h, 0.035),
        wall.p(v, h + 0.22, 0.035),
        wall.p(u, y + 0.22, 0.035),
      ],
      wall.normal,
      color.mortar,
    );
  }
  for (const u of [center - half, center + half])
    panel(out, 'stone', wall, u - 0.085, u + 0.085, base, spring + 0.2, 0.035, color.mortar);
  return center;
}

function range(out, ring, lod, grade, config) {
  if (ring.length < 3) return;
  const { datum, eaves, rise, axis, levels, gate, density = 5.1, quiet = false } = config;
  const bottom = Math.min(datum - 0.48, ...ring.map((point) => grade(point) - 0.39));
  const sign = areaSign(ring);
  for (const [a, b] of pairs(closed(ring))) {
    const wall = edge(a, b, sign);
    if (wall.length < 0.0001) continue;
    const entrance = gate ? carriage(out, wall, a, b, bottom, eaves, gate, lod, datum) : undefined;
    if (entrance === undefined) {
      panel(out, 'stone', wall, 0, wall.length, bottom, datum + 0.14, 0, color.stone);
      panel(
        out,
        'lime',
        wall,
        0,
        wall.length,
        datum + 0.14,
        eaves,
        0,
        quiet ? color.lime : color.pale,
      );
    }
    if (lod > 1)
      panel(out, 'iron', wall, 0, wall.length, eaves - 0.12, eaves + 0.015, 0.046, color.fascia);
    windowRow(out, wall, levels, datum, lod, entrance, gate?.width, density);
  }
  roof(out, ring, axis, eaves, rise, lod);
}

function passage(out, a, lod, datum) {
  const l = a.center - a.width / 2,
    r = a.center + a.width / 2;
  const from = 13,
    to = 29.95,
    n = [5, 8, 12, 16][lod];
  const spring = datum + a.spring;
  const shape = Array.from({ length: n + 1 }, (_, i) => {
    const theta = Math.PI * (1 - i / n);
    return [a.center + a.width * 0.5 * Math.cos(theta), spring + a.rise * Math.sin(theta)];
  });
  for (const [[x, y], [u, v]] of pairs(shape))
    face(
      out,
      'stone',
      [
        [x, y, from],
        [u, v, from],
        [u, v, to],
        [x, y, to],
      ],
      down,
      color.mortar,
    );
  for (const [x, normal] of [
    [l, [1, 0, 0]],
    [r, [-1, 0, 0]],
  ])
    face(
      out,
      'stone',
      [
        [x, datum, from],
        [x, datum, to],
        [x, spring, to],
        [x, spring, from],
      ],
      normal,
      color.stone,
    );
  cap(out, 'stone', rect(l, from, r, to), datum + 0.024, color.mortar);
}

function chimney(out, info, lod, grade) {
  const [x, z] = info.center,
    y = grade(info.center) - 0.05;
  const { width, depth, top } = info;
  const ring = (height, scale) =>
    rect(
      x - (width * scale) / 2,
      z - (depth * scale) / 2,
      x + (width * scale) / 2,
      z + (depth * scale) / 2,
    ).map((p) => at(p, height));
  loft(out, 'brick', [ring(y, 1.12), ring(y + 2.1, 1), ring(top - 0.64, 0.73)], color.brick);
  loft(
    out,
    'brick',
    [ring(top - 0.66, 0.85), ring(top - 0.36, 0.89), ring(top, 0.86), ring(top + 0.16, 0.76)],
    color.darkbrick,
  );
  if (lod) {
    for (const h of [top - 1.25, top - 0.75])
      loft(out, 'brick', [ring(h, 0.79), ring(h + 0.115, 0.79)], color.darkbrick);
    cap(
      out,
      'iron',
      ring(top + 0.16, 0.62).map(([a, , b]) => [a, b]),
      top + 0.165,
      color.iron,
    );
  }
}

function waterWheel(out, info, race, lod, grade) {
  const [x, z] = info.center,
    y = info.axisY,
    radius = info.diameter / 2,
    half = info.width / 2;
  const n = [8, 12, 18, 24][lod];
  const point = (u, i, r) => {
    const a = (i * Math.PI * 2) / n;
    return [u, y + Math.cos(a) * r, z + Math.sin(a) * r];
  };
  const shaft = radius * 0.058;
  beam(
    out,
    'iron',
    [x - half - 0.42, y, z],
    [x + half + 0.62, y, z],
    shaft * 2.16,
    shaft * 2.16,
    color.iron,
  );
  for (let i = 0; i < n; i++) {
    for (const side of [-1, 1]) {
      const u = x + side * half;
      const a = point(u, i, radius),
        b = point(u, i + 1, radius);
      beam(out, 'wood', a, b, 0.21, 0.18, color.wood);
      if (i % (lod < 2 ? 2 : 1) === 0)
        beam(out, 'iron', [u, y, z], point(u, i, radius - 0.06), 0.095, 0.11, color.iron);
    }
    if (lod || i % 2 === 0)
      beam(
        out,
        'wood',
        point(x - half, i, radius - 0.19),
        point(x + half, i, radius - 0.19),
        0.21,
        0.27,
        color.wood,
      );
  }
  const inlet = race[0],
    outlet = race[1],
    w = edge(inlet, outlet);
  const bankY = Math.max(grade(inlet), grade(outlet)) + 0.24;
  for (const d of [-1.87, 1.87]) {
    const a = w.p(0, bankY, d),
      b = w.p(w.length, bankY - 0.14, d);
    beam(out, 'stone', a, b, 0.61, 0.52, color.stone);
  }
  if (lod > 1) {
    const a = w.p(2.44, bankY, -1.88),
      b = w.p(2.44, bankY, 1.88);
    for (const [u, , v] of [a, b])
      block(out, 'iron', u - 0.096, bankY - 0.4, v - 0.096, 0.192, 1.32, 0.192, color.iron);
    beam(
      out,
      'iron',
      [a[0], bankY + 0.88, a[2]],
      [b[0], bankY + 0.88, b[2]],
      0.14,
      0.16,
      color.iron,
    );
  }
}

function build(out, lod, d, grade) {
  const street = d.streetY,
    top = (h) => street + h;
  const front = cropped(d.main, [[1, 13, 1]]);
  const rear = cropped(d.main, [[1, -20, -1]]);
  const mid = cropped(d.main, [
    [1, -20, 1],
    [1, 13, -1],
  ]);
  const portions = [
    [front, 1, 7.45, 3.36, 3, d.arch],
    [rear, 0, 6.1, 3.22, 2],
    [cropped(mid, [[0, 0, -1]]), 0, 7.2, 2.32, 3],
    [
      cropped(mid, [
        [0, 16, 1],
        [0, 33.28, -1],
      ]),
      0,
      8.15,
      3.48,
      3,
    ],
    [
      cropped(mid, [
        [0, 33.28, 1],
        [1, -9.5, -1],
      ]),
      0,
      4.92,
      2.13,
      1,
    ],
    [d.westEast, 0, 4.95, 2.32, 1],
    [d.westNorth, 1, 5.98, 2.83, 2],
    [
      cropped(d.west, [
        [1, 21.4, 1],
        [0, -24.61, -1],
      ]),
      1,
      5.42,
      2.21,
      2,
    ],
    [d.westStore, 0, 4.95, 2.41, 2],
  ];
  for (const [outline, axis, h, rise, levels, gate] of portions)
    range(out, outline, lod, grade, { datum: street, eaves: top(h), axis, rise, levels, gate });
  passage(out, d.arch, lod, street);
  cap(out, 'stone', d.court, d.courtY, color.mortar);
  const buttress = rect(35.1, 22.6, 36.5, 28.8);
  const upperButtress = [
    [35.2, 23.9],
    [36.1, 23.9],
    [36.1, 25.9],
    [35.2, 25.9],
  ];
  loft(
    out,
    'lime',
    [buttress.map((p) => at(p, street)), upperButtress.map((p) => at(p, top(5.5)))],
    color.lime,
  );
  chimney(out, d.stack, lod, grade);
  waterWheel(out, d.wheel, d.millrace, lod, grade);
}

const asset = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'Historic Kilbeggan Distillery with pale roughcast, slate ranges, open court, a red-brick chimney and the restored timber waterwheel on the River Brosna.',
    camera: [151, 111, 154],
    lookAt: [-3.5, 5.5, -2.5],
    yaw: 0.72,
    sun: [-170, 380, 430],
    views: [
      { name: 'distillery-and-riverside-stack', position: [143, 72, 119], lookAt: [-7, 8, 0] },
      { name: 'bridge-street-and-carriage-arch', position: [26, 14, 82], lookAt: [4, 4, 25] },
      { name: 'undershot-wheel-and-tailrace', position: [66, 12, 21], lookAt: [37.4, 1.8, 10] },
      { name: 'open-court-and-slate-ranges', position: [39, 73, 41], lookAt: [-6, 3, -4] },
    ],
  },
  build,
);
export const { skyline, district, street, closeup } = asset;
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
export const model = {
  ...asset.model,
  category: 'industrial',
  buildingCutout: {
    outline: frame.geometry.outline,
    outlines: frame.geometry.polygons,
    minimumCoverage: 0.91,
    basis: 'The surveyed east and west distillery ranges and the separate western store.',
  },
};
