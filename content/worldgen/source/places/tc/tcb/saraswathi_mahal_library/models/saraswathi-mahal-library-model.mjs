/** The photographed public entrance wing in the Thanjavur Palace compound. */
import {readFileSync} from 'node:fs';
import {normalFor} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {face, triangle} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {rgb} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {box} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const inscription = read('facade-inscription');
const [outline] = read('map-frame').geometry.polygons;
const {width, front, rear, floor, spring, vaultRise, eave, nicheTop, bayCenters, bayRadius, porchBack} = plan;
const half = width / 2;
const surfaces = {
  plaster: {slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0},
  stone: {slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.92, metallic: 0},
  tile: {slot: 'foundation', graph: 'stone_limestone', roughness: 0.9, metallic: 0},
  metal: {slot: 'roof', graph: 'metal_standing_seam', roughness: 0.82, metallic: 0.12},
  paint: {slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.86, metallic: 0},
};
const c = Object.fromEntries(Object.entries({
  body: 'b4ae93',
  rear: 'a79f82',
  cream: 'cebba0',
  coping: '6d5a4d',
  roof: '929080',
  floor: '9a7b59',
  dark: '39332a',
  interior: '5e493a',
  brick: '784b44',
  burgundy: '65413c',
  blue: '93acba',
  blueShade: '648083',
  blueDeep: '43575d',
  leaf: '7eaa9a',
  lightLeaf: 'b9cfc1',
  leafShadow: '53836f',
  peach: 'bb866f',
  brass: 'aa8b4e',
  skin: 'b49a7b',
  ivory: 'd5c1a1',
  darkPaint: '4a3b30',
  door: '5c5140',
  canopy: '54839b',
}).map(([key, value]) => [key, rgb(value)]));

function fill(out, slot, points, z, tint, outward = 1) {
  const indices = earcut(points.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const p = indices.slice(i, i + 3).map((j) => [...points[j], z]);
    if (normalFor(...p)[2] * outward < 0) p.reverse();
    triangle(out, slot, p, tint);
  }
}

function rect(out, slot, x0, y0, x1, y1, z, tint) {
  face(out, slot, [[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]], tint);
}

function arch(center, y, radius, rise, segments) {
  return Array.from({length: segments + 1}, (_, i) => {
    const angle = Math.PI * (1 - i / segments);
    return [center + radius * Math.cos(angle), y + rise * Math.sin(angle)];
  });
}

function archedOpening(center, y, radius, rise, bottom, segments) {
  return [[center - radius, bottom], ...arch(center, y, radius, rise, segments), [center + radius, bottom]];
}

function ring(out, slot, a, b, z, tint) {
  for (let i = 0; i < a.length - 1; i++) {
    face(out, slot, [[...a[i],z],[...a[i + 1],z],[...b[i + 1],z],[...b[i],z]], tint);
  }
}

function edge(out, slot, points, zFront, zRear, tint) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    face(out, slot, [[...a,zFront],[...a,zRear],[...b,zRear],[...b,zFront]], tint);
  }
}

function oval(out, slot, x, y, w, h, z, tint, angle, count) {
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const p = Array.from({length: count}, (_, i) => {
    const a = 2 * Math.PI * i / count;
    const u = Math.cos(a) * w;
    const v = Math.sin(a) * h;
    return [x + u * cosine - v * sine, y + u * sine + v * cosine];
  });
  fill(out, slot, p, z, tint);
}

function stroke(out, slot, a, b, width, z, tint) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const r = width / (2 * Math.hypot(dx, dy));
  const x = -dy * r;
  const y = dx * r;
  face(out, slot, [
    [a[0] - x, a[1] - y, z],
    [b[0] - x, b[1] - y, z],
    [b[0] + x, b[1] + y, z],
    [a[0] + x, a[1] + y, z],
  ], tint);
}

