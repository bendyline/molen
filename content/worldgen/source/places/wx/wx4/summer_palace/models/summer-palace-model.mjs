import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { prism } from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_ashlar' },
  marble: { slot: 'trim', graph: 'stone_marble' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  plaster: { slot: 'wall', graph: 'plaster_lime' },
  glass: { slot: 'window', graph: 'window_grid' },
  enamel: { slot: 'trim', graph: 'metal_painted' },
};
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const granite = [0.57, 0.49, 0.38];
const marble = [0.77, 0.73, 0.66];
const red = [0.44, 0.125, 0.091];
const dark = [0.16, 0.13, 0.11];
const turquoise = [0.137, 0.294, 0.25];
const indigo = [0.096, 0.178, 0.283];
const gold = [0.78, 0.49, 0.138];
const roofs = {
  gold: [0.72, 0.386, 0.115],
  green: [0.139, 0.296, 0.205],
  grey: [0.233, 0.244, 0.219],
};
const up = [0, 1, 0];

function face(out, slot, points, color, direction) {
  let normal = normalFor(...points);
  if (Math.hypot(...normal) < 0.9) return;
  if (direction && normal.reduce((n, v, i) => n + v * direction[i], 0) < 0) {
    points = points.toReversed();
    normal = normal.map((n) => -n);
  }
  if (points.length === 3) out.addTriangle(slot, '', points, normal, undefined, color);
  else out.addQuad(slot, '', points, normal, undefined, color);
}

function frame(out, [x, z], y, angle) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const rotate = ([u, v, w]) => [u * c - w * s, v, u * s + w * c];
  const position = (p) => rotate(p).map((v, i) => v + [x, y, z][i]);
  return {
    addTriangle: (k, r, p, n, uv, t) => out.addTriangle(k, r, p.map(position), rotate(n), uv, t),
    addQuad: (k, r, p, n, uv, t) => out.addQuad(k, r, p.map(position), rotate(n), uv, t),
    addConvexPolygon: (k, r, p, n, uv, t) =>
      out.addConvexPolygon(k, r, p.map(position), rotate(n), uv, t),
  };
}

function rectangle(width, depth) {
  return [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
  ];
}
function solid(out, slot, outline, bottom, top, color) {
  if (top - bottom < 0.02) return;
  prism((k, p, n) => face(out, k, p, color, n), slot, { outline, holes: [] }, bottom, top, false);
}
function rectangularRoof(out, width, depth, y, rise, color, detail) {
  const profiles =
    detail < 2
      ? [
          [0, 1, 1],
          [1, 0.66, 0.05],
        ]
      : [
          [0, 1, 1],
          [0.28, 0.89, 0.7],
          [0.62, 0.77, 0.37],
          [1, 0.64, 0.035],
        ];
  loft(
    out,
    'tile',
    profiles.map(([h, w, d]) =>
      rectangle(width * w, depth * d)
        .toReversed()
        .map(([x, z]) => [x, y + h * rise + (h === 0 ? 0.34 : 0), z]),
    ),
    color,
  );
  if (detail < 2) return;
  beam(out, 'tile', [-width * 0.32, y + rise, 0], [width * 0.32, y + rise, 0], 0.33, 0.32, color);
  for (const z of [-depth / 2, depth / 2]) {
    beam(
      out,
      'timber',
      [-width / 2 + 0.2, y + 0.11, z],
      [width / 2 - 0.2, y + 0.11, z],
      0.18,
      0.24,
      turquoise,
    );
    if (detail >= 3)
      for (const x of [-width / 2, width / 2]) {
        const sign = Math.sign(x);
        beam(
          out,
          'tile',
          [x - sign * 0.86, y + 0.28, z],
          [x + sign * 0.19, y + 0.76, z],
          0.2,
          0.32,
          color,
        );
        beam(
          out,
          'enamel',
          [x + sign * 0.19, y + 0.68, z],
          [x + sign * 0.23, y + 0.99, z],
          0.13,
          0.23,
          color,
        );
      }
  }
}

function lattice(out, x, y, z, w, h, detail, backing = dark) {
  face(
    out,
    'timber',
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    backing,
    [0, 0, Math.sign(z)],
  );
  if (detail < 3) return;
  const n = detail === 4 ? 6 : 4;
  const lineZ = z + Math.sign(z) * 0.045;
  for (let j = 0; j <= n; j++) {
    const u = x + (j / n - 0.5) * w;
    face(
      out,
      'timber',
      [
        [u - 0.031, y, lineZ],
        [u + 0.031, y, lineZ],
        [u + 0.031, y + h, lineZ],
        [u - 0.031, y + h, lineZ],
      ],
      red,
      [0, 0, Math.sign(z)],
    );
  }
  for (const v of [0.17, 0.36, 0.68, 0.88])
    face(
      out,
      'timber',
      [
        [x - w / 2, y + h * v, lineZ],
        [x + w / 2, y + h * v, lineZ],
        [x + w / 2, y + h * v + 0.055, lineZ],
        [x - w / 2, y + h * v + 0.055, lineZ],
      ],
      red,
      [0, 0, Math.sign(z)],
    );
}

