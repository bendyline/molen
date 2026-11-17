/** Saint Catherine's fortified monastery and the stepped buildings inside the enclosure. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { buildFortification } from './fortification.mjs';
import { buildCampanile, buildMinaret, galleryCupola } from './monastery-towers.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const map = read('map-frame.json');
const terrain = read('terrain-grid.json');
const section = plan.section;
const color = Object.fromEntries(
  Object.entries({
    ashlar: 'b58d63',
    shadowStone: 'a07a57',
    sand: 'c8a781',
    pale: 'dfcbab',
    wall: 'd1b998',
    roof: 'af8970',
    clay: 'b1805c',
    basilicaRoof: '6e8180',
    roofRidge: '667c7e',
    court: 'b4a388',
    timber: '6e5140',
    shadow: '523e34',
    trim: 'c8ab84',
    brighter: 'e7d3b5',
  }).map(([id, value]) => [id, rgb(value)]),
);
const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.96, metallic: 0 },
  dress: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.92, metallic: 0 },
  lead: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.94, metallic: 0.025 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.87, metallic: 0 },
};
const mix = (a, b, t) => a + t * (b - a);
const center = (a, b) => [mix(a[0], b[0], 0.5), mix(a[1], b[1], 0.5)];
const xyz = ([x, z], y) => [x, y, z];
const slotFrame = (out, a, b) =>
  transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], 0, a[1]]);
const span = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const signed = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return sum + x * b - a * z;
  }, 0);
const outward = (ring) => (signed(ring) > 0 ? ring : ring.toReversed());
const features = new Map(map.features.map(({ role, points }) => [role, points]));

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const a = Math.floor(u),
    b = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[b][a], h[b][a + 1], u - a), mix(h[b + 1][a], h[b + 1][a + 1], u - a), v - b) -
    terrain.modelDatumElevationMeters
  );
}

function triangles(ring) {
  const raw = new MeshBufferBuilder();
  if (
    !raw.addCap(
      'roof',
      'palette:#ffffff',
      ring,
      [],
      () => 0,
      [0, 1, 0],
      (p) => p,
      color.roof,
    )
  )
    throw Error('Monastery plan could not be triangulated');
  const { indices, positions } = raw.finalize();
  return Array.from({ length: indices.length / 3 }, (_, i) =>
    Array.from(indices.slice(i * 3, i * 3 + 3), (j) => [positions[j * 3], positions[j * 3 + 2]]),
  ).filter((p) => Math.abs(signed(p)) > 1e-5);
}

function splitRoof(ring, offset, positive) {
  const inside = (v) => (positive ? v >= 0 : v <= 0);
  const cut = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring.at(i - 1),
      b = ring[i],
      d = offset(a),
      e = offset(b);
    if (inside(d) !== inside(e)) {
      const t = d / (d - e);
      cut.push([mix(a[0], b[0], t), mix(a[1], b[1], t)]);
    }
    if (inside(e)) cut.push(b);
  }
  return cut;
}

const beforeGate = features.get('western-fortification');
const perimeter = outward([
  ...beforeGate,
  ...features.get('southern-and-eastern-fortification').slice(1),
  ...features.get('northeast-tower-fortification').slice(0, -1),
]);

function masonryVolume(out, ring, high, low, body, tint) {
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i],
      q = ring[(i + 1) % ring.length];
    face(out, body, [xyz(q, low(q)), xyz(p, low(p)), xyz(p, high(p)), xyz(q, high(q))], tint);
  }
}

const rooms = section.ranges.map((r) => {
  const ring = outward(features.get(r.role));
  return { ...r, ring, roof: triangles(ring) };
});

function panel(out, slot, a, b, y0, y1, z, tint) {
  face(
    out,
    slot,
    [
      [b, y0, z],
      [a, y0, z],
      [a, y1, z],
      [b, y1, z],
    ],
    tint,
  );
}

function modestWindows(out, a, b, floor, crown, lod) {
  const len = span(a, b);
  if (len < 4.5) return;
  const n = Math.round(len / (lod === 1 ? 5.2 : 3.65));
  const edge = slotFrame(out, a, b);
  const y = Math.min(floor + 2.74, crown - 1.02);
  if (y - floor < 1.03) return;
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) * len) / n;
    const w = i % 4 === 0 ? 0.27 : 0.33;
    panel(edge, 'timber', x - w, x + w, y - 0.34, y + 0.37, -0.037, color.shadow);
    if (lod > 1) {
      panel(edge, 'dress', x - w - 0.14, x + w + 0.14, y - 0.45, y - 0.3, -0.053, color.trim);
      panel(edge, 'timber', x - 0.025, x + 0.025, y - 0.32, y + 0.34, -0.055, color.timber);
      if (i % 3 === 0)
        panel(edge, 'timber', x - w, x + w, y - 0.022, y + 0.018, -0.058, color.timber);
    }
  }
}

function flatRange(out, r, lod) {
  const boundary = r.role === 'monastery-internal-ranges';
  const tower = r.role === 'kleber-tower';
  const wall = tower ? 'granite' : 'plaster';
  const y = (p) =>
    boundary ? Math.max(-5.7, Math.min(8.2, 1.5 + p[1] * 0.165)) : r.floor + r.eave;
  const foot = (p) => (boundary ? Math.min(y(p) - 3, ground(p) + 1.3) : r.floor);
  const low = (p) => Math.min(foot(p) - 0.18, ground(p) - 0.84);
  if (!tower && lod > 0) masonryVolume(out, r.ring, foot, low, 'granite', color.shadowStone);
  masonryVolume(
    out,
    r.ring,
    y,
    tower || lod === 0 ? low : foot,
    wall,
    tower ? color.ashlar : color.wall,
  );
  for (const f of r.roof)
    triangle(
      out,
      'roof',
      f.map((p) => xyz(p, y(p))),
      tower ? color.sand : color.roof,
    );
  if (lod === 0 || tower) return;
  for (let i = 0; i < r.ring.length; i++) {
    const p = r.ring[i],
      q = r.ring[(i + 1) % r.ring.length],
      len = span(p, q);
    if (len < 0.3) continue;
    const c = center(p, q);
    modestWindows(out, p, q, foot(c), y(c), lod);
    const trim = (p) => y(p) + 0.31;
    if (lod > 1)
      face(
        out,
        'dress',
        [xyz(q, y(q) - 0.12), xyz(p, y(p) - 0.12), xyz(p, trim(p)), xyz(q, trim(q))],
        color.trim,
      );
  }
}

const church = section.basilica;
const churchRing = outward(features.get('transfiguration-basilica'));
const [start, end] = church.axis;
const run = span(start, end);
const axis = [(end[0] - start[0]) / run, (end[1] - start[1]) / run];
const ridgeDistance = (p) => (p[0] - start[0]) * axis[1] - (p[1] - start[1]) * axis[0];
const churchRoof = (p) =>
  church.eave +
  (church.ridge - church.eave) * Math.max(0, 1 - Math.abs(ridgeDistance(p)) / (church.width / 2));
const churchDeck = [true, false].flatMap((side) =>
  triangles(splitRoof(churchRing, ridgeDistance, side)),
);

function basilica(out, lod) {
  const low = (p) => Math.min(church.floor - 0.85, ground(p) - 0.79);
  masonryVolume(out, churchRing, churchRoof, low, 'granite', color.sand);
  for (const f of churchDeck)
    triangle(
      out,
      'lead',
      f.map((p) => xyz(p, churchRoof(p))),
      color.basilicaRoof,
    );
  const a = [-3.6171, -4.7509],
    b = [1.4489, 6.2955];
  const entry = slotFrame(out, a, b);
  const mid = span(a, b) / 2;
  const floor = church.floor;
  const [left, right] = [mid - 1.06, mid + 1.06];
  panel(entry, 'timber', left, right, floor + 0.03, floor + 2.61, -0.069, color.timber);
  if (lod > 0) {
    const crossY = church.eave + 0.49;
    panel(
      entry,
      'timber',
      mid - 0.12,
      mid + 0.12,
      crossY - 0.58,
      crossY + 1.15,
      -0.064,
      color.shadow,
    );
    panel(
      entry,
      'timber',
      mid - 0.6,
      mid + 0.6,
      crossY + 0.35,
      crossY + 0.61,
      -0.067,
      color.shadow,
    );
    for (const x of [left - 0.14, right + 0.14])
      box(entry, 'dress', [x - 0.13, floor, -0.25], [x + 0.13, floor + 2.69, 0.05], color.trim);
    box(
      entry,
      'dress',
      [left - 0.3, floor + 2.55, -0.28],
      [right + 0.3, floor + 2.81, 0.03],
      color.trim,
    );
    for (let i = 0; i < churchRing.length; i++) {
      const p = churchRing[i],
        q = churchRing[(i + 1) % churchRing.length];
      if (span(p, q) > 13) modestWindows(out, p, q, floor + 1.33, church.eave, lod);
    }
    const ridge = slotFrame(out, start, end);
    box(
      ridge,
      'lead',
      [-1.0, church.ridge - 0.065, -0.063],
      [run + 1.2, church.ridge + 0.081, 0.063],
      color.roofRidge,
    );
  }
}

const mosqueRing = outward(features.get('fatimid-mosque'));
const mosqueTop = triangles(mosqueRing);
function mosque(out, lod) {
  const m = section.mosque;
  masonryVolume(
    out,
    mosqueRing,
    () => m.eave,
    (p) => Math.min(ground(p) - 0.65, m.floor - 0.65),
    'plaster',
    color.pale,
  );
  for (const f of mosqueTop)
    triangle(
      out,
      'roof',
      f.map((p) => xyz(p, m.eave)),
      color.roof,
    );
  const [x, z] = m.minaretCenter;
  buildMinaret(
    transform(out, 0, [x, 0, z]),
    { width: m.minaretWidth, floor: m.floor, shaftTop: m.minaretShaftTop, crown: m.minaretCrown },
    lod,
  );
}

function archedGalleryLevel(out, config, lod) {
  const { span, bays, floor, ceiling, front, pavilion } = config;
  const width = span / bays;
  const h = ceiling - floor;
  if (lod === 0) {
    box(out, 'plaster', [-span / 2, floor, front], [span / 2, ceiling, front + 0.65], color.wall);
    return;
  }
  const count = lod > 1 ? 7 : 4;
  const frame = (left, right, rangeY, body, z = front) =>
    panel(out, 'dress', left, right, rangeY[0], rangeY[1], z, body);
  for (let i = 0; i < bays; i++) {
    const x = -span / 2 + width * (i + 0.5);
    const l = x - width / 2,
      r = x + width / 2;
    const half = width * (Math.abs(x - pavilion) < width / 2 ? 0.368 : 0.423);
    const spring = floor + h * 0.64,
      rise = h * 0.23;
    frame(l, x - half, [floor, ceiling], color.sand);
    frame(x + half, r, [floor, ceiling], color.sand);
    frame(x - half, x + half, [floor, floor + 0.35], color.sand);
    for (let j = 0; j < count; j++) {
      const t0 = -1 + (2 * j) / count,
        t1 = -1 + (2 * (j + 1)) / count;
      const a = x + t0 * half,
        b = x + t1 * half;
      const bot = (t) => spring + Math.sqrt(1 - t * t) * rise;
      face(
        out,
        'dress',
        [
          [b, bot(t1), front],
          [a, bot(t0), front],
          [a, ceiling, front],
          [b, ceiling, front],
        ],
        color.sand,
      );
    }
    frame(x - half, x + half, [floor + 0.37, floor + 0.6], color.trim, front + 0.024);
    if (lod > 1)
      for (const p of [-0.7, -0.42, -0.14, 0.14, 0.42, 0.7])
        box(
          out,
          'timber',
          [x + half * p - 0.026, floor + 0.41, front - 0.024],
          [x + half * p + 0.026, floor + 0.88, front + 0.042],
          color.timber,
        );
    panel(
      out,
      'timber',
      x - half * 0.35,
      x + half * 0.35,
      floor + 0.81,
      spring + 0.05,
      front + 0.994,
      color.shadow,
    );
  }
}

function upperTerrace(out, lod) {
  const g = section.upperGallery;
  const [x, z] = g.center;
  const half = g.width / 2;
  const d = g.depth / 2;
  const r = transform(out, 0, [x, 0, z]);
  const first = g.floor + 5.5;
  const second = g.roofHeight;
  const yBase = Math.min(ground(g.center) - 0.45, g.floor - 0.89);
  box(r, 'granite', [-half, yBase, -d], [half, g.floor + 0.3, d], color.ashlar);
  box(r, 'plaster', [-half, g.floor + 0.2, -d + 1.02], [half, second - 0.12, d], color.pale);
  archedGalleryLevel(
    r,
    {
      span: g.width,
      bays: g.bays,
      floor: g.floor + 0.32,
      ceiling: first,
      front: -d,
      pavilion: g.pavilionX,
    },
    lod,
  );
  archedGalleryLevel(
    r,
    {
      span: g.width,
      bays: g.bays,
      floor: first + 0.25,
      ceiling: second,
      front: -d,
      pavilion: g.pavilionX,
    },
    lod,
  );
  box(
    r,
    'dress',
    [-half - 0.26, first - 0.2, -d - 0.16],
    [half + 0.26, first + 0.16, d + 0.13],
    color.trim,
  );
  box(
    r,
    'dress',
    [-half - 0.37, second - 0.19, -d - 0.24],
    [half + 0.37, second + 0.27, d + 0.25],
    color.sand,
  );
  const pavilion = transform(r, 0, [g.pavilionX, 0, -d - 0.15]);
  box(pavilion, 'granite', [-2.1, first - 1.48, -0.87], [2.1, second + 1.15, 1.88], color.ashlar);
  panel(pavilion, 'timber', -0.93, 0.93, first + 0.35, second - 0.04, -0.891, color.shadow);
  if (lod > 0) {
    for (const x of [-1.31, 1.31])
      box(
        pavilion,
        'dress',
        [x - 0.15, first + 0.05, -1.07],
        [x + 0.15, second + 0.62, 0.79],
        color.trim,
      );
    box(pavilion, 'dress', [-2.29, second + 0.95, -1.12], [2.29, second + 1.32, 1.95], color.sand);
  }
  galleryCupola(transform(pavilion, 0, [0, 0, 0.43]), 1.56, second + 1.29, 1.45, lod);
}

function sideGallery(out, lod) {
  const wing = transform(out, Math.PI / 2, [35.7, 0, 13.7]);
  const y = 0.17,
    h = 3.05,
    w = 10.35,
    d = 2.42;
  box(wing, 'plaster', [-w, y - 3.15, -d], [w, y, d], color.pale);
  box(wing, 'plaster', [-w, y, -0.25], [w, y + h, d], color.wall);
  box(
    wing,
    'roof',
    [-w - 0.25, y + h - 0.1, -d - 0.41],
    [w + 0.25, y + h + 0.22, d + 0.16],
    color.clay,
  );
  const p = [
    [-w - 0.25, y + h, -d - 0.41],
    [-w - 0.25, y + h + 1.25, 0.23],
    [w + 0.25, y + h + 1.25, 0.23],
    [w + 0.25, y + h, -d - 0.41],
  ];
  face(wing, 'roof', p, color.clay);
  face(
    wing,
    'roof',
    [
      [w + 0.25, y + h, d + 0.16],
      [w + 0.25, y + h + 1.25, 0.23],
      [-w - 0.25, y + h + 1.25, 0.23],
      [-w - 0.25, y + h, d + 0.16],
    ],
    color.clay,
  );
  triangle(wing, 'plaster', [p[0], [-w - 0.25, y + h, d + 0.16], p[1]], color.wall);
  triangle(wing, 'plaster', [p[3], p[2], [w + 0.25, y + h, d + 0.16]], color.wall);
  if (lod === 0) return;
  box(wing, 'timber', [-w, y + 0.54, -d - 0.05], [w, y + 0.69, -d + 0.11], color.timber);
  for (let x = -w + 0.15; x < w; x += 2.05)
    box(
      wing,
      'timber',
      [x - 0.067, y + 0.1, -d - 0.055],
      [x + 0.067, y + h - 0.07, -d + 0.085],
      color.timber,
    );
}

function upperCourts(out, lod) {
  if (lod === 0) return;
  const patios = [
    [
      [-20, -4],
      [-4, -7],
      [0, 9],
      [-16, 13],
    ],
    [
      [-20, 15],
      [-18, 31],
      [2, 29],
      [-2, 17],
    ],
  ];
  for (const ring of patios) {
    const deck = triangles(ring);
    const y = ground(ring[0]) + 0.75;
    for (const f of deck)
      triangle(
        out,
        'dress',
        f.map((p) => xyz(p, Math.max(y, ground(p) + 0.12))),
        color.court,
      );
  }
}

function build(out, lod) {
  buildFortification(out, { path: perimeter, ground, controls: section.fortification }, lod);
  for (const r of rooms) flatRange(out, r, lod);
  basilica(out, lod);
  mosque(out, lod);
  const [x, z] = center(features.get('bell-tower')[0], features.get('bell-tower')[2]);
  buildCampanile(transform(out, -0.49, [x, 0, z]), { ...section.campanile, width: 3.85 }, lod);
  upperTerrace(out, lod);
  sideGallery(out, lod);
  upperCourts(out, lod);
}

export const monasterySkyline = (out) => build(out, 0);
export const monasteryDistrict = (out) => build(out, 1);
export const monasteryStreet = (out) => build(out, 2);
export const monasteryCloseup = (out) => build(out, 3);
const camera = [-61, 62, -131],
  lookAt = [6, -1, 2];
const recipe = 'saint-catherines-monastery-model.mjs';
export const monasteryModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: monasteryCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Saint Catherine’s Monastery in April 2011, with the granite fortification, the Transfiguration Basilica, its open bell tower, the whitewashed Fatimid minaret and the monastery’s terraced ranges.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-32, 50, -72],
  mediumFiContext: {
    scale: 1,
    groundY: -17.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_granite',
    'stone_limestone_raw',
    'plaster_lime',
    'tile_ceramic',
    'metal_standing_seam',
    'wood_plain',
  ],
  qaCameras: [
    { name: 'granite-fortification-and-gate', position: [5, 4, -77], lookAt: [6, -7.5, -26] },
    {
      name: 'basilica-campanile-and-fatimid-minaret',
      position: [-27, 8, -22],
      lookAt: [5, -1.9, 0],
    },
    { name: 'upper-terrace-and-arcades', position: [-10, 19, -3], lookAt: [2, 5.3, 36] },
    { name: 'eastern-walls-and-terraced-ranges', position: [81, 33, 41], lookAt: [3, 1, 5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'sinai-monastery-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'monasterySkyline',
    errorMeters: 0.55,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'monasteryDistrict', 0.25],
        ['street', 'monasteryStreet', 0.11],
        ['closeup', 'monasteryCloseup', 0.041],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The exact Qualla panorama is creator-released CC0. Native OpenStreetMap geometry under ODbL 1.0.',
};