function rearWing(out, lod) {
  box(out, 'tile', [-half - 0.06, -0.49, rear - 0.05], [half + 0.06, floor, front + 0.26], c.floor);
  box(out, 'plaster', [-half, floor, rear], [half, 5.91, porchBack - 0.39], c.body);
  box(out, 'plaster', [-half, floor, porchBack - 0.4], [-half + 0.46, 5.94, front], c.cream);
  box(out, 'plaster', [half - 0.46, floor, porchBack - 0.4], [half, 5.94, front], c.body);
  box(out, 'stone', [-half - 0.06, 5.9, rear - 0.05], [half + 0.06, 6.14, front - 0.09], c.roof);
  box(out, 'plaster', [-half - 0.1, 6.12, rear - 0.08], [half + 0.1, 6.37, rear + 0.25], c.body);
  for (const x of [-half - 0.1, half - 0.16])
    box(out, 'plaster', [x, 6.13, rear + 0.25], [x + 0.26, 6.36, front - 0.08], c.body);

  const z = porchBack - 0.38;
  const segments = [5,8,12,16][lod];
  for (const center of bayCenters) {
    const outer = archedOpening(center, 2.66, 2.44, 1.69, floor + 0.035, segments);
    const inner = archedOpening(center, 2.59, 2.26, 1.57, floor + 0.035, segments);
    fill(out, 'plaster', outer, z + 0.018, c.interior);
    fill(out, 'paint', inner, z + 0.041, c.dark);
    const x = center + (center > 0 ? 0.18 : -0.15);
    if (center > 0) {
      fill(out, 'paint', archedOpening(x, 1.8, 0.92, 0.53, floor + 0.014, segments), z + 0.064, c.door);
      rect(out, 'paint', x - 0.71, floor + 0.025, x + 0.71, 1.83, z + 0.078, c.dark);
    } else if (lod > 0) {
      rect(out, 'paint', x - 1.64, 0.58, x + 1.64, 1.68, z + 0.068, c.door);
      for (const dy of [0.65,1.16,1.64])
        rect(out, 'paint', x - 1.62, dy, x + 1.62, dy + 0.034, z + 0.086, c.peach);
    }
  }
  if (lod > 0) {
    box(out, 'stone', [5.92, 2.56, front - 0.56], [7.02, 2.66, front + 0.87], c.door);
    box(out, 'metal', [5.86, 2.66, front - 0.61], [7.08, 2.75, front + 0.94], c.canopy);
    for (const x of [5.96, 6.95])
      box(out, 'metal', [x, floor, front + 0.77], [x + 0.047, 2.68, front + 0.82], c.canopy);
  }
}

function arcade(out, lod) {
  const segments = [6,10,18,26][lod];
  const base = [[-half, floor]];
  for (const center of bayCenters) {
    const inner = archedOpening(center, spring, bayRadius, vaultRise, floor, segments);
    base.push(...inner);
    edge(out, 'plaster', inner, front, front - 0.64, c.interior);
  }
  base.push([half, floor], [half, eave], [-half, eave]);
  fill(out, 'plaster', base, front, c.brick);
  fill(out, 'plaster', base, front - 0.64, c.interior, -1);
  const coping = [[-half, floor], [-half, eave], [half, eave], [half, floor]];
  edge(out, 'stone', coping, front - 0.64, front, c.cream);

  box(out, 'stone', [-half - 0.12, 6.35, front - 0.25], [half + 0.12, 6.48, front + 0.15], c.coping);
  rect(out, 'paint', -half + 0.07, 5.3, half - 0.07, 6.34, front + 0.025, c.blue);
  for (const y of [5.27, 6.25, 6.33]) {
    box(out, 'stone', [-half, y, front - 0.02], [half, y + 0.052, front + 0.075], c.cream);
  }
  for (const center of bayCenters) {
    const radii = [
      [bayRadius, vaultRise],
      [bayRadius + 0.12, vaultRise + 0.11],
      [bayRadius + 0.25, vaultRise + 0.22],
      [bayRadius + 0.39, vaultRise + 0.34],
    ];
    const curves = radii.map(([r,h]) => arch(center, spring, r, h, segments));
    ring(out, 'stone', curves[0], curves[1], front + 0.041, c.cream);
    ring(out, 'paint', curves[1], curves[2], front + 0.065, c.leaf);
    ring(out, 'stone', curves[2], curves[3], front + 0.092, c.peach);
    if (lod >= 2) {
      const outerLine = arch(center, spring, bayRadius + 0.42, vaultRise + 0.36, segments);
      ring(out, 'paint', curves[3], outerLine, front + 0.116, c.ivory);
      for (let i = 1; i < segments; i += lod === 3 ? 1 : 2) {
        const [x,y] = curves[2][i];
        oval(out, 'paint', x, y + 0.032, 0.051, 0.028, front + 0.13, c.brass, 0, 5);
      }
    }
  }
  for (const x of [-6.55, 0, 6.55]) {
    const w = x === 0 ? 0.62 : 0.51;
    box(out, 'stone', [x - w / 2, floor + 0.08, front - 0.16], [x + w / 2, 2.59, front + 0.18], c.cream);
    for (const [y,h,extra,tint] of [[0.22,0.18,0.17,c.coping],[0.4,0.13,0.11,c.peach],[2.48,0.15,0.13,c.brass],[2.63,0.12,0.2,c.leaf],[2.75,0.13,0.25,c.cream]]) {
      box(out, 'stone', [x - w / 2 - extra, y, front - 0.09], [x + w / 2 + extra, y + h, front + extra + 0.16], tint);
    }
    rect(out, 'paint', x - w * 0.31, 0.54, x + w * 0.31, 2.42, front + 0.2, c.leaf);
    if (lod >= 2) {
      for (let i = 0; i < 7; i++) {
        oval(out, 'paint', x + (i % 2 - 0.5) * 0.1, 0.71 + i * 0.24, 0.12, 0.085, front + 0.22, c.ivory, i % 2 ? 0.71 : -0.65, lod === 3 ? 8 : 5);
      }
    }
  }
  if (lod >= 2) foliage(out, lod, segments);
}

