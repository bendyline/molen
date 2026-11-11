/** Windsor Hotel, Montreal, in its intact circa-1912 configuration. */
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const [outline] = frame.geometry.polygons;
const { holes } = frame.geometry;
const { foundationBottom, junctionX, oldEaves, annexEaves, original, annex, roofRanges } =
  plan.section;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.87, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.12 },
  pane: { slot: 'window', localRef: 'palette:#fffdfe', roughness: 0.77, metallic: 0.08 },
};
const color = Object.fromEntries(
  Object.entries({
    stone: 'c7bfac',
    annex: 'cfc8b7',
    trim: 'dfd5be',
    plinth: 'aea693',
    court: 'bba992',
    roof: '6b6a69',
    metal: '595d58',
    pane: '424f53',
    warmPane: '584d41',
    frame: '837a69',
  }).map(([key, value]) => [key, rgb(value)]),
);
const white = 'palette:#ffffff';

function face(out, slot, points, direction, tint) {
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
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  return {
    length,
    n: [dz * sign, 0, -dx * sign],
    point: (u, y, p = 0) => [a[0] + dx * u + dz * sign * p, y, a[1] + dz * u - dx * sign * p],
  };
}

function strip(out, slot, e, a, b, low, high, depth, tint) {
  face(
    out,
    slot,
    [
      e.point(a, low, depth),
      e.point(b, low, depth),
      e.point(b, high, depth),
      e.point(a, high, depth),
    ],
    e.n,
    tint,
  );
}

function cap(out, ring, inside, height) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      'roof',
      white,
      ring,
      inside,
      () => height,
      [0, 1, 0],
      (p) => p,
      color.roof,
    )
  )
    throw Error('Could not triangulate the Windsor deck and service courts');
  const { indices, positions } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const tri = Array.from(indices.slice(i, i + 3), (j) =>
      Array.from(positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, 'roof', tri, [0, 1, 0], color.roof);
  }
}

function dividedOutline(north) {
  const result = [];
  const keep = (p) => (north ? p[0] >= junctionX : p[0] <= junctionX);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    if (keep(a)) result.push(a);
    if (keep(a) !== keep(b)) {
      const t = (junctionX - a[0]) / (b[0] - a[0]);
      result.push([junctionX, a[1] + t * (b[1] - a[1])]);
    }
  }
  return result;
}

const southPlan = dividedOutline(false),
  northPlan = dividedOutline(true);
const signedArea = (ring) =>
  ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);

function facade(out, e, eaves, levels, lod, tint, court) {
  const n = e.length;
  strip(out, 'stone', e, 0, n, foundationBottom, eaves, 0, tint);
  strip(out, 'trim', e, 0, n, eaves - 0.47, eaves + 0.12, 0.16, color.trim);
  if (court && !lod) return;
  if (lod) strip(out, 'trim', e, 0, n, -1.65, 0.47, 0.04, color.plinth);
  if (lod && !court) {
    for (const y of [4.16, eaves - 4.04])
      strip(out, 'trim', e, 0, n, y, y + 0.26, 0.095, color.trim);
    if (lod >= 2) strip(out, 'trim', e, 0, n, eaves - 1.02, eaves - 0.87, 0.1, color.plinth);
  }
  if (n < (lod ? 2.35 : 10)) return;
  const bays = Math.max(1, Math.round(n / (lod ? (court ? 4.15 : 3.35) : 6.9)));
  const stories = lod ? levels : [levels[1], levels[3], levels.at(-1)];
  const w = lod ? (court ? 0.99 : 1.19) : 1.6;
  for (const [i, base] of stories.entries()) {
    const h = i === stories.length - 1 ? 1.57 : 2.18;
    for (let j = 0; j < bays; j++) {
      const u = ((j + 0.5) * n) / bays,
        a = u - w / 2,
        b = u + w / 2;
      if (lod >= 2)
        strip(out, 'trim', e, a - 0.15, b + 0.15, base - 0.1, base + h + 0.17, 0.03, color.trim);
      strip(
        out,
        'pane',
        e,
        a,
        b,
        base,
        base + h,
        0.048,
        (j + i) % 5 === 0 ? color.warmPane : color.pane,
      );
      if (lod < 2) continue;
      strip(out, 'trim', e, a - 0.19, b + 0.19, base - 0.095, base + 0.04, 0.13, color.trim);
      strip(out, 'pane', e, u - 0.035, u + 0.035, base + 0.06, base + h, 0.062, color.frame);
      if (lod === 3) {
        strip(out, 'pane', e, a, b, base + h * 0.62, base + h * 0.62 + 0.067, 0.066, color.frame);
        if (!court && i < 2)
          strip(
            out,
            'trim',
            e,
            a - 0.22,
            b + 0.22,
            base + h + 0.12,
            base + h + 0.22,
            0.13,
            color.trim,
          );
      }
    }
  }
}

