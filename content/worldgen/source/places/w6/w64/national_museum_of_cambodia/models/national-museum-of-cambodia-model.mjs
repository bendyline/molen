import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
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
  rect,
  ring,
  shell,
  stairs,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  lime: 'ae5038',
  panel: '9c4434',
  pilaster: 'c66b4e',
  carving: 'd48156',
  facia: '7b3b31',
  highRoof: '9d4d36',
  tile: '824030',
  fadedTile: 'a6523d',
  wallBase: 'a86c53',
  stair: 'aa8e72',
  wood: '482b24',
  glass: '30403c',
  gravel: 'b6a282',
  planted: '687754',
});
const surfaces = {
  lime: surface('wall', 'plaster_lime', 0.91),
  carved: surface('trim', 'clay_fired', 0.88),
  roof: surface('roof', 'tile_ceramic', 0.76),
  plinth: surface('foundation', 'stone_sandstone_raw', 0.89),
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.86, metallic: 0 },
  court: surface('foundation', 'gravel', 0.93),
};
const portalZ = d.east[3][1];
const coreBack = 18.72;
const coreFront = 37.4;
const left = d.east[4][0];
const right = d.east[3][0];
const wallTop = d.floor + 5.17;
const galleryTop = d.galleryFloor + 4.85;

function drift(out, slot, outline, bottom, top, tint) {
  const sign = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    face(
      out,
      slot,
      [at(a, bottom), at(b, bottom), at(b, top), at(a, top)],
      edge(a, b, sign).normal,
      tint,
    );
  }
}

function relief(out, wall, width, atY, lod) {
  const bar = [
    [-0.35, 0.18],
    [0, 0.56],
    [0.35, 0.18],
    [0, 0.07],
    [-0.35, 0.18],
  ];
  const count = lod > 2 ? 4 : 2;
  for (let i = 0; i < count; i++) {
    const y = atY + i * width * 0.09;
    const scale = width * (0.6 - i * 0.115);
    beamPath(
      out,
      'carved',
      bar.map(([x, h]) => wall.p(x * scale, y + scale * h, 0.12)),
      0.09,
      0.08,
      colors.carving,
    );
  }
}

// The roof ends and ridge are curved in section and extend toward the portal.
function tiledGable(out, cfg, lod) {
  const { half, eave, ridge, near, far, center, turn = false, accent = colors.tile } = cfg;
  const point = (u, y, v) => (turn ? [v, y, center + u] : [center + u, y, v]);
  const cross =
    lod < 2
      ? [
          [-1, 0],
          [0, 1],
          [1, 0],
        ]
      : [
          [-1, 0],
          [-0.79, 0.2],
          [-0.51, 0.53],
          [0, 1],
          [0.51, 0.53],
          [0.79, 0.2],
          [1, 0],
        ];
  const profile = cross.map(([u, h]) => [u * half, mix(eave, ridge, h)]);
  const [front, back] = turn
    ? [
        [1, 0, 0],
        [-1, 0, 0],
      ]
    : [
        [0, 0, 1],
        [0, 0, -1],
      ];
  const bounds = [
    [near, front],
    [far, back],
  ];
  for (const [[a, ha], [b, hb]] of pairs(profile)) {
    face(
      out,
      'roof',
      [point(a, ha, far), point(b, hb, far), point(b, hb, near), point(a, ha, near)],
      up,
      accent,
    );
    for (const [end, normal] of bounds) {
      const va = point(a, ha, end),
        vb = point(b, hb, end);
      const pa = point(a, eave - 0.12, end),
        pb = point(b, eave - 0.12, end);
      face(out, 'lime', [pa, pb, vb, va], normal, colors.panel);
      face(
        out,
        'carved',
        [
          point(a, ha - 0.15, end),
          point(b, hb - 0.15, end),
          point(b, hb + 0.06, end),
          point(a, ha + 0.06, end),
        ],
        normal,
        colors.carving,
      );
    }
  }
  if (lod === 0) return;
  const side = turn ? [0, 0, 1] : [1, 0, 0];
  for (const sign of [-1, 1]) {
    const u = half * sign;
    face(
      out,
      'carved',
      [
        point(u, eave - 0.17, far),
        point(u, eave - 0.17, near),
        point(u, eave, near),
        point(u, eave, far),
      ],
      side.map((v) => v * sign),
      colors.facia,
    );
    if (!cfg.finials) continue;
    for (const [end] of bounds) {
      const sweep = sign * 0.18;
      beamPath(
        out,
        'carved',
        [
          point(u * 0.97, eave - 0.04, end),
          point(u + sweep, eave + 0.37, end),
          point(u + 0.46 * sweep, eave + 0.84, end),
        ],
        0.1,
        0.14,
        colors.carving,
      );
    }
  }
  if (cfg.finials) {
    for (const [end] of bounds) {
      beamPath(
        out,
        'carved',
        [
          point(0, ridge - 0.05, end),
          point(0.14, ridge + 0.36, end),
          point(-0.1, ridge + 0.94, end),
          ...(lod > 1 ? [point(-0.16, ridge + 1.2, end)] : []),
        ],
        0.15,
        0.14,
        colors.carving,
      );
    }
  }
}

