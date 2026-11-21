import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  opening,
  pairs,
  palette,
  panel,
  plane,
  shell,
  stairs,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const color = palette({
  board: 'd1c9ae',
  shadedBoard: 'b8ad90',
  seam: 'a99f83',
  ivory: 'e1d7ba',
  plaster: 'cfc2a5',
  timber: '705b45',
  grayGreen: '747c63',
  stone: 'a59e89',
  moss: '8c8b74',
  glass: '515958',
  glassLit: '6a746d',
  roof: '596462',
  copper: '596e5b',
  ridge: '49554e',
  slab: 'bfbbae',
  concrete: 'c9c3b2',
});
const neutral = (slot, roughness) => ({ slot, localRef: 'palette:#ffffff', roughness });
const surfaces = {
  walls: neutral('wall', 0.92),
  stone: surface('foundation', 'stone_ashlar', 0.95),
  roof: neutral('roof', 0.84),
  trim: neutral('trim', 0.84),
  glass: neutral('window', 0.48),
  paintedMetal: surface('trim', 'metal_painted', 0.79, 0.16),
};
const roofFacing = [0, 1, 0];
const historicFront = plane(-20.658, -1);
const points = (...indices) => indices.map((i) => d.outline[i]);
const main = points(4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 24, 25, 26, 27, 28, 29);
const newBuilding = points(0, 1, 2, 3, 4, 29);
const extension = points(17, 18, 19, 20, 21, 22, 23, 24);
const roofPoint = (cx, cz, angle) => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return (x, y, z) => [cx + c * x - s * z, y, cz + s * x + c * z];
};

function pitchedRoof(
  out,
  { center, span, elevation, angle = 0, hip = 0.27, tint = color.roof },
  level,
) {
  const [eaves, ridge] = elevation;
  const [w, v] = span.map((n) => n / 2);
  const point = roofPoint(...center, angle);
  const lower = [
    point(-w, eaves, -v),
    point(w, eaves, -v),
    point(w, eaves, v),
    point(-w, eaves, v),
  ];
  const west = point(-w * (1 - hip), ridge, 0);
  const east = point(w * (1 - hip), ridge, 0);
  face(out, 'roof', [lower[0], lower[1], east, west], roofFacing, tint);
  face(out, 'roof', [lower[2], lower[3], west, east], roofFacing, tint);
  if (hip > 0) {
    face(out, 'roof', [lower[3], lower[0], west], roofFacing, tint);
    face(out, 'roof', [lower[1], lower[2], east], roofFacing, tint);
  } else {
    for (const [a, b, top, sign] of [
      [3, 0, west, -1],
      [1, 2, east, 1],
    ]) {
      face(
        out,
        'walls',
        [lower[a], lower[b], top],
        [Math.cos(angle) * sign, 0, Math.sin(angle) * sign],
        color.plaster,
      );
      if (level >= 1) {
        beam(out, 'trim', lower[a], top, 0.19, 0.13, color.timber);
        beam(out, 'trim', lower[b], top, 0.19, 0.13, color.timber);
      }
    }
  }
  if (level >= 1) {
    beam(out, 'roof', west, east, 0.24, 0.16, color.ridge);
    for (const [a, b] of pairs(closed(lower)))
      beam(out, 'trim', a, b, 0.19, 0.19, tint === color.copper ? color.timber : color.ivory);
  }
  if (level < 2) return;
  const divisions = level === 2 ? 10 : Math.ceil(w / 0.62);
  for (const sign of [-1, 1]) {
    for (let i = 1; i < divisions; i++) {
      const x = ((2 * i) / divisions - 1) * w * (1 - hip) * 0.97;
      beam(
        out,
        'roof',
        point(x, eaves + 0.025, sign * v),
        point(x, ridge + 0.025, 0),
        0.021,
        0.028,
        color.ridge,
      );
    }
  }
}

