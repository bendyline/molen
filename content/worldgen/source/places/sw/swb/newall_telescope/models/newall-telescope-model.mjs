import { readFileSync } from 'node:fs';
import {
  beam,
  cross,
  loft,
  normalize,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
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

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  marble: 'd7d0bf',
  pale: 'e0daca',
  stone: 'b4ac99',
  line: 'aaa694',
  glass: '526466',
  silver: 'afb7b4',
  silver2: '9da7a6',
  rail: '7d8b88',
  shutter: 'b9c1be',
  dark: '3d4541',
  green: '718683',
  bronze: 'a08654',
  wood: '625d51',
  optic: '42859a',
});
const surfaces = {
  marble: surface('wall', 'stone_marble', 0.87),
  stone: surface('foundation', 'stone_ashlar', 0.94),
  metal: surface('roof', 'metal_standing_seam', 0.72, 0.26),
  painted: surface('trim', 'metal_painted', 0.78, 0.18),
  bronze: surface('trim', 'metal_bronze_cast', 0.71, 0.37),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.49 },
};
const disk = (radius, n = 22) => radialRing(0, radius, radius, n).map(([x, , z]) => [x, z]);
const base = (floor) => (p) => Math.min(floor - 0.18, grade(p) - 0.34);
const radial = (out, profile, n, slot, color, cap = false) =>
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, n)),
    color,
    { cap },
  );

function stair(out, level) {
  shell(out, d.front, base(d.terraceFloor), d.terraceFloor, {
    wall: 'stone',
    roof: 'marble',
    color: c.stone,
    roofColor: c.pale,
  });
  const count = level === 0 ? 3 : 7;
  for (let i = 0; i < count; i++) {
    const f = (i + 1) / count,
      y = mix(0.23, d.terraceFloor, f);
    const front = 16.3 - (2.8 * i) / count;
    const tread = rect(-2.35, 12.8, 2.35, front);
    shell(out, tread, base(y), y, {
      wall: 'stone',
      roof: 'marble',
      color: c.stone,
      roofColor: c.marble,
    });
  }
  if (level > 0) {
    const outer = d.front.filter(([x, z]) => z > 12 && Math.abs(x) > 2.25);
    for (const [a, b] of pairs(outer)) {
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 3.8) continue;
      const wall = edge(a, b);
      trimBlock(
        out,
        'marble',
        wall,
        0,
        wall.length,
        d.terraceFloor - 0.03,
        d.terraceFloor + 0.48,
        -0.24,
        0.08,
        c.pale,
      );
    }
  }
}

function plinthAndDrum(out, level) {
  const n = [14, 20, 32, 48][level],
    r = d.bodyRadius,
    baseOutline = d.outline;
  shell(out, baseOutline, base(d.rotundaFloor), d.rotundaFloor, {
    wall: 'stone',
    roof: 'marble',
    color: c.stone,
    roofColor: c.pale,
  });
  const drum = disk(r, n);
  shell(out, drum, () => d.rotundaFloor - 0.06, d.domeStart - 0.18, {
    wall: 'marble',
    roof: 'painted',
    color: c.marble,
    roofColor: c.dark,
  });
  radial(
    out,
    [
      [d.rotundaFloor - 0.03, r + 0.2],
      [d.rotundaFloor + 0.35, r + 0.2],
      [d.rotundaFloor + 0.45, r + 0.08],
    ],
    n,
    'marble',
    c.pale,
  );
  radial(
    out,
    [
      [d.domeStart - 0.85, r + 0.005],
      [d.domeStart - 0.6, r + 0.18],
      [d.domeStart - 0.36, r + 0.18],
      [d.domeStart - 0.16, r + 0.02],
    ],
    n,
    'marble',
    c.pale,
  );
  radial(
    out,
    [
      [d.domeStart - 0.2, d.railRadius],
      [d.domeStart + 0.14, d.railRadius],
      [d.domeStart + 0.19, d.domeRadius],
    ],
    n,
    'metal',
    c.rail,
  );
  const front = drum
    .map((p, i) => [p, drum[(i + 1) % n]])
    .filter(([a, b]) => Math.min(a[1], b[1]) > r * 0.91)
    .sort(([a, b], [p, q]) => Math.abs(a[0] + b[0]) - Math.abs(p[0] + q[0]))[0];
  const door = edge(...front, areaSign(drum));
  const u = door.length / 2;
  trimBlock(
    out,
    'marble',
    door,
    u - 0.79,
    u + 0.79,
    d.rotundaFloor,
    d.rotundaFloor + 2.93,
    0.012,
    0.12,
    c.pale,
  );
  panel(
    out,
    'glass',
    door,
    u - 0.65,
    u + 0.65,
    d.rotundaFloor + 0.04,
    d.rotundaFloor + 2.71,
    0.146,
    c.wood,
  );
  if (level > 0) {
    const panels = n === 20 ? [1, 4, 7, 11, 14, 18] : [2, 6, 10, 14, 19, 23, 27, 30];
    for (const i of panels) {
      const a = drum[i],
        b = drum[(i + 1) % n];
      const [x, z] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (z > r * 0.9 && Math.abs(x) < 1.45) continue;
      const wall = edge(a, b, areaSign(drum)),
        center = wall.length * 0.5,
        w = Math.min(0.49, wall.length * 0.42);
      arch(
        out,
        wall,
        center,
        5.22,
        6.35,
        w,
        0.36,
        0.023,
        level < 2 ? 0 : 1,
        { inner: c.glass, trim: c.pale, width: 0.092 },
        { inner: 'glass', trim: 'marble' },
      );
      if (level >= 2) {
        panel(out, 'painted', wall, center - 0.025, center + 0.025, 5.26, 6.58, 0.084, c.rail);
        trimBlock(
          out,
          'marble',
          wall,
          center - w - 0.12,
          center + w + 0.12,
          5.08,
          5.18,
          0.009,
          0.19,
          c.pale,
        );
      }
    }
    for (const y of [4.45, 7.95])
      radial(
        out,
        [
          [y - 0.036, r + 0.01],
          [y + 0.036, r + 0.014],
        ],
        n,
        'marble',
        c.line,
      );
  }
}

