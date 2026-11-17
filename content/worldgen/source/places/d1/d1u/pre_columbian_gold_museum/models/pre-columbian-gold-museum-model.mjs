/** The Plaza de la Cultura is the roof of three underground museum floors. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireGeometry = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = requireGeometry('earcut');
const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));
const map = read('map-frame.json');
const plan = read('plan-controls.json');
const terrain = read('terrain-grid.json');
const [plaza] = map.geometry.polygons;
const { section } = plan;
const { southX, northX, portalZ, streetZ, floorY, roofY } = section.entryCourt;
const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_travertine', roughness: 0.92, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  marble: { slot: 'roof', graph: 'stone_marble', roughness: 0.79, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.17 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.92, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.64, metallic: 0.06 },
};
const tint = Object.fromEntries(
  Object.entries({
    paving: 'd7cdbc',
    apron: 'aaa493',
    wall: 'aba9a0',
    ledge: 'c2bbae',
    slab: 'c9bfae',
    marble: 'bead94',
    dark: '494d4a',
    pane: '647679',
    inset: '606f6e',
    steel: '646d6d',
    cedar: '8e6346',
    basin: '6c8382',
  }).map(([name, value]) => [name, rgb(value)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const shade = (c, value) => c.map((v) => Math.min(1, v * value));
const tau = 2 * Math.PI;

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = terrain.heightsMeters[j];
  const b = terrain.heightsMeters[j + 1];
  return (
    mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function topFace(out, slot, a, b, c, color, ceiling = false) {
  const up = (b[2] - a[2]) * (c[0] - a[0]) > (b[0] - a[0]) * (c[2] - a[2]);
  triangle(out, slot, up === ceiling ? [a, c, b] : [a, b, c], color);
}

function cap(out, slot, boundary, y, color, opening = [], ceiling = false) {
  const points = boundary.concat(opening);
  const indices = earcut(points.flat(), opening.length ? [boundary.length] : []);
  const vertex = ([x, z]) => [x, typeof y === 'number' ? y : y(x, z), z];
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((j) => vertex(points[j]));
    topFace(out, slot, a, b, c, color, ceiling);
  }
}

/** Clip a roof strip in local metres against the measured four-corner footprint. */
function clip(points, axis, at, sign) {
  const ring = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const inside = (a[axis] - at) * sign >= 0;
    if (inside) ring.push(a);
    if (inside !== (b[axis] - at) * sign >= 0) {
      const q = mix(a[1 - axis], b[1 - axis], (at - a[axis]) / (b[axis] - a[axis]));
      ring.push(axis === 0 ? [at, q] : [q, at]);
    }
  }
  return ring.filter((a, i) => {
    const b = ring[(i + ring.length - 1) % ring.length];
    return Math.hypot(a[0] - b[0], a[1] - b[1]) >= 0.0001;
  });
}
const patch = (x0, x1, z0, z1) =>
  clip(clip(clip(clip(plaza, 0, x0, 1), 0, x1, -1), 1, z0, 1), 1, z1, -1);
const plazaY = (x, z) => section.roofPlazaY + x * 0.017 + z * 0.005;

function deckY(x, z) {
  const edgeDistance = Math.min(
    ...plaza.map(([ax, az], i) => {
      const [bx, bz] = plaza[(i + 1) % plaza.length];
      const dx = bx - ax;
      const dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(x - ax - dx * t, z - az - dz * t);
    }),
  );
  return mix(ground(x, z) + 0.08, plazaY(x, z), Math.min(1, edgeDistance / 9.5));
}