function hall(out, site, detail) {
  const { width: w, depth: d, center, angle } = site.frame;
  const open = ['gate', 'entry', 'pavilion', 'octagonal'].includes(site.role);
  const height =
    site.role === 'ceremonial'
      ? 7.1
      : site.role === 'opera'
        ? 6.45
        : site.role === 'royal'
          ? 6.35
          : Math.min(4.75, d * 0.39);
  const count = w >= 28 ? 7 : w >= 17 ? 5 : w >= 8 ? 3 : 2;
  const body = frame(out, center, site.grade + 0.58, angle);
  solid(out, 'stone', site.outline, site.toe, site.grade + 0.58, granite);
  if (site.role === 'octagonal') {
    octagonalBuilding(body, Math.min(w, d) * 0.55, 0, [5.4], detail, roofs.grey);
    return;
  }
  if (!open)
    box(
      body,
      'plaster',
      [-w * 0.405, 0, -d * 0.306],
      [w * 0.405, height, d * 0.306],
      site.role === 'shop' ? [0.74, 0.71, 0.61] : red,
    );
  for (const sign of [-1, 1]) {
    const z = sign * d * 0.37;
    const step = (w * 0.9) / count;
    const span = step * count;
    if (detail === 0) {
      if (open)
        for (const x of [-span / 2, span / 2])
          beam(body, 'timber', [x, 0, z], [x, height + 0.16, z], 0.4, 0.4, red);
      continue;
    }
    for (let i = 0; i <= count; i++) {
      const x = i * step - span / 2;
      beam(body, 'timber', [x, 0, z], [x, height + 0.16, z], 0.29, 0.29, red);
      if (detail >= 2) {
        box(body, 'stone', [x - 0.24, 0, z - 0.24], [x + 0.24, 0.38, z + 0.24], granite);
        box(
          body,
          'timber',
          [x - 0.27, height - 0.48, z - 0.26],
          [x + 0.27, height - 0.14, z + 0.26],
          indigo,
        );
        box(
          body,
          'timber',
          [x - 0.38, height - 0.26, z - 0.36],
          [x + 0.38, height + 0.06, z + 0.36],
          turquoise,
        );
      }
      if (i < count && !open && detail >= 2)
        lattice(
          body,
          x + step / 2,
          0.31,
          sign * (d * 0.308 + 0.023),
          step * 0.73,
          height * 0.67,
          detail,
        );
    }
    beam(body, 'timber', [-w * 0.5, height, z], [w * 0.5, height, z], 0.24, 0.42, indigo);
    if (detail >= 2) {
      beam(
        body,
        'timber',
        [-w * 0.51, height + 0.13, z],
        [w * 0.51, height + 0.13, z],
        0.2,
        0.15,
        turquoise,
      );
      beam(
        body,
        'enamel',
        [-w * 0.5, height - 0.17, z],
        [w * 0.5, height - 0.17, z],
        0.07,
        0.065,
        gold,
      );
    }
  }
  const tint = roofs[site.roof] ?? roofs.grey;
  rectangularRoof(body, w * 1.045, d * 1.11, height + 0.25, Math.min(4.65, d * 0.27), tint, detail);
  if (site.role === 'opera') {
    for (const [y, factor] of [
      [8.3, 0.78],
      [13.6, 0.52],
    ]) {
      box(
        body,
        'plaster',
        [(-w * factor) / 2, y - 1.25, (-d * factor) / 2],
        [(w * factor) / 2, y + 4.1, (d * factor) / 2],
        red,
      );
      rectangularRoof(body, w * factor * 1.18, d * factor * 1.23, y + 4.17, 2.8, tint, detail);
    }
  }
  if (detail >= 2 && ['ceremonial', 'royal', 'entry'].includes(site.role)) {
    const stairWidth = Math.min(w * 0.52, 11);
    for (let i = 0; i < 5; i++) {
      const near = d * 0.43 + i * 0.37;
      box(
        body,
        'stone',
        [-stairWidth / 2, -0.72, near],
        [stairWidth / 2, 0.06 - i * 0.144, near + 0.375],
        granite,
      );
    }
  }
}

function octagonalRoof(out, r, y, rise, detail, color) {
  const n = 8;
  const steps =
    detail === 0
      ? [
          [0, 1],
          [1, 0.22],
        ]
      : [
          [0, 1],
          [0.32, 0.82],
          [0.69, 0.61],
          [1, 0.33],
        ];
  const rings = steps.map(([h, w]) => radialRing(y + rise * h, r * w, r * w, n));
  loft(out, 'tile', rings, color);
  if (detail >= 1)
    for (const [i, p] of rings[0].entries()) {
      const d = rings[0][(i + 1) % n];
      beam(out, 'timber', p, d, 0.18, 0.29, turquoise);
      if (detail >= 2) {
        const tip = [p[0] * 1.047, p[1] + 0.54, p[2] * 1.047];
        beam(out, 'tile', p, tip, 0.23, 0.29, color);
        for (let j = 1; j < rings.length; j++)
          beam(out, 'tile', rings[j - 1][i], rings[j][i], 0.19, 0.23, color);
      }
    }
}

