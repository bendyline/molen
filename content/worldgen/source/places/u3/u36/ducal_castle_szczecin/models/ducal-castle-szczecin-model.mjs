import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.93 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  paving: { slot: 'trim', graph: 'stone_granite', roughness: 0.92 },
  cream: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.89 },
  metal: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.84 },
  clay: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.87 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.88 },
};

const white = rgb('ddd5c2');
const atticWhite = rgb('e1dcca');
const trim = rgb('ccc3ac');
const pale = rgb('e1dbc7');
const stone = rgb('9b9281');
const shadow = rgb('54534c');
const dark = rgb('4c5350');
const glass = rgb('66706a');
const slate = rgb('696b65');
const clay = rgb('a66550');
const copper = rgb('789b91');
const brick = rgb('9b6653');
const blue = rgb('385274');
const gold = rgb('cfa555');
const apron = rgb('a9a08e');
const eave = 14.35;

const outline = frame.geometry.outline;
const court = frame.geometry.holes[0];
const getMappedPart = (id) => frame.features.find((item) => item.id === 'way/' + id).points;
const clock = getMappedPart(1462715442);
const prison = getMappedPart(1462715443);
const stairTower = getMappedPart(948729703);
const north = getMappedPart(948729702);

const edges = (points) => points.map((p, index) => [p, points[(index + 1) % points.length]]);
const rect = (x, z, width, depth) => [
  [x - width / 2, z - depth / 2],
  [x + width / 2, z - depth / 2],
  [x + width / 2, z + depth / 2],
  [x - width / 2, z + depth / 2],
];
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const center = (ring) =>
  ring.reduce(([x, z], p) => [x + p[0] / ring.length, z + p[1] / ring.length], [0, 0]);

function tidy(points, limit) {
  const ring = [...points];
  // Omit sub-metre wall jogs in the distant model while preserving the two court outlines.
  for (let i = ring.length - 1; i >= 0; i--) {
    const a = ring[(i - 1 + ring.length) % ring.length];
    const b = ring[i];
    const c = ring[(i + 1) % ring.length];
    const span = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const jog = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    if (span > 0 && jog / span < limit && Math.hypot(b[0] - a[0], b[1] - a[1]) < limit * 5)
      ring.splice(i, 1);
  }
  return ring;
}

function cap(out, slot, ring, y, tone, holes = []) {
  const points = ring.concat(...holes);
  let count = ring.length;
  const breaks = holes.map((hole) => {
    const at = count;
    count += hole.length;
    return at;
  });
  const ids = earcut(points.flat(), breaks);
  for (let i = 0; i < ids.length; i += 3) {
    const [a, b, c] = ids.slice(i, i + 3).map((part) => points[part]);
    const area = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    if (Math.abs(area) > 0.00005) {
      const ordered = area > 0 ? [a, b, c] : [c, b, a];
      tri(out, slot, ...ordered.map(([x, z]) => [x, y, z]), tone);
    }
  }
}

function panel(out, slot, F, u, y, w, h, d, tone) {
  quad4(
    out,
    slot,
    F.P(u - w / 2, y, d),
    F.P(u + w / 2, y, d),
    F.P(u + w / 2, y + h, d),
    F.P(u - w / 2, y + h, d),
    tone,
  );
}

function window(out, F, u, level, width, height, lod, depth = 0) {
  if (lod > 1)
    panel(out, 'cream', F, u, level - 0.13, width + 0.39, height + 0.26, depth + 0.04, trim);
  panel(out, 'glass', F, u, level, width, height, depth + 0.066, glass);
  if (lod > 1) {
    panel(out, 'cream', F, u, level, 0.083, height, depth + 0.086, dark);
    panel(out, 'cream', F, u, level + height * 0.56, width, 0.078, depth + 0.088, dark);
  }
  if (lod > 1) {
    if (lod === 2) panel(out, 'cream', F, u, level - 0.19, width + 0.5, 0.13, depth + 0.094, pale);
    if (lod === 3) {
      fbox(
        out,
        'cream',
        F,
        u - width / 2 - 0.25,
        u + width / 2 + 0.25,
        level - 0.19,
        level - 0.062,
        depth - 0.035,
        depth + 0.24,
        pale,
      );
      panel(out, 'cream', F, u, level + height * 0.27, width, 0.044, depth + 0.09, trim);
      fbox(
        out,
        'cream',
        F,
        u - width / 2 - 0.27,
        u + width / 2 + 0.27,
        level + height + 0.12,
        level + height + 0.2,
        depth + 0.012,
        depth + 0.24,
        pale,
      );
      panel(out, 'cream', F, u, level + height * 0.78, width, 0.043, depth + 0.09, trim);
    }
  }
}

