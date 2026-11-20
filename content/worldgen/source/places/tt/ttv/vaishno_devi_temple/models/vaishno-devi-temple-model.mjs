import { readFileSync } from 'node:fs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  planarMid,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));

const tone = palette({
  white: 'dcdad0',
  chalk: 'e6e3da',
  walls: 'c9c7ba',
  band: 'b5b7ac',
  stone: '8c8779',
  roof: 'b3b9b3',
  roofLight: 'c9cbc4',
  zinc: 'a8aba4',
  window: '586361',
  shade: '68706a',
  trim: 'e1ded3',
  green: '627f71',
  red: 'a65249',
  redShade: '884238',
  finial: 'be9b56',
});
const surfaces = {
  plaster: surface('wall', 'plaster_lime', 0.92),
  concrete: surface('foundation', 'concrete_plain', 0.93),
  stone: surface('foundation', 'stone_ashlar', 0.97),
  roof: surface('roof', 'metal_corrugated', 0.85, 0.16),
  window: surface('window', 'window_grid', 0.47),
  painted: surface('trim', 'metal_painted', 0.86, 0.08),
};
const mainRange = new Set([7, 10, 14, 18, 26]);
const towardFace = (point, center, f) => point.map((v, i) => mix(v, center[i], f));
const roofRing = (out, a, b, y, color, outer = 0.14) => {
  shell(out, a, () => y - 0.08, y + outer, { wall: 'painted', color });
  for (const [i, pt] of a.entries()) {
    const j = (i + 1) % a.length;
    face(
      out,
      'plaster',
      [at(pt, y + outer), at(a[j], y + outer), at(b[j], y + outer), at(b[i], y + outer)],
      up,
      color,
    );
  }
};

function capPavilion(out, center, y, rise, lod, color) {
  const [x, z] = center;
  const segments = lod === 0 ? 6 : 10;
  ring(
    out,
    'roof',
    center,
    [
      [y, 2.05],
      [y + 0.3, 1.87],
      [y + rise * 0.64, 1.15],
      [y + rise, 0.17],
    ],
    segments,
    color,
  );
  if (lod > 0)
    block(out, 'painted', x - 0.095, y + rise - 0.08, z - 0.095, 0.19, 0.76, 0.19, tone.finial);
}

function facadeBays(out, wing, corners, base, high, lod) {
  const longEdge = Math.max(
    ...pairs(closed(corners)).map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1])),
  );
  for (const [index, [a, b]] of pairs(closed(corners)).entries()) {
    const w = edge(a, b, areaSign(corners));
    if (w.length < 2.1) continue;
    const openGallery = mainRange.has(wing.index) && w.length >= longEdge * 0.56;
    const overGround = Math.min(grade(a), grade(b));
    const levels = [
      base,
      ...Array.from({ length: wing.stories - 1 }, (_, i) =>
        mix(base, high, (i + 1) / wing.stories),
      ),
    ];
    for (const [i, y0] of levels.entries()) {
      if (y0 < overGround - 1.05) continue;
      const top = Math.min(high - 0.27, y0 + (high - base) / wing.stories - 0.44);
      const sill = y0 + 0.7;
      if (top - sill < 0.23) continue;
      if (lod === 0) {
        if (openGallery)
          panel(out, 'window', w, 0.34, w.length - 0.34, sill, top, 0.025, tone.shade);
        continue;
      }
      if (i > 0 || openGallery)
        panel(out, 'plaster', w, 0, w.length, top + 0.04, top + 0.3, 0.048, tone.chalk);
      if (openGallery && i % 2 === 0) {
        panel(out, 'window', w, 0.34, w.length - 0.34, sill, top, 0.031, tone.window);
        const count = Math.max(2, Math.round(w.length / 3.08));
        for (let k = 1; k < count; k++) {
          const u = (w.length * k) / count;
          panel(out, 'plaster', w, u - 0.12, u + 0.12, sill - 0.05, top + 0.1, 0.071, tone.chalk);
          if (lod === 3)
            panel(out, 'painted', w, u - 0.08, u + 0.08, sill + 0.16, sill + 0.5, 0.095, tone.band);
        }
        if (lod > 1)
          panel(
            out,
            'painted',
            w,
            0.35,
            w.length - 0.35,
            sill + 0.18,
            sill + 0.38,
            0.075,
            tone.band,
          );
        continue;
      }
      const count = Math.max(1, Math.round(w.length / (lod === 1 ? 3.9 : 2.63)));
      const pitch = w.length / count;
      for (let k = 0; k < count; k++) {
        const u = pitch * (k + 0.5),
          radius = Math.min(pitch * 0.3, 0.9);
        panel(
          out,
          'window',
          w,
          u - radius,
          u + radius,
          sill,
          top,
          0.034,
          index % 2 ? tone.window : tone.shade,
        );
        if (lod >= 2)
          panel(
            out,
            'plaster',
            w,
            u - radius - 0.08,
            u + radius + 0.08,
            sill - 0.1,
            sill + 0.025,
            0.065,
            tone.trim,
          );
        if (lod === 3) panel(out, 'painted', w, u - 0.039, u + 0.039, sill, top, 0.071, tone.band);
      }
    }
  }
}

