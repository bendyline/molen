/** Hovedbygningen, Ringve Music Museum, Trondheim, before the 2015 fire. */
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  cleanRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  frame = read('map-frame'),
  ground = read('terrain-grid');
const [outline] = frame.geometry.polygons,
  ring = cleanRing(outline);
const {
  foundationBottom,
  mainFloor,
  storyLine,
  wallEaves,
  garden,
  lookout,
  stairsTower,
  westEntry,
  roofs,
} = plan.section;
const surfaces = {
  wall: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.94, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_granite', roughness: 0.95, metallic: 0 },
  detail: { slot: 'window', localRef: 'palette:#fffdfe', roughness: 0.75, metallic: 0.05 },
};
const color = Object.fromEntries(
  Object.entries({
    wall: 'dfdfd0',
    wood: 'af7a46',
    roof: '777972',
    stone: '92918a',
    pane: '5c675f',
    sash: 'e3e0ce',
    door: '8a643f',
    rail: '7e5a3d',
    metal: '5b6159',
    shade: 'c0a57c',
  }).map(([k, v]) => [k, rgb(v)]),
);
const white = 'palette:#ffffff';
function face(out, slot, points, expected, tint = color[slot]) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
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
    point: (u, y, p = 0) => [a[0] + u * dx + p * dz * sign, y, a[1] + u * dz - p * dx * sign],
  };
}
function panel(out, slot, e, l, r, b, t, p, tint = color[slot]) {
  face(
    out,
    slot,
    [e.point(l, b, p), e.point(r, b, p), e.point(r, t, p), e.point(l, t, p)],
    e.n,
    tint,
  );
}
function cap(out, ring, y) {
  const tmp = new MeshBufferBuilder();
  if (
    !tmp.addCap(
      'roof',
      white,
      ring,
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      color.roof,
    )
  )
    throw Error('Could not cap the Ringve manor plan');
  const { indices, positions } = tmp.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = Array.from(indices.slice(i, i + 3), (j) =>
      Array.from(positions.slice(j * 3, j * 3 + 3)),
    );
    face(out, 'roof', p, [0, 1, 0]);
  }
}
function window(out, e, u, w, b, t, lod, d = 0.035) {
  const r = w / 2;
  panel(out, 'wood', e, u - r - 0.12, u + r + 0.12, b - 0.135, t + 0.18, d, color.wood);
  panel(out, 'detail', e, u - r, u + r, b, t, d + 0.022, color.pane);
  if (!lod) return;
  for (const off of [-r * 0.34, r * 0.34])
    panel(out, 'detail', e, u + off - 0.026, u + off + 0.026, b, t, d + 0.036, color.sash);
  panel(
    out,
    'detail',
    e,
    u - r,
    u + r,
    t - (t - b) * 0.34,
    t - (t - b) * 0.34 + 0.043,
    d + 0.037,
    color.sash,
  );
  if (lod >= 2) {
    panel(out, 'wood', e, u - r - 0.19, u + r + 0.19, t + 0.13, t + 0.24, d + 0.08, color.shade);
    for (const f of [0.31, 0.48])
      panel(
        out,
        'detail',
        e,
        u - r,
        u + r,
        b + (t - b) * f,
        b + (t - b) * f + 0.032,
        d + 0.045,
        color.sash,
      );
    if (lod === 3)
      for (const off of [-r * 0.61, 0, r * 0.61]) {
        const y = t - (t - b) * 0.16;
        beam(
          out,
          'detail',
          e.point(u + off - 0.07, y - 0.069, d + 0.05),
          e.point(u + off + 0.07, y + 0.069, d + 0.05),
          0.02,
          0.02,
          color.sash,
        );
        beam(
          out,
          'detail',
          e.point(u + off + 0.07, y - 0.069, d + 0.05),
          e.point(u + off - 0.07, y + 0.069, d + 0.05),
          0.02,
          0.02,
          color.sash,
        );
      }
  }
}
function walls(out, lod) {
  const area = ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      e = edge(a, b, Math.sign(area)),
      n = e.length;
    panel(out, 'stone', e, 0, n, foundationBottom, mainFloor, 0, color.stone);
    panel(out, 'wall', e, 0, n, mainFloor, wallEaves, 0, color.wall);
    for (const y of [mainFloor, storyLine, wallEaves - 0.08])
      panel(out, 'wood', e, 0, n, y - 0.076, y + 0.079, 0.037);
    if (lod && n >= 1.1) {
      panel(out, 'wood', e, 0, 0.12, mainFloor, wallEaves, 0.064);
      panel(out, 'wood', e, n - 0.12, n, mainFloor, wallEaves, 0.064);
    }
    if (n < 2.45 || (a[1] > 8 && b[1] > 8)) continue;
    const count = Math.max(1, Math.round(n / (lod ? 3.14 : 5.1)));
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * n) / count,
        [x, , z] = e.point(u, 0);
      const underWestEntry = Math.abs(x - westEntry.x) < 1.01 && Math.abs(z - westEntry.z) < 0.18;
      if (!underWestEntry) window(out, e, u, 1.15, 2.05, 3.54, lod);
      window(out, e, u, 1.09, 4.49, 6.26, lod);
    }
  }
  cap(out, ring, wallEaves);
  const front = edge(outline[15], outline[13], 1);
  for (const x of garden.windowCenters) {
    const u = ((outline[15][0] - x) * front.length) / (outline[15][0] - outline[13][0]);
    window(out, front, u, 1.46, 1.91, 3.55, lod);
    window(out, front, u, 1.51, 4.4, 6.31, lod);
    if (lod) panel(out, 'wood', front, u - 0.86, u + 0.86, 4.01, 4.35, 0.058);
  }
}
function gable(out, r, lod) {
  const {
      bounds: [x0, x1, z0, z1],
      eaves,
      ridge,
      axis,
    } = r,
    x = (x0 + x1) / 2,
    z = (z0 + z1) / 2;
  const a =
    axis === 'x'
      ? [
          [x0, eaves, z0],
          [x0, ridge, z],
          [x0, eaves, z1],
        ]
      : [
          [x0, eaves, z0],
          [x, ridge, z0],
          [x1, eaves, z0],
        ];
  const b =
    axis === 'x'
      ? [
          [x1, eaves, z0],
          [x1, ridge, z],
          [x1, eaves, z1],
        ]
      : [
          [x0, eaves, z1],
          [x, ridge, z1],
          [x1, eaves, z1],
        ];
  const n = axis === 'x' ? [1, 0, 0] : [0, 0, 1];
  face(
    out,
    'wall',
    a,
    n.map((v) => -v),
  );
  face(out, 'wall', b, n);
  face(out, 'roof', [a[0], a[1], b[1], b[0]], [0, 1, 0]);
  face(out, 'roof', [a[1], a[2], b[2], b[1]], [0, 1, 0]);
  if (!lod) return;
  for (const end of axis === 'x' ? [a, b] : [b]) {
    for (const k of [0, 2])
      beam(out, 'wood', end[k], end[1], lod >= 2 ? 0.19 : 0.135, 0.17, color.wood);
    beam(out, 'wood', end[0], end[2], 0.13, 0.15, color.wood);
    if (lod >= 2)
      for (const f of [0.13, 0.87]) {
        const p = end[0].map((v, i) => v + (end[2][i] - v) * f),
          q = p.map((v, i) => v + (end[1][i] - v) * 0.23);
        beam(out, 'wood', p, q, 0.11, 0.085, color.wood);
      }
  }
  if (r.name === 'enclosed garden room')
    window(
      out,
      edge([x1, z1], [x0, z1]),
      (x1 - x0) / 2,
      0.89,
      eaves + 0.51,
      eaves + 1.43,
      lod,
      0.043,
    );
}
function hip(out, x, z, w, d, base, top) {
  const ring = (y, inset) => [
    [x - w / 2 + inset, y, z - d / 2 + inset],
    [x - w / 2 + inset, y, z + d / 2 - inset],
    [x + w / 2 - inset, y, z + d / 2 - inset],
    [x + w / 2 - inset, y, z - d / 2 + inset],
  ];
  loft(out, 'roof', [ring(base, 0), ring(top, Math.min(w, d) * 0.45)], color.roof);
}
function towers(out, lod) {
  const {
    center: [x, z],
    width: w,
    deck,
    canopy,
    top,
  } = lookout;
  box(out, 'wall', x, wallEaves - 0.18, z, w, deck - wallEaves + 0.18, w, color.wall);
  box(out, 'wood', x, deck - 0.13, z, w + 0.22, 0.21, w + 0.22, color.wood);
  const half = w / 2 - 0.14;
  for (const dx of [-half, half])
    for (const dz of [-half, half])
      box(out, 'wood', x + dx, deck, z + dz, 0.18, canopy - deck, 0.18, color.sash);
  for (const z0 of [z - half, z + half]) {
    box(out, 'wood', x, deck + 0.08, z0, w, 0.69, 0.09, color.wood);
    if (lod)
      for (const sign of [-1, 1])
        beam(
          out,
          'wood',
          [x + sign * half, canopy - 0.8, z0],
          [x + sign * (half - 0.57), canopy - 0.17, z0],
          0.083,
          0.083,
          color.sash,
        );
    if (lod >= 2)
      for (let j = 1; j <= 8; j++)
        box(
          out,
          'wood',
          x - half + (j * 2 * half) / 9,
          deck + 0.16,
          z0 + 0.05,
          0.05,
          0.44,
          0.058,
          color.shade,
        );
  }
  for (const x0 of [x - half, x + half]) {
    box(out, 'wood', x0, deck + 0.08, z, 0.09, 0.69, w, color.wood);
    if (lod)
      for (const sign of [-1, 1])
        beam(
          out,
          'wood',
          [x0, canopy - 0.8, z + sign * half],
          [x0, canopy - 0.17, z + sign * (half - 0.57)],
          0.083,
          0.083,
          color.sash,
        );
  }
  box(out, 'wood', x, canopy - 0.12, z, w + 0.48, 0.14, w + 0.48, color.wood);
  hip(out, x, z, w + 0.69, w + 0.69, canopy, top);
  box(out, 'detail', x, top - 0.06, z, 0.075, 0.35, 0.075, color.metal);
  const {
    center: [sx, sz],
    width,
    capBase,
    top: smallTop,
  } = stairsTower;
  box(out, 'wall', sx, wallEaves - 0.14, sz, width, capBase - wallEaves + 0.14, width, color.wall);
  box(out, 'wood', sx, capBase - 0.13, sz, width + 0.16, 0.15, width + 0.16, color.wood);
  hip(out, sx, sz, width + 0.24, width + 0.24, capBase, smallTop);
}
function grade(x, z) {
  const [u, v] = [x, z].map((p, i) => (p - ground.origin[i]) / ground.stepMeters),
    i = Math.floor(u),
    j = Math.floor(v),
    a = ground.heightsMeters[j],
    b = ground.heightsMeters[j + 1];
  return (
    (a[i] + (a[i + 1] - a[i]) * (u - i)) * (1 - v + j) +
    (b[i] + (b[i + 1] - b[i]) * (u - i)) * (v - j) -
    ground.modelDatumElevationMeters
  );
}
function entrances(out, lod) {
  const { x, z, width, steps } = westEntry,
    e = edge([x + width, z], [x - width, z]);
  panel(out, 'wood', e, width - 0.62, width + 0.62, mainFloor, mainFloor + 2.2, 0.039, color.wood);
  panel(
    out,
    'detail',
    e,
    width - 0.48,
    width + 0.48,
    mainFloor + 0.05,
    mainFloor + 2.04,
    0.064,
    color.door,
  );
  const low = grade(x, z + 1.46) - 0.22,
    n = lod ? steps : 3;
  for (let i = 0; i < n; i++) {
    const d = (1.46 * (i + 1)) / n,
      y = mainFloor - ((mainFloor - low - 0.22) * i) / n;
    box(out, 'stone', x, low, z + d / 2, width, y - low, d, color.stone);
  }
  if (lod >= 2)
    for (const d of [-1, 1])
      beam(
        out,
        'detail',
        [x + (d * width) / 2, mainFloor + 0.75, z],
        [x + (d * width) / 2, low + 0.95, z + 1.46],
        0.038,
        0.04,
        color.metal,
      );
  const rear = edge([-15.24, -8.04], [12.26, -8.04]);
  panel(out, 'wood', rear, 1.22, 2.55, 1.35, 3.48, 0.053, color.wood);
  panel(out, 'detail', rear, 1.37, 2.42, 1.42, 3.27, 0.074, color.door);
  if (lod) {
    box(out, 'stone', -13.34, 8.45, -4.27, 0.54, 1.1, 0.64, color.stone);
    box(out, 'stone', 6.41, 8.47, -4.28, 0.57, 1.11, 0.65, color.stone);
  }
}
function buildLevel(out, lod) {
  walls(out, lod);
  for (const r of roofs) gable(out, r, lod);
  towers(out, lod);
  entrances(out, lod);
}
export const ringveSkyline = (out) => buildLevel(out, 0);
export const ringveDistrict = (out) => buildLevel(out, 1);
export const ringveStreet = (out) => buildLevel(out, 2);
export const ringveCloseup = (out) => buildLevel(out, 3);

const recipe = 'ringve-manor-model.mjs',
  camera = [-34, 15, 36],
  lookAt = [-1, 5, 0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'ringveDistrict', 0.18],
    ['street', 'ringveStreet', 0.064],
    ['closeup', 'ringveCloseup', 0.024],
  ].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]),
);
export const ringveModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: ringveCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Ringve’s main manor house in September 2009, with the garden gable, painted timber siding, ochre surrounds and two unequal towers, including the open lookout.',
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
    minimumCoverage: 0.94,
    basis: 'The original mapped principal manor house, including its attached projections.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['wood_painted_lap', 'wood_plain', 'slate', 'stone_granite'],
  qaCameras: [
    { name: 'garden-gable-and-open-lookout', position: [-18, 10, 34], lookAt: [-3, 4.8, 3] },
    { name: 'yard-front-and-end-gables', position: [-31, 13, -31], lookAt: [-2, 4, -4] },
    { name: 'twin-tower-and-manor-roof-plan', position: [21, 44, 27], lookAt: [0, 4, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-ringve-manor-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'ringveSkyline',
    errorMeters: 0.35,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. OpenStreetMap geographic controls, ODbL 1.0. Exact photographer-released public-domain photos by Daderot and Mahlum.',
};
