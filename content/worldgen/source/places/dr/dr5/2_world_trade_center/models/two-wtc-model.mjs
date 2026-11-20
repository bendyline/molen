import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import site from '../site-frame.json' with { type: 'json' };

export const height = 373.6848;
export const surfaces = {
  panes: { slot: 'window', graph: 'window_grid', roughness: 0.34, metallic: 0.06 },
  frame: { slot: 'trim', graph: 'metal_stainless', roughness: 0.49, metallic: 0.2 },
  ceiling: { slot: 'wall', graph: 'stone_limestone', roughness: 0.79, metallic: 0 },
  pavers: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.91, metallic: 0 },
  leaves: { slot: 'roof', localRef: 'palette:#385836', name: 'Terrace planting', roughness: 0.96 },
  tint: {
    slot: 'wall',
    localRef: 'palette:#506c85',
    name: 'Blue curtain wall',
    roughness: 0.3,
    metallic: 0.14,
  },
  clear: {
    slot: 'window',
    localRef: 'palette:#a6cadd',
    name: 'Clear lobby and terrace glass',
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.31],
    roughness: 0.19,
    metallic: 0.04,
    doubleSided: true,
  },
};

const silver = [0.57, 0.65, 0.73];
const polished = [0.75, 0.81, 0.86];
const pavement = [0.45, 0.48, 0.48];
const pale = [0.76, 0.77, 0.72];
const green = [0.22, 0.31, 0.12];
const glass = [0.65, 0.76, 0.86];
const lobbyGlass = [0.7, 0.83, 0.89];
const blue = [0.25, 0.39, 0.56];

// The map sets the street envelope. The upper blocks and terrace levels are visual estimates
// from the 2026 views. Each garden cuts a real recess into the corresponding curtain wall.
const gardenLevels = [
  { y: 65, h: 10, bounds: [-41, -22, 42, 20], westSouth: true, width: 18, depth: 12 },
  { y: 113, h: 8.2, bounds: [-40.5, -21, 40, 20], westSouth: false, width: 15, depth: 10 },
  { y: 157, h: 10.4, bounds: [-40, -20, 37.5, 18], westSouth: true, width: 21, depth: 11 },
  { y: 200, h: 8.8, bounds: [-39, -18.5, 35, 18], westSouth: false, width: 16, depth: 10 },
  { y: 246, h: 11.2, bounds: [-38.5, -18, 28, 16], westSouth: true, width: 17, depth: 10 },
  { y: 289, h: 8.5, bounds: [-37, -16.5, 18, 15.5], westSouth: false, width: 14, depth: 9.5 },
];
const rectangle = ([west, north, east, south]) => [
  [west, north],
  [east, north],
  [east, south],
  [west, south],
];
const point = ([x, z], y) => [x, y, z];

function cap(out, plan, y, material, color, up = true) {
  const points = plan.map(([x, z]) => new Vector2(x, z));
  for (const triangle of ShapeUtils.triangulateShape(points, []))
    out.addTriangle(
      material,
      'palette:#ffffff',
      triangle.map((index) => point(plan[index], y)),
      [0, up ? 1 : -1, 0],
      [],
      color,
    );
}

function edge(a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  const normal = [dz / length, 0, -dx / length];
  return {
    length,
    normal,
    at: (u, y, offset = 0) => [
      a[0] + (dx * u) / length + normal[0] * offset,
      y,
      a[1] + (dz * u) / length + normal[2] * offset,
    ],
  };
}

function panel(out, e, material, a, b, bottom, top, offset, color, rhythm = [3.25, 4.6]) {
  const vertices = [
    e.at(a, bottom, offset),
    e.at(b, bottom, offset),
    e.at(b, top, offset),
    e.at(a, top, offset),
  ];
  const [u, v] = rhythm;
  out.addQuad(
    material,
    'metric:uv',
    vertices,
    e.normal,
    [
      [a / u, bottom / v],
      [b / u, bottom / v],
      [b / u, top / v],
      [a / u, top / v],
    ],
    color,
  );
}