function octagonalBuilding(out, r, y, stories, detail, color) {
  for (const [i, height] of stories.entries()) {
    const radius = r * (1 - i * 0.105);
    const base = radialRing(y, radius, radius, 8);
    const top = radialRing(y + height, radius, radius, 8);
    for (const [j, a] of base.entries()) {
      const b = base[(j + 1) % 8];
      const q = top[j],
        p = top[(j + 1) % 8];
      const tint = detail < 1 ? red : dark;
      face(
        out,
        'timber',
        [
          a.map((v, k) => (k === 1 ? v : v * 0.91)),
          b.map((v, k) => (k === 1 ? v : v * 0.91)),
          p.map((v, k) => (k === 1 ? v : v * 0.91)),
          q.map((v, k) => (k === 1 ? v : v * 0.91)),
        ],
        tint,
        [a[0] + b[0], 0, a[2] + b[2]],
      );
      if (detail < 1) continue;
      for (const t of detail === 1 ? [0] : [0, 1 / 3, 2 / 3]) {
        const col = a.map((v, k) => v + (b[k] - v) * t);
        beam(out, 'timber', col, [col[0], y + height + 0.19, col[2]], 0.29, 0.29, red);
        if (detail >= 2)
          beam(
            out,
            'timber',
            [col[0], y + height - 0.38, col[2]],
            [col[0], y + height, col[2]],
            0.6,
            0.51,
            indigo,
          );
      }
      beam(out, 'enamel', [a[0], y + 1.03, a[2]], [b[0], y + 1.03, b[2]], 0.13, 0.14, gold);
      beam(
        out,
        'timber',
        [a[0], y + height - 0.26, a[2]],
        [b[0], y + height - 0.26, b[2]],
        0.28,
        0.32,
        turquoise,
      );
      if (detail >= 3)
        for (let panel = 1; panel < 13; panel++) {
          const t = panel / 13;
          const [x, , z] = a.map((v, k) => v + (b[k] - v) * t);
          beam(out, 'timber', [x, y + 0.28, z], [x, y + 1.02, z], 0.05, 0.062, red);
        }
    }
    octagonalRoof(
      out,
      radius * 1.21,
      y + height,
      i === stories.length - 1 ? 3.85 : 1.78,
      detail,
      color,
    );
    y += height + 1.02;
  }
  if (stories.length > 1) {
    const tip = y + 2.51;
    loft(
      out,
      'enamel',
      [
        [0, 0.51],
        [0.35, 0.61],
        [0.89, 0.41],
        [1.28, 0.02],
      ].map(([dy, rr]) => radialRing(tip + dy, rr, rr, detail >= 3 ? 12 : 8)),
      gold,
    );
  }
}

function hill(out, layout, detail) {
  const [tower, ...companions] = layout.sites;
  const y = tower.grade + 3.2;
  const podium = frame(out, tower.frame.center, y, tower.frame.angle);
  const half = 19.5;
  loft(
    podium,
    'stone',
    [
      rectangle(2 * half + 3.8, 28.8)
        .toReversed()
        .map(([x, z]) => [x, -23, z + 0.85]),
      rectangle(2 * half, 25.8)
        .toReversed()
        .map(([x, z]) => [x, 0, z + 0.85]),
    ],
    granite,
  );
  box(podium, 'marble', [-half - 0.25, -0.31, -12.2], [half + 0.25, 0.03, 14.06], marble);
  box(podium, 'stone', [-10.2, -23, 13.8], [10.2, -11.65, 21.25], granite);
  for (const side of [-1, 1]) {
    beam(podium, 'stone', [side * 19, -10.95, 17.6], [side * 7.4, 0.09, 14.2], 1.5, 1.03, granite);
    if (detail >= 2)
      for (let i = 0; i < 30; i++) {
        const x = side * (19 - i * 0.4),
          top = -10.95 + i * 0.37;
        box(podium, 'marble', [x - 0.23, top - 0.18, 14.3], [x + 0.23, top, 17.6], marble);
      }
  }
  const tai = frame(out, tower.frame.center, y + 0.04, tower.frame.angle);
  box(tai, 'stone', [-10.9, 0.03, -10.9], [10.9, 0.92, 10.9], granite);
  octagonalRoof(tai, 11.6, 3.02, 1.15, detail, roofs.green);
  octagonalBuilding(tai, 8.47, 1.1, [7.05, 6.65, 6.48], detail, roofs.green);
  for (const s of companions) hall(out, s, detail);
}

