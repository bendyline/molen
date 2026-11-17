import { readFileSync } from 'node:fs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  column,
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  box,
  tube,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const field = read('terrain-grid.json');
const { floorY, facade, tower, nave, chancel, laterSacristy, rearConnection } = plan.section;
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.9, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.93, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  iron: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.72, metallic: 0.22 },
};
const tint = {
  plaster: rgb('e6e0d2'),
  stone: rgb('9c9180'),
  trim: rgb('a09682'),
  carving: rgb('c4b8a1'),
  tile: rgb('a76751'),
  olderTile: rgb('975943'),
  green: rgb('525647'),
  dark: rgb('312c26'),
  bell: rgb('665745'),
};
const tau = 2 * Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters;
  const v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = field.heightsMeters[j];
  const b = field.heightsMeters[j + 1];
  return (
    lerp(lerp(a[i], a[i + 1], u - i), lerp(b[i], b[i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}

function wall(out, cornerA, cornerB, top) {
  const [x, z] = cornerA;
  const [u, v] = cornerB;
  const a = Math.min(floorY - 0.32, ground(x, z) - 0.24);
  const b = Math.min(floorY - 0.32, ground(u, v) - 0.24);
  face(
    out,
    'stone',
    [
      [u, b, v],
      [x, a, z],
      [x, floorY + 0.16, z],
      [u, floorY + 0.16, v],
    ],
    tint.stone,
  );
  face(
    out,
    'plaster',
    [
      [u, floorY + 0.16, v],
      [x, floorY + 0.16, z],
      [x, top, z],
      [u, top, v],
    ],
    tint.plaster,
  );
}

function rectWing(out, { bounds, eavesY, ridgeY }, color) {
  const [x0, x1, z0, z1] = bounds;
  const outline = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  for (let i = 0; i < outline.length; i++)
    wall(out, outline[i], outline[(i + 1) % outline.length], eavesY);
  const center = (x0 + x1) / 2;
  const inset = Math.min((x1 - x0) * 0.38, (z1 - z0) * 0.36);
  const a = [x0 - 0.21, eavesY, z0 - 0.23],
    b = [x1 + 0.21, eavesY, z0 - 0.23];
  const c = [x1 + 0.21, eavesY, z1 + 0.23],
    d = [x0 - 0.21, eavesY, z1 + 0.23];
  const f = [center, ridgeY, z0 + inset],
    g = [center, ridgeY, z1 - inset];
  face(out, 'tile', [a, d, g, f], color);
  face(out, 'tile', [b, f, g, c], color);
  triangle(out, 'tile', [a, f, b], color);
  triangle(out, 'tile', [c, g, d], color);
}

function naveShell(out, lod) {
  const stations = nave.stations;
  for (let i = 1; i < stations.length; i++) {
    const [z0, w0] = stations[i - 1],
      [z1, w1] = stations[i];
    wall(out, [w0, z0], [w1, z1], nave.eavesY);
    wall(out, [-w1, z1], [-w0, z0], nave.eavesY);
    const rise = (j) => [0, nave.ridgeY - Math.abs(j - 3) * 0.36, stations[j][0]];
    const eave = (sign, w, z) => [sign * (w + 0.35), nave.eavesY, z];
    face(out, 'tile', [eave(1, w0, z0), rise(i - 1), rise(i), eave(1, w1, z1)], tint.tile);
    face(out, 'tile', [eave(-1, w0, z0), eave(-1, w1, z1), rise(i), rise(i - 1)], tint.olderTile);
    if (lod > 0) {
      for (const side of [-1, 1]) {
        tube(
          out,
          'trim',
          [side * (w0 + 0.11), nave.eavesY - 0.26, z0],
          [side * (w1 + 0.11), nave.eavesY - 0.26, z1],
          0.13,
          tint.trim,
          6,
        );
      }
    }
  }
  for (const j of [0, stations.length - 1]) {
    const [z, w] = stations[j];
    const local = transform(out, j === 0 ? 0 : Math.PI, [0, 0, z]);
    panel(local, 'plaster', -w, w, floorY, nave.eavesY, 0, tint.plaster);
    triangle(
      local,
      'plaster',
      [
        [-w, nave.eavesY, 0],
        [0, nave.ridgeY - Math.abs(j - 3) * 0.36, 0],
        [w, nave.eavesY, 0],
      ],
      tint.plaster,
    );
  }
  if (lod === 0) return;
  for (const [index, offset] of [
    [1, 0.52],
    [2, 0.62],
    [3, 0.56],
    [4, 0.52],
  ]) {
    const [a, wa] = stations[index],
      [b, wb] = stations[index + 1];
    for (const side of [-1, 1]) {
      const local = transform(out, (-side * Math.PI) / 2 + Math.atan2(side * (wb - wa), b - a), [
        side * lerp(wa, wb, offset),
        0,
        lerp(a, b, offset),
      ]);
      ellipse(local, 'trim', 0, 9.75, 0.87, 1.1, -0.052, tint.trim, lod > 1 ? 18 : 8);
      ellipse(local, 'wood', 0, 9.75, 0.61, 0.8, -0.065, tint.green, lod > 1 ? 18 : 8);
    }
  }
}

function panel(out, slot, x0, x1, y0, y1, z, color) {
  face(
    out,
    slot,
    [
      [x1, y0, z],
      [x0, y0, z],
      [x0, y1, z],
      [x1, y1, z],
    ],
    color,
  );
}

function ellipse(out, slot, x, y, rx, ry, z, color, sides = 12) {
  for (let i = 0; i < sides; i++) {
    const a = (tau * i) / sides,
      b = (tau * (i + 1)) / sides;
    const p = (angle) => [x + rx * Math.cos(angle), y + ry * Math.sin(angle), z];
    triangle(out, slot, [[x, y, z], p(b), p(a)], color);
  }
}

function opening(out, x, bottom, width, height, z, lod, isDoor = false) {
  const spring = bottom + height - width * 0.24;
  const half = width / 2;
  const sides = [6, 8, 14, 18][lod];
  panel(out, 'trim', x - half - 0.18, x + half + 0.18, bottom - 0.08, spring, z, tint.trim);
  ellipse(out, 'trim', x, spring, half + 0.18, width * 0.24 + 0.16, z - 0.007, tint.carving, sides);
  panel(out, 'wood', x - half, x + half, bottom, spring, z - 0.027, tint.green);
  ellipse(out, 'wood', x, spring, half, width * 0.24, z - 0.034, tint.green, sides);
  if (lod === 0) return;
  box(
    out,
    'trim',
    [x - half - 0.2, bottom - 0.14, z - 0.14],
    [x + half + 0.2, bottom - 0.04, z + 0.025],
    tint.carving,
  );
  panel(out, 'wood', x - 0.029, x + 0.029, bottom, spring, z - 0.065, tint.dark);
  if (!isDoor) {
    panel(
      out,
      'wood',
      x - half,
      x + half,
      bottom + height * 0.52,
      bottom + height * 0.56,
      z - 0.066,
      tint.dark,
    );
  }
}

function crestAndPortal(out, lod) {
  const { halfWidth: w, z, corniceY, crestY } = facade;
  const crest = [
    [0, crestY],
    [0.6, 20.92],
    [1.3, 19.9],
    [2.1, 19.05],
    [3.25, 18.73],
    [4.1, 18.83],
    [4.8, 18.19],
    [5.4, 16.68],
    [6.36, 16.14],
  ];
  const shape = [
    ...crest
      .slice(1)
      .toReversed()
      .map(([x, y]) => [-x, y]),
    ...crest,
  ];
  panel(out, 'plaster', -w, w, floorY, corniceY, z, tint.plaster);
  for (let i = 1; i < shape.length; i++) {
    const [a, y0] = shape[i - 1],
      [b, y1] = shape[i];
    const fill = [
      [b, corniceY, z],
      [a, corniceY, z],
      [a, y0, z],
      [b, y1, z],
    ];
    const edge = [
      [b, y1 - 0.4, z - 0.14],
      [a, y0 - 0.4, z - 0.14],
      [a, y0 + 0.12, z - 0.21],
      [b, y1 + 0.12, z - 0.21],
    ];
    face(out, 'plaster', fill, tint.plaster);
    face(out, 'trim', edge, tint.trim);
    face(
      out,
      'trim',
      [
        [b, y1 + 0.12, z - 0.21],
        [a, y0 + 0.12, z - 0.21],
        [a, y0 + 0.12, z + 0.62],
        [b, y1 + 0.12, z + 0.62],
      ],
      tint.trim,
    );
  }
  for (const x of [-6.1, 6.1]) {
    box(out, 'trim', [x - 0.38, floorY, z - 0.2], [x + 0.38, 16.34, z + 0.36], tint.trim);
    for (const [y, width] of [
      [1.2, 0.94],
      [12.82, 0.88],
      [14.39, 1.21],
    ])
      box(
        out,
        'trim',
        [x - width / 2, y, z - 0.37],
        [x + width / 2, y + 0.27, z + 0.34],
        tint.carving,
      );
    const rings = [
      [16.48, 0.35],
      [16.8, 0.52],
      [17.18, 0.38],
      [17.72, 0.04],
    ];
    loft(
      out,
      'trim',
      rings.map(([y, r]) => radialRing(y, r, r, 8, [x, z + 0.13])),
      tint.carving,
    );
  }
  const wave = [
    [-6.18, corniceY],
    [-2.12, corniceY],
    [-1.62, corniceY + 0.7],
    [-0.7, corniceY + 1.29],
    [0, corniceY + 1.42],
    [0.7, corniceY + 1.29],
    [1.62, corniceY + 0.7],
    [2.12, corniceY],
    [6.18, corniceY],
  ];
  for (let i = 1; i < wave.length; i++) {
    const [x, y] = wave[i - 1],
      [u, v] = wave[i];
    face(
      out,
      'trim',
      [
        [u, v - 0.2, z - 0.29],
        [x, y - 0.2, z - 0.29],
        [x, y + 0.2, z - 0.32],
        [u, v + 0.2, z - 0.32],
      ],
      tint.trim,
    );
  }

  opening(out, 0, floorY, 2.76, 5.02, z - 0.16, lod, true);
  for (const x of [-3.57, 3.57]) opening(out, x, 9.21, 1.58, 2.76, z - 0.08, lod);
  ellipse(out, 'trim', 0, 13.26, 1.35, 1.32, z - 0.13, tint.carving, 18);
  ellipse(out, 'wood', 0, 13.26, 1.02, 0.98, z - 0.19, tint.green, 18);
  ellipse(out, 'trim', 0, 17.68, 1.63, 1.11, z - 0.095, tint.trim, 14);
  if (lod > 0) {
    ellipse(out, 'trim', 0, 7.7, 0.68, 0.94, z - 0.37, tint.carving, 18);
    for (const sign of [-1, 1]) {
      ellipse(out, 'trim', sign * 0.86, 6.64, 0.43, 0.53, z - 0.39, tint.carving, 12);
      if (lod > 1) {
        const scroll = [
          [1.54, 5.38],
          [1.91, 5.93],
          [1.99, 6.48],
          [1.8, 6.94],
          [1.42, 7.35],
          [0.76, 7.56],
          [0.57, 7.93],
          [0.84, 8.22],
        ].map(([x, y]) => [sign * x, y, z - 0.32]);
        tubePath(out, 'trim', scroll, 0.17, tint.carving, 6);
        const wing = [
          [1.5, 6.46],
          [1.23, 6.84],
          [0.91, 6.93],
          [0.68, 6.67],
        ].map(([x, y]) => [sign * x, y, z - 0.42]);
        tubePath(out, 'trim', wing, 0.1, tint.trim, 6);
      }
    }
    // Shallow relief preserves the pediment composition at viewing distance.
    ellipse(out, 'trim', -0.51, 17.44, 0.27, 0.53, z - 0.14, tint.carving);
    ellipse(out, 'trim', 0.59, 17.93, 0.34, 0.66, z - 0.14, tint.carving);
  }
  box(out, 'trim', [-0.62, crestY, z - 0.21], [0.62, crestY + 0.35, z + 0.43], tint.carving);
  box(out, 'iron', [-0.105, crestY + 0.3, z], [0.105, crestY + 3.56, z + 0.19], tint.dark);
  for (const [y, w] of [
    [crestY + 1.59, 1.07],
    [crestY + 2.62, 0.79],
  ]) {
    box(out, 'iron', [-w, y, z], [w, y + 0.17, z + 0.19], tint.dark);
  }
}

function towerProfile(out, slot, center, profile, sides, color, cap = false) {
  const rings = profile.map(([y, r]) => radialRing(y, r, r, sides, center));
  loft(out, slot, rings, color, { cap });
}

function bellStage(out, center, r, lowerY, upperY, lod) {
  const [cx, cz] = center;
  const point = (angle, y, radius = r) => [
    cx + radius * Math.cos(angle),
    y,
    cz + radius * Math.sin(angle),
  ];
  const width = 0.37;
  const quadrant = Math.PI / 2;
  const sill = lowerY + 0.62;
  const spring = upperY - 2.14;
  const q = [2, 4, 7, 10][lod];
  const cuts = Array.from({ length: q + 1 }, (_, i) => lerp(-width, width, i / q));
  for (let index = 0; index < 4; index++) {
    const base = index * quadrant;
    const solid = [base + width, base + quadrant / 2, base + quadrant - width];
    const shell = (a, b, y0, y1, y2, y3, radius = r, slot = 'plaster', color = tint.plaster) => {
      face(
        out,
        slot,
        [point(b, y1, radius), point(a, y0, radius), point(a, y2, radius), point(b, y3, radius)],
        color,
      );
    };
    for (let i = 1; i < solid.length; i++)
      shell(solid[i - 1], solid[i], lowerY, lowerY, upperY, upperY);
    const height = (angle) => spring + 1.1 * Math.sqrt(Math.max(0, 1 - Math.pow(angle / width, 2)));
    for (let i = 1; i < cuts.length; i++) {
      const a = base + cuts[i - 1],
        b = base + cuts[i];
      const ya = height(cuts[i - 1]),
        yb = height(cuts[i]);
      shell(a, b, lowerY, lowerY, sill, sill);
      shell(a, b, ya, yb, upperY, upperY);
      shell(a, b, sill, sill, ya, yb, r - 0.83, 'iron', tint.dark);
      face(
        out,
        'trim',
        [point(b, yb), point(a, ya), point(a, ya, r - 0.83), point(b, yb, r - 0.83)],
        tint.trim,
      );
      if (lod > 0) {
        shell(a, b, ya - 0.02, yb - 0.02, ya + 0.23, yb + 0.23, r + 0.08, 'trim', tint.carving);
      }
    }
    for (const edge of [-width, width]) {
      const a = base + edge;
      face(
        out,
        'trim',
        [point(a, sill), point(a, sill, r - 0.84), point(a, spring, r - 0.84), point(a, spring)],
        tint.trim,
      );
    }
  }
  if (lod > 1) {
    const bellBottom = sill + 0.25;
    const bell = [
      [bellBottom, 0.66],
      [bellBottom + 0.15, 0.64],
      [bellBottom + 0.57, 0.47],
      [bellBottom + 1.08, 0.4],
      [bellBottom + 1.24, 0.22],
    ];
    for (const angle of [-Math.PI / 2, 0, Math.PI / 2, Math.PI]) {
      const [x, , z] = point(angle, 0, r - 0.43);
      towerProfile(out, 'iron', [x, z], bell, 14, tint.bell, true);
      const spanY = spring + 0.03;
      const span = (direction) => [
        x + direction * Math.sin(angle),
        spanY,
        z - direction * Math.cos(angle),
      ];
      tube(out, 'wood', span(-1.19), span(1.19), 0.11, tint.dark, 4);
      tube(out, 'iron', [x, bellBottom + 1.2, z], [x, spanY, z], 0.055, tint.bell, 6);
    }
  }
}

function bellTower(out, x, lod) {
  const { z, radius: r, lowerCorniceY, drumTopY, domeTipY } = tower;
  const footing = Math.min(floorY - 0.34, ground(x, z - r) - 0.52);
  if (lod === 0) {
    const center = [x, z];
    towerProfile(
      out,
      'plaster',
      center,
      [
        [footing, r],
        [drumTopY, r],
      ],
      8,
      tint.plaster,
    );
    for (const y of [lowerCorniceY, drumTopY]) {
      towerProfile(
        out,
        'trim',
        center,
        [
          [y - 0.18, r + 0.22],
          [y + 0.22, r + 0.22],
        ],
        8,
        tint.trim,
      );
    }
    towerProfile(
      out,
      'trim',
      center,
      [
        [drumTopY, 2.52],
        [drumTopY + 0.7, 2.3],
        [drumTopY + 3.05, 1.52],
        [drumTopY + 5, 0.39],
        [domeTipY, 0.035],
      ],
      8,
      tint.stone,
      true,
    );
    const front = transform(out, 0, [x, 0, z - r]);
    panel(front, 'iron', -0.94, 0.94, lowerCorniceY + 0.74, drumTopY - 1.85, -0.05, tint.dark);
    ellipse(front, 'iron', 0, drumTopY - 1.85, 0.94, 0.84, -0.058, tint.dark, 8);
    return;
  }
  const center = [x, z],
    sides = [0, 12, 40, 56][lod];
  towerProfile(
    out,
    'stone',
    center,
    [
      [footing, r + 0.09],
      [floorY + 0.49, r + 0.09],
    ],
    sides,
    tint.stone,
  );
  towerProfile(
    out,
    'plaster',
    center,
    [
      [floorY + 0.44, r],
      [lowerCorniceY - 0.58, r],
    ],
    sides,
    tint.plaster,
  );
  towerProfile(
    out,
    'trim',
    center,
    [
      [lowerCorniceY - 0.58, r + 0.07],
      [lowerCorniceY - 0.24, r + 0.22],
      [lowerCorniceY + 0.03, r + 0.22],
      [lowerCorniceY + 0.31, r],
    ],
    sides,
    tint.trim,
  );
  bellStage(out, center, r, lowerCorniceY + 0.3, drumTopY - 0.24, lod);
  for (const y of [5.5, 10.38]) {
    const local = transform(out, 0, [x, 0, z - r]);
    opening(local, 0, y, 0.49, 1.6, -0.052, lod);
  }
  towerProfile(
    out,
    'trim',
    center,
    [
      [drumTopY - 0.39, r],
      [drumTopY - 0.19, r + 0.25],
      [drumTopY + 0.07, r + 0.49],
      [drumTopY + 0.35, r + 0.49],
    ],
    sides,
    tint.trim,
  );
  const roofBase = drumTopY + 0.35;
  // The bell-shaped crown rises inside the circular stone balcony.
  const crown = [
    [roofBase, 2.45],
    [roofBase + 0.31, 2.56],
    [roofBase + 0.87, 2.25],
    [roofBase + 1.71, 1.85],
    [roofBase + 2.63, 1.59],
    [roofBase + 3.45, 1.24],
    [roofBase + 4.31, 0.83],
    [roofBase + 4.83, 0.42],
  ];
  towerProfile(out, 'trim', center, crown, sides, tint.stone);
  towerProfile(
    out,
    'trim',
    center,
    [
      [roofBase + 4.75, 0.37],
      [roofBase + 5.24, 0.29],
      [roofBase + 5.61, 0.42],
      [roofBase + 6.16, 0.33],
      [domeTipY, 0.035],
    ],
    Math.min(sides, 18),
    tint.carving,
    true,
  );

  const balcony = r + 0.34;
  towerProfile(
    out,
    'trim',
    center,
    [
      [roofBase + 0.85, balcony],
      [roofBase + 1.06, balcony],
    ],
    sides,
    tint.carving,
  );
  const posts = [0, 15, 28, 32][lod];
  for (let i = 0; i < posts; i++) {
    const theta = (tau * i) / posts;
    const ax = x + (balcony - 0.115) * Math.cos(theta),
      az = z + (balcony - 0.115) * Math.sin(theta);
    if (lod < 2) {
      box(
        out,
        'trim',
        [ax - 0.095, roofBase, az - 0.095],
        [ax + 0.095, roofBase + 0.89, az + 0.095],
        tint.carving,
      );
    } else {
      column(out, 'trim', ax, az, roofBase, roofBase + 0.89, 0.11, tint.carving, 6);
    }
  }
}

function entranceCourt(out, lod) {
  const edge = [
    [-10.5, -32.9],
    [-11.25, -35.0],
    [-10.65, -38.3],
    [-7.7, -40.4],
    [-4.2, -41.7],
  ];
  const court = [
    ...edge,
    ...edge
      .slice()
      .reverse()
      .map(([x, z]) => [-x, z]),
  ];
  const p = (x, z) => [x, floorY - 0.03, z];
  for (let i = 0; i < court.length; i++) {
    const [x, z] = court[i],
      [u, v] = court[(i + 1) % court.length];
    triangle(out, 'stone', [p(0, -35.8), p(u, v), p(x, z)], tint.stone);
    if (i === 4 || i === 9) continue;
    const lowA = Math.min(ground(x, z) - 0.52, floorY - 0.66);
    const lowB = Math.min(ground(u, v) - 0.52, floorY - 0.66);
    face(out, 'stone', [[u, lowB, v], [x, lowA, z], p(x, z), p(u, v)], tint.stone);
    if (lod > 0) {
      const railY = floorY + 0.87;
      tube(out, 'trim', [x, railY, z], [u, railY, v], 0.14, tint.carving, 6);
      const count = Math.max(2, Math.round(Math.hypot(u - x, v - z) / (lod > 1 ? 0.47 : 1.6)));
      for (let j = 0; j < count; j++) {
        const ax = lerp(x, u, j / count),
          az = lerp(z, v, j / count);
        if (lod > 1)
          column(out, 'trim', ax, az, floorY - 0.03, railY - 0.04, 0.08, tint.carving, 6);
        else
          box(
            out,
            'trim',
            [ax - 0.08, floorY - 0.03, az - 0.08],
            [ax + 0.08, railY, az + 0.08],
            tint.carving,
          );
      }
    }
  }
  const stepCount = [3, 6, 9, 9][lod];
  const top = -41.69,
    bottom = -46;
  const last = ground(0, bottom) - 0.032;
  for (let i = 0; i < stepCount; i++) {
    const upper = lerp(top, bottom, i / stepCount);
    const lower = lerp(top, bottom, (i + 1) / stepCount);
    const level = lerp(floorY - 0.03, last, i / stepCount);
    const half = lerp(4.2, 5.14, i / stepCount);
    box(out, 'stone', [-half, last - 0.51, lower], [half, level, upper + 0.012], tint.stone);
  }
}

function rearOpenings(out, lod) {
  const [west, east, , rear] = chancel.bounds;
  for (const [x, side] of [
    [west, -1],
    [east, 1],
  ]) {
    const local = transform(out, (-side * Math.PI) / 2, [x, 0, 0]);
    for (const z of [-0.9, 7.5, 17.6, 23.1]) opening(local, side * z, 6.0, 0.91, 1.58, -0.09, lod);
  }
  const local = transform(out, Math.PI, [-0.5, 0, rear]);
  for (const x of [-2.3, 2.3]) opening(local, x, 6.2, 0.97, 1.66, -0.08, lod);
}

function build(out, lod) {
  naveShell(out, lod);
  rectWing(out, chancel, tint.olderTile);
  rectWing(out, laterSacristy, tint.tile);
  rectWing(out, rearConnection, tint.olderTile);
  crestAndPortal(out, lod);
  for (const x of [-tower.x, tower.x]) bellTower(out, x, lod);
  entranceCourt(out, lod);
  if (lod > 0) rearOpenings(out, lod);
}

export const saoJoaoSkyline = (out) => build(out, 0);
export const saoJoaoDistrict = (out) => build(out, 1);
export const saoJoaoStreet = (out) => build(out, 2);
export const saoJoaoCloseup = (out) => build(out, 3);
const recipe = 'sao-joao-del-rei-sao-francisco-model.mjs';
const camera = [28, 22, -78],
  lookAt = [0, 10, -21];
export const saoJoaoModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: saoJoaoCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.995,
    basis:
      'The named church way/164767346 defines the building envelope. The separate cemetery way remains independent.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The standing Rococo church of São Francisco de Assis, with its round bell towers, stone frontispiece, curved nave and terracotta roofs.',
  camera,
  lookAt,
  sunDirection: [-30, 65, -55],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.89,
    cameraYaw: 2.65,
    focus: { center: [0, 4, -11] },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'round-belfries-and-rococo-frontispiece',
      position: [-7, 12, -64],
      lookAt: [0, 13, -31],
    },
    { name: 'curved-nave-and-rear-sacristy', position: [-55, 24, 13], lookAt: [-1, 9, -7] },
    { name: 'forecourt-approach', position: [12, 8, -58], lookAt: [0, 7, -35] },
    { name: 'twin-belltower-crowns', position: [42, 40, -51], lookAt: [0, 21, -25] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `sao-joao-del-rei-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'saoJoaoSkyline',
    errorMeters: 1.37,
    surfaces,
    authoredLevels: {
      district: { export: 'saoJoaoDistrict', errorMeters: 0.56, surfaces },
      street: { export: 'saoJoaoStreet', errorMeters: 0.19, surfaces },
      closeup: { export: 'saoJoaoCloseup', errorMeters: 0.06, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original reconstruction. The OpenStreetMap footprint is ODbL 1.0. Original terrain attribution is recorded in the frozen site grid.',
};
