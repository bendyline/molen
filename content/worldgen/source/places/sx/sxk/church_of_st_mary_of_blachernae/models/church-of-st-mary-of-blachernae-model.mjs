import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  rect,
  ring,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  wall: 'c2b59d',
  masonry: 'ab9e86',
  limestone: 'c9c1ac',
  roof: '985f4c',
  roofSun: 'a96c53',
  eave: '785742',
  timber: '776452',
  glass: '78817b',
  stoneSill: 'a79a84',
  iron: '494d48',
  bronze: '7b7153',
  path: 'a39a87',
});
const surfaces = {
  wall: surface('wall', 'stucco', 0.92),
  masonry: surface('foundation', 'stone_limestone', 0.95),
  trim: surface('trim', 'wood_vertical', 0.91),
  roof: surface('roof', 'tile_ceramic', 0.91),
  iron: surface('trim', 'metal_painted', 0.89, 0.14),
  bronze: surface('trim', 'metal_bronze_cast', 0.81, 0.31),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.66, metallic: 0.04 },
  paving: surface('foundation', 'stone_checker_fine', 0.93),
};

const walls = (outline) => pairs(closed(outline)).map(([a, b]) => edge(a, b, areaSign(outline)));
const wallBottom = (p) => grade(p) - 0.4;
const mainAt = [3.5, 9.05];
const sideAt = [-8.8, -10.3];
const baseMain = grade(mainAt);
const baseSide = grade(sideAt);
const mainHeight = baseMain + d.mainEaveHeight;
const sideHeight = Math.min(mainHeight - 0.9, baseSide + d.northEaveHeight);
const southRoof = [0, 1, 2, 3, 8, 9].map((i) => d.outline[i]);
const northRoof = [3, 4, 5, 6, 7, 8].map((i) => d.outline[i]);

function tiledRoof(out, footprint, center, direction, eave, rise, level) {
  const [cx, cz] = center;
  const [dx, dz] = direction;
  const outer = footprint.map(([x, z]) => [mix(cx, x, 1.043), mix(cz, z, 1.043)]);
  const high = outer.map(([x, z]) => {
    const along = (x - cx) * dx + (z - cz) * dz;
    const span = (x - cx) * -dz + (z - cz) * dx;
    return [cx + along * dx * 0.65 - span * dz * 0.105, cz + along * dz * 0.65 + span * dx * 0.105];
  });
  const top = eave + rise;
  for (const [i, w] of walls(outer).entries()) {
    const j = (i + 1) % outer.length;
    const a = at(outer[i], eave);
    const b = at(outer[j], eave);
    const u = at(high[i], top);
    const v = at(high[j], top);
    const shade = i % 2 ? c.roofSun : c.roof;
    face(out, 'roof', [a, b, v], up, shade);
    face(out, 'roof', [a, v, u], up, shade);
    const finish = level > 0 ? 0.19 : 0.15;
    trimBlock(out, 'trim', w, 0, w.length, eave - finish, eave + 0.03, -0.075, 0.024, c.eave);
    if (level < 2) continue;
    const n = level === 2 ? 7 : 12;
    for (let k = 1; k <= n; k++) {
      const q = k / (n + 1);
      const aRow = a.map((value, index) => mix(value, u[index], q));
      const bRow = b.map((value, index) => mix(value, v[index], q));
      aRow[1] += 0.038;
      bRow[1] += 0.038;
      beam(out, 'roof', aRow, bRow, 0.036, 0.044, shade);
    }
  }
  cap(out, 'roof', high, top, c.roof);
}

function window(out, w, u, sill, high, radius, level) {
  const left = u - radius,
    right = u + radius;
  const spring = high - 0.42;
  const steps = [3, 4, 8, 12][level];
  panel(out, 'glass', w, left, right, sill, spring, 0.045, c.glass);
  const curve = Array.from({ length: steps + 1 }, (_, i) => {
    const t = (Math.PI * i) / steps;
    return w.p(u + Math.cos(t) * radius, spring + Math.sin(t) * 0.42, 0.046);
  });
  face(out, 'glass', curve, w.normal, c.glass);
  if (level === 0) return;
  trimBlock(
    out,
    'masonry',
    w,
    left - 0.12,
    right + 0.12,
    sill - 0.125,
    sill,
    0.02,
    0.155,
    c.stoneSill,
  );
  if (level < 2) return;
  panel(out, 'trim', w, u - 0.039, u + 0.039, sill, spring + 0.36, 0.059, c.timber);
  panel(out, 'trim', w, left, right, sill + 0.62, sill + 0.68, 0.058, c.timber);
}

