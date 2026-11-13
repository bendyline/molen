/** The waterfront fort, its four rounded bastions, and its two open courts in 2004. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireFromWorldgen = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = requireFromWorldgen('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  s = plan.section;
const {
  polygons: [outline],
  holes,
} = read('map-frame').geometry;
const terrain = read('terrain-grid');

const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
  weathered: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.94, metallic: 0 },
  cut: { slot: 'trim', graph: 'stone_limestone', roughness: 0.92, metallic: 0 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  recess: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.93, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    wall: '989083',
    shore: 'a29989',
    warm: 'a99b87',
    worn: '8a8478',
    base: '777064',
    coping: 'a49c8b',
    light: 'b5a894',
    walk: '9c9481',
    shade: '72695e',
    hole: '423d34',
    timber: '514337',
    stage: '766f63',
    seat: 'b3a796',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const white = 'palette:#ffffff',
  up = [0, 1, 0];
const p3 = ([x, z], y) => [x, y, z];
const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + x * v - z * u;
  }, 0);

function face(out, slot, points, expected, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
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
        [0, 1],
      ],
      tint,
    );
}

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const a = terrain.heightsMeters[j],
    b = terrain.heightsMeters[j + 1];
  return (
    (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz -
    terrain.modelDatumElevationMeters
  );
}

const eave = ([, z]) =>
  s.shoreEave + s.inlandRise * Math.min(1, Math.max(0, (35 - z) / s.inlandLimit));
const paving = (p) => Math.min(eave(p) - 3.2, ground(p) - 0.36);
const foot = (p) => Math.min(s.floor - 0.3, paving(p));

function plane(a, b, sign) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const normal = [(sign * dz) / length, 0, (-sign * dx) / length];
  const at = (u, y, offset = 0) => [
    a[0] + (dx * u) / length + normal[0] * offset,
    y,
    a[1] + (dz * u) / length + normal[2] * offset,
  ];
  return { a, b, length, normal, at };
}

function planar(out, slot, outer, holes, to3d, normal, tint) {
  const points = [...outer, ...holes.flat()];
  let offset = outer.length;
  const indices = earcut(
    points.flat(),
    holes.map((ring) => {
      const start = offset;
      offset += ring.length;
      return start;
    }),
  );
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = indices.slice(i, i + 3).map((index) => points[index]);
    if (Math.abs(area(triangle)) < 1e-8) continue;
    face(out, slot, triangle.map(to3d), normal, tint);
  }
}

function recess(out, wall, opening, depth, slot, tint, lod) {
  const { at, normal } = wall;
  planar(out, slot, opening, [], ([u, y]) => at(u, y, -depth), normal, tint);
  if (!lod) return;
  for (let i = 0; i < opening.length; i++) {
    const [a, y] = opening[i],
      [b, h] = opening[(i + 1) % opening.length];
    const points = [at(a, y), at(b, h), at(b, h, -depth), at(a, y, -depth)];
    face(out, 'masonry', points, normalFor(...points), c.shade);
  }
}

function openings(out, wall, topAt, lod, windowRows, gate) {
  const { a, b, length, normal, at } = wall;
  const baseA = foot(a),
    baseB = foot(b);
  const yA = topAt(a),
    yB = topAt(b);
  let polygon = [
    [0, baseA],
    [length, baseB],
    [length, yB],
    [0, yA],
  ];
  if (gate) {
    const center = length / 2,
      width = Math.min(length * 0.58, 3.4);
    const left = center - width / 2,
      right = center + width / 2;
    const low = Math.min(baseA, baseB) - 0.035,
      spring = Math.max(baseA, baseB) + 2.72;
    const count = [5, 8, 12, 16][lod];
    const arc = Array.from({ length: count + 1 }, (_, i) => {
      const t = (Math.PI * i) / count;
      return [center - (width / 2) * Math.cos(t), spring + 1.12 * Math.sin(t)];
    });
    const opening = [[left, low], ...arc, [right, low]];
    polygon = [[0, baseA], ...opening, [length, baseB], [length, yB], [0, yA]];
    recess(out, wall, opening, 0.96, 'timber', c.timber, lod);
    if (lod >= 2) {
      const surround = ([u, y]) => at(center + (u - center) * 1.12, y + 0.18, 0.039);
      for (let i = 1; i < arc.length; i++) {
        const a = arc[i - 1],
          b = arc[i];
        face(
          out,
          'cut',
          [at(...a, 0.041), at(...b, 0.041), surround(b), surround(a)],
          normal,
          c.coping,
        );
      }
    }
  }
  const windows = [];
  if (windowRows.length && lod) {
    const count = Math.max(1, Math.round(length / 3.65));
    for (let i = 0; i < count; i++) {
      const u = (length * (i + 0.5)) / count;
      const groundHere = paving(a) + ((paving(b) - paving(a)) * u) / length;
      const crown = yA + ((yB - yA) * u) / length;
      const windowWidth = Math.min(0.92, length * 0.26);
      for (const row of windowRows) {
        const y = groundHere + (crown - groundHere) * row;
        const h = Math.min(1.4, (crown - groundHere) * 0.18);
        const [left, right] = [u - windowWidth / 2, u + windowWidth / 2];
        windows.push([
          [left, y - h / 2],
          [left, y + h / 2],
          [right, y + h / 2],
          [right, y - h / 2],
        ]);
      }
    }
  }
  const exterior = outline.includes(a);
  const slot = exterior && lod >= 2 ? 'weathered' : 'masonry';
  const tint = gate ? c.warm : yA > 11 ? c.wall : c.shore;
  planar(out, slot, polygon, windows, ([u, y]) => at(u, y), normal, tint);
  if (exterior && lod >= 2 && !gate) {
    const lowA = paving(a),
      lowB = paving(b);
    face(
      out,
      'weathered',
      [
        at(0, baseA, 0.018),
        at(length, baseB, 0.018),
        at(length, lowB + 0.64, 0.018),
        at(0, lowA + 0.64, 0.018),
      ],
      normal,
      c.base,
    );
  }
  for (const window of windows) {
    recess(out, wall, window, 0.42, 'recess', c.hole, lod);
    if (lod >= 2) {
      const [[u, y], , , [v]] = window;
      face(
        out,
        'cut',
        [
          at(u - 0.075, y - 0.045, 0.045),
          at(v + 0.075, y - 0.045, 0.045),
          at(v + 0.075, y + 0.065, 0.045),
          at(u - 0.075, y + 0.065, 0.045),
        ],
        normal,
        c.coping,
      );
    }
  }
}

function strip(out, wall, u, v, y, h, inside, outside, slot, color) {
  const { at, normal } = wall;
  const A = at(u, y[0], outside),
    B = at(v, y[1], outside);
  const C = at(v, h[1], outside),
    D = at(u, h[0], outside);
  const I = at(u, y[0], inside),
    J = at(v, y[1], inside);
  const K = at(v, h[1], inside),
    L = at(u, h[0], inside);
  face(out, slot, [A, B, C, D], normal, color);
  face(
    out,
    slot,
    [I, L, K, J],
    normal.map((v) => -v),
    color,
  );
  face(out, slot, [D, C, K, L], up, color);
}

function coping(out, wall, a, b, lod, tall) {
  const { length, at, normal } = wall;
  const top = [a, b];
  if (!lod) {
    const count = Math.floor(length / 3.35);
    for (let i = 0; i < count; i++) {
      const u = (length * (i + 0.5)) / count;
      const y = a + ((b - a) * u) / length - 0.04;
      const v = u - 0.57,
        w = u + 0.57,
        h = y + s.parapet;
      face(
        out,
        'weathered',
        [at(v, y, 0.02), at(w, y, 0.02), at(w, h, 0.02), at(v, h, 0.02)],
        normal,
        c.worn,
      );
      face(
        out,
        'cut',
        [at(v, h, 0.02), at(w, h, 0.02), at(w, h, -0.36), at(v, h, -0.36)],
        up,
        c.worn,
      );
    }
    return;
  }
  strip(
    out,
    wall,
    0,
    length,
    top.map((y) => y - 0.15),
    top.map((y) => y + 0.1),
    -0.48,
    0.115,
    'cut',
    c.coping,
  );
  const parapet = tall ? 0.45 : 0.36;
  strip(
    out,
    wall,
    0,
    length,
    top,
    top.map((y) => y + parapet),
    -0.47,
    0.015,
    'weathered',
    c.worn,
  );
  if (length < 0.78) return;
  const spacing = lod === 1 ? 2.26 : 1.62;
  const count = Math.max(1, Math.round(length / spacing));
  const width = Math.min(1.03, (length / count) * 0.75);
  for (let i = 0; i < count; i++) {
    const u = (length * (i + 0.5)) / count;
    const y = a + ((b - a) * u) / length + parapet - 0.008;
    const v = u - width / 2,
      w = u + width / 2;
    const h = y + s.parapet - parapet - (tall ? 0 : 0.14);
    if (lod < 2) {
      strip(out, wall, v, w, [y, y], [h, h], -0.43, 0.025, 'weathered', c.worn);
      continue;
    }
    const spring = h - 0.24;
    const cap = [
      [v, y],
      [w, y],
      [w, spring],
      [u + width * 0.33, h - 0.04],
      [u, h],
      [u - width * 0.33, h - 0.04],
      [v, spring],
    ];
    planar(out, 'weathered', cap, [], ([t, y]) => at(t, y, 0.026), normal, c.worn);
    planar(
      out,
      'weathered',
      cap,
      [],
      ([t, y]) => at(t, y, -0.43),
      normal.map((v) => -v),
      c.worn,
    );
    for (let j = 1; j < cap.length; j++) {
      const [x, y] = cap[j - 1],
        [z, h] = cap[j];
      const points = [at(x, y, 0.026), at(z, h, 0.026), at(z, h, -0.43), at(x, y, -0.43)];
      face(out, 'cut', points, normalFor(...points), c.coping);
    }
  }
}

const isBastion = (i) =>
  s.bastionEdges.some(([a, b]) => (a > b ? i >= a || i < b : i >= a && i < b));
const tallPart = (i) => isBastion(i) || s.eastShoulderEdges.includes(i);
const crown = (p, i) => eave(p) + (tallPart(i) ? s.towerRise : 0);

function perimeter(out, lod) {
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const wall = plane(a, b, 1);
    const high = tallPart(i);
    const top = (p) => crown(p, i);
    const rows = s.eastShoulderEdges.includes(i)
      ? [0.31, 0.69]
      : isBastion(i) && wall.length >= 1.47 && (i % 3 === 0 || i === 8)
        ? [0.65]
        : [];
    openings(out, wall, top, lod, rows, i === s.entryEdge);
    coping(out, wall, top(a), top(b), lod, high);
    if (!high) continue;
    const { at, length, normal } = wall;
    const lo = Math.min(3.05, length + 1.27);
    const y0 = top(a) - 0.02,
      y1 = top(b) - 0.02;
    face(out, 'cut', [at(0, y0), at(length, y1), at(length, y1, -lo), at(0, y0, -lo)], up, c.walk);
    face(
      out,
      'weathered',
      [
        at(0, eave(a) - 0.03, -lo),
        at(length, eave(b) - 0.03, -lo),
        at(length, y1, -lo),
        at(0, y0, -lo),
      ],
      normal.map((v) => -v),
      c.wall,
    );
    if (tallPart((i + outline.length - 1) % outline.length) === false) {
      const points = [at(0, eave(a)), at(0, y0), at(0, y0, -lo), at(0, eave(a), -lo)];
      face(out, 'masonry', points, normalFor(...points), c.wall);
    }
    if (!tallPart((i + 1) % outline.length)) {
      const points = [
        at(length, eave(b)),
        at(length, eave(b), -lo),
        at(length, y1, -lo),
        at(length, y1),
      ];
      face(out, 'masonry', points, normalFor(...points), c.wall);
    }
  }
  planar(out, 'cut', outline, holes, (p) => p3(p, eave(p) - 0.025), up, c.walk);
}

function courtyards(out, lod) {
  for (const ring of holes) {
    const sign = area(ring) > 0 ? -1 : 1;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        wall = plane(a, b, sign);
      const windows = lod >= 2 && wall.length > 6 && i % 2 === 0 ? [0.43] : [];
      openings(out, wall, eave, lod, windows, false);
      if (lod) {
        strip(
          out,
          wall,
          0,
          wall.length,
          [eave(a) - 0.21, eave(b) - 0.21],
          [eave(a) + 0.07, eave(b) + 0.07],
          -0.22,
          0.025,
          'cut',
          c.coping,
        );
      }
    }
  }
}

function theatre(out, lod) {
  const { center, stageHeight, radius, nearRadius, seats } = s.theatre;
  const count = [2, 5, seats, seats][lod],
    sides = [7, 12, 21, 28][lod];
  const rowWidth = (radius - nearRadius) / count;
  const arc = (r, i) => {
    const angle = -1.27 + (2.72 * i) / sides;
    return [center[0] + r * Math.cos(angle), center[1] + r * 0.93 * Math.sin(angle)];
  };
  const height = (r, z) => 3.62 - 0.146 * z + (r - nearRadius) * 0.155;
  for (let row = 0; row < count; row++) {
    const a = nearRadius + row * rowWidth,
      b = a + rowWidth;
    for (let i = 1; i <= sides; i++) {
      const p = arc(a, i - 1),
        q = arc(a, i),
        u = arc(b, i - 1),
        v = arc(b, i);
      const ya = height(a, p[1]),
        yb = height(a, q[1]);
      const lo = (y, point) => (row ? y - rowWidth * 0.155 : Math.min(y - 0.16, foot(point)));
      const normal = [center[0] - p[0], 0, center[1] - p[1]];
      face(
        out,
        'masonry',
        [p3(p, lo(ya, p)), p3(q, lo(yb, q)), p3(q, yb), p3(p, ya)],
        normal,
        c.worn,
      );
      face(
        out,
        'cut',
        [p3(p, ya), p3(q, yb), p3(v, height(a, v[1])), p3(u, height(a, u[1]))],
        up,
        row % 2 ? c.seat : c.coping,
      );
      if (row === count - 1 && lod >= 2) {
        face(
          out,
          'masonry',
          [p3(u, foot(u)), p3(v, foot(v)), p3(v, height(a, v[1])), p3(u, height(a, u[1]))],
          normal.map((value) => -value),
          c.worn,
        );
      }
    }
  }
  const stageFoot = Math.min(foot([-43.35, -5.8]), foot([-38.85, 6.2]));
  box(out, 'masonry', -41.1, stageFoot, 0.2, 4.5, stageHeight - stageFoot, 12.0, c.worn);
  box(out, 'cut', -41.1, stageHeight - 0.06, 0.2, 4.62, 0.12, 12.11, c.stage);
}

function build(out, lod) {
  perimeter(out, lod);
  courtyards(out, lod);
  theatre(out, lod);
}

export const fortSkyline = (out) => build(out, 0);
export const fortDistrict = (out) => build(out, 1);
export const fortStreet = (out) => build(out, 2);
export const fortCloseup = (out) => build(out, 3);

const recipe = 'zanzibar-old-fort-model.mjs';
const camera = [103, 59, 143],
  lookAt = [0, 6.3, 2.4];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'fortDistrict', 0.35],
    ['street', 'fortStreet', 0.16],
    ['closeup', 'fortCloseup', 0.044],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const fortModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: fortCloseup,
  category: 'fort',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Ngome Kongwe, the coral-stone waterfront fort of Stone Town, with rounded bastions, stepped battlements, two open courts and the open-air theatre.',
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
    outline,
    minimumCoverage: 0.92,
    basis: 'Mapped Old Fort exterior from OpenStreetMap relation 5310369, way 25103382.',
  },
  mediumFiContext: {
    scale: 0.82,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_raw',
    'stone_limestone_weathered',
    'stone_limestone',
    'wood_plain',
  ],
  qaCameras: [
    {
      name: 'mizingani-waterfront-gate-and-battlements',
      position: [-11, 8.4, 102],
      lookAt: [-5.2, 6.5, 24.0],
    },
    {
      name: 'eastern-shoulder-with-window-recesses',
      position: [-97, 18, 74],
      lookAt: [-42.0, 7.2, 20.5],
    },
    {
      name: 'two-open-courts-and-amphitheatre',
      position: [-45, 76, -62],
      lookAt: [-3.2, 4.8, 0.2],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-zanzibar-old-fort-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'fortSkyline',
    errorMeters: 0.91,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and one exact first-party public-domain Qualla photo.',
};
