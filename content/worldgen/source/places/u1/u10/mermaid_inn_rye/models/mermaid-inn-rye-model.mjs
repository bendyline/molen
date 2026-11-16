/** Street wings, courtyard and timber arch of the Mermaid Inn at Rye. */
import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (n) => JSON.parse(readFileSync(new URL(`../${n}.json`, import.meta.url)));
const plan = read('plan-controls');
const [outline] = read('map-frame').geometry.polygons;
const [dx, dz] = outline[8].map((v, i) => v - outline[9][i]),
  angle = Math.atan2(dz, dx);
const c = Math.cos(angle),
  s = Math.sin(angle),
  at = (x, y, z) => [c * x - s * z, y, s * x + c * z];
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.95, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.92, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.98, metallic: 0 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.68, metallic: 0.07 },
};
const t = Object.fromEntries(
  Object.entries({
    white: 'dbd4c3',
    black: '363430',
    roof: '726044',
    edge: '544a38',
    masonry: '9b917a',
    brown: '96715a',
    pipe: '80594b',
    dark: '414640',
    glass: '606359',
    path: '99978b',
  }).map(([n, h]) => [n, rgb(h)]),
);
const solid = (out, slot, [a, b, c, d], y, h, color) => box(out, slot, [a, y, c], [b, h, d], color);
const mix = (a, b, u) => a + (b - a) * u;

function panel(out, a, b, base, high, levels, lod, windows = true, foundation = true) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const normal = [(b[1] - a[1]) / len, 0, (a[0] - b[0]) / len];
  const p = (u, y, d = 0) => [
    mix(a[0], b[0], u) + normal[0] * d,
    y,
    mix(a[1], b[1], u) + normal[2] * d,
  ];
  const field = (slot, f, g, y, z, d, color) =>
    face(out, slot, [p(f, y, d), p(f, z, d), p(g, z, d), p(g, y, d)], color);
  if (foundation) field('base', 0, 1, base - 2.8, base + 0.36, 0, t.masonry);
  field('plaster', 0, 1, base + 0.35, high, 0, t.white);
  for (const y of levels.slice(lod ? 0 : 1)) field('timber', 0, 1, y, y + 0.19, 0.043, t.black);
  const count = Math.ceil(len / (lod === 0 ? 6.7 : lod === 1 ? 1.18 : lod === 2 ? 0.85 : 0.62));
  for (let i = 0; i <= count; i++) {
    const u = i / count,
      w = (i === 0 || i === count ? 0.102 : 0.071) / len;
    field('timber', u - w, u + w, base + 0.35, high, 0.063, t.black);
  }
  if (!windows) return;
  for (let floor = 1; floor < levels.length; floor++) {
    const y = levels[floor - 1] + 0.75,
      z = levels[floor] - 0.38,
      num = Math.max(1, Math.round(len / 3.1));
    for (let i = 0; i < num; i++) {
      const u = (i + 0.5) / num,
        w = 0.32 / num;
      field('timber', u - w, u + w, y, z, 0.079, t.black);
      field('glazing', u - w + 0.06 / len, u + w - 0.06 / len, y + 0.06, z - 0.06, 0.105, t.glass);
      if (lod) {
        for (const q of lod === 1 ? [0.5] : [0.25, 0.5, 0.75]) {
          const x = mix(u - w, u + w, q),
            d = 0.016 / len;
          field('timber', x - d, x + d, y, z, 0.119, t.black);
        }
        if (lod > 1)
          field('timber', u - w, u + w, mix(y, z, 0.63), mix(y, z, 0.63) + 0.028, 0.121, t.black);
      }
    }
  }
}
function hipped(out, [x0, x1, z0, z1], base, top, alongX) {
  const e = 0.25;
  const p = [
    [x0 - e, base, z0 - e],
    [x0 - e, base, z1 + e],
    [x1 + e, base, z1 + e],
    [x1 + e, base, z0 - e],
  ];
  const x = (x0 + x1) / 2,
    z = (z0 + z1) / 2;
  const insetX = Math.min(1.3, (x1 - x0) * 0.32);
  const insetZ = Math.min(1.3, (z1 - z0) * 0.32);
  const [a, b] = alongX
    ? [
        [x0 + insetX, top, z],
        [x1 - insetX, top, z],
      ]
    : [
        [x, top, z0 + insetZ],
        [x, top, z1 - insetZ],
      ];
  const surfaces = alongX
    ? [
        [p[0], p[1], a],
        [p[1], p[2], b, a],
        [p[2], p[3], b],
        [p[3], p[0], a, b],
      ]
    : [
        [p[0], p[1], b, a],
        [p[1], p[2], b],
        [p[2], p[3], a, b],
        [p[3], p[0], a],
      ];
  for (const q of surfaces) (q.length === 3 ? triangle : face)(out, 'tile', q, t.roof);
  beam(out, 'tile', a, b, 0.12, 0.115, t.edge);
}