const trimBand = (out, wall, y, tint, width = 0.16, depth = 0.056) =>
  panel(out, 'trim', wall, 0, wall.length, y, y + width, depth, tint);

function exterior(out, shape, design, level) {
  const bottom = (p) => Math.min(grade(p) - 0.65, design.base - 0.72);
  const masonry = design.base + design.plinth;
  const top = design.base + design.wall;
  shell(out, shape, bottom, masonry, { wall: 'stone', color: color.stone });
  shell(out, shape, () => masonry, top, {
    wall: 'walls',
    roof: 'roof',
    color: design.tint,
    roofColor: design.roof ?? color.roof,
  });
  if (level === 0) return;
  const order = areaSign(shape);
  for (const [i, [a, b]] of pairs(closed(shape)).entries()) {
    const wall = edge(a, b, order);
    if (wall.length < 2.35) continue;
    trimBand(out, wall, masonry, design.timber ? color.ivory : color.slab, 0.19);
    trimBand(out, wall, top - 0.27, design.timber ? color.ivory : color.slab, 0.24);
    const bay = level === 1 ? design.bay * 1.3 : design.bay;
    const count = Math.max(1, Math.round(wall.length / bay));
    for (const [row, [sill, height, width]] of design.windows.entries()) {
      const y = design.base + sill;
      if (y + height * 0.55 < Math.min(grade(a), grade(b))) continue;
      if (design.timber && row > 0 && level >= 2)
        trimBand(out, wall, y - 0.52, color.shadedBoard, 0.085, 0.045);
      for (let j = 0; j < count; j++) {
        const x = ((j + 0.5) * wall.length) / count;
        if (design.frontIndex === i && row === 0 && Math.abs(x - wall.length / 2) < 2.3) continue;
        const half = Math.min(width / 2, (wall.length / count) * 0.24);
        const tint = (j + row + i) % 4 === 1 ? color.glassLit : color.glass;
        opening(
          out,
          wall,
          x - half,
          x + half,
          y,
          y + height,
          'trim',
          tint,
          'glass',
          design.annex ? color.timber : color.ivory,
          level - 1,
          0.032,
        );
        if (level < 2) continue;
        if (design.timber && design.base + sill > masonry) {
          const trim = design.annex ? color.timber : color.grayGreen;
          for (const sign of [-1, 1]) {
            const a = x + sign * (half + 0.09);
            const b = x + sign * (half + (design.annex ? 0.23 : 0.43));
            panel(out, 'trim', wall, Math.min(a, b), Math.max(a, b), y, y + height, 0.066, trim);
            if (level === 3 && !design.annex) {
              for (let h = 0.17; h < height - 0.1; h += 0.23)
                panel(
                  out,
                  'trim',
                  wall,
                  Math.min(a, b) + 0.028,
                  Math.max(a, b) - 0.028,
                  y + h,
                  y + h + 0.027,
                  0.087,
                  color.shadedBoard,
                );
            }
          }
        }
        panel(
          out,
          'trim',
          wall,
          x - half,
          x + half,
          y + height * 0.53,
          y + height * 0.53 + 0.045,
          0.069,
          design.annex ? color.timber : color.ivory,
        );
      }
    }
    if (level >= 2 && design.annex) {
      for (let j = 0; j <= count; j++) {
        const x = 0.09 + (j / count) * (wall.length - 0.18);
        panel(out, 'trim', wall, x - 0.085, x + 0.085, masonry, top - 0.18, 0.087, color.timber);
      }
      for (const [y] of design.windows.slice(1))
        trimBand(out, wall, design.base + y - 0.62, color.timber, 0.2, 0.09);
    }
    if (
      level < 3 ||
      !design.timber ||
      design.annex ||
      (design.frontIndex !== i && wall.length < 18)
    )
      continue;
    for (let y = masonry + 0.24; y < top - 0.38; y += 0.24)
      trimBand(out, wall, y, color.seam, 0.029, 0.015);
  }
}

