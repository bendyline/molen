/** Timber construction for the 1888 Fort Témiscamingue trading-post buildings. */
import { readFileSync } from 'node:fs';
import { beam, chamferedRectangle, loft, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box, quad } from './structure-mesh.mjs';

const white = 'palette:#ffffff';
const surfaces = {
  siding: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.95, metallic: 0 },
  log: { slot: 'wall', graph: 'wood_log', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.95, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
  dark: { slot: 'trim', localRef: white, roughness: 0.84, metallic: 0 },
};
const color = {
  roof: rgb('716354'),
  shadow: rgb('4a3c31'),
  timber: rgb('73573d'),
  window: rgb('323e3a'),
  sash: rgb('d3c8ad'),
  masonry: rgb('8b8277'),
  weatherboard: rgb('b2a58b'),
};
const styles = {
  fort_temiscamingue_eastern_storehouse: {
    walls: 'siding',
    tint: rgb('9d947c'),
    door: { center: 0.65, width: 2.36, height: 2.29, kind: 'double' },
    windows: [{ center: -4.55, sill: 1.38, width: 0.77, height: 0.7, shutter: true }],
    deck: { width: 3.65, length: 1.23, ramp: 2.45, toe: -0.36 },
    gableVent: true,
  },
  fort_temiscamingue_clerks_house: {
    walls: 'log',
    tint: rgb('d4cbb5'),
    door: { center: 0.07, width: 0.94, height: 2.05 },
    windows: [
      { center: -3.83, sill: 0.83, width: 0.86, height: 1.14 },
      { center: -1.84, sill: 0.83, width: 0.82, height: 1.14 },
      { center: 2.28, sill: 0.83, width: 0.86, height: 1.14 },
      { center: 4.51, sill: 0.83, width: 0.83, height: 1.14 },
    ],
    eastWindows: [{ center: 1.72, sill: 0.86, width: 0.74, height: 1.13 }],
    steps: 5,
    porch: { width: 1.64, length: 0.94, rise: 0.33 },
    chimney: { x: 0.78, z: -4.12, width: 0.63, depth: 0.74, top: 0.55 },
  },
  fort_temiscamingue_carpentry_workshop: {
    walls: 'log',
    tint: rgb('987958'),
    door: { center: -0.74, width: 1.72, height: 2.15, kind: 'double' },
    windows: [{ center: 1.56, sill: 0.93, width: 1.27, height: 1.08 }],
    steps: 6,
    porch: { width: 2.25, length: 0.87, rise: 0.25 },
    chimney: { x: 1.8, z: 2.16, width: 0.54, depth: 0.61, top: 0.16 },
  },
  fort_temiscamingue_dairy_and_icehouse: {
    walls: 'siding',
    tint: rgb('99967f'),
    door: { center: -0.95, width: 1.1, height: 1.83 },
    windows: [{ center: 2.14, sill: 1.28, width: 0.66, height: 0.55, shutter: true }],
    steps: 3,
    stoneCollar: 0.48,
    leanto: { center: 1.29, width: 2.8, length: 1.92 },
    gableVent: true,
  },
};

function face(out, slot, points, tint) {
  const norm = normalFor(...points);
  if (points.length === 4) quad(out, slot, points, norm, tint);
  else out.addConvexPolygon(slot, white, points, norm, ([x, y, z]) => [x + z, y], tint);
}

function roofSlab(out, corners) {
  const bottom = corners.map(([x, y, z]) => [x, y - 0.105, z]);
  face(out, 'roof', corners, color.roof);
  face(out, 'trim', [...bottom].reverse(), color.shadow);
  for (let i = 0; i < corners.length; i++) {
    const next = (i + 1) % corners.length;
    face(out, 'trim', [corners[next], corners[i], bottom[i], bottom[next]], color.timber);
  }
}

