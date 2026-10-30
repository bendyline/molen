/** Original Akmens Bridge exterior. Mapped plan; photo-estimated sections and heights. */
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
  sphere,
  chamferedRectangle,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const akmensControls = {
  west: -262,
  east: 262,
  halfWidth: 13.55,
  roadEdges: [-10.35, 10.5],
  deckEnds: [7.15, 7.35],
  crown: 1.05,
  piers: [-196, -137, -78, -19, 40, 99, 174],
  torchStations: [-250, -137, 99, 242],
  trackCenters: [-1.15, 1.95],
  gauge: 1.524,
};
export const akmensSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.9 },
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.93 },
  fascia: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.9 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.62 },
  road: { slot: 'roof', graph: 'concrete_plain', roughness: 0.96 },
  mark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 1 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.45 },
};
const C = akmensControls,
  lin = (h) =>
    h.match(/../g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  col = {
    stone: lin('a7a49a'),
    fascia: lin('c7c2af'),
    iron: lin('3b4241'),
    road: lin('767972'),
    mark: lin('d3d2bb'),
    glass: lin('e9e5d7'),
  };
const tiers = {
  skyline: {
    deck: 3,
    girders: 2,
    girder: 4,
    post: 0,
    panel: 0,
    stiffener: 0,
    cross: 0,
    torch: -1,
    poles: 0,
    stone: 0,
    ornament: 0,
  },
  district: {
    deck: 8,
    girders: 2,
    girder: 8,
    post: 24,
    panel: 0,
    stiffener: 0,
    cross: 0,
    torch: 1,
    poles: 90,
    stone: 0,
    ornament: 0,
  },
  street: {
    deck: 16,
    girders: 3,
    girder: 24,
    post: 7,
    panel: 0,
    stiffener: 9,
    cross: 40,
    torch: 2,
    poles: 35,
    stone: 0,
    ornament: 0,
  },
  closeup: {
    deck: 32,
    girders: 4,
    girder: 48,
    post: 2.4,
    panel: 1,
    stiffener: 4,
    cross: 24,
    torch: 3,
    poles: 26,
    stone: 1,
    ornament: 1,
  },
  master: {
    deck: 96,
    girders: 8,
    girder: 144,
    post: 2.4,
    panel: 2,
    stiffener: 1.2,
    cross: 9,
    torch: 4,
    poles: 26,
    stone: 2,
    ornament: 2,
  },
};
export const akmensDeckY = (x) => {
  const u = Math.max(0, Math.min(1, (x - C.west) / (C.east - C.west)));
  return C.deckEnds[0] + (C.deckEnds[1] - C.deckEnds[0]) * u + C.crown * Math.sin(Math.PI * u);
};
export const akmensGirderBottom = (x) => {
  const distance = Math.min(...C.piers.map((p) => Math.abs(x - p)));
  return akmensDeckY(x) - 1.4 - 1.1 * Math.pow(Math.max(0, 1 - distance / 28), 2);
};
function writer(target, far) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, points, hint, _uv, color) => {
        for (let i = 1; i < points.length - 1; i++) {
          let p = [points[0], points[i], points[i + 1]],
            n = normalFor(...p);
          if (hint && n.reduce((s, v, j) => s + v * hint[j], 0) < 0) {
            p = [p[0], p[2], p[1]];
            n = normalFor(...p);
          }
          if (Math.hypot(...n) < 0.9) continue;
          const major = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),
            axes = major === 0 ? [2, 1] : major === 1 ? [0, 2] : [0, 1];
          target.addTriangle(
            far ? 'far' : slot,
            ref,
            p,
            n,
            p.map((q) => axes.map((k) => q[k])),
            color,
          );
        }
      },
    ]),
  );
}
function slab(o, slot, x0, x1, z0, z1, bottom, top, color, n) {
  loft(
    o,
    slot,
    Array.from({ length: n + 1 }, (_, i) => {
      const x = x0 + ((x1 - x0) * i) / n;
      return [
        [x, bottom(x), z0],
        [x, top(x), z0],
        [x, top(x), z1],
        [x, bottom(x), z1],
      ];
    }),
    color,
  );
}
function column(o, slot, x, z, profile, color, n = 8) {
  loft(
    o,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, n, [x, z], Math.PI / 8)),
    color,
  );
}
function torch(o, x, z, S) {
  const y = akmensDeckY(x) + 0.18;
  if (S.torch <= 2) {
    box(o, 'stone', [x - 0.6, y, z - 0.6], [x + 0.6, y + 3.7, z + 0.6], col.stone);
    if (S.torch < 0) return;
    beam(o, 'iron', [x, y + 3.7, z], [x, y + 6.3, z], 0.22, 0.22, col.iron);
    for (let i = 0; i < 7; i++) {
      const a = (2 * Math.PI * i) / 6,
        xx = i === 6 ? x : x + Math.cos(a),
        zz = i === 6 ? z : z + Math.sin(a),
        yy = y + (i === 6 ? 6.5 : 5.9);
      sphere(o, 'glass', [xx, yy, zz], [0.3, 0.32, 0.3], col.glass, 4, 2);
      if (i < 6) beam(o, 'iron', [x, y + 4.8, z], [xx, y + 5.5, zz], 0.09, 0.09, col.iron);
    }
    return;
  }
  const ring = (h, w, d) => chamferedRectangle(x, y + h, z, w, d, 0.16);
  loft(
    o,
    'stone',
    [
      ring(0, 1.9, 1.8),
      ring(0.32, 1.9, 1.8),
      ring(0.45, 1.55, 1.5),
      ring(0.95, 1.55, 1.5),
      ring(1.05, 1.35, 1.3),
      ring(3.55, 0.95, 0.95),
      ring(3.72, 1.05, 1.05),
    ],
    col.stone,
  );
  column(
    o,
    'iron',
    x,
    z,
    [
      [y + 3.72, 0.36],
      [y + 3.9, 0.36],
      [y + 4.05, 0.24],
      [y + 4.18, 0.2],
      [y + 4.3, 0.28],
      [y + 4.5, 0.38],
      [y + 4.83, 0.47],
      [y + 5, 0.27],
      [y + 5.12, 0.22],
      [y + 5.5, 0.2],
      [y + 5.6, 0.28],
      [y + 5.72, 0.14],
      [y + 6.12, 0.12],
      [y + 6.23, 0.19],
    ],
    col.iron,
    S.torch >= 3 ? 8 : 6,
  );
  const seg = S.torch >= 4 ? 16 : S.torch >= 3 ? 8 : 4,
    lat = S.torch >= 4 ? 8 : S.torch >= 3 ? 4 : 2;
  sphere(o, 'glass', [x, y + 6.5, z], [0.31, 0.34, 0.31], col.glass, seg, lat);
  for (let i = 0; i < 6; i++) {
    const a = (2 * Math.PI * i) / 6,
      dx = Math.cos(a),
      dz = Math.sin(a),
      xx = x + 1.04 * dx,
      zz = z + 1.04 * dz;
    beamPath(
      o,
      'iron',
      [
        [x + 0.22 * dx, y + 4.67, z + 0.22 * dz],
        [x + 0.48 * dx, y + 4.85, z + 0.48 * dz],
        [xx, y + 4.85, zz],
      ],
      0.15,
      0.19,
      col.iron,
    );
    column(
      o,
      'iron',
      xx,
      zz,
      [
        [y + 4.75, 0.18],
        [y + 4.9, 0.22],
        [y + 5.04, 0.12],
        [y + 5.3, 0.1],
        [y + 5.38, 0.2],
        [y + 5.52, 0.17],
        [y + 5.65, 0.22],
      ],
      col.iron,
      S.torch >= 3 ? 8 : 4,
    );
    sphere(o, 'glass', [xx, y + 5.92, zz], [0.28, 0.31, 0.28], col.glass, seg, lat);
    if (S.torch >= 3) {
      sphere(o, 'iron', [xx, y + 4.56, zz], [0.1, 0.13, 0.1], col.iron, 6, 4);
      beamPath(
        o,
        'iron',
        [
          [x + 0.4 * dx, y + 4.75, z + 0.4 * dz],
          [x + 0.57 * dx, y + 4.4, z + 0.57 * dz],
          [x + 0.85 * dx, y + 4.42, z + 0.85 * dz],
          [xx, y + 4.7, zz],
        ],
        0.06,
        0.065,
        col.iron,
      );
    }
  }
  if (S.stone > 1) {
    for (let row = 0; row < 7; row++) {
      const h = 0.43 + row * 0.45,
        w = 1.48 - row * 0.075;
      for (const side of [-1, 1])
        box(
          o,
          'stone',
          [x - w / 2, y + h, z + side * (w / 2 + 0.006) - 0.012],
          [x + w / 2, y + h + 0.025, z + side * (w / 2 + 0.006) + 0.012],
          col.fascia,
        );
    }
  }
  if (S.stone === 1)
    for (let row = 0; row < 7; row++) {
      const h = 1.05 + row * 0.35,
        w = 1.35 - (h - 1.05) * 0.16;
      for (const side of [-1, 1])
        o.addQuad(
          'stone',
          'palette:#ffffff',
          [
            [x - w / 2, y + h, z + side * (w / 2 + 0.008)],
            [x + w / 2, y + h, z + side * (w / 2 + 0.008)],
            [x + w / 2, y + h + 0.025, z + side * (w / 2 + 0.008)],
            [x - w / 2, y + h + 0.025, z + side * (w / 2 + 0.008)],
          ],
          [0, 0, side],
          null,
          col.iron,
        );
    }
}
function pier(o, x, S) {
  const cap = akmensGirderBottom(x) - 0.25,
    ring = (y, w, d) => chamferedRectangle(x, y, 0, w, d, 0.9);
  loft(
    o,
    'stone',
    S.torch < 0
      ? [ring(-0.8, 7, 26.6), ring(cap, 6.2, 26.2)]
      : [
          ring(-0.8, 7, 26.6),
          ring(0.65, 6.8, 26.4),
          ring(cap - 0.5, 5.7, 25.8),
          ring(cap - 0.5, 6.2, 26.2),
          ring(cap, 6.2, 26.2),
        ],
    col.stone,
  );
  if (S.stone > 1) {
    for (let y = 0.3; y < cap - 0.6; y += 0.48) {
      for (const side of [-1, 1]) {
        box(
          o,
          'stone',
          [x - 2.84, y, side * 12.85 - 0.025],
          [x + 2.84, y + 0.035, side * 12.85 + 0.025],
          col.fascia,
        );
        for (let j = 0; j < 4; j++) {
          const xx = x - 2.55 + j * 1.45 + (Math.round(y / 0.48) % 2) * 0.5;
          box(
            o,
            'stone',
            [xx, y, side * 12.88 - 0.03],
            [xx + 0.035, Math.min(y + 0.48, cap - 0.5), side * 12.88 + 0.03],
            col.fascia,
          );
        }
      }
      if (S.stone > 1)
        for (const side of [-1, 1])
          for (let z = -11.5; z < 12; z += 1.6) {
            const a = x + side * 2.83;
            box(o, 'stone', [a - 0.016, y, z], [a + 0.016, y + 0.032, z + 1.55], col.fascia);
          }
    }
  }
  if (S.torch > 1)
    for (const z of [-9, -3, 3, 9])
      box(o, 'iron', [x - 1.4, cap, z - 0.35], [x + 1.4, cap + 0.26, z + 0.35], col.iron);
  if (S.stone === 1)
    for (let y = 0.3; y < cap - 0.6; y += 0.48) {
      const w = 6.8 + ((5.7 - 6.8) * (y - 0.65)) / (cap - 1.15);
      for (const side of [-1, 1])
        o.addQuad(
          'stone',
          'palette:#ffffff',
          [
            [x - w / 2 + 0.9, y, side * 12.92],
            [x + w / 2 - 0.9, y, side * 12.92],
            [x + w / 2 - 0.9, y + 0.022, side * 12.92],
            [x - w / 2 + 0.9, y + 0.022, side * 12.92],
          ],
          [0, 0, side],
          null,
          col.iron,
        );
    }
}
function rail(o, z, S) {
  const x0 = C.west + 1,
    x1 = C.east - 1,
    n = Math.max(8, Math.ceil((x1 - x0) / (S.post || 80))),
    step = (x1 - x0) / n;
  if (!S.post) return;
  for (const h of [0.36, 1.2])
    beamPath(
      o,
      'iron',
      Array.from({ length: S.deck + 1 }, (_, i) => {
        const x = x0 + ((x1 - x0) * i) / S.deck;
        return [x, akmensDeckY(x) + h, z];
      }),
      0.09,
      0.11,
      col.iron,
    );
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * step,
      y = akmensDeckY(x);
    box(o, 'iron', [x - 0.065, y + 0.18, z - 0.07], [x + 0.065, y + 1.31, z + 0.07], col.iron);
    if (S.panel)
      sphere(
        o,
        'iron',
        [x, y + 1.4, z],
        [0.1, 0.1, 0.1],
        col.iron,
        S.panel > 1 ? 6 : 4,
        S.panel > 1 ? 4 : 2,
      );
    if (i === n || !S.panel) continue;
    const mid = x + step / 2,
      yy = akmensDeckY(mid);
    // Solid national-motif plaques, separated by genuinely open railing cells.
    box(
      o,
      'iron',
      [mid - 0.34, yy + 0.49, z - 0.045],
      [mid + 0.34, yy + 1.05, z + 0.045],
      col.iron,
    );
    for (const xx of [x + step * 0.18, x + step * 0.82])
      box(
        o,
        'iron',
        [xx - 0.022, yy + 0.38, z - 0.025],
        [xx + 0.022, yy + 1.2, z + 0.025],
        col.iron,
      );
    if (S.ornament) {
      for (const side of [-1, 1]) {
        const zz = z + side * 0.051;
        if (S.ornament === 1) {
          const p = [
            [mid - 0.18, yy + 0.77, zz],
            [mid, yy + 0.96, zz],
            [mid + 0.18, yy + 0.77, zz],
            [mid, yy + 0.58, zz],
          ];
          o.addQuad('iron', 'palette:#ffffff', p, [0, 0, side], null, col.fascia);
        } else {
          beam(
            o,
            'iron',
            [mid - 0.2, yy + 0.77, zz],
            [mid, yy + 0.99, zz],
            0.045,
            0.03,
            col.fascia,
          );
          beam(
            o,
            'iron',
            [mid, yy + 0.99, zz],
            [mid + 0.2, yy + 0.77, zz],
            0.045,
            0.03,
            col.fascia,
          );
          beam(
            o,
            'iron',
            [mid + 0.2, yy + 0.77, zz],
            [mid, yy + 0.55, zz],
            0.045,
            0.03,
            col.fascia,
          );
          beam(
            o,
            'iron',
            [mid, yy + 0.55, zz],
            [mid - 0.2, yy + 0.77, zz],
            0.045,
            0.03,
            col.fascia,
          );
        }
      }
    }
  }
}
function poles(o, S) {
  if (!S.poles) return;
  const count = Math.ceil((C.east - C.west - 12) / S.poles);
  for (let i = 0; i <= count; i++) {
    const x = C.west + 6 + ((C.east - C.west - 12) * i) / count,
      y = akmensDeckY(x);
    for (const side of [-1, 1]) {
      const z = side * 10.65;
      beam(o, 'iron', [x, y, z], [x, y + 9.3, z], 0.12, 0.13, col.iron);
      if (S.torch >= 2) {
        beamPath(
          o,
          'iron',
          [
            [x, y + 8.5, z],
            [x + 0.2, y + 8.95, z - side * 0.3],
            [x + 0.7, y + 9.12, z - side * 1.6],
            [x + 1.15, y + 9.12, z - side * 2.1],
          ],
          0.06,
          0.065,
          col.iron,
        );
        sphere(
          o,
          'glass',
          [x + 1.12, y + 9.08, z - side * 2.08],
          [0.3, 0.11, 0.16],
          col.glass,
          6,
          4,
        );
      }
    }
    if (S.torch >= 2)
      beam(o, 'iron', [x, y + 7.05, -10.65], [x, y + 7.05, 10.65], 0.035, 0.035, col.iron);
  }
  if (S.torch >= 2)
    for (const z of C.trackCenters)
      beamPath(
        o,
        'iron',
        Array.from({ length: S.deck + 1 }, (_, i) => {
          const x = C.west + ((C.east - C.west) * i) / S.deck;
          return [x, akmensDeckY(x) + 6.8, z];
        }),
        0.025,
        0.025,
        col.iron,
      );
}
export function buildAkmensLevel(target, level = 'master') {
  const S = tiers[level];
  if (!S) throw Error('Unknown Akmens level ' + level);
  const o = writer(target, level === 'skyline'),
    D = akmensDeckY;
  slab(
    o,
    'road',
    C.west,
    C.east,
    C.roadEdges[0],
    C.roadEdges[1],
    (x) => D(x) - 0.42,
    D,
    col.road,
    S.deck,
  );
  for (const side of [-1, 1]) {
    const a = side < 0 ? -C.halfWidth : C.roadEdges[1],
      b = side < 0 ? C.roadEdges[0] : C.halfWidth;
    slab(
      o,
      'fascia',
      C.west,
      C.east,
      a,
      b,
      (x) => D(x) - 0.52,
      (x) => D(x) + 0.18,
      col.fascia,
      S.deck,
    );
    slab(
      o,
      'stone',
      C.west,
      C.east,
      side < 0 ? -13.5 : 10.7,
      side < 0 ? -10.55 : 13.5,
      (x) => D(x) + 0.18,
      (x) => D(x) + 0.2,
      col.stone,
      S.deck,
    );
    for (const [a, b] of [
      [C.west, -246],
      [236, C.east],
    ])
      slab(
        o,
        'fascia',
        a,
        b,
        side < 0 ? -17.25 : 13.45,
        side < 0 ? -13.45 : 17.25,
        (x) => D(x) - 0.52,
        (x) => D(x) + 0.2,
        col.fascia,
        1,
      );
  }
  for (let j = 0; j < S.girders; j++) {
    const z = -10.1 + (20.2 * j) / (S.girders - 1);
    slab(
      o,
      'iron',
      C.west + 2,
      C.east - 2,
      z - 0.12,
      z + 0.12,
      akmensGirderBottom,
      (x) => D(x) - 0.43,
      col.iron,
      S.girder,
    );
    if (S.stiffener) {
      slab(
        o,
        'iron',
        C.west + 2,
        C.east - 2,
        z - 0.32,
        z + 0.32,
        (x) => akmensGirderBottom(x) - 0.07,
        (x) => akmensGirderBottom(x) + 0.09,
        col.iron,
        S.girder,
      );
      for (let x = C.west + 3; x < C.east - 2; x += S.stiffener)
        box(
          o,
          'iron',
          [x - 0.055, akmensGirderBottom(x), z - 0.23],
          [x + 0.055, D(x) - 0.44, z + 0.23],
          col.iron,
        );
    }
  }
  for (const x of C.piers) pier(o, x, S);
  for (const [x, w] of [
    [-251, 6],
    [246, 7],
  ])
    loft(
      o,
      'stone',
      [
        chamferedRectangle(x, -0.6, 0, w, 28.5, 0.6),
        chamferedRectangle(x, D(x) - 0.45, 0, w, 28.5, 0.6),
      ],
      col.stone,
    );
  for (const x of C.torchStations)
    for (const side of [-1, 1]) {
      const z = side * (Math.abs(x) > 230 ? 15.35 : 14.2);
      slab(
        o,
        'fascia',
        x - 1.5,
        x + 1.5,
        side < 0 ? z - 0.95 : 13.1,
        side < 0 ? -13.1 : z + 0.95,
        (t) => D(t) - 0.5,
        (t) => D(t) + 0.2,
        col.fascia,
        1,
      );
      torch(o, x, z, S);
    }
  if (S.cross)
    for (let x = C.west + 4; x < C.east - 2; x += S.cross)
      beam(o, 'iron', [x, D(x) - 0.64, -10.2], [x, D(x) - 0.64, 10.2], 0.16, 0.4, col.iron);
  for (const side of [-1, 1]) rail(o, side * 13.25, S);
  poles(o, S);
  if (level !== 'skyline') {
    for (const z of C.trackCenters)
      for (const side of [-1, 1])
        slab(
          o,
          'iron',
          C.west,
          C.east,
          z + (side * C.gauge) / 2 - 0.038,
          z + (side * C.gauge) / 2 + 0.038,
          D,
          (x) => D(x) + 0.035,
          col.iron,
          S.deck,
        );
    for (const z of [-7.5, 4.8, 8.3])
      for (let x = C.west + 3; x < C.east - 2; x += 12)
        o.addQuad(
          'mark',
          'palette:#ffffff',
          [
            [x, D(x) + 0.018, z - 0.065],
            [x, D(x) + 0.018, z + 0.065],
            [x + 4, D(x + 4) + 0.018, z + 0.065],
            [x + 4, D(x + 4) + 0.018, z - 0.065],
          ],
          [0, 1, 0],
          null,
          col.mark,
        );
  }
}
export const buildAkmensSkyline = (o) => buildAkmensLevel(o, 'skyline');
export const buildAkmensDistrict = (o) => buildAkmensLevel(o, 'district');
export const buildAkmensStreet = (o) => buildAkmensLevel(o, 'street');
export const buildAkmensCloseup = (o) => buildAkmensLevel(o, 'closeup');
