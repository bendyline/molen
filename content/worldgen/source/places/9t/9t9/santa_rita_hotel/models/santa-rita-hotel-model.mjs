/** Santa Rita Hotel, Tucson. Dimensions are metres in the historic street frame. */
import { readFileSync } from 'node:fs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const bounds = Object.fromEntries(
  frame.features.map(({ role, points }) => [role, [...points[0], ...points[2]]]),
);
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9, metallic: 0 },
  canvas: { slot: 'trim', graph: 'fabric_canvas', roughness: 0.92, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  accent: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.62, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    wall: 'd4b28b',
    trim: 'dfc49d',
    shaded: 'be9b76',
    warm: 'cda780',
    joint: '9c8065',
    glass: '3f5550',
    upperGlass: '647870',
    deep: '313631',
    wood: '5d4935',
    roof: '8a7862',
    clay: '8e5034',
    green: '777941',
    gold: 'd4a447',
    linen: 'f0cd80',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const rect = (out, slot, a, b, y0, y1, z, tint) => {
  if (b - a > 0.001 && y1 - y0 > 0.001)
    face(
      out,
      slot,
      [
        [a, y0, z],
        [b, y0, z],
        [b, y1, z],
        [a, y1, z],
      ],
      tint,
    );
};

function pane(out, a, b, low, spring, rise, lod, shop) {
  const segments = lod > 2 ? 10 : 6;
  const depth = -0.23;
  const tint = shop ? color.deep : color.glass;
  rect(out, 'accent', a, b, low, spring, depth, tint);
  face(
    out,
    'plaster',
    [
      [a, low, depth],
      [b, low, depth],
      [b, low, 0],
      [a, low, 0],
    ],
    color.shaded,
  );
  face(
    out,
    'plaster',
    [
      [a, low, 0],
      [a, low, depth],
      [a, spring, depth],
      [a, spring, 0],
    ],
    color.shaded,
  );
  face(
    out,
    'plaster',
    [
      [b, low, depth],
      [b, low, 0],
      [b, spring, 0],
      [b, spring, depth],
    ],
    color.trim,
  );
  if (rise === 0) {
    face(
      out,
      'plaster',
      [
        [a, spring, 0],
        [b, spring, 0],
        [b, spring, depth],
        [a, spring, depth],
      ],
      color.shaded,
    );
  } else {
    const center = (a + b) / 2;
    const curve = (i) => [
      center - ((b - a) / 2) * Math.cos((Math.PI * i) / segments),
      spring + rise * Math.sin((Math.PI * i) / segments),
    ];
    for (let i = 0; i < segments; i++) {
      const [x, y] = curve(i);
      const [xx, yy] = curve(i + 1);
      const ceiling = spring + rise;
      triangle(
        out,
        'accent',
        [
          [center, spring, depth],
          [xx, yy, depth],
          [x, y, depth],
        ],
        tint,
      );
      face(
        out,
        'plaster',
        [
          [x, y, 0],
          [xx, yy, 0],
          [xx, yy, depth],
          [x, y, depth],
        ],
        color.shaded,
      );
      if (y < ceiling - 0.001 && yy < ceiling - 0.001)
        face(
          out,
          'plaster',
          [
            [x, y, 0],
            [xx, yy, 0],
            [xx, ceiling, 0],
            [x, ceiling, 0],
          ],
          color.wall,
        );
      else if (y < ceiling - 0.001)
        triangle(
          out,
          'plaster',
          [
            [x, y, 0],
            [xx, ceiling, 0],
            [x, ceiling, 0],
          ],
          color.wall,
        );
      else if (yy < ceiling - 0.001)
        triangle(
          out,
          'plaster',
          [
            [x, ceiling, 0],
            [xx, yy, 0],
            [xx, ceiling, 0],
          ],
          color.wall,
        );
    }
  }
  if (lod < 2) return;
  const join = low + (spring - low) * (shop ? 0.75 : 0.5);
  rect(out, 'wood', a + 0.05, b - 0.05, join - 0.042, join + 0.042, depth + 0.016, color.wood);
  rect(
    out,
    'accent',
    a + 0.09,
    b - 0.09,
    join + 0.1,
    spring - 0.09,
    depth + 0.008,
    color.upperGlass,
  );
  if (shop || lod === 3)
    rect(
      out,
      'wood',
      (a + b) / 2 - 0.032,
      (a + b) / 2 + 0.032,
      low,
      spring + rise * 0.72,
      depth + 0.018,
      color.wood,
    );
  if (!shop) box(out, 'plaster', [a - 0.07, low - 0.11, 0], [b + 0.07, low, 0.13], color.trim);
}

function windowBand(out, span, floor, band, lod) {
  const { low, spring, rise = 0, count, width, shop = false } = floor;
  const top = spring + rise;
  rect(out, 'plaster', 0, span, band, low, 0, color.wall);
  const bays = Array.from({ length: count }, (_, i) => ((i + 0.5) * span) / count);
  for (let i = 0, right = 0; i < bays.length; i++) {
    const left = bays[i] - width / 2;
    rect(out, 'plaster', right, left, low, top, 0, color.wall);
    right = bays[i] + width / 2;
    pane(out, left, right, low, spring, rise, lod, shop);
    if (i === bays.length - 1) rect(out, 'plaster', right, span, low, top, 0, color.wall);
  }
  return top;
}

function distantWindows(out, span, floors) {
  for (const { low, spring, rise = 0, count, width, shop } of floors) {
    const tint = shop ? color.deep : color.glass;
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) * span) / count;
      rect(out, 'accent', x - width / 2, x + width / 2, low, spring, 0.013, tint);
      if (rise) {
        const arc = (j) => [
          x - (width / 2) * Math.cos((j * Math.PI) / 4),
          spring + rise * Math.sin((j * Math.PI) / 4),
          0.013,
        ];
        for (let j = 0; j < 4; j++)
          triangle(out, 'accent', [[x, spring, 0.013], arc(j + 1), arc(j)], tint);
      }
    }
  }
}