function bridge(out, { ends, spans, width, deckHeights, water, crown }, detail) {
  const first = ends[0][0],
    last = ends[1][0],
    length = last - first,
    half = width / 2;
  const deck = (x) => {
    const u = (x - first) / length;
    return deckHeights[0] + (deckHeights[1] - deckHeights[0]) * u + crown * 4 * u * (1 - u);
  };
  const invert = water - 1.65;
  const apron = 1.65;
  const gap = (length - 2 * apron - spans.reduce((n, w) => n + w, 0)) / 16;
  const arches = [];
  let from = first + apron;
  for (const [i, w] of spans.entries()) {
    const middle = from + w / 2;
    const top = deck(middle) - 0.42;
    const spring = Math.max(water - 0.3, top - w * 0.54);
    arches.push({ from, to: from + w, middle, top, spring });
    from += w + (i === 16 ? 0 : gap);
  }
  const strips = [
    { from: first, to: arches[0].from },
    ...arches.flatMap((arch, i) => [arch, { from: arch.to, to: arches[i + 1]?.from ?? last }]),
  ];
  const count = detail === 0 ? 5 : detail === 1 ? 8 : detail === 2 ? 12 : detail === 3 ? 16 : 22;
  for (const row of strips) {
    const curved = row.middle !== undefined;
    const n = curved ? count : Math.max(1, detail);
    for (let i = 0; i < n; i++) {
      const ab = (k) => {
        const t = k / n;
        const p = curved ? Math.PI * (1 - t) : 0;
        const x = curved
          ? row.middle + ((row.to - row.from) * Math.cos(p)) / 2
          : row.from + (row.to - row.from) * t;
        const bottom = curved ? row.spring + (row.top - row.spring) * Math.sin(p) : invert;
        return { x, bottom, top: deck(x) };
      };
      const a = ab(i),
        b = ab(i + 1);
      for (const side of [-1, 1]) {
        const z = side * half;
        face(
          out,
          'stone',
          [
            [a.x, a.bottom, z],
            [b.x, b.bottom, z],
            [b.x, b.top, z],
            [a.x, a.top, z],
          ],
          granite,
          [0, 0, side],
        );
        if (detail >= 2 && curved) {
          const topA = Math.min(a.top - 0.07, a.bottom + 0.22),
            topB = Math.min(b.top - 0.07, b.bottom + 0.22);
          face(
            out,
            'marble',
            [
              [a.x, a.bottom, z + side * 0.048],
              [b.x, b.bottom, z + side * 0.048],
              [b.x, topB, z + side * 0.048],
              [a.x, topA, z + side * 0.048],
            ],
            marble,
            [0, 0, side],
          );
        }
      }
      face(
        out,
        'stone',
        [
          [a.x, a.bottom, -half],
          [b.x, b.bottom, -half],
          [b.x, b.bottom, half],
          [a.x, a.bottom, half],
        ],
        granite,
        [0, -1, 0],
      );
      face(
        out,
        'stone',
        [
          [a.x, a.top, -half],
          [a.x, a.top, half],
          [b.x, b.top, half],
          [b.x, b.top, -half],
        ],
        marble,
        up,
      );
    }
    if (curved)
      for (const [x, side] of [
        [row.from, 1],
        [row.to, -1],
      ])
        face(
          out,
          'stone',
          [
            [x, invert, -half],
            [x, row.spring, -half],
            [x, row.spring, half],
            [x, invert, half],
          ],
          granite,
          [side, 0, 0],
        );
  }
  for (const [x, side] of [
    [first, -1],
    [last, 1],
  ])
    face(
      out,
      'stone',
      [
        [x, invert, -half],
        [x, deck(x), -half],
        [x, deck(x), half],
        [x, invert, half],
      ],
      granite,
      [side, 0, 0],
    );
  if (detail === 0) return;
  const rails = detail === 1 ? 36 : detail === 2 ? 72 : 124;
  for (const side of [-1, 1])
    for (let i = 0; i < rails; i++) {
      const a = first + (length * i) / rails,
        b = first + (length * (i + 1)) / rails,
        z = side * (half - 0.13);
      beam(out, 'marble', [a, deck(a) + 0.84, z], [b, deck(b) + 0.84, z], 0.185, 0.146, marble);
      if (detail >= 2) {
        box(
          out,
          'marble',
          [a - 0.08, deck(a), z - 0.11],
          [a + 0.08, deck(a) + 0.94, z + 0.11],
          marble,
        );
        face(
          out,
          'stone',
          [
            [a + 0.13, deck(a) + 0.14, z],
            [b - 0.13, deck(b) + 0.14, z],
            [b - 0.13, deck(b) + 0.62, z],
            [a + 0.13, deck(a) + 0.62, z],
          ],
          marble,
          [0, 0, side],
        );
      }
      if (detail >= 3 && i % 2 === 0) {
        box(
          out,
          'stone',
          [a - 0.16, deck(a) + 0.89, z - 0.15],
          [a + 0.16, deck(a) + 1.04, z + 0.15],
          marble,
        );
        const y = deck(a) + 1.08;
        loft(
          out,
          'marble',
          [
            [0, 0.16],
            [0.14, 0.145],
            [0.29, 0.096],
            [0.37, 0.047],
          ].map(([dy, r]) => radialRing(y + dy, r, r, detail === 4 ? 7 : 5, [a, z])),
          marble,
        );
      }
    }
}

