/** Branicki Palace and its two connected forecourt wings, Białystok, 2023. */
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
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
  ground = read('terrain-grid');
const [outline] = frame.geometry.polygons;
const {
  foundationBottom,
  wingGalleryEaves,
  wingEaves,
  mainEaves,
  mainBaseCornice,
  mainRange,
  wingStartZ,
  courtyard,
  garden,
  pavilionCaps,
  roofs,
} = plan.section;
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.93, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.91, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.86, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.84, metallic: 0.14 },
  pane: { slot: 'window', localRef: 'palette:#fffdfe', roughness: 0.75, metallic: 0.08 },
};
const color = Object.fromEntries(
  Object.entries({
    plaster: 'e4c68b',
    base: 'cdb17e',
    trim: 'ede3ca',
    pale: 'f2ead8',
    tile: '9f5d48',
    slate: '696966',
    copper: '647f74',
    pane: '46535a',
    door: '536771',
    iron: '4d5351',
    frame: '9f9683',
    clock: '4f6683',
  }).map(([key, value]) => [key, rgb(value)]),
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
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  return {
    length,
    n: [dz * sign, 0, -dx * sign],
    point: (u, y, d = 0) => [a[0] + dx * u + dz * sign * d, y, a[1] + dz * u - dx * sign * d],
  };
}

function band(out, slot, e, l, r, bottom, top, offset, tint = color[slot]) {
  face(
    out,
    slot,
    [
      e.point(l, bottom, offset),
      e.point(r, bottom, offset),
      e.point(r, top, offset),
      e.point(l, top, offset),
    ],
    e.n,
    tint,
  );
}

function clip(ring, axis, limit, keepGreater) {
  const result = [],
    inside = (p) => (keepGreater ? p[axis] >= limit : p[axis] <= limit);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if (inside(a)) result.push(a);
    if (inside(a) !== inside(b)) {
      const t = (limit - a[axis]) / (b[axis] - a[axis]);
      result.push(a.map((v, j) => (j === axis ? limit : v + t * (b[j] - v))));
    }
  }
  return cleanRing(result);
}

// The portico bases are retained separately to leave the two approaches open above their floors.
const wallPlan = cleanRing(outline.filter((_, i) => ![27, 28, 66, 67, 68].includes(i)));
const central = clip(clip(wallPlan, 0, mainRange[0], true), 0, mainRange[1], false);
const wings = [false, true].map((right) =>
  clip(clip(wallPlan, 0, mainRange[right ? 1 : 0], right), 1, wingStartZ, true),
);

function cap(out, ring, height, slot, tint = color[slot]) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      slot,
      white,
      ring,
      [],
      () => height,
      [0, 1, 0],
      (p) => p,
      tint,
    )
  )
    throw Error('Cannot cap the Branicki Palace plan');
  const { indices, positions } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (j) =>
      Array.from(positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, slot, points, [0, 1, 0], tint);
  }
}

function groundAt(x, z) {
  const [u, v] = [x, z].map((p, i) => (p - ground.origin[i]) / ground.stepMeters);
  const i = Math.floor(u),
    j = Math.floor(v),
    a = ground.heightsMeters[j],
    b = ground.heightsMeters[j + 1];
  return (
    (a[i] + (a[i + 1] - a[i]) * (u - i)) * (1 - v + j) +
    (b[i] + (b[i + 1] - b[i]) * (u - i)) * (v - j) -
    ground.modelDatumElevationMeters
  );
}

