/** Queen Anne Haas-Lilienthal House and the connected southwest guest wing. */
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  cleanRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls'),
  frame = read('map-frame'),
  terrain = read('terrain-grid');
const [outline] = frame.geometry.polygons;
const { foundationBottom, mainFloor, secondFloor, eaves, annexEaves, porch, stairs, tower, roofs } =
  plan.section;
const main = cleanRing(
  outline.slice(1, 23).map(([x, z], i) => [x, i === 9 || i === 10 ? 13.37 : z]),
);
const annex = cleanRing([...outline.slice(22), ...outline.slice(0, 2)]);
const surfaces = {
  lap: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.91, metallic: 0 },
  shingle: { slot: 'wall', graph: 'siding_shingle', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'shingle_asphalt', roughness: 0.93, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick_flemish', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', localRef: 'palette:#fffdfe', roughness: 0.84, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    lap: '899495',
    shingle: '788587',
    roof: '655f5a',
    turretRoof: '786b59',
    trim: 'd1d3c3',
    shadow: '9da7a0',
    pane: '49585c',
    lead: '67808a',
    brick: '9a5a4d',
    base: 'a7a393',
    stone: 'b9b6ad',
    door: '615f51',
    dark: '4a4d47',
  }).map(([k, v]) => [k, rgb(v)]),
);
const white = 'palette:#ffffff';

function face(out, slot, points, direction, tint = color[slot]) {
  let n = normalFor(...points);
  if (n.reduce((sum, a, i) => sum + a * direction[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}

function edge(a, b, sign = 1) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  return {
    length,
    n: [dz * sign, 0, -dx * sign],
    point: (u, y, d = 0) => [a[0] + u * dx + d * dz * sign, y, a[1] + u * dz - d * dx * sign],
  };
}

function panel(out, slot, e, a, b, low, high, d, tint = color[slot]) {
  face(
    out,
    slot,
    [e.point(a, low, d), e.point(b, low, d), e.point(b, high, d), e.point(a, high, d)],
    e.n,
    tint,
  );
}

function cap(out, ring, y, slot, tint) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      slot,
      white,
      ring,
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      tint,
    )
  )
    throw Error('Cannot close the mapped house roof deck');
  const { indices, positions } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = Array.from(indices.slice(i, i + 3), (j) =>
      Array.from(positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, slot, p, [0, 1, 0], tint);
  }
}

function sash(out, e, u, w, low, high, lod, depth = 0.025, stained = false, tint = color.pane) {
  const a = u - w / 2,
    b = u + w / 2;
  if (lod) panel(out, 'trim', e, a - 0.115, b + 0.115, low - 0.12, high + 0.11, depth, color.trim);
  panel(out, 'trim', e, a, b, low, high, depth + 0.016, tint);
  if (lod >= 2) {
    panel(out, 'trim', e, a - 0.18, b + 0.18, low - 0.12, low - 0.025, depth + 0.13, color.trim);
    panel(
      out,
      'trim',
      e,
      a,
      b,
      low + (high - low) * 0.49,
      low + (high - low) * 0.49 + 0.056,
      depth + 0.035,
      color.trim,
    );
    if (stained)
      panel(
        out,
        'trim',
        e,
        a + 0.02,
        b - 0.02,
        high - 0.37,
        high - 0.025,
        depth + 0.04,
        color.lead,
      );
  }
}

