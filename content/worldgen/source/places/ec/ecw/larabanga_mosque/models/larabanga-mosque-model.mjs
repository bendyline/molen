/** The post-restoration mud-plaster mosque at Larabanga. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  s = plan.section;
const [mappedOutline] = read('map-frame').geometry.polygons;
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  earth: { slot: 'foundation', graph: 'earth_rammed', roughness: 0.97, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_log', roughness: 0.93, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.93, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    plaster: 'e3d9c3',
    bright: 'ece6d6',
    shade: 'cec1a9',
    roof: 'a79679',
    earth: '58544b',
    timber: '71614d',
    cut: '4c4840',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const white = 'palette:#ffffff',
  up = [0, 1, 0];

function face(out, slot, points, expected, tint) {
  let n = normalFor(...points);
  if (n.reduce((dot, v, i) => dot + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}

const directions = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];
function facade(side) {
  const [nx, nz] = directions[side];
  const normal = [nx, 0, nz];
  return {
    normal,
    at: (u, y, p = 0) => [nz * u + nx * (s.halfSize + p), y, -nx * u + nz * (s.halfSize + p)],
  };
}
function panel(out, slot, e, a, b, low, high, depth, tint) {
  face(
    out,
    slot,
    [e.at(a, low, depth), e.at(b, low, depth), e.at(b, high, depth), e.at(a, high, depth)],
    e.normal,
    tint,
  );
}

function cap(out, slot, ring, tint) {
  for (let i = 1; i < ring.length - 1; i++) {
    face(out, slot, [ring[0], ring[i], ring[i + 1]], up, tint);
  }
}
function roundedRing(width, depth, lod) {
  const a = width / 2,
    b = depth / 2;
  if (lod < 2)
    return [
      [-a, -b],
      [a, -b],
      [a, b],
      [-a, b],
    ];
  const cut = Math.min(a, b) * 0.45;
  return [
    [-a + cut, -b],
    [a - cut, -b],
    [a, -b + cut],
    [a, b - cut],
    [a - cut, b],
    [-a + cut, b],
    [-a, b - cut],
    [-a, -b + cut],
  ];
}
function molded(out, levels, at, lod, tint = c.bright) {
  const rings = levels.map(([y, w, d, u, p]) =>
    roundedRing(w, d, lod).map(([x, z]) => at(u + x, y, p + z)),
  );
  for (let k = 1; k < rings.length; k++) {
    const old = rings[k - 1],
      next = rings[k];
    const center = at(levels[k][3], levels[k][0], levels[k][4]);
    const dark = levels[k][0] <= s.baseTop;
    for (let i = 0; i < old.length; i++) {
      const j = (i + 1) % old.length;
      const direction = [
        next[i][0] + next[j][0] - center[0] * 2,
        0,
        next[i][2] + next[j][2] - center[2] * 2,
      ];
      face(
        out,
        dark ? 'earth' : 'plaster',
        [old[i], old[j], next[j], next[i]],
        direction,
        dark ? c.earth : tint,
      );
    }
  }
  cap(out, 'plaster', rings.at(-1), tint);
}

function door(out, e, u, width, top, lod) {
  const a = u - width / 2,
    b = u + width / 2,
    low = s.threshold;
  panel(out, 'earth', e, -4, a, s.foundation, s.baseTop, 0, c.earth);
  panel(out, 'earth', e, b, 4, s.foundation, s.baseTop, 0, c.earth);
  panel(out, 'plaster', e, -4, a, s.baseTop, s.parapet, 0, c.plaster);
  panel(out, 'plaster', e, b, 4, s.baseTop, s.parapet, 0, c.plaster);
  panel(out, 'plaster', e, a, b, top, s.parapet, 0, c.plaster);
  panel(out, 'dark', e, a, b, low, top, -0.33, c.cut);
  panel(out, 'earth', e, a, b, s.foundation, low, 0, c.earth);
  for (const [x, dir] of [
    [a, 1],
    [b, -1],
  ]) {
    const n = [e.normal[2] * dir, 0, -e.normal[0] * dir];
    face(
      out,
      'plaster',
      [e.at(x, low), e.at(x, top), e.at(x, top, -0.33), e.at(x, low, -0.33)],
      n,
      c.shade,
    );
  }
  face(
    out,
    'plaster',
    [e.at(a, top), e.at(b, top), e.at(b, top, -0.33), e.at(a, top, -0.33)],
    [0, -1, 0],
    c.shade,
  );
  face(
    out,
    'earth',
    [e.at(a, low, 0.21), e.at(b, low, 0.21), e.at(b, low, -0.33), e.at(a, low, -0.33)],
    up,
    c.roof,
  );
  if (lod) {
    beam(
      out,
      'timber',
      e.at(a - 0.12, top + 0.015, 0.065),
      e.at(b + 0.14, top + 0.015, 0.065),
      0.11,
      0.19,
      c.timber,
    );
  }
}
function body(out, lod) {
  const doors = [
    [s.frontEntry, s.frontEntryWidth, s.frontEntryHead],
    [0.76, 0.65, 1.39],
    [-0.89, 0.65, 1.34],
    [-0.77, 0.7, 1.41],
  ];
  for (let side = 0; side < 4; side++) door(out, facade(side), ...doors[side], lod);
  const h = s.halfSize,
    y = s.roof;
  face(
    out,
    'earth',
    [
      [-h, y, -h],
      [h, y, -h],
      [h, y, h],
      [-h, y, h],
    ],
    up,
    c.roof,
  );
  for (let side = 0; side < 4; side++) {
    const e = facade(side);
    panel(out, 'plaster', e, -h, h, y, s.parapet, -0.19, c.shade);
    face(
      out,
      'plaster',
      [
        e.at(-h, s.parapet),
        e.at(h, s.parapet),
        e.at(h, s.parapet, -0.19),
        e.at(-h, s.parapet, -0.19),
      ],
      up,
      c.bright,
    );
  }
}

function toron(out, e, u, y, depth, length, drift = 0.045) {
  beam(
    out,
    'timber',
    e.at(u, y, depth - 0.16),
    e.at(u + drift, y - 0.06, depth + length),
    0.065,
    0.07,
    c.timber,
  );
}
function buttresses(out, lod) {
  for (let side = 0; side < 4; side++) {
    const e = facade(side);
    const centers = side === 0 ? s.frontButtresses : [-3.64, -2.09, 0.06, 2.03, 3.63];
    const entryCenter = side === 1 ? 0.76 : side === 2 ? -0.89 : -0.77;
    for (const [i, u] of centers.entries()) {
      if (side && Math.abs(u - entryCenter) < 0.9) continue;
      const corner = i === 0 || i === centers.length - 1;
      const height = corner ? 3.62 : 3.34 + 0.11 * (i % 3);
      const width = corner ? 0.87 : 0.63,
        depth = corner ? 0.83 : 0.67;
      const levels = [
        [s.foundation, width, depth, u, 0.18],
        [s.baseTop, width, depth, u, 0.17],
        [1.91, width * 0.58, depth * 0.7, u + 0.025, 0.12],
        [height - 0.27, width * 0.3, depth * 0.39, u + 0.047, 0.04],
        [height, width * 0.083, depth * 0.13, u + 0.047, 0.027],
      ];
      molded(out, levels, e.at, lod);
      const ys =
        lod === 3
          ? [0.74, 1.32, 1.97, 2.59]
          : lod === 2
            ? [0.74, 1.57, 2.43]
            : lod
              ? [1.0, 2.1]
              : corner
                ? [2.35]
                : [];
      for (const y of ys) toron(out, e, u + 0.035, y, 0.48 - y * 0.092, 0.24 + (i % 3) * 0.06);
    }
    if (lod) {
      for (const y of [0.91, 1.43, 1.96, 2.46]) {
        const limits =
          side === 0 && y < 1.55
            ? [
                [-3.65, -0.47],
                [0.79, 3.65],
              ]
            : [[-3.65, 3.65]];
        for (const [a, b] of limits) {
          if (side && y < 1.5) {
            for (const [u, v] of [
              [a, entryCenter - 0.43],
              [entryCenter + 0.43, b],
            ]) {
              beam(
                out,
                'timber',
                e.at(u, y, 0.02),
                e.at(v, y + 0.016, 0.02),
                0.037,
                0.047,
                c.timber,
              );
            }
          } else {
            beam(out, 'timber', e.at(a, y, 0.02), e.at(b, y + 0.019, 0.02), 0.037, 0.047, c.timber);
          }
        }
      }
    }
  }
}
function entryPanel(out, lod) {
  const e = facade(0),
    u = s.frontEntry;
  const low = 1.55,
    top = 3.56;
  molded(
    out,
    [
      [low, 1.36, 0.62, u, 0.11],
      [2.68, 0.77, 0.48, u, 0.083],
      [top - 0.17, 0.26, 0.26, u, 0.039],
      [top, 0.064, 0.075, u, 0.018],
    ],
    e.at,
    lod,
    c.bright,
  );
  const rows = lod >= 2 ? [6, 5, 4, 3, 2, 1] : lod ? [5, 4, 3, 2, 1] : [3, 2, 1];
  for (const [i, count] of rows.entries()) {
    const y = 1.75 + (i * 1.04) / (rows.length - 1);
    const depth = (y < 2.68 ? 0.42 - (y - low) * 0.087 : 0.323 - (y - 2.68) * 0.148) + 0.018;
    for (let j = 0; j < count; j++) {
      const x = u + (j - (count - 1) / 2) * 0.148;
      face(
        out,
        'dark',
        [
          e.at(x - 0.043, y, depth),
          e.at(x, y - 0.051, depth + 0.003),
          e.at(x + 0.043, y, depth),
          e.at(x, y + 0.051, depth - 0.003),
        ],
        e.normal,
        c.cut,
      );
    }
  }
}
function towers(out, lod) {
  for (const { x, z, baseWidth, height } of s.towers) {
    const at = (u, y, p) => [x + u, y, z + p];
    const width = baseWidth;
    const levels = [
      [s.roof - 0.12, width, width * 0.92, 0, 0],
      [height - 0.97, width * 0.66, width * 0.61, 0.01, 0.01],
      [height - 0.42, width * 0.4, width * 0.38, 0.015, 0.018],
      [height - 0.095, width * 0.13, width * 0.12, 0.016, 0.02],
      [height, width * 0.039, width * 0.039, 0.016, 0.02],
    ];
    molded(out, levels, at, lod, c.bright);
    if (lod) {
      const rows = lod >= 2 ? [0.32, 0.52, 0.72, 0.88] : [0.4, 0.69];
      for (const [nx, nz] of directions) {
        for (const f of rows) {
          const y = s.roof + (height - s.roof) * f;
          const next = levels.findIndex((level) => level[0] >= y);
          const a = levels[next - 1],
            b = levels[next];
          const t = (y - a[0]) / (b[0] - a[0]);
          const [w, d, dx, dz] = a.slice(1).map((v, i) => v + (b[i + 1] - v) * t);
          const radius = (nx ? w : d) / 2,
            u = Math.min(w, d) * 0.1;
          beam(
            out,
            'timber',
            [x + dx + nx * (radius - 0.14) + nz * u, y, z + dz + nz * (radius - 0.14) - nx * u],
            [
              x + dx + nx * (radius + 0.26) + nz * u,
              y - 0.04,
              z + dz + nz * (radius + 0.26) - nx * u,
            ],
            0.059,
            0.062,
            c.timber,
          );
        }
      }
    }
  }
}
function build(out, lod) {
  body(out, lod);
  buttresses(out, lod);
  entryPanel(out, lod);
  towers(out, lod);
  if (lod >= 2)
    box(
      out,
      'earth',
      s.frontEntry,
      s.foundation,
      4.14,
      1.08,
      s.threshold - s.foundation - 0.012,
      0.47,
      c.roof,
    );
}
export const larabangaSkyline = (out) => build(out, 0);
export const larabangaDistrict = (out) => build(out, 1);
export const larabangaStreet = (out) => build(out, 2);
export const larabangaCloseup = (out) => build(out, 3);
const recipe = 'larabanga-mosque-model.mjs',
  camera = [11, 8, 15.3],
  lookAt = [0, 2.1, 0.3];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'larabangaDistrict', 0.105],
    ['street', 'larabangaStreet', 0.046],
    ['closeup', 'larabangaCloseup', 0.018],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const larabangaModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: larabangaCloseup,
  category: 'mosque',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Restored Larabanga Mosque with its whitewashed tapered adobe buttresses, dark plinth, timber torons, unequal towers and small patterned entry.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline: mappedOutline,
    minimumCoverage: 0.92,
    basis:
      'Mapped historic mosque envelope from OSM way 709927303, with the national board’s approximate 8m body dimensions.',
  },
  mediumFiContext: {
    scale: 0.7,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'earth_rammed', 'wood_log'],
  qaCameras: [
    {
      name: 'south-entry-torons-and-buttresses',
      position: [0.1, 2.75, 15.8],
      lookAt: [0, 2.28, 3],
    },
    { name: 'tapered-minaret-and-earthen-roof', position: [13, 9, 9.4], lookAt: [0.3, 2.48, 0] },
    { name: 'mihrab-tower-and-west-elevation', position: [-12.2, 4.1, -7.4], lookAt: [0, 2.16, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-larabanga-mosque-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'larabangaSkyline',
    errorMeters: 0.25,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and two exact first-party public-domain Qualla photographs.',
};