function hillsideWing(out, wing, lod) {
  const points = wing.points;
  const center = planarMid(points);
  const ground = points.map(grade);
  const low = Math.min(...ground);
  const median = ground.sort((a, b) => a - b)[Math.floor(ground.length / 2)];
  const base = Math.min(median - 0.24, low + 1.75);
  const high = Math.max(median + 3.7 + 0.95 * wing.stories, base + 2.85 * wing.stories);
  const parapet = wing.roof === 'terrace' ? 0.56 : 0.33;
  const color = mainRange.has(wing.index) ? tone.chalk : tone.white;
  shell(out, points, (p) => Math.min(base - 0.37, grade(p) - 0.64), base, {
    wall: 'stone',
    color: tone.stone,
  });
  shell(out, points, () => base, high, { wall: 'plaster', color });
  cap(out, 'concrete', points, high, tone.roof);
  if (lod > 0)
    roofRing(
      out,
      points,
      points.map((p) => towardFace(p, center, 0.09)),
      high,
      tone.chalk,
      parapet,
    );
  facadeBays(out, wing, points, base, high, lod);
  if (wing.roof === 'red') {
    capPavilion(out, center, high + 0.08, 2.37, lod, tone.red);
    const [x, z] = center;
    block(out, 'painted', x - 2.03, high + 0.04, z - 1.74, 4.06, 0.3, 3.48, tone.redShade);
  }
  if (wing.roof === 'terrace' && mainRange.has(wing.index)) {
    const points2 = points.map((p) => towardFace(p, center, 0.35));
    const room = high + (wing.index === 7 ? 2.42 : 1.84);
    shell(out, points2, () => high + 0.02, room, { wall: 'plaster', color: tone.white });
    cap(out, 'roof', points2, room, tone.roofLight);
    if (lod > 1)
      roofRing(
        out,
        points2,
        points.map((p) => towardFace(p, center, 0.4)),
        room,
        tone.white,
        0.23,
      );
  }
}

function coveredApproach(out, lod) {
  const hs = d.approach.map((pt) => grade(pt) + 1.28);
  for (const [i, [a, b]] of pairs(d.approach).entries()) {
    const w = edge(a, b);
    const first = hs[i],
      last = hs[i + 1],
      width = d.approachWidth / 2;
    const end = (u, y, v) => w.p(u, mix(first, last, u / w.length) + y, v);
    const strip = (slot, d0, d1, y0, y1, color) =>
      face(
        out,
        slot,
        [
          end(-0.15, y0, d0),
          end(w.length + 0.15, y0, d0),
          end(w.length + 0.15, y1, d1),
          end(-0.15, y1, d1),
        ],
        up,
        color,
      );
    strip('roof', -width - 0.28, 0, 2.75, 3.2, tone.roofLight);
    strip('roof', 0, width + 0.28, 3.2, 2.75, tone.zinc);
    strip('concrete', -width - 0.13, width + 0.13, 0, 0, tone.band);
    for (const s of [-1, 1]) {
      face(
        out,
        'plaster',
        [
          end(0, -0.52, s * width),
          end(w.length, -0.52, s * width),
          end(w.length, 0, s * width),
          end(0, 0, s * width),
        ],
        w.normal.map((v) => v * s),
        tone.walls,
      );
      if (lod === 0) continue;
      const spans = Math.max(2, Math.round(w.length / (lod === 1 ? 7 : 4.5)));
      for (let j = 0; j < spans; j++) {
        const u = ((j + 0.12) * w.length) / spans;
        const [x, y, z] = end(u, 0, s * width);
        const bottom = Math.min(y - 0.82, grade([x, z]) - 0.26);
        block(out, 'stone', x - 0.32, bottom, z - 0.29, 0.64, y - bottom + 0.03, 0.58, tone.stone);
        block(out, 'painted', x - 0.075, y, z - 0.075, 0.15, 2.77, 0.15, tone.green);
      }
      face(
        out,
        'painted',
        [
          end(0, 0.66, s * width),
          end(w.length, 0.66, s * width),
          end(w.length, 0.81, s * width),
          end(0, 0.81, s * width),
        ],
        w.normal.map((v) => v * s),
        tone.green,
      );
    }
  }
}

