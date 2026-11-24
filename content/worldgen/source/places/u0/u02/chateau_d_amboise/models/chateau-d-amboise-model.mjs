import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const nativeParts = read('native-map/amboise-native-building-parts');
const ringOf = (id) => nativeParts.find((part) => part.way.id === id).points;
const dressed = rgb('d1c5ae');
const buff = rgb('bfb39c');
const light = rgb('e0d2b6');
const deepStone = rgb('a49983');
const glass = rgb('555d61');
const chapelGlass = rgb('525d68');
const shade = rgb('4b4b49');
const slate = rgb('515a64');
const chimney = rgb('8b6959');

const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94 },
  footing: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.97 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.92 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.94 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.9 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.64 },
};

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = u - i;
  const b = v - j;
  const h = terrain.heightsMeters;
  return (
    (1 - b) * ((1 - a) * h[j][i] + a * h[j][i + 1]) +
    b * ((1 - a) * h[j + 1][i] + a * h[j + 1][i + 1]) -
    terrain.modelDatumElevationMeters
  );
}

function extents(ring) {
  const x = ring.map((p) => p[0]);
  const z = ring.map((p) => p[1]);
  return [Math.min(...x), Math.max(...x), Math.min(...z), Math.max(...z)];
}

function panel(out, slot, F, a, b, y0, y1, color, d = 0) {
  if (b - a < 0.005 || y1 - y0 < 0.005) return;
  quad4(out, slot, F.P(a, y0, d), F.P(b, y0, d), F.P(b, y1, d), F.P(a, y1, d), color);
}

function window(out, F, u, y, width, height, level, head = 'flat', color = glass, depth = 0) {
  opening(out, F, u, y, width, height, {
    head,
    rise: head === 'pointed' ? width * 0.7 : undefined,
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: color,
    frame: light,
    frameWidth: level === 3 || (level === 2 && head === 'flat') ? 0.1 : 0,
    frameDepth: depth + 0.12,
    d: depth + 0.03,
    mullions: 0,
    transoms: 0,
    sill: false,
  });
  if (level < 2 || (level === 2 && head !== 'flat')) return;
  if (height > 1.32) {
    panel(out, 'trim', F, u - 0.048, u + 0.048, y + 0.07, y + height - 0.25, buff, depth + 0.16);
    panel(
      out,
      'trim',
      F,
      u - width / 2,
      u + width / 2,
      y + height * 0.55,
      y + height * 0.55 + 0.065,
      buff,
      depth + 0.164,
    );
  }
  fbox(
    out,
    'trim',
    F,
    u - width / 2 - 0.16,
    u + width / 2 + 0.16,
    y - 0.16,
    y - 0.025,
    depth,
    depth + 0.207,
    light,
  );
}

function wallPath(out, level) {
  const outline = outwardRing(ringOf('208020935'));
  const stride = Math.max(1, 3 - level);
  const wall = outline.filter((_, index) => index % stride === 0);
  const thickness = 1.15;
  const section = (point, normal) => {
    const sample = (d) => grade(point[0] + normal[0] * d, point[1] + normal[1] * d);
    const crest = Math.max(sample(-5.2), sample(0) + 0.25) + 0.65;
    const foot = Math.min(sample(4.2) - 0.45, crest - 2.1);
    return [foot, crest];
  };
  const samples = wall.map((p, i) => {
    const previous = wallFace(wall[(i + wall.length - 1) % wall.length], p).normal;
    const next = wallFace(p, wall[(i + 1) % wall.length]).normal;
    const x = previous[0] + next[0];
    const z = previous[1] + next[1];
    const length = Math.hypot(x, z);
    const normal = length > 0.001 ? [x / length, z / length] : next;
    return { p, normal, heights: section(p, normal) };
  });
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i];
    const b = samples[(i + 1) % samples.length];
    const p = (s, y, d = 0) => [s.p[0] + s.normal[0] * d, y, s.p[1] + s.normal[1] * d];
    const [a0, a1] = a.heights;
    const [b0, b1] = b.heights;
    quad4(out, 'footing', p(a, a0), p(b, b0), p(b, b1), p(a, a1), deepStone);
    quad4(out, 'stone', p(a, a1), p(b, b1), p(b, b1, -thickness), p(a, a1, -thickness), buff);
    quad4(
      out,
      'stone',
      p(b, b1 - 1.68, -thickness),
      p(a, a1 - 1.68, -thickness),
      p(a, a1, -thickness),
      p(b, b1, -thickness),
      dressed,
    );
    if (level < 2 || Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]) < 1.1) continue;
    const course = level === 3 ? 0.65 : 1.55;
    for (let y = 0.48; y < Math.min(a1 - a0, b1 - b0) - 0.21; y += course) {
      quad4(
        out,
        'trim',
        p(a, a1 - y, 0.015),
        p(b, b1 - y, 0.015),
        p(b, b1 - y + 0.037, 0.015),
        p(a, a1 - y + 0.037, 0.015),
        deepStone,
      );
    }
  }
}