function shell(out, ring, bottom, top, tier, style = 'office') {
  const podium = style === 'podium';
  const crown = style === 'crown';
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length];
    const e = edge(a, b);
    const material = tier === 0 || crown ? 'tint' : 'panes';
    const tint =
      material === 'tint' ? blue : glass.map((channel) => channel * (0.94 + (i % 4) * 0.02));
    panel(out, e, material, 0, e.length, bottom, top, 0, tint, podium ? [2.3, 15.5] : [3.25, 4.6]);
    const interval = podium ? 15.5 : crown ? 7.5 : 4.6 * (tier <= 1 ? 4 : tier === 2 ? 2 : 1);
    const fascia = podium ? 1.25 : crown ? 0.1 : tier <= 1 ? 0.3 : 0.19;
    if (tier > 0 || podium)
      for (let y = bottom + interval; y + fascia < top; y += interval)
        panel(out, e, 'frame', 0, e.length, y, y + fascia, 0.055, podium ? polished : silver);
    if (tier > 0) {
      const count = Math.max(
        1,
        Math.round(e.length / (podium ? 1.17 : 1.63) / (tier === 1 ? 5 : tier === 2 ? 2 : 1)),
      );
      const fin = podium ? 0.13 : crown ? 0.055 : 0.065;
      for (let j = 1; j < count; j++) {
        const x = (j * e.length) / count;
        panel(
          out,
          e,
          'frame',
          x - fin,
          x + fin,
          bottom,
          top,
          0.09,
          podium ? silver : [0.37, 0.47, 0.56],
        );
      }
    }
    // A pale vertical joint divides the curtain-wall runs in the published memorial view.
    if (e.normal[0] < -0.94 && Math.min(a[1], b[1]) < -1 && Math.max(a[1], b[1]) > 2) {
      const split = (e.length * (0.8 - a[1])) / (b[1] - a[1]);
      panel(out, e, 'frame', split - 0.34, split + 0.34, bottom, top, 0.21, polished);
      if (tier > 1) panel(out, e, 'frame', split + 0.47, split + 0.6, bottom, top, 0.19, silver);
    }
    if (tier > 0 && e.length >= 0.6)
      for (const x of [0.11, e.length - 0.11])
        panel(out, e, 'frame', x - 0.08, x + 0.08, bottom, top, 0.065, polished);
  }
  cap(out, ring, top, 'pavers', pavement);
  cap(out, ring, bottom, 'ceiling', pale, false);
}

function base(out, tier) {
  const outline = site.outline;
  const rim = outline.map(([x, z]) => [x * 0.975, z * 0.975]);
  cap(out, outline, 0, 'pavers', pavement);
  cap(out, outline, 13.7, 'ceiling', pale, false);
  box(out, 'ceiling', [-25, 0.02, -11], [30, 13.68, 11], [0.66, 0.58, 0.46]);
  for (const [i, a] of rim.entries()) {
    const e = edge(a, rim[(i + 1) % rim.length]);
    const facingStreet = e.length > 15;
    const kind = tier === 0 ? 'tint' : facingStreet ? 'clear' : 'ceiling';
    panel(out, e, kind, 0, e.length, 0.04, 13.72, 0, tier ? lobbyGlass : blue);
    for (const y of tier ? [3.55, 8.5, 13.4] : [13.4])
      panel(out, e, 'frame', 0, e.length, y, y + 0.14, 0.1, polished);
    const bays = Math.max(1, Math.round(e.length / (tier < 2 ? 6.6 : 2.75)));
    for (let j = 1; j < bays; j++) {
      const x = (j * e.length) / bays;
      panel(out, e, 'frame', x - 0.075, x + 0.075, 0.04, 13.56, 0.12, polished);
    }
    if (tier > 0 && facingStreet) {
      const center = e.length * (i % 2 === 0 ? 0.55 : 0.41);
      for (const x of [center - 2.12, center, center + 2.12])
        panel(out, e, 'frame', x - 0.045, x + 0.045, 0.06, 3.56, 0.14, polished);
      for (const x of [center - 1.19, center + 1.19])
        panel(out, e, 'frame', x - 0.35, x + 0.35, 0.98, 1.07, 0.18, polished);
      for (const t of [0.19, 0.8])
        beam(
          out,
          'frame',
          e.at(e.length * t, 0.04, -1.4),
          e.at(e.length * t, 13.68, -1.4),
          0.58,
          0.56,
          silver,
        );
    }
  }
  shell(out, outline, 13.7, gardenLevels[0].y, tier, 'podium');
}