// The galleries share retaining terraces along the valley face.
const terraceContours = [
  [
    [-64, -15],
    [-57, -2],
    [-51, 12],
    [-57, 20],
  ],
  [
    [-43, -11],
    [-41, 2],
    [-35, 12],
    [-26, 17],
    [-17, 20],
  ],
  [
    [-21, -3],
    [-22, 9],
    [-13, 20],
    [-4, 23],
    [4, 28],
    [11, 30],
    [23, 26],
  ],
  [
    [-11, -29],
    [-17, -21],
    [-11, -13],
    [1, -8],
    [13, -1],
    [25, -4],
  ],
];

function hillsideTerraces(out, lod) {
  for (const contour of terraceContours) {
    for (const [a, b] of pairs(contour)) {
      const w = edge(a, b);
      const first = grade(a) + 2.1,
        last = grade(b) + 2.1;
      const top = (u, side, raise = 0) => w.p(u, mix(first, last, u / w.length) + raise, side);
      const ends = [top(0, 0), top(w.length, 0)];
      face(out, 'concrete', [...ends, top(w.length, -4.8), top(0, -4.8)], up, tone.roofLight);
      const foot = ([x, y, z]) => [x, Math.min(y - 1.8, grade([x, z]) - 0.35), z];
      face(out, 'stone', [...ends, foot(ends[1]), foot(ends[0])], w.normal, tone.stone);
      face(
        out,
        'plaster',
        [...ends, top(w.length, 0, 0.86), top(0, 0, 0.86)],
        w.normal,
        tone.chalk,
      );
      if (lod > 1) {
        face(
          out,
          'painted',
          [
            top(0, 0.04, 0.84),
            top(w.length, 0.04, 0.84),
            top(w.length, -0.11, 0.91),
            top(0, -0.11, 0.91),
          ],
          up,
          tone.white,
        );
      }
    }
  }
}

function build(out, lod) {
  for (const wing of d.components) hillsideWing(out, wing, lod);
  coveredApproach(out, lod);
  hillsideTerraces(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'vaishno-devi-temple-model.mjs';
const camera = [-163, 41, 190],
  lookAt = [-14, 1, 20];
export const bhawanModel = {
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
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The central Bhawan terrace fixes the model datum. The visible wings were fitted to heights from the original hillside field.',
  brief:
    'The Vaishno Devi Holy Bhawan’s stacked white hillside buildings and the immediately adjoining covered approach on Trikuta.',
  camera,
  lookAt,
  sunDirection: [-32, 55, 42],
  mediumFiContext: {
    scale: 1,
    groundY: -72,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.polygons,
    minimumCoverage: 0.91,
    basis:
      'Each of the selected Overture building outlines bounds the corresponding authored roof and replaces ordinary building massing.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'bhawan-from-the-valley', position: [-158, 30, 167], lookAt: [-13, -10, 12] },
    { name: 'terraces-and-rooftops', position: [-108, 46, 111], lookAt: [-15, 1, 16] },
    { name: 'covered-pilgrim-approach', position: [-57, 24, 106], lookAt: [5, 0, 51] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'bhawan-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.16,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.55, surfaces },
      street: { export: 'street', errorMeters: 0.25, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.075, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. Supplementary creator photographs are released under CC0. OpenStreetMap and Overture building vectors are attributed in the geographic source file.',
};
