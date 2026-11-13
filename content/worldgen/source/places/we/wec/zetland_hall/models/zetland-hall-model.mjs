/** Zetland Hall's buff Kennedy Road façade and service side in October 2007. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box as boundsBox } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const f = plan.front;
const surfaces = {
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.95, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.91, metallic: 0 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.55, metallic: 0.12 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.82, metallic: 0.12 },
};
const color = Object.fromEntries(
  Object.entries({
    wall: 'c3b9a1',
    reveal: 'a69980',
    side: 'b2aa92',
    base: '8d8a80',
    roof: '8a8880',
    cap: 'c8c4b1',
    glass: '54605f',
    dark: '38362f',
    brown: '6a5f54',
    steel: '9c9d8f',
    rail: '565950',
    grey: 'a0a39d',
    emblem: '52483a',
    plaque: 'a9a393',
  }).map(([key, value]) => [key, rgb(value)]),
);
const up = [0, 1, 0];
const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);

function directed(out, slot, points, normal, tint) {
  const wound = dot(normalFor(...points), normal) >= 0 ? points : points.toReversed();
  if (points.length === 3) triangle(out, slot, wound, tint);
  else face(out, slot, wound, tint);
}

function surface(out, slot, ring, p, normal, tint, holes = []) {
  const points = [...ring];
  const starts = holes.map((hole) => {
    const offset = points.length;
    points.push(...hole);
    return offset;
  });
  const indices = earcut(points.flat(), starts);
  for (let i = 0; i < indices.length; i += 3) {
    directed(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => p(...points[j])),
      normal,
      tint,
    );
  }
}

function box(out, slot, x, bottom, z, width, height, depth, tint) {
  boundsBox(
    out,
    slot,
    [x - width / 2, bottom, z - depth / 2],
    [x + width / 2, bottom + height, z + depth / 2],
    tint,
  );
}

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  const [row, next] = terrain.heightsMeters.slice(j, j + 2);
  return (
    (1 - b) * ((1 - a) * row[i] + a * row[i + 1]) +
    b * ((1 - a) * next[i] + a * next[i + 1]) -
    terrain.modelDatumElevationMeters
  );
}

function edge(a, b, direction) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const normal = [(direction * dz) / length, 0, (-direction * dx) / length];
  const p = (u, y, depth = 0) => [
    a[0] + (dx * u) / length - normal[0] * depth,
    y,
    a[1] + (dz * u) / length - normal[2] * depth,
  ];
  return { p, normal, length };
}

const rect = (left, right, low, high) => [
  [left, low],
  [right, low],
  [right, high],
  [left, high],
];
function panel(out, section, slot, left, right, low, high, inset, tint) {
  directed(
    out,
    slot,
    rect(left, right, low, high).map((v) => section.p(...v, inset)),
    section.normal,
    tint,
  );
}

function surround(out, section, holes, lod, tint) {
  const { p, normal, length } = section;
  const rings = holes.map(({ left, right, low, high }) => rect(left, right, low, high));
  surface(
    out,
    'plaster',
    rect(0, length, f.base - 0.14, f.parapet),
    p,
    normal,
    tint,
    lod ? rings : [],
  );
  for (const [i, item] of holes.entries()) {
    const { left, right, low, high, depth, kind } = item;
    const inset = lod ? depth : -0.022;
    panel(
      out,
      section,
      'glazing',
      left,
      right,
      low,
      high,
      inset,
      kind === 'door' ? color.dark : color.brown,
    );
    if (lod) {
      const ring = rings[i],
        mid = p((left + right) / 2, (low + high) / 2);
      for (let j = 0; j < 4; j++) {
        const a = ring[j],
          b = ring[(j + 1) % 4],
          m = p((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        directed(
          out,
          'plaster',
          [p(...a), p(...b), p(...b, inset), p(...a, inset)],
          mid.map((v, k) => v - m[k]),
          color.reveal,
        );
      }
    }
    if (kind !== 'light' && kind !== 'side') continue;
    const margin = kind === 'side' ? 0.11 : 0.22;
    const glassTop = high - (kind === 'side' ? 0.11 : 1.04);
    panel(
      out,
      section,
      'glazing',
      left + margin,
      right - margin,
      low + 0.12,
      glassTop,
      inset - 0.025,
      color.glass,
    );
    if (lod >= 2) {
      const y0 = low + 0.14,
        space = glassTop - y0;
      beam(
        out,
        'metal',
        p((left + right) / 2, y0, inset - 0.057),
        p((left + right) / 2, glassTop, inset - 0.057),
        0.065,
        0.063,
        color.steel,
      );
      const rows = kind === 'side' ? 3 : lod === 2 ? 6 : 9;
      for (let j = 0; j <= rows; j++) {
        const y = y0 + (j * space) / rows;
        beam(
          out,
          'metal',
          p(left + margin, y, inset - 0.055),
          p(right - margin, y, inset - 0.055),
          0.05,
          0.052,
          color.steel,
        );
      }
    }
  }
}

function emblem(out, section, lod) {
  const { p, normal } = section;
  const [x, y] = [f.doorCenter, 5.17];
  const count = lod >= 2 ? 18 : 10;
  const disk = Array.from({ length: count }, (_, i) => {
    const angle = (i * 2 * Math.PI) / count;
    return [x + 0.43 * Math.cos(angle), y + 0.43 * Math.sin(angle)];
  });
  surface(out, 'metal', disk, (u, v) => p(u, v, -0.044), normal, color.emblem);
  if (lod >= 1) {
    for (const [a, b] of [
      [
        [x - 0.25, y],
        [x, y - 0.24],
      ],
      [
        [x, y - 0.24],
        [x + 0.25, y],
      ],
      [
        [x - 0.19, y - 0.12],
        [x, y + 0.24],
      ],
      [
        [x, y + 0.24],
        [x + 0.19, y - 0.12],
      ],
    ])
      beam(out, 'metal', p(...a, -0.081), p(...b, -0.081), 0.043, 0.058, color.steel);
    panel(out, section, 'metal', x - 0.44, x + 0.44, 4.44, 4.6, -0.052, color.emblem);
    panel(out, section, 'metal', x - 0.35, x + 0.35, 4.25, 4.35, -0.052, color.emblem);
    panel(out, section, 'stone', 1.03, 1.78, 0.69, 1.08, -0.028, color.plaque);
  }
}

function entranceLanding(out, section, lod) {
  const { p, normal } = section;
  const runs = lod ? 3 : 1;
  for (let j = 0; j < runs; j++) {
    const depth = -(3.22 - j * 0.46),
      y = f.base - (runs - j - 1) * 0.065;
    const a = p(1.9, y, depth),
      b = p(12.95, y, depth),
      c = p(12.95, y, 0),
      d = p(1.9, y, 0);
    const foundation = ([x, , z]) => [x, Math.min(y - 0.09, grade(x, z) - 0.18), z];
    directed(out, 'stone', [a, b, c, d], up, color.base);
    directed(out, 'stone', [foundation(a), foundation(b), b, a], normal, color.base);
    if (j === 0) {
      directed(out, 'stone', [foundation(a), a, d, foundation(d)], [-1, 0, 0], color.base);
      directed(out, 'stone', [foundation(c), c, b, foundation(b)], [1, 0, 0], color.base);
    }
  }
}

function roof(out, lod) {
  surface(out, 'roof', outline, (x, z) => [x, f.roof, z], up, color.roof);
  if (lod) {
    box(out, 'plaster', -1.75, f.roof, -7.3, 3.05, 1.62, 3.4, color.side);
    box(out, 'roof', -1.75, f.roof + 1.59, -7.3, 3.19, 0.17, 3.56, color.roof);
    box(out, 'metal', 2.86, f.roof, -2.65, 1.43, 0.77, 1.51, color.grey);
  }
}

function build(out, lod) {
  const sign = Math.sign(
    outline.reduce((sum, a, i) => {
      const b = outline[(i + 1) % outline.length];
      return sum + a[0] * b[1] - a[1] * b[0];
    }, 0),
  );
  for (const [i, a] of outline.entries()) {
    const b = outline[(i + 1) % outline.length];
    const section = edge(a, b, sign);
    const { p, normal, length } = section;
    const baseAt = ([x, , z]) => [x, Math.min(f.base - 0.22, grade(x, z) - 0.24), z];
    directed(
      out,
      'stone',
      [baseAt(p(0, 0)), baseAt(p(length, 0)), p(length, f.base), p(0, f.base)],
      normal,
      color.base,
    );
    const openings = [];
    if (i === 4) {
      openings.push({
        left: f.doorCenter - f.doorWidth / 2,
        right: f.doorCenter + f.doorWidth / 2,
        low: f.base - 0.09,
        high: f.doorTop,
        depth: 0.8,
        kind: 'door',
      });
      for (const { center, width } of f.lights)
        openings.push({
          left: center - width / 2,
          right: center + width / 2,
          low: f.lightLow,
          high: f.lightTop,
          depth: 0.59,
          kind: 'light',
        });
    } else if (i === 3) {
      for (const x of [2.2, 7.64, 12.8])
        openings.push({
          left: x - 0.54,
          right: x + 0.54,
          low: 4.28,
          high: 6.03,
          depth: 0.25,
          kind: 'side',
        });
    } else if (length > 8) {
      for (const x of [length * 0.31, length * 0.68])
        openings.push({
          left: x - 0.5,
          right: x + 0.5,
          low: 3.1,
          high: 4.71,
          depth: 0.24,
          kind: 'side',
        });
    }
    surround(out, section, openings, lod, i === 4 ? color.wall : color.side);
    if (i === 4) {
      entranceLanding(out, section, lod);
      emblem(out, section, lod);
      if (lod) {
        const seam = f.doorCenter + 1.38;
        beam(
          out,
          'plaster',
          p(seam, f.base, 0.02),
          p(seam, f.parapet - 0.18, 0.02),
          0.1,
          0.16,
          color.reveal,
        );
        beam(
          out,
          'plaster',
          p(seam, 12.28, -0.09),
          p(length - 0.17, 12.28, -0.09),
          0.1,
          0.14,
          color.cap,
        );
      }
    }
    if (i === 3 && lod) {
      for (const x of [3.32, 8.69, 14.14]) {
        beam(out, 'metal', p(x, f.base + 0.14, -0.078), p(x, 12.92, -0.078), 0.1, 0.1, color.cap);
        if (lod >= 2) {
          const [vx, , vz] = p(x + 0.85, 0, -0.26);
          box(out, 'metal', vx, 4.16, vz, 0.34, 0.5, 0.82, color.grey);
        }
      }
    }
    if (lod) {
      beam(out, 'roof', p(0, f.parapet, 0), p(length, f.parapet, 0), 0.26, 0.16, color.cap);
      beam(
        out,
        'metal',
        p(0, f.parapet + 0.42, 0.02),
        p(length, f.parapet + 0.42, 0.02),
        0.068,
        0.067,
        color.rail,
      );
      if (lod >= 2) {
        const posts = Math.max(2, Math.ceil(length / 2.72));
        for (let j = 0; j < posts; j++) {
          const u = ((j + 0.1) * length) / posts;
          beam(
            out,
            'metal',
            p(u, f.parapet, 0.018),
            p(u, f.parapet + 0.42, 0.018),
            0.042,
            0.042,
            color.rail,
          );
        }
      }
    }
  }
  roof(out, lod);
}

export const hallSkyline = (out) => build(out, 0);
export const hallDistrict = (out) => build(out, 1);
export const hallStreet = (out) => build(out, 2);
export const hallCloseup = (out) => build(out, 3);

const recipe = 'zetland-hall-model.mjs',
  camera = [-38, 19, 52],
  lookAt = [0, 6.1, 0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'hallDistrict', 0.37],
    ['street', 'hallStreet', 0.12],
    ['closeup', 'hallCloseup', 0.035],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const hallModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: hallCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Buff stucco hall with three deeply recessed gridded lights and the main entrance on Kennedy Road.',
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
    basis: 'The named Zetland Hall envelope from OpenStreetMap way 533484361.',
  },
  mediumFiContext: {
    scale: 2.23,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stucco', 'stone_granite', 'concrete_plain', 'metal_painted'],
  qaCameras: [
    { name: 'kennedy-road-and-tramway-path', position: [-20, 8.9, 39], lookAt: [0, 6.4, 6] },
    { name: 'entry-and-recessed-window-grid', position: [4, 5.5, 29], lookAt: [0.7, 4.8, 11] },
    { name: 'rear-service-side-and-roof', position: [-27, 18, -29], lookAt: [0, 7.0, -2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-zetland-hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'hallSkyline',
    errorMeters: 0.79,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Mapped footprint is ODbL. The photographer released all three exact Qualla files to the public domain.',
};