function corridor(out, layout, detail) {
  const spacing = detail === 0 ? 57 : detail === 1 ? 13 : detail === 2 ? 7 : 4;
  const profileSegments = layout.groundProfile.slice(0, -1);
  const nearestHeight = (x, z) => {
    let best = Infinity,
      height = 0;
    for (const [i, a] of profileSegments.entries()) {
      const b = layout.groundProfile[i + 1],
        dx = b[0] - a[0],
        dz = b[1] - a[1];
      const t = Math.max(
        0,
        Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)),
      );
      const distance = Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
      if (distance < best) {
        best = distance;
        height = a[2] + (b[2] - a[2]) * t;
      }
    }
    return height;
  };
  for (const [i, a] of layout.path.slice(0, -1).entries()) {
    const b = layout.path[i + 1];
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.25) continue;
    const span = frame(out, a.slice(0, 2), 0, angle),
      grade = (x) => nearestHeight(a[0] + Math.cos(angle) * x, a[1] + Math.sin(angle) * x);
    const hz = 2.14,
      y = (x) => grade(x) + 3.45;
    const deckSegments = Math.max(1, Math.ceil(len / (detail === 0 ? 75 : detail === 1 ? 30 : 12)));
    for (let step = 0; step < deckSegments; step++) {
      const a = (len * step) / deckSegments,
        b = (len * (step + 1)) / deckSegments;
      face(
        span,
        'stone',
        [
          [a, grade(a) + 0.43, -1.39],
          [a, grade(a) + 0.43, 1.39],
          [b, grade(b) + 0.43, 1.39],
          [b, grade(b) + 0.43, -1.39],
        ],
        granite,
        up,
      );
    }
    for (const side of [-1, 1]) {
      const z = side * hz;
      const tint = roofs.grey;
      face(
        span,
        'tile',
        [
          [0, y(0), z],
          [len, y(len), z],
          [len, y(len) + 1.12, 0],
          [0, y(0) + 1.12, 0],
        ],
        tint,
        up,
      );
      if (detail >= 1)
        beam(
          span,
          'timber',
          [0, y(0) - 0.21, z * 0.8],
          [len, y(len) - 0.21, z * 0.8],
          0.19,
          0.35,
          indigo,
        );
      const n = Math.max(detail === 0 ? 0 : 1, Math.round(len / spacing));
      for (let j = 0; j < n; j++) {
        const x = ((j + 0.13) * len) / n,
          column = z * 0.64;
        const top = y(x) - 0.12,
          bottom = grade(x);
        beam(span, 'timber', [x, bottom - 0.5, column], [x, top, column], 0.21, 0.21, red);
        if (detail >= 2) {
          beam(
            span,
            'timber',
            [x - 0.08, top - 0.31, column],
            [x + 0.57, top, column],
            0.14,
            0.2,
            turquoise,
          );
          beam(
            span,
            'timber',
            [x, top - 0.35, column],
            [x, top + 0.03, column],
            0.31,
            0.34,
            turquoise,
          );
        }
        if (detail >= 3) {
          const d = Math.min(len, x + len / n);
          beam(
            span,
            'timber',
            [x, bottom + 0.76, column],
            [d, grade(d) + 0.76, column],
            0.135,
            0.13,
            turquoise,
          );
          beam(
            span,
            'enamel',
            [x, top + 0.036, column],
            [d, y(d) - 0.083, column],
            0.055,
            0.063,
            gold,
          );
        }
      }
    }
    if (detail >= 2)
      beam(span, 'tile', [0, y(0) + 1.12, 0], [len, y(len) + 1.12, 0], 0.2, 0.22, roofs.grey);
  }
}

