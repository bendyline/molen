/** Two independently mapped Swiss houses: plaster pavilions with mansard hips and oval dormers. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const ksiazSwissModels = [
  {
    id: 'KSI_S02',
    key: 'ksiaz_swiss_house_i',
    title: 'Książ Swiss House I',
    way: 255269521,
    component: 'swiss-houses',
    number: '44',
    brief:
      'Cream plaster pavilion with pink blind panels, tiled mansard, oval dormer and paired side rooflights. A recessed door leads to a short stone landing.',
    primaryDescription:
      'Individual heritage house at Wałbrzyska 44, NID A/5052/1215/WŁ. Exterior identity follows Irena Goderska’s primary photograph dated 2012-07-28.',
    references: [
      'https://zabytek.pl/pl/obiekty/g-240579',
      'https://commons.wikimedia.org/wiki/File:PL,_%C5%9Awiebodzice_dom_szwajcarski_44_DSC_0015.JPG',
      'https://www.labiryntarium.pl/7gmin/gminaswiebodzice/698-spacerkiemdoksiaza.html',
    ],
    cameras: [
      { name: 'oval-dormer-and-blind-panels', position: [16, 10, 16], lookAt: [0, 3.4, 0] },
      { name: 'side-portal-and-mansard-break', position: [16, 10, -16], lookAt: [0, 3.4, 0] },
      { name: 'roof-and-own-footprint', position: [2, 25, 3], lookAt: [0, 3, 0] },
      { name: 'rear-and-hipped-roof', position: [-16, 10, -16], lookAt: [0, 3.4, 0] },
      { name: 'paired-rooflights-from-lion-gate', position: [-14, 5, 12], lookAt: [0, 3.4, 0] },
    ],
  },
  {
    id: 'KSI_S03',
    key: 'ksiaz_swiss_house_ii',
    title: 'Książ Swiss House II',
    way: 255269530,
    component: 'swiss-houses',
    number: '46',
    brief:
      'Cream plaster pavilion with pink blind panels, tiled mansard, road-facing oval dormer, eyebrow rooflight and a timber porch over the gate-side entrance.',
    primaryDescription:
      'Individual heritage house at Wałbrzyska 46, NID A/5053/1214/WŁ. The 2012 and trail photographs show the oval dormer, eyebrow rooflight and timber porch. Parcel fences remain separate.',
    references: [
      'https://zabytek.pl/pl/obiekty/g-221860',
      'https://commons.wikimedia.org/wiki/File:PL,_%C5%9Awiebodzice_dom_szwajcarski_46_DSC_0017.JPG',
      'https://www.labiryntarium.pl/7gmin/gminaswiebodzice/698-spacerkiemdoksiaza.html',
    ],
    cameras: [
      { name: 'oval-dormer-and-blind-panels', position: [-16, 9, -14], lookAt: [0, 3.4, 0] },
      { name: 'eyebrow-rooflight-and-portal', position: [-14, 7, 10], lookAt: [0, 3.4, 0] },
      { name: 'roof-and-own-footprint', position: [2, 25, 3], lookAt: [0, 3, 0] },
      { name: 'rear-and-hipped-roof', position: [16, 10, -16], lookAt: [0, 3.4, 0] },
    ],
  },
];
export const ksiazSwissSurfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  rubble: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.92, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.88, metallic: 0 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  cutStone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.88, metallic: 0 },
  glass: { slot: 'window', roughness: 0.35, metallic: 0.1 },
};
export const ksiazSwissPalette = {
  wall: '#f0e9d0',
  panel: '#eed9ce',
  trim: '#f2edda',
  stone: '#d0c3aa',
  roof: '#ce8161',
  brick: '#c78d72',
  fascia: '#8b6d57',
  door: '#ac8968',
  glass: '#536c7c',
};
const colors = Object.fromEntries(
  Object.entries(ksiazSwissPalette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const frames = new Map(
  ksiazSwissModels.map((m) => [
    m.key,
    JSON.parse(readFileSync(new URL(`../../${m.key}/map-frame.json`, import.meta.url))),
  ]),
);
const means = JSON.parse(
  readFileSync(new URL('../../ksiaz_swiss_house_i/surface-means.json', import.meta.url)),
);
function face(o, p, col, slot, target) {
  p = p.map((v) => v.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    let t = [p[0], p[i], p[i + 1]],
      a = t[1].map((v, j) => v - t[0][j]),
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
      colors[col],
    );
  }
}
function local(o, center, angle) {
  const r = ([x, y, z]) => [
    x * Math.cos(angle) + z * Math.sin(angle),
    y,
    -x * Math.sin(angle) + z * Math.cos(angle),
  ];
  return {
    addTriangle: (s, ref, p, n, uv, col) =>
      o.addTriangle(
        s,
        ref,
        p.map((v) => {
          const q = r(v);
          return [q[0] + center[0], q[1], q[2] + center[1]];
        }),
        r(n),
        uv,
        col,
      ),
  };
}
function box(o, x, y, z, w, h, depth, col = 'trim', slot = 'plaster') {
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
function polygon(o, loop, height, col, slot, normal = [0, 1, 0]) {
  const ix = earcut(loop.flat());
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [loop[k][0], height, loop[k][1]]),
      col,
      slot,
      normal,
    );
}
function winding(loop) {
  return Math.sign(
    loop.reduce((s, a, i) => {
      const b = loop[(i + 1) % loop.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
}
function facade(o, loop, i) {
  const a = loop[i],
    b = loop[(i + 1) % loop.length],
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    s = winding(loop);
  return {
    q: local(o, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], Math.atan2(s * dz, -s * dx)),
    length: Math.hypot(dx, dz),
  };
}
function band(o, loop, y, h, col, slot) {
  for (let i = 0; i < loop.length; i++) {
    const { q, length } = facade(o, loop, i);
    face(
      q,
      [
        [-length / 2, y, 0],
        [length / 2, y, 0],
        [length / 2, y + h, 0],
        [-length / 2, y + h, 0],
      ],
      col,
      slot,
      [0, 0, 1],
    );
  }
}
function window(o, x, d) {
  face(
    o,
    [
      [x - 0.46, 1.02, 0.025],
      [x + 0.46, 1.02, 0.025],
      [x + 0.46, 2.55, 0.025],
      [x - 0.46, 2.55, 0.025],
    ],
    'glass',
    'glass',
    [0, 0, 1],
  );
  if (d >= 2) {
    for (const u of [-0.57, 0.57]) box(o, x + u, 0.88, 0.075, 0.2, 1.85, 0.15);
    for (const y of [0.88, 2.55]) box(o, x, y, 0.075, 1.35, 0.17, 0.15);
  }
  if (d === 3) {
    box(o, x, 1.02, 0.095, 0.065, 1.53, 0.08);
    box(o, x, 1.75, 0.095, 0.92, 0.065, 0.08);
  }
}
/** Quarter-circle cuts at the upper blind-panel corners, as photographed. */
function panelLoop(x, width) {
  const a = x - width / 2,
    b = x + width / 2,
    lo = 0.36,
    hi = 2.88,
    r = 0.18;
  return [
    [a, lo],
    [b, lo],
    [b, hi - r],
    [b - r * 0.6, hi - r * 0.6],
    [b - r, hi],
    [a + r, hi],
    [a + r * 0.6, hi - r * 0.6],
    [a, hi - r],
  ];
}
function blindPanel(o, x, width, d) {
  const p = panelLoop(x, width),
    ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [...p[k], 0.02]),
      'panel',
      'plaster',
      [0, 0, 1],
    );
  if (d >= 2)
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        l = Math.hypot(dx, dy),
        nx = (-dy / l) * 0.045,
        ny = (dx / l) * 0.045;
      face(
        o,
        [
          [a[0] - nx, a[1] - ny, 0.04],
          [b[0] - nx, b[1] - ny, 0.04],
          [b[0] + nx, b[1] + ny, 0.04],
          [a[0] + nx, a[1] + ny, 0.04],
        ],
        'trim',
        'plaster',
        [0, 0, 1],
      );
    }
}
function curve(half, bottom, raise, steps) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const x = -half + (2 * half * i) / steps;
    return [x, bottom + raise * Math.cos((Math.PI * x) / (2 * half))];
  });
}
function ovalDormer(o, d) {
  const q = local(o, [0, -0.68], 0),
    steps = d < 2 ? 6 : 10,
    roof = curve(1.03, 5.98, 0.39, steps),
    outer = [[-1.03, 4.3], [1.03, 4.3], ...roof.toReversed()],
    n = d < 2 ? 8 : 12,
    hole = Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return [0.36 * Math.cos(a), 5.52 + 0.56 * Math.sin(a)];
    }),
    all = [...outer, ...hole],
    indices = earcut(all.flat(), [outer.length], 2);
  for (let i = 0; i < indices.length; i += 3)
    face(
      q,
      indices.slice(i, i + 3).map((k) => [...all[k], 0]),
      'wall',
      'plaster',
      [0, 0, 1],
    );
  face(
    q,
    hole.map((p) => [...p, -0.12]),
    'glass',
    'glass',
    [0, 0, 1],
  );
  for (let i = 0; i < hole.length; i++) {
    const a = hole[i],
      b = hole[(i + 1) % hole.length];
    face(
      q,
      [
        [...a, 0],
        [...b, 0],
        [...b, -0.12],
        [...a, -0.12],
      ],
      'trim',
      'plaster',
      [-(a[0] + b[0]) / 2, 5.52 - (a[1] + b[1]) / 2, 0],
    );
    if (d >= 2) {
      const enlarged = (p) => [p[0] * 1.22, 5.52 + (p[1] - 5.52) * 1.15, 0.045];
      face(
        q,
        [[...a, 0.045], enlarged(a), enlarged(b), [...b, 0.045]],
        'trim',
        'plaster',
        [0, 0, 1],
      );
    }
  }
  for (let i = 1; i < roof.length; i++) {
    const a = roof[i - 1],
      b = roof[i],
      back = (p) => [p[0], 5.91 + (p[1] - 5.98) * 0.75, -1.64];
    face(
      q,
      [[a[0], a[1] + 0.12, 0.16], [b[0], b[1] + 0.12, 0.16], back(b), back(a)],
      'roof',
      'tile',
      [0, 1, 0],
    );
    if (d >= 1)
      face(
        q,
        [
          [a[0], a[1] - 0.09, 0.02],
          [b[0], b[1] - 0.09, 0.02],
          [b[0], b[1] + 0.12, 0.02],
          [a[0], a[1] + 0.12, 0.02],
        ],
        'trim',
        'plaster',
        [0, 0, 1],
      );
  }
  for (const sign of [-1, 1])
    face(
      q,
      [
        [sign * 1.03, 4.3, 0],
        [sign * 1.03, 5.98, 0],
        [sign * 1.03, 5.91, -1.64],
        [sign * 1.03, 4.3, -1.64],
      ],
      'wall',
      'plaster',
      [sign, 0, 0],
    );
  if (d === 3) {
    box(q, 0, 4.96, -0.07, 0.065, 1.12, 0.07);
    box(q, 0, 5.52, -0.07, 0.72, 0.065, 0.07);
  }
}
function eyebrow(o, d) {
  const q = local(o, [0, -0.43], 0),
    p = curve(0.62, 4.95, 0.35, d < 2 ? 6 : 10);
  face(
    q,
    [[-0.62, 4.95, 0], [0.62, 4.95, 0], ...p.toReversed().map((v) => [...v, 0])],
    'glass',
    'glass',
    [0, 0, 1],
  );
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      back = (v) => [v[0] * 0.9, 5.26, -0.9];
    face(
      q,
      [[a[0], a[1] + 0.1, 0.12], [b[0], b[1] + 0.1, 0.12], back(b), back(a)],
      'roof',
      'tile',
      [0, 1, 0],
    );
    if (d >= 2)
      face(
        q,
        [
          [...a, 0.02],
          [...b, 0.02],
          [b[0], b[1] + 0.1, 0.02],
          [a[0], a[1] + 0.1, 0.02],
        ],
        'fascia',
        'timber',
        [0, 0, 1],
      );
  }
}
function wallPanel(o, left, right, low, high, z, color, slot) {
  face(
    o,
    [
      [left, low, z],
      [right, low, z],
      [right, high, z],
      [left, high, z],
    ],
    color,
    slot,
    [0, 0, 1],
  );
}
function portal(o, d, length, bodyHeight, base, floor) {
  const half = 0.55,
    head = 2.47,
    recess = -0.23;
  for (const [left, right] of [
    [-length / 2, -half],
    [half, length / 2],
  ]) {
    wallPanel(o, left, right, base, 0.3, 0, 'stone', 'rubble');
    wallPanel(o, left, right, 0.3, bodyHeight, 0, 'wall', 'plaster');
  }
  wallPanel(o, -half, half, base, floor, 0, 'stone', 'rubble');
  wallPanel(o, -half, half, head, bodyHeight, 0, 'wall', 'plaster');
  for (const sign of [-1, 1]) {
    const x = sign * half;
    face(
      o,
      [
        [x, floor, 0],
        [x, floor, recess],
        [x, head, recess],
        [x, head, 0],
      ],
      'trim',
      'plaster',
      [-sign, 0, 0],
    );
  }
  face(
    o,
    [
      [-half, head, recess],
      [half, head, recess],
      [half, head, 0],
      [-half, head, 0],
    ],
    'trim',
    'plaster',
    [0, -1, 0],
  );
  wallPanel(o, -half - 0.01, half + 0.01, floor - 0.01, head + 0.02, recess, 'door', 'timber');
  if (d >= 2) {
    for (const side of [-1, 1]) {
      const x = side * 0.275;
      for (const y of [floor + 0.24, floor + 1.14])
        box(o, x, y, recess + 0.02, 0.4, 0.72, 0.055, 'fascia', 'timber');
      if (d === 3)
        box(o, side * 0.065, floor + 0.95, recess + 0.04, 0.036, 0.063, 0.06, 'fascia', 'timber');
    }
  }
  const p = curve(1.24, 3.68, 0.48, d < 2 ? 6 : 10);
  face(
    o,
    [[-1.24, 3.2, 0.11], [1.24, 3.2, 0.11], ...p.toReversed().map((v) => [...v, 0.11])],
    'trim',
    'plaster',
    [0, 0, 1],
  );
  if (d >= 2) {
    for (const x of [-0.64, 0.64]) box(o, x, floor, 0.065, 0.18, head - floor + 0.15, 0.13);
    box(o, 0, head, 0.065, 1.5, 0.19, 0.13);
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1],
        b = p[i];
      face(
        o,
        [
          [...a, 0.12],
          [...b, 0.12],
          [b[0], b[1] + 0.09, 0.12],
          [a[0], a[1] + 0.09, 0.12],
        ],
        'trim',
        'plaster',
        [0, 0, 1],
      );
    }
  }
}
function stoneLanding(o, { width, depth, floor, toe }, base) {
  const half = width / 2;
  const at = (x, y, z) => [x * half, Array.isArray(y) ? y[(x + 1) / 2] : y, z];
  const rows = [
    [depth, toe],
    [depth - 0.16, toe.map((y) => y + 0.045)],
    [depth - 0.55, toe.map((y) => y + 0.045)],
    [depth - 0.55, floor - 0.15],
    [depth - 0.92, floor - 0.15],
    [depth - 0.92, floor],
    [-0.29, floor],
  ];
  for (let i = 1; i < rows.length; i++) {
    const [z0, y0] = rows[i - 1],
      [z1, y1] = rows[i];
    face(
      o,
      [at(-1, y0, z0), at(1, y0, z0), at(1, y1, z1), at(-1, y1, z1)],
      'stone',
      'cutStone',
      z0 === z1 ? [0, 0, 1] : [0, 1, 0],
    );
    if (z0 !== z1)
      for (const sign of [-1, 1])
        face(
          o,
          [at(sign, base, z0), at(sign, base, z1), at(sign, y1, z1), at(sign, y0, z0)],
          'stone',
          'cutStone',
          [sign, 0, 0],
        );
  }
}
function porch(o, detail, base) {
  const w = 1.34,
    rise = 3.26,
    eave = 2.91,
    depth = 1.42;
  face(
    o,
    [
      [-w, eave, depth],
      [w, eave, depth],
      [w, rise, 0],
      [-w, rise, 0],
    ],
    'roof',
    'tile',
    [0, 1, 0],
  );
  face(
    o,
    [
      [-w, eave - 0.12, depth],
      [w, eave - 0.12, depth],
      [w, rise - 0.12, 0],
      [-w, rise - 0.12, 0],
    ],
    'fascia',
    'timber',
    [0, -1, 0],
  );
  box(o, 0, eave - 0.22, depth - 0.065, 2 * w, 0.22, 0.13, 'fascia', 'timber');
  for (const sign of [-1, 1]) {
    const x = sign * 1.12;
    box(o, x, base, depth - 0.18, 0.35, 0.24 - base, 0.36, 'stone', 'cutStone');
    box(o, x, 0.12, depth - 0.18, 0.16, eave - 0.19, 0.17, 'door', 'timber');
    face(
      o,
      [
        [sign * w, eave, depth],
        [sign * w, rise, 0],
        [sign * w, rise - 0.12, 0],
        [sign * w, eave - 0.12, depth],
      ],
      'fascia',
      'timber',
      [sign, 0, 0],
    );
    if (detail >= 2) box(o, x, 0.32, 0.5, 0.1, 2.32, 0.95, 'door', 'timber');
  }
}
export function buildKsiazSwiss(o, key, level = 'closeup') {
  const f = frames.get(key),
    d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  if (!f) throw Error(`Unknown Swiss house ${key}`);
  if (d === undefined) throw Error(`Unknown runtime level ${level}`);
  const loop = f.geometry.outline.slice(0, -1),
    c = f.controls;
  const {
    footingBottom,
    entrances: [entrance],
  } = f.siteFit;
  const decor = loop.filter((a, i) => {
    const b = loop[(i + loop.length - 1) % loop.length],
      p = loop[(i + 1) % loop.length],
      u = [a[0] - b[0], a[1] - b[1]],
      v = [p[0] - a[0], p[1] - a[1]];
    return Math.abs(u[0] * v[1] - u[1] * v[0]) / (Math.hypot(...u) * Math.hypot(...v)) > 0.02;
  });
  for (let i = 0; i < decor.length; i++) {
    const { q, length } = facade(o, decor, i);
    if (i === c.entryWall) {
      portal(q, d, length, c.bodyHeight, footingBottom, entrance.floor);
      stoneLanding(q, entrance, footingBottom);
      if (key === 'ksiaz_swiss_house_ii') porch(q, d, footingBottom);
    } else {
      wallPanel(q, -length / 2, length / 2, footingBottom, 0.3, 0, 'stone', 'rubble');
      wallPanel(q, -length / 2, length / 2, 0.3, c.bodyHeight, 0, 'wall', 'plaster');
    }
    if (d >= 1) {
      if (i === c.entryWall) {
        window(q, -length * 0.33, d);
        window(q, length * 0.33, d);
      } else {
        window(q, 0, d);
        blindPanel(q, -length * 0.31, length * 0.29, d);
        blindPanel(q, length * 0.31, length * 0.29, d);
      }
    }
    if (d >= 2) {
      for (const x of [-length / 2 + 0.12, length / 2 - 0.12])
        box(q, x, 0.3, 0.06, 0.24, 3.08, 0.12);
      box(q, 0, 3.2, 0.035, length, 0.17, 0.18);
    }
  }
  const crown = decor.map((p) => p.map((v) => v * 1.032));
  band(o, crown, c.bodyHeight - 0.025, c.eaveHeight - c.bodyHeight + 0.025, 'trim', 'plaster');
  polygon(o, crown, c.bodyHeight - 0.025, 'trim', 'plaster', [0, -1, 0]);
  const lower = decor.map((p) => p.map((v) => v * 1.065)),
    upper = decor.map((p) => p.map((v) => v * 0.62)),
    top = decor.map(([x, z]) => [Math.sign(x) * 0.45, Math.sign(z) * 0.15]);
  for (let i = 0; i < decor.length; i++) {
    const j = (i + 1) % decor.length,
      { length } = facade(o, decor, i);
    // The side cornice raises the actual eave; it must not poke through a straight roof.
    const steps = d < 2 ? 6 : 10,
      params =
        i === c.entryWall
          ? [0, ...curve(1.24, 0, 0, steps).map((p) => p[0] / length + 0.5), 1]
          : [0, 1],
      rise = (t) =>
        i === c.entryWall && Math.abs((t - 0.5) * length) <= 1.24
          ? 0.48 * Math.cos((Math.PI * (t - 0.5) * length) / (2 * 1.24))
          : 0,
      lerp = (ring, t) => ring[i].map((v, k) => v + (ring[j][k] - v) * t);
    for (let k = 1; k < params.length; k++) {
      const a = params[k - 1],
        b = params[k],
        la = lerp(lower, a),
        lb = lerp(lower, b),
        ua = lerp(upper, a),
        ub = lerp(upper, b),
        wa = lerp(crown, a),
        wb = lerp(crown, b),
        ya = c.eaveHeight + rise(a),
        yb = c.eaveHeight + rise(b);
      face(
        o,
        [
          [la[0], ya, la[1]],
          [lb[0], yb, lb[1]],
          [ub[0], c.mansardBreakHeight, ub[1]],
          [ua[0], c.mansardBreakHeight, ua[1]],
        ],
        'roof',
        'tile',
        [0, 1, 0],
      );
      face(
        o,
        [
          [wa[0], ya, wa[1]],
          [wb[0], yb, wb[1]],
          [lb[0], yb, lb[1]],
          [la[0], ya, la[1]],
        ],
        'trim',
        'plaster',
        [0, -1, 0],
      );
      if (ya > c.eaveHeight + 0.001 || yb > c.eaveHeight + 0.001) {
        const sign = winding(decor);
        face(
          o,
          [
            [wa[0], c.eaveHeight, wa[1]],
            [wb[0], c.eaveHeight, wb[1]],
            [wb[0], yb, wb[1]],
            [wa[0], ya, wa[1]],
          ],
          'trim',
          'plaster',
          [sign * (wb[1] - wa[1]), 0, -sign * (wb[0] - wa[0])],
        );
      }
    }
    face(
      o,
      [
        [upper[i][0], c.mansardBreakHeight, upper[i][1]],
        [upper[j][0], c.mansardBreakHeight, upper[j][1]],
        [top[j][0], c.ridgeHeight, top[j][1]],
        [top[i][0], c.ridgeHeight, top[i][1]],
      ],
      'roof',
      'tile',
      [0, 1, 0],
    );
  }
  polygon(o, top, c.ridgeHeight, 'roof', 'tile');
  if (d >= 2) band(o, upper, c.mansardBreakHeight - 0.1, 0.17, 'fascia', 'timber');
  const front = facade(o, decor, c.mainDormerWall).q;
  ovalDormer(front, d);
  if (d >= 1)
    for (const rooflight of c.sideRooflights) {
      const { q } = facade(o, decor, rooflight.edge);
      for (const x of rooflight.offsets) eyebrow(local(q, [x, 0], 0), d);
    }
  box(o, 0.15, c.ridgeHeight - 0.1, -0.12, 0.68, 0.65, 0.62, 'brick', 'brick');
  if (d >= 2) box(o, 0.15, c.ridgeHeight + 0.55, -0.12, 0.84, 0.13, 0.78, 'brick', 'brick');
}
export function buildKsiazSwissSkyline(o, key) {
  buildKsiazSwiss(
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
