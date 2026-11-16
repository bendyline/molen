/** Government Museum and Art Gallery, Chandigarh. Meter-scale exterior from mapped and written controls. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const frame = read('map-frame.json');
const plan = read('plan-controls.json');
const field = read('terrain-grid.json');
const section = plan.section;
const { walkLevel, gallerySoffit, galleryFloor, roofDeck, baffleTop } = section;
const mapped = frame.geometry.outline;
const main = section.mainRing.map((i) => mapped[i]);

const surfaces = {
  terracotta: { slot: 'wall', graph: 'brick_longformat', roughness: 0.89 },
  concrete: { slot: 'trim', graph: 'concrete_boardformed', roughness: 0.89 },
  base: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.89 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.85 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.44, metallic: 0.02 },
  steel: { slot: 'door', graph: 'metal_painted', roughness: 0.62 },
};
const colors = Object.fromEntries(
  Object.entries({
    brick: 'b88266',
    brickMuted: 'af785f',
    brickShade: '9f7059',
    concrete: 'c5bbab',
    edge: 'a8a496',
    lower: '96938a',
    light: 'dad3c4',
    roof: '9f9f93',
    glass: '485a59',
    shadedGlass: '394846',
    steel: '63665d',
    dark: '4a5149',
    paving: 'a8a396',
  }).map(([key, value]) => [key, rgb(value)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const solid = (out, slot, x0, x1, y0, y1, z0, z1, tint) =>
  box(out, slot, [x0, y0, z0], [x1, y1, z1], colors[tint]);

function panel(out, slot, x0, x1, y0, y1, z, tint) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    colors[tint],
  );
}

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters;
  const v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const low = field.heightsMeters[j],
    high = field.heightsMeters[j + 1];
  return (
    mix(mix(low[i], low[i + 1], u - i), mix(high[i], high[i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function clockwise(ring) {
  const area = ring.reduce((sum, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + x * v - z * u;
  }, 0);
  return area < 0 ? ring : ring.toReversed();
}

function horizontal(out, slot, ring, y, tint, up = true) {
  const scratch = new MeshBufferBuilder();
  if (
    !scratch.addCap(
      slot,
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, up ? 1 : -1, 0],
      (p) => p,
      colors[tint],
    )
  )
    throw Error('The mapped Chandigarh slab failed to triangulate');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (n) =>
      Array.from(positions.slice(n * 3, n * 3 + 3)),
    );
    triangle(out, slot, points, colors[tint]);
  }
}

function side(out, a, b) {
  return transform(out, Math.atan2(a[1] - b[1], b[0] - a[0]), [a[0], 0, a[1]]);
}

function lowerVolume(out, outline, height, lod, core = false) {
  const ring = clockwise(outline);
  const windowHeight = core ? 2.8 : 1.53;
  const windowBottom = core ? 0.59 : 0.93;
  const tint = core ? 'concrete' : 'brickMuted';
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length];
    const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const faceOut = side(out, a, b);
    const ya = Math.min(walkLevel - 0.64, ground(...a) - 0.43);
    const yb = Math.min(walkLevel - 0.64, ground(...b) - 0.43);
    face(
      faceOut,
      'base',
      [
        [0, ya, 0],
        [length, yb, 0],
        [length, walkLevel, 0],
        [0, walkLevel, 0],
      ],
      colors.lower,
    );
    panel(faceOut, core ? 'concrete' : 'terracotta', 0, length, walkLevel, height, 0, tint);
    if (core && length > 20 && a[1] > 9 && b[1] > 9) {
      const left = length * 0.23,
        right = length * 0.63;
      panel(
        faceOut,
        'glass',
        left,
        right,
        windowBottom,
        windowBottom + windowHeight,
        0.03,
        'shadedGlass',
      );
      if (lod > 0) {
        const bays = lod === 3 ? 14 : lod === 2 ? 10 : 6;
        for (let j = 0; j <= bays; j++) {
          const x = mix(left, right, j / bays);
          panel(
            faceOut,
            'steel',
            x - 0.044,
            x + 0.044,
            windowBottom,
            windowBottom + windowHeight,
            0.054,
            'steel',
          );
        }
        panel(faceOut, 'steel', left, right, 1.54, 1.6, 0.054, 'steel');
      }
    } else if (!core && lod > 0 && length > 6.5) {
      const bays = Math.max(1, Math.round(length / 5));
      for (let j = 0; j < bays; j++) {
        const x = ((j + 0.5) * length) / bays;
        panel(
          faceOut,
          'glass',
          x - 0.65,
          x + 0.65,
          windowBottom,
          windowBottom + windowHeight,
          0.04,
          'shadedGlass',
        );
      }
      panel(faceOut, 'concrete', 0, length, height - 0.38, height, 0.08, 'edge');
    }
  }
  horizontal(out, 'roof', ring, height, core ? 'lower' : 'roof');
}

function mainSlab(out) {
  for (const [i, a] of main.entries()) {
    const b = main[(i + 1) % main.length];
    const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const wall = side(out, a, b);
    panel(wall, 'concrete', 0, length, gallerySoffit, galleryFloor, 0, 'edge');
    panel(wall, 'concrete', 0, length, roofDeck - 0.42, roofDeck, 0.04, 'concrete');
  }
  horizontal(out, 'base', main, gallerySoffit, 'lower', false);
  horizontal(out, 'roof', main, roofDeck, 'roof');
}

function glazingBay(out, begin, end, bottom, top, lod) {
  const recess = -0.66;
  panel(out, 'glass', begin, end, bottom, top, recess, 'glass');
  for (const x of [begin, end]) {
    const points = [
      [x, bottom, 0],
      [x, bottom, recess],
      [x, top, recess],
      [x, top, 0],
    ];
    face(out, 'concrete', x === begin ? points : points.toReversed(), colors.edge);
  }
  face(
    out,
    'concrete',
    [
      [begin, bottom, 0],
      [end, bottom, 0],
      [end, bottom, recess],
      [begin, bottom, recess],
    ],
    colors.edge,
  );
  face(
    out,
    'concrete',
    [
      [begin, top, recess],
      [end, top, recess],
      [end, top, 0],
      [begin, top, 0],
    ],
    colors.edge,
  );
  if (lod < 1) return;
  const count = Math.round((end - begin) / (lod === 3 ? 0.72 : lod === 2 ? 1.0 : 1.58));
  for (let i = 0; i <= count; i++) {
    const x = mix(begin, end, i / count);
    solid(out, 'steel', x - 0.043, x + 0.043, bottom, top, recess - 0.03, recess + 0.08, 'steel');
  }
  panel(
    out,
    'steel',
    begin,
    end,
    mix(bottom, top, 0.43),
    mix(bottom, top, 0.43) + 0.083,
    recess + 0.079,
    'steel',
  );
  if (lod >= 2) {
    solid(
      out,
      'concrete',
      begin - 0.08,
      end + 0.08,
      bottom - 0.15,
      bottom,
      recess - 0.04,
      0.08,
      'concrete',
    );
    solid(
      out,
      'concrete',
      begin - 0.08,
      end + 0.08,
      top,
      top + 0.18,
      recess - 0.04,
      0.39,
      'concrete',
    );
  }
}

function galleryFacade(out, a, b, index, lod) {
  const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const wall = side(out, a, b);
  const left = length * (index === 3 ? 0.42 : index === 5 ? 0.59 : index === 1 ? 0.15 : 0.36);
  const size = Math.min(length * 0.185, 9.36);
  const right = left + size;
  const top = roofDeck - 0.42;
  const bottom = galleryFloor;
  const windowTop = top - 0.46,
    windowBottom = bottom + 0.14;
  const hasWindow = [0, 1, 3, 5].includes(index);
  const stone = (x0, x1, y0, y1) => panel(wall, 'terracotta', x0, x1, y0, y1, 0, 'brick');
  if (hasWindow) {
    stone(0, left, bottom, top);
    stone(right, length, bottom, top);
    stone(left, right, bottom, windowBottom);
    stone(left, right, windowTop, top);
    glazingBay(wall, left, right, windowBottom, windowTop, lod);
  } else {
    stone(0, length, bottom, top);
  }
  if (lod > 0 && (index === 1 || index === 5)) {
    const leftEdge = length * 0.043,
      rightEdge = length * 0.956;
    const count = section.galleryAeratorCountPerSide;
    for (let i = 0; i < count; i++) {
      const x = mix(leftEdge, rightEdge, i / (count - 1));
      if (x > left - 0.27 && x < right + 0.27) {
        if (lod >= 2)
          panel(
            wall,
            'steel',
            x - 0.105,
            x + 0.105,
            windowBottom + 0.45,
            windowBottom + 5.45,
            -0.53,
            'steel',
          );
      } else {
        panel(wall, 'steel', x - 0.12, x + 0.12, bottom + 0.67, bottom + 5.67, 0.017, 'dark');
        if (lod >= 2)
          panel(wall, 'concrete', x + 0.12, x + 0.175, bottom + 0.67, bottom + 5.67, 0.034, 'edge');
      }
    }
  }
  if (lod > 0) {
    for (const pos of [0.024, 0.972]) {
      const x = length * pos;
      solid(
        wall,
        'concrete',
        x - 0.25,
        x + 0.25,
        galleryFloor - 0.04,
        top + 0.12,
        -0.035,
        0.13,
        'concrete',
      );
    }
  }
}

function elevatedPortico(out, lod) {
  const pitch = 7.25;
  for (const z of [22.8, 13.8]) {
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * pitch;
      const low = Math.min(walkLevel, ground(x, z) - 0.16);
      if (i % 2 === 0 && lod > 0) {
        const radius = z > 20 ? 0.46 : 0.4;
        const n = lod === 3 ? 14 : lod === 2 ? 10 : 7;
        loft(
          out,
          'concrete',
          [low, gallerySoffit + 0.055].map((y) => radialRing(y, radius, radius, n, [x, z])),
          colors.concrete,
          { cap: false },
        );
      } else {
        const dx = i % 2 === 0 ? 0.4 : 0.48;
        solid(
          out,
          'concrete',
          x - dx,
          x + dx,
          low,
          gallerySoffit + 0.055,
          z - 0.47,
          z + 0.47,
          'concrete',
        );
      }
    }
  }
  const court = [
    [-30.05, 25.45],
    [-29.5, 17.4],
    [29.84, 17.4],
    [30.5, 25.45],
    [30.31, 27.93],
    [-29.96, 27.93],
  ];
  horizontal(out, 'base', court, walkLevel, 'paving');
  for (let i = 0; i < 3; i++) {
    solid(
      out,
      'base',
      -10.3,
      12.2,
      walkLevel - 0.77,
      walkLevel - i * 0.14,
      26.9 + i * 0.43,
      28.43 + i * 0.43,
      'paving',
    );
  }
}

function lantern(out, center, lod) {
  const [near, far] = section.lanternExtent;
  const darkBase = roofDeck + 0.16;
  const head = baffleTop - 0.21;
  const start = center - 1.12,
    end = center + 1.12;
  solid(out, 'concrete', start, end, roofDeck - 0.02, darkBase, near, far, 'concrete');
  solid(out, 'glass', start + 0.042, end - 0.042, darkBase, head, near + 0.22, far - 0.22, 'glass');
  const profile = [
    [-1.94, head - 0.43],
    [-1.18, head + 0.14],
    [-0.26, head + 0.2],
    [0.46, head + 0.02],
    [1.94, head + 0.23],
  ];
  const point = (i, z) => [center + profile[i][0], profile[i][1], z];
  const indices = lod === 0 ? [0, 2, 4] : [0, 1, 2, 3, 4];
  for (let i = 1; i < indices.length; i++) {
    const a = indices[i - 1],
      b = indices[i];
    face(
      out,
      'roof',
      [point(a, near - 0.28), point(a, far + 0.38), point(b, far + 0.38), point(b, near - 0.28)],
      colors.light,
    );
    for (const [z, flip] of [
      [near - 0.28, true],
      [far + 0.38, false],
    ]) {
      const u = point(a, z),
        v = point(b, z);
      const edge = [u, v, [v[0], v[1] - 0.19, z], [u[0], u[1] - 0.19, z]];
      face(out, 'concrete', flip ? edge : edge.toReversed(), colors.edge);
    }
  }
  solid(out, 'concrete', start, end, darkBase, head - 0.19, near, near + 0.22, 'edge');
  solid(out, 'concrete', start, end, darkBase, head - 0.19, far - 0.22, far, 'edge');
  if (lod === 0) return;
  const bays = [0, 9, 15, 22][lod];
  for (let i = 0; i <= bays; i++) {
    const z = mix(near + 0.59, far - 0.59, i / bays);
    for (const sign of [-1, 1]) {
      const x = center + sign * 1.1;
      face(
        out,
        'concrete',
        [
          [x, darkBase, z],
          [x + sign * 0.63, darkBase, z + 0.22],
          [x + sign * 0.63, head - 0.07, z + 0.22],
          [x, head - 0.07, z],
        ],
        colors.concrete,
      );
      if (lod >= 2) {
        face(
          out,
          'concrete',
          [
            [x, head - 0.07, z + 0.068],
            [x + sign * 0.63, head - 0.07, z + 0.288],
            [x + sign * 0.63, darkBase, z + 0.288],
            [x, darkBase, z + 0.068],
          ],
          colors.edge,
        );
      }
    }
  }
}

function roofDrain(out, x, front, lod) {
  const y = roofDeck - 0.32;
  const baseZ = front ? 24.8 : -26.03;
  const tip = front ? baseZ + 3.69 : baseZ - 3.69;
  const z0 = Math.min(baseZ, tip),
    z1 = Math.max(baseZ, tip);
  if (lod === 0) {
    solid(out, 'concrete', x - 0.7, x + 0.7, y - 0.38, y + 0.16, z0, z1, 'concrete');
    return;
  }
  solid(out, 'concrete', x - 0.68, x + 0.68, y - 0.43, y - 0.11, z0, z1, 'concrete');
  for (const sign of [-1, 1]) {
    const center = x + sign * 0.56;
    solid(out, 'concrete', center - 0.13, center + 0.13, y - 0.11, y + 0.24, z0, z1, 'concrete');
  }
}

function build(out, lod) {
  lowerVolume(
    out,
    [
      [-25.5, 10.7],
      [26.8, 10.7],
      [25.9, -24.5],
      [19.16, -24.64],
      [13.93, -27.44],
      [-15.79, -26.81],
      [-19.61, -24.01],
      [-25.8, -23.9],
      [-25.71, -4.55],
      [-29.39, -5.04],
      [-29.64, 9.9],
    ],
    gallerySoffit + 0.025,
    lod,
    true,
  );
  for (const [i, ring] of section.wingRings.entries()) {
    lowerVolume(
      out,
      ring.map((id) => mapped[id]),
      i === 0 ? 3.52 : 3.6,
      lod,
    );
  }
  elevatedPortico(out, lod);
  mainSlab(out);
  for (const [i, a] of main.entries()) galleryFacade(out, a, main[(i + 1) % main.length], i, lod);
  for (const x of section.roofLanterns) lantern(out, x, lod);
  roofDrain(out, 10.5, true, lod);
  roofDrain(out, -5.4, false, lod);
}

export const chandigarhSkyline = (out) => build(out, 0);
export const chandigarhDistrict = (out) => build(out, 1);
export const chandigarhStreet = (out) => build(out, 2);
export const chandigarhCloseup = (out) => build(out, 3);

const recipe = 'chandigarh-art-museum-model.mjs';
const camera = [-69, 31, 105];
const lookAt = [-4, 5, -4];
export const chandigarhModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: chandigarhCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline: mapped,
    minimumCoverage: 0.995,
    basis:
      'The independently named native main museum way 129784715 includes both connected low projections.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Le Corbusier’s concrete and fired-clay museum in Chandigarh, with its shaded southwest portico and eight parallel concrete roof lanterns.',
  camera,
  lookAt,
  sunDirection: [-37, 69, 55],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 2.0,
    cameraYaw: -0.66,
    groundY: 0,
    focus: { center: [-3, 5.6, -8] },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'southwest-portico-and-roof', position: [-56, 22, 83], lookAt: [-3, 6.9, 3] },
    { name: 'gallery-pilotis-and-apron', position: [-24, 4.6, 61], lookAt: [7, 5.8, 23] },
    {
      name: 'roof-lanterns-and-northeast-projection',
      position: [42, 63, -76],
      lookAt: [-3, 7, -8],
    },
    {
      name: 'northwest-glazing-and-attached-wing',
      position: [-78, 15, -23],
      lookAt: [-18, 6.4, -6],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `chandigarh-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'chandigarhSkyline',
    errorMeters: 1.05,
    surfaces,
    authoredLevels: {
      district: { export: 'chandigarhDistrict', errorMeters: 0.48, surfaces },
      street: { export: 'chandigarhStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'chandigarhCloseup', errorMeters: 0.09, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry from the museum and conservation team’s written architectural facts, ODbL OpenStreetMap footprint and openly attributed Terrarium elevation.',
};