function boat(out, detail) {
  const ring = (length, depth, y, endRise) => [
    [-length / 2, y + endRise, -depth * 0.27],
    [-length * 0.38, y, -depth / 2],
    [length * 0.35, y, -depth / 2],
    [length / 2, y + endRise, -depth * 0.22],
    [length / 2, y + endRise, depth * 0.22],
    [length * 0.35, y, depth / 2],
    [-length * 0.38, y, depth / 2],
    [-length / 2, y + endRise, depth * 0.27],
  ];
  loft(
    out,
    'marble',
    [ring(33.5, 7.1, -1.2, 0.55), ring(36.3, 9, 1.58, 1.45), ring(36.5, 9.13, 1.86, 1.55)].map(
      (r) => r.toReversed(),
    ),
    marble,
    { cap: false },
  );
  box(out, 'marble', [-15.5, 1.3, -4.22], [15.5, 1.94, 4.22], marble);
  box(out, 'marble', [15.1, 1.54, -1.37], [22.1, 1.94, 1.37], marble);
  for (const side of [-1, 1]) {
    beam(out, 'marble', [14.1, 1.96, side * 3.76], [17.5, 3.48, side * 2.15], 0.31, 0.46, marble);
    beam(out, 'marble', [-14.1, 1.96, side * 3.76], [-17.9, 3.48, side * 2.55], 0.34, 0.49, marble);
  }
  for (const y of [1.95, 6.88]) {
    box(out, 'marble', [-10.7, y, -3.94], [10.7, y + 0.42, 3.94], marble);
    const open = [3, 4, 5];
    for (const side of [-1, 1]) {
      const z = side * 3.83;
      for (let i = 0; i < 9; i++) {
        const x = (i - 4) * 2.6,
          w = 1.98,
          lo = y + 0.54,
          hi = lo + 2.36;
        const showGlass = y > 6 ? !open.includes(i) : !open.map((v) => v - 3).includes(i);
        beam(out, 'marble', [x - 1.22, y + 0.06, z], [x - 1.22, y + 4.33, z], 0.19, 0.24, marble);
        if (showGlass) {
          face(
            out,
            'glass',
            [
              [x - w / 2, lo, z],
              [x + w / 2, lo, z],
              [x + w / 2, hi, z],
              [x - w / 2, hi, z],
            ],
            [0.34, 0.49, 0.52],
            [0, 0, side],
          );
        }
        const steps = detail >= 2 ? 9 : 4;
        for (let j = 0; j < steps; j++) {
          const q = (k) => [
            x - w * 0.5 * Math.cos((Math.PI * k) / steps),
            hi + 0.84 * Math.sin((Math.PI * k) / steps),
            z,
          ];
          const a = q(j),
            b = q(j + 1);
          if (showGlass) face(out, 'glass', [[x, hi, z], a, b], [0.34, 0.49, 0.52], [0, 0, side]);
          if (detail >= 1) beam(out, 'marble', a, b, 0.105, 0.135, marble);
        }
      }
      beam(out, 'marble', [11.62, y + 0.06, z], [11.62, y + 4.33, z], 0.19, 0.24, marble);
      beam(out, 'marble', [-11.75, y + 4.22, z], [11.75, y + 4.22, z], 0.38, 0.48, marble);
      if (detail >= 2)
        beam(out, 'enamel', [-11.43, y + 3.84, z], [11.43, y + 3.84, z], 0.29, 0.17, turquoise);
    }
  }
  rectangularRoof(out, 23.86, 8.22, 11.52, 2.46, roofs.grey, detail);
  for (const side of [-1, 1]) {
    const z = side * 4.65;
    const radius = 2.38,
      segments = detail >= 2 ? 20 : 9;
    for (let i = 0; i < segments; i++) {
      const rim = (t) => [0.9 + Math.cos(t) * radius, 0.91 + Math.sin(t) * radius, z];
      const a = rim((Math.PI * i) / segments),
        b = rim((Math.PI * (i + 1)) / segments);
      face(out, 'marble', [[0.9, 0.91, z], a, b], marble, [0, 0, side]);
      if (detail >= 2) beam(out, 'stone', a, b, 0.11, 0.16, granite);
    }
  }
}

function courtRoof(
  out,
  w,
  d,
  y,
  height,
  tint,
  detail,
  gabled = false,
  lift = Math.min(0.58, d * 0.057),
) {
  const steps = detail < 1 ? [0, 1] : [0, 0.28, 0.61, 1];
  const ridge = gabled ? 0.98 : 0.63;
  const rows = steps.map((t) => {
    const x = (w * (1 - (1 - ridge) * t)) / 2;
    const z = (d * (1 - t * 0.97)) / 2;
    return rectangle(x * 2, z * 2)
      .toReversed()
      .flatMap(([r, s], i, ring) => {
        const [a, b] = ring[(i + 1) % ring.length];
        const v = y + height * t * (0.61 + 0.39 * t);
        const lifted = t === 0 ? lift : 0;
        return [
          [r, v + lifted, s],
          [(r + a) / 2, v, (s + b) / 2],
        ];
      });
  });
  loft(out, 'tile', rows, tint, { cap: false });
  const eave = rows[0];
  const soffit = eave.map(([x, v, z]) => [x, v - 0.19, z]);
  for (const [i, a] of eave.entries()) {
    const j = (i + 1) % eave.length;
    const b = eave[j];
    face(out, 'timber', [a, b, soffit[j], soffit[i]], dark, [a[0] + b[0], 0, a[2] + b[2]]);
    face(out, 'timber', [soffit[i], soffit[j], [0, y - 0.19, 0]], dark, [0, -1, 0]);
  }
  const tip = rows.at(-1);
  face(out, 'tile', [tip[0], tip[2], tip[4], tip[6]], tint, up);
  const ridgeHeight = y + height;
  beam(
    out,
    'tile',
    [-w * ridge * 0.5, ridgeHeight, 0],
    [w * ridge * 0.5, ridgeHeight, 0],
    0.23,
    0.21,
    tint,
  );
  if (detail < 2) return;
  for (let i = 0; i < eave.length; i++) {
    const a = eave[i];
    const b = eave[(i + 1) % eave.length];
    beam(out, 'tile', a, b, 0.18, 0.18, tint);
    if (i % 2 === 0) {
      for (let j = 1; j < rows.length; j++)
        beam(out, 'tile', rows[j - 1][i], rows[j][i], 0.16, 0.19, tint);
      beam(out, 'tile', a, [a[0] * 1.01, a[1] + 0.29, a[2] * 1.015], 0.13, 0.18, tint);
    }
  }
  if (detail < 3) return;
  for (const side of [-1, 1]) {
    const z = side * d * 0.5;
    const count = Math.min(70, Math.round(w / 0.4));
    for (let i = 1; i < count; i++) {
      const x = w * (i / count - 0.5);
      const corner = (Math.abs(x) / (w * 0.5)) * lift;
      beam(
        out,
        'tile',
        [x, y + corner, z],
        [x * 0.97, y + corner + 0.04, z * 0.974],
        0.09,
        0.1,
        tint,
      );
    }
    beam(
      out,
      'tile',
      [tip[0][0] * side, ridgeHeight, 0],
      [tip[0][0] * side + side * 0.29, ridgeHeight + 0.4, 0],
      0.13,
      0.18,
      tint,
    );
  }
}

