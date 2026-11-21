import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
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
  plane,
  rect,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const color = palette({
  stone: 'c4bca9',
  light: 'd2c9b5',
  shadow: '9b9487',
  foundation: 'a09b90',
  flank: 'a08776',
  slate: '535b60',
  slateLight: '63696b',
  metal: '4a4d4b',
  lead: '666963',
  glass: '414b51',
  canopy: '596d71',
  door: '545047',
});
const surfaces = {
  stone: surface('wall', 'stone_limestone', 0.92),
  rear: surface('wall', 'brick_flemish', 0.89),
  trim: surface('trim', 'stone_ashlar', 0.87),
  slate: surface('roof', 'slate', 0.9),
  lead: surface('roof', 'metal_standing_seam', 0.84, 0.19),
  glass: surface('window', 'storefront', 0.58, 0.04),
  wood: surface('door', 'wood_plain', 0.82),
  iron: surface('trim', 'metal_painted', 0.76, 0.23),
};
const up = [0, 1, 0];
const down = [0, -1, 0];

function sill(out, wall, left, right, y, rise, depth, tint = color.light) {
  panel(out, 'trim', wall, left, right, y, y + rise, depth, tint);
  face(
    out,
    'trim',
    [
      wall.p(left, y + rise),
      wall.p(right, y + rise),
      wall.p(right, y + rise, depth),
      wall.p(left, y + rise, depth),
    ],
    up,
    tint,
  );
}

function stoneBand(out, wall, from, to, y, height, depth, lod) {
  sill(out, wall, from, to, y, height, depth, color.light);
  if (lod) {
    sill(out, wall, from + 0.045, to - 0.045, y - 0.16, 0.16, depth * 0.69, color.shadow);
    sill(out, wall, from, to, y + height, 0.14, depth * 0.81, color.stone);
  }
  if (lod > 1) {
    const brackets = Math.floor((to - from) / (lod === 3 ? 0.57 : 0.79));
    for (let i = 0; i < brackets; i++) {
      const u = mix(from, to, (i + 0.5) / brackets);
      panel(out, 'trim', wall, u - 0.078, u + 0.078, y - 0.27, y + 0.05, depth * 0.8, color.stone);
    }
  }
}

function squaredWindow(out, wall, u, low, high, width, lod, ornate = false) {
  const l = u - width * 0.5;
  const r = u + width * 0.5;
  opening(out, wall, l, r, low, high, 'trim', color.glass, 'glass', color.light, lod, 0.027);
  if (lod > 0) {
    sill(out, wall, l - 0.15, r + 0.15, low - 0.09, 0.12, 0.17);
    if (ornate) sill(out, wall, l - 0.21, r + 0.21, high + 0.055, 0.15, 0.175);
  }
  if (lod > 1) {
    panel(out, 'trim', wall, u - 0.032, u + 0.032, low, high, 0.073, color.stone);
    panel(
      out,
      'trim',
      wall,
      l,
      r,
      mix(low, high, 0.65) - 0.042,
      mix(low, high, 0.65) + 0.042,
      0.071,
      color.stone,
    );
  }
}

function sashArch(out, wall, u, low, spring, half, rise, lod, slot = 'glass') {
  arch(
    out,
    wall,
    u,
    low,
    spring,
    half,
    rise,
    0.032,
    lod,
    { inner: slot === 'wood' ? color.door : color.glass, trim: color.light, width: 0.145 },
    { inner: slot, trim: 'trim' },
  );
  if (lod > 1) {
    panel(out, 'trim', wall, u - 0.03, u + 0.03, low, spring + rise - 0.04, 0.077, color.stone);
    panel(
      out,
      'trim',
      wall,
      u - half + 0.08,
      u + half - 0.08,
      spring - 0.07,
      spring,
      0.075,
      color.stone,
    );
  }
}

