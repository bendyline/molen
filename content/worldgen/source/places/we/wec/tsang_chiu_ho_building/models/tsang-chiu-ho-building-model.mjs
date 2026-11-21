import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const color = palette({
  cream: 'c6bca6',
  slab: 'd2c8b1',
  tile: 'a79c86',
  pale: 'd1c7ad',
  grey: '817e73',
  roof: '88877a',
  oxide: 'a7634b',
  red: '7d4941',
  redDark: '874c40',
  storefront: '45453e',
  glass: '566361',
  pane: '72807b',
  timber: '5f4936',
  green: '476b57',
  greenLight: '7fa077',
  sign: 'a8b38c',
  warm: 'd9aa79',
  steel: 'a5a397',
  grille: '685f52',
  stucco: 'c2bda8',
});
const surfaces = {
  wall: surface('wall', 'plaster_lime', 0.96),
  slab: surface('foundation', 'concrete_panel', 0.91),
  trim: surface('trim', 'tile_flat', 0.88),
  roof: surface('roof', 'concrete_plain', 0.93),
  glass: surface('window', 'storefront', 0.62, 0.08),
  panel: surface('door', 'wood_plain', 0.89),
  metal: surface('trim', 'metal_painted', 0.71, 0.33),
};
const courses = [9.1, 12.21, 15.35, 18.55, 21.78, 25.01, 28.4];
const support = { wall: 'slab', roof: 'roof', color: color.slab, roofColor: color.roof };
const paleWall = { wall: 'wall', roof: 'roof', color: color.cream, roofColor: color.roof };

