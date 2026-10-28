/** Photo/map reconstruction of the damaged Antonivka crossing, not an intact road. */
import './install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { box, tube, tubePath } from './structure-mesh.mjs';

const frame = JSON.parse(
  await readFile(
    new URL(
      '../../../content/worldgen/source/places/u8/u8r/antonivka_road_bridge/map-frame.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
export const antonivkaRuns = frame.geometry.outlines
  .map((points) => [Math.min(...points.map((p) => p[0])), Math.max(...points.map((p) => p[0]))])
  .sort((a, b) => a[0] - b[0]);
export const antonivkaPiers = [
  -650, -612, -574, -536, -498, -460, -422, -384, -346, -308, -265, -160, -55, 50, 155, 205, 255,
  305, 355, 405, 455, 505, 555, 595, 635, 665,
];
const half = 680.7745;
export const antonivkaDeck = (x) => 15.2 + 9.6 * (1 - (x / half) ** 2);
const concrete = [0.69, 0.69, 0.66],
  pale = [0.79, 0.78, 0.72],
  asphalt = [0.31, 0.32, 0.32];
const blue = [0.16, 0.36, 0.51],
  yellow = [0.69, 0.58, 0.24],
  iron = [0.31, 0.33, 0.33];
const broken = [0.53, 0.52, 0.48],
  white = [0.82, 0.82, 0.76];
const limits = {
  skyline: { step: 200, rails: 0, lamps: 0, fine: false, debris: false },
  district: { step: 160, rails: 0, lamps: 432, fine: false, debris: true, coarse: true },
  street: { step: 24, rails: 16, lamps: 96, fine: false, debris: true },
  closeup: { step: 8, rails: 4, lamps: 36, fine: false, debris: true },
  source: { step: 4, rails: 2, lamps: 36, fine: true, debris: true },
};
function writer(out, far) {
  const means = {
    concrete: [0.710816, 0.710816, 0.681928],
    road: [0.710816, 0.710816, 0.681928],
    iron: [0.83, 0.83, 0.83],
    marking: [0.83, 0.83, 0.83],
  };
  const emit = (slot, ref, points, hint, _uv, color) => {
    points = points.map((p) => p.map(Math.fround));
    for (let i = 1; i < points.length - 1; i++) {
      let t = [points[0], points[i], points[i + 1]],
        n = normalFor(...t);
      if (hint && n.reduce((sum, v, j) => sum + v * hint[j], 0) < 0) {
        t = [t[0], t[2], t[1]];
        n = normalFor(...t);
      }
      out.addTriangle(
        slot,
        ref,
        t,
        n,
        t.map((p) => [p[0], p[2]]),
        far ? color.map((v, j) => v * (means[slot]?.[j] ?? 1)) : color,
      );
    }
  };
  return Object.fromEntries(
    ['addTriangle', 'addQuad', 'addConvexPolygon'].map((key) => [key, emit]),
  );
}
function face(out, slot, points, color, n) {
  out.addQuad(slot, 'palette:#ffffff', points, n ?? normalFor(...points), null, color);
}
function samples(a, b, step, knots = []) {
  const n = Math.ceil((b - a) / step);
  return [
    ...new Set([
      ...Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n),
      ...knots.filter((x) => x > a && x < b),
    ]),
  ].sort((a, b) => a - b);
}
function slab(out, a, b, z0, z1, top, bottom, color, slot = 'concrete', step = 32) {
  loft(
    out,
    slot,
    samples(a, b, step).map((x) => [
      [x, top(x), z0],
      [x, top(x), z1],
      [x, bottom(x), z1],
      [x, bottom(x), z0],
    ]),
    color,
  );
}
function pier(out, x, simple, damaged = false) {
  const top = antonivkaDeck(x) - 3.1;
  const z = [-9.8, -5.7, -4.8, 4.8, 5.7, 9.8];
  const profile = [
    [z[0], 0.1],
    [z[0] + 0.6, top],
    [z[5] - 0.6, top],
    [z[5], 0.1],
    [z[4], 0.1],
    [z[3], top - 2.1],
    [z[2], top - 2.1],
    [z[1], 0.1],
  ];
  const p = (i, side) => [x + side * 1.2, profile[i][1], profile[i][0]];
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    face(out, 'concrete', [p(i, -1), p(j, -1), p(j, 1), p(i, 1)], concrete);
  }
  for (const side of [-1, 1])
    for (const indices of [
      [0, 1, 6, 7],
      [1, 2, 5, 6],
      [2, 3, 4, 5],
    ])
      face(
        out,
        'concrete',
        indices.map((i) => p(i, side)),
        concrete,
        [side, 0, 0],
      );
  if (!simple) {
    for (const zz of [-6.8, 6.8])
      box(out, 'concrete', [x - 1.8, 0.05, zz - 3.5], [x + 1.8, 0.7, zz + 3.5], broken);
    if (!damaged)
      for (const zz of [-5, 5])
        box(out, 'iron', [x - 0.6, top, zz - 1.5], [x + 0.6, top + 0.32, zz + 1.5], iron);
  }
}
const girderDepth = (x) => {
  const distance = Math.min(...antonivkaPiers.map((p) => Math.abs(x - p)));
  return 2.3 + 2.2 * Math.max(0, 1 - distance / 20) ** 2;
};
function intactRun(out, a, b, options, far) {
  // Each run is independent: no deck or parapet is emitted across either mapped breach.
  slab(
    out,
    a,
    b,
    -12.5,
    12.5,
    antonivkaDeck,
    (x) => antonivkaDeck(x) - 0.62,
    concrete,
    'concrete',
    options.step,
  );
  for (const zz of [-5, 5]) {
    const coarse = far || options.coarse;
    const points = samples(a, b, options.step, coarse ? [] : antonivkaPiers);
    loft(
      out,
      'concrete',
      points.map((x) => [
        [x, antonivkaDeck(x) - 0.62, zz - 4.4],
        [x, antonivkaDeck(x) - 0.62, zz + 4.4],
        [x, antonivkaDeck(x) - (coarse ? 3.1 : girderDepth(x)), zz + 3.5],
        [x, antonivkaDeck(x) - (coarse ? 3.1 : girderDepth(x)), zz - 3.5],
      ]),
      concrete,
    );
  }
  if (far) return;
  slab(
    out,
    a,
    b,
    -10.2,
    10.2,
    (x) => antonivkaDeck(x) + 0.035,
    (x) => antonivkaDeck(x) + 0.015,
    asphalt,
    'road',
    options.step,
  );
  for (const side of [-1, 1]) {
    const z0 = side < 0 ? -12.5 : 10.3,
      z1 = side < 0 ? -10.3 : 12.5;
    slab(
      out,
      a,
      b,
      z0,
      z1,
      (x) => antonivkaDeck(x) + 0.25,
      antonivkaDeck,
      pale,
      'concrete',
      options.step,
    );
    for (const h of [0.58, 1.34])
      slab(
        out,
        a,
        b,
        side * 12.35 - 0.055,
        side * 12.35 + 0.055,
        (x) => antonivkaDeck(x) + h + 0.055,
        (x) => antonivkaDeck(x) + h - 0.055,
        h > 1 ? blue : yellow,
        'iron',
        options.step,
      );
    if (options.rails) {
      for (let x = a + 0.6; x < b - 0.3; x += options.rails) {
        const y = antonivkaDeck(x);
        box(
          out,
          'iron',
          [x - 0.07, y + 0.24, side * 12.35 - 0.07],
          [x + 0.07, y + 1.39, side * 12.35 + 0.07],
          yellow,
        );
        if (options.fine)
          for (const dx of [0.45, 0.9, 1.35]) {
            if (x + dx >= b) continue;
            const yy = antonivkaDeck(x + dx);
            box(
              out,
              'iron',
              [x + dx - 0.025, yy + 0.58, side * 12.35 - 0.025],
              [x + dx + 0.025, yy + 1.3, side * 12.35 + 0.025],
              blue,
            );
          }
      }
    }
    if (options.lamps)
      for (
        let x = Math.ceil((a + 3) / options.lamps) * options.lamps;
        x < b - 3;
        x += options.lamps
      ) {
        const y = antonivkaDeck(x),
          z = side * 11.6;
        const n = options.fine ? 8 : 4;
        tube(out, 'iron', [x, y + 0.25, z], [x, y + 4.5, z], 0.1, yellow, n);
        tube(out, 'iron', [x, y + 4.5, z], [x, y + 8.1, z], 0.085, blue, n);
        const curve = [
          [x, y + 8.1, z],
          [x, y + 8.8, z - side * 0.2],
          [x, y + 9.2, z - side * 0.8],
          [x, y + 9.3, z - side * 1.8],
        ];
        tubePath(out, 'iron', curve, 0.075, iron, n);
        box(
          out,
          'iron',
          [x - 0.25, y + 9.15, z - side * 1.8 - 0.45],
          [x + 0.25, y + 9.36, z - side * 1.8 + 0.45],
          iron,
        );
      }
  }
  for (const z of [-9.9, 9.9, -0.1, 0.1])
    slab(
      out,
      a + 0.2,
      b - 0.2,
      z - 0.055,
      z + 0.055,
      (x) => antonivkaDeck(x) + 0.042,
      (x) => antonivkaDeck(x) + 0.038,
      white,
      'marking',
      options.step,
    );
  if (options.rails)
    for (const z of [-5.1, 5.1])
      for (let x = Math.ceil(a / 12) * 12; x < b - 0.1; x += 12)
        slab(
          out,
          x,
          Math.min(x + 3, b - 0.05),
          z - 0.06,
          z + 0.06,
          (xx) => antonivkaDeck(xx) + 0.043,
          (xx) => antonivkaDeck(xx) + 0.039,
          white,
          'marking',
          10,
        );
}
function fractures(out, options) {
  const ends = [antonivkaRuns[0][1], antonivkaRuns[1][0], antonivkaRuns[1][1], antonivkaRuns[2][0]];
  for (let i = 0; i < ends.length; i++) {
    const x = ends[i],
      sign = i % 2 ? -1 : 1,
      y = antonivkaDeck(x);
    // Jagged surviving lips and exposed bars remain separate from the navigable deck.
    const count = options.fine ? 17 : 7;
    for (let j = 0; j < count; j++) {
      const z0 = -12.5 + (25 * j) / count,
        z1 = -12.5 + (25 * (j + 1)) / count;
      const length = 0.55 + 0.7 * (1 + Math.sin(j * 4.7 + i));
      slab(
        out,
        Math.min(x, x + sign * length),
        Math.max(x, x + sign * length),
        z0,
        z1,
        () => y - 0.09,
        () => y - 0.68,
        broken,
        'concrete',
        3,
      );
    }
    if (options.rails)
      for (let z = -11.5; z < 12; z += options.fine ? 1.15 : 3) {
        const bend = 1.4 + 0.8 * Math.sin(z * 1.7 + i);
        beam(
          out,
          'iron',
          [x, y - 0.35, z],
          [x + sign * bend, y - 1.3, z + 0.25],
          options.fine ? 0.035 : 0.07,
          0.06,
          iron,
        );
      }
  }
  const pieces = [
    {
      a: antonivkaRuns[0][1] + 1.8,
      b: -250,
      ya: antonivkaDeck(antonivkaRuns[0][1]) - 1.4,
      yb: 1.8,
    },
    { a: -210, b: -169, ya: 1.4, yb: 4.8 },
    { a: -147, b: -103, ya: 5.2, yb: 1.5 },
  ];
  for (const p of pieces) {
    const y = (x) => p.ya + ((p.yb - p.ya) * (x - p.a)) / (p.b - p.a);
    slab(out, p.a, p.b, -11.5, 11.7, y, (x) => y(x) - 0.8, broken, 'concrete', 20);
    for (const z of [-5, 5])
      slab(
        out,
        p.a,
        p.b,
        z - 3.8,
        z + 3.8,
        (x) => y(x) - 0.8,
        (x) => y(x) - 2.8,
        concrete,
        'concrete',
        20,
      );
  }
}
export function buildAntonivkaLevel(output, level = 'source') {
  const options = limits[level];
  if (!options) throw Error('Unknown Antonivka detail level');
  const far = level === 'skyline',
    out = writer(output, far);
  for (const [a, b] of antonivkaRuns) intactRun(out, a, b, options, far);
  for (const x of antonivkaPiers) pier(out, x, far, x === -265 || x === -160 || x === 50);
  if (options.debris) fractures(out, options);
  else {
    // Keep all three large slumped remains even in the distance representation.
    for (const [a, b, high, low] of [
      [-283.55, -250, antonivkaDeck(antonivkaRuns[0][1]) - 1.4, 1.8],
      [-210, -169, 1.4, 4.8],
      [-147, -103, 5.2, 1.5],
    ]) {
      const y = (x) => high + ((low - high) * (x - a)) / (b - a);
      slab(out, a, b, -11.5, 11.7, y, (x) => y(x) - 1.5, broken, 'concrete', 100);
    }
  }
}
export const buildAntonivka = (out) => buildAntonivkaLevel(out, 'source');
export const antonivkaStudy = {
  id: 'antonivka_road_bridge',
  key: 'antonivka_road_bridge',
  title: 'Antonivka Road Bridge',
  wikidataId: 'Q4067525',
  mapFrameDocument: 'map-frame.json',
  build: buildAntonivka,
  fidelityTarget: 'medium-fi',
  brief:
    'Dated post-November2022 damaged exterior: three surviving mapped deck runs separated by two breaches, paired tapered portal piers, haunched twin concrete girders, four-lane road/footways, blue-and-yellow railings/lamp standards and slumped fractured spans. Not an intact operating road.',
  refs: [
    'https://commons.wikimedia.org/wiki/File:Antonivka_Road_Bridge_after_Battle_of_Kherson_(01).jpg',
    'https://commons.wikimedia.org/wiki/File:Destroyed_Antonivka_Road_Bridge,_Kherson,_2022.11.14_(1).jpg',
    'https://www.openstreetmap.org/relation/14890184',
  ],
  sourceFacts: {
    nominalLengthMeters: 1366,
    nominalWidthMeters: 25,
    mappedExtentMeters: 1361.549,
    deckRuns: antonivkaRuns,
    identity: 'Exact-QID retained multipart OpenStreetMap bridge relation14890184.',
    visualState:
      'Dated damaged-state reconstruction after November2022; not a claim of a fresh2026 site inspection.',
  },
  reconstruction: {
    deckHeightMeters: [15.2, 24.8, 15.2],
    pierStations: antonivkaPiers,
    notes:
      'Mapped surviving slab extents are preserved at scale. Vertical profile,26 paired-pier stations, girder haunches, fracture lips, slumped debris, lamp pitch and hidden fittings are picture-led approximations, not an engineering or damage survey. The width25m includes footways; no fictitious intact deck crosses the mapped gaps.',
  },
  nativeAxes: {
    x: 'south-southeast toward left bank; negativeX is Kherson/right bank',
    y: 'up from provisional river water zero',
    z: 'west-southwest downstream side',
  },
  surfaceOverrides: { road: 'concrete', marking: 'iron' },
  geographic: (map) => ({
    anchor: map.anchor,
    heading: map.heading,
    elevationMode: 'sea-level',
    elevationMeters: 0,
    replaceFootprint: false,
    notes:
      'Full original crossing axis with surviving mapped deck components and explicit open breaches. Dated damaged state; provisional water/deck levels require native rendered fit.',
  }),
  limitations: [
    'Dated post-November2022 damaged-state reconstruction, not a current engineering inspection or drivable historical bridge.',
    'Mapped multipart deck footprints control major gap placement. Individual fracture profiles, hanging bars, underwater debris and damage to hidden pier faces are not surveyed.',
    '26 paired-pier groups and their stationing are inferred visual structure, not a verified original span schedule.',
    'River zero,15.2m bank deck and24.8m central deck are provisional viewer elevations; neighboring approach grades require standard PMTiles/Mapzen review.',
    'Ships, temporary barge crossings, military activity, vehicles, signs, buried foundations and adjacent bank architecture are outside this asset.',
    'Shared concrete grain supplies paving/asphalt microvariation with component tints; no bespoke texture, embedded photo or directional lighting is baked into surfaces.',
    'Physical laptop/phone measurements remain pending. Runtime levels deliberately reduce lamps, rail posts, fracture teeth and exposed bars.',
  ],
  camera: { position: [850, 350, 950], lookAt: [0, 13, 0], fov: 46 },
  qaCameras: [
    { name: 'major-breach', position: [-190, 63, 110], lookAt: [-170, 12, 0] },
    { name: 'minor-breach', position: [54, 36, 65], lookAt: [54, 22, 0] },
    { name: 'portal-piers', position: [198, 9, 55], lookAt: [205, 11, 0] },
    { name: 'road-and-lamps', position: [330, 26, 7], lookAt: [230, 29, 0] },
    { name: 'fracture-end', position: [-298, 28, 29], lookAt: [-283, 21, 0] },
    { name: 'girders-and-footways', position: [180, 14, 35], lookAt: [220, 21, 0] },
    { name: 'surviving-deck-plan', position: [0, 780, 0.1], lookAt: [0, 0, 0] },
  ],
};