function courtBay(out, w, d, y, h, bays, detail, options = {}) {
  const depth = d * 0.39;
  const width = w * 0.43;
  const step = (width * 2) / bays;
  if (options.wall) {
    const z = -depth * 0.64;
    box(out, 'plaster', [-width, y, -depth * 0.94], [width, y + h, z], red);
    if (options.frontScreen) {
      const screen = depth * 0.72;
      box(out, 'timber', [-width, y + h * 0.83, screen - 0.16], [width, y + h, screen], red);
      for (let i = 0; i < bays; i++) {
        const x = -width + step * (i + 0.5);
        if (i === (bays - 1) / 2) {
          face(
            out,
            'timber',
            [
              [x - step * 0.49, y, screen],
              [x + step * 0.49, y, screen],
              [x + step * 0.49, y + h * 0.84, screen],
              [x - step * 0.49, y + h * 0.84, screen],
            ],
            dark,
            [0, 0, 1],
          );
          continue;
        }
        lattice(out, x, y + 0.05, screen, step * 0.995, h * 0.84, detail, [0.42, 0.11, 0.074]);
        if (detail >= 2) {
          beam(
            out,
            'enamel',
            [x - step * 0.42, y + h * 0.28, screen + 0.035],
            [x + step * 0.42, y + h * 0.28, screen + 0.035],
            0.067,
            0.074,
            gold,
          );
          for (const dx of [-0.32, 0, 0.32])
            beam(
              out,
              'enamel',
              [x + step * dx, y + 0.21, screen + 0.035],
              [x + step * dx, y + h * 0.28, screen + 0.035],
              0.061,
              0.072,
              gold,
            );
        }
      }
      for (const x of [-width, width])
        box(out, 'plaster', [x - 0.095, y, -depth * 0.65], [x + 0.095, y + h, screen], red);
    }
  }
  for (const z of [-depth, depth]) {
    for (let i = 0; i <= bays; i++) {
      if (detail === 0 && i > 0 && i < bays && i % 2) continue;
      const x = -width + step * i;
      const column = Math.min(w * 0.061, 0.46);
      beam(out, 'timber', [x, y, z], [x, y + h, z], column, column, options.postTint ?? red);
      if (detail < 2) continue;
      box(
        out,
        'stone',
        [x - column * 0.7, y, z - column * 0.7],
        [x + column * 0.7, y + 0.22, z + column * 0.7],
        granite,
      );
      beam(
        out,
        'timber',
        [x, y + h - 0.47, z],
        [x, y + h - 0.11, z],
        column * 1.55,
        column * 1.67,
        turquoise,
      );
      beam(
        out,
        'timber',
        [x, y + h - 0.25, z],
        [x, y + h + 0.04, z],
        column * 2.14,
        column * 1.87,
        indigo,
      );
    }
    beam(
      out,
      'timber',
      [-w * 0.49, y + h - 0.07, z],
      [w * 0.49, y + h - 0.07, z],
      0.28,
      0.34,
      indigo,
    );
    if (detail >= 2) {
      beam(
        out,
        'timber',
        [-w * 0.48, y + h + 0.16, z],
        [w * 0.48, y + h + 0.16, z],
        0.29,
        0.19,
        turquoise,
      );
      beam(
        out,
        'enamel',
        [-w * 0.46, y + h - 0.26, z],
        [w * 0.46, y + h - 0.26, z],
        0.085,
        0.072,
        gold,
      );
      for (let i = 0; i < bays; i++) {
        const x = step * (i + 0.5) - width;
        const side = Math.sign(z);
        const front = z + side * 0.153;
        box(
          out,
          'timber',
          [x - step * 0.33, y + h - 0.21, front - 0.012],
          [x + step * 0.33, y + h + 0.05, front + 0.012],
          turquoise,
        );
        if (detail >= 3)
          for (const off of [-0.22, 0, 0.22])
            beam(
              out,
              'enamel',
              [x + step * off - 0.1, y + h - 0.17, front + side * 0.019],
              [x + step * off + 0.1, y + h, front + side * 0.019],
              0.042,
              0.047,
              gold,
            );
      }
      if (options.plaque && z > 0) {
        const a = Math.min(step * 0.43, 1.08);
        box(out, 'enamel', [-a, y + h - 0.68, z + 0.13], [a, y + h - 0.24, z + 0.23], gold);
        box(
          out,
          'timber',
          [-a + 0.07, y + h - 0.62, z + 0.22],
          [a - 0.07, y + h - 0.3, z + 0.25],
          dark,
        );
      }
    }
    if (!options.rail || (z > 0 && options.frontSteps)) continue;
    const railH = Math.min(0.92, h * 0.3);
    beam(out, 'timber', [-width, y + railH, z], [width, y + railH, z], 0.13, 0.14, red);
    if (detail >= 2)
      for (let i = 1; i < bays * 5; i++) {
        const x = (step * i) / 5 - width;
        beam(out, 'timber', [x, y + 0.13, z], [x, y + railH, z], 0.075, 0.08, red);
      }
  }
}

