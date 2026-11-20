import fs from 'node:fs';
import { createRequire } from 'node:module';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireGeometry = createRequire(new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url));
const { default: earcut } = requireGeometry('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const field = read('terrain-grid.json');
const geometry = plan.dimensions;
const tint = {
  wall: rgb('c7ac80'),
  oldWall: rgb('b6a081'),
  band: rgb('d6c298'),
  portal: rgb('decaa0'),
  shadow: rgb('806847'),
  roof: rgb('aa9478'),
  plinth: rgb('ad9c82'),
  marble: rgb('c2b6a5'),
  wood: rgb('6b4630'),
  lattice: rgb('a2794d'),
  interior: rgb('292522'),
  water: rgb('638181'),
};
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: .93, metallic: 0 },
  roof: { slot: 'roof', graph: 'plaster_lime', roughness: .94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: .89, metallic: 0 },
  marble: { slot: 'foundation', graph: 'stone_marble', roughness: .84, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: .88, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: .91, metallic: 0 },
};

function panel(out, slot, points, color) {
  const normal = normalFor(...points);
  if (points.length === 4) quad(out, slot, points, normal, color);
  else out.addConvexPolygon(slot, 'palette:#ffffff', points, normal, p => [p[0], p[1] + p[2]], color);
}

function cap(out, slot, ring, y, color, direction = 1) {
  const triangles = earcut(ring.flat(), null, 2);
  for (let i = 0; i < triangles.length; i += 3) {
    const points = triangles.slice(i, i + 3).map(j => [ring[j][0], y, ring[j][1]]);
    panel(out, slot, normalFor(...points)[1] * direction > 0 ? points : points.toReversed(), color);
  }
}

function walls(out, slot, ring, floor, top, color) {
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i];
    const [u, v] = ring[(i + 1) % ring.length];
    panel(out, slot, [[u, floor, v], [x, floor, z], [x, top, z], [u, top, v]], color);
  }
}

function ringWithOutwardNormals(ring) {
  const signedArea = ring.reduce((area, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return area + x * v - u * z;
  }, 0);
  return signedArea >= 0 ? ring : ring.toReversed();
}

function grade([x, z]) {
  const a = (x - field.origin[0]) / field.stepMeters;
  const b = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(a), j = Math.floor(b);
  const u = a - i, v = b - j;
  const sample = k => field.heightsMeters[k][i] * (1 - u) + field.heightsMeters[k][i + 1] * u;
  return sample(j) * (1 - v) + sample(j + 1) * v - field.modelDatumElevationMeters;
}

function profile(out, slot, [x, z], dimensions, sides, color, offset = 0) {
  const circle = ([y, radius]) => Array.from({ length: sides }, (_, i) => {
    const angle = offset + 2 * Math.PI * i / sides;
    return [x + radius * Math.cos(angle), y, z + radius * Math.sin(angle)];
  });
  let previous = circle(dimensions[0]);
  for (const row of dimensions.slice(1)) {
    const next = circle(row);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      panel(out, slot, [previous[i], next[i], next[j], previous[j]], color);
    }
    previous = next;
  }
}

function framedWindow(out, center, sill, width, height, point, lod, timber) {
  const left = center - width / 2, right = center + width / 2;
  const head = sill + height, margin = .14;
  const make = (slot, a, b, y0, y1, depth, color) =>
    panel(out, slot, [point(b, y0, depth), point(a, y0, depth), point(a, y1, depth), point(b, y1, depth)], color);
  make('trim', left - margin, right + margin, sill - margin, head + margin, .04, tint.band);
  make('dark', left, right, sill, head, .065, tint.interior);
  if (lod === 1 && !timber) return;
  const span = (a, b, y0, y1, depth, color) =>
    make(timber ? 'wood' : 'trim', a, b, y0, y1, depth, color);
  const depth = timber ? .32 : .095;
  const color = timber ? tint.wood : tint.shadow;
  if (timber) {
    for (const x of [left, right]) {
      panel(out, 'wood', [point(x, sill, .04), point(x, sill, depth), point(x, head, depth), point(x, head, .04)], color);
    }
    panel(out, 'dark', [point(right, sill, depth), point(left, sill, depth), point(left, head, depth), point(right, head, depth)], tint.interior);
  }
  span(left - .1, right + .1, sill - .1, sill + .08, depth + .021, color);
  span(left - .1, right + .1, head - .08, head + .1, depth + .021, color);
  const verticals = timber ? [1, 2, 7, 11][lod] : [0, 1, 2, 3][lod];
  for (let i = 0; i < verticals; i++) {
    const x = left + width * (i + 1) / (verticals + 1);
    span(x - .029, x + .029, sill + .08, head - .08, depth + .033, timber ? tint.lattice : color);
  }
  const horizontals = timber ? [0, 1, 4, 7][lod] : lod - 1;
  for (let i = 0; i < horizontals; i++) {
    const y = sill + height * (i + 1) / (horizontals + 1);
    span(left, right, y - .026, y + .026, depth + .035, timber ? tint.lattice : color);
  }
}