function stoneColumn(out, [x, z], floor, top, width, lod) {
  const radius = width / 2;
  block(
    out,
    'trim',
    x - radius * 1.29,
    floor,
    z - radius * 1.3,
    width * 1.29,
    0.26,
    width * 1.3,
    color.light,
  );
  if (!lod) {
    block(
      out,
      'trim',
      x - radius * 0.76,
      floor + 0.26,
      z - radius * 0.76,
      width * 0.76,
      top - floor - 0.26,
      width * 0.76,
      color.shadow,
    );
    return;
  }
  const plinth = [
    [floor + 0.26, 1.23],
    [floor + 0.45, 1.06],
    [floor + 0.67, 0.96],
    [top - 0.8, 0.79],
    [top - 0.54, 0.95],
    [top - 0.22, 1.26],
    [top, 1.34],
  ];
  const slices = [4, 7, 10, 14][lod];
  loft(
    out,
    'trim',
    plinth.map(([y, r]) => radialRing(y, radius * r, radius * r, slices, [x, z])),
    color.stone,
  );
  if (lod > 1) {
    block(
      out,
      'trim',
      x - radius * 1.31,
      top - 0.14,
      z - radius * 1.32,
      width * 1.31,
      0.2,
      width * 1.32,
      color.light,
    );
    const a = radialRing(floor + 0.71, radius, radius, slices, [x, z]);
    const b = radialRing(top - 0.81, radius * 0.79, radius * 0.79, slices, [x, z]);
    if (lod === 3)
      for (const [i, point] of a.entries())
        beam(out, 'trim', point, b[i], 0.032, 0.032, color.shadow);
  }
}

function ashlarPiers(out, wall, centers, low, high, lod) {
  for (const u of centers) {
    panel(out, 'trim', wall, u - 0.27, u + 0.27, low, high, 0.125, color.light);
    if (lod > 1) {
      const courses = Math.floor((high - low) / 0.69);
      for (let i = 0; i < courses; i++) {
        const y = mix(low, high, (i + 0.54) / courses);
        panel(out, 'trim', wall, u - 0.33, u + 0.33, y - 0.145, y + 0.145, 0.159, color.stone);
      }
    }
  }
}

function latticeRail(out, w, l, r, base, height, lod, slot = 'trim') {
  const tint = slot === 'iron' ? color.metal : color.light;
  panel(out, slot, w, l, r, base + height - 0.09, base + height, 0.033, tint);
  if (!lod) return;
  panel(out, slot, w, l, r, base + 0.02, base + 0.13, 0.03, tint);
  const count = Math.floor((r - l) / (lod > 1 ? 0.26 : 0.5));
  for (let i = 0; i < count; i++) {
    const u = mix(l, r, (i + 0.5) / count);
    panel(out, slot, w, u - 0.035, u + 0.035, base + 0.12, base + height - 0.085, 0.03, tint);
    if (lod === 3 && slot === 'trim')
      panel(out, slot, w, u - 0.061, u + 0.061, base + 0.24, base + height * 0.6, 0.062, tint);
  }
}

