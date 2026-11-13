import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { section } = plan;
const [outline] = read('map-frame').geometry.polygons;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.93, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.92, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.69, metallic: 0.36 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  glazing: { slot: 'window', localRef: 'palette:#fffdfe', roughness: 0.68, metallic: 0.04 },
};
const color = Object.fromEntries(
  Object.entries({
    brick: 'c17d6c',
    stone: 'dfd9cb',
    plinth: 'a29e93',
    shade: 'c1bbaa',
    copper: '739488',
    copperDark: '4d6e63',
    tile: 'a66459',
    glass: '3f5154',
    door: '64534c',
    mullion: 'a5aaa0',
  }).map(([key, value]) => [key, rgb(value)]),
);
const white = 'palette:#ffffff';
const up = [0, 1, 0];

function face(out, slot, points, facing, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, n, i) => dot + n * facing[i], 0) < 0) {
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
        [0.5, 1],
      ],
      tint,
    );
}

function ringEdges(ring) {
  const area = ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
  const sign = Math.sign(area);
  return ring.map(([x, z], i) => {
    const q = ring[(i + 1) % ring.length];
    const length = Math.hypot(q[0] - x, q[1] - z);
    const dx = (q[0] - x) / length,
      dz = (q[1] - z) / length;
    const normal = [dz * sign, 0, -dx * sign];
    return {
      length,
      normal,
      at: (u, y, offset = 0) => [
        x + dx * u + normal[0] * offset,
        y,
        z + dz * u + normal[2] * offset,
      ],
    };
  });
}

function panel(out, slot, edge, a, b, low, high, depth, tint) {
  face(
    out,
    slot,
    [
      edge.at(a, low, depth),
      edge.at(b, low, depth),
      edge.at(b, high, depth),
      edge.at(a, high, depth),
    ],
    edge.normal,
    tint,
  );
}

function band(out, slot, edge, low, high, depth, tint) {
  panel(out, slot, edge, 0, edge.length, low, high, depth, tint);
  if (depth < 0.02) return;
  for (const [y, normal] of [
    [low, [0, -1, 0]],
    [high, up],
  ]) {
    face(
      out,
      slot,
      [
        edge.at(0, y),
        edge.at(edge.length, y),
        edge.at(edge.length, y, depth),
        edge.at(0, y, depth),
      ],
      normal,
      tint,
    );
  }
}

function cap(out, ring, y, slot, tint) {
  const roof = new MeshBufferBuilder();
  if (
    !roof.addCap(
      slot,
      white,
      ring,
      [],
      () => y,
      up,
      (point) => point,
      tint,
    )
  ) {
    throw Error('Cannot triangulate the museum roof');
  }
  const { indices, positions } = roof.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (index) =>
      Array.from(positions.slice(index * 3, index * 3 + 3)),
    );
    face(out, slot, points, up, tint);
  }
}

function arch(out, slot, edge, u, half, spring, rise, depth, tint, divisions) {
  const at = (i) => {
    const angle = (Math.PI * i) / divisions;
    return edge.at(u - half * Math.cos(angle), spring + rise * Math.sin(angle), depth);
  };
  for (let i = 0; i < divisions; i++) {
    face(out, slot, [edge.at(u, spring, depth), at(i), at(i + 1)], edge.normal, tint);
  }
}

function window(out, edge, u, y, width, height, lod, archRise = 0, door = false) {
  const half = width / 2;
  if (lod) {
    panel(
      out,
      'stone',
      edge,
      u - half - 0.18,
      u + half + 0.18,
      y - 0.14,
      y + height,
      0.11,
      color.stone,
    );
    panel(
      out,
      'stone',
      edge,
      u - half - 0.26,
      u + half + 0.26,
      y - 0.14,
      y - 0.02,
      0.23,
      color.shade,
    );
    if (archRise)
      arch(out, 'stone', edge, u, half + 0.18, y + height, archRise + 0.14, 0.11, color.stone, 8);
  }
  const depth = lod ? 0.125 : 0.025;
  const tint = door ? color.door : color.glass;
  panel(out, 'glazing', edge, u - half, u + half, y, y + height, depth, tint);
  if (archRise && lod)
    arch(out, 'glazing', edge, u, half, y + height, archRise, depth, tint, lod >= 2 ? 8 : 4);
  if (lod >= 2) {
    panel(out, 'glazing', edge, u - 0.033, u + 0.033, y, y + height, depth + 0.015, color.mullion);
    const rail = y + height * 0.65;
    panel(
      out,
      'glazing',
      edge,
      u - half,
      u + half,
      rail - 0.035,
      rail + 0.035,
      depth + 0.015,
      color.mullion,
    );
  }
}