function stack(out, x, z, base, high, lod) {
  solid(out, 'brick', [x - 0.39, x + 0.38, z - 0.3, z + 0.31], base, high, t.brown);
  solid(out, 'brick', [x - 0.45, x + 0.44, z - 0.37, z + 0.38], high - 0.13, high + 0.04, t.pipe);
  if (lod > 0)
    solid(out, 'brick', [x - 0.14, x + 0.14, z - 0.15, z + 0.18], high + 0.04, high + 0.43, t.pipe);
}
function range(out, [x0, x1, z0, z1], ground, eave, crest, alongX, lod) {
  const floor = ground + 2.72;
  const ring = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  const upper = ring.map(([x, z], i) => [
    x + (i === 0 || i === 3 ? -0.08 : 0.08),
    z + (i < 2 ? -0.05 : 0.23),
  ]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    panel(
      out,
      ring[i],
      ring[j],
      ground,
      floor,
      [ground + 0.35, floor - 0.16],
      lod,
      i !== 0 && (lod > 0 || i === 2),
    );
    panel(
      out,
      upper[i],
      upper[j],
      floor - 0.24,
      eave,
      [floor - 0.16, eave - 0.2],
      lod,
      i !== 0 && (lod > 0 || i === 2),
      false,
    );
  }
  hipped(out, [x0 - 0.08, x1 + 0.08, z0 - 0.05, z1 + 0.23], eave, crest, alongX);
}
function courtyard(out, lod) {
  const z = plan.section.rearBridge;
  const y = 3.59,
    eave = 6.46;
  for (const dz of [-0.82, 0.91]) {
    const a = [3.18, z + dz],
      b = [7.19, z + dz];
    panel(out, dz > 0 ? b : a, dz > 0 ? a : b, y, eave, [y + 0.05, eave - 0.16], lod, true, false);
    for (const side of [-1, 1]) {
      const x = 5.2 + side * 1.9;
      solid(out, 'timber', [x - 0.15, x + 0.15, z + dz - 0.11, z + dz + 0.11], 0.53, y, t.black);
      const chain = [
        [x, 2.03, z + dz],
        [5.2 + side * 1.32, 2.97, z + dz],
        [5.2 + side * 0.64, 3.47, z + dz],
        [5.2, 3.61, z + dz],
      ];
      const beams = lod ? chain : [chain[0], chain.at(-1)];
      for (let i = 1; i < beams.length; i++)
        beam(out, 'timber', beams[i - 1], beams[i], 0.2, 0.21, t.black);
    }
  }
  hipped(out, [2.8, 7.58, z - 1.12, z + 1.09], eave, 8.42, true);
  const front = plan.section.streetEdge;
  solid(out, 'base', [3.3, 7.17, z + 0.94, front + 0.25], -0.69, 0.37, t.path);
  if (lod > 0) solid(out, 'base', [4.69, 5.5, z + 0.93, front + 0.27], 0.36, 0.41, t.masonry);
}
function streetEntry(out, lod) {
  if (lod === 0) return;
  const z = plan.section.streetEdge;
  solid(out, 'timber', [9.01, 10.54, z + 0.075, z + 0.18], 0.52, 2.98, t.black);
  solid(out, 'glazing', [9.2, 10.35, z + 0.17, z + 0.205], 0.56, 2.73, t.dark);
  for (let i = 0; i < 3; i++) {
    const start = z + 0.15 + i * 0.31;
    solid(out, 'brick', [8.83, 10.7, start, start + 0.34], -0.75, 0.52 - i * 0.13, t.brown);
  }
  solid(out, 'timber', [6.65, 7.05, -0.12, z + 0.09], 1.37, 2.64, t.black);
  solid(out, 'glazing', [6.613, 6.663, 0.0, z + 0.05], 1.57, 2.43, t.glass);
  for (let i = 1; i < 6; i++) {
    const at = (z * i) / 6;
    solid(out, 'timber', [6.6, 6.657, at - 0.014, at + 0.014], 1.57, 2.43, t.black);
  }
}

