/** The 2013 exterior of Douglas City Hall, on Ridgeway Street in the Isle of Man. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const ring = frame.geometry.polygons[0];
const eaves = plan.wallEaves;
const ridge = plan.roofRidgeZ;
const front = (ring[7][1] + ring[8][1]) / 2;
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.93, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.9, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.89, metallic: 0 },
  cap: { slot: 'roof', graph: 'metal_painted', roughness: 0.66, metallic: 0.22 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.62, metallic: 0.1 },
};
const colors = Object.fromEntries(
  Object.entries({
    rubble: '777271',
    warmRubble: '7e7670',
    mortar: '514d4a',
    stoneBrown: '78716e',
    stoneGray: '706e70',
    stoneWarm: '8a7d73',
    stoneDark: '676265',
    stonePale: '8b8781',
    base: '666766',
    shadow: '575650',
    trim: 'bcb6a7',
    pale: 'c9c2b2',
    darkTrim: '9b9589',
    slate: '5f666e',
    slateRidge: '73777c',
    metal: '969fa7',
    metalShade: '858d98',
    pane: '525b60',
    mullion: 'aaa79a',
    lead: '636766',
    wood: '695249',
    clock: '303334',
    gold: 'c8ab69',
    black: '414343',
  }).map(([name, value]) => [name, rgb(value)]),
);
const lerp = (a, b, f) => a + (b - a) * f;
const rect = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    lerp(lerp(h[j][i], h[j][i + 1], u - i), lerp(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function wallSection(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const ux = dx / length,
    uz = dz / length,
    normal = [-uz, 0, ux];
  const x = (a[0] + b[0]) / 2,
    z = (a[1] + b[1]) / 2;
  return {
    length,
    normal,
    p: (u, y, d = 0) => [x + u * ux + d * normal[0], y, z + u * uz + d * normal[2]],
  };
}

function direct(out, slot, points, normal, tint) {
  const n = normalFor(...points);
  const p = n.reduce((dot, v, i) => dot + v * normal[i], 0) > 0 ? points : points.toReversed();
  if (p.length === 4) face(out, slot, p, tint);
  else triangle(out, slot, p, tint);
}

function planar(out, s, slot, outer, tint, d = 0, holes = []) {
  const points = [...outer],
    starts = [];
  for (const hole of holes) {
    starts.push(points.length);
    points.push(...hole);
  }
  const mesh = earcut(points.flat(), starts);
  for (let i = 0; i < mesh.length; i += 3)
    direct(
      out,
      slot,
      mesh.slice(i, i + 3).map((j) => s.p(...points[j], d)),
      s.normal,
      tint,
    );
}

function band(out, s, slot, x0, y0, x1, y1, d0, d1, tint) {
  const corners = rect(x0, y0, x1, y1);
  direct(
    out,
    slot,
    corners.map((p) => s.p(...p, d1)),
    s.normal,
    tint,
  );
  for (let i = 0; i < 4; i++) {
    const a = corners[i],
      b = corners[(i + 1) % 4];
    face(out, slot, [s.p(...a, d0), s.p(...b, d0), s.p(...b, d1), s.p(...a, d1)], tint);
  }
}

function round(x, y, r, steps) {
  return Array.from({ length: steps }, (_, i) => [
    x + r * Math.cos((i * Math.PI * 2) / steps),
    y + r * Math.sin((i * Math.PI * 2) / steps),
  ]);
}

function ringFace(out, s, slot, x, y, inner, outer, d, tint, steps) {
  const a = round(x, y, inner, steps),
    b = round(x, y, outer, steps);
  for (let i = 0; i < steps; i++) {
    const j = (i + 1) % steps;
    direct(
      out,
      slot,
      [a[i], b[i], b[j], a[j]].map((p) => s.p(...p, d)),
      s.normal,
      tint,
    );
  }
}

function reveal(out, s, outline, depth) {
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    face(out, 'trim', [s.p(...a), s.p(...b), s.p(...b, depth), s.p(...a, depth)], colors.darkTrim);
  }
}

function opening(out, s, w, lod) {
  const { x, width, low, high, door } = w,
    a = x - width / 2,
    b = x + width / 2,
    surround = w.large ? 0.32 : 0.2;
  const aperture = rect(a, low, b, high);
  if (lod < 2) {
    planar(
      out,
      s,
      'trim',
      rect(a - surround, low - surround, b + surround, high + surround),
      colors.pale,
      0.027,
    );
    planar(out, s, door ? 'door' : 'detail', aperture, door ? colors.wood : colors.pane, 0.031);
    if (lod === 1 && !door) {
      planar(out, s, 'trim', rect(x - 0.055, low, x + 0.055, high), colors.mullion, 0.04);
      const y = lerp(low, high, 0.55);
      planar(out, s, 'trim', rect(a, y - 0.04, b, y + 0.04), colors.mullion, 0.041);
    }
    return;
  }
  const depth = -0.17;
  reveal(out, s, aperture, depth);
  planar(
    out,
    s,
    door ? 'door' : 'detail',
    aperture,
    door ? colors.wood : colors.pane,
    depth - 0.003,
  );
  band(out, s, 'trim', a - surround, low, a, high, 0, 0.045, colors.pale);
  band(out, s, 'trim', b, low, b + surround, high, 0, 0.045, colors.pale);
  band(out, s, 'trim', a - surround, high, b + surround, high + surround, 0, 0.08, colors.pale);
  band(out, s, 'trim', a - surround, low - surround, b + surround, low, 0, 0.13, colors.trim);
  const cols = door ? 2 : (w.cols ?? 2);
  for (let i = 1; i < cols; i++) {
    const u = a + (i * width) / cols,
      half = w.large && i === Math.floor(cols / 2) ? 0.194 : 0.049;
    band(out, s, 'trim', u - half, low, u + half, high, depth, 0.022, colors.mullion);
  }
  if (!door) {
    const y = lerp(low, high, 0.55);
    const rail = w.large ? 0.104 : 0.062;
    band(out, s, 'trim', a, y - rail, b, y + rail, depth, 0.022, colors.mullion);
    if (lod === 3 && w.large) {
      for (let i = 0; i < cols * 3; i++) {
        if (i % 3 === 0) continue;
        const u = a + (i * width) / (cols * 3);
        planar(out, s, 'detail', rect(u - 0.01, low, u + 0.01, high), colors.lead, depth + 0.009);
      }
    }
  } else if (lod >= 2) {
    band(out, s, 'trim', a, high - 0.68, b, high - 0.58, depth, 0.018, colors.mullion);
    planar(
      out,
      s,
      'detail',
      rect(a + 0.07, high - 0.58, b - 0.07, high - 0.03),
      colors.pane,
      depth + 0.014,
    );
  }
}

function facade(out, s, windows, lod, low, high, tint = colors.rubble, order = 0) {
  const half = s.length / 2;
  const holes =
    lod < 2 ? [] : windows.map((w) => rect(w.x - w.width / 2, w.low, w.x + w.width / 2, w.high));
  planar(out, s, 'wall', rect(-half, low, half, high), lod < 2 ? tint : colors.mortar, 0, holes);
  for (const w of windows) opening(out, s, w, lod);
  if (lod < 2) return;
  const stoneTints = [
    colors.stoneBrown,
    colors.stoneGray,
    colors.stoneBrown,
    colors.stoneWarm,
    colors.stoneDark,
    colors.stonePale,
  ];
  const courses = [0.39, 0.48, 0.42, 0.52, 0.44];
  for (let row = 0, y = high; y > low + 0.075; row++) {
    const bottom = Math.max(low, y - courses[(row + order) % courses.length]);
    const openings = windows
      .filter((w) => y > w.low - 0.29 && bottom < w.high + 0.29)
      .map((w) => [w.x - w.width / 2 - 0.19, w.x + w.width / 2 + 0.19])
      .sort((a, b) => a[0] - b[0]);
    const limits = [-half];
    for (const [left, right] of openings) {
      if (left > limits.at(-1)) limits.push(left, right);
      else limits[limits.length - 1] = Math.max(limits.at(-1), right);
    }
    limits.push(half);
    for (let span = 0; span < limits.length; span += 2) {
      let x = limits[span] + 0.018;
      const end = limits[span + 1] - 0.018;
      for (let index = 0; x < end - 0.09; index++) {
        const seed = row * 13 + index * 17 + span * 7 + order * 23;
        const right = Math.min(
          end,
          x + (index === 0 && row % 2 ? 0.31 : 0.57) + (seed % 7) * 0.079,
        );
        const relief = 0.011 + (seed % 5) * 0.004;
        const points = [
          [x, bottom + 0.023],
          [right, bottom + 0.021],
          [right - (seed % 3) * 0.024, y - 0.014],
          [x + (seed % 2) * 0.041, y - 0.023],
        ];
        direct(
          out,
          'wall',
          points.map((p) => s.p(...p, relief)),
          s.normal,
          stoneTints[(seed * 3 + Math.floor(seed / 7)) % stoneTints.length],
        );
        x = right + 0.026;
      }
    }
    y = bottom;
  }
}

function mainWindows() {
  const center = (ring[7][0] + ring[8][0]) / 2;
  const bays = [
    [-17.1, 6.55, 4],
    [-8.65, 3.5, 2],
    [-2.9, 2.9, 2],
    [2.55, 2.85, 2],
    [8.06, 3.05, 2],
    [13.04, 2.73, 2],
  ];
  return bays.flatMap(([x, width, cols], i) => [
    { x: x - center, width, cols, large: i < 2, low: 5.17, high: 9.18 },
    {
      x: x - center,
      width: i === 0 ? 5.9 : width * 0.86,
      cols,
      large: i === 0,
      low: 1.88 + (i > 2 ? 0.36 : 0),
      high: 4.22,
    },
  ]);
}

function returnWindows(s, index) {
  if (index === 0 || index === 6) return [];
  if (index === 5) {
    const [x, , z] = s.p(0, 0),
      low = grade(x, z) + 0.11;
    return [
      { x: 0, width: 1.89, low, high: low + 3.28, door: true },
      { x: 0, width: 1.56, low: 6.36, high: 9.05 },
    ];
  }
  const count = Math.max(1, Math.floor(s.length / 4.5));
  return Array.from({ length: count }, (_, i) => {
    const x = -s.length / 2 + ((i + 0.5) * s.length) / count;
    const [wx, , wz] = s.p(x, 0);
    return [
      { x, width: 1.38, low: 5.55, high: 8.95 },
      { x, width: 1.27, low: Math.max(1.8, grade(wx, wz) + 0.52), high: 4.78 },
    ];
  }).flat();
}

function walls(out, lod) {
  for (let i = 0; i < ring.length; i++) {
    const s = wallSection(ring[(i + 1) % ring.length], ring[i]),
      half = s.length / 2;
    const [ax, , az] = s.p(-half, 0),
      [bx, , bz] = s.p(half, 0);
    const g0 = grade(ax, az),
      g1 = grade(bx, bz);
    const windows = i === 7 ? mainWindows() : returnWindows(s, i);
    const base = Math.min(g0, g1) - 0.58;
    facade(out, s, windows, lod, base, eaves, i % 3 === 0 ? colors.warmRubble : colors.rubble, i);
    for (const [left, right] of i === 5
      ? [
          [-half, -1.23],
          [1.23, half],
        ]
      : [[-half, half]]) {
      const leftGrade = lerp(g0, g1, (left + half) / s.length);
      const rightGrade = lerp(g0, g1, (right + half) / s.length);
      const plinth = [
        [left, leftGrade - 0.55],
        [right, rightGrade - 0.55],
        [right, rightGrade + 0.49],
        [left, leftGrade + 0.49],
      ];
      planar(out, s, 'wall', plinth, colors.base, 0.059);
    }
    band(out, s, 'trim', -half, 9.77, half, 10.12, -0.03, 0.19, colors.trim);
    band(out, s, 'trim', -half, 10.1, half, 10.45, -0.08, 0.32, colors.pale);
    if (lod > 0) {
      for (const [left, right] of i === 5
        ? [
            [-half, -1.16],
            [1.16, half],
          ]
        : [[-half, half]]) {
        band(out, s, 'trim', left, 4.72, right, 4.95, -0.01, 0.083, colors.darkTrim);
      }
      if (i === 7 || i === 5 || i === 8) {
        for (let x = -half + 0.37; x < half - 0.23; x += lod === 1 ? 1.23 : 0.62)
          band(out, s, 'trim', x - 0.1, 9.62, x + 0.1, 9.86, 0.02, 0.23, colors.trim);
      }
    }
  }
}

function splitRoof(above) {
  const keep = (p) => (above ? p[1] >= ridge : p[1] <= ridge);
  const poly = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if (keep(a)) poly.push(a);
    if (keep(a) !== keep(b)) poly.push([lerp(a[0], b[0], (ridge - a[1]) / (b[1] - a[1])), ridge]);
  }
  return poly;
}

function roof(out, lod) {
  const rear = Math.min(...ring.map((p) => p[1]));
  const h = (z) =>
    eaves +
    0.15 +
    (z > ridge ? front - z : ((z - rear) * (front - ridge)) / (ridge - rear)) * plan.roofPitch;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[(i + 1) % ring.length],
      b = ring[i],
      s = wallSection(a, b),
      half = s.length / 2;
    const top = [
      [-half, h(a[1])],
      [half, h(b[1])],
    ];
    if ((a[1] < ridge && b[1] > ridge) || (a[1] > ridge && b[1] < ridge))
      top.splice(1, 0, [lerp(-half, half, (ridge - a[1]) / (b[1] - a[1])), h(ridge)]);
    planar(
      out,
      s,
      'wall',
      [[-half, eaves - 0.015], [half, eaves - 0.015], ...top.toReversed()],
      colors.rubble,
    );
  }
  const halves = [splitRoof(false), splitRoof(true)];
  for (const [i, poly] of halves.entries()) {
    const mesh = earcut(poly.flat());
    for (let j = 0; j < mesh.length; j += 3) {
      const points = mesh.slice(j, j + 3).map((k) => [poly[k][0], h(poly[k][1]), poly[k][1]]);
      direct(out, 'slate', points, [0, 1, 0], i === 0 ? colors.slate : colors.slateRidge);
    }
  }
  if (lod > 0) {
    const ends = halves[0]
      .filter((p) => p[1] === ridge)
      .map((p) => p[0])
      .sort((a, b) => a - b);
    beam(
      out,
      'slate',
      [ends[0], h(ridge) + 0.034, ridge],
      [ends.at(-1), h(ridge) + 0.034, ridge],
      0.14,
      0.13,
      colors.slateRidge,
    );
  }
}

function gable(out, lod) {
  const { x, width, top } = plan.frontGable,
    half = width / 2,
    low = eaves - 0.03;
  const s = wallSection([x - half, front], [x + half, front]);
  const crown = [
    [-half, low],
    [half, low],
    [half, low + 0.54],
    [half - 0.92, low + 0.54],
    [1.31, top - 0.69],
    [1.12, top - 0.36],
    [0.71, top - 0.1],
    [0, top],
    [-0.71, top - 0.1],
    [-1.12, top - 0.36],
    [-1.31, top - 0.69],
    [-half + 0.92, low + 0.54],
    [-half, low + 0.54],
  ];
  const cy = 11.67,
    radius = 0.59,
    sides = [10, 14, 20, 28][lod];
  const oculus = round(0, cy, radius, sides);
  const facing = 0.26;
  planar(out, s, 'wall', crown, colors.rubble, facing, lod === 0 ? [] : [oculus]);
  for (let i = 1; i < crown.length; i++) {
    const a = crown[i],
      b = crown[(i + 1) % crown.length];
    face(
      out,
      'wall',
      [s.p(...b, facing), s.p(...a, facing), s.p(...a, -0.63), s.p(...b, -0.63)],
      colors.warmRubble,
    );
    if (i > 2 && i < crown.length - 1)
      beam(
        out,
        'trim',
        s.p(...a, facing + 0.05),
        s.p(...b, facing + 0.05),
        0.139,
        0.24,
        colors.trim,
      );
  }
  const back = {
    ridge: [x, 13.82, 5.2],
    left: [x - half, 11.53, 5.2],
    right: [x + half, 11.53, 5.2],
  };
  const crest = [x, top - 0.46, front - 0.48];
  for (const [left, point] of [
    [true, back.left],
    [false, back.right],
  ]) {
    const start = [x + (left ? -half : half), low + 0.18, front - 0.48];
    direct(out, 'slate', [start, crest, point], [0, 1, 0], colors.slate);
    direct(out, 'slate', [point, crest, back.ridge], [0, 1, 0], colors.slate);
  }
  planar(out, s, 'detail', oculus, colors.pane, lod === 0 ? facing + 0.03 : facing - 0.07);
  ringFace(out, s, 'trim', 0, cy, radius, 0.785, facing + 0.053, colors.pale, sides);
  if (lod > 0) {
    band(
      out,
      s,
      'trim',
      -0.031,
      cy - radius,
      0.031,
      cy + radius,
      facing - 0.062,
      facing + 0.023,
      colors.pale,
    );
    band(
      out,
      s,
      'trim',
      -radius,
      cy - 0.026,
      radius,
      cy + 0.026,
      facing - 0.06,
      facing + 0.022,
      colors.pale,
    );
    for (const u of [-half + 0.17, half - 0.17]) {
      box(
        out,
        'trim',
        [x + u - 0.16, low, front - 0.03],
        [x + u + 0.16, low + 0.44, front + 0.31],
        colors.trim,
      );
      loft(
        out,
        'trim',
        [
          [0.11, 0.13],
          [0.28, 0.19],
          [0.45, 0.06],
        ].map(([y, r]) => radialRing(low + 0.35 + y, r, r, 8, [x + u, front + 0.13])),
        colors.darkTrim,
      );
    }
  }
}

function turret(out, lod) {
  const { x, z, width, depth, head } = plan.turret,
    w = width / 2,
    d = depth / 2;
  const corners = [
    [x - w, z + d],
    [x + w, z + d],
    [x + w, z - d],
    [x - w, z - d],
  ];
  for (let i = 0; i < 4; i++) {
    const s = wallSection(corners[i], corners[(i + 1) % 4]),
      half = s.length / 2;
    facade(
      out,
      s,
      [{ x: 0, width: 2.21, low: 12.11, high: 13.84, cols: 3 }],
      lod,
      eaves + 0.28,
      head,
      colors.rubble,
      i,
    );
    band(out, s, 'trim', -half, head - 0.39, half, head - 0.16, -0.02, 0.19, colors.darkTrim);
    band(out, s, 'trim', -half, head - 0.17, half, head + 0.11, -0.11, 0.31, colors.pale);
    if (lod > 1) {
      for (const u of [-half + 0.08, half - 0.36])
        for (let k = 0; k < 4; k++) {
          const y = 11.26 + k * 0.68;
          band(out, s, 'trim', u, y, u + 0.28 + (k % 2) * 0.11, y + 0.24, 0, 0.078, colors.trim);
        }
    }
  }
  const steps = [8, 12, 16, 24][lod];
  const profile = [
    [0, 1.05],
    [0.31, 1.0],
    [0.77, 0.91],
    [1.36, 0.71],
    [1.8, 0.37],
    [1.94, 0.12],
  ];
  const shell = profile.map(([y, r]) =>
    radialRing(head + y, w * r, d * r, steps, [x, z], Math.PI / 4).map(([px, py, pz]) => {
      const square = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.62);
      return [x + w * r * square((px - x) / (w * r)), py, z + d * r * square((pz - z) / (d * r))];
    }),
  );
  loft(out, 'cap', shell, colors.metal);
  if (lod >= 2) {
    for (let j = 0; j < steps; j += 2)
      for (let i = 1; i < shell.length; i++)
        beam(out, 'cap', shell[i - 1][j], shell[i][j], 0.04, 0.045, colors.metalShade);
  }
  loft(
    out,
    'cap',
    [
      [1.9, 0.18],
      [2.06, 0.13],
      [2.24, 0.07],
      [2.81, 0.027],
    ].map(([y, r]) => radialRing(head + y, r, r, 8, [x, z])),
    colors.metalShade,
  );
}

function clock(out, lod) {
  const x = -21.85,
    y = 5.55,
    z = front + 0.9,
    r = 0.64,
    steps = [10, 14, 20, 28][lod];
  box(
    out,
    'detail',
    [x - 0.1, y - 0.05, front - 0.07],
    [x + 0.1, y + 0.09, z + 0.45],
    colors.black,
  );
  for (const side of [-1, 1]) {
    const center = [x - side * 0.087, z + side * 0.074];
    const s = wallSection(
      [center[0] - side * r * 0.64, center[1] - side * r * 0.768],
      [center[0] + side * r * 0.64, center[1] + side * r * 0.768],
    );
    planar(out, s, 'detail', round(0, y, r, steps), colors.clock);
    ringFace(out, s, 'detail', 0, y, r - 0.081, r + 0.016, 0.016, colors.gold, steps);
    const count = lod === 0 ? 4 : 12;
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count;
      const at = (radius, offset) => [
        Math.sin(a) * radius + Math.cos(a) * offset,
        y + Math.cos(a) * radius - Math.sin(a) * offset,
      ];
      direct(
        out,
        'detail',
        [at(0.43, -0.022), at(0.54, -0.022), at(0.54, 0.022), at(0.43, 0.022)].map((p) =>
          s.p(...p, 0.027),
        ),
        s.normal,
        colors.gold,
      );
    }
    for (const [dx, dy] of [
      [0.13, 0.31],
      [-0.29, 0.22],
    ])
      direct(
        out,
        'detail',
        [
          [-0.018, y],
          [dx - 0.014, y + dy],
          [dx + 0.014, y + dy],
          [0.018, y],
        ].map((p) => s.p(...p, 0.033)),
        s.normal,
        colors.gold,
      );
  }
}

function entrance(out, lod) {
  const s = wallSection(ring[6], ring[5]),
    [x, , z] = s.p(0, 0);
  const level = grade(x, z) + 0.11;
  band(out, s, 'trim', -1.15, level - 0.22, 1.15, level, -0.08, 0.48, colors.trim);
  if (lod === 0) return;
  const x0 = 1.28,
    y = 4.25,
    w = 0.97;
  band(out, s, 'trim', x0, y, x0 + w, y + 0.82, 0, 0.135, colors.pale);
  band(out, s, 'trim', x0 + 0.076, y + 0.07, x0 + w - 0.076, y + 0.745, 0.133, 0.154, colors.trim);
  if (lod === 3) {
    for (const [row, count] of [
      [0, 9],
      [1, 9],
      [2, 4],
    ])
      for (let j = 0; j < count; j++) {
        const a = x0 + w / 2 + (j - (count - 1) / 2) * 0.07,
          b = y + 0.58 - row * 0.15;
        planar(out, s, 'detail', rect(a - 0.023, b, a + 0.023, b + 0.04), colors.darkTrim, 0.156);
      }
  }
}

function build(out, lod) {
  walls(out, lod);
  roof(out, lod);
  gable(out, lod);
  turret(out, lod);
  clock(out, lod);
  entrance(out, lod);
}
export const hallSkyline = (out) => build(out, 0);
export const hallDistrict = (out) => build(out, 1);
export const hallStreet = (out) => build(out, 2);
export const hallCloseup = (out) => build(out, 3);
const recipe = 'douglas-city-hall-model.mjs';
const camera = [-46, 22, 56],
  lookAt = [-3.0, 7, 3.4];
export const hallModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: hallCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Isle of Man’s Douglas City Hall with dark local rubble, pale Bath stone, stepped gable and oculus, projecting clock and metal-roofed square turret.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-31, 42, 47],
  mediumFiContext: {
    scale: 1.1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: ring,
    outlines: [ring],
    minimumCoverage: 0.92,
    basis: 'Mapped civic building outline on Ridgeway Street and John Street.',
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_raw',
    'stone_limestone_weathered',
    'slate',
    'metal_painted',
    'wood_plain',
  ],
  qaCameras: [
    { name: 'ridgeway-street-gable-and-clock', position: [-25, 5.3, 41], lookAt: [-12, 8.1, 10] },
    { name: 'john-street-entrance', position: [35, 7.5, 8], lookAt: [12, 5.4, 2.5] },
    { name: 'turret-and-returning-roofs', position: [19, 23, -37], lookAt: [-5, 9, 4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'hallSkyline',
    errorMeters: 1.07,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'hallDistrict', 0.48],
        ['street', 'hallStreet', 0.16],
        ['closeup', 'hallCloseup', 0.058],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Mapped footprint is ODbL. The photographer released both exact Qualla photos to the public domain.',
};