function stonePier(out, edge, u, low, high, lod, depth = 0.24, half = 0.24) {
  panel(out, 'stone', edge, u - half, u + half, low, high, depth, color.stone);
  if (lod < 2) return;
  for (const y of [low + 0.18, high - 0.23]) {
    panel(
      out,
      'stone',
      edge,
      u - half - 0.07,
      u + half + 0.07,
      y,
      y + 0.17,
      depth + 0.045,
      color.shade,
    );
  }
}

function historicWalls(out, lod) {
  const ring = outline.slice(11, 27);
  for (const [i, edge] of ringEdges(ring).entries()) {
    if (i === ring.length - 1) continue;
    const { length } = edge;
    band(out, 'stone', edge, section.foundation, section.sillCourse, 0, color.plinth);
    band(out, 'stone', edge, section.sillCourse, section.floorBreak, 0, color.stone);
    band(out, 'brick', edge, section.floorBreak, section.eaves, 0, color.brick);
    band(out, 'stone', edge, 5.2, 5.56, lod ? 0.115 : 0.012, color.stone);
    band(out, 'stone', edge, 9.95, section.eaves, lod ? 0.26 : 0.012, color.stone);
    if (i === 7) {
      entrance(out, edge, lod);
      continue;
    }
    if (length < 5) continue;
    const count = Math.max(1, Math.round(length / 3.85));
    const spacing = length / count;
    for (let j = 0; j < count; j++) {
      const u = (j + 0.5) * spacing;
      window(out, edge, u, 1.76, 1.34, 2.08, lod, 0.37);
      window(out, edge, u, 6.24, 1.36, 2.55, lod);
      if (lod && j > 0) stonePier(out, edge, j * spacing, 5.56, 9.95, lod);
      if (lod >= 2) panel(out, 'stone', edge, u - 0.13, u + 0.13, 4.23, 4.61, 0.158, color.shade);
    }
    if (lod >= 2) {
      for (let y = 1.26; y < 5.17; y += 0.48) {
        panel(out, 'stone', edge, 0, length, y, y + 0.046, 0.017, color.shade);
      }
    }
  }
  cap(out, ring, section.eaves, 'copper', color.copperDark);
}

function entrance(out, edge, lod) {
  const u = edge.length / 2;
  window(out, edge, u, 0.62, 3.18, 3.85, lod, 1.04, true);
  window(out, edge, u, 6.28, 1.72, 2.26, lod, 0.33);
  for (const x of [u - 2.62, u + 2.62]) {
    stonePier(out, edge, x, 0.62, 5.44, lod, 0.32, 0.43);
    stonePier(out, edge, x, 5.55, 10.11, lod, 0.25, 0.38);
  }
  const a = edge.at(0.14, 10.47, 0.14);
  const b = edge.at(edge.length - 0.14, 10.47, 0.14);
  const peak = edge.at(u, 12.42, 0.14);
  face(out, 'stone', [a, b, peak], edge.normal, color.stone);
  const rear = edge.at(u, 12.42, -2.65);
  const left = edge.at(0.14, 10.47, -2.65),
    right = edge.at(edge.length - 0.14, 10.47, -2.65);
  face(out, 'copper', [a, peak, rear, left], up, color.copper);
  face(out, 'copper', [peak, b, right, rear], up, color.copper);
  face(
    out,
    'stone',
    [left, right, rear],
    edge.normal.map((n) => -n),
    color.stone,
  );
  if (lod) {
    for (const end of [a, b]) beam(out, 'stone', end, peak, 0.2, 0.21, color.shade);
  }
  for (let i = 0; i < 3; i++) {
    const y = 0.22 * i,
      distance = 1.1 - i * 0.3;
    const x1 = u - 2.43,
      x2 = u + 2.43;
    panel(out, 'stone', edge, x1, x2, i ? y : -0.35, y + 0.22, distance, color.plinth);
    face(
      out,
      'stone',
      [
        edge.at(x1, y + 0.22, distance),
        edge.at(x2, y + 0.22, distance),
        edge.at(x2, y + 0.22, distance - 0.3),
        edge.at(x1, y + 0.22, distance - 0.3),
      ],
      up,
      color.stone,
    );
    for (const [x, side] of [
      [x1, -1],
      [x2, 1],
    ]) {
      const n = [edge.normal[2] * -side, 0, edge.normal[0] * side];
      face(
        out,
        'stone',
        [
          edge.at(x, i ? y : -0.35, 0),
          edge.at(x, i ? y : -0.35, distance),
          edge.at(x, y + 0.22, distance),
          edge.at(x, y + 0.22, 0),
        ],
        n,
        color.plinth,
      );
    }
  }
}

