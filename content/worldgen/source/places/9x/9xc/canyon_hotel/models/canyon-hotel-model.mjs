/** Complete dated1911hotel; primary dimensions with explicitly estimated hidden layout. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  D = P.dimensions,
  Y = P.floor.y;
export const surfaces = {
  wood: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.88, metallic: 0 },
  stone: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'wood_weatherboard', roughness: 0.86, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.3, metallic: 0.12 },
};
const C = {
  wood: rgb('684d3e'),
  stone: rgb('d5cbbb'),
  roof: rgb('6c706c'),
  trim: rgb('ac9d80'),
  glass: rgb('344b50'),
};
let count = 0;
export const partEvidence = [],
  windowEvidence = [];
function T(o, k, ps) {
  const p = ps.map((v) => v.map(Math.fround)),
    n = normalFor(...p);
  if (!n.every(Number.isFinite)) throw Error('Bad triangle');
  o.addTriangle(
    k,
    'palette:#ffffff',
    p,
    n,
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    C[k],
  );
  count++;
}
function face(o, k, p, n) {
  if (n) {
    const q = normalFor(...p);
    if (q.reduce((v, a, i) => v + a * n[i], 0) < 0) p = p.slice().reverse();
  }
  for (let i = 1; i < p.length - 1; i++) T(o, k, [p[0], p[i], p[i + 1]]);
}
function box(o, k, x, y, z, w, h, d) {
  if (Math.min(w, h, d) <= 0) return;
  const a = x - w / 2,
    b = x + w / 2,
    c = y,
    e = y + h,
    f = z - d / 2,
    g = z + d / 2;
  face(
    o,
    k,
    [
      [a, c, g],
      [b, c, g],
      [b, e, g],
      [a, e, g],
    ],
    [0, 0, 1],
  );
  face(
    o,
    k,
    [
      [a, c, f],
      [b, c, f],
      [b, e, f],
      [a, e, f],
    ],
    [0, 0, -1],
  );
  face(
    o,
    k,
    [
      [a, c, f],
      [a, c, g],
      [a, e, g],
      [a, e, f],
    ],
    [-1, 0, 0],
  );
  face(
    o,
    k,
    [
      [b, c, f],
      [b, c, g],
      [b, e, g],
      [b, e, f],
    ],
    [1, 0, 0],
  );
  face(
    o,
    k,
    [
      [a, e, f],
      [b, e, f],
      [b, e, g],
      [a, e, g],
    ],
    [0, 1, 0],
  );
  face(
    o,
    k,
    [
      [a, c, f],
      [b, c, f],
      [b, c, g],
      [a, c, g],
    ],
    [0, -1, 0],
  );
}
function beam(o, k, a, b, w, h) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    l = Math.hypot(dx, dz),
    u = [((dz / l) * w) / 2, 0, ((-dx / l) * w) / 2],
    ps = [a, b].map((p) => [
      [p[0] + u[0], p[1] - h / 2, p[2] + u[2]],
      [p[0] - u[0], p[1] - h / 2, p[2] - u[2]],
      [p[0] - u[0], p[1] + h / 2, p[2] - u[2]],
      [p[0] + u[0], p[1] + h / 2, p[2] + u[2]],
    ]);
  for (let j = 0; j < 4; j++) {
    const k1 = (j + 1) % 4;
    face(o, k, [ps[0][j], ps[0][k1], ps[1][k1], ps[1][j]].reverse());
  }
  face(o, k, ps[0].slice().reverse());
  face(o, k, ps[1]);
}
function hip(o, x, z, w, d, y, rise) {
  const a = x - w / 2,
    b = x + w / 2,
    f = z - d / 2,
    g = z + d / 2,
    longX = w >= d,
    h = Math.min(w, d) * 0.45;
  if (longX) {
    const r1 = [a + h, y + rise, z],
      r2 = [b - h, y + rise, z];
    face(o, 'roof', [[a, y, f], [b, y, f], r2, r1], [0, 1, 0]);
    face(o, 'roof', [[a, y, g], [b, y, g], r2, r1], [0, 1, 0]);
    face(o, 'roof', [[a, y, f], [a, y, g], r1], [0, 1, 0]);
    face(o, 'roof', [[b, y, f], [b, y, g], r2], [0, 1, 0]);
  } else {
    const r1 = [x, y + rise, f + h],
      r2 = [x, y + rise, g - h];
    face(o, 'roof', [[a, y, f], [a, y, g], r2, r1], [0, 1, 0]);
    face(o, 'roof', [[b, y, f], [b, y, g], r2, r1], [0, 1, 0]);
    face(o, 'roof', [[a, y, f], [b, y, f], r1], [0, 1, 0]);
    face(o, 'roof', [[a, y, g], [b, y, g], r2], [0, 1, 0]);
  }
}
function gable(o, x, z, w, d, y, rise) {
  face(
    o,
    'wood',
    [
      [x - w / 2, y, z + d / 2],
      [x + w / 2, y, z + d / 2],
      [x, y + rise, z + d / 2],
    ],
    [0, 0, 1],
  );
  face(
    o,
    'wood',
    [
      [x - w / 2, y, z - d / 2],
      [x + w / 2, y, z - d / 2],
      [x, y + rise, z - d / 2],
    ],
    [0, 0, -1],
  );
  for (const s of [-1, 1])
    face(
      o,
      'roof',
      [
        [x + (s * w) / 2, y, z - d / 2],
        [x + (s * w) / 2, y, z + d / 2],
        [x, y + rise, z + d / 2],
        [x, y + rise, z - d / 2],
      ],
      [0, 1, 0],
    );
}
function wall(
  o,
  {
    center: [x, z],
    axis = 'x',
    normal = 1,
    length,
    bottom,
    height,
    bays,
    rows = 1,
    lod,
    windowHeight = 1.65,
    windowFraction = 0.49,
  },
) {
  const n = axis === 'x' ? [0, 0, normal] : [normal, 0, 0],
    p = (u, y, depth = 0) =>
      axis === 'x' ? [x + u, y, z + normal * depth] : [x + normal * depth, y, z + u],
    panel = (k, u0, u1, y0, y1, depth = 0) =>
      face(o, k, [p(u0, y0, depth), p(u1, y0, depth), p(u1, y1, depth), p(u0, y1, depth)], n),
    step = length / bays,
    storey = height / rows;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < bays; i++) {
      const u = -length / 2 + (i + 0.5) * step,
        lo = u - step / 2,
        hi = u + step / 2,
        y = bottom + j * storey,
        wy = y + 0.72,
        top = wy + windowHeight,
        wl = u - (step * windowFraction) / 2,
        wr = u + (step * windowFraction) / 2,
        depth = lod >= 2 ? -0.32 : 0.035;
      if (lod >= 2) {
        panel('wood', lo, wl, y, y + storey);
        panel('wood', wr, hi, y, y + storey);
        panel('wood', wl, wr, y, wy);
        panel('wood', wl, wr, top, y + storey);
        for (const [a, b] of [
          [
            [wl, wy],
            [wr, wy],
          ],
          [
            [wr, wy],
            [wr, top],
          ],
          [
            [wr, top],
            [wl, top],
          ],
          [
            [wl, top],
            [wl, wy],
          ],
        ])
          face(o, 'trim', [p(...a), p(...b), p(...b, depth), p(...a, depth)]);
      }
      panel('glass', wl, wr, wy, top, depth);
      windowEvidence.push({
        center: p(u, wy + windowHeight / 2, depth),
        normal: n,
        depth: lod >= 2 ? 0.32 : 0,
        width: wr - wl,
        height: windowHeight,
        kind: 'guest-or-service-window',
      });
      if (lod >= 3) {
        const a = p(u, wy, depth + 0.03);
        box(
          o,
          'trim',
          a[0],
          a[1],
          a[2],
          axis === 'x' ? 0.055 : 0.06,
          top - wy,
          axis === 'x' ? 0.06 : 0.055,
        );
        const q = p(u, wy + windowHeight * 0.52, depth + 0.04);
        box(
          o,
          'trim',
          q[0],
          q[1],
          q[2],
          axis === 'x' ? wr - wl : 0.06,
          0.055,
          axis === 'x' ? 0.06 : wr - wl,
        );
      }
    }
}
function room(o, x, z, w, d, y, h, lod, roofRise = 3, rows = 1) {
  box(o, 'stone', x, y - 5.5, z, w, 5.5, d);
  box(o, 'wood', x, y, z, w - 0.8, h, d - 0.8);
  if (lod < 2) box(o, 'wood', x, y, z, w, h, d);
  if (lod >= 1) {
    for (const sign of [-1, 1]) {
      wall(o, {
        center: [x, z + (sign * d) / 2],
        normal: sign,
        length: w,
        bottom: y,
        height: h,
        bays: Math.max(2, Math.round(w / 3.2)),
        rows,
        lod,
      });
      wall(o, {
        center: [x + (sign * w) / 2, z],
        axis: 'z',
        normal: sign,
        length: d,
        bottom: y,
        height: h,
        bays: Math.max(2, Math.round(d / 3.2)),
        rows,
        lod,
      });
    }
  }
  box(o, 'trim', x, y + h - 0.12, z, w + 0.7, 0.3, d + 0.7);
  hip(o, x, z, w + 1.4, d + 1.4, y + h + 0.18, roofRise);
}
function dormer(o, x, z, w, depth, y, sign, lod) {
  if (lod) box(o, 'wood', x, y, z, w, 1.55, depth);
  else
    face(
      o,
      'wood',
      [
        [x - w / 2, y, z + (sign * depth) / 2],
        [x + w / 2, y, z + (sign * depth) / 2],
        [x + w / 2, y + 1.55, z + (sign * depth) / 2],
        [x - w / 2, y + 1.55, z + (sign * depth) / 2],
      ],
      [0, 0, sign],
    );
  gable(o, x, z, w + 0.3, depth + 0.3, y + 1.55, 1.55);
  if (lod >= 1) {
    face(
      o,
      'glass',
      [
        [x - w * 0.37, y + 0.22, z + sign * (depth / 2 + 0.02)],
        [x + w * 0.37, y + 0.22, z + sign * (depth / 2 + 0.02)],
        [x + w * 0.37, y + 1.25, z + sign * (depth / 2 + 0.02)],
        [x - w * 0.37, y + 1.25, z + sign * (depth / 2 + 0.02)],
      ],
      [0, 0, sign],
    );
    if (lod >= 2)
      for (const t of [-1, 0, 1])
        box(o, 'trim', x + t * w * 0.24, y + 0.22, z + sign * (depth / 2 + 0.04), 0.06, 1.05, 0.06);
  }
}
function lounge(o, lod) {
  const w = D.loungeWidth,
    d = D.loungeLength,
    z = 34.48,
    y = Y - D.loungeFloorBelowLobby,
    h = D.loungeWallHeightEstimate;
  box(o, 'stone', 0, y - 5.5, z, w, 5.5, d);
  box(o, 'wood', 0, y, z, w - 0.8, h, d - 0.8);
  for (const s of [-1, 1]) {
    const xx = (s * w) / 2;
    face(
      o,
      'glass',
      [
        [xx, y + 0.7, z - d / 2],
        [xx, y + 0.7, z + d / 2],
        [xx, y + h - 0.4, z + d / 2],
        [xx, y + h - 0.4, z - d / 2],
      ],
      [s, 0, 0],
    );
    for (let j = 0; j <= (lod ? 20 : 2); j++) {
      const zz = z - d / 2 + (j * d) / (lod ? 20 : 2);
      box(o, 'wood', xx, y, zz, lod ? 0.34 : 0.65, h, 0.34);
    }
    if (lod >= 2)
      for (let j = 0; j < 20; j++)
        box(o, 'trim', xx, y + 2.2, z - d / 2 + ((j + 0.5) * d) / 20, 0.12, 0.1, d / 20 - 0.34);
  }
  const front = z + d / 2;
  face(
    o,
    'glass',
    [
      [-w / 2, y + 0.7, front],
      [w / 2, y + 0.7, front],
      [w / 2, y + h - 0.4, front],
      [-w / 2, y + h - 0.4, front],
    ],
    [0, 0, 1],
  );
  for (let i = 0; i <= (lod ? 10 : 4); i++)
    box(o, 'wood', -w / 2 + (i * w) / (lod ? 10 : 4), y, front, 0.4, h, 0.4);
  box(o, 'trim', 0, y + h - 0.1, z, w + 1, 0.32, d + 1);
  hip(o, 0, z, w + 3, d + 3, y + h + 0.2, D.loungeRoofRiseEstimate);
  gable(o, 0, front - 3, w * 0.73, 8, y + h + 0.8, D.loungeRoofRiseEstimate * 0.67);
  if (lod >= 1) {
    face(
      o,
      'glass',
      [
        [-4, y + h + 2.2, front + 1.02],
        [4, y + h + 2.2, front + 1.02],
        [0, y + h + 5.4, front + 1.02],
      ],
      [0, 0, 1],
    );
  }
  for (const s of [-1, 1]) {
    const x = s * (w / 2 + 4);
    box(o, 'stone', x, y - 0.5, z, 8, 0.5, 12);
    for (const xx of [-3.4, 3.4])
      for (const zz of [-5.3, 5.3]) box(o, 'wood', x + xx, y, z + zz, 0.55, 4.4, 0.55);
    hip(o, x, z, 9.5, 13.5, y + 4.4, 2.2);
    if (lod >= 2)
      for (const zz of [-5.4, 5.4])
        beam(o, 'wood', [x - 3.4, y + 1, z + zz], [x + 3.4, y + 1, z + zz], 0.12, 0.12);
  }
}
function service(o, lod) {
  room(o, 35, -30, D.diningLength, D.diningDepth, Y, 5.7, lod, 3.7);
  const w = D.diningBayWidth,
    d = D.diningBayDepth,
    z = -30 + D.diningDepth / 2;
  const ring = Array.from({ length: lod >= 2 ? 9 : 5 }, (_, i) => {
    const a = (i * Math.PI) / (lod >= 2 ? 8 : 4);
    return [35 - (Math.cos(a) * w) / 2, z + Math.sin(a) * d];
  });
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1],
      b = ring[i];
    face(o, 'stone', [
      [...a.slice(0, 1), Y - 5.5, a[1]],
      [b[0], Y - 5.5, b[1]],
      [b[0], Y + 0.6, b[1]],
      [a[0], Y + 0.6, a[1]],
    ]);
    face(o, 'glass', [
      [a[0], Y + 0.6, a[1]],
      [b[0], Y + 0.6, b[1]],
      [b[0], Y + 5.4, b[1]],
      [a[0], Y + 5.4, a[1]],
    ]);
    face(
      o,
      'roof',
      [
        [35, Y + 8, z],
        [a[0], Y + 5.7, a[1]],
        [b[0], Y + 5.7, b[1]],
      ],
      [0, 1, 0],
    );
    if (lod >= 1) box(o, 'wood', a[0], Y + 0.5, a[1], 0.24, 5, 0.24);
  }
  room(o, 35, -68.1, D.kitchenWidth, D.kitchenLength, Y, 5, lod, 2);
  room(o, 35, -106, 18, 18, Y, 4.6, lod, 2.4);
  if (lod >= 1)
    for (const z0 of [-51, -66, -81]) {
      box(o, 'trim', 35, Y + 6.1, z0, 4, 1.2, 3);
      hip(o, 35, z0, 4.6, 3.6, Y + 7.3, 1);
    }
  for (const x of [30, 40]) box(o, 'stone', x, Y + 6, -98, 1.2, 7, 1.2);
}
function entry(o, lod) {
  const a = [12, Y, 6],
    b = [49, 0, 20],
    n = lod >= 2 ? 10 : lod ? 4 : 2;
  beam(o, 'wood', a, b, 5, 0.4);
  beam(o, 'roof', [a[0], a[1] + 4.2, a[2]], [b[0], b[1] + 4.2, b[2]], 6, 0.35);
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      p = a.map((v, k) => v * (1 - t) + b[k] * t),
      dx = b[0] - a[0],
      dz = b[2] - a[2],
      l = Math.hypot(dx, dz);
    for (const s of [-1, 1]) {
      const x = p[0] + ((s * dz) / l) * 2.25,
        z = p[2] - ((s * dx) / l) * 2.25;
      box(o, 'wood', x, p[1], z, 0.45, 4.2, 0.45);
    }
  }
  const y = 0;
  box(o, 'stone', 49, y - 0.45, 20, 14, 0.45, 14);
  for (const x of [-5.5, 5.5])
    for (const z of [-5.5, 5.5]) box(o, 'wood', 49 + x, y, 20 + z, 0.65, 4.2, 0.65);
  hip(o, 49, 20, 16, 16, 4.2, 3.7);
  if (lod >= 2)
    for (const s of [-1, 1]) {
      beam(o, 'wood', [43.5, 3.7, 20 + s * 5.5], [46, 2, 20 + s * 5.5], 0.2, 0.2);
      beam(o, 'wood', [54.5, 3.7, 20 + s * 5.5], [52, 2, 20 + s * 5.5], 0.2, 0.2);
    }
}
export function buildCanyon(o, _frame, lod = 3) {
  count = 0;
  partEvidence.length = 0;
  windowEvidence.length = 0;
  const part = (id, fn) => {
    const n = count;
    fn();
    partEvidence.push({ id, triangles: count - n });
  };
  part('complete595ft-guest-range-including-integrated-old-west-wing-and-central-lobby', () => {
    room(
      o,
      0,
      -8,
      D.wholeRangeLength,
      D.mainRangeDepthEstimate,
      Y,
      D.mainRangeHeightEstimate,
      lod,
      D.mainRoofRiseEstimate,
      3,
    );
    for (const s of [-1, 1])
      for (let i = 0; i < 13; i++)
        dormer(
          o,
          -82 + i * 13.65,
          -8 + s * 9.1,
          i === 6 ? 9 : 6,
          5,
          Y + D.mainRangeHeightEstimate + 0.5,
          s,
          lod,
        );
    for (const x of [-28, 4, 29]) box(o, 'stone', x, Y + 17, -8, 1.1, 2.7, 1.1);
    if (lod >= 2) {
      for (const j of [0, 1, 2]) box(o, 'trim', 0, Y + j * 3.4, -8, 182, 0.16, 24.3);
    }
  });
  part('whole200x100ft-south-lounge-and-both-pillared-side-porches', () => lounge(o, lod));
  part('north-dining-bow-kitchen-and-further-laundry', () => service(o, lod));
  part('sloping-covered-arcade-and-open-porte-cochere', () => entry(o, lod));
}
export const canyonSkyline = (o) => buildCanyon(o, null, 0),
  canyonDistrict = (o) => buildCanyon(o, null, 1),
  canyonStreet = (o) => buildCanyon(o, null, 2),
  canyonCloseup = (o) => buildCanyon(o, null, 3);
const root = 'content/worldgen/source/places/9x/9xc/canyon_hotel',
  look = [0, Y + 8, -20];
export const canyonModel = {
  id: 'canyon_hotel',
  key: 'canyon_hotel',
  cell: '9x/9xc',
  title: 'Canyon Hotel, Yellowstone (1911)',
  wikidataId: 'Q2018142',
  category: 'hotel-commercial',
  recipe: 'canyon-hotel-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildCanyon,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: P.sectionBasis,
  brief: P.geometryBasis,
  appearance: {
    kind: 'historical',
    representedDate: '1911-08-02',
    validFrom: '1911-06-15',
    validUntil: '1929-12-31',
    currentWorldEligible: false,
  },
  camera: [170, 140, 240],
  lookAt: look,
  portableGroundY: Y - 6.7,
  mediumFiContext: {
    scale: 1.12,
    groundY: Y - 6.7,
    far: 1800,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['wood_weatherboard', 'concrete_plain', 'slate'],
  groundCutout: {
    minHeight: Y - 5.6,
    outline: P.physicalGroundOutlines[0],
    additionalOutlines: P.physicalGroundOutlines.slice(1),
    basis:
      'Only estimated whole-hotel physical outlines. Retains originalunmaskedfield; not a surveyed historic footprint or1911hostcontact certificate.',
  },
  qaCameras: [
    {
      name: 'whole1911-south-front-and-long-dormered-wings',
      position: [140, 90, 240],
      lookAt: look,
    },
    {
      name: 'whole-north-service-range-and-roof-junctions',
      position: [-160, 150, -250],
      lookAt: look,
    },
    {
      name: 'south-lounge-glazing-gable-and-east-porch',
      position: [70, Y + 25, 100],
      lookAt: [0, Y + 6, 40],
    },
    {
      name: 'real-open-porte-cochere-and-sloping-arcade',
      position: [85, 23, 55],
      lookAt: [42, 5, 16],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-hotel-${reviewLod}`,
    position: [155, 125, 235],
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/canyon-hotel-model.mjs`,
    level: 'skyline',
    export: 'canyonSkyline',
    errorMeters: 3.5,
    surfaces,
    authoredLevels: {
      district: { export: 'canyonDistrict', errorMeters: 2, surfaces },
      street: { export: 'canyonStreet', errorMeters: 0.5, surfaces },
      closeup: { export: 'canyonCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [P.geometryBasis, P.sectionBasis, ...P.limits],
  sourceLicense:
    'Original authored geometry under repository license. Exact native expired original1911USbrochure/CommonsPD-US-expired/library record; no questionable Qualla/Flickrimage, bakedphotograph or modernreconstruction artwork. Primary architectural scalar dimensions and CC0Wikidata historic point; hidden layout/materialcolors/sections/registration estimated.',
};
