import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  at,
  cap,
  face,
  floorSampler,
  mix,
  palette,
  rect,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import { abox } from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const terrain = read('terrain-grid.json');
const { pitch } = read('native-map/japan-national-stadium-field-controls.json');
const {
  outline,
  holes: [aperture],
} = frame.geometry;
const grade = floorSampler(terrain);
const d = plan.dimensions;
const fieldY = d.fieldDesignDatumTP - terrain.modelDatumElevationMeters;
const topY = d.roofHeight + d.architecturalGroundDatumTP - terrain.modelDatumElevationMeters;
const colors = palette({
  canopy: 'd2d4cc',
  canopyDark: 'c2c7c2',
  shadow: '454c4a',
  undercroft: '686c60',
  concrete: 'babcb0',
  face: 'd7d8cd',
  silver: 'c5c9c6',
  glass: '526568',
  wood: '8e765e',
  darkWood: '62594d',
  lighterWood: 'a28b71',
  grass: '69864d',
  freshGrass: '729052',
  track: 'a9614b',
  kerb: 'd6c9aa',
  apron: '9a958a',
  pale: 'd9d6c4',
  line: 'e1dcc8',
  lime: 'a3aa78',
  gray: '9fa197',
  leaf: '55704a',
  shadeLeaf: '465e3c',
  brown: '726557',
});
const surfaces = {
  canopy: surface('roof', 'metal_standing_seam', 0.78, 0.09),
  timber: surface('trim', 'wood_plain', 0.9),
  concrete: surface('foundation', 'concrete_plain', 0.92),
  cladding: surface('wall', 'concrete_plain', 0.92),
  steel: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.79, metallic: 0.1 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.73 },
  ground: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.96 },
  seats: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.94 },
  leaf: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.97 },
};
const fullTurn = 2 * Math.PI;
const vector = (angle) => [Math.cos(angle), Math.sin(angle)];
const cross = ([x, z], [u, v]) => x * v - z * u;
const scale = ([x, z], f) => [x * f, z * f];
const between = ([x, z], [u, v], t) => [mix(x, u, t), mix(z, v, t)];
const radial = ([x, z]) => [x, 0, z];
const directions = (n) => Array.from({ length: n }, (_, i) => vector((i * fullTurn) / n));

function radius(outline, direction) {
  let distance = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const edge = [b[0] - a[0], b[1] - a[1]];
    const denominator = cross(direction, edge);
    if (Math.abs(denominator) < 1e-8) continue;
    const length = cross(a, edge) / denominator;
    const weight = cross(a, direction) / denominator;
    if (length > 0 && weight >= 0 && weight <= 1) distance = Math.min(distance, length);
  }
  return scale(direction, distance);
}

function band(out, slot, a, b, lo, hi, tint, normal) {
  const loAt = typeof lo === 'function' ? lo : () => lo;
  const hiAt = typeof hi === 'function' ? hi : () => hi;
  const colorAt = typeof tint === 'function' ? tint : () => tint;
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    face(
      out,
      slot,
      [at(a[i], loAt(a[i])), at(a[j], loAt(a[j])), at(b[j], hiAt(b[j])), at(b[i], hiAt(b[i]))],
      normal(a[i]),
      colorAt(i),
    );
  }
}

const trackRadius = 36.5;
const straightHalf = 42.195;
function capsule(direction, radius) {
  const [x, z] = direction;
  const axial = Math.abs(z);
  const hit = radius / Math.max(Math.abs(x), 1e-8);
  const distance =
    hit * axial <= straightHalf
      ? hit
      : straightHalf * axial + Math.sqrt(radius * radius - straightHalf * straightHalf * x * x);
  return scale(direction, distance);
}

