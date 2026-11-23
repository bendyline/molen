import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  at,
  cap,
  floorSampler,
  mix,
  pairs,
  rect,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (key) => JSON.parse(readFileSync(new URL('../' + key + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const grade = floorSampler(read('terrain-grid'));
const [southwest, extension, recess, southeast, northeast, northCut, westCut] =
  frame.geometry.outline;
const back = [westCut[0], 19.0212];
const body = [back, southeast, northeast, northCut, westCut];
const annex = [southwest, extension, recess, back];
const footing = Math.floor(Math.min(...frame.geometry.outline.map((p) => grade(p))) * 2) / 2 - 0.2;
const cornice = plan.dimensions.roofCorniceApproxM;

const stucco = rgb('c7c5bc');
const ivory = rgb('e5e0d3');
const shadowTrim = rgb('b9b6aa');
const grayMasonry = rgb('b2ada0');
const grayWall = rgb('c0bab0');
const roofGray = rgb('626765');
const flatRoof = rgb('acaba0');
const amber = rgb('746b5f');
const black = rgb('3a403d');
const glass = rgb('57625a');
const wood = rgb('615445');
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.94 },
  relief: { slot: 'trim', graph: 'plaster_lime', roughness: 0.9 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.96 },
  slope: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88 },
  upper: { slot: 'roof', graph: 'concrete_plain', roughness: 0.94 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.58 },
  door: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.81 },
};

function segment(a, b) {
  return facade(a, [b[0] - a[0], b[1] - a[1]]);
}

function band(out, f, start, end, y, h, d, tint = ivory) {
  fbox(out, 'relief', f, start, end, y, y + h, -0.032, d, tint);
}

function pane(out, f, center, y, width, height, detail, kind = 'flat', slot = 'dark') {
  if (detail < 2) {
    const q = (u, v) => f.P(center + u, y + v, 0.028);
    const a = width / 2;
    const rise = kind === 'round' ? a : kind === 'tudor' ? width * 0.22 : 0;
    const spring = height - rise;
    quad4(out, slot, q(-a, 0), q(a, 0), q(a, spring), q(-a, spring), black);
    if (rise && detail > 0) {
      const arch = (n) =>
        q(a * Math.cos((n * Math.PI) / 6), spring + rise * Math.sin((n * Math.PI) / 6));
      for (let i = 0; i < 6; i++) tri(out, slot, q(0, spring), arch(i), arch(i + 1), black);
    }
    return;
  }
  opening(out, f, center, y, width, height, {
    glassSlot: slot,
    frameSlot: 'relief',
    glass: slot === 'door' ? wood : glass,
    frame: ivory,
    head: kind,
    rise: width * 0.22,
    frameWidth: 0.101,
    frameDepth: 0.151,
    d: 0.025,
    sill: slot !== 'door',
    mullions: 1,
    transoms: slot !== 'door' ? 1 : 0,
    mullionColor: amber,
  });
}

function column(out, f, u, base, top, radius, detail) {
  const [x, , z] = f.P(u, 0, radius * 0.57);
  const layers = [
    [base, radius * 1.28],
    [base + 0.12, radius * 1.28],
    [base + 0.24, radius],
    [top - 0.3, radius * 0.81],
    [top - 0.15, radius * 1.12],
    [top, radius * 1.15],
  ].map(([y, r]) => [y, r, r]);
  lathe(out, 'relief', [x, z], layers, detail > 1 ? 12 : 7, ivory);
}

function baluster(out, [x, , z], y, scale) {
  const outline = [
    [0, 0.114],
    [0.07, 0.114],
    [0.15, 0.076],
    [0.3, 0.114],
    [0.42, 0.116],
    [0.53, 0.075],
    [0.65, 0.078],
    [0.73, 0.102],
  ];
  const layers = outline.map(([h, r]) => [y + h * scale, r * scale, r * scale]);
  lathe(out, 'relief', [x, z], layers, 8, ivory, {
    capTop: false,
  });
}

