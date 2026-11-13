/** The restored fort on the eastern headland of Muscat harbor in August 2024. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  s = plan.section,
  map = read('map-frame');
const [outer] = map.geometry.polygons,
  [court] = map.geometry.holes;
const terrain = read('terrain-grid');
const surfaces = {
  masonry: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  rock: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.99, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.95, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.93, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.96, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.18 },
};
const c = Object.fromEntries(
  Object.entries({
    wall: 'bba98b',
    sun: 'c7b69a',
    muted: 'a59780',
    stone: 'b39f83',
    apron: '595451',
    paving: 'a9916e',
    dark: '474036',
    rail: '625a4f',
    gate: '5c4e3e',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const white = 'palette:#ffffff',
  up = [0, 1, 0],
  tau = Math.PI * 2;
const vary = (color, i, range = 0.11) =>
  color.map((v) => v * (1 + (((i * 13) % 29) / 28 - 0.5) * range));
const xz = ([x, z], y) => [x, y, z];

function face(out, slot, points, expected, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, v, i) => dot + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}

function cap(out, slot, boundary, holes, height, tint) {
  const points = [...boundary, ...holes.flat()];
  let total = boundary.length;
  const starts = holes.map((ring) => {
    const index = total;
    total += ring.length;
    return index;
  });
  const indices = earcut(points.flat(), starts);
  if (!indices.length) throw Error('Fort perimeter could not be triangulated');
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = indices.slice(i, i + 3).map((id) => xz(points[id], height(points[id])));
    face(out, slot, triangle, up, tint);
  }
}

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const [a, b] = terrain.heightsMeters.slice(j, j + 2);
  return (
    (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz -
    terrain.modelDatumElevationMeters
  );
}

const wallFoot = (i) =>
  i >= 17 && i <= 21 ? [10.2, 6.5, 4.9, 6.1, 7.25][i - 17] : s.ridgeShoulder;
const wallTop = (i) =>
  i >= 17 && i <= 21 ? [17.8, 17.25, 15.5, 15.55, 17.2][i - 17] : s.curtainDeck;

function rockApron(out, lod) {
  const [ex, ez] = s.ridgeExpansion,
    centreZ = 8;
  const rings = [1, 2, 3, 5][lod];
  const point = (x, z, y, level) => {
    const t = level / rings;
    const dx = x * ex,
      dz = (z - centreZ) * ez;
    const toeX = x + dx,
      toeZ = z + dz;
    const toeY = Math.min(y - 1.2, Math.max(-11.1, ground(toeX, toeZ) - 0.72));
    const middle = Math.sin(Math.PI * t);
    const lateral = Math.sin(x * 0.31 + z * 0.15 + t * 6.3) * 0.11 * middle;
    const ledge = Math.cos(x * 0.17 - z * 0.44 - t * 7.2) * 1.15 * middle;
    return [
      x + dx * (t + lateral),
      y * (1 - t) + toeY * t + ledge + (1 - t) * 0.04,
      z + dz * (t + lateral * 0.8),
    ];
  };
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    const normal = [outer[j][1] - outer[i][1], 0, outer[i][0] - outer[j][0]];
    const samples =
      lod < 2 ? 1 : Math.max(1, Math.ceil(Math.hypot(normal[0], normal[2]) / (lod === 3 ? 4 : 7)));
    const at = (u, k) => {
      const t = u / samples,
        p = outer[i],
        q = outer[j];
      return point(
        p[0] * (1 - t) + q[0] * t,
        p[1] * (1 - t) + q[1] * t,
        wallFoot(i) * (1 - t) + wallFoot(j) * t,
        k,
      );
    };
    for (let u = 0; u < samples; u++) {
      for (let k = 0; k < rings; k++) {
        const a = at(u, k),
          b = at(u + 1, k),
          d = at(u, k + 1),
          e = at(u + 1, k + 1);
        const tint = vary(c.apron, i + u * 13 + k * 19, 0.19);
        face(out, 'rock', [a, b, e], normal, tint);
        face(out, 'rock', [a, e, d], normal, vary(tint, i + 4, 0.1));
      }
    }
  }
  cap(out, 'rock', outer, [], (p) => wallFoot(outer.indexOf(p)) - 0.06, c.apron);
}

function section(a, b, outerSide) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const ux = dx / length,
    uz = dz / length;
  const sign = outerSide ? 1 : -1,
    n = [sign * uz, 0, -sign * ux];
  return {
    length,
    n,
    at: (u, y, depth = 0) => [a[0] + ux * u + n[0] * depth, y, a[1] + uz * u + n[2] * depth],
  };
}
function panel(out, slot, f, a, b, y0, y1, tint, depth = 0) {
  face(
    out,
    slot,
    [f.at(a, y0, depth), f.at(b, y0, depth), f.at(b, y1, depth), f.at(a, y1, depth)],
    f.n,
    tint,
  );
}

function ports(out, f, from, to, count, y0, y1, width, lod, row) {
  const span = (to - from) / count,
    radius = width / 2;
  const top = y0 + (row ? 1.23 : 0.84),
    sill = y0 + 0.08;
  const rise = radius * 0.71,
    segments = lod < 2 ? 4 : lod === 2 ? 6 : 9;
  let previous = 0;
  for (let i = 0; i < count; i++) {
    const u = from + (i + 0.5) * span,
      a = u - radius,
      b = u + radius;
    const depth = lod ? -0.55 : 0.008;
    if (lod) {
      panel(out, 'masonry', f, previous, a, y0, y1, c.wall);
      panel(out, 'masonry', f, a, b, y0, sill, c.muted);
    }
    panel(out, 'dark', f, a, b, sill, top, c.dark, depth);
    for (let j = 0; j < segments; j++) {
      const p = (Math.PI * j) / segments,
        q = (Math.PI * (j + 1)) / segments;
      const x1 = u - radius * Math.cos(p),
        x2 = u - radius * Math.cos(q);
      const h1 = top + rise * Math.sin(p),
        h2 = top + rise * Math.sin(q);
      face(
        out,
        'dark',
        [f.at(u, top - 0.015, depth), f.at(x1, h1, depth), f.at(x2, h2, depth)],
        f.n,
        c.dark,
      );
      if (!lod) continue;
      face(out, 'masonry', [f.at(x1, h1), f.at(x2, h2), f.at(x2, y1), f.at(x1, y1)], f.n, c.wall);
      face(
        out,
        'stone',
        [f.at(x1, h1), f.at(x1, h1, depth), f.at(x2, h2, depth), f.at(x2, h2)],
        [0, -1, 0],
        c.muted,
      );
    }
    if (lod) {
      const direction = f.at(1, 0).map((v, k) => v - f.at(0, 0)[k]);
      for (const [x, sign] of [
        [a, 1],
        [b, -1],
      ]) {
        face(
          out,
          'stone',
          [f.at(x, sill), f.at(x, top), f.at(x, top, depth), f.at(x, sill, depth)],
          direction.map((v) => v * sign),
          c.muted,
        );
      }
      face(
        out,
        'stone',
        [f.at(a, sill), f.at(b, sill), f.at(b, sill, depth), f.at(a, sill, depth)],
        up,
        c.stone,
      );
    }
    previous = b;
  }
  if (lod) panel(out, 'masonry', f, previous, f.length, y0, y1, c.wall);
}

function curtain(out, lod) {
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    const f = section(outer[i], outer[j], true);
    const lo = wallFoot(i),
      lo2 = wallFoot(j),
      hi = wallTop(i),
      hi2 = wallTop(j);
    if (i === 22 || i === 23) {
      const bank = s.westArches[23 - i];
      if (!lod) panel(out, 'masonry', f, 0, f.length, lo, hi + 0.22, c.wall);
      panel(out, 'masonry', f, 0, f.length, lo, 17.45, c.muted, 0.006);
      ports(out, f, 0.55, f.length - 0.5, bank, 17.45, 20.52, 1.07, lod, 0);
      ports(out, f, 0.53, f.length - 0.52, bank, 20.52, hi + 0.22, 1.47, lod, 1);
      if (lod)
        beam(
          out,
          'stone',
          f.at(0, hi + 0.18, 0.038),
          f.at(f.length, hi + 0.18, 0.038),
          0.17,
          0.22,
          c.sun,
        );
    } else {
      face(
        out,
        'masonry',
        [f.at(0, lo), f.at(f.length, lo2), f.at(f.length, hi2), f.at(0, hi)],
        f.n,
        vary(c.wall, i),
      );
      if (lod && f.length > 10 && (i === 3 || i === 4 || i === 15 || i === 16)) {
        const count = Math.round(f.length / 5.2);
        for (let n = 1; n < count; n++) {
          const x = (f.length * n) / count,
            y = hi + ((hi2 - hi) * n) / count - 2.53;
          panel(out, 'dark', f, x - 0.19, x + 0.19, y, y + 0.75, c.dark, 0.013);
        }
      }
    }
  }
  const courtTop = ([x, z]) =>
    z > 17 && x < -10 ? Math.max(19.1, s.curtainDeck - (z - 17) * 0.2) : s.curtainDeck;
  for (let i = 0; i < court.length; i++) {
    const j = (i + 1) % court.length,
      f = section(court[i], court[j], true);
    face(
      out,
      'masonry',
      [
        f.at(0, s.courtFloor),
        f.at(f.length, s.courtFloor),
        f.at(f.length, courtTop(court[j])),
        f.at(0, courtTop(court[i])),
      ],
      f.n,
      vary(c.sun, i),
    );
  }
  cap(
    out,
    'paving',
    outer,
    [court],
    (p) => {
      const i = outer.indexOf(p);
      return i >= 0 ? wallTop(i) : courtTop(p);
    },
    c.paving,
  );
  cap(out, 'paving', court, [], () => s.courtFloor + 0.025, c.paving);
}

function roundTower(out, config, lod, north) {
  const [x, z, radius, low, top] = config;
  const n = [10, 14, 22, 32][lod];
  const at = (a, r, y) => [x + r * Math.cos(a), y, z + r * Math.sin(a)];
  const rings = [
    [low, radius],
    [low + 0.72, radius],
    [top - 1.88, radius * 0.9],
    ...(lod ? [[top - 1.62, radius * 0.92]] : []),
    [top - 0.56, radius * 0.92],
  ];
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n,
      mid = (a + b) / 2;
    const normal = [Math.cos(mid), 0, Math.sin(mid)];
    for (let j = 1; j < rings.length; j++) {
      const [l, lr] = rings[j - 1],
        [h, hr] = rings[j];
      face(
        out,
        j === 3 ? 'stone' : 'masonry',
        [at(a, lr, l), at(b, lr, l), at(b, hr, h), at(a, hr, h)],
        normal,
        vary(c.wall, i),
      );
    }
    face(
      out,
      'paving',
      [[x, top - 0.56, z], at(a, rings.at(-1)[1], top - 0.56), at(b, rings.at(-1)[1], top - 0.56)],
      up,
      c.paving,
    );
  }
  const teeth = lod ? (north ? 20 : 23) : 7;
  for (let i = 0; i < teeth; i++) {
    const a = (i * tau) / teeth,
      r = radius * 0.91;
    const h = lod ? 0.4 : 0.26;
    const p = at(a, r, top);
    const u = [Math.cos(a), Math.sin(a)],
      v = [-u[1], u[0]],
      side = lod ? 0.34 : 0.45;
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [
      p[0] + i * u[0] * 0.37 + j * v[0] * side,
      p[2] + i * u[1] * 0.37 + j * v[1] * side,
    ]);
    for (let k = 0; k < 4; k++) {
      const a1 = corners[k],
        b1 = corners[(k + 1) % 4];
      face(
        out,
        'masonry',
        [xz(a1, top - 0.63), xz(b1, top - 0.63), xz(b1, top - 0.56 + h), xz(a1, top - 0.56 + h)],
        [b1[1] - a1[1], 0, a1[0] - b1[0]],
        c.sun,
      );
    }
    face(
      out,
      'stone',
      corners.map((q) => xz(q, top - 0.56 + h)),
      up,
      c.sun,
    );
  }
  if (lod) {
    for (const [a, y] of [
      [2.82, top - 6.75],
      [3.82, top - 4.8],
      [4.52, top - 8.4],
      [1.7, top - 5.8],
      [0.4, top - 9.2],
    ]) {
      const r = radius - (radius * 0.1 * (y - low - 0.72)) / (top - low - 2.6) + 0.035;
      const p = at(a, r, y),
        t = [-Math.sin(a), 0, Math.cos(a)],
        normal = [Math.cos(a), 0, Math.sin(a)];
      const q = (u, dy) => [p[0] + t[0] * u, y + dy, p[2] + t[2] * u];
      face(out, 'dark', [q(-0.24, 0), q(0.24, 0), q(0.24, 0.86), q(-0.24, 0.86)], normal, c.dark);
    }
  }
}

function squareTower(out, config, low, lod, keep) {
  const [x, z, w, depth, top] = config;
  const a = x - w / 2,
    b = x + w / 2,
    rear = z - depth / 2,
    front = z + depth / 2;
  const loop = [
    [a, rear],
    [b, rear],
    [b, front],
    [a, front],
  ];
  box(out, 'masonry', x, low, z, w, top - low - 0.49, depth, c.sun);
  if (lod) box(out, 'stone', x, top - 1.43, z, w + 0.18, 0.24, depth + 0.18, c.stone);
  for (let i = 0; i < loop.length; i++) {
    const f = section(loop[i], loop[(i + 1) % loop.length], true);
    const n = lod ? Math.round(f.length / 1.3) : 2;
    for (let j = 0; j < n; j++) {
      const u = (f.length * (j + 0.4)) / n;
      const p = f.at(u, 0, 0.02);
      box(out, 'masonry', p[0], top - 0.55, p[2], 0.74, 0.67, 0.73, c.sun);
    }
    if (lod) {
      for (const u of [f.length * 0.26, f.length * 0.54, f.length * 0.76]) {
        panel(out, 'dark', f, u - 0.24, u + 0.24, top - 5.02, top - 4.15, c.dark, 0.012);
        if (lod >= 2)
          panel(out, 'dark', f, u - 0.31, u + 0.31, top - 9.3, top - 8.35, c.dark, 0.012);
      }
    }
  }
  if (keep) {
    for (const [cx, cz] of [
      [a + 0.61, rear + 0.62],
      [a + 0.65, front - 0.57],
      [b - 0.68, front - 0.64],
    ]) {
      box(out, 'masonry', cx, top - 0.49, cz, 1.13, 0.84, 1.11, c.sun);
      box(out, 'stone', cx, top + 0.34, cz, 0.72, 0.48, 0.73, c.sun);
    }
    if (lod) beam(out, 'metal', [x, top - 0.48, z], [x, top + 7.65, z], 0.11, 0.12, c.rail);
  } else {
    const f = section([a, front], [a, rear], true),
      u = front - s.stairDoor[2];
    panel(out, 'dark', f, u - 0.68, u + 0.68, 8.7, 10.58, c.gate, 0.015);
    face(
      out,
      'dark',
      [f.at(u - 0.68, 10.58, 0.015), f.at(u + 0.68, 10.58, 0.015), f.at(u, 11.25, 0.015)],
      f.n,
      c.gate,
    );
  }
}

function stair(out, a, b, steps) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    length = Math.hypot(dx, dz),
    width = 1.82;
  const px = ((dz / length) * width) / 2,
    pz = ((-dx / length) * width) / 2;
  const p = (t, y, k) => [a[0] + dx * t + px * k, y, a[2] + dz * t + pz * k];
  for (let i = 0; i < steps; i++) {
    const t = i / steps,
      u = (i + 1) / steps;
    const y0 = a[1] + (b[1] - a[1]) * t,
      y = a[1] + (b[1] - a[1]) * u;
    face(out, 'stone', [p(t, y, -1), p(u, y, -1), p(u, y, 1), p(t, y, 1)], up, vary(c.stone, i));
    face(
      out,
      'masonry',
      [p(t, y0, -1), p(t, y0, 1), p(t, y, 1), p(t, y, -1)],
      [-dx, 0, -dz],
      c.muted,
    );
    for (const k of [-1, 1]) {
      const x = p(t, y, k),
        z = p(u, y, k);
      const foot = (q) => Math.min(q[1] - 0.15, Math.max(-11, ground(q[0], q[2]) - 0.24));
      face(out, 'rock', [p(t, foot(x), k), p(u, foot(z), k), z, x], [px * k, 0, pz * k], c.apron);
    }
  }
}

function build(out, lod) {
  rockApron(out, lod);
  curtain(out, lod);
  roundTower(out, s.northBastion, lod, true);
  roundTower(out, s.eastBastion, lod, false);
  squareTower(out, s.keep, 15.7, lod, true);
  squareTower(out, s.approachTower, 4.4, lod, false);
  stair(out, s.stairBottom, s.stairMid, [3, 10, 20, 26][lod]);
  stair(out, s.stairMid, s.stairDoor, [3, 11, 20, 26][lod]);
}

export const jalaliSkyline = (out) => build(out, 0);
export const jalaliDistrict = (out) => build(out, 1);
export const jalaliStreet = (out) => build(out, 2);
export const jalaliCloseup = (out) => build(out, 3);

const recipe = 'al-jalali-fort-model.mjs',
  camera = [-112, 45, -50],
  lookAt = [-5.0, 16.0, 5.0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'jalaliDistrict', 0.75],
    ['street', 'jalaliStreet', 0.33],
    ['closeup', 'jalaliCloseup', 0.13],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const jalaliModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: jalaliCloseup,
  category: 'fort',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The harbor fort on its rocky ridge with staggered round and square towers, the west arches and steep south approach.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline: outer,
    minimumCoverage: 0.85,
    basis:
      'Named mapped fort perimeter, relation 2690780, with an independently bounded approach and rock apron.',
  },
  mediumFiContext: {
    scale: 0.93,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_basalt_raw',
    'stone_sandstone',
    'stone_limestone_raw',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'harbor-curtain-and-lower-stair',
      position: [-122, 21, -4],
      lookAt: [-12.0, 15.7, 7.0],
    },
    { name: 'enclosed-court-and-east-bastion', position: [85, 81, -58], lookAt: [-7.0, 19.2, 6.0] },
    {
      name: 'south-approach-and-square-keep',
      position: [-92, 45, 104],
      lookAt: [-17.0, 14.3, 19.0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-al-jalali-fort-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'jalaliSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and one exact first-party CC0 Qualla photograph.',
};