function edgeBox(out, slot, w, l, r, low, high, a, b, tint) {
  const ring = [
    [l, low],
    [r, low],
    [r, high],
    [l, high],
  ];
  const forward = [-w.normal[2], 0, w.normal[0]];
  const normals = [[0, -1, 0], forward, [0, 1, 0], forward.map((q) => -q)];
  for (const [i, [p, q]] of pairs(closed(ring)).entries())
    face(out, slot, [w.p(...p, a), w.p(...q, a), w.p(...q, b), w.p(...p, b)], normals[i], tint);
  panel(out, slot, w, l, r, low, high, b, tint);
}
function groundWall(out, w, a, b, d, ground, facade) {
  const h = d.floor;
  const bottom = Math.min(ground(a) - 0.23, ground(b) - 0.23, h - d.basementDepth);
  panel(out, 'slab', w, 0, w.length, bottom, h + d.commercialTop, 0, color.grey);
  if (facade === 'wellington') {
    panel(out, 'wall', w, 0, w.length, h - 0.16, h + 3.07, 0.038, color.redDark);
  } else if (facade === 'aberdeen') {
    const n = 10;
    for (let k = 0; k < n; k++) {
      const start = (k * w.length) / n,
        end = ((k + 1) * w.length) / n;
      const grade = [start, end].map((distance) => {
        const p = w.p(distance, 0);
        return Math.min(ground([p[0], p[2]]) - 0.16, h + 3.07);
      });
      face(
        out,
        'wall',
        [
          w.p(start, grade[0], 0.035),
          w.p(end, grade[1], 0.035),
          w.p(end, h + 6.06, 0.035),
          w.p(start, h + 6.06, 0.035),
        ],
        w.normal,
        k % 3 ? color.stucco : color.pale,
      );
    }
  }
}
function windowBay(out, w, u, left, right, base, top, lod) {
  opening(
    out,
    w,
    u - left,
    u + right,
    base,
    top,
    'trim',
    color.glass,
    'glass',
    color.slab,
    lod,
    0.055,
  );
  if (lod > 1) {
    const sill = base + 0.23;
    panel(
      out,
      'trim',
      w,
      u - left + 0.033,
      u + right - 0.033,
      sill,
      sill + 0.046,
      0.087,
      color.cream,
    );
    panel(out, 'glass', w, u + 0.09, u + right - 0.073, base + 0.07, top - 0.07, 0.102, color.pane);
    if (lod === 3)
      panel(
        out,
        'trim',
        w,
        u + right * 0.58,
        u + right * 0.58 + 0.027,
        base + 0.067,
        top - 0.06,
        0.119,
        color.slab,
      );
  }
}
function condenser(out, w, u, y, lod, wide = false) {
  const r = wide ? 0.51 : 0.34;
  edgeBox(out, 'metal', w, u - r, u + r, y, y + 0.55, 0.11, 0.38, color.steel);
  if (lod < 2) return;
  const n = lod === 2 ? 8 : 12;
  const circle = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return w.p(u + 0.197 * Math.cos(a), y + 0.282 + 0.197 * Math.sin(a), 0.391);
  });
  face(out, 'metal', circle, w.normal, color.grille);
  if (lod === 3)
    for (const yy of [-0.11, -0.055, 0, 0.055, 0.11])
      panel(
        out,
        'metal',
        w,
        u - 0.165,
        u + 0.165,
        y + 0.282 + yy - 0.011,
        y + 0.282 + yy + 0.011,
        0.403,
        color.steel,
      );
}
function upperWall(out, w, d, lod, main) {
  const h = d.floor;
  panel(out, 'wall', w, 0, w.length, h + d.commercialTop, h + d.parapetTop, 0, color.cream);
  const span = w.length,
    bays = Math.max(1, Math.round(span / (main ? 3.1 : 4.3)));
  for (const [j, [b, t]] of pairs(courses).entries()) {
    if (main || j === 0 || j === 5)
      edgeBox(
        out,
        'slab',
        w,
        0,
        span,
        h + b - 0.13,
        h + b + 0.17,
        0.002,
        main ? 0.43 : 0.12,
        color.slab,
      );
    if (lod === 0) {
      if (main && j % 2 === 0)
        panel(out, 'glass', w, 0.25, span - 0.24, h + b + 0.69, h + t - 0.46, 0.046, color.glass);
      continue;
    }
    if (!main && j % 2 && span > 10) continue;
    for (let k = 0; k < bays; k++) {
      const u = (span * (k + 0.5)) / bays,
        half = Math.min((span / bays) * 0.42, 0.96);
      windowBay(out, w, u, half, half, h + b + 0.66, h + t - 0.41, lod);
      if (lod > 1 && main && (k + j) % 3 === 0)
        condenser(out, w, Math.min(span - 0.65, u + 0.65), h + b + 0.32, lod);
    }
  }
  if (main)
    for (let k = 1; k < bays; k++) {
      if (k % 2 === 0) continue;
      const u = (span * k) / bays;
      edgeBox(out, 'trim', w, u - 0.1, u + 0.12, h + 9.1, h + 28.34, 0.05, 0.153, color.oxide);
    }
  panel(out, 'trim', w, 0, span, h + 28.38, h + 28.6, 0.078, color.slab);
}
function commercialBand(out, w, d, lod, front) {
  const y = d.floor;
  const start = front ? 3.66 : 5.89;
  panel(out, 'wall', w, 0, w.length, y + start, y + 7.05, 0.052, color.red);
  edgeBox(out, 'metal', w, 0, w.length, y + 7.04, y + 7.2, 0.044, 0.224, color.storefront);
  panel(out, 'glass', w, 0.25, w.length - 0.21, y + 7.22, y + 8.96, 0.081, color.storefront);
  if (lod > 0) {
    const n = Math.max(2, Math.floor(w.length / 2.03));
    for (let i = 0; i < n; i++) {
      const u = (w.length * (i + 0.5)) / n,
        bay = w.length / n;
      panel(
        out,
        'glass',
        w,
        u - bay * 0.41,
        u + bay * 0.41,
        y + 7.6,
        y + 8.75,
        0.101,
        i % 3 ? color.glass : color.pane,
      );
      if (lod > 1) {
        panel(
          out,
          'metal',
          w,
          u - bay * 0.44,
          u - bay * 0.4,
          y + 7.35,
          y + 8.88,
          0.127,
          color.storefront,
        );
        if (!front && i % 3 !== 2) condenser(out, w, u, y + 6.15, lod, true);
      }
    }
  }
}
function shopfront(out, w, d, lod) {
  const y = d.floor,
    l = w.length;
  panel(out, 'wall', w, 0, l, y - 0.07, y + 0.33, 0.067, color.red);
  panel(out, 'glass', w, 0.39, 3.97, y + 0.35, y + 3.38, 0.102, color.storefront);
  for (const x of [0.57, 1.41, 2.24, 3.16, 3.69])
    panel(out, 'metal', w, x - 0.045, x + 0.045, y + 0.4, y + 3.31, 0.155, color.grey);
  panel(out, 'panel', w, 4.42, l - 0.28, y + 0.38, y + 2.9, 0.107, color.red);
  panel(out, 'wall', w, 0, l, y + 3.46, y + 3.97, 0.106, color.redDark);
  edgeBox(out, 'metal', w, 0.35, 4.09, y + 3.21, y + 3.42, 0.106, 0.94, color.green);
  panel(out, 'metal', w, 0.69, 3.69, y + 2.47, y + 3.01, 0.158, color.green);
  if (lod > 1) {
    for (const u of [1.05, 2.05, 3.08])
      edgeBox(out, 'metal', w, u - 0.17, u + 0.16, y + 2.68, y + 2.93, 0.157, 0.223, color.warm);
    panel(out, 'trim', w, 0.39, 3.97, y + 0.39, y + 0.48, 0.172, color.oxide);
  }
}
const linGlyph = [
  [
    [0.12, 0.25],
    [0.89, 0.25],
  ],
  [
    [0.29, 0.17],
    [0.32, 0.35],
  ],
  [
    [0.68, 0.17],
    [0.66, 0.35],
  ],
  [
    [0.15, 0.42],
    [0.7, 0.42],
    [0.72, 0.71],
    [0.15, 0.71],
    [0.15, 0.42],
  ],
  [
    [0.17, 0.54],
    [0.68, 0.54],
  ],
  [
    [0.16, 0.63],
    [0.69, 0.63],
  ],
  [
    [0.41, 0.34],
    [0.41, 0.84],
  ],
  [
    [0.11, 0.8],
    [0.72, 0.8],
  ],
  [
    [0.74, 0.38],
    [0.83, 0.43],
  ],
  [
    [0.78, 0.55],
    [0.92, 0.54],
    [0.85, 0.66],
    [0.92, 0.79],
    [0.79, 0.85],
    [0.98, 0.89],
  ],
];
const heungGlyph = [
  [
    [0.22, 0.23],
    [0.74, 0.15],
  ],
  [
    [0.1, 0.36],
    [0.89, 0.36],
  ],
  [
    [0.49, 0.2],
    [0.48, 0.65],
  ],
  [
    [0.47, 0.38],
    [0.18, 0.57],
  ],
  [
    [0.51, 0.39],
    [0.81, 0.59],
  ],
  [
    [0.22, 0.58],
    [0.24, 0.89],
    [0.76, 0.89],
    [0.77, 0.59],
    [0.22, 0.58],
  ],
  [
    [0.24, 0.74],
    [0.75, 0.74],
  ],
];
function signBoard(out, a, b, y, scale, lod) {
  const w = edge(a, b),
    half = w.length / 2,
    low = y - 0.9 * scale,
    high = y + 0.9 * scale;
  edgeBox(out, 'metal', w, 0, w.length, low, high, -0.082, 0.082, color.green);
  for (const k of [-1, 1]) {
    const depth = 0.093 * k,
      points = [
        [0.08, low + 0.17],
        [0.22, low + 0.07],
        [w.length - 0.21, low + 0.07],
        [w.length - 0.09, low + 0.19],
        [w.length - 0.09, high - 0.19],
        [w.length - 0.22, high - 0.07],
        [0.22, high - 0.07],
        [0.08, high - 0.19],
      ];
    for (const [p, q] of pairs(closed(points)))
      beam(
        out,
        'metal',
        w.p(...p, depth),
        w.p(...q, depth),
        lod === 0 ? 0.07 : 0.053,
        0.038,
        color.greenLight,
      );
    if (lod === 0) {
      panel(out, 'metal', w, 0.38, half - 0.19, y - 0.28, y + 0.28, depth * 1.17, color.warm);
      panel(
        out,
        'metal',
        w,
        half + 0.19,
        w.length - 0.36,
        y - 0.28,
        y + 0.28,
        depth * 1.17,
        color.warm,
      );
      continue;
    }
    for (const [i, glyph] of [linGlyph, heungGlyph].entries()) {
      const offset = (k > 0 ? i : 1 - i) * half;
      for (const stroke of glyph) {
        const coords = stroke.map(([x, v]) =>
          w.p(
            offset + 0.16 + x * (half - 0.34),
            high - 0.09 - v * (high - low - 0.18),
            depth * 1.14,
          ),
        );
        for (const [p, q] of pairs(coords))
          beam(out, 'metal', p, q, lod === 3 ? 0.045 : 0.063, 0.032, color.warm);
      }
    }
  }
}
function streetSigns(out, d, lod) {
  const y = d.floor;
  signBoard(out, [-10.63, -14.46], [-10.62, -17.27], y + 6.62, 1.0, lod);
  signBoard(out, [-10.68, -13.65], [-13.09, -13.65], y + 5.18, 0.8, lod);
  for (const h of [5.07, 6.45])
    beam(out, 'metal', [-10.17, y + h, -14.27], [-10.64, y + h, -15.55], 0.061, 0.077, color.green);
  if (lod > 1)
    for (const h of [4.75, 5.56])
      beam(
        out,
        'metal',
        [-10.22, y + h, -13.55],
        [-12.49, y + h, -13.62],
        0.072,
        0.073,
        color.green,
      );
}
function sideEntry(out, w, d, ground, lod) {
  const u = w.length * 0.75;
  const q = w.p(u, 0, 0.85);
  const y = ground([q[0], q[2]]);
  const threshold = y + 0.31;
  panel(out, 'glass', w, u - 0.73, u + 0.74, threshold, threshold + 2.61, 0.094, color.storefront);
  panel(out, 'panel', w, u - 0.58, u + 0.55, threshold, threshold + 2.43, 0.116, color.timber);
  panel(out, 'trim', w, u - 1, u + 1, threshold + 2.61, threshold + 2.85, 0.159, color.oxide);
  if (lod > 0) {
    edgeBox(out, 'slab', w, u - 1.0, u + 1.01, y - 0.07, y + 0.14, 0.04, 0.86, color.slab);
    edgeBox(out, 'slab', w, u - 0.93, u + 0.92, y + 0.1, y + 0.27, 0.04, 0.58, color.slab);
    edgeBox(out, 'slab', w, u - 0.85, u + 0.85, y + 0.24, threshold + 0.03, 0.04, 0.34, color.slab);
  }
}
function roof(out, d, lod) {
  const y = d.floor;
  const outline = d.outline;
  cap(out, 'roof', outline, y + d.roofHeight, color.roof);
  const penthouse = rect(-3.01, 1.9, 1.2, 7.1);
  shell(out, penthouse, () => y + 28.34, y + 30.21, paleWall);
  const service = rect(-5.4, -9.25, -2.69, -6.26);
  shell(out, service, () => y + 28.31, y + 29.48, support);
  if (lod > 0) {
    const tank = rect(-2.79, 3.0, -0.26, 5.91);
    shell(out, tank, () => y + 30.17, y + 30.93, {
      wall: 'metal',
      roof: 'roof',
      color: color.grey,
      roofColor: color.steel,
    });
  }
  if (lod > 1)
    for (const [x, z] of [
      [-7.61, -10.72],
      [-5.77, -6.57],
      [-2.48, -4.33],
    ]) {
      block(out, 'slab', x, y + 28.39, z, 0.62, 0.52, 0.72, color.tile);
      block(out, 'metal', x - 0.04, y + 28.87, z - 0.04, 0.72, 0.13, 0.83, color.roof);
    }
}
function draw(out, lod, d, ground) {
  const sign = areaSign(d.outline);
  for (const [i, [a, b]] of pairs(closed(d.outline)).entries()) {
    const w = edge(a, b, sign);
    const facade = i === 5 ? 'wellington' : i === 6 ? 'aberdeen' : 'party';
    groundWall(out, w, a, b, d, ground, facade);
    upperWall(out, w, d, lod, facade !== 'party');
    if (facade !== 'party') commercialBand(out, w, d, lod, facade === 'wellington');
    if (facade === 'wellington') shopfront(out, w, d, lod);
    if (facade === 'aberdeen') sideEntry(out, w, d, ground, lod);
  }
  roof(out, d, lod);
  streetSigns(out, d, lod);
}
const tower = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-34, 27, -39],
    lookAt: [-2.5, 13, -1],
    yaw: -0.88,
    sun: [-78, 123, -83],
    brief:
      'The nine-storey Tsang Chiu Ho Building with its late Lin Heung Tea House shopfront and projecting green signs on the Wellington and Aberdeen Street corner.',
    views: [
      {
        name: 'wellington-and-aberdeen-street-corner',
        position: [-23, 12, -30],
        lookAt: [-5, 11, -6],
      },
      {
        name: 'lin-heung-tea-house-shopfront-and-signs',
        position: [-13, 5, -23],
        lookAt: [-7, 4, -13],
      },
      { name: 'stepped-aberdeen-street-elevation', position: [-27, 11, -4], lookAt: [-5, 8, -1] },
      {
        name: 'apartment-courses-and-stepped-footprint',
        position: [15, 37, 22],
        lookAt: [-3, 13, -3],
      },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = tower;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const model = {
  ...tower.model,
  category: 'hotel-commercial',
  geographicStatus: 'historical-proposal',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  recipeDependencies: [...tower.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  sourceLicense:
    'Exterior geometry based on dated original CC0 photographs, mapped building footprint and original Lands Department terrain.',
  buildingCutout: {
    outline: plan.dimensions.outline,
    minimumCoverage: 0.92,
    basis:
      'Selectively replaces coincident generated geometry at the seven-point original corner building in the 2024–2026 period.',
  },
};