function frieze(out, span, top, count, lod) {
  const y = top - 1.4;
  rect(out, 'plaster', 0, span, y - 0.58, y - 0.47, 0.06, color.trim);
  for (let i = 0; i < count; i++) {
    const x = ((i + 0.5) * span) / count;
    rect(out, 'accent', x - 0.56, x + 0.56, y - 0.34, y + 0.56, 0.02, color.green);
    if (lod > 1) {
      for (let j = 0; j < 4; j++) {
        const a = (j * Math.PI) / 2;
        const r = j % 2 ? 0.26 : 0.34;
        const p = [x + Math.cos(a) * r, y + 0.11 + Math.sin(a) * r, 0.028];
        const q = [
          x + Math.cos(a + Math.PI / 2) * (j % 2 ? 0.34 : 0.26),
          y + 0.11 + Math.sin(a + Math.PI / 2) * (j % 2 ? 0.34 : 0.26),
          0.028,
        ];
        triangle(out, 'accent', [[x, y + 0.11, 0.028], p, q], color.deep);
      }
    }
  }
}

function awning(out, center, width, y, lod) {
  const stripes = lod < 2 ? 1 : Math.ceil(width / (lod === 2 ? 0.52 : 0.26));
  for (let i = 0; i < stripes; i++) {
    const a = center - width / 2 + (i * width) / stripes;
    const b = a + width / stripes;
    face(
      out,
      'canvas',
      [
        [a, y - 0.68, 1.32],
        [b, y - 0.68, 1.32],
        [b, y, 0.025],
        [a, y, 0.025],
      ],
      i % 2 ? color.linen : color.gold,
    );
    if (lod > 1)
      rect(out, 'canvas', a, b, y - 0.85, y - 0.68, 1.32, i % 2 ? color.linen : color.gold);
  }
}

