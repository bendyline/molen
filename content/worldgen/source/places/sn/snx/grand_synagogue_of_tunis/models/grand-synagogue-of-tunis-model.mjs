import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  block,
  edge,
  face,
  floorSampler,
  mix,
  opening,
  palette,
  panel,
  plane,
  rect,
  ring,
  shell,
  stairs,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const y = d.floor;
const pale = palette({
  wall: 'dcd1bb',
  white: 'e8e1cf',
  shadow: 'bfb39d',
  stone: 'b6a68e',
  coping: 'd1cab8',
  bronze: 'bd975c',
  window: '4b5758',
  wood: '554335',
  glassAmber: '8c7d59',
});
const surfaces = {
  stucco: surface('wall', 'plaster_lime', 0.9),
  trim: surface('trim', 'stone_limestone', 0.86),
  base: surface('foundation', 'stone_limestone_raw', 0.95),
  roof: surface('roof', 'concrete_plain', 0.86),
  bronze: surface('trim', 'metal_bronze_cast', 0.65, 0.19),
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.78, metallic: 0 },
};

function mass(out, slot, x1, z1, x2, z2, low, high, tint) {
  block(out, slot, x1, low, z1, x2 - x1, high - low, z2 - z1, tint);
}

function chamferedBay(out, wall, u, b, h, span, lod, offset = 0.035) {
  const cut = Math.min(0.32, span * 0.27);
  const corners = [
    [-span, b],
    [span, b],
    [span, h - cut],
    [span - cut, h],
    [-span + cut, h],
    [-span, h - cut],
  ];
  face(
    out,
    'dark',
    corners.map(([x, a]) => wall.p(u + x, a, offset)),
    wall.normal,
    pale.window,
  );
  if (lod === 0) return;
  const stroke = lod === 1 ? 0.07 : 0.115;
  beamPath(
    out,
    'trim',
    corners.map(([x, a]) => wall.p(u + x, a, offset + 0.054)),
    stroke,
    0.051,
    pale.white,
    true,
  );
  if (lod > 1) {
    for (const v of [u - span / 3, u + span / 3]) {
      panel(out, 'trim', wall, v - 0.022, v + 0.022, b, h - 0.021, offset + 0.035, pale.coping);
    }
    panel(
      out,
      'dark',
      wall,
      u - span + 0.07,
      u + span - 0.07,
      b + (h - b) * 0.47,
      b + (h - b) * 0.55,
      offset + 0.026,
      pale.glassAmber,
    );
  }
}

function cupola(out, lod) {
  const cfg = d.dome;
  const [x, z] = cfg.center;
  const drum = y + cfg.drumBase;
  const top = y + cfg.spring;
  const r = cfg.radius;
  ring(
    out,
    'stucco',
    cfg.center,
    [
      [drum, r],
      [top - 0.11, r],
    ],
    12,
    pale.wall,
  );
  ring(
    out,
    'trim',
    cfg.center,
    [
      [top - 0.2, r + 0.11],
      [top + 0.06, r + 0.11],
    ],
    12,
    pale.white,
  );
  for (let i = 0; i < cfg.windows; i++) {
    const point = (j) => {
      const angle = (j * 2 * Math.PI) / cfg.windows;
      return [x + r * Math.cos(angle), z + r * Math.sin(angle)];
    };
    const w = edge(point(i), point(i + 1));
    chamferedBay(out, w, w.length / 2, y + 11.42, top - 0.46, 0.72, lod, 0.09);
    if (lod > 1) {
      panel(out, 'trim', w, 0.09, 0.15, y + 10.59, top - 0.13, 0.135, pale.white);
      panel(out, 'trim', w, 0.17, w.length - 0.17, y + 11.23, y + 11.43, 0.147, pale.coping);
    }
  }
  const dome =
    lod === 0
      ? [
          [0, 1],
          [0.42, 0.82],
          [0.75, 0.54],
          [1, 0.038],
        ]
      : [
          [0, 1],
          [0.14, 0.94],
          [0.17, 0.9],
          [0.29, 0.83],
          [0.31, 0.78],
          [0.43, 0.71],
          [0.45, 0.67],
          [0.57, 0.58],
          [0.59, 0.53],
          [0.7, 0.45],
          [0.72, 0.4],
          [0.82, 0.33],
          [0.83, 0.29],
          [0.92, 0.22],
          [1, 0.035],
        ];
  const apex = y + cfg.apex;
  ring(
    out,
    'roof',
    cfg.center,
    dome.map(([h, k]) => [mix(top + 0.01, apex, h), r * k]),
    lod < 2 ? 12 : lod === 2 ? 24 : 36,
    pale.coping,
  );
  if (lod > 0)
    ring(
      out,
      'trim',
      [x, z],
      [
        [apex - 0.12, 0.21],
        [apex + 0.22, 0.12],
        [apex + 0.27, 0.055],
      ],
      10,
      pale.white,
    );
}