function roofDeck(out, lod) {
  const xs = [-25, -18, southX, -5, 4, northX, 20, 30];
  const zs = [-80, -72, -64, -54, -45, -36, -27, -18, portalZ, 1, streetZ];
  for (let i = 1; i < xs.length; i++) {
    for (let j = 1; j < zs.length; j++) {
      const x = xs[i - 1];
      const z = zs[j - 1];
      if (z >= portalZ && x >= southX && xs[i] <= northX) continue;
      const ring = patch(x, xs[i], z, zs[j]);
      if (ring.length < 3) continue;
      cap(out, 'stone', ring, deckY, shade(tint.paving, 0.96 + 0.018 * Math.cos(z * 0.11 + i)));
      cap(out, 'concrete', ring, (u, v) => deckY(u, v) - 0.47, tint.wall, [], true);
      for (let k = 0; k < ring.length; k++) {
        const a = ring[k];
        const b = ring[(k + 1) % ring.length];
        const rowEdge = Math.abs(a[1] - b[1]) < 0.0001 && a[1] !== streetZ;
        const columnEdge = Math.abs(a[0] - b[0]) < 0.0001;
        if (rowEdge || columnEdge) continue;
        const va = [a[0], deckY(...a), a[1]];
        const vb = [b[0], deckY(...b), b[1]];
        face(
          out,
          'concrete',
          [[va[0], va[1] - 0.52, va[2]], [vb[0], vb[1] - 0.52, vb[2]], vb, va],
          tint.ledge,
        );
      }
    }
  }
  if (lod === 0) return;
  const rec = [{ x: 6.4, z: -45.4, size: 9.8 }];
  for (const { x, z, size } of rec) {
    const y = Math.max(...[-1, 1].map((v) => deckY(x + v * 4.9, z - v * 3.5)));
    const r = size * 0.5;
    box(
      out,
      'concrete',
      [x - r, y - 0.13, z - r * 0.72],
      [x + r, y + 0.18, z + r * 0.72],
      tint.ledge,
    );
    box(
      out,
      'glass',
      [x - r + 0.31, y + 0.17, z - r * 0.72 + 0.31],
      [x + r - 0.31, y + 0.204, z + r * 0.72 - 0.31],
      tint.basin,
    );
    if (lod > 1 && size > 9) {
      for (const u of [-2.65, 0, 2.65])
        box(
          out,
          'steel',
          [x + u - 0.16, y + 0.2, z - 0.16],
          [x + u + 0.16, y + 0.255, z + 0.16],
          tint.steel,
        );
    }
  }
}

function entry(out, lod) {
  box(out, 'stone', [southX, floorY - 0.43, portalZ - 0.4], [northX, floorY, streetZ], tint.paving);
  if (lod > 1) {
    for (let x = southX + 2.4; x < northX - 2.1; x += 1.9) {
      box(
        out,
        'stone',
        [x, floorY - 0.01, portalZ + 0.85],
        [x + 0.042, floorY + 0.009, 2.79],
        tint.apron,
      );
    }
    for (const z of [-5.7, -4, -2.3, -0.6, 1.1, 2.77]) {
      box(
        out,
        'stone',
        [southX + 1.82, floorY - 0.009, z],
        [northX - 1.6, floorY + 0.013, z + 0.042],
        tint.apron,
      );
    }
  }
  const z = portalZ - 0.16;
  box(
    out,
    'concrete',
    [southX - 0.12, roofY - 0.76, z - 1.62],
    [northX + 0.12, roofY - 0.03, z + 0.94],
    tint.wall,
  );
  box(
    out,
    'steel',
    [southX - 0.11, roofY - 0.19, z + 0.89],
    [northX + 0.11, roofY - 0.11, z + 0.97],
    tint.steel,
  );
  const count = [7, 11, 17, 19][lod];
  for (let i = 0; i < count; i++) {
    const x = mix(southX, northX, i / count);
    const next = mix(southX, northX, (i + 1) / count);
    const door = x <= 1.5 && next >= -0.3;
    const glassY = roofY - 0.78;
    box(
      out,
      'glass',
      [x + 0.024, floorY + 0.15, z - 0.07],
      [next - 0.024, glassY, z + 0.05],
      door ? tint.inset : shade(tint.pane, 0.91 + (0.08 * (i % 3)) / 2),
    );
    if (lod > 0) {
      box(
        out,
        'steel',
        [x - 0.035, floorY + 0.12, z + 0.04],
        [x + 0.035, glassY, z + 0.15],
        tint.steel,
      );
      if (door && lod > 1)
        box(
          out,
          'steel',
          [next - 0.28, floorY + 0.89, z + 0.12],
          [next - 0.23, floorY + 1.19, z + 0.21],
          tint.ledge,
        );
    }
  }
  const run = [3, 5, 9, 11][lod];
  for (let i = 0; i < run; i++) {
    const at = mix(2.8, streetZ, i / run);
    const next = mix(2.8, streetZ, (i + 1) / run);
    const treadY = mix(floorY + 0.13, 0.42, (i + 1) / run);
    box(
      out,
      'stone',
      [southX + 2.02, floorY - 0.04, at],
      [northX - 1.72, treadY, next + 0.024],
      tint.paving,
    );
  }
  for (const x of [southX + 1.23, northX - 1.01]) {
    box(
      out,
      'concrete',
      [x - 0.55, floorY - 0.38, portalZ - 0.5],
      [x + 0.55, roofY - 0.1, 2.78],
      tint.wall,
    );
    box(
      out,
      'stone',
      [x - 0.63, roofY - 0.14, portalZ - 0.46],
      [x + 0.63, roofY + 0.05, 2.74],
      tint.ledge,
    );
    if (lod > 0) {
      const stations = [-5.6, -2.9, 0, 2.55];
      for (const station of stations)
        box(
          out,
          'steel',
          [x - 0.035, roofY, station - 0.046],
          [x + 0.035, roofY + 0.73, station + 0.046],
          tint.steel,
        );
      box(
        out,
        'steel',
        [x - 0.05, roofY + 0.68, stations[0]],
        [x + 0.05, roofY + 0.76, stations.at(-1)],
        tint.steel,
      );
    }
  }
}

