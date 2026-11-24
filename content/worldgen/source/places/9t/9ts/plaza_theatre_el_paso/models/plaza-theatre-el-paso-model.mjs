import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const control = read('native-map/el-paso-plaza-roof-controls');
const heights = control.heightModelsM;
const [frontX, frontZ] = control.facadeCenter;
const facadeZ = frontZ - control.facadeWallRecessM;
const halfFront = control.facadeWidthM / 2;
const surface = (slot, graph, roughness = 0.9) => ({ slot, graph, roughness });
const surfaces = {
  plaster: surface('wall', 'plaster_lime'),
  metal: surface('trim', 'metal_painted', 0.74),
  tile: surface('trim', 'tile_ceramic', 0.76),
  roof: surface('roof', 'metal_standing_seam', 0.89),
  timber: surface('door', 'wood_plain', 0.82),
  stone: surface('trim', 'stone_limestone'),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.45 },
  accent: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.68 },
};
const warmWall = rgb('b79e82'),
  ornament = rgb('a87753'),
  outline = rgb('775a46'),
  facadeLight = rgb('cca98b'),
  baseColor = rgb('868075'),
  coolStucco = rgb('b8b1a5'),
  lightRoof = rgb('c9c9c4'),
  steelRoof = rgb('a4a59d'),
  steelAccent = rgb('929894'),
  terraCotta = rgb('9d5438'),
  darkWood = rgb('59463a'),
  blueGlass = rgb('414f51'),
  shadedGlass = rgb('333f3c'),
  grille = rgb('3d3c32'),
  whiteBoard = rgb('e2dfcd');
const red = rgb('9e2425'),
  indigo = rgb('283a73'),
  gold = rgb('d19324'),
  pearl = rgb('fae3bd');

function cap(out, slot, ring, height, color) {
  const signed = ring.reduce((area, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return area + p[0] * q[1] - q[0] * p[1];
  }, 0);
  const points = ring.map(([x, z]) => [x, height, z]);
  fan(out, slot, signed > 0 ? points.reverse() : points, color);
}

function volume(out, ring, low, high, wallColor, roofColor) {
  extrude(out, 'plaster', ring, low, high, wallColor, { top: false });
  cap(out, 'roof', ring, high, roofColor);
}

function buildingVolumes(out, level) {
  const outer = frame.geometry.outline.map(([x, z]) => [x, Math.min(z, facadeZ - 0.055)]);
  extrude(out, 'plaster', outer, -0.45, 1.2, baseColor, { top: false });
  const lobby = control.entryWing.map(([x, z]) => [x, Math.min(z, facadeZ - 0.055)]);
  extrude(out, 'plaster', lobby, 1.2, heights.entryWingBody, warmWall, { top: false });
  const coverMain = [lobby[0], lobby[2], lobby[3], lobby[8], lobby[9]];
  const coverFront = [lobby[3], lobby[4], lobby[5], lobby[7], lobby[8]];
  cap(out, 'roof', coverMain, heights.entryWingBody, lightRoof);
  cap(out, 'roof', coverFront, heights.entryWingBody, lightRoof);

  const main = control.auditoriumMassing;
  extrude(out, 'plaster', main, 1.18, heights.auditoriumWall, coolStucco, { top: false });
  cap(out, 'roof', [main[0], main[1], main[4], main[5]], heights.auditoriumWall, steelRoof);
  const { auditorium, stage, entryAnnex, backService } = control.roofControlsLocal;
  volume(
    out,
    auditorium,
    heights.auditoriumWall - 0.5,
    heights.auditoriumRoof,
    coolStucco,
    lightRoof,
  );
  volume(out, stage, 1.18, heights.stageHouse, coolStucco, steelRoof);
  volume(out, backService, 1.18, 15.2, warmWall, steelRoof);
  const annexFaces = [entryAnnex[0], entryAnnex[1], entryAnnex[2], entryAnnex[6]];
  volume(out, annexFaces, 1.17, 9.55, warmWall, lightRoof);

  const stageFace = wallFace(stage[1], stage[0]);
  if (level > 0) {
    fbox(
      out,
      'stone',
      stageFace,
      0,
      stageFace.length,
      heights.stageHouse - 0.25,
      heights.stageHouse + 0.13,
      -0.18,
      0.2,
      baseColor,
    );
    for (let i = 1; i <= 6; i++) {
      const u = (stageFace.length * i) / 7;
      fbox(
        out,
        'stone',
        stageFace,
        u - 0.16,
        u + 0.16,
        2.9,
        heights.stageHouse - 0.58,
        0.006,
        0.16,
        coolStucco,
      );
    }
  }
  if (level >= 2) {
    const length = (stage[1][0] - stage[0][0]) * 0.66;
    const x = (stage[2][0] + stage[0][0]) / 2;
    const z = (stage[2][1] + stage[0][1]) / 2;
    abox(
      out,
      'roof',
      [x - length / 2, heights.stageHouse, z - 2.4],
      [x + length / 2, heights.stageHouse + 0.7, z + 2.4],
      lightRoof,
    );
    for (const off of [-5.4, 0, 5.4])
      abox(
        out,
        'roof',
        [x + off - 0.82, heights.stageHouse + 0.58, z - 0.85],
        [x + off + 0.82, heights.stageHouse + 1.11, z + 0.85],
        steelAccent,
      );
    const back = wallFace(main[0], main[1]);
    for (const x of [6, 14.5, 23.7])
      opening(out, back, x, 3.1, 2.2, 2.95, {
        frameSlot: 'stone',
        glassSlot: 'metal',
        frame: baseColor,
        glass: steelAccent,
        frameWidth: 0.12,
        frameDepth: 0.09,
        sill: false,
      });
  }
}