function building(out, part, index, lod) {
  const ring = ringWithOutwardNormals(part.outline);
  const color = index === 0 || index === 1 ? tint.wall : tint.oldWall;
  const floor = index < 2 ? .4 : .15;
  walls(out, 'stone', ring, part.base, part.eave, color);
  walls(out, 'roof', ring, part.eave, part.eave + .42, tint.roof);
  cap(out, 'roof', ring, part.eave + .42, tint.roof);
  cap(out, 'stone', ring, part.base, color, -1);
  if (lod === 0) return;
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i], [u, v] = ring[(i + 1) % ring.length];
    const length = Math.hypot(u - x, v - z), dx = (u - x) / length, dz = (v - z) / length;
    const point = (distance, y, depth) => [x + dx * distance + dz * depth, y, z + dz * distance - dx * depth];
    for (const [y, height, slot, color] of [
      [floor, .47, 'marble', tint.plinth],
      [part.eave - .57, .34, 'trim', tint.band],
    ]) {
      panel(out, slot, [point(length, y, .11), point(0, y, .11), point(0, y + height, .11), point(length, y + height, .11)], color);
    }
    if (length < 4.2 || index === 1 || (index === 3 && x > -25 && u > -25)) continue;
    const count = Math.max(1, Math.round(length / (lod === 1 ? 5.2 : 3.85)));
    for (let window = 0; window < count; window++) {
      const center = length * (window + .5) / count;
      framedWindow(out, center, floor + 1.7, .92, 1.73, point, lod, false);
      framedWindow(out, center, part.eave - 3.35, index > 1 ? 1.46 : 1.26, 2.03, point, lod, true);
    }
  }
}

function recessedArch(out, center, z, floor, spring, width, rise, depth, lod, slot, color) {
  const sides = [6, 8, 14, 24][lod];
  const indices = Array.from({ length: sides + 1 }, (_, i) => Math.PI * i / sides);
  const curve = (angle, frame) => [
    center + (width / 2 + frame) * Math.cos(angle), spring + (rise + frame) * Math.sin(angle), z - depth,
  ];
  const points = indices.map(angle => curve(angle, 0));
  const origin = [center, spring, z - depth];
  for (let i = 0; i < sides; i++) {
    panel(out, slot, [points[i + 1], points[i], origin], color);
    panel(out, 'trim', [curve(indices[i + 1], .23), curve(indices[i], .23), points[i], points[i + 1]], tint.band);
  }
  box(out, slot, [center - width / 2, floor, z - depth - .008], [center + width / 2, spring, z - depth + .09], color);
}

function entrance(out, lod) {
  const { minX, maxX, z } = geometry.entrance;
  const mid = (minX + maxX) / 2;
  const floor = Math.max(.18, geometry.entranceGrade + .8);
  const front = z - .13;
  box(out, 'trim', [minX - .08, floor, front - .12], [maxX + .08, 11.25, z + .13], tint.portal);
  box(out, 'trim', [minX - .14, 10.83, front - .36], [maxX + .14, 11.23, z + .24], tint.band);
  for (const x of [minX + .25, mid - 2.35, mid + 2.35, maxX - .25]) {
    box(out, 'stone', [x - .2, floor, front - .25], [x + .2, 10.83, front + .1], tint.band);
    if (lod > 0) box(out, 'trim', [x - .3, 9.67, front - .32], [x + .3, 10.09, front + .15], tint.plinth);
  }
  recessedArch(out, mid, front, floor, 6, 3.94, 3.85, .24, lod, 'stone', tint.shadow);
  const doorTop = floor + 3.55;
  box(out, 'wood', [mid - 1.31, floor, front - .29], [mid + 1.31, doorTop, front - .18], tint.wood);
  box(out, 'trim', [mid - 1.68, doorTop, front - .37], [mid + 1.68, doorTop + .31, front - .13], tint.band);
  const steps = 5;
  const approach = grade([mid, z - 3.6]) - .14;
  for (let i = 1; i <= steps; i++) {
    const y = approach + (floor - approach) * i / steps;
    box(out, 'marble', [mid - 2.17, approach - .23, z - 4.2 + .56 * i], [mid + 2.17, y, z + .14], tint.plinth);
  }
  for (const x of [mid - 4.13, mid + 4.13]) {
    recessedArch(out, x, front, 2.31, 5.04, 2.32, 1.58, .19, lod, 'stone', tint.oldWall);
    if (lod > 0) {
      box(out, 'dark', [x - .56, 3.02, front - .228], [x + .56, 4.74, front - .18], tint.interior);
      for (const dx of [-.34, 0, .34]) {
        box(out, 'wood', [x + dx - .032, 3.04, front - .26], [x + dx + .032, 4.73, front - .22], tint.lattice);
      }
    }
  }
  if (lod === 0) return;
  const depth = front - .28;
  const ribs = [0, 9, 15, 23][lod];
  for (let i = 1; i < ribs; i++) {
    const t = Math.PI * i / ribs;
    beam(out, 'trim', [mid + .52 * Math.cos(t), 6.03 + .43 * Math.sin(t), depth - .01],
      [mid + 1.9 * Math.cos(t), 6.02 + 3.65 * Math.sin(t), depth - .01], .056, .055, tint.band);
  }
  const centerY = 6.04;
  const medallion = Array.from({ length: 16 }, (_, i) => {
    const angle = 2 * Math.PI * i / 16;
    return [mid + .58 * Math.cos(angle), centerY + .58 * Math.sin(angle), depth - .07];
  });
  for (let i = 0; i < medallion.length; i++) {
    panel(out, 'trim', [medallion[(i + 1) % medallion.length], medallion[i], [mid, centerY, depth - .07]], tint.portal);
  }
  box(out, 'stone', [mid - .08, centerY - .36, depth - .11], [mid + .08, centerY + .36, depth - .065], tint.shadow);
  box(out, 'stone', [mid - .32, centerY - .055, depth - .11], [mid + .32, centerY + .06, depth - .066], tint.shadow);
  for (let i = 1; i < 2 + lod * 2; i++) {
    const x = mid - 1.3 + i * 2.6 / (2 + lod * 2);
    box(out, 'wood', [x - .026, floor + .08, front - .313], [x + .026, doorTop - .08, front - .287], tint.lattice);
  }
}