function garden(out, plan, level, tier) {
  const { y, h, westSouth, width, depth } = level;
  const p = plan[westSouth ? 3 : 0];
  const direction = westSouth ? -1 : 1;
  const px = [p[0] + width, p[1]];
  const pz = [p[0], p[1] + direction * depth];
  const inside = [px[0], pz[1]];
  const opening = westSouth
    ? [...plan.slice(0, 3), px, inside, pz]
    : [pz, inside, px, ...plan.slice(1)];
  shell(out, opening, y - 0.01, y + h, tier);
  cap(out, [p, px, inside, pz], y + 0.025, 'pavers', [0.53, 0.54, 0.47]);
  cap(out, [p, px, inside, pz], y + h - 0.018, 'ceiling', [0.73, 0.64, 0.43], false);
  for (const endpoint of [px, pz]) {
    const e = edge(p, endpoint);
    const guard = [
      point(p, y + 0.12),
      point(endpoint, y + 0.12),
      point(endpoint, y + 1.34),
      point(p, y + 1.34),
    ];
    if (tier > 0)
      out.addQuad('clear', 'palette:#ffffff', guard, normalFor(...guard), [], lobbyGlass);
    panel(out, e, 'frame', 0, e.length, y + 1.3, y + 1.43, 0, silver);
    const post = e.at(e.length * 0.52, y + 0.1);
    if (tier > 0) beam(out, 'frame', post, [post[0], y + h, post[2]], 0.31, 0.31, polished);
  }
  beam(out, 'frame', point(p, y + 0.1), point(p, y + h), 0.43, 0.43, polished);
  const count = tier === 0 ? 1 : tier === 1 ? 2 : 4;
  for (let i = 0; i < count; i++) {
    const x = p[0] + width * (0.23 + (i / count) * 0.66);
    const z = p[1] + direction * depth * (0.31 + (i % 2) * 0.22);
    const radius = 1.08 + (i % 3) * 0.26;
    box(
      out,
      'pavers',
      [x - 1.34, y + 0.1, z - 1.05],
      [x + 1.35, y + 0.7, z + 1.05],
      [0.44, 0.43, 0.35],
    );
    if (tier > 1)
      box(
        out,
        'ceiling',
        [x - 0.11, y + 0.65, z - 0.11],
        [x + 0.11, y + 3.05, z + 0.11],
        [0.31, 0.23, 0.13],
      );
    sphere(
      out,
      'leaves',
      [x, y + 3.45, z],
      [radius, radius * 1.48, radius * 0.98],
      green,
      tier < 2 ? 5 : 7,
      tier < 2 ? 3 : 4,
    );
  }
}

function build(out, tier) {
  base(out, tier);
  for (const [i, level] of gardenLevels.entries()) {
    const plate = rectangle(level.bounds);
    garden(out, plate, level, tier);
    const top = gardenLevels[i + 1]?.y ?? 326.8;
    shell(out, plate, level.y + level.h - 0.014, top, tier);
    if (i === 2 || i === 4 || i === 5) {
      const [, north, east, south] = level.bounds;
      const x = east - 0.92;
      box(
        out,
        'leaves',
        [x - 0.65, top + 0.03, north + 2],
        [x + 0.58, top + 0.58, south - 2],
        green,
      );
      if (tier > 0) {
        const e = edge([east - 0.19, north + 0.14], [east - 0.19, south - 0.14]);
        panel(out, e, 'clear', 0, e.length, top + 0.03, top + 1.22, 0, lobbyGlass);
      }
    }
  }
  shell(out, rectangle([-34, -15.6, -10, 1.7]), 326.78, 352.7, tier, 'crown');
  shell(out, rectangle([-36.7, 1.72, 4.5, 15.4]), 326.78, height, tier, 'crown');
  shell(out, rectangle([5.2, -14.4, 16.7, 9.2]), 326.78, 339.8, tier, 'crown');
}

export const buildMaster = (out) => build(out, 3);
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