function window(out, e, u, width, base, top, arched, lod, tint = color.pane) {
  const r = width / 2,
    depth = 0.044,
    spring = arched ? top - r * 0.65 : top;
  if (lod) band(out, 'trim', e, u - r - 0.14, u + r + 0.14, base - 0.12, top + 0.14, depth - 0.022);
  band(out, 'pane', e, u - r, u + r, base, spring, depth, tint);
  if (arched) {
    const facets = lod < 2 ? 4 : 8;
    const arc = (i) =>
      e.point(
        u + r * Math.cos((i * Math.PI) / facets),
        spring + r * 0.65 * Math.sin((i * Math.PI) / facets),
        depth,
      );
    for (let i = 0; i < facets; i++)
      face(out, 'pane', [e.point(u, spring, depth), arc(i), arc(i + 1)], e.n, tint);
  }
  if (lod >= 2) {
    band(out, 'trim', e, u - r - 0.23, u + r + 0.23, base - 0.13, base - 0.02, depth + 0.12);
    band(out, 'pane', e, u - 0.043, u + 0.043, base, top - 0.06, depth + 0.016, color.frame);
    if (lod === 3)
      band(
        out,
        'pane',
        e,
        u - r,
        u + r,
        base + (spring - base) * 0.65,
        base + (spring - base) * 0.65 + 0.06,
        depth + 0.021,
        color.frame,
      );
  }
}

function sectionWalls(out, ring, bottom, top, type, lod) {
  const sign = Math.sign(
    ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  const isUpper = type === 'main',
    lower = type === 'base',
    trim = color.pale;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      e = edge(a, b, sign),
      n = e.length;
    band(out, 'plaster', e, 0, n, bottom, top, 0, lower ? color.base : color.plaster);
    if (lod || isUpper)
      band(out, 'trim', e, 0, n, top - (isUpper ? 0.48 : 0.32), top + 0.035, 0.095, trim);
    if (n < (lod ? 3 : 12) || (!lod && type === 'wing')) continue;
    const bays = Math.max(1, Math.round(n / (lod ? (isUpper ? 4.12 : 3.54) : 12.5)));
    for (let j = 0; j < bays; j++) {
      const u = ((j + 0.5) * n) / bays,
        [x, , z] = e.point(u, 0);
      const inPortal =
        lower &&
        Math.abs(x - courtyard.x) < 3.6 &&
        ((z > 5.35 && z < 6.2) || (z < -15.7 && z > -16.63));
      if (!inPortal) {
        if (lower) {
          const base = Math.max(-1.2, Math.min(1.65, groundAt(x, z) + 1.34));
          window(out, e, u, lod ? 1.36 : 1.7, base, base + 2.34, lod >= 2 && z > 20, lod);
        } else if (isUpper) {
          window(out, e, u, 1.53, 7.18, 11.04, false, lod);
          window(out, e, u, 1.53, 13.38, 15.94, lod > 0, lod);
        } else window(out, e, u, 1.25, 6.66, 8.82, lod >= 2, lod);
      }
      if (isUpper && lod) {
        const joint = (j * n) / bays + 0.21,
          width = lod >= 2 ? 0.53 : 0.42;
        band(
          out,
          'trim',
          e,
          joint - width / 2,
          joint + width / 2,
          bottom + 0.04,
          top - 0.43,
          0.134,
          trim,
        );
        if (lod >= 2)
          band(out, 'trim', e, joint - 0.34, joint + 0.34, top - 0.99, top - 0.45, 0.19, trim);
      }
    }
    if (lower && lod >= 2 && n > 5)
      for (const y of [2.26, 3.29, 4.37, 5.34])
        band(out, 'plaster', e, 0, n, y, y + 0.058, 0.012, color.plaster);
  }
}

function wallMasses(out, lod) {
  sectionWalls(out, wallPlan, foundationBottom, wingGalleryEaves, 'base', lod);
  cap(out, wallPlan, wingGalleryEaves, 'slate');
  sectionWalls(out, central, mainBaseCornice, mainEaves, 'main', lod);
  cap(out, central, mainEaves, 'slate');
  for (const wing of wings) {
    sectionWalls(out, wing, wingGalleryEaves - 0.04, wingEaves, 'wing', lod);
    cap(out, wing, wingEaves, 'tile');
  }
}

function rectRing([x0, x1, z0, z1], y, ix, iz) {
  return [
    [x0 + ix, y, z0 + iz],
    [x0 + ix, y, z1 - iz],
    [x1 - ix, y, z1 - iz],
    [x1 - ix, y, z0 + iz],
  ];
}

