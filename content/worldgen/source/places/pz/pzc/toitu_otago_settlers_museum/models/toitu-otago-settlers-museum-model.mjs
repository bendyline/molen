/** The linked Edwardian, Art Deco and modern galleries along Queens Gardens. */
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
const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const ground = read('terrain-grid.json');
const [outline] = frame.geometry.polygons;
const { depotEnd, foyerStart, storageStart, storageEnd, storageStreetSideZ } =
  plan.componentStations;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.92, metallic: 0 },
  render: { slot: 'door', graph: 'concrete_plain', roughness: 0.91, metallic: 0 },
  roofing: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.79, metallic: 0.11 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.11 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.59, metallic: 0.12 },
};
const tint = Object.fromEntries(
  Object.entries({
    cream: 'e3d5b8',
    cast: 'd1c9b4',
    red: 'a33b34',
    brick: '885146',
    storage: '878b85',
    roof: '726c60',
    black: '3c4546',
    glass: '536e73',
    lightGlass: '6f8e8c',
    window: '455457',
    deck: 'bab1a3',
  }).map(([k, v]) => [k, rgb(v)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const lerp = ([ax, az], [bx, bz], t) => [mix(ax, bx, t), mix(az, bz, t)];
const p3 = ([x, z], y) => [x, y, z];

function terrain(x, z) {
  const u = (x - ground.origin[0]) / ground.stepMeters,
    v = (z - ground.origin[1]) / ground.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = ground.heightsMeters[j],
    b = ground.heightsMeters[j + 1];
  return (
    mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
    ground.modelDatumElevationMeters
  );
}

function clipped(points, axis, offset, sign) {
  const ring = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    const onA = (a[axis] - offset) * sign >= 0,
      onB = (b[axis] - offset) * sign >= 0;
    if (onA) ring.push(a);
    if (onA !== onB) {
      const at = (offset - a[axis]) / (b[axis] - a[axis]);
      const q = lerp(a, b, at);
      q[axis] = offset;
      ring.push(q);
    }
  }
  return ring.filter(([x, z], i) => {
    const [px, pz] = ring[(i + ring.length - 1) % ring.length];
    return Math.hypot(x - px, z - pz) > 0.001;
  });
}
const range = (a, b) => clipped(clipped(outline, 0, a, 1), 0, b, -1);
const area = (ring) =>
  ring.reduce((total, a, i) => {
    const b = ring[(i + 1) % ring.length];
    return total + a[0] * b[1] - b[0] * a[1];
  }, 0);
const value = (y, p) => (typeof y === 'number' ? y : y(...p));

function cap(out, slot, ring, y, color) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((j) => ring[j]);
    const up = (b[1] - a[1]) * (c[0] - a[0]) > (b[0] - a[0]) * (c[1] - a[1]);
    triangle(
      out,
      slot,
      (up ? [a, b, c] : [a, c, b]).map((p) => p3(p, value(y, p))),
      color,
    );
  }
}

function side(out, slot, a, b, bottom, top, color, forward = true) {
  const points = [
    p3(a, value(bottom, a)),
    p3(a, value(top, a)),
    p3(b, value(top, b)),
    p3(b, value(bottom, b)),
  ];
  face(out, slot, forward ? points : points.reverse(), color);
}
function walls(out, slot, ring, y0, y1, color) {
  const forward = area(ring) > 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    side(out, slot, a, b, y0, y1, color, forward);
  }
}
function shell(out, slot, ring, y0, y1, color) {
  walls(out, slot, ring, y0, y1, color);
  cap(out, slot, ring, y1, color);
}

const deckFloor = (x) => -1.52 + (x - depotEnd) * 0.018;
const dig = (x, z) => terrain(x, z) - 0.48;
const depotRoof = (x) => deckFloor(x) + 8.13;