function fountain(out, center, level, scale, lod) {
  const sides = [6, 10, 16, 23][lod];
  if (lod === 0) {
    const ring = Array.from({ length: sides }, (_, i) => {
      const angle = 2 * Math.PI * i / sides;
      return [center[0] + 1.78 * scale * Math.cos(angle), center[1] + 1.78 * scale * Math.sin(angle)];
    });
    walls(out, 'marble', ring, level, level + .46, tint.plinth);
    cap(out, 'dark', ring, level + .46, tint.water);
    return;
  }
  profile(out, 'marble', center, [[level, 1.78 * scale], [level + .26, 1.78 * scale],
    [level + .46, 1.84 * scale], [level + .51, 1.51 * scale], [level + .28, 1.49 * scale]], sides, tint.plinth);
  const water = Array.from({ length: sides }, (_, i) => {
    const angle = 2 * Math.PI * i / sides;
    return [center[0] + 1.48 * scale * Math.cos(angle), center[1] + 1.48 * scale * Math.sin(angle)];
  });
  cap(out, 'dark', water, level + .305, tint.water);
  profile(out, 'trim', center, [[level + .3, .31 * scale], [level + .73, .23 * scale],
    [level + .84, .51 * scale], [level + .96, .6 * scale]], sides, tint.band);
  cap(out, 'trim', water.map(([x, z]) => [center[0] + (x - center[0]) * .345, center[1] + (z - center[1]) * .345]), level + .961, tint.band);
}

function courtyard(out, lod) {
  const { bounds: [x0, x1, z0, z1], level, columns, fountain: center } = geometry.court;
  box(out, 'marble', [x0, Math.min(level - .33, grade(center) - .22), z0], [x1, level, z1], tint.plinth);
  const porch = { x: x0 + 2.32, roof: level + 3.91 };
  box(out, 'stone', [x0, porch.roof - .18, z0], [porch.x + .69, porch.roof + .09, z1], tint.band);
  for (let i = 0; i < columns; i++) {
    const z = z0 + (z1 - z0) * (i + .51) / columns;
    if (lod === 0) {
      box(out, 'marble', [porch.x - .16, level, z - .16], [porch.x + .16, porch.roof, z + .16], tint.marble);
      continue;
    }
    box(out, 'marble', [porch.x - .27, level, z - .27], [porch.x + .27, level + .27, z + .27], tint.marble);
    profile(out, 'marble', [porch.x, z], [[level + .23, .18], [porch.roof - .43, .133],
      [porch.roof - .29, .17], [porch.roof - .2, .24]], [6, 8, 12, 16][lod], tint.marble);
    box(out, 'trim', [porch.x - .25, porch.roof - .26, z - .24], [porch.x + .25, porch.roof - .1, z + .24], tint.band);
  }
  fountain(out, center, level, 1, lod);
  const wall = geometry.gardenWall;
  for (let i = 1; i < wall.length; i++) {
    const a = wall[i - 1], b = wall[i];
    if (i === 1) continue;
    const base = Math.min(grade(a), grade(b)) - .2;
    beam(out, 'stone', [a[0], base + .64, a[1]], [b[0], base + .64, b[1]], .31, 1.48, tint.oldWall);
  }
  for (const p of geometry.gardenFountains) fountain(out, p, grade(p) - .28, .63, lod);
  if (lod < 2) return;
  for (let i = 1; i <= 3; i++) {
    const x = x0 + (x1 - x0) * i / 4;
    box(out, 'roof', [x - .018, level + .001, z0 + .12], [x + .018, level + .013, z1 - .12], tint.roof);
  }
  const count = lod === 3 ? 15 : 9;
  for (let i = 0; i < count; i++) {
    const z = z0 + .42 + i * .32;
    const step = level + .166 * (i + 1);
    box(out, 'trim', [x1 - 1.32, level, z], [x1 - .18, step, z + .321], tint.band);
  }
}

