import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  fan,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const layout = read('native-map/giac-lam-native-hall-layout');
const colors = {
  ochre: rgb('be8e52'),
  templeWall: rgb('c18846'),
  pale: rgb('d6bf95'),
  dark: rgb('303a35'),
  green: rgb('4b6960'),
  greenShadow: rgb('334d46'),
  clay: rgb('855e49'),
  brown: rgb('73513c'),
  mortar: rgb('8b8374'),
  stone: rgb('b1a18a'),
  gold: rgb('b8985a'),
  goldDark: rgb('907143'),
  red: rgb('783f39'),
};
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  footing: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.86 },
  ridge: { slot: 'trim', graph: 'tile_glazed', roughness: 0.83 },
  wood: { slot: 'trim', graph: 'wood_vertical', roughness: 0.89 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.86 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.69 },
};

const [cx, cz] = plan.dimensions.stupaCenter;
const stupaGrade = 4.45;
const hex = (radius) =>
  Array.from({ length: 6 }, (_, i) => [
    cx + radius * Math.cos((i * Math.PI) / 3),
    cz - radius * Math.sin((i * Math.PI) / 3),
  ]);

function solid(out, slot, ring, bottom, top, color, { cap = true, topColor = color } = {}) {
  const outline = outwardRing(ring);
  for (let i = 0; i < outline.length; i++) {
    const [x, z] = outline[i];
    const [u, v] = outline[(i + 1) % outline.length];
    quad4(out, slot, [x, bottom, z], [u, bottom, v], [u, top, v], [x, top, z], color);
  }
  if (cap)
    fan(
      out,
      slot,
      outline.map(([x, z]) => [x, top, z]),
      topColor,
    );
}

function eaveRing(base, radius, height, rise, subdivisions) {
  return base.flatMap((p, i) => {
    const q = base[(i + 1) % base.length];
    const points = [];
    for (let j = 0; j < subdivisions; j++) {
      const t = j / subdivisions;
      const uplift = Math.pow(2 * t - 1, 4) * rise;
      points.push([
        cx + radius * (p[0] * (1 - t) + q[0] * t),
        height + uplift,
        cz + radius * (p[1] * (1 - t) + q[1] * t),
      ]);
    }
    return points;
  });
}

function connect(out, slot, outer, inner, color) {
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    quad4(out, slot, outer[i], outer[j], inner[j], inner[i], color);
  }
}

function stupaRoof(out, radius, y, top, level) {
  const unitHex = hex(1).map(([x, z]) => [x - cx, z - cz]);
  const n = [2, 2, 4, 6][level];
  const lip = eaveRing(unitHex, radius, y, radius * 0.19, n);
  const near = eaveRing(unitHex, radius * 0.86, y + radius * 0.1, radius * 0.1, n);
  const neck = eaveRing(
    unitHex,
    radius * (top ? 0.1 : 0.54),
    y + radius * (top ? 0.51 : 0.23),
    0,
    n,
  );
  const bottom = lip.map(([x, h, z]) => [x, h - 0.15, z]);
  connect(out, 'ridge', bottom, lip, colors.green);
  connect(out, 'tile', lip, near, colors.clay);
  connect(out, 'tile', near, neck, colors.brown);
  if (level > 0) {
    const fascia = lip.map(([x, h, z]) => [cx + (x - cx) * 0.98, h, cz + (z - cz) * 0.98]);
    connect(out, 'ridge', lip, fascia, colors.green);
    const roofFoot = eaveRing(unitHex, radius * 0.56, y - 0.29, 0, n);
    connect(out, 'wood', roofFoot, bottom, colors.brown);
  }
  if (level < 2) return;
  for (let j = 0; j < lip.length; j += n) {
    const p = lip[j];
    const q = near[j];
    beam(
      out,
      'ridge',
      [q[0], q[1] + 0.08, q[2]],
      [p[0], p[1] + 0.16, p[2]],
      0.14,
      0.12,
      colors.greenShadow,
    );
    const dx = (p[0] - cx) / radius,
      dz = (p[2] - cz) / radius;
    beam(
      out,
      'trim',
      [p[0] - 0.23 * dx, p[1] + 0.16, p[2] - 0.23 * dz],
      [p[0] + 0.22 * dx, p[1] + 0.35, p[2] + 0.22 * dz],
      0.15,
      0.13,
      colors.goldDark,
    );
    beam(
      out,
      'trim',
      [p[0] + 0.22 * dx, p[1] + 0.35, p[2] + 0.22 * dz],
      [p[0] + 0.1 * dx, p[1] + 0.48, p[2] + 0.1 * dz],
      0.12,
      0.11,
      colors.gold,
    );
  }
}