function rangeWindows(out, F, lod, lower, height) {
  const levels = lower ? [1.15, 5.48, 9.22] : [5.48, 9.22];
  const n = Math.max(1, Math.round(F.length / [8.3, 5.9, 3.85, 3.85][lod]));
  for (let i = 0; i < n; i++)
    for (const y of levels) window(out, F, (F.length * (i + 0.5)) / n, y, 1.15, height, lod);
}

function archShape(out, F, u, w, floor, spring, rise, d, tone, steps) {
  const points = [
    [u - w / 2, floor],
    [u + w / 2, floor],
  ];
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI * i) / steps;
    points.push([u + (w / 2) * Math.cos(a), spring + rise * Math.sin(a)]);
  }
  fan(
    out,
    'glass',
    points.map(([x, y]) => F.P(x, y, d)),
    tone,
  );
}

function arcade(out, F, lod) {
  const n = Math.max(1, Math.round(F.length / (lod === 1 ? 4.7 : 3.83)));
  const width = F.length / n;
  const pier = width * 0.17;
  const spring = 2.87;
  const rise = 0.86;
  const steps = [3, 3, 5, 9][lod];
  fbox(out, 'plaster', F, 0, F.length, -1.1, 4.5, -2.33, -2.17, shadow);
  for (let k = 0; k < n; k++) {
    const u0 = k * width;
    const u1 = u0 + width;
    fbox(out, 'plaster', F, u0, u0 + pier, -0.31, 4.38, -1.97, 0.02, white);
    const opening = width - pier;
    const point = (i) => {
      const angle = Math.PI * (1 - i / steps);
      return [u0 + pier + opening * (0.5 + 0.5 * Math.cos(angle)), spring + rise * Math.sin(angle)];
    };
    for (let i = 1; i <= steps; i++) {
      const [a, b] = point(i - 1);
      const [c, d] = point(i);
      quad4(
        out,
        'plaster',
        F.P(a, b, 0.022),
        F.P(c, d, 0.022),
        F.P(c, 4.38, 0.022),
        F.P(a, 4.38, 0.022),
        white,
      );
      if (lod > 1)
        quad4(
          out,
          'plaster',
          F.P(a, b, -0.58),
          F.P(c, d, -0.58),
          F.P(c, d, 0.022),
          F.P(a, b, 0.022),
          trim,
        );
    }
    if (lod > 2) {
      fbox(out, 'stone', F, u0 - 0.044, u0 + pier + 0.05, -0.04, 0.2, -0.1, 0.12, stone);
      window(out, F, 0.5 * (u0 + pier + u1), 0.76, 1.14, 1.7, lod - 1, -2.14);
    }
  }
  fbox(out, 'cream', F, 0, F.length, 4.22, 4.44, -0.03, 0.17, trim);
}

function arcadeEdge(a, b) {
  const m = midpoint(a, b);
  return m[1] < -27.8 || m[0] > 35.8 || (m[0] < -13.5 && m[1] < 12.8);
}

