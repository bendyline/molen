import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  abox,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.79, metallic: 0.31 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.92 },
  canal: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.39 },
};

const stone = rgb('a1977e');
const mortar = rgb('918771');
const greyIron = rgb('4f5957');
const edgeIron = rgb('5c6661');
const paving = rgb('9e9b8b');
const water = rgb('466a63');
const west = -1.32;
const east = 2.11;
const pathEdge = 0.89;
const [south, north] = site.deckLimits;
const angle = (-site.planAngleDegrees * Math.PI) / 180;
const { spanStart, spanPitch, piers } = site;
const spanEnd = spanStart + 19 * spanPitch;
const spring = -4.88;
const soffit = -1.16;

function box(out, slot, x0, x1, y0, y1, z0, z1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color);
}

function pierSection(station, y, length, width) {
  return [
    [station - length / 2, y, 0.32 - width / 2],
    [station - length / 2, y, 0.32 + width / 2],
    [station + length / 2, y, 0.32 + width / 2],
    [station + length / 2, y, 0.32 - width / 2],
  ];
}

function masonry(out, detail) {
  for (const { station, foot, inRiver } of piers) {
    const base = pierSection(station, foot, 3.85, 4.38);
    const neck = pierSection(station, detail === 0 ? soffit + 0.02 : spring - 0.22, 2.57, 3.28);
    loft(out, 'masonry', [base, neck], stone);
    if (detail > 0) {
      loft(out, 'masonry', [neck, pierSection(station, spring, 2.82, 3.58)], mortar);
      box(out, 'masonry', station - 1.19, station + 1.19, spring - 0.01, -0.72, -1.33, 1.97, stone);
      if (inRiver) cutwaters(out, station, foot);
    }
  }
  for (const [edge, joint, bottom] of [
    [south, spanStart + 1.13, piers[0].foot + 0.86],
    [spanEnd - 1.13, north, piers.at(-1).foot + 0.86],
  ]) {
    box(out, 'masonry', edge, joint, bottom, -0.54, -1.7, 2.36, stone);
    if (detail > 0) box(out, 'masonry', edge, joint, -0.66, -0.14, -1.83, 2.49, mortar);
  }
}

function arches(out, detail) {
  const segments = [4, 6, 11, 16][detail];
  const ribs =
    detail === 0
      ? [[west, east]]
      : detail === 1
        ? [
            [west, -0.93],
            [1.7, east],
          ]
        : [
            [west, -1.08],
            [-0.45, -0.27],
            [0.66, 0.84],
            [1.87, east],
          ];
  for (let i = 0; i < 19; i++) {
    const start = spanStart + spanPitch * i + 1.12;
    const end = start + spanPitch - 2.24;
    const profile = Array.from({ length: segments + 1 }, (_, j) => {
      const t = j / segments;
      return [start + (end - start) * t, spring + 3.28 * Math.sin(t * Math.PI)];
    });
    for (const [z0, z1] of ribs) {
      const rings = profile.map(([x, y]) => [
        [x, y, z0],
        [x, soffit, z0],
        [x, soffit, z1],
        [x, y, z1],
      ]);
      loft(out, 'iron', rings, greyIron);
    }
    if (detail < 2) continue;
    for (const t of [0.19, 0.39, 0.61, 0.81]) {
      const x = start + (end - start) * t;
      const y = spring + 3.28 * Math.sin(t * Math.PI) + 0.11;
      beam(out, 'iron', [x, y, -1.28], [x, y, 2.0], 0.135, 0.14, edgeIron);
      if (detail === 3) {
        beam(out, 'iron', [x, y, -1.16], [x + 0.8, soffit, 1.94], 0.079, 0.072, greyIron);
        beam(out, 'iron', [x, y, 1.94], [x + 0.8, soffit, -1.16], 0.079, 0.072, greyIron);
      }
    }
  }
}

function deck(out, detail) {
  box(out, 'iron', south, north, soffit - 0.003, -0.89, west, east, greyIron);
  box(out, 'iron', south, north, -0.9, 0.18, west, west + 0.1, greyIron);
  box(out, 'iron', south, north, -0.9, 0.24, east - 0.11, east, greyIron);
  box(out, 'paving', south, north, -0.13, 0.11, pathEdge, east - 0.1, paving);
  quad4(
    out,
    'canal',
    [south, -0.132, west + 0.099],
    [south, -0.132, pathEdge + 0.005],
    [north, -0.132, pathEdge + 0.005],
    [north, -0.132, west + 0.099],
    water,
  );
  if (detail === 0) return;
  box(out, 'iron', south, north, 1.15, 1.24, east - 0.12, east - 0.012, edgeIron);
  const step = [0, 5.1, 0.82, 0.285][detail];
  const posts = Math.floor((north - south) / step);
  for (let i = 0; i <= posts; i++) {
    const x = south + 0.08 + ((north - south - 0.16) * i) / posts;
    const heavy = i % (detail === 3 ? 9 : 7) === 0;
    const r = heavy ? 0.039 : 0.021;
    box(out, 'iron', x - r, x + r, 0.17, 1.18, east - 0.078 - r, east - 0.078 + r, edgeIron);
  }
  if (detail < 2) return;
  const joints = Math.floor((north - south) / 1.72);
  for (let i = 1; i < joints; i++) {
    const x = south + ((north - south) * i) / joints;
    box(out, 'iron', x - 0.023, x + 0.023, -0.91, 0.175, west - 0.018, west + 0.001, edgeIron);
    if (detail === 3) {
      for (const y of [-0.74, -0.43, -0.12, 0.13]) {
        box(
          out,
          'iron',
          x - 0.042,
          x + 0.042,
          y - 0.025,
          y + 0.025,
          west - 0.034,
          west - 0.017,
          greyIron,
        );
      }
    }
  }
}

function cutwaters(out, station, bottom) {
  const points = (y, span, width) =>
    [
      [station - span / 2, y, 0.32 - width * 0.43],
      [station, y, 0.32 - width / 2],
      [station + span / 2, y, 0.32 - width * 0.43],
      [station + span / 2, y, 0.32 + width * 0.43],
      [station, y, 0.32 + width / 2],
      [station - span / 2, y, 0.32 + width * 0.43],
    ].reverse();
  const level = site.riverElevation - site.terrainDatum;
  loft(
    out,
    'masonry',
    [points(bottom, 4, 6.9), points(level + 1.9, 3.67, 5.7), points(level + 2.9, 3.54, 4.25)],
    stone,
  );
}

function build(out, detail) {
  const m = transform(out, angle);
  masonry(m, detail);
  arches(m, detail);
  deck(m, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