function railPath(out, points, y, scale, detail) {
  for (const [a, b] of pairs(points)) {
    const f = segment(a, b),
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 0.12) continue;
    band(out, f, 0, length, y, 0.13 * scale, 0.1 * scale, shadowTrim);
    band(out, f, 0, length, y + 0.82 * scale, 0.138 * scale, 0.09 * scale);
    if (detail === 0) continue;
    const pitch = [0, 0.56, 0.38, 0.27][detail];
    const n = Math.max(1, Math.floor(length / pitch));
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) * length) / n;
      if (detail === 3) baluster(out, f.P(u, 0, 0.03), y + 0.125 * scale, scale);
      else {
        const bar = Math.min(0.07 * scale, (length / n) * 0.26);
        const p = (x, h) => f.P(u + x, y + h * scale, 0.045);
        quad4(out, 'relief', p(-bar, 0.11), p(bar, 0.11), p(bar, 0.85), p(-bar, 0.85), ivory);
      }
    }
  }
}

function rosette(out, f, u, y, size, detail) {
  if (detail < 1) return;
  const n = detail > 1 ? 12 : 7;
  const center = f.P(u, y, 0.219);
  const q = (i, r) =>
    f.P(u + Math.cos((i * Math.PI * 2) / n) * r, y + Math.sin((i * Math.PI * 2) / n) * r, 0.219);
  for (let i = 0; i < n; i++)
    tri(
      out,
      'relief',
      center,
      q(i, size * (1 - (i % 2) * 0.21)),
      q(i + 1, size * (1 - ((i + 1) % 2) * 0.21)),
      i % 2 ? ivory : shadowTrim,
    );
  if (detail < 3) return;
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const dx = (0.2 + i * 0.1) * size;
      const yy = y - (0.1 + i * 0.1) * size;
      const a = f.P(u + sign * dx, yy, 0.228),
        b = f.P(u + sign * (dx + 0.67 * size), yy + 0.26 * size, 0.228);
      const c = f.P(u + sign * (dx + 0.32 * size), yy - 0.16 * size, 0.228);
      if (sign > 0) tri(out, 'relief', a, c, b, ivory);
      else tri(out, 'relief', a, b, c, ivory);
    }
  }
}

function pediment(out, f, u, base, width, rise, detail, scroll = false) {
  const origin = f.P(u, base, 0.16),
    left = u - width / 2,
    right = u + width / 2;
  const edges = scroll
    ? [
        [left, 0],
        [u - width * 0.36, 0.16],
        [u - width * 0.22, 0.43],
        [u - width * 0.07, 0.88],
        [u, 1],
        [u + width * 0.07, 0.88],
        [u + width * 0.22, 0.43],
        [u + width * 0.36, 0.16],
        [right, 0],
      ]
    : [
        [left, 0],
        [u, 1],
        [right, 0],
      ];
  for (const [[a, v], [b, w]] of pairs(edges)) {
    const lower = f.P(a, base + v * rise, 0.16),
      upper = f.P(b, base + w * rise, 0.16);
    tri(out, 'relief', origin, upper, lower, shadowTrim);
    quad4(
      out,
      'relief',
      lower,
      upper,
      f.P(b, base + w * rise + 0.117, 0.28),
      f.P(a, base + v * rise + 0.117, 0.28),
      ivory,
    );
  }
  band(out, f, left, right, base - 0.12, 0.19, 0.26);
  rosette(out, f, u, base + rise * 0.37, rise * 0.26, detail);
}