function glazedNarthex(out, w, level) {
  const lo = baseMain + 0.27;
  const hi = lo + 2.93;
  const left = w.length * 0.21;
  const right = w.length * 0.83;
  trimBlock(out, 'trim', w, left - 0.19, right + 0.19, lo - 0.02, hi + 0.15, 0, 0.11, c.timber);
  panel(out, 'glass', w, left, right, lo, hi, 0.118, c.glass);
  const doors = [mix(left, right, 0.41), mix(left, right, 0.59)];
  panel(out, 'trim', w, doors[0], doors[1], lo, hi - 0.38, 0.132, c.eave);
  for (const u of doors) panel(out, 'trim', w, u - 0.062, u + 0.062, lo, hi, 0.148, c.timber);
  if (level > 0) {
    for (let i = 1; i < 8; i++) {
      const u = mix(left, right, i / 8);
      panel(out, 'trim', w, u - 0.033, u + 0.033, lo, hi, 0.141, c.timber);
    }
    panel(out, 'trim', w, left, right, hi - 0.41, hi - 0.335, 0.141, c.timber);
    const p = (u, y, offset) => w.p(u, y, offset);
    const steps = level === 1 ? 2 : 4;
    for (let i = 0; i < steps; i++) {
      const ya = mix(lo - 0.52, lo, i / steps);
      const yb = mix(lo - 0.52, lo, (i + 1) / steps);
      const a = 2.42 * (1 - i / steps),
        b = 2.42 * (1 - (i + 1) / steps);
      face(
        out,
        'paving',
        [
          p(left - 0.22, yb, b),
          p(right + 0.22, yb, b),
          p(right + 0.22, yb, a),
          p(left - 0.22, yb, a),
        ],
        up,
        c.path,
      );
      face(
        out,
        'masonry',
        [
          p(left - 0.22, ya, a),
          p(right + 0.22, ya, a),
          p(right + 0.22, yb, a),
          p(left - 0.22, yb, a),
        ],
        w.normal,
        c.stoneSill,
      );
    }
  }
}

function church(out, level) {
  const outline = d.outline;
  const facade = walls(outline);
  for (const [i, w] of facade.entries()) {
    const bottomA = wallBottom(outline[i]);
    const bottomB = wallBottom(outline[(i + 1) % outline.length]);
    const isNorth = i >= 3 && i <= 7;
    const top = isNorth ? sideHeight : mainHeight;
    face(
      out,
      'wall',
      [w.p(0, bottomA), w.p(w.length, bottomB), w.p(w.length, top), w.p(0, top)],
      w.normal,
      c.wall,
    );
    face(
      out,
      'masonry',
      [
        w.p(0, bottomA, 0.023),
        w.p(w.length, bottomB, 0.023),
        w.p(w.length, bottomB + 0.88, 0.023),
        w.p(0, bottomA + 0.88, 0.023),
      ],
      w.normal,
      c.masonry,
    );
    if (i === 0) glazedNarthex(out, w, level);
    else if (w.length > 7) {
      const count = w.length > 13 ? 3 : 2;
      for (let k = 1; k <= count; k++) {
        const u = (w.length * k) / (count + 1);
        window(out, w, u, top - (isNorth ? 2.9 : 3.6), top - 0.94, isNorth ? 0.46 : 0.62, level);
      }
    }
    if (level > 1) {
      const lap = top - 0.25;
      panel(out, 'masonry', w, 0.03, w.length - 0.03, lap, lap + 0.07, 0.026, c.limestone);
    }
  }
  const joint = edge(outline[3], outline[8], -areaSign(southRoof));
  panel(out, 'wall', joint, 0, joint.length, sideHeight - 0.2, mainHeight, 0, c.wall);
  tiledRoof(out, northRoof, [-9.5, -11.3], [0.235, -0.972], sideHeight, d.northRoofRise, level);
  tiledRoof(out, southRoof, [3.22, 10.52], [0.667, 0.745], mainHeight, d.mainRoofRise, level);
  if (level > 0) {
    const [x, z] = [3.22, 10.52];
    const y = mainHeight + d.mainRoofRise;
    beam(out, 'iron', [x, y, z], [x, y + 1.36, z], 0.115, 0.115, c.iron);
    beam(out, 'iron', [x - 0.4, y + 0.91, z], [x + 0.4, y + 0.91, z], 0.105, 0.105, c.iron);
  }
}