function hall(out, lod) {
  const b = d.body;
  const p = rect(b.minX, b.back, b.maxX, b.front);
  shell(out, p, () => d.foundation, y + b.height, {
    wall: 'stucco',
    color: pale.wall,
    roof: 'roof',
    roofColor: pale.coping,
  });
  mass(
    out,
    'base',
    b.minX - 0.078,
    b.back - 0.078,
    b.maxX + 0.078,
    b.front + 0.078,
    d.foundation,
    y + 0.56,
    pale.stone,
  );
  mass(
    out,
    'trim',
    b.minX - 0.196,
    b.back - 0.196,
    b.maxX + 0.196,
    b.front + 0.196,
    y + b.height - 0.2,
    y + b.height + 0.11,
    pale.white,
  );
  for (const [i, j] of [
    [0, 1],
    [1, 2],
    [3, 0],
  ]) {
    const wall = edge(p[i], p[j]);
    const count = i === 0 ? 4 : 5;
    for (let k = 0; k < count; k++) {
      const u = ((k + 0.5) * wall.length) / count;
      chamferedBay(out, wall, u, y + 4.89, y + 8.83, 0.68, lod);
      if (lod > 1) {
        opening(
          out,
          wall,
          u - 0.58,
          u + 0.58,
          y + 1.19,
          y + 3.45,
          'trim',
          pale.window,
          'dark',
          pale.white,
          lod,
          0.035,
        );
      }
    }
  }
}

function star(out, lod, center, radius, z) {
  const depth = lod > 1 ? 0.25 : 0.19;
  for (const direction of [-1, 1]) {
    const points = [
      [0, direction * radius],
      [0.8660254 * radius, (-direction * radius) / 2],
      [-0.8660254 * radius, (-direction * radius) / 2],
    ];
    beamPath(
      out,
      'bronze',
      points.map(([x, h]) => [x, center + h, z]),
      lod === 0 ? 0.33 : 0.24,
      depth,
      pale.bronze,
      true,
    );
  }
}