function eastCupola(out, lod) {
  const { center, roof, top } = geometry.cupola;
  const [x, z] = center;
  const sides = [8, 12, 20, 32][lod];
  box(out, 'stone', [x - 2.02, roof - .06, z - 2.02], [x + 2.02, roof + .91, z + 2.02], tint.oldWall);
  profile(out, 'trim', center, [[roof + .8, 1.71], [roof + .96, 1.94], [roof + 1.64, 1.86],
    [roof + 1.82, 1.77], [roof + 2.63, 1.6], [roof + 3.49, 1.04],
    [top - .65, .48], [top - .37, .09]], sides, tint.band, Math.PI / 8);
  profile(out, 'trim', center, [[top - .45, .1], [top - .32, .21], [top - .09, .12], [top, .04]], sides, tint.shadow);
  if (lod === 0) return;
  for (let i = 0; i < 8; i++) {
    const t = i * Math.PI / 4;
    const at = (r, y) => [x + r * Math.cos(t), y, z + r * Math.sin(t)];
    const from = at(1.79, roof + 2.02), middle = at(1.59, roof + 2.83), to = at(.96, roof + 3.69);
    beam(out, 'stone', from, middle, .08, .08, tint.oldWall);
    beam(out, 'stone', middle, to, .075, .072, tint.oldWall);
  }
}

function build(out, lod) {
  for (const [index, buildingPart] of geometry.buildings.entries()) building(out, buildingPart, index, lod);
  entrance(out, lod);
  courtyard(out, lod);
  eastCupola(out, lod);
}

export const skyline = out => build(out, 0);
export const district = out => build(out, 1);
export const street = out => build(out, 2);
export const closeup = out => build(out, 3);

const recipe = 'coptic-museum-model.mjs';
const camera = [-66, 43, -103];
const lookAt = [-7, 4.8, -5];
const terrain = { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' };
export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  sourceDocuments: plan.requiredSourceDocuments,
  surfaces,
  wikidataId: plan.wikidataId,
  category: 'landmark',
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-exterior',
  groundContactBasis: 'Independent terrain is sampled in the open garden at the entrance. The wing footings and court grade follow the adjacent elevation field.',
  brief: 'Two sandstone museum wings with the neo-Fatimid entrance, east cupola, six-column court and historic mashrabiya windows.',
  camera,
  lookAt,
  sunDirection: [-44, 62, -57],
  embeddedCanonicalGraphs: Object.values(surfaces).map(s => s.graph).filter(Boolean),
  buildingCutout: {
    outline: geometry.outline,
    outlines: geometry.buildings.map(part => part.outline),
    minimumCoverage: .88,
    basis: 'Exact mapped building outlines inside the named museum precinct, preserving neighboring separately identified religious buildings.',
  },
  mediumFiContext: { scale: 1, groundY: -.15, terrain },
  qaCameras: [
    { name: 'neo-fatimid-entrance', position: [16, 10.5, -53], lookAt: [14.7, 5.2, -27] },
    { name: 'old-wing-and-marble-porch', position: [-21, 19, -26], lookAt: [-16.4, 3.6, -1] },
    { name: 'two-wings-and-cupola', position: [-44, 41, 47], lookAt: [-7, 6.7, -4] },
    { name: 'full-museum-standing-in-coptic-cairo', position: [65, 56, -105], lookAt: [-11, 5.4, -6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map(reviewLod => ({
    name: 'coptic-museum-' + reviewLod, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline', export: 'skyline', errorMeters: 2.18, surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: .94, surfaces },
      street: { export: 'street', errorMeters: .38, surfaces },
      closeup: { export: 'closeup', errorMeters: .14, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license. Written architectural facts and ODbL 1.0 OpenStreetMap controls. No photographs incorporated.',
};