function gardenWall(out, level) {
  for (const [i, w] of walls(d.enclosure).entries()) {
    const step = level === 0 ? 15 : level === 1 ? 8 : 4.9;
    const floor = (u) => {
      const [x, , z] = w.p(u, 0);
      return grade([x, z]);
    };
    const left = w.length * 0.5 - 1.85;
    const right = left + 3.7;
    const sections =
      i === 0
        ? [
            [0, left],
            [right, w.length],
          ]
        : [[0, w.length]];
    if (i === 0) {
      const count = [3, 5, 9, 14][level];
      for (const y of [0.18, 1.75]) {
        beam(
          out,
          'iron',
          w.p(left, floor(left) + y),
          w.p(right, floor(right) + y),
          0.075,
          0.075,
          c.iron,
        );
      }
      for (let j = 0; j <= count; j++) {
        const u = mix(left, right, j / count);
        const y = floor(u);
        beam(out, 'iron', w.p(u, y + 0.16), w.p(u, y + 1.82), 0.055, 0.055, c.iron);
      }
    }
    for (const [start, end] of sections) {
      const count = Math.ceil((end - start) / step);
      for (let j = 0; j < count; j++) {
        const a = mix(start, end, j / count);
        const b = mix(start, end, (j + 1) / count);
        const ya = floor(a);
        const yb = floor(b);
        const h = 1.83;
        for (const offset of [-0.21, 0.21]) {
          const n = offset > 0 ? w.normal : w.normal.map((v) => -v);
          face(
            out,
            'masonry',
            [
              w.p(a, ya - 0.32, offset),
              w.p(b, yb - 0.32, offset),
              w.p(b, yb + h, offset),
              w.p(a, ya + h, offset),
            ],
            n,
            c.masonry,
          );
        }
        face(
          out,
          'masonry',
          [
            w.p(a, ya + h, -0.21),
            w.p(b, yb + h, -0.21),
            w.p(b, yb + h, 0.21),
            w.p(a, ya + h, 0.21),
          ],
          up,
          c.limestone,
        );
      }
    }
  }
}

function bellFrame(out, level) {
  const outline = rect(8.1, -15.4, 10.45, -13.02);
  const bottom = grade([9.27, -14.21]);
  const y = bottom + d.bellHeight;
  const lower = outline.map((p) => at(p, bottom - 0.38));
  const upper = outline.map((p) => at(p, y - 0.34));
  for (const [i, p] of lower.entries()) {
    const j = (i + 1) % lower.length;
    beam(out, 'iron', p, upper[i], 0.108, 0.108, c.iron);
    beam(out, 'iron', upper[i], upper[j], 0.12, 0.12, c.iron);
    const middle = bottom + 2.45;
    beam(out, 'iron', at(outline[i], middle), at(outline[j], middle), 0.075, 0.075, c.iron);
    if (level > 0)
      beam(
        out,
        'iron',
        at(outline[i], bottom + 0.38),
        at(outline[j], middle - 0.2),
        0.065,
        0.065,
        c.iron,
      );
    if (level > 1)
      beam(
        out,
        'iron',
        at(outline[j], bottom + 0.38),
        at(outline[i], middle - 0.2),
        0.052,
        0.052,
        c.iron,
      );
  }
  const center = [9.27, -14.21];
  const bellY = y - 1.1;
  ring(
    out,
    'bronze',
    center,
    [
      [bellY - 0.52, 0.42],
      [bellY - 0.41, 0.39],
      [bellY - 0.14, 0.3],
      [bellY + 0.12, 0.23],
      [bellY + 0.23, 0.12],
    ],
    [6, 10, 15, 18][level],
    c.bronze,
  );
  beam(
    out,
    'iron',
    [center[0], bellY + 0.22, center[1]],
    [center[0], y - 0.27, center[1]],
    0.104,
    0.104,
    c.iron,
  );
}

function build(out, level) {
  church(out, level);
  gardenWall(out, level);
  bellFrame(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'church-of-st-mary-of-blachernae-model.mjs';
const camera = [96, 60, 96];
const lookAt = [11, 2, -8];
const errors = { district: 0.42, street: 0.17, closeup: 0.066 };
export const blachernaeChurchAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Original relief sampled at the courtyard, just east of the standing masonry church.',
  brief:
    'The standing tile-roofed Greek Orthodox church of St. Mary of Blachernae, glazed narthex and a simple bell frame in the walled Ayvansaray garden.',
  camera,
  lookAt,
  sunDirection: [10, 17, -4],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Named standing church footprint; garden walls sit independently on sampled relief.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: [
    'authored-structure-mesh.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'masonry-narthex-and-tiled-roof', position: [39, 12, 29], lookAt: [2, 5, 6] },
    { name: 'garden-iron-bell-and-northern-roof', position: [24, 11, -34], lookAt: [-0.5, 4, -7] },
    { name: 'standing-church-and-precinct', position: [-58, 39, 56], lookAt: [9, 1, -9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'church-of-st-mary-of-blachernae-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.81,
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
    'Original mesh under repository license. Mapzen terrain and © OpenStreetMap contributors.',
};