function drawField(out, dirs, lod) {
  const field = pitch.local;
  const y = fieldY + 0.04;
  const inner = dirs.map((v) => capsule(v, trackRadius));
  const outer = dirs.map((v) => capsule(v, trackRadius + 1.22 * 9));
  const apron = dirs.map((v) => capsule(v, trackRadius + 13.2));
  // Radial sectors keep the straight sides of the running track free of collinear faces.
  for (const [ring, h, color] of [
    [apron, y - 0.04, colors.apron],
    [inner, y, colors.grass],
  ])
    for (let i = 0; i < ring.length; i++)
      face(
        out,
        'ground',
        [at([0, 0], h), at(ring[i], h), at(ring[(i + 1) % ring.length], h)],
        up,
        color,
      );
  band(out, 'ground', inner, outer, y + 0.006, y + 0.006, colors.track, () => up);
  cap(out, 'ground', field, y + 0.025, colors.grass);
  if (lod === 0) return;
  const left = Math.min(...field.map((p) => p[0]));
  const right = Math.max(...field.map((p) => p[0]));
  const back = Math.min(...field.map((p) => p[1]));
  const front = Math.max(...field.map((p) => p[1]));
  const stripe = (front - back) / 12;
  for (let i = 0; i < 12; i += 2)
    cap(
      out,
      'ground',
      rect(left, back + (i + 1) * stripe, right, back + i * stripe),
      y + 0.03,
      colors.freshGrass,
    );
  function line([x, z], [a, b], width = 0.084) {
    const len = Math.hypot(a - x, b - z);
    const dx = ((b - z) * width) / len;
    const dz = ((x - a) * width) / len;
    face(
      out,
      'ground',
      [
        [x + dx, z + dz],
        [a + dx, b + dz],
        [a - dx, b - dz],
        [x - dx, z - dz],
      ].map((p) => at(p, y + 0.056)),
      up,
      colors.line,
    );
  }
  for (let i = 0; i < field.length; i++) line(field[i], field[(i + 1) % field.length]);
  line([left, 0], [right, 0]);
  const circle = directions(24).map((v) => scale(v, 9.15));
  for (let i = 0; i < circle.length; i++) line(circle[i], circle[(i + 1) % circle.length]);
  for (const s of [-1, 1]) {
    const end = s === 1 ? front : back;
    for (const [w, l] of [
      [20.16, 16.5],
      [9.16, 5.5],
    ]) {
      const edge = end - s * l;
      line([-w, end], [-w, edge]);
      line([-w, edge], [w, edge]);
      line([w, edge], [w, end]);
    }
    if (lod > 1) {
      const a = [-3.66, y + 0.03, end];
      const b = [3.66, y + 0.03, end];
      const A = [a[0], a[1] + 2.44, a[2]];
      const B = [b[0], b[1] + 2.44, b[2]];
      for (const [p, q] of [
        [a, A],
        [b, B],
        [A, B],
      ])
        beam(out, 'steel', p, q, 0.115, 0.115, colors.face);
    }
  }
  const lanes = lod === 1 ? [0, 9] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const lane of lanes) {
    const a = dirs.map((v) => capsule(v, trackRadius + 1.22 * lane));
    const b = dirs.map((v) => capsule(v, trackRadius + 1.22 * lane + 0.075));
    band(out, 'ground', a, b, y + 0.036, y + 0.036, colors.line, () => up);
  }
}

const seats = [colors.pale, colors.lime, colors.gray, colors.leaf, colors.brown];
function bowl(out, outer, dirs, lod) {
  const apron = dirs.map((v) => capsule(v, trackRadius + 13.25));
  const select = (t) => apron.map((p, i) => between(p, outer[i], t));
  const tier = [
    { from: 0, to: 0.235, low: fieldY + 0.13, high: 12.2 },
    { from: 0.267, to: 0.383, low: 13.7, high: 21.9 },
    { from: 0.414, to: 0.598, low: 23.1, high: 38.2 },
  ];
  for (let k = 0; k < tier.length; k++) {
    const { from, to, low, high } = tier[k];
    const rows = [1, 2, 6, 13][lod];
    for (let j = 0; j < rows; j++) {
      const a = j / rows;
      const b = (j + 1) / rows;
      const inside = select(mix(from, to, a));
      const outside = select(mix(from, to, b));
      const y = mix(low, high, b);
      const tint = (i) => {
        if (lod === 0) return seats[k + 1];
        if (i % (lod === 3 ? 7 : 5) === 1) return colors.concrete;
        const n = (i * 113 + j * 53 + k * 29) % 29;
        return seats[(k + Math.floor(n / 6)) % seats.length];
      };
      band(out, 'seats', inside, outside, lod === 0 ? mix(low, high, a) : y, y, tint, () => up);
      if (lod > 0)
        band(out, 'concrete', inside, inside, mix(low, high, a), y, colors.concrete, (p) =>
          radial(scale(p, -1)),
        );
    }
    if (k < tier.length - 1) {
      const next = tier[k + 1];
      band(
        out,
        'concrete',
        select(to),
        select(next.from),
        high,
        next.low,
        colors.undercroft,
        () => up,
      );
    }
  }
}

