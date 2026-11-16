/** The Archive Gallery, public entrance, memorial and visitor buildings in Karachi. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { buildArchiveFront, shallowGalleryRoof } from './archives-gallery.mjs';
import { buildMartyrsMonument, buildPublicEntrance } from './park-entrance-and-monument.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json'),
  frame = read('map-frame.json'),
  terrain = read('terrain-grid.json');
const archive = read('archive-gallery-controls.json');
const { entrance: entranceSection, monument: monumentSection } = plan.section;
const surfaces = {
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.84, metallic: 0.08 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.89, metallic: 0.06 },
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
  glazing: {
    slot: 'trim',
    localRef: 'palette:#ffffff',
    roughness: 0.27,
    metallic: 0.12,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.34],
    doubleSided: true,
  },
};
const tint = Object.fromEntries(
  Object.entries({
    wall: 'ded3b5',
    warm: 'd1bd9a',
    glass: '596f72',
    roof: 'a3a098',
    stone: 'aa9980',
    edge: '9a8060',
    white: 'ded2ba',
    paving: 'aa8f75',
    light: 'c1ab8d',
    recess: '48565a',
  }).map(([name, value]) => [name, rgb(value)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const span = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const xyz = ([x, z], y) => [x, y, z];
const avg = (ring) => [0, 1].map((i) => ring.reduce((sum, p) => sum + p[i], 0) / ring.length);
const area = (ring) =>
  ring.reduce((sum, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return sum + x * b - a * z;
  }, 0);
const outward = (ring) => (area(ring) > 0 ? ring : ring.toReversed());
const at = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const edge = (out, a, b) => transform(out, -Math.atan2(b[1] - a[1], b[0] - a[0]), [a[0], 0, a[1]]);

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const a = Math.floor(u),
    b = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[b][a], h[b][a + 1], u - a), mix(h[b + 1][a], h[b + 1][a + 1], u - a), v - b) -
    terrain.modelDatumElevationMeters
  );
}

function triangulate(ring) {
  const out = new MeshBufferBuilder();
  if (
    !out.addCap(
      'roof',
      'palette:#ffffff',
      ring,
      [],
      () => 0,
      [0, 1, 0],
      (p) => p,
      tint.roof,
    )
  )
    throw Error('Museum polygon triangulation failed');
  const m = out.finalize();
  return Array.from({ length: m.indices.length / 3 }, (_, i) =>
    Array.from(m.indices.slice(i * 3, i * 3 + 3), (j) => [
      m.positions[j * 3],
      m.positions[j * 3 + 2],
    ]),
  ).filter((p) => Math.abs(area(p)) > 1e-5);
}
const published = frame.features.map(({ role, points }) => {
  const ring = outward(points.filter((p, i) => span(p, points.at(i - 1)) > 0.032));
  const square = Math.abs(area(ring)) * 0.5;
  const y = ground(avg(ring));
  return {
    role,
    ring,
    cap: triangulate(ring),
    area: square,
    floor: role === 'archives-gallery' ? archive.floor : y + 0.28,
    height:
      role === 'archives-gallery'
        ? archive.eave
        : role === 'convention-center'
          ? 7.55
          : square > 550
            ? 5.15
            : square > 220
              ? 4.23
              : 3.04,
  };
});

function wallPanel(out, slot, left, right, bottom, top, z, color) {
  face(
    out,
    slot,
    [
      [right, bottom, z],
      [left, bottom, z],
      [left, top, z],
      [right, top, z],
    ],
    color,
  );
}

function windows(out, a, b, hall, lod) {
  const len = span(a, b);
  if (len < 7.1) return;
  const { floor, height, role } = hall;
  const r = edge(out, a, b);
  const count = Math.max(2, Math.round(len / (role === 'archives-gallery' ? 5.9 : 5.1)));
  const factor = role === 'archives-gallery' ? 0.28 : 0.25;
  for (let i = 0; i < count; i++) {
    const x = (len * (i + 0.5)) / count;
    const half = Math.min(0.94, (len * factor) / count);
    const bottom = floor + height * (i % 5 === 3 ? 0.16 : 0.31),
      top = floor + height * 0.74;
    wallPanel(r, 'trim', x - half, x + half, bottom, top, -0.051, tint.glass);
    if (lod > 1) {
      wallPanel(
        r,
        'trim',
        x - half - 0.11,
        x + half + 0.11,
        bottom - 0.105,
        bottom + 0.012,
        -0.074,
        tint.edge,
      );
      wallPanel(r, 'trim', x - 0.034, x + 0.034, bottom, top, -0.086, tint.light);
      if (lod > 2)
        wallPanel(
          r,
          'trim',
          x - half,
          x + half,
          mix(bottom, top, 0.7),
          mix(bottom, top, 0.7) + 0.035,
          -0.093,
          tint.light,
        );
    }
  }
}

function tailRoof(out, controls, lod) {
  const { x, z, width, depth, ridge } = controls;
  const frame = transform(out, 0, [x, archive.floor, z]);
  shallowGalleryRoof(frame, { width, depth, eave: archive.eave, ridge }, lod);
  for (const side of [-1, 1]) {
    if (side < 0 && z < 110) continue;
    const v = (side * depth) / 2;
    const p = [
      [-width / 2, archive.eave, v],
      [width / 2, archive.eave, v],
      [0, ridge, v],
    ];
    triangle(frame, 'wall', side < 0 ? p.toReversed() : p, tint.wall);
  }
}

function building(out, hall, lod) {
  const { ring, cap, floor, height, role } = hall;
  const main = role === 'archives-gallery';
  const tall = floor + height;
  const tintWall = role === 'public-museum-mosque' ? tint.white : main ? tint.wall : tint.warm;
  const ceiling = main ? tall - 0.09 : tall + 0.087;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const low = (p) => Math.min(floor - 0.12, ground(p) - 0.7);
    const front =
      main &&
      Math.abs(a[1] - archive.frontCenter[1]) < 0.06 &&
      Math.abs(b[1] - archive.frontCenter[1]) < 0.06;
    if (front) continue;
    face(out, 'wall', [xyz(b, low(b)), xyz(a, low(a)), xyz(a, tall), xyz(b, tall)], tintWall);
    if (lod > 0 && span(a, b) > 2.8) {
      const r = edge(out, a, b),
        d = span(a, b);
      wallPanel(r, 'stone', 0, d, floor - 0.35, floor + 0.24, -0.032, tint.stone);
      if (!main) wallPanel(r, 'trim', 0, d, tall - 0.24, tall + 0.2, -0.044, tint.edge);
      windows(out, a, b, hall, lod);
    }
  }
  for (const f of cap)
    triangle(
      out,
      'roof',
      f.map((p) => xyz(p, ceiling)),
      tint.roof,
    );
  if (main) for (const bay of archive.roofBays) tailRoof(out, bay, lod);
}

const [gateCenter, monumentCenter] = frame.estimatedLandmarkAnchors.map((f) => f.position);
const entrance = { ...entranceSection, center: gateCenter, floor: ground(gateCenter) + 0.22 };
const monument = {
  ...monumentSection,
  center: monumentCenter,
  floor: ground(monumentCenter) + 0.33,
};

function walkway(out, line, width) {
  for (let i = 1; i < line.length; i++) {
    const from = line[i - 1],
      to = line[i],
      len = span(from, to);
    if (len < 0.16) continue;
    const d = Math.ceil(len / 9.5);
    for (let j = 0; j < d; j++) {
      const a = at(from, to, j / d),
        b = at(from, to, (j + 1) / d);
      const sx = ((b[1] - a[1]) * width * d) / (2 * len),
        sz = ((a[0] - b[0]) * width * d) / (2 * len);
      const P = (p, s) => [p[0] + sx * s, p[1] + sz * s];
      const corners = [P(a, -1), P(b, -1), P(b, 1), P(a, 1)].map((p) => xyz(p, ground(p) + 0.08));
      triangle(out, 'stone', [corners[0], corners[1], corners[2]], tint.paving);
      triangle(out, 'stone', [corners[0], corners[2], corners[3]], tint.paving);
    }
  }
}
function build(out, lod) {
  for (const hall of published)
    if (lod > 0 || hall.area > 180 || hall.role === 'archives-gallery') building(out, hall, lod);
  buildArchiveFront(out, archive, lod);
  buildPublicEntrance(out, entrance, lod);
  buildMartyrsMonument(out, monument, lod);
  if (lod > 1) {
    const paths = frame.geometry.centerlines;
    walkway(out, paths[0], 4.8);
    walkway(out, paths[1], 2.0);
    walkway(out, paths[2], 2.0);
  }
}

export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);
const camera = [315, 211, 396],
  lookAt = [-32, 4, 61];
const recipe = 'pakistan-air-force-museum-model.mjs';
export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: museumCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Pakistan Air Force Museum at Karachi in November 2016, with the glazed Archive Gallery, public entrance, Martyrs’ Monument and mapped visitor buildings.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-33, 57, -54],
  mediumFiContext: {
    scale: 1,
    groundY: -1.4,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_standing_seam', 'plaster_lime', 'metal_painted', 'stone_ashlar'],
  qaCameras: [
    {
      name: 'archive-glazed-gable-and-portico',
      position: [-144, 8.4, 29],
      lookAt: [-117, 5.9, 75],
    },
    {
      name: 'public-gate-and-mounted-jet-sculptures',
      position: [-28, 12, -247],
      lookAt: [11, 8.7, -215],
    },
    { name: 'martyrs-monument-and-archive', position: [-98, 13, 0], lookAt: [-73, 7.8, 49] },
    { name: 'rotated-visitor-grounds', position: [149, 101, 225], lookAt: [-86, 4, 90] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'paf-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.48,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'museumDistrict', 0.25],
        ['street', 'museumStreet', 0.11],
        ['closeup', 'museumCloseup', 0.038],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Used Qualla photographs are explicitly CC0 or author-released public domain. Native OpenStreetMap geometry under ODbL 1.0.',
};