function opening(
  out,
  edgeX,
  side,
  { center, sill = 0, width, height, kind, shutter },
  floor,
  detail,
) {
  const start = center - width / 2;
  const stop = center + width / 2;
  const bottom = floor + sill;
  const top = bottom + height;
  const isDoor = sill === 0;
  const isDouble = kind === 'double';
  const cover = isDoor || shutter;
  const jamb = cover ? color.timber : color.sash;
  const fixed = side * edgeX;
  const strip = (slot, z0, z1, y0, y1, thickness, tint) => {
    const x0 = fixed + side * 0.004;
    const x1 = fixed + side * thickness;
    box(out, slot, [Math.min(x0, x1), y0, z0], [Math.max(x0, x1), y1, z1], tint);
  };
  strip(
    cover ? 'trim' : 'dark',
    start,
    stop,
    bottom,
    top,
    0.062,
    cover ? color.timber : color.window,
  );
  for (const z of isDouble ? [start, center, stop] : [start, stop])
    strip('trim', z - 0.049, z + 0.049, bottom - 0.018, top + 0.077, 0.115, jamb);
  strip('trim', start - 0.071, stop + 0.071, top - 0.022, top + 0.079, 0.115, jamb);
  if (!isDoor)
    strip('trim', start - 0.073, stop + 0.073, bottom - 0.067, bottom + 0.008, 0.131, jamb);
  if (detail >= 1 && !cover) {
    strip('trim', center - 0.019, center + 0.019, bottom, top, 0.078, jamb);
    const y = bottom + height * 0.54;
    strip('trim', start, stop, y - 0.017, y + 0.017, 0.082, jamb);
  }
  if (detail >= 1 && isDouble) {
    for (const sign of [-1, 1])
      beam(
        out,
        'trim',
        [fixed + side * 0.095, bottom + 0.25, center + sign * (width / 2 - 0.115)],
        [fixed + side * 0.095, top - 0.24, center + sign * 0.091],
        0.089,
        0.043,
        color.shadow,
      );
  }
  if (detail >= 2 && isDoor) {
    for (let i = 1; i < 8; i++) {
      const z = start + ((stop - start) * i) / 8;
      strip('trim', z - 0.008, z + 0.008, bottom + 0.03, top - 0.027, 0.067, color.shadow);
    }
  }
  if (detail === 3 && !cover)
    for (const fraction of [0.27, 0.78]) {
      const y = bottom + height * fraction;
      strip('trim', start, stop, y - 0.013, y + 0.013, 0.076, jamb);
    }
  if (detail === 3 && isDoor) {
    const handle = isDouble ? center + 0.14 : stop - 0.17;
    strip(
      'dark',
      handle - 0.054,
      handle + 0.054,
      bottom + 0.97,
      bottom + 1.02,
      0.119,
      color.shadow,
    );
  }
}

function access(out, style, x, floor, detail) {
  const z = style.door.center;
  if (style.deck) {
    const deck = style.deck;
    const outer = -x - deck.length;
    const low = outer - deck.ramp;
    const start = z - deck.width / 2;
    const end = z + deck.width / 2;
    box(out, 'trim', [outer, floor - 0.18, start], [-x + 0.015, floor, end], color.weatherboard);
    for (const endZ of [start + 0.15, end - 0.15])
      box(
        out,
        'trim',
        [outer + 0.08, -0.67, endZ - 0.075],
        [outer + 0.23, floor - 0.17, endZ + 0.075],
        color.timber,
      );
    face(
      out,
      'trim',
      [
        [low, deck.toe, start],
        [low, deck.toe, end],
        [outer, floor, end],
        [outer, floor, start],
      ],
      color.weatherboard,
    );
    for (const side of [start, end])
      beam(
        out,
        'trim',
        [low, deck.toe - 0.04, side],
        [outer, floor - 0.071, side],
        0.12,
        0.14,
        color.timber,
      );
    return;
  }
  const halfWidth = style.door.width / 2 + 0.18;
  for (let i = 0; i < style.steps; i++) {
    const y = floor - ((floor + 0.14) * i) / style.steps;
    box(
      out,
      'trim',
      [-x - 0.3 * (i + 1), y - 0.27, z - halfWidth],
      [-x + 0.02, y, z + halfWidth],
      color.timber,
    );
  }
  if (!style.porch) return;
  const porch = style.porch;
  const outer = -x - porch.length;
  const left = z - porch.width / 2;
  const right = z + porch.width / 2;
  const hi = floor + style.door.height + 0.28;
  const lo = hi - porch.rise;
  roofSlab(out, [
    [outer, lo, left],
    [outer, lo, right],
    [-x, hi, right],
    [-x, hi, left],
  ]);
  if (detail >= 1)
    for (const side of [left + 0.12, right - 0.12])
      beam(
        out,
        'trim',
        [-x - 0.084, hi - 0.64, side],
        [outer + 0.13, lo - 0.097, side],
        0.09,
        0.078,
        color.timber,
      );
}