function junctionTower(out, level) {
  const center = control.towerCenterEstimate;
  const corners = level === 0 ? 8 : 12;
  const ring = (y, r) => [y, r, r];
  const upper = heights.junctionCupola;
  lathe(
    out,
    'plaster',
    center,
    [
      ring(8.5, 2.56),
      ring(14.15, 2.56),
      ring(14.15, 2.03),
      ring(17.83, 2.03),
      ring(17.83, 1.51),
      ring(20.11, 1.51),
    ],
    corners,
    warmWall,
  );
  lathe(
    out,
    'tile',
    center,
    [
      ring(20.03, 1.67),
      ring(20.34, 1.68),
      ring(21.09, 1.37),
      ring(21.48, 0.97),
      ring(22.0, 0.31),
      ring(22.13, 0.13),
    ],
    corners,
    terraCotta,
  );
  lathe(out, 'metal', center, [ring(22.07, 0.145), ring(upper, 0.035)], 8, outline);
  if (level > 0)
    for (const [y, r] of [
      [14.12, 2.63],
      [17.78, 2.11],
      [20.01, 1.62],
    ])
      lathe(out, 'stone', center, [ring(y - 0.1, r), ring(y + 0.14, r)], corners, facadeLight);
}

const crest = [
  [-1.0, 7.67],
  [-0.93, 7.67],
  [-0.87, 7.83],
  [-0.84, 8.16],
  [-0.78, 8.31],
  [-0.78, 9.89],
  [-0.72, 9.89],
  [-0.72, 10.03],
  [-0.64, 10.07],
  [-0.58, 10.28],
  [-0.53, 10.68],
  [-0.46, 10.85],
  [-0.43, 10.85],
  [-0.43, 11.03],
  [-0.36, 11.1],
  [-0.29, 11.37],
  [-0.25, 11.61],
  [-0.18, 11.63],
  [-0.18, 11.99],
  [-0.12, 11.99],
  [-0.077, 12.12],
  [-0.05, 12.44],
  [-0.04, 12.44],
  [0, 12.52],
];
const crestProfile = [
  ...crest,
  ...crest
    .slice(0, -1)
    .reverse()
    .map(([x, y]) => [-x, y]),
];