function block(out, extents, height, elevations, lod) {
  const [x0, z0, x1, z1] = extents;
  const base = -1.3;
  // On each elevation local +Z faces outwards and local +X runs along the façade.
  const sides = [
    [x0, z0, -Math.PI / 2, z1 - z0],
    [x1, z0, Math.PI, x1 - x0],
    [x1, z1, Math.PI / 2, z1 - z0],
    [x0, z1, 0, x1 - x0],
  ];
  for (const [i, [x, z, angle, span]] of sides.entries()) {
    const wall = transform(out, angle, [x, 0, z]);
    const profile = elevations[i];
    if (profile && lod > 1) {
      let band = base;
      for (const floor of profile.floors) band = windowBand(wall, span, floor, band, lod);
      rect(wall, 'plaster', 0, span, band, height, 0, color.wall);
    } else rect(wall, 'plaster', 0, span, base, height, 0, color.wall);
    if (profile && lod) {
      if (lod === 1) distantWindows(wall, span, profile.floors);
      if (profile.frieze) frieze(wall, span, height, profile.frieze, lod);
      if (profile.awnings)
        for (const [fraction, width] of profile.awnings)
          awning(wall, fraction * span, width, 3.3, lod);
      if (profile.bands && lod > 1)
        for (const y of profile.bands)
          rect(wall, 'plaster', 0, span, y, y + 0.09, 0.055, color.trim);
    }
    if (lod) {
      box(
        wall,
        'tile',
        [-0.04, height - 0.03, -0.22],
        [span + 0.04, height + 0.1, 0.13],
        color.clay,
      );
      if (lod > 1) rect(wall, 'plaster', 0, span, height - 0.18, height - 0.075, 0.05, color.trim);
    } else {
      rect(wall, 'tile', 0, span, height - 0.21, height, 0.011, color.clay);
    }
  }
  face(
    out,
    'tile',
    [
      [x0, height - 0.12, z1],
      [x1, height - 0.12, z1],
      [x1, height - 0.12, z0],
      [x0, height - 0.12, z0],
    ],
    color.roof,
  );
}