function stupaStair(out, level, z) {
  const count = level > 1 ? 7 : 3;
  for (let i = 0; i < count; i++) {
    const step = 0.52 * (7 / count);
    abox(
      out,
      'footing',
      [cx - 3.35, stupaGrade - 1.6, z - step * (count - i)],
      [cx + 3.35, stupaGrade + (1.16 * (i + 1)) / count, z - step * (count - i - 1) + 0.003],
      i % 2 ? colors.stone : colors.pale,
      { bottom: false },
    );
  }
}

function stupa(out, level) {
  const edges = hex(5.65);
  const frontZ = edges[1][1];
  const floor = stupaGrade + 1.16;
  solid(out, 'footing', edges, stupaGrade - 3.3, floor, colors.stone);
  stupaStair(out, level, frontZ);
  const centers = [6.1, 9.95, 13.82, 17.62, 21.18, 24.59, 27.53];
  const radii = [6.7, 6.04, 5.49, 4.85, 4.18, 3.55, 3.08];
  const top = stupaGrade + plan.dimensions.relicHeightM;
  for (let i = 0; i < centers.length; i++) {
    const rim = stupaGrade + centers[i];
    const y0 = i === 0 ? floor : stupaGrade + centers[i - 1] + 0.77;
    const r = radii[i];
    const body = hex(i === 0 ? 5.65 : r * 0.69);
    solid(out, 'plaster', body, y0 - 0.01, rim + 0.25, i === 0 ? colors.ochre : colors.pale, {
      cap: false,
    });
    stupaRoof(out, r, rim, i === centers.length - 1, level);
    if (i > 0) {
      const rail = hex(r * 0.94);
      solid(out, 'plaster', rail, y0, y0 + (level === 0 ? 0.6 : 0.28), colors.pale);
      for (let j = 0; j < rail.length; j++) {
        if (level === 0) break;
        const face = wallFace(rail[j], rail[(j + 1) % rail.length]);
        const topRail = y0 + 0.98;
        fbox(out, 'trim', face, 0, face.length, topRail - 0.11, topRail, -0.2, 0, colors.pale);
        if (level === 1) continue;
        const pillars = Math.max(4, Math.floor(face.length * [0, 1.5, 3.4, 4.8][level]));
        for (let k = 0; k <= pillars; k++) {
          const u = Math.min(face.length - 0.05, Math.max(0.05, (face.length * k) / pillars));
          const w = k === 0 || k === pillars ? 0.12 : 0.064;
          fbox(
            out,
            'trim',
            face,
            u - w / 2,
            u + w / 2,
            y0 + 0.27,
            topRail - 0.1,
            -0.16,
            -0.04,
            k === 0 || k === pillars ? colors.pale : colors.greenShadow,
          );
        }
      }
    }
    if (level === 0) continue;
    for (let j = 0; j < body.length; j++) {
      const face = wallFace(body[j], body[(j + 1) % body.length]);
      if (level === 1) {
        const u = face.length / 2;
        const w = i === 0 ? 1.58 : 0.55;
        quad4(
          out,
          'window',
          face.P(u - w, y0 + 0.34, 0.032),
          face.P(u + w, y0 + 0.34, 0.032),
          face.P(u + w, y0 + 2.22, 0.032),
          face.P(u - w, y0 + 2.22, 0.032),
          colors.dark,
        );
        continue;
      }
      if (i === 0 && j === 1) {
        for (const offset of [-1.75, 0, 1.75]) {
          opening(out, face, face.length / 2 + offset, y0 + 0.09, 1.61, 3.24, {
            sill: false,
            d: 0.053,
            frameDepth: 0.06,
            frameWidth: 0.09,
            glass: colors.dark,
            frame: colors.pale,
            glassSlot: 'window',
            frameSlot: 'trim',
            mullions: level > 1 ? 2 : 0,
          });
        }
        if (level > 1) {
          const u = face.length / 2;
          // The aged sign panel is modeled without copying lettering from a photograph.
          fbox(out, 'trim', face, u - 2.3, u + 2.3, rim + 0.33, rim + 0.94, 0.74, 0.91, colors.red);
          fbox(out, 'trim', face, u - 2.2, u + 2.2, rim + 0.4, rim + 0.87, 0.91, 0.94, colors.gold);
        }
      } else {
        const w = i === 0 ? 1.3 : i < 4 ? 1.15 : 0.97;
        opening(out, face, face.length / 2, y0 + 0.33, w, i > 4 ? 1.56 : 2.1, {
          head: 'round',
          d: 0.03,
          glass: colors.dark,
          frame: colors.ochre,
          frameWidth: 0.09,
          frameDepth: 0.06,
          glassSlot: 'window',
          frameSlot: 'trim',
          mullions: level > 1 ? 1 : 0,
        });
      }
    }
  }
  const stem = top - 3.64;
  lathe(
    out,
    'trim',
    [cx, cz],
    [
      [stem, 0.48, 0.48],
      [stem + 0.4, 0.52, 0.52],
      [stem + 0.82, 0.57, 0.57],
      [stem + 1.28, 0.31, 0.31],
      [stem + 1.51, 0.38, 0.38],
      [stem + 2.05, 0.25, 0.25],
      [top - 0.1, 0.09, 0.09],
      [top, 0.026, 0.026],
    ],
    [5, 8, 12, 14][level],
    colors.gold,
  );
}

