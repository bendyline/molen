/** The pre-renovation exterior of the Museum of Cham Sculpture in Da Nang. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B,
  poly,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const outline = read('map-frame.json').features[0].outline;
const { foundationBottom, mainFloor, eaves, rearUpperEaves } = plan.section;
const surfaces = {
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.92, metallic: 0 },
  moulding: { slot: 'trim', graph: 'plaster_lime', roughness: 0.89, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.94, metallic: 0 },
  pane: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.55, metallic: 0.03 },
};
const tone = Object.fromEntries(
  Object.entries({
    plaster: 'e6be70',
    moulding: 'edd08e',
    recess: 'ce9d54',
    stone: 'b29f80',
    stair: 'a6a391',
    roof: '807064',
    brick: 'ab6750',
    pane: '4b5550',
    dark: '30372e',
    sash: 'bcbead',
  }).map(([k, value]) => [k, rgb(value)]),
);

function surface(out, slot, points, toward, color = tone[slot]) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, n, i) => sum + n * toward[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
      color,
    );
}

function edge([x, z], b) {
  const length = Math.hypot(b[0] - x, b[1] - z);
  const tx = (b[0] - x) / length,
    tz = (b[1] - z) / length;
  return {
    length,
    normal: [-tz, 0, tx],
    at: (u, y, d = 0) => [x + tx * u - tz * d, y, z + tz * u + tx * d],
  };
}

function panel(out, slot, side, lo, hi, base, top, d = 0, color) {
  if (hi - lo < 0.002 || top - base < 0.002) return;
  const { at, normal } = side;
  surface(
    out,
    slot,
    [at(lo, base, d), at(hi, base, d), at(hi, top, d), at(lo, top, d)],
    normal,
    color,
  );
}

function block(out, slot, side, lo, hi, base, top, back, front, color = tone[slot]) {
  const { at, normal } = side;
  panel(out, slot, side, lo, hi, base, top, front, color);
  surface(
    out,
    slot,
    [at(lo, base, back), at(hi, base, back), at(hi, top, back), at(lo, top, back)],
    normal.map((n) => -n),
    color,
  );
  for (const [y, sign] of [
    [base, -1],
    [top, 1],
  ]) {
    surface(
      out,
      slot,
      [at(lo, y, back), at(hi, y, back), at(hi, y, front), at(lo, y, front)],
      [0, sign, 0],
      color,
    );
  }
  for (const [u, sign] of [
    [lo, -1],
    [hi, 1],
  ]) {
    surface(
      out,
      slot,
      [at(u, base, back), at(u, base, front), at(u, top, front), at(u, top, back)],
      [normal[2] * sign, 0, -normal[0] * sign],
      color,
    );
  }
}

function solid(out, slot, ring, y0, y1, color = tone[slot]) {
  const scratch = new MeshBufferBuilder();
  poly(scratch, slot, ring, y0, y1, color);
  const mesh = scratch.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const indices = mesh.indices.slice(i, i + 3);
    const points = Array.from(indices, (k) => Array.from(mesh.positions.slice(k * 3, k * 3 + 3)));
    const normal = Array.from(mesh.normals.slice(indices[0] * 3, indices[0] * 3 + 3));
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
      color,
    );
  }
}

function openings(side, count, entry) {
  return Array.from({ length: count }, (_, i) => {
    const span = side.length / count;
    const u = span * (i + 0.5);
    const door = entry && i === Math.floor(count / 2);
    const w = door ? span * 0.82 : Math.min(2.35, span * 0.59);
    return { lo: u - w / 2, hi: u + w / 2, sill: mainFloor + (door ? 0 : 0.57), head: 4.58, door };
  });
}

function glazing(out, side, opening, lod, recessed = true) {
  const { lo, hi, sill, head, door } = opening;
  const d = recessed ? (door ? -0.82 : -0.25) : 0.018;
  const tint = door ? tone.dark : tone.pane;
  panel(out, 'pane', side, lo, hi, sill, head, d, tint);
  if (!lod) return;
  const bar = d + 0.027,
    cross = head - (door ? 0.53 : 0.68);
  panel(out, 'pane', side, lo, hi, cross - 0.023, cross + 0.023, bar, tone.sash);
  if (!door) {
    const mid = (lo + hi) / 2;
    panel(out, 'pane', side, mid - 0.019, mid + 0.019, sill, cross, bar, tone.sash);
  }
}

function detailOpening(out, side, opening, lod) {
  const { lo, hi, sill, head, door } = opening;
  const { at, normal } = side;
  const d = door ? -0.82 : -0.25;
  for (const [u, sign] of [
    [lo, 1],
    [hi, -1],
  ]) {
    surface(
      out,
      'moulding',
      [at(u, sill, d), at(u, head, d), at(u, head), at(u, sill)],
      [normal[2] * sign, 0, -normal[0] * sign],
      tone.recess,
    );
  }
  surface(
    out,
    'moulding',
    [at(lo, head, d), at(hi, head, d), at(hi, head), at(lo, head)],
    [0, -1, 0],
    tone.recess,
  );
  surface(out, 'stone', [at(lo, sill, d), at(hi, sill, d), at(hi, sill), at(lo, sill)], [0, 1, 0]);
  glazing(out, side, opening, lod);
  if (!door) block(out, 'moulding', side, lo - 0.13, hi + 0.13, sill - 0.105, sill, -0.04, 0.2);
  if (lod === 3)
    block(out, 'moulding', side, lo - 0.13, hi + 0.13, head, head + 0.12, -0.025, 0.14);
}

function galleryFacade(out, side, count, lod, entry = false) {
  const { length } = side;
  const panes = openings(side, count, entry);
  panel(out, 'stone', side, 0, length, foundationBottom, 0.65);
  if (lod < 2) {
    panel(out, 'plaster', side, 0, length, 0.65, eaves);
    for (const opening of panes) glazing(out, side, opening, lod, false);
  } else {
    let cursor = 0;
    for (const opening of panes) {
      const { lo, hi, sill, head } = opening;
      panel(out, 'plaster', side, cursor, lo, 0.65, eaves);
      panel(out, 'plaster', side, lo, hi, 0.65, sill);
      panel(out, 'plaster', side, lo, hi, head, eaves);
      detailOpening(out, side, opening, lod);
      cursor = hi;
    }
    panel(out, 'plaster', side, cursor, length, 0.65, eaves);
  }
  if (lod) block(out, 'moulding', side, 0, length, 5.37, 5.61, -0.025, 0.28);
  block(out, 'moulding', side, 0, length, 5.68, eaves + 0.13, -0.045, 0.43);
  const door = panes.find((p) => p.door);
  const courses =
    lod < 2
      ? [[0.88, 1.08, 0.17]]
      : [
          [0.66, 0.84, 0.14],
          [0.95, 1.12, 0.18],
          [1.37, 1.53, 0.19],
        ];
  for (const [base, top, d] of courses) {
    block(out, 'moulding', side, 0, door?.lo ?? length, base, top, -0.021, d);
    if (door) block(out, 'moulding', side, door.hi, length, base, top, -0.021, d);
  }
  if (lod) {
    for (let i = 1; i < count; i++) {
      const u = (length * i) / count;
      if (lod > 1) {
        block(out, 'moulding', side, u - 0.18, u + 0.18, 1.5, 5.13, -0.03, 0.15);
        block(out, 'moulding', side, u - 0.27, u + 0.27, 5.1, 5.29, -0.04, 0.23);
      } else panel(out, 'moulding', side, u - 0.18, u + 0.18, 1.5, 5.13, 0.027);
    }
  }
}

function roof(out, ring, y, rise, color = tone.roof) {
  const midpoint = ring.reduce(
    ([x, z], [u, v]) => [x + u / ring.length, z + v / ring.length],
    [0, 0],
  );
  const inner = ring.map(([x, z]) => [
    midpoint[0] + (x - midpoint[0]) * 0.63,
    midpoint[1] + (z - midpoint[1]) * 0.64,
  ]);
  const at = ([x, z], height) => [x, height, z];
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    surface(
      out,
      'roof',
      [at(ring[i], y), at(ring[j], y), at(inner[j], y + rise), at(inner[i], y + rise)],
      [0, 1, 0],
      color,
    );
  }
  surface(
    out,
    'roof',
    inner.map((p) => at(p, y + rise)),
    [0, 1, 0],
    color,
  );
}

const rectangle = (x0, z0, x1, z1) => [
  [x0, z1],
  [x1, z1],
  [x1, z0],
  [x0, z0],
];

function rearRange(out, lod) {
  const range = rectangle(-9.95, -18.7, 19.45, 3.85);
  const wallBase = eaves + 0.17;
  for (let i = 0; i < range.length; i++) {
    const side = edge(range[i], range[(i + 1) % range.length]);
    const count = i % 2 ? 4 : 6;
    panel(out, 'plaster', side, 0, side.length, wallBase, rearUpperEaves);
    block(out, 'moulding', side, 0, side.length, 8.75, rearUpperEaves + 0.06, -0.06, 0.22);
    for (let j = 0; j < count; j++) {
      const mid = (side.length * (j + 0.5)) / count;
      const opening = { lo: mid - 0.65, hi: mid + 0.65, sill: 6.53, head: 8.31 };
      glazing(out, side, opening, lod, false);
      if (lod > 1)
        block(out, 'moulding', side, opening.lo - 0.14, opening.hi + 0.14, 6.4, 6.53, -0.06, 0.14);
    }
  }
  roof(out, rectangle(-10.21, -18.96, 19.71, 4.1), rearUpperEaves + 0.065, 1.33);
}

function entry(out, side, lod, broad = false) {
  const mid = side.length / 2,
    width = broad ? 3.55 : 2.95;
  const count = lod === 0 ? 2 : 5;
  const ground = broad ? 0.18 : 0.1;
  for (let i = 0; i < count; i++) {
    const top = ground + ((mainFloor - ground) * (i + 1)) / count;
    const depth = 2.15 - (i * 1.54) / count;
    block(
      out,
      'stone',
      side,
      mid - width / 2,
      mid + width / 2,
      -0.48,
      top,
      -0.025,
      depth,
      tone.stair,
    );
  }
}

function galleryRoofs(out, sides, lod) {
  solid(out, 'plaster', outline, eaves - 0.02, eaves + 0.16);
  roof(out, [outline[11], outline[0], [0.65, 17.84], [-7.69, 17.78]], eaves + 0.16, 0.96);
  roof(out, rectangle(0.74, 8.87, 8.83, 17.59), eaves + 0.17, 0.75);
  roof(out, rectangle(-12.57, 7.96, -7.7, 17.57), eaves + 0.17, 0.71);
  const front = sides[11],
    center = front.length / 2;
  for (const [width, base, height, depth] of [
    [6.55, eaves + 0.06, 0.35, 0.23],
    [3.7, eaves + 0.4, 0.29, 0.16],
    [1.58, eaves + 0.68, 0.24, 0.1],
  ]) {
    block(
      out,
      'moulding',
      front,
      center - width / 2,
      center + width / 2,
      base,
      base + height,
      -0.52,
      depth,
    );
  }
  entry(out, front, lod, true);
  entry(out, sides[10], lod);
}

function terrace(out, lod) {
  const y = eaves + 0.18,
    west = -18.48,
    north = -1.2,
    south = -17.05,
    east = -10;
  B(
    out,
    'roof',
    (east + west) / 2,
    eaves + 0.13,
    (north + south) / 2,
    east - west,
    0.1,
    north - south,
    tone.brick,
  );
  const parapets = [edge([west, north], [west, south]), edge([west, south], [east, south])];
  for (const side of parapets) {
    block(out, 'plaster', side, 0, side.length, y, y + 0.75, -0.16, 0.16);
    block(out, 'moulding', side, 0, side.length, y + 0.71, y + 0.83, -0.24, 0.24);
    const count = Math.max(3, Math.round(side.length / (lod === 0 ? 3.1 : 1.65)));
    for (let i = 0; i < count; i++) {
      const u = (side.length * (i + 0.28)) / count;
      block(out, 'moulding', side, u - 0.21, u + 0.21, y + 0.77, y + 1.02, -0.22, 0.22);
      block(out, 'moulding', side, u - 0.13, u + 0.13, y + 0.98, y + 1.15, -0.14, 0.14);
      if (lod > 1) {
        const [x, , z] = side.at(u, 0);
        const ring = rectangle(x - 0.12, z - 0.12, x + 0.12, z + 0.12);
        for (let j = 0; j < 4; j++) {
          const [a, b] = [ring[j], ring[(j + 1) % 4]];
          surface(
            out,
            'moulding',
            [
              [a[0], y + 1.14, a[1]],
              [b[0], y + 1.14, b[1]],
              [x, y + 1.35, z],
            ],
            edge(a, b).normal,
          );
        }
      }
    }
  }
}

function build(out, _frame, lod = 3) {
  const counts = [4, 3, 2, 3, 6, 8, 6, 2, 3, 2, 4, 3];
  const sides = outline.map((p, i) => edge(p, outline[(i + 1) % outline.length]));
  for (const [i, side] of sides.entries()) galleryFacade(out, side, counts[i], lod, i >= 10);
  galleryRoofs(out, sides, lod);
  rearRange(out, lod);
  terrace(out, lod);
}
export const museumSkyline = (out, frame) => build(out, frame, 0);
export const museumDistrict = (out, frame) => build(out, frame, 1);
export const museumStreet = (out, frame) => build(out, frame, 2);
export const museumCloseup = (out, frame) => build(out, frame, 3);

const recipe = 'museum-model.mjs';
const camera = [43, 25, 57],
  lookAt = [0, 4.3, 5];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'museumDistrict', 0.18],
    ['street', 'museumStreet', 0.074],
    ['closeup', 'museumCloseup', 0.028],
  ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
);
export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The ochre galleries of the Museum of Cham Sculpture in Da Nang, with its stepped entrance, Cham-inspired parapet and terracotta terrace.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  mediumFiContext: {
    scale: 1.22,
    groundY: -0.65,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stucco', 'plaster_lime', 'stone_sandstone_raw', 'tile_flat'],
  qaCameras: [
    { name: 'ochre-entrance-and-courtyard', position: [-12, 5.1, 48], lookAt: [-4, 3.2, 26] },
    { name: 'raised-gallery-and-mouldings', position: [-17.5, 4, 36], lookAt: [-8.4, 3.5, 21] },
    {
      name: 'terracotta-terrace-and-upper-range',
      position: [-23.5, 10, -20],
      lookAt: [-11.5, 7, -8],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-da-nang-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.36,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Cited architectural photographs are public-domain or CC0. OpenStreetMap contributors supply mapped controls under ODbL.',
};