function shoulders(out, f, level) {
  const depth = -0.44;
  for (let i = 0; i + 1 < crestProfile.length; i++) {
    const [p1, y1] = crestProfile[i],
      [p2, y2] = crestProfile[i + 1];
    const u = p1 * halfFront,
      v = p2 * halfFront;
    if (v - u < 0.0003) continue;
    quad4(out, 'plaster', f.P(u, 7.51), f.P(v, 7.51), f.P(v, y2), f.P(u, y1), warmWall);
    quad4(
      out,
      'plaster',
      f.P(v, 7.51, depth),
      f.P(u, 7.51, depth),
      f.P(u, y1, depth),
      f.P(v, y2, depth),
      warmWall,
    );
    quad4(out, 'stone', f.P(u, y1), f.P(v, y2), f.P(v, y2, depth), f.P(u, y1, depth), outline);
    quad4(
      out,
      'stone',
      f.P(u, y1 - 0.08, 0.06),
      f.P(v, y2 - 0.08, 0.06),
      f.P(v, y2 + 0.026, 0.06),
      f.P(u, y1 + 0.026, 0.06),
      ornament,
    );
    if (level >= 2)
      quad4(
        out,
        'stone',
        f.P(u, y1 - 0.14, 0.031),
        f.P(v, y2 - 0.14, 0.031),
        f.P(v, y2 - 0.096, 0.031),
        f.P(u, y1 - 0.096, 0.031),
        facadeLight,
      );
  }
  const y = 7.49;
  fbox(out, 'stone', f, -halfFront, halfFront, y, y + 0.094, -0.4, 0.072, ornament);
  for (const [x, start, end] of [
    [0, 12.48, 13.1],
    [-1.36, 11.63, 12.1],
    [1.36, 11.63, 12.1],
  ]) {
    const [px, , pz] = f.P(x, start, -0.25);
    lathe(
      out,
      'stone',
      [px, pz],
      [
        [start, 0.095, 0.095],
        [start + (end - start) * 0.26, 0.07, 0.07],
        [end - 0.05, 0.039, 0.039],
        [end, 0.017, 0.017],
      ],
      level === 0 ? 4 : 8,
      facadeLight,
    );
  }
}

const letters = {
  P: [
    [
      [0.12, 0],
      [0.12, 0.94],
      [0.55, 0.96],
      [0.81, 0.84],
      [0.83, 0.67],
      [0.68, 0.52],
      [0.12, 0.51],
    ],
  ],
  L: [
    [
      [0.18, 0.99],
      [0.18, 0.04],
      [0.67, 0.04],
      [0.87, 0.17],
    ],
  ],
  A: [
    [
      [0.05, 0.04],
      [0.45, 0.98],
      [0.52, 0.98],
      [0.95, 0.04],
    ],
    [
      [0.25, 0.4],
      [0.73, 0.4],
    ],
  ],
  Z: [
    [
      [0.1, 0.98],
      [0.92, 0.98],
      [0.06, 0.05],
      [0.92, 0.05],
    ],
  ],
};
function broadStroke(out, f, a, b, w, d, color) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const k = (w / Math.hypot(dx, dy)) * 0.5;
  const ox = -dy * k,
    oy = dx * k;
  quad4(
    out,
    'accent',
    f.P(a[0] - ox, a[1] - oy, d),
    f.P(b[0] - ox, b[1] - oy, d),
    f.P(b[0] + ox, b[1] + oy, d),
    f.P(a[0] + ox, a[1] + oy, d),
    color,
  );
}
function nameplate(out, f, level) {
  const word = 'PLAZA';
  for (let i = 0; i < word.length; i++) {
    const offset = i - 2;
    const theta = -offset * 0.14;
    const h = 1.34,
      w = 0.86;
    const x = offset * 1.08,
      y = 8.84 - 0.118 * offset * offset;
    const glyph = ([a, b]) => {
      const u = (a - 0.5) * w,
        v = b * h;
      return [
        x + u * Math.cos(theta) - v * Math.sin(theta),
        y + u * Math.sin(theta) + v * Math.cos(theta),
      ];
    };
    for (const stroke of letters[word[i]])
      for (let j = 0; j + 1 < stroke.length; j++) {
        const a = glyph(stroke[j]),
          b = glyph(stroke[j + 1]);
        broadStroke(out, f, a, b, 0.185, 0.03, outline);
        if (level > 0) broadStroke(out, f, a, b, 0.094, 0.036, facadeLight);
      }
  }
}