function entrance(out, lod) {
  const f = d.frontage;
  const z = f.mainFront,
    z0 = d.body.front - 0.51;
  const porch = f.outerPorch;
  const b = y + 7.82;
  const lower = f.crownRadii.at(-1);
  mass(out, 'stucco', -lower, z0, lower, z, d.foundation, y + 11.98, pale.wall);
  for (const [i, half] of f.crownRadii.toReversed().entries()) {
    const bottom = y + 11.98 + ((f.peak - 11.98) * i) / f.crownRadii.length;
    const top = y + 11.98 + ((f.peak - 11.98) * (i + 1)) / f.crownRadii.length;
    mass(out, 'stucco', -half, z0, half, z, bottom, top, pale.white);
    if (lod > 0)
      mass(
        out,
        'trim',
        -half - 0.1,
        z0 - 0.11,
        half + 0.1,
        z + 0.12,
        top - 0.17,
        top + 0.008,
        pale.coping,
      );
  }
  const w = plane(z, 1);
  for (const [cx, width] of [
    [-3.41, 1.19],
    [0, 1.84],
    [3.41, 1.19],
  ]) {
    opening(
      out,
      w,
      cx - width,
      cx + width,
      y + 0.03,
      b - 1.95,
      'trim',
      pale.wood,
      'dark',
      pale.coping,
      lod,
      0.068,
    );
  }
  const starCenter = y + 11.4;
  star(out, lod, starCenter, 2.24, z + 0.11);
  const portico = [-5.33, -1.83, 1.83, 5.33];
  for (const x of portico) {
    mass(
      out,
      'stucco',
      x - 0.53,
      porch - 0.97,
      x + 0.53,
      porch + 0.06,
      y - 0.03,
      b - 0.31,
      pale.wall,
    );
    if (lod > 0) {
      for (const off of [0.02, b - y - 0.7]) {
        mass(
          out,
          'trim',
          x - 0.64,
          porch - 1.05,
          x + 0.64,
          porch + 0.15,
          y + off,
          y + off + 0.23,
          pale.white,
        );
      }
    }
  }
  mass(out, 'roof', -6.15, z - 0.18, 6.15, porch + 0.19, b - 0.6, b + 0.02, pale.coping);
  mass(out, 'trim', -6.2, porch + 0.01, 6.2, porch + 0.28, b - 0.2, b + 0.32, pale.white);
  if (lod > 1) {
    for (let i = 0; i <= 13; i++) {
      const x = mix(-5.83, 5.83, i / 13);
      mass(
        out,
        'trim',
        x - 0.098,
        porch - 0.21,
        x + 0.098,
        porch + 0.07,
        b + 0.31,
        b + 0.83,
        pale.white,
      );
    }
    mass(out, 'trim', -6.0, porch - 0.24, 6.0, porch + 0.095, b + 0.78, b + 0.91, pale.white);
  }
  mass(out, 'base', -6.27, z - 0.1, 6.27, porch + 0.22, d.foundation, y + 0.01, pale.stone);
  stairs(
    out,
    grade,
    'base',
    -5.97,
    5.97,
    15.41,
    porch + 0.21,
    y + 0.024,
    [2, 4, 6, 8][lod],
    pale.stone,
  );
  for (const side of [-1, 1]) {
    const center = side * 9.07;
    const x1 = center - 1.95,
      x2 = center + 1.95;
    const z2 = 11.53;
    mass(out, 'stucco', x1, 7.97, x2, z2, d.foundation, y + 6.68, pale.wall);
    mass(out, 'trim', x1 - 0.14, 7.92, x2 + 0.14, z2 + 0.12, y + 6.52, y + 6.89, pale.white);
    const end = plane(z2, 1);
    opening(
      out,
      end,
      center - 0.91,
      center + 0.91,
      y + 0.17,
      y + 3.9,
      'trim',
      pale.wood,
      'dark',
      pale.coping,
      lod,
      0.06,
    );
    if (lod > 0) chamferedBay(out, end, center, y + 4.28, y + 5.88, 0.69, lod);
  }
}

function build(out, lod) {
  hall(out, lod);
  entrance(out, lod);
  cupola(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const camera = [-36, 27, 52];
const lookAt = [0, 6, 0];
const recipe = 'grand-synagogue-of-tunis-model.mjs';
export const tunisSynagogueModel = {
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
  orientationPolicy: 'exact-native-frame',
  groundContactBasis:
    'Original elevation from the avenue frontage. Building inset and floor grade are interpreted.',
  brief:
    'Victor Valensi’s Art Deco synagogue on Avenue de la Liberté in Tunis, with a stepped facade and dome, twelve angular drum windows, two low entry pavilions and a prominent Magen David.',
  camera,
  lookAt,
  sunDirection: [-12, 23, 27],
  mediumFiContext: {
    scale: 1,
    groundY: -0.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'facade-on-avenue-de-la-liberte', position: [-25, 15, 42], lookAt: [0, 8, 4] },
    { name: 'stepped-gable-and-magen-david', position: [2, 9, 31], lookAt: [0, 9.4, 9] },
    { name: 'stepped-dome-and-twelve-windows', position: [29, 29, -27], lookAt: [0, 12, -1] },
    { name: 'side-walls-and-drum', position: [-45, 15, -22], lookAt: [0, 7, -2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'tunis-synagogue-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.24,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.63, surfaces },
      street: { export: 'street', errorMeters: 0.29, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.09, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model geometry under the repository license. Factual descriptions and native OpenStreetMap data, ODbL 1.0. No reference photographs used for authoring.',
};