function envelope(out, ring, eaves, floors, lod, tint, court = false) {
  const sign = Math.sign(signedArea(ring)) * (court ? -1 : 1);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      e = edge(a, b, sign);
    if (a[0] === junctionX && b[0] === junctionX) {
      if (eaves === annexEaves) strip(out, 'stone', e, 0, e.length, oldEaves, annexEaves, 0, tint);
    } else facade(out, e, eaves, floors, lod, tint, court);
  }
}

function rectRing([x0, x1, z0, z1], y, insetX = 0, insetZ = 0) {
  return [
    [x0 + insetX, y, z0 + insetZ],
    [x0 + insetX, y, z1 - insetZ],
    [x1 - insetX, y, z1 - insetZ],
    [x1 - insetX, y, z0 + insetZ],
  ];
}

function roofEdge([x0, x1, z0, z1], name) {
  const edges = {
    peel: [
      [x1, z1],
      [x0, z1],
    ],
    stanley: [
      [x0, z0],
      [x1, z0],
    ],
    cypress: [
      [x1, z0],
      [x1, z1],
    ],
    dorchester: [
      [x0, z1],
      [x0, z0],
    ],
  };
  return edge(...edges[name]);
}

function dormer(out, e, u, base, width, tall, lod) {
  const w = width / 2,
    y = base + (tall ? 2.23 : 1.65),
    ridge = y + 0.57;
  const a = e.point(u - w, base, 0.15),
    b = e.point(u + w, base, 0.15);
  const c = e.point(u + w, y, 0.15),
    d = e.point(u - w, y, 0.15),
    p = e.point(u, ridge, 0.15);
  face(out, 'trim', [a, b, c, d], e.n, color.trim);
  face(out, 'trim', [d, c, p], e.n, color.trim);
  strip(out, 'pane', e, u - w * 0.73, u + w * 0.73, base + 0.24, y - 0.24, 0.17, color.pane);
  if (lod < 2) return;
  const t = e.point(u, ridge + 0.04, -0.99);
  face(out, 'roof', [d, p, t, e.point(u - w, y, -1.24)], [0, 1, 0], color.roof);
  face(out, 'roof', [p, c, e.point(u + w, y, -1.24), t], [0, 1, 0], color.roof);
  if (tall && lod === 3) {
    strip(out, 'pane', e, u - 0.035, u + 0.035, base + 0.24, y - 0.24, 0.182, color.frame);
    const center = e.point(u, ridge + 1.02, -1.38),
      r = 0.4;
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4,
        b = ((j + 1) * Math.PI) / 4;
      face(
        out,
        'pane',
        [
          center,
          e.point(u + r * Math.cos(a), ridge + 1.02 + r * Math.sin(a), -1.38),
          e.point(u + r * Math.cos(b), ridge + 1.02 + r * Math.sin(b), -1.38),
        ],
        e.n,
        color.pane,
      );
    }
  }
}

