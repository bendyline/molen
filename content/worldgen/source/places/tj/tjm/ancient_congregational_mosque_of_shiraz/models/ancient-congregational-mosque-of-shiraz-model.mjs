/** Atiq Jameh Mosque of Shiraz, its open court and the Khuda Khane pavilion. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));
const plan = read('plan-controls.json');
const grid = read('terrain-grid.json');
const controls = read('native-map/courtyard-controls.json');
const { floor, arcadeEave, northPortal, southPortal, westPortal, eastPortal, pavilion } =
  plan.dimensions;
const {
  basis: {
    courtRight: [ux, uz],
    courtSouth: [vx, vz],
  },
  perimeterInCourtFrame: main,
  connectedNorthRangeInCourtFrame: north,
} = controls;
const pal = 'palette:#ffffff';
const up = [0, 1, 0];
const c = Object.fromEntries(
  Object.entries({
    brick: 'b9a788',
    shadowBrick: 'a18b70',
    lintel: 'c1ac8d',
    stone: 'c6b69d',
    stoneDark: 'ada18e',
    pale: 'c8bead',
    frieze: '789099',
    turquoise: '7dacab',
    blue: '5c7894',
    roof: 'b5a992',
    raisedRoof: 'ada28b',
    paving: 'b9ae9d',
    dark: '6d6657',
    darkGreen: '798b83',
    glass: '9ba9a0',
    cream: 'c6b9a3',
  }).map(([key, value]) => [key, rgb(value)]),
);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.93, metallic: 0 },
  cutStone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.88, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96, metallic: 0 },
  court: { slot: 'foundation', graph: 'stone_marble', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'stone_limestone_raw', roughness: 0.93, metallic: 0 },
  tiles: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.78, metallic: 0 },
  paint: { slot: 'trim', localRef: pal, roughness: 0.85, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.59, metallic: 0.025 },
};
const geo = ([u, y, v]) => [ux * u + vx * v, y, uz * u + vz * v];
const xz = ([u, v]) => [ux * u + vx * v, uz * u + vz * v];

function face(out, slot, points, toward, color, uv = ([u, y, v]) => [u - v * 0.4, y]) {
  const n = normalFor(...points);
  const sign = n.reduce((s, v, i) => s + v * toward[i], 0) < 0 ? -1 : 1;
  out.addConvexPolygon(
    slot,
    pal,
    points.map(geo),
    geo(n.map((v) => v * sign)),
    ([x, y, z]) => uv([x * ux + z * uz, y, x * vx + z * vz]),
    color,
  );
}

function cap(out, slot, ring, y, color) {
  const indices = earcut(ring.flat());
  if (indices.length === 0) throw Error('Invalid mosque outline');
  for (let i = 0; i < indices.length; i += 3) {
    const points = indices.slice(i, i + 3).map((index) => {
      const [u, v] = ring[index];
      return [u, y, v];
    });
    face(out, slot, points, up, color, ([u, , v]) => [u, v]);
  }
}

function field(u, v) {
  const [x, z] = xz([u, v]);
  const a = (x - grid.origin[0]) / grid.stepMeters,
    b = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(a),
    j = Math.floor(b),
    t = a - i,
    r = b - j;
  const lo = grid.heightsMeters[j],
    hi = grid.heightsMeters[j + 1];
  return (
    (lo[i] * (1 - t) + lo[i + 1] * t) * (1 - r) +
    (hi[i] * (1 - t) + hi[i + 1] * t) * r -
    grid.modelDatumElevationMeters
  );
}

function line(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / length,
    tz = (b[1] - a[1]) / length;
  const normal = [-tz, 0, tx];
  return {
    length,
    normal,
    tangent: [tx, 0, tz],
    p: (u, y, d = 0) => [a[0] + tx * u - tz * d, y, a[1] + tz * u + tx * d],
    uv: ([u, y, v]) => [tx * u + tz * v, y],
  };
}

function panel(out, slot, edge, a, b, y0, y1, d, color) {
  if (b - a < 0.001 || y1 - y0 < 0.001) return;
  const { p, normal, uv } = edge;
  face(out, slot, [p(a, y0, d), p(b, y0, d), p(b, y1, d), p(a, y1, d)], normal, color, uv);
}

function block(out, slot, edge, a, b, lo, hi, d0, d1, color) {
  const { p, normal, tangent } = edge;
  panel(out, slot, edge, a, b, lo, hi, d1, color);
  face(
    out,
    slot,
    [p(a, lo, d0), p(b, lo, d0), p(b, hi, d0), p(a, hi, d0)],
    normal.map((v) => -v),
    color,
    edge.uv,
  );
  for (const [x, sign] of [
    [a, -1],
    [b, 1],
  ])
    face(
      out,
      slot,
      [p(x, lo, d0), p(x, lo, d1), p(x, hi, d1), p(x, hi, d0)],
      tangent.map((v) => sign * v),
      color,
    );
  for (const [y, sign] of [
    [lo, -1],
    [hi, 1],
  ])
    face(
      out,
      slot,
      [p(a, y, d0), p(b, y, d0), p(b, y, d1), p(a, y, d1)],
      [0, sign, 0],
      color,
      ([u, , v]) => [u, v],
    );
}

function depthProfile(out, edge, section, slot, color) {
  const { u, half, lo, spring, peak, front, back } = section;
  const { p, normal, uv, tangent } = edge;
  const sides = [u - half, u + half];
  for (const [i, x] of sides.entries()) {
    face(
      out,
      slot,
      [p(x, lo, front), p(x, lo, back), p(x, spring, back), p(x, spring, front)],
      tangent.map((v) => v * (i === 0 ? 1 : -1)),
      color,
      uv,
    );
  }
  face(
    out,
    'court',
    [p(u - half, lo, back), p(u + half, lo, back), p(u + half, lo, front), p(u - half, lo, front)],
    up,
    c.paving,
  );
  const isPortal = front - back > 1;
  const backing = isPortal ? 'brick' : 'paint';
  const backingColor = isPortal ? c.shadowBrick : c.dark;
  panel(out, backing, edge, u - half, u + half, lo, spring, back, backingColor);
  for (let i = 1; i < peak.length; i++) {
    const [a, y] = peak[i - 1],
      [b, z] = peak[i];
    face(
      out,
      slot,
      [p(a, y, front), p(b, z, front), p(b, z, back), p(a, y, back)],
      [0, -1, 0],
      color,
      uv,
    );
    face(
      out,
      backing,
      [p(u, spring, back), p(a, y, back), p(b, z, back)],
      normal,
      backingColor,
      uv,
    );
  }
}

function pointedProfile(u, half, spring, rise, pieces) {
  return Array.from({ length: pieces + 1 }, (_, i) => {
    const t = (2 * i) / pieces - 1,
      k = 0.38;
    const q =
      Math.sqrt(Math.max(0, (1 + k) * (1 + k) - (Math.abs(t) + k) * (Math.abs(t) + k))) /
      Math.sqrt(1 + 2 * k);
    return [u + half * t, spring + rise * q];
  });
}

function arch(out, edge, shape, lod) {
  const {
    u,
    half,
    bay,
    lo,
    spring,
    rise,
    top,
    front,
    back,
    slot = 'brick',
    color = c.brick,
    trim = 'cutStone',
    trimColor = c.lintel,
  } = shape;
  const { p, normal, uv } = edge;
  const pieces = [2, 6, 10, 14][lod];
  const peak = pointedProfile(u, half, spring, rise, pieces);
  const widest = half + Math.min(0.28, half * 0.21);
  const rim = pointedProfile(u, widest, spring, rise + Math.min(0.26, rise * 0.27), pieces);
  for (const side of [-1, 1]) {
    const a = u + side * bay,
      b = u + side * half;
    panel(out, slot, edge, Math.min(a, b), Math.max(a, b), lo, top, front, color);
    if (lod > 0)
      panel(
        out,
        trim,
        edge,
        Math.min(b, u + side * widest),
        Math.max(b, u + side * widest),
        lo,
        spring,
        front + 0.037,
        trimColor,
      );
  }
  for (let i = 1; i < peak.length; i++) {
    const [a, y] = peak[i - 1],
      [b, z] = peak[i];
    face(
      out,
      slot,
      [p(a, y, front), p(b, z, front), p(b, top, front), p(a, top, front)],
      normal,
      color,
      uv,
    );
    if (lod > 0) {
      const [c1, h1] = rim[i - 1],
        [c2, h2] = rim[i];
      face(
        out,
        trim,
        [
          p(a, y, front + 0.032),
          p(c1, h1, front + 0.032),
          p(c2, h2, front + 0.032),
          p(b, z, front + 0.032),
        ],
        normal,
        trimColor,
        uv,
      );
    }
  }
  if (back !== undefined)
    depthProfile(out, edge, { u, half, lo, spring, front, back, peak }, slot, color);
}

function gradeWall(out, ring, y, color, outerOnly, lod) {
  const points = ring.map((p, i) => [p, ring[(i + 1) % ring.length]]);
  for (const [i, [a, b]] of points.entries()) {
    if (outerOnly && i < 5) continue;
    const edge = line(b, a),
      { p, normal, uv, length } = edge;
    const base = ([u, v]) => Math.min(floor - 0.32, field(u, v) - 0.52);
    face(
      out,
      lod === 0 ? 'brick' : 'foundation',
      [
        p(0, base(b)),
        p(length, base(a)),
        p(length, lod === 0 ? y : floor),
        p(0, lod === 0 ? y : floor),
      ],
      normal,
      lod === 0 ? color : c.stoneDark,
      uv,
    );
    if (lod > 0) panel(out, 'brick', edge, 0, length, floor, y, 0, color);
  }
}

function round(out, slot, center, profile, sides, color) {
  const rings = profile.map(([y, r]) => radialRing(y, r, r, sides, center).map(geo));
  loft(out, slot, rings, color);
}

function facadeCap(out, edge, from, to, top, d0, d1, color) {
  const { p } = edge;
  face(
    out,
    'roof',
    [p(from, top, d0), p(to, top, d0), p(to, top, d1), p(from, top, d1)],
    up,
    color,
    ([u, , v]) => [u, v],
  );
}

const courtSides = [
  { edge: line(main[3], main[2]), portal: northPortal, fraction: 0.56, towers: true },
  { edge: line(main[2], main[1]), portal: eastPortal, fraction: 0.58, towers: false },
  { edge: line(main[1], main[0]), portal: southPortal, fraction: 0.72, towers: false },
  { edge: line(main[5], main[3]), portal: westPortal, fraction: 0.4, towers: false },
];

function smallArcades(out, edge, a, b, lod) {
  const count = Math.max(1, Math.round((b - a) / (lod === 0 ? 6.5 : 4.15)));
  const bay = (b - a) / (2 * count);
  const top = arcadeEave - 0.43;
  for (let i = 0; i < count; i++) {
    const u = a + bay * (2 * i + 1);
    if (lod === 0) {
      panel(out, 'brick', edge, u - bay, u + bay, floor, top, 0.25, c.brick);
      panel(out, 'paint', edge, u - bay * 0.64, u + bay * 0.64, floor + 0.09, 3.62, 0.27, c.dark);
    } else {
      arch(
        out,
        edge,
        {
          u,
          half: bay * 0.65,
          bay,
          lo: floor,
          spring: 2.38,
          rise: 1.48,
          top,
          front: 0.31,
          back: lod > 1 ? 0.014 : undefined,
          trim: 'tiles',
          trimColor: i % 2 === 0 ? c.turquoise : c.cream,
        },
        lod,
      );
      if (lod === 1) panel(out, 'paint', edge, u - bay, u + bay, floor, top, 0.07, c.dark);
      if (lod > 1 && i % 3 !== 0) {
        panel(out, 'glass', edge, u - bay * 0.55, u + bay * 0.55, 0.25, 2.36, 0.05, c.glass);
        const { normal, p, uv } = edge;
        const crown = pointedProfile(u, bay * 0.54, 2.36, 1.15, 6);
        for (let k = 1; k < crown.length; k++) {
          const [a, y] = crown[k - 1];
          const [b, z] = crown[k];
          face(
            out,
            'tiles',
            [p(u, 2.36, 0.06), p(a, y, 0.06), p(b, z, 0.06)],
            normal,
            c.frieze,
            uv,
          );
        }
        for (const r of [-0.55, 0, 0.55])
          panel(
            out,
            'paint',
            edge,
            u + bay * r - 0.032,
            u + bay * r + 0.032,
            0.24,
            2.42,
            0.09,
            c.cream,
          );
      }
    }
  }
  panel(out, 'tiles', edge, a, b, top, top + 0.16, 0.37, c.frieze);
  if (lod === 0) panel(out, 'brick', edge, a, b, top + 0.155, arcadeEave + 0.07, 0.38, c.lintel);
  else block(out, 'brick', edge, a, b, top + 0.155, arcadeEave + 0.07, -0.42, 0.42, c.lintel);
}

function upperTurret(out, edge, u, y, peak, lod) {
  const { p } = edge;
  const center = p(u, 0, 2.18);
  const at = [center[0], center[2]];
  const sides = lod === 0 ? 5 : 8;
  round(
    out,
    'cutStone',
    at,
    [
      [y - 0.44, 0.75],
      [y + 0.24, 0.86],
      [y + 0.58, 0.8],
    ],
    sides,
    c.lintel,
  );
  const capY = peak - 0.87;
  if (lod === 0)
    round(
      out,
      'cutStone',
      at,
      [
        [y + 0.31, 0.61],
        [capY, 0.65],
      ],
      6,
      c.stoneDark,
    );
  else {
    for (let i = 0; i < sides; i++) {
      const angle = (Math.PI * 2 * i) / sides;
      const offset = [at[0] + 0.63 * Math.cos(angle), at[1] + 0.63 * Math.sin(angle)];
      round(
        out,
        'cutStone',
        offset,
        [
          [y + 0.45, 0.145],
          [capY, 0.15],
        ],
        lod === 1 ? 4 : 6,
        c.stone,
      );
    }
  }
  round(
    out,
    'roof',
    at,
    [
      [capY - 0.06, 1.01],
      [capY + 0.17, 1.02],
      [peak, 0.09],
    ],
    sides,
    c.raisedRoof,
  );
}

function facets(out, edge, u, half, spring, rise, lod) {
  if (lod < 2) return;
  const { p } = edge;
  const steps = lod === 3 ? 10 : 6;
  const rows = lod === 3 ? 5 : 3;
  for (let i = 0; i < rows; i++) {
    const radius = half * (0.96 - 0.08 * i);
    const base = spring + 0.25 * i;
    const line = pointedProfile(u, radius, base, rise - 0.25 * i, steps);
    for (let k = 1; k < line.length; k++) {
      const [a, y] = line[k - 1],
        [b, z] = line[k];
      const d = 2.96 - 0.46 * i;
      const low = p((a + b) * 0.5, (y + z) * 0.5 - 0.33, d - 0.24);
      face(
        out,
        'tiles',
        [p(a, y, d), p(b, z, d), low],
        [0, -1, 0],
        (k + i) % 3 === 0 ? c.turquoise : c.cream,
      );
    }
  }
}

function iwan(out, side, lod) {
  const { edge, portal, fraction, towers } = side;
  const u = edge.length * fraction;
  const half = portal.width / 2;
  const bay = half + 0.14;
  const top = portal.height;
  const spring = top * 0.53;
  const rise = top * 0.31;
  const depth = towers ? 3.0 : 2.34;
  const lo = floor + 0.035;
  smallArcades(out, edge, 0, u - bay, lod);
  smallArcades(out, edge, u + bay, edge.length, lod);
  arch(
    out,
    edge,
    {
      u,
      half: half * 0.72,
      bay,
      lo,
      spring,
      rise,
      top: top - 0.39,
      front: depth,
      back: 0.12,
      trim: 'tiles',
      trimColor: c.frieze,
    },
    lod,
  );
  for (const sign of [-1, 1]) {
    const a = u + sign * half;
    block(out, 'brick', edge, a - 0.14, a + 0.14, floor, top - 0.05, -3.26, depth, c.brick);
    if (lod > 0)
      panel(
        out,
        'tiles',
        edge,
        a - 0.12,
        a + 0.12,
        floor + 0.18,
        top - 0.27,
        depth + 0.044,
        c.frieze,
      );
  }
  facadeCap(out, edge, u - bay, u + bay, top - 0.1, -3.44, depth, c.roof);
  block(
    out,
    'cutStone',
    edge,
    u - bay - 0.12,
    u + bay + 0.12,
    top - 0.37,
    top + 0.02,
    depth - 0.4,
    depth + 0.1,
    c.lintel,
  );
  if (lod > 0) {
    panel(
      out,
      'tiles',
      edge,
      u - half + 0.16,
      u + half - 0.16,
      top - 0.91,
      top - 0.48,
      depth + 0.035,
      c.blue,
    );
    if (towers) facets(out, edge, u, half * 0.66, spring, rise, lod);
    if (towers && lod > 1)
      for (const sign of [-1, 1]) {
        const x = u + sign * half * 0.87;
        panel(
          out,
          'cutStone',
          edge,
          x - 0.3,
          x + 0.3,
          floor + 0.12,
          top - 0.58,
          depth + 0.038,
          c.cream,
        );
        for (let i = 0; i < 7; i++) {
          const y = floor + 0.35 + i * 1.25;
          panel(
            out,
            'tiles',
            edge,
            x - 0.22,
            x + 0.22,
            y,
            y + 0.91,
            depth + 0.05,
            i === 0 ? c.turquoise : c.blue,
          );
        }
      }
    if (lod > 1)
      for (let i = 0; i < Math.round(half * 2); i++) {
        const x = u - half + ((i + 0.5) * (half * 2)) / Math.round(half * 2);
        const y = top - 0.69;
        const p = edge.p;
        face(
          out,
          'paint',
          [
            p(x - 0.115, y, depth + 0.053),
            p(x, y - 0.085, depth + 0.053),
            p(x + 0.115, y, depth + 0.053),
            p(x, y + 0.085, depth + 0.053),
          ],
          edge.normal,
          c.cream,
        );
      }
  }
  if (towers)
    for (const side of [-1, 1])
      upperTurret(out, edge, u + side * (half - 0.64), top, portal.turretHeight, lod);
}

const corners = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];
const rect = (w, l) => corners.map(([u, v]) => [(u * w) / 2, (v * l) / 2]);

function khudaKhane(out, lod) {
  const w = pavilion.width,
    l = pavilion.length,
    y = pavilion.platformY,
    eave = pavilion.eaveY;
  const outer = rect(w, l);
  const plinth = rect(w + 0.65, l + 0.65);
  const roof = rect(w + 0.04, l + 0.04);
  const hall = rect(pavilion.coreWidth, pavilion.coreLength);
  cap(out, 'court', plinth, y, c.pale);
  cap(out, 'roof', roof, eave, c.roof);
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    const toward = line(outer[next], outer[i]);
    const slab = line(plinth[next], plinth[i]);
    const core = line(hall[next], hall[i]);
    panel(out, 'cutStone', slab, 0, slab.length, floor - 0.19, y, 0, c.stone);
    panel(out, 'cutStone', core, 0, core.length, y, eave, 0, c.stoneDark);
    const pitch = toward.length / 3;
    for (let bay = 0; bay < 3; bay++) {
      const u = (bay + 0.5) * pitch;
      arch(
        out,
        toward,
        {
          u,
          half: pitch * 0.37,
          bay: pitch / 2,
          lo: y,
          spring: 3.63,
          rise: 1.47,
          top: eave - 0.71,
          front: 0,
          slot: 'cutStone',
          color: c.stone,
          trimColor: c.pale,
        },
        lod,
      );
      if (lod > 1 && bay < 2) {
        const p = toward.p((bay + 1) * pitch, 0, 0.015);
        round(
          out,
          'cutStone',
          [p[0], p[2]],
          [
            [y, 0.24],
            [0.89, 0.22],
            [1.07, 0.17],
            [3.44, 0.143],
            [3.63, 0.22],
          ],
          lod === 3 ? 9 : 6,
          c.pale,
        );
      }
    }
    panel(out, 'tiles', toward, 0, toward.length, eave - 0.74, eave - 0.22, 0.031, c.blue);
    if (lod > 0)
      block(
        out,
        'cutStone',
        toward,
        0,
        toward.length,
        eave - 0.24,
        eave + 0.04,
        -0.1,
        0.11,
        c.lintel,
      );
    if (lod > 1) {
      const n = Math.floor(toward.length / 0.42);
      for (let j = 1; j < n; j++) {
        const x = (j * toward.length) / n;
        const y = eave - 0.47;
        const p = toward.p;
        face(
          out,
          'paint',
          [
            p(x - 0.072, y, 0.053),
            p(x, y - 0.074, 0.053),
            p(x + 0.072, y, 0.053),
            p(x, y + 0.074, 0.053),
          ],
          toward.normal,
          c.cream,
        );
      }
      const x = core.length / 2;
      panel(out, 'paint', core, x - 0.48, x + 0.48, y, 3.63, 0.042, c.dark);
    }
  }
  for (const [u, v] of corners) {
    const center = [u * (w / 2 - 0.74), v * (l / 2 - 0.74)];
    const r = pavilion.corners;
    if (lod === 0) {
      round(
        out,
        'cutStone',
        center,
        [
          [y - 0.1, r],
          [eave + 0.05, r],
        ],
        5,
        c.stone,
      );
      continue;
    }
    const n = [0, 10, 18, 24][lod];
    round(
      out,
      'cutStone',
      center,
      [
        [y - 0.1, r + 0.09],
        [y + 0.12, r],
        [eave - 0.7, r],
      ],
      n,
      c.stone,
    );
    round(
      out,
      'tiles',
      center,
      [
        [eave - 0.71, r + 0.02],
        [eave - 0.23, r + 0.02],
      ],
      n,
      c.frieze,
    );
    round(
      out,
      'cutStone',
      center,
      [
        [eave - 0.25, r],
        [eave - 0.09, r + 0.09],
        [eave + 0.12, r + 0.12],
      ],
      n,
      c.lintel,
    );
  }
}

function draw(out, lod) {
  const pierY = arcadeEave;
  cap(out, 'roof', main, pierY, c.roof);
  cap(out, 'roof', north, pierY, c.raisedRoof);
  gradeWall(out, main, pierY, c.brick, true, lod);
  gradeWall(out, north, pierY, c.shadowBrick, false, lod);
  const court = [main[3], main[2], main[1], [main[5][0], main[1][1] - 1.1]];
  cap(out, 'court', court, floor, c.paving);
  const courtEdge = line(main[1], court[3]);
  const courtBottom = Math.min(floor - 0.16, field(...court[3]) - 0.32);
  panel(out, 'foundation', courtEdge, 0, courtEdge.length, courtBottom, floor, 0, c.stoneDark);
  for (const side of courtSides) iwan(out, side, lod);
  khudaKhane(out, lod);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model,
  slug = id.replaceAll('_', '-');
const camera = geo([126, 114, 131]),
  lookAt = geo([3, 6, -9]);
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  key: id,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: `${slug}-model.mjs`,
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Atiq Jameh Mosque in Shiraz with its open court, four ranges, north entrance turrets and the central Khuda Khane pavilion.',
  camera,
  lookAt,
  sunDirection: geo([-79, 166, 81]),
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.68,
    focus: { center: lookAt },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'khuda-khane-and-open-loggias',
      position: geo([-13.8, 3.5, 11.5]),
      lookAt: geo([0, 3.45, 0]),
    },
    { name: 'north-iwan-and-turrets', position: geo([9, 4.0, -2]), lookAt: geo([5, 7.0, -28]) },
    {
      name: 'open-court-and-mapped-mosque-perimeter',
      position: geo([-58, 98, 90]),
      lookAt: geo([0, 5.2, -16]),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 3.18,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.09, surfaces },
      street: { export: 'street', errorMeters: 0.37, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.12, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Reconstructed from published public-domain Qualla photographs, mapped outlines and the original Terrarium elevation samples.',
};