function theatreEnvelope(out, d, y, grade, lod) {
  const top = y + 20.7;
  const perimeter = pairs(closed(d.outline));
  const sign = areaSign(d.outline);
  const [l, r] = [d.outline[4][0], d.outline[5][0]];
  const returnDepth = 9.4;
  for (const [i, [a, b]] of perimeter.entries()) {
    if (i === 4) continue;
    const wall = edge(a, b, sign);
    const base = Math.min(grade(a), grade(b), y) - 0.25;
    panel(
      out,
      i === 5 ? 'stone' : 'rear',
      wall,
      0,
      wall.length,
      base,
      top,
      0,
      i === 5 ? color.stone : color.flank,
    );
    stoneBand(out, wall, 0, wall.length, y + 19.98, 0.32, 0.17, 0);
    if (i === 5) {
      for (const height of [4.91, 9.53, 13.81, 17.1])
        stoneBand(out, wall, 0, returnDepth, y + height, 0.19, 0.27, lod);
      for (const u of [1.8, 4.82, 7.79]) {
        sashArch(out, wall, u, y + 0.24, y + 3.25, 0.81, 0.68, lod, 'wood');
        for (const [bottom, height] of [
          [5.55, 2.84],
          [10.24, 2.95],
          [14.77, 2.13],
          [18.04, 1.46],
        ]) {
          squaredWindow(out, wall, u, y + bottom, y + bottom + height, 1.24, lod, true);
        }
      }
      ashlarPiers(out, wall, [0.23, 3.28, 6.32, 9.38], y + 0.18, y + 19.7, lod);
    }
    if (i === 5 || lod) {
      const start = i === 5 ? returnDepth + 1.6 : 0.9;
      const bays = Math.max(0, Math.floor((wall.length - start) / 3.42));
      for (let n = 0; n < bays; n++) {
        const u = start + ((n + 0.5) * (wall.length - start)) / bays;
        const courses = lod ? [3.08, 7.25, 11.25, 15.66] : [7.25, 14.1];
        for (const bottom of courses)
          squaredWindow(out, wall, u, y + bottom, y + bottom + 1.58, 0.93, Math.max(0, lod - 1));
      }
    }
  }
  cap(out, 'slate', d.outline, top, color.slate);
  const lower = plane(d.frontZ, 1);
  panel(out, 'stone', lower, l, r, y - 0.3, y + 0.15, 0.034, color.foundation);
  panel(
    out,
    'stone',
    lower,
    l,
    r,
    Math.min(y, grade([l, d.frontZ]), grade([r, d.frontZ])) - 0.32,
    y + 5.18,
    0,
    color.stone,
  );
  panel(out, 'stone', lower, l, r, y + 15.35, top, 0, color.stone);
  const mid = d.facadeCenterX;
  const left = mid - 7.4;
  const right = mid + 7.4;
  panel(out, 'stone', lower, l, left, y + 5.18, y + 15.35, 0, color.stone);
  panel(out, 'stone', lower, right, r, y + 5.18, y + 15.35, 0, color.stone);
  const recess = 1.37;
  const loggia = plane(d.frontZ - recess, 1);
  panel(out, 'stone', loggia, left, right, y + 5.13, y + 15.54, 0, color.shadow);
  for (const [x, normal] of [
    [left, 1],
    [right, -1],
  ]) {
    face(
      out,
      'stone',
      [
        [x, y + 5.14, d.frontZ - recess],
        [x, y + 5.14, d.frontZ],
        [x, y + 15.35, d.frontZ],
        [x, y + 15.35, d.frontZ - recess],
      ],
      [normal, 0, 0],
      color.shadow,
    );
  }
  for (const [offset, height, normal] of [
    [5.16, 'trim', up],
    [15.36, 'stone', down],
  ]) {
    const yr = y + offset;
    face(
      out,
      height,
      [
        [left, yr, d.frontZ - recess],
        [right, yr, d.frontZ - recess],
        [right, yr, d.frontZ + 0.1],
        [left, yr, d.frontZ + 0.1],
      ],
      normal,
      color.stone,
    );
  }
  for (let i = 0; i < d.frontageBays; i++) {
    const u = mid + (i - 4) * 2.82;
    const central = i >= 2 && i <= 6;
    squaredWindow(out, lower, u, y + 16.48, y + 19.22, 1.16, lod, true);
    if (central) {
      sashArch(out, loggia, u, y + 6.02, y + 9.91, 0.75, 0.83, lod);
      sashArch(out, loggia, u, y + 11.34, y + 13.71, 0.72, 0.64, lod);
    } else {
      squaredWindow(out, lower, u, y + 6.44, y + 9.54, 1.32, lod, true);
      squaredWindow(out, lower, u, y + 10.87, y + 14.18, 1.4, lod, true);
    }
    sashArch(out, lower, u, y + 0.21, y + 3.44, 0.83, 0.57, lod, 'wood');
  }
  for (const h of [5.03, 15.17, 19.86])
    stoneBand(out, lower, l, r, y + h, h === 15.17 ? 0.48 : 0.27, h === 15.17 ? 0.54 : 0.31, lod);
  stoneBand(out, lower, l, left, y + 10.16, 0.16, 0.17, Math.min(lod, 1));
  stoneBand(out, lower, right, r, y + 10.16, 0.16, 0.17, Math.min(lod, 1));
  ashlarPiers(out, lower, [l + 0.27, left - 0.3, right + 0.3, r - 0.28], y + 5.43, y + 15.19, lod);
  for (let i = 0; i <= d.loggiaBays; i++) {
    const u = mix(left + 0.055, right - 0.055, i / d.loggiaBays);
    stoneColumn(
      out,
      [u, d.frontZ + 0.13],
      y + 5.53,
      y + 15.17,
      i === 0 || i === d.loggiaBays ? 0.86 : 0.72,
      lod,
    );
  }
  latticeRail(out, plane(d.frontZ + 0.37, 1), left - 0.1, right + 0.1, y + 5.3, 0.84, lod);
}

function mansard(out, [l, r, f, b], eaves, top, lod) {
  const lower = rect(l, f, r, b).map((p) => at(p, eaves));
  const upper = rect(l + 1.2, f - 1.82, r - 1.2, b + 1.82).map((p) => at(p, top));
  for (let i = 0; i < lower.length; i++) {
    const n = (i + 1) % lower.length;
    face(
      out,
      'slate',
      [lower[i], lower[n], upper[n], upper[i]],
      up,
      i === 0 ? color.slateLight : color.slate,
    );
    if (lod > 1) beam(out, 'lead', lower[i], upper[i], 0.098, 0.09, color.lead);
  }
  face(out, 'lead', upper, up, color.slate);
}