function balcony(out, f, u, width, d, detail, curved = false) {
  const y = 4.96,
    l = u - width / 2,
    r = u + width / 2;
  const points = curved
    ? Array.from({ length: 9 }, (_, i) => {
        const a = (i * Math.PI) / 8;
        const p = f.P(u - (width / 2) * Math.cos(a), 0, 0.19 + d * Math.sin(a));
        return [p[0], p[2]];
      })
    : [f.P(l, 0, 0.14), f.P(l, 0, d), f.P(r, 0, d), f.P(r, 0, 0.14)].map(([x, , z]) => [x, z]);
  const pad = [f.P(l, 0, 0), ...points.map((p) => [p[0], 0, p[1]]), f.P(r, 0, 0)].map(
    ([x, , z]) => [x, z],
  );
  extrude(out, 'relief', pad, y - 0.18, y + 0.03, shadowTrim, { top: false });
  cap(out, 'relief', pad, y + 0.04, ivory);
  if (detail === 0) {
    const n = f.P(l, 0, d * 0.7),
      m = f.P(r, 0, d * 0.7);
    const approximation = segment([n[0], n[2]], [m[0], m[2]]);
    band(out, approximation, 0, width, y, 0.64, 0.075, ivory);
  } else {
    railPath(out, points, y, 1, detail);
    for (const pos of [l + 0.16, r - 0.16]) {
      const [cx, , cz] = f.P(pos, 0, curved ? 0.22 : d * 0.9);
      abox(
        out,
        'relief',
        [cx - 0.18, y - 0.03, cz - 0.18],
        [cx + 0.18, y + 0.94, cz + 0.18],
        ivory,
      );
    }
    if (detail > 1)
      for (const a of [u - width * 0.27, u + width * 0.27])
        band(out, f, a - 0.16, a + 0.16, y - 0.61, 0.47, Math.min(d * 0.55, 0.4), shadowTrim);
  }
}

function majorFront(out, a, b, bays, detail, side) {
  const f = segment(a, b);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const pitch = length / bays;
  for (const [y, h, d] of [
    [0.15, 0.46, 0.112],
    [4.37, 0.12, 0.132],
    [5.02, 0.12, 0.14],
    [9.31, 0.14, 0.153],
    [9.55, 0.17, 0.28],
    [9.86, 0.13, 0.41],
    [10.02, 0.2, 0.46],
    [10.23, 0.42, 0.43],
  ]) {
    if (detail > 0 || [0.15, 5.02, 10.23].includes(y))
      band(out, f, 0, length, y, h, d, y < 1 ? grayMasonry : ivory);
  }
  for (let i = 0; i < bays; i++) {
    const u = (i + 0.5) * pitch;
    const middle = i === (bays - 1) / 2;
    const outer = i === 0 || i === bays - 1;
    const accent = outer || (side === 'west' && middle);
    const wide = side === 'west' && !accent;
    const groundWidth = wide ? 2.87 : middle && side === 'north' ? 2.38 : 1.64;
    pane(
      out,
      f,
      u,
      0.26,
      groundWidth,
      wide ? 3.81 : 3.66,
      detail,
      wide ? 'round' : 'tudor',
      'door',
    );
    const upperWidth = side === 'north' && !outer ? 2.8 : 2.16;
    pane(out, f, u, 5.03, upperWidth, 3.22, detail);
    if (detail > 0) {
      if (accent) pediment(out, f, u, 8.34, upperWidth + 0.51, 0.75, detail);
      else {
        band(out, f, u - upperWidth * 0.59, u + upperWidth * 0.59, 8.36, 0.16, 0.23);
        if (detail > 1)
          for (const t of [-1, 1]) {
            const x = u + t * (upperWidth / 2 + 0.21);
            band(out, f, x - 0.095, x + 0.095, 5.09, 3.14, 0.157, shadowTrim);
          }
      }
    }
    if (side === 'west' && [1, 4].includes(i) && detail > 0)
      balcony(out, f, u + pitch / 2, pitch + 3.35, 1.03, detail);
    else if (side !== 'west' || ![1, 2, 4, 5].includes(i) || detail === 0)
      balcony(out, f, u, upperWidth + 0.69, 0.93, detail);
    if (accent)
      pediment(out, f, u, cornice + 0.67, Math.min(4.19, pitch - 0.31), 0.89, detail, true);
    if (side === 'north' && middle && detail > 0) {
      const colHeight = 3.55;
      column(out, f, u - 1.54, 0.28, colHeight, 0.172, detail);
      column(out, f, u + 1.54, 0.28, colHeight, 0.172, detail);
      band(out, f, u - 1.86, u + 1.86, colHeight, 0.15, 0.34);
      pediment(out, f, u, colHeight + 0.14, 3.67, 0.68, detail, true);
    }
  }
  if (detail > 0)
    for (let u = 0.25; u < length - 0.1; u += detail > 1 ? 0.59 : 1.76)
      band(out, f, u - 0.08, u + 0.08, 9.98, 0.205, 0.19, shadowTrim);
  if (detail > 0) {
    const n = Math.ceil(length / 2.5);
    for (let i = 0; i < n; i++) {
      const l = (i * length) / n,
        r = ((i + 1) * length) / n;
      const strip = [f.P(l + 0.14, 0, 0.17), f.P(r - 0.14, 0, 0.17)].map(([x, , z]) => [x, z]);
      railPath(out, strip, cornice + 0.01, 0.63, detail === 3 ? 2 : detail);
    }
  }
}