function apertureGeometry(out, level) {
  const columns = [14, 26, 48, 64][level],
    rows = [6, 10, 16, 23][level];
  const half = d.slitWidth / 2;
  const rim = (t) => {
    const a = t * Math.PI * 0.5;
    const rho = Math.max(0.037, d.domeRadius * Math.cos(a));
    return {
      rho,
      y: d.domeStart + Math.sin(a) * d.domeRadius,
      start: Math.asin(Math.min(0.998, half / rho)),
    };
  };
  const sp = (m, f, offset = 0) => {
    const a = mix(m.start, Math.PI * 2 - m.start, f) + offset;
    return [Math.sin(a) * m.rho, m.y, Math.cos(a) * m.rho];
  };
  for (let i = 0; i < rows; i++) {
    const a = rim(i / rows),
      b = rim((i + 1) / rows);
    for (let j = 0; j < columns; j++) {
      const f = j / columns,
        g = (j + 1) / columns;
      face(
        out,
        'metal',
        [sp(a, f), sp(a, g), sp(b, g), sp(b, f)],
        up,
        level > 0 && (j % 7 === 1 || j % 7 === 2) ? c.silver2 : c.silver,
      );
    }
    for (const side of [0, 1]) {
      const deck = side === 0 ? 1 : -1;
      const lift = (p) => [p[0], p[1] + 0.105, p[2]];
      const a0 = lift(sp(a, side, deck * 0.025)),
        a1 = lift(sp(a, side, deck * 0.145));
      const b0 = lift(sp(b, side, deck * 0.025)),
        b1 = lift(sp(b, side, deck * 0.145));
      face(out, 'metal', [a0, a1, b1, b0], up, c.shutter);
      if (level >= 2) {
        beam(out, 'painted', a0, b0, 0.063, 0.069, c.rail);
        if (i % 3 === 1) beam(out, 'painted', a0, a1, 0.049, 0.052, c.rail);
      }
    }
  }
}

function axisPipe(out, center, axis, segments, profile, slot, color, cap = true) {
  const a = normalize(cross(axis, Math.abs(axis[1]) > 0.92 ? [1, 0, 0] : up));
  const b = normalize(cross(axis, a));
  const bands = profile.map(([h, r]) =>
    Array.from({ length: segments }, (_, i) => {
      const t = (2 * Math.PI * i) / segments;
      return center.map((v, j) => v + h * axis[j] + r * (a[j] * Math.cos(t) + b[j] * Math.sin(t)));
    }),
  );
  loft(out, slot, bands, color, { cap });
}