function roof(out, r, lod) {
  const { bounds, eave, ridge, kind, hips, dormers } = r;
  loft(
    out,
    kind,
    [rectRing(bounds, eave, 0, 0), rectRing(bounds, ridge, hips[0], hips[1])],
    color[kind],
  );
  if (!lod || !dormers) return;
  const [x0, x1, z0, z1] = bounds,
    direction = Math.sign(x0),
    x = direction > 0 ? x0 : x1;
  const e = direction > 0 ? edge([x, z1], [x, z0]) : edge([x, z0], [x, z1]);
  for (let j = 0; j < dormers; j++) {
    const u = ((j + 0.5) * e.length) / dormers,
      b = eave + 0.58,
      t = b + 1.52,
      offset = -0.66;
    band(out, 'trim', e, u - 0.64, u + 0.64, b, t, offset);
    band(out, 'pane', e, u - 0.435, u + 0.435, b + 0.13, t - 0.13, offset + 0.016);
    const p = (a, y, d = offset + 0.012) => e.point(u + a, y, d);
    face(out, 'slate', [p(-0.74, t), p(0.74, t), p(0, t + 0.54)], e.n);
    if (lod >= 2) {
      const rear = p(0, t + 0.54, offset - 2.25);
      face(
        out,
        'slate',
        [p(-0.74, t), p(0, t + 0.54), rear, p(-0.74, t, offset - 2.25)],
        [0, 1, 0],
      );
      face(out, 'slate', [p(0, t + 0.54), p(0.74, t), p(0.74, t, offset - 2.25), rear], [0, 1, 0]);
    }
  }
  for (const f of [0.25, 0.75])
    box(out, 'trim', (x0 + x1) / 2, ridge - 0.46, z0 + (z1 - z0) * f, 0.52, 1.58, 0.76, color.trim);
}

function round(out, slot, center, profile, sides, tint = color[slot], cap = true) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, sides, center, Math.PI / 8)),
    tint,
    { cap },
  );
}

function tower(out, { center, width }, lod) {
  const [x, z] = center,
    r = width * 0.56;
  box(out, 'plaster', x, mainEaves - 0.48, z, width, 2.86, width, color.plaster);
  box(out, 'trim', x, mainEaves + 1.89, z, width + 0.26, 0.59, width + 0.26, color.trim);
  const stages = lod
    ? [
        [19.87, r],
        [21.21, r * 0.89],
        [22.65, r * 0.74],
        [23.05, r * 0.72],
        [23.62, r * 0.66],
        [24.51, r * 0.67],
        [25.28, r * 0.62],
        [26.7, r * 0.4],
        [27.49, r * 0.2],
      ]
    : [
        [19.87, r],
        [22.9, r * 0.74],
        [24.4, r * 0.67],
        [26.8, r * 0.38],
        [27.49, r * 0.2],
      ];
  round(out, 'copper', center, stages, lod >= 2 ? 12 : 8);
  round(
    out,
    'pane',
    center,
    [
      [27.43, 0.63],
      [28.01, 0.27],
      [28.99, 0.058],
    ],
    6,
    color.iron,
  );
  if (lod) {
    const e = edge([x + 1.6, z + r * 0.75], [x - 1.6, z + r * 0.75]);
    window(out, e, e.length / 2, 1.05, 21.02, 22.52, true, lod, color.pane);
  }
}

function steps(out, cfg, direction, lod) {
  const { x, z, width, threshold } = cfg,
    count = lod ? cfg.steps : 2;
  const span = direction === 1 ? 1.74 : 1.24,
    y = groundAt(x, z + direction * span),
    low = Math.min(y, 0) - 0.48;
  for (let i = 0; i < count; i++) {
    const d = (span * (i + 1)) / count,
      h = threshold - ((threshold - y) * i) / count;
    box(out, 'trim', x, low, z + (d / 2) * direction, width, h - low, d, color.trim);
  }
}