const facadeTiers = [
  { y: 7.0, lip: 0.91, wall: 0.795 },
  { y: 14.7, lip: 0.935, wall: 0.807 },
  { y: 22.9, lip: 0.96, wall: 0.822 },
  { y: 30.45, lip: 0.968, wall: 0.842 },
];
const scaleRing = (ring, t) => ring.map((p) => scale(p, t));
function exterior(out, outer, lod) {
  const wall = (slot, r, b, lo, hi, tint, normal = radial) =>
    band(out, slot, scaleRing(outer, r), scaleRing(outer, b), lo, hi, tint, normal);
  wall('cladding', 0.86, 0.86, (p) => Math.min(-8, grade(p) - 1.95), 7, colors.concrete);
  for (let i = 0; i < facadeTiers.length; i++) {
    const { y, lip, wall: back } = facadeTiers[i];
    const ceiling = facadeTiers[i + 1]?.y ?? 40.8;
    wall('glass', back, back, y - 0.22, ceiling - 1.45, colors.glass);
    wall('timber', back, lip, y - 1.84, y - 0.26, colors.wood, () => [0, -1, 0]);
    wall('steel', lip, lip, y - 0.29, y + 0.43, colors.silver);
    if (lod > 0) {
      wall('ground', back + 0.023, lip - 0.008, y + 0.36, y + 0.36, colors.leaf, () => up);
      if (lod > 1) wall('timber', lip - 0.013, lip - 0.013, y + 0.48, y + 0.97, colors.darkWood);
    }
  }
  if (lod === 0) return;
  const columns = [0, 27, 45, 76][lod];
  for (const [i, v] of directions(columns).entries()) {
    const p = radius(outline, v);
    const q = radius(outline, vector(((i + 0.56) * fullTurn) / columns));
    beam(
      out,
      'steel',
      at(scale(p, 0.906), 30.66),
      at(scale(q, 0.978), topY - 1.9),
      0.91,
      0.91,
      colors.face,
    );
    for (const { y, wall: back } of facadeTiers.slice(0, lod === 1 ? 1 : 3)) {
      const r = scale(p, back + 0.04);
      beam(
        out,
        'steel',
        at(r, y + 0.27),
        at(r, y + 6.36),
        lod === 1 ? 0.72 : 0.55,
        0.7,
        colors.face,
      );
    }
    if (lod > 1 && i % 2 === 0)
      beam(
        out,
        'steel',
        at(scale(q, 0.909), 30.66),
        at(scale(p, 0.973), topY - 2.1),
        0.66,
        0.7,
        colors.silver,
      );
  }
  if (lod < 2) return;
  for (const [index, v] of directions(lod === 3 ? 120 : 41).entries()) {
    const r = radius(outline, v);
    for (let i = 1; i < facadeTiers.length; i++) {
      const { y, lip } = facadeTiers[i];
      if (i === 3 && index % 4 === 0) continue;
      const center = scale(r, lip - 0.031 - 0.005 * (index % 3));
      const h = 0.63 + ((index * 13 + i * 7) % 17) * 0.081;
      loft(
        out,
        'leaf',
        [
          radialRing(y + 0.46, 1.32, 0.89, 5, center),
          radialRing(y + h, 1.63, 1.11, 5, center),
          radialRing(y + h + 0.68, 0.44, 0.54, 5, center),
        ],
        index % 5 === 2 ? colors.shadeLeaf : colors.leaf,
      );
    }
  }
}

