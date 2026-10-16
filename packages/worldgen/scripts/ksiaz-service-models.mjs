/** Own-footprint medium-fi exterior of Książ's forester house. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

export const ksiazServiceModels = [
  {
    id: 'KSI_S01',
    key: 'ksiaz_forester_house',
    title: 'Książ forester’s house',
    way: 262236292,
    component: 'forester-house',
    brief:
      'Own jogged footprint with a steep red tiled roof, cream timber-framed main gable, side dormer, small entrance gable, shutters and two masonry chimneys.',
    primaryDescription:
      'Independent heritage house at Jeździecka 9. Exterior identity follows Gliwi’s 2016 photograph and the 2014 primary photograph linked in the mapped feature.',
    references: [
      'https://commons.wikimedia.org/wiki/File:Le%C5%9Bnicz%C3%B3wka_(Ksi%C4%85%C5%BC).jpg',
      'https://www.flickr.com/photos/124589265@N07/14162255536/',
    ],
    cameras: [
      { name: 'main-gable-and-shutters', position: [-20, 12, 25], lookAt: [-0.5, 5, 0] },
      { name: 'entrance-gable-and-dormer', position: [-27, 11, -12], lookAt: [-1, 4.5, 0] },
      { name: 'roof-and-own-footprint', position: [3, 38, 5], lookAt: [0, 3, 0] },
      { name: 'rear-gable-and-service-porch', position: [24, 12, -24], lookAt: [0, 4.5, 0] },
    ],
  },
];
export const ksiazServiceSurfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  rubble: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.92, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  glass: { slot: 'window', roughness: 0.35, metallic: 0.1 },
};
export const ksiazServicePalette = {
  wall: '#c4b398',
  cream: '#f1ead8',
  stone: '#d0c3aa',
  roof: '#cb8058',
  timber: '#6b5948',
  shutter: '#b58760',
  glass: '#536c7c',
};
const colors = Object.fromEntries(
  Object.entries(ksiazServicePalette).map(([k, hex]) => [
    k,
    hex
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const source = '../../../content/worldgen/source/places/u3/u35/ksiaz_forester_house/';
const frame = JSON.parse(readFileSync(new URL(`${source}map-frame.json`, import.meta.url)));
const means = JSON.parse(readFileSync(new URL(`${source}surface-means.json`, import.meta.url)));

function face(o, p, color, slot, target) {
  p = p.map((v) => v.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    let t = [p[0], p[i], p[i + 1]];
    const a = t[1].map((v, j) => v - t[0][j]),
      b = t[2].map((v, j) => v - t[0][j]);
    if (
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
      1e-9
    )
      continue;
    if (target && normalFor(...t).reduce((s, v, j) => s + v * target[j], 0) < 0)
      t = [t[0], t[2], t[1]];
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      normalFor(...t),
      t.map((v) => [v[0], v[1]]),
      colors[color],
    );
  }
}
function local(o, x, z, angle = 0) {
  const rotate = ([u, y, v]) => [
    Math.cos(angle) * u + Math.sin(angle) * v,
    y,
    -Math.sin(angle) * u + Math.cos(angle) * v,
  ];
  return {
    addTriangle: (s, r, p, n, uv, col) =>
      o.addTriangle(
        s,
        r,
        p.map((v) => {
          const q = rotate(v);
          return [q[0] + x, q[1], q[2] + z];
        }),
        rotate(n),
        uv,
        col,
      ),
  };
}
function box(o, x, y, z, w, h, depth, col = 'timber', slot = 'timber') {
  const a = x - w / 2,
    b = x + w / 2,
    u = z - depth / 2,
    v = z + depth / 2,
    t = y + h;
  for (const [p, n] of [
    [
      [
        [a, y, v],
        [b, y, v],
        [b, t, v],
        [a, t, v],
      ],
      [0, 0, 1],
    ],
    [
      [
        [b, y, u],
        [a, y, u],
        [a, t, u],
        [b, t, u],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, y, u],
        [a, y, v],
        [a, t, v],
        [a, t, u],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, y, v],
        [b, y, u],
        [b, t, u],
        [b, t, v],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, t, u],
        [b, t, u],
        [b, t, v],
        [a, t, v],
      ],
      [0, 1, 0],
    ],
  ])
    face(o, p, col, slot, n);
}
function panel(o, x, y, z, w, h, col, slot) {
  face(
    o,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    col,
    slot,
    [0, 0, 1],
  );
}
function beam(o, a, b, width = 0.18, z = 0.04) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dx = (((b[1] - a[1]) / length) * width) / 2,
    dy = ((-(b[0] - a[0]) / length) * width) / 2;
  face(
    o,
    [
      [a[0] - dx, a[1] - dy, z],
      [b[0] - dx, b[1] - dy, z],
      [b[0] + dx, b[1] + dy, z],
      [a[0] + dx, a[1] + dy, z],
    ],
    'timber',
    'timber',
    [0, 0, 1],
  );
}
function window(o, x, y, w, h, d, shutters = false) {
  panel(o, x, y, 0.032, w, h, 'glass', 'glass');
  if (d >= 2) {
    for (const u of [-w / 2, w / 2]) box(o, x + u, y - 0.04, 0.055, 0.12, h + 0.08, 0.12);
    for (const v of [y, y + h]) box(o, x, v - 0.06, 0.055, w + 0.12, 0.12, 0.12);
    if (shutters)
      for (const sign of [-1, 1])
        box(o, x + sign * (w / 2 + 0.32), y, 0.025, 0.49, h, 0.08, 'shutter');
  }
  if (d === 3) {
    box(o, x, y, 0.067, 0.075, h, 0.08);
    box(o, x, y + h * 0.55, 0.067, w, 0.075, 0.08);
  }
}
function clip(poly, axis, bound, greater) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      ai = greater ? a[axis] >= bound : a[axis] <= bound,
      bi = greater ? b[axis] >= bound : b[axis] <= bound;
    if (ai) result.push(a);
    if (ai !== bi) {
      const t = (bound - a[axis]) / (b[axis] - a[axis]);
      result.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return result;
}
function cap(o, poly, height, col, slot) {
  const ix = earcut(poly.flat());
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [poly[k][0], height(poly[k]), poly[k][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
function roofHeight(x) {
  return 3.45 + 7.35 * Math.max(0, 1 - Math.abs(x + 0.3) / 5.52);
}
function gable(o, width, bottom, top, d, windows = true) {
  const half = width / 2,
    upper = (x) => bottom + (top - bottom) * (1 - Math.abs(x) / half);
  face(
    o,
    [
      [-half, bottom, 0],
      [half, bottom, 0],
      [0, top, 0],
    ],
    'cream',
    'plaster',
    [0, 0, 1],
  );
  // One continuous timber strip per framing member; no individual textured cells.
  beam(o, [-half, bottom], [0, top], 0.24);
  beam(o, [0, top], [half, bottom], 0.24);
  beam(o, [-half, bottom], [half, bottom], 0.24);
  if (d >= 1) {
    beam(o, [0, bottom], [0, top - 0.2], 0.2);
    for (const y of [bottom + (top - bottom) * 0.28, bottom + (top - bottom) * 0.55]) {
      const w = half * (1 - (y - bottom) / (top - bottom));
      beam(o, [-w, y], [w, y], 0.19);
    }
    for (const x of [-half * 0.55, half * 0.55]) beam(o, [x, bottom], [x, upper(x) - 0.16], 0.17);
  }
  if (d >= 2) {
    const y = bottom + 0.3,
      h = (top - bottom) * 0.26,
      w = half * 0.53;
    for (const sign of [-1, 1]) beam(o, [sign * w, y], [0, y + h], 0.16);
  }
  if (windows && d >= 1) {
    window(o, 0, bottom + 0.6, 1.25, 1.6, d);
    if (top - bottom > 5.5) window(o, 0, bottom + 3.65, 0.85, 1.08, d);
  }
}
/** Secondary gable faces +Z in its own frame; roof runs back into the main roof. */
function projection(o, x, z, angle, width, depth, base, top, d, entry = false) {
  const q = local(o, x, z, angle),
    half = width / 2;
  if (entry) {
    panel(q, 0, 0, 0, width, base, 'cream', 'plaster');
    if (d >= 1) window(q, 0, 0.18, 1.25, 2.35, d);
    if (d >= 2) for (const u of [-half + 0.15, half - 0.15]) box(q, u, 0, 0.06, 0.23, base, 0.18);
  } else {
    panel(q, 0, base - 1.55, 0, width, 1.55, 'cream', 'plaster');
    if (d >= 1) window(q, 0, base - 1.4, 1.15, 1.22, d);
    if (d >= 2)
      for (const x of [-width / 2 + 0.1, width / 2 - 0.1])
        box(q, x, base - 1.55, 0.04, 0.18, 1.55, 0.12);
  }
  gable(q, width, base, top, d, false);
  for (const sign of [-1, 1]) {
    face(
      q,
      [
        [sign * (half + 0.18), base, 0.18],
        [0, top + 0.12, 0.18],
        [0, top + 0.12, -depth],
        [sign * (half + 0.18), base, -depth],
      ],
      'roof',
      'tile',
      [0, 1, 0],
    );
    if (!entry)
      face(
        q,
        [
          [sign * half, base - 1.55, 0],
          [sign * half, base, 0],
          [sign * half, base, -depth],
          [sign * half, base - 1.55, -depth],
        ],
        'cream',
        'plaster',
        [sign, 0, 0],
      );
  }
}
export function buildKsiazService(o, key, level = 'closeup') {
  if (key !== 'ksiaz_forester_house') throw Error(`Unknown service building ${key}`);
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  if (d === undefined) throw Error(`Unknown runtime level ${level}`);
  const loop = frame.geometry.outline.slice(0, -1),
    area = loop.reduce((sum, a, i) => {
      const b = loop[(i + 1) % loop.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0),
    sign = Math.sign(area);
  cap(o, loop, () => 0, 'stone', 'rubble');
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length],
      n = [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])];
    for (const [low, high, col, slot] of [
      [0, 0.35, 'stone', 'rubble'],
      [0.35, 3.2, 'wall', 'plaster'],
    ])
      face(
        o,
        [
          [a[0], low, a[1]],
          [b[0], low, b[1]],
          [b[0], high, b[1]],
          [a[0], high, a[1]],
        ],
        col,
        slot,
        n,
      );
    face(
      o,
      [
        [a[0], 3.2, a[1]],
        [b[0], 3.2, b[1]],
        [b[0], 3.45, b[1]],
        [a[0], 3.45, a[1]],
      ],
      'cream',
      'plaster',
      n,
    );
  }
  // Photographed roof ranges have continuous eaves that oversail the lower mapped recesses.
  // Ground walls retain all 17 map vertices; a tiny lower-wall jog is not a tall roof notch.
  const eaves = [
    [-5.82, -5.74],
    [5.22, -5.74],
    [5.22, 6.86],
    [-5.82, 6.86],
  ];
  for (const [left, right] of [
    [-5.82, -0.3],
    [-0.3, 5.22],
  ]) {
    const p = clip(clip(eaves, 0, left, true), 0, right, false);
    if (p.length >= 3) cap(o, p, (v) => roofHeight(v[0]), 'roof', 'tile');
  }
  // Photo-supported timber gables; map supplies the envelope, not their measured heights.
  for (const [z, angle] of [
    [6.653, 0],
    [-5.552, Math.PI],
  ]) {
    const q = local(o, -0.3, z, angle);
    panel(q, 0, 3.2, 0, 10.38, 0.69, 'cream', 'plaster');
    gable(q, 10.38, 3.89, 10.73, d);
    if (d >= 1) for (const x of [-3.05, 0, 3.05]) window(q, x, 1.02, 1.28, 1.55, d, angle === 0);
  }
  projection(o, -6.517, 4.35, -Math.PI / 2, 3.18, 2.2, 3.22, 5.8, d, true);
  projection(o, -4.85, -0.25, -Math.PI / 2, 2.75, 2.3, 6.05, 8.48, d);
  // Low rear service bay has its own short roof instead of a second tall main gable.
  projection(o, 6.52, -4.37, Math.PI / 2, 2.55, 2.4, 3.22, 4.8, d, true);
  face(
    o,
    [
      [-4.1, 3.5, -6.84],
      [-0.8, 3.5, -6.84],
      [-0.8, 4.1, -5.53],
      [-4.1, 4.1, -5.53],
    ],
    'roof',
    'tile',
    [0, 1, 0],
  );
  if (d >= 1) {
    for (const z of [-3.6, 1.25]) {
      const q = local(o, -5.565, z, -Math.PI / 2);
      window(q, 0, 1.03, 1.2, 1.5, d, true);
    }
    const q = local(o, 3.79, -0.9, Math.PI / 2);
    window(q, 0, 1.1, 1.2, 1.4, d);
  }
  // Both chimneys carry the roof silhouette at all distances.
  for (const [x, z, w, h] of [
    [0.2, -2.9, 0.72, 1.6],
    [3.3, 2.4, 0.66, 1.2],
  ]) {
    const y = roofHeight(x) - 0.1;
    box(o, x, y, z, w, h, 0.7, 'cream', 'plaster');
    if (d >= 2) box(o, x, y + h, z, w + 0.2, 0.17, 0.9, 'roof', 'tile');
  }
  if (d >= 2) {
    const q = local(o, -5.65, 2.15, -Math.PI / 2);
    // Open porch canopy and its two posts; no opaque infill between them.
    face(
      q,
      [
        [-0.85, 2.65, 0.82],
        [0.85, 2.65, 0.82],
        [0.85, 3.18, -0.35],
        [-0.85, 3.18, -0.35],
      ],
      'roof',
      'tile',
      [0, 1, 0],
    );
    for (const x of [-0.74, 0.74]) box(q, x, 0, 0.67, 0.17, 2.65, 0.17);
  }
}
export function buildKsiazServiceSkyline(o, key) {
  buildKsiazService(
    {
      addTriangle: (s, r, p, n, uv, col) =>
        o.addTriangle(
          'silhouette',
          r,
          p,
          n,
          uv,
          col.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    },
    key,
    'skyline',
  );
}