function foliage(out, lod, segments) {
  for (const center of bayCenters) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < (lod === 3 ? 12 : 7); i++) {
        const t = i / (lod === 3 ? 11 : 6);
        const y = 3.08 + t * 1.98;
        const ellipseHeight = Math.min(1, (y - spring) / (vaultRise + 0.37));
        const archX = (bayRadius + 0.44) * Math.sqrt(1 - ellipseHeight * ellipseHeight);
        const outside = Math.min(3.35, archX + 0.22 + (0.3 + 0.24 * Math.sin(i * 2.38)) * t);
        const x = center + side * outside;
        oval(out, 'paint', x, y, 0.13 + 0.08 * t, 0.074, front + 0.087, i % 4 ? c.leaf : c.ivory, side * (0.25 + 0.8 * Math.sin(i)), lod === 3 ? 7 : 5);
        if (lod === 3 && i > 3) {
          const nextX = center + side * Math.min(3.38, outside + 0.26);
          stroke(out, 'paint', [x,y], [nextX,y + 0.18], 0.025, front + 0.083, c.lightLeaf);
          oval(out, 'paint', nextX, y + 0.18, 0.12, 0.064, front + 0.086, i % 3 ? c.lightLeaf : c.peach, side * 0.68, 6);
        }
      }
    }
    const crest = arch(center, 5.05, 0.26, 0.28, segments);
    fill(out, 'paint', [[center - 0.26,5.02], ...crest, [center + 0.26,5.02]], front + 0.14, c.leafShadow);
    oval(out, 'paint', center, 5.26, 0.13, 0.14, front + 0.17, c.brass, 0, 8);
  }
}

function niche(out, lod) {
  const segments = [6,10,15,22][lod];
  const upper = archedOpening(0, 6.64, 1.23, 1.18, 5.1, segments);
  const inner = archedOpening(0, 6.61, 1.02, 0.93, 5.24, segments);
  const recess = archedOpening(0, 6.58, 0.83, 0.78, 5.39, segments);
  fill(out, 'plaster', upper, front + 0.26, c.leaf);
  fill(out, 'plaster', upper, front - 0.25, c.body, -1);
  edge(out, 'stone', upper.toReversed(), front + 0.26, front - 0.25, c.blueShade);
  fill(out, 'paint', inner, front + 0.285, c.peach);
  fill(out, 'paint', recess, front + 0.31, c.blueDeep);
  for (const [y,w,tint] of [[5.04,1.87,c.leafShadow],[5.15,2.11,c.blueShade],[5.27,2.3,c.brass],[5.38,2.19,c.cream]]) {
    box(out, 'stone', [-w / 2, y, front - 0.16], [w / 2, y + 0.087, front + 0.4], tint);
  }
  const crest = [[-0.23,7.68],[-0.16,7.95],[0,nicheTop],[0.16,7.95],[0.23,7.68]];
  fill(out, 'paint', crest, front + 0.28, c.leafShadow);
  const z = front + 0.355;
  oval(out, 'paint', 0, 5.66, 0.51, 0.22, z, c.ivory, 0, lod > 1 ? 12 : 7);
  oval(out, 'paint', 0.02, 6.03, 0.27, 0.41, z + 0.012, c.cream, -0.12, lod > 1 ? 12 : 7);
  oval(out, 'paint', -0.02, 6.5, 0.15, 0.2, z + 0.014, c.skin, 0, lod > 1 ? 10 : 7);
  oval(out, 'paint', -0.02, 6.68, 0.13, 0.11, z + 0.013, c.brass, 0, 7);
  if (lod > 0) {
    stroke(out, 'paint', [-0.32,5.9], [0.56,6.45], 0.089, z + 0.03, c.brass);
    oval(out, 'paint', -0.31, 5.91, 0.2, 0.16, z + 0.036, c.peach, 0.26, 9);
    stroke(out, 'paint', [-0.21,6.19], [-0.37,5.99], 0.09, z + 0.047, c.skin);
    stroke(out, 'paint', [0.22,6.21], [0.39,6.4], 0.09, z + 0.047, c.skin);
  }
}

