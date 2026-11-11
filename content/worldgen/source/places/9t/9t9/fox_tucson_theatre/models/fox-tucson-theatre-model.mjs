/** Fox Tucson Theatre's restored Congress Street entrance and historic auditorium in 2012. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  frame = read('map-frame'),
  terrain = read('terrain-grid');
const [outline, canopy] = frame.geometry.polygons;
const auditorium = outline.slice(0, 12),
  lobby = [...outline.slice(11), outline[0]];
const front = (outline[14][1] + outline[15][1]) / 2,
  left = outline[15][0],
  right = outline[14][0],
  center = (left + right) / 2;
const surfaces = {
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.91, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.93, metallic: 0 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.85, metallic: 0.15 },
  tile: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.77, metallic: 0.05 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.24 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.66, metallic: 0.09 },
};
const tint = Object.fromEntries(
  Object.entries({
    cream: 'd4bb91',
    light: 'e1caa1',
    darkPlaster: 'b5a081',
    brick: '9e826d',
    paleBrick: 'b2947b',
    concrete: 'a69a86',
    roof: '767975',
    roofLight: '92928c',
    charcoal: '383a38',
    board: '31302c',
    white: 'e9dfc8',
    gold: 'be9960',
    ochre: 'bc914f',
    terra: '98563f',
    amber: 'c18a4f',
    rust: '8b513b',
    turquoise: '608884',
    darkTeal: '476661',
    pane: '45433d',
    door: '514136',
    sidewalk: 'a69c89',
    tileLight: 'd7af6c',
    redTile: 'a96c51',
    letter: 'efead7',
    copper: '79624d',
  }).map(([key, color]) => [key, rgb(color)]),
);
const rect = (a, b, c, d) => [
  [a, b],
  [c, b],
  [c, d],
  [a, d],
];
const mix = (a, b, t) => a + (b - a) * t;

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function section(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    ux = dx / length,
    uz = dz / length;
  const x = (a[0] + b[0]) / 2,
    z = (a[1] + b[1]) / 2,
    normal = [-uz, 0, ux];
  return {
    length,
    normal,
    p: (u, y, d = 0) => [x + u * ux + d * normal[0], y, z + u * uz + d * normal[2]],
  };
}

function oriented(out, slot, p, normal, color) {
  const n = normalFor(...p),
    points = n.reduce((sum, v, i) => sum + v * normal[i], 0) > 0 ? p : p.toReversed();
  if (points.length === 4) face(out, slot, points, color);
  else triangle(out, slot, points, color);
}

function fill(out, s, slot, outer, color, d = 0, holes = []) {
  const vertices = [...outer],
    starts = [];
  for (const hole of holes) {
    starts.push(vertices.length);
    vertices.push(...hole);
  }
  const mesh = earcut(vertices.flat(), starts);
  for (let i = 0; i < mesh.length; i += 3)
    oriented(
      out,
      slot,
      mesh.slice(i, i + 3).map((j) => s.p(...vertices[j], d)),
      s.normal,
      color,
    );
}

function band(out, s, slot, a, b, d0, d1, color, full = false) {
  const points = rect(...a, ...b);
  oriented(
    out,
    slot,
    points.map((p) => s.p(...p, d1)),
    s.normal,
    color,
  );
  if (!full) return;
  for (let i = 0; i < 4; i++) {
    const p = points[i],
      q = points[(i + 1) % 4];
    face(out, slot, [s.p(...p, d0), s.p(...q, d0), s.p(...q, d1), s.p(...p, d1)], color);
  }
}

function top(out, slot, polygon, height, color, normal = [0, 1, 0]) {
  const mesh = earcut(polygon.flat());
  for (let i = 0; i < mesh.length; i += 3)
    oriented(
      out,
      slot,
      mesh.slice(i, i + 3).map((j) => [polygon[j][0], height(...polygon[j]), polygon[j][1]]),
      normal,
      color,
    );
}

function ribbon(out, s, a, b, width, d, color) {
  const du = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(du, dy),
    x = (-dy * width) / (2 * l),
    y = (du * width) / (2 * l);
  oriented(
    out,
    'detail',
    [
      [a[0] + x, a[1] + y],
      [b[0] + x, b[1] + y],
      [b[0] - x, b[1] - y],
      [a[0] - x, a[1] - y],
    ].map((p) => s.p(...p, d)),
    s.normal,
    color,
  );
}

function diamond(out, s, x, y, w, h, d, color) {
  oriented(
    out,
    'detail',
    [
      [x - w, y],
      [x, y + h],
      [x + w, y],
      [x, y - h],
    ].map((p) => s.p(...p, d)),
    s.normal,
    color,
  );
}

function barrel(z) {
  const { eaves, curveRise, north, south } = plan.auditorium;
  const u = (2 * (z - north)) / (south - north) - 1;
  return eaves + curveRise * Math.max(0, 1 - u * u);
}

function clipZ(polygon, z, keepNorth) {
  const inside = (p) => (keepNorth ? p[1] <= z : p[1] >= z);
  const points = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    if (inside(a)) points.push(a);
    if (inside(a) !== inside(b)) {
      const t = (z - a[1]) / (b[1] - a[1]);
      if (t > 0.0000001 && t < 0.9999999) points.push([mix(a[0], b[0], t), z]);
    }
  }
  return points;
}

function theatreShell(out, lod) {
  const zMin = Math.min(...auditorium.map((p) => p[1])),
    zMax = Math.max(...auditorium.map((p) => p[1]));
  const segments = [7, 12, 19, 25][lod],
    splits = Array.from({ length: segments + 1 }, (_, i) => mix(zMin, zMax, i / segments));
  for (let i = 0; i < segments; i++) {
    const strip = clipZ(clipZ(auditorium, splits[i], false), splits[i + 1], true);
    if (strip.length >= 3)
      top(out, 'roof', strip, (_, z) => barrel(z), i % 6 === 0 ? tint.roofLight : tint.roof);
  }
  for (let i = 0; i < auditorium.length; i++) {
    const a = auditorium[(i + 1) % auditorium.length],
      b = auditorium[i],
      s = section(a, b),
      half = s.length / 2;
    const y0 = Math.min(grade(...a), grade(...b)) - 0.29;
    const ts = splits
      .filter((z) => z > Math.min(a[1], b[1]) + 1e-6 && z < Math.max(a[1], b[1]) - 1e-6)
      .map((z) => (z - a[1]) / (b[1] - a[1]))
      .sort((x, y) => x - y);
    const upper = [0, ...ts, 1].map((t) => [mix(-half, half, t), barrel(mix(a[1], b[1], t))]);
    fill(
      out,
      s,
      'brick',
      [[-half, y0], [half, y0], ...upper.toReversed()],
      i % 3 === 0 ? tint.paleBrick : tint.brick,
    );
    band(
      out,
      s,
      'concrete',
      [-half, y0],
      [half, Math.max(grade(...a), grade(...b)) + 0.33],
      0,
      0.037,
      tint.concrete,
    );
    if (lod >= 1 && s.length > 7) {
      const count = Math.max(2, Math.floor(s.length / 4.45));
      for (let j = 0; j <= count; j++) {
        const u = mix(-half + 0.18, half - 0.18, j / count);
        const z = s.p(u, 0)[2];
        band(
          out,
          s,
          'concrete',
          [u - 0.14, y0],
          [u + 0.14, barrel(z) - 0.13],
          0,
          0.045,
          tint.concrete,
          lod >= 2,
        );
      }
      for (const y of [3.86, 8.05, 11.83])
        band(
          out,
          s,
          'concrete',
          [-half, y],
          [half, y + 0.19],
          -0.01,
          0.057,
          tint.concrete,
          lod >= 2,
        );
    }
  }
  const fly = plan.auditorium;
  const p = [
    [auditorium[3][0], auditorium[3][1]],
    [fly.flyEast, -20.68],
    [fly.flyEast, 2.92],
    [auditorium[2][0], auditorium[2][1]],
  ];
  top(out, 'roof', p, () => fly.flyTop, tint.roof);
  for (let i = 0; i < 4; i++) {
    const s = section(p[(i + 1) % 4], p[i]),
      h = s.length / 2;
    fill(out, s, 'brick', rect(-h, fly.eaves - 0.1, h, fly.flyTop), tint.brick);
    band(
      out,
      s,
      'concrete',
      [-h, fly.flyTop - 0.18],
      [h, fly.flyTop + 0.06],
      -0.06,
      0.14,
      tint.concrete,
      lod >= 1,
    );
  }
}

function southLobby(out, lod) {
  const cfg = plan.lobby,
    s = section([left, front], [right, front]),
    h = s.length / 2;
  const [low, open] = [cfg.threshold, 3.53];
  const opening = [
    [-h, -0.3],
    [-open, -0.3],
    [-open, cfg.entranceTop],
    [open, cfg.entranceTop],
    [open, -0.3],
    [h, -0.3],
    [h, cfg.eaves],
    [-h, cfg.eaves],
  ];
  const windows = [-2.27, 0, 2.27].map((x) => rect(x - 0.58, 5.6, x + 0.58, 8.26));
  fill(out, s, 'plaster', opening, tint.cream, 0, lod >= 2 ? windows : []);
  for (const w of windows) {
    const [[a, b], [c], [, d]] = w;
    fill(out, s, 'detail', w, tint.pane, lod >= 2 ? -0.1 : 0.025);
    for (const x of [a - 0.027, c - 0.02])
      band(
        out,
        s,
        'concrete',
        [x, b - 0.08],
        [x + 0.06, d + 0.12],
        -0.055,
        0.031,
        tint.light,
        lod >= 2,
      );
    if (lod >= 1) {
      for (let i = 1; i < (lod >= 2 ? 6 : 3); i++) {
        const u = mix(a, c, i / (lod >= 2 ? 6 : 3));
        band(out, s, 'detail', [u - 0.013, b], [u + 0.013, d], 0, 0.039, tint.gold);
      }
      for (const y of [b + 0.87, b + 1.75])
        band(out, s, 'detail', [a, y - 0.019], [c, y + 0.019], 0, 0.041, tint.white);
    }
  }
  for (const x of [-3.31, 3.31]) {
    fill(
      out,
      s,
      'tile',
      [
        [x - 0.085, 5.41],
        [x + 0.085, 5.41],
        [x + 0.085, 8.96],
        [x, 9.19],
        [x - 0.085, 8.96],
      ],
      tint.ochre,
      0.053,
    );
    if (lod >= 2)
      for (let y = 8.17; y < 8.89; y += 0.14)
        band(out, s, 'tile', [x - 0.22, y], [x + 0.22, y + 0.046], 0.02, 0.059, tint.ochre);
  }
  for (const a of [-h, open]) {
    const b = a < 0 ? -open : h;
    band(out, s, 'tile', [a, low], [b, cfg.entranceTop - 0.055], 0, 0.1, tint.terra, lod >= 1);
    if (lod >= 1) {
      const x = (a + b) / 2;
      band(
        out,
        s,
        'tile',
        [x - 0.29, low + 0.08],
        [x + 0.29, cfg.entranceTop - 0.22],
        0.03,
        0.135,
        tint.amber,
        lod >= 2,
      );
      for (let y = low + 0.18; y < cfg.entranceTop - 0.45; y += 0.45)
        diamond(out, s, x, y, 0.17, 0.15, 0.146, tint.turquoise);
      band(
        out,
        s,
        'detail',
        [x - 0.32, 1.22],
        [x + 0.32, 2.36],
        0.102,
        0.156,
        tint.charcoal,
        lod >= 2,
      );
      band(out, s, 'detail', [x - 0.25, 1.34], [x + 0.25, 2.2], 0.136, 0.167, tint.darkTeal);
    }
  }
  coping(out, s, cfg.eaves, lod);
}

function coping(out, s, y, lod) {
  const h = s.length / 2,
    n = Math.ceil(s.length / 0.69);
  for (let i = 0; i < n; i++) {
    const a = mix(-h, h, i / n),
      b = mix(-h, h, (i + 1) / n),
      x = (a + b) / 2;
    const shape = [
      [a, y - 0.62],
      [b, y - 0.62],
      [b, y - 0.045],
      [x, y + 0.19],
      [a, y - 0.045],
    ];
    fill(out, s, 'plaster', shape, i % 2 === 0 ? tint.light : tint.cream, 0.075);
    for (const [p, q] of [
      [
        [a, y - 0.045],
        [x, y + 0.19],
      ],
      [
        [x, y + 0.19],
        [b, y - 0.045],
      ],
    ])
      ribbon(out, s, p, q, lod === 0 ? 0.075 : 0.095, 0.096, tint.copper);
    if (lod >= 1) {
      diamond(out, s, x, y - 0.067, 0.123, 0.104, 0.104, tint.turquoise);
      diamond(out, s, x, y - 0.067, 0.054, 0.049, 0.111, tint.terra);
      fill(
        out,
        s,
        'detail',
        [
          [x - 0.18, y - 0.59],
          [x + 0.18, y - 0.59],
          [x, y - 0.24],
        ],
        tint.ochre,
        0.092,
      );
    }
  }
  band(out, s, 'metal', [-h, y - 0.68], [h, y - 0.6], 0, 0.107, tint.copper, lod >= 2);
}

function lobbyShell(out, lod) {
  const y = plan.lobby.eaves;
  top(out, 'roof', lobby, () => y - 0.4, tint.roofLight);
  for (let i = 0; i < lobby.length; i++) {
    const a = lobby[(i + 1) % lobby.length],
      b = lobby[i];
    if (i === 3) continue;
    const s = section(a, b),
      h = s.length / 2,
      low = Math.min(grade(...a), grade(...b)) - 0.27;
    fill(
      out,
      s,
      'plaster',
      rect(-h, low, h, y - 0.13),
      i % 2 === 0 ? tint.cream : tint.darkPlaster,
    );
    if (i === 2 || i === 4) coping(out, s, y, lod === 0 ? 0 : 1);
  }
  southLobby(out, lod);
  const cfg = plan.lobby;
  box(
    out,
    'concrete',
    [left + 0.06, -0.23, cfg.doorsZ],
    [right - 0.06, cfg.threshold, front + 0.3],
    tint.sidewalk,
  );
  box(
    out,
    'plaster',
    [left + 0.07, cfg.entranceTop - 0.12, cfg.doorsZ],
    [right - 0.07, cfg.entranceTop, front],
    tint.darkPlaster,
  );
  for (const x of [left + 0.54, right - 0.54])
    box(
      out,
      'tile',
      [x - 0.05, cfg.threshold, cfg.doorsZ],
      [x + 0.05, cfg.entranceTop - 0.09, front],
      tint.terra,
    );
  const s = section([left, cfg.doorsZ], [right, cfg.doorsZ]);
  fill(
    out,
    s,
    'plaster',
    rect(-s.length / 2, cfg.threshold, s.length / 2, cfg.entranceTop),
    tint.darkPlaster,
  );
  for (let i = 0; i < 6; i++) {
    const x = mix(-3.16, 3.16, (i + 0.5) / 6);
    band(
      out,
      s,
      'metal',
      [x - 0.49, cfg.threshold],
      [x + 0.49, 3.23],
      0,
      0.043,
      tint.door,
      lod >= 2,
    );
    band(out, s, 'detail', [x - 0.4, 0.26], [x + 0.4, 3.02], 0.034, 0.052, tint.pane);
    if (lod >= 2) band(out, s, 'metal', [x + 0.3, 1.29], [x + 0.43, 1.35], 0.043, 0.083, tint.gold);
  }
  if (lod >= 2) {
    for (let i = 0; i < 15; i++)
      for (let j = 0; j < 4; j++) {
        const x = left + 0.18 + i * 0.56,
          z = front + 0.18 - j * 0.58;
        oriented(
          out,
          'tile',
          [
            [x, cfg.threshold + 0.004, z],
            [x + 0.51, cfg.threshold + 0.004, z],
            [x + 0.51, cfg.threshold + 0.004, z - 0.51],
            [x, cfg.threshold + 0.004, z - 0.51],
          ],
          [0, 1, 0],
          (i + j) % 3 === 0 ? tint.redTile : tint.tileLight,
        );
      }
  }
}

function booth(out, lod) {
  const y = plan.lobby.threshold,
    z = front - 0.63;
  box(out, 'tile', [center - 0.65, y, z - 0.54], [center + 0.65, 1.03, z + 0.5], tint.amber);
  box(out, 'metal', [center - 0.6, 1.03, z - 0.48], [center + 0.6, 2.31, z + 0.44], tint.charcoal);
  box(
    out,
    'metal',
    [center - 0.73, 2.27, z - 0.61],
    [center + 0.73, 2.51, z + 0.56],
    tint.darkTeal,
  );
  const s = section([center - 0.6, z + 0.441], [center + 0.6, z + 0.441]);
  band(out, s, 'detail', [-0.46, 1.19], [0.46, 2.13], 0, 0.024, tint.pane);
  band(out, s, 'metal', [-0.6, 1.01], [0.6, 1.09], 0, 0.1, tint.gold, lod >= 2);
  if (lod >= 1) {
    const face0 = section([center - 0.65, z + 0.501], [center + 0.65, z + 0.501]);
    const path = [
      [-0.18, 0.84],
      [-0.03, 0.65],
      [-0.13, 0.49],
      [0.04, 0.35],
      [0.15, 0.17],
    ];
    for (let i = 1; i < path.length; i++)
      ribbon(out, face0, path[i - 1], path[i], 0.084, 0.035, tint.darkTeal);
    for (const x of [-0.45, 0.45])
      band(out, face0, 'tile', [x - 0.036, y], [x + 0.036, 0.98], 0, 0.023, tint.rust);
  }
}

// A compact fixed-width sign alphabet, authored as raised tiles on the photographed readerboard.
const glyphs = {
  A: [2, 5, 7, 5, 5],
  B: [6, 5, 6, 5, 6],
  C: [3, 4, 4, 4, 3],
  E: [7, 4, 6, 4, 7],
  H: [5, 5, 7, 5, 5],
  I: [7, 2, 2, 2, 7],
  L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5],
  N: [5, 7, 7, 7, 5],
  O: [7, 5, 5, 5, 7],
  P: [6, 5, 6, 4, 4],
  R: [6, 5, 6, 5, 5],
  T: [7, 2, 2, 2, 2],
  Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7],
  0: [7, 5, 5, 5, 7],
  1: [2, 6, 2, 2, 7],
  2: [6, 1, 7, 4, 7],
  3: [6, 1, 3, 1, 6],
  4: [5, 5, 7, 1, 1],
  7: [7, 1, 2, 2, 2],
  ':': [0, 2, 0, 2, 0],
  '-': [0, 0, 7, 0, 0],
};
function message(out, s, text, y, w, h, d) {
  const dx = w / (text.length * 4),
    dy = h / 5;
  for (let i = 0; i < text.length; i++) {
    const glyph = glyphs[text[i]];
    if (!glyph) continue;
    for (let j = 0; j < 5; j++)
      for (let k = 0; k < 3; k++)
        if (glyph[j] & (4 >> k)) {
          const x = -w / 2 + (4 * i + k) * dx;
          band(
            out,
            s,
            'detail',
            [x, y + (4 - j) * dy],
            [x + dx * 0.91, y + (4 - j + 0.93) * dy],
            d,
            d + 0.003,
            tint.letter,
          );
        }
  }
}

function marquee(out, lod) {
  const { bottom, top: y } = plan.marquee;
  const z = (canopy[1][1] + canopy[2][1]) / 2;
  const s = section(canopy[1], canopy[2]),
    h = s.length / 2;
  top(out, 'metal', canopy, () => y + 0.04, tint.copper);
  top(out, 'metal', canopy, () => bottom + 0.018, tint.gold, [0, -1, 0]);
  for (let i = 0; i < canopy.length; i++) {
    if (i === 1) continue;
    const side = section(canopy[i], canopy[(i + 1) % canopy.length]),
      r = side.length / 2;
    band(out, side, 'metal', [-r, bottom], [r, y], 0, 0.035, tint.copper, lod >= 1);
  }
  band(out, s, 'metal', [-h, bottom], [h, y], -0.035, 0.054, tint.white, lod >= 1);
  band(
    out,
    s,
    'detail',
    [-h + 0.28, bottom + 0.19],
    [h - 0.28, y - 0.17],
    0.026,
    0.068,
    tint.board,
    lod >= 1,
  );
  for (const x of [canopy[1][0] + 0.18, canopy[2][0] - 0.18]) {
    box(
      out,
      'metal',
      [x - 0.14, bottom - 0.048, z - 0.16],
      [x + 0.14, y + 0.058, z + 0.18],
      tint.white,
    );
    box(out, 'metal', [x - 0.2, y + 0.02, z - 0.21], [x + 0.2, y + 0.15, z + 0.21], tint.light);
  }
  if (lod >= 1) {
    const lines =
      lod === 1
        ? ['AZ CENTENNIAL', 'ANNIE HALL']
        : ['2-10 - 2-12 AZ CENTENNIAL CELEBRATION', '2-14 ANNIE HALL 7:30PM'];
    message(out, s, lines[0], bottom + 0.65, lod === 1 ? 5.2 : 7.3, 0.28, 0.079);
    message(out, s, lines[1], bottom + 0.27, lod === 1 ? 4.3 : 5.05, 0.28, 0.079);
  }
  if (lod >= 2) {
    for (let x = -h + 0.33; x < h - 0.2; x += 0.22) {
      band(
        out,
        s,
        'detail',
        [x - 0.031, bottom + 0.079],
        [x + 0.031, bottom + 0.126],
        0.058,
        0.071,
        tint.gold,
      );
      band(
        out,
        s,
        'detail',
        [x - 0.031, y - 0.098],
        [x + 0.031, y - 0.052],
        0.061,
        0.074,
        tint.gold,
      );
    }
    for (const u of [-h + 0.17, h - 0.17])
      for (let j = 0; j < 3; j++) {
        const low = bottom + 0.26 + j * 0.25;
        ribbon(out, s, [u - 0.077, low], [u + 0.077, low + 0.2], 0.026, 0.081, tint.ochre);
        ribbon(out, s, [u + 0.077, low], [u - 0.077, low + 0.2], 0.026, 0.082, tint.ochre);
      }
  }
}

function signLetters(out, s, y, d, lod) {
  const color = tint.letter;
  const slab = (a, b, c, e) => band(out, s, 'detail', [a, y + b], [c, y + e], d, d + 0.003, color);
  const f = 5.9,
    o = 3.47,
    x = 1.02;
  slab(-0.46, f, -0.26, f + 1.96);
  slab(-0.55, f, -0.14, f + 0.1);
  slab(-0.54, f + 1.83, 0.43, f + 1.96);
  slab(-0.29, f + 0.89, 0.25, f + 1.04);
  slab(0.31, f + 1.58, 0.43, f + 1.92);
  slab(0.17, f + 0.77, 0.26, f + 1.18);
  const n = [9, 13, 20, 26][lod],
    oval = (r, h) =>
      Array.from({ length: n }, (_, i) => [
        r * Math.cos((i * 2 * Math.PI) / n),
        y + o + 0.98 + h * Math.sin((i * 2 * Math.PI) / n),
      ]);
  fill(out, s, 'detail', oval(0.47, 1.0), color, d + 0.004, [oval(0.26, 0.83)]);
  ribbon(out, s, [-0.39, y + x], [0.41, y + x + 1.97], 0.16, d + 0.006, color);
  ribbon(out, s, [0.4, y + x], [-0.4, y + x + 1.97], 0.2, d + 0.009, color);
  for (const yy of [x, x + 1.9])
    for (const u of [-0.39, 0.39]) slab(u - 0.12, yy, u + 0.12, yy + 0.1);
}

function blade(out, lod) {
  const { x, z, halfDepth: h, bottom, top: y } = plan.blade;
  const plate = [
    [-h, bottom + 0.17],
    [0, bottom - 0.05],
    [h, bottom + 0.17],
    [h, y - 0.38],
    [0, y],
    [-h, y - 0.38],
  ];
  for (const side of [-1, 1]) {
    const b = x + side * 0.14;
    const s = section([b, z + side * h], [b, z - side * h]);
    fill(out, s, 'metal', plate, tint.board);
    for (let i = 0; i < plate.length; i++) {
      const a = plate[i],
        q = plate[(i + 1) % plate.length];
      ribbon(out, s, a, q, 0.055, 0.018, tint.gold);
      if (side === 1)
        face(out, 'metal', [s.p(...a), s.p(...q), s.p(...q, -0.28), s.p(...a, -0.28)], tint.copper);
    }
    signLetters(out, s, bottom, 0.031, lod);
    if (lod >= 1)
      for (const cy of [bottom + 0.46, y - 0.57])
        for (const u of [-0.34, 0, 0.34]) {
          diamond(out, s, u, cy, 0.13, 0.2, 0.031, tint.gold);
          diamond(out, s, u, cy, 0.081, 0.134, 0.036, tint.board);
          if (lod >= 2) diamond(out, s, u, cy, 0.03, 0.049, 0.043, tint.ochre);
        }
  }
  for (const yy of [bottom + 0.36, bottom + 3.17, bottom + 6.32])
    box(
      out,
      'metal',
      [x - 0.095, yy - 0.063, front - 0.08],
      [x + 0.095, yy + 0.073, z],
      tint.copper,
    );
}

function build(out, lod) {
  theatreShell(out, lod);
  lobbyShell(out, lod);
  marquee(out, lod);
  booth(out, lod);
  blade(out, lod);
}
export const foxSkyline = (out) => build(out, 0);
export const foxDistrict = (out) => build(out, 1);
export const foxStreet = (out) => build(out, 2);
export const foxCloseup = (out) => build(out, 3);
const recipe = 'fox-tucson-theatre-model.mjs';
const camera = [-42, 19, 60],
  lookAt = [-8.2, 7.7, 0.6];
export const foxModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: foxCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The historic Tucson theatre with its FOX blade, tiled Art Deco entrance, rectangular marquee, west fly loft and curved auditorium roof.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-24, 40, 51],
  mediumFiContext: {
    scale: 1.1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    outlines: [outline, canopy],
    minimumCoverage: 0.92,
    basis: 'The two mapped theatre and marquee footprints.',
  },
  embeddedCanonicalGraphs: [
    'stucco',
    'brick',
    'concrete_plain',
    'metal_standing_seam',
    'tile_mosaic',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'congress-street-marquee-and-blade',
      position: [-12, 6.0, 39.2],
      lookAt: [1.6, 7.2, 16.0],
    },
    { name: 'ticket-booth-and-tiled-entry', position: [0.2, 2.38, 30], lookAt: [1.5, 3.0, 18.0] },
    { name: 'bowstring-roof-and-fly-loft', position: [-48, 29, -32], lookAt: [-11, 8, 0.8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-theatre-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'foxSkyline',
    errorMeters: 1.05,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'foxDistrict', 0.46],
        ['street', 'foxStreet', 0.16],
        ['closeup', 'foxCloseup', 0.057],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The footprint is ODbL. Five exact Qualla photographs by Ammodramus are CC0.',
};