const [westX, eastX, backZ, frontZ] = section.insideUpperBounds;
function galleryRing(y) {
  const inset = (section.roofPlazaY - y) / Math.tan((section.slopingWallDegrees * Math.PI) / 180);
  const a = westX + inset,
    b = eastX - inset,
    c = backZ + inset,
    d = frontZ - inset;
  const corner = 3.53;
  return [
    [a + corner, c],
    [b - corner, c],
    [b, c + corner],
    [b, d - corner],
    [b - corner, d],
    [a + corner, d],
    [a, d - corner],
    [a, c + corner],
  ];
}
const stairPoint = (r, angle, height) => [
  section.stairCenter[0] + r * Math.cos(angle),
  height,
  section.stairCenter[1] + r * Math.sin(angle),
];

function galleryShell(out, lod) {
  const floor = section.floorLevels.at(-1);
  const top = galleryRing(section.roofPlazaY);
  const bottom = galleryRing(floor);
  for (let i = 0; i < top.length; i++) {
    const j = (i + 1) % top.length;
    const upper = ([x, z]) => [x, Math.min(section.roofPlazaY - 0.27, deckY(x, z) - 0.49), z];
    const lower = ([x, z]) => [x, floor - 0.2, z];
    face(
      out,
      'concrete',
      [lower(bottom[i]), lower(bottom[j]), upper(top[j]), upper(top[i])],
      tint.wall,
    );
    if (lod > 0)
      face(
        out,
        'concrete',
        [lower(bottom[j]), lower(bottom[i]), upper(top[i]), upper(top[j])],
        tint.wall,
      );
  }
  const openRadius = 6.32;
  const segments = [9, 12, 20, 28][lod];
  const opening = (y) =>
    Array.from({ length: segments }, (_, i) => {
      const [x, , z] = stairPoint(openRadius, (tau * i) / segments, y);
      return [x, z];
    });
  for (const y of section.floorLevels) {
    const hole = y === floor ? [] : opening(y);
    cap(out, 'marble', galleryRing(y), y, tint.marble, hole);
    if (lod > 0 && hole.length) {
      cap(out, 'concrete', galleryRing(y), y - 0.22, tint.slab, hole, true);
      for (let i = 0; i < hole.length; i++) {
        const a = hole[i],
          b = hole[(i + 1) % hole.length];
        face(
          out,
          'concrete',
          [
            [a[0], y - 0.22, a[1]],
            [b[0], y - 0.22, b[1]],
            [b[0], y, b[1]],
            [a[0], y, a[1]],
          ],
          tint.slab,
        );
      }
    }
    if (lod > 1) {
      const [cx, cz] = section.stairCenter;
      for (const x of [-8.6, 10.9]) {
        for (const dz of [-11, 11])
          box(
            out,
            'concrete',
            [x - 0.39, y - 0.2, cz + dz - 0.42],
            [x + 0.39, y + 3.72, cz + dz + 0.42],
            tint.slab,
          );
      }
      if (hole.length) {
        // Paving joints follow the equilateral triangular module around the central void.
        for (const shift of [-13, 13]) {
          for (let t = -2; t <= 2; t++) {
            const z = cz + shift + t * 1.35;
            const a = [cx - 6.8, y + 0.009, z],
              b = [cx + 4.5, y + 0.009, z + 2.12];
            beam(out, 'marble', a, b, 0.027, 0.015, shade(tint.marble, 0.86));
          }
        }
      }
    }
  }
}