function column(out, x, z, base, head, lod) {
  const w = lod > 1 ? 0.57 : 0.67;
  block(out, 'lime', x - w / 2, base, z - w / 2, w, head - base, w, colors.pilaster);
  if (lod === 0) return;
  for (const h of [base, head - 0.26]) {
    block(out, 'carved', x - w * 0.63, h, z - w * 0.63, w * 1.26, 0.26, w * 1.26, colors.carving);
  }
}

function spire(out, p, z, bottom, lod) {
  if (p.spire === 0) return;
  const base = p.spire * 0.32;
  const top = p.spire;
  const profile =
    lod === 0
      ? [
          [0, base],
          [top * 0.54, base * 0.38],
          [top, 0.07],
        ]
      : [
          [0, base],
          [top * 0.08, base],
          [top * 0.16, base * 0.72],
          [top * 0.23, base * 0.78],
          [top * 0.35, base * 0.55],
          [top * 0.42, base * 0.6],
          [top * 0.56, base * 0.35],
          [top * 0.61, base * 0.39],
          [top * 0.79, base * 0.17],
          [top * 0.84, base * 0.18],
          [top, 0.035],
        ];
  ring(
    out,
    'carved',
    [p.x, z],
    profile.map(([h, r]) => [bottom + h, r]),
    [5, 8, 12, 16][lod],
    colors.carving,
  );
}

function portico(out, p, lod) {
  const { x, half, eave, ridge } = p;
  const ne = portalZ + 0.07;
  const y = d.floor + eave;
  const rear = ne - p.porchDepth - 6.4;
  const front = plane(ne - 0.32, 1);
  const l = x - half + 0.48;
  const r = x + half - 0.48;
  const rampStart = ne + 1.9;
  const stairFloor = Math.min(d.floor + 0.09, Math.max(d.floor, grade([x, ne]) + 0.03));
  block(
    out,
    'plinth',
    l,
    d.foundation,
    ne - p.porchDepth,
    r - l,
    stairFloor - d.foundation,
    p.porchDepth - 0.08,
    colors.wallBase,
  );
  stairs(
    out,
    grade,
    'plinth',
    x - half * 0.52,
    x + half * 0.52,
    rampStart,
    ne - 0.06,
    stairFloor,
    [2, 4, 7, 8][lod],
    colors.stair,
  );
  const columns = lod === 0 ? [-0.79, 0.79] : [-0.77, -0.26, 0.26, 0.77];
  for (const side of columns) {
    column(out, x + half * side, ne - 0.43, stairFloor, y - 0.06, lod);
  }
  panel(out, 'carved', front, l, r, y - 0.45, y - 0.12, 0.065, colors.carving);
  tiledGable(
    out,
    {
      half,
      eave: y,
      ridge: d.floor + ridge,
      near: ne,
      far: rear,
      center: x,
      finials: true,
      accent: p.spire ? colors.highRoof : colors.tile,
    },
    lod,
  );
  if (p.spire) {
    const upperEave = y + (ridge - eave) * 0.38;
    const upperRidge = d.floor + ridge + 0.58;
    tiledGable(
      out,
      {
        half: half * 0.61,
        eave: upperEave,
        ridge: upperRidge,
        near: ne - 3.05,
        far: rear - 2.64,
        center: x,
        finials: true,
        accent: colors.fadedTile,
      },
      lod,
    );
    spire(out, p, ne - 9.9, upperRidge - 0.17, lod);
  }
  if (lod > 1) {
    const facade = { normal: front.normal, p: (u, h, depth) => front.p(x + u, h, depth + 0.42) };
    relief(out, facade, half * 0.62, y + 0.59, lod);
  }
}

