/** Original medium-fi exteriors interpreted from the four individual NID survey cards. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const ksiazPalmServiceModels = [
  {
    id: 'KSI_L02',
    key: 'ksiaz_palm_administration',
    title: 'Lubiechów Palm House administration',
    way: 263010003,
    component: 'administration',
    record: 'g-259451',
    card: '224651',
    brief:
      'Own office outline with southern extension, broken hip roof, east oculus pediment and balcony, west arched pediment and pale pilasters.',
  },
  {
    id: 'KSI_L03',
    key: 'ksiaz_palm_utility',
    title: 'Lubiechów Palm House utility building',
    way: 396950371,
    component: 'utility-building',
    record: 'g-259452',
    card: '224655',
    brief:
      'Both connected mapped ranges, long tiled roof, half-timbered upper east band, taller polygonal south end, boarded gable, dormers and square brick chimney.',
  },
  {
    id: 'KSI_L04',
    key: 'ksiaz_palm_residence',
    title: 'Lubiechów Palm House residence',
    way: 232185882,
    component: 'residence',
    record: 'g-212551',
    card: '224659',
    brief:
      'Own jogged residential footprint and west annex, broken red roof, timbered east gable and north/south cross-gables, stone base and three chimneys.',
  },
  {
    id: 'KSI_L05',
    key: 'ksiaz_palm_boiler_range',
    title: 'Lubiechów Palm House boiler and north service range',
    way: 263010002,
    component: 'boiler-building',
    record: 'g-268933',
    card: '224644',
    brief:
      'Own north service range with low flanking wings, central timbered boiler gable, polygonal stair oriel, red tile roof and two square brick stacks.',
  },
].map((m) => ({
  ...m,
  primaryDescription:
    'Independent official NID building record, 1994-01-15 survey-card photographs and drawings, and the numbered ensemble plan. Current restoration and dimensional/terrain survey remain pending.',
  references: [
    `https://zabytek.pl/en/obiekty/${m.record}`,
    `https://zabytek.pl/en/obiekty/${m.record}/dokumenty/PL.1.9.ZIPOZ.NID_N_02_EN.${m.card}/1`,
  ],
  cameras:
    m.component === 'boiler-building'
      ? [
          { name: 'north-timber-gable-and-oriel', position: [-26, 17, -30], lookAt: [0, 6, 0] },
          { name: 'boiler-stacks-and-north-range', position: [70, 35, -58], lookAt: [0, 5, 0] },
          { name: 'own-north-range-footprint', position: [0, 125, 14], lookAt: [0, 0, 0] },
          { name: 'south-service-side', position: [-63, 24, 48], lookAt: [0, 4, 0] },
        ]
      : m.component === 'utility-building'
        ? [
            { name: 'east-timber-range-and-south-end', position: [36, 17, 42], lookAt: [0, 5, 1] },
            { name: 'south-gable-and-chimney', position: [-19, 15, 35], lookAt: [0, 6, 14] },
            { name: 'both-mapped-ranges-and-roofs', position: [3, 72, 14], lookAt: [0, 1, 0] },
            {
              name: 'west-dormers-and-service-facade',
              position: [-35, 18, -27],
              lookAt: [0, 4, 0],
            },
          ]
        : [
            { name: 'east-primary-facade', position: [32, 14, 22], lookAt: [0, 4, 0] },
            { name: 'north-roof-and-cross-gable', position: [-24, 17, -28], lookAt: [0, 4, 0] },
            { name: 'own-footprint-and-roof', position: [3, 51, 10], lookAt: [0, 1, 0] },
            { name: 'west-service-side', position: [-29, 13, 25], lookAt: [0, 4, 0] },
          ],
}));
export const ksiazPalmServiceSurfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  rubble: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.92, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.91, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.9, metallic: 0 },
  glass: { slot: 'window', roughness: 0.58, metallic: 0.04 },
};
export const ksiazPalmServicePalette = {
  wall: '#e8dfc5',
  cream: '#f1ead8',
  ochre: '#d2bd86',
  stone: '#c4b091',
  roof: '#a5644b',
  timber: '#6b5948',
  board: '#927453',
  brick: '#b78362',
  glass: '#536a7b',
};
const colors = Object.fromEntries(
  Object.entries(ksiazPalmServicePalette).map(([k, h]) => [
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
const source = '../../';
const frames = new Map(
  ksiazPalmServiceModels.map((m) => [
    m.key,
    JSON.parse(readFileSync(new URL(`${source}${m.key}/map-frame.json`, import.meta.url))),
  ]),
);
const means = JSON.parse(
  readFileSync(
    new URL(`${source}${ksiazPalmServiceModels[0].key}/surface-means.json`, import.meta.url),
  ),
);
function face(o, p, col, slot, target) {
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
      colors[col],
    );
  }
}
function local(o, x, z, angle = 0) {
  const rot = ([u, y, v]) => [
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
          const q = rot(v);
          return [q[0] + x, q[1], q[2] + z];
        }),
        rot(n),
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
function panel(o, x, y, z, w, h, col = 'cream', slot = 'plaster') {
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
function beam(o, a, b, width = 0.18, z = 0.075, col = 'timber', slot = 'timber') {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (l < 1e-6) return;
  const dx = (((b[1] - a[1]) / l) * width) / 2,
    dy = ((-(b[0] - a[0]) / l) * width) / 2;
  face(
    o,
    [
      [a[0] - dx, a[1] - dy, z],
      [b[0] - dx, b[1] - dy, z],
      [b[0] + dx, b[1] + dy, z],
      [a[0] + dx, a[1] + dy, z],
    ],
    col,
    slot,
    [0, 0, 1],
  );
}
function window(o, x, y, w, h, d) {
  panel(o, x, y, 0.043, w, h, 'glass', 'glass');
  if (d >= 2) {
    for (const u of [-w / 2, w / 2])
      box(o, x + u, y - 0.045, 0.079, 0.12, h + 0.09, 0.12, 'cream', 'plaster');
    for (const v of [y, y + h])
      box(o, x, v - 0.06, 0.079, w + 0.12, 0.12, 0.12, 'cream', 'plaster');
  }
  if (d === 3) {
    box(o, x, y, 0.105, 0.07, h, 0.08, 'cream', 'plaster');
    box(o, x, y + h * 0.56, 0.105, w, 0.07, 0.08, 'cream', 'plaster');
  }
}
function disc(o, x, y, rx, ry, d, half = false) {
  const n = d < 2 ? 8 : 12,
    p = [];
  if (half) p.push([x, y, 0.065]);
  for (let i = 0; i <= n; i++) {
    const a = ((half ? Math.PI : 2 * Math.PI) * i) / n;
    p.push([x + rx * Math.cos(a), y + ry * Math.sin(a), 0.065]);
  }
  face(o, p, 'glass', 'glass', [0, 0, 1]);
  if (d >= 2)
    for (let i = 1; i < p.length; i++) beam(o, p[i - 1], p[i], 0.12, 0.12, 'cream', 'plaster');
}
function clip(poly, axis, bound, greater) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      ai = greater ? a[axis] >= bound : a[axis] <= bound,
      bi = greater ? b[axis] >= bound : b[axis] <= bound;
    if (ai) out.push(a);
    if (ai !== bi) {
      const t = (bound - a[axis]) / (b[axis] - a[axis]);
      out.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return out;
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
function wallSpan(o, a, b, low, high, col, slot, normal, doors) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  if (length < 1e-6) return;
  const at = (t) => [a[0] + dx * t, a[1] + dz * t];
  const height = typeof high === 'function' ? high : () => high;
  const band = (t0, t1, bottom, top) => {
    if (t1 - t0 < 1e-6) return;
    const u = at(t0),
      v = at(t1);
    face(
      o,
      [
        [u[0], bottom, u[1]],
        [v[0], bottom, v[1]],
        [v[0], top(v), v[1]],
        [u[0], top(u), u[1]],
      ],
      col,
      slot,
      normal,
    );
  };
  const openings = doors
    .flatMap((door) => {
      const [x, z] = door.center.map((v, i) => v - a[i]);
      if (Math.abs(x * dz - z * dx) / length > 0.001) return [];
      const center = (x * dx + z * dz) / length;
      const start = Math.max(0, (center - door.width / 2) / length);
      const end = Math.min(1, (center + door.width / 2) / length);
      return start < end ? [{ ...door, start, end }] : [];
    })
    .sort((u, v) => u.start - v.start);
  let cursor = 0;
  for (const door of openings) {
    band(cursor, door.start, low, height);
    if (door.sill > low) band(door.start, door.end, low, () => door.sill);
    band(door.start, door.end, door.head, height);
    cursor = door.end;
  }
  band(cursor, 1, low, height);
}
function walls(o, poly, low, high, col, slot, doors = []) {
  const sign = Math.sign(
    poly.reduce((s, a, i) => {
      const b = poly[(i + 1) % poly.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    wallSpan(
      o,
      a,
      b,
      low,
      high,
      col,
      slot,
      [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
      doors,
    );
  }
}
function shell(o, poly, bottom, eave, col = 'wall', doors = []) {
  walls(o, poly, bottom, 0.35, 'stone', 'rubble');
  walls(o, poly, 0.35, eave, col, 'plaster', doors);
}
function splitRoof(o, poly, axis, cuts, height, bottom, doors = []) {
  walls(o, poly, bottom, 0.35, 'stone', 'rubble');
  const lo = Math.min(...poly.map((p) => p[axis])) - 1,
    hi = Math.max(...poly.map((p) => p[axis])) + 1,
    edges = [lo, ...cuts.filter((v) => v > lo && v < hi).sort((a, b) => a - b), hi];
  for (let i = 1; i < edges.length; i++) {
    const p = clip(clip(poly, axis, edges[i - 1], true), axis, edges[i], false);
    if (p.length >= 3) {
      cap(o, p, height, 'roof', 'tile');
    }
  }
  // Roof breakpoints must also divide the perimeter walls. A single quad cannot close a peaked end.
  const sign = Math.sign(
    poly.reduce((s, a, i) => {
      const b = poly[(i + 1) % poly.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      params = [0, 1];
    for (const c of cuts) {
      const t = (c - a[axis]) / (b[axis] - a[axis]);
      if (t > 0 && t < 1) params.push(t);
    }
    params.sort((a, b) => a - b);
    for (let j = 1; j < params.length; j++) {
      const p = params[j - 1],
        q = params[j],
        u = a.map((v, k) => v + (b[k] - v) * p),
        v = a.map((w, k) => w + (b[k] - w) * q);
      wallSpan(
        o,
        u,
        v,
        0.35,
        height,
        'wall',
        'plaster',
        [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
        doors,
      );
    }
  }
}
function facade(o, poly, i) {
  const a = poly[i],
    b = poly[(i + 1) % poly.length],
    sign = Math.sign(
      poly.reduce((s, p, j) => {
        const q = poly[(j + 1) % poly.length];
        return s + p[0] * q[1] - q[0] * p[1];
      }, 0),
    ),
    normal = [sign * (b[1] - a[1]), -sign * (b[0] - a[0])];
  return {
    q: local(o, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(normal[0], normal[1])),
    length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    normal,
  };
}
function openings(o, poly, d, rows = [1.15], bay = 3.7, doors = []) {
  if (d < 1) return;
  for (let i = 0; i < poly.length; i++) {
    const { q, length } = facade(o, poly, i);
    if (length < 2.2) continue;
    const n = Math.max(1, Math.floor(length / bay));
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n,
        x = (t - 0.5) * length;
      const [px, pz] = a.map((v, k) => v + (b[k] - v) * t);
      for (const y of rows) {
        if (
          doors.some(
            (door) =>
              y < door.head &&
              y + 1.45 > door.sill &&
              Math.hypot(px - door.center[0], pz - door.center[1]) < door.width / 2 + 0.55,
          )
        )
          continue;
        window(q, x, y, 1.05, y < 1 ? 0.65 : 1.45, d);
      }
    }
  }
}
function recessedDoor(o, door, d, glazed = false) {
  const { center, angle, width, sill, head, recess } = door;
  const q = local(o, ...center, angle),
    edge = width / 2;
  for (const x of [-edge, edge])
    face(
      q,
      [
        [x, sill, 0],
        [x, sill, -recess],
        [x, head, -recess],
        [x, head, 0],
      ],
      'cream',
      'plaster',
      [-Math.sign(x), 0, 0],
    );
  face(
    q,
    [
      [-edge, head, 0],
      [edge, head, 0],
      [edge, head, -recess],
      [-edge, head, -recess],
    ],
    'cream',
    'plaster',
    [0, -1, 0],
  );
  panel(q, 0, sill, -recess, width, head - sill, 'board', 'timber');
  if (d >= 1) {
    for (const x of [-edge + 0.04, edge - 0.04, 0])
      box(q, x, sill, -recess + 0.06, 0.08, head - sill, 0.09);
    if (glazed)
      for (const x of [-edge / 2, edge / 2])
        panel(q, x, sill + 1.05, -recess + 0.08, edge - 0.16, head - sill - 1.21, 'glass', 'glass');
  }
}
function entrance(o, fit, d, glazed = false) {
  const door = fit.entry;
  const { depth, threshold, nearWidth, width, toeHeights } = fit.apron;
  const q = local(o, ...door.center, door.angle);
  recessedDoor(o, door, d, glazed);
  const at = (z, y) => {
    const w = (nearWidth + ((width - nearWidth) * (z + 0.16)) / (depth + 0.16)) / 2;
    return [
      [-w, y[0], z],
      [w, y[1], z],
    ];
  };
  const low = toeHeights.map((v) => v - 0.008);
  const heel = at(-0.16, [door.sill, door.sill]),
    stepTop = at(threshold, [door.sill, door.sill]);
  const stepBottom = at(threshold, low),
    toe = at(depth, toeHeights);
  const tread = (a, b) => face(q, [...a, b[1], b[0]], 'stone', 'paving', [0, 1, 0]);
  tread(heel, stepTop);
  // The threshold reaches the door leaf inside the wall, beyond the external approach polygon.
  const back = [
    [-door.width / 2, door.sill, -door.recess],
    [door.width / 2, door.sill, -door.recess],
  ];
  tread(back, heel);
  tread(stepBottom, toe);
  face(q, [...stepBottom, stepTop[1], stepTop[0]], 'stone', 'paving', [0, 0, 1]);
  for (const [a, b] of [
    [heel, stepTop],
    [stepBottom, toe],
  ])
    for (const i of [0, 1])
      face(
        q,
        [a[i], b[i], [b[i][0], fit.footingBottom, b[i][2]], [a[i][0], fit.footingBottom, a[i][2]]],
        'stone',
        'paving',
        [i === 0 ? -1 : 1, 0, 0],
      );
  face(
    q,
    [...toe, [toe[1][0], fit.footingBottom, depth], [toe[0][0], fit.footingBottom, depth]],
    'stone',
    'paving',
    [0, 0, 1],
  );
}
function framing(q, width, low, high, d, diagonal = true) {
  // Continuous solid plaster behind the sparse framing prevents open-looking upper storeys.
  panel(q, 0, low, 0.025, width, high - low);
  for (const y of [low, high]) beam(q, [-width / 2, y], [width / 2, y], 0.23);
  const n = Math.max(2, Math.round(width / 2.1));
  for (let j = 0; j <= n; j++) {
    const x = -width / 2 + (j * width) / n;
    beam(q, [x, low], [x, high], 0.19);
  }
  if (d >= 1 && diagonal)
    for (let j = 0; j < n; j += 2) {
      const a = -width / 2 + (j * width) / n,
        b = a + width / n;
      beam(q, [a, low + 0.1], [b, high - 0.1], 0.17);
      if (d >= 2) beam(q, [a, high - 0.1], [b, low + 0.1], 0.17);
    }
}
function gable(q, width, base, top, d, board = false) {
  face(
    q,
    [
      [-width / 2, base, 0.025],
      [width / 2, base, 0.025],
      [0, top, 0.025],
    ],
    board ? 'board' : 'cream',
    board ? 'timber' : 'plaster',
    [0, 0, 1],
  );
  beam(q, [-width / 2, base], [0, top], 0.22);
  beam(q, [0, top], [width / 2, base], 0.22);
  beam(q, [-width / 2, base], [width / 2, base], 0.22);
  if (d >= 1) {
    const spacing = board ? (d === 3 ? 0.46 : 0.8) : 2;
    for (let x = -width / 2 + spacing; x < width / 2; x += spacing) {
      const y = base + (top - base) * (1 - Math.abs(x) / (width / 2));
      beam(q, [x, base], [x, y - 0.07], board ? 0.06 : 0.18);
    }
  }
}
function projection(o, x, z, angle, width, back, base, top, d, board = false, classical = false) {
  const q = local(o, x, z, angle);
  panel(q, 0, 3.55, 0, width, base - 3.55);
  if (classical)
    face(
      q,
      [
        [-width / 2, base, 0.025],
        [width / 2, base, 0.025],
        [0, top, 0.025],
      ],
      'ochre',
      'plaster',
      [0, 0, 1],
    );
  else gable(q, width, base, top, d, board);
  for (const sign of [-1, 1]) {
    face(
      q,
      [
        [(sign * width) / 2, 3.55, 0],
        [(sign * width) / 2, base, 0],
        [(sign * width) / 2, base, -back],
        [(sign * width) / 2, 3.55, -back],
      ],
      'cream',
      'plaster',
      [sign, 0, 0],
    );
    face(
      q,
      [
        [sign * (width / 2 + 0.12), base, 0.18],
        [0, top + 0.09, 0.18],
        [0, top + 0.09, -back],
        [sign * (width / 2 + 0.12), base, -back],
      ],
      'roof',
      'tile',
      [0, 1, 0],
    );
  }
  return q;
}
function hip(o, rect, eave, brk, ridge) {
  const { minX: a, maxX: b, minZ: u, maxZ: v } = rect,
    cx = (a + b) / 2,
    cz = (u + v) / 2,
    outer = [
      [a, u],
      [b, u],
      [b, v],
      [a, v],
    ],
    middle = [
      [a + 2, u + 2],
      [b - 2, u + 2],
      [b - 2, v - 2],
      [a + 2, v - 2],
    ],
    top = [
      [cx - 1.3, cz - 0.1],
      [cx + 1.3, cz - 0.1],
      [cx + 1.3, cz + 0.1],
      [cx - 1.3, cz + 0.1],
    ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      o,
      [
        [...outer[i].slice(0, 1), eave, outer[i][1]],
        [outer[j][0], eave, outer[j][1]],
        [middle[j][0], brk, middle[j][1]],
        [middle[i][0], brk, middle[i][1]],
      ],
      'roof',
      'tile',
      [0, 1, 0],
    );
    face(
      o,
      [
        [middle[i][0], brk, middle[i][1]],
        [middle[j][0], brk, middle[j][1]],
        [top[j][0], ridge, top[j][1]],
        [top[i][0], ridge, top[i][1]],
      ],
      'roof',
      'tile',
      [0, 1, 0],
    );
  }
  cap(o, top, () => ridge, 'roof', 'tile');
}
function administration(o, f, d) {
  const c = f.controls,
    fit = f.siteFit,
    loop = f.geometry.outline.slice(0, -1),
    main = clip(loop, 1, c.annexZ, false),
    annex = clip(loop, 1, c.annexZ, true);
  const core = clip(main, 0, -6.72, true),
    westPorch = clip(main, 0, -6.72, false);
  shell(o, core, fit.footingBottom, c.eave, 'ochre', [fit.entry]);
  shell(o, westPorch, fit.footingBottom, 3.45, 'ochre');
  cap(o, westPorch, () => 3.45, 'roof', 'tile');
  shell(o, annex, fit.footingBottom, c.annexRoof, 'ochre');
  cap(o, annex, () => c.annexRoof, 'roof', 'tile');
  hip(o, { minX: -7.0, maxX: 8.05, minZ: -8.85, maxZ: 3.38 }, c.eave, c.break, c.ridge);
  openings(o, main, d, [1.2], 3.7, [fit.entry]);
  openings(o, annex, d, [1.0]);
  for (const [x, angle, west] of [
    [7.76, Math.PI / 2, false],
    [-6.73, -Math.PI / 2, true],
  ]) {
    const q = projection(o, x, -2.4, angle, 6.35, 3.6, 7.12, 9.35, d, false, true);
    // Classical pediments have plaster trim rather than Fachwerk borders.
    beam(q, [-3.25, 7.08], [0, 9.45], 0.22, 0.14, 'cream', 'plaster');
    beam(q, [0, 9.45], [3.25, 7.08], 0.22, 0.14, 'cream', 'plaster');
    beam(q, [-3.25, 7.08], [3.25, 7.08], 0.23, 0.14, 'cream', 'plaster');
    for (const u of [-2.8, 2.8]) box(q, u, 0.35, 0.12, 0.49, 6.77, 0.2, 'cream', 'plaster');
    if (d >= 1) {
      window(q, -1.65, 4.5, 1.1, 1.65, d);
      window(q, 1.65, 4.5, 1.1, 1.65, d);
      if (west) {
        window(q, 0, 5.12, 1.65, 1.6, d);
        disc(q, 0, 6.72, 0.82, 0.66, d, true);
      } else {
        window(q, 0, 4.02, 1.15, 2.22, d);
        disc(q, 0, 8.02, 0.47, 0.47, d);
      }
    }
    if (!west) {
      box(q, 0, 3.92, 0.64, 6.25, 0.22, 1.55, 'cream', 'plaster');
      for (const u of [-2.7, 2.7]) box(q, u, 0.35, 1.2, 0.43, 3.57, 0.35, 'cream', 'plaster');
      if (d >= 1) {
        window(q, -1.8, 0.9, 1.7, 2.35, d);
        for (const y of [4.18, 5.12]) box(q, 0, y, 1.37, 6.05, 0.09, 0.09);
        for (const u of [-2.9, -1.45, 0, 1.45, 2.9]) box(q, u, 4.13, 1.37, 0.09, 1.05, 0.09);
      }
    }
  }
  // Eyelid dormers, roof stacks and the photographed northern/southern roof-level windows.
  if (d >= 1)
    for (const [z, angle] of [
      [-8.61, Math.PI],
      [3.13, 0],
    ]) {
      const q = local(o, 0.3, z, angle);
      for (const x of [-3.55, 0, 3.55]) {
        panel(q, x, 4.52, -0.08, 1.0, 1.25);
        window(q, x, 4.58, 0.78, 1.12, d);
      }
    }
  for (const x of [-2.5, 3.1]) {
    box(o, x, 7.7, -2.0, 0.8, 2.0, 0.75, 'brick', 'brick');
    if (d >= 2) box(o, x, 9.7, -2.0, 0.98, 0.16, 0.95, 'cream', 'plaster');
  }
  entrance(o, fit, d, true);
}
function utility(o, f, d) {
  const c = f.controls,
    fit = f.siteFit,
    main = f.geometry.outline.slice(0, -1),
    south = f.geometry.components[0].outline.slice(0, -1),
    center = -0.62,
    h = (p) => c.eave + (c.ridge - c.eave) * Math.max(0, 1 - Math.abs(p[0] - center) / 4.8),
    hs = (p) =>
      c.southEave + (c.southRidge - c.southEave) * Math.max(0, 1 - Math.abs(p[0] - 0.75) / 5.0);
  for (const [p, height, cuts] of [
    [main, h, [center]],
    [south, hs, [0.75]],
  ]) {
    splitRoof(o, p, 0, cuts, height, fit.footingBottom, [fit.entry]);
    openings(o, p, d, [1.08], 3.7, [fit.entry]);
  }
  // Continuous upper east timber band follows the actual sloping mapped side.
  for (let i = 0; i < main.length; i++) {
    const { q, length, normal } = facade(o, main, i);
    if (length > 15) {
      framing(q, length, 3.1, 4.62, d, normal[0] > 0);
      if (d >= 1)
        for (let u = -length / 2 + 2; u < length / 2; u += 4) window(q, u, 3.33, 0.7, 0.92, d);
    }
  }
  // The south end is a polygon, not a flat gable plane inside its mapped shell.
  // Attach timber and boarding to each outward mapped segment so masonry cannot hide it.
  for (let i = 0; i < south.length; i++) {
    const { q, length, normal } = facade(o, south, i);
    if (normal[1] <= 0 || length < 1.6) continue;
    framing(q, length, 3.5, 5.55, d);
    panel(q, 0, 0.35, 0.03, length, 3.08, 'stone', 'rubble');
    const a = south[i],
      b = south[(i + 1) % south.length];
    const params = [0, 1],
      t = (0.75 - a[0]) / (b[0] - a[0]);
    if (t > 0 && t < 1) params.push(t);
    params.sort((u, v) => u - v);
    const height = (u) => hs(a.map((v, k) => v + (b[k] - v) * u));
    for (let j = 1; j < params.length; j++) {
      const u = params[j - 1],
        v = params[j];
      face(
        q,
        [
          [(u - 0.5) * length, 5.6, 0.035],
          [(v - 0.5) * length, 5.6, 0.035],
          [(v - 0.5) * length, height(v), 0.035],
          [(u - 0.5) * length, height(u), 0.035],
        ],
        'board',
        'timber',
        [0, 0, 1],
      );
    }
    if (d >= 1) {
      for (let x = -length / 2 + 0.55; x < length / 2; x += d === 3 ? 0.48 : 0.85) {
        beam(q, [x, 5.6], [x, height(x / length + 0.5) - 0.08], 0.06);
      }
      window(q, 0, 4.0, Math.min(0.9, length * 0.42), 1.2, d);
      window(q, 0, 0.9, Math.min(0.8, length * 0.38), 1.1, d);
    }
  }
  const eastEdge = south[0],
    eastNext = south[1],
    eastFacade = facade(o, south, 0),
    eastNormal = Math.atan2(eastFacade.normal[0], eastFacade.normal[1]);
  const cross = projection(
    o,
    (eastEdge[0] + eastNext[0]) / 2,
    (eastEdge[1] + eastNext[1]) / 2,
    eastNormal,
    4.3,
    5.1,
    6.05,
    9.5,
    d,
    true,
  );
  framing(cross, 4.15, 3.55, 6.0, d);
  if (d >= 1) {
    window(cross, -1.4, 0.9, 0.9, 1.6, d);
    window(cross, 0, 0.9, 0.9, 1.6, d);
    window(cross, 1.4, 0.6, 0.9, 2.0, d);
    window(cross, 0, 4.0, 1.1, 1.5, d);
  }
  box(o, -1.7, 6.0, 13.2, 1.22, c.chimneyTop - 6.0, 1.06, 'brick', 'brick');
  if (d >= 2) box(o, -1.7, c.chimneyTop, 13.2, 1.43, 0.2, 1.24, 'brick', 'brick');
  if (d >= 1)
    for (const z of [11.2, 15.6]) {
      const q = projection(o, -3.48, z, -Math.PI / 2, 1.4, 1.6, 6.4, 7.28, d);
      window(q, 0, 5.0, 0.9, 1.23, d);
    }
  entrance(o, fit, d);
}
function westStair(o, fit, d) {
  const { leftX, rightX, z0, z1, landingZ, landingWidth, steps, upper, toeY } = fit.westAccess;
  const low = Math.max(...toeY),
    run = (z1 - z0) / steps,
    rise = (upper.sill - low) / steps;
  const x = (leftX + rightX) / 2,
    width = rightX - leftX;
  for (let i = 0; i < steps; i++) {
    const z = z0 + i * run,
      y = low + (i + 1) * rise;
    box(o, x, y - 0.13, z + run / 2, width, 0.13, run, 'board', 'timber');
    if (i > 0) box(o, x, y - rise - 0.025, z + 0.007, width, rise + 0.025, 0.035, 'timber');
  }
  // The sloping strings run down to the yard, with the first tread supported by stone.
  for (const u of [leftX + 0.065, rightX - 0.065]) {
    const q = local(o, u, 0, Math.PI / 2);
    beam(q, [-z0, low - 0.14], [-z1, upper.sill - 0.14], 0.24, 0, 'timber');
    if (d >= 1) {
      beam(q, [-z0, low + 0.98], [-z1, upper.sill + 0.98], 0.09, 0, 'timber');
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        box(o, u, low + (upper.sill - low) * t, z0 + (z1 - z0) * t, 0.09, 0.99, 0.09);
      }
    }
  }
  box(
    o,
    x,
    fit.footingBottom,
    z0 + run / 2,
    width,
    low + rise - 0.13 - fit.footingBottom,
    run,
    'stone',
    'rubble',
  );
  const edge = upper.center[0] + upper.recess;
  const front = landingZ + landingWidth / 2;
  box(
    o,
    (leftX + edge) / 2,
    upper.sill - 0.12,
    (z1 + front) / 2,
    edge - leftX,
    0.12,
    front - z1,
    'board',
    'timber',
  );
  if (d >= 1) {
    for (const u of [leftX + 0.065, rightX - 0.065, edge - 0.32]) {
      box(o, u, upper.sill, front - 0.055, 0.09, 1.0, 0.09);
    }
    box(
      o,
      (leftX + edge - 0.25) / 2,
      upper.sill + 0.94,
      front - 0.055,
      edge - 0.25 - leftX,
      0.09,
      0.09,
    );
    box(o, leftX + 0.065, upper.sill + 0.94, (front + z1) / 2, 0.09, 0.09, front - z1);
  }
  recessedDoor(o, upper, d, true);
}
function residence(o, f, d) {
  const c = f.controls,
    fit = f.siteFit,
    p = f.geometry.outline.slice(0, -1),
    annex = f.geometry.components[0].outline.slice(0, -1),
    cz = -0.86,
    roof = (v) => {
      const dist = Math.abs(v[1] - cz);
      return dist > 3.4
        ? c.eave + (c.break - c.eave) * Math.max(0, 1 - (dist - 3.4) / 3.5)
        : c.ridge - ((c.ridge - c.break) * dist) / 3.4;
    };
  const doors = [fit.entry, fit.westAccess.upper];
  splitRoof(o, p, 1, [cz - 3.4, cz, cz + 3.4], roof, fit.footingBottom, doors);
  openings(o, p, d, [1.2], 3.7, doors);
  shell(o, annex, fit.footingBottom, c.annexRoof);
  cap(o, annex, () => c.annexRoof, 'roof', 'tile');
  openings(o, annex, d, [1.0]);
  const east = local(o, 9.8, cz, Math.PI / 2);
  framing(east, 10.9, 3.55, 6.5, d);
  gable(east, 10.9, 6.5, 10.34, d, true);
  if (d >= 1) {
    for (const x of [-3.55, 0, 3.55]) window(east, x, 4.2, 1.03, 1.6, d);
    window(east, 0, 8.15, 0.8, 1.14, d);
  }
  for (const [z, angle] of [
    [-5.9, Math.PI],
    [5.63, 0],
  ]) {
    const q = projection(o, 1.7, z, angle, 5.8, 4.0, 6.55, 9.7, d, true);
    framing(q, 5.65, 3.55, 6.52, d);
    if (d >= 1) {
      for (const x of [-1.28, 1.28]) window(q, x, 4.3, 0.8, 1.5, d);
      window(q, 0, 1.2, 0.9, 1.5, d);
    }
  }
  for (const x of [-3.6, 1.6, 7.9]) {
    box(o, x, 9.2, cz, 0.73, 2.0, 0.67, 'brick', 'brick');
    if (d >= 2) box(o, x, 11.2, cz, 0.92, 0.15, 0.85, 'brick', 'brick');
  }
  entrance(o, fit, d);
  westStair(o, fit, d);
}
function boiler(o, f, d) {
  const c = f.controls,
    fit = f.siteFit,
    p = f.geometry.outline.slice(0, -1),
    b = c.boiler,
    cx = (b.minX + b.maxX) / 2,
    half = (b.maxX - b.minX) / 2,
    roof = (v) => c.eave + (c.ridge - c.eave) * Math.max(0, 1 - Math.abs(v[0] - cx) / half),
    center = clip(clip(p, 0, b.minX, true), 0, b.maxX, false);
  for (const poly of [clip(p, 0, b.minX, false), clip(p, 0, b.maxX, true)]) {
    shell(o, poly, fit.footingBottom, c.wingRoof, 'ochre');
    cap(o, poly, () => c.wingRoof, 'cream', 'plaster');
    openings(o, poly, d, [1.02], 5.0);
  }
  splitRoof(o, center, 0, [cx], roof, fit.footingBottom);
  openings(o, center, d, [1.0], 4.0);
  const north = local(o, cx, b.minZ, Math.PI);
  gable(north, half * 2, c.eave, c.ridge, d);
  for (const y of [5.25, 6.65]) {
    const w = half * (1 - (y - c.eave) / (c.ridge - c.eave));
    beam(north, [-w, y], [w, y], 0.23);
  }
  if (d >= 1)
    for (const x of [-6, -3.5, 2.4, 4.9]) {
      const y = 3.96,
        top = Math.min(6.4, roof([cx + x + 1.1, 0]) - 0.2);
      if (top > y + 0.5) beam(north, [x, y], [x + 1.1, top], 0.22);
    }
  if (d >= 1) {
    for (const x of [-5.8, -2.9, 2.9, 5.8]) {
      const top = roof([cx + x, 0]);
      if (top > 4.95) window(north, x, 4.08, 0.86, 1.1, d);
    }
    for (const x of [-5.5, 4.8]) window(north, x, 1.2, 1.05, 1.5, d);
  }
  // Source-specific half-round stair oriel. It is an interpreted attachment, not a mapped independent ring.
  const arc = [
    0,
    Math.PI / 6,
    Math.PI / 3,
    Math.PI / 2 - 0.342,
    Math.PI / 2 + 0.342,
    (2 * Math.PI) / 3,
    (5 * Math.PI) / 6,
    Math.PI,
  ].map((a) => [Math.cos(a) * 1.38, Math.sin(a) * 1.32]);
  const oriel = local(o, cx, b.minZ, Math.PI);
  cap(oriel, arc, () => 3.8, 'cream', 'plaster');
  walls(oriel, arc, fit.footingBottom, 0.35, 'stone', 'rubble');
  walls(oriel, arc, 0.35, 3.8, 'wall', 'plaster', [{ ...fit.entry, center: [0, arc[3][1]] }]);
  walls(oriel, arc, 3.8, 7.45, 'cream', 'plaster');
  for (let i = 0; i < arc.length - 1; i++) {
    const { q, length } = facade(oriel, arc, i);
    framing(q, length, 3.8, 7.35, d, false);
    if (d >= 1) window(q, 0, 4.6, length * 0.66, 1.53, d);
  }
  for (let i = 1; i < arc.length; i++)
    face(
      oriel,
      [
        [arc[i - 1][0], 7.5, arc[i - 1][1]],
        [arc[i][0], 7.5, arc[i][1]],
        [0, 8.25, -0.3],
      ],
      'roof',
      'tile',
      [0, 1, 0],
    );
  cap(oriel, arc, () => 7.5, 'roof', 'tile');
  for (const [x, z, top, w] of [
    [5.4, 1.4, c.stackTop, 1.4],
    [-3.5, 1.2, 11.7, 1.0],
  ]) {
    const y = roof([x, z]) - 0.12;
    box(o, x, y, z, w, top - y, w, 'brick', 'brick');
    if (d >= 2) box(o, x, top, z, w + 0.2, 0.17, w + 0.2, 'brick', 'brick');
  }
  entrance(o, fit, d);
}
export function buildKsiazPalmService(o, key, level = 'closeup') {
  const f = frames.get(key),
    d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  if (!f) throw Error(`Unknown Palm House service building ${key}`);
  if (d === undefined) throw Error(`Unknown level ${level}`);
  ({ administration, utility, residence, boiler })[f.controls.kind](o, f, d);
}
export function buildKsiazPalmServiceSkyline(o, key) {
  buildKsiazPalmService(
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
