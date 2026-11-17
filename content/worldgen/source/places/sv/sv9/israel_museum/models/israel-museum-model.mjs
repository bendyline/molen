/** Israel Museum campus and Shrine of the Book, Jerusalem. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const terrain = read('terrain-grid');
const { section } = plan;
const [galleryOutline, visitorOutline, shrineOutline] = map.geometry.polygons;
const measuredPavilions = map.features.filter((feature) => feature.mappedHeightMeters);
const materials = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.9, metallic: 0 },
  concrete: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.96, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#e3e9eb', roughness: 0.42, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.76, metallic: 0 },
  basalt: { slot: 'wall', graph: 'stone_basalt', roughness: 0.92, metallic: 0 },
  water: { slot: 'foundation', localRef: 'palette:#deedee', roughness: 0.25, metallic: 0.06 },
};
const colors = Object.fromEntries(
  Object.entries({
    limestone: 'dfd4bf',
    frame: 'eae0cf',
    base: 'a9a08f',
    roof: 'b9b5aa',
    darkGlass: '5c6d71',
    louver: 'a9a294',
    mullion: '514f47',
    white: 'f3f1e9',
    whiteShadow: 'e0e0d9',
    basalt: '535450',
    water: '7c989a',
  }).map(([name, value]) => [name, rgb(value)]),
);
const ref = 'palette:#ffffff';
const up = [0, 1, 0];
const rect = (left, right, back, front) => [
  [left, back],
  [right, back],
  [right, front],
  [left, front],
];
const at = ([x, z], y) => [x, y, z];
const midpoint = (a, b, t = 0.5) => a.map((value, i) => value + (b[i] - value) * t);

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const row = (k) =>
    terrain.heightsMeters[k][i] +
    (terrain.heightsMeters[k][i + 1] - terrain.heightsMeters[k][i]) * (u - i);
  return row(j) + (row(j + 1) - row(j)) * (v - j) - terrain.modelDatumElevationMeters;
}

function face(out, slot, points, target, color) {
  let normal = normalFor(...points);
  if (normal.reduce((total, value, i) => total + value * target[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      ref,
      points,
      normal,
      points.map(([x, , z]) => [x, z]),
      color,
    );
}

function cap(out, slot, ring, elevation, color) {
  const y = typeof elevation === 'function' ? elevation : () => elevation;
  const builder = new MeshBufferBuilder();
  if (!builder.addCap(slot, ref, ring, [], y, up, (p) => p, color))
    throw Error('Invalid museum roof or foundation polygon');
  const { positions, indices } = builder.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = Array.from(indices.slice(i, i + 3), (j) =>
      Array.from(positions.slice(3 * j, 3 * j + 3)),
    );
    face(out, slot, p, up, color);
  }
}

function edges(ring) {
  const area = ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - p[1] * q[0];
  }, 0);
  const points = area > 0 ? ring : [...ring].reverse();
  return points.map((p, i) => [p, points[(i + 1) % points.length]]);
}

function wall(out, slot, a, b, low, high, color) {
  const normal = [b[1] - a[1], 0, a[0] - b[0]];
  face(out, slot, [at(a, low[0]), at(b, low[1]), at(b, high[1]), at(a, high[0])], normal, color);
}

function prism(out, slot, roofSlot, ring, bottom, top, color, roofColor = color) {
  for (const [a, b] of edges(ring)) wall(out, slot, a, b, [bottom, bottom], [top, top], color);
  if (roofSlot) cap(out, roofSlot, ring, top, roofColor);
}

function within([x, z], ring) {
  let inside = false;
  for (const [a, b] of edges(ring)) {
    if (a[1] > z !== b[1] > z && x < a[0] + ((z - a[1]) * (b[0] - a[0])) / (b[1] - a[1]))
      inside = !inside;
  }
  return inside;
}

const center = (ring) => ring.reduce((sum, p) => p.map((v, i) => sum[i] + v / ring.length), [0, 0]);
const modules = [];
const moduleSize = section.galleryModuleMeters;
for (let iz = -19; iz <= 8; iz++) {
  for (let ix = -2; ix <= 9; ix++) {
    const x = section.modularGridCenter[0] + ix * moduleSize;
    const z = section.modularGridCenter[1] + iz * moduleSize;
    const half = moduleSize / 2 - 0.33;
    const ring = rect(x - half, x + half, z - half, z + half);
    const fits = ring.every((point) => within(point, galleryOutline));
    const overlapsMeasured = measuredPavilions.some(
      ({ points }) =>
        ring.some((point) => within(point, points)) ||
        points.some((point) => within(point, ring)) ||
        within([x, z], points),
    );
    if (fits && !overlapsMeasured) modules.push({ ring, x, z, ix, iz });
  }
}

function continuousGalleryBase(out, lod) {
  for (const [a, b] of edges(galleryOutline)) {
    const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const slices = Math.max(1, Math.ceil(length / [38, 22.4, 11.2, 11.2][lod]));
    for (let i = 0; i < slices; i++) {
      const u = midpoint(a, b, i / slices);
      const v = midpoint(a, b, (i + 1) / slices);
      const atGrade = grade(...midpoint(u, v));
      const lo = [grade(...u) - 2.8, grade(...v) - 2.8];
      const top = Math.max(atGrade + 2.65, ...lo.map((y) => y + 3.3));
      if (lod > 1) wall(out, 'concrete', u, v, lo, [top - 0.85, top - 0.85], colors.base);
      wall(out, 'stone', u, v, [top - 0.85, top - 0.85], [top, top], colors.limestone);
    }
  }
  cap(out, 'concrete', galleryOutline, (point) => grade(...point) + 2.45, colors.roof);
}

function inset(ring, distance) {
  const [x, z] = center(ring);
  return ring.map(([px, pz]) => [
    px + Math.sign(x - px) * distance,
    pz + Math.sign(z - pz) * distance,
  ]);
}

function clerestory(out, ring, base, height, lod, prominent) {
  const roofTop = base + height;
  const glazed = roofTop - 0.54 - section.galleryClerestoryHeight;
  prism(
    out,
    'stone',
    lod > 1 ? 'stone' : null,
    ring,
    base - section.galleryFoundationDepth,
    glazed,
    colors.limestone,
  );
  const windows = inset(ring, 0.46);
  prism(out, 'glass', null, windows, glazed - 0.03, roofTop - 0.49, colors.darkGlass);
  prism(out, 'stone', 'concrete', ring, roofTop - 0.49, roofTop, colors.frame, colors.roof);
  if (lod < 2) return;
  for (const [a, b] of edges(windows)) {
    const width = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const divisions = Math.max(1, Math.round(width / (prominent ? 1.28 : 2.7)));
    for (let i = 1; i < divisions; i++) {
      const t = i / divisions;
      const p = midpoint(a, b, t);
      if (lod === 3 && prominent) {
        beam(out, 'glass', at(p, glazed), at(p, roofTop - 0.52), 0.09, 0.15, colors.mullion);
      } else {
        const dx = ((b[1] - a[1]) / width) * 0.035,
          dz = ((a[0] - b[0]) / width) * 0.035;
        const offset = ([x, z]) => [x + dx, z + dz];
        wall(
          out,
          'glass',
          offset(midpoint(a, b, t - 0.042 / width)),
          offset(midpoint(a, b, t + 0.042 / width)),
          [glazed, glazed],
          [roofTop - 0.52, roofTop - 0.52],
          colors.mullion,
        );
      }
    }
  }
}

function skylineGalleries(out) {
  const groups = Map.groupBy(
    modules,
    ({ ix, iz }) => `${Math.floor(ix / 4)},${Math.floor(iz / 4)}`,
  );
  for (const group of groups.values()) {
    const coords = group.flatMap(({ ring }) => ring);
    const x = coords.map((p) => p[0]),
      z = coords.map((p) => p[1]);
    const ring = rect(Math.min(...x), Math.max(...x), Math.min(...z), Math.max(...z));
    const rows = ring.every((p) => within(p, galleryOutline))
      ? [ring]
      : [...Map.groupBy(group, ({ iz }) => iz).values()].map((row) => {
          const corners = row.flatMap(({ ring }) => ring);
          const xx = corners.map((p) => p[0]),
            zz = corners.map((p) => p[1]);
          return rect(Math.min(...xx), Math.max(...xx), Math.min(...zz), Math.max(...zz));
        });
    for (const coverage of rows) {
      const base = grade(...center(coverage));
      const roof = base + section.gallerySectionHeight;
      prism(out, 'stone', 'concrete', coverage, base - 2.48, roof, colors.limestone, colors.roof);
      const offset = inset(coverage, -0.015);
      for (const [a, b] of edges(offset).slice(1, 3))
        wall(
          out,
          'glass',
          a,
          b,
          [roof - 0.9, roof - 0.9],
          [roof - 0.45, roof - 0.45],
          colors.darkGlass,
        );
    }
  }
}

function galleries(out, lod) {
  continuousGalleryBase(out, lod);
  if (lod === 0) skylineGalleries(out);
  else {
    for (const [i, { ring, x, z, ix, iz }] of modules.entries()) {
      const base = Math.round(grade(x, z) / 1.05) * 1.05;
      const height = section.gallerySectionHeight + ((ix + iz + 40) % 4) * 0.4;
      clerestory(out, ring, base, height, lod, false);
      if (i % 7 === 0 && lod > 1) {
        const top = base + height;
        box(
          out,
          'concrete',
          [x - 1.65, top, z - 1.26],
          [x + 1.65, top + 0.83, z + 1.26],
          colors.base,
        );
      }
    }
  }
  for (const p of measuredPavilions)
    clerestory(out, p.points, grade(...center(p.points)), p.mappedHeightMeters, lod, true);
}

function louverPavilion(out, ring, base, height, lod) {
  const top = base + height;
  prism(out, 'concrete', 'concrete', ring, base - 2.9, base + 0.48, colors.base);
  prism(out, 'glass', null, inset(ring, 0.22), base + 0.44, top, colors.darkGlass);
  prism(out, 'stone', 'concrete', ring, top - 0.25, top + 0.17, colors.frame, colors.roof);
  const count = [1, 4, 13, 20][lod];
  for (const [a, b] of edges(ring)) {
    const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
    for (let i = 0; i < count; i++) {
      const y = base + 0.7 + (height - 1.02) * ((i + 0.4) / count);
      if (lod === 3) beam(out, 'stone', at(a, y), at(b, y), 0.15, 0.18, colors.louver);
      else wall(out, 'stone', a, b, [y, y], [y + 0.15, y + 0.15], colors.louver);
    }
    if (lod > 1) {
      const spacing = Math.max(1, Math.round(length / 1.95));
      for (let i = 0; i < spacing; i++) {
        const p = midpoint(a, b, i / spacing);
        beam(out, 'glass', at(p, base + 0.49), at(p, top), 0.08, 0.12, colors.mullion);
      }
    }
  }
}

function arrival(out, lod) {
  const leftRange = rect(-15.78, 8.12, 132.12, 156.15);
  const rightRange = rect(15.6, 35.18, 132.62, 156.98);
  const northRange = rect(-11.99, 15.35, 149.82, 167.58);
  const y = grade(6.6, 150.3) + 0.38;
  prism(out, 'concrete', 'stone', visitorOutline, y - 3.2, y + 0.33, colors.base, colors.frame);
  louverPavilion(out, leftRange, y + 0.3, section.circulationHeight, lod);
  louverPavilion(out, rightRange, y + 0.3, section.circulationHeight + 1.02, lod);
  louverPavilion(out, northRange, y + 0.3, section.circulationHeight - 1.16, lod);
  for (const [z, width] of [
    [116.5, 15.1],
    [103.5, 12.8],
  ]) {
    const y = grade(4.4, z) + 0.15;
    prism(
      out,
      'concrete',
      'stone',
      rect(4.4 - width / 2, 4.4 + width / 2, z - 7.3, z + 7.3),
      y - 1.65,
      y + 0.18,
      colors.base,
      colors.frame,
    );
  }
}

const domeProfile = [
  [0.18, 1.0],
  [0.45, 0.996],
  [1.2, 0.966],
  [1.89, 0.921],
  [2.46, 0.845],
  [2.85, 0.757],
  [3.14, 0.647],
  [3.43, 0.514],
  [3.79, 0.392],
  [4.25, 0.294],
  [4.79, 0.219],
  [5.34, 0.164],
  [5.98, 0.119],
  [6.6, 0.088],
];
function shrine(out, lod) {
  const [x, z] = section.shrineCenter;
  const y = grade(x, z) + 1.05;
  const poolHalf = section.shrinePoolHalfSide;
  const outer = rect(x - poolHalf, x + poolHalf, z - poolHalf, z + poolHalf);
  const inner = inset(outer, 0.47);
  prism(out, 'stone', 'water', outer, y - 3.4, y, colors.base, colors.water);
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    const points = [outer[i], outer[j], inner[j], inner[i]].map((p) => at(p, y + 0.42));
    face(out, 'stone', points, up, colors.frame);
    wall(out, 'stone', outer[i], outer[j], [y, y], [y + 0.42, y + 0.42], colors.limestone);
    wall(out, 'stone', inner[j], inner[i], [y, y], [y + 0.42, y + 0.42], colors.base);
  }
  const count = [8, 16, 40, 64][lod];
  const radius = Math.max(...shrineOutline.map(([p]) => Math.abs(p - x)));
  const ring = (height, r) => radialRing(y + height, radius * r, radius * r, count, [x, z]);
  const plinth = [ring(-0.08, 1.028), ring(0.43, 1.028), ring(0.51, 1)];
  loft(out, 'tile', plinth, colors.whiteShadow, { cap: false });
  const profile =
    lod === 0
      ? domeProfile.filter((_, i) => [1, 3, 5, 7, 9, 11, 13].includes(i))
      : lod === 1
        ? domeProfile.filter((_, i) => i % 2 === 1)
        : domeProfile.slice(1);
  const shell = profile.map(([height, r]) => ring((height * section.shrineCrownHeight) / 6.6, r));
  loft(out, 'tile', shell, colors.white, { cap: false });
  const neck = section.shrineOculusDiameterMeters / (2 * radius);
  loft(
    out,
    'basalt',
    [
      shell.at(-1),
      ring(section.shrineCrownHeight + 0.055, neck + 0.014),
      ring(section.shrineCrownHeight + 0.055, neck),
      ring(section.shrineCrownHeight - 0.15, neck),
    ],
    colors.basalt,
    { cap: false },
  );
  cap(
    out,
    'glass',
    ring(section.shrineCrownHeight - 0.35, neck).map(([px, , pz]) => [px, pz]),
    y + section.shrineCrownHeight - 0.35,
    colors.darkGlass,
  );
  const [wallX, wallZ] = section.basaltWallCenter;
  const wallHalf = section.basaltWallLengthMeters / 2,
    depth = section.basaltWallThicknessMeters / 2;
  const wallTop = grade(wallX, wallZ) + 6.34;
  const wallY = wallTop - section.basaltWallOverallHeightMeters;
  box(
    out,
    'basalt',
    [wallX - depth, wallY, wallZ - wallHalf],
    [wallX + depth, wallTop, wallZ + wallHalf],
    colors.basalt,
  );
  if (lod > 1) {
    for (let i = 0; i < 20; i++) {
      const angle = (2 * Math.PI * i) / 20;
      const dx = Math.cos(angle),
        dz = Math.sin(angle);
      const px = x + (radius + 0.51) * dx,
        pz = z + (radius + 0.51) * dz;
      const diameter = 0.075;
      box(
        out,
        'basalt',
        [px - diameter, y, pz - diameter],
        [px + diameter, y + 0.095, pz + diameter],
        colors.basalt,
      );
    }
  }
}

function build(out, lod) {
  galleries(out, lod);
  arrival(out, lod);
  shrine(out, lod);
}
export const israelMuseumSkyline = (out) => build(out, 0);
export const israelMuseumDistrict = (out) => build(out, 1);
export const israelMuseumStreet = (out) => build(out, 2);
export const israelMuseumCloseup = (out) => build(out, 3);

const recipe = 'israel-museum-model.mjs';
const camera = [339, 181, 304];
const lookAt = [26, 9, -19];
export const israelMuseumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  wikidataId: plan.wikidataId,
  cell: plan.cell,
  recipe,
  surfaces: materials,
  category: 'landmark',
  build: israelMuseumCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline: galleryOutline,
    outlines: [visitorOutline, shrineOutline],
    minimumCoverage: 0.99,
    basis: 'The native main galleries, named Weisbord Pavilion and Shrine roof footprints.',
  },
  brief:
    'The Israel Museum’s terraced Jerusalem stone galleries, glazed circulation pavilions, and the white Shrine of the Book above its square pool and black basalt wall.',
  camera,
  lookAt,
  sunDirection: [105, 119, 130],
  embeddedCanonicalGraphs: Object.values(materials).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.85,
    cameraYaw: 0.61,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'campus-across-the-original-hillside',
      position: [256, 134, 247],
      lookAt: [32, 5, -36],
    },
    { name: 'shrine-dome-pool-and-black-wall', position: [151, 14, 149], lookAt: [114, 7.3, 103] },
    { name: 'shrine-parabolic-tile-and-oculus', position: [152, 28, 117], lookAt: [118, 7.8, 104] },
    { name: 'north-visitor-pavilion-louvers', position: [57, 15, 198], lookAt: [4, 3, 148] },
    {
      name: 'gallery-stone-modules-and-clerestories',
      position: [-86, 27, 47],
      lookAt: [-10, 6, -23],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `museum-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'israelMuseumSkyline',
    errorMeters: 1.7,
    surfaces: materials,
    authoredLevels: {
      district: { export: 'israelMuseumDistrict', errorMeters: 0.75, surfaces: materials },
      street: { export: 'israelMuseumStreet', errorMeters: 0.25, surfaces: materials },
      closeup: { export: 'israelMuseumCloseup', errorMeters: 0.11, surfaces: materials },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry based on written architecture and a verified CC0 Shrine photograph, ODbL OpenStreetMap and openly attributed Terrarium elevation.',
};
