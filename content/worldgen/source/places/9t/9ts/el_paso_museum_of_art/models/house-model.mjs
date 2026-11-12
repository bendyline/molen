/** The 2011 El Paso Museum of Art, built to the mapped plaza entrance and gallery envelope. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { letterAt } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  panel: { slot: 'wall', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'gravel', roughness: 0.95, metallic: 0 },
  blue: { slot: 'wall', graph: 'concrete_panel', roughness: 0.64, metallic: 0 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.64, metallic: 0.16 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.27, metallic: 0.11 },
};
const colors = {
  panel: rgb('dacbb6'),
  roof: rgb('b1aaa0'),
  blue: rgb('3b5279'),
  frame: rgb('313638'),
  glass: rgb('444e56'),
};
const glassLight = rgb('616e79'),
  darkGlass = rgb('393e3e');
const { nativeRing: ring, entry, foundationBottom, floor, wallTop, parapetTop } = plan;
const area = ring.reduce((n, [x, z], i) => {
  const [u, v] = ring[(i + 1) % ring.length];
  return n + x * v - z * u;
}, 0);
const block = (o, k, x0, y0, z0, x1, y1, z1, color = colors[k]) =>
  box(o, k, [x0, y0, z0], [x1, y1, z1], color);
function face(o, k, points, outward, color = colors[k]) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * outward[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(o, k, points, n, color);
  else o.addConvexPolygon(k, 'palette:#ffffff', points, n, ([x, y]) => [x, y], color);
}
function side(a, b) {
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const sign = Math.sign(area);
  const tangent = [(b[0] - a[0]) / width, 0, (b[1] - a[1]) / width];
  const normal = [sign * tangent[2], 0, -sign * tangent[0]];
  const point = (u, y, offset = 0) => [
    a[0] + (u * (b[0] - a[0])) / width + normal[0] * offset,
    y,
    a[1] + (u * (b[1] - a[1])) / width + normal[2] * offset,
  ];
  return { width, normal, tangent, point };
}
function plate(o, k, s, u0, y0, u1, y1, offset = 0, color = colors[k]) {
  const { point: p, normal } = s;
  face(
    o,
    k,
    [p(u0, y0, offset), p(u1, y0, offset), p(u1, y1, offset), p(u0, y1, offset)],
    normal,
    color,
  );
}
function cap(o, k, y, normalY) {
  const raw = new MeshBufferBuilder();
  const loop = area > 0 ? ring : [...ring].reverse();
  if (
    !raw.addCap(
      k,
      'palette:#ffffff',
      loop,
      [],
      () => y,
      [0, normalY, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Cannot triangulate museum envelope');
  const mesh = raw.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = Array.from(mesh.indices.slice(i, i + 3), (j) =>
      Array.from(mesh.positions.slice(j * 3, j * 3 + 3)),
    );
    face(o, k, points, [0, normalY, 0]);
  }
}
function inset(o, k, s, left, bottom, right, top, depth) {
  const { point: p, tangent } = s;
  const rim = [
    [left, bottom],
    [right, bottom],
    [right, top],
    [left, top],
  ];
  for (let i = 0; i < 4; i++) {
    const a = rim[i],
      b = rim[(i + 1) % 4];
    const outward = [[0, 1, 0], tangent.map((v) => -v), [0, -1, 0], tangent][i];
    face(o, k, [p(...a), p(...b), p(...b, -depth), p(...a, -depth)], outward);
  }
}
function glazing(
  o,
  s,
  left,
  bottom,
  right,
  top,
  columns,
  rows,
  lod,
  offset = 0.02,
  tint = colors.glass,
) {
  plate(o, 'frame', s, left - 0.046, bottom - 0.045, right + 0.046, top + 0.045, offset + 0.006);
  plate(o, 'glass', s, left, bottom, right, top, offset + 0.012, tint);
  if (!lod) return;
  for (let i = 1; i < columns; i++) {
    const u = left + ((right - left) * i) / columns;
    plate(o, 'frame', s, u - 0.034, bottom, u + 0.034, top, offset + 0.025);
  }
  for (let i = 1; i < rows; i++) {
    const y = bottom + ((top - bottom) * i) / rows;
    plate(o, 'frame', s, left, y - 0.04, right, y + 0.04, offset + 0.025);
  }
}
function seams(o, s, lod, base = floor) {
  if (!lod) return;
  const spacing = lod > 1 ? 3.25 : 5.2;
  const columns = Math.round(s.width / spacing);
  for (let i = 1; i < columns; i++) {
    const u = (s.width * i) / columns;
    plate(o, 'roof', s, u - 0.012, base, u + 0.012, wallTop, 0.012);
  }
  for (const y of [3.65, 6.61, 8.72]) {
    plate(o, 'roof', s, 0, y, s.width, y + 0.024, 0.012);
  }
}
function museumName(o, s, center) {
  const text = 'EL PASO MUSEUM OF ART';
  const columns = text.length * 12,
    rows = 10,
    width = 5.13,
    height = 0.24;
  const darkBlue = rgb('354a6b');
  function ink(u, v) {
    const i = Math.floor(u);
    const char = text[i];
    const x = (u - i) / 0.75;
    if ((char === 'O' || char === 'U') && x <= 1) {
      return x < 0.16 || x > 0.84 || v < 0.14 || (char === 'O' && v > 0.86);
    }
    return letterAt(text, u, v, 0.125);
  }
  for (let row = 0; row < rows; row++) {
    let start = -1;
    for (let col = 0; col <= columns; col++) {
      const filled = col < columns && ink((col + 0.5) / 12, (row + 0.5) / rows);
      if (filled && start < 0) start = col;
      if (filled || start < 0) continue;
      const right = center + width / 2 - (width * start) / columns;
      const left = center + width / 2 - (width * col) / columns;
      const bottom = 3.62 + (height * row) / rows;
      plate(o, 'frame', s, left, bottom, right, bottom + height / rows, 0.045, darkBlue);
      start = -1;
    }
  }
}
function entrance(o, lod) {
  const s = side(ring[1], ring[3]),
    w = s.width;
  const doorCenter = Math.hypot(entry[0] - ring[1][0], entry[1] - ring[1][1]);
  const left = doorCenter - 3.3,
    right = doorCenter + 3.3,
    top = 3.21,
    depth = 0.67;
  plate(o, 'panel', s, 0, foundationBottom, w, floor);
  plate(o, 'panel', s, 0, floor, left, top);
  plate(o, 'panel', s, right, floor, w, top);
  plate(o, 'panel', s, 0, top, w, parapetTop);
  inset(o, 'panel', s, left, floor, right, top, depth);
  plate(o, 'panel', s, left, floor, right, top, -depth);
  for (let i = 0; i < 3; i++) {
    const advance = (right - left) / 3;
    const u = left + i * advance + 0.13;
    glazing(
      o,
      s,
      u,
      floor + 0.04,
      u + advance - 0.26,
      top - 0.13,
      2,
      2,
      lod,
      -depth + 0.031,
      darkGlass,
    );
  }
  glazing(o, s, left, 4.43, right, 7.84, 6, 4, lod, 0.034, glassLight);
  seams(o, s, lod, top + 0.03);
  if (lod === 3) museumName(o, s, doorCenter);
  plate(o, 'roof', s, 0, 9.91, w, 9.95, 0.036);
}
function plazaWing(o, lod) {
  const s = side(ring[0], ring[1]),
    w = s.width;
  plate(o, 'panel', s, 0, foundationBottom, w, parapetTop);
  const start = w - 23.7;
  plate(o, 'blue', s, start, 0.21, w, 8.02, 0.033);
  glazing(o, s, start + 0.24, 0.24, w - 0.18, 3.53, 10, 2, lod, 0.045, darkGlass);
  glazing(o, s, start + 0.22, 4.71, start + 6.45, 7.61, 3, 2, lod, 0.045, glassLight);
  glazing(o, s, start + 8.62, 4.71, w - 0.14, 7.61, 7, 3, lod, 0.045, glassLight);
  const { point: p, normal, tangent } = s;
  face(
    o,
    'panel',
    [p(start, 8.02), p(w, 8.02), p(w, 8.02, 1.04), p(start, 8.02, 1.04)],
    [0, -1, 0],
  );
  face(
    o,
    'panel',
    [p(start, 8.02, 1.04), p(w, 8.02, 1.04), p(w, 9.79, 1.04), p(start, 9.79, 1.04)],
    normal,
  );
  face(o, 'panel', [p(start, 9.79), p(w, 9.79), p(w, 9.79, 1.04), p(start, 9.79, 1.04)], [0, 1, 0]);
  face(
    o,
    'panel',
    [p(start, 8.02), p(start, 8.02, 1.04), p(start, 9.79, 1.04), p(start, 9.79)],
    tangent.map((v) => -v),
  );
  if (lod > 1)
    for (let i = 1; i <= 9; i++) {
      const u = start + ((w - start) * i) / 10;
      plate(o, 'frame', s, u - 0.011, 3.57, u + 0.011, 4.69, 0.061);
    }
}
export function buildHouse(o, _frame, lod = 3) {
  for (let i = 3; i < ring.length; i++) {
    const s = side(ring[i], ring[(i + 1) % ring.length]);
    plate(o, 'panel', s, 0, foundationBottom, s.width, parapetTop);
    seams(o, s, lod);
    plate(o, 'roof', s, 0, 9.91, s.width, 9.95, 0.022);
    if (lod && i === 17) glazing(o, s, s.width * 0.14, 2.9, s.width * 0.81, 5.25, 6, 2, lod);
  }
  entrance(o, lod);
  plazaWing(o, lod);
  cap(o, 'roof', parapetTop, 1);
  if (lod) cap(o, 'roof', foundationBottom, -1);
  block(o, 'roof', -19, parapetTop, -13.6, 24, parapetTop + 0.73, 14.3);
  if (lod) {
    for (const [x, z] of [
      [-15, 1],
      [-4, 3],
      [7, 5],
      [18, 7],
    ]) {
      block(
        o,
        'frame',
        x - 0.89,
        parapetTop + 0.73,
        z - 0.45,
        x + 0.89,
        parapetTop + 1.04,
        z + 0.45,
      );
    }
  }
}
export const houseSkyline = (mesh, frame) => buildHouse(mesh, frame, 0);
export const houseDistrict = (mesh, frame) => buildHouse(mesh, frame, 1);
export const houseStreet = (mesh, frame) => buildHouse(mesh, frame, 2);
export const houseCloseup = (mesh, frame) => buildHouse(mesh, frame, 3);
const camera = [110, 43, -86],
  lookAt = [5, 4.7, 2];
const modelPath = 'content/worldgen/source/places/9t/9ts/el_paso_museum_of_art';
export const houseModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Two-storey museum with a pale paneled exterior, a recessed plaza entrance, adjoining blue panels and dark glazing, and an angled gallery plan.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  recipeDependencies: ['stadium-lettering.mjs'],
  embeddedCanonicalGraphs: ['concrete_plain', 'gravel', 'concrete_panel', 'metal_painted'],
  qaCameras: [
    {
      name: 'recessed-plaza-entry-and-blue-wing',
      position: [55, 6, -22],
      lookAt: [37.5, 4.25, -9],
    },
    { name: 'whole-gallery-and-angled-rear', position: [-62, 42, 74], lookAt: [4, 4, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: modelPath + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.22,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.14, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.065, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.03, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. The published Qualla photo by Wmpearl is explicitly dedicated to the public domain. Map geometry attributed to OpenStreetMap contributors under ODbL.',
};