function pavilionRoof(out, x0, x1, z0, z1, eave, ridge, level, main) {
  const roof = [
    [x0, z1],
    [x1, z1],
    [x1, z0],
    [x0, z0],
  ];
  const x = (x0 + x1) / 2,
    z = (z0 + z1) / 2;
  const alongX = main || x1 - x0 > z1 - z0;
  const w = (x1 - x0) / 2,
    d = (z1 - z0) / 2;
  const ridgeHalf = alongX ? Math.min(w * 0.5, w - 1.18) : Math.min(d * 0.6, d - 1.18);
  const spine = roof.map(([a, b]) => [
    alongX ? x + Math.sign(a - x) * ridgeHalf : x,
    ridge,
    alongX ? z : z + Math.sign(b - z) * ridgeHalf,
  ]);
  const eaves = roof.map(([a, b]) => [a, eave, b]);
  const knees = eaves.map((p, i) => [
    p[0] * 0.61 + spine[i][0] * 0.39,
    eave + 0.33 * (ridge - eave),
    p[2] * 0.61 + spine[i][2] * 0.39,
  ]);
  connect(
    out,
    'ridge',
    eaves.map(([a, y, b]) => [a, y - 0.16, b]),
    eaves,
    colors.green,
  );
  connect(out, 'tile', eaves, knees, colors.clay);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    if (spine[i][0] === spine[j][0] && spine[i][2] === spine[j][2]) {
      tri(out, 'tile', knees[i], knees[j], spine[i], colors.clay);
    } else {
      quad4(out, 'tile', knees[i], knees[j], spine[j], spine[i], colors.clay);
    }
  }
  if (level > 0) {
    const far = alongX ? [x + ridgeHalf, ridge + 0.07, z] : [x, ridge + 0.07, z + ridgeHalf];
    const near = alongX ? [x - ridgeHalf, ridge + 0.07, z] : [x, ridge + 0.07, z - ridgeHalf];
    beam(out, 'ridge', near, far, 0.18, 0.27, colors.greenShadow);
  }
  if (main && level > 1) {
    abox(out, 'trim', [x - 2.13, ridge, z - 0.22], [x + 2.13, ridge + 0.57, z + 0.22], colors.pale);
    abox(
      out,
      'trim',
      [x - 2.33, ridge + 0.56, z - 0.24],
      [x + 2.33, ridge + 0.69, z + 0.24],
      colors.gold,
    );
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const x1 = x + side * (0.33 + i * 0.53);
        const y = ridge + 0.61 + i * 0.16;
        beam(
          out,
          'trim',
          [x1, y, z + 0.02],
          [x1 + side * 0.41, y + 0.38, z - 0.03],
          0.15,
          0.12,
          i % 2 ? colors.green : colors.gold,
        );
      }
    }
  }
}