function envelope(out, ring, isAnnex, lod) {
  const top = isAnnex ? annexEaves : eaves;
  const floor = isAnnex ? 3.51 : mainFloor;
  const middle = isAnnex ? 5.76 : secondFloor;
  const sign = Math.sign(
    ring.reduce((a, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return a + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const e = edge(ring[i], ring[(i + 1) % ring.length], sign),
      n = e.length;
    panel(out, 'stone', e, 0, n, foundationBottom, floor, 0, color.base);
    panel(out, 'lap', e, 0, n, floor, middle, 0, color.lap);
    panel(out, 'shingle', e, 0, n, middle, top, 0, color.shingle);
    if (lod || n > 2.8)
      for (const y of [floor, middle, top])
        panel(out, 'trim', e, 0, n, y - 0.11, y + 0.14, 0.059, color.trim);
    if (n < (lod ? 2 : 3.5)) continue;
    const count = Math.max(1, Math.round(n / (lod ? 2.15 : 3.68)));
    for (let k = 0; k < count; k++) {
      const u = ((k + 0.5) * n) / count,
        [x, , z] = e.point(u, 0);
      if (!isAnnex && z > 13 && x > 2.2 && x < 7.9) continue;
      sash(out, e, u, 0.91, floor + 0.68, middle - 0.34, lod);
      sash(out, e, u, 0.88, middle + 0.59, top - 0.51, lod, 0.025, !isAnnex);
      if (lod >= 2 && z > 3)
        panel(out, 'trim', e, u - 0.13, u + 0.13, top - 0.34, top - 0.03, 0.12, color.shadow);
    }
  }
  cap(out, ring, top, 'roof', color.roof);
}

function gable(out, r, lod) {
  const {
    bounds: [x0, x1, z0, z1],
    eave,
    ridge,
    axis,
    hip,
  } = r;
  const x = (x0 + x1) / 2,
    z = (z0 + z1) / 2;
  if (hip) {
    const ring = (y, ix, iz) => [
      [x0 + ix, y, z0 + iz],
      [x0 + ix, y, z1 - iz],
      [x1 - ix, y, z1 - iz],
      [x1 - ix, y, z0 + iz],
    ];
    loft(out, 'roof', [ring(eave, 0, 0), ring(ridge, (x1 - x0) * 0.47, 4.28)], color.roof);
    return;
  }
  const faceAt =
    axis === 'z'
      ? (v) => [
          [x0, eave, v],
          [x, ridge, v],
          [x1, eave, v],
        ]
      : (v) => [
          [v, eave, z0],
          [v, ridge, z],
          [v, eave, z1],
        ];
  const [v0, v1] = axis === 'z' ? [z0, z1] : [x0, x1],
    a = faceAt(v0),
    b = faceAt(v1);
  const normal = axis === 'z' ? [0, 0, 1] : [1, 0, 0];
  face(
    out,
    'shingle',
    a,
    normal.map((x) => -x),
  );
  if (r.name === 'Franklin attic gable' && lod) {
    const head = eave + 1.65;
    const inset = ((x1 - x0) * (head - eave)) / (2 * (ridge - eave));
    const left = [x0 + inset, head, z1];
    const right = [x1 - inset, head, z1];
    face(out, 'shingle', [left, b[1], right], normal);
    face(out, 'shingle', [b[0], [1.45, eave, z1], [1.45, head, z1], left], normal);
    face(out, 'shingle', [[5.56, eave, z1], b[2], right, [5.56, head, z1]], normal);
  } else face(out, 'shingle', b, normal);
  face(out, 'roof', [a[0], a[1], b[1], b[0]], [0, 1, 0]);
  face(out, 'roof', [a[1], a[2], b[2], b[1]], [0, 1, 0]);
  if (!lod || r.name.startsWith('long')) return;
  const useFirst = axis === 'x' || r.name.startsWith('rear'),
    side = useFirst ? a : b;
  for (const k of [0, 2])
    beam(out, 'trim', side[k], side[1], lod >= 2 ? 0.21 : 0.16, 0.16, color.trim);
  beam(out, 'trim', side[0], side[2], 0.18, 0.17, color.trim);
  const to2 = ([x, , z]) => [x, z],
    e = useFirst
      ? edge(to2(side[0]), to2(side[2]), axis === 'x' ? -1 : 1)
      : edge(to2(side[2]), to2(side[0]));
  if (!r.name.startsWith('Franklin')) {
    for (const k of [-0.68, 0.68])
      sash(
        out,
        e,
        e.length / 2 + k,
        0.83,
        eave + 0.19,
        Math.min(ridge - 0.9, eave + 1.92),
        lod,
        0.081,
      );
  }
  if (lod >= 2) {
    const [px, py, pz] = side[1];
    box(out, 'trim', px, py - 0.05, pz, 0.12, 0.58, 0.12, color.trim);
    for (const f of [0.24, 0.36, 0.64, 0.76])
      panel(
        out,
        'trim',
        e,
        e.length * f - 0.046,
        e.length * f + 0.046,
        eave + 0.03,
        eave + 0.64,
        0.075,
        color.shadow,
      );
  }
}

function round(out, slot, center, profile, n, tint = color[slot], cap = true) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, n, center, Math.PI / 8)),
    tint,
    { cap },
  );
}