function dormer(out, F, u, edgeY, edgeD, side, level) {
  const center = F.P(u, 0, edgeD);
  const span = 0.77;
  const front = facade([center[0], center[2]], side === 1 ? F.along : F.along.map((v) => -v));
  fbox(out, 'stone', front, -span, span, edgeY - 0.2, edgeY + 1.46, -1.04, 0.12, light);
  const a = front.P(0, 0, 0.17);
  const b = front.P(0, 0, -1.03);
  gableRoof(out, 'roof', [a[0], a[2]], [b[0], b[2]], 1.51, edgeY + 1.4, edgeY + 2.3, slate, {
    overhang: 0.055,
    endSlot: 'stone',
    endColor: light,
  });
  if (level >= 2) window(out, front, 0, edgeY + 0.06, 0.54, 1.04, level, 'pointed', glass, 0.13);
}

function range(out, id, y0, eave, rise, alongX, level, interval) {
  const ring = ringOf(id);
  const [x0, x1, z0, z1] = extents(ring);
  extrude(out, 'stone', ring, y0, eave, dressed, { top: false });
  const center = [(x0 + x1) / 2, (z0 + z1) / 2];
  const a = alongX ? [x0, center[1]] : [center[0], z0];
  const b = alongX ? [x1, center[1]] : [center[0], z1];
  const width = alongX ? z1 - z0 : x1 - x0;
  gableRoof(out, 'roof', a, b, width, eave, eave + rise, slate, {
    overhang: 0.19,
    endSlot: 'stone',
    endColor: light,
  });
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const F = facade(a, [b[0] - a[0], b[1] - a[1]]);
  for (const u of [length * 0.2, length * 0.78]) {
    const [x, , z] = F.P(u, 0, 0.65);
    abox(
      out,
      'brick',
      [x - 0.4, eave + rise - 2.6, z - 0.36],
      [x + 0.4, eave + rise + 1.1, z + 0.36],
      chimney,
    );
    if (level >= 2)
      abox(
        out,
        'brick',
        [x - 0.49, eave + rise + 0.96, z - 0.42],
        [x + 0.49, eave + rise + 1.22, z + 0.42],
        chimney,
      );
  }
  if (level >= 1 && interval > 0) {
    const count = Math.max(2, Math.round(length / interval));
    const sides = level === 1 ? [-1] : [-1, 1];
    for (const side of sides) {
      for (let j = 0; j < count; j++) {
        const u = ((j + 0.5) * length) / count;
        dormer(out, F, u, eave + rise * 0.27, side * width * 0.36, side, level);
      }
    }
  }
  if (level === 0) return;
  const points = outwardRing(ring);
  for (let i = 0; i < points.length; i++) {
    const face = wallFace(points[i], points[(i + 1) % points.length]);
    if (face.length < 2.85) continue;
    fbox(out, 'stone', face, 0, face.length, eave - 0.38, eave - 0.13, -0.13, 0.18, light);
    const count = Math.max(1, Math.round(face.length / 3.26));
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * face.length) / count;
      for (const y of [eave - 4.64, eave - 8.55]) {
        if (y < y0 + 0.15) continue;
        window(out, face, u, y, Math.min(1.02, (face.length / count) * 0.55), 2.01, level);
      }
    }
  }
}