function decoDepot(out, lod) {
  const ring = range(-142, depotEnd);
  walls(out, 'render', ring, dig, (x) => depotRoof(x) - 1.88, tint.cast);
  walls(
    out,
    'stone',
    ring,
    (x) => deckFloor(x) - 0.11,
    (x) => deckFloor(x) + 0.62,
    tint.deck,
  );
  const count = [5, 7, 9, 9][lod];
  for (let i = 0; i < count; i++) {
    const start = mix(-141, depotEnd, i / count),
      end = mix(-141, depotEnd, (i + 1) / count);
    const panel = range(start, end);
    const y = (x) => depotRoof(x) - 1.86 + (1 - (x - start) / (end - start)) * 2.19;
    cap(out, 'roofing', panel, y, tint.red);
    const ys = (x) => y(x) - 0.21;
    walls(out, 'roofing', panel, ys, y, tint.red);
    if (i > 0) {
      const cross = panel.filter(([x]) => Math.abs(x - start) < 0.001).sort((a, b) => a[1] - b[1]);
      if (cross.length > 1) {
        const a = cross[0],
          b = cross.at(-1);
        side(
          out,
          'glass',
          a,
          b,
          (x) => depotRoof(x) - 1.84,
          (x) => y(x) - 0.12,
          tint.window,
        );
        if (lod > 0) {
          for (let j = 1; j < 8; j++) {
            const q = lerp(a, b, j / 8);
            beam(
              out,
              'metal',
              p3(q, depotRoof(q[0]) - 1.84),
              p3(q, y(q[0]) - 0.16),
              0.072,
              0.092,
              tint.black,
            );
          }
        }
      }
    }
  }
  const frontage = ring.filter((p) => p[1] < 24);
  const fascia = (x) => depotRoof(x) - 1.17;
  const isForward = area(ring) > 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const width = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (width < 0.12) continue;
    const n = isForward ? 1 : -1;
    const o = [((b[1] - a[1]) / width) * n, (-(b[0] - a[0]) / width) * n];
    const shift = (p, by) => [p[0] + o[0] * by, p[1] + o[1] * by];
    const a0 = shift(a, 0.11),
      b0 = shift(b, 0.11);
    side(out, 'render', a0, b0, (x) => fascia(x) - 0.72, fascia, tint.cream, isForward);
    if (lod < 1 || width < 4.0 || !frontage.includes(a)) continue;
    const windows = Math.max(1, Math.floor(width / (lod === 1 ? 10.2 : 5.6)));
    for (let j = 0; j < windows; j++) {
      const a1 = shift(lerp(a, b, (j + 0.11) / windows), 0.122),
        b1 = shift(lerp(a, b, (j + 0.89) / windows), 0.122);
      side(
        out,
        'glass',
        a1,
        b1,
        (x) => deckFloor(x) + 1.46,
        (x) => deckFloor(x) + 4.79,
        tint.glass,
        isForward,
      );
      const lintel = (x) => deckFloor(x) + 5.18;
      side(out, 'stone', a1, b1, (x) => lintel(x) - 0.43, lintel, tint.cream, isForward);
      if (lod > 1) {
        const p = lerp(a1, b1, 0.49);
        beam(
          out,
          'metal',
          p3(p, deckFloor(p[0]) + 1.51),
          p3(p, deckFloor(p[0]) + 4.8),
          0.097,
          0.1,
          tint.black,
        );
      }
    }
  }
}

function arch(out, x, y, z, width, rise, lod) {
  const radius = width / 2;
  const segments = [5, 7, 10, 14][lod];
  const spring = y + rise - radius;
  box(out, 'glass', [x - radius, y, z - 0.16], [x + radius, spring, z - 0.065], tint.window);
  const center = [x, spring, z - 0.17];
  for (let i = 0; i < segments; i++) {
    const u = (Math.PI * i) / segments,
      v = (Math.PI * (i + 1)) / segments;
    const point = (r, angle) => [x + r * Math.cos(angle), spring + r * Math.sin(angle), z - 0.17];
    triangle(out, 'glass', [center, point(radius, v), point(radius, u)], tint.window);
    face(
      out,
      'stone',
      [point(radius, u), point(radius, v), point(radius + 0.27, v), point(radius + 0.27, u)],
      tint.cream,
    );
  }
  for (const end of [-1, 1])
    box(
      out,
      'stone',
      [x + end * radius - 0.16, y, z - 0.38],
      [x + end * radius + 0.16, spring, z + 0.11],
      tint.cream,
    );
}