const roofOutsideY = ([, z]) => topY - 1.78 + 1.63 * (1 - Math.max(-1, Math.min(1, z / 177))) * 0.5;
const roofInsideY = ([, z]) => topY - 4.93 + 0.75 * (1 - Math.max(-1, Math.min(1, z / 89))) * 0.5;
function canopy(out, outside, inside, lod) {
  const y1 = roofOutsideY;
  const y0 = roofInsideY;
  const mid = outside.map((p, i) => between(inside[i], p, 0.56));
  const middleY = (p) => topY - 2.37 - (0.25 * p[1]) / 131;
  band(out, 'canopy', outside, mid, y1, middleY, colors.canopy, () => up);
  band(out, 'canopy', mid, inside, middleY, y0, colors.canopyDark, () => up);
  band(
    out,
    'timber',
    outside,
    inside,
    (p) => y1(p) - 1.05,
    (p) => y0(p) - 0.94,
    colors.darkWood,
    () => [0, -1, 0],
  );
  band(out, 'steel', outside, outside, (p) => y1(p) - 1.05, y1, colors.silver, radial);
  band(
    out,
    'steel',
    inside,
    inside,
    (p) => y0(p) - 0.94,
    y0,
    colors.shadow,
    (p) => radial(scale(p, -1)),
  );
  if (lod === 0) return;
  for (const v of directions([0, 22, 100, 252][lod])) {
    const a = radius(outline, v);
    const b = radius(aperture, v);
    const end = between(a, b, lod < 2 ? 0.19 : 0.48);
    const y = mix(y1(a), y0(b), lod < 2 ? 0.19 : 0.48) - 1.13;
    beam(
      out,
      'timber',
      at(a, y1(a) - 1.09),
      at(end, y),
      lod < 2 ? 0.36 : 0.27,
      0.19,
      colors.lighterWood,
    );
  }
}

function concourse(out, lod) {
  for (const [a, b, c, d] of [
    [-104, 87, -85, 125],
    [44, 137, 76, 158],
    [-38, -157, -9, -138],
  ]) {
    const low = grade([(a + c) * 0.5, (b + d) * 0.5]) - 1.1;
    const y = Math.max(low + 1.9, 3.6);
    abox(out, 'concrete', [a, low, b], [c, y, d], colors.concrete, { bottom: false });
    if (lod > 0) {
      const width = c - a;
      for (let i = 0; i < 9; i++) {
        const z = d + i * 0.37;
        abox(
          out,
          'concrete',
          [a + width * 0.11, low, z],
          [c - width * 0.11, mix(y, low + 0.17, i / 9), z + 0.39],
          colors.face,
          { bottom: false },
        );
      }
    }
  }
}

function build(out, lod) {
  const dirs = directions([18, 26, 58, 112][lod]);
  const outside = dirs.map((v) => radius(outline, v));
  const inside = dirs.map((v) => radius(aperture, v));
  cap(out, 'concrete', scaleRing(outside, 0.886), fieldY - 0.31, colors.apron);
  drawField(out, dirs, lod);
  bowl(out, outside, dirs, lod);
  exterior(out, outside, lod);
  canopy(out, outside, inside, lod);
  concourse(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'japan-national-stadium-model.mjs';
const camera = [351, 158, 390];
const lookAt = [0, 18, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Tokyo stadium with a pale open roof, planted timber galleries, inclined white supports, and a nine-lane track around the pitch.',
  surfaces,
  build: closeup,
  limitations: plan.limitations,
  camera,
  lookAt,
  sunDirection: [-95, 124, 147],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.91,
    basis: 'Native perimeter of the built stadium.',
  },
  groundCutout: {
    outline: directions(72).map((v) => scale(radius(outline, v), 0.854)),
    minHeight: fieldY - 0.65,
    basis:
      'The bowl and continuous model-owned floor cover the bounded interior opening. Original terrain remains on the external concourses.',
  },
  embeddedCanonicalGraphs: ['metal_standing_seam', 'concrete_plain', 'wood_plain'],
  recipeDependencies: [
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
    'authored-structure-mesh.mjs',
    'place-recipe-kit.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'gate-c-lattices-and-terraces', position: [-212, 10, 244], lookAt: [-75, 23, 79] },
    { name: 'open-roof-and-track', position: [193, 341, -102], lookAt: [11, 14, 3] },
    { name: 'field-and-three-seating-decks', position: [32, 33, 67], lookAt: [-35, 16, -65] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'tokyo-stadium-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 3.65,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.65, surfaces },
      street: { export: 'street', errorMeters: 0.64, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.23, surfaces },
    },
  },
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. DEM5A terrain from the Geospatial Information Authority of Japan.',
};