function stair(out, lod) {
  const steps = [11, 18, 24, 28][lod];
  const [upperY, middleY, lowerY] = section.floorLevels;
  const radius = 5.89;
  const inner = 3.49;
  const point = (r, a, y) => stairPoint(r, a, y);
  const flights = [
    [upperY, middleY, -Math.PI / 4],
    [middleY, lowerY, Math.PI],
  ];
  for (const [high, low, start] of flights) {
    const end = start + Math.PI * 1.25;
    const landing = [
      point(inner, start - 0.32, high + 0.02),
      point(6.46, start - 0.32, high + 0.02),
      point(6.46, start, high + 0.02),
      point(inner, start, high + 0.02),
    ];
    topFace(out, 'marble', landing[0], landing[1], landing[2], tint.marble);
    topFace(out, 'marble', landing[0], landing[2], landing[3], tint.marble);

    for (let i = 0; i < steps; i++) {
      const a = mix(start, end, i / steps),
        b = mix(start, end, (i + 1) / steps);
      const y = mix(high, low, i / steps),
        drop = y - (high - low) / steps;
      const p = point(inner, a, y),
        q = point(radius, a, y),
        r = point(radius, b, y),
        s = point(inner, b, y);
      topFace(out, 'marble', p, q, r, tint.marble);
      topFace(out, 'marble', p, r, s, tint.marble);
      face(out, 'concrete', [s, r, point(radius, b, drop), point(inner, b, drop)], tint.slab);
      if (lod > 0) {
        const rail = y + 0.94;
        const after = drop + 0.94;
        const barRadius = radius - 0.11;
        beam(
          out,
          'wood',
          point(barRadius, a, rail),
          point(barRadius, b, after),
          0.125,
          0.112,
          tint.cedar,
        );
        if (i % (lod > 1 ? 2 : 3) === 0)
          beam(
            out,
            'steel',
            point(barRadius, a, y),
            point(barRadius, a, rail),
            0.064,
            0.064,
            tint.steel,
          );
      }
    }
  }
}

function build(out, lod) {
  roofDeck(out, lod);
  entry(out, lod);
  galleryShell(out, lod);
  stair(out, lod);
}
export const goldMuseumSkyline = (out) => build(out, 0);
export const goldMuseumDistrict = (out) => build(out, 1);
export const goldMuseumStreet = (out) => build(out, 2);
export const goldMuseumCloseup = (out) => build(out, 3);

const recipe = 'pre-columbian-gold-museum-model.mjs';
const camera = [53, 40, 48];
const lookAt = [0, 0.2, -22];
export const goldMuseumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: goldMuseumCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  groundCutout: {
    outline: plaza,
    basis:
      'The mapped public square forms the built roof and includes its recessed public entrance. The mask is bounded by that native polygon and restores original terrain on unload.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Pre-Columbian Gold Museum under Plaza de la Cultura, with the built terrace, recessed glass entrance, sloping concrete shell, three sublevels and central spiral stair.',
  camera,
  lookAt,
  sunDirection: [-48, 63, 48],
  portableGroundY: -14.1,
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.84,
    cameraYaw: 0.1,
    focus: { center: [0, -3, -23] },
    groundY: -14.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'plaza-roof-and-calle-five-recess', position: camera, lookAt },
    { name: 'glazed-entrance-below-terrace', position: [-0.5, 2.2, 8.3], lookAt: [1, -0.3, -7] },
    { name: 'steps-and-roof-edge', position: [-13, 6.73, 20], lookAt: [4, 0.1, -4.4] },
    { name: 'lower-galleries-and-spiral', position: [9.5, -5.15, -22.6], lookAt: [0.5, -7.1, -35] },
    {
      name: 'concrete-section-from-lower-landing',
      position: [-7.1, -9.1, -45.6],
      lookAt: [1.1, -4.2, -35],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `plaza-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'goldMuseumSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'goldMuseumDistrict', 0.58],
        ['street', 'goldMuseumStreet', 0.19],
        ['closeup', 'goldMuseumCloseup', 0.06],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original geometry under the repository license. Architectural references are public domain or CC0. The mapped roof outline is OpenStreetMap ODbL 1.0.',
  limitations: plan.limitations,
};