function shell(out, lod) {
  const threshold = [1.49, 0.63, 0.18, 0.072][lod];
  const outer = outwardRing(tidy(outline, threshold));
  const inner = outwardRing(tidy(court, threshold)).reverse();
  for (const [a, b] of edges(outer)) {
    const F = wallFace(a, b);
    const stoneHeight = Math.min(1.45, a[0] > 32 && b[0] > 32 ? -0.23 : 0.67);
    if (lod > 0) panel(out, 'stone', F, F.length / 2, -11, F.length, 11 + stoneHeight, 0, stone);
    const wallBase = lod === 0 ? -11 : stoneHeight;
    panel(out, 'plaster', F, F.length / 2, wallBase, F.length, eave - wallBase, 0, white);
    if (F.length > 4.3 && lod > 0) {
      rangeWindows(out, F, lod, true, 2.05);
      panel(out, 'cream', F, F.length / 2, 4.36, F.length, 0.17, 0.045, trim);
      panel(out, 'cream', F, F.length / 2, 13.7, F.length, 0.23, 0.048, trim);
    }
  }
  for (const [a, b] of edges(inner)) {
    const F = wallFace(a, b);
    const carved = arcadeEdge(a, b);
    const bottom = carved && lod > 0 ? 4.38 : -1.1;
    panel(out, 'plaster', F, F.length / 2, bottom, F.length, eave - bottom, 0, white);
    if (F.length > 3.8 && lod > 0) rangeWindows(out, F, lod, !carved, 2.21);
  }
  cap(out, 'metal', outer, eave, slate, [inner]);
  cap(out, 'paving', inner, 0.05, apron);

  const [ne, nw, sw, se] = [court[9], court[13], court[20], court[7]];
  for (const [a, b] of [
    [nw, ne],
    [ne, se],
    [sw, nw],
  ]) {
    const F = wallFace(a, b);
    if (lod > 0) arcade(out, F, lod);
    if (lod > 0) {
      fbox(out, 'cream', F, 0, F.length, 12.62, 12.85, -0.13, 0.24, trim);
      if (lod > 1)
        for (let u = 1.3; u < F.length - 1; u += 3.68)
          disc(out, 'glass', F, u, 13.36, 0.17, 0.052, shadow, 8);
    }
  }

  // Ducal roof terrace. The native northeastern wing steps down toward the river.
  const terrace = outwardRing(tidy(north, threshold));
  cap(out, 'paving', terrace, eave + 0.07, apron);
  for (const [a, b] of edges(terrace)) {
    const F = wallFace(a, b);
    panel(out, 'plaster', F, F.length * 0.5, eave - 0.015, F.length, 0.76, 0, white);
    if (lod > 1 && F.length > 9)
      for (let u = 0.85; u < F.length - 0.22; u += 2.25)
        panel(out, 'cream', F, u, eave + 0.73, 0.21, 0.25, 0.047, pale);
  }
}

function disc(out, slot, F, u, y, radius, depth, tone, steps) {
  fan(
    out,
    slot,
    Array.from({ length: steps }, (_, i) => {
      const a = (i * 2 * Math.PI) / steps;
      return F.P(u + radius * Math.cos(a), y + radius * Math.sin(a), depth);
    }),
    tone,
  );
}

function hoop(out, slot, F, u, y, radius, width, depth, tone, steps) {
  const point = (r, i) => {
    const a = (i * 2 * Math.PI) / steps;
    return F.P(u + r * Math.cos(a), y + r * Math.sin(a), depth);
  };
  for (let i = 0; i < steps; i++)
    quad4(
      out,
      slot,
      point(radius, i),
      point(radius, i + 1),
      point(radius - width, i + 1),
      point(radius - width, i),
      tone,
    );
}

function clockFace(out, F, u, lod) {
  panel(out, 'glass', F, u, 19.9, 3.38, 5.9, 0.095, blue);
  for (const [y, radius] of [
    [23, 1.42],
    [20.86, 0.64],
  ]) {
    hoop(out, 'glass', F, u, y, radius, 0.123, 0.12, gold, lod === 0 ? 7 : 28);
    if (lod < 2) continue;
    hoop(out, 'glass', F, u, y, radius * 0.74, 0.048, 0.126, gold, 24);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const point = (r) => F.P(u + r * Math.cos(a), y + r * Math.sin(a), 0.14);
      beam(out, 'glass', point(radius * 0.8), point(radius * 0.96), 0.035, 0.039, gold);
    }
    beam(
      out,
      'glass',
      F.P(u, y, 0.15),
      F.P(u - radius * 0.57, y + radius * 0.57, 0.15),
      0.057,
      0.06,
      gold,
    );
    beam(
      out,
      'glass',
      F.P(u, y, 0.15),
      F.P(u + radius * 0.6, y - radius * 0.18, 0.15),
      0.04,
      0.04,
      gold,
    );
  }
  if (lod > 1) {
    disc(out, 'cream', F, u, 23, 0.48, 0.135, pale, 14);
    for (const side of [-1, 1]) {
      disc(out, 'glass', F, u + side * 0.93, 25.22, 0.31, 0.125, gold, 8);
      disc(out, 'glass', F, u + side * 0.19, 23.08, 0.058, 0.153, dark, 8);
    }
  }
}

function profile(out, [x, z], values, lod, rotation = 0) {
  const n = [6, 8, 12, 20][lod];
  loft(
    out,
    'metal',
    (lod === 0
      ? values.filter((_, i) => i === 0 || i === values.length - 1 || i % 2 === 0)
      : values
    ).map(([y, rx, rz = rx]) => radialRing(y, rx, rz, n, [x, z], rotation)),
    copper,
    { cap: false },
  );
}