function instrument(out, level) {
  const segments = [8, 14, 24, 32][level];
  const pivot = [0, 11.57, -0.45],
    incline = Math.PI / 5.5;
  const axis = [0, Math.sin(incline), Math.cos(incline)];
  const eye = -d.tubeLength * 0.43,
    front = d.tubeLength * 0.57;
  const radius = d.lensDiameter * 0.57;
  const pos = (h) => pivot.map((v, i) => v + axis[i] * h);
  radial(
    out,
    [
      [d.rotundaFloor, 1.16],
      [d.rotundaFloor + d.pierHeight, 0.57],
      [d.domeStart - 0.14, 0.53],
      [d.domeStart + 0.48, 0.29],
    ],
    segments,
    'stone',
    c.stone,
  );
  beam(out, 'painted', [0, d.domeStart - 0.23, 0.04], pivot, 0.62, 0.75, c.dark);
  axisPipe(
    out,
    pivot,
    axis,
    segments,
    [
      [eye, 0.233],
      [eye + 1.62, 0.37],
      [-1.85, 0.42],
      [0.24, 0.5],
      [front - 1.25, 0.385],
      [front, radius],
    ],
    'painted',
    c.green,
    false,
  );
  axisPipe(
    out,
    pos(front),
    axis,
    segments,
    [
      [0, radius + 0.066],
      [0.12, radius + 0.063],
      [0.22, radius],
    ],
    'bronze',
    c.bronze,
    false,
  );
  axisPipe(
    out,
    pos(front),
    axis,
    segments,
    [
      [0.015, d.lensDiameter / 2],
      [0.065, d.lensDiameter / 2],
    ],
    'glass',
    c.optic,
  );
  if (level === 0) return;
  for (const h of [-2.9, -1.45, 0.6, 2.62, 4.05]) {
    const r = h < 0 ? 0.411 : h > 2 ? 0.407 : 0.519;
    axisPipe(
      out,
      pos(h),
      axis,
      segments,
      [
        [0, r],
        [0.06, r + 0.015],
        [0.13, r],
      ],
      'bronze',
      c.bronze,
      false,
    );
  }
  const transverse = [1, 0, 0],
    wheel = [-0.75, pivot[1] - 0.27, pivot[2] - 0.17];
  axisPipe(
    out,
    wheel,
    transverse,
    segments,
    [
      [-0.11, 1.13],
      [0.07, 1.13],
      [0.07, 1.03],
      [-0.1, 1.03],
    ],
    'painted',
    c.dark,
    false,
  );
  const spokeCount = level === 1 ? 6 : 10;
  for (let i = 0; i < spokeCount; i++) {
    const a = (i * 2 * Math.PI) / spokeCount;
    beam(
      out,
      'painted',
      wheel,
      [wheel[0], wheel[1] + Math.sin(a) * 1.04, wheel[2] + Math.cos(a) * 1.04],
      0.075,
      0.1,
      c.dark,
    );
  }
  axisPipe(
    out,
    pivot,
    transverse,
    segments,
    [
      [0, 0.19],
      [1.21, 0.19],
      [1.22, 0.35],
      [1.77, 0.35],
      [1.86, 0.19],
    ],
    'bronze',
    c.bronze,
  );
  if (level >= 2) {
    const finder = [pivot[0] + 0.46, pivot[1] + 0.27, pivot[2] - 0.35];
    axisPipe(
      out,
      finder,
      axis,
      segments,
      [
        [-3.34, 0.089],
        [-2.99, 0.122],
        [-0.87, 0.138],
      ],
      'bronze',
      c.bronze,
    );
    const behind = pos(eye);
    axisPipe(
      out,
      behind,
      axis,
      segments,
      [
        [-0.52, 0.073],
        [-0.28, 0.108],
        [0.02, 0.153],
      ],
      'bronze',
      c.bronze,
    );
  }
}

function build(out, level) {
  stair(out, level);
  plinthAndDrum(out, level);
  apertureGeometry(out, level);
  instrument(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'newall-telescope-model.mjs';
const camera = [30, 19, 31],
  lookAt = [0, 7, 1.4];
const errors = { district: 0.49, street: 0.15, closeup: 0.041 };
export const newallTelescopeAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'observatory',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: 'Original Penteli terrain at the fan-shaped approach.',
  brief:
    'Penteli’s marble Newall observatory with a 14-metre aluminum dome and the historic refractor visible at the open shutter.',
  camera,
  lookAt,
  sunDirection: [22, 86, 73],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.polygons,
    minimumCoverage: 0.92,
    basis: 'Mapped astronomical rotunda and adjoining approach.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'marble-rotunda-and-fan-shaped-stairs', position: [15, 12, 27], lookAt: [0, 6, 4] },
    { name: 'open-shutter-and-refractor', position: [1.0, 18.5, 16.8], lookAt: [0.15, 13.5, 2.6] },
    { name: 'aluminum-shell-and-track', position: [-22, 20, -15], lookAt: [0, 12, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'newall-telescope-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.9,
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
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