function circle([x, z], radius, count) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count;
    return [x + radius * Math.cos(angle), z + radius * Math.sin(angle)];
  });
}

function joinRings(out, slot, low, high, from, to, tint, outward = false) {
  const outside = ringEdges(low);
  for (let i = 0; i < low.length; i++) {
    const j = (i + 1) % low.length;
    const at = ([x, z], y) => [x, y, z];
    face(
      out,
      slot,
      [at(low[i], from), at(low[j], from), at(high[j], to), at(high[i], to)],
      outward ? outside[i].normal : up,
      tint,
    );
  }
}

function tower(out, center, lod) {
  const r = section.towerRadius,
    count = [12, 16, 24, 32][lod];
  const ring = circle(center, r, count);
  const cornice = section.towerCornice;
  for (const [i, edge] of ringEdges(ring).entries()) {
    band(out, 'stone', edge, section.foundation, 1.06, 0, color.plinth);
    band(out, 'stone', edge, 1.06, 5.61, 0, color.stone);
    band(out, 'brick', edge, 5.61, 9.25, 0, color.brick);
    band(out, 'stone', edge, 9.25, cornice, 0, color.stone);
    if (lod) {
      band(out, 'stone', edge, 5.27, 5.71, 0.17, color.shade);
      band(out, 'stone', edge, 12.83, cornice, 0.25, color.stone);
    }
    const stride = count / [4, 4, 6, 8][lod];
    if (i % stride) continue;
    window(out, edge, edge.length * 0.5, 1.74, Math.min(edge.length * 0.78, 1.18), 2.74, lod);
    window(out, edge, edge.length * 0.5, 6.02, Math.min(edge.length * 0.78, 1.18), 2.52, lod);
    window(out, edge, edge.length * 0.5, 10.33, Math.min(edge.length * 0.7, 0.92), 1.22, lod, 0.32);
  }
  const profile = lod
    ? [
        [0, 1.04],
        [0.18, 1.03],
        [0.47, 0.91],
        [0.74, 0.7],
        [0.93, 0.43],
        [1, 0.11],
      ]
    : [
        [0, 1.04],
        [0.47, 0.91],
        [0.81, 0.62],
        [1, 0.11],
      ];
  for (let i = 1; i < profile.length; i++) {
    const [a, ra] = profile[i - 1],
      [b, rb] = profile[i];
    joinRings(
      out,
      'copper',
      circle(center, r * ra, count),
      circle(center, r * rb, count),
      cornice + a * section.domeRise,
      cornice + b * section.domeRise,
      color.copper,
      true,
    );
  }
  cap(out, circle(center, r * 0.11, count), cornice + section.domeRise, 'copper', color.copperDark);
}

function inset(ring, fraction) {
  const center = [0, 1].map((axis) => ring.reduce((sum, p) => sum + p[axis], 0) / ring.length);
  return ring.map((p) => p.map((n, i) => n + (center[i] - n) * fraction));
}