function masonryOpenings(out, w, positions, bottom, high, lod, width = 1.33) {
  for (const x of positions) {
    opening(
      out,
      w,
      x - width / 2,
      x + width / 2,
      bottom,
      high,
      'carved',
      colors.glass,
      'dark',
      colors.carving,
      lod,
      0.052,
    );
    if (lod > 2) {
      panel(
        out,
        'carved',
        w,
        x - width * 0.64,
        x + width * 0.64,
        bottom - 0.16,
        bottom - 0.05,
        0.11,
        colors.facia,
      );
    }
  }
}

function eastBlock(out, lod) {
  shell(out, rect(left, coreBack, right, coreFront), () => d.foundation, wallTop, {
    wall: 'lime',
    color: colors.lime,
    roof: 'roof',
    roofColor: colors.facia,
  });
  block(
    out,
    'plinth',
    left + 0.01,
    d.foundation,
    coreFront - 0.08,
    right - left - 0.02,
    d.floor - d.foundation + 0.09,
    portalZ - coreFront + 0.09,
    colors.wallBase,
  );
  tiledGable(
    out,
    {
      half: (coreFront - coreBack) / 2 + 0.36,
      center: (coreFront + coreBack) / 2,
      eave: wallTop - 0.08,
      ridge: wallTop + 4.9,
      near: right + 0.27,
      far: left - 0.27,
      turn: true,
    },
    lod,
  );
  const w = plane(coreFront, 1);
  panel(out, 'plinth', w, left, right, d.foundation, d.floor + 0.01, 0.08, colors.wallBase);
  panel(out, 'carved', w, left, right, wallTop - 0.39, wallTop - 0.15, 0.083, colors.pilaster);
  for (const p of d.frontPavilions) {
    if (lod > 0)
      masonryOpenings(
        out,
        w,
        [p.x - p.half * 0.61, p.x + p.half * 0.61],
        d.floor + 1.1,
        d.floor + 3.96,
        lod,
        1.74,
      );
    opening(
      out,
      w,
      p.x - 1.25,
      p.x + 1.25,
      d.floor + 0.01,
      d.floor + 4.09,
      'carved',
      colors.wood,
      'dark',
      colors.carving,
      lod,
      0.06,
    );
    portico(out, p, lod);
  }
  for (const x of [-32.55, -11.27, 11.27, 32.55]) {
    masonryOpenings(out, w, [x], d.floor + 1.48, d.floor + 3.58, lod, 1.49);
  }
}

function ranges(out, lod) {
  const g = d.galleryFloor;
  const inner = d.court;
  const shellTint = { wall: 'lime', color: colors.lime, roof: 'roof', roofColor: colors.facia };
  const rangeNames = [
    {
      bounds: [-29.42, -33.64, -13.05, coreBack],
      roof: { half: 8.36, center: -21.24, near: coreBack + 0.25, far: -34.08 },
    },
    {
      bounds: [13.05, -33.64, 28.7, coreBack],
      roof: { half: 8.02, center: 20.875, near: coreBack + 0.25, far: -34.08 },
    },
    {
      bounds: [-13.05, -33.65, 13.05, -16.83],
      roof: { half: 8.62, center: -25.23, near: 13.56, far: -13.46, turn: true },
    },
    {
      bounds: [-13.05, 16.83, 13.05, coreBack],
      roof: { half: 1.19, center: 17.81, near: 13.56, far: -13.56, turn: true, low: true },
    },
  ];
  for (const { bounds, roof } of rangeNames) {
    shell(out, rect(...bounds), () => d.foundation, galleryTop, shellTint);
    tiledGable(
      out,
      {
        eave: galleryTop - 0.17,
        ridge: galleryTop + (roof.low ? 0.81 : 4.1),
        accent: roof.turn ? colors.fadedTile : colors.tile,
        ...roof,
      },
      lod,
    );
  }
  // The mapped west return carries its own short hipped range.
  shell(out, rect(-34.4, -3.82, -29.39, 6.61), () => d.foundation, g + 3.83, shellTint);
  tiledGable(
    out,
    { half: 2.64, center: -31.9, eave: g + 3.74, ridge: g + 6.29, near: 6.74, far: -4.01 },
    lod,
  );
  const edges = pairs(closed(inner));
  const sign = areaSign(inner);
  for (const [a, b] of edges) {
    const w = edge(a, b, -sign);
    const bays = Math.floor(w.length / 3.7);
    const margin = w.length / bays;
    const base = Math.min(d.galleryFloor, Math.max(grade(a), grade(b)) + 0.14);
    panel(out, 'plinth', w, 0.08, w.length - 0.08, d.foundation, base, 0.11, colors.wallBase);
    panel(
      out,
      'carved',
      w,
      0.08,
      w.length - 0.08,
      galleryTop - 0.55,
      galleryTop - 0.35,
      0.104,
      colors.carving,
    );
    for (let i = 0; i < bays; i++) {
      const p = (i + 0.5) * margin;
      masonryOpenings(out, w, [p], g + 0.35, g + 3.65, lod, Math.min(2.2, margin * 0.58));
      if (lod > 1) {
        const [x, , z] = w.p(i * margin + 0.18, g, 0.25);
        column(out, x, z, g, galleryTop - 0.35, lod);
      }
    }
  }
  if (lod === 0) return;
  for (const [a, b] of pairs(closed(d.west))) {
    if (Math.min(a[1], b[1]) > 18) continue;
    const w = edge(a, b, areaSign(d.west));
    const count = Math.floor(w.length / (lod === 1 ? 6.4 : 4.6));
    const offsets = Array.from({ length: count }, (_, i) => ((i + 0.5) * w.length) / count);
    masonryOpenings(out, w, offsets, g + 1.38, g + 3.7, lod, 1.42);
  }
}

