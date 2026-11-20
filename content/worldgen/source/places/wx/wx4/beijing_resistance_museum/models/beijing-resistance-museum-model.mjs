import { readFileSync } from 'node:fs';
import {
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  rect,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  stone: 'ddd6bf',
  trim: 'e3ddc6',
  base: '96968b',
  roof: '454748',
  ridge: '626065',
  glass: '344d5f',
  recess: '393637',
  timber: '87504a',
  woodShadow: '684742',
  timberTrim: 'a16b60',
  bronze: 'a48252',
  metal: '858488',
  tread: 'a5a599',
  yard: 'b4b2a1',
});
const surfaces = {
  stone: surface('wall', 'stone_ashlar', 0.94),
  base: surface('foundation', 'stone_limestone_weathered', 0.96),
  roof: surface('roof', 'tile_ceramic', 0.91),
  timber: surface('trim', 'wood_plain', 0.82),
  metal: surface('trim', 'metal_bronze_cast', 0.77, 0.19),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.53 },
};
const wingRoof = 12.85;
const vestibule = 14.05;
const entranceFloor = 3.98;
const foundation = (p) => Math.min(entranceFloor - 0.2, grade(p) - 0.35);
const front = d.frontZ;

function capWithCourts(out, y) {
  const verts = [d.outline, ...d.courts].flat();
  const holes = [d.outline.length, d.outline.length + d.courts[0].length];
  const indices = earcut(verts.flat(), holes);
  for (let i = 0; i < indices.length; i += 3)
    face(
      out,
      'roof',
      indices.slice(i, i + 3).map((k) => at(verts[k], y)),
      up,
      c.roof,
    );
}

function walls(out, outline, y, top, slot, color, inverse = false) {
  const sign = areaSign(outline) * (inverse ? -1 : 1);
  for (const [a, b] of pairs(closed(outline))) {
    const wall = edge(a, b, sign);
    face(out, slot, [at(a, y(a)), at(b, y(b)), at(b, top), at(a, top)], wall.normal, color);
  }
}

function hipRoof(out, bounds, bottom, rise, inset, level) {
  const [xa, za, xb, zb] = bounds;
  const span = zb - za;
  const ring1 = rect(xa, za, xb, zb);
  const ring2 = rect(xa + inset * 0.73, za + span * 0.16, xb - inset * 0.73, zb - span * 0.16);
  const ring3 = rect(xa + inset, za + span * 0.43, xb - inset, zb - span * 0.43);
  const part = (bottomRing, topRing, y1, y2, color) => {
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      face(
        out,
        'roof',
        [at(bottomRing[i], y1), at(bottomRing[j], y1), at(topRing[j], y2), at(topRing[i], y2)],
        up,
        color,
      );
    }
  };
  part(ring1, ring2, bottom, bottom + rise * 0.44, c.roof);
  part(ring2, ring3, bottom + rise * 0.44, bottom + rise, c.roof);
  face(
    out,
    'roof',
    ring3.map((p) => at(p, bottom + rise)),
    up,
    c.roof,
  );
  if (level > 0) {
    block(
      out,
      'roof',
      xa + inset - 0.08,
      bottom + rise,
      mix(za, zb, 0.5) - 0.1,
      xb - xa - 2 * inset + 0.16,
      0.18,
      0.2,
      c.ridge,
    );
    block(out, 'stone', xa + 0.1, bottom - 0.15, za - 0.03, xb - xa - 0.2, 0.16, 0.21, c.trim);
  }
  if (level > 1) {
    const spacing = level === 2 ? 0.49 : 0.277;
    const xDelta = inset * 0.73;
    for (let x = xa + 0.24; x < xb - 0.22; x += spacing) {
      const top = mix(xa + xDelta, xb - xDelta, (x - xa) / (xb - xa));
      face(
        out,
        'roof',
        [
          [x - 0.042, bottom + 0.025, za + 0.008],
          [x + 0.042, bottom + 0.025, za + 0.008],
          [top + 0.037, bottom + rise * 0.44 + 0.028, za + span * 0.16],
          [top - 0.037, bottom + rise * 0.44 + 0.028, za + span * 0.16],
        ],
        up,
        c.ridge,
      );
    }
  }
}

