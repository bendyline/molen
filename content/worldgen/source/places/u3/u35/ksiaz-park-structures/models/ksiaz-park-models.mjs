/** Own-footprint exterior recipes for two separate Książ park/service structures. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const ksiazParkModels = [
  {
    id: 'KSI_P01',
    key: 'ksiaz_hochberg_mausoleum',
    title: 'Hochberg mausoleum at Książ',
    way: 266177054,
    wikidata: 'Q30083059',
    component: 'mausoleum',
    brief:
      'Stepped octagonal cream-and-apricot pavilion with four circular windows, red mansard roof, sandstone surrounds and a roof cross.',
    references: [
      'https://www.bip.ksiaz.walbrzych.pl/wp-content/upLoads/2013/06/Za%C5%82%C4%85cznik-nr-10-Projekt-Budowlany-Mauzoleum-elewacja.pdf',
      'https://commons.wikimedia.org/wiki/File:Walbrzych_Hochberg_mausoleum_SE_2019.jpg',
      'https://www.labiryntarium.pl/5powiatow/powiat-walbrzyski/1584-mauzoleum-hochbergow.html',
      'https://www.ksiaz.walbrzych.pl/turystyka/zwiedzanie/dzienne',
    ],
    cameras: [
      { name: 'southeast-oculus', position: [19, 10, 20], lookAt: [0, 4, 0] },
      { name: 'entry-and-recessed-bay', position: [-19, 10, -20], lookAt: [0, 4, 0] },
      { name: 'roof-and-footprint', position: [0, 35, 5], lookAt: [0, 4, 0] },
      { name: 'window-and-cornice', position: [20, 8, 0], lookAt: [0, 4, 0] },
    ],
  },
  {
    id: 'KSI_P02',
    key: 'ksiaz_forge',
    title: 'Książ forge',
    way: 281941091,
    component: 'forge',
    brief:
      'L-shaped service building with rubble stone walls, brick upper band, two arched timber double doors, shallow roof and a tall masonry chimney.',
    references: ['https://www.flickr.com/photos/124589265@N07/14185032925/'],
    cameras: [
      { name: 'arched-door-court', position: [22, 7, 18], lookAt: [-4, 2, 2] },
      { name: 'outer-stone-walls', position: [-25, 12, -23], lookAt: [-1, 3, -1] },
      { name: 'roof-and-footprint', position: [0, 39, 6], lookAt: [0, 2, 0] },
      { name: 'portals-and-chimney', position: [22, 9, 7], lookAt: [-4, 3.5, 2] },
    ],
  },
];
export const ksiazParkSurfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
  cutStone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.88, metallic: 0 },
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.92, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.88, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.88, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.65 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  glass: { slot: 'window', roughness: 0.35, metallic: 0.1 },
};
export const ksiazParkPalette = {
  cream: '#f1e5c7',
  panel: '#e8b584',
  stone: '#dbccb0',
  roof: '#be7756',
  rubble: '#d0c3aa',
  brick: '#ce8e72',
  slate: '#798184',
  timber: '#af946b',
  weatheredTimber: '#685444',
  metal: '#738276',
  glass: '#536c7c',
};
const colors = Object.fromEntries(
  Object.entries(ksiazParkPalette).map(([k, hex]) => [
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
const frames = new Map(
  ksiazParkModels.map((m) => [
    m.key,
    JSON.parse(readFileSync(new URL(`../../${m.key}/map-frame.json`, import.meta.url))),
  ]),
);
const means = JSON.parse(
  readFileSync(new URL('../../ksiaz_hochberg_mausoleum/surface-means.json', import.meta.url)),
);
function face(o, p, color, slot, target) {
  p = p.map((v) => v.map(Math.fround));
  if (target && normalFor(...p.slice(0, 3)).reduce((a, n, i) => a + n * target[i], 0) < 0)
    p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => [v[0], v[1]]),
      colors[color],
    );
  }
}
function local(o, center, angle) {
  const rotate = ([x, y, z]) => [
    x * Math.cos(angle) + z * Math.sin(angle),
    y,
    -x * Math.sin(angle) + z * Math.cos(angle),
  ];
  return {
    addTriangle: (s, r, p, n, uv, col) =>
      o.addTriangle(
        s,
        r,
        p.map((v) => {
          const q = rotate(v);
          return [q[0] + center[0], q[1], q[2] + center[1]];
        }),
        rotate(n),
        uv,
        col,
      ),
  };
}
function box(o, x, y, z, w, h, depth, color, slot) {
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
    face(o, p, color, slot, n);
}
function winding(loop) {
  return Math.sign(
    loop.reduce((s, a, i) => {
      const b = loop[(i + 1) % loop.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
}
function cap(o, loop, height, color, slot, normal = [0, 1, 0]) {
  const ix = earcut(loop.flat());
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix
        .slice(i, i + 3)
        .map((k) => [
          loop[k][0],
          typeof height === 'function' ? height(loop[k]) : height,
          loop[k][1],
        ]),
      color,
      slot,
      normal,
    );
}
function facade(o, loop, i) {
  const a = loop[i],
    b = loop[(i + 1) % loop.length],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    sign = winding(loop),
    length = Math.hypot(dx, dz),
    nx = sign * dz,
    nz = -sign * dx;
  return { q: local(o, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], Math.atan2(nx, nz)), length };
}
function band(o, loop, bottom, top, color, slot) {
  for (let i = 0; i < loop.length; i++) {
    const { q, length } = facade(o, loop, i);
    face(
      q,
      [
        [-length / 2, bottom, 0],
        [length / 2, bottom, 0],
        [length / 2, top, 0],
        [-length / 2, top, 0],
      ],
      color,
      slot,
      [0, 0, 1],
    );
  }
}
function rectangle(o, x, y, z, w, h, color, slot) {
  face(
    o,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    color,
    slot,
    [0, 0, 1],
  );
}
function window(o, y, w, h, d) {
  rectangle(o, 0, y, 0.04, w, h, 'glass', 'glass');
  if (d >= 2) {
    for (const x of [-w / 2 - 0.12, w / 2 + 0.12])
      box(o, x, y - 0.15, 0.1, 0.24, h + 0.3, 0.18, 'stone', 'cutStone');
    for (const yy of [y - 0.18, y + h]) box(o, 0, yy, 0.1, w + 0.5, 0.2, 0.2, 'stone', 'cutStone');
    if (d === 3) {
      box(o, 0, y, 0.16, 0.1, h, 0.09, 'metal', 'metal');
      box(o, 0, y + h * 0.55, 0.16, w, 0.08, 0.09, 'metal', 'metal');
    }
  }
}
function oculus(o, y, radius, d) {
  const n = d < 2 ? 8 : d === 2 ? 14 : 24;
  const ring = (r, z) =>
    Array.from({ length: n }, (_, i) => [
      Math.cos((i * Math.PI * 2) / n) * r,
      y + Math.sin((i * Math.PI * 2) / n) * r,
      z,
    ]);
  face(o, ring(radius, 0.06), 'glass', 'glass', [0, 0, 1]);
  if (d >= 2) {
    const a = ring(radius, 0.09),
      b = ring(radius + 0.06, 0.17),
      c = ring(radius + 0.19, 0.17),
      edge = ring(radius + 0.22, 0.025);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      for (const [inside, outside] of [
        [a, b],
        [b, c],
        [c, edge],
      ])
        face(o, [inside[i], outside[i], outside[k], inside[k]], 'stone', 'cutStone', [0, 0, 1]);
    }
  }
  if (d === 3) {
    const center = ring(radius * 0.28, 0.117),
      tips = ring(radius, 0.117);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      const line = (a, b) => {
        const dx = b[0] - a[0],
          dy = b[1] - a[1],
          length = Math.hypot(dx, dy);
        const shift = [(-0.013 * dy) / length, (0.013 * dx) / length, 0];
        face(
          o,
          [a, b, b.map((v, j) => v + shift[j]), a.map((v, j) => v + shift[j])],
          'metal',
          'metal',
          [0, 0, 1],
        );
      };
      line(center[i], center[k]);
      if (i % 3 === 0) line(center[i], tips[i]);
    }
  }
}
function chapelStair(o, fit, detail) {
  const { width, depth, spring, toe } = fit;
  const levels = [
    { width, depth, height: toe },
    { width: width - 0.12, depth: depth - 0.09, height: toe + 0.045 },
    { width: width - 0.52, depth: depth - 0.42, height: -0.29 },
    { width: width - 0.96, depth: depth - 0.78, height: -0.145 },
    { width: width - 1.42, depth: depth - 1.13, height: 0 },
  ];
  const stride = detail < 2 ? 2 : 1;
  const rings = levels.map((step) => {
    const curve = [];
    for (let i = 0; i <= 12; i += stride) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 12;
      curve.push([
        (Math.sin(angle) * step.width) / 2,
        step.height,
        spring + Math.cos(angle) * (step.depth - spring),
      ]);
    }
    const a = curve[0],
      b = curve.at(-1);
    return [[a[0], a[1], -0.34], ...curve, [b[0], b[1], -0.34]];
  });
  // Render each tread only between adjacent risers, with a short grade join at the toe.
  for (let i = 1; i < rings.length; i++) {
    const outer = rings[i - 1],
      inner = rings[i];
    for (let j = 1; j < outer.length; j++) {
      const a = outer[j - 1],
        b = outer[j],
        c = inner[j],
        d = inner[j - 1];
      const u = [c[0], b[1], c[2]],
        v = [d[0], a[1], d[2]];
      face(o, [a, b, u, v], 'stone', 'cutStone', [0, 1, 0]);
      face(o, [v, u, c, d], 'stone', 'cutStone', [d[2] - c[2], 0, c[0] - d[0]]);
    }
  }
  cap(
    o,
    rings.at(-1).map(([x, , z]) => [x, z]),
    0,
    'stone',
    'cutStone',
  );
}
function chapelPortal(o, length, bodyHeight, detail) {
  const width = 1.38,
    height = 2.72,
    recess = -0.28;
  for (const sign of [-1, 1]) {
    rectangle(
      o,
      (sign * (length + width)) / 4,
      0.38,
      0,
      (length - width) / 2,
      bodyHeight - 0.38,
      'cream',
      'plaster',
    );
    rectangle(
      o,
      (sign * (length + width - 0.6)) / 4,
      0.65,
      0.025,
      (length - width - 0.6) / 2,
      height - 0.65,
      'panel',
      'plaster',
    );
    box(
      o,
      (sign * width) / 2,
      0,
      recess / 2,
      0.19,
      height + 0.04,
      -recess + 0.19,
      'stone',
      'cutStone',
    );
  }
  rectangle(o, 0, height, 0, width, bodyHeight - height, 'cream', 'plaster');
  rectangle(o, 0, height, 0.025, length - 0.6, 5.75 - height, 'panel', 'plaster');
  // The stone head spans the entire reveal. The dark double door sits behind the facade.
  box(o, 0, height - 0.03, recess / 2, 1.81, 0.22, -recess + 0.21, 'stone', 'cutStone');
  face(
    o,
    [
      [-0.8, height - 0.03, -0.38],
      [0.8, height - 0.03, -0.38],
      [0.8, height - 0.03, 0.1],
      [-0.8, height - 0.03, 0.1],
    ],
    'stone',
    'cutStone',
    [0, -1, 0],
  );
  rectangle(o, 0, -0.025, recess, width + 0.08, height + 0.12, 'weatheredTimber', 'timber');
  if (detail >= 2) {
    for (const x of [-0.32, 0.32]) {
      for (let panel = 0; panel < 4; panel++) {
        const y = 0.21 + 0.61 * panel;
        box(o, x, y, recess + 0.025, 0.46, 0.49, 0.055, 'timber', 'timber');
        box(o, x, y + 0.048, recess + 0.054, 0.36, 0.39, 0.042, 'weatheredTimber', 'timber');
      }
      box(o, x / 3, 1.14, recess + 0.095, 0.043, 0.065, 0.055, 'metal', 'metal');
    }
    const head = [
      [-0.86, 2.91],
      [-0.66, 2.95],
      [-0.36, 3.17],
      [0, 3.28],
      [0.36, 3.17],
      [0.66, 2.95],
      [0.86, 2.91],
    ];
    for (let i = 1; i < head.length; i++) {
      const [x0, y0] = head[i - 1],
        [x1, y1] = head[i];
      face(
        o,
        [
          [x0, 2.88, 0.135],
          [x1, 2.88, 0.135],
          [x1, y1, 0.135],
          [x0, y0, 0.135],
        ],
        'stone',
        'cutStone',
        [0, 0, 1],
      );
      face(
        o,
        [
          [x0, y0, 0.135],
          [x1, y1, 0.135],
          [x1, y1, 0.022],
          [x0, y0, 0.022],
        ],
        'stone',
        'cutStone',
        [0, 1, 0],
      );
    }
  }
}
function buildMausoleum(o, frame, d) {
  const loop = frame.geometry.outline.slice(0, -1),
    c = frame.controls;
  const { entrance, footingBottom } = frame.siteFit;
  const high = new Set([1, 5, 10, 14]),
    recess = new Set([3, 7, 12, 16]);
  // The attributed jogs form sixteen architectural faces; the NW collinear point is retained.
  for (let i = 0; i < loop.length; i++) {
    const { q, length } = facade(o, loop, i);
    const entry = i === c.entryFace;
    if (entry) {
      const baseWidth = (length - 1.38) / 2;
      for (const sign of [-1, 1])
        rectangle(
          q,
          (sign * (length - baseWidth)) / 2,
          footingBottom,
          0,
          baseWidth,
          0.38 - footingBottom,
          'stone',
          'sandstone',
        );
      rectangle(q, 0, footingBottom, 0, 1.38, -footingBottom, 'stone', 'sandstone');
      chapelPortal(q, length, c.bodyHeight, d);
      chapelStair(q, entrance, d);
    } else {
      rectangle(q, 0, footingBottom, 0, length, 0.38 - footingBottom, 'stone', 'sandstone');
      rectangle(q, 0, 0.38, 0, length, c.bodyHeight - 0.38, 'cream', 'plaster');
    }
    if (d >= 1 && length > 1.5 && !entry)
      rectangle(q, 0, 0.65, 0.025, Math.max(0.3, length - 0.6), 5.1, 'panel', 'plaster');
    if (d >= 1 && high.has(i)) {
      window(q, 1.05, 1.55, 2.65, d);
      window(q, 4.6, 0.82, 0.95, d);
      if (d >= 2) {
        const pediment = [
          [-1.2, 3.9, 0.14],
          [-0.7, 3.95, 0.14],
          [-0.38, 4.22, 0.14],
          [0.38, 4.22, 0.14],
          [0.7, 3.95, 0.14],
          [1.2, 3.9, 0.14],
          [1.2, 4.08, 0.14],
          [0.65, 4.18, 0.14],
          [0.36, 4.4, 0.14],
          [-0.36, 4.4, 0.14],
          [-0.65, 4.18, 0.14],
          [-1.2, 4.08, 0.14],
        ];
        const ix = earcut(pediment.flatMap((p) => p.slice(0, 2)));
        for (let k = 0; k < ix.length; k += 3)
          face(
            q,
            ix.slice(k, k + 3).map((j) => pediment[j]),
            'stone',
            'cutStone',
            [0, 0, 1],
          );
      }
    }
    if (d >= 1 && recess.has(i)) {
      oculus(q, 4.65, 0.7, d);
      if (!entry && d >= 2) {
        // Restored southeast bay is blind, not an invented lower window.
        for (const x of [-0.78, 0.78]) box(q, x, 0.8, 0.08, 0.2, 2.65, 0.18, 'stone', 'cutStone');
        for (const y of [0.8, 3.25]) box(q, 0, y, 0.08, 1.75, 0.2, 0.18, 'stone', 'cutStone');
      }
    }
  }
  // Joined loft over the actual stepped outline: four raised diagonal mansard bays.
  const eaves = loop.map(([x, z]) => [x * 1.035, z * 1.035]);
  band(o, eaves, 6.23, 6.4, 'cream', 'plaster');
  cap(o, eaves, 6.23, 'cream', 'plaster', [0, -1, 0]);
  const raised = new Set([0, 3, 4, 7, 8, 12, 13, 16]);
  const lower = loop.map(([x, z], i) => [x * 0.76, raised.has(i) ? 7.72 : 7.35, z * 0.76]);
  const upper = loop.map(([x, z]) => [x * 0.46, 8.42, z * 0.46]);
  for (let i = 0; i < loop.length; i++) {
    const k = (i + 1) % loop.length,
      a = eaves[i],
      b = eaves[k];
    face(o, [[a[0], 6.4, a[1]], [b[0], 6.4, b[1]], lower[k], lower[i]], 'roof', 'tile', [0, 1, 0]);
    face(o, [lower[i], lower[k], upper[k], upper[i]], 'roof', 'tile', [0, 1, 0]);
    face(o, [upper[i], upper[k], [0, 9.55, 0]], 'roof', 'tile', [0, 1, 0]);
  }
  if (d >= 1) {
    box(o, -2.3, 7.5, -2.1, 0.85, 1.8, 0.7, 'cream', 'plaster');
    if (d >= 2) {
      box(o, -2.3, 9.28, -2.1, 1.03, 0.18, 0.9, 'slate', 'slate');
      cap(
        o,
        [
          [-2.815, -2.55],
          [-1.785, -2.55],
          [-1.785, -1.65],
          [-2.815, -1.65],
        ],
        9.28,
        'slate',
        'slate',
        [0, -1, 0],
      );
    }
  }
  // Cross is part of the recognizable roof silhouette, retained in every level.
  box(o, 0, 9.5, 0, 0.16, 1.1, 0.16, 'metal', 'metal');
  box(o, 0, 10.1, 0, 0.68, 0.14, 0.14, 'metal', 'metal');
}
function archHeight(x, center, radius, spring) {
  return spring + Math.sqrt(Math.max(0, radius * radius - (x - center) * (x - center)));
}
function portal(o, center, width, d, floor, spring) {
  const r = width / 2,
    n = d < 2 ? 6 : 10,
    left = center - r,
    right = center + r;
  const points = [
    [left, floor + 0.08, -0.2],
    [right, floor + 0.08, -0.2],
    [right, spring, -0.2],
  ];
  for (let i = 1; i <= n; i++) {
    const a = (i * Math.PI) / n;
    points.push([center + r * Math.cos(a), spring + r * Math.sin(a), -0.2]);
  }
  face(o, points, 'weatheredTimber', 'timber', [0, 0, 1]);
  // Reveal returns seal the short distance from the wall opening to its recessed door.
  for (let i = 1; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    face(o, [[a[0], a[1], 0], [b[0], b[1], 0], b, a], 'stone', 'cutStone', [
      center - (a[0] + b[0]) / 2,
      spring - (a[1] + b[1]) / 2,
      0,
    ]);
  }
  face(
    o,
    [[left, floor + 0.08, 0], [right, floor + 0.08, 0], points[1], points[0]],
    'stone',
    'cutStone',
    [0, 1, 0],
  );
  // Upper grilles have a flat muted fill; door timber stops at the spring line.
  const top = [
    [left, spring, -0.1],
    [right, spring, -0.1],
    ...points.slice(3).map((p) => [p[0], p[1], -0.1]),
  ];
  face(o, top, 'glass', 'glass', [0, 0, 1]);
  if (d >= 2) {
    box(
      o,
      center,
      floor + 0.08,
      -0.1,
      0.12,
      spring - floor - 0.08,
      0.13,
      'weatheredTimber',
      'timber',
    );
    for (const x of [left - 0.15, right + 0.15])
      box(o, x, floor, 0.06, 0.3, spring - floor, 0.22, 'stone', 'cutStone');
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n + 0.006,
        b = ((i + 1) * Math.PI) / n - 0.006,
        ring = (t, rr) => [center + rr * Math.cos(t), spring + rr * Math.sin(t), 0.08];
      face(
        o,
        [ring(a, r), ring(a, r + 0.3), ring(b, r + 0.3), ring(b, r)],
        'stone',
        'cutStone',
        [0, 0, 1],
      );
    }
  }
  if (d === 3)
    for (let i = 1; i < 6; i++) {
      const x = left + (width * i) / 6,
        h = archHeight(x, center, r, spring) - spring;
      box(o, x, spring, -0.015, 0.06, h, 0.06, 'metal', 'metal');
    }
}
function portalWall(o, length, openings, d, entries) {
  const intervals = openings
    .map(([x, w], i) => ({
      left: x - w / 2,
      right: x + w / 2,
      x,
      w,
      floor: entries?.[i]?.floor ?? 0,
    }))
    .sort((a, b) => a.left - b.left);
  let cursor = -length / 2;
  for (const p of intervals) {
    rectangle(o, (cursor + p.left) / 2, 0, 0, p.left - cursor, 4.3, 'rubble', 'rubble');
    rectangle(o, p.x, 0, 0, p.w, p.floor + 0.08, 'rubble', 'rubble');
    const n = d < 2 ? 6 : 10;
    const spring = p.floor + 1.82;
    // Wall triangles end at the arch: there is no opaque wall behind the recessed doors.
    for (let i = 0; i < n; i++) {
      const a = p.x - (p.w / 2) * Math.cos((i * Math.PI) / n),
        b = p.x - (p.w / 2) * Math.cos(((i + 1) * Math.PI) / n);
      face(
        o,
        [
          [a, archHeight(a, p.x, p.w / 2, spring), 0],
          [b, archHeight(b, p.x, p.w / 2, spring), 0],
          [b, 4.3, 0],
          [a, 4.3, 0],
        ],
        'rubble',
        'rubble',
        [0, 0, 1],
      );
    }
    portal(o, p.x, p.w, d, p.floor, spring);
    cursor = p.right;
  }
  rectangle(o, (cursor + length / 2) / 2, 0, 0, length / 2 - cursor, 4.3, 'rubble', 'rubble');
}
function forgeApron(o, entry) {
  const { center, angle, apronWidth, depth, floor, toe } = entry;
  const q = local(o, center, angle);
  const left = -apronWidth / 2;
  const right = apronWidth / 2;
  const a = [left, floor + 0.08, -0.015];
  const b = [right, floor + 0.08, -0.015];
  const c = [right, toe[1] + 0.008, depth];
  const d = [left, toe[0] + 0.008, depth];
  face(q, [a, b, c, d], 'stone', 'cutStone', [0, 1, 0]);
  for (const [start, end, normal] of [
    [a, d, [-1, 0, 0]],
    [b, c, [1, 0, 0]],
    [d, c, [0, 0, 1]],
  ])
    face(
      q,
      [start, end, [end[0], end[1] - 0.26, end[2]], [start[0], start[1] - 0.26, start[2]]],
      'stone',
      'cutStone',
      normal,
    );
}
function buildForge(o, frame, d) {
  const loop = frame.geometry.outline.slice(0, -1),
    c = frame.controls;
  for (let i = 0; i < loop.length; i++) {
    const { q, length } = facade(o, loop, i);
    if (i === c.portalWall && d >= 1) portalWall(q, length, c.portals, d, frame.siteFit?.entrances);
    else rectangle(q, 0, 0, 0, length, 4.3, 'rubble', 'rubble');
    rectangle(q, 0, 3.72, 0.02, length, 0.58, 'brick', 'brick');
    if (d >= 2) box(q, 0, 4.25, 0.045, length, 0.12, 0.18, 'slate', 'slate');
  }
  if (frame.siteFit) {
    band(o, loop, frame.siteFit.footingBottom, 0, 'rubble', 'rubble');
    cap(o, loop, frame.siteFit.footingBottom, 'rubble', 'rubble', [0, -1, 0]);
    for (const entry of frame.siteFit.entrances) forgeApron(o, entry);
  }
  const height = ([x, z]) => 4.35 + 0.06 * Math.min(x + 10.2, z + 10.1);
  // A concave L roof, not an envelope rectangle that closes the courtyard.
  cap(o, loop, height, 'slate', 'slate');
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length],
      sign = winding(loop);
    face(
      o,
      [
        [a[0], 4.3, a[1]],
        [b[0], 4.3, b[1]],
        [b[0], height(b), b[1]],
        [a[0], height(a), a[1]],
      ],
      'brick',
      'brick',
      [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
    );
  }
  box(o, c.chimney[0], 4.2, c.chimney[1], 0.85, 3.4, 0.85, 'rubble', 'rubble');
  if (d >= 2) box(o, c.chimney[0], 7.6, c.chimney[1], 1.06, 0.22, 1.06, 'stone', 'sandstone');
}
export function buildKsiazPark(o, key, level = 'closeup') {
  const frame = frames.get(key),
    d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  if (!frame) throw Error(`Unknown Książ park component ${key}`);
  if (d === undefined) throw Error(`Unknown runtime level ${level}`);
  if (key === 'ksiaz_forge') buildForge(o, frame, d);
  else buildMausoleum(o, frame, d);
}
export function buildKsiazParkSkyline(o, key) {
  buildKsiazPark(
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
