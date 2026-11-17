/** Villa d’Este’s palace, upper loggia and principal garden structures in Tivoli. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const terrain = read('terrain-grid');
const { outline, holes } = map.geometry;
const {
  palaceEaves,
  facadeZ,
  terraceY,
  loggiaX,
  loggiaWidth,
  loggiaProjection,
  townGateZ,
  facadeWindowsY,
} = plan.section;
const feature = (id) => map.features.find((feature) => feature.id === `way/${id}`).points;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.92, metallic: 0 },
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.8, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.92, metallic: 0 },
  grotto: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.98, metallic: 0 },
  detail: { slot: 'trim', localRef: 'palette:#f3f2ed', roughness: 0.64, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries({
    wall: 'd1caba',
    pale: 'ded2ba',
    court: 'bfb49e',
    block: 'aaa18c',
    lightStone: 'e4dac4',
    marble: 'dbd0b7',
    buff: 'b3a389',
    grime: '928571',
    roof: 'a95d47',
    darkRoof: '96533f',
    glass: '52606b',
    pane: '616663',
    iron: '67594d',
    shadow: '625e50',
    moss: '77744e',
    rock: 'a09677',
    water: '839c8f',
    deepWater: '67857b',
    foam: 'c7d6c5',
  }).map(([key, value]) => [key, rgb(value)]),
);
const ref = 'palette:#ffffff';
const up = [0, 1, 0];
const at = ([x, z], y) => [x, y, z];
const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const center = (points) =>
  points.reduce((c, p) => [c[0] + p[0] / points.length, c[1] + p[1] / points.length], [0, 0]);

function grade([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const h = (k) =>
    terrain.heightsMeters[k][i] +
    (terrain.heightsMeters[k][i + 1] - terrain.heightsMeters[k][i]) * (u - i);
  return h(j) + (h(j + 1) - h(j)) * (v - j) - terrain.modelDatumElevationMeters;
}

function face(out, slot, points, outward, color) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * outward[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, color);
  else
    out.addTriangle(
      slot,
      ref,
      points,
      n,
      points.map(([x, , z]) => [x, z]),
      color,
    );
}

function capTriangles(ring, voids = []) {
  const builder = new MeshBufferBuilder();
  if (
    !builder.addCap(
      'stone',
      ref,
      ring,
      voids,
      () => 0,
      up,
      (p) => p,
      colors.block,
    )
  )
    throw Error('Cannot triangulate the Villa d’Este outline');
  const { positions, indices } = builder.finalize();
  return Array.from({ length: indices.length / 3 }, (_, i) =>
    Array.from(indices.slice(i * 3, i * 3 + 3), (j) => [positions[j * 3], positions[j * 3 + 2]]),
  );
}

function cap(out, slot, ring, y, color) {
  for (const triangle of capTriangles(ring))
    face(
      out,
      slot,
      triangle.map((p) => at(p, y)),
      up,
      color,
    );
}

function edges(ring, interior = false) {
  const area = ring.reduce((sum, [x, z], i) => {
    const b = ring[(i + 1) % ring.length];
    return sum + x * b[1] - z * b[0];
  }, 0);
  const ordered = area > 0 !== interior ? ring : [...ring].reverse();
  return ordered.map((p, i) => [p, ordered[(i + 1) % ordered.length]]);
}

function edge(a, b) {
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / width,
    dz = (b[1] - a[1]) / width;
  return {
    a,
    b,
    width,
    n: [dz, 0, -dx],
    at: (u, y, d = 0) => [a[0] + dx * u + dz * d, y, a[1] + dz * u - dx * d],
  };
}

function panel(out, slot, f, x0, x1, y0, y1, d, color) {
  face(out, slot, [f.at(x0, y0, d), f.at(x1, y0, d), f.at(x1, y1, d), f.at(x0, y1, d)], f.n, color);
}
function ledge(out, slot, f, x0, x1, y0, y1, depth, color) {
  panel(out, slot, f, x0, x1, y0, y1, depth, color);
  face(
    out,
    slot,
    [f.at(x0, y1, depth), f.at(x1, y1, depth), f.at(x1, y1), f.at(x0, y1)],
    up,
    color,
  );
}
function strip(out, slot, a, b, bottom, top, color) {
  const f = edge(a, b);
  face(out, slot, [at(a, bottom(a)), at(b, bottom(b)), at(b, top), at(a, top)], f.n, color);
}

const courtyardY = [-0.28, 7.08];
const palaceTriangles = capTriangles(outline, holes);
const roofEdges = [...edges(outline), ...holes.flatMap((h) => edges(h))];

function within([x, z], ring) {
  let inside = false;
  for (const [a, b] of edges(ring))
    if (a[1] > z !== b[1] > z && x < a[0] + ((z - a[1]) * (b[0] - a[0])) / (b[1] - a[1]))
      inside = !inside;
  return inside;
}

function eave([x, z]) {
  return palaceEaves + Math.min(3.1, Math.max(0, (-z - 38) * 0.061)) + (x < -38 ? 0.12 : 0);
}

function roofHeight(p) {
  const closest = Math.min(
    ...roofEdges.map(([a, b]) => {
      const d = [b[0] - a[0], b[1] - a[1]],
        dx = p[0] - a[0],
        dz = p[1] - a[1];
      const u = Math.max(0, Math.min(1, (dx * d[0] + dz * d[1]) / (d[0] * d[0] + d[1] * d[1])));
      return Math.hypot(dx - u * d[0], dz - u * d[1]);
    }),
  );
  return eave(p) + Math.min(plan.section.roofRiseLimit, closest * plan.section.roofPitch);
}

function roof(out, lod) {
  const parts = [1, 1, 3, 5][lod];
  for (const [a, b, c] of palaceTriangles) {
    const p = (i, j) => [
      a[0] + (i * (b[0] - a[0]) + j * (c[0] - a[0])) / parts,
      a[1] + (i * (b[1] - a[1]) + j * (c[1] - a[1])) / parts,
    ];
    const t = (points) =>
      face(
        out,
        'roof',
        points.map((pt) => at(pt, roofHeight(pt))),
        up,
        colors.roof,
      );
    if (parts === 1) {
      const interior = center([a, b, c]);
      for (const [p, q] of [
        [a, b],
        [b, c],
        [c, a],
      ])
        t([p, q, interior]);
      continue;
    }
    for (let i = 0; i < parts; i++) {
      for (let j = 0; j < parts - i; j++) {
        t([p(i, j), p(i + 1, j), p(i, j + 1)]);
        if (i + j < parts - 1) t([p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)]);
      }
    }
  }
  if (lod > 0) {
    for (const [x, z] of [
      [-32, -25],
      [-24, -11],
      [0, -14],
      [29, -24],
      [20, -62],
      [3, -78],
      [45, -77],
      [-5, -54],
    ]) {
      const p = [x, z];
      if (!within(p, outline) || holes.some((hole) => within(p, hole))) continue;
      const y = roofHeight(p);
      box(out, 'wall', [x - 0.34, y - 2.15, z - 0.26], [x + 0.34, y + 0.71, z + 0.26], colors.buff);
      box(
        out,
        'roof',
        [x - 0.43, y + 0.59, z - 0.34],
        [x + 0.43, y + 0.83, z + 0.34],
        colors.darkRoof,
      );
    }
  }
}

function window(out, f, u, y, width, lod) {
  const l = u - width / 2,
    r = u + width / 2;
  const h = 2.19;
  if (lod > 0) {
    panel(out, 'marble', f, l - 0.11, r + 0.11, y - 0.1, y + h + 0.12, 0.064, colors.lightStone);
    if (lod > 1)
      ledge(out, 'marble', f, l - 0.18, r + 0.18, y - 0.12, y - 0.01, 0.16, colors.marble);
  }
  panel(out, 'detail', f, l, r, y, y + h, 0.078, colors.glass);
  if (lod > 1) {
    panel(out, 'detail', f, u - 0.031, u + 0.031, y, y + h, 0.094, colors.iron);
    panel(out, 'detail', f, l, r, y + h * 0.54, y + h * 0.54 + 0.04, 0.095, colors.iron);
  }
}

function palaceWalls(out, lod) {
  for (const [ringIndex, ring] of [outline, ...holes].entries()) {
    for (const [a, b] of edges(ring, ringIndex > 0)) {
      const f = edge(a, b),
        visitGarden = f.n[2] > 0.97 && f.width > 88;
      const ground = (p) => (ringIndex > 0 ? courtyardY[ringIndex - 1] - 0.18 : grade(p) - 0.95);
      const lo = Math.max(ground(a), ground(b));
      const masonry = Math.max(visitGarden ? terraceY : lo + 1.1, lo + 1.1);
      face(
        out,
        'stone',
        [at(a, ground(a)), at(b, ground(b)), at(b, masonry), at(a, masonry)],
        f.n,
        colors.block,
      );
      face(
        out,
        'wall',
        [at(a, masonry), at(b, masonry), at(b, eave(b)), at(a, eave(a))],
        f.n,
        ringIndex ? colors.court : colors.wall,
      );
      if (lod > 0 || visitGarden) {
        for (const y of visitGarden
          ? [-6.12, -0.21, 5.58, 10.44]
          : [Math.min(eave(a), eave(b)) - 0.37]) {
          if (y > masonry + 0.26)
            ledge(out, 'stone', f, 0, f.width, y - 0.17, y, 0.14, colors.buff);
        }
      }
      if (f.width < 3.7) continue;
      const count = Math.max(1, Math.round(f.width / (lod < 2 ? 9.5 : 5.25)));
      for (let i = 0; i < count; i++) {
        const u = (f.width * (i + 0.5)) / count;
        const [x, , z] = f.at(u, 0);
        if (visitGarden && Math.abs(x - loggiaX) < loggiaWidth * 0.64) continue;
        if (
          f.n[0] < -0.7 &&
          Math.abs(x - map.terrainContact.local[0]) < 7 &&
          Math.abs(z - townGateZ) < 5
        )
          continue;
        const levels = visitGarden ? facadeWindowsY : [-4.4, 1.0, 6.3, 11.1];
        for (const y of levels) {
          if (!visitGarden && y < Math.max(masonry, ground([x, z]) + 0.62)) continue;
          window(out, f, u, y, visitGarden ? 1.34 : 1.14, lod);
        }
      }
    }
  }
  for (const [i, ring] of holes.entries()) cap(out, 'stone', ring, courtyardY[i], colors.buff);
}

function arch(out, f, u, y, width, straight, rise, lod, thickness, depth = 0, filled = false) {
  const n = [4, 5, 9, 14][lod],
    inner = width * 0.5;
  const curve = (r, h, d) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const angle = (Math.PI * i) / n;
      return f.at(u - r * Math.cos(angle), y + straight + h * Math.sin(angle), d);
    });
  const clear = curve(inner, rise, depth);
  const trim = curve(inner + thickness, rise + thickness * 0.66, depth);
  const reveal = lod > 1 ? curve(inner, rise, depth - 0.27) : undefined;
  if (filled) {
    panel(out, 'detail', f, u - inner, u + inner, y, y + straight, depth - 0.015, colors.shadow);
    for (let i = 0; i < n - 1; i++)
      face(out, 'detail', [clear[0], clear[i + 1], clear[i + 2]], f.n, colors.shadow);
  }
  for (let i = 0; i < n; i++) {
    face(out, 'marble', [clear[i], clear[i + 1], trim[i + 1], trim[i]], f.n, colors.marble);
    if (reveal)
      face(
        out,
        'marble',
        [clear[i], reveal[i], reveal[i + 1], clear[i + 1]],
        [0, -1, 0],
        colors.buff,
      );
  }
  for (const x of [u - inner - thickness, u + inner])
    ledge(out, 'marble', f, x, x + thickness, y, y + straight, depth + 0.028, colors.marble);
}

function post(out, x, z, y, height, wide, lod) {
  if (lod < 2) {
    box(
      out,
      'marble',
      [x - wide * 0.35, y - 0.06, z - wide * 0.31],
      [x + wide * 0.35, y + height, z + wide * 0.31],
      colors.lightStone,
    );
    return;
  }
  box(
    out,
    'marble',
    [x - wide * 0.47, y - 0.06, z - wide * 0.47],
    [x + wide * 0.47, y + 0.29, z + wide * 0.47],
    colors.buff,
  );
  const ends = [
    [0.25, wide * 0.36],
    [height * 0.71, wide * 0.28],
    [height - 0.27, wide * 0.28],
  ];
  loft(
    out,
    'marble',
    ends.map(([h, r]) => radialRing(y + h, r, r, 8, [x, z])),
    colors.lightStone,
    { cap: false },
  );
  box(
    out,
    'marble',
    [x - wide * 0.48, y + height - 0.29, z - wide * 0.43],
    [x + wide * 0.48, y + height + 0.025, z + wide * 0.43],
    colors.marble,
  );
}

function balustrade(out, a, b, y, lod) {
  const f = edge(a, b);
  ledge(out, 'marble', f, 0, f.width, y + 0.92, y + 1.12, 0.26, colors.marble);
  ledge(out, 'marble', f, 0, f.width, y + 0.02, y + 0.19, 0.22, colors.buff);
  const n = Math.max(2, Math.round(f.width / [4.6, 2.2, 1.13, 0.63][lod]));
  for (let i = 0; i < n; i++) {
    const u = (f.width * (i + 0.5)) / n;
    if (lod < 3)
      panel(out, 'marble', f, u - 0.15, u + 0.15, y + 0.16, y + 0.95, 0.13, colors.lightStone);
    else {
      const [x, , z] = f.at(u, y, 0.11);
      loft(
        out,
        'marble',
        [
          [0.17, 0.135],
          [0.31, 0.09],
          [0.49, 0.14],
          [0.67, 0.105],
          [0.91, 0.102],
        ].map(([h, r]) => radialRing(y + h, r, r, 5, [x, z])),
        colors.marble,
        { cap: false },
      );
    }
  }
}

function loggia(out, lod) {
  const x0 = loggiaX - loggiaWidth * 0.5,
    x1 = loggiaX + loggiaWidth * 0.5,
    z = facadeZ + loggiaProjection;
  const f = edge([x1, z], [x0, z]);
  for (const [i, base] of [terraceY, terraceY + 5.66].entries()) {
    const ceiling = base + (i === 0 ? 5.66 : 5.26);
    for (const x of [x0 + 0.65, loggiaX - 2.18, loggiaX + 2.18, x1 - 0.65])
      post(out, x, z - 0.35, base, ceiling - base - 0.26, i === 0 ? 1.0 : 0.81, lod);
    for (const [u, w] of [
      [f.width * 0.5, 4.08],
      [f.width * 0.12, 1.42],
      [f.width * 0.88, 1.42],
    ]) {
      if (u !== f.width * 0.5 && lod === 0) continue;
      arch(
        out,
        f,
        u,
        base + 0.14,
        w,
        i === 0 ? 2.85 : 2.71,
        w * 0.33,
        lod,
        0.22,
        -0.22,
        u !== f.width * 0.5,
      );
      if (u !== f.width * 0.5)
        panel(
          out,
          'stone',
          f,
          u - w * 0.5,
          u + w * 0.5,
          base + 0.25,
          base + 0.81,
          0.03,
          colors.buff,
        );
      if (i === 0 && u === f.width * 0.5)
        panel(out, 'detail', f, u - 1.79, u + 1.79, base + 0.4, base + 3.68, -4.63, colors.shadow);
    }
    box(
      out,
      'marble',
      [x0 - 0.28, ceiling - 0.41, facadeZ - 0.2],
      [x1 + 0.28, ceiling, z + 0.32],
      colors.marble,
    );
    balustrade(out, [x1 + 0.18, z + 0.22], [x0 - 0.18, z + 0.22], ceiling, lod);
    for (const side of [-1, 1]) {
      const x = side < 0 ? x0 + 0.35 : x1 - 0.35;
      post(out, x, facadeZ + 0.5, base, ceiling - base - 0.34, 0.78, lod);
      balustrade(out, [x, z + 0.18], [x, facadeZ - 0.09], ceiling, lod);
    }
  }
  const top = terraceY + 5.66;
  for (const side of [-1, 1]) {
    const edgeX = side < 0 ? x0 : x1,
      length = 11.5,
      count = [5, 9, 15, 22][lod];
    for (let j = 0; j < count; j++) {
      const span = ((j + 1) * length) / count,
        y = top - ((j + 1) * (top - terraceY)) / count;
      const bounds = [edgeX + side * (span - length / count), edgeX + side * span].sort(
        (a, b) => a - b,
      );
      box(
        out,
        'stone',
        [bounds[0], terraceY - 0.18, facadeZ + 0.32],
        [bounds[1], y, facadeZ + 2.45],
        colors.marble,
      );
    }
    beam(
      out,
      'marble',
      [edgeX, top + 1.05, facadeZ + 2.37],
      [edgeX + side * length, terraceY + 1.05, facadeZ + 2.37],
      0.19,
      0.22,
      colors.marble,
    );
  }
}

function entry(out, lod) {
  const f = edge(outline[26], outline[27]);
  const u = (f.width * (townGateZ - f.a[1])) / (f.b[1] - f.a[1]);
  const [, streetZ] = map.terrainContact.local;
  const base = grade([map.terrainContact.local[0], streetZ]) + 0.11;
  panel(out, 'wall', f, u - 3.56, u + 3.56, base, base + 7.5, 0.14, colors.pale);
  arch(out, f, u, base, 3.28, 2.68, 1.58, lod, 0.29, 0.29, true);
  ledge(out, 'marble', f, u - 3.15, u + 3.15, base + 4.36, base + 4.63, 0.36, colors.marble);
  ledge(out, 'stone', f, u - 3.54, u + 3.54, base + 7.14, base + 7.42, 0.37, colors.buff);
  if (lod > 0)
    panel(out, 'detail', f, u - 0.58, u + 0.58, base + 5.12, base + 6.96, 0.18, colors.glass);
}

function terrace(out, lod) {
  const ring = rect(-48.7, 48.6, facadeZ + 0.06, facadeZ + 5.02);
  cap(out, 'stone', ring, terraceY, colors.buff);
  for (const [a, b] of edges(ring))
    strip(
      out,
      'stone',
      a,
      b,
      (p) => Math.min(terraceY - 0.24, grade(p) - 0.31),
      terraceY,
      colors.block,
    );
  for (const [a, b] of [
    [ring[2], [loggiaX + cradleHalf, ring[2][1]]],
    [[loggiaX - cradleHalf, ring[2][1]], ring[3]],
  ])
    balustrade(out, a, b, terraceY, lod);
}

const cradleHalf = 6.05;
const lath = (out, points, width, height, color) => {
  for (let i = 1; i < points.length; i++)
    beam(out, 'detail', points[i - 1], points[i], width, height, color);
};
const meanHeight = (ring) => ring.reduce((sum, p) => sum + grade(p), 0) / ring.length;

function basin(out, nativeRing, y, lod, color = colors.water) {
  const ring = lod < 2 ? nativeRing.filter((_, i) => i % 2 === 0) : nativeRing;
  const c = center(ring);
  const inner = ring.map((p) => mix(p, c, 0.135));
  cap(out, 'detail', inner, y - 0.17, color);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const [a, b] = [ring[i], ring[j]],
      [p, q] = [inner[i], inner[j]];
    face(
      out,
      'marble',
      [a, b, q, p].map((v) => at(v, y + 0.13)),
      up,
      colors.buff,
    );
    const external = edge(a, b),
      internal = edge(q, p);
    face(
      out,
      'stone',
      [
        at(a, Math.min(y - 0.35, grade(a) - 0.15)),
        at(b, Math.min(y - 0.35, grade(b) - 0.15)),
        at(b, y + 0.13),
        at(a, y + 0.13),
      ],
      external.n,
      colors.block,
    );
    panel(out, 'stone', internal, 0, internal.width, y - 0.2, y + 0.13, 0, colors.buff);
  }
  return c;
}

function nicheBlock(out, location, y, angle, span, rise, lod, sideBays = 1) {
  const [x, z] = location,
    dx = Math.cos(angle),
    dz = Math.sin(angle);
  const a = [x - (dx * span) / 2, z - (dz * span) / 2],
    b = [x + (dx * span) / 2, z + (dz * span) / 2],
    f = edge(a, b);
  const low = (p) => Math.min(y - 0.54, grade(p) - 0.24);
  strip(out, 'grotto', a, b, low, y + rise, colors.rock);
  const fBack = edge(
    [b[0] - f.n[0] * 1.0, b[1] - f.n[2] * 1.0],
    [a[0] - f.n[0] * 1.0, a[1] - f.n[2] * 1.0],
  );
  strip(out, 'grotto', fBack.a, fBack.b, low, y + rise, colors.rock);
  for (const offset of sideBays === 1 ? [0] : [-span * 0.28, 0, span * 0.28]) {
    const u = span * 0.5 + offset,
      w = offset === 0 ? span * 0.29 : span * 0.14;
    arch(out, f, u, y + 0.34, w, rise * 0.37, rise * 0.2, lod, 0.185, 0.25, true);
    const [px, , pz] = f.at(u + w * 0.5 + 0.25, y, 0.18);
    post(out, px, pz, y, rise * 0.79, 0.47, lod);
  }
  ledge(out, 'marble', f, 0, span, y + rise - 0.65, y + rise - 0.29, 0.35, colors.marble);
  ledge(out, 'marble', f, 0, span, y + rise - 0.16, y + rise + 0.14, 0.44, colors.lightStone);
}

function jets(out, locations, y, maxRise, lod) {
  if (lod < 2) return;
  for (const [x, z] of locations) {
    const curve = Array.from({ length: lod === 2 ? 4 : 7 }, (_, i) => {
      const t = i / (lod === 2 ? 3 : 6);
      return [x + t * 0.65, y + 4 * maxRise * t * (1 - t), z + t * 0.26];
    });
    lath(out, curve, 0.056, 0.062, colors.foam);
  }
}

function stoneBowl(out, c, y, r, lod) {
  const sides = [6, 6, 12, 20][lod];
  const rings =
    lod < 2
      ? [
          [0, r * 0.36],
          [0.96, r],
          [0.99, r * 0.77],
        ]
      : [
          [0, r * 0.34],
          [0.35, r * 0.39],
          [0.73, r * 0.71],
          [0.96, r],
          [1.11, r * 0.94],
          [0.99, r * 0.77],
        ];
  loft(
    out,
    'grotto',
    rings.map(([h, w]) => radialRing(y + h, w, w, sides, c)),
    colors.rock,
    { cap: false },
  );
  const pool = radialRing(y + 0.998, r * 0.77, r * 0.77, sides, c).map(([x, , z]) => [x, z]);
  cap(out, 'detail', pool, y + 0.998, colors.deepWater);
}

function galleryPath(out, points, width, lod, stairs = false) {
  for (let index = 1; index < points.length; index++) {
    const f = edge(points[index - 1], points[index]);
    const count = Math.max(
      1,
      Math.ceil(f.width / (stairs ? [8, 5, 2, 1.05][lod] : [18, 12, 9, 7][lod])),
    );
    for (let i = 0; i < count; i++) {
      const u0 = (f.width * i) / count,
        u1 = (f.width * (i + 1)) / count;
      const ground = (u, d) => {
        const [x, , z] = f.at(u, 0, d);
        return grade([x, z]);
      };
      const y00 = ground(u0, -width * 0.5),
        y01 = ground(u0, width * 0.5),
        y10 = ground(u1, -width * 0.5),
        y11 = ground(u1, width * 0.5);
      const y0 = stairs ? Math.max(y00, y01, y10, y11) + 0.16 : y00 + 0.14;
      const y1 = stairs ? y0 : y10 + 0.14,
        y2 = stairs ? y0 : y11 + 0.14,
        y3 = stairs ? y0 : y01 + 0.14;
      const points = [
        f.at(u0, y0, -width * 0.5),
        f.at(u1, y1, -width * 0.5),
        f.at(u1, y2, width * 0.5),
        f.at(u0, y3, width * 0.5),
      ];
      face(out, 'stone', points, up, colors.buff);
      if (stairs && lod > 0) {
        face(
          out,
          'stone',
          [
            f.at(u1, Math.min(y10, y11) - 0.19, -width * 0.5),
            f.at(u1, Math.min(y10, y11) - 0.19, width * 0.5),
            points[2],
            points[1],
          ],
          [-f.n[2], 0, f.n[0]],
          colors.block,
        );
      }
    }
  }
}

function lowerGarden(out, lod) {
  for (const id of [561341072, 41251469, 41260227]) {
    const ring = feature(id),
      y = meanHeight(ring) + 0.55;
    if (lod > 1) basin(out, ring, y, lod, colors.deepWater);
    else {
      cap(out, 'detail', ring, y, colors.deepWater);
      for (const [a, b] of edges(ring))
        strip(
          out,
          'stone',
          a,
          b,
          (p) => Math.min(y - 0.35, grade(p) - 0.2),
          y + 0.045,
          colors.block,
        );
    }
  }
  galleryPath(out, feature(41259996), 3.48, lod);
  galleryPath(out, feature(41250035), 3.34, lod, true);
  if (lod > 1) galleryPath(out, feature(41250262), 2.65, lod, true);
  galleryPath(
    out,
    [
      [-55, 99],
      [-8, 99.7],
      [24, 99.8],
      [65, 99.7],
    ],
    3.25,
    lod,
  );
  galleryPath(
    out,
    [
      [-70, 127],
      [-34, 126],
      [-6, 124],
      [30, 123],
      [68, 120],
    ],
    3.17,
    lod,
  );
  galleryPath(
    out,
    [
      [-5.8, 124],
      [-3.8, 134],
      [-5.13, 147],
    ],
    2.47,
    lod,
    true,
  );
}

function gardens(out, lod) {
  const shell = [loggiaX, 8.8],
    shellY = grade(shell) + 0.7;
  const lily = radialRing(shellY, 3.2, 2.12, [8, 12, 18, 24][lod], shell).map(([x, , z]) => [x, z]);
  basin(out, lily, shellY, lod);
  stoneBowl(out, [shell[0], shell[1] - 1.18], shellY + 1.6, 1.27, lod);
  nicheBlock(out, [shell[0], shell[1] - 0.85], shellY + 0.04, Math.PI, 7.25, 3.44, lod, 1);

  const walk = feature(41271399);
  for (let k = 1; k < walk.length; k++) {
    const a = walk[k - 1],
      b = walk[k],
      f = edge(a, b);
    const sections = Math.ceil(f.width / (lod === 0 ? 19 : 10));
    for (let i = 0; i < sections; i++) {
      const u0 = (i * f.width) / sections,
        u1 = ((i + 1) * f.width) / sections;
      const p = f.at((u0 + u1) * 0.5, 0, 1.15),
        y = grade([p[0], p[2]]) + 0.17;
      const terraceCorners = [
        f.at(u0, y, 0.08),
        f.at(u1, y, 0.08),
        f.at(u1, y, 2.44),
        f.at(u0, y, 2.44),
      ];
      face(out, 'stone', terraceCorners, up, colors.buff);
      panel(out, 'grotto', f, u0, u1, y - 0.62, y + 1.1, 0.08, colors.moss);
      ledge(out, 'marble', f, u0, u1, y + 0.69, y + 0.87, 0.41, colors.buff);
      if (lod > 0)
        for (let j = 0; j < (lod === 3 ? 5 : 3); j++) {
          const u = u0 + ((u1 - u0) * (j + 0.5)) / (lod === 3 ? 5 : 3),
            q = f.at(u, y + 0.57, 0.47);
          if (lod > 1)
            box(
              out,
              'grotto',
              [q[0] - 0.22, y + 0.38, q[2] - 0.15],
              [q[0] + 0.22, y + 0.54, q[2] + 0.15],
              colors.rock,
            );
        }
    }
  }

  const dragon = feature(561337080),
    dy = meanHeight(dragon) + 0.25;
  const dc = basin(out, dragon, dy, lod);
  stoneBowl(out, dc, dy - 0.04, 1.72, lod);
  for (const [dx, dz] of [
    [-1.45, 0.88],
    [1.45, 0.88],
    [-1.45, -0.88],
    [1.45, -0.88],
  ]) {
    const x = dc[0] + dx,
      z = dc[1] + dz;
    const count = [5, 6, 8, 10][lod];
    loft(
      out,
      'grotto',
      [
        [0, 0.43],
        [0.49, 0.38],
        [0.94, 0.27],
        [1.36, 0.26],
        [1.57, 0.16],
      ].map(([h, r]) => radialRing(dy + h, r, r * 0.73, count, [x, z])),
      colors.moss,
      { cap: false },
    );
  }
  jets(
    out,
    [
      [dc[0], dc[1]],
      [dc[0] + 1.45, dc[1] - 0.67],
    ],
    dy + 0.4,
    2.0,
    lod,
  );

  const ov = feature(561341074),
    oy = meanHeight(ov) + 0.44;
  const oc = basin(out, ov, oy, lod);
  const rearX = oc[0] - 4.05;
  const shape = Array.from({ length: lod > 1 ? 9 : 5 }, (_, i) => {
    const t = (i / (lod > 1 ? 8 : 4)) * Math.PI;
    return [rearX - 1.76 * Math.sin(t), oc[1] - 9.28 * Math.cos(t)];
  });
  for (const [a, b] of shape.slice(1).map((p, i) => [shape[i], p])) {
    const mid = mix(a, b, 0.5);
    nicheBlock(
      out,
      mid,
      oy - 0.12,
      Math.atan2(b[1] - a[1], b[0] - a[0]),
      Math.hypot(b[0] - a[0], b[1] - a[1]),
      3.94,
      lod,
      1,
    );
  }
  stoneBowl(out, [oc[0] - 0.95, oc[1]], oy + 0.12, 1.18, lod);

  const organ = feature(58360190),
    organC = center(organ);
  const organY = meanHeight(organ) + 0.31;
  basin(out, organ, organY, lod);
  nicheBlock(out, [organC[0] - 3.74, organC[1]], organY + 0.14, Math.PI * 0.5, 18.3, 8.3, lod, 3);
  for (const z of [organC[1] - 1.25, organC[1] + 1.25])
    post(out, organC[0] - 4.5, z, organY + 8.11, 1.36, 0.59, lod);

  const nep = feature(561341073),
    ny = meanHeight(nep) + 0.16;
  const nc = basin(out, nep, ny, lod, colors.deepWater);
  const second = feature(561347911);
  basin(out, second, meanHeight(second) + 0.21, lod);
  for (let i = 0; i < 4; i++) {
    const x = nc[0] - 4.12 + i * 1.46,
      y = ny + 2.9 - i * 0.71;
    box(
      out,
      'grotto',
      [x - 0.7, Math.min(y - 1, grade([x, nc[1]]) - 1.45), nc[1] - 4.92],
      [x + 0.7, y, nc[1] + 4.92],
      colors.moss,
    );
    box(
      out,
      'detail',
      [x - 0.66, y, nc[1] - 3.56],
      [x + 0.68, y + 0.078, nc[1] + 3.56],
      colors.water,
    );
  }
  jets(
    out,
    [-2.6, 0, 2.6].map((dz) => [nc[0] + 1.58, nc[1] + dz]),
    ny + 0.08,
    3.23,
    lod,
  );

  const rot = feature(561337082),
    rotY = meanHeight(rot) + 0.11;
  const rotC = basin(out, rot, rotY, lod);
  for (const [dx, dz] of [
    [4.16, 4.16],
    [-4.16, -4.16],
    [4.16, -4.16],
    [-4.16, 4.16],
  ])
    stoneBowl(out, [rotC[0] + dx, rotC[1] + dz], rotY - 0.13, 0.83, lod);

  if (lod > 0) {
    const rometta = [67.71, 34.96],
      ry = grade(rometta) + 0.25;
    const hull = [
      [-2.2, -1.28],
      [1.55, -1.13],
      [2.57, 0],
      [1.54, 1.19],
      [-2.37, 1.25],
    ].map((p) => [p[0] + rometta[0], p[1] + rometta[1]]);
    basin(
      out,
      radialRing(ry, 4.18, 3.3, 12, rometta).map(([x, , z]) => [x, z]),
      ry,
      lod,
      colors.deepWater,
    );
    cap(out, 'grotto', hull, ry + 0.44, colors.rock);
    for (const [a, b] of edges(hull))
      strip(out, 'grotto', a, b, () => ry - 0.17, ry + 0.44, colors.moss);
    post(out, rometta[0] - 0.1, rometta[1], ry + 0.4, 2.71, 0.5, lod);
    const civetta = [78.72, 51.77],
      cy = grade(civetta) + 0.23;
    basin(
      out,
      radialRing(cy, 3.29, 2.35, 12, civetta).map(([x, , z]) => [x, z]),
      cy,
      lod,
    );
    nicheBlock(out, [civetta[0], civetta[1] - 2.18], cy, Math.PI, 7.2, 6.35, lod, 3);
  }
}

function skyline(out) {
  for (const [i, ring] of [outline, ...holes].entries()) {
    for (const [a, b] of edges(ring, i > 0)) {
      const f = edge(a, b);
      face(
        out,
        'wall',
        [
          at(a, (i ? courtyardY[i - 1] : grade(a)) - 0.95),
          at(b, (i ? courtyardY[i - 1] : grade(b)) - 0.95),
          at(b, eave(b)),
          at(a, eave(a)),
        ],
        f.n,
        colors.wall,
      );
      if (f.n[2] > 0.97 && f.width > 88) {
        for (let j = 0; j < 11; j++) {
          const u = (f.width * (j + 0.5)) / 11;
          const [x] = f.at(u, 0);
          if (Math.abs(x - loggiaX) < 6.1) continue;
          for (const y of facadeWindowsY)
            panel(out, 'detail', f, u - 0.69, u + 0.69, y, y + 2.19, 0.075, colors.glass);
        }
      }
    }
  }
  for (const [i, ring] of holes.entries()) cap(out, 'stone', ring, courtyardY[i], colors.buff);
  roof(out, 0);
  entry(out, 0);
  lowerGarden(out, 0);
  const z = facadeZ + loggiaProjection,
    x0 = loggiaX - loggiaWidth * 0.5,
    x1 = loggiaX + loggiaWidth * 0.5;
  const front = edge([x1, z], [x0, z]);
  for (const y of [terraceY, terraceY + 5.66]) {
    for (const x of [x0 + 0.82, loggiaX - 2.43, loggiaX + 2.43, x1 - 0.82])
      box(out, 'marble', [x - 0.37, y, z - 0.75], [x + 0.37, y + 5.16, z - 0.18], colors.marble);
    arch(out, front, front.width * 0.5, y + 0.15, 4.04, 2.7, 1.34, 0, 0.24, -0.17);
    box(
      out,
      'marble',
      [x0 - 0.28, y + 5.15, facadeZ - 0.05],
      [x1 + 0.28, y + 5.48, z + 0.29],
      colors.marble,
    );
  }
  cap(out, 'stone', rect(-48.7, 48.6, facadeZ + 0.06, facadeZ + 5.02), terraceY, colors.buff);
  strip(
    out,
    'stone',
    [48.6, facadeZ + 5.02],
    [-48.7, facadeZ + 5.02],
    (p) => Math.min(terraceY - 0.24, grade(p) - 0.31),
    terraceY,
    colors.block,
  );
  for (const [id, depth] of [
    [561337080, 0.7],
    [561341074, 0.92],
    [58360190, 0.86],
    [561341073, 0.56],
    [561347911, 0.64],
    [561337082, 0.65],
  ]) {
    const full = feature(id),
      y = meanHeight(full) + 0.3;
    const ring = full.filter((_, i) => i % 2 === 0);
    cap(out, 'detail', ring, y, colors.water);
    for (const [a, b] of edges(ring))
      strip(out, 'stone', a, b, (p) => Math.min(y - depth, grade(p) - 0.12), y, colors.buff);
    const [x, z] = center(full);
    if (id === 58360190)
      box(
        out,
        'stone',
        [x - 4.68, y - 0.33, z - 8.68],
        [x - 2.55, y + 7.79, z + 8.68],
        colors.buff,
      );
    if (id === 561341073)
      box(
        out,
        'grotto',
        [x - 4.81, y - 0.72, z - 4.31],
        [x + 0.49, y + 1.92, z + 4.31],
        colors.moss,
      );
  }
  const walk = feature(41271399);
  for (let i = 1; i < walk.length; i++) {
    const f = edge(walk[i - 1], walk[i]);
    for (let j = 0; j < 5; j++) {
      const u0 = (f.width * j) / 5,
        u1 = (f.width * (j + 1)) / 5;
      const a = f.at(u0, 0, 1.22),
        b = f.at(u1, 0, 1.22);
      const y0 = grade([a[0], a[2]]),
        y1 = grade([b[0], b[2]]);
      face(
        out,
        'stone',
        [
          f.at(u0, y0 + 0.26),
          f.at(u1, y1 + 0.26),
          f.at(u1, y1 + 0.26, 2.44),
          f.at(u0, y0 + 0.26, 2.44),
        ],
        up,
        colors.buff,
      );
    }
  }
}

function build(out, lod) {
  if (lod === 0) return skyline(out);
  palaceWalls(out, lod);
  roof(out, lod);
  terrace(out, lod);
  loggia(out, lod);
  entry(out, lod);
  gardens(out, lod);
  lowerGarden(out, lod);
}

export const villaSkyline = (out) => build(out, 0);
export const villaDistrict = (out) => build(out, 1);
export const villaStreet = (out) => build(out, 2);
export const villaCloseup = (out) => build(out, 3);

const recipe = 'villa-d-este-model.mjs';
const camera = [179, 94, 181],
  lookAt = [-10, -15.3, 42.6];
export const villaModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  wikidataId: plan.wikidataId,
  cell: plan.cell,
  recipe,
  surfaces,
  category: 'landmark',
  build: villaCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline,
    minimumCoverage: 0.995,
    basis: 'The mapped palace footprint around both courts, with the neighbouring church retained.',
  },
  brief:
    'Tivoli’s Villa d’Este palace, with its two courts, pale three-storey garden front, double Renaissance loggia, stepped garden, and stone fountains.',
  camera,
  lookAt,
  sunDirection: [81, 93, 110],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.7,
    cameraYaw: 0.52,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'palace-and-hillside-garden', position: [166, 98, 199], lookAt: [-13, -15, 48] },
    {
      name: 'two-storey-loggia-and-bicchierone',
      position: [-8, 1.8, 30],
      lookAt: [-9, -2.2, -3.4],
    },
    { name: 'roof-and-two-open-courts', position: [-84, 87, -64], lookAt: [8, 4, -43] },
    {
      name: 'organ-neptune-and-lower-terraces',
      position: [-25, 4, 169],
      lookAt: [-76, -23.6, 117],
    },
    { name: 'piazza-trento-entrance', position: [-64, 10, -31], lookAt: [-44, 5, -40] },
    {
      name: 'dragon-fountain-and-hundred-fountains',
      position: [11, -8, 66],
      lookAt: [-17, -22.6, 39],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `villa-d-este-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'villaSkyline',
    errorMeters: 1.88,
    surfaces,
    authoredLevels: {
      district: { export: 'villaDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'villaStreet', errorMeters: 0.26, surfaces },
      closeup: { export: 'villaCloseup', errorMeters: 0.115, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry based on five verified public-domain and CC0 images, UNESCO and Villae written descriptions, ODbL OpenStreetMap and attributed Terrarium elevation.',
};