function porticoes(out, lod) {
  steps(out, courtyard, 1, lod);
  steps(out, garden, -1, lod);
  const x = courtyard.x,
    z = courtyard.z;
  const front = edge([x + 2.49, z], [x - 2.49, z]);
  box(
    out,
    'trim',
    x,
    foundationBottom,
    z - 1.75,
    5.0,
    courtyard.threshold - foundationBottom,
    3.49,
    color.trim,
  );
  box(out, 'trim', x, 5.56, z - 1.75, 5.21, 0.69, 3.76, color.trim);
  for (const dx of [-2.03, 2.03])
    box(out, 'plaster', x + dx, courtyard.threshold, z - 1.65, 0.92, 4.88, 3.49, color.plaster);
  window(
    out,
    edge([x + 2.48, 5.62], [x - 2.48, 5.75]),
    2.48,
    2.45,
    courtyard.threshold,
    5.08,
    true,
    lod,
    color.door,
  );
  if (lod)
    for (const dx of [-6.04, 6.04]) {
      const wall = (u) => [x + u, 5.66 - 0.027 * u];
      const e = edge(wall(dx + 1.97), wall(dx - 1.97));
      window(out, e, e.length / 2, 2.22, 0.59, 5.29, true, lod, color.door);
    }
  if (lod) band(out, 'trim', front, 0.1, 4.88, 5.37, 5.56, 0.044, color.trim);
  box(
    out,
    'trim',
    garden.x,
    foundationBottom,
    garden.z + 2.14,
    garden.width,
    garden.threshold - foundationBottom,
    4.6,
    color.trim,
  );
  box(out, 'trim', garden.x, 5.64, garden.z + 2.14, garden.width + 0.24, 0.56, 4.78, color.trim);
  for (const dx of [-4.64, -1.65, 1.65, 4.64]) {
    const center = [garden.x + dx, garden.z + 0.34];
    round(
      out,
      'trim',
      center,
      [
        [garden.threshold, 0.39],
        [5.53, 0.3],
      ],
      lod >= 2 ? 10 : 6,
      color.pale,
      false,
    );
    box(out, 'trim', center[0], 5.46, center[1], 0.92, 0.2, 0.92, color.pale);
  }
  window(
    out,
    edge([garden.x - 2.75, -16.03], [garden.x + 2.75, -16.18]),
    2.75,
    2.28,
    garden.threshold,
    5.13,
    true,
    lod,
    color.door,
  );
}

function rail(out, x, z, width, base, count, lod, slot = 'trim', tint = color.trim) {
  box(out, slot, x, base, z, width, 0.17, 0.23, tint);
  box(out, slot, x, base + 0.71, z, width, 0.15, 0.23, tint);
  if (!lod) return;
  for (let i = 0; i <= count; i++) {
    const u = x - width / 2 + (i * width) / count,
      w = i % 5 === 0 ? 0.24 : 0.12;
    if (lod === 1) {
      const e = edge([u + w / 2, z], [u - w / 2, z]);
      band(out, slot, e, 0, w, base + 0.16, base + 0.72, 0, tint);
      band(out, slot, e, w, 0, base + 0.16, base + 0.72, -0.017, tint);
    } else box(out, slot, u, base + 0.16, z, w, 0.56, 0.19, tint);
  }
}

function pinnacle(out, x, z, base, lod, scale = 1) {
  box(out, 'trim', x, base, z, 0.57 * scale, 0.43 * scale, 0.52 * scale, color.pale);
  round(
    out,
    'trim',
    [x, z],
    [
      [base + 0.38 * scale, 0.21 * scale],
      [base + 0.92 * scale, 0.28 * scale],
      [base + 1.41 * scale, 0.12 * scale],
    ],
    lod >= 2 ? 6 : 4,
    color.pale,
    false,
  );
}