function chimney(out, style, eaves, ridge, detail) {
  const { x, z, width, depth, top } = style;
  const y = ridge + top;
  loft(
    out,
    'stone',
    [
      chamferedRectangle(x, eaves - 0.29, z, width + 0.08, depth + 0.08, 0.07),
      chamferedRectangle(x, y - 0.18, z, width, depth, 0.062),
      chamferedRectangle(x, y - 0.12, z, width + 0.12, depth + 0.12, 0.069),
      chamferedRectangle(x, y, z, width + 0.12, depth + 0.12, 0.069),
    ],
    color.masonry,
  );
  if (detail >= 2)
    box(
      out,
      'dark',
      [x - width * 0.27, y + 0.001, z - depth * 0.24],
      [x + width * 0.27, y + 0.012, z + depth * 0.24],
      color.shadow,
    );
}

function draw(out, plan, style, detail) {
  const { width, length, floor, wall, rise } = plan.dimensions;
  const x = width / 2,
    z = length / 2;
  const eaves = floor + wall,
    ridge = eaves + rise;
  const collar = style.stoneCollar ?? 0;
  box(
    out,
    'stone',
    [-x + 0.095, -0.68, -z + 0.095],
    [x - 0.095, floor - 0.125, z - 0.095],
    color.masonry,
  );
  box(
    out,
    'trim',
    [-x - 0.016, floor - 0.147, -z - 0.016],
    [x + 0.016, floor + 0.034, z + 0.016],
    color.timber,
  );
  if (collar > 0) box(out, 'stone', [-x, floor, -z], [x, floor + collar, z], color.masonry);
  box(out, style.walls, [-x, floor + collar, -z], [x, eaves, z], style.tint);
  for (const sign of [-1, 1]) {
    const gable = [
      [-x, eaves, z * sign],
      [x, eaves, z * sign],
      [0, ridge - 0.089, z * sign],
    ];
    face(out, style.walls, sign > 0 ? gable : gable.reverse(), style.tint);
    const edge = sign * (x + 0.33);
    const endN = -z - 0.29,
      endS = z + 0.29;
    const left = [
      [0, ridge, endN],
      [0, ridge, endS],
      [edge, eaves - 0.14, endS],
      [edge, eaves - 0.14, endN],
    ];
    roofSlab(out, sign > 0 ? left : left.reverse());
    if (detail >= 1)
      for (const end of [-z, z])
        box(
          out,
          'trim',
          [sign * x - 0.062, floor, end - 0.059],
          [sign * x + 0.062, eaves - 0.036, end + 0.059],
          style.walls === 'log' ? style.tint : color.weatherboard,
        );
  }
  beam(out, 'roof', [0, ridge, -z - 0.31], [0, ridge, z + 0.31], 0.17, 0.076, color.roof);
  if (style.gableVent)
    box(
      out,
      'trim',
      [-0.36, eaves + 0.31, z + 0.002],
      [0.36, eaves + 0.78, z + 0.07],
      color.shadow,
    );
  opening(out, x, -1, style.door, floor, detail);
  for (const window of style.windows) opening(out, x, -1, window, floor, detail);
  for (const window of style.eastWindows ?? []) opening(out, x, 1, window, floor, detail);
  access(out, style, x, floor, detail);
  if (style.chimney) chimney(out, style.chimney, eaves, ridge, detail);
  if (style.leanto) {
    const { center, width, length } = style.leanto;
    const start = center - width / 2,
      end = center + width / 2;
    box(out, 'stone', [-x - length, -0.5, start], [-x + 0.01, floor + 0.18, end], color.masonry);
    box(
      out,
      'siding',
      [-x - length, floor + 0.18, start],
      [-x + 0.01, floor + 1.47, end],
      style.tint,
    );
    roofSlab(out, [
      [-x - length - 0.18, floor + 1.5, start - 0.15],
      [-x - length - 0.18, floor + 1.5, end + 0.15],
      [-x + 0.035, floor + 2.03, end + 0.15],
      [-x + 0.035, floor + 2.03, start - 0.15],
    ]);
  }
}