const standard = (count, width, low, spring, rise = 0) => ({ count, width, low, spring, rise });
const storefront = (count, width, low = 0.16, spring = 3.55, rise = 0) => ({
  ...standard(count, width, low, spring, rise),
  shop: true,
});
function corner(count, groundCount = count, awnings) {
  return {
    floors: [
      storefront(groundCount, 2.12),
      standard(count, 1.22, 4.83, 6.96),
      standard(count, 1.3, 8.29, 10.16, 0.65),
      standard(count, 1.23, 11.98, 14.05),
    ],
    frieze: count,
    bands: [4.15, 7.83, 11.62, 14.82],
    awnings,
  };
}
const south = (count) => ({
  floors: [
    storefront(count, 1.95),
    standard(count, 1.23, 4.82, 6.64),
    standard(count, 1.25, 8.1, 9.91),
    standard(count, 1.24, 11.28, 13.19),
    standard(count, 1.25, 14.55, 16.45),
    standard(count, 1.45, 17.79, 19.85, 0.65),
  ],
  bands: [4.07, 16.99],
});
function capPier(out, x, z, y, height) {
  box(out, 'plaster', [x - 0.52, y, z - 0.55], [x + 0.52, y + height, z + 0.55], color.trim);
  box(
    out,
    'tile',
    [x - 0.575, y + height, z - 0.6],
    [x + 0.575, y + height + 0.13, z + 0.6],
    color.clay,
  );
}
function porch(out, lod) {
  const [x0, z0, , z1] = bounds.porch;
  const west = transform(out, -Math.PI / 2, [x0, 0, z0]);
  const span = z1 - z0;
  const step = span / 4;
  const depth = 0 - x0;
  const top = 5.2;
  const spring = 2.71;
  const openingWidth = 2.48;
  const rise = 1.34;
  for (let i = 0; i <= 4; i++) {
    const x = i * step;
    const pier = step - openingWidth;
    box(west, 'plaster', [x - pier / 2, -0.63, -0.69], [x + pier / 2, top, 0.07], color.trim);
    if (lod > 0) {
      box(
        west,
        'plaster',
        [x - pier / 2 - 0.13, 0, -0.77],
        [x + pier / 2 + 0.13, 0.29, 0.19],
        color.shaded,
      );
      box(
        west,
        'plaster',
        [x - pier / 2 - 0.12, spring - 0.11, -0.75],
        [x + pier / 2 + 0.12, spring + 0.12, 0.21],
        color.trim,
      );
    }
    if (i === 4) break;
    const center = x + step / 2;
    const segments = [4, 6, 9, 14][lod];
    for (let j = 0; j < segments; j++) {
      const arc = (index) => [
        center - (openingWidth / 2) * Math.cos((index * Math.PI) / segments),
        spring + rise * Math.sin((index * Math.PI) / segments),
      ];
      const [a, y] = arc(j);
      const [b, yy] = arc(j + 1);
      face(
        west,
        'plaster',
        [
          [a, y, 0.05],
          [b, yy, 0.05],
          [b, top, 0.05],
          [a, top, 0.05],
        ],
        color.trim,
      );
      face(
        west,
        'plaster',
        [
          [b, yy, -0.69],
          [a, y, -0.69],
          [a, top, -0.69],
          [b, top, -0.69],
        ],
        color.shaded,
      );
      face(
        west,
        'plaster',
        [
          [a, y, -0.69],
          [b, yy, -0.69],
          [b, yy, 0.05],
          [a, y, 0.05],
        ],
        color.shaded,
      );
      if (lod > 1) {
        const head = 0.2;
        face(
          west,
          'plaster',
          [
            [a, y, 0.061],
            [b, yy, 0.061],
            [b, yy + head, 0.061],
            [a, y + head, 0.061],
          ],
          color.shaded,
        );
      }
    }
  }
  box(west, 'plaster', [-0.7, top - 0.19, -depth], [span + 0.7, top + 0.13, 0.3], color.shaded);
  box(west, 'plaster', [-0.55, top + 0.13, -depth], [span + 0.55, top + 0.57, 0.12], color.trim);
  for (const i of [0, 2, 4]) capPier(out, x0, z0 + i * step, 5.53, 0.45);
  const crest = span / 2;
  box(
    west,
    'plaster',
    [crest - 0.97, top + 0.4, -0.35],
    [crest + 0.97, top + 0.72, 0.06],
    color.trim,
  );
  const points = [
    [-0.96, 0],
    [-0.7, 0.3],
    [-0.28, 0.33],
    [0, 0.68],
    [0.28, 0.33],
    [0.7, 0.3],
    [0.96, 0],
  ];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, y] = points[i],
      [b, yy] = points[i + 1];
    triangle(
      west,
      'plaster',
      [
        [crest, top + 0.68, 0.065],
        [crest + b, top + 0.72 + yy, 0.065],
        [crest + a, top + 0.72 + y, 0.065],
      ],
      color.trim,
    );
  }
}