function canopy(out, { center, width, from, to, y, rise, curved = false }, level) {
  const count = curved ? [6, 8, 12, 16][level] : 2;
  const profile = (i) => {
    const t = (2 * i) / count - 1;
    const lateral = Math.abs(t);
    return [
      center + (t * width) / 2,
      y + rise * (curved ? 0.5 + 0.5 * Math.cos(Math.PI * lateral) + 0.1 * lateral : 1 - lateral),
    ];
  };
  for (let i = 0; i < count; i++) {
    const [a, highA] = profile(i);
    const [b, highB] = profile(i + 1);
    face(
      out,
      'roof',
      [
        [a, highA, from],
        [b, highB, from],
        [b, highB + 0.21, to],
        [a, highA + 0.21, to],
      ],
      roofFacing,
      curved ? color.copper : color.roof,
    );
    beam(
      out,
      'trim',
      [a, highA - 0.075, from],
      [b, highB - 0.075, from],
      0.22,
      0.22,
      curved ? color.timber : color.ivory,
    );
    if (level > 1)
      beam(out, 'paintedMetal', [a, highA, from], [a, highA + 0.21, to], 0.033, 0.07, color.ridge);
  }
}

function entryPorch(out, level) {
  const center = -3.2;
  const front = level ? -26.86 : -26.79;
  const back = -20.58;
  const left = center - 4.6;
  const right = center + 4.6;
  const sill = Math.max(0.43, grade([center, front]) + 0.38);
  const y = sill + 3.84;
  block(out, 'stone', left, sill - 0.58, front, right - left, 0.58, back - front, color.stone);
  stairs(
    out,
    grade,
    'stone',
    left + 1.48,
    right - 1.48,
    front - 2,
    front,
    sill,
    level > 1 ? 6 : 3,
    color.stone,
  );
  canopy(out, { center, width: 10.48, from: front - 0.43, to: back + 0.45, y, rise: 0.82 }, level);
  for (const post of [left + 0.45, right - 0.45]) {
    block(out, 'stone', post - 0.27, sill, front + 0.41, 0.54, 0.64, 0.54, color.moss);
    beam(
      out,
      'trim',
      [post, sill + 0.54, front + 0.7],
      [post, y + 0.11, front + 0.7],
      0.25,
      0.25,
      color.ivory,
    );
    if (level > 0) {
      const sign = Math.sign(center - post);
      beam(
        out,
        'trim',
        [post, y - 0.76, front + 0.7],
        [post + sign * 0.94, y + 0.11, front + 0.7],
        0.14,
        0.17,
        color.ivory,
      );
      beam(
        out,
        'trim',
        [post, y - 0.76, front + 0.7],
        [post, y + 0.14, front + 1.7],
        0.14,
        0.16,
        color.ivory,
      );
    }
  }
  if (level >= 1) {
    opening(
      out,
      historicFront,
      center - 1.37,
      center + 1.37,
      sill,
      sill + 2.88,
      'trim',
      color.glass,
      'glass',
      color.timber,
      level,
      0.14,
    );
    for (const side of [-1, 1]) {
      const a = center + side * 2.03;
      const b = center + side * 3.7;
      opening(
        out,
        historicFront,
        Math.min(a, b),
        Math.max(a, b),
        sill + 0.91,
        sill + 2.86,
        'trim',
        color.glassLit,
        'glass',
        color.timber,
        level,
        0.14,
      );
    }
  }
}

function veranda(out, level) {
  const left = -19.7;
  const right = 13.57;
  const z = -21.94;
  const y = 3.83;
  block(out, 'trim', left, y - 0.24, z, right - left, 0.24, 1.46, color.ivory);
  if (level === 0) return;
  for (const dy of [0.12, 0.94])
    beam(out, 'trim', [left, y + dy, z], [right, y + dy, z], 0.104, 0.12, color.ivory);
  const segments = [0, 12, 34, 60][level];
  for (let i = 0; i <= segments; i++) {
    const x = mix(left, right, i / segments);
    beam(out, 'trim', [x, y, z], [x, y + 1.0, z], 0.082, 0.1, color.ivory);
    if (level >= 2 && i % (level === 2 ? 3 : 5) === 0)
      beam(
        out,
        'trim',
        [x, y - 0.69, z + 1.35],
        [x, y - 0.19, z + 0.14],
        0.11,
        0.14,
        color.shadedBoard,
      );
  }
}