function pediment(out, x, z, direction, lod) {
  const e = edge([x + 7.8 * direction, z], [x - 7.8 * direction, z]);
  const u = e.length / 2,
    b = 17.61,
    peak = 21.24;
  face(
    out,
    'plaster',
    [e.point(0, b, 0.12), e.point(e.length, b, 0.12), e.point(u, peak, 0.12)],
    e.n,
  );
  const trim = 0.27;
  for (const side of [-1, 1]) {
    const k = u + side * u;
    face(
      out,
      'slate',
      [e.point(k, b, 0.1), e.point(u, peak, 0.1), e.point(u, peak, -2.5), e.point(k, b, -2.5)],
      [0, 1, 0],
    );
    face(
      out,
      'trim',
      [
        e.point(k, b, 0.2),
        e.point(u, peak, 0.2),
        e.point(u, peak - trim, 0.2),
        e.point(k, b - trim, 0.2),
      ],
      e.n,
    );
  }
  band(out, 'trim', e, 0, e.length, b - 0.21, b + 0.15, 0.19);
  if (!lod) return;
  const count = lod >= 2 ? 12 : 8,
    r = 0.73,
    y = b + 1.64;
  for (let i = 0; i < count; i++) {
    const p = (j, radius) =>
      e.point(
        u + radius * Math.cos((j * 2 * Math.PI) / count),
        y + radius * Math.sin((j * 2 * Math.PI) / count),
        0.219,
      );
    face(
      out,
      'pane',
      [e.point(u, y, 0.219), p(i, r), p(i + 1, r)],
      e.n,
      direction === -1 ? color.clock : color.iron,
    );
    face(out, 'trim', [p(i, r), p(i + 1, r), p(i + 1, r + 0.11), p(i, r + 0.11)], e.n, color.pale);
  }
  for (const dx of [-6.85, -4.66, 0, 4.66, 6.85])
    pinnacle(out, x + dx, z, peak - Math.abs(dx) * 0.43, lod, dx ? 0.69 : 1.2);
}

function ornament(out, lod) {
  pediment(out, garden.x, -16.25, -1, lod);
  pediment(out, courtyard.x, 5.88, 1, lod);
  if (!lod) return;
  rail(out, garden.x, garden.z - 0.14, 12.35, 6.16, 15, lod, 'pane', color.iron);
  rail(out, courtyard.x, courtyard.z + 0.05, 5.08, 6.24, 7, lod, 'pane', color.iron);
  for (const [x, z, w] of [
    [-17.15, -19.34, 15.8],
    [25.9, -20.07, 15.8],
    [-15.3, 5.39, 15.8],
    [25.7, 5.21, 15.8],
  ]) {
    rail(out, x, z, w, 17.51, lod >= 2 ? 18 : 6, lod);
    for (const dx of [-w * 0.42, w * 0.42]) pinnacle(out, x + dx, z, 18.35, lod);
  }
}

function buildLevel(out, lod) {
  wallMasses(out, lod);
  for (const r of roofs) roof(out, r, lod);
  for (const t of pavilionCaps) tower(out, t, lod);
  porticoes(out, lod);
  ornament(out, lod);
}

export const branickiSkyline = (out) => buildLevel(out, 0);
export const branickiDistrict = (out) => buildLevel(out, 1);
export const branickiStreet = (out) => buildLevel(out, 2);
export const branickiCloseup = (out) => buildLevel(out, 3);

const recipe = 'branicki-palace-model.mjs',
  camera = [116, 69, 170],
  lookAt = [3, 10, 25];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'branickiDistrict', 0.32],
    ['street', 'branickiStreet', 0.12],
    ['closeup', 'branickiCloseup', 0.044],
  ].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]),
);

export const branickiModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: branickiCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The 2023 Branicki Palace exterior in Białystok, with its central baroque residence, clock pediment, green pavilions and attached red-roofed wings around the open forecourt.',
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
    basis: 'Original mapped palace perimeter and both connected forecourt wings.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone',
    'tile_flat',
    'slate',
    'metal_copper',
  ],
  qaCameras: [
    { name: 'garden-clock-and-portico', position: [30, 30, -106], lookAt: [5, 10, -10] },
    { name: 'baroque-courtyard-and-wings', position: [-54, 38, 131], lookAt: [2, 10, 25] },
    { name: 'palace-and-open-forecourt-plan', position: [82, 126, 82], lookAt: [2, 8, 28] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-branicki-palace-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'branickiSkyline',
    errorMeters: 0.76,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. OpenStreetMap geographic controls, ODbL 1.0. Photographer-released CC0 reference originals by Rakoon.',
};