function turret(out, lod) {
  const { center, baseRadius: r, coneBase, top } = tower,
    n = [8, 12, 20, 28][lod];
  round(
    out,
    'stone',
    center,
    [
      [foundationBottom, r],
      [mainFloor, r],
    ],
    n,
    color.base,
  );
  round(
    out,
    'lap',
    center,
    [
      [mainFloor, r],
      [secondFloor, r],
    ],
    n,
    color.lap,
    false,
  );
  round(
    out,
    'shingle',
    center,
    [
      [secondFloor, r],
      [coneBase, r * 0.93],
    ],
    n,
    color.shingle,
    false,
  );
  for (const y of [mainFloor, secondFloor, eaves, coneBase]) {
    const radius = y >= eaves ? r * 0.99 : r * 1.045;
    round(
      out,
      'trim',
      center,
      [
        [y - 0.15, radius],
        [y + 0.14, radius],
      ],
      n,
      color.trim,
      false,
    );
  }
  round(
    out,
    'roof',
    center,
    [
      [coneBase - 0.015, r * 0.96],
      [coneBase + 0.48, r * 0.87],
      [top - 0.54, 0.46],
      [top - 0.22, 0.19],
    ],
    n,
    color.turretRoof,
  );
  round(
    out,
    'trim',
    center,
    [
      [top - 0.61, 0.42],
      [top - 0.36, 0.3],
      [top, 0.095],
    ],
    6,
    color.trim,
  );
  if (!lod) return;
  const [cx, cz] = center;
  for (const a of [0.62, 1.21, 1.8, 2.39, 2.98]) {
    const p = (theta, rad) => [cx + rad * Math.cos(theta), cz + rad * Math.sin(theta)];
    const e = edge(p(a + 0.206, r + 0.09), p(a - 0.206, r + 0.09), -1);
    const u = e.length / 2;
    sash(out, e, u, 0.78, mainFloor + 0.67, secondFloor - 0.37, lod, 0.024);
    sash(out, e, u, 0.76, secondFloor + 0.55, eaves - 0.31, lod, 0.024, true);
  }
  for (const x of [cx - 0.82, cx + 0.72]) {
    const z = cz + r * 0.93;
    box(out, 'shingle', x, 11.86, z - 0.19, 0.83, 1.51, 0.45, color.shingle);
    sash(out, edge([x + 0.47, z + 0.04], [x - 0.47, z + 0.04]), 0.47, 0.52, 12.04, 13.1, lod);
    face(
      out,
      'trim',
      [
        [x - 0.51, 13.37, z + 0.062],
        [x + 0.51, 13.37, z + 0.062],
        [x, 13.86, z + 0.062],
      ],
      [0, 0, 1],
      color.trim,
    );
  }
}

function groundAt(x, z) {
  const [u, v] = [x, z].map((p, i) => (p - terrain.origin[i]) / terrain.stepMeters),
    i = Math.floor(u),
    j = Math.floor(v),
    a = terrain.heightsMeters[j],
    b = terrain.heightsMeters[j + 1];
  return (
    (a[i] + (a[i + 1] - a[i]) * (u - i)) * (1 - v + j) +
    (b[i] + (b[i + 1] - b[i]) * (u - i)) * (v - j) -
    terrain.modelDatumElevationMeters
  );
}

function run(out, r, start, lod) {
  const { x, front, back, top, width } = r,
    count = lod ? r.steps : Math.ceil(r.steps / 2),
    span = front - back;
  const base = Math.min(start, 0) - 0.34;
  for (let i = 0; i < count; i++) {
    const depth = (span * (i + 1)) / count,
      y = top - ((top - start) * i) / count;
    box(out, 'stone', x, base, back + depth / 2, width, y - base, depth, color.stone);
  }
  if (lod >= 2)
    for (const dx of [-width / 2, width / 2]) {
      beam(
        out,
        'trim',
        [x + dx, start + 0.82, front],
        [x + dx, top + 0.82, back],
        0.055,
        0.055,
        color.dark,
      );
      for (const f of [0, 0.5, 1])
        box(
          out,
          'trim',
          x + dx,
          start + (top - start) * f,
          front - span * f,
          0.068,
          0.85,
          0.068,
          color.dark,
        );
    }
}