function clockPedestal(out, lod) {
  // The square Gothic brick base projects toward the court beneath the upper octagon.
  const ring = [
    [10.9, 18.53],
    [20.47, 20.02],
    [20.74, 25.2],
    [10.78, 24.39],
  ];
  const F = wallFace(ring[1], ring[0]);
  extrude(out, 'brick', ring, -0.82, 16.25, brick, { top: false });
  fbox(out, 'metal', F, -0.13, F.length + 0.13, 15.74, 16.35, -0.1, 0.21, copper);
  if (lod > 0) {
    for (const y of [3.23, 8.18, 12.71])
      for (const u of [F.length * 0.26, F.length * 0.73]) window(out, F, u, y, 0.86, 1.88, lod);
    if (lod > 1)
      for (const fraction of [0.11, 0.49, 0.89])
        panel(out, 'brick', F, F.length * fraction, 0.5, 0.19, 14.93, 0.033, brick);
  }
}

function blockTower(out, ring, base, brickTop, top, size, lod, kind) {
  const shape = outwardRing(tidy(ring, 0.14));
  const [x, z] = center(shape);
  if (brickTop > base) extrude(out, 'brick', shape, base, brickTop, brick, { top: false });
  extrude(out, 'plaster', shape, brickTop, top, white, { top: false });
  cap(out, 'cream', shape, top, trim);
  const R = size;
  const f = kind === 'clock' ? 1.0 : 0.85;
  const cupola = [
    [top - 0.03, R, R * f],
    [top + 0.37, R * 1.07, R * f * 1.07],
    [top + 1.81, R * 0.976, R * 0.976 * f],
    [top + 4.07, R * 0.79, R * 0.79 * f],
    [top + 6.38, R * 0.49, R * 0.49 * f],
    [top + 7.7, R * 0.26, R * 0.26 * f],
  ];
  if (kind === 'clock') {
    profile(out, [x, z], cupola, lod);
    openLantern(out, [x, z], top + 7.7, top + 10.94, R * 0.256, lod);
    profile(
      out,
      [x, z],
      [
        [top + 10.9, R * 0.34],
        [top + 11.45, R * 0.34],
        [top + 13.22, R * 0.19],
        [top + 15.12, R * 0.025],
        [top + 16.12, 0.027],
      ],
      lod,
    );
  } else profile(out, [x, z], [...cupola, [top + 9.17, R * 0.055], [top + 10.91, 0.029]], lod);

  const faces = edges(shape).map(([a, b]) => wallFace(a, b));
  const clockFront =
    kind === 'clock' ? faces.reduce((a, b) => (a.normal[1] < b.normal[1] ? a : b)) : null;
  for (const F of faces) {
    if (F === clockFront) clockFace(out, F, F.length * 0.5, lod);
    else if (lod > 0 && F.length > 2.15)
      for (const y of [brickTop + 1.3, top - 4.22])
        if (y < top - 2.3) window(out, F, F.length * 0.5, y, 0.95, 2.04, lod);
  }
}

function openLantern(out, [x, z], low, high, radius, lod) {
  const n = 8;
  const a = radialRing(low, radius, radius, n, [x, z], Math.PI / 8);
  const b = radialRing(high, radius, radius, n, [x, z], Math.PI / 8);
  for (let i = 0; i < n; i++) {
    const W = radius * 0.17;
    if (lod < 2) {
      const F = wallFace(
        a[i].filter((_, j) => j !== 1),
        a[(i + 1) % n].filter((_, j) => j !== 1),
      );
      panel(out, 'metal', F, 0, low, W, high - low, 0, copper);
    } else beam(out, 'metal', a[i], b[i], W, W, copper);
  }
  profile(
    out,
    [x, z],
    [
      [low - 0.16, radius * 1.05],
      [low + 0.12, radius * 1.06],
    ],
    0,
  );
  profile(
    out,
    [x, z],
    [
      [high - 0.4, radius],
      [high + 0.08, radius * 1.05],
    ],
    0,
  );
}