/** A source-local file binds each distinct building, its terrain and dated placement. */
export function fortTemiscamingueOutbuilding(planUrl) {
  const plan = JSON.parse(readFileSync(planUrl));
  const style = styles[plan.model];
  const { length, width, floor, wall } = plan.dimensions;
  const span = Math.max(length, width);
  const slug = plan.model.replaceAll('_', '-');
  const file = slug + '-model.mjs';
  const position = [-span * 1.58, span * 0.79 + 2.6, span * 1.64];
  const lookAt = [0, floor + wall * 0.49, 0];
  const skyline = (out) => draw(out, plan, style, 0);
  const district = (out) => draw(out, plan, style, 1);
  const street = (out) => draw(out, plan, style, 2);
  const closeup = (out) => draw(out, plan, style, 3);
  const model = {
    id: plan.model,
    key: plan.model,
    title: plan.title,
    cell: plan.cell,
    recipe: file,
    surfaces,
    build: closeup,
    category: 'landmark',
    quality: 'medium-fi-exterior',
    reviewStatus: 'review-in-qa.json',
    geographicStatus: 'historical-proposal',
    orientationPolicy: 'approximate-visualization',
    groundContactBasis: plan.sectionBasis,
    progressLedger: 'qualla-003.PROGRESS.md',
    brief: plan.sectionBasis,
    camera: position,
    lookAt,
    sunDirection: [-62, 108, 72],
    appearance: {
      kind: 'historical',
      representedDate: plan.representedDate,
      validFrom: plan.validFrom,
      validUntil: plan.validUntil,
      currentWorldEligible: false,
    },
    recipeDependencies: [
      'fort-temiscamingue-outbuildings.mjs',
      'generate-fort-temiscamingue-outbuilding.mjs',
    ],
    embeddedCanonicalGraphs: [
      surfaces[style.walls].graph,
      'wood_plain',
      'shingle_cedar',
      'stone_limestone_raw',
    ],
    mediumFiContext: {
      scale: 0.78,
      cameraYaw: 3.93,
      groundY: 0,
      focus: { center: lookAt },
      terrain: {
        descriptor: 'terrain-review.terrain.json',
        heightmap: 'terrain-review.height.png',
      },
    },
    qaCameras: [
      {
        name: 'shore-facing-entrance',
        position: [-span * 1.44, span * 0.52 + 2.8, span * 0.78],
        lookAt,
      },
      {
        name: 'west-timber-detail',
        position: [-width * 1.25, floor + wall * 0.81, 0.06],
        lookAt: [-width / 2, floor + wall * 0.55, 0],
      },
      {
        name: 'north-gable-and-roof',
        position: [-span * 0.82, span * 0.72 + 1.9, -span * 1.7],
        lookAt,
      },
      {
        name: 'inland-grade-and-footings',
        position: [span * 1.45, span * 0.68 + 2.4, span * 0.81],
        lookAt,
      },
    ],
    qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
      name: slug + '-' + reviewLod,
      position,
      lookAt,
      reviewLod,
    })),
    runtimeLodOverlay: {
      module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + file,
      level: 'skyline',
      export: 'skyline',
      errorMeters: 0.23,
      surfaces,
      authoredLevels: {
        district: { export: 'district', errorMeters: 0.1, surfaces },
        street: { export: 'street', errorMeters: 0.043, surfaces },
        closeup: { export: 'closeup', errorMeters: 0.018, surfaces },
      },
    },
    limitations: plan.limitations,
    sourceDocuments: plan.requiredSourceDocuments,
    sourceLicense:
      'Original reconstruction from the public-domain Qualla photograph, primary historical records, and an unmodified modern digital elevation field.',
  };
  return { model, skyline, district, street, closeup };
}