function mansard(out, range, lod) {
  const { bounds, eave, peak, faces, dormers } = range;
  const h = peak - eave,
    w = bounds[1] - bounds[0],
    d = bounds[3] - bounds[2];
  const x = Math.min(w * 0.25, 3.15),
    z = Math.min(d * 0.25, 3.15);
  loft(
    out,
    'roof',
    [
      rectRing(bounds, eave),
      ...(lod ? [rectRing(bounds, eave + h * 0.19, x * 0.13, z * 0.13)] : []),
      rectRing(bounds, eave + h * 0.78, x * 0.69, z * 0.69),
      rectRing(bounds, peak, x, z),
    ],
    color.roof,
  );
  if (!lod) return;
  for (const name of faces) {
    const e = roofEdge(bounds, name);
    for (let i = 0; i < dormers; i++)
      dormer(
        out,
        e,
        ((i + 0.5) * e.length) / dormers,
        eave + 0.39,
        h > 7 ? 1.72 : 1.47,
        eave > 25,
        lod,
      );
  }
  if (peak > 37.5) {
    for (const corner of rectRing(bounds, peak, x, z))
      box(out, 'metal', corner[0], peak - 0.06, corner[2], 0.17, 0.73, 0.17, color.metal);
  }
}

function round(out, slot, center, profile, sides, tint) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, sides, center, Math.PI / 8)),
    tint,
  );
}

function cornerDome(out, lod) {
  const { corner, drumTop, domeTop, finialTop } = original;
  const sides = [8, 12, 16, 24][lod];
  round(
    out,
    'stone',
    corner,
    [
      [oldEaves - 1.05, 4.63],
      [drumTop - 0.38, 4.42],
    ],
    sides,
    color.stone,
  );
  round(
    out,
    'trim',
    corner,
    [
      [drumTop - 0.43, 4.51],
      [drumTop + 0.12, 4.51],
    ],
    sides,
    color.trim,
  );
  round(
    out,
    'roof',
    corner,
    [
      [drumTop, 4.4],
      [drumTop + 1.43, 4.66],
      [drumTop + 3.24, 4.32],
      [domeTop - 2.5, 3.3],
      [domeTop - 0.57, 1.46],
      [domeTop, 0.68],
    ],
    sides,
    color.roof,
  );
  round(
    out,
    'metal',
    corner,
    [
      [domeTop - 0.07, 0.72],
      [domeTop + 0.3, 0.53],
      [domeTop + 0.63, 0.14],
      [finialTop, 0.055],
    ],
    6,
    color.metal,
  );
  if (lod) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8,
        b = a + Math.PI / 4;
      const pt = (theta) => [
        corner[0] + 4.51 * Math.cos(theta),
        corner[1] + 4.51 * Math.sin(theta),
      ];
      const e = edge(pt(a), pt(b));
      const u = e.length / 2;
      strip(out, 'trim', e, u - 0.74, u + 0.74, oldEaves + 0.75, drumTop - 1.07, 0.13, color.trim);
      strip(out, 'pane', e, u - 0.53, u + 0.53, oldEaves + 0.9, drumTop - 1.27, 0.15, color.pane);
    }
  }
}

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = terrain.heightsMeters[j],
    b = terrain.heightsMeters[j + 1];
  return (
    (a[i] + (a[i + 1] - a[i]) * (u - i)) * (1 - v + j) +
    (b[i] + (b[i + 1] - b[i]) * (u - i)) * (v - j) -
    terrain.modelDatumElevationMeters
  );
}

