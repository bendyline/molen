/** The standing exterior of Doel’s two cooling towers and adjoining industrial buildings. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const frame = read('map-frame.json');
const plan = read('plan-controls.json');
const field = read('terrain-grid.json');
const { features } = frame;
const { flatRoofHalls, reactorHalls, towerProfile } = plan.section;
const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.9, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.87, metallic: 0 },
  fascia: { slot: 'trim', graph: 'metal_corrugated', roughness: 0.64, metallic: 0.1 },
  grille: { slot: 'door', graph: 'metal_painted', roughness: 0.69, metallic: 0.04 },
};
const color = Object.fromEntries(
  Object.entries({
    towerSouth: 'c6c2b6',
    towerNorth: 'aaa498',
    rimSouth: 'a7a8a1',
    rimNorth: '96948b',
    weatheredSouth: 'aaa99e',
    weatheredNorth: '969188',
    shellInner: '7b7971',
    footing: 'aaa99f',
    legs: 'a39e90',
    concrete: 'c6c8bf',
    warmConcrete: 'c8c2b0',
    flange: 'b6b6a9',
    dome: 'e2e2d8',
    roof: 'aeb1ad',
    fascia: 'a2aaa9',
    grille: '656f71',
  }).map(([name, tint]) => [name, rgb(tint)]),
);
const tau = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

function terrain(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters;
  const v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = field.heightsMeters[j];
  const b = field.heightsMeters[j + 1];
  return (
    lerp(lerp(a[i], a[i + 1], u - i), lerp(b[i], b[i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function medianGrade(ring) {
  const samples = ring.map(([x, z]) => terrain(x, z)).sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

function circularBounds(ring) {
  const xs = ring.map(([x]) => x);
  const zs = ring.map(([, z]) => z);
  const [minX, maxX, minZ, maxZ] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...zs),
    Math.max(...zs),
  ];
  return {
    center: [(minX + maxX) / 2, (minZ + maxZ) / 2],
    radius: (maxX - minX + maxZ - minZ) / 4,
  };
}

function profileSurface(out, slot, lower, upper, tint, inward = false) {
  for (let i = 0; i < lower.length; i++) {
    const j = (i + 1) % lower.length;
    const points = [lower[i], lower[j], upper[j], upper[i]];
    face(out, slot, inward ? points.toReversed() : points, tint);
  }
}

function coolingTower(out, index, lod) {
  const feature = features[index];
  const { center, radius } = circularBounds(feature.points);
  const ground = medianGrade(feature.points);
  const height = feature.mappedHeight;
  const segments = [10, 22, 52, 72][lod];
  const shellColor = index === 0 ? color.towerSouth : color.towerNorth;
  const rimColor = index === 0 ? color.rimSouth : color.rimNorth;
  const weathered = index === 0 ? color.weatheredSouth : color.weatheredNorth;
  const ring = (y, r) => radialRing(y, r, r, segments, center);
  const sections =
    lod === 0
      ? [0, 2, 4, 7, 10].map((i) => towerProfile[i])
      : lod === 1
        ? towerProfile.filter((_, i) => i !== 1 && i !== 9)
        : towerProfile;

  const outer = sections.map(([y, r]) => ring(ground + y * height, radius * r));
  const inner = sections.map(([y, r]) =>
    ring(ground + y * height, radius * r - lerp(0.91, 0.53, y)),
  );
  for (let i = 1; i < outer.length; i++) {
    const y = sections[i][0];
    const tint = y < 0.96 ? shellColor : i + 1 === outer.length ? rimColor : weathered;
    profileSurface(out, 'wall', outer[i - 1], outer[i], tint);
    if (lod >= 2 || i >= outer.length - (lod === 0 ? 1 : 2)) {
      profileSurface(out, 'wall', inner[i - 1], inner[i], color.shellInner, true);
    }
  }
  profileSurface(out, 'roof', inner.at(-1), outer.at(-1), rimColor, true);
  if (lod > 1) profileSurface(out, 'wall', outer[0], inner[0], shellColor, true);

  const apronTop = ground + 1.15;
  const apron = ring(apronTop, radius * 1.002);
  const footing = apron.map(([x, , z]) => [x, Math.min(ground - 2.7, terrain(x, z) - 0.7), z]);
  profileSurface(out, 'foundation', footing, apron, color.footing);
  if (lod > 0) {
    const basin = ring(apronTop, radius * 0.94);
    profileSurface(out, 'foundation', basin, apron, color.footing, true);
    out.addConvexPolygon(
      'foundation',
      'palette:#ffffff',
      ring(ground + 0.18, radius * 0.94),
      [0, 1, 0],
      ([x, , z]) => [x, z],
      color.legs,
    );
  }

  const supports = [3, 8, 24, 30][lod];
  const legTop = outer[0][0][1] + 0.14;
  const [x, z] = center;
  const point = (r, a, y) => [x + r * Math.cos(a), y, z + r * Math.sin(a)];
  for (let i = 0; i < supports; i++) {
    const angle = (i * tau) / supports;
    const base = point(radius * 0.976, angle, apronTop - 0.2);
    const spread = lod >= 2 ? [-0.038, 0.038] : [0.033];
    for (const d of spread) {
      const crown = point(radius * 0.991, angle + d, legTop);
      beam(out, 'foundation', base, crown, lod === 0 ? 3.6 : 1.65, 1.75, color.legs);
    }
  }
}

function cap(out, ring, y, tint) {
  const mesh = new MeshBufferBuilder();
  if (
    !mesh.addCap(
      'roof',
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      tint,
    )
  ) {
    throw Error('A mapped roof failed to triangulate');
  }
  const { indices, positions } = mesh.finalize();
  for (let offset = 0; offset < indices.length; offset += 3) {
    const points = Array.from(indices.slice(offset, offset + 3), (i) =>
      Array.from(positions.slice(i * 3, i * 3 + 3)),
    );
    triangle(out, 'roof', points, tint);
  }
}

function outline(ring, lod) {
  let result = ring.filter((a, i) => {
    const p = ring[(i + ring.length - 1) % ring.length];
    const b = ring[(i + 1) % ring.length];
    const u = [a[0] - p[0], a[1] - p[1]];
    const v = [b[0] - a[0], b[1] - a[1]];
    return (
      Math.abs(u[0] * v[1] - v[0] * u[1]) >
      Math.hypot(...u) * Math.hypot(...v) * [0.2, 0.105, 0.015, 0.002][lod]
    );
  });
  const area = result.reduce((sum, [x, z], i) => {
    const [u, v] = result[(i + 1) % result.length];
    return sum + x * v - u * z;
  }, 0);
  if (area > 0) result = result.toReversed();
  return result;
}

function facade(out, a, b, floor, top, lod, main, index) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  const point = (t, y, offset = 0) => [
    a[0] + dx * t - (dz * offset) / length,
    y,
    a[1] + dz * t + (dx * offset) / length,
  ];
  const panel = (slot, x0, x1, y0, y1, offset, tint) =>
    face(
      out,
      slot,
      [point(x0, y0, offset), point(x1, y0, offset), point(x1, y1, offset), point(x0, y1, offset)],
      tint,
    );
  const baseA = Math.min(floor - 0.3, terrain(...a) - 0.65);
  const baseB = Math.min(floor - 0.3, terrain(...b) - 0.65);
  if (lod === 0) {
    face(
      out,
      'wall',
      [point(0, baseA), point(1, baseB), point(1, top), point(0, top)],
      color.concrete,
    );
    return;
  }
  face(
    out,
    'foundation',
    [point(0, baseA), point(1, baseB), point(1, floor), point(0, floor)],
    color.footing,
  );
  panel('wall', 0, 1, floor, top, 0, index % 4 === 0 ? color.warmConcrete : color.concrete);
  if (length < 4) return;
  panel('fascia', 0, 1, top - 1.1, top - 0.12, 0.045, color.fascia);
  if (lod < 2 || length < 11 || (!main && index % 2 === 1)) return;
  const count = Math.max(1, Math.floor(length / (lod === 3 ? 11 : 19)));
  for (let i = 0; i < count; i++) {
    const left = (i + 0.12) / count;
    const right = (i + (main ? 0.76 : 0.48)) / count;
    const bandBase = top - (main ? 7.6 : 4.2);
    panel('grille', left, right, bandBase, bandBase + 1.5, 0.11, color.grille);
    if (lod === 3 && main) {
      const trim = (i + 0.92) / count;
      panel('wall', trim, (i + 0.975) / count, floor + 0.08, top - 1.2, 0.18, color.flange);
    }
  }
}

function hall(out, control, lod) {
  const native = features[control.feature].points;
  const ring = outline(native, lod);
  const floor = medianGrade(native) + 0.18;
  const top = floor + control.height;
  for (let i = 0; i < ring.length; i++) {
    facade(
      out,
      ring[i],
      ring[(i + 1) % ring.length],
      floor,
      top,
      lod,
      !control.secondary,
      control.feature + i,
    );
  }
  cap(out, ring, top, color.roof);
}

function reactor(out, control, lod) {
  const native = features[control.feature].points;
  const mapped = circularBounds(native);
  const center = control.center ?? mapped.center;
  const radius = control.radius ?? mapped.radius;
  const floor = medianGrade(native);
  const eave = floor + control.drumHeight;
  const segments = [8, 18, 36, 56][lod];
  const ring = (y, r) => radialRing(y, r, r, segments, center);
  const groundRing = ring(floor, radius);
  const footRing = groundRing.map(([x, , z]) => [
    x,
    Math.min(floor - 1.5, terrain(x, z) - 0.65),
    z,
  ]);
  profileSurface(out, 'foundation', footRing, groundRing, color.footing);
  profileSurface(
    out,
    'wall',
    groundRing,
    ring(eave, radius),
    control.feature === 2 ? color.warmConcrete : color.concrete,
  );
  const eaveLip = ring(eave + 0.4, radius * 1.012);
  if (lod > 0) {
    loft(out, 'wall', [ring(eave - 1.15, radius * 1.012), eaveLip], color.flange, { cap: false });
  }
  const domeBands =
    lod === 0
      ? [0.54, 0.9]
      : lod === 1
        ? [0.34, 0.65, 0.87, 0.97]
        : [0.2, 0.36, 0.53, 0.71, 0.84, 0.94];
  let previous = lod === 0 ? ring(eave, radius) : eaveLip;
  for (const rise of domeBands) {
    const domeRing = ring(
      eave + 0.4 + rise * control.crownRise,
      radius * Math.sqrt(1 - rise * rise),
    );
    profileSurface(out, 'roof', previous, domeRing, color.dome);
    previous = domeRing;
  }
  const peak = [center[0], eave + 0.4 + control.crownRise, center[1]];
  for (let i = 0; i < segments; i++) {
    triangle(out, 'roof', [previous[i], previous[(i + 1) % segments], peak], color.dome);
  }
}

function build(out, lod) {
  coolingTower(out, 0, lod);
  coolingTower(out, 1, lod);
  for (const control of flatRoofHalls) {
    if (lod > 0 || !control.secondary) hall(out, control, lod);
  }
  for (const control of reactorHalls) reactor(out, control, lod);
}

export const doelSkyline = (out) => build(out, 0);
export const doelDistrict = (out) => build(out, 1);
export const doelStreet = (out) => build(out, 2);
export const doelCloseup = (out) => build(out, 3);

const recipe = 'doel-model.mjs';
const camera = [-555, 128, 850];
const lookAt = [-185, 50, 226];
const outlines = frame.geometry.polygons;
export const doelModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: doelCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline: outlines[0],
    outlines,
    minimumCoverage: 0.995,
    basis:
      'Individual native plans of the two cooling towers, reactor buildings and modeled exterior ancillary halls.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The two open-topped cooling towers at Doel rise above the concrete reactor domes and low industrial buildings on the west bank of the Scheldt.',
  camera,
  lookAt,
  sunDirection: [-420, 600, 810],
  embeddedCanonicalGraphs: Object.values(surfaces).map(({ graph }) => graph),
  mediumFiContext: {
    scale: 3.2,
    cameraYaw: -0.61,
    groundY: 0,
    focus: { center: [-178, 46, 232] },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'station-from-across-the-scheldt', position: camera, lookAt },
    {
      name: 'open-cooling-towers-and-supports',
      position: [-170, 249, 765],
      lookAt: [-10, 89, 397],
    },
    { name: 'low-domes-and-adjoining-halls', position: [-570, 107, 589], lookAt: [-190, 32, 206] },
    {
      name: 'western-station-and-cooling-tower-rims',
      position: [379, 329, -787],
      lookAt: [-188, 58, 208],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `doel-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'doelSkyline',
    errorMeters: 3.1,
    surfaces,
    authoredLevels: {
      district: { export: 'doelDistrict', errorMeters: 1.4, surfaces },
      street: { export: 'doelStreet', errorMeters: 0.48, surfaces },
      closeup: { export: 'doelCloseup', errorMeters: 0.14, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original exterior geometry based on cleared public-domain and CC0 reference photos, ODbL native mapping and openly attributed Terrarium elevation. Photograph pixels are absent from the model.',
};