function hall(out, bounds, eave, ridge, level, main = false) {
  const [x0, x1, z0, z1] = bounds;
  const setback = main ? 1.57 : 0.89;
  const masonry = [
    [x0 + 0.65, z1 - setback],
    [x1 - 0.65, z1 - setback],
    [x1 - 0.65, z0 + 0.53],
    [x0 + 0.65, z0 + 0.53],
  ];
  solid(
    out,
    'footing',
    [
      [x0 + 0.2, z1 + 0.1],
      [x1 - 0.2, z1 + 0.1],
      [x1 - 0.2, z0 + 0.22],
      [x0 + 0.2, z0 + 0.22],
    ],
    -3.55,
    0.34,
    colors.mortar,
    { topColor: colors.stone },
  );
  solid(out, 'plaster', masonry, 0.33, eave - 0.18, main ? colors.templeWall : colors.ochre, {
    cap: false,
  });
  pavilionRoof(out, x0, x1, z0, z1, eave, ridge, level, main);
  if (level === 0) return;
  const front = wallFace(masonry[0], masonry[1]);
  const porch = facade([x0, z1 - 0.52], [1, 0]);
  const bays = main ? 5 : 4;
  const w = x1 - x0;
  for (let i = 0; i <= bays; i++) {
    const u = 1.09 + ((w - 2.18) * i) / bays;
    const half = main ? 0.15 : 0.13;
    fbox(out, 'wood', porch, u - half, u + half, 0.38, eave, -0.17, 0.14, colors.brown);
    if (level > 1)
      fbox(out, 'trim', porch, u - 0.24, u + 0.24, 0.33, 0.58, -0.25, 0.23, colors.stone);
    if (i < bays) {
      const door = main && i % 2 === 0;
      opening(
        out,
        front,
        (front.length * (i + 0.5)) / bays,
        door ? 0.4 : 1.35,
        door ? 1.73 : 1.8,
        door ? 2.94 : 1.56,
        {
          d: 0.03,
          glass: colors.dark,
          frame: colors.greenShadow,
          glassSlot: 'window',
          frameSlot: 'wood',
          sill: false,
          frameWidth: 0.11,
          frameDepth: 0.06,
          mullions: level > 1 ? 2 : 0,
        },
      );
    }
  }
  if (main) {
    const x = (x0 + x1) / 2;
    for (let i = 0; i < 3; i++) {
      const start = z1 + 1.24 - i * 0.38;
      abox(
        out,
        'footing',
        [x - 1.58, -0.84, start - 0.383],
        [x + 1.58, -0.38 + i * 0.24, start],
        colors.stone,
        { bottom: false },
      );
    }
    for (const [a, b] of [
      [x0 + 0.4, x - 1.7],
      [x + 1.7, x1 - 0.4],
    ]) {
      abox(out, 'plaster', [a, 0.33, z1 - 0.16], [b, 0.57, z1 + 0.09], colors.ochre);
      abox(out, 'plaster', [a, 1.27, z1 - 0.17], [b, 1.43, z1 + 0.11], colors.ochre);
      const n = level > 1 ? Math.ceil((b - a) * 2.2) : 5;
      for (let i = 0; i <= n; i++) {
        const u = a + ((b - a) * i) / n;
        const w = i === 0 || i === n ? 0.18 : 0.055;
        abox(
          out,
          'trim',
          [u - w, 0.56, z1 - 0.08],
          [u + w, 1.28, z1 + 0.026],
          i === 0 || i === n ? colors.ochre : colors.pale,
          { bottom: false },
        );
      }
    }
  }
}

const [mainOutline, courtA, courtB] = Object.values(layout.hallFootprints);
const controls = mainOutline.slice(0, -1);
const range = (pairs, axis) => [
  Math.min(...pairs.map((p) => p[axis])),
  Math.max(...pairs.map((p) => p[axis])),
];
const [foreLeft, foreRight] = range(controls.slice(14, 18), 0);
const front = Math.max(...controls.map((p) => p[1]));
const [rearLeft, rearRight] = range(
  controls.filter((p) => p[1] < -51.93),
  0,
);

function build(out, level) {
  stupa(out, level);
  hall(out, [foreLeft, foreRight, -23.6, front], 5.02, 9.2, level, true);
  hall(out, [-16.92, 11.74, -45.9, -23.6], 4.78, 9.45, level);
  hall(out, [rearLeft, rearRight, -69.24, -52.0], 4.57, 8.76, level);
  if (level === 0) return;
  for (const [a, b, c, d] of [
    [-12.5, -5, -52.03, -45.85],
    [3.55, 11.74, -52.03, -45.85],
    [13.18, 19.51, -52.03, -33.5],
  ]) {
    hall(out, [a, b, c, d], 4.05, 5.53, level);
  }
  for (const court of [courtA, courtB]) {
    const ring = court.slice(0, -1);
    solid(out, 'footing', ring, -0.39, 0.04, colors.stone);
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'giac-lam-temple-model.mjs';
const camera = [116, 65, 114];
const lookAt = [0, 11, 1];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: 'Giác Lâm Temple',
  recipe,
  wikidataId: plan.wikidataId,
  category: 'temple',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The linked ochre halls of Giác Lâm under broad clay tiles, and the pale seven-tier Bảo tháp Xá Lợi with raised glazed corners and open balconies.',
  camera,
  lookAt,
  sunDirection: [-32, 63, 40],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: mainOutline.slice(0, -1),
    minimumCoverage: 0.91,
    basis: 'Historic hall footprint from OSM relation 20714367.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_ashlar',
    'tile_ceramic',
    'tile_glazed',
    'wood_vertical',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'seven-tier-relic-stupa', position: [-12, 15, 14], lookAt: [cx, 19, cz] },
    { name: 'historic-hall-front', position: [10, 5.5, 23], lookAt: [-2, 4.3, -6] },
    { name: 'hall-courtyards-and-roofs', position: [36, 48, -12], lookAt: [0, 3.5, -31] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'giac-lam-temple-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.71,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.3, surfaces },
      street: { export: 'street', errorMeters: 0.13, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.04, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model under repository license. Map footprint © OpenStreetMap contributors; public Copernicus DEM GLO-30 elevation data.',
};