function chamferBay(out, detail) {
  const f = segment(northCut, westCut);
  const width = plan.dimensions.chamferM;
  const u = width / 2;
  const end = width - 0.04;
  for (const [y, h, d] of [
    [0.12, 0.47, 0.21],
    [5.01, 0.13, 0.22],
    [9.18, 0.16, 0.19],
    [9.73, 0.18, 0.39],
    [10.0, 0.21, 0.55],
    [10.26, 0.4, 0.55],
  ])
    band(out, f, 0.04, end, y, h, d, y < 1 ? shadowTrim : ivory);
  pane(out, f, u, 0.18, 2.61, 3.66, detail, 'tudor', 'door');
  pane(out, f, u, 5.04, 2.51, 3.04, detail);
  balcony(out, f, u, 3.66, 1.18, detail, true);
  pediment(out, f, u, cornice + 0.71, 3.85, 1.01, detail, true);
  if (detail > 0) {
    column(out, f, 0.41, 5.36, 9.58, 0.263, detail);
    column(out, f, end - 0.38, 5.36, 9.58, 0.263, detail);
    band(out, f, u - 1.62, u + 1.62, 8.18, 0.18, 0.285);
    rosette(out, f, u, 8.67, 0.49, detail);
    for (const offset of [-0.94, 0.94]) rosette(out, f, u + offset, 8.62, 0.27, detail);
    for (const offset of [-1.01, 1.01])
      band(out, f, u + offset - 0.169, u + offset + 0.169, 4.34, 0.39, 0.383, shadowTrim);
  }
}

function mansard(out, detail) {
  const center = [-2.9, 0.6];
  const scale = (a, b) => body.map(([x, z]) => [mix(center[0], x, a), mix(center[1], z, b)]);
  const lower = scale(0.933, 0.925);
  const upper = scale(0.789, 0.772);
  for (let i = 0; i < lower.length; i++) {
    const j = (i + 1) % lower.length;
    quad4(
      out,
      'slope',
      at(lower[i], 10.73),
      at(lower[j], 10.73),
      at(upper[j], 12.43),
      at(upper[i], 12.43),
      roofGray,
    );
  }
  cap(out, 'upper', upper, 12.44, flatRoof);
  const f = segment(northCut, westCut);
  const u = plan.dimensions.chamferM / 2;
  const feature = (horizontal, depth) =>
    [
      f.P(u - horizontal, 0, -depth),
      f.P(u + horizontal, 0, -depth),
      f.P(u + horizontal, 0, -depth - 2.41),
      f.P(u - horizontal, 0, -depth - 2.41),
    ].map(([x, , z]) => [x, z]);
  const base = feature(1.51, 0.21);
  const top = feature(1.04, 0.91);
  for (let i = 0; i < base.length; i++) {
    const j = (i + 1) % base.length;
    quad4(
      out,
      'slope',
      at(base[i], 11.46),
      at(base[j], 11.46),
      at(top[j], 13.95),
      at(top[i], 13.95),
      roofGray,
    );
  }
  cap(out, 'slope', top, 13.96, roofGray);
  if (detail > 0) {
    const service = [
      [0.8, -3.3, 9.6, 9.1, 12.83],
      [5.4, -8.2, 10.5, -2.4, 13.1],
      [-6.7, 4, -1.8, 10.3, 12.8],
    ];
    for (const [a, b, c, d, y] of service) {
      const part = rect(a, b, c, d);
      extrude(out, 'wall', part, 12.43, y, shadowTrim, { top: false });
      cap(out, 'upper', part, y, flatRoof);
    }
  }
}