function build(out, lod) {
  const t = plan.dimensions;
  block(
    out,
    bounds.north,
    t.cornerEave,
    [
      corner(3, 2, [
        [0.27, 4.2],
        [0.72, 4.4],
      ]),
      corner(8, 7),
      corner(3),
      null,
    ],
    lod,
  );
  for (const [x, z] of [
    [0, 0],
    [37.8, 0],
    [0, 12.3],
    [37.8, 12.3],
  ])
    capPier(out, x, z, t.cornerEave - 0.3, 0.85);

  const lobbyWindow = {
    floors: [
      standard(5, 1.45, 8.4, 10.55),
      standard(5, 1.55, 12.04, 14.2),
      standard(2, 2.25, 16.1, 17.86, 0.9),
    ],
    bands: [11.55],
  };
  block(out, [10.9, 12.3, 23.5, 33.7], t.centralParapet, [lobbyWindow, null, null, null], lod);
  block(
    out,
    [23.5, 12.3, 37.8, 33.7],
    12.54,
    [null, null, corner(5), null].map(
      (p) => p && { ...p, frieze: null, floors: p.floors.slice(0, 3) },
    ),
    lod,
  );
  block(
    out,
    [10.9, 30.5, 16.5, 33.7],
    t.towerTop - 0.52,
    [{ floors: [standard(1, 0.91, 17.48, 18.5)] }, null, null, null],
    lod,
  );
  box(out, 'tile', [10.8, t.towerTop - 0.52, 30.35], [16.63, t.towerTop, 33.82], color.clay);

  const lower = {
    floors: [storefront(5, 2.3, 0.08, 2.43, 1.05), standard(5, 1.5, 5.7, 7.12)],
    bands: [4.8],
  };
  block(out, bounds.entry, 8.15, [lower, null, null, null], lod);
  const central = {
    floors: [
      standard(4, 1.37, 4.75, 6.73),
      standard(4, 1.37, 8.22, 10.07, 0.67),
      standard(4, 1.3, 11.85, 13.83),
    ],
    frieze: 4,
    bands: [7.8, 11.6, 14.8],
  };
  const courtyardEnd = {
    floors: [standard(8, 1.12, 9.32, 10.69, 0.46), standard(8, 1.18, 12.24, 14.17)],
    frieze: 8,
    bands: [11.78, 14.8],
  };
  block(out, bounds.crossWing, 16.33, [corner(3, 3), courtyardEnd, corner(3, 3), corner(7)], lod);
  // The front return visible past the arcade makes the stepped roofline.
  block(
    out,
    [0.08, 44.5, 16.5, 50.8],
    15.95,
    [{ ...central, floors: central.floors.map((f) => ({ ...f, count: 2 })) }, null, null, null],
    lod,
  );
  block(
    out,
    [16.5, 44.5, 37.8, 50.8],
    13.18,
    [
      null,
      null,
      { floors: [storefront(2, 1.8), standard(2, 1.26, 5.18, 7.11), standard(2, 1.3, 9.08, 11.3)] },
      null,
    ],
    lod,
  );
  const [sx, sz, ex, ez] = bounds.south;
  block(
    out,
    [sx, sz, 24, ez],
    t.southEave,
    [
      {
        ...south(5),
        awnings: [
          [0.41, 4.0],
          [0.68, 2.5],
        ],
      },
      south(6),
      null,
      south(6),
    ],
    lod,
  );
  block(
    out,
    [24, sz, ex, ez],
    18,
    [null, null, { ...south(5), floors: south(5).floors.slice(0, 5) }, null],
    lod,
  );
  for (const [x, z] of [
    [0.1, 50.8],
    [0.1, 70.8],
    [23.85, 50.8],
    [23.85, 70.8],
  ])
    capPier(out, x, z, t.southEave - 0.5, 1.45);
  box(out, 'plaster', [1.5, 19.78, 51.05], [10.2, 20.07, 51.44], color.trim);
  porch(out, lod);
}

export const hotelSkyline = (out) => build(out, 0);
export const hotelDistrict = (out) => build(out, 1);
export const hotelStreet = (out) => build(out, 2);
export const hotelCloseup = (out) => build(out, 3);

const recipe = 'santa-rita-hotel-model.mjs';
const camera = [-58, 22, -28];
const lookAt = [10, 9.1, 32];
export const hotelModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: hotelCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The former Santa Rita Hotel in Tucson, with its Mission Revival entrance arcade, decorated parapets, and 1917 south wing.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-31, 38, -21],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'tile_ceramic', 'fabric_canvas', 'wood_plain'],
  qaCameras: [
    { name: 'west-entrance-arcade', position: [-21, 5.4, 18], lookAt: [-1, 4.5, 28] },
    { name: 'broadway-corner', position: [-26, 9, -22], lookAt: [4, 8.2, 6] },
    { name: 'south-addition-and-return', position: [-35, 19, 88], lookAt: [10, 11, 53] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'tucson-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'hotelSkyline',
    errorMeters: 0.55,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'hotelDistrict', 0.27],
        ['street', 'hotelStreet', 0.1],
        ['closeup', 'hotelCloseup', 0.045],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Public-domain postcard 65324 from Tichnor Brothers and public-domain Sanborn fire insurance map from the Library of Congress. OpenStreetMap street control under ODbL 1.0.',
};