function balcony(out, f, level) {
  opening(out, f, 0, 10.16, 0.71, 1.62, {
    head: 'round',
    glassSlot: 'tile',
    frameSlot: 'stone',
    glass: outline,
    frame: ornament,
    frameWidth: level >= 1 ? 0.09 : 0,
    frameDepth: 0.064,
    d: 0.01,
    sill: false,
  });
  if (level >= 1) {
    const colors = ['686055', 'aa733c', 'b89674', '584e48', '8d7c58', 'c7b192'].map(rgb);
    for (let row = 0; row < 13; row++) {
      const y = 10.19 + row * 0.121;
      for (let i = 0; i < 6; i++) {
        const u = -0.324 + i * 0.109;
        const a = u + 0.006,
          b = u + 0.107;
        if (y > 11.36 && Math.hypot(Math.max(Math.abs(a), Math.abs(b)), y + 0.105 - 11.42) > 0.335)
          continue;
        quad4(
          out,
          'accent',
          f.P(a, y, 0.015),
          f.P(b, y, 0.015),
          f.P(b, y + 0.116, 0.015),
          f.P(a, y + 0.116, 0.015),
          colors[(i + 3 * row) % colors.length],
        );
      }
    }
  }
  const n = level === 0 ? 4 : level === 1 ? 6 : 12;
  const curve = (i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    return [0.58 * Math.sin(a), 0.51 * Math.cos(a) + 0.055];
  };
  for (let i = 0; i < n; i++) {
    const a = curve(i),
      b = curve(i + 1);
    const A = f.P(a[0], 10.2, a[1]),
      B = f.P(b[0], 10.2, b[1]);
    const edge = wallFace([A[0], A[2]], [B[0], B[2]]);
    fbox(out, 'metal', edge, 0, edge.length, 10.1, 10.22, -0.16, 0.026, grille);
    fbox(out, 'metal', edge, 0, edge.length, 10.79, 10.86, -0.021, 0.018, grille);
    if (level > 0) {
      abox(
        out,
        'metal',
        [A[0] - 0.016, 10.19, A[2] - 0.017],
        [A[0] + 0.016, 10.81, A[2] + 0.017],
        grille,
      );
    }
  }
}

function marquee(out, f, level) {
  const w = halfFront + 0.36,
    front = 1.54,
    y = 2.61,
    top = 4.03;
  fbox(out, 'metal', f, -w, w, y, top, 0.035, front, red);
  fbox(
    out,
    'accent',
    f,
    -w + 0.24,
    w - 0.24,
    y + 0.2,
    top - 0.17,
    front - 0.016,
    front + 0.018,
    whiteBoard,
  );
  for (const side of [-1, 1]) {
    fbox(
      out,
      'accent',
      f,
      side * (w - 0.11) - 0.05,
      side * (w - 0.11) + 0.05,
      y + 0.07,
      top - 0.02,
      front,
      front + 0.041,
      gold,
    );
  }
  fbox(out, 'accent', f, -w, w, y + 0.029, y + 0.098, front, front + 0.045, gold);
  if (level > 0)
    for (const yy of [y + 0.43, y + 0.7, y + 0.98])
      fbox(
        out,
        'accent',
        f,
        -w + 0.26,
        w - 0.26,
        yy,
        yy + 0.014,
        front + 0.018,
        front + 0.024,
        steelAccent,
      );
  const lobes = [12, 12, 20, 28][level];
  const crown = (u) =>
    0.07 +
    0.31 * Math.sin((Math.PI * Math.abs(u)) / w) +
    0.61 * Math.max(0, 1 - Math.abs(u) / 1.38);
  const bands = level === 0 ? [0, 1] : [0, 0.29, 0.55, 0.77, 1];
  const bandColors = [red, gold, indigo, red];
  for (let i = 0; i < lobes; i++) {
    const a = -w + (i * 2 * w) / lobes,
      b = -w + ((i + 1) * 2 * w) / lobes;
    const ya = top + crown(a),
      yb = top + crown(b);
    const middle = (a + b) / 2;
    const point = (u, height, ratio) => {
      const x = Math.abs(middle) < 1.27 ? u * (0.23 + ratio * 0.77) : u;
      return f.P(x, top - 0.033 + (height - top + 0.033) * ratio, front + 0.026);
    };
    for (let j = 0; j + 1 < bands.length; j++)
      quad4(
        out,
        'accent',
        point(a, ya, bands[j]),
        point(b, yb, bands[j]),
        point(b, yb, bands[j + 1]),
        point(a, ya, bands[j + 1]),
        Math.abs(middle) < 1.27 ? bandColors[(j + i) % 4] : bandColors[j],
      );
    if (level >= 2) {
      const p = f.P((a + b) / 2, (ya + yb) / 2 - 0.05, front + 0.047);
      abox(
        out,
        'accent',
        [p[0] - 0.021, p[1] - 0.021, p[2] - 0.012],
        [p[0] + 0.021, p[1] + 0.021, p[2] + 0.014],
        pearl,
      );
    }
  }
  if (level >= 2) {
    const lamps = level === 2 ? 33 : 53;
    for (const yy of [y + 0.105, top - 0.065])
      for (let i = 0; i < lamps; i++) {
        const p = f.P(-w + 0.12 + (i * (2 * w - 0.24)) / (lamps - 1), yy, front + 0.052);
        abox(
          out,
          'accent',
          [p[0] - 0.017, p[1] - 0.015, p[2] - 0.009],
          [p[0] + 0.017, p[1] + 0.015, p[2] + 0.01],
          pearl,
        );
      }
  }
}