function build(out, lod) {
  const m = transform(out, -angle);
  const street = plan.section.streetEdge;
  range(m, [-6.42, 3.55, -10.8, street], -0.28, 5.45, 9.08, false, lod);
  range(m, [6.97, 19.14, -14.2, street], 0.48, 6.23, 9.74, false, lod);
  range(m, [1.13, 19.31, -19.17, -13.48], 0.57, 5.73, 8.48, true, lod);
  range(m, [19.05, 33.91, -8.34, 1.68], 1.28, 6.46, 9.32, true, lod);
  courtyard(m, lod);
  streetEntry(m, lod);
  stack(m, -4.91, -4.55, 7.35, 10.38, lod);
  stack(m, 2.18, -10.15, 7.3, 10.27, lod);
  stack(m, 15.3, -1.91, 7.54, 11.23, lod);
  stack(m, 27.8, -5.87, 7.6, 10.42, lod);
  if (lod) {
    const dormer = [9.31, 11.65, 0.87, 2.34];
    solid(m, 'timber', dormer, 6.97, 8.38, t.black);
    solid(m, 'glazing', [9.55, 11.39, 2.32, 2.4], 7.17, 8.19, t.glass);
    hipped(m, dormer, 8.38, 8.9, true);
  }
}
export const innSkyline = (out) => build(out, 0);
export const innDistrict = (out) => build(out, 1);
export const innStreet = (out) => build(out, 2);
export const innCloseup = (out) => build(out, 3);
const camera = at(18, 19, 44),
  lookAt = at(8, 4, -5),
  recipe = 'mermaid-inn-rye-model.mjs';
export const innModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'structure-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: innCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Mermaid Inn’s black and white timber wings, clay-tile roofs, brick chimneys and cobbled courtyard on Mermaid Street.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: at(-29, 42, 40),
  portableGroundY: -0.5,
  mediumFiContext: {
    scale: 0.95,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: [
      [-7, -9],
      [24, -14],
      [32, -5],
      [17, 5],
      [-7, 5],
    ].map(([x, z]) => {
      const [a, , b] = at(x, 0, z);
      return [a, b];
    }),
    minimumCoverage: 0.82,
    basis: 'Approximate occupied eastern part of the wider mapped Mermaid Street row.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'wood_plain', 'brick', 'tile_flat', 'stone_limestone'],
  qaCameras: [
    {
      name: 'street-fronts-and-jettied-upper-storeys',
      position: at(24, 8, 26),
      lookAt: at(5, 4, 0),
    },
    {
      name: 'courtyard-arch-and-timber-studs',
      position: at(5.21, 2.1, 12),
      lookAt: at(5.19, 2.95, -6.6),
    },
    { name: 'hipped-roofs-and-brick-chimneys', position: at(-25, 39, -28), lookAt: at(13, 4, -6) },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `rye-inn-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'innSkyline',
    errorMeters: 0.51,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'innDistrict', 0.27],
        ['street', 'innStreet', 0.09],
        ['closeup', 'innCloseup', 0.043],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap data is ODbL. The exact Qualla image and two independently verified exterior photographs are CC0.',
};