const letters = {
  A:[[[0,0],[.5,1],[1,0]],[[.22,.42],[.78,.42]]],
  B:[[[0,0],[0,1],[.65,1],[.95,.8],[.65,.53],[0,.53]],[[.65,.53],[1,.33],[.81,.04],[0,0]]],
  H:[[[0,0],[0,1]],[[1,0],[1,1]],[[0,.51],[1,.51]]],
  I:[[[.5,0],[.5,1]],[[.17,0],[.83,0]],[[.17,1],[.83,1]]],
  L:[[[0,1],[0,0],[1,0]]],
  M:[[[0,0],[0,1],[.5,.45],[1,1],[1,0]]],
  R:[[[0,0],[0,1],[.62,1],[.94,.81],[.86,.57],[.59,.51],[0,.51]],[[.55,.51],[1,0]]],
  S:[[[1,.86],[.78,1],[.25,1],[0,.77],[.2,.56],[.8,.44],[1,.23],[.78,0],[.19,0],[0,.13]]],
  T:[[[.5,0],[.5,1]],[[0,1],[1,1]]],
  V:[[[0,1],[.5,0],[1,1]]],
  Y:[[[0,1],[.5,.5],[1,1]],[[.5,.5],[.5,0]]],
};

function sign(out, lod) {
  if (lod < 2) return;
  const [columns, rows] = inscription.grid;
  for (const [x0, y0, x1, y1] of inscription.rectangles) {
    rect(
      out, 'paint',
      -6.64 + 5.02 * x0 / columns, 6.008 - 0.36 * y1 / rows,
      -6.64 + 5.02 * x1 / columns, 6.008 - 0.36 * y0 / rows,
      front + 0.061, c.brass,
    );
  }
  const text = 'SARASVATI MAHAL LIBRARY';
  for (let i = 0; i < text.length; i++) {
    const glyph = letters[text[i]];
    if (!glyph) continue;
    for (const line of glyph) {
      for (let j = 1; j < line.length; j++) {
        const project = ([x,y]) => [1.46 + i * 0.239 + x * 0.166, 5.72 + y * 0.24];
        stroke(out, 'paint', project(line[j - 1]), project(line[j]), 0.032, front + 0.062, c.brass);
      }
    }
  }
}

function build(out, lod) {
  rearWing(out, lod);
  arcade(out, lod);
  niche(out, lod);
  sign(out, lod);
}
export const librarySkyline = (out) => build(out, 0);
export const libraryDistrict = (out) => build(out, 1);
export const libraryStreet = (out) => build(out, 2);
export const libraryCloseup = (out) => build(out, 3);
const recipe = 'saraswathi-mahal-library-model.mjs';
const camera = [-12, 7.2, 21.3];
const lookAt = [0, 3.32, 0.9];
export const libraryModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs','polygon-triangulation.mjs'],
  surfaces,
  build: libraryCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'Saraswathi Mahal Library’s recessed two-arch entrance, painted spandrels, blue sign band and raised Saraswati niche.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-12, 17, 20],
  mediumFiContext: {
    scale: 0.7,
    groundY: 0,
    terrain: {descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png'},
  },
  buildingCutout: {
    outline,
    basis: 'Only the estimated public entrance wing within the mapped palace and museum footprint.',
  },
  embeddedCanonicalGraphs: ['plaster_lime','stone_limestone_raw','stone_limestone','metal_standing_seam'],
  qaCameras: [
    {name: 'painted-double-arcade', position: [-1.65, 3.62, 20.1], lookAt: [0, 3.68, 4.38]},
    {name: 'niche-and-porch-depth', position: [9.1, 5.4, 16.4], lookAt: [0.65, 3.86, 4.54]},
    {name: 'wing-return-and-roof', position: [-15.1, 10.3, -13.9], lookAt: [0, 3.15, -0.3]},
  ],
  qaLodCameras: ['skyline','district','street','closeup'].map((reviewLod) => ({
    name: 'whole-library-' + reviewLod, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'librarySkyline',
    errorMeters: 0.66,
    surfaces,
    authoredLevels: Object.fromEntries([
      ['district','libraryDistrict',0.28], ['street','libraryStreet',0.11], ['closeup','libraryCloseup',0.038],
    ].map(([level,name,errorMeters]) => [level, {export: name, errorMeters, surfaces}])),
  },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license. Palace map is ODbL. The exact Qualla photograph is CC0.',
};