function entry(out, lod) {
  const { x, z, width, depth } = porch,
    front = z + depth / 2;
  run(out, stairs.lower, groundAt(stairs.lower.x, stairs.lower.front), lod);
  const low = -0.31,
    span = stairs.upper.x - stairs.lower.x;
  box(
    out,
    'stone',
    (stairs.lower.x + stairs.upper.x) / 2,
    low,
    20.0,
    span + 2.15,
    stairs.lower.top - low,
    1.22,
    color.stone,
  );
  run(out, stairs.upper, stairs.lower.top, lod);
  box(
    out,
    'stone',
    x,
    foundationBottom,
    z,
    width,
    mainFloor - foundationBottom,
    depth,
    color.stone,
  );
  box(out, 'trim', x, 6.39, z, width + 0.28, 0.33, depth + 0.25, color.trim);
  for (const k of [-1, 1]) {
    const u = x + k * (width / 2 - 0.32),
      v = front - 0.24;
    round(
      out,
      'trim',
      [u, v],
      [
        [mainFloor, 0.215],
        [6.38, 0.16],
      ],
      lod >= 2 ? 10 : 6,
      color.trim,
      false,
    );
    if (lod) box(out, 'trim', u, 6.21, v, 0.56, 0.2, 0.56, color.trim);
  }
  gable(
    out,
    {
      name: 'Franklin porch',
      bounds: [x - width / 2 - 0.18, x + width / 2 + 0.18, z - depth / 2 - 0.08, front + 0.12],
      eave: 6.71,
      ridge: 8.41,
      axis: 'z',
    },
    lod,
  );
  const back = edge([x + 1.41, 13.37], [x - 1.41, 13.37]);
  sash(out, back, back.length / 2, 1.78, mainFloor + 0.04, 6.18, lod, 0.034, false, color.door);
  if (lod) {
    const e = edge([x + width / 2, front], [x - width / 2, front]);
    panel(out, 'trim', e, 0, width, 6.2, 6.42, 0.026, color.shadow);
    for (const sign of [-1, 1])
      box(
        out,
        'trim',
        x + sign * width * 0.42,
        mainFloor + 0.84,
        front - 0.43,
        0.61,
        0.11,
        0.13,
        color.trim,
      );
  }
}

function details(out, lod) {
  const top = 12.43;
  box(out, 'brick', -4.68, 3.09, 2.18, 1.09, top - 3.09, 0.79, color.brick);
  box(out, 'brick', -4.68, top - 0.16, 2.18, 1.34, 0.31, 0.96, color.brick);
  box(out, 'brick', 1.38, 12.32, 4.23, 0.7, 1.74, 0.83, color.brick);
  if (lod) {
    const e = edge([5.56, 13.64], [1.45, 13.64]);
    panel(out, 'trim', e, 0, e.length, 10.13, 11.8, 0.02, color.dark);
    sash(out, e, e.length / 2, 1.23, 10.36, 11.69, lod, 0.04);
    box(out, 'trim', 4.07, 9.99, 13.81, 4.15, 0.18, 0.81, color.trim);
    box(out, 'trim', 4.07, 10.81, 14.13, 4.15, 0.13, 0.18, color.trim);
    for (let i = 0; i <= (lod >= 2 ? 14 : 7); i++) {
      const n = lod >= 2 ? 14 : 7,
        x = 2.09 + (i * 3.96) / n;
      box(out, 'trim', x, 10.17, 14.11, 0.095, 0.64, 0.14, color.trim);
    }
    for (const x of [2.03, 6.13]) box(out, 'trim', x, 10.17, 13.98, 0.14, 1.29, 0.14, color.trim);
  }
}

function buildLevel(out, lod) {
  envelope(out, main, false, lod);
  envelope(out, annex, true, lod);
  for (const r of roofs) gable(out, r, lod);
  turret(out, lod);
  entry(out, lod);
  details(out, lod);
}

export const haasSkyline = (out) => buildLevel(out, 0);
export const haasDistrict = (out) => buildLevel(out, 1);
export const haasStreet = (out) => buildLevel(out, 2);
export const haasCloseup = (out) => buildLevel(out, 3);

const recipe = 'haas-lilienthal-model.mjs',
  camera = [-40, 25, 53],
  lookAt = [-1, 6, -0.7];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'haasDistrict', 0.23],
    ['street', 'haasStreet', 0.084],
    ['closeup', 'haasCloseup', 0.031],
  ].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]),
);
export const haasModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: haasCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The May 2015 Haas-Lilienthal House on Franklin Street, with its Queen Anne turret, shingled gables, entry stair, porch and attached 1929 guest wing.',
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
    minimumCoverage: 0.93,
    basis: 'Native mapped continuous house and connected rear guest wing.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'wood_painted_lap',
    'siding_shingle',
    'shingle_asphalt',
    'brick_flemish',
    'stone_limestone',
  ],
  qaCameras: [
    { name: 'franklin-porch-stairs-and-turret', position: [-9, 9, 51], lookAt: [1, 7, 12] },
    { name: 'south-gables-and-chimney', position: [-43, 13, 17], lookAt: [-2, 7, 2] },
    { name: 'rear-guest-wing-and-roof-plan', position: [-37, 57, -45], lookAt: [-3, 5, -3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-haas-lilienthal-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'haasSkyline',
    errorMeters: 0.49,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. OpenStreetMap geographic controls, ODbL 1.0. Exact CC0 Daderot references and public-domain Jack E. Boucher HABS original.',
};