function facade(out, level) {
  walls(out, d.outline, foundation, entranceFloor, 'base', c.base);
  walls(out, d.outline, () => entranceFloor, wingRoof - 0.5, 'stone', c.stone);
  for (const court of d.courts)
    walls(
      out,
      court,
      () => Math.max(2.65, entranceFloor - 0.7),
      wingRoof - 0.5,
      'stone',
      c.stone,
      true,
    );
  capWithCourts(out, wingRoof - 0.51);

  const [xl, xr] = d.frontWings;
  const [left, right] = d.portal;
  const south = edge([xl, front - 0.018], [xr, front - 0.018]);
  for (const [start, end] of [
    [xl, left],
    [right, xr],
  ]) {
    panel(out, 'glass', south, start - xl, end - xl, 9.48, 12.35, 0.008, c.glass);
    hipRoof(
      out,
      [start - 0.32, front - 0.45, end + 0.32, -27.8],
      wingRoof - 0.12,
      2.51,
      2.85,
      level,
    );
    if (level > 0)
      for (let x = start + 0.95; x < end - 0.14; x += level < 2 ? 2.35 : 1.19)
        panel(out, 'metal', south, x - xl - 0.027, x - xl + 0.027, 9.48, 12.43, 0.018, c.metal);
  }

  // The entrance is a shallow stone frame, with the timber doors behind its lintel.
  const z = d.portalZ;
  const frame = edge([left, z], [right, z]);
  block(out, 'stone', left, 8.73, z, right - left, vestibule - 8.73, 3.2, c.stone);
  for (const x of [left - 1.71, right - 1.46]) {
    block(out, 'stone', x, entranceFloor, z + 0.11, 3.57, 17.91 - entranceFloor, 6.94, c.trim);
    if (level > 0) block(out, 'stone', x + 0.24, 17.91, z + 0.35, 3.09, 0.11, 6.39, c.stone);
  }
  hipRoof(out, [left + 1.1, z - 0.26, right - 1.15, -28.6], vestibule + 0.03, 2.46, 2.68, level);
  const total = right - left;
  const passage = 1.68;
  panel(out, 'glass', frame, passage, total - passage, entranceFloor, 8.72, -0.52, c.recess);
  const bayCount = level === 0 ? 6 : 12;
  const bay = (total - passage * 2) / bayCount;
  for (let i = 0; i < bayCount; i++) {
    if (i === bayCount / 2 - 1 || i === bayCount / 2) continue;
    const x = passage + i * bay;
    panel(
      out,
      'timber',
      frame,
      x + 0.058,
      x + bay - 0.058,
      entranceFloor + 0.12,
      8.05,
      -0.47,
      c.timber,
    );
    if (level > 0)
      for (const [a, b] of [
        [4.44, 5.98],
        [6.27, 7.78],
      ]) {
        const inset = level === 3 ? 0.15 : 0.23;
        panel(out, 'timber', frame, x + inset, x + bay - inset, a, b, -0.456, c.woodShadow);
        if (level > 1)
          panel(
            out,
            'timber',
            frame,
            x + inset * 1.5,
            x + bay - inset * 1.5,
            a + 0.14,
            b - 0.14,
            -0.45,
            c.timberTrim,
          );
      }
    if (level > 1)
      panel(out, 'metal', frame, x + bay * 0.68, x + bay * 0.68 + 0.11, 5.65, 5.9, -0.44, c.bronze);
  }

  if (level > 0) {
    const sides = pairs(closed(d.outline)).slice(1, 12);
    for (const [a, b] of sides) {
      const wall = edge(a, b, areaSign(d.outline));
      if (wall.length < 6) continue;
      const count = Math.max(1, Math.round(wall.length / 4.85));
      for (let i = 0; i < count; i++) {
        const x = ((i + 0.5) * wall.length) / count;
        panel(out, 'glass', wall, x - 0.61, x + 0.61, 8.22, 10.02, 0.017, c.glass);
        if (level > 1)
          trimBlock(out, 'stone', wall, x - 0.7, x + 0.7, 8.03, 8.22, 0.014, 0.13, c.trim);
      }
    }
  }
}

function stair(out, bounds, start, end, count, level) {
  const [left, right, near, far] = bounds;
  const run = (far - near) / count;
  const group = level === 0 ? 2 : 1;
  for (let i = 0; i < count; i += group) {
    const n = Math.min(i + group, count);
    const y = mix(start, end, n / count);
    const frontZ = near + i * run;
    const points = rect(left, frontZ, right, near + n * run + 0.013);
    shell(out, points, (p) => Math.min(y - 0.2, grade(p) - 0.22), y, {
      wall: 'base',
      color: c.base,
      roof: 'base',
      roofColor: c.tread,
    });
    if (level > 0) {
      const line = edge([left, frontZ], [right, frontZ]);
      panel(out, 'stone', line, 0, right - left, y - 0.041, y, 0.017, c.trim);
    }
  }
}

function approach(out, level) {
  const [, , , lowerFar] = d.lowerFlight;
  const [left, right, upperNear, upperFar] = d.upperFlight;
  stair(out, d.lowerFlight, 0.06, 1.58, d.steps[0], level);
  shell(
    out,
    rect(d.lowerFlight[0], lowerFar, d.lowerFlight[1], upperNear + 0.015),
    (p) => Math.min(1.4, grade(p) - 0.2),
    1.58,
    { wall: 'base', color: c.base, roof: 'base', roofColor: c.yard },
  );
  stair(out, d.upperFlight, 1.58, entranceFloor, d.steps[1], level);
  shell(out, rect(left, upperFar, right, front + 0.14), foundation, entranceFloor, {
    wall: 'base',
    color: c.base,
    roof: 'base',
    roofColor: c.yard,
  });
}

function build(out, level) {
  facade(out, level);
  approach(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'beijing-resistance-museum-model.mjs';
const camera = [97, 47, -145];
const lookAt = [0, 8, -23];
const errors = { district: 0.7, street: 0.29, closeup: 0.09 };

export const beijingResistanceMuseumAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: 'Original Wanping elevation sampled at the foot of the southern stair.',
  brief:
    'The Wanping museum with its paifang entrance, cream stone pylons, dark tiled wings and two approach stairs.',
  camera,
  lookAt,
  sunDirection: [-42, 119, -87],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Named current outer museum envelope.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'south-entrance-and-stairs', position: [0, 12, -96], lookAt: [0, 7, -48] },
    { name: 'tiled-roofs-and-ribbon-windows', position: [63, 26, -68], lookAt: [24, 10, -39] },
    { name: 'paired-open-roof-courts', position: [-61, 67, 39], lookAt: [0, 9, -6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'beijing-resistance-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.26,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