function serviceRear(out, detail) {
  extrude(out, 'wall', annex, footing, 4.66, grayWall, { top: false });
  cap(out, 'upper', annex, 4.66, flatRoof);
  const f = segment(back, southwest);
  const length = Math.hypot(southwest[0] - back[0], southwest[1] - back[1]);
  band(out, f, 0, length, 4.51, 0.38, 0.19, shadowTrim);
  pane(out, f, length * 0.28, 0.12, 1.78, 2.45, detail, 'flat', 'door');
  pane(out, f, length * 0.73, 0.9, 1.2, 1.8, detail);
  if (detail > 0) {
    for (const [a, b, n] of [
      [southeast, back, 5],
      [northeast, southeast, 6],
    ]) {
      const rear = segment(a, b);
      const span = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let i = 0; i < n; i++) {
        const offset = ((i + 0.5) * span) / n;
        pane(out, rear, offset, 5.21, 1.24, 2.51, detail, 'flat');
        if (detail > 1) pane(out, rear, offset, 0.75, 1.17, 2.47, detail, 'flat', 'door');
      }
      band(out, rear, 0, span, 9.73, 0.4, 0.15, shadowTrim);
    }
  }
}

function build(out, detail) {
  extrude(out, 'stone', body, footing, 0.43, grayMasonry, { top: false });
  extrude(out, 'wall', body, 0.35, cornice - 0.11, stucco, { top: false });
  extrude(out, 'relief', body, cornice - 0.27, cornice + 0.07, ivory, { top: false });
  cap(out, 'upper', body, cornice + 0.071, flatRoof);
  majorFront(out, northeast, northCut, 5, detail, 'north');
  majorFront(out, westCut, back, 7, detail, 'west');
  chamferBay(out, detail);
  mansard(out, detail);
  serviceRear(out, detail);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'antiguo-casino-de-ponce-model.mjs';
const camera = [-57, 32, -47];
const lookAt = [-2.3, 5.47, -2];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'hotel-commercial',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The former Casino de Ponce at Calle Marina and Calle Luna, with the curved balcony, decorative relief and mission-tile mansard.',
  camera,
  lookAt,
  sunDirection: [-54, 63, -37],
  mediumFiContext: {
    scale: 1.5,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.93,
    basis: 'Only the present former-casino cadastral outline, with the surveyed chamfer.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'chamfered-corner-and-two-street-fronts', position: camera, lookAt },
    {
      name: 'baroque-corner-balcony-and-parapet',
      position: [-41, 10, -34],
      lookAt: [-16.8, 6.8, -14],
    },
    { name: 'calle-marina-balconies-and-arches', position: [-72, 19, 3], lookAt: [-9, 5.9, 1] },
    { name: 'roof-courtyard-and-service-wing', position: [54, 49, 45], lookAt: [-4, 5.9, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'antiguo-casino-de-ponce-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.24,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.63, surfaces },
      street: { export: 'street', errorMeters: 0.21, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.067, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model based on the individually cleared 1984 Puerto Rico SHPO photo, federal agricultural aerial and elevation data, and the OpenStreetMap named footprint.',
};