function circular(out, id, radius, y0, y1, kind, level) {
  const [x0, x1, z0, z1] = extents(ringOf(id));
  const c = [(x0 + x1) / 2, (z0 + z1) / 2];
  const sides = radius > 6 ? [12, 16, 24, 28][level] : [8, 10, 14, 16][level];
  const drum = [
    [y0, radius * 1.025, radius * 1.025],
    [y1 - 2.4, radius, radius],
    [y1 - 2.07, radius * 1.035, radius * 1.035],
    [y1 - 1.75, radius * 1.009, radius * 1.009],
    [y1, radius * 1.009, radius * 1.009],
  ];
  lathe(
    out,
    'stone',
    c,
    level ? drum : [drum[0], drum.at(-1)],
    sides,
    kind === 'minimes' ? buff : dressed,
  );
  if (kind === 'minimes') {
    lathe(
      out,
      'footing',
      c,
      [
        [y0, radius * 1.02, radius * 1.02],
        [y1 - 5.82, radius * 1.005, radius * 1.005],
      ],
      sides,
      deepStone,
      { capTop: false },
    );
  } else {
    const rise = kind === 'heurtault' ? 4.95 : radius * 1.94;
    lathe(
      out,
      'roof',
      c,
      [
        [y1, radius * 1.095, radius * 1.095],
        [y1 + rise * 0.18, radius * 0.86, radius * 0.86],
        [y1 + rise, 0, 0],
      ],
      sides,
      slate,
    );
  }
  if (!level) return;
  const bays = radius > 7 ? 12 : 6;
  for (let i = 0; i < bays; i++) {
    const angle = ((i + 0.5) * 2 * Math.PI) / bays;
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    const r = radius * 1.033;
    const face = facade([c[0] + r * cos, c[1] + r * sin], [sin, -cos]);
    window(
      out,
      face,
      0,
      y1 - 1.69,
      radius > 6 ? 0.67 : 0.41,
      radius > 6 ? 1.13 : 0.83,
      1,
      'pointed',
      shade,
    );
    if (level >= 2 && radius > 5) {
      for (const y of [y1 - 5.55, y1 - 10.4]) {
        window(out, face, 0, y, 0.69, 1.85, level, 'round', shade);
      }
      if (kind === 'minimes') {
        fbox(out, 'stone', face, -0.19, 0.19, y1 - 3.72, y1 - 2.15, -0.42, -0.007, light);
      }
    }
  }
}

function riverLoggia(out, level) {
  const F = wallFace([17.2, -18.06], [-25.26, -19.96]);
  const width = F.length;
  fbox(out, 'footing', F, 0, width, -11.1, 6.32, -1.65, 0.21, buff);
  fbox(out, 'stone', F, 0.1, width - 0.1, 6.22, 6.66, -1.68, 0.72, light);
  if (level >= 1) {
    fbox(out, 'stone', F, 0.1, width - 0.1, 1.58, 2.09, -1.58, 0.59, light);
    for (let j = 0; j < 8; j++) {
      const u = 2.75 + (j * (width - 5.5)) / 7;
      window(out, F, u, 2.84, 3.25, 2.8, level, 'round', shade, 0.22);
      fbox(out, 'stone', F, u - 2.03, u - 1.62, 2.1, 5.62, 0.17, 0.4, buff);
    }
  }
  if (level >= 2) {
    for (let j = 0; j < 16; j++) {
      const u = 1.4 + (j * (width - 2.8)) / 15;
      panel(out, 'glass', F, u - 0.24, u + 0.24, -0.88, -0.23, shade, 0.24);
      if (level === 3) fbox(out, 'stone', F, u - 0.15, u + 0.15, 2.09, 2.49, 0.49, 0.66, dressed);
    }
  }
}