function bellTower(out, lod) {
  const x = -32.88;
  const z = -33.91;
  const shaft = outwardRing(rect(x, z, 10.4, 10.65));
  const lantern = plan.dimensions.bellTowerOutlookHeightM + 5;
  const spire = plan.dimensions.bellTowerHeightIncludingSpireM;
  extrude(out, 'plaster', shaft, -2.1, 36.2, white, { top: false });
  cap(out, 'cream', shaft, 36.2, trim);
  profile(
    out,
    [x, z],
    [
      [35.92, 5.39],
      [36.2, 5.55],
      [37.55, 4.98],
      [39.62, 3.18],
      [lantern, 2.9],
    ],
    lod,
    Math.PI / 8,
  );
  openLantern(out, [x, z], lantern, 47.35, 2.9, lod);
  profile(
    out,
    [x, z],
    [
      [47.28, 3.18],
      [47.63, 3.25],
      [50.82, 2.68],
      [52.72, 1.47],
      [53.2, 0.59],
      [53.96, 0.58],
      [54.7, 0.86],
      [55.18, 0.7],
      [55.62, 0.3],
      [58.84, 0.13],
      [spire, 0.029],
    ],
    lod,
    Math.PI / 8,
  );
  for (const [a, b] of edges(shaft)) {
    const F = wallFace(a, b);
    for (const y of [16.3, 25.2, 32.75]) {
      panel(out, 'cream', F, F.length / 2, y - 0.64, F.length, 0.24, 0.057, trim);
      if (lod > 0) window(out, F, F.length / 2, y, y > 30 ? 1.77 : 1.4, 2.4, lod);
    }
  }
  if (lod > 1)
    for (const [cx, cz] of shaft)
      profile(
        out,
        [cx + (x - cx) * 0.17, cz + (z - cz) * 0.17],
        [
          [36.12, 0.68],
          [37, 0.68],
          [37.78, 0.41],
          [38.2, 0.08],
        ],
        0,
      );
}

function atticCrown(out, F, u, y, width, group, lod) {
  const radius = width * 0.5 - 0.21;
  const depth = 0.23;
  const n = [5, 8, 12, 18][lod];
  if (lod === 0) {
    disc(out, 'cream', F, u, y, radius, depth, atticWhite, n);
    return;
  }
  for (const d of [depth, -0.35]) {
    const V =
      d > 0
        ? F
        : facade(
            [F.P(u, y, d)[0], F.P(u, y, d)[2]],
            F.along.map((v) => -v),
          );
    disc(out, 'cream', V, d > 0 ? u : 0, y, radius, d > 0 ? d : 0, atticWhite, n);
  }
  if (lod > 1)
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n;
      const b = ((i + 1) * Math.PI * 2) / n;
      const p = (angle, d) => F.P(u + radius * Math.cos(angle), y + radius * Math.sin(angle), d);
      quad4(out, 'metal', p(a, depth), p(a, -0.35), p(b, -0.35), p(b, depth), copper);
    }
  if (lod > 1) {
    hoop(out, 'cream', F, u, y, radius * 0.79, 0.11, depth + 0.026, trim, n);
    if (lod > 2)
      for (const a of [0, 2.0944, 4.1888])
        beam(
          out,
          'cream',
          F.P(u, y, depth + 0.045),
          F.P(
            u + (radius - 0.3) * Math.cos(a + group * 0.12),
            y + (radius - 0.3) * Math.sin(a + group * 0.12),
            depth + 0.041,
          ),
          0.085,
          0.09,
          trim,
        );
  }
}

function renaissanceAttic(out, F, lod) {
  const high = 23.2;
  if (lod > 0) fbox(out, 'plaster', F, 0, F.length, eave - 0.01, high, -0.14, 0.08, atticWhite);
  for (const y of lod > 0 ? [16.32, 19.23, 21.65, high - 0.16] : [high - 0.16])
    panel(out, 'cream', F, F.length / 2, y, F.length, 0.17, 0.129, trim);
  const columnCount = Math.max(3, Math.round(F.length / 1.85));
  if (lod > 1)
    for (let j = 1; j < columnCount; j++) {
      const u = (F.length * j) / columnCount;
      panel(out, 'cream', F, u, 16.52, 0.105, 2.66, 0.116, trim);
      const n = lod === 1 ? 6 : 12;
      hoop(out, 'cream', F, u, 20.47, 0.73, 0.09, 0.125, pale, n);
    }
  const groupCount = Math.max(1, Math.round(F.length / 8.4));
  const width = F.length / groupCount;
  for (let g = 0; g < groupCount; g++) {
    const u = width * (g + 0.5);
    panel(out, 'plaster', F, u, high, width * 0.95, 0.78, 0.09, atticWhite);
    const repeats = lod < 2 ? 2 : 3;
    for (let j = 0; j < repeats; j++)
      atticCrown(
        out,
        F,
        u + width * 0.89 * ((j + 0.5) / repeats - 0.5),
        high + 0.77,
        (width * 0.87) / repeats,
        g,
        lod,
      );
  }
}