function annexPorch(out, level) {
  const center = -30.8;
  const front = -39.17;
  const sill = Math.max(0.65, grade([center, front]) + 0.13);
  const y = sill + 3.73;
  canopy(
    out,
    { center, width: 8.25, from: front - 0.74, to: -37.45, y, rise: 1.06, curved: true },
    level,
  );
  for (const p of [center - 3.25, center + 3.25]) {
    block(out, 'stone', p - 0.34, sill - 0.35, front + 0.07, 0.68, 0.42, 0.62, color.stone);
    beam(
      out,
      'trim',
      [p, sill, front + 0.36],
      [p, y + 0.32, front + 0.36],
      0.31,
      0.28,
      color.timber,
    );
  }
  if (level >= 1) {
    const w = plane(-38.47, -1);
    opening(
      out,
      w,
      center - 1.38,
      center + 1.38,
      sill,
      sill + 2.7,
      'trim',
      color.glass,
      'glass',
      color.timber,
      level,
    );
  }
}

function build(out, level) {
  const mainBase = d.datums.main;
  const newBase = d.datums.new;
  const annexBase = d.datums.annex;
  const eastBase = d.datums.extension;
  const secondBase = d.datums.secondNew - 1.45;
  exterior(
    out,
    main,
    {
      base: mainBase,
      plinth: 3.64,
      wall: 10.94,
      tint: color.board,
      timber: true,
      frontIndex: 7,
      bay: 3.13,
      windows: [
        [0.86, 1.63, 1.37],
        [4.28, 1.95, 1.14],
        [7.85, 1.86, 1.13],
      ],
    },
    level,
  );
  pitchedRoof(out, { center: [-3.0, -2.8], span: [36.6, 37.6], elevation: [10.95, 15.42] }, level);
  pitchedRoof(
    out,
    { center: [4.33, 9.48], span: [42.3, 20.4], elevation: [11.02, 14.58], hip: 0.34 },
    level,
  );
  pitchedRoof(
    out,
    { center: [21.12, -1.53], span: [42.7, 12.9], angle: Math.PI / 2, elevation: [11.04, 14.02] },
    level,
  );
  pitchedRoof(
    out,
    { center: [-17.55, 18.06], span: [23.5, 11.1], angle: 1.75, elevation: [11.0, 13.31] },
    level,
  );
  veranda(out, level);
  entryPorch(out, level);

  exterior(
    out,
    newBuilding,
    {
      base: newBase,
      plinth: 0.66,
      wall: 7.83,
      tint: color.board,
      timber: true,
      bay: 3.02,
      windows: [
        [1.51, 1.69, 1.18],
        [4.8, 1.64, 1.15],
      ],
    },
    level,
  );
  pitchedRoof(
    out,
    {
      center: [-34.38, 43.64],
      span: [37.9, 19.0],
      angle: -1.071,
      elevation: [newBase + 7.83, newBase + 11.34],
      hip: 0.24,
    },
    level,
  );

  exterior(
    out,
    d.annex,
    {
      base: annexBase,
      plinth: 0.82,
      wall: 10.15,
      tint: color.plaster,
      timber: true,
      annex: true,
      bay: 2.87,
      windows: [
        [1.24, 1.69, 1.34],
        [4.36, 1.71, 1.4],
        [7.52, 1.65, 1.37],
      ],
    },
    level,
  );
  pitchedRoof(
    out,
    { center: [-41.21, -25.72], span: [29.9, 19.8], elevation: [10.19, 13.81], tint: color.copper },
    level,
  );
  pitchedRoof(
    out,
    {
      center: [-32.39, -28.28],
      span: [23.3, 17.8],
      angle: Math.PI / 2,
      elevation: [10.29, 14.93],
      hip: 0,
      tint: color.copper,
    },
    level,
  );
  pitchedRoof(
    out,
    {
      center: [-23.64, -30.1],
      span: [11.6, 9.75],
      elevation: [10.22, 12.86],
      hip: 0,
      tint: color.copper,
    },
    level,
  );
  annexPorch(out, level);

  exterior(
    out,
    extension,
    {
      base: eastBase,
      plinth: 0.54,
      wall: 6.5,
      tint: color.shadedBoard,
      roof: color.roof,
      bay: 3.45,
      windows: [
        [1.11, 1.42, 1.46],
        [4.23, 1.44, 1.46],
      ],
    },
    level,
  );
  pitchedRoof(
    out,
    {
      center: [46.57, -15.43],
      span: [38.6, 10.13],
      angle: Math.PI / 2,
      elevation: [eastBase + 6.5, eastBase + 9.0],
      hip: 0.16,
    },
    level,
  );
  pitchedRoof(
    out,
    {
      center: [34.34, -9.23],
      span: [18.1, 9.6],
      angle: -0.445,
      elevation: [eastBase + 6.58, eastBase + 8.3],
    },
    level,
  );

  exterior(
    out,
    d.secondNew,
    {
      base: secondBase,
      plinth: 0.48,
      wall: 15.25,
      tint: color.concrete,
      roof: color.roof,
      bay: 2.83,
      windows: [
        [0.92, 1.35, 1.63],
        [3.71, 1.51, 1.76],
        [6.58, 1.51, 1.76],
        [9.45, 1.51, 1.76],
        [12.31, 1.51, 1.76],
      ],
    },
    level,
  );
  for (const [a, b] of pairs(closed(d.secondNew))) {
    const w = edge(a, b, areaSign(d.secondNew));
    trimBand(out, w, secondBase + 14.78, color.slab, 0.54);
    if (level >= 2)
      for (let i = 1; i <= 4; i++)
        trimBand(out, w, secondBase + i * 2.88 + 0.06, color.slab, 0.16, 0.09);
  }
  block(out, 'walls', 39.3, secondBase + 15.25, 21.9, 5.4, 1.8, 4.1, color.concrete);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'nikko-kanaya-hotel-model.mjs';
const camera = [128, 76, -148];
const lookAt = [-2, 10, 8];
export const nikkoKanayaHotelAsset = {
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
  groundContactBasis:
    'Original GSI elevation for the entry courtyard and stepped wing foundations.',
  brief:
    'The standing hillside hotel in Nikkō, with the 1893 clapboard Main over its stone ground floor, the early New Building, copper-roofed Annex and 1961 Second New Building.',
  camera,
  lookAt,
  sunDirection: [85, 111, -120],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: [d.outline, d.annex, d.secondNew],
    minimumCoverage: 0.92,
    basis: 'Native mapped outlines of the main hotel, detached Annex and Second New Building.',
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'metal_painted'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    {
      name: 'stone-base-clapboards-and-carriage-entrance',
      position: [17, 8.2, -51],
      lookAt: [-3.5, 7.1, -20],
    },
    { name: 'annex-copper-and-karahafu', position: [-64, 19, -73], lookAt: [-36, 8.2, -28.0] },
    { name: 'upper-new-building-and-hillside', position: [-84, 49, 87], lookAt: [-23, 13, 24] },
    { name: 'second-new-building', position: [88, 35, 67], lookAt: [28, 12, 13] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'nikko-kanaya-hotel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.18,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries({ district: 0.55, street: 0.19, closeup: 0.061 }).map(
        ([name, errorMeters]) => [name, { export: name, errorMeters, surfaces }],
      ),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors, ODbL 1.0. GSI Japan elevation data.',
};
