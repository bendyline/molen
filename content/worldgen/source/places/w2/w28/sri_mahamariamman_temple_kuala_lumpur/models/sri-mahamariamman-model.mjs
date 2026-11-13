/** The 2007 Jalan Tun H.S. Lee frontage of Sri Mahamariamman Temple. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { buildDravidianTower } from '../../../../../../../../packages/worldgen/scripts/dravidian-tower-geometry.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { prism } from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  molding: { slot: 'trim', graph: 'plaster_tadelakt', roughness: 0.91, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'clay_fired', roughness: 0.93, metallic: 0 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  painted: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.87, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    blue: '7b9eaa',
    shadedBlue: '607d8a',
    blueWall: '859da4',
    frame: '8bacb2',
    darkTeal: '4c7174',
    turquoise: '77a29d',
    green: '738b78',
    rose: 'ae8071',
    terracotta: 'aa795f',
    cream: 'c9bda5',
    pale: 'd0c4a9',
    gold: 'a38e5a',
    red: '77514a',
    brick: '8d5546',
    granite: '6b7370',
    concrete: 'aeb2a1',
    beige: 'b6ab90',
    roof: '9e8f7c',
    door: '59534b',
    panelFloor: '74816e',
    stone: 'afaa94',
    mutedOrange: 'b58c61',
    skyBlue: '729eaa',
    ivory: 'c7c2ac',
    skin: 'b9a98b',
  }).map(([k, v]) => [k, rgb(v)]),
);
const lerp = (a, b, t) => a + (b - a) * t;

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = lerp(terrain.heightsMeters[j][i], terrain.heightsMeters[j][i + 1], u - i);
  const b = lerp(terrain.heightsMeters[j + 1][i], terrain.heightsMeters[j + 1][i + 1], u - i);
  return lerp(a, b, v - j) - terrain.modelDatumElevationMeters;
}

function directed(out, slot, vertices, expected, color) {
  for (let i = 1; i < vertices.length - 1; i++) {
    const p = [vertices[0], vertices[i], vertices[i + 1]];
    const n = normalFor(...p);
    if (n.reduce((sum, v, k) => sum + v * expected[k], 0) < 0) p.reverse();
    triangle(out, slot, p, color);
  }
}

function solid(out, slot, poly, low, high, tint) {
  prism(
    (_, vertices, normal) => directed(out, slot, vertices, normal, tint),
    slot,
    { outline: poly, holes: [] },
    low,
    high,
  );
}

function clipRear(polygon, z) {
  const result = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    if (a[1] <= z) result.push(a);
    if (a[1] <= z !== b[1] <= z) result.push([lerp(a[0], b[0], (z - a[1]) / (b[1] - a[1])), z]);
  }
  return result;
}

function hall(out, lod) {
  const shell = clipRear(outline, 16.59);
  solid(out, 'base', shell, -3.0, 1.0, c.granite);
  solid(out, 'plaster', shell, 1.0, 7.15, c.beige);
  solid(out, 'roof', shell, 7.15, 7.55, c.roof);
  const rear = clipRear(outline, -12.8);
  solid(out, 'plaster', rear, 7.52, 8.62, c.concrete);
  solid(out, 'roof', rear, 8.62, 8.94, c.roof);
  box(out, 'base', [-4.7, -0.42, 14.45], [4.7, 0.21, 21.45], c.granite);
  if (lod === 0) return;
  box(out, 'timber', [-3.1, 0.67, 16.58], [3.1, 4.87, 16.71], c.door);
  const shrine = [
    [-4.8, -20.3],
    [4.9, -20.3],
    [4.9, -25.1],
    [-4.8, -25.1],
  ];
  solid(out, 'plaster', shrine, 8.92, 9.68, c.stone);
  for (let tier = 0; tier < 3; tier++) {
    const w = 8.7 - tier * 2.15,
      d = 4.6 - tier * 1.1,
      y = 9.64 + tier * 0.93;
    box(
      out,
      'molding',
      [-w / 2, y, -22.7 - d / 2],
      [w / 2, y + 0.24, -22.7 + d / 2],
      tier % 2 ? c.blue : c.green,
    );
    box(
      out,
      'plaster',
      [-w / 2 + 0.38, y + 0.22, -22.7 - d / 2 + 0.22],
      [w / 2 - 0.38, y + 0.92, -22.7 + d / 2 - 0.22],
      c.stone,
    );
  }
}

function gopuram(out, lod) {
  const p = plan.tower;
  const style = {
    stone: ['plaster', c.blue],
    wall: ['painted', c.cream],
    blue: ['molding', c.shadedBlue],
    green: ['molding', c.turquoise],
    rose: ['painted', c.terracotta],
    gold: ['painted', c.gold],
  };
  buildDravidianTower(
    (role, vertices, expected) => {
      const [slot, tint] = style[role];
      directed(
        out,
        slot,
        vertices.map(([x, y, z]) => [x + p.x, y + p.floor, z + p.z]),
        expected,
        tint,
      );
    },
    p,
    lod,
  );
  const front = p.z + p.depth / 2;
  const edge = p.width / 2;
  const inner = p.openingWidth / 2;
  for (const [a, b] of [
    [-edge, -inner],
    [inner, edge],
  ]) {
    for (const [y0, y1, over, tint] of [
      [-0.18, 0.26, 0.42, c.darkTeal],
      [0.26, 0.47, 0.34, c.shadedBlue],
      [0.57, 0.7, 0.27, c.cream],
      [0.83, 1.03, 0.18, c.terracotta],
    ]) {
      box(
        out,
        'molding',
        [a - over * 0.5, y0, front - 0.12],
        [b + over * 0.5, y1, front + over],
        tint,
      );
    }
  }
  box(out, 'base', [-inner, -0.32, front - 0.12], [inner, 0.19, front + 0.57], c.granite);
  box(
    out,
    'base',
    [-inner - 0.17, -0.29, front + 0.53],
    [inner + 0.17, 0.03, front + 0.92],
    c.granite,
  );
  if (lod === 0) return;
  for (const x of [-4.7, -3.95, -3.16, 3.16, 3.95, 4.7]) {
    box(out, 'molding', [x - 0.11, 1.14, front + 0.08], [x + 0.11, 4.64, front + 0.26], c.cream);
    box(out, 'molding', [x - 0.16, 4.61, front + 0.09], [x + 0.16, 4.87, front + 0.35], c.pale);
  }
  box(
    out,
    'roof',
    [-inner - 0.23, 4.88, front - 0.17],
    [inner + 0.23, 5.15, front + 0.39],
    c.terracotta,
  );
  if (lod < 2) return;
  for (const x of [-1.76, 1.74]) {
    const z = front + 0.51;
    beam(out, 'painted', [x - 0.43, 5.55, z], [x + 0.37, 6.02, z + 0.1], 0.4, 0.28, c.ivory);
    beam(
      out,
      'painted',
      [x + 0.24, 5.98, z + 0.06],
      [x + 0.38, 6.49, z + 0.23],
      0.21,
      0.22,
      c.ivory,
    );
    beam(out, 'painted', [x - 0.36, 5.59, z], [x - 0.55, 5.22, z - 0.08], 0.12, 0.13, c.pale);
    beam(out, 'painted', [x + 0.18, 5.79, z], [x + 0.01, 5.24, z + 0.22], 0.12, 0.13, c.pale);
  }
}

function deity(out, x, y, z, h, palette, pose, lod) {
  const [robe, skin] = palette;
  const sides = lod === 3 ? 8 : 6;
  const rings = [
    radialRing(y, h * 0.15, h * 0.103, sides, [x, z]),
    radialRing(y + h * 0.37, h * 0.097, h * 0.081, sides, [x, z]),
    radialRing(y + h * 0.64, h * 0.145, h * 0.099, sides, [x, z]),
  ];
  loft(out, 'painted', rings, robe, { cap: false });
  sphere(
    out,
    'painted',
    [x, y + h * 0.76, z + 0.008],
    [h * 0.085, h * 0.107, h * 0.075],
    skin,
    sides,
    5,
  );
  loft(
    out,
    'painted',
    [
      radialRing(y + h * 0.83, h * 0.1, h * 0.08, sides, [x, z]),
      radialRing(y + h * 0.98, h * 0.041, h * 0.04, sides, [x, z]),
    ],
    c.gold,
  );
  if (lod < 2) return;
  for (const side of [-1, 1]) {
    const shoulder = [x + side * h * 0.109, y + h * 0.63, z];
    const elbow = [x + side * h * 0.225, y + h * (pose % 2 ? 0.51 : 0.47), z + h * 0.064];
    const wrist = [x + side * h * 0.24, y + h * (pose % 2 ? 0.7 : 0.36), z + h * 0.112];
    beam(out, 'painted', shoulder, elbow, h * 0.061, h * 0.06, skin);
    beam(out, 'painted', elbow, wrist, h * 0.055, h * 0.053, skin);
  }
  if (lod === 3)
    beam(
      out,
      'painted',
      [x - h * 0.075, y + h * 0.6, z + h * 0.09],
      [x + h * 0.075, y + h * 0.6, z + h * 0.09],
      h * 0.033,
      h * 0.032,
      c.gold,
    );
}

function wing(out, range, north, lod) {
  const { front, back, height } = plan.wings;
  const [min, max] = range;
  const ground = grade((min + max) / 2, front + 0.1);
  const underside = north ? Math.min(3.76, ground + 2.5) : 2.53;
  box(out, 'base', [min, -2.7, back], [max, Math.min(1.5, ground + 0.32), front - 0.06], c.granite);
  box(out, 'plaster', [min, -0.75, back], [max, underside + 0.15, front - 1.03], c.red);
  box(out, 'plaster', [min, underside, back], [max, height, front - 0.28], c.blueWall);
  box(
    out,
    'molding',
    [min - 0.12, height - 0.19, back],
    [max + 0.12, height + 0.09, front + 0.18],
    c.frame,
  );
  box(
    out,
    'molding',
    [min, underside - 0.21, front - 0.47],
    [max, underside + 0.02, front + 0.11],
    c.darkTeal,
  );
  if (lod === 0) return;
  const ratios = north ? [0, 0.19, 0.4, 0.62, 0.78, 1] : [0, 0.325, 0.5, 0.69, 0.85, 1];
  const tall = new Set(north ? [0, 1, 3] : [1, 3, 4]);
  const palette = [
    [c.cream, c.skyBlue],
    [c.mutedOrange, c.skin],
    [c.turquoise, c.ivory],
    [c.terracotta, c.pale],
  ];
  for (const [i, t] of ratios.entries()) {
    const x = lerp(min, max, t);
    box(
      out,
      'molding',
      [x - 0.082, underside, front - 0.39],
      [x + 0.082, height - 0.15, front + 0.047],
      c.frame,
    );
    if (i === ratios.length - 1) continue;
    const end = lerp(min, max, ratios[i + 1]);
    const mid = (x + end) / 2;
    const low = Math.max(ground + 0.15, 0.24);
    if (underside - low > 0.45)
      box(
        out,
        'timber',
        [mid - (end - x) * 0.32, low, front - 1.01],
        [mid + (end - x) * 0.32, underside - 0.1, front - 0.925],
        c.red,
      );
    const n = tall.has(i) ? 1 : 3;
    const panelHeight = (height - underside - 0.28) / n;
    for (let row = 0; row < n; row++) {
      const y = underside + row * panelHeight + 0.26;
      if (row > 0)
        box(
          out,
          'molding',
          [x + 0.05, y - 0.27, front - 0.38],
          [end - 0.05, y - 0.15, front + 0.048],
          c.frame,
        );
      const figureH = Math.min(n === 1 ? 3.35 : 1.41, panelHeight * 0.78);
      const figureBase = n === 1 ? y + panelHeight * 0.11 : y;
      box(
        out,
        'molding',
        [mid - figureH * 0.26, figureBase - 0.1, front - 0.31],
        [mid + figureH * 0.26, figureBase + 0.04, front + 0.15],
        c.panelFloor,
      );
      if (lod === 1) {
        box(
          out,
          'painted',
          [mid - figureH * 0.12, figureBase, front - 0.21],
          [mid + figureH * 0.12, figureBase + figureH, front + 0.11],
          palette[i % 4][0],
        );
      } else {
        deity(
          out,
          mid,
          figureBase,
          front - 0.056,
          figureH,
          palette[(i + row + (north ? 1 : 0)) % 4],
          i + row,
          lod,
        );
        if (lod === 3 && n > 1 && end - x > 3.3)
          for (const side of [-1, 1])
            deity(
              out,
              mid + side * (end - x) * 0.23,
              figureBase,
              front - 0.08,
              figureH * 0.76,
              palette[(i + row + 2) % 4],
              i + row + 1,
              lod,
            );
      }
    }
  }
  const signLow = height + 0.1;
  const x0 = min + (max - min) * 0.19,
    x1 = max - (max - min) * 0.13;
  box(
    out,
    'molding',
    [x0, signLow, front - 0.21],
    [x1, signLow + (north ? 0.68 : 0.95), front + 0.07],
    c.pale,
  );
  if (lod >= 2 && north) {
    const shiftX = (x0 + x1) / 2;
    const placeLetter = (slot, _ref, points, normal, _uv, tint) => {
      directed(
        out,
        slot,
        points.map(([x, y, z]) => [x + shiftX, y, z]),
        normal,
        tint,
      );
    };
    lettering(
      { addQuad: placeLetter, addConvexPolygon: placeLetter },
      'SRI MAHA MARIAMMAN TEMPLE DEVASTHANAM',
      {
        width: x1 - x0 - 0.39,
        height: 0.34,
        y: signLow + 0.165,
        z: front + 0.102,
        slot: 'painted',
        stroke: 0.034,
        color: c.brick,
      },
    );
  }
}

function build(out, lod) {
  hall(out, lod);
  gopuram(out, lod);
  wing(out, plan.wings.south, false, lod);
  wing(out, plan.wings.north, true, lod);
}
export const templeSkyline = (out) => build(out, 0);
export const templeDistrict = (out) => build(out, 1);
export const templeStreet = (out) => build(out, 2);
export const templeCloseup = (out) => build(out, 3);
const recipe = 'sri-mahamariamman-model.mjs';
const camera = [-48, 27, 93],
  lookAt = [-1, 9.4, 2.5];
export const templeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: [
    'dravidian-tower-geometry.mjs',
    'khmer-structure-geometry.mjs',
    'heritage-tower-detail-mesh.mjs',
    'polygon-triangulation.mjs',
    'stadium-lettering.mjs',
  ],
  surfaces,
  build: templeCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Kuala Lumpur temple’s five-tier gopuram, blue sculpted street walls and low attached hall.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-19, 32, 36],
  mediumFiContext: {
    scale: 1.6,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'Named temple outline, OpenStreetMap way 1248817862.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'plaster_tadelakt',
    'stone_granite',
    'clay_fired',
    'wood_plain',
  ],
  qaCameras: [
    { name: 'street-gopuram-and-blue-wings', position: [-7, 9.6, 66], lookAt: [0, 9.1, 23] },
    { name: 'gopuram-piers-and-sculpture', position: [-18, 6.6, 48], lookAt: [-1, 10, 23] },
    { name: 'rear-hall-and-roofline', position: [38, 22, -61], lookAt: [0, 7.3, -5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-temple-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'templeSkyline',
    errorMeters: 1.11,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'templeDistrict', 0.48],
        ['street', 'templeStreet', 0.18],
        ['closeup', 'templeCloseup', 0.057],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Mapped envelope is ODbL. The four exact photographs were released under CC0.',
};
