/** The October 2019 John Rutledge House on Broad Street, Charleston. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
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
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const ring = frame.geometry.polygons[0];
const body = ring.slice(2, 12);
const { porch, eaves } = plan;
const center = (porch.x0 + porch.x1) / 2;
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.93, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.92, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.9, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.86, metallic: 0 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.87, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.82, metallic: 0.19 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.64, metallic: 0.11 },
};
const tint = Object.fromEntries(
  Object.entries({
    wall: 'ded6c7',
    warm: 'dfd4c4',
    shaded: 'cfc6bb',
    pale: 'e5dace',
    base: 'beb6a5',
    trim: 'c2b5a5',
    hood: 'a79f93',
    sash: 'c7c3b6',
    pane: '515a58',
    door: '4e5953',
    iron: '6f8780',
    darkIron: '566e67',
    paleIron: '82968b',
    deck: 'a89f8d',
    slate: '737b7d',
    slateLight: '8a8e8a',
    whiteTile: 'ddd6c5',
    darkTile: '454947',
  }).map(([name, color]) => [name, rgb(color)]),
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

function oriented(out, slot, points, normal, color) {
  const n = normalFor(...points),
    p = n.reduce((sum, v, i) => sum + v * normal[i], 0) > 0 ? points : points.toReversed();
  if (p.length === 4) face(out, slot, p, color);
  else triangle(out, slot, p, color);
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

function arch(w, steps, grow = 0) {
  const r = w.width / 2 + grow;
  if (w.basement) return rect(w.x - r, w.low - grow, w.x + r, w.top + grow);
  const y = w.top + grow,
    profile = Array.from({ length: steps + 1 }, (_, i) => {
      const u = 1 - (2 * i) / steps;
      return [w.x + u * r, y - w.curve * u * u];
    });
  return [[w.x - r, w.low - grow], [w.x + r, w.low - grow], ...profile];
}

function window(out, s, w, lod, decorated) {
  const r = w.width / 2,
    n = [2, 3, 6, 8][lod],
    pane = arch(w, n),
    shell = arch(w, n, 0.1);
  if (lod === 0) {
    band(
      out,
      s,
      'detail',
      [w.x - r, w.low],
      [w.x + r, w.top],
      0,
      0.028,
      w.door ? tint.door : tint.pane,
    );
    return;
  }
  const glass = lod >= 2 ? -0.13 : 0.031;
  if (lod === 1) fill(out, s, 'trim', shell, tint.trim, 0.018);
  else
    for (let i = 0; i < pane.length; i++) {
      const j = (i + 1) % pane.length,
        a = pane[i],
        b = pane[j];
      oriented(
        out,
        'trim',
        [a, b, shell[j], shell[i]].map((p) => s.p(...p, 0.068)),
        s.normal,
        tint.trim,
      );
      face(
        out,
        'wall',
        [s.p(...a, 0.065), s.p(...b, 0.065), s.p(...b, glass), s.p(...a, glass)],
        tint.shaded,
      );
    }
  fill(out, s, w.door ? 'timber' : 'detail', pane, w.door ? tint.door : tint.pane, glass);
  if (w.basement) return;
  if (lod >= 2)
    band(
      out,
      s,
      'trim',
      [w.x - r - 0.13, w.low - 0.082],
      [w.x + r + 0.13, w.low + 0.014],
      -0.02,
      0.16,
      tint.trim,
      true,
    );
  band(
    out,
    s,
    'detail',
    [w.x - 0.021, w.low + 0.016],
    [w.x + 0.021, w.top - w.curve - 0.017],
    glass,
    0.04,
    tint.sash,
    lod === 3,
  );
  for (const f of lod === 1 ? [0.52] : [0.27, 0.53, 0.77]) {
    const y = mix(w.low, w.top - w.curve, f);
    band(
      out,
      s,
      'detail',
      [w.x - r + 0.02, y - 0.018],
      [w.x + r - 0.02, y + 0.018],
      glass,
      0.046,
      tint.sash,
      lod === 3,
    );
  }
  if (lod < 2 || !decorated) return;
  const cap = arch({ ...w, low: w.top - w.curve - 0.13 }, n, 0.17).slice(2);
  for (let i = 1; i < cap.length; i++)
    beam(out, 'trim', s.p(...cap[i - 1], 0.142), s.p(...cap[i], 0.142), 0.113, 0.15, tint.hood);
  for (const side of [-1, 1]) {
    const u = w.x + side * (r + 0.14),
      y = w.top - w.curve;
    band(out, s, 'trim', [u - 0.07, y - 0.24], [u + 0.07, y + 0.035], 0.04, 0.162, tint.trim, true);
  }
  band(
    out,
    s,
    'trim',
    [w.x - 0.081, w.top + 0.09],
    [w.x + 0.081, w.top + 0.29],
    0.055,
    0.184,
    tint.pale,
    true,
  );
}

function windows(s, front, side) {
  const count = front
    ? 5
    : s.length < 2.35
      ? 0
      : Math.max(1, Math.floor(s.length / (side ? 3.65 : 3.0)));
  return Array.from({ length: count }, (_, i) => {
    const x = s.length * ((i + 0.5) / count - 0.5),
      width = Math.min(front ? 1.34 : 1.18, s.length / count - 0.59);
    return [
      { x, width: width * 0.63, low: 0.52, top: 1.66, basement: true },
      {
        x,
        width,
        low: front && i === 2 ? 2.21 : 2.65,
        top: 5.55,
        curve: 0.13,
        door: front && i === 2,
      },
      { x, width: width * 0.94, low: 6.93, top: 9.82, curve: 0.16 },
      { x, width: width * 0.86, low: 11.41, top: 13.7, curve: 0.16 },
    ];
  }).flat();
}

function walls(out, lod) {
  for (let i = 0; i < body.length; i++) {
    const a = body[(i + 1) % body.length],
      b = body[i],
      s = section(a, b),
      h = s.length / 2;
    const front = i === body.length - 1,
      west = i === 0,
      decorated = front || west;
    const [ga, gb] = [grade(...a), grade(...b)],
      low = Math.min(ga, gb) - 0.24;
    const ws = windows(s, front, west),
      holes = lod >= 2 ? ws.map((w) => arch(w, lod === 2 ? 6 : 8)) : [];
    fill(
      out,
      s,
      'wall',
      rect(-h, low, h, eaves),
      front ? tint.wall : west ? tint.warm : tint.shaded,
      0,
      holes,
    );
    fill(
      out,
      s,
      'base',
      [
        [-h, ga - 0.22],
        [h, gb - 0.22],
        [h, gb + 0.28],
        [-h, ga + 0.28],
      ],
      tint.base,
      0.024,
    );
    for (const w of ws) window(out, s, w, lod, decorated);
    band(out, s, 'trim', [-h, eaves - 0.37], [h, eaves - 0.19], 0, 0.19, tint.trim, lod > 0);
    band(out, s, 'trim', [-h, eaves - 0.18], [h, eaves + 0.07], -0.03, 0.31, tint.pale, lod > 0);
    if (lod >= 2 && decorated) {
      for (let x = -h + 0.23; x < h - 0.11; x += 0.31)
        band(
          out,
          s,
          'trim',
          [x - 0.046, eaves - 0.37],
          [x + 0.046, eaves - 0.16],
          0.12,
          0.24,
          tint.trim,
          true,
        );
      for (const side of [-1, 1])
        for (let y = 1.94, j = 0; y < eaves - 0.65; y += 0.5, j++) {
          const u = side * (h - 0.27),
            w = j % 2 === 0 ? 0.37 : 0.26;
          band(
            out,
            s,
            'wall',
            [u - w / 2, y],
            [u + w / 2, y + 0.32],
            0,
            0.061,
            tint.pale,
            lod === 3,
          );
        }
    }
  }
}

function topPolygon(out, slot, points, y, color) {
  const mesh = earcut(points.flat());
  for (let i = 0; i < mesh.length; i += 3)
    oriented(
      out,
      slot,
      mesh.slice(i, i + 3).map((j) => [points[j][0], y, points[j][1]]),
      [0, 1, 0],
      color,
    );
}

function roofRing(x0, x1, z0, z1, y) {
  return [
    [x0, y, z0],
    [x0, y, z1],
    [x1, y, z1],
    [x1, y, z0],
  ];
}

function roof(out, lod) {
  const x0 = body[0][0],
    x1 = body.at(-1)[0],
    back = body[1][1],
    front = (body[0][1] + body.at(-1)[1]) / 2;
  loft(
    out,
    'slate',
    [
      roofRing(x0 - 0.32, x1 + 0.32, back - 0.14, front + 0.41, eaves),
      roofRing(center - 0.41, center + 0.37, back + 3.55, front - 3.77, plan.ridge),
    ],
    tint.slate,
  );
  topPolygon(out, 'slate', [...body.slice(1, -1), [x1, back]], eaves + 0.045, tint.slateLight);
  if (lod >= 1)
    beam(
      out,
      'slate',
      [center, plan.ridge + 0.045, back + 3.55],
      [center, plan.ridge + 0.045, front - 3.77],
      0.13,
      0.13,
      tint.slateLight,
    );
  const z = front + 0.39,
    h = 3.53,
    y = eaves + 1.68;
  const s = section([center - h, z], [center + h, z]);
  fill(
    out,
    s,
    'wall',
    [
      [-h, eaves],
      [h, eaves],
      [0, y],
    ],
    tint.pale,
    0.012,
  );
  for (const sign of [-1, 1]) {
    const a = [center + sign * h, eaves + 0.015, z + 0.035],
      b = [center, y, z + 0.035],
      c = [center, y, front - 2.36];
    oriented(out, 'slate', [a, b, c], [0, 1, 0], tint.slate);
    oriented(
      out,
      'slate',
      [a, c, [center + sign * h, eaves + 1.12, front - 2.59]],
      [0, 1, 0],
      tint.slate,
    );
    beam(out, 'trim', a, b, 0.121, 0.145, tint.pale);
  }
  for (const [x, q, height] of [
    [x0 + 1.32, 6.18, 18.27],
    [x0 + 1.36, -1.46, 17.62],
  ]) {
    box(
      out,
      'wall',
      [x - 0.53, eaves + 0.48, q - 0.51],
      [x + 0.53, height - 0.1, q + 0.51],
      tint.warm,
    );
    box(out, 'trim', [x - 0.62, height - 0.15, q - 0.59], [x + 0.62, height, q + 0.59], tint.trim);
    if (lod >= 2)
      box(
        out,
        'detail',
        [x - 0.42, height - 0.01, q - 0.41],
        [x + 0.42, height + 0.02, q + 0.41],
        tint.darkTile,
      );
  }
}

function ribbon(out, s, a, b, thickness, d, color) {
  const du = b[0] - a[0],
    dy = b[1] - a[1],
    length = Math.hypot(du, dy),
    x = (-dy * thickness) / (2 * length),
    y = (du * thickness) / (2 * length);
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

function rail(out, s, a, b, y, lod) {
  const top = y + 0.94;
  for (const h of lod === 0 ? [top] : [y + 0.094, top])
    beam(out, 'iron', s.p(a, h, 0.022), s.p(b, h, 0.022), 0.052, 0.052, tint.iron);
  if (lod === 0) return;
  const count = Math.max(2, Math.ceil((b - a) / (lod === 1 ? 0.63 : 0.24)));
  for (let i = 0; i <= count; i++) {
    const u = mix(a, b, i / count);
    if (lod === 1) ribbon(out, s, [u, y + 0.1], [u, top], 0.036, 0.025, tint.iron);
    else {
      beam(
        out,
        'detail',
        s.p(u, y + 0.105, 0.038),
        s.p(u, top, 0.038),
        0.033,
        0.036,
        tint.darkIron,
      );
      if (i < count) {
        const next = mix(a, b, (i + 1) / count),
          mid = (u + next) / 2;
        const pattern = [
          [u + 0.024, y + 0.29],
          [mid, y + 0.54],
          [next - 0.024, y + 0.29],
          [mid, y + 0.17],
        ];
        for (let j = 0; j < 4; j++)
          ribbon(out, s, pattern[j], pattern[(j + 1) % 4], 0.02, 0.041, tint.paleIron);
        if (lod === 3) {
          ribbon(out, s, [mid, y + 0.49], [mid, y + 0.8], 0.021, 0.044, tint.iron);
          for (const sign of [-1, 1])
            ribbon(out, s, [mid, y + 0.7], [mid + sign * 0.061, y + 0.77], 0.017, 0.046, tint.iron);
        }
      }
    }
  }
}

function column(out, x, z, bottom, top, lod) {
  const y = bottom + 0.2;
  box(out, 'iron', [x - 0.16, bottom - 0.018, z - 0.14], [x + 0.16, y, z + 0.14], tint.darkIron);
  if (lod < 2) {
    box(out, 'iron', [x - 0.088, y - 0.01, z - 0.076], [x + 0.088, top, z + 0.076], tint.iron);
    return;
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const p = [x + sx * 0.084, y - 0.017, z + sz * 0.067];
      beam(out, 'iron', p, [p[0], top, p[2]], 0.043, 0.046, tint.iron);
    }
  const s = section([x - 0.13, z + 0.07], [x + 0.13, z + 0.07]);
  const count = lod === 2 ? 8 : 13;
  for (let i = 0; i < count; i++) {
    const floor = mix(y, top, i / count),
      ceiling = mix(y, top, (i + 1) / count),
      m = (floor + ceiling) / 2;
    const sequence = [
      [0, floor],
      [-0.074, m],
      [0, ceiling],
      [0.074, m],
    ];
    for (let j = 0; j < 4; j++)
      ribbon(out, s, sequence[j], sequence[(j + 1) % 4], 0.025, 0.02, tint.paleIron);
    if (lod === 3) ribbon(out, s, [-0.06, m], [0.062, m], 0.018, 0.023, tint.darkIron);
  }
}

function spandrel(out, s, a, b, top, lod) {
  const count = [4, 6, 10, 14][lod],
    height = 0.77;
  const path = Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count;
    return [mix(a, b, t), top - 0.105 - height * Math.pow(Math.abs(2 * t - 1), 2.75)];
  });
  for (let i = 0; i < count; i++) {
    const p = path[i],
      q = path[i + 1],
      d = 0.014;
    ribbon(out, s, p, q, lod >= 2 ? 0.065 : 0.082, d, tint.iron);
    if (lod >= 2 && Math.min(p[1], q[1]) < top - 0.2) {
      const u = mix(p[0], q[0], 0.5),
        y = (p[1] + q[1]) / 2;
      ribbon(
        out,
        s,
        [u, y + 0.019],
        [u + (i < count / 2 ? 0.078 : -0.078), top - 0.083],
        0.024,
        d + 0.008,
        tint.paleIron,
      );
      if (lod === 3)
        ribbon(out, s, [p[0], top - 0.081], [q[0], q[1] + 0.038], 0.018, d + 0.011, tint.darkIron);
    }
  }
}

function porchFront(out, lod) {
  const [floor, upper, top] = porch.levels,
    x0 = porch.x0,
    x1 = porch.x1,
    z = porch.front,
    z0 = porch.back;
  const s = section([x0, z], [x1, z]),
    half = s.length / 2;
  box(out, 'base', [x0 - 0.1, -0.26, z0], [x1 + 0.1, floor - 0.21, z - 0.11], tint.base);
  for (const h of [floor, upper, top]) {
    box(out, 'timber', [x0 - 0.08, h - 0.18, z0 - 0.08], [x1 + 0.08, h, z + 0.1], tint.deck);
    band(
      out,
      s,
      'iron',
      [-half - 0.08, h - 0.22],
      [half + 0.08, h - 0.055],
      0.01,
      0.135,
      tint.darkIron,
      lod >= 1,
    );
    if (lod >= 2)
      band(
        out,
        s,
        'trim',
        [-half - 0.09, h - 0.063],
        [half + 0.09, h - 0.023],
        0.07,
        0.161,
        tint.pale,
        true,
      );
  }
  const posts = Array.from({ length: 6 }, (_, i) => mix(-half + 0.12, half - 0.12, i / 5));
  for (const [low, high] of [
    [floor, upper],
    [upper, top],
  ]) {
    for (const u of posts) column(out, s.p(u, 0)[0], z - 0.045, low, high - 0.16, lod);
    for (let i = 0; i < posts.length - 1; i++)
      spandrel(out, s, posts[i] + 0.1, posts[i + 1] - 0.1, high - 0.15, lod);
    if (low === upper) rail(out, s, posts[0], posts.at(-1), low, lod);
    else {
      rail(out, s, posts[0], -1.37, low, lod);
      rail(out, s, 1.37, posts.at(-1), low, lod);
    }
    if (lod >= 1)
      for (const [a, b] of [
        [
          [x0, z0],
          [x0, z],
        ],
        [
          [x1, z],
          [x1, z0],
        ],
      ]) {
        const side = section(a, b),
          r = side.length / 2;
        rail(out, side, -r + 0.06, r - 0.08, low, lod);
        spandrel(out, side, -r + 0.04, r - 0.04, high - 0.16, lod);
      }
  }
}

function entry(out, lod) {
  const floor = porch.levels[0],
    left = center - 1.32,
    right = center + 1.32,
    z0 = porch.front - 0.01,
    z1 = porch.stepExtent;
  const low = grade(center, z1) + 0.044,
    count = [3, 7, 13, 14][lod];
  for (let i = 0; i < count; i++) {
    const a = mix(z1, z0, i / count),
      b = mix(z1, z0, (i + 1) / count),
      y = mix(low, floor, (i + 1) / count);
    box(out, 'base', [left, low - 0.27, b], [right, y, a + 0.013], tint.pale);
  }
  if (lod >= 1)
    for (const x of [left + 0.09, right - 0.09]) {
      beam(out, 'iron', [x, low + 0.88, z1], [x, floor + 0.9, z0], 0.051, 0.059, tint.darkIron);
      const n = lod === 1 ? 4 : count;
      for (let i = 0; i <= n; i++) {
        const u = i / n,
          y = mix(low, floor, u),
          z = mix(z1, z0, u);
        beam(out, 'iron', [x, y, z], [x, y + 0.89, z], 0.038, 0.044, tint.iron);
      }
    }
  if (lod >= 2) {
    const tile = 0.33;
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 3; j++) {
        const x = center - 1.32 + tile * i,
          z = z1 + tile * j;
        const points = [
          [x, z],
          [x + tile, z],
          [x + tile, z + tile],
          [x, z + tile],
        ].map(([x, z]) => [x, grade(x, z) + 0.022, z]);
        oriented(out, 'detail', points, [0, 1, 0], (i + j) % 2 ? tint.whiteTile : tint.darkTile);
      }
  }
}

function build(out, lod) {
  walls(out, lod);
  roof(out, lod);
  porchFront(out, lod);
  entry(out, lod);
}
export const rutledgeSkyline = (out) => build(out, 0);
export const rutledgeDistrict = (out) => build(out, 1);
export const rutledgeStreet = (out) => build(out, 2);
export const rutledgeCloseup = (out) => build(out, 3);
const recipe = 'john-rutledge-house-model.mjs';
const camera = [-30, 18.5, 47],
  lookAt = [0.7, 8, 4.2];
export const rutledgeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: rutledgeCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The 116 Broad Street house with a two-story blue-green cast-iron porch, pale five-bay facade, terracotta hoods and slate hip.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-29, 39, 36],
  mediumFiContext: {
    scale: 1.1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: ring,
    outlines: [ring],
    minimumCoverage: 0.92,
    basis: 'Mapped body and projecting Broad Street porch.',
  },
  embeddedCanonicalGraphs: [
    'stucco',
    'stone_limestone_weathered',
    'stone_limestone',
    'slate',
    'wood_plain',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'broad-street-facade-and-iron-porch',
      position: [-7.6, 5.1, 35],
      lookAt: [0.45, 8.1, 9.5],
    },
    { name: 'cast-iron-columns-and-entry', position: [-6.9, 4.5, 23], lookAt: [0.3, 6.7, 12] },
    { name: 'slate-roof-and-rear-outline', position: [24, 24, -27], lookAt: [0.65, 8.6, 1.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'rutledgeSkyline',
    errorMeters: 0.95,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'rutledgeDistrict', 0.44],
        ['street', 'rutledgeStreet', 0.15],
        ['closeup', 'rutledgeCloseup', 0.055],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The footprint is ODbL. The five exact Qualla originals are CC0 by Warren LeMay.',
};