function courtyard(out, lod) {
  const walks = [
    [-12.9, -1.25, 12.9, 1.25],
    [-1.16, -16.58, 1.16, -1.25],
    [-1.16, 1.25, 1.16, 16.58],
  ];
  const patch = (area, tint) => {
    const [x, z, r, b] = area;
    const size = lod < 2 ? 2 : 5;
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const footprint = rect(
          mix(x, r, i / size),
          mix(z, b, j / size),
          mix(x, r, (i + 1) / size),
          mix(z, b, (j + 1) / size),
        );
        const points = footprint.map((p) => at(p, grade(p) + 0.066));
        face(out, 'court', [points[0], points[1], points[2]], up, tint);
        face(out, 'court', [points[0], points[2], points[3]], up, tint);
      }
    }
  };
  for (const walk of walks) patch(walk, colors.gravel);
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const xSpan = [x * 2.14, x * 11.8].sort((a, b) => a - b),
        zSpan = [z * 2.37, z * 15.6].sort((a, b) => a - b);
      patch([xSpan[0], zSpan[0], xSpan[1], zSpan[1]], colors.planted);
    }
  }
}

function build(out, lod) {
  drift(out, 'plinth', d.outline, d.foundation, d.floor + 0.08, colors.wallBase);
  eastBlock(out, lod);
  ranges(out, lod);
  courtyard(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const camera = [-104, 70, 140];
const lookAt = [0, 7, 8];
const recipe = 'national-museum-of-cambodia-model.mjs';
export const cambodiaModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'museum-library',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'exact-native-frame',
  groundContactBasis:
    'Independent original elevation sample on the east apron, with authored west gallery steps and court fitted to the local ground.',
  brief:
    'George Groslier’s National Museum of Cambodia in Phnom Penh, with five small and principal colonnaded roof pavilions, terracotta Khmer gables, and four galleries surrounding an open court.',
  camera,
  lookAt,
  sunDirection: [-32, 51, 61],
  buildingCutout: {
    outline: d.outline,
    outlines: [d.east, d.west],
    minimumCoverage: 0.92,
    basis:
      'The two mapped museum wings replace matching generic outlines. Royal Palace and university geometry is outside the model.',
  },
  mediumFiContext: {
    scale: 1,
    groundY: -0.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'entrance-pavilions-and-khmer-spires', position: [-74, 27, 125], lookAt: [3, 10, 26] },
    { name: 'central-gable-and-portico', position: [-15, 14, 79], lookAt: [2, 10, 38] },
    { name: 'open-court-and-four-galleries', position: [-46, 59, -81], lookAt: [0, 5, 2] },
    { name: 'full-museum-roof-plan', position: [26, 139, 5], lookAt: [0, 0, 5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.1,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1, surfaces },
      street: { export: 'street', errorMeters: 0.43, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.16, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model geometry under the repository license. The 1930 EFEO period plate is public domain. OpenStreetMap data © contributors, ODbL 1.0.',
};