function dormer(out, x, y, z, width, lod, pediment = false) {
  const height = 2.42;
  const l = x - width / 2;
  const r = x + width / 2;
  block(out, 'stone', l, y, z - 1.65, width, height, 1.76, color.stone);
  const front = plane(z + 0.11, 1);
  sashArch(out, front, x, y + 0.28, y + 1.43, width * 0.27, 0.41, lod);
  const slope = pediment ? 0.69 : 0.27;
  face(
    out,
    'trim',
    [
      [l - 0.14, y + height, z + 0.17],
      [r + 0.14, y + height, z + 0.17],
      [x, y + height + slope, z + 0.17],
    ],
    [0, 0, 1],
    color.light,
  );
  for (const v of [l - 0.18, r + 0.18]) {
    face(
      out,
      'slate',
      [
        [v, y + height, z + 0.2],
        [x, y + height + slope, z + 0.2],
        [x, y + height + slope, z - 1.78],
        [v, y + height, z - 1.78],
      ],
      up,
      color.slate,
    );
    if (lod > 1)
      beam(
        out,
        'trim',
        [v, y + height, z + 0.235],
        [x, y + height + slope, z + 0.235],
        0.14,
        0.17,
        color.light,
      );
  }
}

function roundedSquareRing(x, z, y, radius, n) {
  return Array.from({ length: n }, (_, i) => {
    const angle = (-i * 2 * Math.PI) / n;
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const form = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.52);
    return [x + radius * form(c), y, z + radius * form(s)];
  });
}

function dome(out, d, y, lod) {
  const x = d.facadeCenterX;
  const z = 9.0;
  const bottom = y + d.domeShoulder - 0.42;
  const upper = y + d.domeTop;
  const r = 6.63;
  const outline = rect(x - r, z + r, x + r, z - r);
  const neck = y + d.pavilionEaves - 2.1;
  shell(out, outline, () => neck, bottom, { wall: 'stone', color: color.light });
  const front = plane(z + r, 1);
  const sign = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const wall = edge(a, b, sign);
    for (const h of [neck + 0.27, neck + 2.7, bottom - 0.4])
      stoneBand(out, wall, 0.08, wall.length - 0.08, h, 0.22, 0.3, lod);
    for (const u of [2.7, wall.length * 0.5, wall.length - 2.7])
      squaredWindow(out, wall, u, neck + 3.07, bottom - 0.75, 1.36, lod, true);
  }
  for (const u of [x - 4.58, x - 2.28, x, x + 2.28, x + 4.58])
    sashArch(out, front, u, neck + 0.62, neck + 1.65, 0.63, 0.68, lod);
  const profile = [
    [0, 1],
    [0.17, 0.967],
    [0.39, 0.875],
    [0.62, 0.701],
    [0.82, 0.471],
    [0.95, 0.24],
    [1, 0.17],
  ];
  const profileByLevel = lod ? profile : [profile[0], profile[2], profile[4], profile.at(-1)];
  const steps = [8, 20, 28, 44][lod];
  const rings = profileByLevel.map(([h, f]) =>
    roundedSquareRing(x, z, mix(bottom, upper, h), r * f, steps),
  );
  loft(out, 'lead', rings, color.lead);
  if (lod > 1) {
    const cadence = lod === 3 ? 2 : 4;
    for (let i = 0; i < steps; i += cadence) {
      for (const [lower, higher] of pairs(rings)) {
        beam(
          out,
          'lead',
          [x + (lower[i][0] - x) * 1.003, lower[i][1] + 0.026, z + (lower[i][2] - z) * 1.003],
          [x + (higher[i][0] - x) * 1.003, higher[i][1] + 0.026, z + (higher[i][2] - z) * 1.003],
          0.045,
          0.035,
          color.metal,
        );
      }
    }
    for (const side of [-1, 1]) {
      const off = side * 3.12;
      dormer(out, x + off, bottom + 1.37, z + 5.18, 1.22, lod, false);
    }
  }
  const top = y + d.lanternTop;
  const capRings = [
    [upper - 0.06, 1.04],
    [upper + 0.21, 1.53],
    [upper + 0.68, 1.53],
    [upper + 0.91, 1.09],
    [upper + 2.42, 0.92],
    [upper + 2.58, 1.09],
    [upper + 2.83, 0.99],
    [upper + 3.16, 0.71],
    [top - 0.48, 0.19],
    [top, 0.12],
  ];
  for (const [body, slot, tint] of [
    [capRings.slice(0, 4), 'lead', color.metal],
    [capRings.slice(3, 5), 'stone', color.shadow],
    [capRings.slice(4), 'lead', color.metal],
  ])
    loft(
      out,
      slot,
      body.map(([yy, rr]) => radialRing(yy, rr, rr, 8, [x, z])),
      tint,
    );
  if (lod) {
    for (const p of radialRing(upper + 0.79, 1.09, 1.09, 8, [x, z]))
      stoneColumn(out, [p[0], p[2]], upper + 0.82, upper + 2.51, 0.18, lod > 1 ? 1 : 0);
  }
}