function southernRange(out, lod) {
  const A = [-12.2, 16.85];
  const B = [40.37, 26.59];
  const C = [37.1, 42.36];
  const D = [-9.03, 33.63];
  const tall = [A, B, C, D];
  extrude(out, 'plaster', tall, eave - 0.05, 23.19, atticWhite, { top: false });
  cap(out, 'metal', tall, 23.19, slate);
  for (const [a, b] of edges(outwardRing(tall))) renaissanceAttic(out, wallFace(a, b), lod);
  gableRoof(out, 'metal', [-13.6, 16.85], [38.1, 26.67], 4.1, eave - 0.12, 16.32, slate, {
    overhang: 0.12,
    endSlot: 'plaster',
    endColor: white,
  });
}

function mintCourt(out, lod) {
  const left = wallFace([-49.7, -28.8], [-48.15, 32.85]);
  const right = wallFace([-36.98, 33.0], [-31.26, 0.4]);
  cap(
    out,
    'paving',
    [
      [-49.7, -28.8],
      [-31.26, -28.0],
      [-35.96, 32.93],
      [-48.15, 32.85],
    ],
    0.06,
    apron,
  );
  for (const F of [left, right])
    if (lod > 0 && F.length > 8) {
      // Existing wall windows are retained on the surveyed faces. The inner cornice ties the walk together.
      panel(out, 'cream', F, F.length / 2, 11.77, F.length, 0.19, 0.03, trim);
    }
  gableRoof(out, 'clay', [-48.94, 36.49], [-36.69, 37.28], 7.72, 14.31, 17.62, clay, {
    overhang: 0.19,
    endSlot: 'plaster',
    endColor: white,
  });
  const portal = wallFace([-36.84, 32.859], [-48.633, 33.04]);
  const at = portal.length * 0.52;
  archShape(out, portal, at, 3.42, -0.025, 2.89, 0.8, 0.081, shadow, lod === 0 ? 6 : 12);
  if (lod > 0) {
    for (const u of [-3.49, 0, 3.49]) window(out, portal, at + u, 5.34, 1.46, 2.42, lod);
    const gable = [
      [at - 2.72, 9.33],
      [at + 2.72, 9.33],
      [at + 2.39, 10.16],
      [at + 1.34, 10.67],
      [at + 0.95, 11.61],
      [at, 12.13],
      [at - 0.95, 11.61],
      [at - 1.34, 10.67],
      [at - 2.39, 10.16],
    ];
    const ids = earcut(gable.flat());
    for (let i = 0; i < ids.length; i += 3)
      tri(out, 'plaster', ...ids.slice(i, i + 3).map((k) => portal.P(...gable[k], 0.089)), white);
  }
}

function build(out, lod) {
  shell(out, lod);
  southernRange(out, lod);
  mintCourt(out, lod);
  blockTower(out, stairTower, -1.62, 3.72, 22.2, 4.0, lod, 'stair');
  blockTower(out, prison, -2.2, 0, 24.89, 5.21, lod, 'prison');
  clockPedestal(out, lod);
  blockTower(out, clock, -0.8, 17.25, 32.13, 5.01, lod, 'clock');
  bellTower(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'ducal-castle-szczecin-model.mjs';
const camera = [-112, 81, 146];
const lookAt = [0, 16, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'castle',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Pomeranian Dukes’ Castle in Szczecin, with both courtyards, the raised Renaissance attic, green copper towers and astronomical clock.',
  camera,
  lookAt,
  sunDirection: [-36, 77, -58],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    holes: frame.geometry.holes,
    minimumCoverage: 0.9,
    basis: 'Native castle relation preserves the five wing plan and the open Great Courtyard.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_ashlar',
    'stone_granite',
    'stone_limestone_weathered',
    'metal_standing_seam',
    'tile_ceramic',
    'brick_flemish',
  ],
  recipeDependencies: [
    'authored-structure-mesh.mjs',
    'place-recipe-kit.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'clock-tower-and-great-court', position: [40, 22, -30], lookAt: [11, 22, 26] },
    { name: 'bell-tower-from-the-arcade', position: [25, 5, 14], lookAt: [-29, 22, -31] },
    { name: 'mint-courtyard-and-gateway', position: [-40, 12, -21], lookAt: [-41, 8, 36] },
    { name: 'south-attic-and-copper-towers', position: [87, 63, 93], lookAt: [9, 21, 26] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'szczecin-ducal-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.65,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.57, surfaces },
      street: { export: 'street', errorMeters: 0.2, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.07, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