function chapel(out, level) {
  const ring = ringOf('31174156');
  const [x0, x1, z0, z1] = extents(ring);
  const c = [(x0 + x1) / 2, (z0 + z1) / 2];
  const base = grade(...c) + 0.96;
  const eave = base + plan.dimensions.chapelEaveEstimateM;
  extrude(out, 'footing', ring, base - 4.15, base, buff, { top: false });
  extrude(out, 'stone', ring, base, eave, light, { top: false });
  gableRoof(
    out,
    'roof',
    [x0 + 0.4, c[1] - 1.25],
    [x1 - 0.26, c[1] - 1.25],
    7.8,
    eave,
    eave + 4.7,
    slate,
    { overhang: 0.13, endSlot: 'stone', endColor: light },
  );
  const spike = [c[0] + 0.85, c[1] - 1.18];
  lathe(
    out,
    'roof',
    spike,
    [
      [eave + 4.23, 0.62, 0.62],
      [eave + 4.92, 0.41, 0.41],
      [eave + 9.65, 0, 0],
    ],
    level >= 2 ? 12 : 7,
    slate,
  );
  if (!level) return;
  const points = outwardRing(ring);
  for (let i = 0; i < points.length; i++) {
    const f = wallFace(points[i], points[(i + 1) % points.length]);
    if (f.length < 2.12) continue;
    const count = Math.max(1, Math.round(f.length / 2.9));
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * f.length) / count;
      window(
        out,
        f,
        u,
        base + 2.28,
        Math.min(1.3, (f.length / count) * 0.51),
        3.91,
        level,
        'pointed',
        chapelGlass,
      );
    }
    for (const u of [0.15, f.length - 0.15]) {
      fbox(out, 'stone', f, u - 0.14, u + 0.14, base + 0.12, eave + 0.84, -0.34, 0.35, light);
    }
  }
  if (level === 3)
    beam(
      out,
      'trim',
      [spike[0], eave + 9.6, spike[1]],
      [spike[0], eave + 9.98, spike[1]],
      0.054,
      0.054,
      light,
    );
}

function build(out, level) {
  wallPath(out, level);
  extrude(out, 'footing', frame.geometry.outline, -7.57, 2.62, deepStone, { top: false });
  riverLoggia(out, level);
  range(out, '451409826', 5.7, 15.7, 7.85, true, level, 3.57);
  range(out, '451409827', 1.22, 15.6, 8.8, false, level, 3.15);
  range(out, '451409830', 1.41, 12.7, 5.31, true, level, 0);
  range(out, '451514984', 1.42, 9.9, 3.9, true, level, 0);
  circular(out, '451514985', 2.18, -3.3, 14.9, 'turret', level);
  circular(out, '451409828', 2.04, 2.42, 18.61, 'turret', level);
  circular(out, '451409829', 1.79, 1.65, 15.87, 'turret', level);
  circular(out, '451409825', 10.65, -14.6, 9.7, 'minimes', level);
  circular(out, '176699223', 12.05, -16.8, 3.32, 'heurtault', level);
  circular(out, '31174159', 5.02, -20.9, -3.08, 'minimes', level);
  chapel(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'chateau-d-amboise-model.mjs';
const camera = [-112, 68, -162];
const lookAt = [15, 3, 46];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: "Château d'Amboise",
  wikidataId: plan.wikidataId,
  category: 'castle',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The royal lodging, vaulted river facade, Tour des Minimes, Tour Heurtault, Tour Garçonnet and Chapelle Saint-Hubert above the Loire.',
  camera,
  lookAt,
  sunDirection: [-75, 88, -112],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Named château building outline for the surviving royal lodgings.',
  },
  embeddedCanonicalGraphs: ['stone_limestone', 'stone_limestone_weathered', 'slate', 'brick'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'loire-front-loggia-and-minimes', position: [29, 3, -104], lookAt: [0, 6, -13] },
    { name: 'chapel-and-town-side', position: [-104, 17, 69], lookAt: [-50, 6, 29] },
    { name: 'fortified-terrace-and-heurtault', position: [122, 96, 129], lookAt: [16, 2, 37] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'chateau-d-amboise-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.96,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.46, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.062, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