function audienceHall(out, site, detail) {
  const { width: w, depth: d, center, angle } = site.frame;
  const plinth = 0.83;
  solid(out, 'stone', site.outline, site.toe, site.grade + plinth, granite);
  const body = frame(out, center, site.grade + plinth, angle);
  const h = 6.05;
  courtBay(body, w, d, 0, h, 7, detail, { wall: true, frontScreen: true, plaque: true });
  courtRoof(body, w * 1.06, d * 1.06, h + 0.38, 4.08, roofs[site.roof], detail, true);
  for (let i = 0; i < (detail > 0 ? 5 : 1); i++) {
    const z = d * 0.49 + i * 0.34;
    box(body, 'stone', [-w * 0.21, -1.4, z], [w * 0.21, 0.017 - 0.16 * i, z + 0.35], granite);
  }
}

function theater(out, site, detail) {
  const { width: w, depth: d, center, angle } = site.frame;
  const plinth = 1.12;
  solid(out, 'stone', site.outline, site.toe, site.grade + plinth, granite);
  const body = frame(out, center, site.grade + plinth, angle);
  const rear = frame(body, [0, -d * 0.22], 0, 0);
  box(rear, 'plaster', [-w * 0.48, 0, -d * 0.254], [w * 0.48, 4.42, d * 0.25], red);
  courtRoof(rear, w * 1.034, d * 0.56, 4.44, 2.7, roofs.grey, detail);
  const stage = frame(body, [-w * 0.028, d * 0.246], 0, 0);
  for (const [i, [y, width, depth, clear, rise]] of [
    [0, w * 0.66, d * 0.48, 5.6, 2.38],
    [7.16, w * 0.57, d * 0.41, 4.72, 2.21],
    [13.02, w * 0.46, d * 0.35, 4.01, 2.82],
  ].entries()) {
    box(
      stage,
      'stone',
      [-width * 0.475, y - 0.28, -depth * 0.453],
      [width * 0.475, y, depth * 0.453],
      granite,
    );
    courtBay(stage, width, depth, y, clear, i === 0 ? 5 : 3, detail, {
      wall: true,
      rail: i > 0,
      plaque: true,
    });
    courtRoof(stage, width * 1.07, depth * 1.085, y + clear + 0.34, rise, roofs.grey, detail);
  }
}

function lakesidePavilion(out, site, detail) {
  const { width: w, depth: d, center, angle } = site.frame;
  const plinth = 0.44;
  solid(out, 'stone', site.outline, site.toe, site.grade + plinth, granite);
  const body = frame(out, center, site.grade + plinth, angle);
  courtBay(body, w * 0.79, d * 0.8, 0, 3.66, 1, detail, {
    rail: true,
    frontSteps: true,
    plaque: true,
  });
  courtRoof(body, w * 1.04, d * 1.06, 3.99, 1.98, roofs.grey, detail);
  courtBay(body, w * 0.57, d * 0.57, 4.58, 1.12, 1, detail, { wall: true });
  courtRoof(body, w * 0.77, d * 0.77, 5.97, 1.75, roofs.grey, detail);
  box(body, 'stone', [-0.18, 7.68, -0.18], [0.18, 7.93, 0.18], granite);
  if (detail < 2) return;
  for (const x of [-w * 0.34, w * 0.34])
    beam(body, 'timber', [x, 0.66, -d * 0.29], [x, 0.66, d * 0.28], 0.12, 0.14, red);
}

const courtRoles = {
  audience: audienceHall,
  theater,
  lakeside: lakesidePavilion,
};

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level];
  switch (layout.form) {
    case 'hill':
      hill(out, layout, detail);
      break;
    case 'bridge':
      bridge(out, layout.bridge, detail);
      break;
    case 'corridor':
      corridor(out, layout, detail);
      break;
    case 'boat':
      boat(out, detail);
      break;
    default:
      for (const site of layout.sites) (courtRoles[site.role] ?? hall)(out, site, detail);
  }
}

export {
  courtBay,
  courtRoof,
  dark,
  face,
  frame,
  gold,
  granite,
  hall,
  indigo,
  lattice,
  levels,
  marble,
  rectangle,
  red,
  roofs,
  solid,
  turquoise,
  up,
};