function burnside(out, lod) {
  const whole = range(depotEnd, foyerStart);
  const galleries = clipped(whole, 1, storageStreetSideZ, -1);
  const storage = clipped(range(storageStart, storageEnd), 1, storageStreetSideZ, 1);
  const wingHeight = 9.72;
  const foot = -0.32;
  shell(out, 'brick', galleries, dig, wingHeight, tint.brick);
  walls(out, 'stone', galleries, (x, z) => terrain(x, z) - 0.3, foot + 1.68, tint.deck);
  walls(out, 'stone', galleries, wingHeight - 0.6, wingHeight + 0.07, tint.cream);
  if (storage.length > 2) {
    shell(out, 'render', storage, dig, 8.36, tint.storage);
    cap(out, 'roofing', storage, 8.39, tint.roof);
  }
  const forward = area(galleries) > 0;
  for (let i = 0; i < galleries.length; i++) {
    const a = galleries[i],
      b = galleries[(i + 1) % galleries.length];
    const run = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (run < 0.6) continue;
    const n = forward ? 1 : -1;
    const o = [((b[1] - a[1]) / run) * n, (-(b[0] - a[0]) / run) * n];
    const move = ([x, z], d) => [x + o[0] * d, z + o[1] * d];
    side(
      out,
      'stone',
      move(a, 0.16),
      move(b, 0.16),
      wingHeight - 0.72,
      wingHeight - 0.29,
      tint.cream,
      forward,
    );
    if (lod > 0) {
      const bays = Math.max(1, Math.floor(run / (lod > 1 ? 5.1 : 7.4)));
      side(
        out,
        'stone',
        move(a, 0.17),
        move(b, 0.17),
        wingHeight + 0.83,
        wingHeight + 1.04,
        tint.cream,
        forward,
      );
      for (let j = 0; j < bays; j++) {
        const q = move(lerp(a, b, (j + 0.04) / bays), 0.22);
        beam(out, 'stone', p3(q, foot + 1.14), p3(q, wingHeight - 0.38), 0.38, 0.56, tint.cream);
        if (lod > 1) {
          const k = move(lerp(a, b, (j + 0.54) / bays), 0.13);
          beam(
            out,
            'stone',
            p3(k, wingHeight - 0.015),
            p3(k, wingHeight + 1.01),
            0.32,
            0.32,
            tint.cream,
          );
          if (lod === 3) {
            for (const f of [0.24, 0.72, 0.89]) {
              const baluster = move(lerp(a, b, (j + f) / bays), 0.13);
              beam(
                out,
                'stone',
                p3(baluster, wingHeight + 0.07),
                p3(baluster, wingHeight + 0.89),
                0.095,
                0.11,
                tint.cream,
              );
            }
          }
        }
      }
    }
  }
  for (const port of [
    { x: 5.8, z: -29.98, w: 2.9, h: 4.88 },
    { x: 38.7, z: -24.4, w: 2.3, h: 4.05 },
  ]) {
    const { x, z, w, h } = port;
    const e = h + 0.69;
    box(out, 'stone', [x - w * 0.72, -0.75, z - 0.73], [x + w * 0.72, 0.45, z + 0.11], tint.deck);
    arch(out, x, 0.42, z - 0.23, w, h, lod);
    if (lod > 0) {
      for (const dir of [-1, 1]) {
        const post = x + dir * w * 0.68;
        box(
          out,
          'stone',
          [post - 0.19, 0.46, z - 0.57],
          [post + 0.19, e - 0.05, z - 0.23],
          tint.cream,
        );
      }
      box(
        out,
        'stone',
        [x - w * 0.83, e - 0.22, z - 0.58],
        [x + w * 0.83, e + 0.06, z - 0.22],
        tint.cream,
      );
      box(out, 'stone', [x - w * 0.67, -0.31, z - 1.06], [x + w * 0.67, 0.23, z - 0.65], tint.deck);
    }
    const cornice = [x - w * 0.79, e, z - 0.39],
      right = [x + w * 0.79, e, z - 0.39],
      top = [x, e + 1.27, z - 0.39];
    triangle(out, 'stone', [cornice, top, right], tint.cream);
    for (const [a, b] of [
      [cornice, right],
      [cornice, top],
      [top, right],
    ])
      beam(out, 'stone', a, b, 0.19, 0.3, tint.cream);
  }
  for (const [x, z, w] of [
    [5.8, -9.12, 11.3],
    [36.2, -8.7, 9.2],
  ]) {
    const y = wingHeight + 0.68;
    for (const sign of [-1, 1]) {
      const a = [x - w, y, z + sign * 9.2],
        b = [x + w, y, z + sign * 9.2];
      const c = [x + w * 0.75, y + 2.14, z],
        d = [x - w * 0.75, y + 2.14, z];
      face(out, 'roofing', sign > 0 ? [a, b, c, d] : [b, a, d, c], tint.roof);
    }
  }
}