function doorsAndWall(out, f, level) {
  fbox(out, 'plaster', f, -halfFront, halfFront, -0.27, 7.54, -0.4, 0, warmWall);
  for (const u of [-2.49, -0.82, 0.82, 2.49]) {
    opening(out, f, u, 0.07, 1.34, 2.23, {
      glassSlot: 'glass',
      frameSlot: 'timber',
      glass: shadedGlass,
      frame: darkWood,
      frameWidth: level >= 1 ? 0.1 : 0,
      frameDepth: 0.065,
      sill: false,
      d: 0.019,
      mullions: level >= 1 ? 1 : 0,
      transoms: level >= 2 ? 3 : 0,
      mullionColor: darkWood,
    });
  }
  for (const u of [-2.06, 0, 2.06])
    opening(out, f, u, 4.53, 0.77, 0.71, {
      glassSlot: 'glass',
      frameSlot: 'timber',
      glass: blueGlass,
      frame: darkWood,
      frameWidth: level > 0 ? 0.077 : 0,
      frameDepth: 0.066,
      sill: level > 0,
      mullions: level >= 2 ? 2 : 0,
      transoms: level >= 2 ? 1 : 0,
      mullionColor: darkWood,
    });
  for (const s of [-1, 1]) {
    fbox(
      out,
      'tile',
      f,
      s * (halfFront - 0.42) - 0.36,
      s * (halfFront - 0.42) + 0.36,
      0.01,
      1.09,
      -0.12,
      0.04,
      outline,
    );
    if (level >= 1) {
      for (let i = 1; i <= 6; i++) {
        const x = s * (halfFront - 0.46),
          y = 4.67 + i * 0.405;
        fbox(out, 'stone', f, x - 0.41, x + 0.41, y, y + 0.018, -0.014, 0.022, ornament);
      }
    }
  }
}

function build(out, level) {
  buildingVolumes(out, level);
  junctionTower(out, level);
  const f = facade([frontX, facadeZ], [1, 0]);
  doorsAndWall(out, f, level);
  shoulders(out, f, level);
  nameplate(out, f, level);
  balcony(out, f, level);
  marquee(out, f, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'plaza-theatre-el-paso-model.mjs';
const camera = [78, 64, 132],
  lookAt = [0, 10.2, 3.4];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'theatre',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Spanish Colonial Revival Plaza Theatre in El Paso, with its scrolled stucco gable, mosaic balcony, decorated marquee, auditorium and tall stage house.',
  camera,
  lookAt,
  sunDirection: [-35, 53, 65],
  mediumFiContext: {
    scale: 0.75,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.92,
    basis:
      'Replace the building outlined as Plaza Theatre, while retaining adjacent historic structures.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'pioneer-plaza-entrance',
      position: [frontX + 1.0, 8.9, frontZ + 25.5],
      lookAt: [frontX, 6.55, facadeZ],
    },
    { name: 'auditorium-stage-house-and-entry-wing', position: camera, lookAt },
    { name: 'stage-house-and-rear-roofs', position: [-79, 64, -98], lookAt: [-3, 10.8, -17] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'plaza-theatre-el-paso-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.91,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.38, surfaces },
      street: { export: 'street', errorMeters: 0.13, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.053, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model from Carol M. Highsmith’s public-domain Library of Congress photograph, public-domain USDA aerial imagery, the named OpenStreetMap outline and USGS 3DEP terrain.',
};