function entrance(out, lod) {
  const { x, z } = original.entrance,
    y = grade(x, z + 1.8),
    width = 6.5;
  const e = edge([x + width / 2, z], [x - width / 2, z]);
  const middle = width / 2;
  box(out, 'stone', x, oldEaves - 0.16, z - 4.42, 7.7, 3.52, 8.9, color.stone);
  mansard(
    out,
    {
      bounds: [x - 4.04, x + 4.04, z - 9.3, z + 0.18],
      eave: 25.72,
      peak: 32.18,
      faces: [],
      dormers: 0,
    },
    lod,
  );
  dormer(out, e, middle, 25.83, 2.96, true, lod);
  for (let i = 0; i < (lod ? 4 : 2); i++) {
    const step = lod ? 0.37 : 0.74,
      rise = lod ? 0.235 : 0.47;
    box(
      out,
      'trim',
      x,
      y - 0.43,
      z + 0.5 - step / 2 + ((i + 1) * step) / 2,
      width - 0.15,
      0.43 + 0.94 - i * rise,
      (i + 1) * step,
      color.trim,
    );
  }
  const spring = y + 3.64,
    radius = 1.15,
    base = y + 0.91;
  strip(out, 'trim', e, 0.6, width - 0.6, base, spring + 1.53, 0.21, color.trim);
  strip(out, 'pane', e, middle - radius, middle + radius, base, spring, 0.237, color.warmPane);
  const segments = lod > 1 ? 12 : 6;
  for (let i = 0; i < segments; i++) {
    const a = (i * Math.PI) / segments,
      b = ((i + 1) * Math.PI) / segments;
    const p = (v) => e.point(middle + radius * Math.cos(v), spring + radius * Math.sin(v), 0.237);
    face(out, 'pane', [e.point(middle, spring, 0.237), p(a), p(b)], e.n, color.warmPane);
  }
  if (lod) {
    for (const dx of [-2.45, -1.61, 1.61, 2.45])
      box(out, 'trim', x + dx, base, z + 0.36, 0.3, 4.26, 0.35, color.trim);
    box(out, 'trim', x, spring + 1.58, z + 0.31, width, 0.27, 0.61, color.trim);
    strip(out, 'pane', e, middle - 0.055, middle + 0.055, base, spring, 0.25, color.frame);
  }
}

function buildLevel(out, lod) {
  envelope(out, southPlan, oldEaves, original.floors, lod, color.stone);
  envelope(out, northPlan, annexEaves, annex.floors, lod, color.annex);
  for (const ring of holes) envelope(out, ring, oldEaves, original.floors, lod, color.court, true);
  cap(out, southPlan, holes, oldEaves);
  cap(out, northPlan, [], annexEaves);
  for (const range of roofRanges) mansard(out, range, lod);
  cornerDome(out, lod);
  entrance(out, lod);
}

export const windsorSkyline = (out) => buildLevel(out, 0);
export const windsorDistrict = (out) => buildLevel(out, 1);
export const windsorStreet = (out) => buildLevel(out, 2);
export const windsorCloseup = (out) => buildLevel(out, 3);

const recipe = 'windsor-hotel-model.mjs';
const camera = [104, 68, 143],
  lookAt = [1, 16, 1];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'windsorDistrict', 0.31],
    ['street', 'windsorStreet', 0.11],
    ['closeup', 'windsorCloseup', 0.043],
  ].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]),
);

export const windsorModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: windsorCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The intact circa-1912 Windsor Hotel in Montreal, with its Second Empire corner dome, the taller Cypress annex, mansard roofs and two open service courts.',
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
    basis: 'Dated historic hotel plan from Goad plate 14 and the mapped surviving annex.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_limestone',
    'stone_limestone_weathered',
    'slate',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'peel-from-dorchester-square', position: [28, 39, 120], lookAt: [0, 17, 15] },
    { name: 'lost-dorchester-wing-and-dome', position: [-107, 46, 82], lookAt: [-25, 18, 16] },
    { name: 'cypress-and-annex-mansards', position: [110, 43, 56], lookAt: [35, 22, 6] },
    { name: 'historic-plan-and-service-courts', position: [-63, 112, -55], lookAt: [0, 13, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-windsor-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'windsorSkyline',
    errorMeters: 0.73,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. The 1912 Goad atlas and the Notman print are public-domain originals. Geographic control points are from OpenStreetMap, ODbL 1.0.',
};