function mansards(out, lod) {
  for (const ring of section.historicRoofSections) {
    const breakRing = inset(ring, 0.38),
      ridge = inset(ring, 0.71);
    joinRings(out, 'copper', ring, breakRing, section.eaves + 0.006, 13.46, color.copper);
    joinRings(out, 'copper', breakRing, ridge, 13.46, 14.36, color.copper);
    cap(out, ridge, 14.36, 'copper', color.copperDark);
  }
  if (!lod) return;
  const edges = ringEdges(outline);
  for (const index of [11, 16, 25]) {
    const eave = edges[index];
    const edge = { ...eave, at: (u, y, depth = 0) => eave.at(u, y, depth - 1.23) };
    const count = Math.max(1, Math.round(edge.length / 8));
    for (let i = 0; i < count; i++) {
      const u = (edge.length * (i + 0.5)) / count;
      const y = 10.58;
      panel(out, 'stone', edge, u - 0.65, u + 0.65, y, y + 1.71, 0, color.stone);
      window(out, edge, u, y + 0.64, 0.7, 0.65, 0, 0.23);
      const a = edge.at(u - 0.72, y + 1.71);
      const b = edge.at(u + 0.72, y + 1.71);
      const tip = edge.at(u, y + 2.3);
      const back = edge.at(u, y + 2.3, -2.45);
      face(out, 'stone', [a, b, tip], edge.normal, color.shade);
      for (const [side, base, sign] of [
        [a, u - 0.72, -1],
        [b, u + 0.72, 1],
      ]) {
        const inner = edge.at(base, y + 1.71, -2.45);
        face(
          out,
          'stone',
          [edge.at(base, y), side, inner, edge.at(base, y, -2.45)],
          [-edge.normal[2] * sign, 0, edge.normal[0] * sign],
          color.shade,
        );
        face(out, 'copper', [side, tip, back, inner], up, color.copper);
      }
    }
  }
}

function rear(out, lod) {
  const ring = [...outline.slice(26), ...outline.slice(0, 12)];
  for (const [i, edge] of ringEdges(ring).entries()) {
    if (i === ring.length - 1) continue;
    band(out, 'stone', edge, section.foundation, 1.05, 0, color.plinth);
    band(out, 'brick', edge, 1.05, 9.84, 0, color.brick);
    band(out, 'stone', edge, 9.5, 9.84, lod ? 0.12 : 0.012, color.shade);
    if (edge.length < 7) continue;
    const count = Math.round(edge.length / 4.9);
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * edge.length) / count;
      window(out, edge, u, 4.78, 1.35, 2.78, lod);
    }
  }
  cap(out, ring, 9.84, 'tile', color.tile);
  const high = section.rearRaisedVolume,
    ridge = inset(high, 0.67);
  for (const edge of ringEdges(high)) {
    band(out, 'brick', edge, 9.81, 13.03, 0, color.brick);
    band(out, 'stone', edge, 12.77, 13.03, lod ? 0.12 : 0.012, color.shade);
  }
  joinRings(out, 'tile', high, ridge, 13.03, 15.23, color.tile);
  cap(out, ridge, 15.23, 'tile', color.tile);
}

function build(out, lod) {
  historicWalls(out, lod);
  mansards(out, lod);
  rear(out, lod);
  for (const center of section.towerCenters) tower(out, center, lod);
}

export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);

const recipe = 'taiwan-literature-model.mjs';
const camera = [61, 36, -108],
  lookAt = [0, 8, -4];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'museumDistrict', 0.31],
    ['street', 'museumStreet', 0.13],
    ['closeup', 'museumCloseup', 0.046],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const taiwanLiteratureModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'museum',
  recipe,
  surfaces,
  build: museumCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The former Tainan Prefecture Hall in June 2025, with paired copper-domed towers, rusticated masonry and red brick, copper mansards, and the attached museum expansion.',
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
    minimumCoverage: 0.88,
    basis: 'Mapped whole museum outline from OpenStreetMap way 161025892.',
  },
  mediumFiContext: {
    scale: 0.83,
    groundY: 0,
    terrain: {
      descriptor: 'terrain-review.terrain.json',
      heightmap: 'terrain-review.height.png',
    },
  },
  embeddedCanonicalGraphs: ['brick_flemish', 'stone_limestone', 'metal_copper', 'tile_ceramic'],
  qaCameras: [
    { name: 'roundabout-entrance-and-copper-towers', position: [4, 11, -77], lookAt: [0, 8, -24] },
    {
      name: 'northwest-rustication-and-domed-tower',
      position: [-64, 12, -32],
      lookAt: [-24, 8, -16],
    },
    { name: 'mansards-and-rear-expansion', position: [66, 37, 60], lookAt: [5, 9, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-tainan-literature-museum-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.68,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap ODbL 1.0 and exact Lchung9779 CC0 exterior reference.',
};