function entranceCanopy(out, d, y, lod) {
  const front = d.frontZ;
  const width = 25.8;
  const l = d.facadeCenterX - width / 2;
  const r = l + width;
  const outer = front + 2.92;
  const head = y + 4.78;
  const lip = y + 3.92;
  const a = [l, head, front + 0.03];
  const b = [r, head, front + 0.03];
  const c = [r, lip, outer];
  const e = [l, lip, outer];
  face(out, 'glass', [a, b, c, e], up, color.canopy);
  face(out, 'glass', [a, e, c, b], down, color.canopy);
  block(out, 'iron', l, lip - 0.16, outer - 0.03, width, 0.18, 0.075, color.metal);
  if (lod) {
    for (let i = 0; i <= d.frontageBays * 2; i++) {
      const u = mix(l, r, i / (d.frontageBays * 2));
      beam(
        out,
        'iron',
        [u, head + 0.015, front + 0.03],
        [u, lip + 0.014, outer],
        0.038,
        0.05,
        color.metal,
      );
      if (i % 2 === 0 && lod > 1)
        beam(
          out,
          'iron',
          [u, y + 3.23, front + 0.1],
          [u, lip - 0.08, outer],
          0.052,
          0.06,
          color.metal,
        );
    }
    if (lod > 1)
      latticeRail(out, plane(outer + 0.004, 1), l + 0.04, r - 0.04, lip + 0.022, 0.29, lod, 'iron');
  }
}

function build(out, lod, d, grade) {
  const y = d.floorY;
  theatreEnvelope(out, d, y, grade, lod);
  mansard(out, [-8.18, 19.23, 18.08, 0.42], y + 20.3, y + 24.8, lod);
  mansard(out, [-10.45, 17.95, 0.76, -26.58], y + 20.05, y + 24.43, lod);
  block(out, 'rear', -8.42, y + 20.45, -19.6, 22.95, 2.37, 13.05, color.flank);
  block(out, 'lead', -8.54, y + 22.81, -19.68, 23.19, 0.23, 13.26, color.slate);
  for (const u of [-5.61, -2.85, 14.0, 16.68])
    dormer(out, u, y + 20.56, d.frontZ - 0.12, 1.97, lod, true);
  dome(out, d, y, lod);
  entranceCanopy(out, d, y, lod);
}

const asset = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'His Majesty’s Theatre on Haymarket with its nine-bay limestone façade, five-bay giant Corinthian loggia, glazed iron canopy, pedimented mansards, square French dome and octagonal lantern.',
    camera: [43, 31, 72],
    lookAt: [5.45, 15.0, 1.9],
    yaw: 0.63,
    sun: [-245, 490, 610],
    views: [
      { name: 'haymarket-loggia-and-canopy', position: [-20, 15, 60], lookAt: [5.3, 12.2, 17.8] },
      { name: 'mansards-and-french-dome', position: [37, 43, 56], lookAt: [5.5, 27, 10] },
      { name: 'charles-ii-street-return', position: [59, 23, 3], lookAt: [13.6, 12.5, 5] },
      {
        name: 'stage-roof-and-lantern-silhouette',
        position: [32, 49, -63],
        lookAt: [5.4, 18.9, -6],
      },
    ],
  },
  build,
);
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
export const { skyline, district, street, closeup } = asset;
export const model = {
  ...asset.model,
  category: 'theatre',
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Named theatre footprint with a separately surveyed Royal Opera Arcade behind it.',
  },
};