function modernFoyer(out, lod) {
  const ring = range(foyerStart, 119);
  const forward = area(ring) > 0;
  const low = (x) => mix(-0.42, -0.58, (x - foyerStart) / 55);
  const glassTop = (x, z) =>
    low(x) +
    mix(
      plan.heightsMeters.foyerFlatCeiling,
      plan.heightsMeters.foyerGlazedCeiling,
      Math.min(1, Math.max(0, (15 - z) / 33)),
    );
  const ridgeZ = 5.18;
  const roofTop = (x, z) => {
    const peak = Math.max(0, 1 - Math.abs(z - ridgeZ) / 24) * (x - foyerStart) * 0.041;
    return glassTop(x, z) + 0.83 + peak;
  };
  shell(out, 'stone', ring, dig, low, tint.deck);
  walls(out, 'glass', ring, low, glassTop, tint.glass);
  const roofOutline = ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length];
    if ((a[1] - ridgeZ) * (b[1] - ridgeZ) >= 0) return [a];
    return [a, lerp(a, b, (ridgeZ - a[1]) / (b[1] - a[1]))];
  });
  walls(out, 'roofing', roofOutline, glassTop, roofTop, tint.roof);
  for (const sign of [-1, 1])
    cap(out, 'roofing', clipped(ring, 1, ridgeZ, sign), roofTop, tint.roof);
  if (lod === 0) return;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const width = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (width < 0.7) continue;
    const normal = forward ? 1 : -1;
    const offset = [((b[1] - a[1]) / width) * normal, (-(b[0] - a[0]) / width) * normal];
    const move = ([x, z], d) => [x + offset[0] * d, z + offset[1] * d];
    const panels = Math.max(1, Math.round(width / (lod === 1 ? 5.2 : 3.15)));
    for (let j = 0; j < panels; j++) {
      const q = move(lerp(a, b, j / panels), 0.078);
      beam(
        out,
        'metal',
        p3(q, low(q[0]) - 0.02),
        p3(q, glassTop(...q) + 0.08),
        0.17,
        0.17,
        tint.black,
      );
      const s = move(lerp(a, b, (j + 0.055) / panels), 0.017);
      const t = move(lerp(a, b, (j + 0.945) / panels), 0.017);
      if (j % 3 === 1)
        side(
          out,
          'glass',
          s,
          t,
          (x) => low(x) + 0.125,
          (x, z) => glassTop(x, z) - 0.15,
          tint.lightGlass,
          forward,
        );
      if (lod > 1) {
        for (const height of [2.12, 4.18])
          beam(
            out,
            'metal',
            p3(s, low(s[0]) + height),
            p3(t, low(t[0]) + height),
            0.068,
            0.068,
            tint.black,
          );
      }
    }
  }
}

function build(out, lod) {
  decoDepot(out, lod);
  burnside(out, lod);
  modernFoyer(out, lod);
}
export const toituMuseumSkyline = (out) => build(out, 0);
export const toituMuseumDistrict = (out) => build(out, 1);
export const toituMuseumStreet = (out) => build(out, 2);
export const toituMuseumCloseup = (out) => build(out, 3);

const recipe = 'toitu-otago-settlers-museum-model.mjs';
const camera = [170, 85, -195],
  lookAt = [-20, 2, 1];
export const toituMuseumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'museum-library',
  build: toituMuseumCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline,
    minimumCoverage: 0.84,
    basis:
      'The mapped footprint encloses the linked Toitū galleries. The separately mapped Dunedin Railway Station remains in the source map.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Toitū Otago Settlers Museum with the historic Edwardian Burnside facade, Deco road-service depot with red sawtooth clerestories, and pointed floor-to-ceiling glazed Josephine Foyer.',
  camera,
  lookAt,
  sunDirection: [105, 85, -115],
  portableGroundY: -8.3,
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.78,
    cameraYaw: 0.43,
    focus: { center: [-10, 3, 0] },
    groundY: -8.3,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'museum-from-queens-gardens', position: camera, lookAt },
    {
      name: 'josephine-foyer-glass-and-arrowhead',
      position: [146, 21, -49],
      lookAt: [98, 5, 1],
    },
    {
      name: 'burnside-brick-parapets-and-portals',
      position: [25, 14, -71],
      lookAt: [21, 4.7, -20],
    },
    { name: 'art-deco-parapet-and-red-sawtooth', position: [-154, 27, -67], lookAt: [-76, 4, 2] },
    { name: 'railway-side-and-linked-galleries', position: [124, 47, 112], lookAt: [-15, 4, 4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'toituMuseumSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'toituMuseumDistrict', 0.7],
        ['street', 'toituMuseumStreet', 0.27],
        ['closeup', 'toituMuseumCloseup', 0.08],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original modeled geometry. Used an exact CC0 Qualla foyer photo and the Te Papa catalogue scans of a 1904–1915 published postcard. OpenStreetMap geometry is ODbL 1.0.',
  limitations: plan.limitations,
};
